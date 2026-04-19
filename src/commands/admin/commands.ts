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
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import { readGuildFile, writeGuildFile } from '../../utils/dataManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGuildDisabledCommands(guildId: string): string[] {
    return readGuildFile(guildId).disabled_commands ?? [];
}

function setGuildDisabledCommands(guildId: string, list: string[]): void {
    const file = readGuildFile(guildId);
    writeGuildFile(guildId, { ...file, disabled_commands: list });
}

function buildStatusEmbed(guildName: string, disabled: string[], all: string[]): EmbedBuilder {
    const noneDisabled = disabled.length === 0;
    const allDisabled  = disabled.length === all.length;

    let statusLine: string;
    if (allDisabled)       statusLine = '🔴 All toggleable commands disabled';
    else if (noneDisabled) statusLine = '🟢 All toggleable commands enabled';
    else                   statusLine = `🟡 Some commands disabled (${disabled.length}/${all.length})`;

    const disabledList = disabled.length > 0 ? disabled.map(c => `\`${c}\``).join('\n') : '_None_';
    const enabledList  = all.filter(c => !disabled.includes(c)).map(c => `\`${c}\``).join('\n') || '_None_';

    return new EmbedBuilder()
        .setTitle(`🏠 Server Command Settings — ${guildName}`)
        .setDescription(statusLine)
        .addFields(
            { name: '✅ Enabled', value: enabledList, inline: true },
            { name: '❌ Disabled', value: disabledList, inline: true },
        )
        .setColor(allDisabled ? 0xED4245 : noneDisabled ? 0x57F287 : 0xFEE75C)
        .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
    data: {
        name: 'admin',
        description: 'Server administration settings.',
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: 'commands',
                description: 'Manage which commands are available in this server.',
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'disable',
                        description: 'Disable a command server-wide.',
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
                        description: 'Re-enable a command server-wide.',
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
                        description: 'View the current server command settings.',
                    },
                ],
            },
        ],
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        if (!interaction.guildId) return await interaction.respond([]);

        const client      = interaction.client as any;
        const all: string[] = client.toggleableCommands ?? [];
        const sub         = interaction.options.getSubcommand();
        const focused     = interaction.options.getFocused().toLowerCase();
        const disabled    = getGuildDisabledCommands(interaction.guildId);

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

        // Must be in a guild
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: '❌ Server settings can only be managed inside a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Require ManageGuild
        const member = interaction.guild?.members.cache.get(interaction.user.id)
            ?? await interaction.guild?.members.fetch(interaction.user.id);

        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({
                content: '❌ You need the **Manage Server** permission to change server settings.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const guildId = interaction.guildId!;
        const sub     = interaction.options.getSubcommand();
        const all: string[] = client.toggleableCommands ?? [];

        // ── status ────────────────────────────────────────────────────────
        if (sub === 'status') {
            const disabled = getGuildDisabledCommands(guildId);
            const embed    = buildStatusEmbed(interaction.guild?.name ?? guildId, disabled, all);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const command  = interaction.options.getString('command', true);
        const disabled = getGuildDisabledCommands(guildId);

        // ── disable ───────────────────────────────────────────────────────
        if (sub === 'disable') {
            const newList = command === 'All'
                ? [...all]
                : Array.from(new Set([...disabled, command]));

            setGuildDisabledCommands(guildId, newList);

            const label = command === 'All' ? 'All commands' : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} disabled server-wide.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        if (sub === 'enable') {
            const newList = command === 'All'
                ? []
                : disabled.filter(c => c !== command);

            setGuildDisabledCommands(guildId, newList);

            const label = command === 'All' ? 'All commands' : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} re-enabled server-wide.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};