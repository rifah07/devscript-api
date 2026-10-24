// User text inside $regex is a pattern, not a string: `(a+)+$` can pin the
// DB CPU (ReDoS), and `.*` matches everything. Escape it to a literal.
export const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
