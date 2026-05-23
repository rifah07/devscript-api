import {
  Controller,
  Post,
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

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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
