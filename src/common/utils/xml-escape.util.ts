// Escapes characters that have special meaning in XML.
// Without this, a post title containing & or < would produce invalid XML,
// or worse, allow malicious content injection into the feed.
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
