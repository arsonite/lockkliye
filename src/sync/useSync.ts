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

// React imports
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// Sync
import {
    assembleNotes,
    blockCollection,
    blockItemsOf,
    folderCollection,
    historyCollection,
    noteCollection,
    settingsCollection,
    type iCollection,
    type iSettingsItem,
} from '@/sync/collections';
import { findDirty, hashOf, syncCollection, type tSeed, type tSynced } from '@/sync/engine';

// Types
import type { iHistoryEntry, iNotesState } from '@/types';

const META_KEY = 'lockkliye-sync';
// Bump when the row format changes: an older meta would otherwise make unchanged-looking entities count as deleted on the server
const META_VERSION = 2;
const COLLECTIONS = ['folders', 'notes', 'blocks', 'settings', 'history'] as const;

type tSyncStatus = 'idle' | 'syncing' | 'offline';

interface iSyncMeta {
    version: number;
    synced: Record<string, tSynced>;
    seed: Record<string, tSeed>;
}

interface iSyncReport {
    ok: boolean;
    busy?: boolean; // Another sync was already running, nothing was done
    pushed: number;
    pulled: number;
    removed: number;
    overwritten: number;
    failed: number;
    error?: string;
}

interface iUseSyncProps {
    state: iNotesState;
    history: iHistoryEntry[];
    historyLimit: number;
    freshInstall: boolean; // The browser had no stored data, so the state is the generated welcome content
    setState: Dispatch<SetStateAction<iNotesState>>;
    setHistory: Dispatch<SetStateAction<iHistoryEntry[]>>;
}

const settingsOf = (state: iNotesState): iSettingsItem => ({
    lightMode: state.lightMode,
    sidebarExpanded: state.sidebarExpanded,
    editorWidth: state.editorWidth,
    confirmDeletions: state.confirmDeletions,
    blockPresets: state.blockPresets,
});

const emptyMeta = (): iSyncMeta => ({
    version: META_VERSION,
    synced: Object.fromEntries(COLLECTIONS.map((name) => [name, {}])),
    seed: Object.fromEntries(COLLECTIONS.map((name) => [name, {}])),
});

const loadMeta = (state: iNotesState, freshInstall: boolean): iSyncMeta => {
    const stored = localStorage.getItem(META_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.version === META_VERSION) {
                return parsed;
            }
        } catch {
            // Fall through to a fresh meta
        }
    }

    const meta = emptyMeta();
    if (freshInstall) {
        for (const folder of state.folders) {
            meta.seed.folders[folder.id] = hashOf(folderCollection, folder);
        }
        for (const note of state.notes) {
            meta.seed.notes[note.id] = hashOf(noteCollection, note);
        }
        for (const item of blockItemsOf(state.notes)) {
            meta.seed.blocks[item.block.id] = hashOf(blockCollection, item);
        }
        meta.seed.settings.main = hashOf(settingsCollection, settingsOf(state));
    }
    return meta;
};

// Takes the sync result for the entities that were not touched while the request was in flight,
// keeps everything the user changed or created in the meantime, and adds entities that are new from the server
const mergeItems = <L extends object>(
    collection: iCollection<L>,
    current: L[],
    snapshot: L[],
    result: L[],
): L[] => {
    const snapshotByKey = new Map(snapshot.map((item) => [collection.key(item), item]));
    const resultByKey = new Map(result.map((item) => [collection.key(item), item]));
    const seen = new Set<string>();
    const merged: L[] = [];

    for (const item of current) {
        const key = collection.key(item);
        seen.add(key);
        if (snapshotByKey.get(key) !== item) {
            merged.push(item);
            continue;
        }
        const synced = resultByKey.get(key);
        if (synced) {
            merged.push(synced);
        }
    }
    for (const item of result) {
        const key = collection.key(item);
        if (!seen.has(key) && !snapshotByKey.has(key)) {
            merged.push(item);
        }
    }
    return merged;
};

const useSync = ({ state, history, historyLimit, freshInstall, setState, setHistory }: iUseSyncProps) => {
    const [meta, setMeta] = useState<iSyncMeta>(() => loadMeta(state, freshInstall));
    const [status, setStatus] = useState<tSyncStatus>('idle');
    const syncing = useRef(false);
    const latest = useRef({ state, history, meta });
    latest.current = { state, history, meta };

    useEffect(() => {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
    }, [meta]);

    const settings = useMemo(
        () => settingsOf(state),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.lightMode, state.sidebarExpanded, state.editorWidth, state.confirmDeletions, state.blockPresets],
    );

    const dirty = useMemo(
        () => ({
            folders: findDirty(folderCollection, state.folders, meta.synced.folders, meta.seed.folders),
            notes: findDirty(noteCollection, state.notes, meta.synced.notes, meta.seed.notes),
            settings: findDirty(settingsCollection, [settings], meta.synced.settings, meta.seed.settings),
        }),
        [state.folders, state.notes, settings, meta],
    );

    // History is saved along with the notes, it does not count as an unsaved change on its own
    const unsavedCount = Object.values(dirty).reduce((sum, entry) => sum + entry.dirty.size + entry.deleted.length, 0);

    const sync = useCallback(
        async (push: boolean): Promise<iSyncReport> => {
            const report: iSyncReport = { ok: false, pushed: 0, pulled: 0, removed: 0, overwritten: 0, failed: 0 };
            if (syncing.current) {
                return { ...report, busy: true };
            }
            syncing.current = true;
            setStatus('syncing');

            const { state: snapshot, history: snapshotHistory, meta: snapshotMeta } = latest.current;
            const snapshotSettings = settingsOf(snapshot);

            try {
                const run = <L extends object>(collection: iCollection<L>, items: L[]) =>
                    syncCollection(
                        collection,
                        items,
                        snapshotMeta.synced[collection.name],
                        snapshotMeta.seed[collection.name],
                        push,
                    );
                const folders = await run(folderCollection, snapshot.folders);
                const notes = await run(noteCollection, snapshot.notes);
                const blocks = await run(blockCollection, blockItemsOf(snapshot.notes));
                const settingsResult = await run(settingsCollection, [snapshotSettings]);
                const historyResult = await run(historyCollection, snapshotHistory);
                const results = [folders, notes, blocks, settingsResult, historyResult];

                const syncedNotes = assembleNotes(notes.items, blocks.items);
                // Notes the sync removed (deleted elsewhere), their history entries have nothing left to point to
                const removedNoteIds = new Set(snapshot.notes.map((note) => note.id));
                syncedNotes.forEach((note) => removedNoteIds.delete(note.id));

                setState((current) => {
                    const mergedNotes = mergeItems(noteCollection, current.notes, snapshot.notes, syncedNotes);
                    const mergedFolders = mergeItems(folderCollection, current.folders, snapshot.folders, folders.items);
                    // Only overwrite the settings if they were not changed while saving
                    const settingsUntouched =
                        hashOf(settingsCollection, settingsOf(current)) === hashOf(settingsCollection, snapshotSettings);
                    const next = { ...current, notes: mergedNotes, folders: mergedFolders };
                    const syncedSettings = settingsResult.items[0];
                    if (syncedSettings && settingsUntouched) {
                        Object.assign(next, syncedSettings);
                    }
                    if (next.activeNoteId && !mergedNotes.some((note) => note.id === next.activeNoteId)) {
                        next.activeNoteId = mergedNotes[0]?.id ?? null;
                    }
                    if (next.activeFolderId && !mergedFolders.some((folder) => folder.id === next.activeFolderId)) {
                        next.activeFolderId = mergedFolders[0]?.id ?? null;
                    }
                    return next;
                });
                setHistory((current) =>
                    mergeItems(historyCollection, current, snapshotHistory, historyResult.items)
                        .filter((entry) => !removedNoteIds.has(entry.noteId))
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .slice(-historyLimit),
                );

                const nextMeta = emptyMeta();
                [folderCollection, noteCollection, blockCollection, settingsCollection, historyCollection].forEach((collection, index) => {
                    nextMeta.synced[collection.name] = results[index].synced;
                    // A placeholder that is synced (or gone) is no placeholder anymore
                    nextMeta.seed[collection.name] = Object.fromEntries(
                        Object.entries(snapshotMeta.seed[collection.name]).filter(
                            ([key]) => !(key in results[index].synced),
                        ),
                    );
                });
                setMeta(nextMeta);

                for (const result of results) {
                    report.pushed += result.pushed;
                    report.pulled += result.pulled;
                    report.removed += result.removed;
                    report.overwritten += result.overwritten;
                    report.failed += result.failed;
                }
                setStatus('idle');
                return { ...report, ok: true };
            } catch (error) {
                setStatus('offline');
                return { ...report, error: error instanceof Error ? error.message : String(error) };
            } finally {
                syncing.current = false;
            }
        },
        [historyLimit, setHistory, setState],
    );

    // Pull what the server has as soon as the app opens and when the connection returns, nothing is pushed without Ctrl+S
    useEffect(() => {
        const pull = () => void sync(false);
        pull();
        window.addEventListener('online', pull);
        return () => window.removeEventListener('online', pull);
    }, [sync]);

    const save = useCallback(() => sync(true), [sync]);

    return {
        dirtyNoteIds: dirty.notes.dirty,
        save,
        syncStatus: status,
        unsavedCount,
    };
};

export type { iSyncReport, tSyncStatus };
export default useSync;
