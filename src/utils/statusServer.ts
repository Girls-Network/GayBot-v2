/*
 * Copyright (c) 2026 Girls Network
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { ShardingManager } from 'discord.js';
import { log, logError } from './logger';
import chalk from 'chalk';

const STATUS_PORT = parseInt(process.env.STATUS_PORT ?? '3000', 10);

interface ShardStatus {
    id: number;
    status: 'ready' | 'idle' | 'nearly' | 'disconnected' | 'reconnecting' | 'connecting' | 'unknown';
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

async function collectStats(manager: ShardingManager): Promise<StatusPayload> {
    const shardStatuses: ShardStatus[] = [];

    for (const [id, shard] of manager.shards) {
        let ping = -1;
        let guilds = 0;
        let uptime = 0;
        let status: ShardStatus['status'] = 'unknown';

        try {
            const results = await Promise.race([
                Promise.all([
                    shard.eval((c: any) => c.ws.ping),
                    shard.eval((c: any) => c.guilds.cache.size),
                    shard.eval((c: any) => Math.floor((c.uptime ?? 0) / 1000)),
                    shard.eval((c: any) => c.ws.status),
                ]),
                new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
            ]);

            if (results) {
                const [p, g, u, s] = results as [number, number, number, number];
                ping = p;
                guilds = g;
                uptime = u;
                // discord.js WebSocket status codes: 0=READY, 1=CONNECTING, 2=RECONNECTING, 3=IDLE, 4=NEARLY, 5=DISCONNECTED
                const statusMap: Record<number, ShardStatus['status']> = {
                    0: 'ready',
                    1: 'connecting',
                    2: 'reconnecting',
                    3: 'idle',
                    4: 'nearly',
                    5: 'disconnected',
                };
                status = statusMap[s] ?? 'unknown';
            } else {
                status = 'disconnected';
            }
        } catch {
            status = 'disconnected';
        }

        shardStatuses.push({ id, status, ping, guilds, uptime });
    }

    const totalGuilds = shardStatuses.reduce((acc, s) => acc + s.guilds, 0);
    const pings = shardStatuses.filter(s => s.ping >= 0).map(s => s.ping);
    const averagePing = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : -1;
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
    // Serve the static dashboard HTML
    const htmlPath = path.join(__dirname, '../../status.html');

    const server = http.createServer(async (req, res) => {
        const url = req.url ?? '/';

        // JSON API endpoint
        if (url === '/api/status') {
            try {
                const payload = await collectStats(manager);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                });
                res.end(JSON.stringify(payload));
            } catch (err) {
                logError(err, 'StatusServer /api/status');
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to collect stats' }));
            }
            return;
        }

        // Dashboard HTML
        if (url === '/' || url === '/index.html') {
            if (fs.existsSync(htmlPath)) {
                const html = fs.readFileSync(htmlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            } else {
                res.writeHead(404);
                res.end('Dashboard not found. Place status.html next to package.json.');
            }
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    });

    server.listen(STATUS_PORT, () => {
        log(chalk.cyanBright(`[StatusServer] Running on http://localhost:${STATUS_PORT}`));
    });

    server.on('error', err => logError(err, 'StatusServer'));
}