/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { VoiceStateEditOptions } from 'discord.js';

const LOG_DIR = path.join(process.cwd(), '.logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getTimestamp(): string {
    return new Date().toISOString();
}

export function log(message: string): void {
    const timestamp = getTimestamp();
    const formatted = chalk.grey(`[${timestamp}]`);
    console.log(`${formatted} ${message}`);
}

export function logError(error: Error | unknown, context?: string): void {
    const timestamp = getTimestamp();
    const formatted = chalk.grey(`[${timestamp}]`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';

    const logContent = `${formatted} ERROR${context ? ` (${context})` : ''}: ${errorMessage}\n${stack}\n\n`;

    // Write to error log file
    const filename = `error-${new Date().toISOString().split('T')[0]}.log`;
    fs.appendFileSync(path.join(LOG_DIR, filename), logContent);

    console.error(chalk.redBright(`There was an error, see: ${filename}`))
}

export function asciiArt(): void {
    const lines = [
        "                                             .-'''-.                                                           ",
        "                                            '   _    \\                                     .-''-.              ",
        "                                 /|       /   / `.   \\                 .----.     .----..' .-.  )             ",
        "  .--./)          .-.          .-||      .   |     \\  '                  \\    \\   /    // .'  / /              ",
        " /.''\\\\            \\ \\        / /||      |   '      |  '  .|              '   '. /'   /(_/   / /               ",
        "| |  | |      __    \\ \\      / / ||  __  \\    \\     / / .' |_             |    |'    /      / /                ",
        " \\`-' /    .:--.'.   \\ \\    / /  ||/'__ '.`.   ` ..' /.'     |            |    ||    |     / /                 ",
        " /(\"'`    / |   \\ |   \\ \\  / /   |:/`  '. '  '-...-'`'--.  .-'            '.   `'   .'    . '                  ",
        " \\ '---.  `\" __ | |    \\ `  /    ||     | |             |  |               \\        /    / /    _.-')          ",
        "  /'\"\"'.\\  .'.''| |     \\  /     ||\\    / '             |  |                \\      /   .' '  _.'.-''           ",
        " ||     ||/ /   | |_    / /      |/\\'..' /              |  '.'               '----'   /  /.-'_.'               ",
        " \\'. __// \\ \\._,\\ '/|`-' /       '  `'-'`               |   /                        /    _.'                  ",
        "  `'---'   `--'  `\"  '..'                               `'-'                        ( _.-'                     ",
    ];

    lines.forEach(line => console.log(chalk.greenBright(line)));
}

export function logBoot(): void {
    console.log(chalk.magentaBright('\n╔════════════════════════════════════════════════════╗'));
    console.log(chalk.magentaBright('║  Aria Rees & Clove Nytrix Doughmination Twilight   ║'));
    console.log(chalk.magentaBright('╚════════════════════════════════════════════════════╝\n'));
} 