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
    blockCollection,
    folderCollection,
    historyCollection,
    noteCollection,
    presetCollection,
    settingsCollection,
    wordCollection,
    type iCollection,
    type iSettingsItem,
} from '@/sync/collections';
import { findDirty, hashOf, syncCollection, type iCollectionResult, type tSeed, type tSynced } from '@/sync/engine';
import { assemble, deriveItems, type iSyncItems } from '@/sync/tree';
import usePersist from '@/storage/usePersist';

// Types
import type { iHistoryEntry, iNotesState } from '@/types';

// Bump when the row format changes: an older meta would otherwise make unchanged-looking entities count as deleted on the server
const META_VERSION = 4;
// Entries point to entries of the collections before them, so this is also the order of saving
const COLLECTIONS = [
    'folders',
    'notes',
    'settings',
    'blocks',
    'words',
    'presets',
    'history',
] as const;

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
    storedMeta?: unknown; // The sync meta of the last session
    setState: Dispatch<SetStateAction<iNotesState>>;
    setHistory: Dispatch<SetStateAction<iHistoryEntry[]>>;
}

const settingsOf = (state: iNotesState): iSettingsItem => ({
    lightMode: state.lightMode,
    sidebarExpanded: state.sidebarExpanded,
    editorWidth: state.editorWidth,
    confirmDeletions: state.confirmDeletions,
    palette: state.palette,
});

const emptyMeta = (): iSyncMeta => ({
    version: META_VERSION,
    synced: Object.fromEntries(COLLECTIONS.map((name) => [name, {}])),
    seed: Object.fromEntries(COLLECTIONS.map((name) => [name, {}])),
});

const loadMeta = (state: iNotesState, freshInstall: boolean, stored: unknown): iSyncMeta => {
    if ((stored as iSyncMeta | undefined)?.version === META_VERSION) {
        return stored as iSyncMeta;
    }

    const meta = emptyMeta();
    if (freshInstall) {
        const items = deriveItems(state.folders, state.notes, state.blockPresets, settingsOf(state), []);
        const addSeed = <L extends object>(collection: iCollection<L>, list: L[]) => {
            for (const item of list) {
                meta.seed[collection.name][collection.key(item)] = hashOf(collection, item);
            }
        };
        addSeed(folderCollection, items.folders);
        addSeed(noteCollection, items.notes);
        addSeed(settingsCollection, items.settings);
        addSeed(blockCollection, items.blocks);
        addSeed(wordCollection, items.words);
        addSeed(presetCollection, items.presets);
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

const useSync = ({ state, history, historyLimit, freshInstall, storedMeta, setState, setHistory }: iUseSyncProps) => {
    const [meta, setMeta] = useState<iSyncMeta>(() => loadMeta(state, freshInstall, storedMeta));
    const [status, setStatus] = useState<tSyncStatus>('idle');
    const syncing = useRef(false);
    const latest = useRef({ state, history, meta });
    latest.current = { state, history, meta };

    usePersist('sync', meta);

    const settings = useMemo(
        () => settingsOf(state),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.lightMode, state.sidebarExpanded, state.editorWidth, state.confirmDeletions, state.palette],
    );
    const presets = useMemo(
        () => deriveItems([], [], state.blockPresets, settings, []).presets,
        [state.blockPresets, settings],
    );

    // Edits of blocks and words always change the note itself (updatedAt), so the note row also shows those
    const dirty = useMemo(
        () => ({
            folders: findDirty(folderCollection, state.folders, meta.synced.folders, meta.seed.folders),
            notes: findDirty(noteCollection, state.notes, meta.synced.notes, meta.seed.notes),
            settings: findDirty(settingsCollection, [settings], meta.synced.settings, meta.seed.settings),
            presets: findDirty(presetCollection, presets, meta.synced.presets, meta.seed.presets),
        }),
        [state.folders, state.notes, settings, presets, meta],
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
            // The collections that were synced, if a later one fails the writes of these must not be forgotten
            const finished: Record<string, iCollectionResult<object>> = {};

            try {
                // What the collections saved so far ended up as, later ones look up the server ids of their relations here
                const done: Record<string, tSynced> = {};
                const run = async <L extends object>(collection: iCollection<L>, items: L[]) => {
                    const result = await syncCollection(
                        collection,
                        items,
                        snapshotMeta.synced[collection.name],
                        snapshotMeta.seed[collection.name],
                        push,
                        done,
                    );
                    done[collection.name] = result.synced;
                    finished[collection.name] = result;
                    return result;
                };
                const items: iSyncItems = deriveItems(
                    snapshot.folders,
                    snapshot.notes,
                    snapshot.blockPresets,
                    snapshotSettings,
                    snapshotHistory,
                );
                // Same order as COLLECTIONS
                const results = {
                    folders: await run(folderCollection, items.folders),
                    notes: await run(noteCollection, items.notes),
                    settings: await run(settingsCollection, items.settings),
                    blocks: await run(blockCollection, items.blocks),
                    words: await run(wordCollection, items.words),
                    presets: await run(presetCollection, items.presets),
                    history: await run(historyCollection, items.history),
                };

                const assembled = assemble(
                    {
                        notes: results.notes.items,
                        blocks: results.blocks.items,
                        words: results.words.items,
                        presets: results.presets.items,
                        history: results.history.items,
                    },
                    snapshotHistory,
                    snapshot.blockPresets,
                );
                // Notes the sync removed (deleted elsewhere), their history entries have nothing left to point to
                const removedNoteIds = new Set(snapshot.notes.map((note) => note.id));
                assembled.notes.forEach((note) => removedNoteIds.delete(note.id));

                setState((current) => {
                    const mergedNotes = mergeItems(noteCollection, current.notes, snapshot.notes, assembled.notes);
                    const mergedFolders = mergeItems(
                        folderCollection,
                        current.folders,
                        snapshot.folders,
                        results.folders.items,
                    );
                    const next = { ...current, notes: mergedNotes, folders: mergedFolders };
                    // Only overwrite settings and presets if they were not changed while saving
                    const syncedSettings = results.settings.items[0];
                    if (
                        syncedSettings &&
                        hashOf(settingsCollection, settingsOf(current)) === hashOf(settingsCollection, snapshotSettings)
                    ) {
                        Object.assign(next, syncedSettings);
                    }
                    if (current.blockPresets === snapshot.blockPresets) {
                        next.blockPresets = assembled.presets;
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
                    mergeItems(historyCollection, current, snapshotHistory, assembled.history)
                        .filter((entry) => !removedNoteIds.has(entry.noteId))
                        .sort((a, b) => a.timestamp - b.timestamp)
                        .slice(-historyLimit),
                );

                const nextMeta = emptyMeta();
                for (const name of COLLECTIONS) {
                    nextMeta.synced[name] = results[name].synced;
                    // A placeholder that is synced (or gone) is no placeholder anymore
                    nextMeta.seed[name] = Object.fromEntries(
                        Object.entries(snapshotMeta.seed[name]).filter(([key]) => !(key in results[name].synced)),
                    );
                    report.pushed += results[name].pushed;
                    report.pulled += results[name].pulled;
                    report.removed += results[name].removed;
                    report.overwritten += results[name].overwritten;
                    report.failed += results[name].failed;
                }
                setMeta(nextMeta);

                setStatus('idle');
                return { ...report, ok: true };
            } catch (error) {
                // Rows that were created or deleted on the server stay known, or they would come back as strangers
                // and rows deleted here would not be deleted there
                const partial = emptyMeta();
                partial.seed = snapshotMeta.seed;
                for (const name of COLLECTIONS) {
                    const synced = { ...snapshotMeta.synced[name] };
                    const result = finished[name];
                    result?.pushedKeys.forEach((key) => (synced[key] = result.synced[key]));
                    result?.removedKeys.forEach((key) => delete synced[key]);
                    partial.synced[name] = synced;
                }
                setMeta(partial);
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
