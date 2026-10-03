// The saved puzzle lives in IndexedDB: the image is too large for localStorage.
// Everything stays in this browser; failures are swallowed since saving is a
// convenience, not something the game depends on.

const DB_NAME = 'puzzle-maker';
const STORE = 'save';
const IMAGE_KEY = 'image';
const STATE_KEY = 'state';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = op(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch {
    return undefined;
  }
}

/** Stores a new image and drops any progress saved for the previous one. */
export function saveImage(image: Blob): Promise<void> {
  return quietly(() =>
    run('readwrite', (store) => {
      store.put(image, IMAGE_KEY);
      store.delete(STATE_KEY);
    }),
  ).then(() => undefined);
}

export function saveState(state: unknown): Promise<void> {
  return quietly(() => run('readwrite', (store) => store.put(state, STATE_KEY))).then(() => undefined);
}

/** Drops the saved puzzle but keeps the image, so a new cut of it can still be saved and resumed. */
export function clearState(): Promise<void> {
  return quietly(() => run('readwrite', (store) => store.delete(STATE_KEY))).then(() => undefined);
}

/** The saved image and puzzle state, if both are present. */
export async function loadSave(): Promise<{ image: Blob; state: unknown } | null> {
  const result = await quietly(async () => {
    const image = await run<unknown>('readonly', (store) => store.get(IMAGE_KEY));
    const state = await run<unknown>('readonly', (store) => store.get(STATE_KEY));
    return image instanceof Blob && state !== undefined ? { image, state } : null;
  });
  return result ?? null;
}
