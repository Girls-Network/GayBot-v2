/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Client, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { log, logError } from '../utils/logger';
import chalk from 'chalk';
import { ExtendedClient } from '../utils/ExtendedClient';

export interface BotCommand {
    toggle?: boolean;
    data: any;
    execute: (interaction: any, client: any) => Promise<void>;
    autocomplete?: (interaction: any) => Promise<void>;
}

interface CommandIdLog {
    deployed_at: string;
    commands: Record<string, string>;
}

const ID_LOG_PATH = path.join(process.cwd(), 'data', 'ids.json');

function writeCommandIdLog(commands: { name: string; id: string }[]): void {
    const data: CommandIdLog = {
        deployed_at: new Date().toISOString(),
        commands: Object.fromEntries(commands.map(c => [c.name, c.id])),
    };

    const dir = path.dirname(ID_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(ID_LOG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    log(chalk.cyanBright('Command IDs written to data/ids.json'));
}

/**
 * Recursively collect all .js/.ts command files under a directory.
 * Files are keyed by their path relative to the commands root so we
 * can derive the subcommand group name (e.g. "yuri/kiss" → "yuri kiss").
 */
function collectCommandFiles(dir: string, root: string): { filePath: string; relKey: string }[] {
    const results: { filePath: string; relKey: string }[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results.push(...collectCommandFiles(full, root));
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
            // relKey: e.g. "yuri/kiss" or "ping"
            const rel = path.relative(root, full);
            const relKey = rel
                .replace(/\.(js|ts)$/, '')
                .split(path.sep)
                .join(' ');
            results.push({ filePath: full, relKey });
        }
    }

    return results;
}

export async function loadCommands(client: ExtendedClient): Promise<void> {
    client.commands = new Collection();
    client.toggleableCommands = [];

    const commandsRoot = path.join(__dirname, '../commands');
    const files = collectCommandFiles(commandsRoot, commandsRoot);

    for (const { filePath, relKey } of files) {
        const command: BotCommand = require(filePath).default;
        if (!command?.data?.execute && !command?.execute) continue;
        if (!command.data || !command.execute) continue;

        // Store under the top-level command name for dispatch
        client.commands.set(command.data.name, command);

        // If toggleable, record the full subcommand key
        if (command.toggle) {
            client.toggleableCommands.push(relKey);
        }
    }

    log(chalk.cyanBright(`Loading commands (${client.commands.size} top-level, ${client.toggleableCommands.length} toggleable)`));
}

export async function deployCommands(client: ExtendedClient): Promise<void> {
    const TOKEN     = process.env.GAYBOT_TOKEN;
    const CLIENT_ID = process.env.GAYBOT_CLIENT_ID;

    if (!CLIENT_ID || !TOKEN) {
        logError(new Error('Missing CLIENT_ID or BOT_TOKEN'), 'Commands');
        return;
    }

    if (CLIENT_ID === 'Client ID' || TOKEN === 'Token') {
        logError(new Error('Default Values'), 'Commands');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    const commands = client.commands.map(cmd => ({
        ...cmd.data,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
    }));

    try {
        log(chalk.yellow('Deploying commands globally (may take up to 1 hour to propagate)'));

        const deployed = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        ) as { name: string; id: string }[];

        log(chalk.greenBright('Global commands deployed successfully'));
        writeCommandIdLog(deployed);
    } catch (error) {
        logError(error, 'Commands');
    }
}