/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
} from 'discord.js';
import yuriGifs from '../configs/yuri.json';

export default {
    data: {
        name: 'yuri',
        description: 'Posts a random yuri gif! 🌸',
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: 'target',
                description: 'The user to kiss.',
                required: true,
            },
        ],
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const targetUser = interaction.options.getUser('target', true);
        const gif = yuriGifs[Math.floor(Math.random() * yuriGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setImage(gif);

        await interaction.reply({
            content: `*${interaction.user} kisses ${targetUser}!* 🌸`,
            embeds: [embed],
        });
    },
};