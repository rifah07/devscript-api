import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OneTimeTokenDocument = HydratedDocument<OneTimeToken>;

export enum TokenPurpose {
  OAUTH_CODE = 'oauth_code', // Google login → frontend exchange, 60 s
  PASSWORD_RESET = 'password_reset', // emailed link, 1 h
  EMAIL_VERIFY = 'email_verify', // emailed link after signup, 24 h
}

// Short-lived, single-use secrets. Only the SHA-256 hash is stored, so a
// database leak doesn't hand out working reset links.
@Schema({ timestamps: true })
export class OneTimeToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  declare tokenHash: string;

  @Prop({ type: String, enum: TokenPurpose, required: true })
  declare purpose: TokenPurpose;

  @Prop({ required: true })
  declare expiresAt: Date;

  // OAuth codes only: hash of the nonce cookie of the browser that started
  // the login. The code is useless in any other browser (login CSRF).
  @Prop({ type: String, default: null })
  declare bindingHash: string | null;
}

export const OneTimeTokenSchema = SchemaFactory.createForClass(OneTimeToken);

// TTL index: Mongo deletes expired tokens on its own (checked every ~60 s,
// so code must still compare expiresAt itself).
OneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
