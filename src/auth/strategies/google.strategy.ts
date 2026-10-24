import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // Google sign-in is optional: without its keys the app still boots and
    // GoogleAuthGuard answers 404 before this strategy is ever used
    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL: callbackURL || 'http://localhost/not-configured',
      scope: ['email', 'profile'],
    });
  }

  // Called automatically by Passport after Google confirms the user's identity
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      return done(new Error('Google account has no email'), false);
    }

    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email,
      // Google's own "this person controls this inbox" flag. Accounts are
      // matched by email, so an unverified one must never be trusted.
      emailVerified: profile.emails?.[0]?.verified === true,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value ?? '',
    };

    // Whatever we pass to done() becomes req.user in the callback route
    done(null, googleProfile);
  }
}
