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

// Sync
import {
    presetKeyOf,
    type iBlockItem,
    type iPresetItem,
    type iSettingsItem,
    type iWordItem,
} from '@/sync/collections';

// Types
import { createBlock, createWord } from '@/types';
import type { iBlockStyle, iFolder, iHistoryEntry, iNote } from '@/types';

// What the app stores as nested objects is stored on the server as flat entries: this module takes the
// app state apart into those entries (deriveItems) and puts the entries of a sync result back together (assemble).
interface iSyncItems {
    folders: iFolder[];
    notes: iNote[];
    settings: iSettingsItem[];
    blocks: iBlockItem[];
    words: iWordItem[];
    presets: iPresetItem[];
    history: iHistoryEntry[];
}

interface iAssembled {
    notes: iNote[];
    history: iHistoryEntry[];
    presets: iBlockStyle[];
}

// Derived items are cached per source object, so unchanged parts of the state keep their identity (and their hash)
type tMemo<V> = WeakMap<object, { signature: string; value: V }>;
const blockItems: tMemo<iBlockItem> = new WeakMap();
const presetItems: tMemo<iPresetItem> = new WeakMap();
const wordItems: tMemo<iWordItem> = new WeakMap();

const memo = <V>(cache: tMemo<V>, key: object, signature: string, make: () => V): V => {
    const hit = cache.get(key);
    if (hit && hit.signature === signature) {
        return hit.value;
    }
    const value = make();
    cache.set(key, { signature, value });
    return value;
};

const sameItems = <T>(a: T[], b: T[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);
const byPosition = <T extends { position: number }>(a: T, b: T): number => a.position - b.position;

const group = <T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> => {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        const members = groups.get(key) ?? [];
        members.push(item);
        groups.set(key, members);
    }
    return groups;
};

const deriveItems = (
    folders: iFolder[],
    notes: iNote[],
    presets: iBlockStyle[],
    settings: iSettingsItem,
    history: iHistoryEntry[],
): iSyncItems => {
    const items: iSyncItems = { folders, notes, settings: [settings], blocks: [], words: [], presets: [], history };

    for (const note of notes) {
        note.blocks.forEach((block, position) => {
            items.blocks.push(
                memo(blockItems, block, `${note.id}:${position}`, () => ({
                    id: block.id,
                    noteId: note.id,
                    position,
                    block,
                })),
            );
            block.words.forEach((word, wordPosition) => {
                items.words.push(
                    memo(wordItems, word, `${block.id}:${wordPosition}`, () => ({
                        id: word.id,
                        blockId: block.id,
                        position: wordPosition,
                        word,
                    })),
                );
            });
        });
    }

    presets.forEach((style, position) => {
        items.presets.push(memo(presetItems, style, String(position), () => ({
            id: presetKeyOf(position),
            position,
            style,
        })));
    });

    return items;
};

const assemble = (
    result: Pick<iSyncItems, 'notes' | 'blocks' | 'words' | 'presets' | 'history'>,
    localHistory: iHistoryEntry[],
    localPresets: iBlockStyle[],
): iAssembled => {
    const wordsByBlock = group(result.words, (item) => item.blockId);
    const blocksByNote = group(result.blocks, (item) => item.noteId);

    const notes = result.notes.map((note) => {
        const blocks = (blocksByNote.get(note.id) ?? []).sort(byPosition).map((item) => {
            const words = (wordsByBlock.get(item.id) ?? []).sort(byPosition).map((entry) => entry.word);
            const original = item.block;
            const wordsOfBlock = words.length > 0 ? words : [createWord('')];
            // Keep the local object if nothing changed, so React and the hash cache see no new value
            return sameItems(original.words, wordsOfBlock) ? original : { ...original, words: wordsOfBlock };
        });
        const noteBlocks = blocks.length > 0 ? blocks : [createBlock([createWord('')])];
        return sameItems(note.blocks, noteBlocks) ? note : { ...note, blocks: noteBlocks };
    });

    // A history entry pulled from the server keeps the note as it was, in the folder the note is in now
    const local = new Set(localHistory);
    const noteById = new Map(notes.map((note) => [note.id, note]));
    const history = result.history.map((entry) =>
        local.has(entry)
            ? entry
            : { ...entry, note: { ...entry.note, folderId: noteById.get(entry.noteId)?.folderId ?? null } },
    );

    const presets = [...result.presets].sort(byPosition).map((item) => item.style);
    return { notes, history, presets: sameItems(localPresets, presets) ? localPresets : presets };
};

export type { iAssembled, iSyncItems };
export { assemble, deriveItems, sameItems };
