/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { logError } from "../utils/logger";
import { CommandInteraction, Interaction } from "discord.js";

// Two thin wrappers that get called from the catch blocks in
// events/interactionCreate.ts. They're separate because slash commands
// are always repliable but other interactions (autocomplete, modals
// etc.) sometimes aren't, and we want different generic copy for each.
//
// The pattern in both: log the actual error to disk, then send the user
// a generic apology so they're not staring at "interaction failed" in
// the Discord UI. We never let the reply itself throw — if Discord is
// unhappy with our reply (interaction expired, channel deleted, etc.)
// we just log that secondary failure and move on.

// Called from chat-input command catch blocks. The deferred/replied
// branch matters because Discord rejects .reply() once you've already
// responded — you have to call .editReply() instead.
export async function handleCommandError(
    error: Error | unknown,
    interaction: CommandInteraction,
): Promise<void> {
    logError(error, `Command: ${interaction.commandName}`);

    const errorMessage = "An error occurred while executing this command.";

    try {
        if (interaction.deferred || interaction.replied) {
            // We've already said something to Discord, edit that reply.
            await interaction.editReply({ content: errorMessage });
        } else {
            // First contact — initial reply, ephemeral so we don't
            // dump generic error spam into the channel for everyone.
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    } catch (replyError) {
        // Discord rejected the apology. Nothing else we can do but log it.
        logError(replyError, "Error Handler Reply");
    }
}

// Same shape as above but for the broader Interaction type — buttons,
// select menus, autocompletes, etc. Some of those (autocomplete in
// particular) aren't repliable at all, hence the isRepliable() gate.
export async function handleInteractionError(
    error: Error | unknown,
    interaction: Interaction,
): Promise<void> {
    logError(error, `Interaction: ${interaction.id}`);

    const errorMessage = "An error occurred while processing this interaction.";

    try {
        if (interaction.isRepliable()) {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true,
                });
            }
        }
        // Non-repliable interactions just get the error logged. There's
        // no surface to apologise on, so we silently fall through.
    } catch (replyError) {
        logError(replyError, "Error Handler Reply");
    }
}
