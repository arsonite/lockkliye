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

import { useState, useRef, useEffect } from 'react';

// TeaType components
import {
    TeaSidebar,
    TeaModal,
} from '@teatype/components';

// Types
import type { iFolder, iNote } from '@/types';
import { FORMAT_COLORS } from '@/types';
import type { tSyncStatus } from '@/sync/useSync';

// Components
import AnchorIcon from '@/components/AnchorIcon';

// Utils
import { descendantIds, folderPath } from '@/util/folderTree';

const COLLAPSED_KEY = 'lockkliye-folders-collapsed';
const FOLDER_COLORS = FORMAT_COLORS.filter((color) => color !== 'inherit');

interface iSidebarProps {
    notes: iNote[];
    folders: iFolder[];
    activeNoteId: string | null;
    expanded: boolean;
    confirmDeletions: boolean;
    dirtyNoteIds: Set<string>;
    syncStatus: tSyncStatus;
    unsavedCount: number;
    onToggle: () => void;
    onSave: () => void;
    onNoteSelect: (noteId: string) => void;
    onCreateNote: (folderId?: string | null) => void;
    onDeleteNote: (noteId: string) => void;
    onMoveNote: (noteId: string, folderId: string | null) => void;
    onCreateFolder: (name: string, parentId: string | null, color?: string) => void;
    onUpdateFolder: (folderId: string, updates: Partial<iFolder>) => void;
    onDeleteFolder: (folderId: string) => void;
    settingsOpen: boolean;
    onOpenSettings: () => void;
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
    color: string;
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
    confirmDeletions,
    dirtyNoteIds,
    syncStatus,
    unsavedCount,
    onToggle,
    onSave,
    onNoteSelect,
    onCreateNote,
    onDeleteNote,
    onMoveNote,
    onCreateFolder,
    onUpdateFolder,
    onDeleteFolder,
    settingsOpen,
    onOpenSettings,
}: iSidebarProps) => {
    const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
    const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
    const [folderForm, setFolderForm] = useState<iFolderForm | null>(null);
    const [moveNoteId, setMoveNoteId] = useState<string | null>(null);
    const [moveTarget, setMoveTarget] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
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
        const onMouseDown = (event: MouseEvent) => {
            if (!(event.target as HTMLElement).closest('.sidebar-menu')) {
                close();
            }
        };
        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close();
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', close);
        window.addEventListener('blur', close);
        document.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
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
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const getNotePreview = (note: iNote): string => {
        const words = note.blocks.flatMap((b) => b.words.map((w) => w.text)).filter(Boolean);
        return words.slice(0, 10).join(' ') || 'No content';
    };

    // Check if note is empty
    const isNoteEmpty = (note: iNote): boolean => {
        return (
            note.blocks.length === 0 ||
            (note.blocks.length === 1 && note.blocks[0].words.length <= 1 && !note.blocks[0].words[0]?.text.trim())
        );
    };

    // Folders and notes by the folder they sit in, a missing or unknown parent counts as the top level
    const folderIds = new Set(folders.map((folder) => folder.id));
    const parentOf = (folder: iFolder) => (folder.parentId && folderIds.has(folder.parentId) ? folder.parentId : null);
    const foldersIn = (parentId: string | null) => folders.filter((f) => parentOf(f) === parentId).sort(byName);
    const sortedNotes = [...notes].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    const notesIn = (folderId: string | null) =>
        sortedNotes.filter((n) => (n.folderId && folderIds.has(n.folderId) ? n.folderId : null) === folderId);
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
            onUpdateFolder(folderForm.id, { name, color: folderForm.color || undefined, parentId: folderForm.parentId });
        } else {
            onCreateFolder(name, folderForm.parentId, folderForm.color || undefined);
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
        { label: 'New subfolder', onClick: () => setFolderForm({ id: null, name: '', color: '', parentId: folder.id }) },
        {
            label: 'Edit folder',
            onClick: () =>
                setFolderForm({
                    id: folder.id,
                    name: folder.name,
                    color: folder.color ?? '',
                    parentId: parentOf(folder),
                }),
        },
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
        { label: 'Delete note', danger: true, onClick: () => handleNoteDelete(note) },
    ];

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

    const dragOver = (event: React.DragEvent, target: string) => {
        if (!dragged.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(target);
    };

    const renderNote = (note: iNote, depth: number) => (
        <div
            key={note.id}
            className={`tea-sidebar-item sidebar-row ${activeNoteId === note.id ? 'tea-sidebar-item--active' : ''}`}
            style={{ paddingLeft: 12 + depth * 16 }}
            draggable
            onDragStart={(event) => startDrag(event, { type: 'note', id: note.id })}
            onDragEnd={() => setDropTarget(null)}
            onClick={() => onNoteSelect(note.id)}
            onContextMenu={(event) => openMenu(event, noteMenu(note))}
            role='button'
            tabIndex={0}
            onKeyDown={(event) => event.key === 'Enter' && onNoteSelect(note.id)}
        >
            <div className='tea-sidebar-item__content'>
                <div className='tea-sidebar-item__header'>
                    <span className='tea-sidebar-item__title'>
                        {dirtyNoteIds.has(note.id) && <span className='sync-dot' title='Not saved yet (Ctrl+S)' />}
                        {note.isAnchor && (
                            <span className='sidebar-row__anchor' title='Anchor note'>
                                <AnchorIcon size={12} />
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
                            ×
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

    const renderFolder = (folder: iFolder, depth: number): React.ReactNode => {
        const open = !collapsed.has(folder.id);
        return (
            <div key={folder.id} className='folder-node'>
                <div
                    className={`tea-sidebar-item sidebar-row folder-row ${
                        dropTarget === folder.id ? 'folder-row--drop' : ''
                    }`}
                    style={{ paddingLeft: 12 + depth * 16 }}
                    draggable
                    onDragStart={(event) => startDrag(event, { type: 'folder', id: folder.id })}
                    onDragEnd={() => setDropTarget(null)}
                    onDragOver={(event) => dragOver(event, folder.id)}
                    onDragLeave={() => setDropTarget((current) => (current === folder.id ? null : current))}
                    onDrop={(event) => dropOn(event, folder.id)}
                    onClick={() => toggleCollapsed(folder.id)}
                    onContextMenu={(event) => openMenu(event, folderMenu(folder))}
                    title={folder.name}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(event) => event.key === 'Enter' && toggleCollapsed(folder.id)}
                >
                    <span className={`folder-row__chevron ${open ? 'folder-row__chevron--open' : ''}`}>▶</span>
                    {folder.color && <span className='folder-row__dot' style={{ background: folder.color }} />}
                    <span className='tea-sidebar-item__title folder-row__name'>{folder.name}</span>
                    <span className='folder-row__count'>{countNotes(folder.id)}</span>
                </div>
                {open && (
                    <>
                        {foldersIn(folder.id).map((child) => renderFolder(child, depth + 1))}
                        {notesIn(folder.id).map((note) => renderNote(note, depth + 1))}
                    </>
                )}
            </div>
        );
    };

    const tree = (
        <div
            className={`folder-tree ${dropTarget === 'root' ? 'folder-tree--drop' : ''}`}
            onDragOver={(event) => dragOver(event, 'root')}
            onDragLeave={(event) => event.currentTarget === event.target && setDropTarget(null)}
            onDrop={(event) => dropOn(event, null)}
        >
            {notes.length === 0 && folders.length === 0 ? (
                <div className='tea-sidebar__empty'>No notes yet. Click + to create one.</div>
            ) : (
                <>
                    {foldersIn(null).map((folder) => renderFolder(folder, 0))}
                    {notesIn(null).map((note) => renderNote(note, 0))}
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
                title='Save to the server (Ctrl+S)'
            >
                <span className='sync-status__dot' />
                <span>{syncLabel}</span>
            </button>
            <button
                className={`tea-sidebar-footer-btn ${settingsOpen ? 'tea-sidebar-footer-btn--active' : ''}`}
                onClick={onOpenSettings}
            >
                <span>⚙</span>
                <span>Settings</span>
            </button>
        </>
    );

    const deleteFolderName = folders.find((f) => f.id === deleteFolderId)?.name;
    const moveNote = notes.find((n) => n.id === moveNoteId);

    return (
        <>
            <TeaSidebar
                title='Notes'
                expanded={expanded}
                onToggle={onToggle}
                headerActions={[
                    {
                        id: 'new-folder',
                        label: 'New Folder',
                        icon: <span className='sidebar-header-icon'>🗀</span>,
                        onClick: () => setFolderForm({ id: null, name: '', color: '', parentId: null }),
                        variant: 'secondary',
                    },
                    {
                        id: 'new-note',
                        label: 'New Note',
                        onClick: () => onCreateNote(null),
                        variant: 'primary',
                    },
                ]}
                footer={footer}
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
                isOpen={folderForm !== null}
                title={folderForm?.id ? 'Edit Folder' : 'New Folder'}
                onClose={() => setFolderForm(null)}
                size='sm'
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
                        <div className='folder-form__label'>
                            Color
                            <div className='folder-form__colors'>
                                {['', ...FOLDER_COLORS].map((color) => (
                                    <button
                                        key={color || 'none'}
                                        type='button'
                                        title={color || 'No color'}
                                        className={`folder-form__swatch ${
                                            folderForm.color === color ? 'folder-form__swatch--active' : ''
                                        } ${color ? '' : 'folder-form__swatch--none'}`}
                                        style={color ? { background: color } : undefined}
                                        onClick={() => setFolderForm({ ...folderForm, color })}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </TeaModal>

            {/* Move Note Modal */}
            <TeaModal
                isOpen={moveNoteId !== null}
                title='Move Note'
                onClose={() => setMoveNoteId(null)}
                size='sm'
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

            {/* Delete Folder Confirmation Modal */}
            <TeaModal
                isOpen={deleteFolderId !== null}
                title='Delete Folder'
                onClose={() => setDeleteFolderId(null)}
                size='sm'
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
            >
                <p>
                    Delete the folder "{deleteFolderName}"? Its notes and subfolders are not deleted, they move up one
                    level.
                </p>
            </TeaModal>

            {/* Delete Note Confirmation Modal */}
            <TeaModal
                isOpen={deleteNoteId !== null}
                title='Delete Note'
                onClose={() => setDeleteNoteId(null)}
                size='sm'
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
            >
                <p>
                    Are you sure you want to delete "{notes.find((n) => n.id === deleteNoteId)?.title || 'this note'}"?
                </p>
            </TeaModal>
        </>
    );
};
