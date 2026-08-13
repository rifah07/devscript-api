import {
  Controller,
  Get,
  Delete,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AccountService } from './account.service';
import { DeleteAccountInput } from './dto/delete-account.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Account')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('export')
  @ApiOperation({ summary: 'Download all your account data as JSON' })
  @ApiResponse({ status: 200, description: 'JSON file returned' })
  async exportData(
    @CurrentUser() user: UserDocument,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.accountService.exportUserData(user._id.toString());

    const filename = `misk-journal-data-export-${new Date().toISOString().split('T')[0]}.json`;

    // Setting Content-Disposition forces a file download instead of
    // rendering JSON in the browser — same principle as image downloads
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Delete('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete your account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Incorrect password' })
  async deleteAccount(
    @Body() dto: DeleteAccountInput,
    @CurrentUser() user: UserDocument,
  ) {
    await this.accountService.deleteAccount(user, dto.password);
    return { message: 'Your account has been permanently deleted' };
  }
}
