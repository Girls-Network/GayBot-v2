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
    getUserReactionPrefs,
    getGuildReactionPrefs,
    disableAllUserReactions,
    enableAllUserReactions,
    disableUserEmojis,
    enableUserEmojis,
    disableAllGuildReactions,
    enableAllGuildReactions,
    disableGuildEmojis,
    enableGuildEmojis,
    ReactionData,
} from '../utils/reactionPreferences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStatusEmbed(
    prefs: ReactionData,
    scope: 'user' | 'server',
    scopeName: string,
): EmbedBuilder {
    const allDisabled = prefs.disabled_emojis.length === ALL_EMOJI_TITLES.length;
    const noneDisabled = prefs.disabled_emojis.length === 0;

    let statusLine: string;
    if (allDisabled) {
        statusLine = '🔴 All reactions disabled';
    } else if (noneDisabled) {
        statusLine = '🟢 All reactions enabled';
    } else {
        statusLine = `🟡 Some reactions disabled (${prefs.disabled_emojis.length}/${ALL_EMOJI_TITLES.length})`;
    }

    const disabledList = prefs.disabled_emojis.length > 0
        ? prefs.disabled_emojis.map(t => {
            const emoji = titleToEmoji(t);
            return emoji ? `${emoji} ${t}` : t;
        }).join('\n')
        : '_None_';

    const enabledTitles = ALL_EMOJI_TITLES.filter(t => !prefs.disabled_emojis.includes(t));
    const enabledList = enabledTitles.length > 0
        ? enabledTitles.map(t => {
            const emoji = titleToEmoji(t);
            return emoji ? `${emoji} ${t}` : t;
        }).join('\n')
        : '_None_';

    return new EmbedBuilder()
        .setTitle(`${scope === 'user' ? '👤' : '🏠'} Reaction Settings — ${scopeName}`)
        .setDescription(statusLine)
        .addFields(
            { name: '✅ Enabled', value: enabledList, inline: true },
            { name: '❌ Disabled', value: disabledList, inline: true },
        )
        .setColor(allDisabled ? 0xED4245 : noneDisabled ? 0x57F287 : 0xFEE75C);
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
    data: {
        name: 'reactions',
        description: 'Manage gaybot reaction settings.',
        default_member_permissions: null,
        options: [
            // ── /reactions user ───────────────────────────────────────────
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: 'user',
                description: 'Manage your personal reaction preferences.',
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'disable',
                        description: 'Disable a specific reaction or all reactions for yourself.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'reaction',
                                description: 'Reaction to disable, or "All" to disable everything.',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'enable',
                        description: 'Re-enable a specific reaction or all reactions for yourself.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'reaction',
                                description: 'Reaction to re-enable, or "All" to enable everything.',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'status',
                        description: 'View your current reaction preferences.',
                    },
                ],
            },

            // ── /reactions server ─────────────────────────────────────────
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: 'server',
                description: 'Manage server-wide reaction preferences. Requires Manage Server.',
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'disable',
                        description: 'Disable a specific reaction or all reactions server-wide.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'reaction',
                                description: 'Reaction to disable, or "All" to disable everything.',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'enable',
                        description: 'Re-enable a specific reaction or all reactions server-wide.',
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: 'reaction',
                                description: 'Reaction to re-enable, or "All" to enable everything.',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'status',
                        description: 'View the current server reaction preferences.',
                    },
                ],
            },
        ],
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const group   = interaction.options.getSubcommandGroup();
        const sub     = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();

        // Build the candidate list depending on enable vs disable context
        let candidates: string[] = [];

        if (sub === 'disable') {
            // For disable: show "All" + titles not already disabled
            const prefs = group === 'server' && interaction.guildId
                ? getGuildReactionPrefs(interaction.guildId)
                : getUserReactionPrefs(interaction.user.id);

            const notYetDisabled = ALL_EMOJI_TITLES.filter(
                t => !prefs.disabled_emojis.includes(t)
            );
            candidates = notYetDisabled.length > 0 ? ['All', ...notYetDisabled] : [];
        } else if (sub === 'enable') {
            // For enable: show "All" + titles that are currently disabled
            const prefs = group === 'server' && interaction.guildId
                ? getGuildReactionPrefs(interaction.guildId)
                : getUserReactionPrefs(interaction.user.id);

            candidates = prefs.disabled_emojis.length > 0
                ? ['All', ...prefs.disabled_emojis]
                : [];
        }

        const filtered = candidates
            .filter(c => c.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(c => ({ name: c, value: c }));

        await interaction.respond(filtered);
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const group = interaction.options.getSubcommandGroup();
        const sub   = interaction.options.getSubcommand();

        // ── /reactions server — require ManageGuild ───────────────────────
        if (group === 'server') {
            if (!interaction.inGuild()) {
                await interaction.reply({
                    content: '❌ Server reactions can only be managed inside a server.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const member = interaction.guild?.members.cache.get(interaction.user.id)
                ?? await interaction.guild?.members.fetch(interaction.user.id);

            if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({
                    content: '❌ You need the **Manage Server** permission to change server reaction settings.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        // ── /reactions user status ────────────────────────────────────────
        if (group === 'user' && sub === 'status') {
            const prefs = getUserReactionPrefs(interaction.user.id);
            const embed = buildStatusEmbed(prefs, 'user', interaction.user.displayName);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // ── /reactions server status ──────────────────────────────────────
        if (group === 'server' && sub === 'status') {
            const guildId = interaction.guildId!;
            const prefs   = getGuildReactionPrefs(guildId);
            const embed   = buildStatusEmbed(prefs, 'server', interaction.guild?.name ?? guildId);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // ── /reactions user disable / enable ─────────────────────────────
        if (group === 'user') {
            const reaction = interaction.options.getString('reaction', true);
            let prefs: ReactionData;

            if (sub === 'disable') {
                prefs = reaction === 'All'
                    ? disableAllUserReactions(interaction.user.id)
                    : disableUserEmojis(interaction.user.id, [reaction]);

                const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
                const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
                await interaction.reply({
                    content: `✅ ${emoji} ${label} disabled for you.`.trim(),
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                prefs = reaction === 'All'
                    ? enableAllUserReactions(interaction.user.id)
                    : enableUserEmojis(interaction.user.id, [reaction]);

                const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
                const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
                await interaction.reply({
                    content: `✅ ${emoji} ${label} re-enabled for you.`.trim(),
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        // ── /reactions server disable / enable ───────────────────────────
        if (group === 'server') {
            const guildId  = interaction.guildId!;
            const reaction = interaction.options.getString('reaction', true);
            let prefs: ReactionData;

            if (sub === 'disable') {
                prefs = reaction === 'All'
                    ? disableAllGuildReactions(guildId)
                    : disableGuildEmojis(guildId, [reaction]);

                const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
                const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
                await interaction.reply({
                    content: `✅ ${emoji} ${label} disabled server-wide.`.trim(),
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                prefs = reaction === 'All'
                    ? enableAllGuildReactions(guildId)
                    : enableGuildEmojis(guildId, [reaction]);

                const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
                const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
                await interaction.reply({
                    content: `✅ ${emoji} ${label} re-enabled server-wide.`.trim(),
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }
    },
};