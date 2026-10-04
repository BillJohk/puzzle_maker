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

/** Every file that looks like an image, by the same rule as `firstImageFile`. */
export function imageFiles<T extends { name: string; type: string }>(files: Iterable<T>): T[] {
  return [...files].filter((f) => firstImageFile([f]) === f);
}

/**
 * Hands out items in random order without repeats until every one has been
 * drawn, then reshuffles. The first draw after a reshuffle is never the item
 * drawn just before it.
 */
export class ShuffleBag<T> {
  private readonly items: T[];
  private remaining: T[] = [];
  private last: T | undefined;

  constructor(
    items: Iterable<T>,
    private readonly random: () => number = Math.random,
  ) {
    this.items = [...items];
  }

  get size(): number {
    return this.items.length;
  }

  has(item: T): boolean {
    return this.items.includes(item);
  }

  /** Takes an item out for good, so it is never drawn again. */
  remove(item: T): void {
    const drop = (list: T[]) => {
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
    };
    drop(this.items);
    drop(this.remaining);
  }

  next(): T | undefined {
    if (this.items.length === 0) return undefined;
    if (this.remaining.length === 0) {
      const order = [...this.items];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      // Draws come off the end; keep the previous pick away from there.
      if (order.length > 1 && order[order.length - 1] === this.last) {
        [order[0], order[order.length - 1]] = [order[order.length - 1], order[0]];
      }
      this.remaining = order;
    }
    this.last = this.remaining.pop();
    return this.last;
  }
}
