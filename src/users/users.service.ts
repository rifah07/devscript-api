import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { User, UserDocument } from './schemas/user.schema';
import { CreateUserInput } from './dto/create-user.input';
import { UserModel } from './models/user.model';

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

  async findByEmail(email: string): Promise<UserDocument | null> {
    // Note: we add .select('+password') ONLY here - the login flow.
    // This is the ONLY place we need the hashed password.
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  async findById(id: string): Promise<UserModel> {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.toModel(user);
  }

  private toModel(doc: UserDocument): UserModel {
    return {
      _id: doc._id.toString(), // ← ObjectId → string
      email: doc.email,
      name: doc.name,
      role: doc.role,
      bio: doc.bio,
      avatarUrl: doc.avatarUrl,
      createdAt: doc.createdAt,
    };
  }
}
