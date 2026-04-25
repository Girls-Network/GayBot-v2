/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// JSON-on-disk persistence layer. Plain files in data/{users,guilds,pk-systems}/
// because we don't have enough volume to justify a real database, and the
// flat structure makes it easy to inspect or hand-edit when something's off.
//
// Each user/guild/system gets one file keyed by their ID. Inside that file
// we store separate "slots" (identity, reactions, disabled_commands, etc.)
// so unrelated features can coexist in one document without stepping on
// each other. The schemas below are the source of truth for those slots.
//
// Concurrency note: we're single-process per shard and discord.js
// serialises message handling per-shard, so the lack of file locking
// is fine for now. If we ever go multi-process per host, revisit.

import * as fs from 'fs';
import * as path from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────

// Everything lives under ./data relative to wherever the bot was launched.
// process.cwd() is intentional (vs __dirname) — it means dev runs and
// prod runs share the same on-disk layout regardless of dist/ vs src/.
const DATA_DIR      = path.join(process.cwd(), 'data');
const USERS_DIR     = path.join(DATA_DIR, 'users');
const GUILDS_DIR    = path.join(DATA_DIR, 'guilds');
// PK systems get their own directory so we don't have to worry about
// hid collisions with Discord IDs (different namespaces, different
// formats — Discord IDs are numeric snowflakes, PK hids are 5-char
// lowercase strings).
const PK_SYSTEMS_DIR = path.join(DATA_DIR, 'pk-systems');

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

/** Preferences attached to a PluralKit system hid (applies to every account in it). */
export interface PkSystemFile {
    reactions?: ReactionData;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Lazy directory creation — called from every read/write so a fresh
// checkout (or a wiped data/ folder) just works on the next operation
// without needing a separate setup step.
function ensureDirs(): void {
    for (const dir of [DATA_DIR, USERS_DIR, GUILDS_DIR, PK_SYSTEMS_DIR]) {
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

function pkSystemPath(systemId: string): string {
    // PK hids are 5-char lowercase alphabetic, so no sanitisation is strictly
    // needed, but we scrub just in case PK ever changes the format. Also
    // protects us from path traversal in the (very unlikely) event the
    // upstream API hands us back something weird.
    const safe = systemId.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(PK_SYSTEMS_DIR, `${safe}.json`);
}

// ─── User file I/O ────────────────────────────────────────────────────────────

// Read a user's JSON. Missing file = empty record (not null/undefined),
// because every caller wants to read-modify-write and an empty object
// is the cleanest seed for that. Malformed JSON also collapses to {}
// rather than throwing, for the same reason — we'd rather lose one
// dodgy file than crash the bot mid-message.
export function readUserFile(userId: string): UserFile {
    ensureDirs();
    const p = userPath(userId);
    if (!fs.existsSync(p)) return {};
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as UserFile;
    } catch {
        // If you ever start seeing weird missing-data reports, check
        // the on-disk file for actual corruption. We swallow the parse
        // error here on purpose; it shouldn't fire in normal use.
        return {};
    }
}

// Whole-file replace. `null, 2` indentation is so the files are still
// pleasant to eyeball if we ever need to debug something by hand.
export function writeUserFile(userId: string, data: UserFile): void {
    ensureDirs();
    fs.writeFileSync(userPath(userId), JSON.stringify(data, null, 2), 'utf-8');
}

// Hard delete — used by clearIdentity when the user wipes everything
// AND has no other slots set. Returns false (not throws) when the
// file doesn't exist so callers can distinguish "deleted" from
// "nothing to delete" without try/catch.
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

// ─── PK system file I/O ───────────────────────────────────────────────────────

export function readPkSystemFile(systemId: string): PkSystemFile {
    ensureDirs();
    const p = pkSystemPath(systemId);
    if (!fs.existsSync(p)) return {};
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as PkSystemFile;
    } catch {
        return {};
    }
}

export function writePkSystemFile(systemId: string, data: PkSystemFile): void {
    ensureDirs();
    fs.writeFileSync(pkSystemPath(systemId), JSON.stringify(data, null, 2), 'utf-8');
}

export function deletePkSystemFile(systemId: string): boolean {
    const p = pkSystemPath(systemId);
    if (!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
}