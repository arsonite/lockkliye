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

// Less than this is a browser bar that comes and goes, not a keyboard
const KEYBOARD_MIN_HEIGHT = 120;
// A keyboard that goes away and comes back within this time (moving from one text to another) did not leave
const CLOSE_DELAY = 400;
// Safari reports the final size of the keyboard some time after it started to slide in
const RECHECK = [0, 120, 350, 700];

// How much of the screen the on-screen keyboard covers, 0 while there is none. Safari on iOS keeps the layout
// viewport as it is and only shrinks the visual one. A pinch zoom shrinks it as well, that is no keyboard.
const measure = (viewport: VisualViewport): number => {
    const covered = window.innerHeight - viewport.height - viewport.offsetTop;
    return viewport.scale <= 1.01 && covered > KEYBOARD_MIN_HEIGHT ? Math.round(covered) : 0;
};

// Where the keyboard starts, in the coordinates of the layout viewport
const topOf = (viewport: VisualViewport): number => Math.round(viewport.offsetTop + viewport.height);

// Tells the listener how much the keyboard covers and where it starts. It reports opening and a change at once and the closing only
// when the keyboard stays away, or the page would jump back and forth between two texts. The size is looked at
// again around a focus change, the events of the viewport do not come for every change of the keyboard.
const watchKeyboard = (listener: (covered: number, top: number) => void): (() => void) => {
    const viewport = window.visualViewport;
    if (!viewport) return () => undefined;
    let current = 0;
    let currentTop = 0;
    let closing = 0;
    const rechecks: number[] = [];

    const update = () => {
        const covered = measure(viewport);
        if (covered > 0) {
            clearTimeout(closing);
            closing = 0;
            const top = topOf(viewport);
            if (covered !== current || top !== currentTop) {
                current = covered;
                currentTop = top;
                listener(covered, top);
            }
        } else if (current > 0 && !closing) {
            closing = window.setTimeout(() => {
                closing = 0;
                if (measure(viewport) === 0) {
                    current = 0;
                    listener(0, 0);
                }
            }, CLOSE_DELAY);
        }
    };
    const recheck = () => {
        rechecks.forEach(clearTimeout);
        rechecks.length = 0;
        RECHECK.forEach((delay) => rechecks.push(window.setTimeout(update, delay)));
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', recheck);
    document.addEventListener('focusout', recheck);
    return () => {
        clearTimeout(closing);
        rechecks.forEach(clearTimeout);
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
        document.removeEventListener('focusin', recheck);
        document.removeEventListener('focusout', recheck);
    };
};

export { watchKeyboard };
