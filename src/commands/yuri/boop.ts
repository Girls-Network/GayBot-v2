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
import boopGifs from '../../configs/yuri/boop.json';

export default {
    toggle: true,
    data: {
        name: 'yuri',
        description: 'Yuri commands 🌸',
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'boop',
                description: 'Posts a random boop gif! 🌸',
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: 'target',
                        description: 'The user to boop.',
                        required: true,
                    },
                ],
            },
        ],
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const targetUser = interaction.options.getUser('target', true);
        const gif = boopGifs[Math.floor(Math.random() * boopGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setImage(gif)
            .setFooter({ text: 'GayBot v2' });

        await interaction.reply({
            content: `*${interaction.user} boops ${targetUser}!* 🌸`,
            embeds: [embed],
        });
    },
};