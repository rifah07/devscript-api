import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';

import { Post, PostDocument, PostStatus } from './schemas/post.schema';
import { PostModel, PaginatedPosts } from './models/post.model';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { PostsFilterInput } from './dto/posts-filter.input';
import { UserRole } from '../users/schemas/user.schema';
import type { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowsService } from '../follows/follows.service';
import { CategoriesService } from '../categories/categories.service';
import { UploadService } from '../common/services/upload.service';

const PAGE_SIZE = 10;

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly followsService: FollowsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(
    input: CreatePostInput,
    author: UserDocument,
  ): Promise<PostModel> {
    const slug = this.generateUniqueSlug(input.title);
    const readTime = this.calculateReadTime(input.body);

    const post = await this.postModel.create({
      title: input.title,
      slug,
      body: input.body,
      tags: input.tags ?? [],
      author: author._id,
      category: input.categoryId ? new Types.ObjectId(input.categoryId) : null,
      readTime,
    });

    if (input.categoryId) {
      await this.categoriesService.incrementPostCount(input.categoryId);
    }

    await post.populate(['author', 'category']);
    return this.toModel(post);
  }

  async findAll(filter: PostsFilterInput): Promise<PaginatedPosts> {
    const query: Record<string, unknown> = {};

    if (filter.status) query['status'] = filter.status;
    if (filter.tag) query['tags'] = filter.tag;
    if (filter.authorId) query['author'] = new Types.ObjectId(filter.authorId);
    if (filter.space) query['space'] = filter.space;
    if (filter.postType) query['postType'] = filter.postType;

    if (filter.cursor) {
      query['_id'] = { $lt: new Types.ObjectId(filter.cursor) };
    }

    const posts = await this.postModel
      .find(query)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .populate('author')
      .lean()
      .exec();

    const hasNextPage = posts.length > PAGE_SIZE;
    const sliced = hasNextPage ? posts.slice(0, PAGE_SIZE) : posts;
    const totalCount = await this.postModel.countDocuments(query);

    return {
      posts: sliced.map((p) => this.toModel(p)),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async findBySlug(slug: string): Promise<PostModel> {
    const post = await this.postModel
      .findOne({ slug })
      .populate('author')
      .lean()
      .exec();

    if (!post) throw new NotFoundException(`Post "${slug}" not found`);
    return this.toModel(post);
  }

  async findById(id: string): Promise<PostModel> {
    const post = await this.postModel
      .findById(id)
      .populate('author')
      .lean()
      .exec();

    if (!post) throw new NotFoundException('Post not found');
    return this.toModel(post);
  }

  async update(
    input: UpdatePostInput,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.postModel.findById(input.id);
    if (!post) throw new NotFoundException('Post not found');

    this.assertIsAuthorOrAdmin(post, requestor);

    if (input.title) {
      post.title = input.title;
      post.slug = this.generateUniqueSlug(input.title);
    }
    if (input.body) {
      post.body = input.body;
      post.readTime = this.calculateReadTime(input.body);
    }
    if (input.tags) post.tags = input.tags;

    await post.save();
    await post.populate('author');
    return this.toModel(post);
  }

  async publish(id: string, requestor: UserDocument): Promise<PostModel> {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    this.assertIsAuthorOrAdmin(post, requestor);

    post.status = PostStatus.PUBLISHED;
    await post.save();
    await post.populate('author');
    const result = this.toModel(post);

    // Notify all followers about the new post — fire and forget
    // We don't await this — no reason to slow down the publish response
    void this.followsService
      .getFollowerIds(requestor._id.toString())
      .then((followerIds) =>
        this.notificationsService.notifyNewPost({
          followerIds,
          actor: requestor,
          postId: id,
          postTitle: post.title,
        }),
      );
    return result;
  }

  async remove(id: string, requestor: UserDocument): Promise<boolean> {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');

    this.assertIsAuthorOrAdmin(post, requestor);

    await post.deleteOne();
    return true;
  }

  async updateSummary(id: string, summary: string): Promise<void> {
    await this.postModel.updateOne({ _id: id }, { summary });
  }

  async recordView(postId: string, viewerId?: string): Promise<void> {
    // viewerId present = logged-in user
    // viewerId absent = anonymous visitor

    if (viewerId) {
      // For logged-in users: only count once per user using $addToSet
      // $addToSet adds to array only if not already present — atomic, no race condition
      // $inc increments viewCount only if the viewer was actually added
      const result = await this.postModel.updateOne(
        {
          _id: new Types.ObjectId(postId),
          uniqueViewers: { $ne: viewerId }, // only if not already viewed
        },
        {
          $addToSet: { uniqueViewers: viewerId },
          $inc: { viewCount: 1 },
        },
      );

      // Cap uniqueViewers array at 1000 to prevent unbounded growth
      if (result.modifiedCount > 0) {
        await this.postModel.updateOne(
          { _id: new Types.ObjectId(postId) },
          { $slice: { uniqueViewers: -1000 } }, // keep last 1000
        );
      }
    } else {
      // Anonymous — just increment view count
      await this.postModel.updateOne(
        { _id: new Types.ObjectId(postId) },
        { $inc: { viewCount: 1 } },
      );
    }
  }

  async getAuthorAnalytics(authorId: string): Promise<{
    totalViews: number;
    totalPosts: number;
    totalBookmarks: number;
    topPosts: PostModel[];
  }> {
    const authorObjectId = new Types.ObjectId(authorId);

    const [stats, topPosts] = await Promise.all([
      this.postModel.aggregate<{
        totalViews: number;
        totalPosts: number;
        totalBookmarks: number;
      }>([
        { $match: { author: authorObjectId } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$viewCount' },
            totalPosts: { $sum: 1 },
            totalBookmarks: { $sum: '$bookmarksCount' },
          },
        },
      ]),
      this.postModel
        .find({ author: authorObjectId })
        .sort({ viewCount: -1 })
        .limit(5)
        .populate('author')
        .lean()
        .exec(),
    ]);

    return {
      totalViews: stats[0]?.totalViews ?? 0,
      totalPosts: stats[0]?.totalPosts ?? 0,
      totalBookmarks: stats[0]?.totalBookmarks ?? 0,
      topPosts: topPosts.map((p) => this.toModel(p)),
    };
  }

  async getRelatedPosts(postId: string, limit = 5): Promise<PostModel[]> {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    // Build a scoring pipeline:
    // +3 points for same category
    // +1 point per shared tag
    // Excludes the post itself, only published posts
    const related = await this.postModel.aggregate([
      {
        $match: {
          _id: { $ne: post._id },
          status: PostStatus.PUBLISHED,
          $or: [{ category: post.category }, { tags: { $in: post.tags } }],
        },
      },
      {
        $addFields: {
          // Count how many tags overlap with the source post
          sharedTagsCount: {
            $size: { $setIntersection: ['$tags', post.tags] },
          },
          // Boolean → 1/0 for same category
          sameCategoryScore: {
            $cond: [{ $eq: ['$category', post.category] }, 3, 0],
          },
        },
      },
      {
        $addFields: {
          relevanceScore: { $add: ['$sharedTagsCount', '$sameCategoryScore'] },
        },
      },
      { $sort: { relevanceScore: -1, createdAt: -1 } },
      { $limit: limit },
    ]);

    // Populate author and category on aggregation results
    const populated = await this.postModel.populate(related, [
      { path: 'author' },
      { path: 'category' },
    ]);

    return populated.map((p) => this.toModel(p as PostDocument));
  }

  async addGalleryImages(
    postId: string,
    files: Express.Multer.File[],
    requestor: UserDocument,
    uploadService: UploadService,
  ): Promise<PostModel> {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    this.assertIsAuthorOrAdmin(post, requestor);

    if (post.gallery.length + files.length > 10) {
      throw new BadRequestException('Maximum 10 images allowed per post');
    }

    // Upload all images in parallel — much faster than sequential
    const uploadResults = await Promise.all(
      files.map((file) => uploadService.uploadPostCover(file)),
    );

    const newImages = uploadResults.map((result, index) => ({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      alt: '',
      order: post.gallery.length + index,
    }));

    post.gallery.push(...newImages);

    // Set cover image automatically if this is the first image
    if (!post.coverImageUrl && newImages[0]) {
      post.coverImageUrl = newImages[0].url;
      post.coverImagePublicId = newImages[0].publicId;
      post.ogImage = newImages[0].url;
    }

    await post.save();
    await post.populate(['author', 'category']);
    return this.toModel(post);
  }

  async removeGalleryImage(
    postId: string,
    publicId: string,
    requestor: UserDocument,
    uploadService: UploadService,
  ): Promise<PostModel> {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    this.assertIsAuthorOrAdmin(post, requestor);

    post.gallery = post.gallery.filter((img) => img.publicId !== publicId);

    // Delete from Cloudinary too
    await uploadService.deleteFile(publicId);

    await post.save();
    await post.populate(['author', 'category']);
    return this.toModel(post);
  }

  // Generate Open Graph metadata automatically on publish
  async generateOgMetadata(postId: string): Promise<void> {
    const post = await this.postModel.findById(postId);
    if (!post) return;

    const ogTitle = post.title.slice(0, 60);
    const ogDescription =
      post.summary || post.body.slice(0, 160).trim() + '...';
    const ogImage = post.coverImageUrl || post.gallery[0]?.url || '';

    await this.postModel.updateOne(
      { _id: postId },
      { $set: { ogTitle, ogDescription, ogImage } },
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private generateUniqueSlug(title: string): string {
    const base = slugify(title, { lower: true, strict: true });
    return `${base}-${Date.now()}`;
  }

  private calculateReadTime(body: string): number {
    const words = body.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  private assertIsAuthorOrAdmin(post: PostDocument, user: UserDocument): void {
    const isAuthor = post.author.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('You can only modify your own posts');
    }
  }

  private toModel(doc: PostDocument): PostModel {
    const author = doc.author;
    const category = doc.category;

    return {
      _id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      body: doc.body,
      summary: doc.summary,
      tags: doc.tags,
      space: doc.space,
      postType: doc.postType,
      coverImageUrl: doc.coverImageUrl,
      gallery: doc.gallery,
      ogTitle: doc.ogTitle,
      ogDescription: doc.ogDescription,
      ogImage: doc.ogImage,
      author:
        author && typeof author === 'object' && '_id' in author
          ? (author as unknown as PostModel['author'])
          : undefined,
      category:
        category && typeof category === 'object' && '_id' in category
          ? (category as unknown as PostModel['category'])
          : undefined,
      status: doc.status,
      readTime: doc.readTime,
      viewCount: doc.viewCount,
      bookmarksCount: doc.bookmarksCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
