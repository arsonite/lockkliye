/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 */

// Types
import type { iHistoryEntry, iNotesState } from '@/types';

// The local copy of the data lives in IndexedDB, localStorage ends at about 5 MB and a history of whole notes
// gets there quickly. Values are stored as they are, not as JSON text.

const DB_NAME = 'lockkliye'; // Name of the IndexedDB database.
const STORE = 'kv'; // Name of the single object store, used as a simple key-value table (out-of-line keys).

type tKey = 'data' | 'history' | 'redo' | 'sync'; // Keys under which values are stored in the key-value store.

/**
 * Shape of everything that is persisted locally.
 * Every field is optional, because nothing exists on a first start or when IndexedDB is unavailable.
 */
interface iPersisted {
    data?: iNotesState; // Current state of the notes
    history?: iHistoryEntry[]; // Undo stack
    redo?: iHistoryEntry[]; // Redo stack
    sync?: unknown; // Sync metadata, its structure is owned by the sync code
}

// Cached connection promise, so the database is opened only once.
let opened: Promise<IDBDatabase> | null = null;

/**
 * Opens the database (lazily, once) and creates the object store on first use.
 * @returns Promise resolving to the shared database connection.
 */
const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise((resolve, reject) => {
        // Version 1: the only schema change is creating the store
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return opened;
};

/**
 * Runs one request inside its own transaction.
 * Resolves only when the transaction completed, so a resolved write is really committed.
 * @param mode Transaction mode, 'readonly' or 'readwrite'.
 * @param work Callback that issues exactly one request on the store.
 * @returns Promise resolving to the result of that request.
 */
const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));
        // Wait for the transaction, not just the request, to be sure data is durable
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
};

/**
 * Reads one value.
 * @param key Key to read.
 * @returns The stored value, or undefined if nothing is stored.
 */
const read = <T>(key: tKey): Promise<T | undefined> => run('readonly', (store) => store.get(key));

/**
 * Writes one value, replacing an existing one. The value must be structured-cloneable.
 * @param key Key to write.
 * @param value Value to store.
 * @returns Promise resolving to the key once committed.
 */
const write = (key: tKey, value: unknown): Promise<IDBValidKey> => run('readwrite', (store) => store.put(value, key));

/** All keys that are loaded on start. */
const KEYS: tKey[] = ['data', 'history', 'redo', 'sync'];

/**
 * Loads everything that was saved.
 * Never rejects: if IndexedDB fails (e.g. private mode), the error is logged
 * and whatever was read so far is returned, so the app can start empty.
 * @returns The persisted values, missing ones are undefined.
 */
const loadPersisted = async (): Promise<iPersisted> => {
    const persisted: Record<string, unknown> = {};
    try {
        // Sequential reads, each in its own transaction
        for (const key of KEYS) {
            persisted[key] = await read<unknown>(key);
        }
    } catch (error) {
        console.error('IndexedDB is not available, nothing is saved in this browser', error);
    }
    return persisted as iPersisted;
};

export type { iPersisted, tKey };
export { loadPersisted, write };
