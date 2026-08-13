import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { GraphQLJSON } from '../comments/scalars/graphql-json.scalar';
import { AccountService, UserDataExport } from './account.service';
import { DeleteAccountInput } from './dto/delete-account.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Resolver()
export class AccountResolver {
  constructor(private readonly accountService: AccountService) {}

  @Query(() => GraphQLJSON, { name: 'exportMyData' })
  @UseGuards(JwtAuthGuard)
  async exportMyData(
    @CurrentUser() user: UserDocument,
  ): Promise<UserDataExport> {
    return this.accountService.exportUserData(user._id.toString());
  }
  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteMyAccount(
    @Args('input') input: DeleteAccountInput,
    @CurrentUser() user: UserDocument,
  ): Promise<boolean> {
    return this.accountService.deleteAccount(user, input.password);
  }
}
