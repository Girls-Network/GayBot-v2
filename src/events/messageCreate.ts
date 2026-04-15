/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Message } from 'discord.js';
import { KeywordChecker, ReactionQueueEntry } from '../utils/reactionSystem';

interface ExtendedClient {
    reactionQueue: ReactionQueueEntry[];
}

const keywordChecker = new KeywordChecker();

export default {
    name: 'messageCreate',
    async execute(message: Message) {
        // Ignore bot messages but react to webhooks
        if (message.author.bot && !message.webhookId) return;
        if (!message.content) return;

        const client = message.client as unknown as ExtendedClient;
        const matches = keywordChecker.getMatchingEmojis(message.content);

        for (const { emoji, title } of matches) {
            client.reactionQueue.push({ message, emoji, title });
        }
    },
};