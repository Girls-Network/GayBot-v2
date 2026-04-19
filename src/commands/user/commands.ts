/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
    MessageFlags,
} from 'discord.js';
import { readUserFile, writeUserFile } from '../../utils/dataManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserDisabledCommands(userId: string): string[] {
    return readUserFile(userId).disabled_commands ?? [];
}

function setUserDisabledCommands(userId: string, list: string[]): void {
    const file = readUserFile(userId);
    writeUserFile(userId, { ...file, disabled_commands: list });
}

function buildStatusEmbed(userId: string, displayName: string, disabled: string[], all: string[]): EmbedBuilder {
    const noneDisabled = disabled.length === 0;
    const allDisabled  = disabled.length === all.length;

    let statusLine: string;
    if (allDisabled)   statusLine = '🔴 All toggleable commands disabled';
    else if (noneDisabled) statusLine = '🟢 All toggleable commands enabled';
    else               statusLine = `🟡 Some commands disabled (${disabled.length}/${all.length})`;

    const disabledList = disabled.length > 0 ? disabled.map(c => `\`${c}\``).join('\n') : '_None_';
    const enabledList  = all.filter(c => !disabled.includes(c)).map(c => `\`${c}\``).join('\n') || '_None_';

    return new EmbedBuilder()
        .setTitle(`👤 Command Preferences — ${displayName}`)
        .setDescription(statusLine)
        .addFields(
            { name: '✅ Enabled', value: enabledList, inline: true },
            { name: '❌ Disabled', value: disabledList, inline: true },
        )
        .setColor(allDisabled ? 0xED4245 : noneDisabled ? 0x57F287 : 0xFEE75C)
        .setFooter({ text: 'GayBot v2' });
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
    data: {
        name: 'user',
        description: 'Manage your personal preferences.',
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: 'commands',
                description: 'Manage which commands others can use on you.',
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'disable',
                        description: 'Stop others from targeting you with a command.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'command',
                                description: 'Command to disable, or "All".',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'enable',
                        description: 'Allow others to target you with a command again.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'command',
                                description: 'Command to re-enable, or "All".',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'status',
                        description: 'View your current command preferences.',
                    },
                ],
            },
        ],
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const client      = interaction.client as any;
        const all: string[] = client.toggleableCommands ?? [];
        const sub         = interaction.options.getSubcommand();
        const focused     = interaction.options.getFocused().toLowerCase();
        const disabled    = getUserDisabledCommands(interaction.user.id);

        let candidates: string[] = [];

        if (sub === 'disable') {
            const notYet = all.filter(c => !disabled.includes(c));
            candidates = notYet.length > 0 ? ['All', ...notYet] : [];
        } else if (sub === 'enable') {
            candidates = disabled.length > 0 ? ['All', ...disabled] : [];
        }

        await interaction.respond(
            candidates
                .filter(c => c.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(c => ({ name: c, value: c }))
        );
    },

    async execute(interaction: CommandInteraction, client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const sub  = interaction.options.getSubcommand();
        const all: string[] = client.toggleableCommands ?? [];

        // ── status ────────────────────────────────────────────────────────
        if (sub === 'status') {
            const disabled = getUserDisabledCommands(interaction.user.id);
            const embed    = buildStatusEmbed(interaction.user.id, interaction.user.displayName, disabled, all);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const command  = interaction.options.getString('command', true);
        const disabled = getUserDisabledCommands(interaction.user.id);

        // ── disable ───────────────────────────────────────────────────────
        if (sub === 'disable') {
            const newList = command === 'All'
                ? [...all]
                : Array.from(new Set([...disabled, command]));

            setUserDisabledCommands(interaction.user.id, newList);

            const label = command === 'All' ? 'All commands' : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} disabled — others can no longer use ${command === 'All' ? 'them' : 'it'} on you.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        if (sub === 'enable') {
            const newList = command === 'All'
                ? []
                : disabled.filter(c => c !== command);

            setUserDisabledCommands(interaction.user.id, newList);

            const label = command === 'All' ? 'All commands' : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} re-enabled — others can use ${command === 'All' ? 'them' : 'it'} on you again.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};