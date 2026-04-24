/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

/*
 * HTTP client for /p/r's v3 API. Small on purpose — does fetch, attaches
 * headers, and gets out of the way. All the status-code handling and retry
 * logic lives in resolver.ts.
 *
 * What ant told us (keep this in sync if he tells us otherwise later):
 *   - Unauth: 5 req / 5s per-IP. Auth: 30 req / 10s per-token.
 *   - One token per application — he'd rather we don't shard across tokens.
 *     Rate-limit concerns can wait until v5 is actually out.
 *   - On v5 the auth becomes mandatory and the base URL moves to
 *     plural.gg/api. That's a one-line change here when it happens.
 */

const API_BASE = 'https://api.plural.gg';

// Same UA we use for PK. Not strictly required by /p/r (ant said the token
// identifies us just fine), but keeping one UA across every outbound call
// makes it easier for third-party devs to grep their logs for us.
export const PLURAL_USER_AGENT = 'GayBot (https://github.com/Girls-Network/gaybot-v2)';

export class PluralApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'PluralApiError';
    }
}

// ─── Token ───────────────────────────────────────────────────────────────────

// Read the token once at startup. Restart the bot if you rotate it.
// One token per app — ant's preference, don't fight it.
const TOKEN: string | null = (() => {
    const raw = process.env.PLURAL_API_TOKEN;
    return raw && raw.trim().length > 0 ? raw.trim() : null;
})();

export function hasPluralToken(): boolean {
    return TOKEN !== null;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function pluralFetch(path: string): Promise<Response> {
    const headers: Record<string, string> = {
        'User-Agent': PLURAL_USER_AGENT,
        Accept: 'application/json',
    };

    if (TOKEN) {
        // /p/r wants the raw token in the Authorization header — no
        // "Bearer " prefix. Took us a 400 and an error body to figure
        // this out, so please leave it as-is unless ant changes it:
        //   {"msg":"Invalid token","loc":["header","Authorization"]}
        headers.Authorization = TOKEN;
    }

    return fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers,
    });
}
