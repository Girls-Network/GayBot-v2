/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// /gaycounter — the silliest command in the bot. Returns a "gayness %" for
// a user. Purely a joke; the number is derived deterministically from the
// Discord snowflake so it's stable across calls (you don't get a different
// number every time you run it, which would undercut the gag).
//
// Deterministic-not-random matters here: users will re-run this on
// themselves and on friends, and the joke only lands if the number is
// the same each time. A hash would also work, but sin() is genuinely
// simpler and the "randomness" of the distribution doesn't need to be
// cryptographically anything — we just want it to look scattered.

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
} from "discord.js";

// Hand-picked overrides for the bit. Everyone else rolls on the deterministic
// sin() below. The values have their own jokes baked in (69 for a plural
// system, 420 for lillybanana, 1000 for transbian meaning "over the cap",
// etc.) — when a new regular joins and wants an override, drop them in here.
// Add yourself at your own risk, we don't judge... much.
const gaynessOverrides = new Map<string, number>([
    ["652597508027187240", 1000], // @transbian
    ["1125844710511104030", 69], // @doughmination.system
    ["908055723659898902", 420], // @lillybanana.7z
    ["855122091791089664", 54], // @primrosethelesbianlady
    ["1110542429838397471", 200], // @msmoscar
    ["527709099186716673", 200], // @theawesometaco
]);

// Deterministic pseudo-random gayness from the Discord ID.
//
// Why sin() and not a hash?
//   - sin() is cheap and built-in; no crypto import needed for a joke.
//   - sin(x) oscillates in [-1, 1] regardless of x, so |sin(x)|*100 gives
//     a nicely spread-out number in [0, 100).
//   - We mod the ID by 1000 before feeding it to sin() because snowflakes
//     are 18+ digit numbers, and sin() starts losing meaningful precision
//     on very large doubles. Mod-1000 keeps us well inside the safe range
//     without sacrificing "randomness" of the output.
//
// toFixed(1) then parseFloat rounds to one decimal — "46.3% gay" reads
// funnier than "46.31254718463% gay".
function calculateGayness(userId: string): number {
    // Override table wins. If you're in the list, you get your hand-picked
    // number whether it's in [0, 100) or not (1000 for transbian is a joke
    // about exceeding the cap).
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
        name: "gaycounter",
        description: "Find out how gay a user is!",
        options: [
            {
                type: ApplicationCommandOptionType.User,
                name: "target",
                description: "The user to check.",
                required: false,
            },
        ],
    },
    async execute(interaction: CommandInteraction, _client: any) {
        if (!interaction.isChatInputCommand()) return;
        // Default to self-target if no @user given. Makes "/gaycounter" on
        // its own a quick "what's my number" check — which, yes, people do.
        const targetUser =
            interaction.options.getUser("target") || interaction.user;

        // deferReply because we reply publicly (not ephemeral) — this is a
        // fun bit the channel gets to see. Defer gives us breathing room
        // even though the work is trivial; it also avoids the "thinking..."
        // ghost if something slows us down unexpectedly.
        await interaction.deferReply();

        const gayness = calculateGayness(targetUser.id);

        // Three-tier commentary, chosen by range. The thresholds are
        // gut-feel — <20 gets a "keep shining" (underdog), middle range
        // gets the spectrum-position nudge, and >80 gets the "max gay
        // energy" celebration. Overrides >100 (transbian's 1000) land
        // in the top bucket automatically, which is the intent.
        let message = "";
        if (gayness < 20) {
            message = `**${targetUser.username}** is **${gayness}% gay**! Keep shining! 🌈`;
        } else if (gayness <= 80) {
            message = `**${targetUser.username}** is **${gayness}% gay**! That's a good spectrum position! 😉`;
        } else {
            message = `**${targetUser.username}** is **${gayness}% gay**! Congratulations, that's max gay energy! ✨`;
        }

        // 0x8e44ad is our pride-purple — the same colour /identity uses.
        // Keeps the bot's own output visually consistent across commands.
        const embed = new EmbedBuilder()
            .setTitle("🏳️‍🌈 Gayness Percentage Calculator")
            .setDescription(message)
            .setColor(0x8e44ad)
            .setFooter({
                text: "GayBot v2",
                iconURL:
                    "https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png",
            });

        // editReply because we deferred. No ephemeral flag — this is a
        // public message by design.
        await interaction.editReply({ embeds: [embed] });
    },
};
