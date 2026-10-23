import { randomBytes } from 'crypto';

// Google login state: "<site>.<nonce>". The site picks where to send the
// browser back; the nonce ties the login to the browser that started it.
export const OAUTH_NONCE_COOKIE = 'oauth_nonce';
const STATE = /^(devscript|personal)\.([A-Za-z0-9_-]{22,64})$/;

export const newNonce = (): string => randomBytes(24).toString('base64url');

export function parseState(
  state: string | undefined,
): { site: 'devscript' | 'personal'; nonce: string } | null {
  const match = STATE.exec(state ?? '');
  return match
    ? { site: match[1] as 'devscript' | 'personal', nonce: match[2] }
    : null;
}
