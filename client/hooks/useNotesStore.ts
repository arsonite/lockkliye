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
import { useState, useCallback, useRef } from 'react';

// Types
import { iNote, iFolder, tFormatMode, iNotesState, iWord, iTextBlock, iBlockStyle, iHistoryEntry, iListOptions, tBlockData, tBlockKind, tPaletteKind, tPin } from '@/types';

// Util
import { createNote, createFolder, createBlock, createBlockOfKind, createWord, FORMAT_COLORS, exportNotesAsText, exportNotesAsJson, exportSettingsAsJson, importFromJson as parseImportJson } from '@/types';
import { descendantIds, repairFolders } from '@/tools/folderTree';
import { DEFAULT_ACCENT, sanitizeAccent } from '@/tools/accent';
import { DEFAULT_LIST_OPTIONS, sanitizeListOptions } from '@/tools/lists';
import { MAX_ENABLED, catalogOf, defaultPalette, sanitizePalette } from '@/tools/palette';
import { generateRandomFolderTree, generateRandomNote, randomizeDates } from '@/tools/randomGenerator';
import { createTutorialNote } from '@/tools/tutorialNote';
import useSync from '@/sync/useSync';
import type { iPersisted } from '@/tools/indexedDB';
import usePersist from '@/hooks/usePersist';

const MAX_HISTORY_SIZE = 100;
// Edits of one kind within this time are one undo step: a typed sentence is not one step per keystroke
const COALESCE_MS = 1500;
const COALESCED = ['Edit text', 'Edit block', 'Update block style', 'Update note'];

const getInitialState = (stored?: iNotesState): iNotesState => {
    if (stored) {
        // Older versions saved less
        return {
            ...stored,
            lightMode: stored.lightMode ?? false,
            selectedSize: stored.selectedSize ?? 'normal',
            selectedAnchorId: stored.selectedAnchorId ?? null,
            editorWidth: stored.editorWidth ?? 70,
            showBlockBorders: stored.showBlockBorders ?? true,
            showStyleButton: stored.showStyleButton ?? false,
            use24HourTime: stored.use24HourTime ?? true,
            accentColor: sanitizeAccent(stored.accentColor),
            listOptions: sanitizeListOptions(stored.listOptions),
            palette: sanitizePalette(stored.palette),
        };
    }

    // Create default state with sample data
    const sampleNote = createTutorialNote();

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
        showBlockBorders: true,
        showStyleButton: false,
        use24HourTime: true,
        accentColor: DEFAULT_ACCENT,
        listOptions: DEFAULT_LIST_OPTIONS,
        palette: defaultPalette(),
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

const useNotesStore = (persisted: iPersisted) => {
    // Nothing saved yet means the state is the generated welcome content
    const [freshInstall] = useState(() => persisted.data === undefined);
    const [state, setState] = useState<iNotesState>(() => getInitialState(persisted.data));
    const [history, setHistory] = useState<iHistoryEntry[]>(() => persisted.history ?? []);
    const [redoStack, setRedoStack] = useState<iHistoryEntry[]>(() => persisted.redo ?? []);
    // A block that was just added, the editor of it takes the focus and scrolls into view
    const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
    const isUndoing = useRef(false);
    const lastChange = useRef<{ noteId: string; group: string; time: number } | null>(null);

    const sync = useSync({
        state,
        history,
        historyLimit: MAX_HISTORY_SIZE,
        freshInstall,
        storedMeta: persisted.sync,
        setState,
        setHistory,
    });

    usePersist('data', state);
    usePersist('history', history);
    usePersist('redo', redoStack);

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

    const clearAllHistory = useCallback(() => {
        setHistory([]);
        setRedoStack([]);
    }, []);

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

    // Deleting a folder deletes what is in it: its subfolders and all their notes, with the history of those notes
    const deleteFolder = useCallback(
        (folderId: string) => {
            const folderIds = descendantIds(state.folders, folderId).add(folderId);
            const goneNotes = new Set(
                state.notes.filter((n: iNote) => n.folderId && folderIds.has(n.folderId)).map((n: iNote) => n.id),
            );
            setState((prev: iNotesState) => {
                const notes = stripAnchors(
                    prev.notes.filter((n: iNote) => !goneNotes.has(n.id)),
                    (anchorId) => goneNotes.has(anchorId),
                );
                return {
                    ...prev,
                    folders: prev.folders.filter((f: iFolder) => !folderIds.has(f.id)),
                    notes,
                    selectedAnchorId:
                        prev.selectedAnchorId && goneNotes.has(prev.selectedAnchorId) ? null : prev.selectedAnchorId,
                    activeNoteId:
                        prev.activeNoteId && goneNotes.has(prev.activeNoteId)
                            ? (notes[0]?.id ?? null)
                            : prev.activeNoteId,
                    activeFolderId:
                        prev.activeFolderId && folderIds.has(prev.activeFolderId) ? null : prev.activeFolderId,
                };
            });
            setHistory((prev: iHistoryEntry[]) => prev.filter((entry) => !goneNotes.has(entry.noteId)));
            setRedoStack((prev: iHistoryEntry[]) => prev.filter((entry) => !goneNotes.has(entry.noteId)));
        },
        [state.folders, state.notes],
    );

    // Moving a note is not an edit of its text, so it stays out of the undo history
    const moveNote = useCallback((noteId: string, folderId: string | null) => {
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) => (n.id === noteId && n.folderId !== folderId ? { ...n, folderId } : n)),
        }));
    }, []);

    // Pinning is no edit of the note, so it neither counts as last edited nor as an undo step
    const setNotePin = useCallback((noteId: string, pinned: tPin | undefined) => {
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) => (n.id === noteId ? { ...n, pinned } : n)),
        }));
    }, []);

    // The notes in the order they were dragged into, a folder that has such an order is sorted manually from then on
    const orderNotes = useCallback((folderId: string | null, ids: string[]) => {
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((n: iNote) => (ids.includes(n.id) ? { ...n, order: ids.indexOf(n.id) } : n)),
            folders: folderId
                ? prev.folders.map((f: iFolder) => (f.id === folderId ? { ...f, sort: 'manual' as const } : f))
                : prev.folders,
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
        setState((prev: iNotesState) => {
            if (prev.formatMode === mode) return { ...prev, formatMode: null };
            if (mode !== 'anchor') return { ...prev, formatMode: mode };
            // Anchor mode applies the chosen anchor note, so one is picked as soon as the mode starts
            const anchors = prev.notes.filter((note) => note.isAnchor);
            const chosen = anchors.some((note) => note.id === prev.selectedAnchorId) ? prev.selectedAnchorId : anchors[0]?.id;
            return { ...prev, formatMode: mode, selectedAnchorId: chosen ?? null };
        });
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
        setFocusBlockId(newBlock.id);
        return newBlock;
    }, [saveToHistory]);

    const addBlockBefore = useCallback((noteId: string, beforeBlockId: string) => {
        saveToHistory(noteId, 'Add block');
        const newBlock = createBlock([createWord('')]);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                const idx = note.blocks.findIndex((b: iTextBlock) => b.id === beforeBlockId);
                const newBlocks = [...note.blocks];
                newBlocks.splice(Math.max(idx, 0), 0, newBlock);
                return { ...note, blocks: newBlocks, updatedAt: Date.now() };
            }),
        }));
        setFocusBlockId(newBlock.id);
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

    // A component (checklist, table, code) at a position between the blocks, the end if no index is given
    const insertBlock = useCallback((noteId: string, kind: tBlockKind, index?: number) => {
        saveToHistory(noteId, 'Add block');
        const newBlock = createBlockOfKind(kind);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) => {
                if (note.id !== noteId) return note;
                const blocks = [...note.blocks];
                blocks.splice(index === undefined ? blocks.length : Math.min(Math.max(index, 0), blocks.length), 0, newBlock);
                return { ...note, blocks, updatedAt: Date.now() };
            }),
        }));
        setFocusBlockId(newBlock.id);
    }, [saveToHistory]);

    // What a component holds changes while it is typed in, like the words of a text block
    const setBlockData = useCallback((noteId: string, blockId: string, data: tBlockData) => {
        saveToHistory(noteId, 'Edit block', `Edit block ${blockId}`);
        setState((prev: iNotesState) => ({
            ...prev,
            notes: prev.notes.map((note: iNote) =>
                note.id !== noteId
                    ? note
                    : {
                          ...note,
                          updatedAt: Date.now(),
                          blocks: note.blocks.map((block: iTextBlock) => (block.id === blockId ? { ...block, data } : block)),
                      },
            ),
        }));
    }, [saveToHistory]);

    // Text that was selected in a block goes into a new block above or below it, the block keeps the rest.
    // The focus goes to the new block or stays with the old one.
    const moveSelectionToBlock = useCallback(
        (noteId: string, blockId: string, remaining: iWord[], selected: iWord[], position: 'above' | 'below', focusNew: boolean) => {
            saveToHistory(noteId, 'Move text');
            const newBlock = createBlock(selected.length > 0 ? selected : [createWord('')]);
            setState((prev: iNotesState) => ({
                ...prev,
                notes: prev.notes.map((note: iNote) => {
                    if (note.id !== noteId) return note;
                    const index = note.blocks.findIndex((block: iTextBlock) => block.id === blockId);
                    if (index === -1) return note;
                    const blocks = note.blocks.map((block: iTextBlock) =>
                        block.id === blockId ? { ...block, words: remaining.length > 0 ? remaining : [createWord('')] } : block,
                    );
                    blocks.splice(position === 'above' ? index : index + 1, 0, newBlock);
                    return { ...note, blocks, updatedAt: Date.now() };
                }),
            }));
            setFocusBlockId(focusNew ? newBlock.id : blockId);
        },
        [saveToHistory],
    );

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
                showBlockBorders: state.showBlockBorders,
                showStyleButton: state.showStyleButton,
                use24HourTime: state.use24HourTime,
                accentColor: state.accentColor,
                listOptions: state.listOptions,
                palette: state.palette,
            },
            state.blockPresets
        );
    }, [state.lightMode, state.sidebarExpanded, state.editorWidth, state.confirmDeletions, state.showBlockBorders, state.showStyleButton, state.use24HourTime, state.accentColor, state.listOptions, state.palette, state.blockPresets]);

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
                    if (result.settings.showBlockBorders !== undefined) newState.showBlockBorders = result.settings.showBlockBorders;
                    if (result.settings.showStyleButton !== undefined) newState.showStyleButton = result.settings.showStyleButton;
                    if (result.settings.use24HourTime !== undefined) newState.use24HourTime = result.settings.use24HourTime;
                    if (result.settings.accentColor !== undefined) newState.accentColor = sanitizeAccent(result.settings.accentColor);
                    if (result.settings.listOptions !== undefined) newState.listOptions = sanitizeListOptions(result.settings.listOptions);
                    if (result.settings.palette) newState.palette = sanitizePalette(result.settings.palette);
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
                if (result.settings.showBlockBorders !== undefined) newState.showBlockBorders = result.settings.showBlockBorders;
                if (result.settings.showStyleButton !== undefined) newState.showStyleButton = result.settings.showStyleButton;
                if (result.settings.use24HourTime !== undefined) newState.use24HourTime = result.settings.use24HourTime;
                if (result.settings.accentColor !== undefined) newState.accentColor = sanitizeAccent(result.settings.accentColor);
                if (result.settings.listOptions !== undefined) newState.listOptions = sanitizeListOptions(result.settings.listOptions);
                if (result.settings.palette) newState.palette = sanitizePalette(result.settings.palette);
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

    // Everything in one file, as it is in the app: notes, folders, settings with the colors, presets and the history
    const exportBackup = useCallback(() => {
        return JSON.stringify(
            {
                type: 'lockkliye-backup',
                version: 1,
                exportedAt: Date.now(),
                notes: state.notes,
                folders: state.folders,
                settings: {
                    lightMode: state.lightMode,
                    sidebarExpanded: state.sidebarExpanded,
                    editorWidth: state.editorWidth,
                    confirmDeletions: state.confirmDeletions,
                    showBlockBorders: state.showBlockBorders,
                    showStyleButton: state.showStyleButton,
                    use24HourTime: state.use24HourTime,
                    accentColor: state.accentColor,
                    listOptions: state.listOptions,
                    palette: state.palette,
                },
                blockPresets: state.blockPresets,
                history,
            },
            null,
            2,
        );
    }, [state, history]);

    // A backup replaces everything that is here, the next save makes the server match it
    const importBackup = useCallback((jsonString: string): boolean => {
        try {
            const data = JSON.parse(jsonString);
            if (data?.type !== 'lockkliye-backup' || !Array.isArray(data.notes) || !Array.isArray(data.folders)) {
                return false;
            }
            const settings = data.settings ?? {};
            const references = withValidReferences(data.notes, data.folders);
            setState((prev: iNotesState) => ({
                ...prev,
                ...references,
                lightMode: settings.lightMode ?? prev.lightMode,
                sidebarExpanded: settings.sidebarExpanded ?? prev.sidebarExpanded,
                editorWidth: settings.editorWidth ?? prev.editorWidth,
                confirmDeletions: settings.confirmDeletions ?? prev.confirmDeletions,
                showBlockBorders: settings.showBlockBorders ?? prev.showBlockBorders,
                showStyleButton: settings.showStyleButton ?? prev.showStyleButton,
                use24HourTime: settings.use24HourTime ?? prev.use24HourTime,
                accentColor: settings.accentColor !== undefined ? sanitizeAccent(settings.accentColor) : prev.accentColor,
                listOptions: settings.listOptions !== undefined ? sanitizeListOptions(settings.listOptions) : prev.listOptions,
                palette: settings.palette ? sanitizePalette(settings.palette) : prev.palette,
                blockPresets: Array.isArray(data.blockPresets) ? data.blockPresets : prev.blockPresets,
                activeNoteId: references.notes[0]?.id ?? null,
                activeFolderId: null,
                selectedAnchorId: null,
                formatMode: null,
            }));
            setHistory(Array.isArray(data.history) ? data.history : []);
            setRedoStack([]);
            return true;
        } catch {
            return false;
        }
    }, []);

    // A random folder with subfolders, notes and subnotes for testing
    const createRandomFolder = useCallback(() => {
        const tree = generateRandomFolderTree();
        setState((prev: iNotesState) => ({
            ...prev,
            folders: [...prev.folders, ...tree.folders],
            notes: [...tree.notes, ...prev.notes],
        }));
    }, []);

    // New random creation and edit dates for every note
    const randomizeNoteDates = useCallback(() => {
        setState((prev: iNotesState) => ({ ...prev, notes: prev.notes.map(randomizeDates) }));
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

    // The tutorial note is added again, or reset when it is still there
    const restoreTutorialNote = useCallback(() => {
        const tutorial = createTutorialNote();
        setState((prev: iNotesState) => {
            const existing = prev.notes.find((note: iNote) => note.title === tutorial.title);
            if (!existing) {
                return { ...prev, notes: [tutorial, ...prev.notes], activeNoteId: tutorial.id };
            }
            return {
                ...prev,
                notes: prev.notes.map((note: iNote) =>
                    note.id === existing.id ? { ...note, blocks: tutorial.blocks, updatedAt: Date.now() } : note,
                ),
                activeNoteId: existing.id,
            };
        });
    }, []);

    // Clear all data
    const clearAllData = useCallback(() => {
        setHistory([]);
        setRedoStack([]);
        setState(getInitialState());
    }, []);

    // Toggle confirmation dialogs
    const setConfirmDeletions = useCallback((value: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, confirmDeletions: value }));
    }, []);

    const setShowBlockBorders = useCallback((value: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, showBlockBorders: value }));
    }, []);

    const setShowStyleButton = useCallback((value: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, showStyleButton: value }));
    }, []);

    const setAccentColor = useCallback((value: string) => {
        setState((prev: iNotesState) => ({ ...prev, accentColor: sanitizeAccent(value) }));
    }, []);

    const setListOptions = useCallback((value: iListOptions) => {
        setState((prev: iNotesState) => ({ ...prev, listOptions: sanitizeListOptions(value) }));
    }, []);

    const setUse24HourTime = useCallback((value: boolean) => {
        setState((prev: iNotesState) => ({ ...prev, use24HourTime: value }));
    }, []);

    // Colors and gradients offered by the toolbar and the block style menu
    const togglePaletteEntry = useCallback((kind: tPaletteKind, value: string) => {
        setState((prev: iNotesState) => {
            const { enabled, custom } = prev.palette[kind];
            if (enabled.includes(value)) {
                return { ...prev, palette: { ...prev.palette, [kind]: { custom, enabled: enabled.filter((entry) => entry !== value) } } };
            }
            if (enabled.length >= MAX_ENABLED) return prev;
            return { ...prev, palette: { ...prev.palette, [kind]: { custom, enabled: [...enabled, value] } } };
        });
    }, []);

    // A new custom entry is switched on right away if there is room
    const addCustomPaletteEntry = useCallback((kind: tPaletteKind, value: string) => {
        setState((prev: iNotesState) => {
            if (catalogOf(kind, prev.palette).some((entry) => entry.value === value)) return prev;
            const { enabled, custom } = prev.palette[kind];
            return {
                ...prev,
                palette: {
                    ...prev.palette,
                    [kind]: {
                        custom: [...custom, value],
                        enabled: enabled.length < MAX_ENABLED ? [...enabled, value] : enabled,
                    },
                },
            };
        });
    }, []);

    // Words and blocks that already use it keep it
    const removeCustomPaletteEntry = useCallback((kind: tPaletteKind, value: string) => {
        setState((prev: iNotesState) => {
            const { enabled, custom } = prev.palette[kind];
            return {
                ...prev,
                palette: {
                    ...prev.palette,
                    [kind]: { custom: custom.filter((entry) => entry !== value), enabled: enabled.filter((entry) => entry !== value) },
                },
            };
        });
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
        setFocusBlockId(newBlock.id);
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
        setNotePin,
        orderNotes,
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
        addBlockBefore,
        focusBlockId,
        setFocusBlockId,
        updateBlock,
        updateBlockStyle,
        deleteBlock,
        reorderBlocks,
        setBlockWords,
        insertBlock,
        setBlockData,
        moveSelectionToBlock,

        // History
        undo,
        redo,
        getActiveNoteHistory,
        clearActiveNoteHistory,
        clearAllHistory,

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
        setShowBlockBorders,
        setShowStyleButton,
        setAccentColor,
        setListOptions,
        setUse24HourTime,
        togglePaletteEntry,
        addCustomPaletteEntry,
        removeCustomPaletteEntry,

        // Block presets
        addBlockPreset,
        removeBlockPreset,
        updateBlockPreset,
        addBlockWithPreset,

        // Dev
        clearAllData,
        createRandomNote,
        createRandomFolder,
        randomizeNoteDates,
        exportBackup,
        importBackup,
        restoreTutorialNote,

        // Server sync
        dirtyNoteIds: sync.dirtyNoteIds,
        save: sync.save,
        syncStatus: sync.syncStatus,
        unsavedCount: sync.unsavedCount,
    };
};

export default useNotesStore;

export type tNotesStore = ReturnType<typeof useNotesStore>;