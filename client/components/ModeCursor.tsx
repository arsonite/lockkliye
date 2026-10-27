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

// Hooks
import useMousePosition from '@/hooks/useMousePosition';

// Types
import type { tFormatMode } from '@/types';
import React from 'react';

interface iModeCursorProps {
    formatMode: tFormatMode;
    selectedColor: string;
}

const getModeIcon = (mode: tFormatMode): string => {
    switch (mode) {
        case 'bold':
            return 'B';
        case 'italic':
            return 'I';
        case 'underline':
            return 'U';
        case 'strikethrough':
            return 'S';
        case 'color':
            return '◉';
        case 'highlight':
            return '◌';
        case 'larger':
            return 'A+';
        case 'smaller':
            return 'A-';
        default:
            return '';
    }
};

const ModeCursor: React.FC<iModeCursorProps> = ({ formatMode, selectedColor }) => {
    const { x, y } = useMousePosition();

    if (!formatMode) return null;

    const isColorMode = formatMode === 'color' || formatMode === 'highlight';

    return (
        <div
            className='mode-cursor'
            style={{
                left: x + 15,
                top: y + 15,
                borderColor: isColorMode ? selectedColor : undefined,
            }}
        >
            <span
                className='mode-cursor__icon'
                style={{
                    color: formatMode === 'color' ? selectedColor : undefined,
                    backgroundColor: formatMode === 'highlight' ? selectedColor + '40' : undefined,
                }}
            >
                {getModeIcon(formatMode)}
            </span>
            <span className='mode-cursor__label'>mode:{formatMode}</span>
        </div>
    );
};

export default ModeCursor;
