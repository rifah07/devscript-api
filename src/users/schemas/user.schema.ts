import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// This is a Mongoose schema - it defines how data is stored in MongoDB.
// HydratedDocument gives you the Document type with your User type merged.
export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

// Extension point for paid tiers: limits per plan live in ai/ai-plans.ts.
export enum UserPlan {
  FREE = 'free',
  PREMIUM = 'premium',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  declare email: string;

  @Prop({ required: true, minlength: 2, maxlength: 50 })
  declare name: string;

  @Prop({ type: String, enum: AuthProvider, default: AuthProvider.LOCAL })
  declare authProvider: AuthProvider;

  @Prop({
    required: function (this: User) {
      return this.authProvider === AuthProvider.LOCAL;
    },
    select: false,
  })
  declare password: string;

  @Prop({ type: String, default: null, index: true, sparse: true })
  declare googleId: string | null;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  declare role: UserRole;

  @Prop({ default: '' })
  declare bio: string;

  @Prop({ default: '' })
  declare avatarUrl: string;

  @Prop({ default: '' })
  declare avatarPublicId: string; // ← store Cloudinary public_id for deletion

  @Prop({ default: '' })
  declare website: string;

  @Prop({ default: '' })
  declare github: string;

  @Prop({ default: '' })
  declare leetcode: string;

  @Prop({ default: '' })
  declare twitter: string;

  @Prop({ default: true })
  declare isActive: boolean;

  // True once the owner proved they control the inbox: clicked the emailed
  // link, reset their password by email, or signed in with Google.
  @Prop({ default: false })
  declare emailVerified: boolean;

  @Prop({ type: String, enum: UserPlan, default: UserPlan.FREE })
  declare plan: UserPlan;

  // Today's AI usage: { day: 'YYYY-MM-DD', count }. Reset implicitly when
  // the day changes (see AiQuotaService). select:false keeps it internal.
  @Prop({
    type: { day: String, count: Number },
    default: { day: '', count: 0 },
    select: false,
  })
  declare aiUsage: { day: string; count: number };

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
