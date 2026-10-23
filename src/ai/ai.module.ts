import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { TtsService } from './tts.service';
import { AiQuotaService } from './ai-quota.service';
import { User, UserSchema } from '../users/schemas/user.schema';

// Pure AI services. The GraphQL resolver lives in PostsModule (it needs
// PostsService), which keeps the dependency one-way: Posts → AI.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [AiService, TtsService, AiQuotaService],
  exports: [AiService, TtsService, AiQuotaService],
})
export class AiModule {}
