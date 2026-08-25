import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { NewsletterService } from './newsletter.service';
import { SubscribeInput } from './dto/subscribe.input';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // prevent subscription spam
  @ApiOperation({
    summary: 'Subscribe to newsletter (sends confirmation email)',
  })
  async subscribe(@Body() dto: SubscribeInput) {
    await this.newsletterService.subscribe(dto);
    return { message: 'Check your email to confirm your subscription' };
  }

  @Get('confirm')
  @ApiOperation({ summary: 'Confirm newsletter subscription via emailed link' })
  @ApiQuery({ name: 'token' })
  async confirm(@Query('token') token: string) {
    await this.newsletterService.confirm(token);
    return { message: 'Subscription confirmed! Welcome aboard.' };
  }

  @Get('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe via emailed link' })
  @ApiQuery({ name: 'token' })
  async unsubscribe(@Query('token') token: string) {
    await this.newsletterService.unsubscribe(token);
    return { message: 'You have been unsubscribed' };
  }
}
