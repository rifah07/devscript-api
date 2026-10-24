import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AI_PLANS } from './ai-plans';

@Injectable()
export class AiQuotaService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // One atomic update both checks and spends: "if it's a new day, or the
  // count is under the limit, then set the counter". Two parallel requests
  // can't both slip past the limit, and it works across serverless
  // instances because the counter lives in the database, not in memory.
  async consume(user: UserDocument): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const limit = AI_PLANS[user.plan]?.callsPerDay ?? AI_PLANS.free.callsPerDay;

    const result = await this.userModel.updateOne(
      {
        _id: user._id,
        $or: [
          { 'aiUsage.day': { $ne: today } },
          { 'aiUsage.count': { $lt: limit } },
        ],
      },
      [
        {
          $set: {
            aiUsage: {
              day: today,
              count: {
                $cond: [
                  { $eq: ['$aiUsage.day', today] },
                  { $add: ['$aiUsage.count', 1] },
                  1,
                ],
              },
            },
          },
        },
      ],
      // Mongoose 9 requires opting in to aggregation-pipeline updates.
      { updatePipeline: true },
    );

    if (result.modifiedCount === 0) {
      throw new HttpException(
        `You've used today's ${limit} AI requests. They reset at midnight UTC.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
