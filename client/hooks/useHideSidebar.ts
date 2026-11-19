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

// React imports
import { useCallback, useState } from 'react';

// Only of this browser (a phone and a laptop want different ones), so it lives in localStorage and is not synced
const HIDE_KEY = 'lockkliye-hide-sidebar';

const read = (): boolean => {
    try {
        return localStorage.getItem(HIDE_KEY) === 'true';
    } catch {
        return false;
    }
};

// On a phone: no sidebar or rail, it comes in from the left edge by a swipe to the right
const useHideSidebar = (): [boolean, (hide: boolean) => void] => {
    const [hide, setHide] = useState(read);

    const change = useCallback((value: boolean) => {
        setHide(value);
        try {
            localStorage.setItem(HIDE_KEY, String(value));
        } catch {
            // Private mode or a full storage: the sidebar is shown again next time
        }
    }, []);

    return [hide, change];
};

export default useHideSidebar;
