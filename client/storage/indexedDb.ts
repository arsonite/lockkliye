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
const DB_NAME = 'lockkliye';
const STORE = 'kv';

type tKey = 'data' | 'history' | 'redo' | 'sync';

// Where each value was kept in localStorage before
const LEGACY_KEYS: Record<tKey, string> = {
    data: 'lockkliye-data',
    history: 'lockkliye-history',
    redo: 'lockkliye-redo',
    sync: 'lockkliye-sync',
};

interface iPersisted {
    data?: iNotesState;
    history?: iHistoryEntry[];
    redo?: iHistoryEntry[];
    sync?: unknown;
}

let opened: Promise<IDBDatabase> | null = null;

const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return opened;
};

const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
};

const read = <T>(key: tKey): Promise<T | undefined> => run('readonly', (store) => store.get(key));
const write = (key: tKey, value: unknown): Promise<IDBValidKey> => run('readwrite', (store) => store.put(value, key));

// Everything that was saved, data of the older localStorage version moves over once
const loadOnce = async (): Promise<iPersisted> => {
    const persisted: Record<string, unknown> = {};
    try {
        for (const key of Object.keys(LEGACY_KEYS) as tKey[]) {
            let value = await read<unknown>(key);
            const legacy = localStorage.getItem(LEGACY_KEYS[key]);
            if (value === undefined && legacy) {
                try {
                    value = JSON.parse(legacy);
                    await write(key, value);
                } catch {
                    value = undefined;
                }
            }
            if (legacy && value !== undefined) {
                localStorage.removeItem(LEGACY_KEYS[key]);
            }
            persisted[key] = value;
        }
    } catch (error) {
        console.error('IndexedDB is not available, nothing is saved in this browser', error);
    }
    return persisted as iPersisted;
};

// Loading twice at the same time (StrictMode) must not race the move from localStorage
let loading: Promise<iPersisted> | null = null;
const loadPersisted = (): Promise<iPersisted> => (loading ??= loadOnce());

export type { iPersisted, tKey };
export { loadPersisted, write };
