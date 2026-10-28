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

/**
 * Collects the ids of all folders below a folder, at any depth.
 * The folder itself is only included if the data contains a cycle leading back to it.
 * Uses an iterative traversal with a visited set, so cyclic data cannot cause an endless loop.
 *
 * @param folders - Flat list of all folders
 * @param folderId - Id of the folder whose descendants are wanted
 * @returns Set of descendant folder ids
 */
const descendantIds = (folders: iFolder[], folderId: string): Set<string> => {
    const found = new Set<string>();
    // Stack of folders whose children still have to be visited
    const pending = [folderId];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const folder of folders) {
            // Skip already found folders to guard against cycles
            if (folder.parentId === current && !found.has(folder.id)) {
                found.add(folder.id);
                pending.push(folder.id);
            }
        }
    }
    return found;
};

/**
 * Builds the chain of folders a folder sits in, outermost first and ending with the folder itself.
 * Stops early at a missing parent or when a cycle is detected.
 *
 * @param folders - Flat list of all folders
 * @param folderId - Id of the innermost folder, may be empty
 * @returns Ordered folders from the top level down to the given folder, empty if not found
 */
const folderChain = (folders: iFolder[], folderId: string | null | undefined): iFolder[] => {
    const chain: iFolder[] = [];
    // Ids already visited, protects against parent cycles
    const seen = new Set<string>();
    for (let id = folderId; id && !seen.has(id);) {
        seen.add(id);
        const folder = folders.find((entry) => entry.id === id);
        if (!folder) {
            // Dangling parent reference, the chain ends here
            break;
        }
        // Walking upwards, so prepend to keep the outermost folder first
        chain.unshift(folder);
        id = folder.parentId;
    }
    return chain;
};

/**
 * Formats the location of a folder as a readable path,
 * e.g. "Work / Projects / 2026", for lists where the nesting has to be readable without indentation.
 *
 * @param folders - Flat list of all folders
 * @param folderId - Id of the folder to describe
 * @returns Folder names joined by " / "
 */
const folderPath = (folders: iFolder[], folderId: string): string =>
    folderChain(folders, folderId)
        .map((folder) => folder.name)
        .join(' / ');

/**
 * Repairs broken folder hierarchies.
 * Folders without an existing parent move to the top level, and so do folders that are their own ancestors.
 * Does not mutate the input, only changed folders are copied.
 *
 * @param folders - Flat list of all folders
 * @returns List with the same folders, with invalid parent references reset to null
 */
const repairFolders = (folders: iFolder[]): iFolder[] => {
    const ids = new Set(folders.map((folder) => folder.id));
    return folders.map((folder) =>
        folder.parentId && (!ids.has(folder.parentId) || descendantIds(folders, folder.id).has(folder.parentId))
            ? { ...folder, parentId: null }
            : folder,
    );
};

export { descendantIds, folderChain, folderPath, repairFolders };
