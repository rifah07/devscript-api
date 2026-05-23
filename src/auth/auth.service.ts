import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtSignOptions } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UserModel } from '../users/models/user.model';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { AuthResponse } from './dto/auth-response.model';

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
  ) {}

  async register(
    registerInput: RegisterInput,
    userAgent = '',
  ): Promise<AuthResponse> {
    const user = await this.usersService.create(registerInput);
    return this.generateAuthResponse(
      user._id.toString(),
      user.email,
      user,
      userAgent,
    );
  }

  async login(loginInput: LoginInput, userAgent = ''): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginInput.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginInput.password,
      user.password,
    );

    if (!isPasswordValid || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAuthResponse(
      user._id.toString(),
      user.email,
      user,
      userAgent,
    );
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

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.generateAuthResponse(
      user._id.toString(),
      user.email,
      user,
      userAgent,
    );
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
      user: this.toUserModel(user),
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

  private toUserModel(doc: UserDocument): UserModel {
    return {
      _id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      role: doc.role,
      bio: doc.bio,
      avatarUrl: doc.avatarUrl,
      createdAt: doc.createdAt,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
