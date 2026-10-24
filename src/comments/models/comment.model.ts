import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PublicUserModel } from '../../users/models/public-user.model';

@ObjectType()
export class CommentModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare body: string;

  @Field(() => PublicUserModel, { nullable: true })
  declare author?: PublicUserModel;

  @Field(() => ID)
  declare post: string;

  @Field(() => ID, { nullable: true })
  declare parent?: string;

  @Field()
  declare isDeleted: boolean;

  @Field(() => [CommentModel], { nullable: true })
  declare replies?: CommentModel[];

  @Field()
  declare createdAt: Date;
}
