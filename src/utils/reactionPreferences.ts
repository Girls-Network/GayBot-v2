/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    readUserFile,
    writeUserFile,
    readGuildFile,
    writeGuildFile,
    ReactionData,
} from './dataManager';
import emojiConfigData from '../configs/emoji-config.json';

// Re-export for consumers that need the type
export type { ReactionData };

// ─── Emoji config helpers ─────────────────────────────────────────────────────

interface EmojiConfig {
    emoji: string;
    title: string;
    keywords: string[];
}

const emojiConfig: EmojiConfig[] = emojiConfigData as EmojiConfig[];

/** All known emoji titles, in config order. */
export const ALL_EMOJI_TITLES: string[] = emojiConfig.map(e => e.title);

/** Convert a title (e.g. "Lesbian Flag") to its emoji string. Returns null if not found. */
export function titleToEmoji(title: string): string | null {
    return emojiConfig.find(e => e.title === title)?.emoji ?? null;
}

/** Convert an emoji string to its title. Returns null if not found. */
export function emojiToTitle(emoji: string): string | null {
    return emojiConfig.find(e => e.emoji === emoji)?.title ?? null;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_REACTIONS: ReactionData = { disabled_emojis: [] };

// ─── User preferences ─────────────────────────────────────────────────────────

export function getUserReactionPrefs(userId: string): ReactionData {
    return readUserFile(userId).reactions ?? { ...DEFAULT_REACTIONS };
}

export function setUserReactionPrefs(userId: string, prefs: ReactionData): ReactionData {
    const file = readUserFile(userId);
    writeUserFile(userId, { ...file, reactions: prefs });
    return prefs;
}

/** Disable all reactions for a user. */
export function disableAllUserReactions(userId: string): ReactionData {
    return setUserReactionPrefs(userId, { disabled_emojis: [...ALL_EMOJI_TITLES] });
}

/** Enable all reactions for a user (clears the list). */
export function enableAllUserReactions(userId: string): ReactionData {
    return setUserReactionPrefs(userId, { disabled_emojis: [] });
}

/** Add titles to a user's disabled list. */
export function disableUserEmojis(userId: string, titles: string[]): ReactionData {
    const prefs = getUserReactionPrefs(userId);
    return setUserReactionPrefs(userId, {
        disabled_emojis: Array.from(new Set([...prefs.disabled_emojis, ...titles])),
    });
}

/** Remove titles from a user's disabled list. */
export function enableUserEmojis(userId: string, titles: string[]): ReactionData {
    const prefs = getUserReactionPrefs(userId);
    return setUserReactionPrefs(userId, {
        disabled_emojis: prefs.disabled_emojis.filter(t => !titles.includes(t)),
    });
}

// ─── Guild preferences ────────────────────────────────────────────────────────

export function getGuildReactionPrefs(guildId: string): ReactionData {
    return readGuildFile(guildId).reactions ?? { ...DEFAULT_REACTIONS };
}

export function setGuildReactionPrefs(guildId: string, prefs: ReactionData): ReactionData {
    const file = readGuildFile(guildId);
    writeGuildFile(guildId, { ...file, reactions: prefs });
    return prefs;
}

/** Disable all reactions in a guild. */
export function disableAllGuildReactions(guildId: string): ReactionData {
    return setGuildReactionPrefs(guildId, { disabled_emojis: [...ALL_EMOJI_TITLES] });
}

/** Enable all reactions in a guild. */
export function enableAllGuildReactions(guildId: string): ReactionData {
    return setGuildReactionPrefs(guildId, { disabled_emojis: [] });
}

/** Add titles to a guild's disabled list. */
export function disableGuildEmojis(guildId: string, titles: string[]): ReactionData {
    const prefs = getGuildReactionPrefs(guildId);
    return setGuildReactionPrefs(guildId, {
        disabled_emojis: Array.from(new Set([...prefs.disabled_emojis, ...titles])),
    });
}

/** Remove titles from a guild's disabled list. */
export function enableGuildEmojis(guildId: string, titles: string[]): ReactionData {
    const prefs = getGuildReactionPrefs(guildId);
    return setGuildReactionPrefs(guildId, {
        disabled_emojis: prefs.disabled_emojis.filter(t => !titles.includes(t)),
    });
}

// ─── Reaction gate ────────────────────────────────────────────────────────────

/**
 * Called by the reaction queue with the emoji's TITLE (e.g. "Lesbian Flag").
 *
 * Returns true  → react
 * Returns false → skip
 *
 * Guild rules are checked first; most restrictive wins.
 */
export function isReactionAllowed(
    title: string,
    userId: string,
    guildId: string | null,
): boolean {
    if (guildId) {
        const guild = getGuildReactionPrefs(guildId);
        if (guild.disabled_emojis.includes(title)) return false;
    }

    const user = getUserReactionPrefs(userId);
    if (user.disabled_emojis.includes(title)) return false;

    return true;
}