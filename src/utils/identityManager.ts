/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export interface IdentityData {
    user_id: string;
    pronouns?: string;
    gender?: string;
    sexuality?: string;
    romantic?: string;
    flag?: string;
    bio?: string;
    updated_at: string;
}

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function getFilePath(userId: string): string {
    return path.join(DATA_DIR, `${userId}.json`);
}

export function getIdentity(userId: string): IdentityData | null {
    ensureDataDir();
    const filePath = getFilePath(userId);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as IdentityData;
    } catch {
        return null;
    }
}

export function setIdentity(
    userId: string,
    fields: Partial<Omit<IdentityData, 'user_id' | 'updated_at'>>
): IdentityData {
    ensureDataDir();

    // Merge with existing so partial updates don't wipe other fields
    const existing = getIdentity(userId) ?? { user_id: userId, updated_at: '' };
    const updated: IdentityData = {
        ...existing,
        ...fields,
        user_id: userId,
        updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(getFilePath(userId), JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
}

export function clearIdentity(userId: string): boolean {
    ensureDataDir();
    const filePath = getFilePath(userId);

    if (!fs.existsSync(filePath)) {
        return false;
    }

    fs.unlinkSync(filePath);
    return true;
}