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

// TeaType icons
import { CodeIcon, ColorIcon, ContrastIcon, KeyboardIcon, PencilIcon, TransferIcon } from '@teatype/icons';

// TeaType components
import { TeaButton, TeaModal, TeaSettingsPage, type iTeaSettingsCategory, type iUseTeaToastReturn } from '@teatype/components';

// Components
import PaletteEditor from './PaletteEditor';

// Types
import type { iAnchorStyle, iListOptions, iPalette, tNumbering, tPaletteKind } from '@/types';

// Utils
import { DEFAULT_ACCENT } from '@/tools/accent';
import { ANCHOR_LINES, sanitizeAnchorStyle } from '@/tools/anchorStyle';
import { BULLETS, NUMBERINGS, numberingLabel, sanitizeListOptions } from '@/tools/lists';
import { SHORTCUT_GROUPS } from '@/tools/shortcuts';
import { generateShortText, generateLongText, generateTitle, copyToClipboard } from '@/tools/randomGenerator';

interface iSettingsViewProps {
    lightMode: boolean;
    accentColor: string;
    listOptions: iListOptions;
    editorWidth: number;
    confirmDeletions: boolean;
    showBlockBorders: boolean;
    showStyleButton: boolean;
    use24HourTime: boolean;
    palette: iPalette;
    toast: iUseTeaToastReturn;

    onToggleLightMode: () => void;
    onAccentColorChange: (color: string) => void;
    onListOptionsChange: (options: iListOptions) => void;
    anchorStyle: iAnchorStyle;
    onAnchorStyleChange: (style: iAnchorStyle) => void;
    onEditorWidthChange: (width: number) => void;
    onConfirmDeletionsChange: (value: boolean) => void;
    onShowBlockBordersChange: (value: boolean) => void;
    onShowStyleButtonChange: (value: boolean) => void;
    onUse24HourTimeChange: (value: boolean) => void;
    onClearAllHistory: () => void;
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
    onCreateRandomFolder: () => void;
    onRandomizeDates: () => void;
    onExportBackup: () => string;
    onImportBackup: (json: string) => boolean;
    onRestoreTutorial: () => void;
    onClearAllData: () => void;
    onClose: () => void;
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

// The keys of a shortcut, a shortcut with two ways to press it shows both
const ShortcutKeys = ({ alternatives }: { alternatives: string[] }) => (
    <span className='shortcut-keys'>
        {alternatives.map((combo, index) => (
            <span key={combo} className='shortcut-keys__combo'>
                {index > 0 && <span className='shortcut-keys__or'>or</span>}
                {combo.split('+').map((key) => (
                    <kbd key={key}>{key}</kbd>
                ))}
            </span>
        ))}
    </span>
);

// The settings of the app, described for the TeaSettingsPage
export const SettingsView = ({
    lightMode,
    accentColor,
    listOptions,
    editorWidth,
    confirmDeletions,
    showBlockBorders,
    showStyleButton,
    use24HourTime,
    palette,
    toast,

    onToggleLightMode,
    onAccentColorChange,
    onListOptionsChange,
    anchorStyle,
    onAnchorStyleChange,
    onEditorWidthChange,
    onConfirmDeletionsChange,
    onShowBlockBordersChange,
    onShowStyleButtonChange,
    onUse24HourTimeChange,
    onClearAllHistory,
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
    onCreateRandomFolder,
    onRandomizeDates,
    onExportBackup,
    onImportBackup,
    onRestoreTutorial,
    onClearAllData,
    onClose,
}: iSettingsViewProps) => {
    const [showClearDataModal, setShowClearDataModal] = useState(false);
    const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
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
            icon: <ContrastIcon />,
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
                            id: 'accent-color',
                            label: 'Accent color',
                            layout: 'stacked', // The color popup of the browser opens at the field, on the right it leaves the window
                            description: 'Buttons and highlights, orange by default.',
                            control: {
                                type: 'custom',
                                render: () => (
                                    <span className='accent-picker'>
                                        <input
                                            type='color'
                                            value={accentColor}
                                            onChange={(event) => onAccentColorChange(event.target.value)}
                                        />
                                        <TeaButton onClick={() => onAccentColorChange(DEFAULT_ACCENT)}>Reset</TeaButton>
                                    </span>
                                ),
                            },
                        },
                        {
                            id: 'use-24-hour-time',
                            label: '24-hour time',
                            description: 'Shows times as 14:30 instead of 2:30 PM.',
                            control: { type: 'toggle', value: use24HourTime, onChange: onUse24HourTimeChange },
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
            icon: <PencilIcon />,
            description: 'How notes behave while you work on them.',
            groups: [
                {
                    id: 'editing',
                    items: [
                        {
                            id: 'show-block-borders',
                            label: 'Outline blocks on hover',
                            description:
                                'Draws a border around the block under the mouse, to see which text belongs together.',
                            control: { type: 'toggle', value: showBlockBorders, onChange: onShowBlockBordersChange },
                        },
                        {
                            id: 'show-style-button',
                            label: 'Block style button',
                            description:
                                'Shows a button next to a block that opens its style menu. The menu always opens with a right-click, or a long press on a touch screen.',
                            control: { type: 'toggle', value: showStyleButton, onChange: onShowStyleButtonChange },
                        },
                        {
                            id: 'confirm-deletions',
                            label: 'Confirm deletions',
                            description: 'Ask before a note, folder, block or preset with content is deleted.',
                            control: { type: 'toggle', value: confirmDeletions, onChange: onConfirmDeletionsChange },
                        },
                    ],
                },
                {
                    id: 'lists',
                    title: 'Lists',
                    description: 'The default for all blocks. Text that starts a line with "-", "*" or "1." becomes a list, Enter continues it and an empty item ends it.',
                    items: [
                        {
                            id: 'list-bullet',
                            label: 'Bullet',
                            description: 'A block can set its own in its style menu.',
                            control: {
                                type: 'select',
                                value: listOptions.bullet,
                                options: BULLETS.map((bullet) => ({ value: bullet, label: bullet })),
                                onChange: (bullet: string) => onListOptionsChange({ ...listOptions, bullet }),
                            },
                        },
                        {
                            id: 'list-numbering',
                            label: 'Numbering',
                            control: {
                                type: 'select',
                                value: listOptions.numbering,
                                options: (Object.keys(NUMBERINGS) as tNumbering[]).map((id) => ({
                                    value: id,
                                    label: numberingLabel(id),
                                })),
                                onChange: (numbering: string) =>
                                    onListOptionsChange(sanitizeListOptions({ ...listOptions, numbering })),
                            },
                        },
                    ],
                },
                {
                    id: 'anchors',
                    title: 'Anchors',
                    description: 'How a word that is linked to an anchor note looks. Ctrl+click on it opens the note.',
                    items: [
                        {
                            id: 'anchor-line',
                            label: 'Line',
                            control: {
                                type: 'select',
                                value: anchorStyle.line,
                                options: ANCHOR_LINES.map((line) => ({ value: line, label: line === 'dashed' ? 'Dashed' : 'Solid' })),
                                onChange: (line: string) => onAnchorStyleChange(sanitizeAnchorStyle({ ...anchorStyle, line })),
                            },
                        },
                        {
                            id: 'anchor-bold',
                            label: 'Bold',
                            description: 'Anchored words are written in bold.',
                            control: {
                                type: 'toggle',
                                value: anchorStyle.bold,
                                onChange: (bold: boolean) => onAnchorStyleChange({ ...anchorStyle, bold }),
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: 'colors',
            label: 'Colors',
            icon: <ColorIcon />,
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
            id: 'shortcuts',
            label: 'Shortcuts',
            icon: <KeyboardIcon />,
            description:
                'All keyboard shortcuts. Hold Ctrl, then Shift or Alt, to see the keys on the toolbar and the sidebar.',
            groups: SHORTCUT_GROUPS.map((group) => ({
                id: `shortcuts-${group.title}`,
                title: group.title,
                items: group.items.map((entry) => ({
                    id: `shortcut-${entry.label}`,
                    label: entry.label,
                    control: { type: 'custom' as const, render: () => <ShortcutKeys alternatives={entry.keys} /> },
                })),
            })),
        },
        {
            id: 'data',
            label: 'Data',
            icon: <TransferIcon />,
            description: 'Back up everything, or take parts of it out of the app and bring them in as files.',
            groups: [
                {
                    id: 'backup',
                    title: 'Backup',
                    description:
                        'One file with all notes, folders, settings, colors, presets and the history, to keep as a backup or to restore somewhere else.',
                    items: [
                        {
                            id: 'backup-export',
                            label: 'Full backup',
                            control: {
                                type: 'button',
                                label: 'Download',
                                onClick: () =>
                                    exportAs(
                                        onExportBackup(),
                                        `lockkliye-backup-${new Date().toISOString().slice(0, 10)}.json`,
                                        'application/json',
                                        'Backup downloaded',
                                    ),
                            },
                        },
                        {
                            id: 'backup-restore',
                            label: 'Restore backup',
                            description: 'Replaces everything here with the contents of a backup file.',
                            control: {
                                type: 'button',
                                label: 'Restore',
                                theme: 'danger',
                                onClick: () => setShowRestoreModal(true),
                            },
                        },
                    ],
                },
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
                {
                    id: 'history',
                    title: 'History',
                    items: [
                        {
                            id: 'clear-histories',
                            label: 'Clear all histories',
                            description:
                                'Empties the undo history of every note at once. The notes themselves are not changed.',
                            control: {
                                type: 'button',
                                label: 'Clear all',
                                theme: 'danger',
                                onClick: () => setShowClearHistoryModal(true),
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: 'developer',
            label: 'Developer',
            icon: <CodeIcon />,
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
                        {
                            id: 'restore-tutorial',
                            label: 'Tutorial note',
                            description:
                                'Adds the tutorial note again, or resets it to the current version if it is still there.',
                            control: { type: 'button', label: 'Restore', onClick: onRestoreTutorial },
                        },
                        {
                            id: 'random-folder',
                            label: 'Random folder',
                            description: 'Creates a folder with random subfolders, notes and subnotes.',
                            control: { type: 'button', label: 'Create', onClick: onCreateRandomFolder },
                        },
                        {
                            id: 'randomize-dates',
                            label: 'Random dates',
                            description: 'Gives every note a random creation and edit date.',
                            control: { type: 'button', label: 'Randomize', onClick: onRandomizeDates },
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

            <TeaModal
                isOpen={showRestoreModal}
                title='Restore Backup'
                onClose={() => setShowRestoreModal(false)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setShowRestoreModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                setShowRestoreModal(false);
                                startImport({
                                    run: onImportBackup,
                                    success: 'Backup restored',
                                    failure: 'Failed to restore. This is not a Lockkliye backup file.',
                                });
                            }}
                        >
                            Choose File
                        </button>
                    </>
                }
            >
                <p>
                    Restoring replaces all notes, folders, settings, presets and history here with the ones of the
                    backup file. This cannot be undone.
                </p>
            </TeaModal>

            <TeaModal
                isOpen={showClearHistoryModal}
                title='Clear All Histories'
                onClose={() => setShowClearHistoryModal(false)}
                size='sm'
                footer={
                    <>
                        <button
                            className='tea-modal-btn tea-modal-btn--secondary'
                            onClick={() => setShowClearHistoryModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className='tea-modal-btn tea-modal-btn--danger'
                            onClick={() => {
                                onClearAllHistory();
                                setShowClearHistoryModal(false);
                                toast.success('All histories cleared');
                            }}
                        >
                            Clear all
                        </button>
                    </>
                }
            >
                <p>Empty the undo history of all notes? This cannot be undone.</p>
            </TeaModal>
        </>
    );
};

export default SettingsView;
