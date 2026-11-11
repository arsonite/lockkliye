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
import { useState } from 'react';

// TeaType icons
import { LockIcon } from '@teatype/icons';

// Types
import type { iNote } from '@/types';

// Utility
import { supported } from '@/tools/lock';

interface iLockedNoteProps {
    note: iNote;
    hasPassword: boolean;
    unlocked: boolean; // The password was entered, the text is being opened
    unreadable: boolean; // The note was locked with another password
    onUnlock: (password: string) => Promise<boolean>;
}

// Shown instead of a locked note: unlocking one note opens all of them
const LockedNote: React.FC<iLockedNoteProps> = ({ note, hasPassword, unlocked, unreadable, onUnlock }) => {
    const [password, setPassword] = useState('');
    const [wrong, setWrong] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy || !password) return;
        setBusy(true);
        const ok = await onUnlock(password);
        setBusy(false);
        setWrong(!ok);
        if (ok) setPassword('');
    };

    let body: React.ReactNode;
    if (unreadable) {
        body = <p className='locked-note__text'>This note was locked with another password, so it cannot be opened here.</p>;
    } else if (unlocked) {
        body = <p className='locked-note__text'>Opening…</p>;
    } else if (!hasPassword) {
        body = (
            <p className='locked-note__text'>
                The password of this note is not known here yet. Sync with the server to get it (Ctrl+S).
            </p>
        );
    } else {
        body = (
            <form className='locked-note__form' onSubmit={submit}>
                <input
                    className='lock-form__username'
                    type='text'
                    name='username'
                    value='Lockkliye'
                    autoComplete='username'
                    tabIndex={-1}
                    readOnly
                    aria-hidden='true'
                />
                <p className='locked-note__text'>This note is locked. Enter the password to open all locked notes.</p>
                <div className='locked-note__row'>
                    <input
                        className='lock-form__input'
                        type='password'
                        name='password'
                        placeholder='Password'
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setWrong(false);
                        }}
                        autoComplete='current-password'
                        autoFocus
                    />
                    <button className='tea-modal-btn tea-modal-btn--primary' type='submit' disabled={busy || !password}>
                        Unlock
                    </button>
                </div>
                {wrong && <p className='lock-form__error'>Wrong password.</p>}
                {!supported() && (
                    <p className='lock-form__error'>Unlocking needs a secure connection: HTTPS or localhost.</p>
                )}
            </form>
        );
    }

    return (
        <div className='locked-note'>
            <div className='locked-note__icon'>
                <LockIcon />
            </div>
            <h2 className='locked-note__title'>{note.title}</h2>
            {body}
        </div>
    );
};

export default LockedNote;
