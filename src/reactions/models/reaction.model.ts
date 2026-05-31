import { Field, ID, ObjectType, Int, registerEnumType } from '@nestjs/graphql';
import { ReactionType, ReactionTargetType } from '../schemas/reaction.schema';

registerEnumType(ReactionType, { name: 'ReactionType' });
registerEnumType(ReactionTargetType, { name: 'ReactionTargetType' });

@ObjectType()
export class ReactionModel {
  @Field(() => ID)
  declare _id: string;

  @Field(() => ReactionType)
  declare type: ReactionType;

  @Field(() => ID)
  declare targetId: string;

  @Field(() => ReactionTargetType)
  declare targetType: ReactionTargetType;

  @Field()
  declare createdAt: Date;
}

// Summary of reactions for a post/comment - count per type
@ObjectType()
export class ReactionSummary {
  @Field(() => ReactionType)
  declare type: ReactionType;

  @Field(() => Int)
  declare count: number;

  // Did the current user react with this type?
  @Field()
  declare userReacted: boolean;
}
