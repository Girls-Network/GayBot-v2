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
        name: 'support',
        description: 'Get the support links',
    },

    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sent = await interaction.editReply({ content: 'Please wait...' });

        const embed = new EmbedBuilder()
            .setTitle('🎗️ Support Links')
            .setDescription(
                `**Support Server:**https://discord.gg/transfemme
                \n**Source Code:** https://github.com/Girls-Network/GayBot-v2
                \n**Bot Status:** https://status.girlsnetwork.dev`
            )
            .setColor(0x2ecc71)
            .setFooter({ text: 'GayBot v2' })
            .setThumbnail('https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png');

        await interaction.editReply({ content: '', embeds: [embed] });
    },
};