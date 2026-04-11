/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
    MessageFlags,
} from 'discord.js';
import { getIdentity, setIdentity, clearIdentity, IdentityData } from '../utils/identityManager';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildIdentityEmbed(data: IdentityData, displayName: string, avatarURL: string | null, isSelf: boolean): EmbedBuilder {
    const title = isSelf ? '🏳️‍🌈 Your Identity' : `🏳️‍🌈 ${displayName}'s Identity`;

    const fields: { name: string; value: string; inline: boolean }[] = [];

    if (data.pronouns)  fields.push({ name: 'Pronouns',    value: data.pronouns,   inline: true });
    if (data.gender)    fields.push({ name: 'Gender',       value: data.gender,     inline: true });
    if (data.sexuality) fields.push({ name: 'Sexuality',    value: data.sexuality,  inline: true });
    if (data.romantic)  fields.push({ name: 'Romantic',     value: data.romantic,   inline: true });
    if (data.flag)      fields.push({ name: 'Flag',         value: data.flag,       inline: true });

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x8e44ad)
        .setFooter({ text: `Last updated: ${new Date(data.updated_at).toUTCString()}` });

    if (avatarURL) embed.setThumbnail(avatarURL);
    if (fields.length > 0) embed.addFields(fields);
    if (data.bio) embed.setDescription(data.bio);

    if (fields.length === 0 && !data.bio) {
        embed.setDescription('_No fields set yet._');
    }

    return embed;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
    data: {
        name: 'identity',
        description: 'Manage your LGBTQ+ identity profile.',
        options: [
            // ── /identity set ─────────────────────────────────────────────
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'set',
                description: 'Set or update fields on your identity profile. All fields are optional.',
                options: [
                    { type: ApplicationCommandOptionType.String, name: 'pronouns',   description: 'Your pronouns (e.g. she/her, they/them).',          required: false },
                    { type: ApplicationCommandOptionType.String, name: 'gender',     description: 'Your gender identity (e.g. non-binary, trans woman).', required: false },
                    { type: ApplicationCommandOptionType.String, name: 'sexuality',  description: 'Your sexual orientation (e.g. bisexual, lesbian).',   required: false },
                    { type: ApplicationCommandOptionType.String, name: 'romantic',   description: 'Your romantic orientation (e.g. aromantic).',         required: false },
                    { type: ApplicationCommandOptionType.String, name: 'flag',       description: 'Your pride flag (e.g. trans flag, bi flag).',         required: false },
                    { type: ApplicationCommandOptionType.String, name: 'bio',        description: 'A short bio about yourself.',                         required: false },
                ],
            },

            // ── /identity get ─────────────────────────────────────────────
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'get',
                description: "View another user's identity profile.",
                options: [
                    {
                        type: ApplicationCommandOptionType.User,
                        name: 'user',
                        description: 'The user to look up.',
                        required: true,
                    },
                ],
            },

            // ── /identity me ──────────────────────────────────────────────
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'me',
                description: 'View your own identity profile.',
            },

            // ── /identity clear ───────────────────────────────────────────
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: 'clear',
                description: 'Permanently delete your identity profile and all stored data.',
            },
        ],
    },

    async execute(interaction: CommandInteraction, _client: any): Promise<void> {
        if (!interaction.isChatInputCommand()) return;

        const sub = interaction.options.getSubcommand();

        // ── SET ───────────────────────────────────────────────────────────
        if (sub === 'set') {
            const pronouns   = interaction.options.getString('pronouns')  ?? undefined;
            const gender     = interaction.options.getString('gender')     ?? undefined;
            const sexuality  = interaction.options.getString('sexuality')  ?? undefined;
            const romantic   = interaction.options.getString('romantic')   ?? undefined;
            const flag       = interaction.options.getString('flag')       ?? undefined;
            const bio        = interaction.options.getString('bio')        ?? undefined;

            if (!pronouns && !gender && !sexuality && !romantic && !flag && !bio) {
                await interaction.reply({
                    content: '❌ Please provide at least one field to update.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const updated = setIdentity(interaction.user.id, { pronouns, gender, sexuality, romantic, flag, bio });

            const avatarURL = interaction.user.displayAvatarURL();
            const embed = buildIdentityEmbed(updated, interaction.user.displayName, avatarURL, true);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // ── ME ────────────────────────────────────────────────────────────
        if (sub === 'me') {
            const data = getIdentity(interaction.user.id);

            if (!data) {
                await interaction.reply({
                    content: "You haven't set up an identity profile yet. Use `/identity set` to get started!",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const avatarURL = interaction.user.displayAvatarURL();
            const embed = buildIdentityEmbed(data, interaction.user.displayName, avatarURL, true);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // ── GET ───────────────────────────────────────────────────────────
        if (sub === 'get') {
            const targetUser = interaction.options.getUser('user', true);

            if (targetUser.id === interaction.user.id) {
                await interaction.reply({
                    content: "That's you! Use `/identity me` to view your own profile.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const data = getIdentity(targetUser.id);

            if (!data) {
                await interaction.reply({
                    content: `**${targetUser.displayName}** hasn't set up an identity profile yet.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const avatarURL = targetUser.displayAvatarURL();
            const embed = buildIdentityEmbed(data, targetUser.displayName, avatarURL, false);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // ── CLEAR ─────────────────────────────────────────────────────────
        if (sub === 'clear') {
            const deleted = clearIdentity(interaction.user.id);

            if (!deleted) {
                await interaction.reply({
                    content: "You don't have an identity profile to clear.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await interaction.reply({
                content: '🗑️ Your identity profile and all associated data have been permanently deleted.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};