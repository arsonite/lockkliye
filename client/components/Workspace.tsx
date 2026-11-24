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
    receiving: boolean; // A block from the note is dragged over the workspace
    renderBlock: (block: iTextBlock, handle: React.ReactNode) => React.ReactNode;
    onAdd: () => void;
    onPull: (blockId: string) => void; // Back into the note, at its end
    onDragOut: (blockId: string, x: number, y: number) => void; // Dropped outside of the workspace
    onClose: () => void;
}

// Beside the note: comments, drafts and unfinished text that are not part of the note (yet)
const Workspace: React.FC<iWorkspaceProps> = ({ blocks, receiving, renderBlock, onAdd, onPull, onDragOut, onClose }) => {
    const [drag, setDrag] = useState<string | null>(null);
    const ghostRef = useRef<HTMLDivElement>(null);
    const lastTap = useRef<{ id: string; time: number } | null>(null);
    const rootRef = useRef<HTMLElement>(null);
    const origin = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!drag) return;
        const start = origin.current;
        let moved = false;

        const move = (e: PointerEvent) => {
            if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_DISTANCE) moved = true;
            if (ghostRef.current) {
                ghostRef.current.style.display = moved ? 'block' : 'none';
                ghostRef.current.style.translate = `${e.clientX + 14}px ${e.clientY - 18}px`;
            }
        };
        const up = (e: PointerEvent) => {
            setDrag(null);
            if (moved && !rootRef.current?.contains(document.elementFromPoint(e.clientX, e.clientY))) {
                onDragOut(drag, e.clientX, e.clientY);
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
    }, [drag, onDragOut]);

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
        setDrag(blockId);
    };

    const dragged = blocks.find((block) => block.id === drag);
    const preview = dragged?.words.map((word) => word.text).join(' ').trim() || dragged?.kind || 'Empty block';

    return (
        <aside ref={rootRef} className={`workspace ${receiving ? 'workspace--receiving' : ''}`} aria-label='Workspace'>
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
                {blocks.map((block) => (
                    <div key={block.id} className={`workspace__item ${block.id === drag ? 'workspace__item--dragged' : ''}`}>
                        {renderBlock(
                            block,
                            <div
                                className='note-editor__drag-handle'
                                onPointerDown={(e) => press(e, block.id)}
                                title='Drag into the note, tap twice to move it to the end of the note'
                            >
                                <span className='note-editor__drag-icon'>
                                    <DragHandleIcon />
                                </span>
                            </div>,
                        )}
                    </div>
                ))}
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
