import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// This is a Mongoose schema - it defines how data is stored in MongoDB.
// HydratedDocument gives you the Document type with your User type merged.
export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
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

  @Prop({ enum: AuthProvider, default: AuthProvider.LOCAL })
  declare authProvider: AuthProvider;

  @Prop({
    required: function (this: User) {
      return this.authProvider === AuthProvider.LOCAL;
    },
    select: false,
  })
  declare password: string;

  @Prop({ default: null, index: true, sparse: true })
  declare googleId: string | null;

  @Prop({ enum: UserRole, default: UserRole.USER })
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

  @Prop({ default: '' })
  declare penName: string;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
