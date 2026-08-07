import { ObjectType, Field, ID } from '@nestjs/graphql';
import { GalleryImageModel } from './gallery-image.model';

@ObjectType()
export class PostGalleryModel {
  @Field(() => ID)
  declare postId: string;

  @Field()
  declare postTitle: string;

  @Field(() => [GalleryImageModel])
  declare images: GalleryImageModel[];
}
