import { ObjectType, Field } from '@nestjs/graphql';
import { UserModel } from '../../users/models/user.model';

@ObjectType()
export class AuthResponse {
  @Field()
  declare accessToken: string;

  // refreshToken is NOT in the GraphQL response.
  // It goes into an HttpOnly cookie via the REST controller.
  // We return it from the service so the controller can set the cookie.
  // GraphQL clients get it via the cookie automatically.
  refreshToken?: string;

  @Field(() => UserModel)
  declare user: UserModel;
}
