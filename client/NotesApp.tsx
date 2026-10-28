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
import { useEffect, useState } from 'react';

// TeaType
import { TeaToastContainer, useTeaToast } from '@teatype/components';

// Components
import ModeCursor from '@/components/ModeCursor';
import { NoteEditor } from '@/components/NoteEditor';
import { SettingsView } from '@/components/SettingsView';
import { Sidebar } from '@/components/Sidebar';

// Hooks
import useKeyboardShortcuts from '@/hooks/useKeyboardShortcuts';
import useNotesStore from '@/hooks/useNotesStore';

// Utility
import { loadPersisted, type iPersisted } from '@/tools/indexedDB';

// Types
import type { iBlockStyle } from '@/types';

/**
 * Main application shell.
 *
 * Wires the notes store to the sidebar, the note editor and the settings view,
 * and provides save handling with user feedback via toasts.
 * Rendered only after the persisted data has been read from IndexedDB.
 *
 * @param persisted Data loaded from IndexedDB, used to initialize the store
 */
const NotesAppContent: React.FC<{ persisted: iPersisted }> = ({ persisted }) => {
    // Central state and actions for notes, folders, formatting, history and settings
    const store = useNotesStore(persisted);
    // Toast notifications for save results and settings feedback
    const toast = useTeaToast();
    // When true, the settings view replaces the editor in the main area
    const [showSettings, setShowSettings] = useState(false);

    // The toast is rendered in the body, so its light mode comes from the body
    useEffect(() => {
        document.body.classList.toggle('light-mode', store.lightMode);
    }, [store.lightMode]);

    /**
     * Saves unsaved changes to the server and reports the outcome via toast.
     * Outcomes: busy (a save is already running, stay silent), server
     * unreachable, partial failure, overwritten newer remote versions, success.
     */
    const handleSave = async () => {
        const report = await store.save();
        // Another save is in progress, nothing to report
        if (report.busy) {
            return;
        }
        // Server unreachable: data is kept locally and stays marked as unsaved
        if (!report.ok) {
            toast.warning('Server not reachable. Changes are kept in this browser and stay marked as unsaved.');
        } else if (report.failed > 0) {
            toast.error(`${report.failed} item(s) could not be saved and stay marked as unsaved.`);
        } else if (report.overwritten > 0) {
            toast.warning(`Saved, but replaced a newer version of ${report.overwritten} item(s) saved elsewhere.`);
        } else {
            toast.success('Saved');
        }
    };

    // Global keyboard shortcuts: Escape leaves format mode and closes settings
    useKeyboardShortcuts({
        onEscape: () => {
            store.setFormatMode(null);
            setShowSettings(false);
        },
        onFormatToggle: store.toggleFormatMode,
        onSave: handleSave,
        onUndo: store.undo,
        onRedo: store.redo,
    });

    // The handlers below bind editor events to the active note.
    // They do nothing when no note is active.

    // Applies a format to a single word of a block
    const handleWordFormatChange = (
        blockId: string,
        wordId: string,
        format: Parameters<typeof store.updateWordFormat>[3],
    ) => {
        if (store.activeNoteId) {
            store.updateWordFormat(store.activeNoteId, blockId, wordId, format);
        }
    };

    const handleWordsChange = (blockId: string, words: Parameters<typeof store.setBlockWords>[2]) => {
        if (store.activeNoteId) {
            store.setBlockWords(store.activeNoteId, blockId, words);
        }
    };

    const handleBlockStyleChange = (blockId: string, style: Parameters<typeof store.updateBlockStyle>[2]) => {
        if (store.activeNoteId) {
            store.updateBlockStyle(store.activeNoteId, blockId, style);
        }
    };

    const handleBlockDelete = (blockId: string) => {
        if (store.activeNoteId) {
            store.deleteBlock(store.activeNoteId, blockId);
        }
    };

    const handleBlockAdd = (afterBlockId?: string) => {
        if (store.activeNoteId) {
            store.addBlock(store.activeNoteId, afterBlockId);
        }
    };

    const handleBlockAddBefore = (beforeBlockId: string) => {
        if (store.activeNoteId) {
            store.addBlockBefore(store.activeNoteId, beforeBlockId);
        }
    };

    const handleBlockAddWithPreset = (preset: iBlockStyle, afterBlockId?: string) => {
        if (store.activeNoteId) {
            store.addBlockWithPreset(store.activeNoteId, preset, afterBlockId);
        }
    };

    const handleBlockReorder = (fromIndex: number, toIndex: number) => {
        if (store.activeNoteId) {
            store.reorderBlocks(store.activeNoteId, fromIndex, toIndex);
        }
    };

    const handleToggleAnchor = (isAnchor: boolean) => {
        if (store.activeNoteId) {
            store.setNoteAnchor(store.activeNoteId, isAnchor);
        }
    };

    const handleTitleChange = (title: string) => {
        if (store.activeNoteId) {
            store.updateNote(store.activeNoteId, { title });
        }
    };

    return (
        <div
            className={`notes-app ${store.sidebarExpanded ? '' : 'notes-app--fullscreen'} ${
                store.lightMode ? 'light-mode' : ''
            }`}
        >
            <Sidebar
                notes={store.notes}
                folders={store.folders}
                activeNoteId={store.activeNoteId}
                expanded={store.sidebarExpanded}
                confirmDeletions={store.confirmDeletions}
                dirtyNoteIds={store.dirtyNoteIds}
                syncStatus={store.syncStatus}
                unsavedCount={store.unsavedCount}
                onToggle={store.toggleSidebar}
                onSave={handleSave}
                onNoteSelect={(noteId) => {
                    setShowSettings(false);
                    store.setActiveNote(noteId);
                }}
                onCreateNote={(folderId) => {
                    setShowSettings(false);
                    store.createNewNote(folderId);
                }}
                onDeleteNote={store.deleteNote}
                onMoveNote={store.moveNote}
                onCreateFolder={store.createNewFolder}
                onUpdateFolder={store.updateFolder}
                onDeleteFolder={store.deleteFolder}
                settingsOpen={showSettings}
                onOpenSettings={() => setShowSettings((open) => !open)}
            />

            <main>
                {showSettings ? (
                    <SettingsView
                        lightMode={store.lightMode}
                        editorWidth={store.editorWidth}
                        confirmDeletions={store.confirmDeletions}
                        showBlockBorders={store.showBlockBorders}
                        palette={store.palette}
                        onToggleLightMode={store.toggleLightMode}
                        onEditorWidthChange={store.setEditorWidth}
                        onConfirmDeletionsChange={store.setConfirmDeletions}
                        onShowBlockBordersChange={store.setShowBlockBorders}
                        onTogglePaletteEntry={store.togglePaletteEntry}
                        onAddPaletteEntry={store.addCustomPaletteEntry}
                        onRemovePaletteEntry={store.removeCustomPaletteEntry}
                        onExportText={store.exportAsText}
                        onExportJson={store.exportAsJson}
                        onExportSettings={store.exportSettings}
                        onExportHistory={store.exportHistory}
                        onImportNotes={store.importNotes}
                        onImportSettings={store.importSettings}
                        onImportHistory={store.importHistory}
                        onCreateRandomNote={store.createRandomNote}
                        onClearAllData={store.clearAllData}
                        onClose={() => setShowSettings(false)}
                        toast={toast}
                    />
                ) : store.activeNote ? (
                    <NoteEditor
                        note={store.activeNote}
                        folders={store.folders}
                        anchorNotes={store.notes.filter((note) => note.isAnchor)}
                        anchorUsage={store.anchorUsageCount(store.activeNote.id)}
                        formatMode={store.formatMode}
                        selectedColor={store.selectedColor}
                        palette={store.palette}
                        selectedSize={store.selectedSize}
                        selectedAnchorId={store.selectedAnchorId}
                        editorWidth={store.editorWidth}
                        historyCount={store.historyCount}
                        redoCount={store.redoCount}
                        canUndo={store.canUndo}
                        canRedo={store.canRedo}
                        confirmDeletions={store.confirmDeletions}
                        showBlockBorders={store.showBlockBorders}
                        blockPresets={store.blockPresets}
                        onTitleChange={handleTitleChange}
                        onToggleAnchor={handleToggleAnchor}
                        onAnchorChange={store.setSelectedAnchor}
                        onOpenNote={(noteId) =>
                            store.notes.some((note) => note.id === noteId) && store.setActiveNote(noteId)
                        }
                        onWordFormatChange={handleWordFormatChange}
                        onWordsChange={handleWordsChange}
                        onBlockStyleChange={handleBlockStyleChange}
                        onBlockDelete={handleBlockDelete}
                        onBlockAdd={handleBlockAdd}
                        onBlockAddBefore={handleBlockAddBefore}
                        focusBlockId={store.focusBlockId}
                        onFocusHandled={() => store.setFocusBlockId(null)}
                        onBlockAddWithPreset={handleBlockAddWithPreset}
                        onBlockReorder={handleBlockReorder}
                        onFormatModeChange={store.setFormatMode}
                        onColorChange={store.setSelectedColor}
                        onSizeChange={store.setSelectedSize}
                        onClearFormatMode={() => store.setFormatMode(null)}
                        onUndo={store.undo}
                        onRedo={store.redo}
                        getHistory={store.getActiveNoteHistory}
                        onClearHistory={store.clearActiveNoteHistory}
                        onAddBlockPreset={store.addBlockPreset}
                        onRemoveBlockPreset={store.removeBlockPreset}
                        onUpdateBlockPreset={store.updateBlockPreset}
                    />
                ) : (
                    <div id='notes-empty'>
                        <div id='notes-empty-icon'>📝</div>
                        <h2>No note selected</h2>
                        <p>Select a note from the sidebar or create a new one</p>
                        <button onClick={() => store.createNewNote()}>Create New Note</button>
                    </div>
                )}
            </main>

            <ModeCursor formatMode={store.formatMode} selectedColor={store.selectedColor} />

            <TeaToastContainer toasts={toast.toasts} onRemove={toast.removeToast} position={toast.position} />
        </div>
    );
};

/**
 * Root component. Loads the persisted data from IndexedDB first and renders
 * nothing until it is available, then mounts the actual app.
 */
const NotesApp: React.FC = () => {
    const [persisted, setPersisted] = useState<iPersisted | null>(null);

    useEffect(() => {
        loadPersisted().then(setPersisted);
    }, []);

    return persisted ? <NotesAppContent persisted={persisted} /> : null;
};

export default NotesApp;
