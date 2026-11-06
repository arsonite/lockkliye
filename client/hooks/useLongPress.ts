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
import { useCallback, useEffect, useRef } from 'react';

// Types
import type { PointerEvent as ReactPointerEvent } from 'react';

interface iLongPressOptions {
    delay?: number;
    mouse?: boolean; // A held mouse button counts as well, touch and pen always do
}

const MOVE_TOLERANCE = 10;

/**
 * Handlers that call `onLongPress` with the position of the press once it was held still for `delay` ms.
 * `cancel` stops a press that is running, e.g. because the pointer turned into a drag.
 * The click that follows a long press is swallowed, so it does not trigger what the press target does on a tap.
 */
const useLongPress = (
    onLongPress: (point: { x: number; y: number }) => void,
    { delay = 500, mouse = false }: iLongPressOptions = {},
) => {
    const timer = useRef<number | null>(null);
    const start = useRef({ x: 0, y: 0 });
    const fired = useRef(false);
    const callback = useRef(onLongPress);
    callback.current = onLongPress;

    const cancel = useCallback(() => {
        if (timer.current !== null) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    useEffect(() => cancel, [cancel]);

    return {
        cancel,
        handlers: {
            onPointerDown: (event: ReactPointerEvent) => {
                if (event.pointerType === 'mouse' && !mouse) return;
                cancel();
                fired.current = false;
                start.current = { x: event.clientX, y: event.clientY };
                timer.current = window.setTimeout(() => {
                    timer.current = null;
                    fired.current = true;
                    callback.current(start.current);
                }, delay);
            },
            onPointerMove: (event: ReactPointerEvent) => {
                if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > MOVE_TOLERANCE) {
                    cancel();
                }
            },
            onPointerUp: cancel,
            onPointerCancel: cancel,
            onClickCapture: (event: React.MouseEvent) => {
                if (fired.current) {
                    fired.current = false;
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
        },
    };
};

export default useLongPress;
