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

// The folders a folder sits in, outermost first and ending with the folder itself
const folderChain = (folders: iFolder[], folderId: string | null | undefined): iFolder[] => {
    const chain: iFolder[] = [];
    const seen = new Set<string>();
    for (let id = folderId; id && !seen.has(id); ) {
        seen.add(id);
        const folder = folders.find((entry) => entry.id === id);
        if (!folder) {
            break;
        }
        chain.unshift(folder);
        id = folder.parentId;
    }
    return chain;
};

// "Work / Projects / 2026", for lists where the nesting has to be readable without indentation
const folderPath = (folders: iFolder[], folderId: string): string =>
    folderChain(folders, folderId)
        .map((folder) => folder.name)
        .join(' / ');

// Folders without an existing parent move to the top level, and so do folders that are their own ancestors
const repairFolders = (folders: iFolder[]): iFolder[] => {
    const ids = new Set(folders.map((folder) => folder.id));
    return folders.map((folder) =>
        folder.parentId && (!ids.has(folder.parentId) || descendantIds(folders, folder.id).has(folder.parentId))
            ? { ...folder, parentId: null }
            : folder,
    );
};

export { descendantIds, folderChain, folderPath, repairFolders };
