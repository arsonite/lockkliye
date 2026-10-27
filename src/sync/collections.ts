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
import {
    BlockAPI,
    BlockPresetAPI,
    BlockStyleAPI,
    FolderAPI,
    NoteAPI,
    NoteHistoryAPI,
    NoteSnapshotAPI,
    SettingsAPI,
    WordAPI,
} from '@/sync/api';

// Types
import type { iBlockStyle, iFolder, iHistoryEntry, iNote, iTextBlock, iWord, iWordFormat } from '@/types';

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

// The text of a note is a tree of server entries: Note <- Block <- Word, and Block -> BlockStyle.
// Items carry the ids of their parents, the tree is put back together from them (see tree.ts).
interface iBlockItem {
    id: string;
    noteId: string | null; // A block belongs to a note ...
    snapshotId: string | null; // ... or to a snapshot of the undo history
    position: number;
    block: iTextBlock;
}

interface iWordItem {
    id: string;
    blockRowId: string;
    position: number;
    word: iWord;
}

interface iStyleItem {
    id: string;
    style: iBlockStyle;
}

interface iPresetItem {
    id: string;
    position: number;
}

interface iSnapshotItem {
    id: string;
    note: iNote; // Without its blocks
}

// The app settings are one row, 'main'
interface iSettingsItem {
    lightMode: boolean;
    sidebarExpanded: boolean;
    editorWidth: number;
    confirmDeletions: boolean;
}

const SETTINGS_ID = 'main';

// Entry ids are global on the server, so every kind of entry derives its id from its owner
const historyKeyOf = (entry: iHistoryEntry): string => `${entry.noteId}_${entry.timestamp}`;
const snapshotIdOf = (historyKey: string): string => `${historyKey}__snapshot`;
const styleIdOf = (ownerId: string): string => `${ownerId}__style`;
const snapshotChildIdOf = (historyKey: string, kind: 'block' | 'word', id: string): string =>
    `${historyKey}__${kind}__${id}`;
// Live entries use the browser's ids as they are, snapshot entries are prefixed
const originalIdOf = (id: string): string => (id.includes('__') ? id.slice(id.lastIndexOf('__') + 2) : id);

const text = (value: unknown): string => (value as string | undefined) ?? '';

const styleRow = (style: iBlockStyle): tRow => ({
    background_color: style.backgroundColor ?? '',
    background_gradient: style.backgroundGradient ?? '',
    border_color: style.borderColor ?? '',
    border_radius: Math.round(style.borderRadius ?? -1),
    border_style: style.borderStyle ?? '',
    custom_color: style.customColor ?? '',
    custom_gradient: style.customGradient ?? '',
    title: style.title ?? '',
    transparent: style.transparent ?? false,
    width_percent: Math.round(style.widthPercent ?? -1),
});

const styleFromRow = (row: tServerRow): iBlockStyle => {
    const style: iBlockStyle = {};
    if (row.background_color) style.backgroundColor = text(row.background_color);
    if (row.background_gradient) style.backgroundGradient = text(row.background_gradient);
    if (row.border_color) style.borderColor = text(row.border_color);
    if ((row.border_radius as number) >= 0) style.borderRadius = row.border_radius as number;
    if (row.border_style) style.borderStyle = text(row.border_style) as iBlockStyle['borderStyle'];
    if (row.custom_color) style.customColor = text(row.custom_color);
    if (row.custom_gradient) style.customGradient = text(row.custom_gradient);
    if (row.title) style.title = text(row.title);
    if (row.transparent) style.transparent = true;
    if ((row.width_percent as number) >= 0) style.widthPercent = row.width_percent as number;
    return style;
};

const wordRow = (word: iWord): tRow => ({
    bold: word.format.bold ?? false,
    color: word.format.color ?? '',
    font_size: word.format.fontSize ?? '',
    highlight: word.format.highlight ?? '',
    italic: word.format.italic ?? false,
    link: word.format.link ?? '',
    strikethrough: word.format.strikethrough ?? false,
    text: word.text,
    underline: word.format.underline ?? false,
});

const wordFromRow = (row: tServerRow): iWord => {
    const format: iWordFormat = {};
    if (row.bold) format.bold = true;
    if (row.color) format.color = text(row.color);
    if (row.font_size) format.fontSize = text(row.font_size) as iWordFormat['fontSize'];
    if (row.highlight) format.highlight = text(row.highlight);
    if (row.italic) format.italic = true;
    if (row.link) format.link = text(row.link);
    if (row.strikethrough) format.strikethrough = true;
    if (row.underline) format.underline = true;
    return { id: originalIdOf(row.id), text: text(row.text), format };
};

const folderCollection: iCollection<iFolder> = {
    name: 'folders',
    api: FolderAPI,
    key: (folder) => folder.id,
    toRow: (folder) => ({
        color: folder.color ?? '',
        expanded: folder.expanded ?? true,
        icon: folder.icon ?? '',
        name: folder.name,
    }),
    fromRow: (row) => ({
        id: row.id,
        name: text(row.name),
        icon: text(row.icon) || undefined,
        color: text(row.color) || undefined,
        expanded: row.expanded as boolean,
    }),
};

// Without its blocks
const noteCollection: iCollection<iNote> = {
    name: 'notes',
    api: NoteAPI,
    key: (note) => note.id,
    toRow: (note) => ({
        created_ms: note.createdAt,
        pinned: note.pinned ?? false,
        title: note.title,
        updated_ms: note.updatedAt,
        ...(note.folderId ? { folder: note.folderId } : {}),
    }),
    fromRow: (row) => ({
        id: row.id,
        title: text(row.title),
        blocks: [],
        folderId: (row.folder as string | undefined) ?? null,
        pinned: row.pinned as boolean,
        createdAt: row.created_ms as number,
        updatedAt: row.updated_ms as number,
    }),
};

const snapshotCollection: iCollection<iSnapshotItem> = {
    name: 'snapshots',
    api: NoteSnapshotAPI,
    key: (item) => item.id,
    toRow: ({ note }) => ({
        created_ms: note.createdAt,
        folder_id: note.folderId ?? '',
        pinned: note.pinned ?? false,
        title: note.title,
        updated_ms: note.updatedAt,
    }),
    fromRow: (row) => ({
        id: row.id,
        note: {
            id: '', // Set from the history entry
            title: text(row.title),
            blocks: [],
            folderId: text(row.folder_id) || null,
            pinned: row.pinned as boolean,
            createdAt: row.created_ms as number,
            updatedAt: row.updated_ms as number,
        },
    }),
};

const settingsCollection: iCollection<iSettingsItem> = {
    name: 'settings',
    api: SettingsAPI,
    key: () => SETTINGS_ID,
    toRow: (settings) => ({
        confirm_deletions: settings.confirmDeletions,
        editor_width: settings.editorWidth,
        light_mode: settings.lightMode,
        sidebar_expanded: settings.sidebarExpanded,
    }),
    fromRow: (row) => ({
        lightMode: row.light_mode as boolean,
        sidebarExpanded: row.sidebar_expanded as boolean,
        editorWidth: row.editor_width as number,
        confirmDeletions: row.confirm_deletions as boolean,
    }),
};

const styleCollection: iCollection<iStyleItem> = {
    name: 'styles',
    api: BlockStyleAPI,
    key: (item) => item.id,
    toRow: (item) => styleRow(item.style),
    fromRow: (row) => ({ id: row.id, style: styleFromRow(row) }),
};

const blockCollection: iCollection<iBlockItem> = {
    name: 'blocks',
    api: BlockAPI,
    key: (item) => item.id,
    toRow: (item) => ({
        position: item.position,
        style: styleIdOf(item.id),
        ...(item.noteId ? { note: item.noteId } : {}),
        ...(item.snapshotId ? { snapshot: item.snapshotId } : {}),
    }),
    fromRow: (row) => ({
        id: row.id,
        noteId: (row.note as string | undefined) ?? null,
        snapshotId: (row.snapshot as string | undefined) ?? null,
        position: row.position as number,
        block: { id: originalIdOf(row.id), words: [], style: {} },
    }),
};

const wordCollection: iCollection<iWordItem> = {
    name: 'words',
    api: WordAPI,
    key: (item) => item.id,
    toRow: (item) => ({ position: item.position, ...wordRow(item.word), block: item.blockRowId }),
    fromRow: (row) => ({
        id: row.id,
        blockRowId: text(row.block),
        position: row.position as number,
        word: wordFromRow(row),
    }),
};

const presetCollection: iCollection<iPresetItem> = {
    name: 'presets',
    api: BlockPresetAPI,
    key: (item) => item.id,
    toRow: (item) => ({ position: item.position, settings: SETTINGS_ID, style: styleIdOf(item.id) }),
    fromRow: (row) => ({ id: row.id, position: row.position as number }),
};

// The note of the entry is put in from its snapshot (see tree.ts)
const historyCollection: iCollection<iHistoryEntry> = {
    name: 'history',
    api: NoteHistoryAPI,
    key: historyKeyOf,
    toRow: (entry) => ({
        description: entry.description,
        note: entry.noteId,
        snapshot: snapshotIdOf(historyKeyOf(entry)),
        timestamp: entry.timestamp,
    }),
    fromRow: (row) => ({
        noteId: text(row.note),
        note: { id: text(row.note), title: '', blocks: [], folderId: null, createdAt: 0, updatedAt: 0 },
        timestamp: row.timestamp as number,
        description: text(row.description),
    }),
};

export type {
    iBlockItem,
    iCollection,
    iPresetItem,
    iSettingsItem,
    iSnapshotItem,
    iStyleItem,
    iWordItem,
    tRow,
    tServerRow,
};
export {
    blockCollection,
    folderCollection,
    historyCollection,
    historyKeyOf,
    noteCollection,
    originalIdOf,
    presetCollection,
    SETTINGS_ID,
    settingsCollection,
    snapshotChildIdOf,
    snapshotCollection,
    snapshotIdOf,
    styleCollection,
    styleIdOf,
    wordCollection,
};
