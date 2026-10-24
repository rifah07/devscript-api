import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserPlan, UserRole } from '../schemas/user.schema';
import { PublicUserModel } from './public-user.model';

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(UserPlan, { name: 'UserPlan' });

// Private view: only `me`, `updateProfile`, auth responses and admin.
@ObjectType()
export class UserModel extends PublicUserModel {
  @Field()
  declare email: string;

  @Field(() => UserRole)
  declare role: UserRole;

  @Field(() => UserPlan)
  declare plan: UserPlan;

  @Field()
  declare emailVerified: boolean;
}
