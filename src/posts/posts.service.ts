import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { publicUser } from '../users/public-user-fields';

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
import {
  isValidPostTypeForSpace,
  getDefaultPostType,
} from './constants/post-type-rules';
import { PostGalleryModel } from './models/post-gallery.model';
import { NewsletterService } from '../newsletter/newsletter.service';
import { TtsService } from '../ai/tts.service';
import { PostSpace } from './schemas/post.schema';
import {
  makeExcerpt,
  makeSlug,
  readTimeMinutes,
  defaultBodyFormat,
} from './utils/post-logic.util';
import { toPostModel } from './utils/post.mapper';
import { AiService } from '../ai/ai.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { LruCache } from '../common/utils/lru-cache';
import { dot, topK } from '../common/utils/top-k';
import { Comment, CommentDocument } from '../comments/schemas/comment.schema';
import {
  Reaction,
  ReactionDocument,
} from '../reactions/schemas/reaction.schema';
import {
  Bookmark,
  BookmarkDocument,
} from '../bookmarks/schemas/bookmark.schema';
import {
  Notification,
  NotificationDocument,
} from '../notifications/schemas/notification.schema';
import { Series, SeriesDocument } from '../series/schemas/series.schema';

const PAGE_SIZE = 10;
const MAX_GALLERY = 10;
// Lists never need these: body can be 50 KB, uniqueViewers up to 1000 ids.
const LIST_EXCLUDE = '-body -uniqueViewers';
const POPULATE = [
  publicUser('author'),
  'category',
  { path: 'series', select: 'title slug' },
];

type Requestor = UserDocument | null | undefined;

// How many recent posts semantic "related" compares against. Brute-force
// top-k over a few hundred 768-d vectors is a few ms; past ~5k posts switch
// to Atlas Vector Search.
const RELATED_CANDIDATES = 500;

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly followsService: FollowsService,
    private readonly categoriesService: CategoriesService,
    private readonly newsletterService: NewsletterService,
    private readonly aiService: AiService,
    private readonly aiQuota: AiQuotaService,
    private readonly ttsService: TtsService,
    private readonly uploadService: UploadService,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name)
    private readonly reactionModel: Model<ReactionDocument>,
    @InjectModel(Bookmark.name)
    private readonly bookmarkModel: Model<BookmarkDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Series.name)
    private readonly seriesModel: Model<SeriesDocument>,
  ) {}

  private readonly logger = new Logger(PostsService.name);
  // Same question about the same version of a post → same answer, no AI call.
  private readonly answers = new LruCache<string, string>(500);

  async create(
    input: CreatePostInput,
    author: UserDocument,
  ): Promise<PostModel> {
    // Determine postType — use provided value or a sensible default for the space
    const postType = input.postType ?? getDefaultPostType(input.space);

    // Defense in depth — even if DTO validation is bypassed, this blocks bad data
    if (!isValidPostTypeForSpace(input.space, postType)) {
      throw new BadRequestException(
        `postType "${postType}" is not valid for space "${input.space}"`,
      );
    }
    // Validate before writing, so a bad category never leaves an orphan post.
    if (input.categoryId)
      await this.assertCategoryInSpace(input.categoryId, input.space);

    const post = await this.postModel.create({
      title: input.title,
      slug: makeSlug(input.title, input.space),
      body: input.body,
      excerpt: makeExcerpt(input.body),
      bodyFormat: defaultBodyFormat(input.space),
      tags: input.tags ?? [],
      author: author._id,
      category: input.categoryId ? new Types.ObjectId(input.categoryId) : null,
      space: input.space,
      postType,
      readTime: readTimeMinutes(input.body),
    });

    if (input.categoryId)
      await this.categoriesService.incrementPostCount(input.categoryId);

    await post.populate(POPULATE);
    return toPostModel(post);
  }

  // Anonymous callers see PUBLISHED only. Drafts/scheduled are listed only
  // to their own author: asking for `status: DRAFT` or for your own
  // authorId scopes the list to you, whoever you claim to be.
  async findAll(
    filter: PostsFilterInput,
    requestor?: Requestor,
  ): Promise<PaginatedPosts> {
    const query: Record<string, unknown> = {};

    if (filter.tag) query['tags'] = filter.tag;
    if (filter.space) query['space'] = filter.space;
    if (filter.postType) query['postType'] = filter.postType;
    if (filter.categoryId)
      query['category'] = new Types.ObjectId(filter.categoryId);

    const wantsHidden = filter.status && filter.status !== PostStatus.PUBLISHED;
    const isOwnList =
      !!requestor && filter.authorId === requestor._id.toString();

    if (wantsHidden || isOwnList) {
      if (!requestor) return { posts: [], hasNextPage: false, totalCount: 0 };
      query['author'] = requestor._id;
      if (filter.status) query['status'] = filter.status;
    } else {
      query['status'] = PostStatus.PUBLISHED;
      if (filter.authorId)
        query['author'] = new Types.ObjectId(filter.authorId);
    }

    const totalCount = await this.postModel.countDocuments(query);

    if (filter.cursor) {
      query['_id'] = { $lt: new Types.ObjectId(filter.cursor) };
    }

    const posts = await this.postModel
      .find(query)
      .select(LIST_EXCLUDE)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .populate(POPULATE)
      .lean()
      .exec();

    const hasNextPage = posts.length > PAGE_SIZE;
    const sliced = hasNextPage ? posts.slice(0, PAGE_SIZE) : posts;

    return {
      posts: sliced.map((p) => toPostModel(p)),
      nextCursor: hasNextPage
        ? sliced[sliced.length - 1]?._id.toString()
        : undefined,
      hasNextPage,
      totalCount,
    };
  }

  async findBySlug(slug: string, requestor?: Requestor): Promise<PostModel> {
    const post = await this.postModel
      .findOne({ slug })
      .populate(POPULATE)
      .lean()
      .exec();

    return toPostModel(this.assertVisible(post, requestor));
  }

  // For comments, reactions, bookmarks: you may only interact with a post
  // that exists and is published. Hidden posts look missing (404).
  async findPublished(id: string): Promise<PostModel> {
    const post = await this.postModel
      .findOne({ _id: id, status: PostStatus.PUBLISHED })
      .select(LIST_EXCLUDE)
      .populate(publicUser('author'))
      .lean()
      .exec();
    if (!post) throw new NotFoundException('Post not found');
    return toPostModel(post);
  }

  // Returns the raw document after checking the requestor may edit it.
  async findEditable(
    id: string,
    requestor: UserDocument,
  ): Promise<PostDocument> {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    this.assertIsAuthorOrAdmin(post, requestor);
    return post;
  }

  async update(
    input: UpdatePostInput,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(input.id, requestor);

    const finalSpace = input.space ?? post.space;
    const finalPostType = input.postType ?? post.postType;
    if (!isValidPostTypeForSpace(finalSpace, finalPostType)) {
      throw new BadRequestException(
        `postType "${finalPostType}" is not valid for space "${finalSpace}"`,
      );
    }

    const previousCategory = post.category?.toString();
    if (input.categoryId && input.categoryId !== previousCategory) {
      await this.assertCategoryInSpace(input.categoryId, finalSpace);
      post.category = new Types.ObjectId(input.categoryId);
    }

    // Slug is deliberately NOT regenerated: shared links, Pinterest pins and
    // RSS guids all point at it. A changed title keeps the original URL.
    if (input.title) post.title = input.title;
    if (input.body) {
      post.body = input.body;
      post.excerpt = makeExcerpt(input.body);
      post.readTime = readTimeMinutes(input.body);
    }
    if (input.tags) post.tags = input.tags;
    if (input.space) post.space = input.space;
    if (input.postType) post.postType = input.postType;

    const contentChanged = !!(input.title || input.body);
    await post.save();
    if (contentChanged && post.status === PostStatus.PUBLISHED)
      await this.embedPost(post);

    if (input.categoryId && input.categoryId !== previousCategory) {
      await this.categoriesService.incrementPostCount(input.categoryId);
      if (previousCategory)
        await this.categoriesService.decrementPostCount(previousCategory);
    }

    await post.populate(POPULATE);
    return toPostModel(post);
  }

  async publish(id: string, requestor: UserDocument): Promise<PostModel> {
    const post = await this.findEditable(id, requestor);

    // Idempotent: publishing twice must not email every subscriber twice.
    if (post.status !== PostStatus.PUBLISHED) {
      post.status = PostStatus.PUBLISHED;
      post.scheduledAt = null;
      this.applyOgMetadata(post);
      await post.save();
      await this.afterPublish(post, requestor);
    }

    await post.populate(POPULATE);
    return toPostModel(post);
  }

  // MongoDB has no ON DELETE CASCADE, so the cleanup is explicit: nothing
  // may keep pointing at a deleted post, and counters must not drift.
  async remove(id: string, requestor: UserDocument): Promise<boolean> {
    const post = await this.findEditable(id, requestor);
    const commentIds = await this.commentModel
      .find({ post: post._id })
      .distinct('_id');

    await post.deleteOne();
    await Promise.all([
      this.commentModel.deleteMany({ post: post._id }),
      this.reactionModel.deleteMany({
        targetId: { $in: [post._id, ...commentIds] },
      }),
      this.bookmarkModel.deleteMany({ post: post._id }),
      this.notificationModel.deleteMany({ postId: post._id }),
      post.category &&
        this.categoriesService.decrementPostCount(post.category.toString()),
      post.series &&
        this.seriesModel.updateOne(
          { _id: post.series },
          { $inc: { postCount: -1 } },
        ),
    ]);

    // Files last, and best effort: a Cloudinary hiccup must not undo the delete.
    const files = [
      ...post.gallery.map((g) => g.publicId),
      post.narrationPublicId,
    ].filter(Boolean);
    await Promise.allSettled(
      files.map((f) => this.uploadService.deleteFile(f)),
    );
    return true;
  }

  async updateSummary(id: string, summary: string): Promise<void> {
    await this.postModel.updateOne({ _id: id }, { summary });
  }

  // Logged-in viewers count once per account. Anonymous viewers count once
  // per device per day: a hash of ip + user agent + date, so no raw IP is
  // ever stored and the key can't be linked across days.
  async recordView(
    postId: string,
    requestor: Requestor,
    ip = '',
    userAgent = '',
  ): Promise<void> {
    const viewerKey = requestor
      ? requestor._id.toString()
      : createHash('sha256')
          .update(`${ip}|${userAgent}|${new Date().toISOString().slice(0, 10)}`)
          .digest('hex');

    await this.postModel.updateOne(
      {
        _id: postId,
        status: PostStatus.PUBLISHED,
        uniqueViewers: { $ne: viewerKey },
      },
      {
        $inc: { viewCount: 1 },
        // $push + $slice keeps only the newest 1000 keys, atomically.
        $push: { uniqueViewers: { $each: [viewerKey], $slice: -1000 } },
      },
    );
  }

  async generateNarration(
    postId: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);

    // Narration only makes sense for shorter, reflective content —
    // not long technical articles with code blocks
    if (post.space !== PostSpace.PERSONAL) {
      throw new BadRequestException(
        'Narration is only available for The Misk Journal (personal space) posts',
      );
    }

    // Narration is the most expensive AI call: it counts against the quota.
    await this.aiQuota.consume(requestor);
    const text = this.ttsService.prepareTextForNarration(post.title, post.body);
    const narration = await this.ttsService.generateNarration(text);

    // Delete the old narration file if regenerating
    if (post.narrationPublicId) {
      await this.uploadService.deleteFile(post.narrationPublicId);
    }

    const uploaded = await this.uploadService.uploadNarrationAudio(
      narration.audioBuffer,
      postId,
    );

    post.narrationUrl = uploaded.url;
    post.narrationPublicId = uploaded.publicId;
    post.narrationDuration = narration.estimatedDurationSeconds;
    post.narrationGeneratedAt = new Date();

    await post.save();
    await post.populate(POPULATE);

    return toPostModel(post);
  }

  async schedulePost(
    postId: string,
    scheduledAt: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);

    if (post.status === PostStatus.PUBLISHED) {
      throw new BadRequestException('Post is already published');
    }

    const scheduleDate = new Date(scheduledAt);
    if (
      Number.isNaN(scheduleDate.getTime()) ||
      scheduleDate.getTime() <= Date.now()
    ) {
      throw new BadRequestException('scheduledAt must be a future date');
    }

    post.status = PostStatus.SCHEDULED;
    post.scheduledAt = scheduleDate;
    await post.save();
    await post.populate(POPULATE);

    return toPostModel(post);
  }

  async cancelSchedule(
    postId: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);

    if (post.status !== PostStatus.SCHEDULED) {
      throw new BadRequestException('Post is not currently scheduled');
    }

    post.status = PostStatus.DRAFT;
    post.scheduledAt = null;
    await post.save();
    await post.populate(POPULATE);

    return toPostModel(post);
  }

  // Called by BOTH the cron job (traditional server) AND
  // the external trigger endpoint (Vercel Cron Jobs)
  // Publishes every post whose scheduledAt time has passed
  async publishDueScheduledPosts(): Promise<number> {
    const duePosts = await this.postModel
      .find({
        status: PostStatus.SCHEDULED,
        scheduledAt: { $lte: new Date() },
      })
      .populate(publicUser('author'))
      .exec();

    for (const post of duePosts) {
      post.status = PostStatus.PUBLISHED;
      post.scheduledAt = null;
      this.applyOgMetadata(post);
      await post.save();
      await this.afterPublish(post, post.author as unknown as UserDocument);
    }

    return duePosts.length;
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
        .select(LIST_EXCLUDE)
        .sort({ viewCount: -1 })
        .limit(5)
        .populate(publicUser('author'))
        .lean()
        .exec(),
    ]);

    return {
      totalViews: stats[0]?.totalViews ?? 0,
      totalPosts: stats[0]?.totalPosts ?? 0,
      totalBookmarks: stats[0]?.totalBookmarks ?? 0,
      topPosts: topPosts.map((p) => toPostModel(p)),
    };
  }

  async getRelatedPosts(
    postId: string,
    requestor: Requestor,
    limit = 5,
  ): Promise<PostModel[]> {
    const post = this.assertVisible<PostDocument>(
      await this.postModel.findById(postId),
      requestor,
    );

    const semantic = await this.semanticRelated(post, limit);
    if (semantic.length) return semantic;

    // Fallback when embeddings aren't available. Scoring pipeline:
    // +3 points for same category
    // +1 point per shared tag
    // Excludes the post itself; same space and published only
    const related = await this.postModel.aggregate([
      {
        $match: {
          _id: { $ne: post._id },
          space: post.space,
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
      { $limit: Math.min(Math.max(limit, 1), 20) },
      { $project: { body: 0, uniqueViewers: 0 } },
    ]);

    // Populate author and category on aggregation results
    const populated = await this.postModel.populate(related, [
      publicUser('author'),
      { path: 'category' },
    ]);

    return populated.map((p) => toPostModel(p as PostDocument));
  }

  async addGalleryImages(
    postId: string,
    files: Express.Multer.File[],
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);

    if (!files?.length) throw new BadRequestException('No files uploaded');
    if (post.gallery.length + files.length > MAX_GALLERY) {
      throw new BadRequestException(
        `Maximum ${MAX_GALLERY} images allowed per post`,
      );
    }

    // Upload all images in parallel — much faster than sequential
    const uploadResults = await Promise.all(
      files.map((file) => this.uploadService.uploadGalleryImage(file)),
    );

    const newImages = uploadResults.map((result, index) => ({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      alt: '',
      order: post.gallery.length + index,
      downloadCount: 0,
    }));

    post.gallery.push(...newImages);

    // Set cover image automatically if this is the first image
    if (!post.coverImageUrl && newImages[0]) {
      post.coverImageUrl = newImages[0].url;
      post.coverImagePublicId = newImages[0].publicId;
      post.ogImage = newImages[0].url;
    }

    await post.save();
    await post.populate(POPULATE);
    return toPostModel(post);
  }

  async removeGalleryImage(
    postId: string,
    publicId: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);
    // Without this check any logged-in author could delete ANY Cloudinary
    // asset (someone else's avatar, another post's image) by passing its id.
    this.findGalleryImage(post, publicId);

    post.gallery = post.gallery
      .filter((img) => img.publicId !== publicId)
      .sort((a, b) => a.order - b.order)
      .map((img, order) => ({ ...img, order }));

    if (post.coverImagePublicId === publicId) {
      const next = post.gallery[0];
      post.coverImageUrl = next?.url ?? '';
      post.coverImagePublicId = next?.publicId ?? '';
      post.ogImage = next?.url ?? '';
    }

    // Save first: the DB must never point at an asset that no longer exists.
    await post.save();
    await this.uploadService.deleteFile(publicId);

    await post.populate(POPULATE);
    return toPostModel(post);
  }

  async setPostCover(
    postId: string,
    publicId: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);
    const image = this.findGalleryImage(post, publicId);

    post.coverImageUrl = image.url;
    post.coverImagePublicId = image.publicId;
    post.ogImage = image.url;

    await post.save();
    await post.populate(POPULATE);
    return toPostModel(post);
  }

  async reorderGallery(
    postId: string,
    publicIds: string[],
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);

    // Must be an exact permutation of the current gallery: nothing added,
    // dropped, or duplicated.
    const current = new Set(post.gallery.map((img) => img.publicId));
    const isPermutation =
      publicIds.length === current.size &&
      new Set(publicIds).size === publicIds.length &&
      publicIds.every((id) => current.has(id));
    if (!isPermutation) {
      throw new BadRequestException(
        'publicIds must list every gallery image exactly once',
      );
    }

    const position = new Map(publicIds.map((id, i) => [id, i]));
    for (const img of post.gallery) img.order = position.get(img.publicId) ?? 0;
    post.gallery.sort((a, b) => a.order - b.order);

    await post.save();
    await post.populate(POPULATE);
    return toPostModel(post);
  }

  async updateGalleryImageAlt(
    postId: string,
    publicId: string,
    alt: string,
    requestor: UserDocument,
  ): Promise<PostModel> {
    const post = await this.findEditable(postId, requestor);
    this.findGalleryImage(post, publicId).alt = alt.trim().slice(0, 300);

    await post.save();
    await post.populate(POPULATE);
    return toPostModel(post);
  }

  async getPostGallery(
    postId: string,
    requestor?: Requestor,
  ): Promise<PostGalleryModel> {
    const post = this.assertVisible(
      await this.postModel
        .findById(postId)
        .select('title gallery status author')
        .lean()
        .exec(),
      requestor,
    );

    // Always return images sorted by their intended reading order
    const sortedImages = [...post.gallery].sort((a, b) => a.order - b.order);

    return {
      postId: post._id.toString(),
      postTitle: post.title,
      images: sortedImages,
    };
  }

  // Only counts images that really belong to a published post.
  async incrementImageDownloadCount(
    postId: string,
    publicId: string,
  ): Promise<void> {
    // $ positional operator updates only the matching array element
    await this.postModel.updateOne(
      {
        _id: postId,
        status: PostStatus.PUBLISHED,
        'gallery.publicId': publicId,
      },
      { $inc: { 'gallery.$.downloadCount': 1 } },
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  // Hidden posts answer 404, not 403: a 403 would confirm the draft exists.
  private assertVisible<T extends { status: PostStatus; author: unknown }>(
    post: T | null,
    requestor: Requestor,
  ): T {
    if (!post) throw new NotFoundException('Post not found');
    if (post.status === PostStatus.PUBLISHED) return post;

    // author is an ObjectId, or a populated user document
    const authorId =
      post.author instanceof Types.ObjectId
        ? post.author.toString()
        : (post.author as { _id: Types.ObjectId })._id.toString();
    const allowed =
      !!requestor &&
      (requestor.role === UserRole.ADMIN ||
        requestor._id.toString() === authorId);
    if (!allowed) throw new NotFoundException('Post not found');
    return post;
  }

  private findGalleryImage(post: PostDocument, publicId: string) {
    const image = post.gallery.find((img) => img.publicId === publicId);
    if (!image) throw new NotFoundException('Image not found in this post');
    return image;
  }

  private async assertCategoryInSpace(
    categoryId: string,
    space: PostSpace,
  ): Promise<void> {
    const category = await this.categoriesService.findById(categoryId);
    if (category.space !== space) {
      throw new BadRequestException(
        `Category belongs to "${category.space}" space, but post is in "${space}" space`,
      );
    }
  }

  // Open Graph fields for rich link previews, set just before saving.
  private applyOgMetadata(post: PostDocument): void {
    post.ogTitle = post.title.slice(0, 60);
    post.ogDescription = post.summary || makeExcerpt(post.body, 160);
    post.ogImage = post.coverImageUrl || post.gallery[0]?.url || '';
  }

  // Awaited, not fire-and-forget: on serverless hosts work that runs after
  // the response is sent can be frozen mid-way. allSettled so one failing
  // side effect (say, email) doesn't stop the others or fail the publish.
  private async afterPublish(
    post: PostDocument,
    author: UserDocument,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.followsService
        .getFollowerIds(author._id.toString())
        .then((followerIds) =>
          this.notificationsService.notifyNewPost({
            followerIds,
            actor: author,
            postId: post._id.toString(),
            postTitle: post.title,
          }),
        ),
      this.newsletterService.notifySubscribersOfNewPost(
        post.space,
        post.title,
        post.summary || post.excerpt,
        post.slug,
      ),
      this.embedPost(post),
    ]);
    for (const r of results) {
      if (r.status === 'rejected')
        this.logger.warn(`After-publish step failed: ${String(r.reason)}`);
    }
  }

  // ─── AI: embeddings, related posts, questions ─────────────────────────────

  private async embedPost(post: PostDocument): Promise<number[] | null> {
    const vector = await this.aiService.embed(`${post.title}\n\n${post.body}`);
    if (vector)
      await this.postModel.updateOne(
        { _id: post._id },
        { $set: { embedding: vector } },
      );
    return vector;
  }

  // Nearest neighbours by meaning, not by shared tags. Lazy backfill: a
  // post published before embeddings existed gets one the first time it's
  // read.
  private async semanticRelated(
    post: PostDocument,
    limit: number,
  ): Promise<PostModel[]> {
    if (post.status !== PostStatus.PUBLISHED) return [];
    const source =
      (await this.postModel.findById(post._id).select('+embedding').lean())
        ?.embedding ?? (await this.embedPost(post));
    if (!source?.length) return [];

    const candidates = await this.postModel
      .find({
        _id: { $ne: post._id },
        space: post.space,
        status: PostStatus.PUBLISHED,
        'embedding.0': { $exists: true },
      })
      .select('+embedding -body -uniqueViewers')
      .sort({ _id: -1 })
      .limit(RELATED_CANDIDATES)
      .lean();

    const best = topK(candidates, Math.min(Math.max(limit, 1), 20), (c) =>
      dot(source, c.embedding ?? []),
    );
    const populated = await this.postModel.populate(best, [
      publicUser('author'),
      { path: 'category' },
    ]);
    return populated.map((p) => toPostModel(p as PostDocument));
  }

  async answerQuestion(postId: string, question: string): Promise<string> {
    const post = await this.postModel
      .findOne({ _id: postId, status: PostStatus.PUBLISHED })
      .select('title body updatedAt')
      .lean();
    if (!post) throw new NotFoundException('Post not found');

    // Keyed by post version, so an edited post never serves stale answers.
    const key = `${postId}:${post.updatedAt?.getTime()}:${question.toLowerCase().replace(/\s+/g, ' ')}`;
    const cached = this.answers.get(key);
    if (cached) return cached;

    const answer = await this.aiService.answerFromArticle(
      post.title,
      post.body,
      question,
    );
    if (answer) this.answers.set(key, answer);
    return answer;
  }

  private assertIsAuthorOrAdmin(post: PostDocument, user: UserDocument): void {
    const isAuthor = post.author.toString() === user._id.toString();
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('You can only modify your own posts');
    }
  }
}
