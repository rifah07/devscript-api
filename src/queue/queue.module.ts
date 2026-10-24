// Not imported by AppModule yet. BullMQ needs Redis plus a long-running
// worker process, which serverless hosts (Vercel) don't provide; V1 sends
// email directly. To enable on Render/VPS: write the @Processor classes,
// add QueueModule to AppModule imports, set REDIS_HOST/PORT/PASSWORD.
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const EMAIL_QUEUE = 'email';
export const NARRATION_QUEUE = 'narration';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: NARRATION_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
