/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';

// Sanity-check command. Useful when shards feel sluggish — gives us both
// the round-trip on the slash command itself and the WebSocket heartbeat
// ping, which are different things and can disagree.
export default {
    data: {
        name: 'ping',
        description: 'Replies with Pong and displays latencies.',
    },

    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;

        // Ephemeral so we don't spam the channel every time someone tests
        // the bot. Defer first because the latency math below needs an
        // actual reply timestamp to subtract from the interaction one.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Send a placeholder we can timestamp. createdTimestamp on `sent`
        // is when our response went out; on `interaction` it's when the
        // user fired the command. The delta is round-trip-ish.
        const sent = await interaction.editReply({ content: 'Pinging...' });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        // Heartbeat ping — discord.js exposes the gateway's last ping value.
        // Independent of slash-command latency, so worth showing both.
        const apiLatency = client.ws.ping;

        const embed = new EmbedBuilder()
            .setTitle('🌐 Latency Check Complete')
            .setDescription(
                `Pong! 🏓\n**Command Latency**: **${latency}ms**\n**API Latency**: **${apiLatency}ms**`
            )
            .setColor(0x2ecc71)
            .setThumbnail('https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png')
            .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });

        // Replace the placeholder text with the embed. Empty content
        // string clears the "Pinging..." line — Discord requires it
        // explicitly when transitioning text-only to embed-only.
        await interaction.editReply({ content: '', embeds: [embed] });
    },
};