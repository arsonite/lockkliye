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
import { useEffect, useState } from 'react';
import AnchorIcon from '@/components/AnchorIcon';
import { HYPERLINKS_ENABLED, iNote, iPalette, tFormatMode } from '@/types';
import { enabledOf } from '@/util/palette';

interface iFloatingToolbarProps {
    formatMode: tFormatMode;
    selectedColor: string;
    palette: iPalette;
    selectedSize: string;
    anchorNotes: iNote[];
    selectedAnchorId?: string | null;

    onAnchorChange: (noteId: string) => void;
    onFormatModeChange: (mode: tFormatMode) => void;
    onColorChange: (color: string) => void;
    onSizeChange: (size: string) => void;
}

interface iToolButton {
    mode: tFormatMode;
    icon: string;
    label: string;
    shortcut?: string;
}

interface iSizePreset {
    id: string;
    label: string;
    fontSize: string;
}

const SIZE_PRESETS: iSizePreset[] = [
    { id: 'title', label: 'Title', fontSize: 'huge' },
    { id: 'heading', label: 'Heading', fontSize: 'larger' },
    { id: 'subheading', label: 'Subheading', fontSize: 'large' },
    { id: 'body', label: 'Body', fontSize: 'normal' },
    { id: 'small', label: 'Small', fontSize: 'smaller' },
    { id: 'caption', label: 'Caption', fontSize: 'tiny' },
];

const tools: iToolButton[] = [
    { mode: 'bold', icon: 'B', label: 'Bold', shortcut: 'Ctrl+B' },
    { mode: 'italic', icon: 'I', label: 'Italic', shortcut: 'Ctrl+I' },
    { mode: 'underline', icon: 'U', label: 'Underline', shortcut: 'Ctrl+U' },
    { mode: 'strikethrough', icon: 'S', label: 'Strikethrough', shortcut: 'Ctrl+Shift+S' },
    { mode: 'color', icon: '◉', label: 'Text Color', shortcut: 'Ctrl+Shift+C' },
    { mode: 'highlight', icon: '◌', label: 'Highlight', shortcut: 'Ctrl+Shift+H' },
    { mode: 'link', icon: '🔗', label: 'Hyperlink', shortcut: 'Ctrl+K' },
];

// The modifier keys that are held right now, in the order a shortcut is written: 'ctrl', 'ctrl+shift', ...
const useHeldModifiers = (): string => {
    const [held, setHeld] = useState('');

    useEffect(() => {
        const update = (event: KeyboardEvent) =>
            setHeld(
                [event.ctrlKey || event.metaKey ? 'ctrl' : '', event.shiftKey ? 'shift' : '', event.altKey ? 'alt' : '']
                    .filter(Boolean)
                    .join('+'),
            );
        const reset = () => setHeld('');
        window.addEventListener('keydown', update);
        window.addEventListener('keyup', update);
        window.addEventListener('blur', reset);
        return () => {
            window.removeEventListener('keydown', update);
            window.removeEventListener('keyup', update);
            window.removeEventListener('blur', reset);
        };
    }, []);

    return held;
};

// 'Ctrl+Shift+S' -> the modifiers 'ctrl+shift' and the letter 'S'
const splitShortcut = (shortcut?: string): { modifiers: string; letter: string } | null => {
    if (!shortcut) return null;
    const parts = shortcut.split('+');
    return { modifiers: parts.slice(0, -1).join('+').toLowerCase(), letter: parts[parts.length - 1] };
};

// Size modes that can be set as format mode
const SIZE_MODES = ['huge', 'larger', 'large', 'normal', 'smaller', 'tiny'] as const;

const FloatingToolbar: React.FC<iFloatingToolbarProps> = ({
    formatMode,
    selectedColor,
    palette,
    selectedSize: _selectedSize,
    anchorNotes,
    selectedAnchorId,
    onAnchorChange,
    onFormatModeChange,
    onColorChange,
    onSizeChange,
}) => {
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const heldModifiers = useHeldModifiers();
    const [anchorQuery, setAnchorQuery] = useState('');
    const matchingAnchors = anchorNotes.filter((note) =>
        note.title.toLowerCase().includes(anchorQuery.trim().toLowerCase()),
    );

    // Anchor mode applies the chosen anchor note, so one is picked as soon as the mode starts
    const toggleAnchorMode = () => {
        setAnchorQuery('');
        if (formatMode === 'anchor') {
            onFormatModeChange(null);
            return;
        }
        if (!anchorNotes.some((note) => note.id === selectedAnchorId) && anchorNotes.length > 0) {
            onAnchorChange(anchorNotes[0].id);
        }
        onFormatModeChange('anchor');
    };

    // Check if current format mode is a size mode
    const isSizeMode = SIZE_MODES.includes(formatMode as (typeof SIZE_MODES)[number]);

    return (
        <div className='floating-toolbar'>
            <div className='floating-toolbar__inner'>
                <div className='floating-toolbar__tools'>
                    {tools.filter((tool) => HYPERLINKS_ENABLED || tool.mode !== 'link').map((tool) => {
                        // Holding Ctrl shows the shortcuts that are Ctrl plus a letter, adding Shift shows the next ones
                        const shortcut = splitShortcut(tool.shortcut);
                        const hinted = !!heldModifiers && shortcut?.modifiers === heldModifiers;
                        return (
                        <button
                            key={tool.mode}
                            className={`floating-toolbar__btn ${
                                formatMode === tool.mode ? 'floating-toolbar__btn--active' : ''
                            } ${hinted ? 'floating-toolbar__btn--hint' : ''}`}
                            onClick={() => onFormatModeChange(formatMode === tool.mode ? null : tool.mode)}
                            onMouseDown={(e) => e.preventDefault()}
                            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                            style={
                                tool.mode === 'color' && selectedColor !== 'inherit'
                                    ? { color: selectedColor }
                                    : undefined
                            }
                        >
                            <span
                                className={`floating-toolbar__icon ${
                                    tool.mode === 'bold' ? 'floating-toolbar__icon--bold' : ''
                                } ${tool.mode === 'italic' ? 'floating-toolbar__icon--italic' : ''} ${
                                    tool.mode === 'underline' ? 'floating-toolbar__icon--underline' : ''
                                } ${tool.mode === 'strikethrough' ? 'floating-toolbar__icon--strike' : ''}`}
                            >
                                {tool.icon}
                            </span>
                            {hinted && <span className='floating-toolbar__key'>{shortcut?.letter}</span>}
                        </button>
                        );
                    })}

                    {/* Anchor button with the list of anchor notes */}
                    <div className='floating-toolbar__size-wrapper'>
                        <button
                            className={`floating-toolbar__btn ${
                                formatMode === 'anchor' ? 'floating-toolbar__btn--active' : ''
                            }`}
                            onClick={toggleAnchorMode}
                            onMouseDown={(e) => e.preventDefault()}
                            title='Anchor: click words to link them to an anchor note (Ctrl+click opens it)'
                        >
                            <span className='floating-toolbar__icon'>
                                <AnchorIcon />
                            </span>
                        </button>

                        {formatMode === 'anchor' && (
                            <div className='floating-toolbar__size-menu floating-toolbar__anchor-menu'>
                                {anchorNotes.length === 0 ? (
                                    <div className='floating-toolbar__anchor-empty'>
                                        No anchor notes yet. Use the bookmark button next to a note title.
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            className='floating-toolbar__anchor-search'
                                            type='search'
                                            placeholder='Search anchors...'
                                            value={anchorQuery}
                                            onChange={(e) => setAnchorQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && matchingAnchors.length > 0) {
                                                    onAnchorChange(matchingAnchors[0].id);
                                                }
                                            }}
                                        />
                                        <div className='floating-toolbar__anchor-list'>
                                            {matchingAnchors.length === 0 ? (
                                                <div className='floating-toolbar__anchor-empty'>No match</div>
                                            ) : (
                                                matchingAnchors.map((note) => (
                                                    <button
                                                        key={note.id}
                                                        className={`floating-toolbar__size-option ${
                                                            note.id === selectedAnchorId
                                                                ? 'floating-toolbar__size-option--active'
                                                                : ''
                                                        }`}
                                                        onClick={() => onAnchorChange(note.id)}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                    >
                                                        {note.title}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Size button with dropdown */}
                    <div className='floating-toolbar__size-wrapper'>
                        <button
                            className={`floating-toolbar__btn floating-toolbar__btn--size ${
                                showSizeMenu || isSizeMode ? 'floating-toolbar__btn--active' : ''
                            }`}
                            onClick={() => setShowSizeMenu(!showSizeMenu)}
                            onMouseDown={(e) => e.preventDefault()}
                            title='Text Size'
                        >
                            <span className='floating-toolbar__icon'>Aa</span>
                        </button>

                        {showSizeMenu && (
                            <div className='floating-toolbar__size-menu'>
                                {SIZE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        className={`floating-toolbar__size-option ${
                                            formatMode === preset.fontSize
                                                ? 'floating-toolbar__size-option--active'
                                                : ''
                                        }`}
                                        onClick={() => {
                                            // Set format mode to the size so clicking words applies this size
                                            onFormatModeChange(preset.fontSize as tFormatMode);
                                            onSizeChange(preset.fontSize);
                                            setShowSizeMenu(false);
                                        }}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <span
                                            className={`floating-toolbar__size-preview floating-toolbar__size-preview--${preset.fontSize}`}
                                        >
                                            {preset.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* The colors are only needed while a color is being applied */}
            {(formatMode === 'color' || formatMode === 'highlight') && (
                <div className='floating-toolbar__inner floating-toolbar__inner--colors'>
                    <div className='floating-toolbar__colors'>
                        {enabledOf('text', palette).length === 0 && (
                            <span className='floating-toolbar__no-colors'>
                                No colors are switched on, choose some in Settings.
                            </span>
                        )}
                        {enabledOf('text', palette).map(({ value, label }) => (
                            <button
                                key={value}
                                className={`floating-toolbar__color ${
                                    selectedColor === value ? 'floating-toolbar__color--active' : ''
                                } ${value === 'inherit' ? 'floating-toolbar__color--inherit' : ''}`}
                                style={value !== 'inherit' ? { backgroundColor: value } : undefined}
                                onClick={() => onColorChange(value)}
                                onMouseDown={(e) => e.preventDefault()}
                                title={label}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloatingToolbar;
