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
import type { iAnchorStyle, tAnchorLine } from '@/types';

const ANCHOR_LINES: tAnchorLine[] = ['dashed', 'solid'];

const DEFAULT_ANCHOR_STYLE: iAnchorStyle = { line: 'dashed', bold: false };

const sanitizeAnchorStyle = (value: unknown): iAnchorStyle => {
    const { line, bold } = (value ?? {}) as Record<string, unknown>;
    return {
        line: ANCHOR_LINES.includes(line as tAnchorLine) ? (line as tAnchorLine) : DEFAULT_ANCHOR_STYLE.line,
        bold: typeof bold === 'boolean' ? bold : DEFAULT_ANCHOR_STYLE.bold,
    };
};

// The variables that `span.rich-text-editor__anchored` reads
const anchorVars = ({ line, bold }: iAnchorStyle): Record<string, string> => ({
    '--anchor-line': line,
    '--anchor-weight': bold ? '700' : 'inherit',
});

export { ANCHOR_LINES, DEFAULT_ANCHOR_STYLE, anchorVars, sanitizeAnchorStyle };
