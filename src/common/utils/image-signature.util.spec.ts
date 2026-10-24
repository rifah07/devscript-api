import { detectImageType } from './image-signature.util';

const pad = (bytes: number[]) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('detectImageType', () => {
  it('recognises real image headers', () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii'))).toBe(
      'image/webp',
    );
  });

  it('rejects files that only claim to be images', () => {
    expect(
      detectImageType(Buffer.from('<html><script>alert(1)</script></html>')),
    ).toBeNull();
    expect(
      detectImageType(Buffer.from('MZ\x90\0 not an image at all')),
    ).toBeNull();
  });
});
