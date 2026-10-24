import { Field, ID, ObjectType, Int, registerEnumType } from '@nestjs/graphql';
import { PostStatus } from '../schemas/post.schema';
import { PublicUserModel } from '../../users/models/public-user.model';
import { CategoryModel } from '../../categories/models/category.model';
import { BodyFormat, PostSpace, PostType } from '../schemas/post.schema';
import { GalleryImageModel } from './gallery-image.model';

registerEnumType(PostSpace, { name: 'PostSpace' });
registerEnumType(PostType, { name: 'PostType' });
registerEnumType(PostStatus, { name: 'PostStatus' });
registerEnumType(BodyFormat, { name: 'BodyFormat' });

@ObjectType()
export class SeriesRefModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare title: string;

  @Field()
  declare slug: string;
}

@ObjectType()
export class PostModel {
  @Field(() => ID)
  declare _id: string;

  @Field()
  declare title: string;

  @Field()
  declare slug: string;

  // Null in list queries: they send `excerpt` instead.
  @Field({ nullable: true })
  declare body?: string;

  @Field()
  declare excerpt: string;

  @Field(() => BodyFormat)
  declare bodyFormat: BodyFormat;

  @Field()
  declare featured: boolean;

  @Field({ nullable: true })
  declare scheduledAt?: Date;

  @Field(() => SeriesRefModel, { nullable: true })
  declare series?: SeriesRefModel;

  @Field(() => Int, { nullable: true })
  declare seriesOrder?: number;

  // Internal: read by coverImageVariants, never serialized.
  declare coverImagePublicId?: string;

  @Field({ nullable: true })
  declare summary?: string;

  @Field(() => [String])
  declare tags: string[];

  // nullable: true handles the case where author was deleted
  @Field(() => PublicUserModel, { nullable: true })
  declare author?: PublicUserModel;

  @Field(() => PostStatus)
  declare status: PostStatus;

  @Field(() => Int)
  declare readTime: number;

  @Field(() => Int)
  declare viewCount: number;

  @Field(() => Int)
  declare bookmarksCount: number;

  @Field(() => CategoryModel, { nullable: true })
  declare category?: CategoryModel;

  @Field(() => PostSpace)
  declare space: PostSpace;

  @Field(() => PostType)
  declare postType: PostType;

  @Field({ nullable: true })
  declare coverImageUrl?: string;

  @Field(() => [GalleryImageModel])
  declare gallery: GalleryImageModel[];

  @Field({ nullable: true })
  declare ogTitle?: string;

  @Field({ nullable: true })
  declare ogDescription?: string;

  @Field({ nullable: true })
  declare ogImage?: string;

  @Field({ nullable: true })
  declare narrationUrl?: string;

  @Field(() => Int, { nullable: true })
  declare narrationDuration?: number;

  @Field({ nullable: true })
  declare narrationGeneratedAt?: Date;

  @Field()
  declare createdAt: Date;

  @Field()
  declare updatedAt: Date;
}

// Cursor-based pagination response type
@ObjectType()
export class PaginatedPosts {
  @Field(() => [PostModel])
  declare posts: PostModel[];

  @Field({ nullable: true })
  declare nextCursor?: string; // ID of last item - client sends this for next page

  @Field()
  declare hasNextPage: boolean;

  @Field(() => Int)
  declare totalCount: number;
}
