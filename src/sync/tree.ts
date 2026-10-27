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
    historyKeyOf,
    snapshotChildIdOf,
    snapshotIdOf,
    styleIdOf,
    type iBlockItem,
    type iPresetItem,
    type iSettingsItem,
    type iSnapshotItem,
    type iStyleItem,
    type iWordItem,
} from '@/sync/collections';

// Types
import { createBlock, createWord } from '@/types';
import type { iBlockStyle, iFolder, iHistoryEntry, iNote, iTextBlock } from '@/types';

// What the app stores as nested objects is stored on the server as many flat entries: this module takes the
// app state apart into those entries (deriveItems) and puts the entries of a sync result back together (assemble).
interface iSyncItems {
    folders: iFolder[];
    notes: iNote[];
    snapshots: iSnapshotItem[];
    settings: iSettingsItem[];
    styles: iStyleItem[];
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
const snapshotItems: tMemo<iSnapshotItem> = new WeakMap();
const styleItems: tMemo<iStyleItem> = new WeakMap();
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

const group = <T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> => {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        if (key === null) {
            continue;
        }
        const members = groups.get(key) ?? [];
        members.push(item);
        groups.set(key, members);
    }
    return groups;
};

const appendTree = (
    items: iSyncItems,
    blocks: iTextBlock[],
    owner: { noteId: string | null; snapshotId: string | null },
    idOf: (kind: 'block' | 'word', id: string) => string,
): void => {
    blocks.forEach((block, position) => {
        const blockRowId = idOf('block', block.id);
        const style = block.style ?? {};
        items.blocks.push(
            memo(
                blockItems,
                block,
                `${blockRowId}:${position}:${owner.noteId}:${owner.snapshotId}`,
                () => ({ id: blockRowId, noteId: owner.noteId, snapshotId: owner.snapshotId, position, block }),
            ),
        );
        items.styles.push(
            memo(styleItems, style, styleIdOf(blockRowId), () => ({ id: styleIdOf(blockRowId), style })),
        );
        block.words.forEach((word, wordPosition) => {
            const wordRowId = idOf('word', word.id);
            items.words.push(
                memo(
                    wordItems,
                    word,
                    `${wordRowId}:${blockRowId}:${wordPosition}`,
                    () => ({ id: wordRowId, blockRowId, position: wordPosition, word }),
                ),
            );
        });
    });
};

const deriveItems = (
    folders: iFolder[],
    notes: iNote[],
    presets: iBlockStyle[],
    settings: iSettingsItem,
    history: iHistoryEntry[],
): iSyncItems => {
    const items: iSyncItems = {
        folders,
        notes,
        snapshots: [],
        settings: [settings],
        styles: [],
        blocks: [],
        words: [],
        presets: [],
        history,
    };

    for (const note of notes) {
        appendTree(items, note.blocks, { noteId: note.id, snapshotId: null }, (_kind, id) => id);
    }

    for (const entry of history) {
        const key = historyKeyOf(entry);
        const snapshotId = snapshotIdOf(key);
        items.snapshots.push(memo(snapshotItems, entry, snapshotId, () => ({ id: snapshotId, note: entry.note })));
        appendTree(
            items,
            entry.note.blocks,
            { noteId: null, snapshotId },
            (kind, id) => snapshotChildIdOf(key, kind, id),
        );
    }

    presets.forEach((style, position) => {
        const id = `preset_${position}`;
        items.presets.push(memo(presetItems, style, id, () => ({ id, position })));
        items.styles.push(memo(styleItems, style, styleIdOf(id), () => ({ id: styleIdOf(id), style })));
    });

    return items;
};

// Blocks of every note and snapshot, keyed by the id of the note or snapshot
const assembleBlocks = (blocks: iBlockItem[], words: iWordItem[], styles: iStyleItem[]): Map<string, iTextBlock[]> => {
    const wordsByBlock = group(words, (item) => item.blockRowId);
    const styleById = new Map(styles.map((item) => [item.id, item.style]));
    const blocksByParent = new Map<string, iTextBlock[]>();

    for (const [parentId, parentBlocks] of group(blocks, (item) => item.noteId ?? item.snapshotId)) {
        blocksByParent.set(
            parentId,
            parentBlocks.sort(byPosition).map((item) => {
                const itemWords = (wordsByBlock.get(item.id) ?? []).sort(byPosition).map((entry) => entry.word);
                const wordsOfBlock = itemWords.length > 0 ? itemWords : [createWord('')];
                const style = styleById.get(styleIdOf(item.id)) ?? {};
                const original = item.block;
                // Keep the local object if nothing changed, so React and the hash cache see no new value
                return sameItems(original.words, wordsOfBlock) && original.style === style
                    ? original
                    : { id: original.id, words: wordsOfBlock, style };
            }),
        );
    }
    return blocksByParent;
};

const assemble = (
    result: Pick<iSyncItems, 'notes' | 'blocks' | 'words' | 'styles' | 'snapshots' | 'presets' | 'history'>,
    localHistory: iHistoryEntry[],
    localPresets: iBlockStyle[],
): iAssembled => {
    const blocksByParent = assembleBlocks(result.blocks, result.words, result.styles);
    const emptyBlocks = () => [createBlock([createWord('')])];

    const notes = result.notes.map((note) => {
        const blocks = blocksByParent.get(note.id) ?? emptyBlocks();
        return sameItems(note.blocks, blocks) ? note : { ...note, blocks };
    });

    // Snapshots never change, a local entry is already complete
    const local = new Set(localHistory);
    const snapshotById = new Map(result.snapshots.map((item) => [item.id, item.note]));
    const history = result.history.map((entry) => {
        if (local.has(entry)) {
            return entry;
        }
        const snapshotId = snapshotIdOf(historyKeyOf(entry));
        const snapshot = snapshotById.get(snapshotId) ?? entry.note;
        return {
            ...entry,
            note: { ...snapshot, id: entry.noteId, blocks: blocksByParent.get(snapshotId) ?? emptyBlocks() },
        };
    });

    const styleById = new Map(result.styles.map((item) => [item.id, item.style]));
    const presets = [...result.presets].sort(byPosition).map((item) => styleById.get(styleIdOf(item.id)) ?? {});

    return { notes, history, presets: sameItems(localPresets, presets) ? localPresets : presets };
};

export type { iAssembled, iSyncItems };
export { assemble, deriveItems, sameItems };
