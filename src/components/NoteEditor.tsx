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
import { useState, useRef, useEffect, useCallback } from 'react';

// External
import { Flipper, Flipped } from 'react-flip-toolkit';

// TeaType components
import { TeaModal } from '@teatype/components';

// Components
import FloatingToolbar from './FloatingToolbar';
import { TextBlockComponent } from './TextBlockComponent';

// Types
import type { iNote, iTextBlock, iWord, tFormatMode, iHistoryEntry, iBlockStyle } from '@/types';

interface iNoteEditorProps {
    note: iNote;
    formatMode: tFormatMode;
    selectedColor: string;
    selectedSize: string;
    editorWidth: number;
    historyCount: number;
    redoCount: number;
    canUndo: boolean;
    canRedo: boolean;
    confirmDeletions: boolean;
    blockPresets: iBlockStyle[];
    onTitleChange: (title: string) => void;
    onWordFormatChange: (blockId: string, wordId: string, format: Partial<iWord['format']>) => void;
    onWordsChange: (blockId: string, words: iWord[]) => void;
    onBlockStyleChange: (blockId: string, style: Partial<iTextBlock['style']>) => void;
    onBlockDelete: (blockId: string) => void;
    onBlockAdd: (afterBlockId?: string) => void;
    onBlockAddWithPreset: (preset: iBlockStyle, afterBlockId?: string) => void;
    onBlockReorder: (fromIndex: number, toIndex: number) => void;
    onFormatModeChange: (mode: tFormatMode) => void;
    onColorChange: (color: string) => void;
    onSizeChange: (size: string) => void;
    onClearFormatMode: () => void;
    onUndo: () => void;
    onRedo: () => void;
    getHistory: () => iHistoryEntry[];
    onAddBlockPreset: (preset: iBlockStyle) => void;
    onRemoveBlockPreset: (index: number) => void;
    onUpdateBlockPreset: (index: number, preset: iBlockStyle) => void;
}

export const NoteEditor = ({
    note,
    formatMode,
    selectedColor,
    selectedSize,
    editorWidth,
    historyCount,
    redoCount: _redoCount,
    canUndo,
    canRedo,
    confirmDeletions,
    blockPresets,
    onTitleChange,
    onWordFormatChange,
    onWordsChange,
    onBlockStyleChange,
    onBlockDelete,
    onBlockAdd,
    onBlockAddWithPreset,
    onBlockReorder,
    onFormatModeChange,
    onColorChange,
    onSizeChange,
    onClearFormatMode,
    onUndo,
    onRedo,
    getHistory,
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
    const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
    const [previewOrder, setPreviewOrder] = useState<number[] | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [draggedBlockRect, setDraggedBlockRect] = useState<DOMRect | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const presetMenuRef = useRef<HTMLDivElement>(null);
    const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dragGhostRef = useRef<HTMLDivElement>(null);

    // Mouse-based drag system for full control
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });

            // Find which block we're over based on mouse Y position
            if (draggedBlockIndex === null || !previewOrder) return;

            const blockEntries = Array.from(blockRefs.current.entries());
            for (let i = 0; i < blockEntries.length; i++) {
                const [blockId, el] = blockEntries[i];
                const rect = el.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;

                // Find the visual index of this block
                const block = note.blocks.find((b) => b.id === blockId);
                if (!block) continue;
                const originalIdx = note.blocks.indexOf(block);
                const visualIdx = previewOrder.indexOf(originalIdx);

                // If mouse is above the midpoint of this block, move dragged block here
                if (e.clientY < midY && visualIdx !== -1) {
                    const currentDraggedVisualIndex = previewOrder.indexOf(draggedBlockIndex);
                    if (currentDraggedVisualIndex !== visualIdx && currentDraggedVisualIndex !== -1) {
                        const newOrder = [...previewOrder];
                        newOrder.splice(currentDraggedVisualIndex, 1);
                        newOrder.splice(visualIdx, 0, draggedBlockIndex);
                        setPreviewOrder(newOrder);
                    }
                    break;
                }
                // If this is the last block and mouse is below it
                if (i === blockEntries.length - 1 && e.clientY >= midY) {
                    const currentDraggedVisualIndex = previewOrder.indexOf(draggedBlockIndex);
                    const targetIdx = previewOrder.length - 1;
                    if (currentDraggedVisualIndex !== targetIdx && currentDraggedVisualIndex !== -1) {
                        const newOrder = [...previewOrder];
                        newOrder.splice(currentDraggedVisualIndex, 1);
                        newOrder.push(draggedBlockIndex);
                        setPreviewOrder(newOrder);
                    }
                }
            }
        };

        const handleMouseUp = () => {
            if (draggedBlockIndex !== null && previewOrder) {
                const finalIndex = previewOrder.indexOf(draggedBlockIndex);
                if (finalIndex !== draggedBlockIndex) {
                    onBlockReorder(draggedBlockIndex, finalIndex);
                }
            }
            setDraggedBlockIndex(null);
            setPreviewOrder(null);
            setIsDragging(false);
            setDraggedBlockRect(null);
            document.body.style.cursor = '';
        };

        document.body.style.cursor = 'grabbing';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, draggedBlockIndex, previewOrder, note.blocks, onBlockReorder]);

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

            if (blockElement) {
                setDraggedBlockRect(blockElement.getBoundingClientRect());
            }

            setDraggedBlockIndex(index);
            setIsDragging(true);
            setMousePosition({ x: e.clientX, y: e.clientY });
            setPreviewOrder(note.blocks.map((_, i) => i));
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
        onTitleChange(titleValue || 'Untitled');
        setIsEditingTitle(false);
    };

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
        <div className='note-editor'>
            {/* Floating toolbar - fixed at top, overlays content */}
            <div className='note-editor__toolbar-overlay'>
                <FloatingToolbar
                    formatMode={formatMode}
                    selectedColor={selectedColor}
                    selectedSize={selectedSize}
                    onFormatModeChange={onFormatModeChange}
                    onColorChange={onColorChange}
                    onSizeChange={onSizeChange}
                />
            </div>

            <div ref={editorRef} className='note-editor__body' style={{ maxWidth: `${editorWidth}%` }}>
                <div className='note-editor__header'>
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
                    <p className='note-editor__date'>Last edited: {formatDate(note.updatedAt)}</p>
                </div>

                <div className='note-editor__content'>
                    <Flipper
                        flipKey={previewOrder ? previewOrder.join('-') : note.blocks.map((b) => b.id).join('-')}
                        spring={{ stiffness: 500, damping: 40 }}
                    >
                        {getVisualBlocks().map((block) => {
                            const originalIndex = note.blocks.findIndex((b) => b.id === block.id);
                            const isBeingDragged = originalIndex === draggedBlockIndex;

                            return (
                                <Flipped key={block.id} flipId={block.id}>
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
                                                style={{
                                                    height: draggedBlockRect ? draggedBlockRect.height : 'auto',
                                                    minHeight: '80px',
                                                }}
                                            />
                                        ) : (
                                            <div className='note-editor__block-content'>
                                                <TextBlockComponent
                                                    block={block}
                                                    formatMode={formatMode}
                                                    selectedColor={selectedColor}
                                                    selectedSize={selectedSize}
                                                    confirmDeletions={confirmDeletions}
                                                    onWordFormatChange={onWordFormatChange}
                                                    onWordsChange={onWordsChange}
                                                    onStyleChange={onBlockStyleChange}
                                                    onDelete={onBlockDelete}
                                                    onAddBlockAfter={onBlockAdd}
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
                                left: mousePosition.x + 15,
                                top: mousePosition.y - 20,
                                width: draggedBlockRect ? draggedBlockRect.width : 300,
                            }}
                        >
                            <TextBlockComponent
                                block={note.blocks[draggedBlockIndex]}
                                formatMode={null}
                                selectedColor={selectedColor}
                                selectedSize={selectedSize}
                                confirmDeletions={false}
                                onWordFormatChange={() => {}}
                                onWordsChange={() => {}}
                                onStyleChange={() => {}}
                                onDelete={() => {}}
                                onAddBlockAfter={() => {}}
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
                                <button onClick={() => setShowHistory(false)}>×</button>
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
