// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
//import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
//import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtSignOptions } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UserModel } from '../users/models/user.model';

import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { AuthResponse } from './dto/auth-response.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
      //      userAgent,
    );
  }

  async login(loginInput: LoginInput): Promise<AuthResponse> {
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
      //      userAgent,
    );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async generateAuthResponse(
    userId: string,
    email: string,
    user: UserDocument,
    // userAgent: string,
  ): Promise<AuthResponse> {
    const accessToken = this.signAccessToken(userId, email);
    //const refreshToken = await this.createRefreshToken(userId, userAgent); // ← await was missing

    return {
      accessToken,
      //refreshToken,
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
