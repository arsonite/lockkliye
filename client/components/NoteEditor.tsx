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
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

// External
import { Flipper, Flipped } from 'react-flip-toolkit';

// TeaType components
import { TeaModal } from '@teatype/components';

// Components
import AnchorIcon from './AnchorIcon';
import FloatingToolbar from './FloatingToolbar';
import { TextBlockComponent } from './TextBlockComponent';

// Types
import type { iFolder, iNote, iTextBlock, iWord, tFormatMode, iHistoryEntry, iBlockStyle, iPalette } from '@/types';

// Utils
import { folderChain } from '@/util/folderTree';

interface iNoteEditorProps {
    note: iNote;
    folders: iFolder[];
    anchorNotes: iNote[];
    anchorUsage: number; // Words anywhere that are anchored to this note
    formatMode: tFormatMode;
    selectedColor: string;
    palette: iPalette;
    selectedSize: string;
    selectedAnchorId?: string | null;
    editorWidth: number;
    historyCount: number;
    redoCount: number;
    canUndo: boolean;
    canRedo: boolean;
    confirmDeletions: boolean;
    showBlockBorders: boolean;
    blockPresets: iBlockStyle[];
    onTitleChange: (title: string) => void;
    onToggleAnchor: (isAnchor: boolean) => void;
    onAnchorChange: (noteId: string) => void;
    onOpenNote: (noteId: string) => void;
    onWordFormatChange: (blockId: string, wordId: string, format: Partial<iWord['format']>) => void;
    onWordsChange: (blockId: string, words: iWord[]) => void;
    onBlockStyleChange: (blockId: string, style: Partial<iTextBlock['style']>) => void;
    onBlockDelete: (blockId: string) => void;
    onBlockAdd: (afterBlockId?: string) => void;
    onBlockAddBefore: (beforeBlockId: string) => void;
    focusBlockId?: string | null; // A block that was just added, its editor takes the focus
    onFocusHandled: () => void;
    onBlockAddWithPreset: (preset: iBlockStyle, afterBlockId?: string) => void;
    onBlockReorder: (fromIndex: number, toIndex: number) => void;
    onFormatModeChange: (mode: tFormatMode) => void;
    onColorChange: (color: string) => void;
    onSizeChange: (size: string) => void;
    onClearFormatMode: () => void;
    onUndo: () => void;
    onRedo: () => void;
    getHistory: () => iHistoryEntry[];
    onClearHistory: () => void;
    onAddBlockPreset: (preset: iBlockStyle) => void;
    onRemoveBlockPreset: (index: number) => void;
    onUpdateBlockPreset: (index: number, preset: iBlockStyle) => void;
}

export const NoteEditor = ({
    note,
    folders,
    anchorNotes,
    anchorUsage,
    formatMode,
    selectedColor,
    palette,
    selectedSize,
    selectedAnchorId,
    editorWidth,
    historyCount,
    redoCount: _redoCount,
    canUndo,
    canRedo,
    confirmDeletions,
    showBlockBorders,
    blockPresets,
    onTitleChange,
    onToggleAnchor,
    onAnchorChange,
    onOpenNote,
    onWordFormatChange,
    onWordsChange,
    onBlockStyleChange,
    onBlockDelete,
    onBlockAdd,
    onBlockAddBefore,
    focusBlockId,
    onFocusHandled,
    onBlockAddWithPreset,
    onBlockReorder,
    onFormatModeChange,
    onColorChange,
    onSizeChange,
    onClearFormatMode,
    onUndo,
    onRedo,
    getHistory,
    onClearHistory,
    onAddBlockPreset,
    onRemoveBlockPreset,
    onUpdateBlockPreset,
}: iNoteEditorProps) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState(note.title);
    const [showHistory, setShowHistory] = useState(false);
    const [showPresetMenu, setShowPresetMenu] = useState(false);
    const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
    const [editingPresetTitle, setEditingPresetTitle] = useState('');
    const [deletePresetIndex, setDeletePresetIndex] = useState<number | null>(null);
    const [showUnanchorModal, setShowUnanchorModal] = useState(false);
    const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
    const [previewOrder, setPreviewOrder] = useState<number[] | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    // The box of the text block that is dragged, its width is a share of the note and its margins are part of the layout
    const [draggedBlockRect, setDraggedBlockRect] = useState<{
        width: number;
        height: number;
        marginTop: number;
        marginBottom: number;
    } | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const presetMenuRef = useRef<HTMLDivElement>(null);
    const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dragGhostRef = useRef<HTMLDivElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const orderRef = useRef<number[]>([]);

    // The ghost follows the mouse without a render, a render per mouse move is what made the drag jerky
    const moveGhost = () => {
        if (dragGhostRef.current) {
            dragGhostRef.current.style.translate = `${mouseRef.current.x + 15}px ${mouseRef.current.y - 20}px`;
        }
    };
    useLayoutEffect(moveGhost, [isDragging]);

    // Mouse-based drag system for full control
    useEffect(() => {
        if (!isDragging || draggedBlockIndex === null) return;

        // The position of a block is worked out from the heights of the ones above it, the rects of the
        // blocks are shifted by the move animation and would flip the order back and forth
        const reorder = (y: number) => {
            const content = contentRef.current;
            if (!content) return;
            const order = orderRef.current;
            const from = order.indexOf(draggedBlockIndex);
            let top = content.getBoundingClientRect().top + parseFloat(getComputedStyle(content).paddingTop);
            let to = -1;
            for (let i = 0; i < order.length; i++) {
                const el = blockRefs.current.get(note.blocks[order[i]].id);
                if (!el) continue;
                const height = el.offsetHeight;
                const mid = top + height / 2;
                if (i !== from && y >= top && y < top + height) {
                    if ((i > from && y > mid) || (i < from && y < mid)) to = i;
                    break;
                }
                if (i === 0 && y < top) to = 0;
                if (i === order.length - 1 && y >= top + height) to = i;
                top += height;
            }
            if (to === -1 || to === from) return;
            order.splice(from, 1);
            order.splice(to, 0, draggedBlockIndex);
            setPreviewOrder([...order]);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
            moveGhost();
            reorder(e.clientY);
        };

        const handleMouseUp = () => {
            const finalIndex = orderRef.current.indexOf(draggedBlockIndex);
            if (finalIndex !== draggedBlockIndex) {
                onBlockReorder(draggedBlockIndex, finalIndex);
            }
            setDraggedBlockIndex(null);
            setPreviewOrder(null);
            setIsDragging(false);
            setDraggedBlockRect(null);
        };

        document.body.style.cursor = 'grabbing';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, draggedBlockIndex, note.blocks, onBlockReorder]);

    // Compute the visual order of blocks (with preview reordering)
    const getVisualBlocks = useCallback(() => {
        if (!previewOrder) return note.blocks;
        return previewOrder.map((i) => note.blocks[i]);
    }, [note.blocks, previewOrder]);

    // Handle drag start - now mouse-based
    const handleDragStart = useCallback(
        (e: React.MouseEvent, index: number) => {
            e.preventDefault();
            const blockId = note.blocks[index]?.id;
            const blockElement = blockId ? blockRefs.current.get(blockId) : null;

            const textBlock = blockElement?.querySelector('.text-block');
            if (textBlock) {
                const { width, height } = textBlock.getBoundingClientRect();
                const { marginTop, marginBottom } = getComputedStyle(textBlock);
                setDraggedBlockRect({ width, height, marginTop: parseFloat(marginTop), marginBottom: parseFloat(marginBottom) });
            }

            setDraggedBlockIndex(index);
            setIsDragging(true);
            mouseRef.current = { x: e.clientX, y: e.clientY };
            orderRef.current = note.blocks.map((_, i) => i);
            setPreviewOrder(orderRef.current);
        },
        [note.blocks],
    );

    // Close preset menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showPresetMenu && presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
                const addPresetBtn = (e.target as HTMLElement).closest('.note-editor__add-preset');
                if (!addPresetBtn) {
                    setShowPresetMenu(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPresetMenu]);

    const handleTitleSubmit = () => {
        // Clicking into the title and out again is no edit
        if ((titleValue || 'Untitled') !== note.title) {
            onTitleChange(titleValue || 'Untitled');
        }
        setIsEditingTitle(false);
    };

    // Taking the anchor off also takes it off every word that points here, so that is confirmed first
    const handleAnchorToggle = () => {
        if (!note.isAnchor) {
            onToggleAnchor(true);
        } else if (anchorUsage > 0) {
            setShowUnanchorModal(true);
        } else {
            onToggleAnchor(false);
        }
    };

    const breadcrumbs = folderChain(folders, note.folderId);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className={`note-editor ${showBlockBorders ? 'note-editor--block-borders' : ''}`}>
            {/* Floating toolbar - fixed at top, overlays content */}
            <div className='note-editor__toolbar-overlay'>
                <FloatingToolbar
                    formatMode={formatMode}
                    selectedColor={selectedColor}
                    palette={palette}
                    selectedSize={selectedSize}
                    anchorNotes={anchorNotes}
                    selectedAnchorId={selectedAnchorId}
                    onAnchorChange={onAnchorChange}
                    onFormatModeChange={onFormatModeChange}
                    onColorChange={onColorChange}
                    onSizeChange={onSizeChange}
                />
            </div>

            <div ref={editorRef} className='note-editor__body' style={{ maxWidth: `${editorWidth}%` }}>
                <div className='note-editor__header'>
                    {breadcrumbs.length > 0 && (
                        <div className='note-editor__breadcrumbs'>
                            {breadcrumbs.map((folder, index) => (
                                <span key={folder.id}>
                                    {index > 0 && <span className='note-editor__breadcrumb-separator'>/</span>}
                                    {folder.name}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className='note-editor__title-row'>
                        <button
                            className={`note-editor__anchor-btn ${
                                note.isAnchor ? 'note-editor__anchor-btn--active' : ''
                            }`}
                            onClick={handleAnchorToggle}
                            title={
                                note.isAnchor
                                    ? 'This note is an anchor. Click to stop it being one.'
                                    : 'Make this note an anchor, so words in other notes can open it'
                            }
                        >
                            <AnchorIcon />
                        </button>
                        {isEditingTitle ? (
                            <input
                                className='note-editor__title-input'
                                value={titleValue}
                                onChange={(e) => setTitleValue(e.target.value)}
                                onBlur={handleTitleSubmit}
                                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                                autoFocus
                            />
                        ) : (
                            <h1
                                className='note-editor__title'
                                onClick={() => {
                                    setTitleValue(note.title);
                                    setIsEditingTitle(true);
                                }}
                            >
                                {note.title}
                            </h1>
                        )}
                    </div>
                    <p className='note-editor__date'>Last edited: {formatDate(note.updatedAt)}</p>
                </div>

                <div className='note-editor__content' ref={contentRef}>
                    <Flipper
                        flipKey={getVisualBlocks().map((b) => b.id).join('-')}
                        spring={{ stiffness: 500, damping: 40 }}
                    >
                        {getVisualBlocks().map((block) => {
                            const originalIndex = note.blocks.findIndex((b) => b.id === block.id);
                            const isBeingDragged = originalIndex === draggedBlockIndex;

                            return (
                                <Flipped key={block.id} flipId={block.id} translate>
                                    <div
                                        ref={(el) => {
                                            if (el) blockRefs.current.set(block.id, el);
                                            else blockRefs.current.delete(block.id);
                                        }}
                                        className={`note-editor__block-wrapper ${
                                            isBeingDragged ? 'note-editor__block-wrapper--dragging' : ''
                                        }`}
                                    >
                                        {/* Drag handle - outside block-content so it stays visible */}
                                        {!isBeingDragged && (
                                            <div
                                                className='note-editor__drag-handle'
                                                onMouseDown={(e) => handleDragStart(e, originalIndex)}
                                                title='Drag to reorder'
                                            >
                                                <span className='note-editor__drag-icon'>⠿</span>
                                            </div>
                                        )}
                                        {/* Placeholder for dragged block */}
                                        {isBeingDragged && isDragging ? (
                                            <div
                                                className='note-editor__block-placeholder'
                                                style={
                                                    draggedBlockRect
                                                        ? {
                                                              width: draggedBlockRect.width,
                                                              height: draggedBlockRect.height,
                                                              marginTop: draggedBlockRect.marginTop,
                                                              marginBottom: draggedBlockRect.marginBottom,
                                                          }
                                                        : undefined
                                                }
                                            />
                                        ) : (
                                            <div className='note-editor__block-content'>
                                                <TextBlockComponent
                                                    block={block}
                                                    formatMode={formatMode}
                                                    selectedColor={selectedColor}
                                                    palette={palette}
                                                    selectedSize={selectedSize}
                                                    selectedAnchorId={selectedAnchorId}
                                                    onOpenAnchor={onOpenNote}
                                                    confirmDeletions={confirmDeletions}
                                                    onWordFormatChange={onWordFormatChange}
                                                    onWordsChange={onWordsChange}
                                                    onStyleChange={onBlockStyleChange}
                                                    onDelete={onBlockDelete}
                                                    onAddBlockAfter={onBlockAdd}
                                                    onAddBlockBefore={onBlockAddBefore}
                                                    autoFocus={block.id === focusBlockId}
                                                    onAutoFocused={onFocusHandled}
                                                    onClearFormatMode={onClearFormatMode}
                                                    onSaveAsPreset={onAddBlockPreset}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Flipped>
                            );
                        })}
                    </Flipper>

                    {/* Floating ghost block that follows the cursor - exact copy of dragged block */}
                    {isDragging && draggedBlockIndex !== null && (
                        <div
                            ref={dragGhostRef}
                            className='note-editor__drag-ghost'
                            style={{
                                width: draggedBlockRect ? draggedBlockRect.width : 300,
                            }}
                        >
                            <TextBlockComponent
                                block={note.blocks[draggedBlockIndex]}
                                formatMode={null}
                                selectedColor={selectedColor}
                                palette={palette}
                                selectedSize={selectedSize}
                                confirmDeletions={false}
                                onWordFormatChange={() => {}}
                                onWordsChange={() => {}}
                                onStyleChange={() => {}}
                                onDelete={() => {}}
                                onAddBlockAfter={() => {}}
                                onAddBlockBefore={() => {}}
                                onClearFormatMode={() => {}}
                                onSaveAsPreset={() => {}}
                            />
                        </div>
                    )}

                    <div className='note-editor__add-buttons'>
                        <button className='note-editor__add-block' onClick={() => onBlockAdd()}>
                            + Add block
                        </button>
                        <div className='note-editor__preset-container'>
                            <button
                                className='note-editor__add-preset'
                                onClick={() => setShowPresetMenu(!showPresetMenu)}
                            >
                                + Add preset
                            </button>
                            {showPresetMenu && (
                                <div className='note-editor__preset-menu' ref={presetMenuRef}>
                                    {blockPresets.length === 0 ? (
                                        <div className='note-editor__preset-empty'>No presets yet</div>
                                    ) : (
                                        blockPresets.map((preset, index) => (
                                            <div key={index} className='note-editor__preset-row'>
                                                {editingPresetIndex === index ? (
                                                    <input
                                                        className='note-editor__preset-edit-input'
                                                        value={editingPresetTitle}
                                                        onChange={(e) => setEditingPresetTitle(e.target.value)}
                                                        onBlur={() => {
                                                            onUpdateBlockPreset(index, {
                                                                ...preset,
                                                                title: editingPresetTitle,
                                                            });
                                                            setEditingPresetIndex(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                onUpdateBlockPreset(index, {
                                                                    ...preset,
                                                                    title: editingPresetTitle,
                                                                });
                                                                setEditingPresetIndex(null);
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <button
                                                        className='note-editor__preset-item'
                                                        onClick={() => {
                                                            onBlockAddWithPreset(preset);
                                                            setShowPresetMenu(false);
                                                        }}
                                                        style={{
                                                            background:
                                                                preset.backgroundGradient ||
                                                                preset.customGradient ||
                                                                preset.backgroundColor ||
                                                                preset.customColor ||
                                                                'transparent',
                                                            borderStyle: preset.borderStyle || 'solid',
                                                            borderColor: preset.borderColor || '#333',
                                                            borderRadius: `${preset.borderRadius || 0}px`,
                                                        }}
                                                    >
                                                        {preset.title || `Preset ${index + 1}`}
                                                    </button>
                                                )}
                                                <div className='note-editor__preset-actions'>
                                                    <button
                                                        className='note-editor__preset-edit'
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingPresetIndex(index);
                                                            setEditingPresetTitle(
                                                                preset.title || `Preset ${index + 1}`,
                                                            );
                                                        }}
                                                        title='Edit preset name'
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className='note-editor__preset-delete'
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirmDeletions) {
                                                                setDeletePresetIndex(index);
                                                            } else {
                                                                onRemoveBlockPreset(index);
                                                            }
                                                        }}
                                                        title='Delete preset'
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Remove Anchor Confirmation Modal */}
            <TeaModal
                isOpen={showUnanchorModal}
                title='Remove Anchor'
                onClose={() => setShowUnanchorModal(false)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setShowUnanchorModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                onToggleAnchor(false);
                                setShowUnanchorModal(false);
                            }}
                        >
                            Remove Anchor
                        </button>
                    </>
                }
            >
                <p>
                    {anchorUsage === 1 ? '1 anchored word' : `${anchorUsage} anchored words`} in your notes point to "
                    {note.title}". They will be unanchored, also in the database, once you save.
                </p>
            </TeaModal>

            {/* Delete Preset Confirmation Modal */}
            <TeaModal
                isOpen={deletePresetIndex !== null}
                title='Delete Preset'
                onClose={() => setDeletePresetIndex(null)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setDeletePresetIndex(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                if (deletePresetIndex !== null) {
                                    onRemoveBlockPreset(deletePresetIndex);
                                    setDeletePresetIndex(null);
                                }
                            }}
                        >
                            Delete
                        </button>
                    </>
                }
            >
                <p>Are you sure you want to delete "{blockPresets[deletePresetIndex ?? 0]?.title || 'this preset'}"?</p>
            </TeaModal>

            {/* History indicator - fixed at bottom, overlays content */}
            <div className='note-editor__history-overlay'>
                <div className='note-editor__history-indicator'>
                    <button
                        className={`note-editor__undo-btn ${!canUndo ? 'note-editor__undo-btn--disabled' : ''}`}
                        onClick={onUndo}
                        disabled={!canUndo}
                        title='Undo (Ctrl+Z)'
                    >
                        ↩
                    </button>

                    <button
                        className={`note-editor__history-btn ${
                            historyCount === 0 ? 'note-editor__history-btn--disabled' : ''
                        }`}
                        onClick={() => historyCount > 0 && setShowHistory(!showHistory)}
                        disabled={historyCount === 0}
                        title={`${historyCount} change${historyCount !== 1 ? 's' : ''} - Click to view history`}
                    >
                        <span className='note-editor__history-count'>{historyCount}</span>
                        <span className='note-editor__history-label'>changes</span>
                    </button>

                    <button
                        className={`note-editor__redo-btn ${!canRedo ? 'note-editor__redo-btn--disabled' : ''}`}
                        onClick={onRedo}
                        disabled={!canRedo}
                        title='Redo (Ctrl+Shift+Z)'
                    >
                        ↪
                    </button>

                    {showHistory && historyCount > 0 && (
                        <div className='note-editor__history-dropdown'>
                            <div className='note-editor__history-header'>
                                <span>History ({historyCount})</span>
                                <div className='note-editor__history-actions'>
                                    <button
                                        className='note-editor__history-clear'
                                        title='Delete the history of this note, on the server with the next save'
                                        onClick={() => {
                                            onClearHistory();
                                            setShowHistory(false);
                                        }}
                                    >
                                        Clear
                                    </button>
                                    <button onClick={() => setShowHistory(false)}>×</button>
                                </div>
                            </div>
                            <div className='note-editor__history-list'>
                                {getHistory()
                                    .slice()
                                    .reverse()
                                    .map((entry) => (
                                        <div key={entry.timestamp} className='note-editor__history-item'>
                                            <span className='note-editor__history-item-desc'>{entry.description}</span>
                                            <span className='note-editor__history-item-time'>
                                                {new Date(entry.timestamp).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
