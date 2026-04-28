/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// /help — paginated command list. We split pagination across two files:
// this one handles the initial render (page 0), and events/interactionCreate
// handles the prev/next button clicks. The button handler has to live there
// because button presses arrive as Interactions, not slash commands, so
// there's no natural "command module" hook for them.
//
// Reply is ephemeral because a help listing is personal UI — the person
// who ran /help wants to see it, nobody else in the channel needs to.

import {
    CommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from "discord.js";

// Minimal shape of an entry in client.commands — we only touch .data.name
// and .data.description so we don't need the full command-module type here.
interface BotCommand {
    data: any;
    execute: (interaction: CommandInteraction, client: any) => Promise<void>;
}

// Five fits comfortably in a single Discord embed without scrolling. If we
// start running long on descriptions it may be worth dropping this to 4.
// The interactionCreate page handler uses the same constant for the same
// reason — keep them in sync if you ever change it.
const COMMANDS_PER_PAGE = 5;

export default {
    data: {
        name: "help",
        description: "View all available commands and their details.",
    },

    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;

        // Build the full list up-front; pagination happens by slicing it.
        // No caching — this only runs when someone invokes /help, and the
        // command set is small enough that re-building every time costs
        // nothing. The └ box-drawing char is a visual connector so the
        // description reads as hanging off the command name.
        const commandList: string[] = [];

        client.commands.forEach((cmd: BotCommand) => {
            const data = cmd.data;
            commandList.push(`**/${data.name}**\n└ ${data.description}`);
        });

        const totalPages = Math.ceil(commandList.length / COMMANDS_PER_PAGE);
        // Always start at page 0 on first render. Subsequent pages are
        // driven by the button handler in interactionCreate, which encodes
        // the current page into the customId and bumps from there.
        const page = 0;

        // Blurple (0x5865F2) is Discord's own brand colour. Using it here
        // makes /help feel like a "native" listing rather than our themed
        // command output (which leans on pride colours elsewhere).
        const embed = new EmbedBuilder()
            .setTitle("📖 Available Commands")
            .setDescription(
                commandList
                    .slice(
                        page * COMMANDS_PER_PAGE,
                        (page + 1) * COMMANDS_PER_PAGE,
                    )
                    .join("\n\n"),
            )
            .setFooter({
                text: `Page ${page + 1} of ${totalPages}`,
                iconURL:
                    "https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png",
            })
            .setColor(0x5865f2);

        // Prev is always disabled on first render (we're at page 0).
        // Next is disabled only if everything fits on one page, in which
        // case there's nowhere to paginate to and we render the buttons
        // as a no-op row rather than dropping them entirely — it keeps
        // the embed visually consistent across servers of different sizes.
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`help_prev:${page}`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`help_next:${page}`)
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(totalPages <= 1),
        );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    },
};
