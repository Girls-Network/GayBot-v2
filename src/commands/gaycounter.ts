/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType
} from 'discord.js';

// Hand-picked overrides for the bit. Everyone else rolls on the deterministic
// sin() below. Add yourself at your own risk, we don't judge... much.
const gaynessOverrides = new Map<string, number>([
    ['652597508027187240', 1000], // @transbian
    ['1125844710511104030', 69], // @doughmination.system
    ['908055723659898902', 420], // @lillybanana.7z
    ['855122091791089664', 54], // @primrosethelesbianlady
    ['1110542429838397471', 200], // @msmoscar
    ['527709099186716673', 200] // @theawesometaco
]);

// Deterministic pseudo-random gayness from the Discord ID. Using sin here
// instead of a hash is intentional: it's cheap, repeatable, and the output
// is nicely distributed in [0, 100). The mod-1000 seeding keeps the input
// small enough that sin doesn't lose precision on huge numbers.
function calculateGayness(userId: string): number {
    if (gaynessOverrides.has(userId)) {
        return gaynessOverrides.get(userId)!;
    }

    const seeding = parseInt(userId) % 1000;
    const decimal = Math.abs(Math.sin(seeding)) * 100;
    const gayness = parseFloat(decimal.toFixed(1));
    return gayness;

}

export default {
    data: {
        name: 'gaycounter',
        description: 'Find out how gay a user is!',
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: 'target',
                description: 'The user to check.',
                required: false
            }
        ],
    },
    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;
        const targetUser = interaction.options.getUser('target') || interaction.user;

        await interaction.deferReply();

        const gayness = calculateGayness(targetUser.id);

        let message = '';
        if (gayness < 20) {
            message = `**${targetUser.username}** is **${gayness}% gay**! Keep shining! 🌈`;
        } else if (gayness <= 80) {
            message = `**${targetUser.username}** is **${gayness}% gay**! That's a good spectrum position! 😉`;
        } else {
            message = `**${targetUser.username}** is **${gayness}% gay**! Congratulations, that's max gay energy! ✨`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏳️‍🌈 Gayness Percentage Calculator')
            .setDescription(message)
            .setColor(0x8e44ad)
            .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });

        await interaction.editReply({ embeds: [embed] });
    },
};
