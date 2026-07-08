import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Report, ReportDocument, ReportStatus } from './schemas/report.schema';
import { ReportModel, PaginatedReports } from './models/report.model';
import { PlatformStats } from './models/platform-stats.model';
import { CreateReportInput } from './dto/create-report.input';
import { ReviewReportInput } from './dto/review-report.input';
import { AdminUsersFilterInput } from './dto/admin-users-filter.input';

import { User, UserDocument } from '../users/schemas/user.schema';
import { UserModel } from '../users/models/user.model';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';
import {
  Reaction,
  ReactionDocument,
} from '../reactions/schemas/reaction.schema';
import {
  Bookmark,
  BookmarkDocument,
} from '../bookmarks/schemas/bookmark.schema';
import { UserRole } from '../users/schemas/user.schema';
import type { UserDocument as AuthUser } from '../users/schemas/user.schema';

const PAGE_SIZE = 20;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,
    @InjectModel(Bookmark.name)
    private readonly bookmarkModel: Model<BookmarkDocument>,
  ) {}

  // ─── Platform Stats ───────────────────────────────────────────────────────

  async getPlatformStats(): Promise<PlatformStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run all stat queries in parallel
    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalReactions,
      totalBookmarks,
      pendingReports,
      newUsersThisMonth,
      newPostsThisMonth,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.postModel.countDocuments(),
      this.commentModel.countDocuments({ isDeleted: false }),
      this.reactionModel.countDocuments(),
      this.bookmarkModel.countDocuments(),
      this.reportModel.countDocuments({ status: ReportStatus.PENDING }),
      this.userModel.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      }),
      this.postModel.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      }),
    ]);

    return {
      totalUsers,
      totalPosts,
      totalComments,
      totalReactions,
      totalBookmarks,
      pendingReports,
      newUsersThisMonth,
      newPostsThisMonth,
    };
  }

  // ─── User Management ──────────────────────────────────────────────────────

  async getAllUsers(filter: AdminUsersFilterInput): Promise<{
    users: UserModel[];
    nextCursor?: string;
    hasNextPage: boolean;
    totalCount: number;
  }> {
    const query: Record<string, unknown> = {};

    if (filter.role) query['role'] = filter.role;
    if (filter.isActive !== undefined) query['isActive'] = filter.isActive;
    if (filter.search) {
      query['$or'] = [
        { name: { $regex: filter.search, $options: 'i' } },
        { email: { $regex: filter.search, $options: 'i' } },
      ];
    }
    if (filter.cursor) {
      query['_id'] = { $lt: new Types.ObjectId(filter.cursor) };
    }

    const [users, totalCount] = await Promise.all([
      this.userModel
        .find(query)
        .sort({ _id: -1 })
        .limit(PAGE_SIZE + 1)
        .lean()
        .exec(),
      this.userModel.countDocuments(query),
    ]);

    const hasNextPage = users.length > PAGE_SIZE;
    const sliced = hasNextPage ? users.slice(0, PAGE_SIZE) : users;

    return {
      users: sliced.map((u) => this.toUserModel(u)),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async deactivateUser(userId: string): Promise<UserModel> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!user) throw new NotFoundException('User not found');
    return this.toUserModel(user);
  }

  async activateUser(userId: string): Promise<UserModel> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { isActive: true } },
      { new: true },
    );

    if (!user) throw new NotFoundException('User not found');
    return this.toUserModel(user);
  }

  async changeUserRole(userId: string, role: UserRole): Promise<UserModel> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true },
    );

    if (!user) throw new NotFoundException('User not found');
    return this.toUserModel(user);
  }

  // ─── Content Moderation ───────────────────────────────────────────────────

  async deletePost(postId: string): Promise<boolean> {
    const result = await this.postModel.findByIdAndDelete(postId);
    if (!result) throw new NotFoundException('Post not found');
    return true;
  }

  async deleteComment(commentId: string): Promise<boolean> {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) throw new NotFoundException('Comment not found');

    // Hard delete — admin override, regardless of replies
    await comment.deleteOne();
    return true;
  }

  async featurePost(postId: string, featured: boolean): Promise<boolean> {
    const result = await this.postModel.findByIdAndUpdate(postId, {
      $set: { featured },
    });
    if (!result) throw new NotFoundException('Post not found');
    return true;
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  async createReport(
    input: CreateReportInput,
    reporter: AuthUser,
  ): Promise<ReportModel> {
    try {
      const report = await this.reportModel.create({
        reporter: reporter._id,
        targetId: new Types.ObjectId(input.targetId),
        targetType: input.targetType,
        reason: input.reason,
        description: input.description ?? '',
      });

      await report.populate('reporter');
      return this.toReportModel(report);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new ConflictException('You have already reported this content');
      }
      throw error;
    }
  }

  async getReports(
    status?: ReportStatus,
    cursor?: string,
  ): Promise<PaginatedReports> {
    const query: Record<string, unknown> = {};

    if (status) query['status'] = status;
    if (cursor) query['_id'] = { $lt: new Types.ObjectId(cursor) };

    const [reports, totalCount] = await Promise.all([
      this.reportModel
        .find(query)
        .sort({ createdAt: 1 }) // oldest first — FIFO review queue
        .limit(PAGE_SIZE + 1)
        .populate('reporter')
        .populate('reviewedBy')
        .lean()
        .exec(),
      this.reportModel.countDocuments(query),
    ]);

    const hasNextPage = reports.length > PAGE_SIZE;
    const sliced = hasNextPage ? reports.slice(0, PAGE_SIZE) : reports;

    return {
      reports: sliced.map((r) => this.toReportModel(r)),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async reviewReport(
    input: ReviewReportInput,
    admin: AuthUser,
  ): Promise<ReportModel> {
    const report = await this.reportModel
      .findByIdAndUpdate(
        input.reportId,
        {
          $set: {
            status: input.status,
            reviewedBy: admin._id,
            adminNote: input.adminNote ?? '',
          },
        },
        { new: true },
      )
      .populate('reporter')
      .populate('reviewedBy');

    if (!report) throw new NotFoundException('Report not found');
    return this.toReportModel(report);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private toUserModel(doc: UserDocument): UserModel {
    return {
      _id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      role: doc.role,
      bio: doc.bio,
      avatarUrl: doc.avatarUrl,
      createdAt: doc.createdAt,
    };
  }

  private toReportModel(doc: ReportDocument): ReportModel {
    const reporter = doc.reporter;
    const reviewedBy = doc.reviewedBy;

    return {
      _id: doc._id.toString(),
      reporter:
        reporter && typeof reporter === 'object' && '_id' in reporter
          ? (reporter as unknown as UserModel)
          : undefined,
      targetId: doc.targetId.toString(),
      targetType: doc.targetType,
      reason: doc.reason,
      description: doc.description,
      status: doc.status,
      reviewedBy:
        reviewedBy && typeof reviewedBy === 'object' && '_id' in reviewedBy
          ? (reviewedBy as unknown as UserModel)
          : undefined,
      adminNote: doc.adminNote,
      createdAt: doc.createdAt,
    };
  }
}
