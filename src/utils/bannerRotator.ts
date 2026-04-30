/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Cycles the bot's profile banner through the PNGs in assets/ so the
// profile doesn't get stale. Only runs on shard 0 (see main.ts) because
// the banner is a bot-wide property — running this on every shard would
// just have them all racing to PATCH the same endpoint.
//
// Discord rate-limits banner updates fairly aggressively; 72 minutes
// between rotations is well under the limit and keeps the asset wear
// from being tediously fast-paced.

import { Client } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";
import { log, logError } from "./logger";
import chalk from "chalk";

// ESM doesn't define __dirname like CommonJS does — derive it from
// import.meta.url. This file lives at src/utils/, two levels from the
// project root, so ../../assets points at the right place.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, "../../assets");
const ROTATE_INTERVAL_MS = 72 * 60 * 1000; // 72 minutes — see file-top note

// Module-level state so startBannerRotater() is idempotent-ish: calling
// it twice would just reset the index, not double-schedule rotations.
// (We only ever call it once from main.ts on shard 0, but it's nice
// to fail soft if that ever changes.)
let currentIndex = 0;
let bannerFiles: string[] = [];

// Read assets/ once at startup. The numeric sort matters because the
// files are named 1.png, 2.png, ..., 20.png and a default lexical sort
// would order them 1, 10, 11, ..., 2, 20, 3, which is not what we want.
function loadBannerFiles(): void {
    const files = fs
        .readdirSync(ASSETS_DIR)
        .filter((f) => f.endsWith(".png"))
        .sort((a, b) => {
            // parseInt stops at the first non-digit, so "10.png" → 10.
            return parseInt(a) - parseInt(b);
        });

    if (files.length === 0) {
        // This is fatal for the rotater specifically, but the bot should
        // keep running — startBannerRotater catches and logs.
        throw new Error("No PNG files found in assets/");
    }

    bannerFiles = files;
    log(
        chalk.cyanBright(`Banner rotater loaded ${bannerFiles.length} banners`),
    );
}

// Pushes the next banner up to Discord. We send the PNG inline as a
// base64 data URI because that's what discord.js's setBanner expects.
async function rotateBanner(client: Client): Promise<void> {
    if (bannerFiles.length === 0) return;

    const file = bannerFiles[currentIndex];
    const filePath = path.join(ASSETS_DIR, file);

    try {
        // readFileSync is fine here — this runs once every 72 minutes
        // and the PNGs are small enough that the I/O is negligible.
        const imageData = fs.readFileSync(filePath);
        const base64 = `data:image/png;base64,${imageData.toString("base64")}`;

        // Optional chain on client.user because in theory we could
        // run this before login resolves; in practice main.ts gates
        // this on the 'clientReady' event so it's always defined.
        await client.user?.setBanner(base64);

        log(
            chalk.cyanBright(
                `Banner rotated to ${file} (${currentIndex + 1}/${bannerFiles.length})`,
            ),
        );
        // Wrap around at the end of the list — no need to reload the
        // directory listing, banners don't get added at runtime.
        currentIndex = (currentIndex + 1) % bannerFiles.length;
    } catch (error) {
        // Don't throw — a failed rotation shouldn't kill the interval.
        // We just log and try again next tick.
        logError(error, "BannerRotater");
    }
}

// Public entry point — called from main.ts on shard 0 once we're logged in.
export function startBannerRotater(client: Client): void {
    try {
        loadBannerFiles();
    } catch (error) {
        // Missing assets/ or empty directory — log and bow out. The
        // rest of the bot runs fine without banner rotation.
        logError(error, "BannerRotater");
        return;
    }

    // Fire one rotation immediately so the bot's banner reflects the
    // current rotation state from boot, not 72 minutes later.
    rotateBanner(client);
    setInterval(() => rotateBanner(client), ROTATE_INTERVAL_MS);

    log(chalk.cyanBright(`Banner rotater started (interval: 72 mins)`));
}
