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

export default {
    data: {
        name: 'ping',
        description: 'Replies with Pong and displays latencies.',
    },

    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sent = await interaction.editReply({ content: 'Pinging...' });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = client.ws.ping;

        const embed = new EmbedBuilder()
            .setTitle('🌐 Latency Check Complete')
            .setDescription(
                `Pong! 🏓\n**Command Latency**: **${latency}ms**\n**API Latency**: **${apiLatency}ms**`
            )
            .setColor(0x2ecc71)
            .setThumbnail('https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png')
            .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });

        await interaction.editReply({ content: '', embeds: [embed] });
    },
};