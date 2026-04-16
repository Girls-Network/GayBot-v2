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

interface BotCommand {
    data: any;
    execute: (interaction: any, client: any) => Promise<void>;
}

interface ExtendedClient extends Client {
    commands: Collection<string, BotCommand>;
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

    // Ensure data/ exists
    const dir = path.dirname(ID_LOG_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(ID_LOG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    log(chalk.cyanBright(`Command IDs written to data/ids.json`));
}

export async function loadCommands(client: ExtendedClient): Promise<void> {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath).default;

        if (command && command.data && command.execute) {
            client.commands.set(command.data.name, command);
        }
    }

    log(chalk.cyanBright('Loading commands'));
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
        integration_types: [0, 1], // GUILD_INSTALL (0), USER_INSTALL (1)
        contexts: [0, 1, 2],       // GUILD (0), BOT_DM (1), PRIVATE_CHANNEL (2)
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