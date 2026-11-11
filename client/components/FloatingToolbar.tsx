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

// TeaType
import { BookmarkIcon, ColorIcon, HighlightIcon, LinkIcon } from '@teatype/icons';

// React imports
import { useState } from 'react';

// Hooks
import useHeldModifiers from '@/hooks/useHeldModifiers';

// Types
import { HYPERLINKS_ENABLED, iNote, iPalette, tFormatMode } from '@/types';
import { enabledOf } from '@/tools/palette';
import { shortcutBase, shortcutKey, shortcutText } from '@/tools/shortcuts';
import type { tShortcutId } from '@/tools/shortcuts';

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
    mode: tShortcutId & tFormatMode;
    icon: React.ReactNode;
    label: string;
}

interface iSizePreset {
    id: string;
    label: string;
    fontSize: string;
    shortcut: tShortcutId;
}

const SIZE_PRESETS: iSizePreset[] = [
    { id: 'title', label: 'Title', fontSize: 'huge', shortcut: 'sizeTitle' },
    { id: 'heading', label: 'Heading', fontSize: 'larger', shortcut: 'sizeHeading' },
    { id: 'subheading', label: 'Subheading', fontSize: 'large', shortcut: 'sizeSubheading' },
    { id: 'body', label: 'Body', fontSize: 'normal', shortcut: 'sizeBody' },
    { id: 'small', label: 'Small', fontSize: 'smaller', shortcut: 'sizeSmall' },
    { id: 'caption', label: 'Caption', fontSize: 'tiny', shortcut: 'sizeCaption' },
];

const tools: iToolButton[] = [
    { mode: 'bold', icon: 'B', label: 'Bold' },
    { mode: 'italic', icon: 'I', label: 'Italic' },
    { mode: 'underline', icon: 'U', label: 'Underline' },
    { mode: 'strikethrough', icon: 'S', label: 'Strikethrough' },
    { mode: 'color', icon: <ColorIcon />, label: 'Text Color' },
    { mode: 'highlight', icon: <HighlightIcon />, label: 'Highlight' },
    { mode: 'link', icon: <LinkIcon />, label: 'Hyperlink' },
];

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
    const anchorHinted = heldModifiers === shortcutBase('anchor').toLowerCase();
    const sizeHinted = heldModifiers === shortcutBase('sizeTitle').toLowerCase();
    const colorsVisible = formatMode === 'color' || formatMode === 'highlight';
    // The color shortcut picks a color of the second bar
    const colorsHinted = colorsVisible && heldModifiers === shortcutBase('colorPick').toLowerCase();
    const colors = enabledOf('text', palette);
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
        onFormatModeChange('anchor');
    };

    // Check if current format mode is a size mode
    const isSizeMode = SIZE_MODES.includes(formatMode as (typeof SIZE_MODES)[number]);

    return (
        <div className='floating-toolbar'>
            <div className='floating-toolbar__inner'>
                <div className='floating-toolbar__tools'>
                    {tools
                        .filter((tool) => HYPERLINKS_ENABLED || tool.mode !== 'link')
                        .map((tool) => {
                            // Holding Ctrl shows the shortcuts that are Ctrl plus a letter, adding Shift shows the next ones
                            const hinted = !!heldModifiers && shortcutBase(tool.mode).toLowerCase() === heldModifiers;
                            return (
                                <button
                                    key={tool.mode}
                                    className={`floating-toolbar__btn ${
                                        formatMode === tool.mode ? 'floating-toolbar__btn--active' : ''
                                    } ${hinted ? 'floating-toolbar__btn--hint' : ''}`}
                                    onClick={() => onFormatModeChange(formatMode === tool.mode ? null : tool.mode)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    title={`${tool.label} (${shortcutText(tool.mode)})`}
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
                                    {hinted && <span className='floating-toolbar__key'>{shortcutKey(tool.mode)}</span>}
                                </button>
                            );
                        })}

                    {/* Anchor button with the list of anchor notes */}
                    <div className='floating-toolbar__size-wrapper'>
                        <button
                            className={`floating-toolbar__btn ${
                                formatMode === 'anchor' ? 'floating-toolbar__btn--active' : ''
                            } ${anchorHinted ? 'floating-toolbar__btn--hint' : ''}`}
                            onClick={toggleAnchorMode}
                            onMouseDown={(e) => e.preventDefault()}
                            title={`Anchor (${shortcutText('anchor')}): click words to link them to an anchor note, Ctrl+click opens it`}
                        >
                            <span className='floating-toolbar__icon'>
                                <BookmarkIcon />
                            </span>
                            {anchorHinted && <span className='floating-toolbar__key'>{shortcutKey('anchor')}</span>}
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
                            } ${sizeHinted ? 'floating-toolbar__btn--hint' : ''}`}
                            onClick={() => setShowSizeMenu(!showSizeMenu)}
                            onMouseDown={(e) => e.preventDefault()}
                            title={`Text Size (${shortcutText('sizes')})`}
                        >
                            <span className='floating-toolbar__icon'>Aa</span>
                        </button>

                        {/* Holding Ctrl+Alt lists the sizes with their numbers, the key badge under the Aa button is not shown for it */}
                        {(showSizeMenu || sizeHinted) && (
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
                                        <span className='floating-toolbar__size-shortcut'>{shortcutKey(preset.shortcut)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* The colors are only needed while a color is being applied */}
            {colorsVisible && (
                <div className='floating-toolbar__inner floating-toolbar__inner--colors'>
                    <div className='floating-toolbar__colors'>
                        {colors.length === 0 && (
                            <span className='floating-toolbar__no-colors'>
                                No colors are switched on, choose some in Settings.
                            </span>
                        )}
                        {colors.map(({ value, label }, index) => (
                            <button
                                key={value}
                                className={`floating-toolbar__color ${
                                    selectedColor === value ? 'floating-toolbar__color--active' : ''
                                } ${value === 'inherit' ? 'floating-toolbar__color--inherit' : ''}`}
                                style={value !== 'inherit' ? { backgroundColor: value } : undefined}
                                onClick={() => onColorChange(value)}
                                onMouseDown={(e) => e.preventDefault()}
                                title={`${label} (${shortcutBase('colorPick')}+${index + 1})`}
                            >
                                {colorsHinted && <span className='floating-toolbar__key'>{index + 1}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloatingToolbar;
