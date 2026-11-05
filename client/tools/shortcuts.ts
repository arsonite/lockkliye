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

// Types
import { HYPERLINKS_ENABLED } from '@/types';
import type { tFormatMode } from '@/types';

// The one place that defines the keyboard shortcuts: what handles them, what shows them (tooltips, keycaps, the
// settings, the tutorial) and the list in the settings all read from here.
interface iShortcut {
    display?: boolean; // Only shown, the app reads a range of keys on its own
    group: 'Text' | 'General' | 'Blocks';
    keys: string[]; // The first one is the one that is shown, the others are alternatives
    label: string;
    hidden?: boolean; // Left out of the list in the settings
    mode?: tFormatMode; // The format mode that the shortcut toggles
    off?: boolean;
}

// The ids stay literal while the entries are all typed as shortcuts
const define = <T extends Record<string, iShortcut>>(shortcuts: T): Record<keyof T, iShortcut> => shortcuts;

const SHORTCUT_KEYS = {
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    underline: 'Ctrl+U',
    strikethrough: 'Ctrl+Shift+S',
    color: 'Ctrl+Shift+C',
    highlight: 'Ctrl+Shift+H',
    link: 'Ctrl+K',
    colorPick: 'Ctrl+Shift+1…8',
    sizes: 'Ctrl+Alt+1…6',
    sizeTitle: 'Ctrl+Alt+1',
    sizeHeading: 'Ctrl+Alt+2',
    sizeSubheading: 'Ctrl+Alt+3',
    sizeBody: 'Ctrl+Alt+4',
    sizeSmall: 'Ctrl+Alt+5',
    sizeCaption: 'Ctrl+Alt+6',
    larger: 'Ctrl+]',
    smaller: 'Ctrl+[',
    anchor: 'Ctrl+Shift+A',
    save: 'Ctrl+S',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Shift+Z',
    escape: 'Escape',
    toggleSidebar: 'Ctrl+L',
    newBlock: 'Shift+Enter',
};

const SHORTCUTS = define({
    bold: { group: 'Text', keys: [SHORTCUT_KEYS.bold], label: 'Bold', mode: 'bold' },
    italic: { group: 'Text', keys: [SHORTCUT_KEYS.italic], label: 'Italic', mode: 'italic' },
    underline: { group: 'Text', keys: [SHORTCUT_KEYS.underline], label: 'Underline', mode: 'underline' },
    strikethrough: { group: 'Text', keys: [SHORTCUT_KEYS.strikethrough], label: 'Strikethrough', mode: 'strikethrough' },
    color: { group: 'Text', keys: [SHORTCUT_KEYS.color], label: 'Text color', mode: 'color' },
    highlight: { group: 'Text', keys: [SHORTCUT_KEYS.highlight], label: 'Highlight', mode: 'highlight' },
    link: { group: 'Text', keys: [SHORTCUT_KEYS.link], label: 'Hyperlink', mode: 'link', off: !HYPERLINKS_ENABLED },
    colorPick: {
        group: 'Text',
        keys: [SHORTCUT_KEYS.colorPick],
        label: 'Pick a color while the color bar is open',
        display: true,
    },
    sizes: { group: 'Text', keys: [SHORTCUT_KEYS.sizes], label: 'Text size, from Title down to Caption', display: true },
    sizeTitle: { group: 'Text', keys: [SHORTCUT_KEYS.sizeTitle], label: 'Title', mode: 'huge', hidden: true },
    sizeHeading: { group: 'Text', keys: [SHORTCUT_KEYS.sizeHeading], label: 'Heading', mode: 'larger', hidden: true },
    sizeSubheading: { group: 'Text', keys: [SHORTCUT_KEYS.sizeSubheading], label: 'Subheading', mode: 'large', hidden: true },
    sizeBody: { group: 'Text', keys: [SHORTCUT_KEYS.sizeBody], label: 'Body', mode: 'normal', hidden: true },
    sizeSmall: { group: 'Text', keys: [SHORTCUT_KEYS.sizeSmall], label: 'Small', mode: 'smaller', hidden: true },
    sizeCaption: { group: 'Text', keys: [SHORTCUT_KEYS.sizeCaption], label: 'Caption', mode: 'tiny', hidden: true },
    larger: { group: 'Text', keys: [SHORTCUT_KEYS.larger], label: 'Larger text', mode: 'larger' },
    smaller: { group: 'Text', keys: [SHORTCUT_KEYS.smaller], label: 'Smaller text', mode: 'smaller' },
    anchor: { group: 'Text', keys: [SHORTCUT_KEYS.anchor], label: 'Anchor mode', mode: 'anchor' },

    save: { group: 'General', keys: [SHORTCUT_KEYS.save], label: 'Save to the server' },
    undo: { group: 'General', keys: [SHORTCUT_KEYS.undo], label: 'Undo' },
    redo: { group: 'General', keys: [SHORTCUT_KEYS.redo, 'Ctrl+Y'], label: 'Redo' },
    escape: { group: 'General', keys: [SHORTCUT_KEYS.escape], label: 'Leave formatting mode and close the settings' },
    toggleSidebar: { group: 'General', keys: [SHORTCUT_KEYS.toggleSidebar], label: 'Collapse or expand the sidebar' },

    newBlock: { group: 'Blocks', keys: [SHORTCUT_KEYS.newBlock], label: 'New block below' },
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