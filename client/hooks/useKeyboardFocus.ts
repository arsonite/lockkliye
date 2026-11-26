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
import { useEffect } from 'react';

// Local imports
import { watchKeyboard } from '@/hooks/keyboard';

// Space the toolbar takes above the keyboard while a note is edited
const TOOLBAR_FALLBACK = 100;
// How long nothing may move before the text that is edited is brought into view
const SETTLE = 160;

const isEditable = (el: Element | null): el is HTMLElement =>
    !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);

const scrollParent = (el: HTMLElement): HTMLElement | null => {
    for (let node = el.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
};

// The rectangle of the caret, an empty line has none of its own
const caretRect = (field: HTMLElement): DOMRect => {
    const selection = window.getSelection();
    if (field.isContentEditable && selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
        if (rect.height > 0) return rect;
        const node = range.startContainer;
        const parent = node instanceof HTMLElement ? node : node.parentElement;
        if (parent) return parent.getBoundingClientRect();
    }
    return field.getBoundingClientRect();
};

// Safari on iOS does not bring the word that is edited above the keyboard, and the keyboard hides the field of a
// password. This scrolls what is edited into the part of the screen that is left. It is centred when the keyboard
// comes up, after that it only moves as far as needed, and only once the tap, the scroll of Safari itself and the
// switch between two texts have settled, so tapping from one text to another does not jump up and down.
// It tells the layout how much the keyboard covers (--keyboard-inset) for what is centred on the screen.
const useKeyboardFocus = (enabled: boolean): void => {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!enabled || !viewport) return;
        let settle = 0;
        let timer = 0;
        let open = false;
        let touching = false;
        let lastMove = 0;

        const reveal = (center: boolean) => {
            const field = document.activeElement;
            if (!open || !isEditable(field)) return;
            const scroller = scrollParent(field);
            if (!scroller) return;
            const rect = caretRect(field);
            const bounds = scroller.getBoundingClientRect();
            const inNote = !!field.closest('.note-editor__body');
            const bar = inNote
                ? (document.querySelector<HTMLElement>('.note-editor__toolbar-overlay--keyboard')?.offsetHeight ??
                  TOOLBAR_FALLBACK)
                : 0;
            const top = Math.max(bounds.top, viewport.offsetTop) + (inNote ? 72 : 8);
            const bottom = Math.min(bounds.bottom, viewport.offsetTop + viewport.height) - bar - 16;
            if (!center && rect.top >= top && rect.bottom <= bottom) return;
            // Up to the nearest edge of the free part, or to its middle
            const delta = center
                ? (rect.top + rect.bottom) / 2 - (top + bottom) / 2
                : rect.top < top
                  ? rect.top - top
                  : rect.bottom - bottom;
            if (Math.abs(delta) > 1) scroller.scrollTop += delta;
        };

        const stop = watchKeyboard((covered) => {
            document.documentElement.style.setProperty('--keyboard-inset', `${covered}px`);
            const wasOpen = open;
            open = covered > 0;
            if (open && !wasOpen) {
                clearTimeout(timer);
                timer = window.setTimeout(() => reveal(true), 60);
            }
        });
        const schedule = () => {
            clearTimeout(settle);
            settle = window.setTimeout(() => {
                if (touching || performance.now() - lastMove < SETTLE) schedule();
                else reveal(false);
            }, SETTLE);
        };
        const onMove = () => {
            lastMove = performance.now();
        };
        const onTouch = (event: TouchEvent) => {
            touching = event.touches.length > 0;
            if (!touching) schedule();
        };

        document.addEventListener('selectionchange', schedule);
        document.addEventListener('scroll', onMove, true);
        document.addEventListener('touchstart', onTouch, { passive: true });
        document.addEventListener('touchend', onTouch, { passive: true });
        document.addEventListener('touchcancel', onTouch, { passive: true });
        viewport.addEventListener('scroll', onMove);
        viewport.addEventListener('resize', onMove);
        return () => {
            stop();
            clearTimeout(settle);
            clearTimeout(timer);
            document.removeEventListener('selectionchange', schedule);
            document.removeEventListener('scroll', onMove, true);
            document.removeEventListener('touchstart', onTouch);
            document.removeEventListener('touchend', onTouch);
            document.removeEventListener('touchcancel', onTouch);
            viewport.removeEventListener('scroll', onMove);
            viewport.removeEventListener('resize', onMove);
            document.documentElement.style.removeProperty('--keyboard-inset');
        };
    }, [enabled]);
};

export default useKeyboardFocus;
