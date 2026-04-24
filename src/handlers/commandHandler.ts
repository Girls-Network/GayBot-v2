/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Client, Collection, REST, Routes, SlashCommandBuilder } from 'discord.js';
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

// ─── File collection ──────────────────────────────────────────────────────────

function collectCommandFiles(dir: string, root: string): { filePath: string; relKey: string }[] {
    const results: { filePath: string; relKey: string }[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectCommandFiles(full, root));
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
            const rel = path.relative(root, full);
            const relKey = rel.replace(/\.(js|ts)$/, '').split(path.sep).join(' ');
            results.push({ filePath: full, relKey });
        }
    }
    return results;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loadCommands(client: ExtendedClient): Promise<void> {
    client.commands = new Collection();
    client.toggleableCommands = [];

    const commandsRoot = path.join(__dirname, '../commands');
    const files = collectCommandFiles(commandsRoot, commandsRoot);

    // Bucket command modules by their top-level name. This is how we let
    // admin/commands.ts and admin/reactions.ts both contribute to /admin
    // without fighting over ownership of the top-level Discord command.
    const grouped = new Map<string, { relKey: string; mod: BotCommand }[]>();

    for (const { filePath, relKey } of files) {
        const mod: BotCommand = require(filePath).default;
        if (!mod?.data || !mod?.execute) continue;

        const topLevel: string = mod.data.name;
        if (!grouped.has(topLevel)) grouped.set(topLevel, []);
        grouped.get(topLevel)!.push({ relKey, mod });
    }

    for (const [topLevelName, entries] of grouped) {
        if (entries.length === 1) {
            // Only one file contributes to this command, easy case.
            const { relKey, mod } = entries[0];
            client.commands.set(topLevelName, mod);
            if (mod.toggle) client.toggleableCommands.push(relKey);
            log(chalk.cyanBright(`  Loaded /${topLevelName}`));
        } else {
            // Several files claim the same top-level command. Fold their
            // subcommand groups together into one synthetic command so
            // Discord sees a single /admin with all the pieces attached.
            const merged = buildMergedCommand(topLevelName, entries, client);
            client.commands.set(topLevelName, merged);
            log(chalk.cyanBright(`  Merged /${topLevelName} (${entries.length} files)`));
        }
    }

    log(chalk.cyanBright(
        `Commands loaded — ${client.commands.size} top-level, ` +
        `${client.toggleableCommands.length} toggleable`
    ));
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

function buildMergedCommand(
    name: string,
    entries: { relKey: string; mod: BotCommand }[],
    client: ExtendedClient,
): BotCommand {
    // Pull every subcommand/group out of each contributing file, plus build
    // a lookup table so we can route an incoming interaction back to the
    // right file's execute()/autocomplete() at dispatch time.
    const allOptions: any[] = [];
    const executeMap = new Map<string, BotCommand['execute']>();
    const autocompleteMap = new Map<string, BotCommand['autocomplete']>();

    for (const { relKey, mod } of entries) {
        const opts: any[] = mod.data.options ?? [];
        allOptions.push(...opts);

        // Keys look like "reactions disable" for grouped subcommands, or
        // just "disable" for plain subcommands. Same shape the dispatcher
        // below reconstructs from the interaction.
        for (const opt of opts) {
            // type 2 = SubcommandGroup (per Discord's API constants)
            if (opt.type === 2) {
                for (const sub of opt.options ?? []) {
                    const key = `${opt.name} ${sub.name}`;
                    executeMap.set(key, mod.execute);
                    if (mod.autocomplete) autocompleteMap.set(key, mod.autocomplete);
                }
                // Belt-and-braces: also register the bare group name in
                // case someone invokes it without a subcommand somehow.
                executeMap.set(opt.name, mod.execute);
                if (mod.autocomplete) autocompleteMap.set(opt.name, mod.autocomplete);
            }
            // type 1 = plain Subcommand
            if (opt.type === 1) {
                executeMap.set(opt.name, mod.execute);
                if (mod.autocomplete) autocompleteMap.set(opt.name, mod.autocomplete);
            }
        }

        if (mod.toggle) client.toggleableCommands.push(relKey);
    }

    // Build the combined command payload Discord sees. The first file wins
    // on the top-level description (there's no sensible way to merge prose),
    // but options get replaced with the full union.
    const baseData = { ...entries[0].mod.data, options: allOptions };

    const merged: BotCommand = {
        data: baseData,

        async execute(interaction, cl) {
            if (!interaction.isChatInputCommand()) return;
            const group = interaction.options.getSubcommandGroup(false);
            const sub   = interaction.options.getSubcommand(false);

            // Pick the handler that owns this subcommand. Grouped path
            // first ("reactions disable"), plain sub second ("disable").
            let handler = group && sub
                ? executeMap.get(`${group} ${sub}`)
                : sub
                    ? executeMap.get(sub)
                    : undefined;

            if (!handler) {
                await interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
                return;
            }
            await handler(interaction, cl);
        },

        async autocomplete(interaction) {
            const group = interaction.options.getSubcommandGroup(false);
            const sub   = interaction.options.getSubcommand(false);

            const handler = group && sub
                ? autocompleteMap.get(`${group} ${sub}`)
                : sub
                    ? autocompleteMap.get(sub)
                    : undefined;

            if (handler) await handler(interaction);
        },
    };

    return merged;
}

// ─── Deploy ───────────────────────────────────────────────────────────────────

const ID_LOG_PATH = path.join(process.cwd(), 'data', 'ids.json');

function writeCommandIdLog(commands: { name: string; id: string }[]): void {
    const data = {
        deployed_at: new Date().toISOString(),
        commands: Object.fromEntries(commands.map(c => [c.name, c.id])),
    };
    const dir = path.dirname(ID_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ID_LOG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    log(chalk.cyanBright('Command IDs written to data/ids.json'));
}

export async function deployCommands(client: ExtendedClient): Promise<void> {
    const TOKEN     = process.env.GAYBOT_TOKEN;
    const CLIENT_ID = process.env.GAYBOT_CLIENT_ID;

    if (!CLIENT_ID || !TOKEN) {
        logError(new Error('Missing CLIENT_ID or BOT_TOKEN'), 'Commands');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const commands = client.commands.map(cmd => ({
        ...cmd.data,
        integration_types: [0, 1],
        contexts: [0, 1, 2],
    }));

    try {
        log(chalk.yellow('Deploying commands globally…'));
        const deployed = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        ) as { name: string; id: string }[];
        log(chalk.greenBright('Global commands deployed'));
        writeCommandIdLog(deployed);
    } catch (error) {
        logError(error, 'Commands');
    }
}