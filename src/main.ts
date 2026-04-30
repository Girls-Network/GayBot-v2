/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import {
    Client,
    GatewayIntentBits,
    Collection,
    ActivityType,
} from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCommands, deployCommands } from "./handlers/commandHandler";
import { processReactionQueue } from "./utils/reactionSystem";
import { logBoot, asciiArt, log } from "./utils/logger";
import { startBannerRotater } from "./utils/bannerRotator";
import chalk from "chalk";
import { ExtendedClient } from "./utils/ExtendedClient";

// ESM doesn't define __dirname like CommonJS does. Derive it from
// import.meta.url so the rest of the file keeps working.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal intent set: we only need to see guild messages and their content
// to do the reaction matching. If we ever need DMs or member events, revisit.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
}) as ExtendedClient;

// Attach the per-shard bits we carry around on the client. The reaction
// queue in particular has to live somewhere shared so messageCreate can
// push to it and the interval below can drain it.
client.commands = new Collection();
client.reactionQueue = [];
client.toggleableCommands = [];

// Auto-discover every file in events/ and wire it up. Each event module
// exports { name, execute, once? } — the once flag is used for one-shot
// hooks like 'clientReady'.
async function loadEvents() {
    const eventsPath = path.join(__dirname, "events");
    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        // Dynamic import is intentional: we're walking disk to discover event
        // modules. ESM's import() needs a file:// URL for absolute paths.
        const event = (await import(pathToFileURL(filePath).href)).default;

        if (event && event.name && event.execute) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }
    }

    log(chalk.cyanBright("Loading events"));
}

client.once("clientReady", () => {
    const shardId = client.shard?.ids[0] ?? 0;
    log(
        chalk.greenBright(
            `[Shard ${shardId}] Logged in as ${client.user?.tag}`,
        ),
    );
    client.user?.setActivity("Gayness", { type: ActivityType.Watching });

    // Banners are a bot-wide thing, not per-shard. Running the rotater on
    // every shard would just hammer Discord with identical PATCH calls.
    if (shardId === 0) {
        startBannerRotater(client);
    }
});

// Drain the reaction queue once a second. The 1s cadence is deliberately
// slack — Discord's reaction endpoint is rate limited and we'd rather batch
// up a backlog than trickle at the maximum rate and risk 429s.
setInterval(() => processReactionQueue(client.reactionQueue), 1000);

async function start() {
    // Pretty banner + boot log only once, not five times over. If we're
    // unsharded SHARD_ID is unset, which we also treat as "go ahead".
    const shardId = process.env.SHARD_ID
        ? parseInt(process.env.SHARD_ID)
        : null;
    if (shardId === null || shardId === 0) {
        asciiArt();
        logBoot();
    }

    await loadCommands(client);
    await loadEvents();

    // Same reasoning as banners: command deployment is global, shard 0 only.
    // Otherwise every shard races to PUT the same command list and we eat
    // five times the rate limit budget for no gain.
    if (shardId === null || shardId === 0) {
        await deployCommands(client);
    }

    await client.login(process.env.GAYBOT_TOKEN);
}

start();
