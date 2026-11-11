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

// Dates in the text: 2026-03-12, 12.03.2026 and 12/03/2026 (day first). A date is one word, punctuation around it
// (like a comma behind it) stays where it is.

type tDateStyle = 'iso' | 'dot' | 'slash';

interface iFoundDate {
    date: Date;
    style: tDateStyle;
    padded: boolean;
    before: string;
    after: string;
}

const DATE_WORD = /^([([“"']*)(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})([./])(\d{1,2})\6(\d{4}))([)\]”"'.,;:!?]*)$/;

const pad = (value: number): string => String(value).padStart(2, '0');

// Only real days, "31.02.2026" is not a date
const buildDate = (year: number, month: number, day: number): Date | null => {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const findDate = (word: string): iFoundDate | null => {
    const match = DATE_WORD.exec(word);
    if (!match) return null;
    const [, before, isoYear, isoMonth, isoDay, day, separator, month, year, after] = match;
    const iso = Boolean(isoYear);
    const date = iso ? buildDate(+isoYear, +isoMonth, +isoDay) : buildDate(+year, +month, +day);
    if (!date) return null;
    return {
        date,
        style: iso ? 'iso' : separator === '.' ? 'dot' : 'slash',
        padded: iso || day.length === 2,
        before,
        after,
    };
};

// The word for a date, in the style and with the punctuation of the one it replaces
const formatDate = (date: Date, { style, padded, before, after }: Omit<iFoundDate, 'date'>): string => {
    const [day, month, year] = [date.getDate(), date.getMonth() + 1, date.getFullYear()];
    const [dd, mm] = padded ? [pad(day), pad(month)] : [String(day), String(month)];
    const core = style === 'iso' ? `${year}-${pad(month)}-${pad(day)}` : `${dd}${style === 'dot' ? '.' : '/'}${mm}${style === 'dot' ? '.' : '/'}${year}`;
    return `${before}${core}${after}`;
};

export type { iFoundDate, tDateStyle };
export { findDate, formatDate };
