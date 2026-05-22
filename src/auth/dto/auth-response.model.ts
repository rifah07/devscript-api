import { ObjectType, Field } from '@nestjs/graphql';
import { UserModel } from '../../users/models/user.model';

@ObjectType()
export class AuthResponse {
  @Field()
  declare accessToken: string;

  @Field(() => UserModel)
  declare user: UserModel;
}
