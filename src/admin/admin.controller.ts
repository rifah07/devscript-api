import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { ReviewReportInput } from './dto/review-report.input';
import { ReportStatus } from './schemas/report.schema';
import { UserRole } from '../users/schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({ status: 200, description: 'Platform stats returned' })
  async getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'cursor', required: false })
  async getAllUsers(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.adminService.getAllUsers({
      search,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      cursor,
    });
  }

  @Put('users/:userId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiParam({ name: 'userId' })
  async deactivateUser(@Param('userId') userId: string) {
    return this.adminService.deactivateUser(userId);
  }

  @Put('users/:userId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a user account' })
  @ApiParam({ name: 'userId' })
  async activateUser(@Param('userId') userId: string) {
    return this.adminService.activateUser(userId);
  }

  @Put('users/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user role' })
  @ApiParam({ name: 'userId' })
  @ApiQuery({ name: 'role', enum: UserRole })
  async changeRole(
    @Param('userId') userId: string,
    @Query('role') role: UserRole,
  ) {
    return this.adminService.changeUserRole(userId, role);
  }

  @Delete('posts/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete any post (admin override)' })
  @ApiParam({ name: 'postId' })
  async deletePost(@Param('postId') postId: string) {
    return this.adminService.deletePost(postId);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete any comment (admin override)' })
  @ApiParam({ name: 'commentId' })
  async deleteComment(@Param('commentId') commentId: string) {
    return this.adminService.deleteComment(commentId);
  }

  @Put('posts/:postId/feature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Feature or unfeature a post' })
  @ApiParam({ name: 'postId' })
  @ApiQuery({ name: 'featured', type: Boolean })
  async featurePost(
    @Param('postId') postId: string,
    @Query('featured') featured: string,
  ) {
    return this.adminService.featurePost(postId, featured === 'true');
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get content reports' })
  @ApiQuery({ name: 'status', enum: ReportStatus, required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async getReports(
    @Query('status') status?: ReportStatus,
    @Query('cursor') cursor?: string,
  ) {
    return this.adminService.getReports(status, cursor);
  }

  @Put('reports/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review a report' })
  async reviewReport(
    @Body() dto: ReviewReportInput,
    @CurrentUser() admin: UserDocument,
  ) {
    return this.adminService.reviewReport(dto, admin);
  }
}
