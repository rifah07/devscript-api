import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Reaction,
  ReactionDocument,
  ReactionTargetType,
} from './schemas/reaction.schema';
import { ReactionSummary } from './models/reaction.model';
import { ToggleReactionInput } from './dto/toggle-reaction.input';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,
  ) {}

  async toggle(
    input: ToggleReactionInput,
    user: UserDocument,
  ): Promise<boolean> {
    const filter = {
      user: user._id,
      targetId: new Types.ObjectId(input.targetId),
      type: input.type,
    };

    const existing = await this.reactionModel.findOne(filter);

    if (existing) {
      // Toggle off - remove the reaction
      await existing.deleteOne();
      return false; // false = reaction removed
    }

    // Toggle on - add the reaction
    await this.reactionModel.create({
      ...filter,
      targetType: input.targetType,
    });

    return true; // true = reaction added
  }

  async getSummary(
    targetId: string,
    targetType: ReactionTargetType,
    currentUserId?: string,
  ): Promise<ReactionSummary[]> {
    // Aggregate reaction counts grouped by type - one DB round trip
    const counts = await this.reactionModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          targetId: new Types.ObjectId(targetId),
          targetType,
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    // Which types did the current user react with?
    const userReactions: string[] = currentUserId
      ? await this.reactionModel
          .find({
            user: new Types.ObjectId(currentUserId),
            targetId: new Types.ObjectId(targetId),
          })
          .distinct('type')
      : [];

    return counts.map((c) => ({
      type: c._id as ReactionSummary['type'],
      count: c.count,
      userReacted: userReactions.includes(c._id),
    }));
  }

  async getReactionCount(targetId: string): Promise<number> {
    return this.reactionModel.countDocuments({
      targetId: new Types.ObjectId(targetId),
    });
  }
}
