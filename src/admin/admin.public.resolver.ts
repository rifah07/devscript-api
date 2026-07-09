import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AdminService } from './admin.service';
import { ReportModel } from './models/report.model';
import { CreateReportInput } from './dto/create-report.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

// Separate resolver for public-facing mutations — no admin role required
@Resolver()
export class AdminPublicResolver {
  constructor(private readonly adminService: AdminService) {}

  @Mutation(() => ReportModel)
  @UseGuards(JwtAuthGuard)
  async reportContent(
    @Args('input') input: CreateReportInput,
    @CurrentUser() user: UserDocument,
  ): Promise<ReportModel> {
    return this.adminService.createReport(input, user);
  }
}
