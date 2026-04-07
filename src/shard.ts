/*
 * Copyright (c) 2026 Girls Network
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { ShardingManager } from 'discord.js';
import * as path from 'path';
import chalk from 'chalk';
import { log, logError, logBoot, asciiArt } from './utils/logger';
import { startStatusServer } from './utils/statusServer';

const TOKEN = process.env.GAYBOT_TOKEN;

if (!TOKEN) {
    console.error(chalk.redBright('Missing GAYBOT_TOKEN environment variable'));
    process.exit(1);
}

asciiArt();
logBoot();

// We point the manager at the compiled main.js (or main.ts if using ts-node)
const botFile = path.join(__dirname, 'main.js');

const manager = new ShardingManager(botFile, {
    token: TOKEN,
    totalShards: 5,
    respawn: true, // Auto-restart crashed shards
});

// ── Shard lifecycle logging ────────────────────────────────────────────────

manager.on('shardCreate', shard => {
    log(chalk.cyanBright(`[ShardManager] Shard ${shard.id} launched`));

    shard.on('ready', () => {
        log(chalk.greenBright(`[Shard ${shard.id}] Ready`));
    });

    shard.on('disconnect', () => {
        log(chalk.yellowBright(`[Shard ${shard.id}] Disconnected`));
    });

    shard.on('reconnecting', () => {
        log(chalk.yellow(`[Shard ${shard.id}] Reconnecting...`));
    });

    shard.on('death', process => {
        logError(
            new Error(`Shard process exited with code ${process.exitCode}`),
            `Shard ${shard.id}`
        );
    });

    shard.on('error', err => {
        logError(err, `Shard ${shard.id}`);
    });
});

// ── Start the status HTTP server before spawning shards ───────────────────
startStatusServer(manager);

// ── Spawn all shards ──────────────────────────────────────────────────────
manager.spawn({ amount: 'auto', delay: 5500, timeout: 30_000 })
    .then(() => {
        log(chalk.greenBright('[ShardManager] All shards spawned successfully'));
    })
    .catch(err => {
        logError(err, 'ShardManager spawn');
        process.exit(1);
    });