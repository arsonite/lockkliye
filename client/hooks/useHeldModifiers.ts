/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 */

// React imports
import { useEffect, useState } from 'react';

// The modifier keys that are held right now, in the order a shortcut is written: 'ctrl', 'ctrl+shift', ...
const useHeldModifiers = (): string => {
    const [held, setHeld] = useState('');

    useEffect(() => {
        const update = (event: KeyboardEvent) =>
            setHeld(
                [event.ctrlKey || event.metaKey ? 'ctrl' : '', event.shiftKey ? 'shift' : '', event.altKey ? 'alt' : '']
                    .filter(Boolean)
                    .join('+'),
            );
        const reset = () => setHeld('');
        window.addEventListener('keydown', update);
        window.addEventListener('keyup', update);
        window.addEventListener('blur', reset);
        return () => {
            window.removeEventListener('keydown', update);
            window.removeEventListener('keyup', update);
            window.removeEventListener('blur', reset);
        };
    }, []);

    return held;
};

export default useHeldModifiers;
