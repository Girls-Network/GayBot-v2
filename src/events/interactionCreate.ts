/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Central entry point for everything Discord delivers as an Interaction —
// slash commands, autocomplete fills, and button presses all land here.
// We dispatch out to the matching command module's execute/autocomplete
// handler, with a couple of cross-cutting concerns handled inline:
//   - the toggle/opt-out gate (guild + per-user) for `toggle: true` commands
//   - the help-pagination button handler, which lives here because there's
//     no command module that "owns" the buttons after they're posted
//
// Everything that throws gets caught and routed through errorHandler so
// users see a friendly ephemeral instead of an unbounded silence.

import {
    Interaction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    MessageFlags,
} from 'discord.js';
import { handleCommandError, handleInteractionError } from '../handlers/errorHandler';
import { readGuildFile, readUserFile } from '../utils/dataManager';

// Minimal client typing — we only care about the two custom properties we
// stash on the client at boot. Anything else comes from discord.js's own type.
interface ExtendedClient {
    commands: Collection<string, any>;
    toggleableCommands: string[];
}

// Help embed page size. Five-per-page keeps each page under the visible
// area without scrolling, and the bot has well under 50 commands so the
// pager never gets ridiculous.
const COMMANDS_PER_PAGE = 5;

// Reconstruct the dispatch key the loader uses for a given interaction.
// E.g. "/yuri kiss @target" → "yuri kiss". The loader stores commands keyed
// by this string, so we have to build the same string at lookup time.
//
// Try/catch wraps the option getters because discord.js's getSubcommand()
// throws if the slash command has no subcommand at all, rather than
// returning null — easier to swallow than to type-narrow up front.
function getSubcommandKey(interaction: any): string {
    try {
        const group = interaction.options?.getSubcommandGroup(false);
        const sub   = interaction.options?.getSubcommand(false);
        if (group && sub) return `${interaction.commandName} ${group} ${sub}`;
        if (sub)          return `${interaction.commandName} ${sub}`;
    } catch {
        // Top-level command with no subcommand — fall through to the
        // bare command name below.
    }
    return interaction.commandName;
}

export default {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        const client = interaction.client as unknown as ExtendedClient;

        // ── Autocomplete ──────────────────────────────────────────────────
        // Autocomplete events fire on every keystroke in an autocomplete-
        // enabled option, so this path needs to be cheap. We don't run the
        // toggle gate here — autocomplete shouldn't reveal whether a target
        // has opted out, that's a finish-the-command concern.
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command?.autocomplete) return;
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                // Discord will just show "No matches" if we error out;
                // that's fine, but log it so we can chase it down later.
                console.error('Autocomplete error:', error);
            }
            return;
        }

        // ── Slash commands ────────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            // Unknown commands shouldn't normally happen — Discord only
            // delivers commands we registered. If we got here, something's
            // out of sync; bail silently rather than confuse the user.
            if (!command) return;

            // The opt-out gate only applies to things explicitly marked
            // toggle: true (the yuri stuff etc.). Utility commands like
            // /ping or /help should never be silently disabled.
            if (command.toggle) {
                const key = getSubcommandKey(interaction);

                // Guild bans win — if the server has turned this off, no
                // one in it gets to use it, regardless of target.
                if (interaction.guildId) {
                    const guildData = readGuildFile(interaction.guildId);
                    if (guildData.disabled_commands?.includes(key)) {
                        await interaction.reply({
                            content: '❌ This command has been disabled in this server.',
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                }

                // Individual opt-outs. Only matters for commands that
                // aim at a user ('target' option); self-targeting
                // commands don't hit this branch.
                const targetUser = interaction.options.getUser('target');
                if (targetUser) {
                    const targetData = readUserFile(targetUser.id);
                    if (targetData.disabled_commands?.includes(key)) {
                        await interaction.reply({
                            content: `❌ ${targetUser} has disabled this command.`,
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                }
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                await handleCommandError(error, interaction);
            }
        }

        // ── Help pagination buttons ───────────────────────────────────────
        // The /help command posts an embed with prev/next buttons whose
        // customIds encode the *current* page (e.g. "help_next:2" means
        // "you're on page 2, go forward"). We rebuild the embed for the
        // new page on click — much simpler than tracking pagination state
        // server-side, and the embed is small enough that re-rendering
        // every time is fine.
        if (interaction.isButton()) {
            // customId format: "<action>:<currentPage>". Bail out fast for
            // any button that isn't ours — there'll likely be more in future
            // (e.g. confirm dialogs) and we don't want to swallow them.
            const [action, currentPageStr] = interaction.customId.split(':');
            if (!action.startsWith('help_')) return;

            try {
                // Increment/decrement based on the verb. The button-disabled
                // flags below mean we should never see prev at page 0 or
                // next at last page, but the math wouldn't break if we did.
                let page = parseInt(currentPageStr);
                if (action === 'help_next') page++;
                if (action === 'help_prev') page--;

                // Re-derive the command list from the live commands collection.
                // No caching — this only runs on a button click, command set
                // doesn't change at runtime, and the list is small.
                const commandList: string[] = [];
                client.commands.forEach((cmd) => {
                    commandList.push(`**/${cmd.data.name}**\n└ ${cmd.data.description}`);
                });

                const totalPages = Math.ceil(commandList.length / COMMANDS_PER_PAGE);

                // Slice the page out of the full list and build the embed.
                // 0x5865F2 is Discord's blurple — distinguishes /help visually
                // from the green/yellow/red status embeds elsewhere.
                const embed = new EmbedBuilder()
                    .setTitle('📖 Available Commands')
                    .setDescription(commandList.slice(page * COMMANDS_PER_PAGE, (page + 1) * COMMANDS_PER_PAGE).join('\n\n'))
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                    .setColor(0x5865F2);

                // Rebuild the button row. The customId encodes the *new*
                // page so the next click knows where to start. setDisabled
                // greys out the button at the ends so users don't paginate
                // off the edge of the list.
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_prev:${page}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`help_next:${page}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page >= totalPages - 1)
                );

                // .update() edits the existing message in place rather than
                // sending a new one — the buttons "feel" like they're moving
                // the same embed forward/back instead of spamming the channel.
                await interaction.update({ embeds: [embed], components: [row] });
            } catch (error) {
                await handleInteractionError(error, interaction);
            }
        }
    },
};