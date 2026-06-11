import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
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

import { ReactionsService } from './reactions.service';
import { ToggleReactionInput } from './dto/toggle-reaction.input';
import { ReactionTargetType } from './schemas/reaction.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Reactions')
@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle a reaction — adds if not exists, removes if exists',
  })
  @ApiResponse({ status: 200, description: 'true = added, false = removed' })
  async toggle(
    @Body() dto: ToggleReactionInput,
    @CurrentUser() user: UserDocument,
  ) {
    const added = await this.reactionsService.toggle(dto, user);
    return { added };
  }

  @Get(':targetId')
  @ApiOperation({ summary: 'Get reaction summary for a post or comment' })
  @ApiParam({ name: 'targetId', description: 'Post or Comment ID' })
  @ApiQuery({ name: 'targetType', enum: ReactionTargetType })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'To check if user reacted',
  })
  @ApiResponse({ status: 200, description: 'Reaction summary returned' })
  async getSummary(
    @Param('targetId') targetId: string,
    @Query('targetType') targetType: ReactionTargetType,
    @Query('userId') userId?: string,
  ) {
    return this.reactionsService.getSummary(targetId, targetType, userId);
  }
}
