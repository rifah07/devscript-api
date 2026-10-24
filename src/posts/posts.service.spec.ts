import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { PostsService } from './posts.service';
import { Post, PostStatus } from './schemas/post.schema';
import { UserRole } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowsService } from '../follows/follows.service';
import { CategoriesService } from '../categories/categories.service';
import { NewsletterService } from '../newsletter/newsletter.service';
import { AiService } from '../ai/ai.service';
import { AiQuotaService } from '../ai/ai-quota.service';
import { TtsService } from '../ai/tts.service';
import { UploadService } from '../common/services/upload.service';
import { Comment } from '../comments/schemas/comment.schema';
import { Reaction } from '../reactions/schemas/reaction.schema';
import { Bookmark } from '../bookmarks/schemas/bookmark.schema';
import { Notification } from '../notifications/schemas/notification.schema';
import { Series } from '../series/schemas/series.schema';

describe('PostsService', () => {
  let service: PostsService;
  let postModel: Record<string, jest.Mock>;

  const mockAuthor = {
    _id: { toString: () => 'author-id-123' },
    role: UserRole.USER,
  };

  const mockAdmin = {
    _id: { toString: () => 'admin-id-456' },
    role: UserRole.ADMIN,
  };

  const mockOtherUser = {
    _id: { toString: () => 'other-id-789' },
    role: UserRole.USER,
  };

  beforeEach(async () => {
    postModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getModelToken(Post.name), useValue: postModel },
        {
          provide: NotificationsService,
          useValue: { notifyNewPost: jest.fn() },
        },
        {
          provide: FollowsService,
          useValue: { getFollowerIds: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: CategoriesService,
          useValue: {
            incrementPostCount: jest.fn(),
            decrementPostCount: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: NewsletterService,
          useValue: { notifySubscribersOfNewPost: jest.fn() },
        },
        {
          provide: AiService,
          useValue: { embed: jest.fn().mockResolvedValue(null) },
        },
        { provide: TtsService, useValue: {} },
        { provide: AiQuotaService, useValue: { consume: jest.fn() } },
        { provide: UploadService, useValue: { deleteFile: jest.fn() } },
        // Cascade-delete models: every call resolves to "nothing to do"
        ...[Comment, Reaction, Bookmark, Notification, Series].map((m) => ({
          provide: getModelToken(m.name),
          useValue: {
            find: () => ({ distinct: () => Promise.resolve([]) }),
            deleteMany: jest.fn(),
            updateOne: jest.fn(),
          },
        })),
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  describe('remove — authorization checks', () => {
    it('should throw NotFoundException when post does not exist', async () => {
      postModel.findById.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent-id', mockAuthor as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when a non-author, non-admin tries to delete', async () => {
      const mockPost = {
        author: { toString: () => 'author-id-123' },
        gallery: [],
        deleteOne: jest.fn(),
      };
      postModel.findById.mockResolvedValue(mockPost);

      await expect(
        service.remove('post-id', mockOtherUser as never),
      ).rejects.toThrow(ForbiddenException);

      // Critical: verify deletion was NEVER attempted when unauthorized
      expect(mockPost.deleteOne).not.toHaveBeenCalled();
    });

    it('should allow the post author to delete their own post', async () => {
      const mockPost = {
        author: { toString: () => 'author-id-123' },
        gallery: [],
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      postModel.findById.mockResolvedValue(mockPost);

      const result = await service.remove('post-id', mockAuthor as never);

      expect(result).toBe(true);
      expect(mockPost.deleteOne).toHaveBeenCalledTimes(1);
    });

    it('should allow an admin to delete any post, even if not the author', async () => {
      const mockPost = {
        author: { toString: () => 'author-id-123' }, // NOT the admin's ID
        gallery: [],
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      postModel.findById.mockResolvedValue(mockPost);

      const result = await service.remove('post-id', mockAdmin as never);

      expect(result).toBe(true);
      expect(mockPost.deleteOne).toHaveBeenCalledTimes(1);
    });
  });

  // Who may read a post, by status. Hidden posts must be 404 (not 403),
  // so a stranger can't even confirm a draft exists.
  describe('findBySlug — draft visibility matrix', () => {
    const AUTHOR = new Types.ObjectId();
    const as = (id: Types.ObjectId, role = UserRole.USER) =>
      ({ _id: id, role }) as never;
    const viewers = {
      anonymous: null,
      author: as(AUTHOR),
      otherUser: as(new Types.ObjectId()),
      admin: as(new Types.ObjectId(), UserRole.ADMIN),
    };
    const canSee: Record<PostStatus, (keyof typeof viewers)[]> = {
      [PostStatus.PUBLISHED]: ['anonymous', 'author', 'otherUser', 'admin'],
      [PostStatus.DRAFT]: ['author', 'admin'],
      [PostStatus.SCHEDULED]: ['author', 'admin'],
    };

    const returnPost = (status: PostStatus) => {
      const doc = {
        _id: new Types.ObjectId(),
        status,
        author: { _id: AUTHOR, name: 'A' },
        title: 'T',
        slug: 't',
        body: 'b',
        space: 'devscript',
        gallery: [],
      };
      const chain = {
        populate: () => chain,
        lean: () => chain,
        exec: () => Promise.resolve(doc),
      };
      postModel.findOne.mockReturnValue(chain);
    };

    for (const status of Object.values(PostStatus)) {
      for (const [who, viewer] of Object.entries(viewers)) {
        const allowed = canSee[status].includes(who as keyof typeof viewers);
        it(`${status} post, ${who} → ${allowed ? 'visible' : '404'}`, async () => {
          returnPost(status);
          const result = service.findBySlug('t', viewer);
          if (allowed) await expect(result).resolves.toMatchObject({ status });
          else await expect(result).rejects.toThrow(NotFoundException);
        });
      }
    }

    it('anonymous list of DRAFT posts is empty and never queries', async () => {
      const result = await service.findAll({ status: PostStatus.DRAFT });
      expect(result.posts).toEqual([]);
      expect(postModel.find).not.toHaveBeenCalled();
    });
  });
});
