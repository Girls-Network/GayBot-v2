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
import hugGifs from '../configs/hug.json';

export default {
    data: {
        name: 'yuri',
        description: 'Posts a random hugging gif!',
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: 'target',
                description: 'The user to hug.',
                required: true,
            },
        ],
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const targetUser = interaction.options.getUser('target', true);
        const gif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setImage(gif);

        await interaction.reply({
            content: `*${interaction.user} kisses ${targetUser}!* 🌸`,
            embeds: [embed],
        });
    },
};