/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// PluralKit v2 API client. Deliberately tiny — just a fetch wrapper that sets
// the User-Agent and tags errors with their HTTP status. The interesting
// behaviour (caching, in-flight de-duplication, retry, 404 handling) all
// lives one level up in resolver.ts.
//
// Rate-limit context: /messages/{id} caps at 10 req/sec *per IP* on PK's
// public API, and adding an auth token does NOT raise that ceiling for
// public endpoints. The cache + in-flight dedupe in resolver.ts is what
// keeps us under that line during big bursts (say, when a server suddenly
// has 30 PK-proxied messages in a minute).
//
// One client per process is the right move — sharing a User-Agent across
// shards is explicitly required by PK's API rules so they can attribute
// traffic correctly. Don't randomise or vary it per-shard.

const API_BASE = 'https://api.pluralkit.me/v2';

/**
 * The User-Agent string PK uses to identify us. Includes the repo URL so
 * if PK ops needs to ping someone about misbehaving traffic, they can.
 * Shared across every shard — consistency here is a PK API requirement,
 * not just a nicety.
 */
export const PK_USER_AGENT = 'GayBot (https://github.com/Girls-Network/gaybot-v2)';

/**
 * Thin Error subclass so callers can distinguish "PK said no" from
 * "the network exploded" via instanceof. The status code is exposed
 * because resolver.ts wants to flatten 404s and 403s into nulls
 * differently from other errors.
 */
export class PkApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'PkApiError';
    }
}

/**
 * Perform a GET against the PK API. Returns the raw Response so the caller
 * can decide what to do with non-2xx — resolver.ts treats 404 as "user
 * isn't on PK", 429 as "back off and retry", and everything else as fatal.
 * No request body / no other methods because we never write to PK.
 */
export async function pkFetch(path: string): Promise<Response> {
    return fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers: {
            'User-Agent': PK_USER_AGENT,
            Accept: 'application/json',
        },
    });
}
