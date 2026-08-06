// Cloudinary's fl_attachment flag forces the browser to download the file
// instead of displaying it inline. Without this flag, clicking the URL
// just opens the image in a new tab — not what "download" should do.
export function buildDownloadUrl(
  cloudName: string,
  publicId: string,
  filename: string,
): string {
  // Sanitize filename — remove characters that break Content-Disposition header
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);

  // fl_attachment:filename tells Cloudinary to set the Content-Disposition
  // header so the browser saves the file with this exact name
  return `https://res.cloudinary.com/${cloudName}/image/upload/fl_attachment:${safeFilename},q_auto/${publicId}`;
}
