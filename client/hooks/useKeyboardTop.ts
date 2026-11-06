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
import { useEffect, useState } from 'react';

// Less than this is a browser bar that comes and goes, not a keyboard
const KEYBOARD_MIN_HEIGHT = 120;

// Where the on-screen keyboard starts, in the coordinates of the layout viewport, or null while there is none.
// Safari on iOS keeps the layout viewport as it is and only shrinks the visual one, so what the page has to
// follow is the visual viewport. Its height already leaves out the bar with the Done button above the keys.
const useKeyboardTop = (enabled: boolean): number | null => {
    const [top, setTop] = useState<number | null>(null);

    useEffect(() => {
        const viewport = window.visualViewport;
        if (!enabled || !viewport) {
            setTop(null);
            return;
        }
        const update = () => {
            // A pinch zoom shrinks the visual viewport as well
            const covered = window.innerHeight - viewport.height - viewport.offsetTop;
            const open = viewport.scale <= 1.01 && covered > KEYBOARD_MIN_HEIGHT;
            setTop(open ? Math.round(viewport.offsetTop + viewport.height) : null);
        };
        update();
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        return () => {
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
        };
    }, [enabled]);

    return top;
};

export default useKeyboardTop;
