import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PostSpace } from '../../posts/schemas/post.schema';

export type NewsletterSubscriberDocument =
  HydratedDocument<NewsletterSubscriber>;

@Schema({ timestamps: true })
export class NewsletterSubscriber {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  declare email: string;

  @Prop({ enum: PostSpace, required: true, index: true })
  declare space: PostSpace;

  // Double opt-in — subscriber isn't active until they click the confirmation link
  @Prop({ default: false, index: true })
  declare isConfirmed: boolean;

  // Random token used for both confirm and unsubscribe links —
  // avoids needing the subscriber to log in for either action
  @Prop({ required: true, unique: true })
  declare token: string;

  @Prop()
  declare createdAt: Date;

  @Prop()
  declare confirmedAt: Date;
}

export const NewsletterSubscriberSchema =
  SchemaFactory.createForClass(NewsletterSubscriber);

// One email can subscribe to BOTH spaces (DevScript AND Misk Journal)
// but not subscribe twice to the same space
NewsletterSubscriberSchema.index({ email: 1, space: 1 }, { unique: true });
