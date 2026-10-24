import { randomBytes } from 'crypto';
import slugify from 'slugify';
import { BodyFormat, PostSpace } from '../schemas/post.schema';

// strict:true strips non-Latin scripts, so a Bangla title gives '' — fall
// back to a word, never an empty slug. Random suffix: Date.now() collides
// when two posts are created in the same millisecond.
// shortcut: Bangla titles get generic slugs, add `transliteration` if SEO for them matters.
export function makeSlug(title: string, space: PostSpace): string {
  const base =
    slugify(title, { lower: true, strict: true }) ||
    (space === PostSpace.PERSONAL ? 'poem' : 'post');
  return `${base}-${randomBytes(3).toString('hex')}`;
}

export function readTimeMinutes(body: string): number {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));
}

// Lists send this instead of the body, so a feed page stays small.
export function makeExcerpt(body: string, length = 200): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/<[^>]*>/g, ' ') // raw HTML tags (never rendered, never excerpted)
    .replace(/^\s*\|.*\|\s*$/gm, ' ') // table rows
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // line-start markers only
    .replace(/[*_`~]/g, '') // emphasis (hyphens inside words survive)
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > length ? `${plain.slice(0, length).trimEnd()}…` : plain;
}

export function defaultBodyFormat(space: PostSpace): BodyFormat {
  return space === PostSpace.PERSONAL
    ? BodyFormat.PLAINTEXT
    : BodyFormat.MARKDOWN;
}
