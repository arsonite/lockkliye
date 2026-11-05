/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// Types
import type { iNote, tSortMode } from '@/types';

const SORT_MODES: { id: tSortMode; label: string }[] = [
    { id: 'edited', label: 'Last edited first' },
    { id: 'title', label: 'Title A to Z' },
    { id: 'title-desc', label: 'Title Z to A' },
    { id: 'created', label: 'Newest first' },
    { id: 'manual', label: 'Manual (drag to reorder)' },
];

const DEFAULT_SORT: tSortMode = 'edited';

const byTitle = (a: iNote, b: iNote) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });

const sorters: Record<tSortMode, (a: iNote, b: iNote) => number> = {
    edited: (a, b) => b.updatedAt - a.updatedAt,
    title: byTitle,
    'title-desc': (a, b) => byTitle(b, a),
    created: (a, b) => b.createdAt - a.createdAt,
    // Notes that were never placed come first, the newest of them on top
    manual: (a, b) => (a.order ?? -1) - (b.order ?? -1) || b.updatedAt - a.updatedAt,
};

const sortNotes = (notes: iNote[], mode: tSortMode = DEFAULT_SORT): iNote[] => [...notes].sort(sorters[mode]);

// The notes in the order of a list: the pinned ones first, each part in the order of the mode
const arrangeNotes = (notes: iNote[], mode: tSortMode = DEFAULT_SORT): iNote[] => [
    ...sortNotes(notes.filter((note) => note.pinned), mode),
    ...sortNotes(notes.filter((note) => !note.pinned), mode),
];

export { DEFAULT_SORT, SORT_MODES, arrangeNotes, sortNotes };
