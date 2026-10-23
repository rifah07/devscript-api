import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { OAUTH_NONCE_COOKIE, parseState } from './oauth-state';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import {
  ResendVerificationInput,
  VerifyEmailInput,
} from './dto/verify-email.input';

import { AuthService } from './auth.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { TypedRequest } from '../common/interfaces/typed-request.interface';
import { Throttle } from '@nestjs/throttler';
import { Query } from '@nestjs/common';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { GoogleProfile } from './strategies/google.strategy';
import {
  ExchangeCodeInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './dto/password-reset.input';

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
    const parsed = parseState(state);
    const site =
      parsed?.site === 'personal'
        ? process.env.MISK_JOURNAL_URL
        : process.env.DEVSCRIPT_URL;
    // A login we didn't start (missing or malformed state) goes nowhere.
    if (!parsed) return res.redirect(`${site}/login?error=google`);

    const user = await this.authService.findOrCreateGoogleUser(req.user);
    const code = await this.authService.createOAuthCode(
      user._id.toString(),
      parsed.nonce,
    );

    // No tokens in the URL (they'd sit in history and server logs), and no
    // cookie here (it would land on the API's domain, not the site's).
    // The frontend POSTs this code to /auth/google/exchange instead.
    res.redirect(`${site}/auth/callback?code=${code}`);
  }

  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Trade a one-time Google login code for tokens' })
  async exchangeGoogleCode(
    @Body() dto: ExchangeCodeInput,
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.exchangeOAuthCode(
      dto.code,
      req.cookies[OAUTH_NONCE_COOKIE],
      this.extractUserAgent(req),
    );
    res.clearCookie(OAUTH_NONCE_COOKIE, { path: '/' });
    this.setRefreshCookie(res, result.refreshToken ?? '');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Confirm an email address with the emailed token' })
  async verifyEmail(@Body() dto: VerifyEmailInput) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email confirmed.' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Email a new confirmation link to yourself' })
  async resendVerification(
    @CurrentUser() user: UserDocument,
    @Body() dto: ResendVerificationInput,
  ) {
    await this.authService.resendVerificationEmail(user, dto.space);
    return {
      message: 'If your email isn’t confirmed yet, a new link is on its way.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Email a password reset link (always succeeds)' })
  async forgotPassword(@Body() dto: ForgotPasswordInput) {
    await this.authService.forgotPassword(dto.email, dto.space);
    return {
      message: 'If that email has an account, a reset link is on its way.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  async resetPassword(@Body() dto: ResetPasswordInput) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password updated. Please log in again.' };
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

    // 401 (not 200) so the frontend's refresh() sees a failure.
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

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
