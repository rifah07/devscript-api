import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare userId: Types.ObjectId;

  // We store a HASH of the refresh token, never the raw value.
  // Same principle as passwords — if DB leaks, tokens are useless.
  @Prop({ required: true })
  declare tokenHash: string;

  // When this token expires. MongoDB's TTL index auto-deletes
  // expired documents — zero manual cleanup needed.
  @Prop({ required: true })
  declare expiresAt: Date;

  // Optional: track device for "manage sessions" feature later
  @Prop({ default: '' })
  declare userAgent: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index: MongoDB automatically deletes documents where
// expiresAt is in the past. Runs every 60 seconds.
// This is the cleanest way to handle token expiry cleanup.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
