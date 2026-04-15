/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { readUserFile, writeUserFile, deleteUserFile, IdentityData } from './dataManager';

// Re-export IdentityData so existing imports from identityManager still work
export type { IdentityData };

export function getIdentity(userId: string): IdentityData | null {
    return readUserFile(userId).identity ?? null;
}

export function setIdentity(
    userId: string,
    fields: Partial<Omit<IdentityData, 'updated_at'>>
): IdentityData {
    const file = readUserFile(userId);
    const existing = file.identity ?? { updated_at: '' };

    const updated: IdentityData = {
        ...existing,
        ...fields,
        updated_at: new Date().toISOString(),
    };

    writeUserFile(userId, { ...file, identity: updated });
    return updated;
}

export function clearIdentity(userId: string): boolean {
    const file = readUserFile(userId);
    if (!file.identity) return false;

    const { identity: _, ...rest } = file;

    // If nothing else is left in the file, delete it entirely
    if (Object.keys(rest).length === 0) {
        deleteUserFile(userId);
    } else {
        writeUserFile(userId, rest);
    }

    return true;
}