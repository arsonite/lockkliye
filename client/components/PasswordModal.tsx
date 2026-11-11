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

// TeaType components
import { TeaModal } from '@teatype/components';

// Utility
import { supported } from '@/tools/lock';

type tPasswordMode = 'create' | 'unlock' | 'change';

interface iPasswordModalProps {
    mode: tPasswordMode | null;
    // What was entered: `current` is the existing password (unlock, change), `next` the new one (create, change).
    // Resolves to an error text, or null when it worked and the modal can close.
    onSubmit: (mode: tPasswordMode, values: { current: string; next: string }) => Promise<string | null>;
    onClose: () => void;
}

const MIN_LENGTH = 4;
const FORM_ID = 'lock-password-form';

const TITLES: Record<tPasswordMode, string> = {
    create: 'Set a password',
    unlock: 'Unlock notes',
    change: 'Change the password',
};

// Asks for the password of the locked notes: a new one (twice), the one that exists, or both to change it
const PasswordModal: React.FC<iPasswordModalProps> = ({ mode, onSubmit, onClose }) => {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [verify, setVerify] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setCurrent('');
        setNext('');
        setVerify('');
        setError(null);
        setBusy(false);
    }, [mode]);

    if (!mode) return null;

    const asksCurrent = mode !== 'create';
    const asksNext = mode !== 'unlock';

    const submit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (busy) return;
        if (asksNext && next.length < MIN_LENGTH) {
            setError(`Use at least ${MIN_LENGTH} characters.`);
            return;
        }
        if (asksNext && next !== verify) {
            setError('The passwords do not match.');
            return;
        }
        setBusy(true);
        setError(null);
        const failure = await onSubmit(mode, { current, next });
        setBusy(false);
        if (failure) setError(failure);
    };

    return (
        <TeaModal
            isOpen
            title={TITLES[mode]}
            onClose={onClose}
            size='sm'
            footer={
                <>
                    <button className='tea-modal-btn tea-modal-btn--secondary' onClick={onClose}>
                        Cancel
                    </button>
                    <button className='tea-modal-btn tea-modal-btn--primary' type='submit' form={FORM_ID} disabled={busy}>
                        {mode === 'unlock' ? 'Unlock' : mode === 'change' ? 'Change' : 'Set password'}
                    </button>
                </>
            }
        >
            <form id={FORM_ID} className='lock-form' onSubmit={submit}>
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
                {!supported() && (
                    <p className='lock-form__error'>
                        Locking needs a secure connection: open the app over HTTPS or on localhost.
                    </p>
                )}
                {mode === 'create' && (
                    <p className='lock-form__hint'>
                        One password locks all notes you choose. It cannot be reset: if it is forgotten, locked notes
                        cannot be read again.
                    </p>
                )}
                {asksCurrent && (
                    <input
                        className='lock-form__input'
                        type='password'
                        name='password'
                        placeholder={mode === 'change' ? 'Current password' : 'Password'}
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                        autoComplete='current-password'
                        autoFocus
                    />
                )}
                {asksNext && (
                    <>
                        <input
                            className='lock-form__input'
                            type='password'
                            name={mode === 'change' ? 'new-password' : 'password'}
                            placeholder={mode === 'change' ? 'New password' : 'Password'}
                            value={next}
                            onChange={(e) => setNext(e.target.value)}
                            autoComplete='new-password'
                            autoFocus={mode === 'create'}
                        />
                        <input
                            className='lock-form__input'
                            type='password'
                            name='new-password-repeat'
                            placeholder='Repeat the password'
                            value={verify}
                            onChange={(e) => setVerify(e.target.value)}
                            autoComplete='new-password'
                        />
                    </>
                )}
                {error && <p className='lock-form__error'>{error}</p>}
            </form>
        </TeaModal>
    );
};

export type { tPasswordMode };
export default PasswordModal;
