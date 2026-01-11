import * as dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { loadCommands, deployCommands } from './handlers/commandHandler';
import { processReactionQueue } from './utils/reactionSystem';
import { logBoot, log, logError } from './utils/logger';

interface ReactionQueueEntry {
    message: any;
    emoji: string;
}

interface ExtendedClient extends Client {
    commands: Collection<string, any>;
    reactionQueue: ReactionQueueEntry[];
}

// Initialize client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
}) as ExtendedClient;

// Initialize properties
client.commands = new Collection();
client.reactionQueue = [];

// Load events
async function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath).default;

        if (event && event.name && event.execute) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }
    }
    
    log('Loading events');
}

// Set bot presence
client.once('clientReady', () => {
    log(`Logged in as ${client.user?.tag}`);
    client.user?.setActivity('Gayness', { type: ActivityType.Watching });
});

// Start reaction queue processor
setInterval(() => processReactionQueue(client.reactionQueue), 1000);

// Startup sequence
async function start() {
    try {
        logBoot();
        
        await loadCommands(client);
        await loadEvents();
        await deployCommands(client);
        
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        logError(error, 'Startup');
        process.exit(1);
    }
}

start();