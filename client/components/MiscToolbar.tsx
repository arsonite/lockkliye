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
import { LockIcon, UnlockIcon, WorkspaceIcon } from '@teatype/icons';

// Hooks
import useHeldModifiers from '@/hooks/useHeldModifiers';

// Utility
import { shortcutBase, shortcutKey, shortcutText } from '@/tools/shortcuts';

interface iMiscToolbarProps {
    locked?: boolean; // The note has a lock, only then there is a button for it
    unlocked: boolean; // Locked notes are readable right now
    onLockAll: () => void;
    workspaceOpen?: boolean;
    onWorkspaceToggle?: () => void; // No button for the workspace where there is none to open
}

// The second bar, next to the one for formatting: things that are not about the text, like locking the notes or the workspace
const MiscToolbar: React.FC<iMiscToolbarProps> = ({ locked = true, unlocked, onLockAll, workspaceOpen, onWorkspaceToggle }) => {
    const heldModifiers = useHeldModifiers();
    const hinted = heldModifiers === shortcutBase('lockAll').toLowerCase();
    const workspaceHinted = heldModifiers === shortcutBase('toggleWorkspace').toLowerCase();

    return (
        <div className='floating-toolbar floating-toolbar--misc'>
            <div className='floating-toolbar__inner'>
                {locked && (
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
                                : 'All notes are locked'
                        }
                    >
                        {unlocked ? <UnlockIcon /> : <LockIcon />}
                        {hinted && <span className='floating-toolbar__key'>{shortcutKey('lockAll')}</span>}
                    </button>
                )}
                {onWorkspaceToggle && (
                    <button
                        className={`floating-toolbar__btn ${workspaceOpen ? 'floating-toolbar__btn--open' : ''} ${
                            workspaceHinted ? 'floating-toolbar__btn--hint' : ''
                        }`}
                        onClick={onWorkspaceToggle}
                        onMouseDown={(e) => e.preventDefault()}
                        title={`${workspaceOpen ? 'Close' : 'Open'} the workspace for comments, drafts and unfinished text (${shortcutText('toggleWorkspace')})`}
                    >
                        <WorkspaceIcon />
                        {workspaceHinted && <span className='floating-toolbar__key'>{shortcutKey('toggleWorkspace')}</span>}
                    </button>
                )}
            </div>
        </div>
    );
};

export default MiscToolbar;
