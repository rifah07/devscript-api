import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
}

export enum PostSpace {
  DEVSCRIPT = 'devscript',
  PERSONAL = 'personal',
}

export enum PostType {
  ARTICLE = 'article', // technical writing, tutorials
  POEM = 'poem', // poetry
  REFLECTION = 'reflection', // Islamic knowledge, life reflections
  NOTE = 'note', // short-form thoughts
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

  @Prop({ default: 0, index: true })
  declare viewCount: number;

  // Store unique viewer IDs — prevents counting same user twice
  // We use a Set-like array with a sparse index
  // Cap at 1000 unique viewers to prevent unbounded growth
  @Prop({ type: [String], default: [] })
  declare uniqueViewers: string[];

  // Cached bookmark count — updated when bookmarks change
  // Storing it avoids a count query on every post fetch
  @Prop({ default: 0 })
  declare bookmarksCount: number;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null, index: true })
  declare category: Types.ObjectId | null;

  @Prop({
    enum: PostSpace,
    required: true,
    default: PostSpace.DEVSCRIPT,
    index: true,
  })
  declare space: PostSpace;

  @Prop({
    enum: PostType,
    required: true,
    default: PostType.ARTICLE,
    index: true,
  })
  declare postType: PostType;

  // Cover image — used by both spaces
  @Prop({ default: '' })
  declare coverImageUrl: string;

  @Prop({ default: '' })
  declare coverImagePublicId: string;

  // Image gallery — mainly for PERSONAL space (poetry + pinterest-style visuals)
  @Prop({
    type: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        alt: { type: String, default: '' },
        order: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  declare gallery: {
    url: string;
    publicId: string;
    width: number;
    height: number;
    alt: string;
    order: number;
  }[];

  // Open Graph metadata — for rich link previews on FB/Insta/Pinterest
  @Prop({ default: '' })
  declare ogTitle: string;

  @Prop({ default: '' })
  declare ogDescription: string;

  @Prop({ default: '' })
  declare ogImage: string; // usually same as coverImageUrl, but can differ

  @Prop({ default: null, index: true })
  declare scheduledAt: Date | null;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Text index for basic search - allows $text queries on title and body
PostSchema.index({ title: 'text', body: 'text' });
PostSchema.index({ category: 1, status: 1, createdAt: -1 });
PostSchema.index({ space: 1, status: 1, createdAt: -1 });
PostSchema.index({ space: 1, postType: 1, status: 1, createdAt: -1 });
