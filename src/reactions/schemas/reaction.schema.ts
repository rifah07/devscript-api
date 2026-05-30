import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReactionDocument = HydratedDocument<Reaction>;

export enum ReactionType {
  LIKE = 'like',
  HELPFUL = 'helpful',
  INSPIRING = 'inspiring',
  BRILLIANT = 'brilliant',
  SAVED = 'saved',
}

export enum ReactionTargetType {
  POST = 'post',
  COMMENT = 'comment',
}

@Schema({ timestamps: true })
export class Reaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  declare user: Types.ObjectId;

  // Polymorphic reference - can point to a Post or Comment
  @Prop({ type: Types.ObjectId, required: true })
  declare targetId: Types.ObjectId;

  @Prop({ enum: ReactionTargetType, required: true })
  declare targetType: ReactionTargetType;

  @Prop({ enum: ReactionType, required: true })
  declare type: ReactionType;

  @Prop()
  declare createdAt: Date;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);

// CRITICAL: This compound unique index prevents a user from
// reacting with the same emoji to the same target twice.
// MongoDB enforces this at the DB level - bulletproof.
ReactionSchema.index({ user: 1, targetId: 1, type: 1 }, { unique: true });

// For fetching all reactions on a post/comment
ReactionSchema.index({ targetId: 1, targetType: 1 });
