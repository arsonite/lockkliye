/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// Types
import type { iBlockListOptions, iListOptions, tNumbering } from '@/types';

const DEFAULT_LIST_OPTIONS: iListOptions = { auto: true, bullet: '•', numbering: '1.' };

// The bullets offered, nothing else is accepted
const BULLETS = ['•', '–', '▸', '◦', '■', '→', '★', '✓', '◆', '○', '✦', '›'];

interface iNumbering {
    kind: 'decimal' | 'alpha' | 'roman';
    upper: boolean;
    open: string;
    close: string;
}

const NUMBERINGS: Record<tNumbering, iNumbering> = {
    '1.': { kind: 'decimal', upper: false, open: '', close: '.' },
    '1)': { kind: 'decimal', upper: false, open: '', close: ')' },
    '(1)': { kind: 'decimal', upper: false, open: '(', close: ')' },
    '1:': { kind: 'decimal', upper: false, open: '', close: ':' },
    'a.': { kind: 'alpha', upper: false, open: '', close: '.' },
    'a)': { kind: 'alpha', upper: false, open: '', close: ')' },
    'A.': { kind: 'alpha', upper: true, open: '', close: '.' },
    'i.': { kind: 'roman', upper: false, open: '', close: '.' },
    'I.': { kind: 'roman', upper: true, open: '', close: '.' },
};

const DECIMAL_NUMBERINGS = (Object.keys(NUMBERINGS) as tNumbering[]).filter((id) => NUMBERINGS[id].kind === 'decimal');

const ROMAN: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

const toRoman = (number: number): string => {
    let result = '';
    for (const [value, symbol] of ROMAN) {
        while (number >= value) {
            result += symbol;
            number -= value;
        }
    }
    return result;
};

const fromRoman = (text: string): number | null => {
    let number = 0;
    let index = 0;
    for (const [value, symbol] of ROMAN) {
        while (text.startsWith(symbol, index)) {
            number += value;
            index += symbol.length;
        }
    }
    return index === text.length && toRoman(number) === text ? number : null;
};

// The marker of the given number, null if the style cannot count that far (letters stop at 26)
const formatNumber = (number: number, id: tNumbering): string | null => {
    const { kind, upper, open, close } = NUMBERINGS[id];
    if (number < 1 || (kind === 'alpha' && number > 26) || (kind === 'roman' && number > 3999)) return null;
    const core = kind === 'decimal' ? String(number) : kind === 'alpha' ? String.fromCharCode(96 + number) : toRoman(number);
    return `${open}${upper ? core.toUpperCase() : core}${close}`;
};

const parseNumber = (word: string, id: tNumbering): number | null => {
    const { kind, upper, open, close } = NUMBERINGS[id];
    if (!word.startsWith(open) || !word.endsWith(close) || word.length <= open.length + close.length) return null;
    const core = word.slice(open.length, word.length - close.length);
    if (kind === 'decimal') return /^\d+$/.test(core) ? Number(core) : null;
    if (upper ? core !== core.toUpperCase() : core !== core.toLowerCase()) return null;
    if (kind === 'alpha') return core.length === 1 && /[a-z]/i.test(core) ? core.toLowerCase().charCodeAt(0) - 96 : null;
    return fromRoman(core.toLowerCase());
};

// What a marker means in these options. Letters and roman numerals count only in the chosen style, or "I." in a
// sentence would start a list.
const numberOf = (word: string, options: iListOptions): { number: number; id: tNumbering } | null => {
    for (const id of [options.numbering, ...DECIMAL_NUMBERINGS]) {
        const number = parseNumber(word, id);
        if (number !== null) return { number, id };
    }
    return null;
};

const sanitizeNumbering = (value: unknown): tNumbering | null => {
    // Before there were more styles, the setting held the character after the number
    if (value === '.' || value === ')') return value === '.' ? '1.' : '1)';
    return typeof value === 'string' && value in NUMBERINGS ? (value as tNumbering) : null;
};

const sanitizeBlockListOptions = (value: unknown): iBlockListOptions => {
    const { auto, bullet, numbering } = (value ?? {}) as Record<string, unknown>;
    return {
        ...(typeof auto === 'boolean' ? { auto } : {}),
        ...(typeof bullet === 'string' && BULLETS.includes(bullet) ? { bullet } : {}),
        ...(sanitizeNumbering(numbering) ? { numbering: sanitizeNumbering(numbering)! } : {}),
    };
};

const sanitizeListOptions = (value: unknown): iListOptions => ({
    ...DEFAULT_LIST_OPTIONS,
    ...sanitizeBlockListOptions(value),
});

// What a list line starts with: the typed markers ("-", "1.") and the decorators of the options
const isBulletWord = (word: string, options: iListOptions): boolean =>
    word === options.bullet || /^[-*+]$/.test(word) || BULLETS.includes(word);

// The marker of the line after one that starts with the given word, null if that line is not a list item
const nextMarker = (firstWord: string, options: iListOptions): string | null => {
    const marker = numberOf(firstWord, options);
    if (marker) {
        return formatNumber(marker.number + 1, marker.id);
    }
    return isBulletWord(firstWord, options) ? options.bullet : null;
};

// The decorator a typed marker becomes ("-" -> bullet, "1)" -> "a." in the chosen style), null if it is none
const decoratorOf = (word: string, options: iListOptions): string | null => {
    if (/^[-*+]$/.test(word)) return options.bullet;
    const typed = /^(\d+)[.)]$/.exec(word);
    return typed ? formatNumber(Number(typed[1]), options.numbering) : null;
};

// Lines of pasted text that look like list items get the decorators
const convertPastedLists = (text: string, options: iListOptions): string =>
    text
        .split('\n')
        .map((line) => {
            const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
            const decorator = match ? decoratorOf(match[2], options) : null;
            return match && decorator ? `${match[1]}${decorator} ${match[3]}` : line;
        })
        .join('\n');

// The sample shown in the menus, like "a. b. c."
const numberingLabel = (id: tNumbering): string => [1, 2, 3].map((n) => formatNumber(n, id)).join(' ');

export {
    BULLETS,
    DEFAULT_LIST_OPTIONS,
    NUMBERINGS,
    convertPastedLists,
    decoratorOf,
    isBulletWord,
    nextMarker,
    numberingLabel,
    sanitizeBlockListOptions,
    sanitizeListOptions,
};
