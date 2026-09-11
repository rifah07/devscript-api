import slugify from 'slugify';

// Extract these as standalone testable functions if not already,
// or test them via the service (shown below) - this file demonstrates
// testing pure logic in isolation, the fastest and most reliable test type
describe('Post slug and read time logic', () => {
  describe('slug generation', () => {
    it('should convert title to lowercase kebab-case', () => {
      const result = slugify('My First Blog Post!', {
        lower: true,
        strict: true,
      });
      expect(result).toBe('my-first-blog-post');
    });

    it('should handle Bangla/non-Latin characters gracefully', () => {
      const result = slugify('সন্ধ্যার আলো', { lower: true, strict: true });
      // strict: true strips non-Latin characters - result should not be empty crash
      expect(typeof result).toBe('string');
    });

    it('should strip special characters', () => {
      const result = slugify('NestJS & GraphQL: A Guide!', {
        lower: true,
        strict: true,
      });
      expect(result).not.toMatch(/[&:!]/);
    });
  });

  describe('read time calculation', () => {
    function calculateReadTime(body: string): number {
      const words = body.trim().split(/\s+/).length;
      return Math.max(1, Math.ceil(words / 200));
    }

    it('should return 1 minute minimum for very short text', () => {
      expect(calculateReadTime('Just a few words here')).toBe(1);
    });

    it('should calculate correctly for exactly 200 words', () => {
      const body = Array(200).fill('word').join(' ');
      expect(calculateReadTime(body)).toBe(1);
    });

    it('should round up for 201 words', () => {
      const body = Array(201).fill('word').join(' ');
      expect(calculateReadTime(body)).toBe(2);
    });

    it('should calculate correctly for 1000 words', () => {
      const body = Array(1000).fill('word').join(' ');
      expect(calculateReadTime(body)).toBe(5);
    });
  });
});
