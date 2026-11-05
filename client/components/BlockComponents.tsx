/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// React imports
import { useEffect, useRef } from 'react';

// TeaType
import { PlusIcon, XIcon } from '@teatype/icons';
import { TeaCheckbox } from '@teatype/components';

// Types
import type { iChecklistData, iTableData } from '@/types';

// The components a block can hold besides text. Each edits the data of its block through onChange.
interface iBlockContentProps<T> {
    data: T;
    autoFocus?: boolean; // The block was just added
    onAutoFocused?: () => void;
    onChange: (data: T) => void;
}

// Focuses the first field of a block that was just added, after the blocks moved into place
const useAutoFocus = (autoFocus: boolean | undefined, onAutoFocused: (() => void) | undefined, focus: () => void) => {
    useEffect(() => {
        if (!autoFocus) return;
        const timer = setTimeout(() => {
            focus();
            onAutoFocused?.();
        }, 80);
        return () => clearTimeout(timer);
    }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps
};

export const ChecklistBlock = ({ data, autoFocus, onAutoFocused, onChange }: iBlockContentProps<iChecklistData>) => {
    const { items } = data;
    const inputs = useRef(new Map<string, HTMLInputElement>());
    // The item that gets the focus once the list is rendered again
    const focusNext = useRef<string | null>(null);

    useEffect(() => {
        if (focusNext.current) {
            inputs.current.get(focusNext.current)?.focus();
            focusNext.current = null;
        }
    });
    useAutoFocus(autoFocus, onAutoFocused, () => inputs.current.get(items[0]?.id)?.focus());

    const update = (id: string, patch: Partial<iChecklistData['items'][number]>) =>
        onChange({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

    const addAfter = (index: number) => {
        const item = { id: crypto.randomUUID(), text: '', done: false };
        focusNext.current = item.id;
        const next = [...items];
        next.splice(index + 1, 0, item);
        onChange({ items: next });
    };

    const remove = (index: number) => {
        if (items.length === 1) return;
        focusNext.current = items[index === 0 ? 1 : index - 1].id;
        onChange({ items: items.filter((_, position) => position !== index) });
    };

    return (
        <div className='checklist'>
            {items.map((item, index) => (
                <div key={item.id} className={`checklist__item ${item.done ? 'checklist__item--done' : ''}`}>
                    <TeaCheckbox checked={item.done} onChange={(done) => update(item.id, { done })} />
                    <input
                        ref={(element) => {
                            if (element) inputs.current.set(item.id, element);
                            else inputs.current.delete(item.id);
                        }}
                        className='checklist__text'
                        placeholder='Item'
                        spellCheck={false}
                        value={item.text}
                        onChange={(event) => update(item.id, { text: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                addAfter(index);
                            } else if (event.key === 'Backspace' && !item.text && items.length > 1) {
                                event.preventDefault();
                                remove(index);
                            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)];
                                if (target) {
                                    event.preventDefault();
                                    inputs.current.get(target.id)?.focus();
                                }
                            }
                        }}
                    />
                    {items.length > 1 && (
                        <button className='checklist__remove' title='Remove item' onClick={() => remove(index)}>
                            <XIcon width='1em' height='1em' />
                        </button>
                    )}
                </div>
            ))}
            <button className='checklist__add' onClick={() => addAfter(items.length - 1)}>
                <PlusIcon /> Item
            </button>
        </div>
    );
};

export const TableBlock = ({ data, autoFocus, onAutoFocused, onChange }: iBlockContentProps<iTableData>) => {
    const { rows } = data;
    const columns = rows[0]?.length ?? 1;
    const cells = useRef(new Map<string, HTMLInputElement>());
    const focusNext = useRef<string | null>(null);

    useEffect(() => {
        if (focusNext.current) {
            cells.current.get(focusNext.current)?.focus();
            focusNext.current = null;
        }
    });
    useAutoFocus(autoFocus, onAutoFocused, () => cells.current.get('0:0')?.focus());

    const setCell = (row: number, column: number, value: string) =>
        onChange({
            rows: rows.map((cellsOfRow, r) =>
                r === row ? cellsOfRow.map((cell, c) => (c === column ? value : cell)) : cellsOfRow,
            ),
        });

    const addRow = () => onChange({ rows: [...rows, Array<string>(columns).fill('')] });

    return (
        <div className='table-block'>
            <table>
                <tbody>
                    {rows.map((row, r) => (
                        <tr key={r}>
                            {row.map((cell, c) => (
                                <td key={c}>
                                    <input
                                        ref={(element) => {
                                            if (element) cells.current.set(`${r}:${c}`, element);
                                            else cells.current.delete(`${r}:${c}`);
                                        }}
                                        spellCheck={false}
                                        value={cell}
                                        onChange={(event) => setCell(r, c, event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter') return;
                                            event.preventDefault();
                                            if (r === rows.length - 1) addRow();
                                            focusNext.current = `${r + 1}:${c}`;
                                        }}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className='table-block__actions'>
                <button onClick={addRow}>+ Row</button>
                <button onClick={() => onChange({ rows: rows.map((row) => [...row, '']) })}>+ Column</button>
                <button disabled={rows.length === 1} onClick={() => onChange({ rows: rows.slice(0, -1) })}>
                    - Row
                </button>
                <button
                    disabled={columns === 1}
                    onClick={() => onChange({ rows: rows.map((row) => row.slice(0, -1)) })}
                >
                    - Column
                </button>
            </div>
        </div>
    );
};
