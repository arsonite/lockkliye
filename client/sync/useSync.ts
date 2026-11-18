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
import { useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// TeaType Sync
import { hashOf, mergeItems, useSync as useGenericSync } from '@teatype/sync';
import type { iCollectionResult, tSeed } from '@teatype/sync';

// Sync
import {
    blockCollection,
    folderCollection,
    historyCollection,
    noteCollection,
    presetCollection,
    settingsCollection,
    wordCollection,
    type iBlockItem,
    type iPresetItem,
    type iSettingsItem,
    type iWordItem,
} from '@/sync/collections';
import { assemble, deriveItems, type iSyncItems } from '@/sync/tree';

// Types
import type { iFolder, iHistoryEntry, iNote, iNotesState } from '@/types';

// Bump when the row format changes: an older meta would otherwise make unchanged-looking entities count as deleted on the server
const META_VERSION = 4;
// Entries point to entries of the collections before them, so this is also the order of saving
const COLLECTIONS = [
    folderCollection,
    noteCollection,
    settingsCollection,
    blockCollection,
    wordCollection,
    presetCollection,
    historyCollection,
];

interface iUseSyncProps {
    state: iNotesState;
    history: iHistoryEntry[];
    historyLimit: number;
    freshInstall: boolean; // The browser had no stored data, so the state is the generated welcome content
    storedMeta?: unknown; // The sync meta of the last session
    setState: Dispatch<SetStateAction<iNotesState>>;
    setHistory: Dispatch<SetStateAction<iHistoryEntry[]>>;
}

interface iResults {
    folders: iCollectionResult<iFolder>;
    notes: iCollectionResult<iNote>;
    settings: iCollectionResult<iSettingsItem>;
    blocks: iCollectionResult<iBlockItem>;
    words: iCollectionResult<iWordItem>;
    presets: iCollectionResult<iPresetItem>;
    history: iCollectionResult<iHistoryEntry>;
}

const settingsOf = (state: iNotesState): iSettingsItem => ({
    lightMode: state.lightMode,
    editorWidth: state.editorWidth,
    confirmDeletions: state.confirmDeletions,
    showBlockBorders: state.showBlockBorders,
    showStyleButton: state.showStyleButton,
    use24HourTime: state.use24HourTime,
    accentColor: state.accentColor,
    listOptions: state.listOptions,
    anchorStyle: state.anchorStyle,
    lockSetup: state.lockSetup,
    palette: state.palette,
});

// The generated welcome content is no change of the user, it is replaced as soon as the server has data of its own
const seedOf = (state: iNotesState): Record<string, tSeed> => {
    const items = deriveItems(state.folders, state.notes, state.blockPresets, settingsOf(state), []);
    const seed: Record<string, tSeed> = {};
    for (const collection of COLLECTIONS) {
        seed[collection.name] = {};
    }
    const add = <L extends object>(collection: { name: string; key: (item: L) => string }, list: L[]) => {
        for (const item of list) {
            seed[collection.name][collection.key(item)] = hashOf(collection as never, item);
        }
    };
    add(folderCollection, items.folders);
    add(noteCollection, items.notes);
    add(settingsCollection, items.settings);
    add(blockCollection, items.blocks);
    add(wordCollection, items.words);
    add(presetCollection, items.presets);
    return seed;
};

// Syncs the notes by hand: the server is only asked, saving is Ctrl+S
const useSync = ({ state, history, historyLimit, freshInstall, storedMeta, setState, setHistory }: iUseSyncProps) => {
    const latest = useRef({ state, history });
    latest.current = { state, history };

    const settings = useMemo(
        () => settingsOf(state),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.lightMode, state.editorWidth, state.confirmDeletions, state.showBlockBorders, state.showStyleButton, state.use24HourTime, state.accentColor, state.listOptions, state.anchorStyle, state.lockSetup, state.palette],
    );
    const presets = useMemo(
        () => deriveItems([], [], state.blockPresets, settings, []).presets,
        [state.blockPresets, settings],
    );

    // Edits of blocks and words always change the note itself (updatedAt), so the note row also shows those.
    // History is saved along with the notes, it does not count as an unsaved change on its own
    const tracked = [
        { collection: folderCollection, items: state.folders },
        { collection: noteCollection, items: state.notes },
        { collection: settingsCollection, items: [settings] },
        { collection: presetCollection, items: presets },
    ];

    const { dirty, meta, save, status, unsavedCount } = useGenericSync<{
        snapshot: iNotesState;
        snapshotHistory: iHistoryEntry[];
        snapshotSettings: iSettingsItem;
    }>({
        mode: 'manual',
        collections: COLLECTIONS,
        version: META_VERSION,
        storedMeta,
        initialSeed: freshInstall ? () => seedOf(latest.current.state) : undefined,
        tracked,
        read: () => {
            const { state: snapshot, history: snapshotHistory } = latest.current;
            const snapshotSettings = settingsOf(snapshot);
            const items: iSyncItems = deriveItems(
                snapshot.folders,
                snapshot.notes,
                snapshot.blockPresets,
                snapshotSettings,
                snapshotHistory,
            );
            return { items: { ...items }, context: { snapshot, snapshotHistory, snapshotSettings } };
        },
        apply: (generic, { snapshot, snapshotHistory, snapshotSettings }) => {
            const results = generic as unknown as iResults;
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
                const mergedNotes = mergeItems((note) => note.id, current.notes, snapshot.notes, assembled.notes);
                const mergedFolders = mergeItems(
                    (folder) => folder.id,
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
                mergeItems(historyCollection.key, current, snapshotHistory, assembled.history)
                    .filter((entry) => !removedNoteIds.has(entry.noteId))
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .slice(-historyLimit),
            );
        },
    });

    return {
        dirtyNoteIds: dirty.notes.dirty,
        meta,
        save,
        syncStatus: status,
        unsavedCount,
    };
};

export type { iSyncReport, tSyncStatus } from '@teatype/sync';
export default useSync;
