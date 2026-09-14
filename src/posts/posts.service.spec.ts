// src/postsposts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

import { PostsService } from './posts.service';
import { Post } from './schemas/post.schema';
import { UserRole } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FollowsService } from '../follows/follows.service';
import { CategoriesService } from '../categories/categories.service';
import { NewsletterService } from '../newsletter/newsletter.service';

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
            findById: jest.fn(),
          },
        },
        {
          provide: NewsletterService,
          useValue: { notifySubscribersOfNewPost: jest.fn() },
        },
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
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      postModel.findById.mockResolvedValue(mockPost);

      const result = await service.remove('post-id', mockAdmin as never);

      expect(result).toBe(true);
      expect(mockPost.deleteOne).toHaveBeenCalledTimes(1);
    });
  });
});
