import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, trim: true })
  declare title: string;

  // Slug is auto-generated from title - unique URL identifier
  // e.g. "My NestJS Guide" → "my-nestjs-guide-1748291234"
  // Index: true because we query by slug on every post page load
  @Prop({ required: true, unique: true, index: true })
  declare slug: string;

  @Prop({ required: true })
  declare body: string;

  // AI-generated summary - optional, filled after creation
  @Prop({ default: '' })
  declare summary: string;

  // Tags array - index for filtering by tag
  @Prop({ type: [String], default: [] })
  declare tags: string[];

  // ref: 'User' tells Mongoose which collection to populate from
  // index: true because we filter posts by author frequently
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare author: Types.ObjectId;

  @Prop({ enum: PostStatus, default: PostStatus.DRAFT, index: true })
  declare status: PostStatus;

  // Read time in minutes - computed on save, stored for performance
  @Prop({ default: 0 })
  declare readTime: number;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Compound index: fetching all published posts sorted by date
// This is the most common query in the entire app
PostSchema.index({ status: 1, createdAt: -1 });

// Text index for basic search - allows $text queries on title and body
PostSchema.index({ title: 'text', body: 'text' });
