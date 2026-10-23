import type { UserDocument } from './schemas/user.schema';
import type { UserModel } from './models/user.model';

// The one place a User document becomes the private API shape (me, auth,
// admin). Public places use the same object typed as PublicUserModel, and
// GraphQL then only sends the public fields.
export function toUserModel(doc: UserDocument): UserModel {
  return {
    _id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    plan: doc.plan,
    emailVerified: doc.emailVerified ?? false,
    bio: doc.bio,
    avatarUrl: doc.avatarUrl,
    website: doc.website,
    github: doc.github,
    leetcode: doc.leetcode,
    twitter: doc.twitter,
    createdAt: doc.createdAt,
  };
}
