// Populate users with ONLY these fields anywhere a user appears next to
// public content. GraphQL already hides private fields by type, but the REST
// mirror serializes whatever the document holds, so private data must never
// be loaded in the first place.
export const PUBLIC_USER_FIELDS =
  'name bio avatarUrl website github leetcode twitter createdAt';

export const publicUser = (path: string) => ({
  path,
  select: PUBLIC_USER_FIELDS,
});
