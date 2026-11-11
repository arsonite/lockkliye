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
const NEW_FEATURES_TITLE = 'What is new in Lockkliye';

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

// A second page for the newer features, it is restored together with the first one
const createNewFeaturesNote = (): iNote => {
    const note = createNote(NEW_FEATURES_TITLE);
    const section = (icon: string, title: string): iWord[] => [
        createWord(icon, { fontSize: 'larger' }),
        ...words(title, { bold: true, fontSize: 'larger' }),
    ];
    const card = (title: string, color: string, text: iWord[]) =>
        createBlock(text, { title, borderStyle: 'solid', borderRadius: 8, backgroundColor: color });

    note.blocks = [
        createBlock([
            createWord('What', { bold: true, fontSize: 'huge', color: '#74c0fc' }),
            createWord('is', { bold: true, fontSize: 'huge' }),
            createWord('new', { bold: true, fontSize: 'huge', color: '#ff9500' }),
        ]),

        createBlock(
            words('A tour of the newer features, with examples you can try right here.', { fontSize: 'large' }),
            { backgroundColor: 'rgba(116,192,252,0.1)', borderRadius: 12 },
        ),

        createBlock(section('📅', 'Dates and Times')),

        card('Dates', 'rgba(255,212,59,0.1)', [
            ...words('A date like'),
            ...words('2026-03-14,'),
            ...words('14.03.2026 or'),
            ...words('14/03/2026 is underlined with dashes. Ctrl+click on it (a tap on a touch screen, once the block is in edit mode) opens a calendar where you pick another day. The date keeps its style.'),
        ]),

        card('Times', 'rgba(255,169,77,0.1)', [
            ...words('A time like'),
            ...words('14:30,'),
            ...words('9:05,'),
            ...words('14:30:15 or'),
            ...words('2:30pm is underlined with dashes as well. Ctrl+click on it opens a clock. Drag the hand to the hour, then to the minutes, press "Set" and the text changes. "Now" jumps to the current time. A time written with am or pm keeps that way of writing, the 24 hour clock has two rings.'),
        ]),

        card('Hold Ctrl', 'rgba(177,151,252,0.1)', words(
            'While Ctrl is held, the mouse turns into a pointer over everything that reacts to Ctrl+click: dates, times and anchors.',
        )),

        createBlock(section('🎨', 'Formatting')),

        card('Color, Highlight and Anchor', 'rgba(255,107,107,0.1)', [
            ...words(`Switch on a mode (${shortcutText('color')}, ${shortcutText('highlight')} or ${shortcutText('anchor')}) and the choice stays open until you pick something. Pick a color, a gradient or an anchor note with the mouse or with`),
            key(shortcutText('colorPick')),
            ...words('and the marked words, or the word with the cursor in it, change at once.'),
        ]),

        card('Anchors', 'rgba(177,151,252,0.1)', words(
            'A word linked to an anchor note has a dashed underline in the color of the accent, no bold anymore. Ctrl+click on it opens the note.',
        )),

        card('Holding Keys', 'rgba(105,219,124,0.1)', words(
            'Holding a shortcut no longer switches a mode on and off again and again, and the number keys of the color pick never write a character.',
        )),

        createBlock(section('☰', 'Lists')),

        card('Bullets', 'rgba(105,219,124,0.1)', lines([
            item(words('The bullet is a small hollow circle by default')),
            item(words('The style menu of a block (right-click, or press and hold) shows the bullet that is in use')),
            item(words('List options are only offered when the block already has a list')),
        ])),

        createBlock(section('📱', 'Phone and Tablet')),

        card('Sidebar', 'rgba(116,192,252,0.1)', words(
            'On a phone the sidebar slides in over everything, with an X to close it. Collapsed, a narrow rail stays at the left edge with the toggle, the save dot (yellow while a note is not saved, green when it is), a line and the settings button. The page runs under the rail on a phone, on a desktop it sits beside it.',
        )),

        card('Taps', 'rgba(255,169,77,0.1)', lines([
            item(words('One tap on a note opens it, one tap on a block puts the cursor where you tapped')),
            item(words('Press and hold on a block opens its customizer in the middle of the screen')),
            item(words('Press and hold on text works like a right-click')),
            item(words('The block buttons and the handle are stacked next to the block, over the rail')),
        ])),

        card('Keyboard', 'rgba(255,212,59,0.1)', words(
            'While you type, the toolbar is moved above the keyboard of the phone, next to the bar with the button that finishes the writing.',
        )),

        createBlock(section('🖱️', 'Blocks')),

        card('Handle and Buttons', 'rgba(177,151,252,0.1)', words(
            'On a desktop the handle to drag a block sits in the middle of its left side and is larger than before. The buttons of a block vanish again when the mouse leaves it.',
        )),

        createBlock(section('☁️', 'Saving')),

        card('Faster Saving', 'rgba(105,219,124,0.1)', words(
            'Changes are sent to the server in bulk requests and in a sliding window, so saving many notes takes a fraction of the time it did.',
        )),
    ];

    return note;
};

const createTutorialNotes = (): iNote[] => [createTutorialNote(), createNewFeaturesNote()];

export { NEW_FEATURES_TITLE, TUTORIAL_TITLE, createNewFeaturesNote, createTutorialNote, createTutorialNotes };
