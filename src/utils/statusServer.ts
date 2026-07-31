/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";
import { ShardingManager } from "discord.js";
import { log, logError } from "./logger";
import chalk from "chalk";

// ESM doesn't define __dirname like CommonJS does — derive it from
// import.meta.url so the status.html lookup below keeps working.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATUS_PORT = "5050";

interface ShardStatus {
    id: number;
    status:
        | "ready"
        | "idle"
        | "nearly"
        | "disconnected"
        | "reconnecting"
        | "connecting"
        | "unknown";
    ping: number;
    guilds: number;
    uptime: number; // seconds
}

interface StatusPayload {
    shards: ShardStatus[];
    totalShards: number;
    totalGuilds: number;
    averagePing: number;
    startedAt: string;
    uptime: number; // seconds
}

const startedAt = new Date();

interface StatsTotals {
    users: number; // unique users the bot has cached, deduped across shards
    guilds: number;
    user_installs: number; // Discord's approximate user-install count
}

// Totals for /api/stats — the numbers a consumer wants without leaning on
// Discord's own figures.
//
// users: we don't have the GuildMembers intent, so we can't enumerate every
//   member of every guild. The best available "unique users" is the union of
//   each shard's user cache (users the bot has actually seen), deduped by ID
//   across shards. We pull IDs per shard and union them here so a user in
//   several mutual guilds is counted once.
// user_installs: read from the application object (approximateUserInstallCount).
//   It's a global value, so one reachable shard is enough.
async function collectTotals(manager: ShardingManager): Promise<StatsTotals> {
    const userIds = new Set<string>();
    let guilds = 0;
    let userInstalls = 0;
    let haveInstalls = false;

    for (const [, shard] of manager.shards) {
        try {
            const results = await Promise.race([
                Promise.all([
                    shard.eval((c: any) => c.guilds.cache.size),
                    shard.eval((c: any) => [...c.users.cache.keys()]),
                    // Global figure — only fetch it until we get one answer.
                    haveInstalls
                        ? Promise.resolve(0)
                        : shard.eval(async (c: any) => {
                              const app = await c.application.fetch();
                              return app.approximateUserInstallCount ?? 0;
                          }),
                ]),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 2000),
                ),
            ]);

            if (results) {
                const [g, ids, installs] = results as [number, string[], number];
                guilds += g;
                for (const id of ids) userIds.add(id);
                if (!haveInstalls && installs > 0) {
                    userInstalls = installs;
                    haveInstalls = true;
                }
            }
        } catch {
            // A dead/unreachable shard contributes nothing rather than
            // failing the whole request.
        }
    }

    return {
        users: userIds.size,
        guilds,
        user_installs: userInstalls,
    };
}

async function collectStats(manager: ShardingManager): Promise<StatusPayload> {
    const shardStatuses: ShardStatus[] = [];

    for (const [id, shard] of manager.shards) {
        let ping = -1;
        let guilds = 0;
        let uptime = 0;
        let status: ShardStatus["status"] = "unknown";

        try {
            const results = await Promise.race([
                Promise.all([
                    shard.eval((c: any) => c.ws.ping),
                    shard.eval((c: any) => c.guilds.cache.size),
                    shard.eval((c: any) => Math.floor((c.uptime ?? 0) / 1000)),
                    shard.eval((c: any) => c.ws.status),
                ]),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 2000),
                ),
            ]);

            if (results) {
                const [p, g, u, s] = results as [
                    number,
                    number,
                    number,
                    number,
                ];
                ping = p;
                guilds = g;
                uptime = u;
                // discord.js WebSocket status codes: 0=READY, 1=CONNECTING, 2=RECONNECTING, 3=IDLE, 4=NEARLY, 5=DISCONNECTED
                const statusMap: Record<number, ShardStatus["status"]> = {
                    0: "ready",
                    1: "connecting",
                    2: "reconnecting",
                    3: "idle",
                    4: "nearly",
                    5: "disconnected",
                };
                status = statusMap[s] ?? "unknown";
            } else {
                status = "disconnected";
            }
        } catch {
            status = "disconnected";
        }

        shardStatuses.push({ id, status, ping, guilds, uptime });
    }

    const totalGuilds = shardStatuses.reduce((acc, s) => acc + s.guilds, 0);
    const pings = shardStatuses.filter((s) => s.ping >= 0).map((s) => s.ping);
    const averagePing = pings.length
        ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
        : -1;
    const uptime = Math.floor((Date.now() - startedAt.getTime()) / 1000);

    return {
        shards: shardStatuses,
        totalShards: manager.totalShards as number,
        totalGuilds,
        averagePing,
        startedAt: startedAt.toISOString(),
        uptime,
    };
}

export function startStatusServer(manager: ShardingManager): void {
    // status.html lives at the project root, not inside src/. From dist/utils/
    // that's two directories up; ts-node's src/utils/ ends up at the same
    // relative place because we're one level deeper than dist/.
    const htmlPath = path.join(__dirname, "../../status.html");

    const server = http.createServer(async (req, res) => {
        const url = req.url ?? "/";

        // /api/status — machine-readable. CORS is wide open on purpose so
        // the dashboard HTML can be hosted anywhere and still poll us.
        if (url === "/api/status") {
            try {
                const payload = await collectStats(manager);
                res.writeHead(200, {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                });
                res.end(JSON.stringify(payload));
            } catch (err) {
                logError(err, "StatusServer /api/status");
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to collect stats" }));
            }
            return;
        }

        // /api/stats — just the live user + guild totals, so consumers
        // don't have to lean on Discord's own numbers. CORS wide open to
        // match /api/status.
        if (url === "/api/stats") {
            try {
                const payload = await collectTotals(manager);
                res.writeHead(200, {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                });
                res.end(JSON.stringify(payload));
            } catch (err) {
                logError(err, "StatusServer /api/stats");
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to collect stats" }));
            }
            return;
        }

        // / — human-facing dashboard page.
        if (url === "/" || url === "/index.html") {
            if (fs.existsSync(htmlPath)) {
                const html = fs.readFileSync(htmlPath, "utf-8");
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(html);
            } else {
                res.writeHead(404);
                res.end(
                    "Dashboard not found. Place status.html next to package.json.",
                );
            }
            return;
        }

        res.writeHead(404);
        res.end("Not Found");
    });

    server.listen(STATUS_PORT, () => {
        log(
            chalk.cyanBright(
                `[StatusServer] Running on http://localhost:${STATUS_PORT}`,
            ),
        );
    });

    server.on("error", (err) => logError(err, "StatusServer"));
}
