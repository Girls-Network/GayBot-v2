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

// Sibling of kiss.ts and hug.ts — see kiss.ts for the merge mechanics.
export default {
    toggle: true, // boop opt-outs honoured for both server and target
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
        // Random gif from configs/yuri/boop.json.
        const gif = boopGifs[Math.floor(Math.random() * boopGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0xff69b4)
            .setImage(gif)
            .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });

        await interaction.reply({
            content: `*${interaction.user} boops ${targetUser}!* 🌸`,
            embeds: [embed],
        });
    },
};