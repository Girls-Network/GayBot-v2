/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { Client, Collection } from "discord.js";
import { ReactionQueueEntry } from "../utils/reactionSystem";
import { BotCommand } from "../handlers/commandHandler";

// Our own shape on top of discord.js's Client. Anything we hang off the
// client instance at runtime needs to be declared here so TypeScript
// doesn't yell whenever we read client.commands / client.reactionQueue.
export interface ExtendedClient extends Client {
    commands: Collection<string, BotCommand>;
    reactionQueue: ReactionQueueEntry[];
    toggleableCommands: string[];
}
