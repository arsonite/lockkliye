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
import { useEffect, useRef } from 'react';

// Utility
import { write, type tKey } from '@/tools/indexedDB';

const DEBOUNCE_MS = 250;

// Keeps a value in IndexedDB. Writes wait for a short pause in the changes, and a value that is still waiting is
// written as soon as the page is hidden or closed.
const usePersist = (key: tKey, value: unknown): void => {
    const latest = useRef(value);
    const pending = useRef(false);
    latest.current = value;

    useEffect(() => {
        pending.current = true;
        const timer = setTimeout(() => {
            pending.current = false;
            write(key, latest.current).catch((error) => console.error(`Could not save "${key}"`, error));
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [key, value]);

    useEffect(() => {
        const flush = () => {
            if (pending.current) {
                pending.current = false;
                write(key, latest.current).catch((error) => console.error(`Could not save "${key}"`, error));
            }
        };
        const onVisibility = () => document.visibilityState === 'hidden' && flush();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', flush);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', flush);
        };
    }, [key]);
};

export default usePersist;
