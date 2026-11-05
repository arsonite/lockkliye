/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// A menu that opens at the mouse, like the block customizer. It closes on a click elsewhere and on Escape.
// It lives in the body, so the blocks (which move and blur) do not clip it.
// React imports
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface iPopoverMenuProps {
    x: number;
    y: number;
    children: ReactNode;

    onClose: () => void;
}

export const PopoverMenu = ({ x, y, children, onClose }: iPopoverMenuProps) => {
    const menu = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: x, top: y });

    // Keeps it inside the window
    useLayoutEffect(() => {
        const rect = menu.current?.getBoundingClientRect();
        if (rect) {
            setPosition({
                left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
                top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
            });
        }
    }, [x, y]);

    useEffect(() => {
        const onMouseDown = (event: MouseEvent) => {
            if (!menu.current?.contains(event.target as Node)) onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onClose);
        window.addEventListener('blur', onClose);
        document.addEventListener('scroll', onClose, true);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('blur', onClose);
            document.removeEventListener('scroll', onClose, true);
        };
    }, [onClose]);

    return createPortal(
        <div
            ref={menu}
            className='popover-menu'
            style={position}
            // Pressing a button must not take the selection or the focus away from the text
            onMouseDown={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
        >
            {children}
        </div>,
        document.body,
    );
};
