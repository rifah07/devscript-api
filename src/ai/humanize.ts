// Guardrails so AI text reads like a person wrote it. The style rules go
// into every prompt, and humanize() cleans whatever slips through anyway:
// prompts are requests, code is a guarantee.

export const STYLE_RULES =
  'Write like a thoughtful human, in plain words. Never use em dashes or en dashes. ' +
  'No emojis. No filler openers ("Certainly", "Great question", "In conclusion"). ' +
  'Avoid the words: delve, tapestry, testament, realm, embark, unlock, elevate, seamless, vibrant.';

const FILLER_OPENERS =
  /^(certainly|sure|great question|of course|absolutely|in conclusion|overall)[,!.:]?\s+/i;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

export function humanize(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, (match, offset: number, whole: string) =>
      // "2019–2025" stays a range; a dash between words becomes a comma.
      /\d/.test(whole[offset - 1] ?? '') &&
      /\d/.test(whole[offset + match.length] ?? '')
        ? '-'
        : ', ',
    )
    .replace(EMOJI, '')
    .replace(FILLER_OPENERS, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\*\*(.+?)\*\*/g, '$1') // stray markdown bold in plain-text answers
    .replace(/ {2,}/g, ' ')
    .replace(/ ,/g, ',')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}
