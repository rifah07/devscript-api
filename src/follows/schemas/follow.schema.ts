import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FollowDocument = HydratedDocument<Follow>;

@Schema({ timestamps: true })
export class Follow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare follower: Types.ObjectId; // the person who clicked "follow"

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare following: Types.ObjectId; // the person being followed

  @Prop()
  declare createdAt: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

// Prevent duplicate follows at DB level — bulletproof against race conditions
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });

// For fetching "who follows user X" fast
FollowSchema.index({ following: 1, createdAt: -1 });

// For fetching "who is user X following" fast
FollowSchema.index({ follower: 1, createdAt: -1 });
