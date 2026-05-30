import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 1000 })
  declare body: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare author: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  declare post: Types.ObjectId;

  // null = top-level comment. ObjectId = reply to a comment.
  // We only allow ONE level of nesting — no replies to replies.
  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null, index: true })
  declare parent: Types.ObjectId | null;

  // Soft delete - we keep the document but hide the body.
  // This preserves reply threading (a deleted comment with replies
  // shows "[deleted]" instead of breaking the thread).
  @Prop({ default: false })
  declare isDeleted: boolean;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Compound index: fetch all top-level comments for a post fast
CommentSchema.index({ post: 1, parent: 1, createdAt: 1 });
