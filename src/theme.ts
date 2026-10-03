export interface TableColor {
  id: string;
  label: string;
  /** null keeps the stylesheet's color, which follows light/dark mode. */
  color: string | null;
}

export const TABLE_COLORS: readonly TableColor[] = [
  { id: 'felt', label: 'Green felt', color: null },
  { id: 'navy', label: 'Navy', color: '#1f2f4a' },
  { id: 'wine', label: 'Wine', color: '#4a1f2c' },
  { id: 'charcoal', label: 'Charcoal', color: '#2b2b2e' },
  { id: 'walnut', label: 'Walnut', color: '#5a3d26' },
  { id: 'sand', label: 'Sand', color: '#d9cdb4' },
  { id: 'paper', label: 'Paper', color: '#ecebe7' },
];

export function tableColor(id: string | null): TableColor {
  return TABLE_COLORS.find((c) => c.id === id) ?? TABLE_COLORS[0];
}

/** Relative luminance (WCAG) of a #rrggbb color, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a #rrggbb color: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Light tables need dark text and outlines to stay readable. */
export function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.35;
}
