import { Field, ID, ObjectType } from '@nestjs/graphql';

// What anyone may see about a user. GraphQL only serializes @Field members,
// so returning a full UserDocument typed as this still never leaks email/role.
@ObjectType()
export class PublicUserModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare name: string;

  @Field({ nullable: true })
  declare bio?: string;

  @Field({ nullable: true })
  declare avatarUrl?: string;

  @Field({ nullable: true })
  declare website?: string;

  @Field({ nullable: true })
  declare github?: string;

  @Field({ nullable: true })
  declare leetcode?: string;

  @Field({ nullable: true })
  declare twitter?: string;

  @Field({ nullable: true })
  declare createdAt?: Date;
}
