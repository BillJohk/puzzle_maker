/**
 * The first file that looks like an image, by MIME type or, when the browser
 * reports none, by extension.
 */
export function firstImageFile<T extends { name: string; type: string }>(files: Iterable<T>): T | null {
  for (const f of files) {
    if (f.type.startsWith('image/')) return f;
    if (!f.type && /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(f.name)) return f;
  }
  return null;
}
