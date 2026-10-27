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

// Formatting modes that can be activated via shortcuts
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
}

// Folder for organizing notes
interface iFolder {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    expanded?: boolean;
}

// History entry for undo/redo functionality
interface iHistoryEntry {
    noteId: string;
    note: iNote;
    timestamp: number;
    description: string;
}

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
    lightMode: boolean;
    editorWidth: number; // percentage 50-100
    confirmDeletions: boolean; // Show confirmation dialogs for deletions
    blockPresets: iBlockStyle[]; // Saved block presets
}

// Predefined colors for formatting
// 'inherit' is a special value that uses the default text color (white in dark mode, black in light mode)
const FORMAT_COLORS = [
    'inherit', // default text color (adapts to theme)
    '#ff6b6b', // red
    '#ffa94d', // orange
    '#ffd43b', // yellow
    '#69db7c', // green
    '#74c0fc', // blue
    '#b197fc', // purple
    '#f783ac', // pink
];

// Predefined gradients for blocks
const BLOCK_GRADIENTS = [
    'linear-gradient(135deg, rgba(255,107,107,0.2) 0%, rgba(255,169,77,0.2) 100%)',
    'linear-gradient(135deg, rgba(116,192,252,0.2) 0%, rgba(177,151,252,0.2) 100%)',
    'linear-gradient(135deg, rgba(105,219,124,0.2) 0%, rgba(116,192,252,0.2) 100%)',
    'linear-gradient(135deg, rgba(247,131,172,0.2) 0%, rgba(177,151,252,0.2) 100%)',
    'linear-gradient(135deg, rgba(255,212,59,0.2) 0%, rgba(255,169,77,0.2) 100%)',
    // Additional gradients
    'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(150,150,150,0.1) 100%)', // Silver/Gray
    'linear-gradient(135deg, rgba(64,224,208,0.2) 0%, rgba(116,192,252,0.2) 100%)', // Turquoise to Blue
];

// Keyboard shortcuts mapping
const SHORTCUTS: Record<string, tFormatMode> = {
    'ctrl+b': 'bold',
    'ctrl+i': 'italic',
    'ctrl+u': 'underline',
    'ctrl+shift+s': 'strikethrough',
    'ctrl+shift+c': 'color',
    'ctrl+shift+h': 'highlight',
    'ctrl+k': 'link',
    'ctrl+]': 'larger',
    'ctrl+[': 'smaller',
};

// Helper to create a new word
const createWord = (text: string, format: iWordFormat = {}): iWord => ({
    id: crypto.randomUUID(),
    text,
    format,
});

// Helper to create a new block
const createBlock = (words: iWord[] = [], style: iBlockStyle = {}): iTextBlock => ({
    id: crypto.randomUUID(),
    words,
    style,
});

// Helper to create a new note
const createNote = (title: string = 'Untitled', folderId: string | null = null): iNote => ({
    id: crypto.randomUUID(),
    title,
    blocks: [createBlock([createWord('')])],
    folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

// Helper to create a new folder
const createFolder = (name: string): iFolder => ({
    id: crypto.randomUUID(),
    name,
    expanded: true,
});

// Serialize note for storage/reconstruction
const serializeNote = (note: iNote): string => JSON.stringify(note);

// Deserialize note from storage
const deserializeNote = (data: string): iNote => JSON.parse(data);

// Export notes as plain text
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

// Import from JSON - handles notes, settings, or legacy combined format
// Returns parsed data with type indicator for proper merging
const importFromJson = (jsonString: string): {
    type: 'notes' | 'settings' | 'legacy';
    notes?: iNote[];
    folders?: iFolder[];
    settings?: {
        lightMode?: boolean;
        sidebarExpanded?: boolean;
        editorWidth?: number;
        confirmDeletions?: boolean;
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
    iTextBlock,
    iWord,
    iWordFormat,
};

export {
    BLOCK_GRADIENTS,
    FORMAT_COLORS,
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