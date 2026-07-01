import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookmarkDocument = HydratedDocument<Bookmark>;

@Schema({ timestamps: true })
export class Bookmark {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  declare post: Types.ObjectId;

  @Prop()
  declare createdAt: Date;
}

export const BookmarkSchema = SchemaFactory.createForClass(Bookmark);

// Unique: one bookmark per user per post
BookmarkSchema.index({ user: 1, post: 1 }, { unique: true });

// For fetching user's bookmarks sorted by newest first
BookmarkSchema.index({ user: 1, createdAt: -1 });
