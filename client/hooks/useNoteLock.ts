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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// Types
import type { iNotesState } from '@/types';

// Utility
import { LOCK_AFTER_MS, checkPassword, createSetup, isLocked, supported } from '@/tools/lock';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

interface iUseNoteLockProps {
    state: iNotesState;
    setState: Dispatch<SetStateAction<iNotesState>>;
}

// The password of the locked notes. One password opens all of them for this session (`unlocked`, memory only), until
// they are locked again by hand or after a while without input. The notes themselves just carry a `locked` flag.
const useNoteLock = ({ state, setState }: iUseNoteLockProps) => {
    const [unlocked, setUnlocked] = useState(false);
    const lastActive = useRef(Date.now());
    const stateRef = useRef(state);
    stateRef.current = state;

    const hasPassword = !!state.lockSetup;

    const begin = useCallback(() => {
        lastActive.current = Date.now();
        setUnlocked(true);
    }, []);

    const lockAll = useCallback(() => setUnlocked(false), []);

    // The first password: from then on notes can be locked with it
    const createPassword = useCallback(
        async (password: string): Promise<boolean> => {
            if (!supported() || stateRef.current.lockSetup) return false;
            const setup = await createSetup(password);
            setState((prev) => ({ ...prev, lockSetup: setup }));
            begin();
            return true;
        },
        [begin, setState],
    );

    // False for a wrong password
    const unlock = useCallback(
        async (password: string): Promise<boolean> => {
            const setup = stateRef.current.lockSetup;
            if (!supported() || !setup || !(await checkPassword(password, setup))) return false;
            begin();
            return true;
        },
        [begin],
    );

    const setLocked = useCallback(
        (noteId: string, locked: boolean): boolean => {
            const note = stateRef.current.notes.find((n) => n.id === noteId);
            if (!note || isLocked(note) === locked) return false;
            setState((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === noteId ? { ...n, locked } : n)) }));
            return true;
        },
        [setState],
    );

    // A note stays readable until all notes lock
    const lockNote = useCallback((noteId: string): boolean => setLocked(noteId, true), [setLocked]);

    const removeLock = useCallback((noteId: string): boolean => setLocked(noteId, false), [setLocked]);

    // False for a wrong old password
    const changePassword = useCallback(
        async (oldPassword: string, newPassword: string): Promise<boolean> => {
            const setup = stateRef.current.lockSetup;
            if (!supported() || !setup || !(await checkPassword(oldPassword, setup))) return false;
            const next = await createSetup(newPassword);
            setState((prev) => ({ ...prev, lockSetup: next }));
            begin();
            return true;
        },
        [begin, setState],
    );

    // No input for a while: the notes lock again
    useEffect(() => {
        if (!unlocked) return;
        const touch = () => (lastActive.current = Date.now());
        const check = () => {
            if (Date.now() - lastActive.current >= LOCK_AFTER_MS) lockAll();
        };
        ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, touch, { passive: true, capture: true }));
        const timer = setInterval(check, 5000);
        document.addEventListener('visibilitychange', check);
        return () => {
            ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, touch, { capture: true }));
            clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
        };
    }, [unlocked, lockAll]);

    return {
        changePassword,
        createPassword,
        hasPassword,
        lockAll,
        lockNote,
        removeLock,
        reset: lockAll,
        unlock,
        unlocked,
    };
};

export default useNoteLock;
