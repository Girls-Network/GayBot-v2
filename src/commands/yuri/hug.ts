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
import hugGifs from '../../configs/yuri/hug.json';

export default {
    toggle: true,
    data: {
        name: 'yuri',
        description: 'Yuri commands 🌸',
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'hug',
                description: 'Posts a random hug gif! 🫂',
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: 'target',
                        description: 'The user to hug.',
                        required: true,
                    },
                ],
            },
        ],
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const targetUser = interaction.options.getUser('target', true);
        const gif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setImage(gif)
            .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });

        await interaction.reply({
            content: `*${interaction.user} hugs ${targetUser}!* 🫂`,
            embeds: [embed],
        });
    },
};