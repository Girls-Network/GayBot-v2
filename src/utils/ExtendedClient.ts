import { Client, Collection } from 'discord.js';
import { ReactionQueueEntry } from '../utils/reactionSystem';
import { BotCommand } from '../handlers/commandHandler';

export interface ExtendedClient extends Client {
    commands: Collection<string, BotCommand>;
    reactionQueue: ReactionQueueEntry[];
    toggleableCommands: string[];
}