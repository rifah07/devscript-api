import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Field, ObjectType, Int } from '@nestjs/graphql';

import { AdminService } from './admin.service';
import { PlatformStats } from './models/platform-stats.model';
import { ReportModel, PaginatedReports } from './models/report.model';
import { ReviewReportInput } from './dto/review-report.input';
import { AdminUsersFilterInput } from './dto/admin-users-filter.input';
import { ReportStatus } from './schemas/report.schema';
import { UserModel } from '../users/models/user.model';
import { UserRole } from '../users/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ObjectType()
class AdminUsersResult {
  @Field(() => [UserModel])
  declare users: UserModel[];

  @Field({ nullable: true })
  declare nextCursor?: string;

  @Field()
  declare hasNextPage: boolean;

  @Field(() => Int)
  declare totalCount: number;
}

// Apply both guards to every resolver in this class
// JwtAuthGuard: must be logged in
// RolesGuard: must have ADMIN role
@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  // ─── Stats ─────────────────────────────────────────────────────────────

  @Query(() => PlatformStats, { name: 'platformStats' })
  async getPlatformStats(): Promise<PlatformStats> {
    return this.adminService.getPlatformStats();
  }

  // ─── User management ───────────────────────────────────────────────────

  @Query(() => AdminUsersResult, { name: 'adminUsers' })
  async getAllUsers(
    @Args('filter', { nullable: true }) filter?: AdminUsersFilterInput,
  ): Promise<AdminUsersResult> {
    return this.adminService.getAllUsers(filter ?? {});
  }

  @Mutation(() => UserModel)
  async deactivateUser(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<UserModel> {
    return this.adminService.deactivateUser(userId);
  }

  @Mutation(() => UserModel)
  async activateUser(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<UserModel> {
    return this.adminService.activateUser(userId);
  }

  @Mutation(() => UserModel)
  async changeUserRole(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('role', { type: () => UserRole }) role: UserRole,
  ): Promise<UserModel> {
    return this.adminService.changeUserRole(userId, role);
  }

  // ─── Content moderation ────────────────────────────────────────────────

  @Mutation(() => Boolean)
  async adminDeletePost(
    @Args('postId', { type: () => ID }) postId: string,
  ): Promise<boolean> {
    return this.adminService.deletePost(postId);
  }

  @Mutation(() => Boolean)
  async adminDeleteComment(
    @Args('commentId', { type: () => ID }) commentId: string,
  ): Promise<boolean> {
    return this.adminService.deleteComment(commentId);
  }

  @Mutation(() => Boolean)
  async featurePost(
    @Args('postId', { type: () => ID }) postId: string,
    @Args('featured') featured: boolean,
  ): Promise<boolean> {
    return this.adminService.featurePost(postId, featured);
  }

  // ─── Reports ───────────────────────────────────────────────────────────

  @Query(() => PaginatedReports, { name: 'adminReports' })
  async getReports(
    @Args('status', { type: () => ReportStatus, nullable: true })
    status?: ReportStatus,
    @Args('cursor', { type: () => ID, nullable: true }) cursor?: string,
  ): Promise<PaginatedReports> {
    return this.adminService.getReports(status, cursor);
  }

  @Mutation(() => ReportModel)
  async reviewReport(
    @Args('input') input: ReviewReportInput,
    @CurrentUser() admin: UserDocument,
  ): Promise<ReportModel> {
    return this.adminService.reviewReport(input, admin);
  }
}
