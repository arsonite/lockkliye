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

// TeaType Sync
import { createLocalStore } from '@teatype/sync';

// Types
import type { iHistoryEntry, iNotesState } from '@/types';

// The local copy of the data lives in IndexedDB, localStorage ends at about 5 MB and a history of whole notes
// gets there quickly.

const localStore = createLocalStore('lockkliye');

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

/**
 * Loads everything that was saved. Never rejects: if IndexedDB fails (e.g. private mode) the app starts empty.
 * @returns The persisted values, missing ones are undefined.
 */
const loadPersisted = async (): Promise<iPersisted> =>
    (await localStore.readAll(['data', 'history', 'redo', 'sync'])) as iPersisted;

export type { iPersisted };
export { loadPersisted, localStore };
