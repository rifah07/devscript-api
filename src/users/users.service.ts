import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { toUserModel } from './user.mapper';
import { PUBLIC_USER_FIELDS } from './public-user-fields';
import { PublicUserModel } from './models/public-user.model';

import { User, UserDocument } from './schemas/user.schema';
import { CreateUserInput } from './dto/create-user.input';
import { UserModel } from './models/user.model';
import { UpdateProfileInput } from './dto/update-user.input';
import { AuthProvider } from './schemas/user.schema';
import type { GoogleProfile } from '../auth/strategies/google.strategy';

@Injectable()
export class UsersService {
  // Dependency Injection: NestJS automatically provides the User model.
  // @InjectModel connects the Mongoose model we registered in the module.
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserInput: CreateUserInput): Promise<UserDocument> {
    // 1. Check for duplicate email BEFORE hashing password
    const existingUser = await this.userModel.findOne({
      email: createUserInput.email.toLowerCase(),
    });

    if (existingUser) {
      // Use 409 Conflict, not 400 Bad Request.
      // 400 = you sent bad data. 409 = data conflicts with existing state.
      throw new ConflictException('Email already registered');
    }

    // 2. Hash password. Salt rounds = 12.
    // Higher rounds = more secure but slower.
    // 10-12 is the production sweet spot.
    const hashedPassword = await bcrypt.hash(createUserInput.password, 12);

    // 3. Create and save. Mongoose validates against schema before saving.
    const user = new this.userModel({
      ...createUserInput,
      password: hashedPassword,
      email: createUserInput.email.toLowerCase(),
    });

    return user.save();
  }

  // linkedExisting = true when Google was just attached to an account that
  // was created with email + password. The caller must then end every old
  // session (see AuthService.findOrCreateGoogleUser).
  async findOrCreateFromGoogle(
    profile: GoogleProfile,
  ): Promise<{ user: UserDocument; linkedExisting: boolean }> {
    // Case 1: user already signed in with Google before - find by googleId
    let user = await this.userModel.findOne({ googleId: profile.googleId });
    if (user) return { user, linkedExisting: false };

    // Everything below matches accounts by email, so Google must vouch for it.
    if (!profile.emailVerified) {
      throw new UnauthorizedException(
        'Your Google account email is not verified',
      );
    }

    // Case 2: an email/password account with the same email exists. Sign-up
    // never proved that whoever set that password owns the inbox; Google
    // just did. So the inbox owner wins: link Google, and remove the old
    // password. Otherwise someone could register victim@gmail.com first and
    // keep a back door into the victim's account (pre-account takeover).
    // The owner can set a new password any time with "forgot password".
    // If the account's email was already verified, the password belongs to
    // the inbox owner too, so it stays.
    user = await this.userModel.findOne({ email: profile.email.toLowerCase() });
    if (user) {
      const untrustedPassword = !user.emailVerified;
      user.googleId = profile.googleId;
      user.emailVerified = true;
      if (untrustedPassword) {
        user.authProvider = AuthProvider.GOOGLE;
        user.set('password', undefined);
      }
      if (!user.avatarUrl && profile.avatarUrl) {
        user.avatarUrl = profile.avatarUrl;
      }
      await user.save();
      return { user, linkedExisting: untrustedPassword };
    }

    // Case 3: brand new user - create the account
    user = await this.userModel.create({
      email: profile.email.toLowerCase(),
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      authProvider: AuthProvider.GOOGLE,
      googleId: profile.googleId,
      emailVerified: true, // Google verified it (checked above)
      // No password - schema's conditional `required` allows this
      // since authProvider is GOOGLE, not LOCAL
    });

    return { user, linkedExisting: false };
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    // Note: we add .select('+password') ONLY here - the login flow.
    // This is the ONLY place we need the hashed password.
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  async findByIdRaw(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  // For anyone-can-see lookups (profile pages, REST /users/:id).
  async findPublicById(id: string): Promise<PublicUserModel> {
    const user = await this.userModel
      .findOne({ _id: id, isActive: true })
      .select(PUBLIC_USER_FIELDS)
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return { ...user, _id: user._id.toString() };
  }

  async findById(id: string): Promise<UserModel> {
    const user = await this.findByIdRaw(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return toUserModel(user);
  }

  // profile picture, bio, website, social links

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserModel> {
    // Remove undefined fields — only update what was provided
    const updates: Partial<Record<string, unknown>> = {};
    if (input.name !== undefined) updates['name'] = input.name;
    if (input.bio !== undefined) updates['bio'] = input.bio;
    if (input.website !== undefined) updates['website'] = input.website;
    if (input.github !== undefined) updates['github'] = input.github;
    if (input.twitter !== undefined) updates['twitter'] = input.twitter;
    if (input.leetcode !== undefined) updates['leetcode'] = input.leetcode;

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true }, // return updated document
      )
      .exec();

    if (!user) throw new NotFoundException('User not found');

    return toUserModel(user);
  }

  async updateAvatar(
    userId: string,
    avatarUrl: string,
    avatarPublicId: string,
  ): Promise<UserModel> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { avatarUrl, avatarPublicId } },
        { new: true },
      )
      .exec();

    if (!user) throw new NotFoundException('User not found');

    return toUserModel(user);
  }

  // Only called after the user proved inbox access (reset link), so the
  // email counts as verified too.
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { password: passwordHash, emailVerified: true } },
    );
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { emailVerified: true } },
    );
  }

  async getAvatarPublicId(userId: string): Promise<string | null> {
    const user = await this.userModel
      .findById(userId)
      .select('avatarPublicId')
      .exec();

    return user?.avatarPublicId ?? null;
  }
}
