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
import type { iNote } from '@/types';
import { Modal } from './Modal';
import type { useToast } from './Toast';
import { generateShortText, generateLongText, generateTitle, copyToClipboard } from '@/util/randomGenerator';

interface iSidebarProps {
    notes: iNote[];
    activeNoteId: string | null;
    expanded: boolean;
    lightMode: boolean;
    editorWidth: number;
    confirmDeletions: boolean;
    onToggle: () => void;
    onNoteSelect: (noteId: string) => void;
    onCreateNote: () => void;
    onDeleteNote: (noteId: string) => void;
    onClearAllData: () => void;
    onToggleLightMode: () => void;
    onEditorWidthChange: (width: number) => void;
    onConfirmDeletionsChange: (value: boolean) => void;
    onExportText: () => string;
    onExportJson: () => string;
    onExportSettings: () => string;
    onExportHistory: () => string;
    onImportNotes: (json: string) => boolean;
    onImportSettings: (json: string) => boolean;
    onImportHistory: (json: string) => boolean;
    onCreateRandomNote: () => void;
    toast: ReturnType<typeof useToast>;
}

export const Sidebar = ({
    notes,
    activeNoteId,
    expanded,
    lightMode,
    editorWidth,
    confirmDeletions,
    onToggle,
    onNoteSelect,
    onCreateNote,
    onDeleteNote,
    onClearAllData,
    onToggleLightMode,
    onEditorWidthChange,
    onConfirmDeletionsChange,
    onExportText,
    onExportJson,
    onExportSettings,
    onExportHistory,
    onImportNotes,
    onImportSettings,
    onImportHistory,
    onCreateRandomNote,
    toast,
}: iSidebarProps) => {
    const [showSettings, setShowSettings] = useState(false);
    const [isSettingsClosing, setIsSettingsClosing] = useState(false);
    const [showClearDataModal, setShowClearDataModal] = useState(false);
    const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
    const notesInputRef = useRef<HTMLInputElement>(null);
    const settingsInputRef = useRef<HTMLInputElement>(null);
    const historyInputRef = useRef<HTMLInputElement>(null);

    // Handle settings toggle with closing animation
    const handleSettingsToggle = () => {
        if (showSettings) {
            // Start closing animation
            setIsSettingsClosing(true);
        } else {
            setShowSettings(true);
        }
    };

    // Handle animation end for closing
    useEffect(() => {
        if (isSettingsClosing) {
            const timer = setTimeout(() => {
                setShowSettings(false);
                setIsSettingsClosing(false);
            }, 200); // Match animation duration
            return () => clearTimeout(timer);
        }
    }, [isSettingsClosing]);

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

    return (
        <aside className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}>
            <div className='sidebar__header'>
                <button className='sidebar__toggle' onClick={onToggle} title={expanded ? 'Collapse' : 'Expand'}>
                    <span className='sidebar__toggle-icon'>{expanded ? '◀' : '▶'}</span>
                </button>
                {expanded && (
                    <>
                        <h2 className='sidebar__title'>Notes</h2>
                        <button className='sidebar__new-note' onClick={onCreateNote} title='New Note'>
                            <span>+</span>
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <>
                    <div className='sidebar__notes'>
                        <div className='sidebar__section-header'>
                            <span>All Notes</span>
                            <span className='sidebar__count'>{notes.length}</span>
                        </div>

                        <div className='sidebar__notes-list'>
                            {notes.length === 0 ? (
                                <div className='sidebar__empty'>No notes yet. Click + to create one.</div>
                            ) : (
                                notes
                                    .sort((a, b) => b.updatedAt - a.updatedAt)
                                    .map((note) => (
                                        <div
                                            key={note.id}
                                            className={`sidebar__note ${
                                                activeNoteId === note.id ? 'sidebar__note--active' : ''
                                            }`}
                                            onClick={() => onNoteSelect(note.id)}
                                            role='button'
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && onNoteSelect(note.id)}
                                        >
                                            <div className='sidebar__note-header'>
                                                <span className='sidebar__note-title'>{note.title}</span>
                                                <button
                                                    className='sidebar__note-delete'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Check if note is empty (skip confirmation)
                                                        const noteToDelete = notes.find((n) => n.id === note.id);
                                                        const isNoteEmpty =
                                                            !noteToDelete ||
                                                            noteToDelete.blocks.length === 0 ||
                                                            (noteToDelete.blocks.length === 1 &&
                                                                noteToDelete.blocks[0].words.length <= 1 &&
                                                                !noteToDelete.blocks[0].words[0]?.text.trim());
                                                        if (confirmDeletions && !isNoteEmpty) {
                                                            setDeleteNoteId(note.id);
                                                        } else {
                                                            onDeleteNote(note.id);
                                                        }
                                                    }}
                                                    title='Delete note'
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className='sidebar__note-meta'>
                                                <span className='sidebar__note-date'>{formatDate(note.updatedAt)}</span>
                                                <span className='sidebar__note-preview'>{getNotePreview(note)}</span>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>

                    <div className='sidebar__footer'>
                        <button className='sidebar__settings-btn' onClick={handleSettingsToggle}>
                            <span>⚙</span>
                            <span>Settings</span>
                        </button>

                        {showSettings && (
                            <div
                                className={`sidebar__settings ${isSettingsClosing ? 'sidebar__settings--closing' : ''}`}
                            >
                                <div className='sidebar__settings-section'>
                                    <span className='sidebar__settings-label'>Appearance</span>
                                    <button className='sidebar__toggle-light-mode-btn' onClick={onToggleLightMode}>
                                        {lightMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                                    </button>
                                </div>

                                <div className='sidebar__settings-section'>
                                    <span className='sidebar__settings-label'>Editor Width</span>
                                    <div className='sidebar__slider-container'>
                                        <input
                                            type='range'
                                            min='50'
                                            max='100'
                                            step='5'
                                            value={editorWidth}
                                            onChange={(e) => onEditorWidthChange(Number(e.target.value))}
                                            className='sidebar__slider'
                                        />
                                        <span className='sidebar__slider-value'>{editorWidth}%</span>
                                    </div>
                                </div>

                                <div className='sidebar__settings-section'>
                                    <span className='sidebar__settings-label'>Export</span>
                                    <div className='sidebar__export-buttons'>
                                        <button
                                            className='sidebar__export-btn'
                                            onClick={() => {
                                                const text = onExportText();
                                                const blob = new Blob([text], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'lockkliye-notes.txt';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                toast.success('Notes exported as text');
                                            }}
                                        >
                                            📄 Notes (Text)
                                        </button>
                                        <button
                                            className='sidebar__export-btn'
                                            onClick={() => {
                                                const json = onExportJson();
                                                const blob = new Blob([json], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'lockkliye-notes.json';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                toast.success('Notes exported as JSON');
                                            }}
                                        >
                                            📝 Notes (JSON)
                                        </button>
                                        <button
                                            className='sidebar__export-btn'
                                            onClick={() => {
                                                const json = onExportSettings();
                                                const blob = new Blob([json], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'lockkliye-settings.json';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                toast.success('Settings & presets exported');
                                            }}
                                        >
                                            ⚙️ Settings & Presets
                                        </button>
                                        <button
                                            className='sidebar__export-btn'
                                            onClick={() => {
                                                const json = onExportHistory();
                                                const blob = new Blob([json], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'lockkliye-history.json';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                toast.success('History exported');
                                            }}
                                        >
                                            📜 History
                                        </button>
                                    </div>
                                </div>

                                <div className='sidebar__settings-section'>
                                    <span className='sidebar__settings-label'>Import</span>
                                    <input
                                        type='file'
                                        ref={notesInputRef}
                                        accept='.json'
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    const content = event.target?.result as string;
                                                    const success = onImportNotes(content);
                                                    if (success) {
                                                        toast.success('Notes imported successfully!');
                                                    } else {
                                                        toast.error('Failed to import notes. Invalid file format.');
                                                    }
                                                };
                                                reader.readAsText(file);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                    <input
                                        type='file'
                                        ref={settingsInputRef}
                                        accept='.json'
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    const content = event.target?.result as string;
                                                    const success = onImportSettings(content);
                                                    if (success) {
                                                        toast.success('Settings & presets imported!');
                                                    } else {
                                                        toast.error('Failed to import settings. Invalid file format.');
                                                    }
                                                };
                                                reader.readAsText(file);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                    <input
                                        type='file'
                                        ref={historyInputRef}
                                        accept='.json'
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    const content = event.target?.result as string;
                                                    const success = onImportHistory(content);
                                                    if (success) {
                                                        toast.success('History imported successfully!');
                                                    } else {
                                                        toast.error('Failed to import history. Invalid file format.');
                                                    }
                                                };
                                                reader.readAsText(file);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                    <div className='sidebar__import-buttons'>
                                        <button
                                            className='sidebar__import-btn'
                                            onClick={() => notesInputRef.current?.click()}
                                        >
                                            📝 Notes
                                        </button>
                                        <button
                                            className='sidebar__import-btn'
                                            onClick={() => settingsInputRef.current?.click()}
                                        >
                                            ⚙️ Settings & Presets
                                        </button>
                                        <button
                                            className='sidebar__import-btn'
                                            onClick={() => historyInputRef.current?.click()}
                                        >
                                            📜 History
                                        </button>
                                    </div>
                                </div>

                                <div className='sidebar__settings-section'>
                                    <span className='sidebar__settings-label'>Developer</span>
                                    <div className='sidebar__toggle-setting'>
                                        <label>
                                            <input
                                                type='checkbox'
                                                checked={confirmDeletions}
                                                onChange={(e) => onConfirmDeletionsChange(e.target.checked)}
                                            />
                                            Show delete confirmations
                                        </label>
                                    </div>
                                    <div className='sidebar__dev-buttons'>
                                        <span className='sidebar__dev-label'>Text Generators</span>
                                        <button
                                            className='sidebar__dev-btn'
                                            onClick={async () => {
                                                const text = generateShortText();
                                                const success = await copyToClipboard(text);
                                                if (success) toast.success('Short text copied!');
                                                else toast.error('Failed to copy');
                                            }}
                                        >
                                            📋 Short Text
                                        </button>
                                        <button
                                            className='sidebar__dev-btn'
                                            onClick={async () => {
                                                const text = generateLongText();
                                                const success = await copyToClipboard(text);
                                                if (success) toast.success('Long text copied!');
                                                else toast.error('Failed to copy');
                                            }}
                                        >
                                            📋 Long Text
                                        </button>
                                        <button
                                            className='sidebar__dev-btn'
                                            onClick={async () => {
                                                const text = generateTitle();
                                                const success = await copyToClipboard(text);
                                                if (success) toast.success('Title copied!');
                                                else toast.error('Failed to copy');
                                            }}
                                        >
                                            📋 Title
                                        </button>
                                        <span className='sidebar__dev-label'>Note Generator</span>
                                        <button className='sidebar__dev-btn' onClick={onCreateRandomNote}>
                                            🎲 Random Note
                                        </button>
                                    </div>
                                    <button
                                        className='sidebar__clear-data-btn'
                                        onClick={() => setShowClearDataModal(true)}
                                    >
                                        Clear All Data
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Clear All Data Confirmation Modal */}
            <Modal
                isOpen={showClearDataModal}
                title='Clear All Data'
                message='Are you sure you want to clear all data? This cannot be undone.'
                onClose={() => setShowClearDataModal(false)}
                buttons={[
                    { label: 'Cancel', variant: 'secondary', onClick: () => setShowClearDataModal(false) },
                    {
                        label: 'Clear All',
                        variant: 'danger',
                        onClick: () => {
                            onClearAllData();
                            setShowClearDataModal(false);
                        },
                    },
                ]}
            />

            {/* Delete Note Confirmation Modal */}
            <Modal
                isOpen={deleteNoteId !== null}
                title='Delete Note'
                message={`Are you sure you want to delete "${
                    notes.find((n) => n.id === deleteNoteId)?.title || 'this note'
                }"?`}
                onClose={() => setDeleteNoteId(null)}
                buttons={[
                    { label: 'Cancel', variant: 'secondary', onClick: () => setDeleteNoteId(null) },
                    {
                        label: 'Delete',
                        variant: 'danger',
                        onClick: () => {
                            if (deleteNoteId) {
                                onDeleteNote(deleteNoteId);
                                setDeleteNoteId(null);
                            }
                        },
                    },
                ]}
            />
        </aside>
    );
};
