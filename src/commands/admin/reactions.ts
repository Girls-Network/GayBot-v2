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
import {
    ALL_EMOJI_TITLES,
    titleToEmoji,
    getGuildReactionPrefs,
    disableAllGuildReactions,
    enableAllGuildReactions,
    disableGuildEmojis,
    enableGuildEmojis,
    ReactionData,
} from '../../utils/reactionPreferences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStatusEmbed(prefs: ReactionData, guildName: string): EmbedBuilder {
    const allDisabled  = prefs.disabled_emojis.length === ALL_EMOJI_TITLES.length;
    const noneDisabled = prefs.disabled_emojis.length === 0;

    let statusLine: string;
    if (allDisabled)       statusLine = '🔴 All reactions disabled';
    else if (noneDisabled) statusLine = '🟢 All reactions enabled';
    else                   statusLine = `🟡 Some reactions disabled (${prefs.disabled_emojis.length}/${ALL_EMOJI_TITLES.length})`;

    const disabledList = prefs.disabled_emojis.length > 0
        ? prefs.disabled_emojis.map(t => `${titleToEmoji(t) ?? ''} ${t}`.trim()).join('\n')
        : '_None_';

    const enabledList = ALL_EMOJI_TITLES
        .filter(t => !prefs.disabled_emojis.includes(t))
        .map(t => `${titleToEmoji(t) ?? ''} ${t}`.trim())
        .join('\n') || '_None_';

    return new EmbedBuilder()
        .setTitle(`🏠 Server Reaction Settings — ${guildName}`)
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
                name: 'reactions',
                description: 'Manage which reactions the bot adds in this server.',
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'disable',
                        description: 'Disable a reaction or all reactions server-wide.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'reaction',
                                description: 'Reaction to disable, or "All".',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'enable',
                        description: 'Re-enable a reaction or all reactions server-wide.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'reaction',
                                description: 'Reaction to re-enable, or "All".',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'status',
                        description: 'View the current server reaction settings.',
                    },
                ],
            },
        ],
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        if (!interaction.guildId) return await interaction.respond([]);

        const sub     = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();
        const prefs   = getGuildReactionPrefs(interaction.guildId);

        let candidates: string[] = [];

        if (sub === 'disable') {
            const notYet = ALL_EMOJI_TITLES.filter(t => !prefs.disabled_emojis.includes(t));
            candidates = notYet.length > 0 ? ['All', ...notYet] : [];
        } else if (sub === 'enable') {
            candidates = prefs.disabled_emojis.length > 0 ? ['All', ...prefs.disabled_emojis] : [];
        }

        await interaction.respond(
            candidates
                .filter(c => c.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(c => ({ name: c, value: c }))
        );
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        if (!interaction.inGuild()) {
            await interaction.reply({
                content: '❌ Server settings can only be managed inside a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

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

        // ── status ────────────────────────────────────────────────────────
        if (sub === 'status') {
            const prefs = getGuildReactionPrefs(guildId);
            const embed = buildStatusEmbed(prefs, interaction.guild?.name ?? guildId);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const reaction = interaction.options.getString('reaction', true);

        // ── disable ───────────────────────────────────────────────────────
        if (sub === 'disable') {
            reaction === 'All'
                ? disableAllGuildReactions(guildId)
                : disableGuildEmojis(guildId, [reaction]);

            const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
            const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
            await interaction.reply({
                content: `✅ ${emoji} ${label} disabled server-wide.`.trim(),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        if (sub === 'enable') {
            reaction === 'All'
                ? enableAllGuildReactions(guildId)
                : enableGuildEmojis(guildId, [reaction]);

            const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
            const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
            await interaction.reply({
                content: `✅ ${emoji} ${label} re-enabled server-wide.`.trim(),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};