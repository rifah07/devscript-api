import { createHash, timingSafeEqual } from 'crypto';

// `===` returns early on the first different byte, so response time leaks how
// much of a guess was right. Hashing first gives equal-length buffers.
export function safeCompare(
  given: string | undefined,
  expected: string | undefined,
): boolean {
  if (!given || !expected) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
