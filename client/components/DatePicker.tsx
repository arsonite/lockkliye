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

// The calendar of a date in the text: shows the date, a click on another day picks it
// React imports
import { useState } from 'react';

// Components
import { PopoverMenu } from './PopoverMenu';

interface iDatePickerProps {
    x: number;
    y: number;
    date: Date;

    onPick: (date: Date) => void;
    onClose: () => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Six weeks from the Monday of the week the month starts in
const weeksOf = (year: number, month: number): Date[][] => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, week) =>
        Array.from(
            { length: 7 },
            (_, day) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day),
        ),
    );
};

export const DatePicker = ({ x, y, date, onPick, onClose }: iDatePickerProps) => {
    const [view, setView] = useState({ year: date.getFullYear(), month: date.getMonth() });
    const today = new Date();

    const move = (months: number) => {
        const next = new Date(view.year, view.month + months, 1);
        setView({ year: next.getFullYear(), month: next.getMonth() });
    };

    return (
        <PopoverMenu x={x} y={y} onClose={onClose}>
            <div className='date-picker'>
                <div className='date-picker__header'>
                    <button className='date-picker__nav' onClick={() => move(-12)} title='Previous year'>
                        «
                    </button>
                    <button className='date-picker__nav' onClick={() => move(-1)} title='Previous month'>
                        ‹
                    </button>
                    <span className='date-picker__title'>
                        {new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </span>
                    <button className='date-picker__nav' onClick={() => move(1)} title='Next month'>
                        ›
                    </button>
                    <button className='date-picker__nav' onClick={() => move(12)} title='Next year'>
                        »
                    </button>
                </div>
                <div className='date-picker__grid'>
                    {WEEKDAYS.map((weekday) => (
                        <span key={weekday} className='date-picker__weekday'>
                            {weekday}
                        </span>
                    ))}
                    {weeksOf(view.year, view.month)
                        .flat()
                        .map((day) => (
                            <button
                                key={day.getTime()}
                                className={[
                                    'date-picker__day',
                                    day.getMonth() !== view.month ? 'date-picker__day--outside' : '',
                                    isSameDay(day, today) ? 'date-picker__day--today' : '',
                                    isSameDay(day, date) ? 'date-picker__day--selected' : '',
                                ].join(' ')}
                                onClick={() => onPick(day)}
                            >
                                {day.getDate()}
                            </button>
                        ))}
                </div>
                <button className='date-picker__today' onClick={() => onPick(today)}>
                    Today
                </button>
            </div>
        </PopoverMenu>
    );
};
