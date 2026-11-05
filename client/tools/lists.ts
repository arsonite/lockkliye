/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// Types
import type { iBlockListOptions, iListOptions, iWord, tNumbering } from '@/types';

const DEFAULT_LIST_OPTIONS: iListOptions = { bullet: '•', numbering: '1.' };

// The bullets offered, nothing else is accepted
const BULLETS = ['•', '–', '○', '-', '⋄', '>'];

// The marker of a number is its number between these
const NUMBERINGS: Record<tNumbering, [string, string]> = {
    '1.': ['', '.'],
    '1.)': ['', '.)'],
    '1)': ['', ')'],
    '(1)': ['(', ')'],
};

const formatNumber = (number: number, id: tNumbering): string => `${NUMBERINGS[id][0]}${number}${NUMBERINGS[id][1]}`;

const numberOf = (word: string): number | null => {
    for (const [open, close] of Object.values(NUMBERINGS)) {
        const core = word.startsWith(open) && word.endsWith(close) ? word.slice(open.length, word.length - close.length) : '';
        if (/^\d+$/.test(core)) return Number(core);
    }
    return null;
};

const sanitizeNumbering = (value: unknown): tNumbering | null => {
    // Before there were more styles, the setting held the character after the number
    if (value === '.' || value === ')') return value === '.' ? '1.' : '1)';
    return typeof value === 'string' && value in NUMBERINGS ? (value as tNumbering) : null;
};

const sanitizeBlockListOptions = (value: unknown): iBlockListOptions => {
    const { bullet, numbering } = (value ?? {}) as Record<string, unknown>;
    const id = sanitizeNumbering(numbering);
    return {
        ...(typeof bullet === 'string' && BULLETS.includes(bullet) ? { bullet } : {}),
        ...(id ? { numbering: id } : {}),
    };
};

const sanitizeListOptions = (value: unknown): iListOptions => ({
    ...DEFAULT_LIST_OPTIONS,
    ...sanitizeBlockListOptions(value),
});

const isBullet = (word: string): boolean => BULLETS.includes(word) || /^[-*+]$/.test(word);

// What a list line starts with: the typed markers ("-", "1.") and the decorators of the options. ">" starts a list only
// if it is the bullet, it is too common in text.
const isBulletWord = (word: string, options: iListOptions): boolean =>
    word === options.bullet || (isBullet(word) && word !== '>');

// The marker of the line after one that starts with the given word, null if that line is not a list item
const nextMarker = (firstWord: string, options: iListOptions): string | null => {
    const number = numberOf(firstWord);
    if (number !== null) {
        return formatNumber(number + 1, options.numbering);
    }
    return isBulletWord(firstWord, options) ? options.bullet : null;
};

// The decorator a typed marker becomes ("-" -> bullet, "1)" -> "(1)" in the chosen style), null if it is none
const decoratorOf = (word: string, options: iListOptions): string | null => {
    if (/^[-*+]$/.test(word)) return options.bullet;
    const typed = /^(\d+)(\.\)|[.)])$/.exec(word);
    return typed ? formatNumber(Number(typed[1]), options.numbering) : null;
};

// Lines of pasted text that look like list items get the decorators
const convertPastedLists = (text: string, options: iListOptions): string =>
    text
        .split('\n')
        .map((line) => {
            const match = /^(\s*)([-*+]|\d+(?:\.\)|[.)]))\s+(.*)$/.exec(line);
            const decorator = match ? decoratorOf(match[2], options) : null;
            return match && decorator ? `${match[1]}${decorator} ${match[3]}` : line;
        })
        .join('\n');

// The existing lists of a block get the style of the options, the words stay the same objects if nothing changes
const convertListMarkers = (words: iWord[], options: iListOptions): iWord[] =>
    words.map((word, i) => {
        const next = words[i + 1];
        if ((i > 0 && words[i - 1].text !== '\n') || !next || next.text === '\n') return word;
        const number = numberOf(word.text);
        const text = number !== null ? formatNumber(number, options.numbering) : isBullet(word.text) ? options.bullet : word.text;
        return text === word.text ? word : { ...word, text };
    });

// The sample shown in the menus, like "1. 2. 3."
const numberingLabel = (id: tNumbering): string => [1, 2, 3].map((n) => formatNumber(n, id)).join(' ');

export {
    BULLETS,
    DEFAULT_LIST_OPTIONS,
    NUMBERINGS,
    convertListMarkers,
    convertPastedLists,
    decoratorOf,
    nextMarker,
    numberingLabel,
    sanitizeBlockListOptions,
    sanitizeListOptions,
};
