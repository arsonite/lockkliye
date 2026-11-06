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

// Utility
import hash from '@/sync/hash';

// Types
import type { iCollection, tServerRow } from '@/sync/collections';

// What the server had when an entity was last synced: the local content hash, the server's rev and the server's
// entry id. The key of the entity is the key of this record.
type tSynced = Record<string, { hash: string; id: string; rev: number }>;

// Hashes of the first-run placeholder entities (welcome note, default settings), see syncCollection()
type tSeed = Record<string, string>;

interface iCollectionResult<L> {
    items: L[];
    synced: tSynced;
    pushedKeys: string[]; // What was written to the server and what was deleted there, to keep that even if a later step fails
    removedKeys: string[];
    pushed: number;
    pulled: number;
    removed: number;
    overwritten: number;
    failed: number;
}

type tStep<L> = { key: string; item?: L; step: 'keep' | 'pull' | 'push' };

type tPayload = Record<string, string | number | boolean | null>;

type tPush<L> = { kind: 'push'; key: string; item: L; row?: tServerRow; payload: tPayload; rev: number };
type tDelete = { kind: 'delete'; key: string; row: tServerRow };
type tOp<L> = tPush<L> | tDelete;

const PULL_ONE_BY_ONE_LIMIT = 5;
const REQUESTS_AT_ONCE = 16;
const BULK_SIZE = 200;
const BULK_REQUESTS_AT_ONCE = 4;

// Set once a server answered that it has no bulk route (older backend), from then on everything is sent one by one
let bulkMissing = false;

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

// A sliding window: a slow request holds up only its own slot, not a whole batch
const inParallel = async <T, R>(list: T[], work: (entry: T) => Promise<R>, size = REQUESTS_AT_ONCE): Promise<R[]> => {
    const results = new Array<R>(list.length);
    let next = 0;
    const worker = async () => {
        while (next < list.length) {
            const index = next++;
            results[index] = await work(list[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(size, list.length) }, worker));
    return results;
};

const isNotFound = (error: unknown): boolean => (error as { status?: number }).status === 404;

const isMissingRoute = (error: unknown): boolean => [404, 405].includes((error as { status?: number }).status ?? 0);

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
 * `parents` holds the synced records of the collections saved before this one, to swap the keys in relation
 * fields for server ids and back.
 *
 * - local entity unchanged since the last sync: the server wins (changed or deleted elsewhere)
 * - local entity changed or never synced: pushed if `push`, otherwise kept as it is
 * - server row without local entity: new from elsewhere if never synced here, otherwise it was deleted locally
 * - an unchanged first-run placeholder is dropped as soon as the server has data of its own
 *
 * Saving is last-write-wins: a changed local entity overwrites a row changed elsewhere (counted in `overwritten`).
 * The server creates the entry ids, the synced record is what ties a local key to its id.
 */
const syncCollection = async <L extends object>(
    collection: iCollection<L>,
    items: L[],
    synced: tSynced,
    seed: tSeed,
    push: boolean,
    parents: Record<string, tSynced>,
): Promise<iCollectionResult<L>> => {
    // Only ids and revs are listed, full rows are fetched for the entities that need pulling
    const listing = await collection.api.fetchAll<tServerRow>({ fields: ['rev', ...(collection.listFields ?? [])] });
    const keyOfId = new Map(Object.entries(synced).map(([key, known]) => [known.id, key]));

    // Server rows by the key of the local entity they belong to, rows known from an earlier sync come first
    const remote = new Map<string, tServerRow>();
    const knownFirst = [...listing.data].sort((a, b) => Number(keyOfId.has(b.id)) - Number(keyOfId.has(a.id)));
    for (const row of knownFirst) {
        const key = keyOfId.get(row.id) ?? collection.slot?.(row) ?? row.id;
        if (!remote.has(key)) {
            remote.set(key, row);
        }
    }

    const relations = Object.entries(collection.relations ?? {});
    const parentKeys = new Map<string, Map<string, string>>();
    const toServerId = (parent: string, key: string): string => {
        // An entity of the own collection (folder in folder) is known as soon as it was saved in this run
        const id = (parent === collection.name ? nextSynced : parents[parent])?.[key]?.id;
        if (!id) {
            throw new Error(`${parent} "${key}" is not on the server`);
        }
        return id;
    };
    const toLocalKey = (parent: string, id: string): string => {
        if (!parentKeys.has(parent)) {
            parentKeys.set(
                parent,
                new Map(
                    Object.entries((parent === collection.name ? synced : parents[parent]) ?? {}).map(([key, known]) => [
                        known.id,
                        key,
                    ]),
                ),
            );
        }
        return parentKeys.get(parent)?.get(id) ?? id;
    };

    const nextSynced: tSynced = { ...synced };
    const plan: tStep<L>[] = [];
    const toDelete: [string, tServerRow][] = [];
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
            localKeys.delete(key); // The server row for the same thing (settings, presets) is then pulled as new
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
            toDelete.push([key, row]);
        }
    }

    // A child needs the server id of its parent: entities pointing to their own collection are saved parents first, one by one
    const selfFields = relations.filter(([, parent]) => parent === collection.name).map(([field]) => field);
    const relationFields = new Set(relations.map(([field]) => field));
    if (selfFields.length > 0) {
        const parentOf = new Map(plan.map(({ key, item }) => [key, item ? String(collection.toRow(item)[selfFields[0]] ?? '') : '']));
        const depthOf = (key: string): number => {
            let depth = 0;
            for (let up = parentOf.get(key); up && depth < 100; up = parentOf.get(up)) {
                depth++;
            }
            return depth;
        };
        plan.sort((a, b) => depthOf(a.key) - depthOf(b.key));
    }

    const pullIds = plan.filter((entry) => entry.step === 'pull').map((entry) => (remote.get(entry.key) as tServerRow).id);
    const pulledRows = new Map<string, tServerRow>();
    if (pullIds.length > 0) {
        const options = { includeRelations: true };
        const fetched =
            pullIds.length > PULL_ONE_BY_ONE_LIMIT
                ? (await collection.api.fetchAll<tServerRow>(options)).data
                : (
                    await inParallel(pullIds, async (id) => {
                        try {
                            return (await collection.api.fetchOne<tServerRow>(id, options)).data;
                        } catch (error) {
                            if (isNotFound(error)) {
                                return undefined; // Deleted on the server between listing and fetching
                            }
                            throw error;
                        }
                    })
                ).filter((row): row is tServerRow => row !== undefined);
        for (const row of fetched) {
            pulledRows.set(row.id, row);
        }
    }

    const ops: tOp<L>[] = [];
    const pushedKeys: string[] = [];
    const removedKeys: string[] = [];
    let pushed = 0;
    let pulled = 0;
    let removed = 0;
    let failed = 0;

    const work = async ({ key, item, step }: tStep<L>): Promise<L | undefined> => {
        if (step === 'keep') {
            return item;
        }

        if (step === 'pull') {
            const row = pulledRows.get((remote.get(key) as tServerRow).id);
            if (!row) {
                delete nextSynced[key];
                return undefined;
            }
            const local = { ...row };
            for (const [field, parent] of relations) {
                if (typeof local[field] === 'string') {
                    local[field] = toLocalKey(parent, local[field] as string);
                }
            }
            const pulledItem = collection.fromRow(local, key);
            const itemKey = collection.key(pulledItem);
            if (itemKey !== key) {
                delete nextSynced[key]; // Entities whose key is made of their content
            }
            nextSynced[itemKey] = { hash: hashOf(collection, pulledItem), id: row.id, rev: row.rev };
            localKeys.add(itemKey);
            pulled++;
            return pulledItem;
        }

        const localItem = item as L;
        const rev = Date.now();
        try {
            const payload: tPayload = { ...collection.toRow(localItem), rev };
            const row = remote.get(key);
            for (const [field, parent] of relations) {
                if (field in payload) {
                    payload[field] = toServerId(parent, String(payload[field]));
                } else if (row) {
                    payload[field] = null; // A relation that is left out is unset on the server
                }
            }
            const op: tPush<L> = { kind: 'push', key, item: localItem, row, payload, rev };
            if (selfFields.length > 0) {
                await sendOne(op); // Parents first, so no batching
            } else {
                ops.push(op);
            }
        } catch {
            failed++; // Stays dirty, the next save tries again
        }
        return localItem;
    };

    const settlePush = ({ key, item, payload, rev }: tPush<L>, stored: tServerRow): void => {
        // A server that runs older models drops the columns it does not know and still answers with success
        const dropped = Object.keys(payload).filter(
            (field) => payload[field] !== null && !relationFields.has(field) && !(field in stored),
        );
        nextSynced[key] = { hash: dropped.length > 0 ? '' : hashOf(collection, item), id: stored.id, rev };
        if (dropped.length > 0) {
            failed++;
            return;
        }
        pushedKeys.push(key);
        pushed++;
    };

    const settleDelete = (key: string): void => {
        delete nextSynced[key];
        removedKeys.push(key);
        removed++;
    };

    const sendOne = async (op: tOp<L>): Promise<void> => {
        try {
            if (op.kind === 'delete') {
                await collection.api.delete(op.row.id);
                settleDelete(op.key);
            } else {
                const stored = (
                    op.row
                        ? await collection.api.update<tServerRow>(op.row.id, op.payload, { partial: true })
                        : await collection.api.create<tServerRow>(op.payload)
                ).data;
                settlePush(op, stored);
            }
        } catch {
            failed++;
        }
    };

    // Creates, updates and deletes of one chunk travel in one request, every item reports its own outcome
    const sendChunk = async (chunk: tOp<L>[]): Promise<void> => {
        if (!bulkMissing) {
            const creates = chunk.filter((op): op is tPush<L> => op.kind === 'push' && !op.row);
            const updates = chunk.filter((op): op is tPush<L> => op.kind === 'push' && !!op.row);
            const deletes = chunk.filter((op): op is tDelete => op.kind === 'delete');
            try {
                const { data } = await collection.api.bulk<tServerRow>({
                    create: creates.map((op) => op.payload),
                    update: updates.map((op) => ({ id: (op.row as tServerRow).id, data: op.payload })),
                    delete: deletes.map((op) => op.row.id),
                });
                const settle = <T extends tOp<L>>(list: T[], results: Array<{ ok: boolean; status?: number; data?: unknown }>, onOk: (op: T, data: unknown) => void) =>
                    list.forEach((op, index) => {
                        const result = results[index];
                        if (result?.ok) {
                            onOk(op, result.data);
                        } else if (op.kind === 'delete' && result?.status === 404) {
                            settleDelete(op.key); // Already gone
                        } else {
                            failed++;
                        }
                    });
                const pushOk = (op: tPush<L>, row: unknown) => settlePush(op, row as tServerRow);
                settle(creates, data.create, pushOk);
                settle(updates, data.update, pushOk);
                settle(deletes, data.delete, (op) => settleDelete(op.key));
                return;
            } catch (error) {
                if (!isMissingRoute(error)) {
                    failed += chunk.length; // Stays dirty, the next save tries again
                    return;
                }
                bulkMissing = true;
            }
        }
        await inParallel(chunk, sendOne);
    };

    const resolved = selfFields.length > 0 ? await inParallel(plan, work, 1) : await inParallel(plan, work);

    if (push) {
        ops.push(...toDelete.map(([key, row]): tDelete => ({ kind: 'delete', key, row })));
    }
    const chunks = Array.from({ length: Math.ceil(ops.length / BULK_SIZE) }, (_, index) => ops.slice(index * BULK_SIZE, (index + 1) * BULK_SIZE));
    await inParallel(chunks, sendChunk, BULK_REQUESTS_AT_ONCE);

    for (const key of Object.keys(nextSynced)) {
        if (!localKeys.has(key) && !remote.has(key)) {
            delete nextSynced[key];
        }
    }

    return {
        items: resolved.filter((item): item is L => item !== undefined),
        synced: nextSynced,
        pushedKeys,
        removedKeys,
        pushed,
        pulled,
        removed,
        overwritten,
        failed,
    };
};

export type { iCollectionResult, tSeed, tSynced };

export { findDirty, hashOf, syncCollection };