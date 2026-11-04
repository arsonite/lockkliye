/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// Types
import { HYPERLINKS_ENABLED } from '@/types';
import type { tFormatMode } from '@/types';

// The one place that defines the keyboard shortcuts: what handles them, what shows them (tooltips, keycaps, the
// settings, the tutorial) and the list in the settings all read from here.
interface iShortcut {
    group: 'Text' | 'General' | 'Blocks';
    keys: string[]; // The first one is the one that is shown, the others are alternatives
    label: string;
    display?: boolean; // Only shown, the app reads a range of keys on its own
    hidden?: boolean; // Left out of the list in the settings
    mode?: tFormatMode; // The format mode that the shortcut toggles
    off?: boolean;
}

// The ids stay literal while the entries are all typed as shortcuts
const define = <T extends Record<string, iShortcut>>(shortcuts: T): Record<keyof T, iShortcut> => shortcuts;

const SHORTCUTS = define({
    bold: { group: 'Text', keys: ['Ctrl+B'], label: 'Bold', mode: 'bold' },
    italic: { group: 'Text', keys: ['Ctrl+I'], label: 'Italic', mode: 'italic' },
    underline: { group: 'Text', keys: ['Ctrl+U'], label: 'Underline', mode: 'underline' },
    strikethrough: { group: 'Text', keys: ['Ctrl+Shift+S'], label: 'Strikethrough', mode: 'strikethrough' },
    color: { group: 'Text', keys: ['Ctrl+Shift+C'], label: 'Text color', mode: 'color' },
    highlight: { group: 'Text', keys: ['Ctrl+Shift+H'], label: 'Highlight', mode: 'highlight' },
    link: { group: 'Text', keys: ['Ctrl+K'], label: 'Hyperlink', mode: 'link', off: !HYPERLINKS_ENABLED },
    colorPick: {
        group: 'Text',
        keys: ['Ctrl+Shift+1…8'],
        label: 'Pick a color while the color bar is open',
        display: true,
    },
    sizes: { group: 'Text', keys: ['Ctrl+Alt+1…6'], label: 'Text size, from Title down to Caption', display: true },
    sizeTitle: { group: 'Text', keys: ['Ctrl+Alt+1'], label: 'Title', mode: 'huge', hidden: true },
    sizeHeading: { group: 'Text', keys: ['Ctrl+Alt+2'], label: 'Heading', mode: 'larger', hidden: true },
    sizeSubheading: { group: 'Text', keys: ['Ctrl+Alt+3'], label: 'Subheading', mode: 'large', hidden: true },
    sizeBody: { group: 'Text', keys: ['Ctrl+Alt+4'], label: 'Body', mode: 'normal', hidden: true },
    sizeSmall: { group: 'Text', keys: ['Ctrl+Alt+5'], label: 'Small', mode: 'smaller', hidden: true },
    sizeCaption: { group: 'Text', keys: ['Ctrl+Alt+6'], label: 'Caption', mode: 'tiny', hidden: true },
    larger: { group: 'Text', keys: ['Ctrl+]'], label: 'Larger text', mode: 'larger' },
    smaller: { group: 'Text', keys: ['Ctrl+['], label: 'Smaller text', mode: 'smaller' },
    anchor: { group: 'Text', keys: ['Ctrl+Shift+A'], label: 'Anchor mode', mode: 'anchor' },

    save: { group: 'General', keys: ['Ctrl+S'], label: 'Save to the server' },
    undo: { group: 'General', keys: ['Ctrl+Z'], label: 'Undo' },
    redo: { group: 'General', keys: ['Ctrl+Shift+Z', 'Ctrl+Y'], label: 'Redo' },
    escape: { group: 'General', keys: ['Escape'], label: 'Leave formatting mode and close the settings' },
    toggleSidebar: { group: 'General', keys: ['Ctrl+L'], label: 'Collapse or expand the sidebar' },

    newBlock: { group: 'Blocks', keys: ['Shift+Enter'], label: 'New block below' },
});

type tShortcutId = keyof typeof SHORTCUTS;

const entries = Object.entries(SHORTCUTS) as [tShortcutId, iShortcut][];

const SHORTCUT_GROUPS = (['Text', 'General', 'Blocks'] as const).map((title) => ({
    title,
    items: entries.filter(([, s]) => s.group === title && !s.hidden && !s.off).map(([, s]) => s),
}));

const idByCombo = new Map<string, tShortcutId>();
for (const [id, shortcut] of entries) {
    if (shortcut.display || shortcut.off) continue;
    shortcut.keys.forEach((keys) => idByCombo.set(keys.toLowerCase(), id));
}

// 'Ctrl+Shift+S' as it is shown
const shortcutText = (id: tShortcutId): string => SHORTCUTS[id].keys[0];

// 'Ctrl+Shift' of 'Ctrl+Shift+S'
const shortcutBase = (id: tShortcutId): string => shortcutText(id).split('+').slice(0, -1).join('+');

// 'S' of 'Ctrl+Shift+S'
const shortcutKey = (id: tShortcutId): string => shortcutText(id).split('+').pop() as string;

type tKeyEvent = Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>;

// The shortcut as the pressed keys write it: 'ctrl+shift+s'
const comboOf = (event: tKeyEvent): string =>
    [
        event.ctrlKey || event.metaKey ? 'ctrl' : '',
        event.shiftKey ? 'shift' : '',
        event.altKey ? 'alt' : '',
        // Alt changes the key on some layouts, the digit row is read by its position
        /^Digit\d$/.test(event.code) ? event.code.slice(5) : event.key.toLowerCase(),
    ]
        .filter(Boolean)
        .join('+');

const shortcutOf = (event: tKeyEvent): tShortcutId | undefined => idByCombo.get(comboOf(event));

// The index of the color that the pressed keys pick, 0 for the first
const colorIndexOf = (event: tKeyEvent): number | null => {
    const [first, last] = shortcutKey('colorPick').split('…').map(Number);
    const prefix = `${shortcutBase('colorPick').toLowerCase()}+`;
    const combo = comboOf(event);
    const digit = combo.startsWith(prefix) ? Number(combo.slice(prefix.length)) : NaN;
    return digit >= first && digit <= last ? digit - first : null;
};

export type { iShortcut, tShortcutId };
export { SHORTCUT_GROUPS, SHORTCUTS, colorIndexOf, shortcutBase, shortcutKey, shortcutOf, shortcutText };
