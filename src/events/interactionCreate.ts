/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    Interaction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    MessageFlags,
} from 'discord.js';
import { handleCommandError, handleInteractionError } from '../handlers/errorHandler';
import { readGuildFile, readUserFile } from '../utils/dataManager';

interface ExtendedClient {
    commands: Collection<string, any>;
    toggleableCommands: string[];
}

const COMMANDS_PER_PAGE = 5;

// Build the subcommand key for an interaction (e.g. "yuri kiss" or "admin commands disable").
// Matches the format the command loader produces.
function getSubcommandKey(interaction: any): string {
    try {
        const group = interaction.options?.getSubcommandGroup(false);
        const sub   = interaction.options?.getSubcommand(false);
        if (group && sub) return `${interaction.commandName} ${group} ${sub}`;
        if (sub)          return `${interaction.commandName} ${sub}`;
    } catch {
        // No subcommand
    }
    return interaction.commandName;
}

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        const client = interaction.client as unknown as ExtendedClient;

        // ── Autocomplete ──────────────────────────────────────────────────
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command?.autocomplete) return;
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error('Autocomplete error:', error);
            }
            return;
        }

        // ── Slash commands ────────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            // The opt-out gate only applies to things explicitly marked
            // toggle: true (the yuri stuff etc.). Utility commands like
            // /ping or /help should never be silently disabled.
            if (command.toggle) {
                const key = getSubcommandKey(interaction);

                // Guild bans win — if the server has turned this off, no
                // one in it gets to use it, regardless of target.
                if (interaction.guildId) {
                    const guildData = readGuildFile(interaction.guildId);
                    if (guildData.disabled_commands?.includes(key)) {
                        await interaction.reply({
                            content: '❌ This command has been disabled in this server.',
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                }

                // Individual opt-outs. Only matters for commands that
                // aim at a user ('target' option); self-targeting
                // commands don't hit this branch.
                const targetUser = interaction.options.getUser('target');
                if (targetUser) {
                    const targetData = readUserFile(targetUser.id);
                    if (targetData.disabled_commands?.includes(key)) {
                        await interaction.reply({
                            content: `❌ ${targetUser} has disabled this command.`,
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                }
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                await handleCommandError(error, interaction);
            }
        }

        // ── Help pagination buttons ───────────────────────────────────────
        if (interaction.isButton()) {
            const [action, currentPageStr] = interaction.customId.split(':');
            if (!action.startsWith('help_')) return;

            try {
                let page = parseInt(currentPageStr);
                if (action === 'help_next') page++;
                if (action === 'help_prev') page--;

                const commandList: string[] = [];
                client.commands.forEach((cmd) => {
                    commandList.push(`**/${cmd.data.name}**\n└ ${cmd.data.description}`);
                });

                const totalPages = Math.ceil(commandList.length / COMMANDS_PER_PAGE);

                const embed = new EmbedBuilder()
                    .setTitle('📖 Available Commands')
                    .setDescription(commandList.slice(page * COMMANDS_PER_PAGE, (page + 1) * COMMANDS_PER_PAGE).join('\n\n'))
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                    .setColor(0x5865F2);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_prev:${page}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`help_next:${page}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page >= totalPages - 1)
                );

                await interaction.update({ embeds: [embed], components: [row] });
            } catch (error) {
                await handleInteractionError(error, interaction);
            }
        }
    },
};