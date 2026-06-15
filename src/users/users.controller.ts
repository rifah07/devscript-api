import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { UploadService } from '../common/services/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from './schemas/user.schema';
import { UpdateProfileInput } from './dto/update-user.input';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  async getMe(@CurrentUser() user: UserDocument) {
    return this.usersService.findById(user._id.toString());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @Body() dto: UpdateProfileInput,
    @CurrentUser() user: UserDocument,
  ) {
    return this.usersService.updateProfile(user._id.toString(), dto);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload or replace avatar image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  // FileInterceptor extracts the file from multipart form
  // memoryStorage keeps it in RAM as Buffer — required for Vercel
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserDocument,
  ) {
    // Delete old avatar from Cloudinary if exists
    const oldPublicId = await this.usersService.getAvatarPublicId(
      user._id.toString(),
    );

    if (oldPublicId) {
      await this.uploadService.deleteFile(oldPublicId);
    }

    // Upload new avatar
    const result = await this.uploadService.uploadAvatar(file);

    // Save URL and publicId to user record
    const updated = await this.usersService.updateAvatar(
      user._id.toString(),
      result.url,
      result.publicId,
    );

    return { avatarUrl: updated.avatarUrl };
  }
}
