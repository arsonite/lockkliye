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
import type { iLockSetup, iNote, iSealed, iTextBlock } from '@/types';

// One password for all locked notes: PBKDF2 turns it into an AES-GCM key that only lives in memory.
// The text of a locked note is encrypted with it, the title stays readable like in iCloud Notes.
const ITERATIONS = 310_000;
const CHECK_TEXT = 'lockkliye';

// Locked notes close again after this long without any input
const LOCK_AFTER_MS = 10 * 60 * 1000;

const supported = (): boolean => typeof crypto !== 'undefined' && !!crypto.subtle;

const toBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
    return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

// A note with an empty seal had its lock taken off, see iNote.lock
const isLocked = (note: Pick<iNote, 'lock'>): boolean => !!note.lock?.data;

// Locked and readable right now
const isOpen = (note: Pick<iNote, 'lock' | 'open'>): boolean => isLocked(note) && !!note.open;

const deriveKey = async (password: string, salt: string): Promise<CryptoKey> => {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
        'deriveKey',
    ]);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: fromBase64(salt), iterations: ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
};

const seal = async (key: CryptoKey, text: string): Promise<iSealed> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    return { data: toBase64(new Uint8Array(data)), iv: toBase64(iv) };
};

const unseal = async (key: CryptoKey, sealed: iSealed): Promise<string> => {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.data));
    return new TextDecoder().decode(data);
};

const sealBlocks = (key: CryptoKey, blocks: iTextBlock[]): Promise<iSealed> => seal(key, JSON.stringify(blocks));

const unsealBlocks = async (key: CryptoKey, sealed: iSealed): Promise<iTextBlock[]> => {
    const blocks = JSON.parse(await unseal(key, sealed));
    if (!Array.isArray(blocks)) throw new Error('The sealed text is not a list of blocks');
    return blocks;
};

// A new password: its salt and the proof that the key is the right one
const createSetup = async (password: string): Promise<{ key: CryptoKey; setup: iLockSetup }> => {
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const key = await deriveKey(password, salt);
    return { key, setup: { salt, check: await seal(key, CHECK_TEXT) } };
};

// The key of the password, or null when the password is wrong
const openSetup = async (password: string, setup: iLockSetup): Promise<CryptoKey | null> => {
    try {
        const key = await deriveKey(password, setup.salt);
        return (await unseal(key, setup.check)) === CHECK_TEXT ? key : null;
    } catch {
        return null;
    }
};

const sanitizeSealed = (value: unknown): iSealed | null => {
    const sealed = value as Partial<iSealed> | null | undefined;
    return typeof sealed?.data === 'string' && typeof sealed?.iv === 'string' ? { data: sealed.data, iv: sealed.iv } : null;
};

const sanitizeLockSetup = (value: unknown): iLockSetup | null => {
    const setup = value as Partial<iLockSetup> | null | undefined;
    const check = sanitizeSealed(setup?.check);
    return typeof setup?.salt === 'string' && check ? { salt: setup.salt, check } : null;
};

// The note without its in-memory `open` flag
const closed = (note: iNote): iNote => {
    const copy = { ...note };
    delete copy.open;
    return copy;
};

// What leaves the memory (IndexedDB, backups, the server): a locked note without its readable text
const withoutText = (note: iNote): iNote => {
    if (!isLocked(note)) return note;
    const rest = closed(note);
    return rest.blocks.length === 0 ? rest : { ...rest, blocks: [] };
};

export { ITERATIONS, closed, LOCK_AFTER_MS, createSetup, isLocked, isOpen, openSetup, sanitizeLockSetup, sanitizeSealed, sealBlocks, supported, unsealBlocks, withoutText };
