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
import {
    iBlockStyle, iNote, iTextBlock, iWord, iWordFormat,
    FORMAT_COLORS,
    createWord, createBlock, createNote,
} from '@/types';

// Word lists for generating random text
const NOUNS = [
    'time', 'year', 'people', 'way', 'day', 'man', 'woman', 'child', 'world', 'life',
    'hand', 'part', 'place', 'case', 'week', 'company', 'system', 'program', 'question', 'work',
    'government', 'number', 'night', 'point', 'home', 'water', 'room', 'mother', 'area', 'money',
    'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word',
    'business', 'issue', 'side', 'kind', 'head', 'house', 'service', 'friend', 'father', 'power',
    'hour', 'game', 'line', 'end', 'member', 'law', 'car', 'city', 'community', 'name',
    'president', 'team', 'minute', 'idea', 'kid', 'body', 'information', 'back', 'parent', 'face',
    'others', 'level', 'office', 'door', 'health', 'person', 'art', 'war', 'history', 'party',
    'result', 'change', 'morning', 'reason', 'research', 'girl', 'guy', 'moment', 'air', 'teacher'
];

const VERBS = [
    'be', 'have', 'do', 'say', 'get', 'make', 'go', 'know', 'take', 'see',
    'come', 'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask', 'work',
    'seem', 'feel', 'try', 'leave', 'call', 'need', 'become', 'put', 'mean', 'keep',
    'let', 'begin', 'help', 'show', 'hear', 'play', 'run', 'move', 'live', 'believe',
    'hold', 'bring', 'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet',
    'include', 'continue', 'set', 'learn', 'change', 'lead', 'understand', 'watch', 'follow', 'stop'
];

const ADJECTIVES = [
    'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other', 'old',
    'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important',
    'few', 'public', 'bad', 'same', 'able', 'human', 'local', 'sure', 'free', 'better',
    'strong', 'possible', 'whole', 'special', 'real', 'best', 'open', 'full', 'clear', 'easy',
    'hard', 'simple', 'beautiful', 'happy', 'dark', 'light', 'quick', 'slow', 'warm', 'cold'
];

const ADVERBS = [
    'up', 'so', 'out', 'just', 'now', 'how', 'then', 'more', 'also', 'here',
    'well', 'only', 'very', 'even', 'back', 'there', 'down', 'still', 'in', 'as',
    'too', 'when', 'never', 'really', 'most', 'already', 'always', 'often', 'away', 'again',
    'however', 'perhaps', 'usually', 'quite', 'almost', 'probably', 'certainly', 'quickly', 'slowly', 'finally'
];

const PREPOSITIONS = [
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'or',
    'about', 'into', 'over', 'after', 'beneath', 'under', 'above', 'through', 'between', 'during'
];

const ARTICLES = ['the', 'a', 'an'];
const CONJUNCTIONS = ['and', 'but', 'or', 'yet', 'so', 'because', 'although', 'while', 'if', 'when'];

const TITLE_WORDS = [
    'Guide', 'Notes', 'Ideas', 'Thoughts', 'Plan', 'List', 'Review', 'Summary', 'Analysis', 'Overview',
    'Project', 'Meeting', 'Task', 'Goal', 'Vision', 'Strategy', 'Report', 'Update', 'Reminder', 'Draft',
    'Quick', 'Important', 'Daily', 'Weekly', 'Monthly', 'Personal', 'Work', 'Creative', 'Research', 'Learning'
];

// Helper to pick random item from array
const pick = <T>(arr: T[]): T => {
    return arr[Math.floor(Math.random() * arr.length)];
};

// Helper to pick random number in range
const randInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate a random sentence
const generateSentence = (minWords: number = 5, maxWords: number = 15): string => {
    const wordCount = randInt(minWords, maxWords);
    const words: string[] = [];

    // Start with article + adjective + noun pattern
    words.push(pick(ARTICLES));
    if (Math.random() > 0.5) {
        words.push(pick(ADJECTIVES));
    };
    words.push(pick(NOUNS));
    words.push(pick(VERBS));

    // Fill remaining with mixed words
    while (words.length < wordCount) {
        const rand = Math.random();
        if (rand < 0.2) {
            words.push(pick(ARTICLES));
        } else if (rand < 0.35) {
            words.push(pick(ADJECTIVES))
        } else if (rand < 0.5) {
            words.push(pick(ADVERBS));
        } else if (rand < 0.7) {
            words.push(pick(NOUNS));
        } else if (rand < 0.85) {
            words.push(pick(VERBS));
        } else if (rand < 0.92) {
            words.push(pick(PREPOSITIONS));
        } else {
            words.push(pick(CONJUNCTIONS));
        }
    }

    // Capitalize first word and add period
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(' ') + '.';
};

// Generate a paragraph with multiple sentences
const generateParagraph = (minSentences: number = 3, maxSentences: number = 7): string => {
    const sentenceCount = randInt(minSentences, maxSentences);
    const sentences: string[] = [];
    for (let i = 0; i < sentenceCount; i++) {
        sentences.push(generateSentence());
    }
    return sentences.join(' ');
};

// Generate short text (~50-100 words)
const generateShortText = (): string => {
    return generateParagraph(3, 5);
};

// Generate long text (~200-500 words)
const generateLongText = (): string => {
    const paragraphs: string[] = [];
    const paragraphCount = randInt(3, 5);
    for (let i = 0; i < paragraphCount; i++) {
        paragraphs.push(generateParagraph(5, 8));
    }
    return paragraphs.join('\n\n');
};

// Generate title text
const generateTitle = (): string => {
    const style = randInt(1, 4);
    switch (style) {
        case 1: // Simple: "Word Word"
            return `${pick(TITLE_WORDS)} ${pick(TITLE_WORDS)}`;
        case 2: // "The Word Word"
            return `The ${pick(ADJECTIVES).charAt(0).toUpperCase() + pick(ADJECTIVES).slice(1)} ${pick(TITLE_WORDS)}`;
        case 3: // "Word: A Word"
            return `${pick(TITLE_WORDS)}: ${pick(ARTICLES).charAt(0).toUpperCase() + pick(ARTICLES).slice(1)} ${pick(TITLE_WORDS)}`;
        default: // Single word
            return pick(TITLE_WORDS);
    }
};

// Background colors for blocks
const BG_COLORS = [
    'transparent',
    'rgba(255,107,107,0.1)',
    'rgba(255,169,77,0.1)',
    'rgba(255,212,59,0.1)',
    'rgba(105,219,124,0.1)',
    'rgba(116,192,252,0.1)',
    'rgba(177,151,252,0.1)',
    'rgba(247,131,172,0.1)',
];

const GRADIENTS = [
    '',
    'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,169,77,0.15) 100%)',
    'linear-gradient(135deg, rgba(116,192,252,0.15) 0%, rgba(177,151,252,0.15) 100%)',
    'linear-gradient(135deg, rgba(105,219,124,0.15) 0%, rgba(116,192,252,0.15) 100%)',
    'linear-gradient(135deg, rgba(247,131,172,0.15) 0%, rgba(177,151,252,0.15) 100%)',
    'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(150,150,150,0.1) 100%)',
];

const BORDER_STYLES: Array<'none' | 'solid' | 'dashed' | 'dotted' | 'double'> = ['none', 'solid', 'dashed', 'dotted', 'double'];
const BORDER_RADII = [0, 2, 4, 6, 8, 10, 12, 16, 20];

// Generate random word format
const generateRandomFormat = (): iWordFormat => {
    const format: iWordFormat = {};
    // Random chance for each format option
    if (Math.random() < 0.15) {
        format.bold = true;
    };
    if (Math.random() < 0.1) {
        format.italic = true;
    };
    if (Math.random() < 0.05) {
        format.underline = true;
    };
    if (Math.random() < 0.03) {
        format.strikethrough = true;
    };
    if (Math.random() < 0.1) {
        format.color = pick(FORMAT_COLORS);
    };
    if (Math.random() < 0.08) {
        format.highlight = pick(FORMAT_COLORS) + '40';
    };
    if (Math.random() < 0.1) {
        const sizes: Array<'tiny' | 'smaller' | 'normal' | 'large' | 'larger' | 'huge'> = ['tiny', 'smaller', 'normal', 'large', 'larger', 'huge'];
        format.fontSize = pick(sizes);
    }
    if (Math.random() < 0.03) {
        format.link = 'https://example.com/' + pick(NOUNS);
    };
    return format;
};

// Generate random block style
const generateRandomBlockStyle = (): iBlockStyle => {
    const style: iBlockStyle = {};

    // 30% chance for title
    if (Math.random() < 0.3) {
        style.title = pick(TITLE_WORDS);
    }

    // 40% chance for border
    if (Math.random() < 0.4) {
        style.borderStyle = pick(BORDER_STYLES.filter(s => s !== 'none'));
        style.borderRadius = pick(BORDER_RADII);
    }

    // 50% chance for background
    if (Math.random() < 0.5) {
        if (Math.random() < 0.6) {
            style.backgroundColor = pick(BG_COLORS.filter(c => c !== 'transparent'));
        } else {
            style.backgroundGradient = pick(GRADIENTS.filter(g => g !== ''));
        }
    }

    // 20% chance for custom width
    if (Math.random() < 0.2) {
        style.widthPercent = pick([50, 60, 70, 80, 90, 100]);
    }
    return style;
};

// Generate words from text with random formatting
const textToWordsWithFormat = (text: string, applyRandomFormat: boolean = true): iWord[] => {
    return text.split(/\s+/).map(word => {
        const format = applyRandomFormat ? generateRandomFormat() : {};
        return createWord(word, format);
    });
};

// Generate a bullet list block
const generateBulletListBlock = (): iTextBlock => {
    const itemCount = randInt(3, 6);
    const words: iWord[] = [];

    for (let i = 0; i < itemCount; i++) {
        // Add bullet
        words.push(createWord('•'));

        // Add 3-8 words for this item
        const itemWordCount = randInt(3, 8);
        for (let j = 0; j < itemWordCount; j++) {
            const wordPool = Math.random() < 0.5 ? NOUNS : (Math.random() < 0.5 ? VERBS : ADJECTIVES);
            const format = Math.random() < 0.1 ? generateRandomFormat() : {};
            words.push(createWord(pick(wordPool), format));
        }

        // Add newline except for last item
        if (i < itemCount - 1) {
            words.push(createWord('\n'));
        }
    }

    return createBlock(words, generateRandomBlockStyle());
};

// Generate a random text block
const generateTextBlock = (sentenceCount: number = 3): iTextBlock => {
    const sentences: string[] = [];
    for (let i = 0; i < sentenceCount; i++) {
        sentences.push(generateSentence());
    }
    const text = sentences.join(' ');
    const words = textToWordsWithFormat(text, true);
    return createBlock(words, generateRandomBlockStyle());
};

// Generate a heading block
const generateHeadingBlock = (): iTextBlock => {
    const title = generateTitle();
    const words = title.split(/\s+/).map(word =>
        createWord(word, { bold: true, fontSize: 'larger' })
    );
    return createBlock(words, { borderRadius: 4 });
};

// Generate a completely random note
const generateRandomNote = (): iNote => {
    const note = createNote(generateTitle());
    const blocks: iTextBlock[] = [];

    // Always start with a heading
    blocks.push(generateHeadingBlock());

    // Add 3-8 random blocks
    const blockCount = randInt(3, 8);
    for (let i = 0; i < blockCount; i++) {
        const blockType = Math.random();

        if (blockType < 0.2) {
            // Bullet list
            blocks.push(generateBulletListBlock());
        } else if (blockType < 0.3) {
            // Another heading/subheading
            const subheadingWords = generateTitle().split(/\s+/).map(word =>
                createWord(word, { bold: true, fontSize: 'large' })
            );
            blocks.push(createBlock(subheadingWords, generateRandomBlockStyle()));
        } else if (blockType < 0.5) {
            // Short text block
            blocks.push(generateTextBlock(randInt(1, 3)));
        } else {
            // Normal text block
            blocks.push(generateTextBlock(randInt(3, 6)));
        }
    }

    note.blocks = blocks;
    return note;
};

// Copy text to clipboard
const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch {
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }
};

export {
    copyToClipboard,
    generateLongText,
    generateRandomNote,
    generateShortText,
    generateTitle
}