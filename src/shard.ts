/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
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

// In prod we're running compiled JS out of dist/ (so __filename ends in .js
// and main.js is sitting next to us). In dev, ts-node is running us straight
// from src/ and our sibling is main.ts instead. Detect which we're in and
// point ShardingManager at the right file.
//
// The execArgv bit matters too: ShardingManager forks child processes for
// each shard, and those children don't inherit our ts-node hook. So in dev
// we have to tell Node to preload ts-node/register in each shard as well,
// otherwise they try to load main.ts as plain JS and explode.
const isTsNode = __filename.endsWith('.ts');
const botFile = path.join(__dirname, isTsNode ? 'main.ts' : 'main.js');

const manager = new ShardingManager(botFile, {
    token: TOKEN,
    totalShards: 5,
    respawn: true, // auto-restart crashed shards so a blip doesn't take us down
    execArgv: isTsNode ? ['-r', 'ts-node/register'] : undefined,
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

    shard.on('death', (proc) => {
    const code = (proc as any).exitCode ?? 'unknown';
    logError(
        new Error(`Shard process exited with code ${code}`),
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