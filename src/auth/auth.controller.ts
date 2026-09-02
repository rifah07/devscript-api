import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { TypedRequest } from '../common/interfaces/typed-request.interface';
import { Throttle } from '@nestjs/throttler';
import { Query } from '@nestjs/common';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { GoogleProfile } from './strategies/google.strategy';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute per IP
  async register(
    @Body() dto: RegisterInput,
    @Res({ passthrough: true }) res: Response,
    @Req() req: TypedRequest,
  ) {
    const userAgent = this.extractUserAgent(req);
    const result = await this.authService.register(dto, userAgent);
    this.setRefreshCookie(res, result.refreshToken ?? '');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginInput,
    @Res({ passthrough: true }) res: Response,
    @Req() req: TypedRequest,
  ) {
    const userAgent = this.extractUserAgent(req);
    const result = await this.authService.login(dto, userAgent);
    this.setRefreshCookie(res, result.refreshToken ?? '');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth consent screen' })
  googleLogin(): void {
    // This route's body never executes — GoogleAuthGuard intercepts
    // the request and redirects to Google before we get here
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback — exchanges code for tokens',
  })
  async googleCallback(
    @Req() req: TypedRequest & { user: GoogleProfile },
    @Res() res: Response,
    @Query('state') state?: string, // optional — carries which frontend/space initiated login
  ) {
    const userAgent = req.headers['user-agent'];
    const ua = Array.isArray(userAgent) ? userAgent[0] : userAgent;

    const result = await this.authService.loginWithGoogle(req.user, ua ?? '');

    this.setRefreshCookie(res, result.refreshToken ?? '');

    // Redirect back to the frontend with the access token as a query param.
    // The frontend reads it once from the URL, stores it in memory, then
    // should immediately clean the URL (history.replaceState) so the token
    // doesn't linger in browser history or get shared accidentally.
    const redirectBase =
      state === 'personal'
        ? (process.env.MISK_JOURNAL_URL ?? 'http://localhost:5173')
        : (process.env.DEVSCRIPT_URL ?? 'http://localhost:3000');

    res.redirect(
      `${redirectBase}/auth/callback?accessToken=${result.accessToken}`,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token using cookie' })
  async refresh(
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];

    if (!refreshToken) {
      return { message: 'No refresh token' };
    }

    const userAgent = this.extractUserAgent(req);
    const result = await this.authService.refreshTokens(
      refreshToken,
      userAgent,
    );
    this.setRefreshCookie(res, result.refreshToken ?? '');
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private extractUserAgent(req: TypedRequest): string {
    const ua = req.headers['user-agent'];
    return Array.isArray(ua) ? (ua[0] ?? '') : (ua ?? '');
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
