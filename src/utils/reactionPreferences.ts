/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Reaction preference layer — three scopes (user, guild, PK system) all stored
// the same way: a `disabled_emojis` array of *titles* (not raw emoji strings).
// We store titles because emoji-config.json is the source of truth for what
// emoji corresponds to what name — if we ever swap the lesbian flag emoji for
// a better one, the user's "Lesbian Flag" opt-out keeps working.
//
// The actual reaction-fire decision is the isReactionAllowed gate at the bottom.
// Everything above it is plumbing for getting/setting prefs at each scope.

import {
    readUserFile,
    writeUserFile,
    readGuildFile,
    writeGuildFile,
    readPkSystemFile,
    writePkSystemFile,
    ReactionData,
} from "./dataManager";
import emojiConfigData from "../configs/emoji-config.json";

// Re-exported so callers don't have to know that the type lives in dataManager.
// Same pattern as identityManager — this file is the public surface for
// reaction prefs, dataManager is the storage layer underneath.
export type { ReactionData };

// ─── Emoji config helpers ─────────────────────────────────────────────────────

// Mirror of one entry in configs/emoji-config.json. The JSON import is
// statically typed as `any` by default, so we cast through this interface
// to get autocomplete elsewhere in the codebase.
interface EmojiConfig {
    emoji: string; // the actual unicode/custom emoji to fire
    title: string; // human-readable name, used as the opt-out key
    keywords: string[]; // trigger words scanned in messageCreate
}

const emojiConfig: EmojiConfig[] = emojiConfigData as EmojiConfig[];

/** All known emoji titles, in config order. Used to "disable everything". */
export const ALL_EMOJI_TITLES: string[] = emojiConfig.map((e) => e.title);

/** Convert a title (e.g. "Lesbian Flag") to its emoji string. Returns null if not found. */
export function titleToEmoji(title: string): string | null {
    return emojiConfig.find((e) => e.title === title)?.emoji ?? null;
}

/** Convert an emoji string to its title. Returns null if not found. */
export function emojiToTitle(emoji: string): string | null {
    return emojiConfig.find((e) => e.emoji === emoji)?.title ?? null;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

// Spread this when seeding new prefs so callers can't accidentally mutate
// the shared default array. Cheap insurance against a long-tail aliasing bug.
const DEFAULT_REACTIONS: ReactionData = { disabled_emojis: [] };

// ─── User preferences ─────────────────────────────────────────────────────────
//
// Per-account opt-outs. Note that "user" here means a Discord user ID — for
// PluralKit folks each fronter has their own row. If they want to opt out
// for the whole system they should use the system-scoped functions below.

// Read with a sensible default. Spreading DEFAULT_REACTIONS so the returned
// object is always safe to mutate without touching the shared default.
export function getUserReactionPrefs(userId: string): ReactionData {
    return readUserFile(userId).reactions ?? { ...DEFAULT_REACTIONS };
}

// Whole-prefs replace. We read-merge-write the user file because the
// `reactions` slot lives alongside `identity`, `disabled_commands`, etc. —
// dropping those would be a really mean bug.
export function setUserReactionPrefs(
    userId: string,
    prefs: ReactionData,
): ReactionData {
    const file = readUserFile(userId);
    writeUserFile(userId, { ...file, reactions: prefs });
    return prefs;
}

/** Disable every known reaction for a user. Spreads ALL_EMOJI_TITLES into a fresh array. */
export function disableAllUserReactions(userId: string): ReactionData {
    return setUserReactionPrefs(userId, {
        disabled_emojis: [...ALL_EMOJI_TITLES],
    });
}

/** Re-enable everything by emptying the disabled list. */
export function enableAllUserReactions(userId: string): ReactionData {
    return setUserReactionPrefs(userId, { disabled_emojis: [] });
}

/** Add titles to a user's disabled list. Set-dedupes so re-disabling a title is a no-op. */
export function disableUserEmojis(
    userId: string,
    titles: string[],
): ReactionData {
    const prefs = getUserReactionPrefs(userId);
    return setUserReactionPrefs(userId, {
        disabled_emojis: Array.from(
            new Set([...prefs.disabled_emojis, ...titles]),
        ),
    });
}

/** Remove titles from a user's disabled list. Filter-out is fine here since the list is small. */
export function enableUserEmojis(
    userId: string,
    titles: string[],
): ReactionData {
    const prefs = getUserReactionPrefs(userId);
    return setUserReactionPrefs(userId, {
        disabled_emojis: prefs.disabled_emojis.filter(
            (t) => !titles.includes(t),
        ),
    });
}

// ─── Guild preferences ────────────────────────────────────────────────────────
//
// Server-wide opt-outs, set by admins via /admin reactions ... in their guild.
// Strict superset of user prefs in the gate logic below: a guild block wins
// over an individual user wanting that reaction enabled.

export function getGuildReactionPrefs(guildId: string): ReactionData {
    return readGuildFile(guildId).reactions ?? { ...DEFAULT_REACTIONS };
}

export function setGuildReactionPrefs(
    guildId: string,
    prefs: ReactionData,
): ReactionData {
    const file = readGuildFile(guildId);
    writeGuildFile(guildId, { ...file, reactions: prefs });
    return prefs;
}

/** Disable all reactions in a guild. Useful for "this server doesn't do reactions, period". */
export function disableAllGuildReactions(guildId: string): ReactionData {
    return setGuildReactionPrefs(guildId, {
        disabled_emojis: [...ALL_EMOJI_TITLES],
    });
}

/** Enable all reactions in a guild — clears the disabled list, doesn't override user prefs. */
export function enableAllGuildReactions(guildId: string): ReactionData {
    return setGuildReactionPrefs(guildId, { disabled_emojis: [] });
}

/** Add titles to a guild's disabled list. Same set-dedup pattern as the user version. */
export function disableGuildEmojis(
    guildId: string,
    titles: string[],
): ReactionData {
    const prefs = getGuildReactionPrefs(guildId);
    return setGuildReactionPrefs(guildId, {
        disabled_emojis: Array.from(
            new Set([...prefs.disabled_emojis, ...titles]),
        ),
    });
}

/** Remove titles from a guild's disabled list. */
export function enableGuildEmojis(
    guildId: string,
    titles: string[],
): ReactionData {
    const prefs = getGuildReactionPrefs(guildId);
    return setGuildReactionPrefs(guildId, {
        disabled_emojis: prefs.disabled_emojis.filter(
            (t) => !titles.includes(t),
        ),
    });
}

// ─── PK system preferences ────────────────────────────────────────────────────
//
// PluralKit-system-wide opt-outs. The reason this scope exists at all is that
// PK users have multiple Discord accounts (one per fronter, sometimes) and
// having to set the same prefs on each one would be tedious and error-prone.
// One opt-out at the system level applies to every account in the system.
//
// systemId here is the PK hid (5-char lowercase). The mapping from a Discord
// user ID to their hid is resolved upstream in src/pk/resolver.ts.

export function getSystemReactionPrefs(systemId: string): ReactionData {
    return readPkSystemFile(systemId).reactions ?? { ...DEFAULT_REACTIONS };
}

export function setSystemReactionPrefs(
    systemId: string,
    prefs: ReactionData,
): ReactionData {
    const file = readPkSystemFile(systemId);
    writePkSystemFile(systemId, { ...file, reactions: prefs });
    return prefs;
}

/** Disable all reactions for an entire PK system. */
export function disableAllSystemReactions(systemId: string): ReactionData {
    return setSystemReactionPrefs(systemId, {
        disabled_emojis: [...ALL_EMOJI_TITLES],
    });
}

/** Enable all reactions for an entire PK system. */
export function enableAllSystemReactions(systemId: string): ReactionData {
    return setSystemReactionPrefs(systemId, { disabled_emojis: [] });
}

/** Add titles to a PK system's disabled list. */
export function disableSystemEmojis(
    systemId: string,
    titles: string[],
): ReactionData {
    const prefs = getSystemReactionPrefs(systemId);
    return setSystemReactionPrefs(systemId, {
        disabled_emojis: Array.from(
            new Set([...prefs.disabled_emojis, ...titles]),
        ),
    });
}

/** Remove titles from a PK system's disabled list. */
export function enableSystemEmojis(
    systemId: string,
    titles: string[],
): ReactionData {
    const prefs = getSystemReactionPrefs(systemId);
    return setSystemReactionPrefs(systemId, {
        disabled_emojis: prefs.disabled_emojis.filter(
            (t) => !titles.includes(t),
        ),
    });
}

// ─── Reaction gate ────────────────────────────────────────────────────────────

// The single function the message handler actually calls per emoji per message.
// Three scopes get checked in order: guild → system → user. *Any* of them
// opting out blocks the reaction; we OR the disables together rather than
// trying to do something clever with overrides.
//
// Why this order?
//   1. Guild first because it's the cheapest "no" — if the server has banned
//      this emoji nothing else matters.
//   2. System next because we already had to look it up to know we're proxied.
//   3. User last because it's the narrowest scope.
//
// systemId is optional because most messages aren't PK-proxied — passing
// null/undefined just skips that check.
export function isReactionAllowed(
    title: string,
    userId: string,
    guildId: string | null,
    systemId?: string | null,
): boolean {
    // Guild scope wins over individual prefs. An admin disabling "Trans Flag"
    // server-wide overrides any user who wanted it on for themselves.
    if (guildId) {
        const guild = getGuildReactionPrefs(guildId);
        if (guild.disabled_emojis.includes(title)) return false;
    }

    // System scope: applies to every account inside the PK system.
    if (systemId) {
        const system = getSystemReactionPrefs(systemId);
        if (system.disabled_emojis.includes(title)) return false;
    }

    // User scope last — narrowest, but final say if nothing higher blocked it.
    const user = getUserReactionPrefs(userId);
    if (user.disabled_emojis.includes(title)) return false;

    return true;
}
