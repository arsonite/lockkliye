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
import type { iCollection, tRow, tServerRow } from '@teatype/sync';

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
import type {
    iAnchorStyle,
    iBlockStyle,
    iFolder,
    iHistoryEntry,
    iListOptions,
    iLockSetup,
    iNote,
    iPalette,
    iTextBlock,
    iWord,
    iWordFormat,
    tBlockKind,
} from '@/types';

// Util
import { sanitizeAccent } from '@/tools/accent';
import { sanitizeLockSetup } from '@/tools/lock';
import { sanitizeAnchorStyle } from '@/tools/anchorStyle';
import { sanitizeBlockListOptions, sanitizeListOptions } from '@/tools/lists';
import { sanitizePalette } from '@/tools/palette';

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
    editorWidth: number;
    confirmDeletions: boolean;
    showBlockBorders: boolean;
    showStyleButton: boolean;
    use24HourTime: boolean;
    accentColor: string;
    listOptions: iListOptions;
    anchorStyle: iAnchorStyle;
    lockSetup: iLockSetup | null;
    palette: iPalette;
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
    // Only sent once the user has chosen, so the blocks that never did keep their hash
    ...(style.borderGap === undefined ? {} : { border_gap: style.borderGap }),
    ...(style.textAlign ? { text_align: style.textAlign } : {}),
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
    if (typeof row.border_gap === 'number' && row.border_gap >= 0) style.borderGap = row.border_gap;
    if (row.text_align) style.textAlign = text(row.text_align) as iBlockStyle['textAlign'];
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
        ...(folder.sort ? { sort_mode: folder.sort } : {}),
    }),
    fromRow: (row, key) => ({
        id: key,
        name: text(row.name),
        icon: text(row.icon) || undefined,
        color: text(row.color) || undefined,
        parentId: (row.parent as string | undefined) ?? null,
        sort: (text(row.sort_mode) || undefined) as iFolder['sort'],
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
        pinned: !!note.pinned,
        title: note.title,
        updated_ms: note.updatedAt,
        ...(note.folderId ? { folder: note.folderId } : {}),
        // Only sent when there is something to say, so the notes that have neither keep their hash
        ...(note.pinned ? { pin_scope: note.pinned } : {}),
        ...(note.order === undefined ? {} : { sort_order: note.order }),
        // Only once the note was locked, the others keep their hash. A lock that was taken off sends false
        ...(note.locked === undefined ? {} : { locked: note.locked }),
        // The same for the template flag: a note that was never one keeps its hash
        ...(note.isTemplate === undefined ? {} : { is_template: note.isTemplate }),
    }),
    fromRow: (row, key) => ({
        id: key,
        title: text(row.title),
        blocks: [],
        folderId: (row.folder as string | undefined) ?? null,
        isAnchor: row.is_anchor === true,
        pinned: row.pinned ? (row.pin_scope === 'global' ? 'global' : 'folder') : undefined,
        order: typeof row.sort_order === 'number' ? row.sort_order : undefined,
        locked: typeof row.locked === 'boolean' ? row.locked : undefined,
        isTemplate: typeof row.is_template === 'boolean' ? row.is_template : undefined,
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
        accent_color: settings.accentColor,
        anchor_style: JSON.stringify(settings.anchorStyle),
        confirm_deletions: settings.confirmDeletions,
        editor_width: settings.editorWidth,
        light_mode: settings.lightMode,
        list_options: JSON.stringify(settings.listOptions),
        palette: JSON.stringify({
            text: settings.palette.text,
            block: settings.palette.block,
            gradient: settings.palette.gradient,
        }),
        show_block_borders: settings.showBlockBorders,
        show_style_button: settings.showStyleButton,
        use_24_hour_time: settings.use24HourTime,
        // Only once there is a password, the settings of everyone else keep their hash
        ...(settings.lockSetup ? { lock_setup: JSON.stringify(settings.lockSetup) } : {}),
    }),
    fromRow: (row) => ({
        lightMode: row.light_mode as boolean,
        editorWidth: row.editor_width as number,
        confirmDeletions: row.confirm_deletions as boolean,
        showBlockBorders: row.show_block_borders !== false,
        showStyleButton: row.show_style_button === true,
        use24HourTime: row.use_24_hour_time !== false,
        accentColor: sanitizeAccent(row.accent_color),
        listOptions: sanitizeListOptions(row.list_options ? JSON.parse(text(row.list_options)) : undefined),
        anchorStyle: sanitizeAnchorStyle(row.anchor_style ? JSON.parse(text(row.anchor_style)) : undefined),
        lockSetup: sanitizeLockSetup(row.lock_setup ? JSON.parse(text(row.lock_setup)) : undefined),
        palette: sanitizePalette(row.palette ? JSON.parse(text(row.palette)) : undefined),
    }),
    slot: () => SETTINGS_KEY,
};

const blockCollection: iCollection<iBlockItem> = {
    name: 'blocks',
    api: BlockAPI,
    key: (item) => item.id,
    toRow: (item) => ({
        position: item.position,
        note: item.noteId,
        ...styleRow(item.block.style),
        ...(item.block.style.listOptions ? { list_options: JSON.stringify(item.block.style.listOptions) } : {}),
        // Components only, text blocks have no kind or content
        ...(item.block.kind && item.block.kind !== 'text'
            ? { kind: item.block.kind, ...(item.block.data ? { content: JSON.stringify(item.block.data) } : {}) }
            : {}),
    }),
    fromRow: (row, key) => ({
        id: key,
        noteId: text(row.note),
        position: row.position as number,
        block: {
            id: key,
            words: [],
            style: {
                ...styleFromRow(row),
                ...(row.list_options ? { listOptions: sanitizeBlockListOptions(JSON.parse(text(row.list_options))) } : {}),
            },
            ...(row.kind && row.kind !== 'text'
                ? {
                      kind: text(row.kind) as tBlockKind,
                      ...(row.content ? { data: JSON.parse(text(row.content)) } : {}),
                  }
                : {}),
        },
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
        workspace: note.workspace,
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

export type { iBlockItem, iPresetItem, iSettingsItem, iWordItem };
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
