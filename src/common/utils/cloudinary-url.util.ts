// Cloudinary builds transformed images by encoding parameters directly in the URL.
// No re-upload needed — same publicId, different URL = different rendered size.
// First request to a new size triggers generation + CDN caching; every request after is instant.

export type ImageVariantPreset =
  | 'thumbnail' // 150x150 square — for lists, avatars-in-comments-on-images
  | 'square' // 1080x1080 — Instagram feed post
  | 'pinterestPin' // 1000x1500 (2:3 ratio) — Pinterest's preferred pin size
  | 'landscape' // 1200x630 — Open Graph / Facebook share preview
  | 'story' // 1080x1920 (9:16) — Instagram/FB Stories
  | 'original'; // untouched, just quality/format auto-optimized

interface TransformParams {
  width?: number;
  height?: number;
  crop?: string;
  gravity?: string;
}

const PRESETS: Record<
  Exclude<ImageVariantPreset, 'original'>,
  TransformParams
> = {
  thumbnail: { width: 150, height: 150, crop: 'fill', gravity: 'auto' },
  square: { width: 1080, height: 1080, crop: 'fill', gravity: 'auto' },
  pinterestPin: { width: 1000, height: 1500, crop: 'fill', gravity: 'auto' },
  landscape: { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
  story: { width: 1080, height: 1920, crop: 'fill', gravity: 'auto' },
};

export function buildCloudinaryUrl(
  cloudName: string,
  publicId: string,
  preset: ImageVariantPreset,
): string {
  const base = `https://res.cloudinary.com/${cloudName}/image/upload`;

  if (preset === 'original') {
    return `${base}/q_auto,f_auto/${publicId}`;
  }

  const { width, height, crop, gravity } = PRESETS[preset];
  const transform = `w_${width},h_${height},c_${crop},g_${gravity},q_auto,f_auto`;

  return `${base}/${transform}/${publicId}`;
}

export function buildAllVariants(
  cloudName: string,
  publicId: string,
): Record<ImageVariantPreset, string> {
  return {
    thumbnail: buildCloudinaryUrl(cloudName, publicId, 'thumbnail'),
    square: buildCloudinaryUrl(cloudName, publicId, 'square'),
    pinterestPin: buildCloudinaryUrl(cloudName, publicId, 'pinterestPin'),
    landscape: buildCloudinaryUrl(cloudName, publicId, 'landscape'),
    story: buildCloudinaryUrl(cloudName, publicId, 'story'),
    original: buildCloudinaryUrl(cloudName, publicId, 'original'),
  };
}
