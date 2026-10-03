export const PREVIEW_MODES = ['off', 'ghost', 'thumbnail'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

export const PREVIEW_LABELS: Record<PreviewMode, string> = {
  off: 'Preview off',
  ghost: 'Preview: ghost',
  thumbnail: 'Preview: picture',
};

/** The mode after `mode` when cycling with the preview button. */
export function nextPreviewMode(mode: PreviewMode): PreviewMode {
  return PREVIEW_MODES[(PREVIEW_MODES.indexOf(mode) + 1) % PREVIEW_MODES.length];
}

export function parsePreviewMode(value: string | null): PreviewMode {
  return PREVIEW_MODES.find((m) => m === value) ?? 'thumbnail';
}

/** Largest size with the image's aspect ratio that fits in maxW × maxH, never upscaling. */
export function fitSize(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}
