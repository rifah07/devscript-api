import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reaction, ReactionSchema } from './schemas/reaction.schema';
import { ReactionsService } from './reactions.service';
import { ReactionsResolver } from './reactions.resolver';
import { ReactionsController } from './reactions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
    ]),
  ],
  providers: [ReactionsService, ReactionsResolver],
  controllers: [ReactionsController],
  exports: [ReactionsService],
})
export class ReactionsModule {}
