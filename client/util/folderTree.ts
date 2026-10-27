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

// Types
import type { iFolder } from '@/types';

// All folders below a folder, at any depth
const descendantIds = (folders: iFolder[], folderId: string): Set<string> => {
    const found = new Set<string>();
    const pending = [folderId];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const folder of folders) {
            if (folder.parentId === current && !found.has(folder.id)) {
                found.add(folder.id);
                pending.push(folder.id);
            }
        }
    }
    return found;
};

// "Work / Projects / 2026", for lists where the nesting has to be readable without indentation
const folderPath = (folders: iFolder[], folderId: string): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let id: string | null | undefined = folderId; id && !seen.has(id);) {
        seen.add(id);
        const folder = folders.find((entry) => entry.id === id);
        if (!folder) {
            break;
        }
        names.unshift(folder.name);
        id = folder.parentId;
    }
    return names.join(' / ');
};

// Folders without an existing parent move to the top level, and so do folders that are their own ancestors
const repairFolders = (folders: iFolder[]): iFolder[] => {
    const ids = new Set(folders.map((folder) => folder.id));
    return folders.map((folder) =>
        folder.parentId && (!ids.has(folder.parentId) || descendantIds(folders, folder.id).has(folder.parentId))
            ? { ...folder, parentId: null }
            : folder,
    );
};

export { descendantIds, folderPath, repairFolders };
