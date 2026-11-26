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
import type { iBlockListOptions, iListOptions, iWord, tNumbering } from '@/types';

const DEFAULT_LIST_OPTIONS: iListOptions = { bullet: '◦', numbering: '1.' };

// The bullets offered, nothing else is accepted
const BULLETS = ['◦', '•', '–', '○', '-', '⋄', '❖', '>'];

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

// Indented items alternate between the style and its partner: first style, partner, first style, ...
const SUB_BULLETS: Record<string, string> = { '◦': '•', '•': '◦', '–': '•', '○': '•', '-': '•', '⋄': '•', '❖': '•', '>': '–' };
const SUB_NUMBERINGS: Record<tNumbering, tNumbering> = { '1.': '1)', '1.)': '1.', '1)': '1.', '(1)': '1)' };

const INDENT = '\u00A0\u00A0\u00A0\u00A0';
const isIndent = (word: string): boolean => word === '\t' || word === INDENT;

const bulletAt = (options: iListOptions, level: number): string =>
    level % 2 === 0 ? options.bullet : (SUB_BULLETS[options.bullet] ?? options.bullet);

const numberingAt = (options: iListOptions, level: number): tNumbering =>
    level % 2 === 0 ? options.numbering : SUB_NUMBERINGS[options.numbering];

// The indentation of a line and the words after it
const splitIndent = (line: iWord[]): { level: number; rest: iWord[] } => {
    const level = line.findIndex((word) => !isIndent(word.text));
    return level < 0 ? { level: line.length, rest: [] } : { level, rest: line.slice(level) };
};

// The words that start a list item, the first of a line that has text after it, with the indentation of the line
const listItems = (words: iWord[]): { index: number; level: number }[] => {
    const items: { index: number; level: number }[] = [];
    let level = 0;
    let atStart = true;
    words.forEach((word, index) => {
        if (word.text === '\n') {
            atStart = true;
            level = 0;
        } else if (atStart && isIndent(word.text)) {
            level++;
        } else if (atStart) {
            atStart = false;
            const next = words[index + 1];
            if (next && next.text !== '\n') items.push({ index, level });
        }
    });
    return items;
};

// What the next line of a list starts with (indentation and marker) after the line that is given, null if that line is
// not a list item
const nextLineStart = (line: iWord[], options: iListOptions): string | null => {
    const { level, rest } = splitIndent(line);
    if (!rest.length) return null;
    const indent = INDENT.repeat(level);
    const number = numberOf(rest[0].text);
    if (number !== null) {
        return `${indent}${formatNumber(number + 1, numberingAt(options, level))}`;
    }
    return isBulletWord(rest[0].text, options) ? `${indent}${bulletAt(options, level)}` : null;
};

// The decorator a typed marker becomes at a level ("-" -> bullet, "1)" -> "(1)" in the chosen style), null if it is none
const decorate = (typed: string, options: iListOptions, level: number): string | null => {
    if (/^[-*+]$/.test(typed)) return bulletAt(options, level);
    const number = /^(\d+)(\.\)|[.)])$/.exec(typed);
    return number ? formatNumber(Number(number[1]), numberingAt(options, level)) : null;
};

// The decorator of a line that is only indentation and a typed marker, null if the line is something else
const decoratorOf = (line: iWord[], options: iListOptions): string | null => {
    const { level, rest } = splitIndent(line);
    return rest.length === 1 ? decorate(rest[0].text, options, level) : null;
};

// An empty item (indentation and marker only) moved a level in or out, with the marker of the new level, null if the line
// is no empty item or cannot move
const shiftedItem = (line: iWord[], options: iListOptions, delta: number): string | null => {
    const { level, rest } = splitIndent(line);
    if (rest.length !== 1 || level + delta < 0) return null;
    const shifted = level + delta;
    const marker = numberOf(rest[0].text) !== null ? formatNumber(1, numberingAt(options, shifted)) : isBulletWord(rest[0].text, options) ? bulletAt(options, shifted) : null;
    return marker && `${INDENT.repeat(shifted)}${marker}`;
};

// Lines of pasted text that look like list items get the decorators, their indentation becomes indent words
const convertPastedLists = (text: string, options: iListOptions): string => {
    const lines = text.split('\n').map((line) => {
        const match = /^([ \t]*)([-*+]|\d+(?:\.\)|[.)]))\s+(.*)$/.exec(line);
        return { line, match, width: match ? match[1].replace(/\t/g, '    ').length : 0 };
    });
    // The smallest indentation is one level, whether it is 2 or 4 spaces
    const unit = Math.min(4, ...lines.map((entry) => entry.width).filter(Boolean));
    return lines
        .map(({ line, match, width }) => {
            if (!match) return line;
            const level = Math.round(width / unit);
            const decorator = decorate(match[2], options, level);
            return decorator ? `${INDENT.repeat(level)}${decorator} ${match[3]}` : line;
        })
        .join('\n');
};

// The existing lists of a block get the style of the options, the words stay the same objects if nothing changes
const convertListMarkers = (words: iWord[], options: iListOptions): iWord[] => {
    const converted = [...words];
    for (const { index, level } of listItems(words)) {
        const word = words[index];
        const number = numberOf(word.text);
        const text =
            number !== null
                ? formatNumber(number, numberingAt(options, level))
                : isBullet(word.text)
                  ? bulletAt(options, level)
                  : word.text;
        if (text !== word.text) converted[index] = { ...word, text };
    }
    return converted;
};

// What the lists in the words use right now: the first bullet and the first numbering found at the start of a line,
// nothing for a kind that has no list. Indented items follow the style of the top level, so only that is looked at.
const currentListStyle = (words: iWord[]): iBlockListOptions => {
    const style: iBlockListOptions = {};
    for (const { index, level } of listItems(words)) {
        if (level > 0) continue;
        const word = words[index];
        if (!style.bullet && isBullet(word.text)) style.bullet = word.text;
        const number = numberOf(word.text);
        if (!style.numbering && number !== null) {
            style.numbering = (Object.keys(NUMBERINGS) as tNumbering[]).find((id) => formatNumber(number, id) === word.text);
        }
    }
    return style;
};

// What the menus show for a style: the style of the first level and the one of the next, like "◦ ... •"
const bulletLabel = (bullet: string): string => `${bullet} ... ${SUB_BULLETS[bullet] ?? bullet}`;

const numberingLabel = (id: tNumbering): string => {
    const sample = (style: tNumbering) => [1, 2].map((n) => formatNumber(n, style)).join(' ');
    return `${sample(id)} ... ${sample(SUB_NUMBERINGS[id])}`;
};

export {
    BULLETS,
    DEFAULT_LIST_OPTIONS,
    NUMBERINGS,
    bulletLabel,
    convertListMarkers,
    convertPastedLists,
    currentListStyle,
    decoratorOf,
    isIndent,
    nextLineStart,
    numberingLabel,
    sanitizeBlockListOptions,
    sanitizeListOptions,
    shiftedItem,
};
