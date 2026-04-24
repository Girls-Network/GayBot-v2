/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Message } from 'discord.js';
import { KeywordChecker, ReactionQueueEntry } from '../utils/reactionSystem';
import { resolveProxiedSender as resolvePkSender } from '../pk';
import { resolveProxiedSender as resolvePluralSender } from '../plural';
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

        // Webhook messages are (usually) proxies — the visible author is the
        // bot, but the real person who typed the message is behind it. We
        // want opt-outs to apply to that person, so we ask PK and /p/r in
        // turn who the actual sender is.
        //
        // PK first because most of our proxied traffic is PK. If PK says
        // "not mine" we fall through to /p/r. If neither recognises the
        // message it's probably a different webhook (Tupperbox, GitHub,
        // etc.) and we just use the webhook's own author ID like before.
        //
        // Heads up on systemId: it's a PK concept (a PK system hid). /p/r's
        // equivalent is the account, but resolving Discord-user → account
        // needs an endpoint we haven't confirmed with ant yet. Until that's
        // sorted, /p/r senders get user-level opt-outs but not the cascade
        // across every Discord login they own.
        let authorId = message.author.id;
        let systemId: string | null = null;
        if (message.webhookId) {
            try {
                const pk = await resolvePkSender(message.id);
                if (pk) {
                    authorId = pk.senderId;
                    systemId = pk.systemId;
                } else {
                    // Not a PK message — try /p/r next.
                    try {
                        const plural = await resolvePluralSender(message.channelId, message.id);
                        if (plural) {
                            authorId = plural.senderId;
                            // systemId stays null — see the note above.
                        }
                    } catch (err) {
                        logError(err, 'plural.resolveProxiedSender');
                    }
                }
            } catch (err) {
                // Never hold up reactions over an API hiccup. Log it, fall
                // back to the webhook's own author ID, keep moving.
                logError(err, 'pk.resolveProxiedSender');
            }
        }

        const client = message.client as unknown as ExtendedClient;
        for (const { emoji, title } of matches) {
            client.reactionQueue.push({ message, emoji, title, authorId, systemId });
        }
    },
};