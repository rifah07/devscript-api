import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ObjectType, Field } from '@nestjs/graphql';

import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth-response.model';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { GqlContext } from '../common/interfaces/gql-context.interface';
import type { UserDocument } from '../users/schemas/user.schema';

@ObjectType()
export class RefreshResponse {
  @Field()
  declare accessToken: string;
}

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async register(
    @Args('registerInput') registerInput: RegisterInput,
    @Context() context: GqlContext,
  ): Promise<AuthResponse> {
    const userAgent = this.extractUserAgent(context);
    const result = await this.authService.register(registerInput, userAgent);
    this.setRefreshCookie(context, result.refreshToken ?? '');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Mutation(() => AuthResponse)
  async login(
    @Args('loginInput') loginInput: LoginInput,
    @Context() context: GqlContext,
  ): Promise<AuthResponse> {
    const userAgent = this.extractUserAgent(context);
    const result = await this.authService.login(loginInput, userAgent);
    this.setRefreshCookie(context, result.refreshToken ?? '');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Mutation(() => RefreshResponse)
  async refreshToken(@Context() context: GqlContext): Promise<RefreshResponse> {
    const refreshToken = context.req.cookies['refresh_token'];

    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }

    const userAgent = this.extractUserAgent(context);
    const result = await this.authService.refreshTokens(
      refreshToken,
      userAgent,
    );
    this.setRefreshCookie(context, result.refreshToken ?? '');
    return { accessToken: result.accessToken };
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async logout(@Context() context: GqlContext): Promise<boolean> {
    const refreshToken = context.req.cookies['refresh_token'];

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    context.res.clearCookie('refresh_token');
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async logoutAllDevices(@CurrentUser() user: UserDocument): Promise<boolean> {
    await this.authService.revokeAllUserTokens(user._id.toString());
    return true;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private extractUserAgent(context: GqlContext): string {
    const ua = context.req.headers['user-agent'];
    return Array.isArray(ua) ? (ua[0] ?? '') : (ua ?? '');
  }

  private setRefreshCookie(context: GqlContext, token: string): void {
    context.res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
