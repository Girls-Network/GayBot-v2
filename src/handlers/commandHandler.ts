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
    const TOKEN = process.env.GAYBOT_TOKEN;
    const CLIENT_ID = process.env.GAYBOT_CLIENT_ID;
    const GUILD_ID = process.env.GAYBOT_GUILD_ID;

    if (!CLIENT_ID || !TOKEN) {
        logError(new Error('Missing CLIENT_ID or BOT_TOKEN'), 'Commands');
        return;
    }

    if (CLIENT_ID === 'Client ID' || TOKEN === 'Token') {
        logError(new Error('Default Values'), 'Commands');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    // Add integration_types and contexts to each command for user install support
    const commands = client.commands.map(cmd => ({
        ...cmd.data,
        integration_types: [0, 1], // GUILD_INSTALL (0), USER_INSTALL (1)
        contexts: [0, 1, 2],       // GUILD (0), BOT_DM (1), PRIVATE_CHANNEL (2)
    }));

    try {
        log(chalk.yellow('Deploying commands'));
        
        // Always deploy globally
        log(chalk.yellow('Deploying globally (may take up to 1 hour to propagate)'));
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        log(chalk.greenBright('Global commands deployed successfully'));
        
        // Additionally deploy to test guild if specified (instant)
        if (GUILD_ID) {
            log(chalk.yellow(`Also deploying to guild ${GUILD_ID} for instant testing`));
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            log(chalk.greenBright('Guild commands deployed successfully'));
        }
    } catch (error) {
        logError(error, 'Commands');
    }
}