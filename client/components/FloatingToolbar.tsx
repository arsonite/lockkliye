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
import { useState } from 'react';
import { FORMAT_COLORS, tFormatMode } from '@/types';

interface iFloatingToolbarProps {
    formatMode: tFormatMode;
    selectedColor: string;
    selectedSize: string;

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

// Size modes that can be set as format mode
const SIZE_MODES = ['huge', 'larger', 'large', 'normal', 'smaller', 'tiny'] as const;

const FloatingToolbar: React.FC<iFloatingToolbarProps> = ({
    formatMode,
    selectedColor,
    selectedSize: _selectedSize,
    onFormatModeChange,
    onColorChange,
    onSizeChange,
}) => {
    const [showSizeMenu, setShowSizeMenu] = useState(false);

    // Check if current format mode is a size mode
    const isSizeMode = SIZE_MODES.includes(formatMode as (typeof SIZE_MODES)[number]);

    return (
        <div className='floating-toolbar'>
            <div className='floating-toolbar__inner'>
                <div className='floating-toolbar__tools'>
                    {tools.map((tool) => (
                        <button
                            key={tool.mode}
                            className={`floating-toolbar__btn ${
                                formatMode === tool.mode ? 'floating-toolbar__btn--active' : ''
                            }`}
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
                        </button>
                    ))}

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

                <div className='floating-toolbar__divider' />

                <div className='floating-toolbar__colors'>
                    {FORMAT_COLORS.map((color) => (
                        <button
                            key={color}
                            className={`floating-toolbar__color ${
                                selectedColor === color ? 'floating-toolbar__color--active' : ''
                            } ${color === 'inherit' ? 'floating-toolbar__color--inherit' : ''}`}
                            style={color !== 'inherit' ? { backgroundColor: color } : undefined}
                            onClick={() => onColorChange(color)}
                            onMouseDown={(e) => e.preventDefault()}
                            title={color === 'inherit' ? 'Default Color' : `Color: ${color}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FloatingToolbar;
