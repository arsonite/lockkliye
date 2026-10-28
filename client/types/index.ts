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

/**
 * Shared types, constants and helpers of the client.
 *
 * Data model overview:
 * - A note (iNote) holds an ordered list of text blocks (iTextBlock).
 * - A block holds an ordered list of words (iWord) and a style (iBlockStyle).
 * - A word holds its text and its formatting (iWordFormat).
 * - Notes can be organized in folders (iFolder), which can be nested.
 *
 * Naming convention: `i` prefix for interfaces, `t` prefix for type aliases.
 */

/**
 * Formatting modes that can be activated via shortcuts or the toolbar.
 * `null` means no mode is active.
 */
type tFormatMode =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'color'
    | 'highlight'
    | 'huge'
    | 'larger'
    | 'large'
    | 'normal'
    | 'smaller'
    | 'tiny'
    | 'link'
    | 'anchor'
    | null;

// Word-level formatting attributes
interface iWordFormat {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;
    highlight?: string;
    fontSize?: 'tiny' | 'smaller' | 'normal' | 'large' | 'larger' | 'huge';
    link?: string; // URL for hyperlinks
    anchor?: string; // Id of the anchor note that Ctrl+click opens
}

// Each word is its own component with formatting
interface iWord {
    id: string;
    text: string;
    format: iWordFormat;
}

// Block styles for text containers
interface iBlockStyle {
    title?: string; // Optional title displayed as legend on block
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
    borderColor?: string;
    borderRadius?: number;
    backgroundColor?: string;
    backgroundGradient?: string;
    customColor?: string; // Per-block custom color (last in row)
    customGradient?: string; // Per-block custom gradient (last in row)
    transparent?: boolean;
    widthPercent?: number; // User-adjustable width as percentage (0-100)
}

// Text block containing words
interface iTextBlock {
    id: string;
    words: iWord[];
    style: iBlockStyle;
}

// Note document
interface iNote {
    id: string;
    title: string;
    blocks: iTextBlock[];
    folderId: string | null;
    createdAt: number;
    updatedAt: number;
    pinned?: boolean;
    isAnchor?: boolean; // Words of other notes can be anchored to this note
}

// Folder for organizing notes
interface iFolder {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    parentId?: string | null; // The folder this one sits in, none for a top-level folder
}

// History entry for undo/redo functionality
interface iHistoryEntry {
    noteId: string;
    note: iNote;
    timestamp: number;
    description: string;
}

// The colors of the toolbar ('text'), the backgrounds of a block ('block') and the gradients of a block
type tPaletteKind = 'text' | 'block' | 'gradient';

// What is offered of one kind: the values that are switched on (in this order, 8 at most) and the ones made by the user
interface iPaletteSlot {
    enabled: string[];
    custom: string[];
}

type iPalette = Record<tPaletteKind, iPaletteSlot>;

// App settings
interface iAppSettings {
    lightMode: boolean;
    sidebarExpanded: boolean;
}

// App state
interface iNotesState {
    notes: iNote[];
    folders: iFolder[];
    activeNoteId: string | null;
    activeFolderId: string | null;
    sidebarExpanded: boolean;
    formatMode: tFormatMode;
    selectedColor: string;
    selectedSize: string;
    selectedAnchorId?: string | null; // The anchor note that anchor mode applies to
    lightMode: boolean;
    editorWidth: number; // percentage 50-100
    confirmDeletions: boolean; // Show confirmation dialogs for deletions
    showBlockBorders: boolean; // Outline the block under the mouse
    blockPresets: iBlockStyle[]; // Saved block presets
    palette: iPalette; // Which colors and gradients the toolbar and the block style menu offer
}

// The text colors that are on by default, the full list is in util/palette.ts
// 'inherit' is a special value that uses the default text color (white in dark mode, black in light mode)
const FORMAT_COLORS = [
    'inherit', // default text color (adapts to theme)
    '#ff6b6b', // red
    '#ffa94d', // orange
    '#ffd43b', // yellow
    '#69db7c', // green
    '#74c0fc', // blue
    '#b197fc', // purple
    '#adb5bd', // gray
];

// Hyperlinks are switched off for now: no toolbar button, no shortcut, no click handling. Stored links are kept.
const HYPERLINKS_ENABLED = false;

// Keyboard shortcuts mapping
const SHORTCUTS: Record<string, tFormatMode> = {
    'ctrl+b': 'bold',
    'ctrl+i': 'italic',
    'ctrl+u': 'underline',
    'ctrl+shift+s': 'strikethrough',
    'ctrl+shift+c': 'color',
    'ctrl+shift+h': 'highlight',
    ...(HYPERLINKS_ENABLED ? { 'ctrl+k': 'link' as const } : {}),
    'ctrl+shift+a': 'anchor',
    'ctrl+alt+1': 'huge',
    'ctrl+alt+2': 'larger',
    'ctrl+alt+3': 'large',
    'ctrl+alt+4': 'normal',
    'ctrl+alt+5': 'smaller',
    'ctrl+alt+6': 'tiny',
    'ctrl+]': 'larger',
    'ctrl+[': 'smaller',
};

/**
 * Creates a new word with a fresh unique id.
 * @param text - The text of the word
 * @param format - Optional formatting, defaults to none
 */
const createWord = (text: string, format: iWordFormat = {}): iWord => ({
    id: crypto.randomUUID(),
    text,
    format,
});

/**
 * Creates a new text block with a fresh unique id.
 * @param words - The words of the block, defaults to empty
 * @param style - Optional block style, defaults to none
 */
const createBlock = (words: iWord[] = [], style: iBlockStyle = {}): iTextBlock => ({
    id: crypto.randomUUID(),
    words,
    style,
});

/**
 * Creates a new note containing a single block with one empty word.
 * Both timestamps are set to the current time (ms).
 * @param title - The note title, defaults to 'Untitled'
 * @param folderId - The folder of the note, null for none
 */
const createNote = (title: string = 'Untitled', folderId: string | null = null): iNote => ({
    id: crypto.randomUUID(),
    title,
    blocks: [createBlock([createWord('')])],
    folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

/**
 * Creates a new folder with a fresh unique id.
 * @param name - The folder name
 * @param parentId - The parent folder, null for a top-level folder
 */
const createFolder = (name: string, parentId: string | null = null): iFolder => ({
    id: crypto.randomUUID(),
    name,
    parentId,
});

// Serialize note for storage/reconstruction
const serializeNote = (note: iNote): string => JSON.stringify(note);

// Deserialize note from storage
const deserializeNote = (data: string): iNote => JSON.parse(data);

/**
 * Exports notes as plain text (formatting is dropped).
 * Each note starts with `# title`, blocks are separated by a blank line,
 * words by a space, block titles are written as `[title]`,
 * and notes are separated by `---`.
 */
const exportNotesAsText = (notes: iNote[]): string => {
    return notes.map(note => {
        const title = `# ${note.title}\n`;
        const content = note.blocks.map(block => {
            const blockTitle = block.style.title ? `[${block.style.title}]\n` : '';
            return blockTitle + block.words.map(w => w.text).join(' ');
        }).join('\n\n');
        return title + content;
    }).join('\n\n---\n\n');
};

// Export data types for separate JSON exports
interface iNotesExportData {
    version: number;
    type: 'notes';
    exportedAt: number;
    notes: iNote[];
    folders: iFolder[];
}

interface iSettingsExportData {
    version: number;
    type: 'settings';
    exportedAt: number;
    settings: {
        lightMode: boolean;
        sidebarExpanded: boolean;
        editorWidth: number;
        confirmDeletions: boolean;
        showBlockBorders?: boolean;
        palette?: iPalette;
    };
    blockPresets: iBlockStyle[];
}

// Export notes as JSON (notes and folders only)
const exportNotesAsJson = (notes: iNote[], folders: iFolder[]): string => {
    const exportData: iNotesExportData = {
        version: 1,
        type: 'notes',
        exportedAt: Date.now(),
        notes,
        folders,
    };
    return JSON.stringify(exportData, null, 2);
};

// Export settings as JSON (settings and presets)
const exportSettingsAsJson = (
    settings: {
        lightMode: boolean;
        sidebarExpanded: boolean;
        editorWidth: number;
        confirmDeletions: boolean;
        showBlockBorders?: boolean;
        palette?: iPalette;
    },
    blockPresets: iBlockStyle[]
): string => {
    const exportData: iSettingsExportData = {
        version: 1,
        type: 'settings',
        exportedAt: Date.now(),
        settings,
        blockPresets,
    };
    return JSON.stringify(exportData, null, 2);
};

/**
 * Parses an exported JSON string.
 * Handles the 'notes' and 'settings' exports and the legacy combined format
 * (no `type` field, but a `notes` array, with presets inside `settings`).
 * The `type` of the result tells the caller how to merge the data.
 * @returns The parsed data, or null if the input is invalid or unrecognized
 */
const importFromJson = (jsonString: string): {
    type: 'notes' | 'settings' | 'legacy';
    notes?: iNote[];
    folders?: iFolder[];
    settings?: {
        lightMode?: boolean;
        sidebarExpanded?: boolean;
        editorWidth?: number;
        confirmDeletions?: boolean;
        showBlockBorders?: boolean;
        palette?: iPalette;
    };
    blockPresets?: iBlockStyle[];
} | null => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.version) return null;

        // New format with type field
        if (data.type === 'notes') {
            return {
                type: 'notes',
                notes: data.notes || [],
                folders: data.folders || [],
            };
        }

        if (data.type === 'settings') {
            return {
                type: 'settings',
                settings: data.settings,
                blockPresets: data.blockPresets || [],
            };
        }

        // Legacy format (v1/v2 without type field) - treat as combined
        if (data.notes) {
            return {
                type: 'legacy',
                notes: data.notes,
                folders: data.folders || [],
                settings: data.settings,
                blockPresets: data.settings?.blockPresets,
            };
        }

        return null;
    } catch {
        return null;
    }
};

export type {
    iAppSettings,
    iBlockStyle,
    iFolder,
    tFormatMode,
    iHistoryEntry,
    iNote,
    iNotesState,
    iPalette,
    iPaletteSlot,
    iTextBlock,
    tPaletteKind,
    iWord,
    iWordFormat,
};

export {
    FORMAT_COLORS,
    HYPERLINKS_ENABLED,
    SHORTCUTS,

    createBlock,
    createFolder,
    createNote,
    createWord,
    deserializeNote,
    exportNotesAsJson,
    exportNotesAsText,
    exportSettingsAsJson,
    importFromJson,
    serializeNote,
};