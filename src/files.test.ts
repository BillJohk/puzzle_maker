import { describe, expect, it } from 'vitest';
import { firstImageFile } from './files';

const file = (name: string, type: string) => ({ name, type });

describe('firstImageFile', () => {
  it('skips files that are not images', () => {
    const img = file('cat.jpg', 'image/jpeg');
    expect(firstImageFile([file('notes.txt', 'text/plain'), img, file('b.png', 'image/png')])).toBe(img);
  });

  it('falls back to the extension when there is no type', () => {
    const img = file('photo.WEBP', '');
    expect(firstImageFile([file('readme', ''), img])).toBe(img);
  });

  it('returns null when nothing is an image', () => {
    expect(firstImageFile([file('a.pdf', 'application/pdf')])).toBeNull();
    expect(firstImageFile([])).toBeNull();
  });
});
