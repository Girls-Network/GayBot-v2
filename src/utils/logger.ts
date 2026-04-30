/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

// ESM doesn't define __dirname like CommonJS does — derive it from
// import.meta.url so the package.json lookup below keeps working.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(process.cwd(), ".logs");

// Make sure .logs/ exists up-front — appendFileSync will throw otherwise
// and we'd lose the first error we tried to record.
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Grab the version string from package.json so the boot banner shows it.
// The two candidate paths cover prod (compiled to dist/utils/) and dev
// (ts-node running straight out of src/utils/) — we're one directory
// deeper in dev, hence the extra ../ step. A missing or busted package.json
// shouldn't stop the bot booting, so we just fall through to "unknown".
function getBotVersion(): string {
    const candidates = [
        path.join(__dirname, "..", "..", "package.json"), // dist/utils/logger.js
        path.join(__dirname, "..", "..", "..", "package.json"), // src/utils/logger.ts (ts-node)
    ];
    for (const p of candidates) {
        try {
            if (!fs.existsSync(p)) continue;
            const pkg = JSON.parse(fs.readFileSync(p, "utf-8")) as {
                version?: string;
            };
            if (typeof pkg.version === "string") return pkg.version;
        } catch {
            // malformed JSON here doesn't matter, try the next path
        }
    }
    return "unknown";
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
    const stack = error instanceof Error ? error.stack : "";

    const logContent = `${formatted} ERROR${context ? ` (${context})` : ""}: ${errorMessage}\n${stack}\n\n`;

    // One file per day keeps logs grep-able without rotation tooling.
    const filename = `error-${new Date().toISOString().split("T")[0]}.log`;
    fs.appendFileSync(path.join(LOG_DIR, filename), logContent);

    console.error(chalk.redBright(`There was an error, see: ${filename}`));
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

    lines.forEach((line) => console.log(chalk.greenBright(line)));
}

export function logBoot(): void {
    const authors = "Aria Rees & Clove Nytrix Doughmination Twilight";
    const version = `v${getBotVersion()}`;

    // Width the box has to be = longest string inside it + 2 spaces of
    // padding on each side. Everything else is centred inside that width.
    const innerWidth = Math.max(authors.length, version.length) + 4;
    const border = "═".repeat(innerWidth);

    const center = (s: string): string => {
        const total = innerWidth - s.length;
        const left = Math.floor(total / 2);
        const right = total - left;
        return " ".repeat(left) + s + " ".repeat(right);
    };

    console.log(chalk.magentaBright(`\n╔${border}╗`));
    console.log(chalk.magentaBright(`║${center(authors)}║`));
    console.log(chalk.magentaBright(`║${center(version)}║`));
    console.log(chalk.magentaBright(`╚${border}╝\n`));
}
