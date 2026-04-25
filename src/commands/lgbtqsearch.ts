/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// /lgbtqsearch — look up an LGBTQIA+ term against our own glossary API.
// The dataset and API both live at github.com/Girls-Network/LGBT-API; the
// bot just renders the response as a pretty embed so people can get
// definitions in-channel without opening a browser.
//
// Optional `member` arg pings someone with the result — useful for
// answering "what's X mean?" without typing the definition yourself.

import {
    CommandInteraction,
    EmbedBuilder,
    ApplicationCommandOptionType,
    GuildMember,
    MessageFlags
} from 'discord.js';

// Narrow response shape — the API returns more fields but these are the
// only two we render. If we ever use more, expand this interface rather
// than reaching for Record<string, any>.
interface ApiResponse {
    content: string;
    type: 'gender' | 'sexuality';
}

// Normalise the user's input so "Lesbians" and "lesbian" hit the same row
// in the dataset. The dataset stores singular lowercase forms, so we
// best-effort strip plurals here rather than polluting the dataset with
// every inflection.
function normalizeTerm(term: string): string {
    let normalized = term.toLowerCase().trim();

    // Plural stripping. Order matters: check `ies` before `es` before `s`
    // so "ladies" → "lady" and not "ladie" or "ladi".
    if (normalized.endsWith('ies')) {
        normalized = normalized.slice(0, -3) + 'y';
    } else if (normalized.endsWith('es')) {
        normalized = normalized.slice(0, -2);
    } else if (normalized.endsWith('s') && normalized.length > 2) {
        // Don't remove 's' from short words (false positives like "gas")
        // or from words that naturally end in 's' and would get mangled —
        // "trans" → "tran" would be terrible. Expand this list when we
        // find new offenders.
        const exceptionsEndingInS = ['trans', 'nonbinary', 'genderless', 'ageless'];
        if (!exceptionsEndingInS.includes(normalized)) {
            normalized = normalized.slice(0, -1);
        }
    }

    return normalized;
}

// Hit the glossary API with the normalised term. Returns null on any
// failure (404, 5xx, network) — the caller just renders a "not found"
// embed in that case, no distinguishing between flavours of failure.
async function searchLgbtqTerm(term: string): Promise<ApiResponse | null> {
    const normalizedTerm = normalizeTerm(term);

    // Our own API — same repo as the dataset at github.com/Girls-Network/LGBT-API.
    // If we ever stand up staging we'll probably want to env-var this, but for
    // now it's a single production endpoint.
    const apiBase = 'https://api.girlsnetwork.dev';
    // encodeURIComponent to keep weird characters from breaking the path —
    // the dataset uses hyphens and alphanumerics but defensive encoding
    // is cheap insurance.
    const apiURL = `${apiBase}/api/${encodeURIComponent(normalizedTerm)}`;

    try {
        const response = await fetch(apiURL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            // 404 = term not in dataset. Common enough case that we log
            // at info level rather than error.
            if (response.status === 404) {
                console.log(`[LGBTQ Search] Term not found (404)`);
                return null;
            }
            // Everything else is an actual error worth logging loudly
            // so we can chase API regressions.
            console.log(`[LGBTQ Search] API error: ${response.status} ${response.statusText}`);
            const errorText = await response.text().catch(() => 'Unable to read error');
            console.log(`[LGBTQ Search] Error response: ${errorText}`);
            return null;
        }
        // We read as text first and parse manually so a mangled JSON
        // response shows up in the catch block rather than as a cryptic
        // response.json() rejection.
        const rawText = await response.text();
        const data: ApiResponse = JSON.parse(rawText) as ApiResponse;

        return data;
    } catch (error) {
        // Network blip, DNS failure, JSON parse error — collapses all of
        // these into "not found" for the user. The log is for us.
        console.error(`[LGBTQ Search] Fetch error:`, error);
        return null;
    }
}

export default {
    data: {
        name: 'lgbtqsearch',
        description: 'Search for definitions of LGBTQIA+ terms',
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: 'term',
                description: 'The term or sexuality to look up (e.g., agender, bi, nonbinary).',
                required: true
            },
            {
                type: ApplicationCommandOptionType.User,
                name: 'member',
                description: 'Optional: A member to ping with the result.',
                required: false
            }
        ],
    },

    async execute(interaction: CommandInteraction, client: any) {
        if (!interaction.isChatInputCommand()) return;

        const searchTerm = interaction.options.getString('term', true);
        // getMember can return APIInteractionGuildMember in DMs or other
        // weird contexts — we cast to GuildMember | null because we only
        // use it for the mention string, which both shapes support.
        const targetMember = interaction.options.getMember('member') as GuildMember | null;

        // deferReply ephemeral because the API call can take a moment and
        // we don't want the "thinking..." indicator sitting publicly. The
        // final reply *will* be public if a target was mentioned; the
        // ephemeral flag here only affects the defer placeholder.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const termData = await searchLgbtqTerm(searchTerm);

        // Build both branches of the reply: content (the optional ping)
        // and embed (the actual definition or not-found message).
        let content = '';
        let replyEmbed: EmbedBuilder;

        if (termData) {
            // "gender" → "Gender", "sexuality" → "Sexuality". Cheap
            // title-case since we only have two possible types.
            const categoryDisplay = termData.type.charAt(0).toUpperCase() + termData.type.slice(1);

            // Blurple (0x5865F2) for success — matches /help's colour and
            // signals "informational" rather than error.
            replyEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🏳️‍🌈 Term: **${searchTerm}**`)
                .setDescription(termData.content)
                .addFields(
                    { name: 'Category', value: categoryDisplay, inline: true },
                    { name: 'Source', value: 'girlsnetwork.dev', inline: true }
                )
                .setFooter({ text: `Searched term: ${searchTerm}` });

            if (targetMember) {
                // Mention-plus-friendly-phrasing so the ping feels like a
                // helpful handoff rather than a drive-by.
                content = `Hey ${targetMember}! Here is the information you requested about **${searchTerm}**.`;
            }
        } else {
            // Red for "didn't work". The "open an issue" nudge is there
            // because term omissions are a real form of feedback we want
            // to see — the dataset grows from community contributions.
            replyEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Term Not Found 🔎')
                .setDescription(`Could not find a definition for **"${searchTerm}"** in the database. Missing information? Open an issue on our [github](https://github.com/Girls-Network/LGBT-API/issues)`)
                .setFooter({ text: 'GayBot v2', iconURL: 'https://cdn.discordapp.com/avatars/1475380726643032064/c86c2351bcea2dabfca02272b0ee2354.png' });

            if (targetMember) {
                content = `${targetMember}, I couldn't find a definition for **${searchTerm}**.`;
            }
        }

        await interaction.editReply({
            content: content,
            embeds: [replyEmbed]
        });
    },
};