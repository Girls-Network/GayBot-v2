/*
 * Copyright (c) 2026 Girls Network
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
} from 'discord.js';
import yuriGifs from '../configs/yuri.json';
// Gifs were sent by Camilla (1110542429838397471)

export default {
    data: {
        name: 'yuri',
        description: 'Posts a random kissing yuri gif! 🌸',
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
            content: `*${interaction.user.displayName} kisses ${targetUser}!* 🌸`,
            embeds: [embed],
        });
    },
};