import { describe, expect, it } from 'vitest';
import { isLightColor, luminance, TABLE_COLORS, tableColor } from './theme';

describe('luminance', () => {
  it('spans black to white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1);
  });

  it('weights green above red above blue', () => {
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
    expect(luminance('#ff0000')).toBeGreaterThan(luminance('#0000ff'));
  });

  it('rejects other formats', () => {
    expect(() => luminance('red')).toThrow();
    expect(() => luminance('#fff')).toThrow();
  });
});

describe('isLightColor', () => {
  it('tells light tables from dark ones', () => {
    expect(isLightColor('#ecebe7')).toBe(true);
    expect(isLightColor('#d9cdb4')).toBe(true);
    expect(isLightColor('#2c4a3b')).toBe(false);
    expect(isLightColor('#5a3d26')).toBe(false);
  });
});

describe('tableColor', () => {
  it('finds a color by id and falls back to the default', () => {
    expect(tableColor('navy').color).toBe('#1f2f4a');
    expect(tableColor(null)).toBe(TABLE_COLORS[0]);
    expect(tableColor('plaid')).toBe(TABLE_COLORS[0]);
  });

  it('has unique ids and valid colors', () => {
    expect(new Set(TABLE_COLORS.map((c) => c.id)).size).toBe(TABLE_COLORS.length);
    for (const c of TABLE_COLORS) if (c.color) expect(() => luminance(c.color!)).not.toThrow();
  });
});
