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
import {
    ALL_EMOJI_TITLES,
    titleToEmoji,
    getUserReactionPrefs,
    disableAllUserReactions,
    enableAllUserReactions,
    disableUserEmojis,
    enableUserEmojis,
    getSystemReactionPrefs,
    disableAllSystemReactions,
    enableAllSystemReactions,
    disableSystemEmojis,
    enableSystemEmojis,
} from '../../utils/reactionPreferences';
import { resolveSystemByDiscordUser } from '../../pk';
import { logError } from '../../utils/logger';

// ─── PK cascade helpers ───────────────────────────────────────────────────────

/**
 * Resolve the invoking user's PK system, if any. Swallows API failures —
 * cascading is best-effort; the user-level opt-out always applies regardless.
 */
async function tryResolveSystem(discordUserId: string): Promise<string | null> {
    try {
        return await resolveSystemByDiscordUser(discordUserId);
    } catch (err) {
        logError(err, 'pk.resolveSystemByDiscordUser');
        return null;
    }
}

/** Union of user + system disabled titles, de-duplicated. */
function mergedDisabled(userId: string, systemId: string | null): string[] {
    const user = getUserReactionPrefs(userId).disabled_emojis;
    if (!systemId) return [...user];
    const system = getSystemReactionPrefs(systemId).disabled_emojis;
    return Array.from(new Set([...user, ...system]));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStatusEmbed(
    disabled: string[],
    displayName: string,
    systemId: string | null,
): EmbedBuilder {
    const allDisabled  = disabled.length === ALL_EMOJI_TITLES.length;
    const noneDisabled = disabled.length === 0;

    let statusLine: string;
    if (allDisabled)       statusLine = '🔴 All reactions disabled';
    else if (noneDisabled) statusLine = '🟢 All reactions enabled';
    else                   statusLine = `🟡 Some reactions disabled (${disabled.length}/${ALL_EMOJI_TITLES.length})`;

    if (systemId) {
        statusLine += `\n🔗 Linked to PluralKit system \`${systemId}\` — prefs apply to every account in the system.`;
    }

    const disabledList = disabled.length > 0
        ? disabled.map(t => `${titleToEmoji(t) ?? ''} ${t}`.trim()).join('\n')
        : '_None_';

    const enabledList = ALL_EMOJI_TITLES
        .filter(t => !disabled.includes(t))
        .map(t => `${titleToEmoji(t) ?? ''} ${t}`.trim())
        .join('\n') || '_None_';

    return new EmbedBuilder()
        .setTitle(`👤 Reaction Preferences — ${displayName}`)
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
        name: 'user',
        description: 'Manage your personal preferences.',
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: 'reactions',
                description: 'Manage which reactions the bot adds to your messages.',
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'disable',
                        description: 'Disable a reaction or all reactions on your messages.',
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
                        description: 'Re-enable a reaction or all reactions on your messages.',
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
                        description: 'View your current reaction preferences.',
                    },
                ],
            },
        ],
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const sub     = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();
        // Autocomplete reflects the effective (user + system) set so plurals
        // see the truth of what's disabled, not just their own file.
        const systemId = await tryResolveSystem(interaction.user.id);
        const disabled = mergedDisabled(interaction.user.id, systemId);

        let candidates: string[] = [];

        if (sub === 'disable') {
            const notYet = ALL_EMOJI_TITLES.filter(t => !disabled.includes(t));
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

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const sub      = interaction.options.getSubcommand();
        const userId   = interaction.user.id;
        const systemId = await tryResolveSystem(userId);

        // ── status ────────────────────────────────────────────────────────
        if (sub === 'status') {
            const disabled = mergedDisabled(userId, systemId);
            const embed = buildStatusEmbed(disabled, interaction.user.displayName, systemId);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const reaction = interaction.options.getString('reaction', true);
        const label    = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
        const emoji    = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');

        // ── disable ───────────────────────────────────────────────────────
        if (sub === 'disable') {
            if (reaction === 'All') {
                disableAllUserReactions(userId);
                if (systemId) disableAllSystemReactions(systemId);
            } else {
                disableUserEmojis(userId, [reaction]);
                if (systemId) disableSystemEmojis(systemId, [reaction]);
            }

            const scopeNote = systemId
                ? ` (applied to your PluralKit system \`${systemId}\` — every account in the system is covered)`
                : '';
            await interaction.reply({
                content: `✅ ${emoji} ${label} disabled on your messages.${scopeNote}`.trim(),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        if (sub === 'enable') {
            if (reaction === 'All') {
                enableAllUserReactions(userId);
                if (systemId) enableAllSystemReactions(systemId);
            } else {
                enableUserEmojis(userId, [reaction]);
                if (systemId) enableSystemEmojis(systemId, [reaction]);
            }

            const scopeNote = systemId
                ? ` (applied to your PluralKit system \`${systemId}\` — every account in the system is covered)`
                : '';
            await interaction.reply({
                content: `✅ ${emoji} ${label} re-enabled on your messages.${scopeNote}`.trim(),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};