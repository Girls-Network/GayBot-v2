/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Message, PartialMessage } from 'discord.js';
import emojiConfigData from '../configs/emoji-config.json';
import { isReactionAllowed } from './reactionPreferences';
import chalk from 'chalk';

interface EmojiConfig {
    emoji: string;
    title: string;
    keywords: string[];
}

export interface ReactionQueueEntry {
    message: Message | PartialMessage;
    emoji: string;
    title: string;
    /**
     * Discord user ID to gate opt-outs against. For PK-proxied messages this is
     * the real user behind the proxy (resolved in messageCreate via PK's API),
     * not the webhook bot's ID.
     */
    authorId: string;
    /**
     * PK system hid the sender belongs to, if any. Populated for PK-proxied
     * messages; null for regular Discord users (or webhooks that aren't PK).
     * Used to honour system-level opt-outs that cascade across every account
     * in the system.
     */
    systemId: string | null;
}

// Imported once at module load — the config file is static and we don't
// want to re-parse the JSON for every incoming message.
const emojis: EmojiConfig[] = emojiConfigData as EmojiConfig[];

// Matches message content against the keyword config and spits out the
// emojis that should fire. This is the hot path for every message we see,
// so keep it cheap.
export class KeywordChecker {
    private emojiMap: EmojiConfig[];

    constructor() {
        this.emojiMap = emojis;
    }

    /** Returns matched { emoji, title } pairs for a given message string. */
    public getMatchingEmojis(messageContent: string): { emoji: string; title: string }[] {
        if (!messageContent || typeof messageContent !== 'string') {
            return [];
        }

        const lowerMessage = messageContent.toLowerCase();
        const found = new Map<string, string>(); // emoji → title, de-dupes by emoji

        this.emojiMap.forEach(item => {
            const matchFound = item.keywords.some(keyword => {
                const lowerKeyword = keyword.toLowerCase();

                // Literal-match for Discord mentions like <@123>. Word-boundary
                // regex would mangle these because of the angle brackets.
                if (lowerKeyword.startsWith('<@') && lowerKeyword.endsWith('>')) {
                    return lowerMessage.includes(lowerKeyword);
                }

                // Word-boundary matching for everything else. We swap \b for a
                // whitespace lookahead/behind when the keyword starts or ends
                // with a non-word char — otherwise things like ":3" or "^w^"
                // never match because \b can't anchor against punctuation.
                const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pluralization = '(s|es)?';

                const startsWithWordChar = /^\w/.test(lowerKeyword);
                const endsWithWordChar = /\w$/.test(lowerKeyword);

                const prefix = startsWithWordChar ? '\\b' : '(?<=\\s|^)';
                const suffix = endsWithWordChar ? '\\b' : '(?=\\s|$)';

                const regex = new RegExp(`${prefix}${escapedKeyword}${pluralization}${suffix}`);
                return regex.test(lowerMessage);
            });

            if (matchFound && !found.has(item.emoji)) {
                found.set(item.emoji, item.title);
            }
        });

        return Array.from(found.entries()).map(([emoji, title]) => ({ emoji, title }));
    }
}

// Single-flight guard. Multiple 1s ticks can fire while a fetch is still
// in flight (e.g. slow Discord response); this flag makes sure we don't
// double-process the same queue entry.
let isProcessing = false;

export async function processReactionQueue(queue: ReactionQueueEntry[]): Promise<void> {
    if (isProcessing || queue.length === 0) {
        return;
    }

    isProcessing = true;

    const entry = queue.shift();
    if (entry) {
        try {
            const message = await entry.message.fetch();

            // authorId here is already the real human — messageCreate did
            // the PK/plural dance before pushing us the entry, so we can
            // trust it for opt-out lookups.
            const guildId = message.guildId ?? null;

            if (!isReactionAllowed(entry.title, entry.authorId, guildId, entry.systemId)) {
                isProcessing = false;
                if (queue.length > 0) setTimeout(() => processReactionQueue(queue), 500);
                return;
            }

            await message.react(entry.emoji);
        } catch (error) {
            console.error(chalk.redBright`Failed to react with ${entry.emoji}:`, error);
        }
    }

    isProcessing = false;

    // 500ms between reactions is slower than strictly needed but keeps us
    // well under Discord's per-channel reaction rate limit (1/250ms).
    if (queue.length > 0) {
        setTimeout(() => processReactionQueue(queue), 500);
    }
}