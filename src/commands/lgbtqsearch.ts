import { 
    CommandInteraction, 
    EmbedBuilder,
    ApplicationCommandOptionType,
    GuildMember
} from 'discord.js';

// NOTE: Currently using pronouns.page API
// TODO: Migrate to internal checker in future for more updated and comprehensive definitions
interface ApiTermVersion {
    locale: string;
    term: string;
    definition: string;
    category: string;
}

interface ApiTerm {
    term: string;
    definition: string;
    category: string;
    locale: string;
    versions: ApiTermVersion[];
}

async function searchLgbtqTerm(term: string): Promise<ApiTerm | null> {
    const apiURL = `https://en.pronouns.page/api/terms/search/${encodeURIComponent(term)}`;

    try {
        const response = await fetch(apiURL);
        
        if (!response.ok) {
            return null;
        }

        const data: ApiTerm[] = await response.json() as ApiTerm[];

        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        // Prefer English results
        for (const entry of data) {
            if (entry.locale === 'en') {
                return entry;
            }
            const englishVersion = entry.versions.find(v => v.locale === 'en');
            if (englishVersion) {
                return {
                    ...entry,
                    term: englishVersion.term,
                    definition: englishVersion.definition,
                    category: englishVersion.category,
                } as ApiTerm;
            }
        }

        return null;
    } catch (error) {
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
        const targetMember = interaction.options.getMember('member') as GuildMember | null;

        await interaction.deferReply();

        const termData = await searchLgbtqTerm(searchTerm);

        let content = '';
        let replyEmbed: EmbedBuilder;

        if (termData) {
            // Clean up definition formatting
            const definition = termData.definition
                .replace(/\{#([^{}]+)=([^{}]+)\}/g, '$2')
                .replace(/\{([^{}]+)\}/g, '$1');

            const fullTermDisplay = termData.term.replace(/\|/g, ', ');

            replyEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🏳️‍🌈 Term: **${fullTermDisplay}**`)
                .setDescription(definition)
                .addFields(
                    { name: 'Category', value: termData.category.split(',').map(c => c.trim()).join(', '), inline: true },
                    { name: 'Source', value: 'en.pronouns.page', inline: true }
                )
                .setFooter({ text: `Searched term: ${searchTerm}` });

            if (targetMember) {
                content = `Hey ${targetMember}! Here is the information you requested about **${searchTerm}**.`;
            }
        } else {
            replyEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Term Not Found 🔎')
                .setDescription(`Could not find a definition for **"${searchTerm}"** in the English database. Please try a different spelling or a more general term.`)
                .setFooter({ text: `API Source: en.pronouns.page` });

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