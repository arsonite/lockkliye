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
import { useEffect, useRef, useState } from 'react';

// TeaType icons
import { DragHandleIcon, PlusIcon, XIcon } from '@teatype/icons';

// Types
import type { iTextBlock } from '@/types';

const DOUBLE_TAP_MS = 350;
const DRAG_DISTANCE = 6;

interface iWorkspaceProps {
    blocks: iTextBlock[];
    dropIndex: number | null; // A block from the note is dragged over the workspace, this is where it would land
    dropHeight?: number;
    renderBlock: (block: iTextBlock, handle: React.ReactNode) => React.ReactNode;
    onAdd: () => void;
    onPull: (blockId: string) => void; // Back into the note, at its end
    onReorder: (blockId: string, toIndex: number) => void;
    onDragOver: (blockId: string, y: number, height: number) => void; // Held over the note
    onDragLeave: () => void;
    onDragOut: (blockId: string, x: number, y: number) => void; // Dropped outside of the workspace
    onClose: () => void;
}

// Beside the note: comments, drafts and unfinished text that are not part of the note (yet)
const Workspace: React.FC<iWorkspaceProps> = ({
    blocks,
    dropIndex,
    dropHeight,
    renderBlock,
    onAdd,
    onPull,
    onReorder,
    onDragOver,
    onDragLeave,
    onDragOut,
    onClose,
}) => {
    const [drag, setDrag] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);
    // The order of the blocks while one is dragged inside the workspace
    const [order, setOrder] = useState<string[] | null>(null);
    const itemRefs = useRef(new Map<string, HTMLDivElement>());
    const dragHeight = useRef(0);
    // The drag listeners must outlive the renders the parent does while the block is held over the note
    const latest = useRef({ blocks, onReorder, onDragOver, onDragLeave, onDragOut });
    latest.current = { blocks, onReorder, onDragOver, onDragLeave, onDragOut };
    const ghostRef = useRef<HTMLDivElement>(null);
    const lastTap = useRef<{ id: string; time: number } | null>(null);
    const rootRef = useRef<HTMLElement>(null);
    const origin = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!drag) return;
        const start = origin.current;
        let moved = false;
        let current: string[] | null = null;
        const isInside = (e: PointerEvent) => !!rootRef.current?.contains(document.elementFromPoint(e.clientX, e.clientY));

        // The block goes after the other blocks that start above the pointer
        const reorder = (y: number) => {
            const others = latest.current.blocks.filter((block) => block.id !== drag).map((block) => block.id);
            let at = 0;
            others.forEach((id, position) => {
                const rect = itemRefs.current.get(id)?.getBoundingClientRect();
                if (rect && rect.top + rect.height / 2 < y) at = position + 1;
            });
            others.splice(at, 0, drag);
            if (current?.join() !== others.join()) {
                current = others;
                setOrder(others);
            }
        };

        const move = (e: PointerEvent) => {
            if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_DISTANCE) {
                moved = true;
                setMoving(true);
            }
            if (ghostRef.current) {
                ghostRef.current.style.display = moved ? 'block' : 'none';
                ghostRef.current.style.translate = `${e.clientX + 14}px ${e.clientY - 18}px`;
            }
            if (!moved) return;
            if (isInside(e)) {
                latest.current.onDragLeave();
                reorder(e.clientY);
            } else {
                current = null;
                setOrder(null);
                latest.current.onDragOver(drag, e.clientY, dragHeight.current);
            }
        };
        const up = (e: PointerEvent) => {
            setDrag(null);
            setMoving(false);
            setOrder(null);
            if (!moved) return;
            if (!isInside(e)) {
                latest.current.onDragOut(drag, e.clientX, e.clientY);
            } else {
                latest.current.onDragLeave();
                const to = current?.indexOf(drag) ?? -1;
                if (to >= 0 && to !== latest.current.blocks.findIndex((block) => block.id === drag)) latest.current.onReorder(drag, to);
            }
        };
        const blockTouch = (e: TouchEvent) => e.preventDefault();
        document.body.style.cursor = 'grabbing';
        document.addEventListener('touchmove', blockTouch, { passive: false });
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
        return () => {
            document.body.style.cursor = '';
            document.removeEventListener('touchmove', blockTouch);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
        };
    }, [drag]);

    // A second tap on the handle sends the block back into the note, a drag from it drops it where it is let go
    const press = (e: React.PointerEvent, blockId: string) => {
        e.preventDefault();
        const now = Date.now();
        if (lastTap.current?.id === blockId && now - lastTap.current.time < DOUBLE_TAP_MS) {
            lastTap.current = null;
            onPull(blockId);
            return;
        }
        lastTap.current = { id: blockId, time: now };
        origin.current = { x: e.clientX, y: e.clientY };
        dragHeight.current = itemRefs.current.get(blockId)?.offsetHeight ?? 0;
        setDrag(blockId);
    };

    const shown = order ? order.map((id) => blocks.find((block) => block.id === id)).filter((b): b is iTextBlock => !!b) : blocks;
    const dragged = blocks.find((block) => block.id === drag);
    const preview = dragged?.words.map((word) => word.text).join(' ').trim() || dragged?.kind || 'Empty block';

    const dropPlaceholder = <div key='drop' className='workspace__placeholder' style={{ height: dropHeight ?? 64 }} />;

    return (
        <aside ref={rootRef} className={`workspace ${dropIndex !== null ? 'workspace--receiving' : ''}`} aria-label='Workspace'>
            <div className='workspace__header'>
                <h2 className='workspace__title'>Workspace</h2>
                <button className='workspace__btn' onClick={onAdd} title='New block in the workspace'>
                    <PlusIcon />
                </button>
                <button className='workspace__btn' onClick={onClose} title='Close the workspace'>
                    <XIcon />
                </button>
            </div>
            <div className='workspace__list'>
                {blocks.length === 0 && (
                    <p className='workspace__empty'>
                        Comments, drafts and unfinished text that are not part of the note. Drag a block here or into the
                        note, or tap its handle twice to send it across.
                    </p>
                )}
                {blocks.length === 0 && dropIndex !== null && dropPlaceholder}
                {shown.flatMap((block, position) => [
                    dropIndex === position ? dropPlaceholder : null,
                    <div
                        key={block.id}
                        ref={(el) => {
                            if (el) itemRefs.current.set(block.id, el);
                            else itemRefs.current.delete(block.id);
                        }}
                        className={`workspace__item ${block.id === drag && moving ? 'workspace__item--dragged' : ''}`}
                    >
                        {block.id === drag && moving ? (
                            <div className='workspace__placeholder' style={{ height: dragHeight.current }} />
                        ) : (
                            renderBlock(
                                block,
                                <div
                                    className='note-editor__drag-handle'
                                    onPointerDown={(e) => press(e, block.id)}
                                    title='Drag to move it, tap twice to move it to the end of the note'
                                >
                                    <span className='note-editor__drag-icon'>
                                        <DragHandleIcon />
                                    </span>
                                </div>,
                            )
                        )}
                    </div>,
                ])}
                {dropIndex !== null && dropIndex >= shown.length && blocks.length > 0 && dropPlaceholder}
            </div>
            {drag && (
                <div ref={ghostRef} className='workspace__ghost' style={{ display: 'none' }}>
                    {preview}
                </div>
            )}
        </aside>
    );
};

export default Workspace;
