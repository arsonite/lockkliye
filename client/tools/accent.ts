/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

const DEFAULT_ACCENT = '#ff9500';

const HEX = /^#[0-9a-f]{6}$/i;

const sanitizeAccent = (value: unknown): string => (typeof value === 'string' && HEX.test(value) ? value : DEFAULT_ACCENT);

// The accent variables of a color: hover is lighter on a dark and darker on a light background, the glow is a veil
const accentVars = (color: string, light: boolean): Record<string, string> => {
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    const hex = (channel: number) => Math.round(channel).toString(16).padStart(2, '0');
    const towards = light ? 0 : 255;
    const mixed = [r, g, b].map((channel) => channel + (towards - channel) * 0.2);

    return {
        '--accent': color,
        '--accent-hover': `#${mixed.map(hex).join('')}`,
        '--accent-glow': `rgba(${r}, ${g}, ${b}, ${light ? 0.2 : 0.3})`,
    };
};

export { DEFAULT_ACCENT, accentVars, sanitizeAccent };
