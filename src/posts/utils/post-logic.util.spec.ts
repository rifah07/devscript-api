import { PostSpace } from '../schemas/post.schema';
import { makeExcerpt, makeSlug, readTimeMinutes } from './post-logic.util';

describe('post logic', () => {
  it('slugs Latin titles as kebab-case with a random suffix', () => {
    expect(makeSlug('My First Post!', PostSpace.DEVSCRIPT)).toMatch(
      /^my-first-post-[0-9a-f]{6}$/,
    );
  });

  it('never produces an empty slug for Bangla titles', () => {
    expect(makeSlug('সন্ধ্যার আলো', PostSpace.PERSONAL)).toMatch(
      /^poem-[0-9a-f]{6}$/,
    );
  });

  it('gives different slugs for the same title', () => {
    expect(makeSlug('Same', PostSpace.DEVSCRIPT)).not.toBe(
      makeSlug('Same', PostSpace.DEVSCRIPT),
    );
  });

  it('rounds read time up with a 1 minute minimum', () => {
    expect(readTimeMinutes('one two')).toBe(1);
    expect(readTimeMinutes(Array(401).fill('w').join(' '))).toBe(3);
  });

  it('strips markdown and code from excerpts', () => {
    expect(
      makeExcerpt('# Title\n\n```ts\nconst x = 1;\n```\nSome **bold** text'),
    ).toBe('Title Some bold text');
    expect(makeExcerpt('a'.repeat(300))).toHaveLength(201);
    expect(
      makeExcerpt(
        '- single-use **token** [docs](https://x.dev)\n\n| A | B |\n|---|---|\n| 1 | 2 |',
      ),
    ).toBe('single-use token docs');
    expect(makeExcerpt('Hi <script>alert(1)</script> there')).toBe('Hi alert(1) there');
  });
});
