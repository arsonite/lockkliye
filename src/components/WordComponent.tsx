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

import { useMemo } from 'react';
import type { iWord, iWordFormat, tFormatMode } from '@/types';

interface iWordComponentProps {
    word: iWord;
    formatMode: tFormatMode;
    selectedColor: string;
    isHovered: boolean;
    onHover: (wordId: string | null) => void;
    onClick: (wordId: string) => void;
}

export const WordComponent = ({
    word,
    formatMode,
    selectedColor,
    isHovered,
    onHover,
    onClick,
}: iWordComponentProps) => {
    const style = useMemo(() => {
        const s: React.CSSProperties = {};
        const f = word.format;

        if (f.bold) s.fontWeight = 'bold';
        if (f.italic) s.fontStyle = 'italic';
        if (f.underline) s.textDecoration = (s.textDecoration || '') + ' underline';
        if (f.strikethrough) s.textDecoration = (s.textDecoration || '') + ' line-through';
        if (f.color) s.color = f.color;
        if (f.highlight) s.backgroundColor = f.highlight;
        if (f.link) {
            s.color = s.color || '#0a84ff';
            s.textDecoration = (s.textDecoration || '') + ' underline';
            s.cursor = 'pointer';
        }

        switch (f.fontSize) {
            case 'tiny':
                s.fontSize = '0.75em';
                break;
            case 'smaller':
                s.fontSize = '0.85em';
                break;
            case 'large':
                s.fontSize = '1.1em';
                break;
            case 'larger':
                s.fontSize = '1.25em';
                break;
            case 'huge':
                s.fontSize = '1.5em';
                break;
        }

        return s;
    }, [word.format]);

    const getModePreviewStyle = (): React.CSSProperties => {
        if (!isHovered || !formatMode) return {};

        switch (formatMode) {
            case 'bold':
                return { fontWeight: 'bold' };
            case 'italic':
                return { fontStyle: 'italic' };
            case 'underline':
                return { textDecoration: 'underline' };
            case 'strikethrough':
                return { textDecoration: 'line-through' };
            case 'color':
                return { color: selectedColor };
            case 'highlight':
                return { backgroundColor: selectedColor + '40' };
            case 'tiny':
                return { fontSize: '0.75em' };
            case 'smaller':
                return { fontSize: '0.85em' };
            case 'normal':
                return { fontSize: '1em' };
            case 'large':
                return { fontSize: '1.1em' };
            case 'larger':
                return { fontSize: '1.25em' };
            case 'huge':
                return { fontSize: '1.5em' };
            default:
                return {};
        }
    };

    const handleClick = () => {
        if (formatMode) {
            onClick(word.id);
        }
    };

    return (
        <span
            className={`word ${formatMode ? 'word--mode-active' : ''} ${
                isHovered && formatMode ? 'word--hovered' : ''
            }`}
            style={{ ...style, ...getModePreviewStyle() }}
            onMouseEnter={() => onHover(word.id)}
            onMouseLeave={() => onHover(null)}
            onClick={handleClick}
            data-word-id={word.id}
        >
            {word.text || '\u00A0'}
        </span>
    );
};

// Helper to apply format based on current mode
export const applyFormatMode = (
    currentFormat: iWordFormat,
    mode: tFormatMode,
    selectedColor: string
): Partial<iWordFormat> => {
    switch (mode) {
        case 'bold':
            return { bold: !currentFormat.bold };
        case 'italic':
            return { italic: !currentFormat.italic };
        case 'underline':
            return { underline: !currentFormat.underline };
        case 'strikethrough':
            return { strikethrough: !currentFormat.strikethrough };
        case 'color':
            return { color: currentFormat.color === selectedColor ? undefined : selectedColor };
        case 'highlight':
            return { highlight: currentFormat.highlight ? undefined : selectedColor + '40' };
        case 'link':
            // Link mode is handled specially - this toggles the link off if already set
            // Setting a link is handled by the LinkModal component
            return currentFormat.link ? { link: undefined } : {};
        // Size modes - directly set the size
        case 'tiny':
            return { fontSize: 'tiny' };
        case 'smaller':
            return { fontSize: 'smaller' };
        case 'normal':
            return { fontSize: 'normal' };
        case 'large':
            return { fontSize: 'large' };
        case 'larger':
            return { fontSize: 'larger' };
        case 'huge':
            return { fontSize: 'huge' };
        default:
            return {};
    }
};
