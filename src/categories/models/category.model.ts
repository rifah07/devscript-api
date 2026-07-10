import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class CategoryModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare name: string;

  @Field()
  declare slug: string;

  @Field({ nullable: true })
  declare description?: string;

  @Field(() => Int)
  declare postCount: number;

  @Field()
  declare createdAt: Date;
}
