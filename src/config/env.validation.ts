import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  validateSync,
} from 'class-validator';

// Fail fast: a missing secret should crash boot, not 500 on the first request.
class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  declare NODE_ENV: string;

  @IsString() @IsNotEmpty() declare MONGODB_URI: string;

  @IsString() @MinLength(32) declare JWT_SECRET: string;
  @IsString() @MinLength(32) declare REFRESH_TOKEN_SECRET: string;

  @IsString() @IsNotEmpty() declare CLOUDINARY_CLOUD_NAME: string;
  @IsString() @IsNotEmpty() declare CLOUDINARY_API_KEY: string;
  @IsString() @IsNotEmpty() declare CLOUDINARY_API_SECRET: string;

  @IsString() @IsNotEmpty() declare GEMINI_API_KEY: string;
  // Optional: without it, emails are logged instead of sent (handy locally)
  @IsOptional() @IsString() declare BREVO_API_KEY?: string;
  @IsOptional() @IsEmail() declare EMAIL_FROM?: string;

  @IsUrl({ require_tld: false }) declare DEVSCRIPT_URL: string;
  @IsUrl({ require_tld: false }) declare MISK_JOURNAL_URL: string;

  @IsOptional() @IsString() @MinLength(16) declare CRON_SECRET?: string;
  @IsOptional() @IsString() @MinLength(32) declare INTERNAL_API_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  // `KEY=` in a .env file arrives as '', which means "not set".
  const present = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== ''),
  );
  const env = plainToInstance(EnvironmentVariables, present);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const lines = errors.map(
      (e) =>
        `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  return config;
}
