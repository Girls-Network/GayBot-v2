/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// The reaction pipeline in two halves:
//   1. KeywordChecker — pure function: given message text, which emoji
//      titles should fire. This is the hot path for every message we see.
//   2. processReactionQueue — drains a queue of "fire this emoji on this
//      message" entries, one per tick, with opt-out gating and Discord
//      rate-limit friendliness baked in.
//
// The messageCreate handler calls (1), builds queue entries, pushes them
// onto a shared queue on the client, and a 1s interval in main.ts calls (2)
// to drain that queue. Keeping the two halves decoupled means keyword
// matching stays synchronous and opt-out/rate-limit logic doesn't block
// the event handler.

import { Message, PartialMessage } from 'discord.js';
import emojiConfigData from '../configs/emoji-config.json';
import { isReactionAllowed } from './reactionPreferences';
import chalk from 'chalk';

// Shape of one entry in configs/emoji-config.json. JSON imports land as
// `any`, so we cast through this interface for autocomplete downstream.
interface EmojiConfig {
    emoji: string;      // the emoji string to react with
    title: string;      // human-readable name — the opt-out key
    keywords: string[]; // trigger words/phrases to match against message text
}

export interface ReactionQueueEntry {
    message: Message | PartialMessage;
    emoji: string;
    title: string;
    /**
     * Discord user ID to gate opt-outs against. For PK-proxied messages this is
     * the real user behind the proxy (resolved in messageCreate via PK's API),
     * not the webhook bot's ID. This matters a lot — the webhook doesn't own
     * a user profile and its opt-outs would always be "no prefs set".
     */
    authorId: string;
    /**
     * PK system hid the sender belongs to, if any. Populated for PK-proxied
     * messages; null for regular Discord users (or webhooks that aren't PK).
     * Used to honour system-level opt-outs that cascade across every account
     * in the system — one "disable" at the system level and none of the
     * fronters' accounts get reacted to.
     */
    systemId: string | null;
}

// Imported once at module load — the config file is static and we don't
// want to re-parse the JSON for every incoming message. If the config
// changes at runtime (which it doesn't, currently), this would need a
// reload mechanism.
const emojis: EmojiConfig[] = emojiConfigData as EmojiConfig[];

// Matches message content against the keyword config and spits out the
// emojis that should fire. This is the hot path for every message we see,
// so keep it cheap. Allocations and regex work here run once per message
// per keyword — that's 30ish emojis × a handful of keywords each × however
// many messages the server gets per second. Not catastrophic, but not free.
export class KeywordChecker {
    // Held as an instance field (rather than using the module-level `emojis`
    // directly) mostly so tests could inject a different config if we ever
    // needed them. Currently it's just the imported JSON.
    private emojiMap: EmojiConfig[];

    constructor() {
        this.emojiMap = emojis;
    }

    /** Returns matched { emoji, title } pairs for a given message string. */
    public getMatchingEmojis(messageContent: string): { emoji: string; title: string }[] {
        // Defensive null/type check — PartialMessage objects can have
        // null content, and we don't want to crash if Discord ever sends
        // us something unexpected.
        if (!messageContent || typeof messageContent !== 'string') {
            return [];
        }

        const lowerMessage = messageContent.toLowerCase();
        // Map (not Set) so we preserve the title alongside the emoji.
        // Keyed by emoji so the same emoji never fires twice for one
        // message even if multiple keywords matched it.
        const found = new Map<string, string>(); // emoji → title, de-dupes by emoji

        this.emojiMap.forEach(item => {
            // .some() short-circuits on the first matching keyword — no point
            // checking the rest once we know this emoji fires.
            const matchFound = item.keywords.some(keyword => {
                const lowerKeyword = keyword.toLowerCase();

                // Literal-match for Discord mentions like <@123>. Word-boundary
                // regex would mangle these because of the angle brackets,
                // which aren't "word characters" and mess up \b anchors.
                // Plain substring check is correct and simpler for mentions.
                if (lowerKeyword.startsWith('<@') && lowerKeyword.endsWith('>')) {
                    return lowerMessage.includes(lowerKeyword);
                }

                // Word-boundary matching for everything else. The escape
                // regex here neutralises regex metacharacters so a keyword
                // like "c++" matches literally rather than blowing up.
                const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Allow plural forms to match too — "lesbian" should fire
                // on "lesbians", "kiss" on "kisses". Not fancy English
                // pluralisation (no "y→ies"), but catches the common case.
                const pluralization = '(s|es)?';

                // We swap \b for a whitespace lookahead/behind when the
                // keyword starts or ends with a non-word char — otherwise
                // things like ":3" or "^w^" never match because \b can't
                // anchor against punctuation. Word-char anchors get the
                // classic \b treatment.
                const startsWithWordChar = /^\w/.test(lowerKeyword);
                const endsWithWordChar = /\w$/.test(lowerKeyword);

                const prefix = startsWithWordChar ? '\\b' : '(?<=\\s|^)';
                const suffix = endsWithWordChar ? '\\b' : '(?=\\s|$)';

                const regex = new RegExp(`${prefix}${escapedKeyword}${pluralization}${suffix}`);
                return regex.test(lowerMessage);
            });

            // has-check prevents double-entry even though Map.set would
            // overwrite — we want the first-matched title to win for
            // consistency if two keywords somehow mapped the same emoji.
            if (matchFound && !found.has(item.emoji)) {
                found.set(item.emoji, item.title);
            }
        });

        return Array.from(found.entries()).map(([emoji, title]) => ({ emoji, title }));
    }
}

// Single-flight guard. Multiple 1s ticks from main.ts can fire while a
// fetch is still in flight (e.g. slow Discord response); this flag makes
// sure we don't double-process the same queue entry or stack up overlapping
// reaction bursts. Module-level state is fine here — one bot process per
// shard, and reaction processing is inherently serial anyway.
let isProcessing = false;

// Pulls one entry off the queue, checks opt-outs, and fires the reaction.
// Loops itself via setTimeout after each entry so there's always a 500ms
// gap between reactions regardless of how fast the caller ticks.
export async function processReactionQueue(queue: ReactionQueueEntry[]): Promise<void> {
    // Early out for both the "already working" and "nothing to do" cases.
    // Either way this tick is a no-op.
    if (isProcessing || queue.length === 0) {
        return;
    }

    isProcessing = true;

    const entry = queue.shift();
    if (entry) {
        try {
            // Re-fetch the message because the queue entry may hold a
            // Partial. Fetch resolves it to a full Message so we can call
            // .react() reliably. Rare case: message was deleted between
            // queueing and firing; .fetch() throws and we log+skip below.
            const message = await entry.message.fetch();

            // authorId here is already the real human — messageCreate did
            // the PK/plural dance before pushing us the entry, so we can
            // trust it for opt-out lookups without any more API calls.
            const guildId = message.guildId ?? null;

            // Opt-out gate. If any scope (guild/system/user) has this title
            // disabled, bail without reacting. Still honour the 500ms tail
            // by scheduling the next tick — we just drop *this* entry on
            // the floor rather than processing it.
            if (!isReactionAllowed(entry.title, entry.authorId, guildId, entry.systemId)) {
                isProcessing = false;
                if (queue.length > 0) setTimeout(() => processReactionQueue(queue), 500);
                return;
            }

            await message.react(entry.emoji);
        } catch (error) {
            // Don't let a single bad reaction (deleted message, missing
            // permissions, removed emoji, etc.) stop the rest of the
            // queue. Log and move on.
            console.error(chalk.redBright`Failed to react with ${entry.emoji}:`, error);
        }
    }

    isProcessing = false;

    // 500ms between reactions is slower than strictly needed but keeps us
    // well under Discord's per-channel reaction rate limit (1/250ms). If
    // the queue is empty we just stop — the next push will kick this loop
    // again via the main.ts interval.
    if (queue.length > 0) {
        setTimeout(() => processReactionQueue(queue), 500);
    }
}