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
    FolderAPI,
    NoteAPI,
    NoteHistoryAPI,
    SettingsAPI,
    WordAPI,
} from '@/sync/api';

// Types
import type { iBlockStyle, iFolder, iHistoryEntry, iNote, iTextBlock, iWord, iWordFormat } from '@/types';

type tRow = Record<string, string | number | boolean>;
type tServerRow = HSDBEntity & { rev: number } & Record<string, unknown>;

// Maps one local entity type to one HSDB model. The key identifies the entity in the browser only: the server
// hands out its own entry ids, the sync keeps track of which key belongs to which id (see engine.ts).
// toRow() must produce the same key order every time: its JSON decides whether an entity changed since the last
// sync, so it contains neither the id nor the rev. Relation fields hold the key of the related entity, the sync
// swaps keys and server ids at the boundary.
interface iCollection<L extends object> {
    name: string;
    api: typeof HSDBBaseAPI;
    key: (item: L) => string;
    toRow: (item: L) => tRow;
    fromRow: (row: tServerRow, key: string) => L;
    relations?: Record<string, string>; // Relation field -> name of the collection it points to
    // For models where the content decides which row is which (the single settings row, presets by position):
    // a server row without a known key is matched to the local entity with this key. Needs the fields it reads.
    slot?: (row: tServerRow) => string;
    listFields?: string[];
}

// The text of a note is a tree of server entries: Note <- Block <- Word
interface iBlockItem {
    id: string;
    noteId: string;
    position: number;
    block: iTextBlock;
}

interface iWordItem {
    id: string;
    blockId: string;
    position: number;
    word: iWord;
}

interface iPresetItem {
    id: string;
    position: number;
    style: iBlockStyle;
}

// The app settings are one row
interface iSettingsItem {
    lightMode: boolean;
    sidebarExpanded: boolean;
    editorWidth: number;
    confirmDeletions: boolean;
}

const SETTINGS_KEY = 'settings';

// A history entry has no identity of its own, the note and the time of the change are enough
const historyKeyOf = (entry: iHistoryEntry): string => `${entry.noteId}_${entry.timestamp}`;
const presetKeyOf = (position: number): string => `preset_${position}`;

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
    ...(word.format.anchor ? { anchor: word.format.anchor } : {}),
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

const wordFromRow = (row: tServerRow, key: string): iWord => {
    const format: iWordFormat = {};
    if (row.anchor) format.anchor = text(row.anchor);
    if (row.bold) format.bold = true;
    if (row.color) format.color = text(row.color);
    if (row.font_size) format.fontSize = text(row.font_size) as iWordFormat['fontSize'];
    if (row.highlight) format.highlight = text(row.highlight);
    if (row.italic) format.italic = true;
    if (row.link) format.link = text(row.link);
    if (row.strikethrough) format.strikethrough = true;
    if (row.underline) format.underline = true;
    return { id: key, text: text(row.text), format };
};

const folderCollection: iCollection<iFolder> = {
    name: 'folders',
    api: FolderAPI,
    key: (folder) => folder.id,
    toRow: (folder) => ({
        color: folder.color ?? '',
        icon: folder.icon ?? '',
        name: folder.name,
        ...(folder.parentId ? { parent: folder.parentId } : {}),
    }),
    fromRow: (row, key) => ({
        id: key,
        name: text(row.name),
        icon: text(row.icon) || undefined,
        color: text(row.color) || undefined,
        parentId: (row.parent as string | undefined) ?? null,
    }),
    relations: { parent: 'folders' },
};

// Without its blocks
const noteCollection: iCollection<iNote> = {
    name: 'notes',
    api: NoteAPI,
    key: (note) => note.id,
    toRow: (note) => ({
        created_ms: note.createdAt,
        is_anchor: note.isAnchor ?? false,
        pinned: note.pinned ?? false,
        title: note.title,
        updated_ms: note.updatedAt,
        ...(note.folderId ? { folder: note.folderId } : {}),
    }),
    fromRow: (row, key) => ({
        id: key,
        title: text(row.title),
        blocks: [],
        folderId: (row.folder as string | undefined) ?? null,
        isAnchor: row.is_anchor === true,
        pinned: row.pinned as boolean,
        createdAt: row.created_ms as number,
        updatedAt: row.updated_ms as number,
    }),
    relations: { folder: 'folders' },
};

const settingsCollection: iCollection<iSettingsItem> = {
    name: 'settings',
    api: SettingsAPI,
    key: () => SETTINGS_KEY,
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
    slot: () => SETTINGS_KEY,
};

const blockCollection: iCollection<iBlockItem> = {
    name: 'blocks',
    api: BlockAPI,
    key: (item) => item.id,
    toRow: (item) => ({ position: item.position, note: item.noteId, ...styleRow(item.block.style) }),
    fromRow: (row, key) => ({
        id: key,
        noteId: text(row.note),
        position: row.position as number,
        block: { id: key, words: [], style: styleFromRow(row) },
    }),
    relations: { note: 'notes' },
};

const wordCollection: iCollection<iWordItem> = {
    name: 'words',
    api: WordAPI,
    key: (item) => item.id,
    toRow: (item) => ({ position: item.position, block: item.blockId, ...wordRow(item.word) }),
    fromRow: (row, key) => ({
        id: key,
        blockId: text(row.block),
        position: row.position as number,
        word: wordFromRow(row, key),
    }),
    relations: { block: 'blocks', anchor: 'notes' },
};

const presetCollection: iCollection<iPresetItem> = {
    name: 'presets',
    api: BlockPresetAPI,
    key: (item) => item.id,
    toRow: (item) => ({ position: item.position, settings: SETTINGS_KEY, ...styleRow(item.style) }),
    fromRow: (row, key) => ({ id: key, position: row.position as number, style: styleFromRow(row) }),
    relations: { settings: 'settings' },
    slot: (row) => presetKeyOf(row.position as number),
    listFields: ['position'],
};

// What the note looked like before the change. Folder and id are left out, they are the note's current ones.
const snapshotOf = (note: iNote): string =>
    JSON.stringify({
        title: note.title,
        blocks: note.blocks,
        pinned: note.pinned,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
    });

// The folder of a pulled entry is filled in from its note (see tree.ts)
const historyCollection: iCollection<iHistoryEntry> = {
    name: 'history',
    api: NoteHistoryAPI,
    key: historyKeyOf,
    toRow: (entry) => ({
        description: entry.description,
        note: entry.noteId,
        snapshot: snapshotOf(entry.note),
        timestamp: entry.timestamp,
    }),
    fromRow: (row) => {
        const noteId = text(row.note);
        return {
            noteId,
            note: { ...JSON.parse(text(row.snapshot)), id: noteId, folderId: null },
            timestamp: row.timestamp as number,
            description: text(row.description),
        };
    },
    relations: { note: 'notes' },
};

export type { iBlockItem, iCollection, iPresetItem, iSettingsItem, iWordItem, tRow, tServerRow };
export {
    blockCollection,
    folderCollection,
    historyCollection,
    historyKeyOf,
    noteCollection,
    presetCollection,
    presetKeyOf,
    settingsCollection,
    wordCollection,
};
