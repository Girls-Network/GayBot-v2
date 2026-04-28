/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
} from "discord.js";
import kissGifs from "../../configs/yuri/kiss.json";

// One of three yuri-flavoured commands (kiss/hug/boop). They all share the
// top-level /yuri name, so commandHandler.ts merges them into a single
// Discord-registered command with three subcommands at boot time.
export default {
    // toggle: true means servers and individual users can opt out of being
    // targeted by this. The gate is enforced in events/interactionCreate.ts.
    toggle: true,
    data: {
        name: "yuri",
        description: "Yuri commands 🌸",
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "kiss",
                description: "Posts a random yuri kiss gif! 🌸",
                options: [
                    {
                        // Required because a kiss without a recipient is just
                        // sad. The opt-out check above keys off this option.
                        type: ApplicationCommandOptionType.User,
                        name: "target",
                        description: "The user to kiss.",
                        required: true,
                    },
                ],
            },
        ],
    },

    async execute(
        interaction: CommandInteraction,
        _client: any,
    ): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const targetUser = interaction.options.getUser("target", true);
        // Pick one at random from the curated list in configs/yuri/kiss.json.
        // If you want to add or replace gifs, that's the only file to touch.
        const gif = kissGifs[Math.floor(Math.random() * kissGifs.length)];

        const embed = new EmbedBuilder()
            .setColor(0xff69b4) // hot pink — matches the other yuri commands
            .setImage(gif)
            .setFooter({
                text: "GayBot v2",
                iconURL:
                    "https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png",
            });

        // Public reply (not ephemeral) — the whole point is that everyone
        // in the channel sees it. No flag here, so it defaults to visible.
        await interaction.reply({
            content: `*${interaction.user} kisses ${targetUser}!* 🌸`,
            embeds: [embed],
        });
    },
};
