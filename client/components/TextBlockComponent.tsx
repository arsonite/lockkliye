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

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { iTextBlock, tFormatMode, iWord, iBlockStyle, iPalette } from '@/types';
import { enabledOf } from '@/util/palette';
import { RichTextEditor } from './RichTextEditor';
import { TeaModal } from '@teatype/components';

interface iTextBlockComponentProps {
    block: iTextBlock;
    formatMode: tFormatMode;
    selectedColor: string;
    palette: iPalette;
    selectedSize: string;
    selectedAnchorId?: string | null;
    onOpenAnchor?: (noteId: string) => void;
    onWordFormatChange: (blockId: string, wordId: string, format: Partial<iWord['format']>) => void;
    onWordsChange: (blockId: string, words: iWord[]) => void;
    onStyleChange: (blockId: string, style: Partial<iTextBlock['style']>) => void;
    onDelete: (blockId: string) => void;
    onAddBlockAfter: (blockId: string) => void;
    onAddBlockBefore: (blockId: string) => void;
    autoFocus?: boolean; // The block was just added, its editor takes the focus
    onAutoFocused?: () => void;
    onEditingChange?: (blockId: string, isEditing: boolean) => void;
    onClearFormatMode?: () => void;
    onSaveAsPreset?: (style: iBlockStyle) => void;
}

export const TextBlockComponent = ({
    block,
    formatMode,
    selectedColor,
    palette,
    selectedSize,
    selectedAnchorId,
    onOpenAnchor,
    onWordsChange,
    onStyleChange,
    onDelete,
    onAddBlockAfter,
    onAddBlockBefore,
    autoFocus,
    onAutoFocused,
    onClearFormatMode,
    onSaveAsPreset,
    confirmDeletions = true,
}: iTextBlockComponentProps & {
    confirmDeletions?: boolean;
}) => {
    const [showStyleMenu, setShowStyleMenu] = useState(false);
    // Where a right-click opened the menu, null when the button did
    const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [isNearEdge, setIsNearEdge] = useState(false);
    const [titleInput, setTitleInput] = useState(block.style.title || '');
    const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
    const [showCustomGradientPicker, setShowCustomGradientPicker] = useState(false);
    const [customColorInput, setCustomColorInput] = useState('#ff0000');
    const [customColorAlpha, setCustomColorAlpha] = useState(10);
    const [customGradientFrom, setCustomGradientFrom] = useState('#ff0000');
    const [customGradientTo, setCustomGradientTo] = useState('#0000ff');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isLightMode, setIsLightMode] = useState(
        () => document.querySelector('.notes-app')?.classList.contains('light-mode') ?? false,
    );
    const styleMenuRef = useRef<HTMLDivElement>(null);
    const blockRef = useRef<HTMLDivElement>(null);

    const blockStyle = block.style;

    // Watch for light mode changes via MutationObserver
    useEffect(() => {
        const appElement = document.querySelector('.notes-app');
        if (!appElement) return;

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    setIsLightMode(appElement.classList.contains('light-mode'));
                }
            }
        });

        observer.observe(appElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    // Place the menu at the mouse, kept inside the window
    useLayoutEffect(() => {
        const menu = styleMenuRef.current;
        const block = blockRef.current;
        if (!showStyleMenu || !menuPoint || !menu || !block) return;
        const blockRect = block.getBoundingClientRect();
        // Not the rect, that is scaled by the opening animation
        const { offsetWidth: width, offsetHeight: height } = menu;
        const x = Math.max(8, Math.min(menuPoint.x, window.innerWidth - width - 8));
        const y = Math.max(8, Math.min(menuPoint.y, window.innerHeight - height - 8));
        menu.style.left = `${x - blockRect.left}px`;
        menu.style.top = `${y - blockRect.top}px`;
        menu.style.marginTop = '0';
    }, [showStyleMenu, menuPoint]);

    // Close style menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showStyleMenu && styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) {
                setShowStyleMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showStyleMenu]);

    // Handle width resizing
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!blockRef.current) return;
            const container = blockRef.current.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const blockRect = blockRef.current.getBoundingClientRect();

            // Calculate new width as percentage of container
            const rawWidth = ((e.clientX - blockRect.left) / containerRect.width) * 100;
            // Snap to 10% increments for snappy feel
            const snappedWidth = Math.round(rawWidth / 10) * 10;
            const clampedWidth = Math.max(10, Math.min(100, snappedWidth));

            // Only update if the snapped value changed
            if (clampedWidth !== block.style.widthPercent) {
                onStyleChange(block.id, { widthPercent: clampedWidth });
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, block.id, block.style.widthPercent, onStyleChange]);

    // Detect when mouse is near right edge of block
    const handleMouseMoveOnBlock = (e: React.MouseEvent) => {
        if (!blockRef.current) {
            setIsNearEdge(false);
            return;
        }
        const rect = blockRef.current.getBoundingClientRect();
        const nearEdgeThreshold = 15;
        // Only inside the block: the buttons next to it are outside its right edge
        const distanceToEdge = rect.right - e.clientX;
        const isNear = distanceToEdge >= 0 && distanceToEdge < nearEdgeThreshold;
        setIsNearEdge(isNear);
    };

    const handleMouseLeave = () => {
        if (!isResizing) {
            setIsNearEdge(false);
        }
    };

    // Darken a color for borders
    const darkenColor = (colorStr: string | undefined, amount: number = 0.3): string => {
        if (!colorStr || colorStr === 'transparent') return 'rgba(100, 100, 100, 0.4)';
        const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (rgbaMatch) {
            const r = Math.max(0, parseInt(rgbaMatch[1]) - 50);
            const g = Math.max(0, parseInt(rgbaMatch[2]) - 50);
            const b = Math.max(0, parseInt(rgbaMatch[3]) - 50);
            const a = Math.min(1, parseFloat(rgbaMatch[4] || '1') + amount);
            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        return 'rgba(100, 100, 100, 0.4)';
    };

    // Get the effective background for determining border/title color
    const getEffectiveBackground = () => {
        return (
            blockStyle.backgroundGradient ||
            blockStyle.backgroundColor ||
            blockStyle.customGradient ||
            blockStyle.customColor
        );
    };

    const getBlockStyles = (): React.CSSProperties => {
        const styles: React.CSSProperties = {};

        if (blockStyle.widthPercent) {
            styles.width = `${blockStyle.widthPercent}%`;
        }

        const effectiveBg = getEffectiveBackground();

        // Use border radius from style or default to 8
        styles.borderRadius = `${blockStyle.borderRadius ?? 8}px`;

        // Set border style
        if (blockStyle.borderStyle && blockStyle.borderStyle !== 'none') {
            styles.borderStyle = blockStyle.borderStyle;
            styles.borderWidth = '1px';
        }

        // Always calculate border color based on background (for blocks with borders)
        if (blockStyle.borderStyle && blockStyle.borderStyle !== 'none') {
            styles.borderColor = darkenColor(effectiveBg);
        }

        if (blockStyle.backgroundGradient) {
            styles.background = blockStyle.backgroundGradient;
        } else if (blockStyle.backgroundColor) {
            styles.backgroundColor = blockStyle.backgroundColor;
        }

        if (blockStyle.transparent) {
            styles.backgroundColor = 'transparent';
        }

        return styles;
    };

    // Get title color based on block background - ensure good contrast
    const getTitleColor = (): string | undefined => {
        const effectiveBg = getEffectiveBackground();
        if (!effectiveBg || effectiveBg === 'transparent') {
            return undefined; // Will use CSS default
        }

        // Extract RGB values from the background
        const rgbaMatch = effectiveBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]);
            const g = parseInt(rgbaMatch[2]);
            const b = parseInt(rgbaMatch[3]);

            if (isLightMode) {
                // Light mode: darken the color significantly for better contrast
                const darkenAmount = 0.35;
                const darkR = Math.round(r * darkenAmount);
                const darkG = Math.round(g * darkenAmount);
                const darkB = Math.round(b * darkenAmount);
                return `rgb(${darkR}, ${darkG}, ${darkB})`;
            } else {
                // Dark mode: brighten/saturate the color for visibility
                // Keep the hue but make it more vibrant and visible
                const brightenAmount = 1.3;
                const brightR = Math.min(255, Math.round(r * brightenAmount));
                const brightG = Math.min(255, Math.round(g * brightenAmount));
                const brightB = Math.min(255, Math.round(b * brightenAmount));
                return `rgb(${brightR}, ${brightG}, ${brightB})`;
            }
        }

        return undefined; // Will use CSS default
    };

    const borderStyles = ['none', 'solid', 'dashed', 'dotted', 'double'] as const;
    const bgColors = enabledOf('block', palette).map((entry) => entry.value);
    const gradients = enabledOf('gradient', palette).map((entry) => entry.value);

    // Check if block is empty (no content or just empty words)
    const isBlockEmpty = () => {
        return block.words.length === 0 || (block.words.length === 1 && !block.words[0].text.trim());
    };

    const handleDelete = () => {
        // Skip confirmation for empty blocks
        if (confirmDeletions && !isBlockEmpty()) {
            setShowDeleteModal(true);
        } else {
            onDelete(block.id);
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        setTitleInput(title);
        onStyleChange(block.id, { title: title || undefined });
    };

    // Set custom color for this block only (last in row)
    const handleSetCustomColor = () => {
        if (customColorInput) {
            const alpha = customColorAlpha / 100;
            const rgba = hexToRgba(customColorInput, alpha);
            onStyleChange(block.id, {
                customColor: rgba,
                backgroundColor: rgba,
                backgroundGradient: '',
                customGradient: '',
            });
            setShowCustomColorPicker(false);
        }
    };

    // Clear custom color for this block
    const handleClearCustomColor = () => {
        onStyleChange(block.id, { customColor: undefined, backgroundColor: 'transparent', backgroundGradient: '' });
    };

    // Set custom gradient for this block only (last in row)
    const handleSetCustomGradient = () => {
        // Convert hex colors to rgba with 0.15 alpha to match default gradient opacity
        const fromRgba = hexToRgba(customGradientFrom, 0.15);
        const toRgba = hexToRgba(customGradientTo, 0.15);
        const gradient = `linear-gradient(135deg, ${fromRgba} 0%, ${toRgba} 100%)`;
        onStyleChange(block.id, {
            customGradient: gradient,
            backgroundGradient: gradient,
            backgroundColor: '',
            customColor: '',
        });
        setShowCustomGradientPicker(false);
    };

    // Clear custom gradient for this block
    const handleClearCustomGradient = () => {
        onStyleChange(block.id, { customGradient: undefined, backgroundGradient: '', backgroundColor: 'transparent' });
    };

    // Save current block style as a preset
    const handleSaveAsPreset = () => {
        if (onSaveAsPreset) {
            onSaveAsPreset({ ...blockStyle });
            setShowStyleMenu(false);
        }
    };

    // Helper to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    return (
        <>
            <div
                ref={blockRef}
                className={`text-block ${isNearEdge || isResizing ? 'text-block--resizing' : ''} ${
                    blockStyle.title ? 'text-block--has-title' : ''
                }`}
                style={getBlockStyles()}
                onMouseMove={handleMouseMoveOnBlock}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => {
                    if (styleMenuRef.current?.contains(e.target as Node)) return;
                    e.preventDefault();
                    setMenuPoint({ x: e.clientX, y: e.clientY });
                    setShowStyleMenu(true);
                }}
            >
                {/* Block title (legend-style) with color based on background */}
                {blockStyle.title && (
                    <span
                        className='text-block__title'
                        style={{
                            color: getTitleColor(),
                            backgroundColor: darkenColor(getEffectiveBackground(), 0.4),
                        }}
                    >
                        {blockStyle.title}
                    </span>
                )}

                {/* Width resize handle */}
                {(isNearEdge || isResizing) && (
                    <div
                        className='text-block__resize-handle'
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setIsResizing(true);
                        }}
                        onDoubleClick={() => {
                            setIsResizing(false);
                            onStyleChange(block.id, { widthPercent: undefined });
                        }}
                        title='Double-click to reset the width'
                    />
                )}

                <div className='text-block__controls'>
                    <button
                        className='text-block__style-btn'
                        onClick={() => {
                            setMenuPoint(null);
                            setShowStyleMenu(!showStyleMenu);
                        }}
                        title='Block style'
                    >
                        ◐
                    </button>
                    <button
                        className='text-block__add-above-btn'
                        onClick={() => onAddBlockBefore(block.id)}
                        title='Add block above'
                    >
                        +↑
                    </button>
                    <button
                        className='text-block__add-btn'
                        onClick={() => onAddBlockAfter(block.id)}
                        title='Add block below'
                    >
                        +↓
                    </button>
                    <button className='text-block__delete-btn' onClick={handleDelete} title='Delete block'>
                        ×
                    </button>
                </div>

                {showStyleMenu && (
                    <div className='text-block__style-menu' ref={styleMenuRef}>
                        <div className='style-menu__section'>
                            <span className='style-menu__label'>Title</span>
                            <input
                                type='text'
                                className='style-menu__title-input'
                                placeholder='Block title (optional)'
                                value={titleInput}
                                onChange={handleTitleChange}
                            />
                        </div>
                        <div className='style-menu__section'>
                            <span className='style-menu__label'>Border</span>
                            <div className='style-menu__options'>
                                {borderStyles.map((style) => (
                                    <button
                                        key={style}
                                        className={`style-menu__option ${
                                            blockStyle.borderStyle === style ? 'style-menu__option--active' : ''
                                        }`}
                                        onClick={() => onStyleChange(block.id, { borderStyle: style })}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className='style-menu__section'>
                            <span className='style-menu__label'>Corner Radius</span>
                            <div className='style-menu__slider-row'>
                                <input
                                    type='range'
                                    className='style-menu__slider'
                                    min='0'
                                    max='20'
                                    step='2'
                                    value={blockStyle.borderRadius ?? 8}
                                    onChange={(e) =>
                                        onStyleChange(block.id, { borderRadius: parseInt(e.target.value) })
                                    }
                                />
                                <span className='style-menu__slider-value'>{blockStyle.borderRadius ?? 8}px</span>
                            </div>
                        </div>
                        <div className='style-menu__section'>
                            <span className='style-menu__label'>Background</span>
                            <div className='style-menu__colors'>
                                {bgColors.map((color, i) => (
                                    <button
                                        key={i}
                                        className={`style-menu__color ${
                                            blockStyle.backgroundColor === color && !blockStyle.customColor
                                                ? 'style-menu__color--active'
                                                : ''
                                        }`}
                                        style={{ backgroundColor: color || 'transparent' }}
                                        onClick={() =>
                                            onStyleChange(block.id, {
                                                backgroundColor: color,
                                                backgroundGradient: '',
                                                customColor: undefined,
                                                customGradient: undefined,
                                            })
                                        }
                                    />
                                ))}
                                {/* Per-block custom color (last in row) */}
                                {blockStyle.customColor ? (
                                    <button
                                        className='style-menu__color style-menu__color--custom style-menu__color--active'
                                        style={{ backgroundColor: blockStyle.customColor }}
                                        onClick={handleClearCustomColor}
                                        title='Click to remove custom color'
                                    />
                                ) : (
                                    <button
                                        className='style-menu__color style-menu__color--add'
                                        onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
                                        title='Add custom color for this block'
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                            {showCustomColorPicker && (
                                <div className='style-menu__custom-picker'>
                                    <input
                                        type='color'
                                        value={customColorInput}
                                        onChange={(e) => setCustomColorInput(e.target.value)}
                                    />
                                    <input
                                        type='range'
                                        min='0'
                                        max='100'
                                        value={customColorAlpha}
                                        onChange={(e) => setCustomColorAlpha(parseInt(e.target.value))}
                                        title='Opacity'
                                    />
                                    <span className='style-menu__alpha-label'>{customColorAlpha}%</span>
                                    <button onClick={handleSetCustomColor}>Set</button>
                                </div>
                            )}
                        </div>
                        <div className='style-menu__section'>
                            <span className='style-menu__label'>Gradient</span>
                            <div className='style-menu__colors'>
                                {gradients.map((grad, i) => (
                                    <button
                                        key={i}
                                        className={`style-menu__color style-menu__color--gradient ${
                                            blockStyle.backgroundGradient === grad && !blockStyle.customGradient
                                                ? 'style-menu__color--active'
                                                : ''
                                        }`}
                                        style={{ background: grad || 'transparent' }}
                                        onClick={() =>
                                            onStyleChange(block.id, {
                                                backgroundGradient: grad,
                                                backgroundColor: '',
                                                customColor: undefined,
                                                customGradient: undefined,
                                            })
                                        }
                                    />
                                ))}
                                {/* Per-block custom gradient (last in row) */}
                                {blockStyle.customGradient ? (
                                    <button
                                        className='style-menu__color style-menu__color--gradient style-menu__color--custom style-menu__color--active'
                                        style={{ background: blockStyle.customGradient }}
                                        onClick={handleClearCustomGradient}
                                        title='Click to remove custom gradient'
                                    />
                                ) : (
                                    <button
                                        className='style-menu__color style-menu__color--add'
                                        onClick={() => setShowCustomGradientPicker(!showCustomGradientPicker)}
                                        title='Add custom gradient for this block'
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                            {showCustomGradientPicker && (
                                <div className='style-menu__custom-picker style-menu__custom-picker--gradient'>
                                    <div className='style-menu__gradient-colors'>
                                        <label>
                                            From:
                                            <input
                                                type='color'
                                                value={customGradientFrom}
                                                onChange={(e) => setCustomGradientFrom(e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            To:
                                            <input
                                                type='color'
                                                value={customGradientTo}
                                                onChange={(e) => setCustomGradientTo(e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <div
                                        className='style-menu__gradient-preview'
                                        style={{
                                            background: `linear-gradient(135deg, ${customGradientFrom}, ${customGradientTo})`,
                                        }}
                                    />
                                    <button onClick={handleSetCustomGradient}>Set</button>
                                </div>
                            )}
                        </div>
                        {onSaveAsPreset && (
                            <div className='style-menu__section'>
                                <button className='style-menu__save-preset' onClick={handleSaveAsPreset}>
                                    💾 Save as Preset
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <RichTextEditor
                    words={block.words}
                    formatMode={formatMode}
                    selectedColor={selectedColor}
                    selectedSize={selectedSize}
                    selectedAnchorId={selectedAnchorId}
                    onOpenAnchor={onOpenAnchor}
                    onWordsChange={(newWords) => onWordsChange(block.id, newWords)}
                    onAddBlockAfter={() => onAddBlockAfter(block.id)}
                    autoFocus={autoFocus}
                    onAutoFocused={onAutoFocused}
                    onClearFormatMode={onClearFormatMode}
                    placeholder='Click to edit...'
                />
            </div>

            {/* Delete Confirmation Modal */}
            <TeaModal
                isOpen={showDeleteModal}
                title='Delete Block'
                onClose={() => setShowDeleteModal(false)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setShowDeleteModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                onDelete(block.id);
                                setShowDeleteModal(false);
                            }}
                        >
                            Delete
                        </button>
                    </>
                }
            >
                <p>Are you sure you want to delete this block?</p>
            </TeaModal>
        </>
    );
};
