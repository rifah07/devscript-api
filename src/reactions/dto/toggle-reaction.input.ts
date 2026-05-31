import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId, IsEnum } from 'class-validator';
import { ReactionType, ReactionTargetType } from '../schemas/reaction.schema';

@InputType()
export class ToggleReactionInput {
  @Field(() => ID)
  @IsMongoId()
  declare targetId: string;

  @Field(() => ReactionTargetType)
  @IsEnum(ReactionTargetType)
  declare targetType: ReactionTargetType;

  @Field(() => ReactionType)
  @IsEnum(ReactionType)
  declare type: ReactionType;
}
