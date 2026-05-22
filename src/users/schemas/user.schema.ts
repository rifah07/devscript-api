import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// This is a Mongoose schema - it defines how data is stored in MongoDB.
// HydratedDocument gives you the Document type with your User type merged.
export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
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

  @Prop({ required: true, select: false })
  declare password: string;

  @Prop({ enum: UserRole, default: UserRole.USER })
  declare role: UserRole;

  @Prop({ default: '' })
  declare bio: string;

  @Prop({ default: '' })
  declare avatarUrl: string;

  @Prop({ default: true })
  declare isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
