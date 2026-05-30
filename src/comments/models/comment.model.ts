import { Field, ID, ObjectType } from '@nestjs/graphql';
import { UserModel } from '../../users/models/user.model';

@ObjectType()
export class CommentModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare body: string;

  @Field(() => UserModel, { nullable: true })
  declare author?: UserModel;

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
