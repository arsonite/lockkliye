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
import { createBlock, createWord } from '@/types';
import type { iHistoryEntry, iNotesState, iSealed, iTextBlock } from '@/types';

// Utility
import {
    LOCK_AFTER_MS,
    createSetup,
    closed,
    isLocked,
    isOpen,
    openSetup,
    sealBlocks,
    supported,
    unsealBlocks,
} from '@/tools/lock';

// Edits of an open note are sealed again after a short pause, not with every key
const SEAL_DEBOUNCE_MS = 250;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

interface iUseNoteLockProps {
    state: iNotesState;
    setState: Dispatch<SetStateAction<iNotesState>>;
    setHistory: Dispatch<SetStateAction<iHistoryEntry[]>>;
    setRedoStack: Dispatch<SetStateAction<iHistoryEntry[]>>;
}

// The password of the locked notes. One password opens all of them, the key lives in memory only. While the key is
// there, the open notes carry their readable blocks and `lock` is kept up to date with them (that is what is saved);
// without it the blocks of a locked note are empty.
const useNoteLock = ({ state, setState, setHistory, setRedoStack }: iUseNoteLockProps) => {
    const keyRef = useRef<CryptoKey | null>(null);
    const [unlocked, setUnlocked] = useState(false);
    // Locks that no password of this browser opens (made with another one), by their sealed text
    const [unreadable, setUnreadable] = useState<string[]>([]);
    // The blocks of every open note as they were last sealed or opened: an open note with other blocks was edited
    const sealed = useRef(new Map<string, iTextBlock[]>());
    // Set while all notes close, so that the key does not open the ones just closed
    const closing = useRef(false);
    const lastActive = useRef(Date.now());
    const stateRef = useRef(state);
    stateRef.current = state;

    const hasPassword = !!state.lockSetup;

    const begin = useCallback((key: CryptoKey) => {
        keyRef.current = key;
        lastActive.current = Date.now();
        setUnreadable([]);
        setUnlocked(true);
    }, []);

    // Opens what the key can open, seals what was edited
    useEffect(() => {
        const key = keyRef.current;
        if (!unlocked || !key) return;

        const locked = state.notes.filter(isLocked);
        const toOpen = closing.current ? [] : locked.filter((note) => !note.open && !unreadable.includes(note.lock?.data ?? ''));
        const toSeal = locked.filter((note) => note.open && sealed.current.get(note.id) !== note.blocks);
        if (toOpen.length === 0 && toSeal.length === 0) return;

        const timer = setTimeout(
            async () => {
                for (const note of toOpen) {
                    const lock = note.lock as iSealed;
                    try {
                        const blocks = await unsealBlocks(key, lock);
                        const readable = blocks.length > 0 ? blocks : [createBlock([createWord('')])];
                        sealed.current.set(note.id, readable);
                        setState((prev) => ({
                            ...prev,
                            notes: prev.notes.map((n) =>
                                n.id === note.id && !n.open && n.lock?.data === lock.data
                                    ? { ...n, blocks: readable, open: true }
                                    : n,
                            ),
                        }));
                    } catch {
                        setUnreadable((prev) => [...prev, lock.data]);
                    }
                }
                for (const note of toSeal) {
                    const blocks = note.blocks;
                    const lock = await sealBlocks(key, blocks);
                    sealed.current.set(note.id, blocks);
                    setState((prev) => ({
                        ...prev,
                        notes: prev.notes.map((n) => (n.id === note.id && n.blocks === blocks ? { ...n, lock } : n)),
                    }));
                }
            },
            toSeal.length > 0 ? SEAL_DEBOUNCE_MS : 0,
        );
        return () => clearTimeout(timer);
    }, [state.notes, unlocked, unreadable, setState]);

    const forgetHistoryOf = useCallback(
        (noteIds: Set<string>) => {
            setHistory((prev) => prev.filter((entry) => !noteIds.has(entry.noteId)));
            setRedoStack((prev) => prev.filter((entry) => !noteIds.has(entry.noteId)));
        },
        [setHistory, setRedoStack],
    );

    const reset = useCallback(() => {
        keyRef.current = null;
        sealed.current.clear();
        setUnreadable([]);
        setUnlocked(false);
    }, []);

    // The first password: from then on notes can be locked with it
    const createPassword = useCallback(
        async (password: string): Promise<boolean> => {
            if (!supported() || stateRef.current.lockSetup) return false;
            const { key, setup } = await createSetup(password);
            setState((prev) => ({ ...prev, lockSetup: setup }));
            begin(key);
            return true;
        },
        [begin, setState],
    );

    // False for a wrong password
    const unlock = useCallback(
        async (password: string): Promise<boolean> => {
            const setup = stateRef.current.lockSetup;
            if (!supported() || !setup) return false;
            const key = await openSetup(password, setup);
            if (!key) return false;
            begin(key);
            return true;
        },
        [begin],
    );

    // Locks a note, which stays readable until all notes lock
    const lockNote = useCallback(
        async (noteId: string): Promise<boolean> => {
            const key = keyRef.current;
            const note = stateRef.current.notes.find((n) => n.id === noteId);
            if (!key || !note || isLocked(note)) return false;
            const blocks = note.blocks;
            const lock = await sealBlocks(key, blocks);
            sealed.current.set(noteId, blocks);
            setState((prev) => ({
                ...prev,
                notes: prev.notes.map((n) => (n.id === noteId ? { ...n, lock, open: true } : n)),
            }));
            // What was done to the note so far is readable in the history, which is not kept for locked notes
            forgetHistoryOf(new Set([noteId]));
            return true;
        },
        [forgetHistoryOf, setState],
    );

    // Takes the lock off an open note
    const removeLock = useCallback(
        (noteId: string): boolean => {
            const note = stateRef.current.notes.find((n) => n.id === noteId);
            if (!note || !isOpen(note)) return false;
            sealed.current.delete(noteId);
            setState((prev) => ({
                ...prev,
                notes: prev.notes.map((n) => {
                    if (n.id !== noteId) return n;
                    return { ...closed(n), lock: { data: '', iv: '' } };
                }),
            }));
            return true;
        },
        [setState],
    );

    // Closes every note: the edits are sealed, the readable text is dropped and so is the key
    const lockAll = useCallback(async (): Promise<void> => {
        const key = keyRef.current;
        if (!key) return;

        closing.current = true;
        for (let attempt = 0; attempt < 5; attempt++) {
            for (const note of stateRef.current.notes.filter((n) => isOpen(n) && sealed.current.get(n.id) !== n.blocks)) {
                const blocks = note.blocks;
                const lock = await sealBlocks(key, blocks);
                sealed.current.set(note.id, blocks);
                setState((prev) => ({
                    ...prev,
                    notes: prev.notes.map((n) => (n.id === note.id && n.blocks === blocks ? { ...n, lock } : n)),
                }));
            }
            // Only notes whose text is the sealed one close, one that was edited in the meantime waits for the next round
            setState((prev) => ({
                ...prev,
                notes: prev.notes.map((n) => {
                    if (!isOpen(n) || sealed.current.get(n.id) !== n.blocks) return n;
                    return { ...closed(n), blocks: [] };
                }),
            }));
            await new Promise((resolve) => setTimeout(resolve, 60));
            if (!stateRef.current.notes.some(isOpen)) break;
        }

        if (!stateRef.current.notes.some(isOpen)) {
            forgetHistoryOf(new Set(stateRef.current.notes.filter(isLocked).map((n) => n.id)));
            reset();
        }
        closing.current = false;
    }, [forgetHistoryOf, reset, setState]);

    // A new password for all locked notes, they are sealed again with it. False for a wrong old password.
    const changePassword = useCallback(
        async (oldPassword: string, newPassword: string): Promise<boolean> => {
            const setup = stateRef.current.lockSetup;
            if (!supported() || !setup) return false;
            const oldKey = await openSetup(oldPassword, setup);
            if (!oldKey) return false;

            const { key, setup: next } = await createSetup(newPassword);
            const resealed = new Map<string, { lock: iSealed; blocks: iTextBlock[] }>();
            for (const note of stateRef.current.notes.filter(isLocked)) {
                try {
                    const blocks = note.open ? note.blocks : await unsealBlocks(oldKey, note.lock as iSealed);
                    resealed.set(note.id, { lock: await sealBlocks(key, blocks), blocks });
                } catch {
                    // Made with another password, it stays as it is
                }
            }
            resealed.forEach(({ blocks }, id) => {
                if (stateRef.current.notes.find((n) => n.id === id)?.open) sealed.current.set(id, blocks);
            });
            setState((prev) => ({
                ...prev,
                lockSetup: next,
                notes: prev.notes.map((n) => {
                    const done = resealed.get(n.id);
                    return done && isLocked(n) && (!n.open || n.blocks === done.blocks) ? { ...n, lock: done.lock } : n;
                }),
            }));
            begin(key);
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
        reset,
        unlock,
        unlocked,
        unreadable,
    };
};

export default useNoteLock;
