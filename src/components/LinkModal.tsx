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

import { useState, useEffect, useRef } from 'react';

interface iLinkModalProps {
    isOpen: boolean;
    currentLink?: string;
    wordText: string;
    position: { x: number; y: number };
    onSave: (url: string) => void;
    onDelete: () => void;
    onClose: () => void;
}

export const LinkModal: React.FC<iLinkModalProps> = ({
    isOpen,
    currentLink,
    wordText,
    position,
    onSave,
    onDelete,
    onClose,
}) => {
    const [url, setUrl] = useState(currentLink || '');
    const inputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setUrl(currentLink || '');
    }, [currentLink, isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen]);

    // Handle click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Delay adding the listener to prevent immediate close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter') {
                handleSave();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, url, onClose]);

    const handleSave = () => {
        if (url.trim()) {
            // Add https:// if no protocol specified
            let finalUrl = url.trim();
            if (!/^https?:\/\//i.test(finalUrl)) {
                finalUrl = 'https://' + finalUrl;
            }
            onSave(finalUrl);
        }
        onClose();
    };

    if (!isOpen) return null;

    // Calculate position - ensure modal stays within viewport
    const modalStyle: React.CSSProperties = {
        position: 'fixed',
        left: position.x,
        top: position.y - 10, // Position above the word
        transform: 'translate(-50%, -100%)',
        zIndex: 10000,
    };

    return (
        <div ref={modalRef} className='link-modal' style={modalStyle}>
            <div className='link-modal__header'>
                <span className='link-modal__word'>"{wordText}"</span>
                {currentLink && (
                    <button
                        className='link-modal__delete'
                        onClick={() => {
                            onDelete();
                            onClose();
                        }}
                        title='Remove link'
                    >
                        🗑️
                    </button>
                )}
            </div>
            <div className='link-modal__body'>
                <input
                    ref={inputRef}
                    type='url'
                    className='link-modal__input'
                    placeholder='Enter URL (e.g., https://example.com)'
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
            </div>
            <div className='link-modal__footer'>
                <button className='link-modal__btn link-modal__btn--secondary' onClick={onClose}>
                    Cancel
                </button>
                <button
                    className='link-modal__btn link-modal__btn--primary'
                    onClick={handleSave}
                    disabled={!url.trim()}
                >
                    {currentLink ? 'Update' : 'Add Link'}
                </button>
            </div>
        </div>
    );
};

export default LinkModal;
