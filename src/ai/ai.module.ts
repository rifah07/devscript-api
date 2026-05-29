import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiResolver } from './ai.resolver';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [PostsModule],
  providers: [AiService, AiResolver],
})
export class AiModule {}
