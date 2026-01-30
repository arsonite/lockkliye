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
import {
    tFormatMode,
    SHORTCUTS
} from '@/types';

interface iUseKeyboardShortcutsProps {
    onEscape: () => void;
    onFormatToggle: (mode: tFormatMode) => void;
    onUndo?: () => void;
    onRedo?: () => void;
}

const useKeyboardShortcuts: React.FC<iUseKeyboardShortcutsProps> = (props) => {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Build shortcut string
        const parts: string[] = [];
        if (e.ctrlKey || e.metaKey) {
            parts.push('ctrl');
        };
        if (e.shiftKey) {
            parts.push('shift');
        };
        if (e.altKey) {
            ;
            parts.push('alt');
        };
        parts.push(e.key.toLowerCase());
        const shortcut = parts.join('+');

        // Check for escape - blur active element and clear format mode
        if (e.key === 'Escape') {
            // Blur any focused element (defocus text editor)
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            // Also clear any text selection
            window.getSelection()?.removeAllRanges();
            props.onEscape();
            return;
        }

        // Check for redo (Ctrl+Shift+Z or Ctrl+Y)
        if ((shortcut === 'ctrl+shift+z' || shortcut === 'ctrl+y') && props.onRedo) {
            e.preventDefault();
            props.onRedo();
            return;
        }

        // Check for undo (Ctrl+Z)
        if (shortcut === 'ctrl+z' && props.onUndo) {
            e.preventDefault();
            props.onUndo();
            return;
        }

        // Check for format shortcuts
        const mode = SHORTCUTS[shortcut];
        if (mode) {
            e.preventDefault();

            props.onFormatToggle(mode);
        }
    }, [props.onFormatToggle, props.onEscape, props.onUndo, props.onRedo]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown]);

    return null;
};

export default useKeyboardShortcuts;