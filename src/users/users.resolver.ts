import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserModel } from './models/user.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileInput } from './dto/update-user.input';
import type { UserDocument } from './schemas/user.schema';

// THIN RESOLVER RULE: Resolvers only do two things:
// 1. Call the service
// 2. Return the result
// ALL business logic lives in the service.
@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => UserModel, { name: 'me' })
  @UseGuards(JwtAuthGuard) // Protect this query — must be logged in
  async getMe(@CurrentUser() user: UserDocument): Promise<UserModel> {
    // CurrentUser decorator extracts the user from GraphQL context
    // (which was put there by the JWT guard)
    return this.usersService.findById(user._id.toString());
  }

  @Query(() => UserModel, { name: 'user' })
  async getUserById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<UserModel> {
    return this.usersService.findById(id);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Args('input') input: UpdateProfileInput,
    @CurrentUser() user: UserDocument,
  ): Promise<UserModel> {
    return this.usersService.updateProfile(user._id.toString(), input);
  }
}
