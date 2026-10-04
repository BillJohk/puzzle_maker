import { describe, expect, it } from 'vitest';
import { firstImageFile, imageFiles, ShuffleBag } from './files';

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

describe('imageFiles', () => {
  it('keeps only the images, in order', () => {
    const a = file('a.jpg', 'image/jpeg');
    const b = file('b.heic', '');
    expect(imageFiles([file('x.txt', 'text/plain'), a, file('.DS_Store', ''), b])).toEqual([a, b]);
  });
});

describe('ShuffleBag', () => {
  it('returns undefined when empty', () => {
    expect(new ShuffleBag([]).next()).toBeUndefined();
  });

  it('draws every item once before repeating', () => {
    const bag = new ShuffleBag([1, 2, 3, 4, 5]);
    for (let round = 0; round < 3; round++) {
      const drawn = Array.from({ length: 5 }, () => bag.next());
      expect([...drawn].sort()).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('never draws the same item twice in a row across reshuffles', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const bag = new ShuffleBag(['a', 'b', 'c'], random);
    let prev = bag.next();
    for (let i = 0; i < 300; i++) {
      const cur = bag.next();
      expect(cur).not.toBe(prev);
      prev = cur;
    }
  });

  it('keeps returning the only item', () => {
    const bag = new ShuffleBag(['solo']);
    expect([bag.next(), bag.next()]).toEqual(['solo', 'solo']);
  });

  it('never draws a removed item again', () => {
    const bag = new ShuffleBag([1, 2, 3, 4]);
    const first = bag.next()!;
    bag.remove(first);
    bag.remove(99);
    expect(bag.size).toBe(3);
    expect(bag.has(first)).toBe(false);
    const drawn = Array.from({ length: 9 }, () => bag.next());
    expect(drawn).not.toContain(first);
    expect(new Set(drawn).size).toBe(3);
  });

  it('is empty once everything is removed', () => {
    const bag = new ShuffleBag(['a']);
    bag.remove(bag.next()!);
    expect(bag.size).toBe(0);
    expect(bag.next()).toBeUndefined();
  });
});
