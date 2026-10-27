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

// TeaType components
import { TeaToastContainer, useTeaToast } from '@teatype/components';

// Components
import ModeCursor from '@/components/ModeCursor';
import { NoteEditor } from '@/components/NoteEditor';
import { Sidebar } from '@/components/Sidebar';

// Hooks
import useNotesStore from '@/hooks/useNotesStore';
import useKeyboardShortcuts from '@/hooks/useKeyboardShortcuts';

// Types
import type { iBlockStyle } from '@/types';

const NotesApp: React.FC = () => {
    const store = useNotesStore();
    const toast = useTeaToast();

    const handleSave = async () => {
        const report = await store.save();
        if (report.busy) {
            return;
        }
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

    useKeyboardShortcuts({
        onEscape: () => store.setFormatMode(null),
        onFormatToggle: store.toggleFormatMode,
        onSave: handleSave,
        onUndo: store.undo,
        onRedo: store.redo,
    });

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
                lightMode={store.lightMode}
                editorWidth={store.editorWidth}
                confirmDeletions={store.confirmDeletions}
                dirtyNoteIds={store.dirtyNoteIds}
                syncStatus={store.syncStatus}
                unsavedCount={store.unsavedCount}
                onToggle={store.toggleSidebar}
                onSave={handleSave}
                onNoteSelect={store.setActiveNote}
                onCreateNote={(folderId) => store.createNewNote(folderId)}
                onDeleteNote={store.deleteNote}
                onMoveNote={store.moveNote}
                onCreateFolder={store.createNewFolder}
                onUpdateFolder={store.updateFolder}
                onDeleteFolder={store.deleteFolder}
                onClearAllData={store.clearAllData}
                onToggleLightMode={store.toggleLightMode}
                onEditorWidthChange={store.setEditorWidth}
                onConfirmDeletionsChange={store.setConfirmDeletions}
                onExportText={store.exportAsText}
                onExportJson={store.exportAsJson}
                onExportSettings={store.exportSettings}
                onExportHistory={store.exportHistory}
                onImportNotes={store.importNotes}
                onImportSettings={store.importSettings}
                onImportHistory={store.importHistory}
                onCreateRandomNote={store.createRandomNote}
                toast={toast}
            />

            <main className='notes-app__main'>
                {store.activeNote ? (
                    <NoteEditor
                        note={store.activeNote}
                        folders={store.folders}
                        anchorNotes={store.notes.filter((note) => note.isAnchor)}
                        anchorUsage={store.anchorUsageCount(store.activeNote.id)}
                        formatMode={store.formatMode}
                        selectedColor={store.selectedColor}
                        selectedSize={store.selectedSize}
                        selectedAnchorId={store.selectedAnchorId}
                        editorWidth={store.editorWidth}
                        historyCount={store.historyCount}
                        redoCount={store.redoCount}
                        canUndo={store.canUndo}
                        canRedo={store.canRedo}
                        confirmDeletions={store.confirmDeletions}
                        blockPresets={store.blockPresets}
                        onTitleChange={handleTitleChange}
                        onToggleAnchor={handleToggleAnchor}
                        onAnchorChange={store.setSelectedAnchor}
                        onOpenNote={(noteId) => store.notes.some((note) => note.id === noteId) && store.setActiveNote(noteId)}
                        onWordFormatChange={handleWordFormatChange}
                        onWordsChange={handleWordsChange}
                        onBlockStyleChange={handleBlockStyleChange}
                        onBlockDelete={handleBlockDelete}
                        onBlockAdd={handleBlockAdd}
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
                    <div className='notes-app__empty'>
                        <div className='notes-app__empty-icon'>📝</div>
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

export default NotesApp;
