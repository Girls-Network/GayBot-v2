/*
 * Copyright (c) 2026 Girls Network
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Message, PartialMessage } from 'discord.js';
import emojiConfigData from '../configs/emoji-config.json';
import chalk from 'chalk';

interface EmojiConfig {
    emoji: string;
    title: string;
    keywords: string[];
}

interface ReactionQueueEntry {
    message: Message | PartialMessage;
    emoji: string;
}

// Load emoji configuration
const emojis: EmojiConfig[] = emojiConfigData as EmojiConfig[];

// Keyword Checker
export class KeywordChecker {
    private emojiMap: EmojiConfig[];

    constructor() {
        this.emojiMap = emojis;
    }

    public getMatchingEmojis(messageContent: string): string[] {
        if (!messageContent || typeof messageContent !== 'string') {
            return [];
        }

        const lowerMessage = messageContent.toLowerCase();
        const foundEmojis = new Set<string>();

        this.emojiMap.forEach(item => {
            const matchFound = item.keywords.some(keyword => {
                const lowerKeyword = keyword.toLowerCase();

                // Check if keyword is a Discord mention
                if (lowerKeyword.startsWith('<@') && lowerKeyword.endsWith('>')) {
                    // For mentions, do exact string matching (case-insensitive)
                    return lowerMessage.includes(lowerKeyword);
                }

                // For regular keywords, use boundary-aware regex.
                // \b only works between \w and \W characters, so keywords that
                // start or end with non-word chars (e.g. :3, ;3, ^w^) won't
                // match correctly with \b — we use lookahead/lookbehind for
                // whitespace or string boundaries instead.
                const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pluralization = '(s|es)?';

                const startsWithWordChar = /^\w/.test(lowerKeyword);
                const endsWithWordChar = /\w$/.test(lowerKeyword);

                const prefix = startsWithWordChar ? '\\b' : '(?<=\\s|^)';
                const suffix = endsWithWordChar ? '\\b' : '(?=\\s|$)';

                const regex = new RegExp(`${prefix}${escapedKeyword}${pluralization}${suffix}`);
                return regex.test(lowerMessage);
            });

            if (matchFound) {
                foundEmojis.add(item.emoji);
            }
        });

        return Array.from(foundEmojis);
    }
}

// Reaction Queue Processor
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
            await message.react(entry.emoji);
        } catch (error) {
            console.error(chalk.redBright`Failed to react with ${entry.emoji}:`, error);
        }
    }

    isProcessing = false;

    // Continue processing if queue has more items
    if (queue.length > 0) {
        setTimeout(() => processReactionQueue(queue), 500);
    }
}