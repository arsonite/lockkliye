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

// Local imports
import { watchKeyboard } from '@/hooks/keyboard';

// Where the on-screen keyboard starts, in the coordinates of the layout viewport, or null while there is none.
// The height of the visual viewport already leaves out the bar with the Done button above the keys.
const useKeyboardTop = (enabled: boolean): number | null => {
    const [top, setTop] = useState<number | null>(null);

    useEffect(() => {
        if (!enabled || !window.visualViewport) {
            setTop(null);
            return;
        }
        return watchKeyboard((covered, keyboardTop) => setTop(covered > 0 ? keyboardTop : null));
    }, [enabled]);

    return top;
};

export default useKeyboardTop;
