/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// Every keyboard shortcut of the app, as listed in the settings. The keys of a shortcut that has two are alternatives.
interface iShortcut {
    keys: string[];
    label: string;
}

interface iShortcutGroup {
    items: iShortcut[];
    title: string;
}

const SHORTCUT_GROUPS: iShortcutGroup[] = [
    {
        title: 'Text',
        items: [
            { keys: ['Ctrl+B'], label: 'Bold' },
            { keys: ['Ctrl+I'], label: 'Italic' },
            { keys: ['Ctrl+U'], label: 'Underline' },
            { keys: ['Ctrl+Shift+S'], label: 'Strikethrough' },
            { keys: ['Ctrl+Shift+C'], label: 'Text color' },
            { keys: ['Ctrl+Shift+H'], label: 'Highlight' },
            { keys: ['Ctrl+Shift+1…8'], label: 'Pick a color while the color bar is open' },
            { keys: ['Ctrl+Alt+1…6'], label: 'Text size, from Title down to Caption' },
            { keys: ['Ctrl+]'], label: 'Larger text' },
            { keys: ['Ctrl+['], label: 'Smaller text' },
            { keys: ['Ctrl+Shift+A'], label: 'Anchor mode' },
        ],
    },
    {
        title: 'General',
        items: [
            { keys: ['Ctrl+S'], label: 'Save to the server' },
            { keys: ['Ctrl+Z'], label: 'Undo' },
            { keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], label: 'Redo' },
            { keys: ['Escape'], label: 'Leave formatting mode and close the settings' },
            { keys: ['Ctrl+Shift+L'], label: 'Collapse or expand the sidebar' },
        ],
    },
    {
        title: 'Blocks',
        items: [{ keys: ['Shift+Enter'], label: 'New block below' }],
    },
];

export type { iShortcut, iShortcutGroup };
export { SHORTCUT_GROUPS };
