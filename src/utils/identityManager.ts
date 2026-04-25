/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Identity-only convenience layer over dataManager. The actual JSON I/O
// (read/write/delete) lives one level down — this file just understands
// the `identity` slot inside a user file and how to mutate it cleanly
// without trampling other slots like `reactions` or `disabled_commands`.
//
// Used by /identity set / get / me / clear (src/commands/identity.ts).

import { readUserFile, writeUserFile, deleteUserFile, IdentityData } from './dataManager';

// IdentityData itself lives in dataManager (alongside the other slot
// types). Re-exported here so existing imports of `IdentityData` from
// './identityManager' don't break — the type is logically part of this
// module's surface even if the source-of-truth is elsewhere.
export type { IdentityData };

// Returns the user's identity record, or null if they haven't set one
// up yet. Doesn't lazy-create — that's setIdentity's job.
export function getIdentity(userId: string): IdentityData | null {
    return readUserFile(userId).identity ?? null;
}

// Partial-update model: pass any subset of identity fields and they
// get merged on top of whatever's already there. updated_at is always
// stamped server-side so callers can't accidentally lie about when
// the change happened.
export function setIdentity(
    userId: string,
    fields: Partial<Omit<IdentityData, 'updated_at'>>
): IdentityData {
    const file = readUserFile(userId);
    // First-time setters won't have an existing identity. The empty
    // updated_at gets overwritten below, so it's just a placeholder.
    const existing = file.identity ?? { updated_at: '' };

    const updated: IdentityData = {
        ...existing,
        ...fields,
        updated_at: new Date().toISOString(),
    };

    writeUserFile(userId, { ...file, identity: updated });
    return updated;
}

// /identity clear. Returns false if there was nothing to clear — lets
// the command surface a "you don't have a profile" message instead of
// a generic success.
export function clearIdentity(userId: string): boolean {
    const file = readUserFile(userId);
    if (!file.identity) return false;

    // Remove just the identity slot, keep everything else. Underscore
    // on the destructure is the standard "discarded variable" tell.
    const { identity: _, ...rest } = file;

    // If the user file had nothing else in it, delete the file entirely
    // rather than leaving a `{}` JSON sitting on disk for no reason.
    // Keeps `data/users/` tidy when people clear their profile and
    // never come back.
    if (Object.keys(rest).length === 0) {
        deleteUserFile(userId);
    } else {
        writeUserFile(userId, rest);
    }

    return true;
}