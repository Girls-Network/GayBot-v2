/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { CommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";

// Bundled support / community links. Update the strings inline here when
// any of those URLs move — there's no config file for these on purpose,
// they change rarely enough that a code change is fine.
export default {
    data: {
        name: "support",
        description: "Get the support links",
    },

    async execute(interaction: CommandInteraction, _client: any) {
        if (!interaction.isChatInputCommand()) return;

        // Ephemeral so the links don't clutter the channel for everyone.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Placeholder text while the embed builds. Mostly cosmetic — the
        // embed assembly below is synchronous, so this is a holdover from
        // when we did extra fetching here. Harmless to keep.
        await interaction.editReply({ content: "Please wait..." });

        const embed = new EmbedBuilder()
            .setTitle("🎗️ Support Links")
            .setDescription(
                // The leading whitespace on the second/third lines is a
                // template-literal indentation artefact — it renders fine
                // in Discord embeds because they collapse leading spaces.
                `**Support Server:**https://discord.gg/AVemTzVRza
                \n**Source Code:** https://github.com/Girls-Network/GayBot-v2
                \n**Bot Status:** https://status.girlsnetwork.dev`,
            )
            .setColor(0x2ecc71)
            .setFooter({
                text: "GayBot v2",
                iconURL:
                    "https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png",
            })
            .setThumbnail(
                "https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png",
            );

        // Swap the placeholder for the embed; clear content explicitly.
        await interaction.editReply({ content: "", embeds: [embed] });
    },
};
