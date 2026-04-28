/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// /user commands — per-user opt-out for being targeted by others' commands.
// Specifically the "interaction" commands like /yuri kiss @other-user — if
// you don't want random people kissing you, you set yourself off the list
// here and the kiss command refuses to fire on you.
//
// The list of "toggleable" commands is built up at startup by the command
// loader (see handlers/commandHandler.ts) and stashed on the client for
// us to pull from. We don't enumerate it here — that'd be duplication and
// would drift the moment someone added a new yuri/* subcommand.
//
// Storage lives under data/users/{id}.json in the `disabled_commands` slot.

import {
    CommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
    MessageFlags,
} from "discord.js";
import { readUserFile, writeUserFile } from "../../utils/dataManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Read the list of dispatch keys (e.g. "yuri kiss") this user has opted out
// of. Defaults to empty array — we never want callers to deal with undefined.
function getUserDisabledCommands(userId: string): string[] {
    return readUserFile(userId).disabled_commands ?? [];
}

// Whole-list replace. Same read-merge-write dance as the reaction prefs:
// the disabled_commands slot lives next to identity/reactions and we don't
// want to clobber siblings.
function setUserDisabledCommands(userId: string, list: string[]): void {
    const file = readUserFile(userId);
    writeUserFile(userId, { ...file, disabled_commands: list });
}

// Render the user's current opt-outs as an embed. Same three-state colour
// scheme as /admin reactions for visual consistency — red/green/yellow tells
// you at a glance what shape your prefs are in.
function buildStatusEmbed(
    userId: string,
    displayName: string,
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

    // Backticks render as inline code in Discord, which makes command names
    // visually distinct from regular text. _None_ italic placeholder when
    // the field would otherwise be empty.
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
        .setTitle(`👤 Command Preferences — ${displayName}`)
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
        name: "user",
        description: "Manage your personal preferences.",
        options: [
            {
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: "commands",
                description: "Manage which commands others can use on you.",
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: "disable",
                        description:
                            "Stop others from targeting you with a command.",
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
                        description:
                            "Allow others to target you with a command again.",
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
                        description: "View your current command preferences.",
                    },
                ],
            },
        ],
    },

    // Autocomplete on the `command` field. Same trick as /admin reactions:
    // tailor the list to the verb. Disable shows things you haven't disabled
    // yet, enable shows things you have. "All" prepends when relevant.
    //
    // toggleableCommands is the list the command loader builds at boot —
    // every dispatch key whose handler opts into the toggle system. We cast
    // the client as `any` because we're reaching for a custom property
    // that isn't part of the discord.js Client type.
    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const client = interaction.client as any;
        const all: string[] = client.toggleableCommands ?? [];
        const sub = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused().toLowerCase();
        const disabled = getUserDisabledCommands(interaction.user.id);

        let candidates: string[] = [];

        if (sub === "disable") {
            // Only show commands the user hasn't already disabled.
            const notYet = all.filter((c) => !disabled.includes(c));
            candidates = notYet.length > 0 ? ["All", ...notYet] : [];
        } else if (sub === "enable") {
            // Only show ones currently disabled — nothing to enable otherwise.
            candidates = disabled.length > 0 ? ["All", ...disabled] : [];
        }

        // Discord's 25-result autocomplete cap. Substring match on lowercase
        // is the right balance for our small command list.
        await interaction.respond(
            candidates
                .filter((c) => c.toLowerCase().includes(focused))
                .slice(0, 25)
                .map((c) => ({ name: c, value: c })),
        );
    },

    async execute(interaction: CommandInteraction, client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const sub = interaction.options.getSubcommand();
        const all: string[] = client.toggleableCommands ?? [];

        // ── status ────────────────────────────────────────────────────────
        // Read-only view. Renders the embed with current state and bails.
        if (sub === "status") {
            const disabled = getUserDisabledCommands(interaction.user.id);
            const embed = buildStatusEmbed(
                interaction.user.id,
                interaction.user.displayName,
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
        const disabled = getUserDisabledCommands(interaction.user.id);

        // ── disable ───────────────────────────────────────────────────────
        // "All" replaces the list with the master set; single-command disable
        // appends and dedupes via Set so re-disabling is harmless.
        if (sub === "disable") {
            const newList =
                command === "All"
                    ? [...all]
                    : Array.from(new Set([...disabled, command]));

            setUserDisabledCommands(interaction.user.id, newList);

            // Pluralisation hack: "them" if it's a bulk action, "it" if a
            // single command. Cleaner than templating the noun separately.
            const label = command === "All" ? "All commands" : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} disabled — others can no longer use ${command === "All" ? "them" : "it"} on you.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── enable ────────────────────────────────────────────────────────
        // Mirror of disable. "All" empties the list (everything re-enabled);
        // single-command enable filters that name out.
        if (sub === "enable") {
            const newList =
                command === "All" ? [] : disabled.filter((c) => c !== command);

            setUserDisabledCommands(interaction.user.id, newList);

            const label = command === "All" ? "All commands" : `\`${command}\``;
            await interaction.reply({
                content: `✅ ${label} re-enabled — others can use ${command === "All" ? "them" : "it"} on you again.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
