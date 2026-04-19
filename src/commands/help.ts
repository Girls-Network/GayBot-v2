/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { 
    CommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags,
    Collection
} from 'discord.js';

interface BotCommand {
    data: any;
    execute: (interaction: CommandInteraction, client: any) => Promise<void>;
}

const COMMANDS_PER_PAGE = 5;

export default {
    data: {
        name: 'help',
        description: 'View all available commands and their details.',
    },

    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;

        const commandList: string[] = [];
        
        client.commands.forEach((cmd: BotCommand) => {
            const data = cmd.data;
            commandList.push(`**/${data.name}**\n└ ${data.description}`);
        });

        const totalPages = Math.ceil(commandList.length / COMMANDS_PER_PAGE);
        const page = 0;

        const embed = new EmbedBuilder()
            .setTitle('📖 Available Commands')
            .setDescription(commandList.slice(page * COMMANDS_PER_PAGE, (page + 1) * COMMANDS_PER_PAGE).join('\n\n'))
            .setFooter({ text: `Page ${page + 1} of ${totalPages}`, iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' })
            .setColor(0x5865F2);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`help_prev:${page}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`help_next:${page}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(totalPages <= 1)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    },
};