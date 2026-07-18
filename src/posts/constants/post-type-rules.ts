import { PostSpace, PostType } from '../schemas/post.schema';

// Single source of truth — used by both validator and service
export const VALID_POST_TYPES_BY_SPACE: Record<PostSpace, PostType[]> = {
  [PostSpace.DEVSCRIPT]: [PostType.ARTICLE, PostType.NOTE],
  [PostSpace.PERSONAL]: [PostType.POEM, PostType.REFLECTION, PostType.NOTE],
};

export function isValidPostTypeForSpace(
  space: PostSpace,
  postType: PostType,
): boolean {
  return VALID_POST_TYPES_BY_SPACE[space]?.includes(postType) ?? false;
}

export function getDefaultPostType(space: PostSpace): PostType {
  return space === PostSpace.DEVSCRIPT ? PostType.ARTICLE : PostType.REFLECTION;
}
