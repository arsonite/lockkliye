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
                item(key(shortcutText('toggleSidebar')), words('→ Collapse or expand the sidebar,'), key(shortcutText('lockAll')), words('→ Lock all notes')),
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
                ...words(`Switch on a mode (${shortcutText('color')} for text, ${shortcutText('highlight')} for the background) and the color bar stays open until you pick one, with the mouse or with`),
                key(shortcutText('colorPick')),
                ...words('and the marked words, or the word the cursor is in, change at once. Settings > Colors chooses which colors and gradients are offered, 8 of each at most, and lets you add your own.'),
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
                'Drag the ⠿ handle to move a block, it sits next to the buttons of the block and moves with them. Drag the right edge to change the width and double-click it (or hold it on a touch screen) to reset it. The buttons add a block above or below and delete it, they vanish when the mouse leaves the block. Settings > Editor can outline the block under the mouse and show a style button.',
            ),
            { title: 'Moving Blocks', borderStyle: 'double', borderRadius: 8, backgroundColor: 'rgba(105,219,124,0.1)' },
        ),

        createBlock(
            words(
                `Make a note an anchor with the bookmark button left of its title. Then switch on anchor mode in the toolbar (${shortcutText('anchor')}), pick the anchor note and click words to link them to it. A linked word has a dashed underline, Ctrl+click on it opens the anchor note. Settings > Editor > Anchors changes the line to a solid one and makes the word bold.`,
            ),
            { title: 'Anchors', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(177,151,252,0.1)' },
        ),

        createBlock(
            words(
                `Folders (the folder button in the sidebar) can be nested, drag notes into them or right-click a note to move it. Everything is kept in this browser first. The dot in front of a note means it is not saved to the server yet, ${shortcutText('save')} saves it. Changes go to the server in bulk requests, so saving many notes is fast.`,
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
                item(words('A line that starts with "-", "*" or "1." becomes a list, the bullet is a small hollow circle')),
                item(words('Enter continues the list, Enter on an empty item ends it')),
                item(words('Settings > Editor > Lists changes the bullet and the numbering for all blocks, the style menu of a block (right-click, or press and hold) sets its own and offers list options only in a block that has a list')),
            ]),
            { title: 'Lists', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(105,219,124,0.1)' },
        ),

        createBlock(
            words(
                'The note you edited last is on top. Right-click a note to pin it to the top of its folder or of the whole list. Right-click a folder, or the empty space of the list, to sort its notes (last edited, title, newest or by hand). Drag a note onto another note to put it before it, the folder is then sorted by hand.',
            ),
            { title: 'Sorting and Pinning', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,212,59,0.1)' },
        ),

        createBlock([createWord('📅', { fontSize: 'larger' }), ...words('Dates and Times', { bold: true, fontSize: 'larger' })]),

        createBlock(
            [
                ...words('A date like'),
                ...words('2026-03-14,'),
                ...words('14.03.2026 or'),
                ...words('14/03/2026 is underlined with dashes. Ctrl+click on it (a tap on a touch screen, once the block is in edit mode) opens a calendar where you pick another day. The date keeps its style.'),
            ],
            { title: 'Dates', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,212,59,0.1)' },
        ),

        createBlock(
            [
                ...words('A time like'),
                ...words('14:30,'),
                ...words('9:05,'),
                ...words('14:30:15 or'),
                ...words('2:30pm is underlined with dashes as well. Ctrl+click on it opens a clock. Drag the hand to the hour, then to the minutes, press "Set" and the text changes. "Now" jumps to the current time. A time written with am or pm keeps that way of writing.'),
            ],
            { title: 'Times', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,169,77,0.1)' },
        ),

        createBlock(
            words('While Ctrl is held, the mouse turns into a pointer over everything that reacts to Ctrl+click: dates, times and anchors.'),
            { title: 'Hold Ctrl', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(177,151,252,0.1)' },
        ),

        createBlock([createWord('📱', { fontSize: 'larger' }), ...words('Phone and Tablet', { bold: true, fontSize: 'larger' })]),

        createBlock(
            words(
                'On a phone the sidebar slides in over everything, with an X to close it. Collapsed, a narrow rail stays at the left edge with the toggle, the save dot (yellow while a note is not saved, green when it is), a line and the settings button. The page runs under the rail on a phone, on a desktop it sits beside it.',
            ),
            { title: 'Sidebar', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(116,192,252,0.1)' },
        ),

        createBlock(
            lines([
                item(words('One tap opens a note, one tap on a block puts the cursor where you tapped')),
                item(words('Press and hold works like a right-click: on a block it opens the customizer in the middle of the screen, on marked text the move menu, on empty space the list of components, on a note or folder its menu')),
                item(words('The block buttons and the handle are stacked next to the block, over the rail')),
                item(words('While you type, the toolbar sits above the keyboard')),
            ]),
            { title: 'Touch', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,169,77,0.1)' },
        ),

        createBlock(
            words(
                'The toolbar fades while you scroll and is fully visible again when the mouse is over it or you use a shortcut. Undo and redo are faint at the bottom and only visible when there is something to undo or redo, with the number of changes between them. Hover them and the word changes folds out, then the list opens between the two buttons. Hold Ctrl to see their keys.',
            ),
            { title: 'Toolbar and History', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(105,219,124,0.1)' },
        ),

        createBlock(
            words(
                `Lock a note from its right-click menu in the sidebar. One password locks all of them, and opening one locked note opens all of them. They lock again after 10 minutes without input, with the padlock in the second bar next to the toolbar (shown on locked notes) or with ${shortcutText('lockAll')}. The text of a locked note is encrypted in this browser before it is saved or synced, only the title stays readable. The password cannot be reset, Settings > Security changes it.`,
            ),
            { title: 'Locked Notes', borderStyle: 'solid', borderRadius: 8, backgroundColor: 'rgba(255,107,107,0.1)' },
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
