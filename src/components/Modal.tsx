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

import { useEffect, useRef } from 'react';

export interface iModalButton {
    label: string;
    variant?: 'primary' | 'danger' | 'secondary';
    onClick: () => void;
}

interface iModalProps {
    isOpen: boolean;
    title?: string;
    message?: string;
    children?: React.ReactNode;
    buttons?: iModalButton[];
    onClose: () => void;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
}

export const Modal: React.FC<iModalProps> = ({
    isOpen,
    title,
    message,
    children,
    buttons = [],
    onClose,
    closeOnOverlay = true,
    closeOnEscape = true,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle escape key
    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeOnEscape, onClose]);

    // Focus trap and auto-focus first button
    useEffect(() => {
        if (!isOpen || !modalRef.current) return;

        const firstButton = modalRef.current.querySelector('button');
        if (firstButton) {
            firstButton.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (closeOnOverlay && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className='modal-overlay' onClick={handleOverlayClick}>
            <div className='modal' ref={modalRef}>
                {title && (
                    <div className='modal__header'>
                        <h3 className='modal__title'>{title}</h3>
                        <button className='modal__close' onClick={onClose}>
                            ×
                        </button>
                    </div>
                )}
                <div className='modal__body'>
                    {message && <p className='modal__message'>{message}</p>}
                    {children}
                </div>
                {buttons.length > 0 && (
                    <div className='modal__footer'>
                        {buttons.map((btn, index) => (
                            <button
                                key={index}
                                className={`modal__btn modal__btn--${btn.variant || 'secondary'}`}
                                onClick={btn.onClick}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Confirmation dialog helper
export interface iConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
}

export default Modal;
