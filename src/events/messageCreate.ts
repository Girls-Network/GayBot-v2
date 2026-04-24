/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Message } from 'discord.js';
import { KeywordChecker, ReactionQueueEntry } from '../utils/reactionSystem';
import { resolveProxiedSender } from '../pk';
import { logError } from '../utils/logger';

interface ExtendedClient {
    reactionQueue: ReactionQueueEntry[];
}

const keywordChecker = new KeywordChecker();

export default {
    name: 'messageCreate',
    async execute(message: Message) {
        // Ignore bot messages but react to webhooks (PluralKit proxies come through as webhooks).
        if (message.author.bot && !message.webhookId) return;
        if (!message.content) return;

        const matches = keywordChecker.getMatchingEmojis(message.content);
        if (matches.length === 0) return;

        // For PK-proxied (webhook) messages, resolve the real sender via PK's
        // API so opt-outs apply to the human behind the proxy. For non-webhook
        // traffic we just use message.author.id as before.
        let authorId = message.author.id;
        let systemId: string | null = null;
        if (message.webhookId) {
            try {
                const resolved = await resolveProxiedSender(message.id);
                if (resolved) {
                    authorId = resolved.senderId;
                    systemId = resolved.systemId;
                }
                // If resolved is null, this is a non-PK webhook — fall back to
                // the webhook's own ID (preserves prior behaviour).
            } catch (err) {
                // Don't block reactions on transient PK API failures; just log
                // and fall back to the webhook author ID.
                logError(err, 'pk.resolveProxiedSender');
            }
        }

        const client = message.client as unknown as ExtendedClient;
        for (const { emoji, title } of matches) {
            client.reactionQueue.push({ message, emoji, title, authorId, systemId });
        }
    },
};