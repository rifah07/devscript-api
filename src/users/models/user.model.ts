import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '../schemas/user.schema';

registerEnumType(UserRole, { name: 'UserRole' });

@ObjectType()
export class UserModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare email: string;

  @Field()
  declare name: string;

  @Field(() => UserRole)
  declare role: UserRole;

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
