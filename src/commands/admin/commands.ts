/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// /admin commands — server-wide command disable. Twin of /user commands but
// scoped to the whole guild. Admin bans here override individual user opt-ins:
// if the server disables /yuri kiss, it doesn't matter that a user left it
// enabled on their own profile, nobody in the server gets to run it.
//
// The actual gate lives in events/interactionCreate.ts — we just persist
// the opt-out list here and the event handler checks it before dispatching.

import {
    CommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    MessageFlags,
} from "discord.js";
import { readGuildFile, writeGuildFile } from "../../utils/dataManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Guild-scoped read/write helpers — parallel to the user versions in
// /user commands. Both hit dataManager but against different files
// (guilds/{id}.json instead of users/{id}.json).
function getGuildDisabledCommands(guildId: string): string[] {
    return readGuildFile(guildId).disabled_commands ?? [];
}

// Whole-list replace, read-merge-write to keep the `reactions` slot intact.
function setGuildDisabledCommands(guildId: string, list: string[]): void {
    const file = readGuildFile(guildId);
    writeGuildFile(guildId, { ...file, disabled_commands: list });
}

// Status embed for the server. Same three-state colour scheme as the user
// version for visual consistency: red/green/yellow.
function buildStatusEmbed(
    guildName: string,
    disabled: string[],
    all: string[],
): EmbedBuilder {
    const noneDisabled = disabled.length === 0;
    const allDisabled = disabled.length === all.length;

    let statusLine: string;
    if (allDisabled) statusLine = "🔴 All toggleable commands disabled";
    else if (noneDisabled) statusLine = "🟢 All toggleable commands enabled";
    else
        statusLine = `🟡 Some commands disabled (${disabled.length}/${all.length})`;

    // Backticks render commands as inline code in Discord so they stand
    // out from prose. _None_ placeholder keeps the field from rendering
    // as an empty gap when there's nothing in the list.
    const disabledList =
        disabled.length > 0
            ? disabled.map((c) => `\`${c}\``).join("\n")
            : "_None_";
    const enabledList =
        all
            .filter((c) => !disabled.includes(c))
            .map((c) => `\`${c}\``)
            .join("\n") || "_None_";

    return new EmbedBuilder()
        .setTitle(`🏠 Server Command Settings — ${guildName}`)
        .setDescription(statusLine)
        .addFields(
            { name: "✅ Enabled", value: enabledList, inline: true },
            { name: "❌ Disabled", value: disabledList, inline: true },
        )
        .setColor(allDisabled ? 0xed4245 : noneDisabled ? 0x57f287 : 0xfee75c)
        .setFooter({
            text: "GayBot v2",
            iconURL:
                "https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png",
        });
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
    data: {
        name: "admin",
        description: "Server administration settings.",
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: "commands",
                description:
                    "Manage which commands are available in this server.",
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "disable",
                        description: "Disable a command server-wide.",
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: "command",
                                description: 'Command to disable, or "All".',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "enable",
                        description: "Re-enable a command server-wide.",
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: "command",
                                description: 'Command to re-enable, or "All".',
                                required: true,
                                autocomplete: true,
                            },
                        ],
                    },
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "status",
                        description:
                            "View the current server command settings.",
                    },
                ],
            },
        ],
    },

    // Autocomplete — same verb-tailored list pattern as /admin reactions
    // and /user commands. Show enables for currently-disabled, disables
    // for currently-enabled. "All" prepends when it has a reason to.
    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        // Belt-and-braces DM guard, even though the command is guild-only.
        if (!interaction.guildId) return await interaction.respond([]);

        const client = interaction.client as any;
        // Master list of toggleable commands comes from the loader; this
        // is the set we can meaningfully enable/disable at the guild level.
        const all: string[] = client.toggleableCommands ?? [];
        const sub = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();
        const disabled = getGuildDisabledCommands(interaction.guildId);

        let candidates: string[] = [];

        if (sub === "disable") {
            // Only commands that aren't already disabled.
            const notYet = all.filter((c) => !disabled.includes(c));
            candidates = notYet.length > 0 ? ["All", ...notYet] : [];
        } else if (sub === "enable") {
            // Only commands currently disabled — nothing to enable otherwise.
            candidates = disabled.length > 0 ? ["All", ...disabled] : [];
        }

        // 25 is Discord's autocomplete cap. Substring match on lowercase
        // is plenty for our command count.
        await interaction.respond(
            candidates
                .filter((c) => c.toLowerCase().includes(focused))
                .slice(0, 25)
                .map((c) => ({ name: c, value: c })),
        );
    },

    async execute(interaction: CommandInteraction, client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        // DMs don't have server settings to manage, so bail early.
        if (!interaction.inGuild()) {
            await interaction.reply({
                content:
                    "❌ Server settings can only be managed inside a server.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // Gate on ManageGuild. Cache lookup first so we don't slam the
        // REST API for staff who've already interacted this session.
        const member =
            interaction.guild?.members.cache.get(interaction.user.id) ??
            (await interaction.guild?.members.fetch(interaction.user.id));

        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({
                content:
                    "❌ You need the **Manage Server** permission to change server settings.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const guildId = interaction.guildId!;
        const sub = interaction.options.getSubcommand();
        const all: string[] = client.toggleableCommands ?? [];

        // ── status ────────────────────────────────────────────────────────
        // Read-only view. Falls back to guildId as the title if the guild
        // object doesn't have a cached name (rare, but can happen right
        // after join before the guild create event lands).
        if (sub === "status") {
            const disabled = getGuildDisabledCommands(guildId);
            const embed = buildStatusEmbed(
                interaction.guild?.name ?? guildId,
                disabled,
                all,
            );
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const command = interaction.options.getString("command", true);
        const disabled = getGuildDisabledCommands(guildId);

        // ── disable ───────────────────────────────────────────────────────
        // "All" replaces the list wholesale with the master toggleable set;
        // single-command disable appends via Set so re-disabling is a no-op.
        if (sub === "disable") {
            const newList =
                command === "All"
                    ? [...all]
                    : Array.from(new Set([...disabled, command]));

            setGuildDisabledCommands(guildId, newList);

            const label = command === "All" ? "All commands" : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} disabled server-wide.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        // Mirror of disable. "All" empties the list; single-command enable
        // filters that name out.
        if (sub === "enable") {
            const newList =
                command === "All" ? [] : disabled.filter((c) => c !== command);

            setGuildDisabledCommands(guildId, newList);

            const label = command === "All" ? "All commands" : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} re-enabled server-wide.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
