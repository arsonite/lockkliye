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
import { useState, useRef, useEffect } from 'react';

// TeaType
import { BookmarkIcon, ChevronIcon, FolderIcon, LockIcon, PinIcon, SettingsIcon, UnlockIcon, XIcon } from '@teatype/icons';
import { TeaSidebar, TeaModal } from '@teatype/components';

// Utility
import { descendantIds, folderPath } from '@/tools/folderTree';
import { isLocked, isOpen } from '@/tools/lock';
import { DEFAULT_SORT, SORT_MODES, arrangeNotes } from '@/tools/sorting';

// Hooks
import useHeldModifiers from '@/hooks/useHeldModifiers';
import useLongPress from '@/hooks/useLongPress';
import { shortcutBase, shortcutKey, shortcutText } from '@/tools/shortcuts';

// Types
import type { iFolder, iNote, tPin, tSortMode } from '@/types';
import type { tSyncStatus } from '@/sync/useSync';

const COLLAPSED_KEY = 'lockkliye-folders-collapsed';
const ROOT_SORT_KEY = 'lockkliye-root-sort';

interface iSidebarProps {
    notes: iNote[];
    folders: iFolder[];
    activeNoteId: string | null;
    expanded: boolean;
    mobile: boolean;
    confirmDeletions: boolean;
    dirtyNoteIds: Set<string>;
    syncStatus: tSyncStatus;
    settingsOpen: boolean;
    unsavedCount: number;
    use24HourTime: boolean;

    onToggle: () => void;
    onSave: () => void;
    onNoteSelect: (noteId: string) => void;
    onCreateNote: (folderId?: string | null) => void;
    onDeleteNote: (noteId: string) => void;
    onMoveNote: (noteId: string, folderId: string | null) => void;
    onCreateFolder: (name: string, parentId: string | null) => void;
    onUpdateFolder: (folderId: string, updates: Partial<iFolder>) => void;
    onDeleteFolder: (folderId: string) => void;
    onOpenSettings: () => void;
    onSetPin: (noteId: string, pin: tPin | undefined) => void;
    onToggleLock: (noteId: string) => void;
    onOrderNotes: (folderId: string | null, ids: string[]) => void; // The order the notes were dragged into
}

// What is being dragged from the list, notes and folders can both be dropped on a folder
interface iDragged {
    type: 'note' | 'folder';
    id: string;
}

// The folder dialog creates a folder or edits an existing one
interface iFolderForm {
    id: string | null;
    name: string;
    parentId: string | null;
}

// An entry of the right-click menu
interface iMenuItem {
    label: string;
    danger?: boolean;

    onClick: () => void;
}

const byName = (a: iFolder, b: iFolder) => a.name.localeCompare(b.name);

const loadCollapsed = (): Set<string> => {
    try {
        return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
    } catch {
        return new Set();
    }
};

export const Sidebar = ({
    notes,
    folders,
    activeNoteId,
    expanded,
    mobile,
    confirmDeletions,
    dirtyNoteIds,
    syncStatus,
    settingsOpen,
    unsavedCount,
    use24HourTime,

    onToggle,
    onSave,
    onNoteSelect,
    onCreateNote,
    onDeleteNote,
    onMoveNote,
    onCreateFolder,
    onUpdateFolder,
    onDeleteFolder,
    onOpenSettings,
    onSetPin,
    onToggleLock,
    onOrderNotes,
}: iSidebarProps) => {
    const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
    const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
    const [folderForm, setFolderForm] = useState<iFolderForm | null>(null);
    const [moveNoteId, setMoveNoteId] = useState<string | null>(null);
    const [moveTarget, setMoveTarget] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
    const [query, setQuery] = useState('');
    // The order of the notes at the top level, the one of a folder belongs to the folder
    const [rootSort, setRootSort] = useState<tSortMode>(() => {
        const saved = localStorage.getItem(ROOT_SORT_KEY);
        return SORT_MODES.some((mode) => mode.id === saved) ? (saved as tSortMode) : DEFAULT_SORT;
    });
    // The folder whose order is being chosen, 'root' for the top level
    const [sortTarget, setSortTarget] = useState<string | null>(null);
    const heldModifiers = useHeldModifiers();
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: iMenuItem[] } | null>(null);
    const dragged = useRef<iDragged | null>(null);

    // Whether a folder is open is a matter of this browser, so it is not part of the synced data
    useEffect(() => {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    }, [collapsed]);

    // The right-click menu closes on any other click, on Escape, and when the list scrolls or the window changes
    useEffect(() => {
        if (!contextMenu) {
            return;
        }
        const close = () => setContextMenu(null);
        // Pointer, not mouse: a touch screen sends mouse events after the touch that opened the menu ended
        const onPointerDown = (event: PointerEvent) => {
            if (!(event.target as HTMLElement).closest('.sidebar-menu')) {
                close();
            }
        };
        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close();
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', close);
        window.addEventListener('blur', close);
        document.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', close);
            window.removeEventListener('blur', close);
            document.removeEventListener('scroll', close, true);
        };
    }, [contextMenu]);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: use24HourTime ? 'h23' : 'h12',
            });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const getNotePreview = (note: iNote): string => {
        if (isLocked(note)) return 'Locked';
        const words = note.blocks.flatMap((b) => b.words.map((w) => w.text)).filter(Boolean);
        return words.slice(0, 10).join(' ') || 'No content';
    };

    // Check if note is empty
    const isNoteEmpty = (note: iNote): boolean => {
        return (
            !isLocked(note) &&
            note.blocks.length === 0 ||
            (note.blocks.length === 1 && note.blocks[0].words.length <= 1 && !note.blocks[0].words[0]?.text.trim())
        );
    };

    // Folders and notes by the folder they sit in, a missing or unknown parent counts as the top level
    const folderIds = new Set(folders.map((folder) => folder.id));
    const parentOf = (folder: iFolder) => (folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null);
    const foldersIn = (parentId: string | null) => folders.filter((f) => parentOf(f) === parentId).sort(byName);
    const folderOfNote = (note: iNote) => (note.folderId && folderIds.has(note.folderId) ? note.folderId : null);
    const sortModeOf = (folderId: string | null): tSortMode =>
        folderId ? (folders.find((f) => f.id === folderId)?.sort ?? DEFAULT_SORT) : rootSort;
    // The pinned ones of a folder come first, the notes that are pinned globally are listed at the top of the sidebar
    const notesIn = (folderId: string | null) =>
        arrangeNotes(notes.filter((n) => n.pinned !== 'global' && folderOfNote(n) === folderId), sortModeOf(folderId));
    const pinnedNotes = arrangeNotes(notes.filter((n) => n.pinned === 'global'), rootSort);
    const countNotes = (folderId: string) => {
        const inside = descendantIds(folders, folderId).add(folderId);
        return notes.filter((n) => n.folderId && inside.has(n.folderId)).length;
    };

    // Folders to choose from, "Work / Projects" instead of indentation, without the ones a folder cannot move into
    const folderOptions = (exclude?: string | null) => {
        const blocked = exclude ? descendantIds(folders, exclude).add(exclude) : new Set<string>();
        return folders
            .filter((folder) => !blocked.has(folder.id))
            .map((folder) => ({ id: folder.id, label: folderPath(folders, folder.id) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    };

    const toggleCollapsed = (folderId: string) =>
        setCollapsed((previous) => {
            const next = new Set(previous);
            if (!next.delete(folderId)) {
                next.add(folderId);
            }
            return next;
        });

    const submitFolderForm = () => {
        if (!folderForm || !folderForm.name.trim()) {
            return;
        }
        const name = folderForm.name.trim();
        if (folderForm.id) {
            onUpdateFolder(folderForm.id, { name, parentId: folderForm.parentId });
        } else {
            onCreateFolder(name, folderForm.parentId);
            // Show the new folder, its parent may be closed
            setCollapsed((previous) => {
                const next = new Set(previous);
                if (folderForm.parentId) {
                    next.delete(folderForm.parentId);
                }
                return next;
            });
        }
        setFolderForm(null);
    };

    const openMenu = (event: React.MouseEvent, items: iMenuItem[]) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY, items });
    };

    // No right-click on a touch screen: holding a row (or the empty list) opens the same menu
    const longPress = useLongPress(({ x, y }) => {
        const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-note-id], [data-folder-id]');
        const note = notes.find((candidate) => candidate.id === row?.dataset.noteId);
        const folder = folders.find((candidate) => candidate.id === row?.dataset.folderId);
        setContextMenu({ x, y, items: note ? noteMenu(note) : folder ? folderMenu(folder) : listMenu() });
    });

    const folderMenu = (folder: iFolder): iMenuItem[] => [
        {
            label: 'New note here',
            onClick: () => {
                onCreateNote(folder.id);
                setCollapsed((previous) => {
                    const next = new Set(previous);
                    next.delete(folder.id);
                    return next;
                });
            },
        },
        {
            label: 'New subfolder',
            onClick: () => setFolderForm({ id: null, name: '', parentId: folder.id }),
        },
        {
            label: 'Edit folder',
            onClick: () =>
                setFolderForm({ id: folder.id, name: folder.name, parentId: parentOf(folder) }),
        },
        { label: 'Sort notes…', onClick: () => setSortTarget(folder.id) },
        { label: 'Delete folder', danger: true, onClick: () => handleFolderDelete(folder) },
    ];

    const noteMenu = (note: iNote): iMenuItem[] => [
        ...(folders.length > 0
            ? [
                  {
                      label: 'Move to folder',
                      onClick: () => {
                          setMoveNoteId(note.id);
                          setMoveTarget(note.folderId ?? '');
                      },
                  },
              ]
            : []),
        ...(note.pinned === 'folder' ? [] : [{ label: 'Pin in folder', onClick: () => onSetPin(note.id, 'folder') }]),
        ...(note.pinned === 'global' ? [] : [{ label: 'Pin globally', onClick: () => onSetPin(note.id, 'global') }]),
        ...(note.pinned ? [{ label: 'Unpin', onClick: () => onSetPin(note.id, undefined) }] : []),
        { label: isLocked(note) ? 'Remove lock' : 'Lock note', onClick: () => onToggleLock(note.id) },
        { label: 'Delete note', danger: true, onClick: () => handleNoteDelete(note) },
    ];

    // The free space of the list
    const listMenu = (): iMenuItem[] => [
        { label: 'New note', onClick: () => onCreateNote(null) },
        { label: 'New folder', onClick: () => setFolderForm({ id: null, name: '', parentId: null }) },
        { label: 'Sort notes…', onClick: () => setSortTarget('root') },
    ];

    const chooseSort = (mode: tSortMode) => {
        if (sortTarget === 'root') {
            setRootSort(mode);
            localStorage.setItem(ROOT_SORT_KEY, mode);
        } else if (sortTarget) {
            onUpdateFolder(sortTarget, { sort: mode });
        }
        setSortTarget(null);
    };

    const handleFolderDelete = (folder: iFolder) => {
        const hasContent = notesIn(folder.id).length > 0 || foldersIn(folder.id).length > 0;
        if (confirmDeletions && hasContent) {
            setDeleteFolderId(folder.id);
        } else {
            onDeleteFolder(folder.id);
        }
    };

    const handleNoteDelete = (note: iNote) => {
        if (confirmDeletions && !isNoteEmpty(note)) {
            setDeleteNoteId(note.id);
        } else {
            onDeleteNote(note.id);
        }
    };

    // Drag and drop: a note or folder dropped on a folder goes into it, dropped on the free space it goes to the top level
    const startDrag = (event: React.DragEvent, item: iDragged) => {
        dragged.current = item;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
        event.stopPropagation();
    };

    const dropOn = (event: React.DragEvent, folderId: string | null) => {
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(null);
        const item = dragged.current;
        dragged.current = null;
        if (!item) {
            return;
        }
        if (item.type === 'note') {
            onMoveNote(item.id, folderId);
        } else if (item.id !== folderId) {
            onUpdateFolder(item.id, { parentId: folderId });
        }
    };

    // A note dropped on another note takes the place before it, the folder then keeps the order that was dragged
    const dropBefore = (event: React.DragEvent, target: iNote) => {
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(null);
        const item = dragged.current;
        dragged.current = null;
        if (!item || item.type !== 'note' || item.id === target.id || target.pinned === 'global') {
            return;
        }
        const containerId = folderOfNote(target);
        const sequence = notesIn(containerId)
            .filter((note) => note.id !== item.id)
            .map((note) => note.id);
        sequence.splice(sequence.indexOf(target.id), 0, item.id);
        const moving = notes.find((note) => note.id === item.id);
        if (moving && folderOfNote(moving) !== containerId) {
            onMoveNote(item.id, containerId);
        }
        onOrderNotes(containerId, sequence);
        if (containerId === null) {
            setRootSort('manual');
            localStorage.setItem(ROOT_SORT_KEY, 'manual');
        }
    };

    const dragOver = (event: React.DragEvent, target: string) => {
        if (!dragged.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(target);
    };

    // Search: every word has to be in the title or the text of a note, or in the name of a folder
    const needle = query.trim().toLowerCase();
    const noteMatches = (note: iNote): boolean => {
        if (!needle) return true;
        const body = isLocked(note) ? '' : note.blocks.flatMap((block) => block.words.map((word) => word.text)).join(' ');
        const text = `${note.title} ${body}`.toLowerCase();
        return needle.split(/\s+/).every((term) => text.includes(term));
    };
    const folderNameMatches = (folder: iFolder): boolean => !!needle && folder.name.toLowerCase().includes(needle);
    const folderShown = (folder: iFolder): boolean =>
        !needle ||
        folderNameMatches(folder) ||
        notesIn(folder.id).some(noteMatches) ||
        foldersIn(folder.id).some(folderShown);

    const renderNote = (note: iNote, depth: number) => (
        <div
            draggable={!mobile}
            data-note-id={note.id}
            className={`tea-sidebar-item sidebar-row ${activeNoteId === note.id ? 'tea-sidebar-item--active' : ''} ${
                dropTarget === `before:${note.id}` ? 'sidebar-row--drop-before' : ''
            }`}
            key={note.id}
            role='button'
            style={{ paddingLeft: 12 + depth * 16 }}
            tabIndex={0}
            onClick={() => onNoteSelect(note.id)}
            onContextMenu={(event) => openMenu(event, noteMenu(note))}
            onDragStart={(event) => startDrag(event, { type: 'note', id: note.id })}
            onDragEnd={() => setDropTarget(null)}
            onDragOver={(event) => dragged.current?.type === 'note' && dragged.current.id !== note.id && dragOver(event, `before:${note.id}`)}
            onDragLeave={() => setDropTarget((current) => (current === `before:${note.id}` ? null : current))}
            onDrop={(event) => dropBefore(event, note)}
            onKeyDown={(event) => event.key === 'Enter' && onNoteSelect(note.id)}
        >
            <div className='tea-sidebar-item__content'>
                <div className='tea-sidebar-item__header'>
                    <span className='tea-sidebar-item__title'>
                        {dirtyNoteIds.has(note.id) && <span className='sync-dot' title={`Not saved yet (${shortcutText('save')})`} />}
                        {note.pinned && (
                            <span
                                className='sidebar-row__anchor'
                                title={note.pinned === 'global' ? 'Pinned globally' : 'Pinned in its folder'}
                            >
                                <PinIcon />
                            </span>
                        )}
                        {isLocked(note) && (
                            <span className='sidebar-row__anchor' title={isOpen(note) ? 'Locked note, open' : 'Locked'}>
                                {isOpen(note) ? <UnlockIcon /> : <LockIcon />}
                            </span>
                        )}
                        {note.isAnchor && (
                            <span className='sidebar-row__anchor' title='Anchor note'>
                                <BookmarkIcon size={12} />
                            </span>
                        )}
                        {note.title}
                    </span>

                    <span className='sidebar-row__actions'>
                        <button
                            className='sidebar-action sidebar-action--danger'
                            title='Delete'
                            onClick={(event) => {
                                event.stopPropagation();
                                handleNoteDelete(note);
                            }}
                        >
                            <XIcon width='1em' height='1em' />
                        </button>
                    </span>
                </div>

                <div className='tea-sidebar-item__meta'>
                    <span className='tea-sidebar-item__date'>{formatDate(note.updatedAt)}</span>
                    <span className='tea-sidebar-item__subtitle'>{getNotePreview(note)}</span>
                </div>
            </div>
        </div>
    );

    const renderFolder = (folder: iFolder, depth: number, showAll = false): React.ReactNode => {
        // A search opens every folder it found something in, and shows all of a folder whose name it found
        const open = needle ? true : !collapsed.has(folder.id);
        const everything = showAll || folderNameMatches(folder);

        return (
            <div key={folder.id} className='folder-node'>
                <div
                    draggable={!mobile}
                    data-folder-id={folder.id}
                    className={`tea-sidebar-item sidebar-row folder-row ${
                        dropTarget === folder.id ? 'folder-row--drop' : ''
                    }`}
                    role='button'
                    style={{ paddingLeft: 12 + depth * 16 }}
                    tabIndex={0}
                    title={folder.name}
                    onClick={() => toggleCollapsed(folder.id)}
                    onContextMenu={(event) => openMenu(event, folderMenu(folder))}
                    onDragStart={(event) => startDrag(event, { type: 'folder', id: folder.id })}
                    onDragEnd={() => setDropTarget(null)}
                    onDragOver={(event) => dragOver(event, folder.id)}
                    onDragLeave={() => setDropTarget((current) => (current === folder.id ? null : current))}
                    onDrop={(event) => dropOn(event, folder.id)}
                    onKeyDown={(event) => event.key === 'Enter' && toggleCollapsed(folder.id)}
                >
                    <span className={`folder-row__chevron ${open ? 'folder-row__chevron--open' : ''}`}>
                        <ChevronIcon />
                    </span>

                    <span className='tea-sidebar-item__title folder-row__name'>{folder.name}</span>

                    <span className='folder-row__count'>{countNotes(folder.id)}</span>
                </div>

                {open && (
                    <>
                        {foldersIn(folder.id)
                            .filter((child) => everything || folderShown(child))
                            .map((child) => renderFolder(child, depth + 1, everything))}
                        {notesIn(folder.id)
                            .filter((note) => everything || noteMatches(note))
                            .map((note) => renderNote(note, depth + 1))}
                    </>
                )}
            </div>
        );
    };

    const tree = (
        <div
            className={`folder-tree ${dropTarget === 'root' ? 'folder-tree--drop' : ''}`}
            {...longPress.handlers}
            onDragOver={(event) => dragOver(event, 'root')}
            onDragLeave={(event) => event.currentTarget === event.target && setDropTarget(null)}
            onDrop={(event) => dropOn(event, null)}
            onContextMenu={(event) => !(event.target as HTMLElement).closest('.sidebar-row') && openMenu(event, listMenu())}
        >
            {notes.length === 0 && folders.length === 0 ? (
                <div id='sidebar-empty'>No notes yet. Click + to create one.</div>
            ) : (
                <>
                    {pinnedNotes.some(noteMatches) && (
                        <>
                            <div className='sidebar-section-label'>Pinned</div>
                            {pinnedNotes.filter(noteMatches).map((note) => renderNote(note, 0))}
                            <div className='sidebar-section-label'>Notes</div>
                        </>
                    )}
                    {foldersIn(null)
                        .filter(folderShown)
                        .map((folder) => renderFolder(folder, 0))}
                    {notesIn(null)
                        .filter(noteMatches)
                        .map((note) => renderNote(note, 0))}
                    {needle && !foldersIn(null).some(folderShown) && !notesIn(null).some(noteMatches) && !pinnedNotes.some(noteMatches) && (
                        <div id='sidebar-empty'>Nothing found.</div>
                    )}
                </>
            )}
        </div>
    );

    const syncLabel =
        syncStatus === 'syncing'
            ? 'Saving...'
            : unsavedCount > 0
              ? `${unsavedCount} unsaved change${unsavedCount > 1 ? 's' : ''}${syncStatus === 'offline' ? ' (offline)' : ''}`
              : syncStatus === 'offline'
                ? 'Offline, saved locally'
                : 'All changes saved';

    const footer = (
        <>
            <button
                className={`tea-sidebar-footer-btn sync-status sync-status--${
                    syncStatus === 'idle' && unsavedCount > 0 ? 'unsaved' : syncStatus
                }`}
                onClick={onSave}
                title={`Save to the server (${shortcutText('save')})`}
            >
                <span className='sync-status__dot' />
                <span>{syncLabel}</span>
            </button>

            <button
                className={`tea-sidebar-footer-btn ${settingsOpen ? 'tea-sidebar-footer-btn--active' : ''}`}
                onClick={onOpenSettings}
            >
                <SettingsIcon />
                <span>Settings</span>
            </button>
        </>
    );

    // What the collapsed sidebar keeps: saving and the settings
    const rail = (
        <>
            <button
                className={`tea-rail__btn sync-status sync-status--${syncStatus === 'idle' && unsavedCount > 0 ? 'unsaved' : syncStatus}`}
                onClick={onSave}
                title={`${syncLabel}. Click to save (${shortcutText('save')})`}
            >
                <span className='sync-status__dot' />
            </button>
            <button
                className={`tea-rail__btn ${settingsOpen ? 'tea-rail__btn--active' : ''}`}
                onClick={onOpenSettings}
                title='Settings'
            >
                <SettingsIcon />
            </button>
        </>
    );

    const deleteFolderName = folders.find((f) => f.id === deleteFolderId)?.name;
    const deleteCounts = {
        notes: deleteFolderId ? countNotes(deleteFolderId) : 0,
        folders: deleteFolderId ? descendantIds(folders, deleteFolderId).size : 0,
    };
    const moveNote = notes.find((n) => n.id === moveNoteId);

    return (
        <>
            <TeaSidebar
                expanded={expanded}
                mobile={mobile}
                rail={rail}
                toggleKey={heldModifiers === shortcutBase('toggleSidebar').toLowerCase() ? shortcutKey('toggleSidebar') : undefined}
                footer={footer}
                headerActions={[
                    {
                        id: 'new-folder',
                        label: 'New Folder',
                        icon: <span className='sidebar-header-icon'>
                                <FolderIcon />
                            </span>,
                        onClick: () => setFolderForm({ id: null, name: '', parentId: null }),
                        variant: 'secondary',
                    },
                    {
                        id: 'new-note',
                        label: 'New Note',
                        onClick: () => onCreateNote(null),
                        variant: 'primary',
                    },
                ]}
                title={
                    <div className='sidebar-search'>
                        <input
                            type='search'
                            placeholder='Search'
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                }
                onToggle={onToggle}
            >
                {tree}
            </TeaSidebar>

            {/* Right-click menu of folders and notes */}
            {contextMenu && (
                <div
                    className='sidebar-menu'
                    style={{
                        left: Math.min(contextMenu.x, window.innerWidth - 190),
                        top: Math.min(contextMenu.y, window.innerHeight - contextMenu.items.length * 36 - 16),
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                >
                    {contextMenu.items.map((item) => (
                        <button
                            key={item.label}
                            className={`sidebar-menu__item ${item.danger ? 'sidebar-menu__item--danger' : ''}`}
                            onClick={() => {
                                setContextMenu(null);
                                item.onClick();
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Create / Edit Folder Modal */}
            <TeaModal
                footer={
                    <>
                        <button className='tea-modal-btn tea-modal-btn--secondary' onClick={() => setFolderForm(null)}>
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--primary'
                            disabled={!folderForm?.name.trim()}
                            onClick={submitFolderForm}
                        >
                            {folderForm?.id ? 'Save' : 'Create'}
                        </button>
                    </>
                }
                isOpen={folderForm !== null}
                size='sm'
                title={folderForm?.id ? 'Edit Folder' : 'New Folder'}
                onClose={() => setFolderForm(null)}
            >
                {folderForm && (
                    <div className='folder-form'>
                        <label className='folder-form__label'>
                            Name
                            <input
                                className='folder-form__input'
                                autoFocus
                                value={folderForm.name}
                                onChange={(event) => setFolderForm({ ...folderForm, name: event.target.value })}
                                onKeyDown={(event) => event.key === 'Enter' && submitFolderForm()}
                            />
                        </label>
                        <label className='folder-form__label'>
                            Inside
                            <select
                                className='folder-form__input'
                                value={folderForm.parentId ?? ''}
                                onChange={(event) =>
                                    setFolderForm({ ...folderForm, parentId: event.target.value || null })
                                }
                            >
                                <option value=''>No folder (top level)</option>
                                {folderOptions(folderForm.id).map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}
            </TeaModal>

            {/* Move Note Modal */}
            <TeaModal
                footer={
                    <>
                        <button className='tea-modal-btn tea-modal-btn--secondary' onClick={() => setMoveNoteId(null)}>
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--primary'
                            onClick={() => {
                                if (moveNoteId) {
                                    onMoveNote(moveNoteId, moveTarget || null);
                                }
                                setMoveNoteId(null);
                            }}
                        >
                            Move
                        </button>
                    </>
                }
                isOpen={moveNoteId !== null}
                size='sm'
                title='Move Note'
                onClose={() => setMoveNoteId(null)}
            >
                <div className='folder-form'>
                    <label className='folder-form__label'>
                        Move "{moveNote?.title}" to
                        <select
                            className='folder-form__input'
                            value={moveTarget}
                            onChange={(event) => setMoveTarget(event.target.value)}
                        >
                            <option value=''>No folder (top level)</option>
                            {folderOptions().map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </TeaModal>

            {/* How the notes of a folder are ordered */}
            <TeaModal
                isOpen={sortTarget !== null}
                size='sm'
                title='Sort notes'
                onClose={() => setSortTarget(null)}
            >
                <div className='sort-options'>
                    <p>
                        {sortTarget === 'root'
                            ? 'The notes that are in no folder.'
                            : `The notes in "${folders.find((f) => f.id === sortTarget)?.name ?? ''}".`}
                    </p>
                    {SORT_MODES.map((mode) => (
                        <button
                            key={mode.id}
                            className={`sort-options__option ${
                                sortModeOf(sortTarget === 'root' ? null : sortTarget) === mode.id ? 'sort-options__option--active' : ''
                            }`}
                            onClick={() => chooseSort(mode.id)}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </TeaModal>

            {/* Delete Folder Confirmation Modal */}
            <TeaModal
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setDeleteFolderId(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                if (deleteFolderId) {
                                    onDeleteFolder(deleteFolderId);
                                    setDeleteFolderId(null);
                                }
                            }}
                        >
                            Delete
                        </button>
                    </>
                }
                isOpen={deleteFolderId !== null}
                size='sm'
                title='Delete Folder'
                onClose={() => setDeleteFolderId(null)}
            >
                <p>
                    Delete the folder "{deleteFolderName}" with everything in it, {deleteCounts.notes} note(s) and{' '}
                    {deleteCounts.folders} subfolder(s)? This cannot be undone.
                </p>
            </TeaModal>

            {/* Delete Note Confirmation Modal */}
            <TeaModal
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setDeleteNoteId(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                if (deleteNoteId) {
                                    onDeleteNote(deleteNoteId);
                                    setDeleteNoteId(null);
                                }
                            }}
                        >
                            Delete
                        </button>
                    </>
                }
                isOpen={deleteNoteId !== null}
                size='sm'
                title='Delete Note'
                onClose={() => setDeleteNoteId(null)}
            >
                <p>
                    Are you sure you want to delete "{notes.find((n) => n.id === deleteNoteId)?.title || 'this note'}"?
                </p>
            </TeaModal>
        </>
    );
};
