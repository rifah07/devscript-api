import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ImageVariants {
  @Field()
  declare thumbnail: string;

  @Field()
  declare square: string;

  @Field()
  declare pinterestPin: string;

  @Field()
  declare landscape: string;

  @Field()
  declare story: string;

  @Field()
  declare original: string;
}
