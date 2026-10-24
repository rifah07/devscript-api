import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtSignOptions } from '@nestjs/jwt';
import { toUserModel } from '../users/user.mapper';

import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { AuthResponse } from './dto/auth-response.model';
import { GoogleProfile } from './strategies/google.strategy';
import {
  OneTimeToken,
  OneTimeTokenDocument,
  TokenPurpose,
} from './schemas/one-time-token.schema';
import { EmailService } from '../email/email.service';
import { PostSpace } from '../posts/schemas/post.schema';
import { siteFor } from '../common/utils/site.util';

// A real bcrypt hash of a random string. Comparing against it when the
// email is unknown makes "no such user" take as long as "wrong password",
// so response time can't be used to discover registered emails.
const DUMMY_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5h3l3P4p7bFz0WqzQ8O3Jt9nqV1ZQ2a';
const OAUTH_CODE_TTL_S = 60;
const RESET_TOKEN_TTL_S = 60 * 60;
const EMAIL_VERIFY_TTL_S = 24 * 60 * 60;

interface JwtPayload {
  sub: string;
  email: string;
  type: string;
}
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(OneTimeToken.name)
    private readonly oneTimeTokenModel: Model<OneTimeTokenDocument>,
    private readonly emailService: EmailService,
  ) {}

  async register(
    registerInput: RegisterInput,
    userAgent = '',
  ): Promise<AuthResponse> {
    const { space = PostSpace.DEVSCRIPT, ...fields } = registerInput;
    const user = await this.usersService.create(fields);
    await this.sendVerificationEmail(user, space);
    return this.generateAuthResponse(
      user._id.toString(),
      user.email,
      user,
      userAgent,
    );
  }

  async login(loginInput: LoginInput, userAgent = ''): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginInput.email);

    // Always run bcrypt, even with no user (or a Google-only user with no
    // password): same work, same timing, same generic message.
    const isPasswordValid = await bcrypt.compare(
      loginInput.password,
      user?.password || DUMMY_HASH,
    );

    if (!user?.password || !isPasswordValid || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAuthResponse(
      user._id.toString(),
      user.email,
      user,
      userAgent,
    );
  }

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<UserDocument> {
    const { user, linkedExisting } =
      await this.usersService.findOrCreateFromGoogle(profile);
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    // Whoever held the old password may still be logged in: end it all.
    if (linkedExisting) await this.revokeAllUserTokens(user._id.toString());
    return user;
  }

  async refreshTokens(
    rawRefreshToken: string,
    userAgent = '',
  ): Promise<AuthResponse> {
    // Step 1: verify JWT signature and expiry
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Step 2: ensure this is a refresh token, not an access token
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Step 3: check the token exists in DB and is not revoked
    const tokenHash = this.hashToken(rawRefreshToken);

    const storedToken = await this.refreshTokenModel.findOne({
      userId: new Types.ObjectId(payload.sub),
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token not found or already used',
      );
    }

    // Step 4: delete old token — refresh token rotation
    await storedToken.deleteOne();

    // Step 5: fetch user and issue new tokens
    const user = await this.usersService.findByIdRaw(payload.sub);

    // Deactivated by an admin = no new sessions, even with a valid cookie.
    if (!user?.isActive) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.generateAuthResponse(
      user._id.toString(),
      user.email,
      user,
      userAgent,
    );
  }

  // Google login can't set a cookie for the frontend's domain (the callback
  // runs on the API's domain). So it hands the browser a 60-second code, and
  // the frontend trades it for tokens through its same-origin proxy.
  // `nonce` is the login-start cookie's value (see GoogleAuthGuard). Binding
  // the code to it means a code only works in the browser that asked for it,
  // so nobody can send you a link that logs you into THEIR account.
  async createOAuthCode(userId: string, nonce: string): Promise<string> {
    return this.createOneTimeToken(
      userId,
      TokenPurpose.OAUTH_CODE,
      OAUTH_CODE_TTL_S,
      nonce,
    );
  }

  async exchangeOAuthCode(
    code: string,
    nonce: string | undefined,
    userAgent = '',
  ): Promise<AuthResponse> {
    if (!nonce) throw new UnauthorizedException('Invalid or expired code');
    const userId = await this.consumeOneTimeToken(
      code,
      TokenPurpose.OAUTH_CODE,
      nonce,
    );
    const user = await this.usersService.findByIdRaw(userId);
    if (!user?.isActive)
      throw new UnauthorizedException('Invalid or expired code');
    return this.generateAuthResponse(userId, user.email, user, userAgent);
  }

  // Always resolves true: the caller must not learn whether the email exists.
  async forgotPassword(email: string, space: PostSpace): Promise<boolean> {
    const user = await this.usersService.findByEmail(email);
    if (!user?.isActive) return true;

    // One active reset link per user: a new request kills the old one.
    await this.oneTimeTokenModel.deleteMany({
      userId: user._id,
      purpose: TokenPurpose.PASSWORD_RESET,
    });
    const token = await this.createOneTimeToken(
      user._id.toString(),
      TokenPurpose.PASSWORD_RESET,
      RESET_TOKEN_TTL_S,
    );

    const site = siteFor(this.configService, space);
    await this.emailService.sendPasswordResetEmail(
      user.email,
      site.name,
      `${site.url}/reset-password?token=${token}`,
    );
    return true;
  }

  // ─── Email verification ───────────────────────────────────────────────────

  // One active link per user; a new one replaces the old.
  private async sendVerificationEmail(
    user: UserDocument,
    space: PostSpace,
  ): Promise<void> {
    await this.oneTimeTokenModel.deleteMany({
      userId: user._id,
      purpose: TokenPurpose.EMAIL_VERIFY,
    });
    const token = await this.createOneTimeToken(
      user._id.toString(),
      TokenPurpose.EMAIL_VERIFY,
      EMAIL_VERIFY_TTL_S,
    );
    const site = siteFor(this.configService, space);
    await this.emailService.sendVerificationEmail(
      user.email,
      site.name,
      `${site.url}/verify-email?token=${token}`,
    );
  }

  async resendVerificationEmail(
    user: UserDocument,
    space: PostSpace,
  ): Promise<boolean> {
    if (!user.emailVerified) await this.sendVerificationEmail(user, space);
    return true;
  }

  async verifyEmail(token: string): Promise<boolean> {
    const userId = await this.consumeOneTimeToken(
      token,
      TokenPurpose.EMAIL_VERIFY,
    );
    await this.usersService.markEmailVerified(userId);
    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const userId = await this.consumeOneTimeToken(
      token,
      TokenPurpose.PASSWORD_RESET,
    );
    await this.usersService.setPassword(
      userId,
      await bcrypt.hash(newPassword, 12),
    );
    // Whoever had the old password may hold sessions: end all of them.
    await this.revokeAllUserTokens(userId);
    return true;
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenModel.deleteOne({ tokenHash });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async generateAuthResponse(
    userId: string,
    email: string,
    user: UserDocument,
    userAgent: string,
  ): Promise<AuthResponse> {
    const accessToken = this.signAccessToken(userId, email);
    const refreshToken = await this.createRefreshToken(userId, userAgent);

    return {
      accessToken,
      refreshToken,
      user: toUserModel(user),
    };
  }

  private signAccessToken(userId: string, email: string): string {
    const secret = this.configService.get<string>('jwt.secret');
    const expiresIn = this.configService.get<string>('jwt.expiresIn');

    const options: JwtSignOptions = {
      secret,
      ...(expiresIn && { expiresIn: expiresIn as JwtSignOptions['expiresIn'] }),
    };

    return this.jwtService.sign(
      { sub: userId, email, type: 'access' },
      options,
    );
  }

  private async createRefreshToken(
    userId: string,
    userAgent: string,
  ): Promise<string> {
    const secret = this.configService.get<string>('jwt.refreshSecret');
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn');

    const options: JwtSignOptions = {
      secret,
      ...(expiresIn && { expiresIn: expiresIn as JwtSignOptions['expiresIn'] }),
    };

    const rawToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      options,
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: this.hashToken(rawToken),
      expiresAt,
      userAgent,
    });

    return rawToken;
  }

  private async createOneTimeToken(
    userId: string,
    purpose: TokenPurpose,
    ttlSeconds: number,
    binding?: string,
  ): Promise<string> {
    // 32 random bytes = 256 bits: unguessable. base64url is safe in URLs.
    const raw = crypto.randomBytes(32).toString('base64url');
    await this.oneTimeTokenModel.create({
      userId: new Types.ObjectId(userId),
      tokenHash: this.hashToken(raw),
      purpose,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      bindingHash: binding ? this.hashToken(binding) : null,
    });
    return raw;
  }

  // findOneAndDelete is atomic: two concurrent requests with the same token
  // can't both succeed. That is what makes the token single-use.
  private async consumeOneTimeToken(
    raw: string,
    purpose: TokenPurpose,
    binding?: string,
  ): Promise<string> {
    const doc = await this.oneTimeTokenModel.findOneAndDelete({
      tokenHash: this.hashToken(raw),
      purpose,
      expiresAt: { $gt: new Date() },
      bindingHash: binding ? this.hashToken(binding) : null,
    });
    if (!doc) throw new UnauthorizedException('Invalid or expired token');
    return doc.userId.toString();
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
