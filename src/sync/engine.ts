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

// TeaType API
import type { HSDBEntity } from '@teatype/api';

// Sync
import type { iCollection, tServerRow } from '@/sync/collections';
import hash from '@/sync/hash';

// What the server had when an entity was last synced: the local content hash and the server's rev
type tSynced = Record<string, { hash: string; rev: number }>;
// Hashes of the first-run placeholder entities (welcome note, default settings), see syncCollection()
type tSeed = Record<string, string>;
type tRemote = HSDBEntity & { client_id: string; rev: number };

interface iCollectionResult<L> {
    items: L[];
    synced: tSynced;
    pushed: number;
    pulled: number;
    removed: number;
    overwritten: number;
    failed: number;
}

type tStep<L> = { key: string; item?: L; step: 'keep' | 'pull' | 'push' };

const PULL_ONE_BY_ONE_LIMIT = 5;
const REQUESTS_AT_ONCE = 8;

// Items are replaced, never mutated, so the hash only has to be computed once per object
const hashCache = new WeakMap<object, string>();

const hashOf = <L extends object>(collection: iCollection<L>, item: L): string => {
    let value = hashCache.get(item);
    if (value === undefined) {
        value = hash(JSON.stringify(collection.toRow(item)));
        hashCache.set(item, value);
    }
    return value;
};

const inChunks = async <T, R>(list: T[], work: (entry: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = [];
    for (let i = 0; i < list.length; i += REQUESTS_AT_ONCE) {
        results.push(...(await Promise.all(list.slice(i, i + REQUESTS_AT_ONCE).map(work))));
    }
    return results;
};

// Local-only view of what a save would send: changed or never synced entities, and keys deleted since the last sync
const findDirty = <L extends object>(
    collection: iCollection<L>,
    items: L[],
    synced: tSynced,
    seed: tSeed,
): { dirty: Set<string>; deleted: string[] } => {
    const dirty = new Set<string>();
    const present = new Set<string>();
    for (const item of items) {
        const key = collection.key(item);
        const current = hashOf(collection, item);
        present.add(key);
        if (synced[key]?.hash !== current && seed[key] !== current) {
            dirty.add(key);
        }
    }
    return { dirty, deleted: Object.keys(synced).filter((key) => !present.has(key)) };
};

/**
 * Compares the local items with the server rows of one model. Throws if the server cannot be reached.
 *
 * - local entity unchanged since the last sync: the server wins (changed or deleted elsewhere)
 * - local entity changed or never synced: pushed if `push`, otherwise kept as it is
 * - server row without local entity: new from elsewhere if never synced here, otherwise it was deleted locally
 * - an unchanged first-run placeholder is dropped as soon as the server has data of its own
 *
 * Saving is last-write-wins: a changed local entity overwrites a row changed elsewhere (counted in `overwritten`).
 */
const syncCollection = async <L extends object>(
    collection: iCollection<L>,
    items: L[],
    synced: tSynced,
    seed: tSeed,
    push: boolean,
): Promise<iCollectionResult<L>> => {
    // Only keys and revs are listed, full rows are fetched for the entities that need pulling
    const listing = await collection.api.fetchAll<tRemote>({ fields: ['client_id', 'rev'] });
    const remote = new Map(listing.data.map((row) => [row.client_id, row]));

    const nextSynced: tSynced = { ...synced };
    const plan: tStep<L>[] = [];
    const toDelete: tRemote[] = [];
    const localKeys = new Set<string>();
    let overwritten = 0;

    for (const item of items) {
        const key = collection.key(item);
        const current = hashOf(collection, item);
        const known = synced[key];
        const row = remote.get(key);
        localKeys.add(key);

        if (known && known.hash === current) {
            if (!row) {
                delete nextSynced[key];
            } else {
                plan.push({ key, item, step: row.rev === known.rev ? 'keep' : 'pull' });
            }
        } else if (seed[key] === current && remote.size > 0) {
            continue;
        } else if (push) {
            if (known && row && row.rev !== known.rev) {
                overwritten++;
            }
            plan.push({ key, item, step: 'push' });
        } else {
            plan.push({ key, item, step: 'keep' });
        }
    }

    for (const [key, row] of remote) {
        if (localKeys.has(key)) {
            continue;
        }
        if (!synced[key]) {
            plan.push({ key, step: 'pull' });
        } else if (push) {
            toDelete.push(row);
        }
    }

    const pullKeys = plan.filter((entry) => entry.step === 'pull').map((entry) => entry.key);
    const pulledRows = new Map<string, tServerRow>();
    if (pullKeys.length > 0) {
        const fetched =
            pullKeys.length > PULL_ONE_BY_ONE_LIMIT
                ? (await collection.api.fetchAll<tServerRow>()).data
                : (
                    await Promise.all(
                        pullKeys.map((key) =>
                            collection.api.fetchAll<tServerRow>({
                                conditions: [{ field: 'client_id', operator: 'eq', value: key }],
                            }),
                        ),
                    )
                ).flatMap((response) => response.data);
        for (const row of fetched) {
            pulledRows.set(row.client_id, row);
        }
    }

    let pushed = 0;
    let pulled = 0;
    let removed = 0;
    let failed = 0;

    const resolved = await inChunks(plan, async ({ key, item, step }): Promise<L | undefined> => {
        if (step === 'keep') {
            return item;
        }

        if (step === 'pull') {
            const row = pulledRows.get(key);
            if (!row) {
                delete nextSynced[key]; // Deleted on the server between listing and fetching
                return undefined;
            }
            const pulledItem = collection.fromRow(row);
            nextSynced[key] = { hash: hashOf(collection, pulledItem), rev: row.rev };
            pulled++;
            return pulledItem;
        }

        const localItem = item as L;
        const rev = Date.now();
        const payload = { ...collection.toRow(localItem), rev };
        const row = remote.get(key);
        try {
            if (row) {
                await collection.api.update(row.id, payload, { partial: true });
            } else {
                await collection.api.create(payload);
            }
            nextSynced[key] = { hash: hashOf(collection, localItem), rev };
            pushed++;
        } catch {
            failed++; // Stays dirty, the next save tries again
        }
        return localItem;
    });

    await inChunks(toDelete, async (row) => {
        try {
            await collection.api.delete(row.id);
            delete nextSynced[row.client_id];
            removed++;
        } catch {
            failed++;
        }
    });

    for (const key of Object.keys(nextSynced)) {
        if (!localKeys.has(key) && !remote.has(key)) {
            delete nextSynced[key];
        }
    }

    return {
        items: resolved.filter((item): item is L => item !== undefined),
        synced: nextSynced,
        pushed,
        pulled,
        removed,
        overwritten,
        failed,
    };
};

export type { iCollectionResult, tSeed, tSynced };
export { findDirty, hashOf, syncCollection };
