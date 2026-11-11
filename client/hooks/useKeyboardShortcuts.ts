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
import { useEffect, useCallback } from 'react';

// Types
import type { tFormatMode } from '@/types';

// Utility
import { SHORTCUTS, colorIndexOf, shortcutOf } from '@/tools/shortcuts';

interface iUseKeyboardShortcutsProps {
    onEscape: () => void;
    onFormatToggle: (mode: tFormatMode) => void;
    onToggleSidebar?: () => void;
    onColorIndex?: (index: number) => boolean; // Returns whether a color was picked
    onSave?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
}

const useKeyboardShortcuts: React.FC<iUseKeyboardShortcutsProps> = (props) => {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const id = shortcutOf(e);

        // Escape: blur the editor, clear the selection and leave format mode
        if (id === 'escape') {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            window.getSelection()?.removeAllRanges();
            props.onEscape();
            return;
        }

        // Always swallowed so the browser does not open its own save dialog
        if (id === 'save') {
            e.preventDefault();
            props.onSave?.();
            return;
        }

        if (id === 'toggleSidebar' && props.onToggleSidebar) {
            e.preventDefault();
            props.onToggleSidebar();
            return;
        }

        if (id === 'redo' && props.onRedo) {
            e.preventDefault();
            props.onRedo();
            return;
        }

        if (id === 'undo' && props.onUndo) {
            e.preventDefault();
            props.onUndo();
            return;
        }

        // Picks a color of the toolbar while the color bar is open
        // The keys are taken even without a color bar: on some layouts Shift and a digit would type a character
        const colorIndex = colorIndexOf(e);
        if (colorIndex !== null) {
            e.preventDefault();
            if (!e.repeat) props.onColorIndex?.(colorIndex);
            return;
        }

        const mode = id && SHORTCUTS[id].mode;
        if (mode) {
            e.preventDefault();

            // Holding the keys repeats them, which would switch the mode on and off again
            if (!e.repeat) props.onFormatToggle(mode);
        }
    }, [props.onFormatToggle, props.onColorIndex, props.onEscape, props.onSave, props.onUndo, props.onRedo, props.onToggleSidebar]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown]);

    return null;
};

export default useKeyboardShortcuts;