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
import type { iPalette, iPaletteSlot, tPaletteKind } from '@/types';

// Colors and gradients the toolbar and the block style menu can offer. The user switches them on in the settings,
// 8 at most per kind, and can add their own.
const MAX_ENABLED = 8;

interface iPaletteEntry {
    value: string; // What is stored in a word or a block
    label: string;
    custom?: boolean;
}

type tHex = `#${string}`;

const TEXT_COLORS: [tHex | 'inherit', string][] = [
    ['inherit', 'Default'],
    ['#ff6b6b', 'Red'],
    ['#ffa94d', 'Orange'],
    ['#ffd43b', 'Yellow'],
    ['#69db7c', 'Green'],
    ['#74c0fc', 'Blue'],
    ['#b197fc', 'Purple'],
    ['#adb5bd', 'Gray'],
    ['#f783ac', 'Pink'],
    ['#ff8787', 'Salmon'],
    ['#e03131', 'Crimson'],
    ['#f76707', 'Tangerine'],
    ['#fcc419', 'Gold'],
    ['#a9e34b', 'Lime'],
    ['#51cf66', 'Emerald'],
    ['#63e6be', 'Mint'],
    ['#20c997', 'Teal'],
    ['#3bc9db', 'Cyan'],
    ['#4dabf7', 'Sky'],
    ['#4c6ef5', 'Indigo'],
    ['#748ffc', 'Periwinkle'],
    ['#9775fa', 'Violet'],
    ['#da77f2', 'Orchid'],
    ['#e64980', 'Magenta'],
    ['#d0bfff', 'Lavender'],
    ['#ffc9a0', 'Peach'],
    ['#c69c6d', 'Sand'],
    ['#868e96', 'Slate'],
    ['#f8f9fa', 'White'],
    ['#343a40', 'Charcoal'],
];

const GRADIENT_PAIRS: [tHex, tHex, string][] = [
    ['#ff6b6b', '#ffa94d', 'Sunrise'],
    ['#74c0fc', '#b197fc', 'Twilight'],
    ['#69db7c', '#74c0fc', 'Meadow'],
    ['#f783ac', '#b197fc', 'Bubblegum'],
    ['#40e0d0', '#74c0fc', 'Lagoon'],
    ['#ffd43b', '#69db7c', 'Spring'],
    ['#ffd43b', '#ffa94d', 'Honey'],
    ['#ff6b6b', '#b197fc', 'Ember'],
    ['#ffa94d', '#f783ac', 'Peach fizz'],
    ['#4dabf7', '#20c997', 'Ocean'],
    ['#51cf66', '#20c997', 'Forest'],
    ['#9775fa', '#e64980', 'Berry'],
    ['#4c6ef5', '#da77f2', 'Nebula'],
    ['#3bc9db', '#4c6ef5', 'Deep sea'],
    ['#63e6be', '#9775fa', 'Aurora'],
    ['#a9e34b', '#ffd43b', 'Citrus'],
    ['#fcc419', '#ff6b6b', 'Sunset'],
    ['#868e96', '#74c0fc', 'Mist'],
];

const rgbOf = (hex: string): string => {
    const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16);
    return `${channel(1)},${channel(3)},${channel(5)}`;
};

const blockColorOf = (hex: string, alpha = 0.1): string => `rgba(${rgbOf(hex)},${alpha})`;

const gradientOf = (from: string, to: string, alpha = 0.15): string =>
    `linear-gradient(135deg, rgba(${rgbOf(from)},${alpha}) 0%, rgba(${rgbOf(to)},${alpha}) 100%)`;

// Grayscale, so it is not made from two hex colors like the others
const SILVER_GRADIENT = 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(150,150,150,0.1) 100%)';

const BUILT_IN: Record<tPaletteKind, iPaletteEntry[]> = {
    text: TEXT_COLORS.map(([value, label]) => ({ value, label })),
    block: [
        { value: 'transparent', label: 'None' },
        ...TEXT_COLORS.filter(([value]) => value !== 'inherit').map(([value, label]) => ({
            value: blockColorOf(value),
            label,
        })),
    ],
    gradient: [
        { value: '', label: 'None' },
        { value: SILVER_GRADIENT, label: 'Silver' },
        ...GRADIENT_PAIRS.map(([from, to, label]) => ({ value: gradientOf(from, to), label })),
    ],
};

// What is on until the user changes it
const DEFAULT_ENABLED: Record<tPaletteKind, string[]> = {
    text: ['inherit', '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc', '#adb5bd'],
    block: [
        'transparent',
        ...['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc', '#adb5bd'].map((hex) =>
            blockColorOf(hex),
        ),
    ],
    gradient: [
        '',
        gradientOf('#ff6b6b', '#ffa94d'),
        gradientOf('#74c0fc', '#b197fc'),
        gradientOf('#69db7c', '#74c0fc'),
        gradientOf('#f783ac', '#b197fc'),
        SILVER_GRADIENT,
        gradientOf('#40e0d0', '#74c0fc'),
        gradientOf('#ffd43b', '#69db7c'),
    ],
};

const defaultPalette = (): iPalette => ({
    text: { enabled: [...DEFAULT_ENABLED.text], custom: [] },
    block: { enabled: [...DEFAULT_ENABLED.block], custom: [] },
    gradient: { enabled: [...DEFAULT_ENABLED.gradient], custom: [] },
});

// The saved palette of an older version or a file can lack parts or be wrong
const sanitizePalette = (value: unknown): iPalette => {
    const fallback = defaultPalette();
    const source = (value ?? {}) as Partial<Record<tPaletteKind, Partial<iPaletteSlot>>>;
    const list = (input: unknown): string[] | undefined =>
        Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === 'string') : undefined;
    const slotOf = (kind: tPaletteKind): iPaletteSlot => {
        const custom = list(source[kind]?.custom) ?? [];
        const enabled = list(source[kind]?.enabled) ?? fallback[kind].enabled;
        return { enabled: [...new Set(enabled)].slice(0, MAX_ENABLED), custom: [...new Set(custom)] };
    };
    return { text: slotOf('text'), block: slotOf('block'), gradient: slotOf('gradient') };
};

// Everything of a kind that can be switched on: the built-in ones, then the ones of the user
const catalogOf = (kind: tPaletteKind, palette: iPalette): iPaletteEntry[] => [
    ...BUILT_IN[kind],
    ...palette[kind].custom.map((value) => ({ value, label: 'Custom', custom: true })),
];

// The ones that are on, in the order the user switched them on
const enabledOf = (kind: tPaletteKind, palette: iPalette): iPaletteEntry[] => {
    const catalog = catalogOf(kind, palette);
    return palette[kind].enabled
        .map((value) => catalog.find((entry) => entry.value === value))
        .filter((entry): entry is iPaletteEntry => !!entry);
};

// What a custom entry of a kind is made of
const customValueOf = (kind: tPaletteKind, colors: string[], alpha = 0.1): string => {
    if (kind === 'text') return colors[0];
    if (kind === 'block') return blockColorOf(colors[0], alpha);
    return gradientOf(colors[0], colors[1]);
};

export type { iPaletteEntry };
export {
    MAX_ENABLED,
    customValueOf,
    catalogOf,
    defaultPalette,
    enabledOf,
    sanitizePalette,
};
