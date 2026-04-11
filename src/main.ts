/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { loadCommands, deployCommands } from './handlers/commandHandler';
import { processReactionQueue } from './utils/reactionSystem';
import { logBoot, asciiArt, log, logError } from './utils/logger';
import { startBannerRotater } from './utils/bannerRotator';
import chalk from 'chalk';

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

    log(chalk.cyanBright('Loading events'));
}

// Set bot presence
client.once('clientReady', () => {
    const shardId = client.shard?.ids[0] ?? 0;
    log(chalk.greenBright(`[Shard ${shardId}] Logged in as ${client.user?.tag}`));
    client.user?.setActivity('Gayness', { type: ActivityType.Watching });

    // Only rotate banners on shard 0 to avoid redundant API calls
    if (shardId === 0) {
        startBannerRotater(client);
    }
});

// Start reaction queue processor
setInterval(() => processReactionQueue(client.reactionQueue), 1000);

// Startup sequence
async function start() {
    // Only print the boot banner on shard 0 (or when not sharded)
    const shardId = process.env.SHARD_ID ? parseInt(process.env.SHARD_ID) : null;
    if (shardId === null || shardId === 0) {
        asciiArt();
        logBoot();
    }

    await loadCommands(client);
    await loadEvents();

    // Only deploy commands from shard 0 to avoid rate-limit spam across shards
    if (shardId === null || shardId === 0) {
        await deployCommands(client);
    }

    await client.login(process.env.GAYBOT_TOKEN);
}

start();