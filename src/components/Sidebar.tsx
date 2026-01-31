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
    TeaSidebarSettings,
    TeaSidebarSlider,
    TeaSidebarToggle,
    TeaSidebarButton,
    TeaSidebarButtonGroup,
    TeaModal,
    type iTeaSidebarItem,
    type iTeaSidebarSection,
    type iUseTeaToastReturn,
} from '@teatype/components';

// Types
import type { iNote } from '@/types';

// Utils
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
    toast: iUseTeaToastReturn;
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
            }, 200);
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

    // Check if note is empty
    const isNoteEmpty = (note: iNote): boolean => {
        return (
            note.blocks.length === 0 ||
            (note.blocks.length === 1 && note.blocks[0].words.length <= 1 && !note.blocks[0].words[0]?.text.trim())
        );
    };

    // Transform notes to sidebar items
    const noteItems: iTeaSidebarItem[] = notes
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((note) => ({
            id: note.id,
            title: note.title,
            subtitle: getNotePreview(note),
            meta: formatDate(note.updatedAt),
            active: activeNoteId === note.id,
        }));

    const sections: iTeaSidebarSection[] = [
        {
            id: 'notes',
            title: 'All Notes',
            items: noteItems,
            count: notes.length,
        },
    ];

    const handleItemClick = (_sectionId: string, itemId: string) => {
        onNoteSelect(itemId);
    };

    const handleItemDelete = (_sectionId: string, itemId: string) => {
        const note = notes.find((n) => n.id === itemId);
        if (note && confirmDeletions && !isNoteEmpty(note)) {
            setDeleteNoteId(itemId);
        } else {
            onDeleteNote(itemId);
        }
    };

    // Hidden file inputs for import
    const fileInputs = (
        <>
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
        </>
    );

    // Export helper
    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Settings panel content
    const settingsSections = [
        {
            id: 'appearance',
            label: 'Appearance',
            children: (
                <TeaSidebarButton onClick={onToggleLightMode}>
                    {lightMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </TeaSidebarButton>
            ),
        },
        {
            id: 'editor-width',
            label: 'Editor Width',
            children: (
                <TeaSidebarSlider
                    min={50}
                    max={100}
                    step={5}
                    value={editorWidth}
                    onChange={onEditorWidthChange}
                    unit='%'
                />
            ),
        },
        {
            id: 'export',
            label: 'Export',
            children: (
                <TeaSidebarButtonGroup>
                    <TeaSidebarButton
                        onClick={() => {
                            downloadFile(onExportText(), 'lockkliye-notes.txt', 'text/plain');
                            toast.success('Notes exported as text');
                        }}
                    >
                        📄 Notes (Text)
                    </TeaSidebarButton>
                    <TeaSidebarButton
                        onClick={() => {
                            downloadFile(onExportJson(), 'lockkliye-notes.json', 'application/json');
                            toast.success('Notes exported as JSON');
                        }}
                    >
                        📝 Notes (JSON)
                    </TeaSidebarButton>
                    <TeaSidebarButton
                        onClick={() => {
                            downloadFile(onExportSettings(), 'lockkliye-settings.json', 'application/json');
                            toast.success('Settings & presets exported');
                        }}
                    >
                        ⚙️ Settings & Presets
                    </TeaSidebarButton>
                    <TeaSidebarButton
                        onClick={() => {
                            downloadFile(onExportHistory(), 'lockkliye-history.json', 'application/json');
                            toast.success('History exported');
                        }}
                    >
                        📜 History
                    </TeaSidebarButton>
                </TeaSidebarButtonGroup>
            ),
        },
        {
            id: 'import',
            label: 'Import',
            children: (
                <TeaSidebarButtonGroup>
                    <TeaSidebarButton onClick={() => notesInputRef.current?.click()}>📝 Notes</TeaSidebarButton>
                    <TeaSidebarButton onClick={() => settingsInputRef.current?.click()}>
                        ⚙️ Settings & Presets
                    </TeaSidebarButton>
                    <TeaSidebarButton onClick={() => historyInputRef.current?.click()}>📜 History</TeaSidebarButton>
                </TeaSidebarButtonGroup>
            ),
        },
        {
            id: 'developer',
            label: 'Developer',
            children: (
                <>
                    <TeaSidebarToggle
                        checked={confirmDeletions}
                        onChange={onConfirmDeletionsChange}
                        label='Show delete confirmations'
                    />
                    <div className='tea-sidebar-settings__sublabel'>Text Generators</div>
                    <TeaSidebarButtonGroup>
                        <TeaSidebarButton
                            onClick={async () => {
                                const text = generateShortText();
                                const success = await copyToClipboard(text);
                                if (success) toast.success('Short text copied!');
                                else toast.error('Failed to copy');
                            }}
                        >
                            📋 Short Text
                        </TeaSidebarButton>
                        <TeaSidebarButton
                            onClick={async () => {
                                const text = generateLongText();
                                const success = await copyToClipboard(text);
                                if (success) toast.success('Long text copied!');
                                else toast.error('Failed to copy');
                            }}
                        >
                            📋 Long Text
                        </TeaSidebarButton>
                        <TeaSidebarButton
                            onClick={async () => {
                                const text = generateTitle();
                                const success = await copyToClipboard(text);
                                if (success) toast.success('Title copied!');
                                else toast.error('Failed to copy');
                            }}
                        >
                            📋 Title
                        </TeaSidebarButton>
                    </TeaSidebarButtonGroup>
                    <div className='tea-sidebar-settings__sublabel'>Note Generator</div>
                    <TeaSidebarButton onClick={onCreateRandomNote}>🎲 Random Note</TeaSidebarButton>
                    <TeaSidebarButton variant='danger' onClick={() => setShowClearDataModal(true)}>
                        Clear All Data
                    </TeaSidebarButton>
                </>
            ),
        },
    ];

    const footer = (
        <>
            <button className='tea-sidebar-footer-btn' onClick={handleSettingsToggle}>
                <span>⚙</span>
                <span>Settings</span>
            </button>
            <TeaSidebarSettings isOpen={showSettings} isClosing={isSettingsClosing} sections={settingsSections} />
            {fileInputs}
        </>
    );

    return (
        <>
            <TeaSidebar
                title='Notes'
                expanded={expanded}
                onToggle={onToggle}
                headerActions={[
                    {
                        id: 'new-note',
                        label: 'New Note',
                        onClick: onCreateNote,
                        variant: 'primary',
                    },
                ]}
                sections={sections}
                onItemClick={handleItemClick}
                onItemDelete={handleItemDelete}
                showItemDelete={true}
                footer={footer}
                emptyMessage='No notes yet. Click + to create one.'
            />

            {/* Clear All Data Confirmation Modal */}
            <TeaModal
                isOpen={showClearDataModal}
                title='Clear All Data'
                onClose={() => setShowClearDataModal(false)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setShowClearDataModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                onClearAllData();
                                setShowClearDataModal(false);
                            }}
                        >
                            Clear All
                        </button>
                    </>
                }
            >
                <p>Are you sure you want to clear all data? This cannot be undone.</p>
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
