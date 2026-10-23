import { humanize } from './humanize';

describe('humanize', () => {
  it('turns em/en dashes between words into commas', () => {
    expect(humanize('Caching helps — but only when reads dominate.')).toBe(
      'Caching helps, but only when reads dominate.',
    );
    expect(humanize('fast–cheap')).toBe('Fast, cheap');
  });

  it('keeps numeric ranges as a plain hyphen', () => {
    expect(humanize('Studied 2019–2025.')).toBe('Studied 2019-2025.');
  });

  it('drops filler openers, emojis and smart quotes', () => {
    expect(humanize('Certainly! This post is “great” 🚀')).toBe(
      'This post is "great"',
    );
  });
});
