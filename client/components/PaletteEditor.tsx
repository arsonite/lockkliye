/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// React imports
import { useState } from 'react';

// TeaType components
import { TeaButton } from '@teatype/components';

// Types
import type { iPalette, tPaletteKind } from '@/types';

// Util
import { MAX_ENABLED, catalogOf, customValueOf } from '@/util/palette';

interface iPaletteEditorProps {
    kind: tPaletteKind;
    palette: iPalette;
    onToggle: (kind: tPaletteKind, value: string) => void;
    onAdd: (kind: tPaletteKind, value: string) => void;
    onRemove: (kind: tPaletteKind, value: string) => void;
}

// A block color or gradient is translucent, so it is shown on top of the card
const swatchStyle = (kind: tPaletteKind, value: string): React.CSSProperties => {
    if (kind === 'text') return { background: value === 'inherit' ? 'var(--text-primary)' : value };
    if (kind === 'block') return { backgroundImage: `linear-gradient(${value}, ${value})` };
    return { backgroundImage: value || 'none' };
};

const isNone = (kind: tPaletteKind, value: string) =>
    (kind === 'block' && value === 'transparent') || (kind === 'gradient' && value === '');

// Switches the colors or gradients of one kind on and off and makes new ones
export const PaletteEditor = ({ kind, palette, onToggle, onAdd, onRemove }: iPaletteEditorProps) => {
    const [first, setFirst] = useState('#4dabf7');
    const [second, setSecond] = useState('#da77f2');
    const [opacity, setOpacity] = useState(10);

    const { enabled } = palette[kind];
    const full = enabled.length >= MAX_ENABLED;
    const preview = customValueOf(kind, [first, second], opacity / 100);

    return (
        <div className='palette-editor'>
            <span className='palette-editor__count'>
                {enabled.length} of {MAX_ENABLED} on
            </span>

            <div className='palette-editor__swatches'>
                {catalogOf(kind, palette).map((entry) => {
                    const on = enabled.includes(entry.value);
                    return (
                        <div key={entry.value} className='palette-editor__cell'>
                            <button
                                type='button'
                                className={`palette-editor__swatch ${on ? 'palette-editor__swatch--on' : ''} ${
                                    isNone(kind, entry.value) ? 'palette-editor__swatch--none' : ''
                                }`}
                                style={swatchStyle(kind, entry.value)}
                                disabled={!on && full}
                                aria-pressed={on}
                                title={`${entry.label}${on ? ' (on)' : full ? ' (8 are already on)' : ''}`}
                                onClick={() => onToggle(kind, entry.value)}
                            />
                            {entry.custom && (
                                <button
                                    type='button'
                                    className='palette-editor__remove'
                                    title='Delete this custom color'
                                    onClick={() => onRemove(kind, entry.value)}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className='palette-editor__new'>
                <input
                    type='color'
                    value={first}
                    onChange={(event) => setFirst(event.target.value)}
                    title={kind === 'gradient' ? 'Start color' : 'Color'}
                />
                {kind === 'gradient' && (
                    <input
                        type='color'
                        value={second}
                        onChange={(event) => setSecond(event.target.value)}
                        title='End color'
                    />
                )}
                {kind === 'block' && (
                    <label className='palette-editor__opacity'>
                        <input
                            type='range'
                            min={5}
                            max={50}
                            step={5}
                            value={opacity}
                            onChange={(event) => setOpacity(parseInt(event.target.value))}
                        />
                        {opacity}%
                    </label>
                )}
                <span className='palette-editor__swatch palette-editor__preview' style={swatchStyle(kind, preview)} />
                <TeaButton onClick={() => onAdd(kind, preview)}>Add</TeaButton>
            </div>
        </div>
    );
};

export default PaletteEditor;
