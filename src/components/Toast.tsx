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
import { useEffect, useState, useRef } from 'react';

export type tToastType = 'success' | 'error' | 'info' | 'warning';
export type tToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface iToastProps {
    message: string;
    type?: tToastType;
    duration?: number;
    onClose: () => void;
}

export const Toast = ({ message, type = 'info', duration = 5000, onClose }: iToastProps) => {
    const [isClosing, setIsClosing] = useState(false);
    const [progress, setProgress] = useState(360); // degrees
    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const isPausedRef = useRef(false);
    const remainingTimeRef = useRef(duration);

    useEffect(() => {
        const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;

            if (isPausedRef.current) {
                startTimeRef.current = timestamp - (duration - remainingTimeRef.current);
                animationRef.current = requestAnimationFrame(animate);
                return;
            }

            const elapsed = timestamp - startTimeRef.current;
            const remaining = Math.max(0, duration - elapsed);
            remainingTimeRef.current = remaining;
            const progressPercent = remaining / duration;
            setProgress(progressPercent * 360);

            if (remaining <= 0) {
                setIsClosing(true);
            } else {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [duration]);

    useEffect(() => {
        if (isClosing) {
            const closeTimer = setTimeout(() => {
                onClose();
            }, 300); // Match animation duration
            return () => clearTimeout(closeTimer);
        }
    }, [isClosing, onClose]);

    const handleClick = () => {
        setIsClosing(true);
    };

    const handleMouseEnter = () => {
        isPausedRef.current = true;
    };

    const handleMouseLeave = () => {
        isPausedRef.current = false;
        startTimeRef.current = null;
    };

    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            case 'info':
            default:
                return 'ℹ';
        }
    };

    return (
        <div
            className={`toast toast--${type} ${isClosing ? 'toast--closing' : ''}`}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={
                {
                    '--toast-duration': `${duration}ms`,
                    '--toast-progress': `${progress}deg`,
                } as React.CSSProperties
            }
        >
            <div className='toast__border-timer' />
            <div className='toast__content'>
                <span className='toast__icon'>{getIcon()}</span>
                <span className='toast__message'>{message}</span>
            </div>
        </div>
    );
};

// Toast container for managing multiple toasts
interface iToastItem {
    id: string;
    message: string;
    type: tToastType;
    duration?: number;
}

interface iToastContainerProps {
    toasts: iToastItem[];
    onRemove: (id: string) => void;
    position?: tToastPosition;
}

export const ToastContainer = ({ toasts, onRemove, position = 'bottom-right' }: iToastContainerProps) => {
    if (toasts.length === 0) return null;

    return (
        <div className={`toast-container toast-container--${position}`}>
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => onRemove(toast.id)}
                />
            ))}
        </div>
    );
};

// Hook for managing toasts
export const useToast = (position: tToastPosition = 'bottom-right') => {
    const [toasts, setToasts] = useState<iToastItem[]>([]);

    const addToast = (message: string, type: tToastType = 'info', duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts((prev) => [...prev, { id, message, type, duration }]);
        return id;
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const success = (message: string, duration?: number) => addToast(message, 'success', duration);
    const error = (message: string, duration?: number) => addToast(message, 'error', duration);
    const warning = (message: string, duration?: number) => addToast(message, 'warning', duration);
    const info = (message: string, duration?: number) => addToast(message, 'info', duration);

    return {
        toasts,
        position,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
    };
};
