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

// Types
import type { iLockSetup, iNote } from '@/types';

// Locking is a gate in the app, the text of a locked note is stored like any other. One password is shared by all
// locked notes, only a salted hash of it is kept (PBKDF2), so the password itself can neither be read nor guessed fast.
const ITERATIONS = 100_000;

// Locked notes close again after this long without any input
const LOCK_AFTER_MS = 10 * 60 * 1000;

const supported = (): boolean => typeof crypto !== 'undefined' && !!crypto.subtle;

const toBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
    return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

const isLocked = (note: Pick<iNote, 'locked'>): boolean => !!note.locked;

const hashOf = async (password: string, salt: string): Promise<string> => {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
        'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: fromBase64(salt), iterations: ITERATIONS, hash: 'SHA-256' },
        material,
        256,
    );
    return toBase64(new Uint8Array(bits));
};

const createSetup = async (password: string): Promise<iLockSetup> => {
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    return { salt, hash: await hashOf(password, salt) };
};

const checkPassword = async (password: string, setup: iLockSetup): Promise<boolean> => {
    try {
        return (await hashOf(password, setup.salt)) === setup.hash;
    } catch {
        return false;
    }
};

const sanitizeLockSetup = (value: unknown): iLockSetup | null => {
    const setup = value as Partial<iLockSetup> | null | undefined;
    return typeof setup?.salt === 'string' && typeof setup?.hash === 'string' ? { salt: setup.salt, hash: setup.hash } : null;
};

export { LOCK_AFTER_MS, checkPassword, createSetup, isLocked, sanitizeLockSetup, supported };
