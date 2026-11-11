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

// TeaType icons
import { LockIcon, UnlockIcon } from '@teatype/icons';

// Hooks
import useHeldModifiers from '@/hooks/useHeldModifiers';

// Utility
import { shortcutBase, shortcutKey, shortcutText } from '@/tools/shortcuts';

interface iMiscToolbarProps {
    unlocked: boolean; // Locked notes are readable right now
    onLockAll: () => void;
}

// The second bar, next to the one for formatting: things that are not about the text, like locking the notes
const MiscToolbar: React.FC<iMiscToolbarProps> = ({ unlocked, onLockAll }) => {
    const heldModifiers = useHeldModifiers();
    const hinted = heldModifiers === shortcutBase('lockAll').toLowerCase();

    return (
        <div className='floating-toolbar floating-toolbar--misc'>
            <div className='floating-toolbar__inner'>
                <button
                    className={`floating-toolbar__btn ${unlocked ? 'floating-toolbar__btn--open' : ''} ${
                        hinted ? 'floating-toolbar__btn--hint' : ''
                    }`}
                    onClick={onLockAll}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={!unlocked}
                    title={
                        unlocked
                            ? `Lock all notes (${shortcutText('lockAll')}), they also lock after 10 minutes without input`
                            : 'No locked note is open'
                    }
                >
                    {unlocked ? <UnlockIcon /> : <LockIcon />}
                    {hinted && <span className='floating-toolbar__key'>{shortcutKey('lockAll')}</span>}
                </button>
            </div>
        </div>
    );
};

export default MiscToolbar;
