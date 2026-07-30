import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PostSpace } from '../../posts/schemas/post.schema';

export type SeriesDocument = HydratedDocument<Series>;

@Schema({ timestamps: true })
export class Series {
  @Prop({ required: true, trim: true })
  declare title: string;

  @Prop({ required: true, unique: true, index: true })
  declare slug: string;

  @Prop({ default: '', maxlength: 500 })
  declare description: string;

  @Prop({ default: '' })
  declare coverImageUrl: string;

  @Prop({ default: '' })
  declare coverImagePublicId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  declare author: Types.ObjectId;

  @Prop({ enum: PostSpace, required: true, index: true })
  declare space: PostSpace;

  // Cached - updated when posts are added/removed from series
  @Prop({ default: 0 })
  declare postCount: number;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const SeriesSchema = SchemaFactory.createForClass(Series);

SeriesSchema.index({ author: 1, space: 1 });
