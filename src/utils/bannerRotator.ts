/*
 * Copyright (c) 2026 Girls Network
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Client } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { log, logError } from './logger';
import chalk from 'chalk';

const ASSETS_DIR = path.join(__dirname, '../../assets');
const ROTATE_INTERVAL_MS = 72 * 60 * 1000; // 72 minutes

let currentIndex = 0;
let bannerFiles: string[] = [];

function loadBannerFiles(): void {
    const files = fs.readdirSync(ASSETS_DIR)
        .filter(f => f.endsWith('.png'))
        .sort((a, b) => {
            // Sort numerically (1.png, 2.png ... 20.png)
            return parseInt(a) - parseInt(b);
        });

    if (files.length === 0) {
        throw new Error('No PNG files found in assets/');
    }

    bannerFiles = files;
    log(chalk.cyanBright(`Banner rotater loaded ${bannerFiles.length} banners`));
}

async function rotateBanner(client: Client): Promise<void> {
    if (bannerFiles.length === 0) return;

    const file = bannerFiles[currentIndex];
    const filePath = path.join(ASSETS_DIR, file);

    try {
        const imageData = fs.readFileSync(filePath);
        const base64 = `data:image/png;base64,${imageData.toString('base64')}`;

        await client.user?.setBanner(base64);

        log(chalk.cyanBright(`Banner rotated to ${file} (${currentIndex + 1}/${bannerFiles.length})`));
        currentIndex = (currentIndex + 1) % bannerFiles.length;
    } catch (error) {
        logError(error, 'BannerRotater');
    }
}

export function startBannerRotater(client: Client): void {
    try {
        loadBannerFiles();
    } catch (error) {
        logError(error, 'BannerRotater');
        return;
    }

    // Rotate immediately on start, then on interval
    rotateBanner(client);
    setInterval(() => rotateBanner(client), ROTATE_INTERVAL_MS);

    log(chalk.cyanBright(`Banner rotater started (interval: 72 mins)`));
}