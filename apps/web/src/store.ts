import type { RoutineItem, RoutineTemplate } from "@autiplanner/core";
import type { CommandName } from "./api.js";

/** A command the user made that has not been confirmed by the server yet. */
export interface PendingCommand {
  /** Doubles as the idempotency key sent to the server. */
  readonly id: string;
  readonly command: CommandName;
  readonly uid?: string;
  readonly completedAt?: string;
  readonly expectedRevision?: number;
  readonly item?: RoutineItem;
  /** A repeating template, for `add_series`. */
  readonly series?: RoutineTemplate;
  readonly patch?: Record<string, unknown>;
  readonly queuedAt: string;
}

export interface LocalState {
  readonly items: readonly RoutineItem[];
  readonly revision: number;
  readonly syncedAt: string | null;
}

/**
 * Everything the app needs to work with no network.
 *
 * Kept behind an interface so the offline rules can be tested without a browser.
 */
export interface LocalStore {
  getState(): Promise<LocalState | null>;
  putState(state: LocalState): Promise<void>;
  listPending(): Promise<readonly PendingCommand[]>;
  putPending(command: PendingCommand): Promise<void>;
  removePending(id: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "autiplanner";
const DB_VERSION = 1;
const STATE_STORE = "state";
const PENDING_STORE = "pending";
const STATE_KEY = "current";

/** IndexedDB implementation used in the browser. */
export class IndexedDbStore implements LocalStore {
  private database: Promise<IDBDatabase> | null = null;

  constructor(private readonly indexedDb: IDBFactory = globalThis.indexedDB) {}

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.indexedDb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STATE_STORE)) {
          database.createObjectStore(STATE_STORE);
        }
        if (!database.objectStoreNames.contains(PENDING_STORE)) {
          database.createObjectStore(PENDING_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });
    return this.database;
  }

  private async run<T>(
    store: string,
    mode: IDBTransactionMode,
    work: (objectStore: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      const request = work(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB aborted"));
    });
  }

  async getState(): Promise<LocalState | null> {
    const value = await this.run<LocalState | undefined>(STATE_STORE, "readonly", (s) =>
      s.get(STATE_KEY),
    );
    return value ?? null;
  }

  putState(state: LocalState): Promise<void> {
    return this.run(STATE_STORE, "readwrite", (s) => s.put(state, STATE_KEY)).then(
      () => undefined,
    );
  }

  async listPending(): Promise<readonly PendingCommand[]> {
    const all = await this.run<PendingCommand[]>(PENDING_STORE, "readonly", (s) => s.getAll());
    // Oldest first: the queue is replayed in the order the user made changes.
    return all.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  }

  putPending(command: PendingCommand): Promise<void> {
    return this.run(PENDING_STORE, "readwrite", (s) => s.put(command)).then(() => undefined);
  }

  removePending(id: string): Promise<void> {
    return this.run(PENDING_STORE, "readwrite", (s) => s.delete(id)).then(() => undefined);
  }

  async clear(): Promise<void> {
    await this.run(STATE_STORE, "readwrite", (s) => s.clear());
    await this.run(PENDING_STORE, "readwrite", (s) => s.clear());
  }
}

/** In-memory store, used by tests and as a fallback when IndexedDB is blocked. */
export class MemoryStore implements LocalStore {
  private state: LocalState | null = null;
  private pending = new Map<string, PendingCommand>();

  async getState(): Promise<LocalState | null> {
    return this.state;
  }

  async putState(state: LocalState): Promise<void> {
    this.state = state;
  }

  async listPending(): Promise<readonly PendingCommand[]> {
    return [...this.pending.values()].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  }

  async putPending(command: PendingCommand): Promise<void> {
    this.pending.set(command.id, command);
  }

  async removePending(id: string): Promise<void> {
    this.pending.delete(id);
  }

  async clear(): Promise<void> {
    this.state = null;
    this.pending.clear();
  }
}

/**
 * Opens IndexedDB, falling back to memory.
 *
 * Private browsing and some embedded webviews refuse IndexedDB. Losing the cache
 * is acceptable; losing the whole app is not.
 */
export async function openLocalStore(): Promise<LocalStore> {
  try {
    const store = new IndexedDbStore();
    await store.getState();
    return store;
  } catch (error) {
    console.warn("[autiplanner] IndexedDB unavailable, staying in memory", error);
    return new MemoryStore();
  }
}

export function newId(): string {
  if (globalThis.crypto?.randomUUID !== undefined) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
