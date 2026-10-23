import { Types } from 'mongoose';
import { PostDocument } from '../schemas/post.schema';
import { PostModel } from '../models/post.model';
import { defaultBodyFormat, makeExcerpt } from './post-logic.util';

// The one place a Post document becomes the API shape. Shared by every
// module that returns posts, so a new field can't be forgotten in one of them.
export function toPostModel(doc: PostDocument): PostModel {
  const author = doc.author;
  const category = doc.category;
  const series = doc.series as unknown as {
    _id: Types.ObjectId;
    title?: string;
    slug?: string;
  } | null;

  return {
    _id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    body: doc.body,
    excerpt: doc.excerpt || (doc.body ? makeExcerpt(doc.body) : ''),
    bodyFormat: doc.bodyFormat ?? defaultBodyFormat(doc.space),
    featured: doc.featured ?? false,
    scheduledAt: doc.scheduledAt ?? undefined,
    series:
      series?.title && series.slug
        ? { _id: series._id.toString(), title: series.title, slug: series.slug }
        : undefined,
    seriesOrder: doc.seriesOrder ?? undefined,
    summary: doc.summary,
    tags: doc.tags,
    space: doc.space,
    postType: doc.postType,
    coverImageUrl: doc.coverImageUrl,
    coverImagePublicId: doc.coverImagePublicId,
    gallery: doc.gallery,
    ogTitle: doc.ogTitle,
    ogDescription: doc.ogDescription,
    ogImage: doc.ogImage,
    narrationUrl: doc.narrationUrl || undefined,
    narrationDuration: doc.narrationDuration || undefined,
    narrationGeneratedAt: doc.narrationGeneratedAt || undefined,
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
