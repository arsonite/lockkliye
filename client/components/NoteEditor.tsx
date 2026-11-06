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
import {
    BookmarkIcon,
    ChecklistIcon,
    CodeIcon,
    DragHandleIcon,
    NoteIcon,
    PencilIcon,
    RedoIcon,
    TableIcon,
    UndoIcon,
    XIcon,
} from '@teatype/icons';
import { TeaModal } from '@teatype/components';

// Components
import FloatingToolbar from './FloatingToolbar';
import { PopoverMenu } from './PopoverMenu';
import { TextBlockComponent } from './TextBlockComponent';

// Types
import type { iFolder, iNote, iTextBlock, iWord, tFormatMode, iHistoryEntry, iBlockStyle, iPalette, iListOptions, tBlockData, tBlockKind } from '@/types';

// Utils
import useIsMobile from '@/hooks/useIsMobile';
import useKeyboardTop from '@/hooks/useKeyboardTop';
import { folderChain } from '@/tools/folderTree';
import { shortcutText } from '@/tools/shortcuts';

// What can be added to a note besides the text of the blocks, in the order of the menus
const COMPONENTS: [tBlockKind, string, React.ReactNode][] = [
    ['text', 'Text block', <NoteIcon key='text' />],
    ['checklist', 'Checklist', <ChecklistIcon key='checklist' />],
    ['table', 'Table', <TableIcon key='table' />],
    ['code', 'Code block', <CodeIcon key='code' />],
];

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
    showStyleButton: boolean;
    use24HourTime: boolean;
    blockPresets: iBlockStyle[];
    listOptions: iListOptions;
    focusBlockId?: string | null; // A block that was just added, its editor takes the focus

    onTitleChange: (title: string) => void;
    onToggleAnchor: (isAnchor: boolean) => void;
    onAnchorChange: (noteId: string) => void;
    onOpenNote: (noteId: string) => void;
    onWordFormatChange: (blockId: string, wordId: string, format: Partial<iWord['format']>) => void;
    onWordsChange: (blockId: string, words: iWord[]) => void;
    onBlockDataChange: (blockId: string, data: tBlockData) => void;
    onBlockInsert: (kind: tBlockKind, index?: number) => void;
    onMoveSelection: (
        blockId: string,
        remaining: iWord[],
        selected: iWord[],
        position: 'above' | 'below',
        focusNew: boolean,
    ) => void;
    onBlockStyleChange: (blockId: string, style: Partial<iTextBlock['style']>) => void;
    onBlockDelete: (blockId: string) => void;
    onBlockAdd: (afterBlockId?: string) => void;
    onBlockAddBefore: (beforeBlockId: string) => void;
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
    showStyleButton,
    use24HourTime,
    blockPresets,
    listOptions,
    onTitleChange,
    onToggleAnchor,
    onAnchorChange,
    onOpenNote,
    onWordFormatChange,
    onWordsChange,
    onBlockDataChange,
    onBlockInsert,
    onMoveSelection,
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
    const mobile = useIsMobile();
    const keyboardTop = useKeyboardTop(mobile);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState(note.title);
    const [showHistory, setShowHistory] = useState(false);
    const [showPresetMenu, setShowPresetMenu] = useState(false);
    const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
    const [editingPresetTitle, setEditingPresetTitle] = useState('');
    const [deletePresetIndex, setDeletePresetIndex] = useState<number | null>(null);
    const [showUnanchorModal, setShowUnanchorModal] = useState(false);
    // A right-click on the empty space of the note opens the list of components, they go in after block `index`
    const [insertMenu, setInsertMenu] = useState<{ x: number; y: number; index: number } | null>(null);
    const [showComponentMenu, setShowComponentMenu] = useState(false);
    const componentMenuRef = useRef<HTMLDivElement>(null);
    const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
    const [previewOrder, setPreviewOrder] = useState<number[] | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    // The block that was touched last keeps its buttons on a touch screen, which has no hover to show them
    const [touchedBlockId, setTouchedBlockId] = useState<string | null>(null);
    const pointerType = useRef('mouse');
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

        const handleMouseMove = (e: PointerEvent) => {
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
        document.addEventListener('pointermove', handleMouseMove);
        document.addEventListener('pointerup', handleMouseUp);
        document.addEventListener('pointercancel', handleMouseUp);

        return () => {
            document.body.style.cursor = '';
            document.removeEventListener('pointermove', handleMouseMove);
            document.removeEventListener('pointerup', handleMouseUp);
            document.removeEventListener('pointercancel', handleMouseUp);
        };
    }, [isDragging, draggedBlockIndex, note.blocks, onBlockReorder]);

    // Compute the visual order of blocks (with preview reordering)
    const getVisualBlocks = useCallback(() => {
        if (!previewOrder) return note.blocks;
        return previewOrder.map((i) => note.blocks[i]);
    }, [note.blocks, previewOrder]);

    // The buttons at the left of a block (the drag handle is the last of them) follow the mouse, as far as the block is
    // high. A block that is lower than they are keeps them in its middle. They stay where they are while the mouse is on
    // them or on the style menu, or the rest of their buttons would run away from the mouse.
    const followMouse = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDragging || (e.target as HTMLElement).closest('.text-block__controls, .text-block__style-menu')) return;
        const block = e.currentTarget.querySelector<HTMLElement>('.text-block');
        const controls = block?.querySelector<HTMLElement>('.text-block__controls');
        if (!block || !controls) return;
        const y = e.clientY - block.getBoundingClientRect().top;
        const size = controls.offsetHeight;
        const center =
            block.offsetHeight <= size
                ? block.offsetHeight / 2
                : Math.min(Math.max(y, size / 2), block.offsetHeight - size / 2);
        block.style.setProperty('--follow-y', `${center}px`);
    };

    // Handle drag start, by mouse, finger or pen
    const handleDragStart = useCallback(
        (e: React.PointerEvent, index: number) => {
            e.preventDefault();
            const blockId = note.blocks[index]?.id;
            const blockElement = blockId ? blockRefs.current.get(blockId) : null;

            const textBlock = blockElement?.querySelector('.text-block');
            if (textBlock) {
                const { width, height } = textBlock.getBoundingClientRect();
                const { marginTop, marginBottom } = getComputedStyle(textBlock);
                setDraggedBlockRect({
                    width,
                    height,
                    marginTop: parseFloat(marginTop),
                    marginBottom: parseFloat(marginBottom),
                });
            }

            setDraggedBlockIndex(index);
            setIsDragging(true);
            mouseRef.current = { x: e.clientX, y: e.clientY };
            orderRef.current = note.blocks.map((_, i) => i);
            setPreviewOrder(orderRef.current);
        },
        [note.blocks],
    );

    // Close the component menu on outside click
    useEffect(() => {
        if (!showComponentMenu) return;
        const close = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!componentMenuRef.current?.contains(target) && !target.closest('.note-editor__add-component')) {
                setShowComponentMenu(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [showComponentMenu]);

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
            hourCycle: use24HourTime ? 'h23' : 'h12',
        });
    };

    // The blocks, the header and the buttons have their own right-click, the empty space (also between the blocks) opens
    // the list of components
    const handleEmptySpaceMenu = (event: React.MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('.text-block, .note-editor__header, .note-editor__add-buttons, .note-editor__toolbar-overlay, .note-editor__history-overlay')) {
            return;
        }
        event.preventDefault();
        // After the last block that starts above the click
        let index = 0;
        note.blocks.forEach((block, position) => {
            const rect = blockRefs.current.get(block.id)?.getBoundingClientRect();
            if (rect && rect.top + rect.height / 2 < event.clientY) index = position + 1;
        });
        setInsertMenu({ x: event.clientX, y: event.clientY, index });
    };

    return (
        <div
            className={`note-editor ${showBlockBorders ? 'note-editor--block-borders' : ''}`}
            onContextMenu={handleEmptySpaceMenu}
        >
            {/* Floating toolbar - fixed at top, overlays content */}
            <div
                className={`note-editor__toolbar-overlay ${keyboardTop !== null ? 'note-editor__toolbar-overlay--keyboard' : ''}`}
                style={keyboardTop !== null ? ({ '--keyboard-top': `${keyboardTop}px` } as React.CSSProperties) : undefined}
            >
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

            <div ref={editorRef} className='note-editor__body' style={{ maxWidth: mobile ? '100%' : `${editorWidth}%` }}>
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
                            <BookmarkIcon />
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
                        flipKey={getVisualBlocks()
                            .map((b) => b.id)
                            .join('-')}
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
                                        } ${block.id === touchedBlockId ? 'note-editor__block-wrapper--touched' : ''}`}
                                        onMouseMove={followMouse}
                                        onPointerDownCapture={(e) => {
                                            pointerType.current = e.pointerType;
                                            if (e.pointerType === 'mouse') setTouchedBlockId(null);
                                        }}
                                        // On click, not on pointer down: a touch screen must not see the buttons appear before the tap went through
                                        onClickCapture={() => pointerType.current !== 'mouse' && setTouchedBlockId(block.id)}
                                    >
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
                                                    showStyleButton={showStyleButton}
                                                    selectedSize={selectedSize}
                                                    selectedAnchorId={selectedAnchorId}
                                                    onOpenAnchor={onOpenNote}
                                                    confirmDeletions={confirmDeletions}
                                                    onWordFormatChange={onWordFormatChange}
                                                    onWordsChange={onWordsChange}
                                                    onDataChange={onBlockDataChange}
                                                    onMoveSelection={onMoveSelection}
                                                    listOptions={listOptions}
                                                    onStyleChange={onBlockStyleChange}
                                                    onDelete={onBlockDelete}
                                                    onAddBlockAfter={onBlockAdd}
                                                    onAddBlockBefore={onBlockAddBefore}
                                                    autoFocus={block.id === focusBlockId}
                                                    onAutoFocused={onFocusHandled}
                                                    onClearFormatMode={onClearFormatMode}
                                                    onSaveAsPreset={onAddBlockPreset}
                                                    handle={
                                                        <div
                                                            className='note-editor__drag-handle'
                                                            onPointerDown={(e) => handleDragStart(e, originalIndex)}
                                                            title='Drag to reorder'
                                                        >
                                                            <span className='note-editor__drag-icon'>
                                                                <DragHandleIcon />
                                                            </span>
                                                        </div>
                                                    }
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
                                className='note-editor__add-component'
                                onClick={() => setShowComponentMenu(!showComponentMenu)}
                            >
                                + Add component
                            </button>
                            {showComponentMenu && (
                                <div className='note-editor__preset-menu note-editor__component-menu' ref={componentMenuRef}>
                                    {COMPONENTS.filter(([kind]) => kind !== 'text').map(([kind, label, icon]) => (
                                        <button
                                            key={kind}
                                            className='popover-menu__item'
                                            onClick={() => {
                                                onBlockInsert(kind);
                                                setShowComponentMenu(false);
                                            }}
                                        >
                                            {icon}
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
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
                                                        <PencilIcon />
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
                                                        <XIcon width='1em' height='1em' />
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

            {/* The components, where the empty space was clicked */}
            {insertMenu && (
                <PopoverMenu x={insertMenu.x} y={insertMenu.y} onClose={() => setInsertMenu(null)}>
                    {COMPONENTS.map(([kind, label, icon]) => (
                        <button
                            key={kind}
                            className='popover-menu__item'
                            onClick={() => {
                                onBlockInsert(kind, insertMenu.index);
                                setInsertMenu(null);
                            }}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </PopoverMenu>
            )}

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

            {/* History indicator - fixed at bottom, overlays content, visible while the mouse is over it */}
            <div className='note-editor__history-overlay'>
                <div className='note-editor__history-indicator'>
                    <button
                        className={`note-editor__undo-btn ${!canUndo ? 'note-editor__undo-btn--disabled' : ''}`}
                        onClick={onUndo}
                        disabled={!canUndo}
                        title={`Undo (${shortcutText('undo')})`}
                    >
                        <UndoIcon />
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
                        title={`Redo (${shortcutText('redo')})`}
                    >
                        <RedoIcon />
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
                                    <button onClick={() => setShowHistory(false)}>
                                        <XIcon width='1em' height='1em' />
                                    </button>
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
                                                    hourCycle: use24HourTime ? 'h23' : 'h12',
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
