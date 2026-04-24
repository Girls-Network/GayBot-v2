/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// PluralKit v2 API client. /messages/{id} caps at 10 req/sec per IP
// (token won't raise it). Always use the same User-Agent across shards
// so PK sees all our traffic as one bot.

const API_BASE = 'https://api.pluralkit.me/v2';

/**
 * Shared across every shard. If you change this, change it everywhere —
 * consistency across instances is a PK requirement, not just a nicety.
 */
export const PK_USER_AGENT = 'GayBot (https://github.com/Girls-Network/gaybot-v2)';

export class PkApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'PkApiError';
    }
}

/** Perform a GET against the PK API. Caller handles status codes. */
export async function pkFetch(path: string): Promise<Response> {
    return fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers: {
            'User-Agent': PK_USER_AGENT,
            Accept: 'application/json',
        },
    });
}
