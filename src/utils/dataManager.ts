/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR   = path.join(process.cwd(), 'data');
const USERS_DIR  = path.join(DATA_DIR, 'users');
const GUILDS_DIR = path.join(DATA_DIR, 'guilds');

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface IdentityData {
    pronouns?:   string;
    gender?:     string;
    sexuality?:  string;
    romantic?:   string;
    flag?:       string;
    bio?:        string;
    updated_at:  string;
}

export interface ReactionData {
    /** Emoji titles (matching emoji-config.json "title" field) that are blocked. */
    disabled_emojis: string[];
}

export interface UserFile {
    identity?:          IdentityData;
    reactions?:         ReactionData;
    /** Subcommand keys (e.g. "yuri kiss") the user has opted out of being targeted by. */
    disabled_commands?: string[];
}

export interface GuildFile {
    reactions?:         ReactionData;
    /** Subcommand keys (e.g. "yuri kiss") disabled server-wide by an admin. */
    disabled_commands?: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function ensureDirs(): void {
    for (const dir of [DATA_DIR, USERS_DIR, GUILDS_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

function userPath(userId: string): string {
    return path.join(USERS_DIR, `${userId}.json`);
}

function guildPath(guildId: string): string {
    return path.join(GUILDS_DIR, `${guildId}.json`);
}

// ─── User file I/O ────────────────────────────────────────────────────────────

export function readUserFile(userId: string): UserFile {
    ensureDirs();
    const p = userPath(userId);
    if (!fs.existsSync(p)) return {};
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as UserFile;
    } catch {
        return {};
    }
}

export function writeUserFile(userId: string, data: UserFile): void {
    ensureDirs();
    fs.writeFileSync(userPath(userId), JSON.stringify(data, null, 2), 'utf-8');
}

export function deleteUserFile(userId: string): boolean {
    const p = userPath(userId);
    if (!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
}

// ─── Guild file I/O ───────────────────────────────────────────────────────────

export function readGuildFile(guildId: string): GuildFile {
    ensureDirs();
    const p = guildPath(guildId);
    if (!fs.existsSync(p)) return {};
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as GuildFile;
    } catch {
        return {};
    }
}

export function writeGuildFile(guildId: string, data: GuildFile): void {
    ensureDirs();
    fs.writeFileSync(guildPath(guildId), JSON.stringify(data, null, 2), 'utf-8');
}

export function deleteGuildFile(guildId: string): boolean {
    const p = guildPath(guildId);
    if (!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
}