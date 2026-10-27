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
import { useState, useCallback, useEffect, useRef } from 'react';

// Types
import { iNote, iFolder, tFormatMode, iNotesState, iWord, iTextBlock, iBlockStyle, iHistoryEntry } from '@/types';

// Util
import { createNote, createFolder, createBlock, createWord, FORMAT_COLORS, exportNotesAsText, exportNotesAsJson, exportSettingsAsJson, importFromJson as parseImportJson } from '@/types';
import { descendantIds, repairFolders } from '@/util/folderTree';
import { generateRandomNote } from '@/util/randomGenerator';
import useSync from '@/sync/useSync';

const STORAGE_KEY = 'lockkliye-data';
const HISTORY_KEY = 'lockkliye-history';
const REDO_KEY = 'lockkliye-redo';
const MAX_HISTORY_SIZE = 100;
// Edits of one kind within this time are one undo step: a typed sentence is not one step per keystroke
const COALESCE_MS = 1500;
const COALESCED = ['Edit text', 'Update block style', 'Update note'];

const getInitialState = (): iNotesState => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Ensure lightMode, selectedSize, and editorWidth exist
            return {
                ...parsed,
                lightMode: parsed.lightMode ?? false,
                selectedSize: parsed.selectedSize ?? 'normal',
                selectedAnchorId: parsed.selectedAnchorId ?? null,
                editorWidth: parsed.editorWidth ?? 70,
            };
        } catch {
            // Fall through to default state
        }
    }

    // Create default state with sample data
    const sampleNote = createNote('Welcome to Lockkliye');
    sampleNote.blocks = [
        // Title block
        createBlock([
            createWord('Welcome', { bold: true, fontSize: 'huge', color: '#74c0fc' }),
            createWord('to'),
            createWord('Lockkliye', { bold: true, fontSize: 'huge', color: '#ff9500' }),
        ]),
        // Introduction
        createBlock([
            createWord('A', { fontSize: 'large' }),
            createWord('modern', { fontSize: 'large' }),
            createWord('note-taking', { fontSize: 'large', italic: true }),
            createWord('app', { fontSize: 'large' }),
            createWord('with', { fontSize: 'large' }),
            createWord('rich', { fontSize: 'large', bold: true }),
            createWord('formatting', { fontSize: 'large', bold: true }),
            createWord('capabilities.', { fontSize: 'large' }),
        ], {
            backgroundColor: 'rgba(116,192,252,0.1)',
            borderRadius: 12,
        }),
        // Shortcuts section header
        createBlock([
            createWord('⌨️', { fontSize: 'larger' }),
            createWord('Keyboard', { bold: true, fontSize: 'larger' }),
            createWord('Shortcuts', { bold: true, fontSize: 'larger' }),
        ]),
        // Shortcuts list
        createBlock([
            createWord('•'),
            createWord('CTRL+B', { bold: true, highlight: 'rgba(255,212,59,0.3)' }),
            createWord('→'),
            createWord('Bold', { bold: true }),
            createWord('text'),
            createWord('\n'),
            createWord('•'),
            createWord('CTRL+I', { bold: true, highlight: 'rgba(116,192,252,0.3)' }),
            createWord('→'),
            createWord('Italic', { italic: true }),
            createWord('text'),
            createWord('\n'),
            createWord('•'),
            createWord('CTRL+U', { bold: true, highlight: 'rgba(177,151,252,0.3)' }),
            createWord('→'),
            createWord('Underline', { underline: true }),
            createWord('text'),
        ], {
            borderStyle: 'solid',
            borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.05)',
        }),
        // Features section
        createBlock([
            createWord('✨', { fontSize: 'larger' }),
            createWord('Features', { bold: true, fontSize: 'larger' }),
        ]),
        // Feature: Text sizes
        createBlock([
            createWord('Text', { fontSize: 'tiny' }),
            createWord('in', { fontSize: 'smaller' }),
            createWord('different', {}),
            createWord('sizes:', { fontSize: 'large' }),
            createWord('tiny,', { fontSize: 'tiny' }),
            createWord('smaller,', { fontSize: 'smaller' }),
            createWord('normal,', {}),
            createWord('large,', { fontSize: 'large' }),
            createWord('larger,', { fontSize: 'larger' }),
            createWord('huge', { fontSize: 'huge' }),
        ], {
            title: 'Text Sizes',
            borderStyle: 'dashed',
            borderRadius: 6,
            backgroundColor: 'rgba(255,169,77,0.1)',
        }),
        // Feature: Colors
        createBlock([
            createWord('Colorful', { color: '#ff6b6b', bold: true }),
            createWord('text', { color: '#ffa94d' }),
            createWord('with', { color: '#ffd43b' }),
            createWord('highlights', { highlight: 'rgba(105,219,124,0.4)' }),
            createWord('and', { color: '#74c0fc' }),
            createWord('backgrounds', { highlight: 'rgba(177,151,252,0.4)' }),
        ], {
            title: 'Colors',
            borderStyle: 'solid',
            borderRadius: 10,
            backgroundGradient: 'linear-gradient(135deg, rgba(116,192,252,0.1) 0%, rgba(177,151,252,0.1) 100%)',
        }),
        // Feature: Blocks
        createBlock([
            createWord('Blocks'),
            createWord('can'),
            createWord('have'),
            createWord('different'),
            createWord('styles:'),
            createWord('borders,'),
            createWord('backgrounds,'),
            createWord('gradients,'),
            createWord('and'),
            createWord('corner'),
            createWord('radius!'),
        ], {
            title: 'Block Styling',
            borderStyle: 'dotted',
            borderRadius: 16,
            backgroundGradient: 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,169,77,0.15) 100%)',
        }),
        // Tips section
        createBlock([
            createWord('💡', { fontSize: 'larger' }),
            createWord('Tips', { bold: true, fontSize: 'larger' }),
        ]),
        createBlock([
            createWord('•'),
            createWord('Click'),
            createWord('◐'),
            createWord('on'),
            createWord('a'),
            createWord('block'),
            createWord('to'),
            createWord('customize'),
            createWord('its'),
            createWord('style'),
            createWord('\n'),
            createWord('•'),
            createWord('Use'),
            createWord('Shift+Enter'),
            createWord('to'),
            createWord('create'),
            createWord('a'),
            createWord('new'),
            createWord('block'),
            createWord('\n'),
            createWord('•'),
            createWord('Escape'),
            createWord('to'),
            createWord('exit'),
            createWord('formatting'),
            createWord('mode'),
            createWord('\n'),
            createWord('•'),
            createWord('CTRL+Z'),
            createWord('to'),
            createWord('undo'),
            createWord('changes'),
        ], {
            borderStyle: 'solid',
            borderRadius: 4,
            backgroundColor: 'rgba(105,219,124,0.1)',
        }),
    ];

    return {
        notes: [sampleNote],
        folders: [],
        activeNoteId: sampleNote.id,
        activeFolderId: null,
        sidebarExpanded: true,
        formatMode: null,
        selectedColor: FORMAT_COLORS[0],
        selectedSize: 'normal',
        selectedAnchorId: null,
        lightMode: false,
        editorWidth: 70,
        confirmDeletions: true,
        blockPresets: [
            // Default presets
            { title: 'Note', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,212,59,0.1)' },
            { title: 'Important', borderStyle: 'solid', borderRadius: 4, backgroundGradient: 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,169,77,0.15) 100%)' },
            { title: 'Info', borderStyle: 'dashed', borderRadius: 8, backgroundColor: 'rgba(116,192,252,0.1)' },
        ],
    };
};

const sameFormat = (a: iWord['format'], b: iWord['format']): boolean => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof iWord['format']>;
    return [...keys].every((key) => a[key] === b[key]);
};

// Same text and formatting, the ids do not matter
const sameWords = (a: iWord[], b: iWord[]): boolean =>
    a.length === b.length && a.every((word, i) => word.text === b[i].text && sameFormat(word.format, b[i].format));

// Takes the anchor off every word whose anchor note matches, notes with such words count as edited
const stripAnchors = (notes: iNote[], strip: (anchorId: string) => boolean): iNote[] =>
    notes.map((note) => {
        let changed = false;
        const blocks = note.blocks.map((block) => {
            if (!block.words.some((word) => word.format.anchor && strip(word.format.anchor))) {
                return block;
            }
            changed = true;
            return {
                ...block,
                words: block.words.map((word) => {
                    if (!word.format.anchor || !strip(word.format.anchor)) {
                        return word;
                    }
                    const { anchor: _anchor, ...format } = word.format;
                    return { ...word, format };
                }),
            };
        });
        return changed ? { ...note, blocks, updatedAt: Date.now() } : note;
    });

// Imported data may point to folders or anchor notes that are not there, those move to the top level or lose the anchor
const withValidReferences = (notes: iNote[], folders: iFolder[]): { notes: iNote[]; folders: iFolder[] } => {
    const repaired = repairFolders(folders);
    const ids = new Set(repaired.map((folder) => folder.id));
    const anchorIds = new Set(notes.filter((note) => note.isAnchor).map((note) => note.id));
    return {
        folders: repaired,
        notes: stripAnchors(
            notes.map((note) => (note.folderId && !ids.has(note.folderId) ? { ...note, folderId: null } : note)),
            (anchorId) => !anchorIds.has(anchorId),
        ),
    };
};

const getInitialHistory = (): iHistoryEntry[] => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return [];
        }
    }
    return [];
};

const getInitialRedo = (): iHistoryEntry[] => {
    const stored = localStorage.getItem(REDO_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return [];
        }
    }
    return [];
};

const useNotesStore = () => {
    // Read before the state initializer below, once data is persisted the browser is no longer fresh
    const [freshInstall] = useState(() => localStorage.getItem(STORAGE_KEY) === null);
    const [state, setState] = useState<iNotesState>(getInitialState);
    const [history, setHistory] = useState<iHistoryEntry[]>(getInitialHistory);
    const [redoStack, setRedoStack] = useState<iHistoryEntry[]>(getInitialRedo);
    const isUndoing = useRef(false);
    const lastChange = useRef<{ noteId: string; group: string; time: number } | null>(null);

    const sync = useSync({ state, history, historyLimit: MAX_HISTORY_SIZE, freshInstall, setState, setHistory });

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);

    // Persist history to localStorage
    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }, [history]);

    // Persist redo to localStorage
    useEffect(() => {
        localStorage.setItem(REDO_KEY, JSON.stringify(redoStack));
    }, [redoStack]);

    // Save state to history before modifications (per-note)
    // Edits with the same group within a short time are one step, the group tells a block from another
    const saveToHistory = useCallback((noteId: string, description: string, group = description) => {
        if (isUndoing.current) return;

        const note = state.notes.find((n: iNote) => n.id === noteId);
        if (!note) return;

        // Any new change ends what could be redone
        setRedoStack([]);

        const now = Date.now();
        const last = lastChange.current;
        lastChange.current = { noteId, group, time: now };
        if (last && last.noteId === noteId && last.group === group && COALESCED.includes(description) && now - last.time < COALESCE_MS) {
            return;
        }

        setHistory((prev: iHistoryEntry[]) => {
            const newEntry: iHistoryEntry = {
                noteId,
                note: JSON.parse(JSON.stringify(note)), // Deep clone
                timestamp: Date.now(),
                description,
            };
            const newHistory = [...prev, newEntry];
            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                return newHistory.slice(-MAX_HISTORY_SIZE);
            }
            return newHistory;
        });
    }, [state.notes]);

    // Get history for active note
    const getActiveNoteHistory = useCallback(() => {
        if (!state.activeNoteId) return [];
        return history.filter((h: iHistoryEntry) => h.noteId === state.activeNoteId);
    }, [history, state.activeNoteId]);

    const clearActiveNoteHistory = useCallback(() => {
        const noteId = state.activeNoteId;
        setHistory((prev: iHistoryEntry[]) => prev.filter((h: iHistoryEntry) => h.noteId !== noteId));
        setRedoStack((prev: iHistoryEntry[]) => prev.filter((r: iHistoryEntry) => r.noteId !== noteId));
    }, [state.activeNoteId]);

    // Undo - restore previous state for active note
    const undo = useCallback(() => {
        const noteHistory = getActiveNoteHistory();
        if (noteHistory.length === 0) return;

        isUndoing.current = true;
        lastChange.current = null;
        const previousEntry = noteHistory[noteHistory.length - 1];

        // What is undone can be redone, under the name of the change
        // (the redo stack is not history, it only remembers what was undone)
        const currentNote = state.notes.find((n: iNote) => n.id === state.activeNoteId);
        if (currentNote) {
            setRedoStack((prev: iHistoryEntry[]) => [...prev, {
                noteId: currentNote.id,
                note: JSON.parse(JSON.stringify(currentNote)),
                timestamp: Date.now(),
                description: previousEntry.description,
            }]);
        }

        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) =>
                n.id === previousEntry.noteId ? previousEntry.note : n
            ),
        }));

        setHistory((prev: iHistoryEntry[]) => prev.filter((h: iHistoryEntry) => h !== previousEntry));

        setTimeout(() => {
            isUndoing.current = false;
        }, 0);
    }, [getActiveNoteHistory, state.notes, state.activeNoteId]);

    // Redo - restore from redo stack
    const redo = useCallback(() => {
        const noteRedos = redoStack.filter((r: iHistoryEntry) => r.noteId === state.activeNoteId);
        if (noteRedos.length === 0) return;

        isUndoing.current = true;
        lastChange.current = null;
        const redoEntry = noteRedos[noteRedos.length - 1];

        // Redoing is the change again, so it is undone as that change and keeps its name
        const currentNote = state.notes.find((n: iNote) => n.id === state.activeNoteId);
        if (currentNote) {
            setHistory((prev: iHistoryEntry[]) => [...prev, {
                noteId: currentNote.id,
                note: JSON.parse(JSON.stringify(currentNote)),
                timestamp: Date.now(),
                description: redoEntry.description,
            }]);
        }

        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) =>
                n.id === redoEntry.noteId ? redoEntry.note : n
            ),
        }));

        setRedoStack((prev: iHistoryEntry[]) => prev.filter((r: iHistoryEntry) => r !== redoEntry));

        setTimeout(() => {
            isUndoing.current = false;
        }, 0);
    }, [redoStack, state.notes, state.activeNoteId]);

    // Check if undo/redo is available
    const canUndo = getActiveNoteHistory().length > 0;
    const canRedo = redoStack.filter((r: iHistoryEntry) => r.noteId === state.activeNoteId).length > 0;
    const historyCount = getActiveNoteHistory().length;
    const redoCount = redoStack.filter((r: iHistoryEntry) => r.noteId === state.activeNoteId).length;

    const activeNote = state.notes.find((n: iNote) => n.id === state.activeNoteId) || null;

    // Note actions
    const createNewNote = useCallback((folderId?: string | null) => {
        const note = createNote('Untitled', folderId ?? null);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: [note, ...prev.notes],
            activeNoteId: note.id,
        }));
        return note;
    }, []);

    const updateNote = useCallback((noteId: string, updates: Partial<iNote>) => {
        saveToHistory(noteId, 'Update note');
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) =>
                n.id === noteId
                    ? { ...n, ...updates, updatedAt: Date.now() }
                    : n
            ),
        }));
    }, [saveToHistory]);

    const deleteNote = useCallback((noteId: string) => {
        setState((prev: iNotesState) => {
            const newNotes = stripAnchors(
                prev.notes.filter((n: iNote) => n.id !== noteId),
                (anchorId) => anchorId === noteId,
            );
            return {
                ...prev,
                notes: newNotes,
                selectedAnchorId: prev.selectedAnchorId === noteId ? null : prev.selectedAnchorId,
                activeNoteId: prev.activeNoteId === noteId
                    ? (newNotes[0]?.id || null)
                    : prev.activeNoteId,
            };
        });
        // Clear history for deleted note
        setHistory((prev: iHistoryEntry[]) => prev.filter((h: iHistoryEntry) => h.noteId !== noteId));
        setRedoStack((prev: iHistoryEntry[]) => prev.filter((r: iHistoryEntry) => r.noteId !== noteId));
    }, []);

    const setActiveNote = useCallback((noteId: string | null) => {
        setState((prev: iNotesState) => ({ ...prev, activeNoteId: noteId }));
    }, []);

    // Folder actions
    const createNewFolder = useCallback((name: string, parentId: string | null = null, color?: string) => {
        const folder = { ...createFolder(name, parentId), ...(color ? { color } : {}) };
        setState((prev: iNotesState) => ({
            ...prev,
            folders: [...prev.folders, folder],
        }));
        return folder;
    }, []);

    const updateFolder = useCallback((folderId: string, updates: Partial<iFolder>) => {
        setState((prev: iNotesState) => {
            // A folder cannot move into itself or into one of its own subfolders
            const blocked = updates.parentId
                ? updates.parentId === folderId || descendantIds(prev.folders, folderId).has(updates.parentId)
                : false;
            const { parentId, ...rest } = updates;
            return {
                ...prev,
                folders: prev.folders.map((f: iFolder) =>
                    f.id === folderId ? { ...f, ...rest, ...(parentId !== undefined && !blocked ? { parentId } : {}) } : f
                ),
            };
        });
    }, []);

    // What is inside a deleted folder moves up to the folder above it
    const deleteFolder = useCallback((folderId: string) => {
        setState((prev: iNotesState) => {
            const above = prev.folders.find((f: iFolder) => f.id === folderId)?.parentId ?? null;
            return {
                ...prev,
                folders: prev.folders
                    .filter((f: iFolder) => f.id !== folderId)
                    .map((f: iFolder) => (f.parentId === folderId ? { ...f, parentId: above } : f)),
                notes: prev.notes.map((n: iNote) => (n.folderId === folderId ? { ...n, folderId: above } : n)),
                activeFolderId: prev.activeFolderId === folderId ? null : prev.activeFolderId,
            };
        });
    }, []);

    // Moving a note is not an edit of its text, so it stays out of the undo history
    const moveNote = useCallback((noteId: string, folderId: string | null) => {
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) => (n.id === noteId && n.folderId !== folderId ? { ...n, folderId } : n)),
        }));
    }, []);

    const setActiveFolder = useCallback((folderId: string | null) => {
        setState((prev: iNotesState) => ({ ...prev, activeFolderId: folderId }));
    }, []);

    // Sidebar
    const toggleSidebar = useCallback(() => {
        setState((prev: iNotesState) => ({ ...prev, sidebarExpanded: !prev.sidebarExpanded }));
    }, []);

    const setSidebarExpanded = useCallback((expanded: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, sidebarExpanded: expanded }));
    }, []);

    // Format mode
    const setFormatMode = useCallback((mode: tFormatMode) => {
        setState((prev: iNotesState) => ({ ...prev, formatMode: mode }));
    }, []);

    const toggleFormatMode = useCallback((mode: tFormatMode) => {
        setState((prev: iNotesState) => ({
            ...prev,
            formatMode: prev.formatMode === mode ? null : mode,
        }));
    }, []);

    const setSelectedColor = useCallback((color: string) => {
        setState((prev: iNotesState) => ({ ...prev, selectedColor: color }));
    }, []);

    const setSelectedSize = useCallback((size: string) => {
        setState((prev: iNotesState) => ({ ...prev, selectedSize: size }));
    }, []);

    const setSelectedAnchor = useCallback((noteId: string | null) => {
        setState((prev: iNotesState) => ({ ...prev, selectedAnchorId: noteId }));
    }, []);

    // Taking the anchor off a note also takes it off every word that points to it
    const setNoteAnchor = useCallback((noteId: string, isAnchor: boolean) => {
        setState((prev: iNotesState) => ({
            ...prev,
            notes: (isAnchor ? prev.notes : stripAnchors(prev.notes, (anchorId) => anchorId === noteId)).map(
                (n: iNote) => (n.id === noteId ? { ...n, isAnchor } : n),
            ),
            selectedAnchorId: !isAnchor && prev.selectedAnchorId === noteId ? null : prev.selectedAnchorId,
        }));
    }, []);

    const anchorUsageCount = useCallback(
        (noteId: string) =>
            state.notes.reduce(
                (sum: number, n: iNote) =>
                    sum +
                    n.blocks.reduce(
                        (inNote: number, block: iTextBlock) =>
                            inNote + block.words.filter((word: iWord) => word.format.anchor === noteId).length,
                        0,
                    ),
                0,
            ),
        [state.notes],
    );

    // Light mode toggle
    const setLightMode = useCallback((lightMode: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, lightMode }));
    }, []);

    const toggleLightMode = useCallback(() => {
        setState((prev: iNotesState) => ({ ...prev, lightMode: !prev.lightMode }));
    }, []);

    // Editor width setting
    const setEditorWidth = useCallback((width: number) => {
        setState((prev: iNotesState) => ({ ...prev, editorWidth: Math.max(50, Math.min(100, width)) }));
    }, []);

    // Word formatting
    const updateWordFormat = useCallback((
        noteId: string,
        blockId: string,
        wordId: string,
        formatUpdates: Partial<iWord['format']>
    ) => {
        saveToHistory(noteId, 'Format word');
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                return {
                    ...note,
                    updatedAt: Date.now(),
                    blocks: note.blocks.map((block: iTextBlock) => {
                        if (block.id !== blockId) return block;
                        return {
                            ...block,
                            words: block.words.map((word: iWord) => {
                                if (word.id !== wordId) return word;
                                return {
                                    ...word,
                                    format: { ...word.format, ...formatUpdates },
                                };
                            }),
                        };
                    }),
                };
            }),
        }));
    }, [saveToHistory]);

    // Block operations
    const addBlock = useCallback((noteId: string, afterBlockId?: string, style?: iBlockStyle) => {
        saveToHistory(noteId, 'Add block');
        const newBlock = createBlock([createWord('')], style);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                if (!afterBlockId) {
                    return { ...note, blocks: [...note.blocks, newBlock], updatedAt: Date.now() };
                }
                const idx = note.blocks.findIndex((b: iTextBlock) => b.id === afterBlockId);
                const newBlocks = [...note.blocks];
                newBlocks.splice(idx + 1, 0, newBlock);
                return { ...note, blocks: newBlocks, updatedAt: Date.now() };
            }),
        }));
        return newBlock;
    }, [saveToHistory]);

    const updateBlock = useCallback((noteId: string, blockId: string, updates: Partial<iTextBlock>) => {
        saveToHistory(noteId, 'Update block');
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                return {
                    ...note,
                    updatedAt: Date.now(),
                    blocks: note.blocks.map((block: iTextBlock) =>
                        block.id === blockId ? { ...block, ...updates } : block
                    ),
                };
            }),
        }));
    }, [saveToHistory]);

    const updateBlockStyle = useCallback((noteId: string, blockId: string, style: Partial<iBlockStyle>) => {
        const current = state.notes.find((n: iNote) => n.id === noteId)?.blocks.find((b: iTextBlock) => b.id === blockId);
        if (current && Object.entries(style).every(([key, value]) => current.style[key as keyof iBlockStyle] === value)) return;
        saveToHistory(noteId, 'Update block style', `Update block style ${blockId}`);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                return {
                    ...note,
                    updatedAt: Date.now(),
                    blocks: note.blocks.map((block: iTextBlock) =>
                        block.id === blockId
                            ? { ...block, style: { ...block.style, ...style } }
                            : block
                    ),
                };
            }),
        }));
    }, [saveToHistory, state.notes]);

    const deleteBlock = useCallback((noteId: string, blockId: string) => {
        saveToHistory(noteId, 'Delete block');
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                const newBlocks = note.blocks.filter((b: iTextBlock) => b.id !== blockId);
                // Keep at least one block
                if (newBlocks.length === 0) {
                    newBlocks.push(createBlock([createWord('')]));
                }
                return { ...note, blocks: newBlocks, updatedAt: Date.now() };
            }),
        }));
    }, [saveToHistory]);

    const reorderBlocks = useCallback((noteId: string, fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        saveToHistory(noteId, 'Reorder blocks');
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                const newBlocks = [...note.blocks];
                const [movedBlock] = newBlocks.splice(fromIndex, 1);
                newBlocks.splice(toIndex, 0, movedBlock);
                return { ...note, blocks: newBlocks, updatedAt: Date.now() };
            }),
        }));
    }, [saveToHistory]);

    // Update words in a block (for typing)
    const setBlockWords = useCallback((noteId: string, blockId: string, words: iWord[]) => {
        // Clicking around a note reports its text again, that is no edit and no undo step
        const current = state.notes.find((n: iNote) => n.id === noteId)?.blocks.find((b: iTextBlock) => b.id === blockId);
        if (current && sameWords(current.words, words)) return;
        saveToHistory(noteId, 'Edit text', `Edit text ${blockId}`);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                return {
                    ...note,
                    updatedAt: Date.now(),
                    blocks: note.blocks.map((block: iTextBlock) =>
                        block.id === blockId ? { ...block, words } : block
                    ),
                };
            }),
        }));
    }, [saveToHistory, state.notes]);

    // Export functions
    const exportAsText = useCallback(() => {
        return exportNotesAsText(state.notes);
    }, [state.notes]);

    const exportAsJson = useCallback(() => {
        return exportNotesAsJson(state.notes, state.folders);
    }, [state.notes, state.folders]);

    const exportSettings = useCallback(() => {
        return exportSettingsAsJson(
            {
                lightMode: state.lightMode,
                sidebarExpanded: state.sidebarExpanded,
                editorWidth: state.editorWidth,
                confirmDeletions: state.confirmDeletions,
            },
            state.blockPresets
        );
    }, [state.lightMode, state.sidebarExpanded, state.editorWidth, state.confirmDeletions, state.blockPresets]);

    const importFromJson = useCallback((jsonString: string) => {
        const result = parseImportJson(jsonString);
        if (!result) return false;

        setState((prev: iNotesState) => {
            const newState = { ...prev };

            // Handle notes import (notes or legacy format)
            if (result.type === 'notes' || result.type === 'legacy') {
                if (result.notes) {
                    // Merge notes by ID - skip if ID already exists, otherwise add
                    const existingIds = new Set(prev.notes.map(n => n.id));
                    const newNotes = result.notes.filter((n: iNote) => !existingIds.has(n.id));
                    newState.notes = [...newNotes, ...prev.notes];
                }
                if (result.folders) {
                    // Merge folders by ID - skip if ID already exists
                    const existingFolderIds = new Set(prev.folders.map(f => f.id));
                    const newFolders = result.folders.filter((f: iFolder) => !existingFolderIds.has(f.id));
                    newState.folders = [...newFolders, ...prev.folders];
                }
                Object.assign(newState, withValidReferences(newState.notes, newState.folders));
            }

            // Handle settings import (settings or legacy format)
            if (result.type === 'settings' || result.type === 'legacy') {
                if (result.settings) {
                    if (result.settings.lightMode !== undefined) newState.lightMode = result.settings.lightMode;
                    if (result.settings.sidebarExpanded !== undefined) newState.sidebarExpanded = result.settings.sidebarExpanded;
                    if (result.settings.editorWidth !== undefined) newState.editorWidth = result.settings.editorWidth;
                    if (result.settings.confirmDeletions !== undefined) newState.confirmDeletions = result.settings.confirmDeletions;
                }
                if (result.blockPresets) {
                    // Merge presets by title (presets don't have IDs)
                    const existingTitles = new Set(prev.blockPresets.map(p => p.title));
                    const newPresets = result.blockPresets.filter((p: iBlockStyle) => {
                        if (existingTitles.has(p.title)) return false;
                        return true;
                    });
                    newState.blockPresets = [...prev.blockPresets, ...newPresets];
                }
            }

            return newState;
        });
        return true;
    }, []);

    // Import notes only (expects notes-type JSON)
    const importNotes = useCallback((jsonString: string) => {
        const result = parseImportJson(jsonString);
        if (!result) return false;
        // Only accept notes-type or legacy format for notes import
        if (result.type !== 'notes' && result.type !== 'legacy') return false;

        setState((prev: iNotesState) => {
            const newState = { ...prev };

            if (result.notes) {
                const existingIds = new Set(prev.notes.map(n => n.id));
                const newNotes = result.notes.filter((n: iNote) => !existingIds.has(n.id));
                newState.notes = [...newNotes, ...prev.notes];
            }
            if (result.folders) {
                const existingFolderIds = new Set(prev.folders.map(f => f.id));
                const newFolders = result.folders.filter((f: iFolder) => !existingFolderIds.has(f.id));
                newState.folders = [...newFolders, ...prev.folders];
            }
            Object.assign(newState, withValidReferences(newState.notes, newState.folders));

            return newState;
        });
        return true;
    }, []);

    // Import settings only (expects settings-type JSON)
    const importSettings = useCallback((jsonString: string) => {
        const result = parseImportJson(jsonString);
        if (!result) return false;
        // Only accept settings-type or legacy format for settings import
        if (result.type !== 'settings' && result.type !== 'legacy') return false;

        setState((prev: iNotesState) => {
            const newState = { ...prev };

            if (result.settings) {
                if (result.settings.lightMode !== undefined) newState.lightMode = result.settings.lightMode;
                if (result.settings.sidebarExpanded !== undefined) newState.sidebarExpanded = result.settings.sidebarExpanded;
                if (result.settings.editorWidth !== undefined) newState.editorWidth = result.settings.editorWidth;
                if (result.settings.confirmDeletions !== undefined) newState.confirmDeletions = result.settings.confirmDeletions;
            }
            if (result.blockPresets) {
                const existingTitles = new Set(prev.blockPresets.map(p => p.title));
                const newPresets = result.blockPresets.filter((p: iBlockStyle) => {
                    if (existingTitles.has(p.title)) return false;
                    return true;
                });
                newState.blockPresets = [...prev.blockPresets, ...newPresets];
            }

            return newState;
        });
        return true;
    }, []);

    // Export history as JSON (separate file with note ID references)
    const exportHistory = useCallback(() => {
        const historyExport = {
            type: 'lockkliye-history',
            version: 1,
            exportedAt: new Date().toISOString(),
            entries: history.map((entry: iHistoryEntry) => ({
                noteId: entry.noteId,
                timestamp: entry.timestamp,
                description: entry.description,
                // Store full note snapshot
                noteSnapshot: entry.note,
            })),
        };
        return JSON.stringify(historyExport, null, 2);
    }, [history]);

    // Import history from JSON
    const importHistory = useCallback((jsonString: string): boolean => {
        try {
            const data = JSON.parse(jsonString);
            if (data.type !== 'lockkliye-history' || !data.entries) {
                return false;
            }

            const importedHistory: iHistoryEntry[] = data.entries.map((entry: {
                noteId: string;
                timestamp: number;
                description: string;
                noteSnapshot: iNote;
            }) => ({
                noteId: entry.noteId,
                timestamp: entry.timestamp,
                description: entry.description,
                note: entry.noteSnapshot,
            }));

            // Merge with existing history or replace
            setHistory((prev: iHistoryEntry[]) => [...importedHistory, ...prev].slice(0, MAX_HISTORY_SIZE));
            return true;
        } catch {
            return false;
        }
    }, []);

    // Create a random note for testing (without pushing to history)
    const createRandomNote = useCallback(() => {
        const note = generateRandomNote();
        setState((prev: iNotesState) => ({
            ...prev,
            notes: [note, ...prev.notes],
            activeNoteId: note.id,
        }));
        return note;
    }, []);

    // Clear all data
    const clearAllData = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(HISTORY_KEY);
        localStorage.removeItem(REDO_KEY);
        setHistory([]);
        setRedoStack([]);
        setState(getInitialState());
    }, []);

    // Toggle confirmation dialogs
    const setConfirmDeletions = useCallback((value: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, confirmDeletions: value }));
    }, []);

    // Block presets management
    const addBlockPreset = useCallback((preset: iBlockStyle) => {
        setState((prev: iNotesState) => ({
            ...prev,
            blockPresets: [...prev.blockPresets, preset],
        }));
    }, []);

    const removeBlockPreset = useCallback((index: number) => {
        setState((prev: iNotesState) => ({
            ...prev,
            blockPresets: prev.blockPresets.filter((_, i) => i !== index),
        }));
    }, []);

    const updateBlockPreset = useCallback((index: number, preset: iBlockStyle) => {
        setState((prev: iNotesState) => ({
            ...prev,
            blockPresets: prev.blockPresets.map((p, i) => i === index ? preset : p),
        }));
    }, []);

    // Add block with preset style
    const addBlockWithPreset = useCallback((noteId: string, preset: iBlockStyle, afterBlockId?: string) => {
        saveToHistory(noteId, 'Add preset block');
        const newBlock = createBlock([createWord('')], preset);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                const blocks = [...note.blocks];
                if (afterBlockId) {
                    const idx = blocks.findIndex((b: iTextBlock) => b.id === afterBlockId);
                    if (idx !== -1) {
                        blocks.splice(idx + 1, 0, newBlock);
                    } else {
                        blocks.push(newBlock);
                    }
                } else {
                    blocks.push(newBlock);
                }
                return { ...note, blocks, updatedAt: Date.now() };
            }),
        }));
    }, [saveToHistory]);

    return {
        // State
        ...state,
        activeNote,
        canUndo,
        canRedo,
        historyCount,
        redoCount,

        // Note actions
        createNewNote,
        updateNote,
        deleteNote,
        setActiveNote,

        // Folder actions
        createNewFolder,
        updateFolder,
        deleteFolder,
        moveNote,
        setActiveFolder,

        // Sidebar
        toggleSidebar,
        setSidebarExpanded,

        // Format mode
        setFormatMode,
        toggleFormatMode,
        setSelectedColor,
        setSelectedSize,
        setSelectedAnchor,
        setNoteAnchor,
        anchorUsageCount,

        // Light mode
        setLightMode,
        toggleLightMode,

        // Editor width
        setEditorWidth,

        // Word/Block operations
        updateWordFormat,
        addBlock,
        updateBlock,
        updateBlockStyle,
        deleteBlock,
        reorderBlocks,
        setBlockWords,

        // History
        undo,
        redo,
        getActiveNoteHistory,
        clearActiveNoteHistory,

        // Export/Import
        exportAsText,
        exportAsJson,
        exportSettings,
        exportHistory,
        importFromJson,
        importNotes,
        importSettings,
        importHistory,

        // Settings
        setConfirmDeletions,

        // Block presets
        addBlockPreset,
        removeBlockPreset,
        updateBlockPreset,
        addBlockWithPreset,

        // Dev
        clearAllData,
        createRandomNote,

        // Server sync
        dirtyNoteIds: sync.dirtyNoteIds,
        save: sync.save,
        syncStatus: sync.syncStatus,
        unsavedCount: sync.unsavedCount,
    };
};

export default useNotesStore;

export type tNotesStore = ReturnType<typeof useNotesStore>;