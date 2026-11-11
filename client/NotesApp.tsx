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
import { NoteIcon } from '@teatype/icons';

// Components
import ModeCursor from '@/components/ModeCursor';
import LockedNote from '@/components/LockedNote';
import { NoteEditor } from '@/components/NoteEditor';
import PasswordModal, { type tPasswordMode } from '@/components/PasswordModal';
import { SettingsView } from '@/components/SettingsView';
import { Sidebar } from '@/components/Sidebar';

// Hooks
import useHeldModifiers from '@/hooks/useHeldModifiers';
import useIsMobile from '@/hooks/useIsMobile';
import useKeyboardShortcuts from '@/hooks/useKeyboardShortcuts';
import useNotesStore from '@/hooks/useNotesStore';

// Utility
import { loadPersisted, type iPersisted } from '@/tools/indexedDB';
import { accentVars } from '@/tools/accent';
import { anchorVars } from '@/tools/anchorStyle';
import { isLocked } from '@/tools/lock';
import { enabledOf } from '@/tools/palette';

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
    // On a phone the sidebar is a sheet over everything, opened on demand and not part of the saved layout
    const mobile = useIsMobile();
    const held = useHeldModifiers();
    const [sheetOpen, setSheetOpen] = useState(false);
    const sidebarExpanded = mobile ? sheetOpen : store.sidebarExpanded;
    const toggleSidebar = mobile ? () => setSheetOpen((open) => !open) : store.toggleSidebar;
    const closeSheet = () => setSheetOpen(false);

    // The password dialog, with the note that is to be locked once it is through
    const [passwordMode, setPasswordMode] = useState<tPasswordMode | null>(null);
    const [noteToLock, setNoteToLock] = useState<string | null>(null);
    // A locked note whose lock is to come off as soon as the password has opened it
    const [unlockRemoval, setUnlockRemoval] = useState<string | null>(null);
    const closePassword = () => {
        setPasswordMode(null);
        setNoteToLock(null);
        setUnlockRemoval(null);
    };

    useEffect(() => {
        if (!unlockRemoval) return;
        const note = store.notes.find((n) => n.id === unlockRemoval);
        if (!note) {
            setUnlockRemoval(null);
        } else if (note.open) {
            store.removeLock(unlockRemoval);
            setUnlockRemoval(null);
        }
    }, [unlockRemoval, store]);

    // The toast is rendered in the body, so its light mode comes from the body
    useEffect(() => {
        document.body.classList.toggle('light-mode', store.lightMode);
    }, [store.lightMode]);

    // The accent color is on the page, so the toast and the modals in the body get it too
    useEffect(() => {
        Object.entries(accentVars(store.accentColor, store.lightMode)).forEach(([name, value]) =>
            document.documentElement.style.setProperty(name, value),
        );
    }, [store.accentColor, store.lightMode]);

    useEffect(() => {
        Object.entries(anchorVars(store.anchorStyle)).forEach(([name, value]) =>
            document.documentElement.style.setProperty(name, value),
        );
    }, [store.anchorStyle]);

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

    // Locks a note or takes its lock off, taking the password first when there is none or the notes are closed
    const handleToggleLock = (noteId: string) => {
        const note = store.notes.find((n) => n.id === noteId);
        if (!note) return;
        if (isLocked(note)) {
            if (note.open) {
                store.removeLock(noteId);
            } else if (store.unlocked) {
                setUnlockRemoval(noteId);
            } else {
                setUnlockRemoval(noteId);
                setPasswordMode('unlock');
            }
            return;
        }
        if (!store.hasPassword || !store.unlocked) {
            setNoteToLock(noteId);
            setPasswordMode(store.hasPassword ? 'unlock' : 'create');
            return;
        }
        store.lockNote(noteId);
    };

    const handlePassword = async (
        mode: tPasswordMode,
        { current, next }: { current: string; next: string },
    ): Promise<string | null> => {
        if (mode === 'create') {
            if (!(await store.createPassword(next))) return 'Locking is not available here. Use HTTPS or localhost.';
        } else if (mode === 'unlock') {
            if (!(await store.unlock(current))) return 'Wrong password.';
        } else if (!(await store.changePassword(current, next))) {
            return 'The current password is wrong.';
        }
        if (noteToLock) await store.lockNote(noteToLock);
        setPasswordMode(null);
        setNoteToLock(null);
        if (mode === 'change') toast.success('Password changed');
        return null;
    };

    // Global keyboard shortcuts: Escape leaves format mode and closes settings
    useKeyboardShortcuts({
        onEscape: () => {
            store.setFormatMode(null);
            setShowSettings(false);
            closeSheet();
        },
        onFormatToggle: store.toggleFormatMode,
        onToggleSidebar: toggleSidebar,
        onLockAll: store.lockAll,
        onColorIndex: (index) => {
            const color = enabledOf('text', store.palette)[index];
            if ((store.formatMode !== 'color' && store.formatMode !== 'highlight') || !color) {
                return false;
            }
            store.setSelectedColor(color.value);
            return true;
        },
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

    const handleBlockDataChange = (blockId: string, data: Parameters<typeof store.setBlockData>[2]) => {
        if (store.activeNoteId) {
            store.setBlockData(store.activeNoteId, blockId, data);
        }
    };

    const handleMoveSelection = (
        blockId: string,
        remaining: Parameters<typeof store.moveSelectionToBlock>[2],
        selected: Parameters<typeof store.moveSelectionToBlock>[3],
        position: 'above' | 'below',
        focusNew: boolean,
    ) => {
        if (store.activeNoteId) {
            store.moveSelectionToBlock(store.activeNoteId, blockId, remaining, selected, position, focusNew);
        }
    };

    const handleBlockInsert = (kind: Parameters<typeof store.insertBlock>[1], index?: number) => {
        if (store.activeNoteId) {
            store.insertBlock(store.activeNoteId, kind, index);
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
            className={`notes-app ${sidebarExpanded && !mobile ? '' : 'notes-app--rail'} ${mobile ? 'notes-app--mobile' : ''} ${
                held.startsWith('ctrl') ? 'notes-app--ctrl' : ''
            } ${store.lightMode ? 'light-mode' : ''}`}
        >
            <Sidebar
                notes={store.notes}
                folders={store.folders}
                activeNoteId={store.activeNoteId}
                expanded={sidebarExpanded}
                mobile={mobile}
                confirmDeletions={store.confirmDeletions}
                dirtyNoteIds={store.dirtyNoteIds}
                syncStatus={store.syncStatus}
                unsavedCount={store.unsavedCount}
                use24HourTime={store.use24HourTime}
                onToggle={toggleSidebar}
                onSave={handleSave}
                onNoteSelect={(noteId) => {
                    setShowSettings(false);
                    store.setActiveNote(noteId);
                    closeSheet();
                }}
                onCreateNote={(folderId) => {
                    setShowSettings(false);
                    store.createNewNote(folderId);
                    closeSheet();
                }}
                onDeleteNote={store.deleteNote}
                onMoveNote={store.moveNote}
                onCreateFolder={store.createNewFolder}
                onUpdateFolder={store.updateFolder}
                onDeleteFolder={store.deleteFolder}
                settingsOpen={showSettings}
                onOpenSettings={() => {
                    setShowSettings((open) => !open);
                    closeSheet();
                }}
                onSetPin={store.setNotePin}
                onToggleLock={handleToggleLock}
                onOrderNotes={store.orderNotes}
            />

            <main>
                {showSettings ? (
                    <SettingsView
                        lightMode={store.lightMode}
                        accentColor={store.accentColor}
                        listOptions={store.listOptions}
                        editorWidth={store.editorWidth}
                        confirmDeletions={store.confirmDeletions}
                        showBlockBorders={store.showBlockBorders}
                        showStyleButton={store.showStyleButton}
                        use24HourTime={store.use24HourTime}
                        palette={store.palette}
                        onToggleLightMode={store.toggleLightMode}
                        onAccentColorChange={store.setAccentColor}
                        onListOptionsChange={store.setListOptions}
                        anchorStyle={store.anchorStyle}
                        onAnchorStyleChange={store.setAnchorStyle}
                        onEditorWidthChange={store.setEditorWidth}
                        onConfirmDeletionsChange={store.setConfirmDeletions}
                        onShowBlockBordersChange={store.setShowBlockBorders}
                        onShowStyleButtonChange={store.setShowStyleButton}
                        onUse24HourTimeChange={store.setUse24HourTime}
                        hasPassword={store.hasPassword}
                        locksOpen={store.unlocked}
                        onSetPassword={() => setPasswordMode(store.hasPassword ? 'change' : 'create')}
                        onLockAll={store.lockAll}
                        onClearAllHistory={store.clearAllHistory}
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
                        onCreateRandomFolder={store.createRandomFolder}
                        onRandomizeDates={store.randomizeNoteDates}
                        onExportBackup={store.exportBackup}
                        onImportBackup={store.importBackup}
                        onRestoreTutorial={() => {
                            store.restoreTutorialNote();
                            setShowSettings(false);
                            toast.success('Tutorial note restored');
                        }}
                        onClearAllData={store.clearAllData}
                        onClose={() => setShowSettings(false)}
                        toast={toast}
                    />
                ) : store.activeNote && isLocked(store.activeNote) && !store.activeNote.open ? (
                    <LockedNote
                        key={store.activeNote.id}
                        hasPassword={store.hasPassword}
                        unlocked={store.unlocked}
                        unreadable={store.unreadable.includes(store.activeNote.lock?.data ?? '')}
                        onUnlock={store.unlock}
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
                        formatPicks={store.formatPicks}
                        editorWidth={store.editorWidth}
                        historyCount={store.historyCount}
                        redoCount={store.redoCount}
                        canUndo={store.canUndo}
                        canRedo={store.canRedo}
                        confirmDeletions={store.confirmDeletions}
                        showBlockBorders={store.showBlockBorders}
                        showStyleButton={store.showStyleButton}
                        use24HourTime={store.use24HourTime}
                        blockPresets={store.blockPresets}
                        locksOpen={store.unlocked}
                        onLockAll={store.lockAll}
                        onTitleChange={handleTitleChange}
                        onToggleAnchor={handleToggleAnchor}
                        onAnchorChange={store.setSelectedAnchor}
                        onOpenNote={(noteId) =>
                            store.notes.some((note) => note.id === noteId) && store.setActiveNote(noteId)
                        }
                        onWordFormatChange={handleWordFormatChange}
                        onWordsChange={handleWordsChange}
                        listOptions={store.listOptions}
                        onBlockDataChange={handleBlockDataChange}
                        onBlockInsert={handleBlockInsert}
                        onMoveSelection={handleMoveSelection}
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
                        <div id='notes-empty-icon'>
                            <NoteIcon />
                        </div>
                        <h2>No note selected</h2>
                        <p>Select a note from the sidebar or create a new one</p>
                        <button onClick={() => store.createNewNote()}>Create New Note</button>
                    </div>
                )}
            </main>

            <PasswordModal mode={passwordMode} onSubmit={handlePassword} onClose={closePassword} />

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
