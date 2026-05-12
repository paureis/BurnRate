// Tiny IndexedDB wrapper. No library — ~80 lines.
// Database: `burnrate`. Version: 1. Stores: `snapshots` (keyPath snapshotMonth).

export const DB_NAME = "burnrate";
export const DB_VERSION = 1;

export const SNAPSHOTS_STORE = "snapshots";

const KNOWN_STORES = [SNAPSHOTS_STORE] as const;

function getIndexedDB(): IDBFactory | null {
  if (typeof indexedDB !== "undefined") return indexedDB;
  if (typeof globalThis !== "undefined" && "indexedDB" in globalThis) {
    return (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
  }
  return null;
}

function openDb(): Promise<IDBDatabase> {
  const factory = getIndexedDB();
  if (!factory) {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of KNOWN_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: keyPathFor(store) });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

function keyPathFor(store: string): string {
  switch (store) {
    case SNAPSHOTS_STORE:
      return "snapshotMonth";
    default:
      return "id";
  }
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    return (await promisifyRequest(objectStore.getAll())) as T[];
  } finally {
    db.close();
  }
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    await promisifyRequest(objectStore.put(value as unknown as IDBValidKey extends never ? never : unknown));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  } finally {
    db.close();
  }
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    await promisifyRequest(objectStore.delete(key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbClear(store: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    await promisifyRequest(objectStore.clear());
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    });
  } finally {
    db.close();
  }
}

export function isIndexedDbAvailable(): boolean {
  return getIndexedDB() !== null;
}
