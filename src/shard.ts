/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Top-level entry point. This file owns the ShardingManager and the bot
// process tree — main.ts is what each individual shard runs. npm start
// boots shard.ts, shard.ts spawns N main.ts children, each child connects
// to Discord as one shard.
//
// We also start the HTTP status server here (not in main.ts) because that
// server wants a manager-level view — it aggregates status from all shards,
// and the manager is the only place with visibility into all of them.

import { ShardingManager } from "discord.js";
import * as path from "path";
import chalk from "chalk";
import { log, logError, logBoot, asciiArt } from "./utils/logger";
import { startStatusServer } from "./utils/statusServer";

const TOKEN = process.env.GAYBOT_TOKEN;

// Fail fast if the token's missing. We check here rather than in main.ts
// because a missing token would mean every shard fails identically, and
// that's much noisier than one clean error at the top. console.error
// (not our logger) is deliberate — if this fires we haven't finished
// booting enough to guarantee the logger works.
if (!TOKEN) {
    console.error(chalk.redBright("Missing GAYBOT_TOKEN environment variable"));
    process.exit(1);
}

// Banner + boot log. Cosmetic, but the ASCII art makes it obvious at a
// glance which bot this log belongs to when you have several terminal
// tabs open. logBoot also stamps the version and environment, which is
// useful when grepping old logs.
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
const isTsNode = __filename.endsWith(".ts");
const botFile = path.join(__dirname, isTsNode ? "main.ts" : "main.js");

const manager = new ShardingManager(botFile, {
    token: TOKEN,
    // totalShards: 5 is our current guild count comfortably — Discord
    // recommends ~1 shard per 1000 guilds and we're nowhere near that,
    // but 5 gives us headroom and distributes the gateway connections
    // so a single-shard hiccup doesn't pause the whole bot.
    totalShards: 5,
    // Auto-restart crashed shards. A transient websocket fault or an
    // uncaught exception shouldn't take the bot offline — the shard
    // pops back and picks up where it left off. We log the death
    // event below so we can see if this ever kicks in.
    respawn: true,
    // See the isTsNode note above — child processes need ts-node
    // preloaded in dev, otherwise they try to execute main.ts as JS.
    execArgv: isTsNode ? ["-r", "ts-node/register"] : undefined,
});

// ── Shard lifecycle logging ────────────────────────────────────────────────
//
// We subscribe to every shard's lifecycle events so the manager log tells
// a coherent story: which shards launched, which are ready, and — more
// importantly — which died or reconnected. Without this you just see a
// silent window of nothing, then "something broke" from afar.

manager.on("shardCreate", (shard) => {
    log(chalk.cyanBright(`[ShardManager] Shard ${shard.id} launched`));

    // "Ready" is the big milestone — the shard has finished its guild
    // member chunking and is actually receiving events. Until this
    // fires, the shard can technically accept commands but may not
    // have up-to-date state.
    shard.on("ready", () => {
        log(chalk.greenBright(`[Shard ${shard.id}] Ready`));
    });

    // Disconnect = transient websocket drop. Not necessarily bad; the
    // shard will usually reconnect on its own. Yellow because it's
    // worth noticing but not a five-alarm fire.
    shard.on("disconnect", () => {
        log(chalk.yellowBright(`[Shard ${shard.id}] Disconnected`));
    });

    shard.on("reconnecting", () => {
        log(chalk.yellow(`[Shard ${shard.id}] Reconnecting...`));
    });

    // Death = the whole child process exited. This should be rare and
    // is usually a sign of an OOM or a serious bug. respawn: true above
    // means the manager will bring it back automatically, but we still
    // want a loud log entry so it doesn't slip past unnoticed.
    shard.on("death", (proc) => {
        const code = (proc as any).exitCode ?? "unknown";
        logError(
            new Error(`Shard process exited with code ${code}`),
            `Shard ${shard.id}`,
        );
    });

    shard.on("error", (err) => {
        logError(err, `Shard ${shard.id}`);
    });
});

// ── Start the status HTTP server before spawning shards ───────────────────
// Order matters slightly: we bring up the status server first so if the
// spawn step hangs, the health endpoint is at least reachable and we can
// tell it's the spawn that's stuck rather than the whole process.
startStatusServer(manager);

// ── Spawn all shards ──────────────────────────────────────────────────────
// amount: 'auto' honours the totalShards: 5 set on the manager.
// delay: 5500 is the 5.5s throttle Discord asks for between shard gateway
// connects, to avoid slamming the rate limit. timeout: 30s is how long we
// give each shard to reach 'ready' before we consider the spawn failed —
// 30s is comfortably more than a healthy startup but not so long that a
// wedged shard holds up the whole boot forever.
manager
    .spawn({ amount: "auto", delay: 5500, timeout: 30_000 })
    .then(() => {
        log(
            chalk.greenBright("[ShardManager] All shards spawned successfully"),
        );
    })
    .catch((err) => {
        // Fatal — if spawn() itself rejects, nothing is going to come up
        // on its own. Log and exit so the supervisor (systemd / pm2 /
        // whatever) can restart us with a clean slate.
        logError(err, "ShardManager spawn");
        process.exit(1);
    });
