import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class GalleryImageModel {
  @Field()
  declare url: string;

  @Field()
  declare publicId: string;

  @Field(() => Int)
  declare width: number;

  @Field(() => Int)
  declare height: number;

  @Field({ nullable: true })
  declare alt?: string;

  @Field(() => Int)
  declare order: number;

  @Field(() => Int)
  declare downloadCount: number;
  // variants is NOT stored in DB — computed on demand via field resolver
}
