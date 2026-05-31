import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reaction, ReactionSchema } from './schemas/reaction.schema';
import { ReactionsService } from './reactions.service';
import { ReactionsResolver } from './reactions.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
    ]),
  ],
  providers: [ReactionsService, ReactionsResolver],
  exports: [ReactionsService],
})
export class ReactionsModule {}
