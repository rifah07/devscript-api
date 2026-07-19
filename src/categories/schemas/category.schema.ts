import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PostSpace } from '../../posts/schemas/post.schema';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  declare name: string;

  @Prop({ required: true, unique: true, index: true })
  declare slug: string;

  @Prop({ default: '', maxlength: 300 })
  declare description: string;

  // Cached count — updated when posts are assigned/unassigned
  // Avoids a COUNT query every time categories are listed
  @Prop({ default: 0 })
  declare postCount: number;

  @Prop({ enum: PostSpace, required: true, index: true })
  declare space: PostSpace;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare updatedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
