export const PREVIEW_MODES = ['off', 'ghost', 'thumbnail'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

export const PREVIEW_LABELS: Record<PreviewMode, string> = {
  off: 'Off',
  ghost: 'Ghost on board',
  thumbnail: 'Corner picture',
};

export function parsePreviewMode(value: string | null): PreviewMode {
  return PREVIEW_MODES.find((m) => m === value) ?? 'thumbnail';
}

/** Largest size with the image's aspect ratio that fits in maxW × maxH, never upscaling. */
export function fitSize(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}
