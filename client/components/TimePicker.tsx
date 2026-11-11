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

// The clock of a time in the text: the hour and then the minute are set by turning the hand
// React imports
import { useRef, useState } from 'react';

// Components
import { PopoverMenu } from './PopoverMenu';

interface iTimePickerProps {
    x: number;
    y: number;
    hours: number;
    minutes: number;
    twelve: boolean; // The time is written with am or pm, so the clock has one ring and an AM/PM switch

    onPick: (hours: number, minutes: number) => void;
    onClose: () => void;
}

type tUnit = 'hours' | 'minutes';

const SIZE = 200;
const CENTER = SIZE / 2;
const OUTER = 80;
const INNER = 52;

const pad = (value: number): string => String(value).padStart(2, '0');

// A point of the dial, the angle is in degrees clockwise from the top
const pointAt = (angle: number, radius: number) => ({
    x: CENTER + radius * Math.sin((angle * Math.PI) / 180),
    y: CENTER - radius * Math.cos((angle * Math.PI) / 180),
});

export const TimePicker = ({
    x,
    y,
    hours: initialHours,
    minutes: initialMinutes,
    twelve,
    onPick,
    onClose,
}: iTimePickerProps) => {
    const [hours, setHours] = useState(initialHours);
    const [minutes, setMinutes] = useState(initialMinutes);
    const [unit, setUnit] = useState<tUnit>('hours');
    const dial = useRef<SVGSVGElement>(null);
    const turning = useRef(false);

    const pm = hours >= 12;
    // The outer ring is 12, 1 to 11 (13 to 23 in a 24 hour day shares its places), the inner ring 00 and 13 to 23
    const inner = !twelve && hours !== 12 && (hours === 0 || hours > 12);
    const hourAngle = (hours % 12) * 30;
    const handAngle = unit === 'hours' ? hourAngle : minutes * 6;
    const handRadius = unit === 'hours' && inner ? INNER : OUTER;
    const tip = pointAt(handAngle, handRadius);

    // Sets the hour or the minute that the pointer is on
    const turnTo = (event: React.PointerEvent<SVGSVGElement>) => {
        const rect = dial.current?.getBoundingClientRect();
        if (!rect) return;
        const scale = SIZE / rect.width;
        const dx = (event.clientX - rect.left) * scale - CENTER;
        const dy = (event.clientY - rect.top) * scale - CENTER;
        const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
        const turn = (angle + 360) % 360;

        if (unit === 'minutes') {
            setMinutes(Math.round(turn / 6) % 60);
            return;
        }
        const place = Math.round(turn / 30) % 12;
        if (twelve) {
            setHours(place + (pm ? 12 : 0));
        } else if (Math.hypot(dx, dy) < (INNER + OUTER) / 2) {
            setHours(place === 0 ? 0 : place + 12);
        } else {
            setHours(place === 0 ? 12 : place);
        }
    };

    const startTurning = (event: React.PointerEvent<SVGSVGElement>) => {
        turning.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        turnTo(event);
    };

    const stopTurning = () => {
        if (!turning.current) return;
        turning.current = false;
        if (unit === 'hours') setUnit('minutes');
    };

    const switchHalf = (toPm: boolean) => {
        if (toPm !== pm) setHours((hours + 12) % 24);
    };

    const places = Array.from({ length: 12 }, (_, place) => place);
    const minutePlaces = places.map((place) => place * 5);

    return (
        <PopoverMenu x={x} y={y} onClose={onClose}>
            <div className='time-picker'>
                <div className='time-picker__header'>
                    <button
                        className={`time-picker__unit ${unit === 'hours' ? 'time-picker__unit--active' : ''}`}
                        onClick={() => setUnit('hours')}
                        title='Hour'
                    >
                        {pad(twelve ? hours % 12 || 12 : hours)}
                    </button>
                    <span className='time-picker__colon'>:</span>
                    <button
                        className={`time-picker__unit ${unit === 'minutes' ? 'time-picker__unit--active' : ''}`}
                        onClick={() => setUnit('minutes')}
                        title='Minute'
                    >
                        {pad(minutes)}
                    </button>
                    {twelve && (
                        <div className='time-picker__halves'>
                            <button
                                className={`time-picker__half ${!pm ? 'time-picker__half--active' : ''}`}
                                onClick={() => switchHalf(false)}
                            >
                                AM
                            </button>
                            <button
                                className={`time-picker__half ${pm ? 'time-picker__half--active' : ''}`}
                                onClick={() => switchHalf(true)}
                            >
                                PM
                            </button>
                        </div>
                    )}
                </div>

                <svg
                    ref={dial}
                    className='time-picker__dial'
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    onPointerDown={startTurning}
                    onPointerMove={(event) => turning.current && turnTo(event)}
                    onPointerUp={stopTurning}
                    onPointerCancel={stopTurning}
                >
                    <circle className='time-picker__face' cx={CENTER} cy={CENTER} r={CENTER - 2} />
                    <line className='time-picker__hand' x1={CENTER} y1={CENTER} x2={tip.x} y2={tip.y} />
                    <circle className='time-picker__hand-dot' cx={CENTER} cy={CENTER} r={3} />
                    <circle className='time-picker__hand-tip' cx={tip.x} cy={tip.y} r={15} />
                    {unit === 'hours'
                        ? places.flatMap((place) => {
                              const outerHour = place === 0 ? 12 : place;
                              const innerHour = place === 0 ? 0 : place + 12;
                              const rings = twelve
                                  ? [[outerHour, OUTER]]
                                  : [
                                        [outerHour, OUTER],
                                        [innerHour, INNER],
                                    ];
                              return rings.map(([hour, radius]) => {
                                  const point = pointAt(place * 30, radius);
                                  const selected = twelve ? hours % 12 === place : hours === hour;
                                  return (
                                      <text
                                          key={`${hour}`}
                                          className={`time-picker__number ${selected ? 'time-picker__number--selected' : ''}`}
                                          x={point.x}
                                          y={point.y}
                                          textAnchor='middle'
                                          dominantBaseline='central'
                                      >
                                          {radius === INNER ? pad(hour) : hour}
                                      </text>
                                  );
                              });
                          })
                        : minutePlaces.map((minute) => {
                              const point = pointAt(minute * 6, OUTER);
                              return (
                                  <text
                                      key={minute}
                                      className={`time-picker__number ${minutes === minute ? 'time-picker__number--selected' : ''}`}
                                      x={point.x}
                                      y={point.y}
                                      textAnchor='middle'
                                      dominantBaseline='central'
                                  >
                                      {pad(minute)}
                                  </text>
                              );
                          })}
                </svg>

                <div className='time-picker__footer'>
                    <button
                        className='time-picker__action'
                        onClick={() => {
                            const now = new Date();
                            onPick(now.getHours(), now.getMinutes());
                        }}
                    >
                        Now
                    </button>
                    <button
                        className='time-picker__action time-picker__action--primary'
                        onClick={() => onPick(hours, minutes)}
                    >
                        Set
                    </button>
                </div>
            </div>
        </PopoverMenu>
    );
};
