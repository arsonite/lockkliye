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

// Utility
import { shortcutText } from '@/tools/shortcuts';

// Types
import { createBlock, createNote, createWord } from '@/types';
import type { iNote, iWord, iWordFormat } from '@/types';

// The tutorial is found again by its title, restoring it resets this note instead of adding a second one
const TUTORIAL_TITLE = 'Welcome to Lockkliye';

// The words of a text
const words = (text: string, format: iWordFormat = {}): iWord[] =>
    text.split(' ').map((word) => createWord(word, format));

// A shortcut, marked like a keycap
const key = (text: string): iWord => createWord(text, { bold: true, highlight: 'rgba(255,212,59,0.3)' });

// Lines of words with a line break between them
const lines = (rows: iWord[][]): iWord[] =>
    rows.flatMap((row, index) => (index === 0 ? row : [createWord('\n'), ...row]));

// A line of a list
const item = (...parts: (iWord | iWord[])[]): iWord[] => [createWord('◦'), ...parts.flat()];

const createTutorialNote = (): iNote => {
    const note = createNote(TUTORIAL_TITLE);

    note.blocks = [
        createBlock([
            createWord('Welcome', { bold: true, fontSize: 'huge', color: '#74c0fc' }),
            createWord('to'),
            createWord('Lockkliye', { bold: true, fontSize: 'huge', color: '#ff9500' }),
        ]),

        createBlock(
            [
                ...words('A modern', { fontSize: 'large' }),
                ...words('note-taking', { fontSize: 'large', italic: true }),
                ...words('app with', { fontSize: 'large' }),
                ...words('rich formatting', { fontSize: 'large', bold: true }),
                ...words(`capabilities. Notes work offline and are saved to the server with ${shortcutText('save')}.`, {
                    fontSize: 'large',
                }),
            ],
            { backgroundColor: 'rgba(116,192,252,0.1)', borderRadius: 12 },
        ),

        createBlock([
            createWord('⌨️', { fontSize: 'larger' }),
            ...words('Keyboard Shortcuts', { bold: true, fontSize: 'larger' }),
        ]),

        createBlock(
            lines([
                item(key(shortcutText('bold')), words('→ Bold,'), key(shortcutText('italic')), words('→ Italic,'), key(shortcutText('underline')), words('→ Underline')),
                item(key(shortcutText('strikethrough')), words('→ Strikethrough')),
                item(
                    key(shortcutText('color')),
                    words('→ Text color,'),
                    key(shortcutText('highlight')),
                    words('→ Highlight, then'),
                    key(shortcutText('colorPick')),
                    words('picks a color'),
                ),
                item(key(shortcutText('sizes')), words('→ Text size, from Title down to Caption')),
                item(key(shortcutText('anchor')), words('→ Anchor mode')),
                item(key(shortcutText('toggleSidebar')), words('→ Collapse or expand the sidebar')),
                item(key(shortcutText('save')), words('→ Save,'), key(shortcutText('undo')), words('→ Undo,'), key(shortcutText('redo')), words('→ Redo')),
                item(words('Hold Ctrl, then Shift or Alt, to see the keys under the toolbar buttons')),
            ]),
            { borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
        ),

        createBlock([createWord('✨', { fontSize: 'larger' }), ...words('Features', { bold: true, fontSize: 'larger' })]),

        createBlock(
            [
                createWord('Text', { fontSize: 'tiny' }),
                createWord('in', { fontSize: 'smaller' }),
                createWord('different'),
                createWord('sizes:', { fontSize: 'large' }),
                createWord('tiny,', { fontSize: 'tiny' }),
                createWord('smaller,', { fontSize: 'smaller' }),
                createWord('normal,'),
                createWord('large,', { fontSize: 'large' }),
                createWord('larger,', { fontSize: 'larger' }),
                createWord('huge', { fontSize: 'huge' }),
            ],
            { title: 'Text Sizes', borderStyle: 'dashed', borderRadius: 6, backgroundColor: 'rgba(255,169,77,0.1)' },
        ),

        createBlock(
            [
                createWord('Colorful', { color: '#ff6b6b', bold: true }),
                createWord('text', { color: '#ffa94d' }),
                createWord('with', { color: '#ffd43b' }),
                createWord('highlights', { highlight: 'rgba(105,219,124,0.4)' }),
                createWord('and', { color: '#74c0fc' }),
                createWord('backgrounds.', { highlight: 'rgba(177,151,252,0.4)' }),
                ...words('Settings > Colors chooses which colors and gradients are offered, 8 of each at most, and lets you add your own.'),
            ],
            {
                title: 'Colors',
                borderStyle: 'solid',
                borderRadius: 10,
                backgroundGradient: 'linear-gradient(135deg, rgba(116,192,252,0.1) 0%, rgba(177,151,252,0.1) 100%)',
            },
        ),

        createBlock(
            words(
                'Right-click a block (or press and hold on a touch screen) to open its customizer: title, border with an adjustable gap between dashes, corner radius, background and gradient. Save a style as a preset to reuse it.',
            ),
            {
                title: 'Block Styling',
                borderStyle: 'dotted',
                borderRadius: 16,
                backgroundGradient: 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,169,77,0.15) 100%)',
            },
        ),

        createBlock(
            words(
                'Drag the ⠿ handle to move a block, drag its right edge to change its width and double-click that edge to reset it. The buttons next to a block add a block above or below it and delete it. Settings > Editor can outline the block under the mouse and show a style button.',
            ),
            { title: 'Moving Blocks', borderStyle: 'double', borderRadius: 8, backgroundColor: 'rgba(105,219,124,0.1)' },
        ),

        createBlock(
            words(
                `Make a note an anchor with the bookmark button left of its title. Then switch on anchor mode in the toolbar (${shortcutText('anchor')}), pick the anchor note and click words to link them to it. Ctrl+click on a linked word opens the anchor note.`,
            ),
            { title: 'Anchors', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(177,151,252,0.1)' },
        ),

        createBlock(
            words(
                `Folders (the folder button in the sidebar) can be nested, drag notes into them or right-click a note to move it. Everything is kept in this browser first. The dot in front of a note means it is not saved to the server yet, ${shortcutText('save')} saves it.`,
            ),
            { title: 'Folders and Saving', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,212,59,0.1)' },
        ),

        createBlock(
            words(
                'Right-click selected text to get a small menu that moves it into a new block above or below, with or without following it. "Add component" at the bottom of a note adds a checklist, a table or a code block (indented text with a gray line and a monospaced font), and a right-click on the empty space of a note, also between blocks, opens the same list where you clicked.',
            ),
            { title: 'Blocks and Components', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(116,192,252,0.1)' },
        ),

        createBlock(
            lines([
                item(words('A line that starts with "-", "*" or "1." becomes a list')),
                item(words('Enter continues the list, Enter on an empty item ends it')),
                item(words('Settings > Editor > Lists changes the bullet and the numbering for all blocks, the style menu of a block (right-click) sets its own')),
            ]),
            { title: 'Lists', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(105,219,124,0.1)' },
        ),

        createBlock(
            words(
                'The note you edited last is on top. Right-click a note to pin it to the top of its folder or of the whole list. Right-click a folder, or the empty space of the list, to sort its notes (last edited, title, newest or by hand). Drag a note onto another note to put it before it, the folder is then sorted by hand.',
            ),
            { title: 'Sorting and Pinning', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,212,59,0.1)' },
        ),

        createBlock([createWord('💡', { fontSize: 'larger' }), ...words('Tips', { bold: true, fontSize: 'larger' })]),

        createBlock(
            lines([
                item(words(`Use ${shortcutText('newBlock')} to create a new block`)),
                item(words(`${shortcutText('escape')} leaves formatting mode`)),
                item(words('Hover a block to see its buttons, they follow the mouse')),
                item(words('Settings has light mode, the width of the editor, export and import and clearing of histories')),
            ]),
            { borderStyle: 'solid', borderRadius: 4, backgroundColor: 'rgba(105,219,124,0.1)' },
        ),
    ];

    return note;
};

export { TUTORIAL_TITLE, createTutorialNote };
