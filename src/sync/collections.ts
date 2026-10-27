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

// TeaType API
import type { HSDBBaseAPI, HSDBEntity } from '@teatype/api';

// Sync
import { BlockAPI, FolderAPI, NoteAPI, NoteHistoryAPI, SettingsAPI } from '@/sync/api';

// Types
import { createBlock, createWord } from '@/types';
import type { iBlockStyle, iFolder, iHistoryEntry, iNote, iTextBlock } from '@/types';

type tRow = Record<string, string | number | boolean>;
type tServerRow = HSDBEntity & { rev: number } & Record<string, unknown>;

// Maps one local entity type to one HSDB model. The key is also the entry id on the server.
// toRow() must produce the same key order every time: its JSON decides whether an entity changed
// since the last sync, so it contains neither the id nor the rev. Relation fields hold the id of the related entry.
interface iCollection<L extends object> {
    name: string;
    api: typeof HSDBBaseAPI;
    key: (item: L) => string;
    toRow: (item: L) => tRow;
    fromRow: (row: tServerRow) => L;
}

// A block together with the note it belongs to, blocks are their own model pointing to the note
interface iBlockItem {
    noteId: string;
    position: number;
    block: iTextBlock;
}

// The app settings are one row, 'main'
interface iSettingsItem {
    lightMode: boolean;
    sidebarExpanded: boolean;
    editorWidth: number;
    confirmDeletions: boolean;
    blockPresets: iBlockStyle[];
}

const folderCollection: iCollection<iFolder> = {
    name: 'folders',
    api: FolderAPI,
    key: (folder) => folder.id,
    toRow: (folder) => ({
        name: folder.name,
        icon: folder.icon ?? '',
        color: folder.color ?? '',
        expanded: folder.expanded ?? true,
    }),
    fromRow: (row) => ({
        id: row.id,
        name: row.name as string,
        icon: (row.icon as string) || undefined,
        color: (row.color as string) || undefined,
        expanded: row.expanded as boolean,
    }),
};

// Without its blocks, those are synced through blockCollection
const noteCollection: iCollection<iNote> = {
    name: 'notes',
    api: NoteAPI,
    key: (note) => note.id,
    toRow: (note) => ({
        title: note.title,
        pinned: note.pinned ?? false,
        created_ms: note.createdAt,
        updated_ms: note.updatedAt,
        ...(note.folderId ? { folder: note.folderId } : {}),
    }),
    fromRow: (row) => ({
        id: row.id,
        title: row.title as string,
        blocks: [],
        folderId: (row.folder as string | undefined) ?? null,
        pinned: row.pinned as boolean,
        createdAt: row.created_ms as number,
        updatedAt: row.updated_ms as number,
    }),
};

const blockCollection: iCollection<iBlockItem> = {
    name: 'blocks',
    api: BlockAPI,
    key: (item) => item.block.id,
    toRow: (item) => ({
        position: item.position,
        words: JSON.stringify(item.block.words),
        style: JSON.stringify(item.block.style),
        note: item.noteId,
    }),
    fromRow: (row) => ({
        noteId: row.note as string,
        position: row.position as number,
        block: {
            id: row.id,
            words: JSON.parse(row.words as string),
            style: JSON.parse(row.style as string),
        },
    }),
};

const settingsCollection: iCollection<iSettingsItem> = {
    name: 'settings',
    api: SettingsAPI,
    key: () => 'main',
    toRow: (settings) => ({
        light_mode: settings.lightMode,
        sidebar_expanded: settings.sidebarExpanded,
        editor_width: settings.editorWidth,
        confirm_deletions: settings.confirmDeletions,
        block_presets: JSON.stringify(settings.blockPresets),
    }),
    fromRow: (row) => ({
        lightMode: row.light_mode as boolean,
        sidebarExpanded: row.sidebar_expanded as boolean,
        editorWidth: row.editor_width as number,
        confirmDeletions: row.confirm_deletions as boolean,
        blockPresets: JSON.parse(row.block_presets as string),
    }),
};

const historyCollection: iCollection<iHistoryEntry> = {
    name: 'history',
    api: NoteHistoryAPI,
    key: (entry) => `${entry.noteId}_${entry.timestamp}`,
    toRow: (entry) => ({
        timestamp: entry.timestamp,
        description: entry.description,
        snapshot: JSON.stringify(entry.note),
        note: entry.noteId,
    }),
    fromRow: (row) => ({
        noteId: row.note as string,
        note: JSON.parse(row.snapshot as string),
        timestamp: row.timestamp as number,
        description: row.description as string,
    }),
};

// Block items are cached per block so that unchanged blocks keep their identity, which keeps their hash cached
const blockItemCache = new WeakMap<iTextBlock, iBlockItem>();

const blockItemsOf = (notes: iNote[]): iBlockItem[] =>
    notes.flatMap((note) =>
        note.blocks.map((block, position) => {
            const cached = blockItemCache.get(block);
            if (cached && cached.noteId === note.id && cached.position === position) {
                return cached;
            }
            const item = { noteId: note.id, position, block };
            blockItemCache.set(block, item);
            return item;
        }),
    );

// Notes from the note collection carry no blocks, put them (back) together from the block items
const assembleNotes = (notes: iNote[], blocks: iBlockItem[]): iNote[] => {
    const byNote = new Map<string, iBlockItem[]>();
    for (const item of blocks) {
        byNote.set(item.noteId, [...(byNote.get(item.noteId) ?? []), item]);
    }
    return notes.map((note) => {
        const items = (byNote.get(note.id) ?? []).sort((a, b) => a.position - b.position);
        return { ...note, blocks: items.length > 0 ? items.map((item) => item.block) : [createBlock([createWord('')])] };
    });
};

export type { iBlockItem, iCollection, iSettingsItem, tRow, tServerRow };
export {
    assembleNotes,
    blockCollection,
    blockItemsOf,
    folderCollection,
    historyCollection,
    noteCollection,
    settingsCollection,
};
