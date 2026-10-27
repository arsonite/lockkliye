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
import { FolderAPI, NoteAPI, NoteHistoryAPI, SettingsAPI } from '@/sync/api';

// Types
import type { iBlockStyle, iFolder, iHistoryEntry, iNote } from '@/types';

type tRow = Record<string, string | number | boolean>;
type tServerRow = HSDBEntity & { client_id: string; rev: number } & Record<string, unknown>;

// Maps one local entity type to one HSDB model. toRow() must produce the same key order every time,
// its JSON is what decides whether an entity changed since the last sync (server fields and rev excluded)
interface iCollection<L extends object> {
    name: string;
    api: typeof HSDBBaseAPI;
    key: (item: L) => string;
    toRow: (item: L) => tRow;
    fromRow: (row: tServerRow) => L;
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
        client_id: folder.id,
        name: folder.name,
        icon: folder.icon ?? '',
        color: folder.color ?? '',
        expanded: folder.expanded ?? true,
    }),
    fromRow: (row) => ({
        id: row.client_id,
        name: row.name as string,
        icon: (row.icon as string) || undefined,
        color: (row.color as string) || undefined,
        expanded: row.expanded as boolean,
    }),
};

const noteCollection: iCollection<iNote> = {
    name: 'notes',
    api: NoteAPI,
    key: (note) => note.id,
    toRow: (note) => ({
        client_id: note.id,
        title: note.title,
        blocks: JSON.stringify(note.blocks),
        folder_id: note.folderId ?? '',
        pinned: note.pinned ?? false,
        created_ms: note.createdAt,
        updated_ms: note.updatedAt,
    }),
    fromRow: (row) => ({
        id: row.client_id,
        title: row.title as string,
        blocks: JSON.parse(row.blocks as string),
        folderId: (row.folder_id as string) || null,
        pinned: row.pinned as boolean,
        createdAt: row.created_ms as number,
        updatedAt: row.updated_ms as number,
    }),
};

const settingsCollection: iCollection<iSettingsItem> = {
    name: 'settings',
    api: SettingsAPI,
    key: () => 'main',
    toRow: (settings) => ({
        client_id: 'main',
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
    key: (entry) => `${entry.noteId}:${entry.timestamp}`,
    toRow: (entry) => ({
        client_id: `${entry.noteId}:${entry.timestamp}`,
        note_id: entry.noteId,
        timestamp: entry.timestamp,
        description: entry.description,
        snapshot: JSON.stringify(entry.note),
    }),
    fromRow: (row) => ({
        noteId: row.note_id as string,
        note: JSON.parse(row.snapshot as string),
        timestamp: row.timestamp as number,
        description: row.description as string,
    }),
};

export type { iCollection, iSettingsItem, tRow, tServerRow };
export { folderCollection, historyCollection, noteCollection, settingsCollection };
