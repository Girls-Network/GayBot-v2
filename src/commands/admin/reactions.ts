/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// /admin reactions — server-side counterpart to /reactions (which is per-user).
// Anything an admin disables here applies to *every* user in the server,
// regardless of their personal prefs. The gate logic in
// utils/reactionPreferences.ts ORs guild + system + user disables together.
//
// Permission gate is ManageGuild. We don't fall back to Administrator because
// ManageGuild is the standard "this person configures the server" perm and
// most servers grant it independently of full admin.

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

// Render the current guild prefs as a status embed. Three colour states so
// admins can tell at a glance what shape they're in:
//   - red    = everything off
//   - green  = everything on
//   - yellow = mixed (and we tell them how many)
//
// Both lists (enabled/disabled) get rendered inline, side-by-side, so the
// admin doesn't have to scroll back and forth comparing counts.
function buildStatusEmbed(prefs: ReactionData, guildName: string): EmbedBuilder {
    const allDisabled  = prefs.disabled_emojis.length === ALL_EMOJI_TITLES.length;
    const noneDisabled = prefs.disabled_emojis.length === 0;

    // Status banner at the top of the embed. Emoji circles rather than just
    // text so it's scannable in a dense channel.
    let statusLine: string;
    if (allDisabled)       statusLine = '🔴 All reactions disabled';
    else if (noneDisabled) statusLine = '🟢 All reactions enabled';
    else                   statusLine = `🟡 Some reactions disabled (${prefs.disabled_emojis.length}/${ALL_EMOJI_TITLES.length})`;

    // Disabled list — show the emoji next to the title so it's recognisable
    // even if the title is something obscure. _None_ italic placeholder when
    // empty so the field doesn't render as a weird gap.
    const disabledList = prefs.disabled_emojis.length > 0
        ? prefs.disabled_emojis.map(t => `${titleToEmoji(t) ?? ''} ${t}`.trim()).join('\n')
        : '_None_';

    // Enabled list = everything in the master config that isn't currently
    // disabled. Same format as the disabled list for visual symmetry.
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
        // Discord-native traffic-light colours: red for danger/blocked,
        // green for go, yellow for mixed.
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

    // Autocomplete on the `reaction` field. We tailor the suggestions to the
    // subcommand the user is typing — there's no point offering "Enable" on
    // a reaction that's already enabled, or "Disable" on one already disabled.
    // The "All" pseudo-option goes at the top when it makes sense (i.e. when
    // there's at least one item that the operation could plausibly affect).
    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        // Belt-and-braces: this command is guild-only at the slash level, but
        // a stray DM context shouldn't crash the autocomplete.
        if (!interaction.guildId) return await interaction.respond([]);

        const sub     = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();
        const prefs   = getGuildReactionPrefs(interaction.guildId);

        let candidates: string[] = [];

        if (sub === 'disable') {
            // Show only currently-enabled emojis as disable candidates.
            // "All" only appears if there's at least one to disable.
            const notYet = ALL_EMOJI_TITLES.filter(t => !prefs.disabled_emojis.includes(t));
            candidates = notYet.length > 0 ? ['All', ...notYet] : [];
        } else if (sub === 'enable') {
            // Mirror image: only currently-disabled emojis.
            candidates = prefs.disabled_emojis.length > 0 ? ['All', ...prefs.disabled_emojis] : [];
        }

        // Discord caps autocomplete results at 25. Substring match is fine
        // for our list size — fewer than 30 emojis total.
        await interaction.respond(
            candidates
                .filter(c => c.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(c => ({ name: c, value: c }))
        );
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        // Guild-only sanity check. Discord's slash command config also gates
        // this, but if someone manages to invoke in a DM via API quirks we
        // bail with a friendly error rather than crashing on guildId access.
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: '❌ Server settings can only be managed inside a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Permission check — try cache first, fall back to a fetch. Cache
        // miss is common for users who haven't been seen since restart.
        const member = interaction.guild?.members.cache.get(interaction.user.id)
            ?? await interaction.guild?.members.fetch(interaction.user.id);

        // ManageGuild is the canonical "this person configures the server"
        // permission. We don't accept mod-tier perms (KickMembers, etc)
        // because reaction prefs are a server-wide config concern.
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
        // Read-only view. No state mutation, just hand back the embed.
        if (sub === 'status') {
            const prefs = getGuildReactionPrefs(guildId);
            const embed = buildStatusEmbed(prefs, interaction.guild?.name ?? guildId);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // Both `disable` and `enable` take the same `reaction` string arg,
        // so we extract it once before the branch.
        const reaction = interaction.options.getString('reaction', true);

        // ── disable ───────────────────────────────────────────────────────
        // "All" is a pseudo-value from autocomplete that means
        // "disable every emoji in the master list". Anything else is a
        // single-title disable.
        if (sub === 'disable') {
            reaction === 'All'
                ? disableAllGuildReactions(guildId)
                : disableGuildEmojis(guildId, [reaction]);

            // Reply text leans on the same emoji+title format as the embed
            // for visual continuity. .trim() catches the leading space when
            // emoji is empty (which happens for "All" or unknown titles).
            const label = reaction === 'All' ? 'All reactions' : `**${reaction}**`;
            const emoji = reaction === 'All' ? '' : (titleToEmoji(reaction) ?? '');
            await interaction.reply({
                content: `✅ ${emoji} ${label} disabled server-wide.`.trim(),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        // Mirror of disable. The early-return chain above means we don't
        // need an else here — if we got past disable, we're in enable.
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