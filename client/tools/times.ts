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

// Times in the text: 14:30, 9:05, 14:30:15 and 2:30pm. A time is one word, punctuation around it (like a comma
// behind it) stays where it is.

interface iFoundTime {
    hours: number; // 0 to 23, also for a time written with am or pm
    minutes: number;
    seconds?: string; // Kept as it is written, the clock does not change it
    twelve: boolean; // Written with am or pm
    upper: boolean; // PM instead of pm
    padded: boolean; // 09:05 instead of 9:05
    before: string;
    after: string;
}

const TIME_WORD = /^([([“"']*)(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?([)\]”"'.,;:!?]*)$/i;

const pad = (value: number): string => String(value).padStart(2, '0');

const findTime = (word: string): iFoundTime | null => {
    const match = TIME_WORD.exec(word);
    if (!match) return null;
    const [, before, hourText, minuteText, seconds, meridiem, after] = match;
    const [hour, minutes] = [+hourText, +minuteText];
    const twelve = Boolean(meridiem);
    if (minutes > 59 || (seconds !== undefined && +seconds > 59)) return null;
    if (twelve ? hour < 1 || hour > 12 : hour > 23) return null;
    const hours = twelve ? (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0) : hour;
    return {
        hours,
        minutes,
        seconds,
        twelve,
        upper: twelve && meridiem === meridiem.toUpperCase(),
        padded: hourText.length === 2,
        before,
        after,
    };
};

// The word for a time, in the style and with the punctuation of the one it replaces
const formatTime = (
    hours: number,
    minutes: number,
    { seconds, twelve, upper, padded, before, after }: Omit<iFoundTime, 'hours' | 'minutes'>,
): string => {
    const shown = twelve ? hours % 12 || 12 : hours;
    const hourText = padded ? pad(shown) : String(shown);
    const meridiem = twelve ? (hours >= 12 ? 'pm' : 'am') : '';
    return `${before}${hourText}:${pad(minutes)}${seconds !== undefined ? `:${seconds}` : ''}${upper ? meridiem.toUpperCase() : meridiem}${after}`;
};

export type { iFoundTime };

export { findTime, formatTime };