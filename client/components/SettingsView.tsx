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
import { useRef, useState } from 'react';

// TeaType components
import { TeaModal, TeaSettingsPage, type iTeaSettingsCategory, type iUseTeaToastReturn } from '@teatype/components';

// Components
import PaletteEditor from './PaletteEditor';

// Types
import type { iPalette, tPaletteKind } from '@/types';

// Utils
import { generateShortText, generateLongText, generateTitle, copyToClipboard } from '@/util/randomGenerator';

interface iSettingsViewProps {
    lightMode: boolean;
    editorWidth: number;
    confirmDeletions: boolean;
    palette: iPalette;
    onToggleLightMode: () => void;
    onEditorWidthChange: (width: number) => void;
    onConfirmDeletionsChange: (value: boolean) => void;
    onTogglePaletteEntry: (kind: tPaletteKind, value: string) => void;
    onAddPaletteEntry: (kind: tPaletteKind, value: string) => void;
    onRemovePaletteEntry: (kind: tPaletteKind, value: string) => void;
    onExportText: () => string;
    onExportJson: () => string;
    onExportSettings: () => string;
    onExportHistory: () => string;
    onImportNotes: (json: string) => boolean;
    onImportSettings: (json: string) => boolean;
    onImportHistory: (json: string) => boolean;
    onCreateRandomNote: () => void;
    onClearAllData: () => void;
    onClose: () => void;
    toast: iUseTeaToastReturn;
}

interface iImportJob {
    run: (json: string) => boolean;
    success: string;
    failure: string;
}

const downloadFile = (content: string, filename: string, mimeType: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

// The settings of the app, described for the TeaSettingsPage
export const SettingsView = ({
    lightMode,
    editorWidth,
    confirmDeletions,
    palette,
    onToggleLightMode,
    onEditorWidthChange,
    onConfirmDeletionsChange,
    onTogglePaletteEntry,
    onAddPaletteEntry,
    onRemovePaletteEntry,
    onExportText,
    onExportJson,
    onExportSettings,
    onExportHistory,
    onImportNotes,
    onImportSettings,
    onImportHistory,
    onCreateRandomNote,
    onClearAllData,
    onClose,
    toast,
}: iSettingsViewProps) => {
    const [showClearDataModal, setShowClearDataModal] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const importJob = useRef<iImportJob | null>(null);

    const startImport = (job: iImportJob) => {
        importJob.current = job;
        fileInput.current?.click();
    };

    const exportAs = (content: string, filename: string, mimeType: string, message: string) => {
        downloadFile(content, filename, mimeType);
        toast.success(message);
    };

    const copyGenerated = async (text: string, name: string) => {
        if (await copyToClipboard(text)) toast.success(`${name} copied!`);
        else toast.error('Failed to copy');
    };

    const paletteItem = (kind: tPaletteKind, label: string, description: string) => ({
        id: `palette-${kind}`,
        label,
        description,
        layout: 'stacked' as const,
        control: {
            type: 'custom' as const,
            render: () => (
                <PaletteEditor
                    kind={kind}
                    palette={palette}
                    onToggle={onTogglePaletteEntry}
                    onAdd={onAddPaletteEntry}
                    onRemove={onRemovePaletteEntry}
                />
            ),
        },
    });

    const categories: iTeaSettingsCategory[] = [
        {
            id: 'appearance',
            label: 'Appearance',
            icon: '◐',
            description: 'How the app looks.',
            groups: [
                {
                    id: 'theme',
                    items: [
                        {
                            id: 'light-mode',
                            label: 'Light mode',
                            description: 'Dark text on a light background.',
                            control: { type: 'toggle', value: lightMode, onChange: onToggleLightMode },
                        },
                        {
                            id: 'editor-width',
                            label: 'Editor width',
                            description: 'How wide a note is, as a share of the window.',
                            control: {
                                type: 'slider',
                                value: editorWidth,
                                min: 50,
                                max: 100,
                                step: 5,
                                unit: '%',
                                onChange: onEditorWidthChange,
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: 'editor',
            label: 'Editor',
            icon: '✎',
            description: 'How notes behave while you work on them.',
            groups: [
                {
                    id: 'confirmations',
                    items: [
                        {
                            id: 'confirm-deletions',
                            label: 'Confirm deletions',
                            description: 'Ask before a note, folder, block or preset with content is deleted.',
                            control: { type: 'toggle', value: confirmDeletions, onChange: onConfirmDeletionsChange },
                        },
                    ],
                },
            ],
        },
        {
            id: 'colors',
            label: 'Colors',
            icon: '◉',
            description:
                'Choose which colors and gradients are offered, 8 of each at most, and make your own. Text that already uses a color keeps it when the color is switched off or deleted.',
            groups: [
                {
                    id: 'text-colors',
                    title: 'Toolbar',
                    items: [
                        paletteItem(
                            'text',
                            'Text and highlight colors',
                            'Shown in the second bar while Text color or Highlight is chosen.',
                        ),
                    ],
                },
                {
                    id: 'block-style',
                    title: 'Block style',
                    items: [
                        paletteItem('block', 'Block colors', 'The Background row of the style menu of a block.'),
                        paletteItem('gradient', 'Block gradients', 'The Gradient row of the style menu of a block.'),
                    ],
                },
            ],
        },
        {
            id: 'data',
            label: 'Data',
            icon: '⇅',
            description: 'Take your notes out of the app or bring them in as files.',
            groups: [
                {
                    id: 'export',
                    title: 'Export',
                    items: [
                        {
                            id: 'export-notes',
                            label: 'Notes',
                            description: 'All notes and folders, as plain text or as JSON that can be imported again.',
                            control: {
                                type: 'buttons',
                                buttons: [
                                    {
                                        id: 'text',
                                        label: 'Text',
                                        onClick: () =>
                                            exportAs(
                                                onExportText(),
                                                'lockkliye-notes.txt',
                                                'text/plain',
                                                'Notes exported as text',
                                            ),
                                    },
                                    {
                                        id: 'json',
                                        label: 'JSON',
                                        onClick: () =>
                                            exportAs(
                                                onExportJson(),
                                                'lockkliye-notes.json',
                                                'application/json',
                                                'Notes exported as JSON',
                                            ),
                                    },
                                ],
                            },
                        },
                        {
                            id: 'export-settings',
                            label: 'Settings and presets',
                            control: {
                                type: 'button',
                                label: 'Export',
                                onClick: () =>
                                    exportAs(
                                        onExportSettings(),
                                        'lockkliye-settings.json',
                                        'application/json',
                                        'Settings & presets exported',
                                    ),
                            },
                        },
                        {
                            id: 'export-history',
                            label: 'History',
                            control: {
                                type: 'button',
                                label: 'Export',
                                onClick: () =>
                                    exportAs(
                                        onExportHistory(),
                                        'lockkliye-history.json',
                                        'application/json',
                                        'History exported',
                                    ),
                            },
                        },
                    ],
                },
                {
                    id: 'import',
                    title: 'Import',
                    items: [
                        {
                            id: 'import-notes',
                            label: 'Notes',
                            description: 'A notes file from an export. Notes that are already here are skipped.',
                            control: {
                                type: 'button',
                                label: 'Import',
                                onClick: () =>
                                    startImport({
                                        run: onImportNotes,
                                        success: 'Notes imported successfully!',
                                        failure: 'Failed to import notes. Invalid file format.',
                                    }),
                            },
                        },
                        {
                            id: 'import-settings',
                            label: 'Settings and presets',
                            control: {
                                type: 'button',
                                label: 'Import',
                                onClick: () =>
                                    startImport({
                                        run: onImportSettings,
                                        success: 'Settings & presets imported!',
                                        failure: 'Failed to import settings. Invalid file format.',
                                    }),
                            },
                        },
                        {
                            id: 'import-history',
                            label: 'History',
                            control: {
                                type: 'button',
                                label: 'Import',
                                onClick: () =>
                                    startImport({
                                        run: onImportHistory,
                                        success: 'History imported successfully!',
                                        failure: 'Failed to import history. Invalid file format.',
                                    }),
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: 'developer',
            label: 'Developer',
            icon: '⌘',
            developer: true,
            description: 'Tools for testing the app. They can change or remove your data.',
            groups: [
                {
                    id: 'generators',
                    title: 'Generators',
                    items: [
                        {
                            id: 'generate-text',
                            label: 'Copy random text',
                            description: 'Puts generated text in the clipboard.',
                            control: {
                                type: 'buttons',
                                buttons: [
                                    {
                                        id: 'short',
                                        label: 'Short',
                                        onClick: () => copyGenerated(generateShortText(), 'Short text'),
                                    },
                                    {
                                        id: 'long',
                                        label: 'Long',
                                        onClick: () => copyGenerated(generateLongText(), 'Long text'),
                                    },
                                    {
                                        id: 'title',
                                        label: 'Title',
                                        onClick: () => copyGenerated(generateTitle(), 'Title'),
                                    },
                                ],
                            },
                        },
                        {
                            id: 'random-note',
                            label: 'Random note',
                            description: 'Adds a note with generated content.',
                            control: { type: 'button', label: 'Create', onClick: onCreateRandomNote },
                        },
                    ],
                },
                {
                    id: 'danger',
                    title: 'Danger zone',
                    items: [
                        {
                            id: 'clear-data',
                            label: 'Clear all data',
                            description: 'Removes every note, folder and the history from this browser.',
                            control: {
                                type: 'button',
                                label: 'Clear all data',
                                theme: 'danger',
                                onClick: () => setShowClearDataModal(true),
                            },
                        },
                    ],
                },
            ],
        },
    ];

    return (
        <>
            <TeaSettingsPage categories={categories} onClose={onClose} />

            <input
                ref={fileInput}
                type='file'
                accept='.json'
                style={{ display: 'none' }}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    const job = importJob.current;
                    if (file && job) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            if (job.run(reader.result as string)) toast.success(job.success);
                            else toast.error(job.failure);
                        };
                        reader.readAsText(file);
                    }
                    event.target.value = '';
                }}
            />

            <TeaModal
                isOpen={showClearDataModal}
                title='Clear All Data'
                onClose={() => setShowClearDataModal(false)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setShowClearDataModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                onClearAllData();
                                setShowClearDataModal(false);
                            }}
                        >
                            Clear All
                        </button>
                    </>
                }
            >
                <p>Are you sure you want to clear all data? This cannot be undone.</p>
            </TeaModal>
        </>
    );
};

export default SettingsView;
