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

// React imports
import { useRef, useCallback, useEffect, useState } from 'react';

// Components
import { applyFormatMode } from '@/components/WordComponent';
import LinkModal from '@/components/LinkModal';

// Types
import { createWord, iWord, iWordFormat, tFormatMode } from '@/types';

interface iRichTextEditorProps {
    words: iWord[];
    formatMode: tFormatMode;
    selectedColor: string;
    selectedSize: string;
    onWordsChange: (words: iWord[]) => void;
    onAddBlockAfter: () => void;
    onClearFormatMode?: () => void;
    placeholder?: string;
}

// Link modal state
interface iLinkModalState {
    isOpen: boolean;
    wordId: string | null;
    currentLink?: string;
    wordText: string;
    position: { x: number; y: number };
}

// Generate inline styles from word format
const getWordStyle = (format: iWordFormat): React.CSSProperties => {
    const style: React.CSSProperties = {};

    if (format.bold) style.fontWeight = 'bold';
    if (format.italic) style.fontStyle = 'italic';
    if (format.underline) style.textDecoration = (style.textDecoration || '') + ' underline';
    if (format.strikethrough) style.textDecoration = (style.textDecoration || '') + ' line-through';
    // 'inherit' means use the default text color, so don't set any color style
    if (format.color && format.color !== 'inherit') style.color = format.color;
    if (format.highlight) style.backgroundColor = format.highlight;
    if (format.link) {
        if (!format.color || format.color === 'inherit') style.color = '#0a84ff';
        style.textDecoration = (style.textDecoration || '') + ' underline';
        style.cursor = 'pointer';
    }

    switch (format.fontSize) {
        case 'tiny':
            style.fontSize = '0.75em';
            break;
        case 'smaller':
            style.fontSize = '0.85em';
            break;
        case 'large':
            style.fontSize = '1.1em';
            break;
        case 'larger':
            style.fontSize = '1.25em';
            break;
        case 'huge':
            style.fontSize = '1.5em';
            break;
    }

    return style;
};

// Convert CSS style object to inline style string
const styleToString = (style: React.CSSProperties): string => {
    return Object.entries(style)
        .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
        })
        .join('; ');
};

export const RichTextEditor: React.FC<iRichTextEditorProps> = ({
    words,
    formatMode,
    selectedColor,
    selectedSize: _selectedSize,
    onWordsChange,
    onAddBlockAfter,
    onClearFormatMode,
    placeholder = 'Click to edit...',
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const wordsRef = useRef(words);

    // Link modal state
    const [linkModal, setLinkModal] = useState<iLinkModalState>({
        isOpen: false,
        wordId: null,
        currentLink: undefined,
        wordText: '',
        position: { x: 0, y: 0 },
    });

    // Keep wordsRef in sync
    useEffect(() => {
        wordsRef.current = words;
    }, [words]);

    // Update DOM to reflect words - call this after formatting
    const updateDOMContent = useCallback((wordList: iWord[]) => {
        if (!editorRef.current) return;
        const html = renderWordsAsHTML(wordList);
        if (html) {
            editorRef.current.innerHTML = html;
        }
    }, []);

    // Update styles of specific words in-place without rewriting DOM (preserves cursor)
    const updateWordStylesInPlace = useCallback((wordIds: string[], wordList: iWord[]) => {
        if (!editorRef.current) return;

        wordIds.forEach((wordId) => {
            const span = editorRef.current?.querySelector(`span[data-word-id="${wordId}"]`);
            if (span && span instanceof HTMLElement) {
                const word = wordList.find((w) => w.id === wordId);
                if (word) {
                    const style = getWordStyle(word.format);
                    const styleStr = styleToString(style);
                    span.setAttribute('style', styleStr);

                    // Update link class
                    if (word.format.link) {
                        span.classList.add('rich-text-editor__linked');
                    } else {
                        span.classList.remove('rich-text-editor__linked');
                    }
                }
            }
        });
    }, []);

    // Render words as HTML with formatting
    const renderWordsAsHTML = useCallback((wordList: iWord[]): string => {
        if (wordList.length === 0 || (wordList.length === 1 && !wordList[0].text)) {
            return '';
        }

        return wordList
            .map((word, idx) => {
                if (word.text === '\n') {
                    return '<br>';
                }

                if (word.text === '\t') {
                    return `<span data-word-id="${word.id}" class="rich-text-editor__tab">\t</span>`;
                }

                // Handle non-breaking space indent markers (4 nbsp)
                if (word.text === '\u00A0\u00A0\u00A0\u00A0') {
                    return `<span data-word-id="${word.id}" class="rich-text-editor__indent">\u00A0\u00A0\u00A0\u00A0</span>`;
                }

                const style = getWordStyle(word.format);
                const styleStr = styleToString(style);
                const space =
                    idx < wordList.length - 1 &&
                    wordList[idx + 1]?.text !== '\n' &&
                    wordList[idx + 1]?.text !== '\t' &&
                    wordList[idx + 1]?.text !== '\u00A0\u00A0\u00A0\u00A0'
                        ? ' '
                        : '';

                // Add link class for hyperlinked words (indicator is added via CSS ::after)
                const linkClass = word.format.link ? ' rich-text-editor__linked' : '';

                if (styleStr || linkClass) {
                    return `<span data-word-id="${word.id}" class="rich-text-editor__word${linkClass}" style="${styleStr}">${word.text}</span>${space}`;
                }
                return `<span data-word-id="${word.id}" class="rich-text-editor__word">${word.text}</span>${space}`;
            })
            .join('');
    }, []);

    // Parse HTML content back to words
    const parseHTMLToWords = useCallback((element: HTMLElement): iWord[] => {
        const result: iWord[] = [];

        const processNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                // Split by whitespace while preserving it (including tabs)
                const parts = text.split(/(\s+)/);

                // Check if this text node is inside a word span with existing ID
                const parentSpan = node.parentElement;
                const parentWordId = parentSpan?.tagName === 'SPAN' ? parentSpan.getAttribute('data-word-id') : null;
                const existingWord = parentWordId ? wordsRef.current.find((w) => w.id === parentWordId) : null;

                parts.forEach((part) => {
                    if (part === '\n' || part.includes('\n')) {
                        // Handle newlines
                        const lines = part.split('\n');
                        lines.forEach((line, idx) => {
                            if (line.trim()) {
                                line.split(/\s+/)
                                    .filter(Boolean)
                                    .forEach((word) => {
                                        result.push(createWord(word));
                                    });
                            } else if (line.includes('\t')) {
                                // Preserve tabs
                                const tabCount = (line.match(/\t/g) || []).length;
                                for (let i = 0; i < tabCount; i++) {
                                    result.push(createWord('\t'));
                                }
                            }
                            if (idx < lines.length - 1) {
                                result.push(createWord('\n'));
                            }
                        });
                    } else if (part === '\t' || part.includes('\t')) {
                        // Handle tabs
                        const tabCount = (part.match(/\t/g) || []).length;
                        for (let i = 0; i < tabCount; i++) {
                            result.push(createWord('\t'));
                        }
                        // Also handle any non-tab content mixed with tabs
                        const nonTabParts = part.split('\t').filter(Boolean);
                        nonTabParts.forEach((nonTab) => {
                            if (nonTab.trim()) {
                                result.push(createWord(nonTab.trim()));
                            }
                        });
                    } else if (part.includes('\u00A0')) {
                        // Handle non-breaking spaces (used for fake tabs/indentation)
                        // Count groups of 4 non-breaking spaces as indent markers
                        const nbspCount = (part.match(/\u00A0/g) || []).length;
                        if (nbspCount >= 4) {
                            // Store as indent word (4 nbsp = 1 indent)
                            const indentCount = Math.floor(nbspCount / 4);
                            for (let i = 0; i < indentCount; i++) {
                                result.push(createWord('\u00A0\u00A0\u00A0\u00A0'));
                            }
                        }
                    } else if (part.trim()) {
                        // Regular word - preserve ID and format if from existing word span
                        if (existingWord && part.trim() === existingWord.text) {
                            // Preserve the existing word with its ID and format
                            result.push({ ...existingWord });
                        } else if (parentSpan && parentSpan.tagName === 'SPAN') {
                            // Parse format from the existing word or span styles
                            let format: iWordFormat = {};

                            if (existingWord) {
                                format = { ...existingWord.format };
                            } else {
                                // Parse styles from the element
                                const style = parentSpan.style;
                                if (style.fontWeight === 'bold') format.bold = true;
                                if (style.fontStyle === 'italic') format.italic = true;
                                if (style.textDecoration?.includes('underline')) format.underline = true;
                                if (style.textDecoration?.includes('line-through')) format.strikethrough = true;
                                if (style.color) format.color = style.color;
                                if (style.backgroundColor) format.highlight = style.backgroundColor;
                                if (style.fontSize) {
                                    const fs = style.fontSize;
                                    if (fs === '0.75em') format.fontSize = 'tiny';
                                    else if (fs === '0.85em') format.fontSize = 'smaller';
                                    else if (fs === '1.1em') format.fontSize = 'large';
                                    else if (fs === '1.25em') format.fontSize = 'larger';
                                    else if (fs === '1.5em') format.fontSize = 'huge';
                                }
                            }

                            result.push(createWord(part.trim(), format));
                        } else {
                            result.push(createWord(part.trim()));
                        }
                    }
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;

                if (el.tagName === 'BR') {
                    // Always add newline for BR - this allows empty lines
                    result.push(createWord('\n'));
                    return;
                }

                if (el.tagName === 'DIV' && result.length > 0) {
                    // New div means new line (contenteditable behavior)
                    // Only add if last isn't already a newline
                    const lastWord = result[result.length - 1];
                    if (lastWord && lastWord.text !== '\n') {
                        result.push(createWord('\n'));
                    }
                }

                // Process children
                el.childNodes.forEach((child) => processNode(child));
            }
        };

        element.childNodes.forEach((child) => processNode(child));

        // Don't strip trailing newlines anymore - preserve them for empty lines
        // Only remove excessive consecutive newlines (more than 2)
        const cleaned: iWord[] = [];
        let consecutiveNewlines = 0;

        for (const word of result) {
            if (word.text === '\n') {
                consecutiveNewlines++;
                // Allow up to 2 consecutive newlines (one empty line)
                if (consecutiveNewlines <= 2) {
                    cleaned.push(word);
                }
            } else {
                consecutiveNewlines = 0;
                cleaned.push(word);
            }
        }

        // Remove leading newlines only
        while (cleaned.length > 0 && cleaned[0].text === '\n') {
            cleaned.shift();
        }

        if (cleaned.length === 0) {
            return [createWord('')];
        }

        return cleaned;
    }, []);

    // Save cursor position
    const saveCursorPosition = useCallback((): { start: number; end: number } | null => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || !editorRef.current) return null;

        const range = selection.getRangeAt(0);
        const preRange = range.cloneRange();
        preRange.selectNodeContents(editorRef.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;

        const endRange = range.cloneRange();
        endRange.selectNodeContents(editorRef.current);
        endRange.setEnd(range.endContainer, range.endOffset);
        const end = endRange.toString().length;

        return { start, end };
    }, []);

    // Restore cursor position
    const restoreCursorPosition = useCallback((pos: { start: number; end: number }) => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        let charCount = 0;
        let startNode: Node | null = null;
        let startOffset = 0;
        let endNode: Node | null = null;
        let endOffset = 0;

        const traverse = (node: Node): boolean => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                const textLen = text.length;

                if (!startNode && charCount + textLen >= pos.start) {
                    startNode = node;
                    startOffset = pos.start - charCount;
                }

                if (!endNode && charCount + textLen >= pos.end) {
                    endNode = node;
                    endOffset = pos.end - charCount;
                    return true; // Done
                }

                charCount += textLen;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if ((node as HTMLElement).tagName === 'BR') {
                    charCount += 1;
                    if (!startNode && charCount >= pos.start) {
                        startNode = node;
                        startOffset = 0;
                    }
                    if (!endNode && charCount >= pos.end) {
                        endNode = node;
                        endOffset = 0;
                    }
                } else {
                    for (const child of Array.from(node.childNodes)) {
                        if (traverse(child)) return true;
                    }
                }
            }
            return false;
        };

        traverse(editorRef.current);

        if (startNode && endNode) {
            try {
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch {
                // Cursor position failed, that's okay
            }
        }
    }, []);

    // Get currently selected word IDs
    const getSelectedWordIds = useCallback((): string[] => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || !editorRef.current) return [];

        const selectedIds: string[] = [];

        // Find all spans within the selection
        const spans = editorRef.current.querySelectorAll('span[data-word-id]');
        spans.forEach((span) => {
            if (selection.containsNode(span, true)) {
                const id = span.getAttribute('data-word-id');
                if (id) selectedIds.push(id);
            }
        });

        return selectedIds;
    }, []);

    // Apply formatting to selected words
    const applyFormattingToSelection = useCallback(() => {
        if (!formatMode || !editorRef.current) return false;

        const selectedIds = getSelectedWordIds();
        if (selectedIds.length === 0) return false;

        const newWords = wordsRef.current.map((word) => {
            if (selectedIds.includes(word.id)) {
                const updates = applyFormatMode(word.format, formatMode, selectedColor);
                return { ...word, format: { ...word.format, ...updates } };
            }
            return word;
        });

        // Update words ref immediately for instant update
        wordsRef.current = newWords;

        // Update state
        onWordsChange(newWords);

        // Update styles in-place to preserve cursor/selection
        updateWordStylesInPlace(selectedIds, newWords);

        // Only clear format mode if editor is focused (typing mode)
        // Keep format mode active for quick formatting in non-edit mode
        if (onClearFormatMode && isFocused) {
            onClearFormatMode();
        }

        return true;
    }, [
        formatMode,
        selectedColor,
        getSelectedWordIds,
        onWordsChange,
        updateWordStylesInPlace,
        onClearFormatMode,
        isFocused,
    ]);

    // Apply formatting to a single word by ID
    const applyFormattingToWord = useCallback(
        (wordId: string) => {
            if (!formatMode) return;

            const newWords = wordsRef.current.map((word) => {
                if (word.id === wordId) {
                    const updates = applyFormatMode(word.format, formatMode, selectedColor);
                    return { ...word, format: { ...word.format, ...updates } };
                }
                return word;
            });

            // Update words ref immediately
            wordsRef.current = newWords;

            onWordsChange(newWords);

            // Update style in-place to preserve cursor
            updateWordStylesInPlace([wordId], newWords);

            // Only clear format mode if editor is focused (typing mode)
            // Keep format mode active for quick formatting in non-edit mode
            if (onClearFormatMode && isFocused) {
                onClearFormatMode();
            }
        },
        [formatMode, selectedColor, onWordsChange, updateWordStylesInPlace, onClearFormatMode, isFocused]
    );

    // Track previous format mode to detect changes
    const prevFormatModeRef = useRef<tFormatMode>(null);

    // Handle format mode changes - apply to selection when format mode is activated
    useEffect(() => {
        // Only apply if format mode changed from null/different to a new mode
        if (formatMode && prevFormatModeRef.current !== formatMode) {
            // Small delay to let selection settle
            const timer = setTimeout(() => {
                applyFormattingToSelection();
            }, 10);
            prevFormatModeRef.current = formatMode;
            return () => clearTimeout(timer);
        }
        if (!formatMode) {
            prevFormatModeRef.current = null;
        }
    }, [formatMode, applyFormattingToSelection]);

    // Handle input changes
    const handleInput = useCallback(() => {
        if (!editorRef.current) return;

        const newWords = parseHTMLToWords(editorRef.current);

        // Auto-convert "- " at the start of a line to bullet
        const convertedWords = newWords.map((word, idx) => {
            if (word.text === '-') {
                // Check if it's at the start or after a newline
                const prevWord = newWords[idx - 1];
                const nextWord = newWords[idx + 1];
                const isAtStart = idx === 0 || (prevWord && prevWord.text === '\n');
                // If next word exists and isn't a newline, convert "-" to "•"
                if (isAtStart && nextWord && nextWord.text !== '\n') {
                    return { ...word, text: '•' };
                }
            }
            return word;
        });

        onWordsChange(convertedWords);

        // Don't restore cursor here - let the content update naturally
    }, [parseHTMLToWords, onWordsChange]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                onAddBlockAfter();
                return;
            }

            // Handle Tab key - insert 4 non-breaking spaces instead of tab character
            // Using \u00A0 (non-breaking space) prevents them from being collapsed
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\u00A0\u00A0\u00A0\u00A0');
                return;
            }

            // Regular Enter inserts newline (default contenteditable behavior)
        },
        [onAddBlockAfter]
    );

    // Handle paste - strip formatting and insert plain text
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    }, []);

    // Handle saving a link to a word
    const handleLinkSave = useCallback(
        (url: string) => {
            if (!linkModal.wordId) return;

            const newWords = wordsRef.current.map((word) => {
                if (word.id === linkModal.wordId) {
                    return { ...word, format: { ...word.format, link: url } };
                }
                return word;
            });

            wordsRef.current = newWords;
            onWordsChange(newWords);
            updateDOMContent(newWords);
        },
        [linkModal.wordId, onWordsChange, updateDOMContent]
    );

    // Handle deleting a link from a word
    const handleLinkDelete = useCallback(() => {
        if (!linkModal.wordId) return;

        const newWords = wordsRef.current.map((word) => {
            if (word.id === linkModal.wordId) {
                const { link: _, ...restFormat } = word.format;
                return { ...word, format: restFormat };
            }
            return word;
        });

        wordsRef.current = newWords;
        onWordsChange(newWords);
        updateDOMContent(newWords);
    }, [linkModal.wordId, onWordsChange, updateDOMContent]);

    // Close link modal
    const handleLinkModalClose = useCallback(() => {
        setLinkModal({
            isOpen: false,
            wordId: null,
            currentLink: undefined,
            wordText: '',
            position: { x: 0, y: 0 },
        });
    }, []);

    // Open link modal for a word
    const openLinkModal = useCallback((wordId: string, wordSpan: Element) => {
        const word = wordsRef.current.find((w) => w.id === wordId);
        if (!word) return;

        const rect = wordSpan.getBoundingClientRect();
        setLinkModal({
            isOpen: true,
            wordId,
            currentLink: word.format.link,
            wordText: word.text,
            position: {
                x: rect.left + rect.width / 2,
                y: rect.top,
            },
        });
    }, []);

    // Handle click on words when in format mode (for selection-based formatting)
    // Also handles link clicks (Ctrl+click to open, click to edit)
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            const target = e.target as HTMLElement;
            const wordSpan = target.closest('span[data-word-id]');

            if (wordSpan) {
                const wordId = wordSpan.getAttribute('data-word-id');
                if (wordId) {
                    const word = wordsRef.current.find((w) => w.id === wordId);

                    // Check if it's a linked word
                    if (word?.format.link) {
                        if (e.ctrlKey || e.metaKey) {
                            // Ctrl+click opens the link
                            e.preventDefault();
                            window.open(word.format.link, '_blank', 'noopener,noreferrer');
                            return;
                        } else if (!formatMode) {
                            // Regular click on linked word opens edit modal (only when not in format mode)
                            e.preventDefault();
                            openLinkModal(wordId, wordSpan);
                            return;
                        }
                    }

                    // Handle link format mode - open modal for adding link
                    if (formatMode === 'link') {
                        e.preventDefault();
                        openLinkModal(wordId, wordSpan);
                        return;
                    }
                }
            }

            if (!formatMode || !editorRef.current) return;

            // In edit mode with selection, apply formatting to selection
            if (isFocused) {
                const selection = window.getSelection();
                const hasSelection = selection && selection.toString().trim().length > 0;
                if (hasSelection) {
                    applyFormattingToSelection();
                }
            }
        },
        [formatMode, isFocused, applyFormattingToSelection, openLinkModal]
    );

    // Handle mousedown for format mode clicking
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (!formatMode || !editorRef.current) return;

            // Link mode is handled by handleClick to open modal
            if (formatMode === 'link') return;

            const target = e.target as HTMLElement;
            const wordSpan = target.closest('span[data-word-id]');

            // If user is focused (editing mode), allow selection for multi-word formatting
            if (isFocused) {
                // Don't prevent default - allow text selection
                // Selection-based formatting is handled by the useEffect that watches formatMode
                return;
            }

            // In non-edit mode (clicking from outside), prevent selection and format single word
            if (wordSpan) {
                e.preventDefault();
                const wordId = wordSpan.getAttribute('data-word-id');
                if (wordId) {
                    applyFormattingToWord(wordId);
                }
            }
        },
        [formatMode, applyFormattingToWord, isFocused]
    );

    // Handle mouseup - only prevent selection in format mode when NOT editing
    const handleMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (formatMode && !isFocused) {
                e.preventDefault();
                // Clear any accidental selection only in non-edit mode
                window.getSelection()?.removeAllRanges();
            }
        },
        [formatMode, isFocused]
    );

    // Handle selectstart to prevent text selection in format mode when NOT editing
    const handleSelectStart = useCallback(
        (e: React.SyntheticEvent) => {
            if (formatMode && !isFocused) {
                e.preventDefault();
            }
        },
        [formatMode, isFocused]
    );

    // Sync content when words change externally
    useEffect(() => {
        if (!editorRef.current || isFocused) return;

        const html = renderWordsAsHTML(words);
        if (editorRef.current.innerHTML !== html) {
            editorRef.current.innerHTML = html || `<span class="rich-text-editor__placeholder">${placeholder}</span>`;
        }
    }, [words, isFocused, renderWordsAsHTML, placeholder]);

    // Initial render
    useEffect(() => {
        if (editorRef.current) {
            const html = renderWordsAsHTML(words);
            editorRef.current.innerHTML = html || `<span class="rich-text-editor__placeholder">${placeholder}</span>`;
        }
    }, []);

    const handleFocus = () => {
        setIsFocused(true);
        if (editorRef.current) {
            // Remove placeholder if present
            const ph = editorRef.current.querySelector('.rich-text-editor__placeholder');
            if (ph) {
                editorRef.current.innerHTML = '';
            }
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        handleInput(); // Final save on blur

        // Show placeholder if empty
        if (editorRef.current && !editorRef.current.textContent?.trim()) {
            editorRef.current.innerHTML = `<span class="rich-text-editor__placeholder">${placeholder}</span>`;
        }
    };

    return (
        <>
            <div
                ref={editorRef}
                className={`rich-text-editor ${isFocused ? 'rich-text-editor--focused' : ''} ${
                    formatMode ? 'rich-text-editor--format-mode' : ''
                }`}
                contentEditable={!formatMode || isFocused}
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onSelect={handleSelectStart}
                spellCheck={false}
                style={formatMode && !isFocused ? { userSelect: 'none', caretColor: 'transparent' } : undefined}
            />
            <LinkModal
                isOpen={linkModal.isOpen}
                currentLink={linkModal.currentLink}
                wordText={linkModal.wordText}
                position={linkModal.position}
                onSave={handleLinkSave}
                onDelete={handleLinkDelete}
                onClose={handleLinkModalClose}
            />
        </>
    );
};

export default RichTextEditor;
