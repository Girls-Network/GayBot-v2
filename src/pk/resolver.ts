/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { LruCache } from './cache';
import { pkFetch, PkApiError } from './client';
import type { PkMessageResponse, PkSystemResponse, ResolvedSender } from './types';

/**
 * PK persists message metadata asynchronously after proxying, so the API
 * can briefly 404 before the row lands in their DB. Their dev recommends
 * an exponential-ish backoff abandoning around 3–5s.
 */
const RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

/**
 * `messageId -> ResolvedSender | null`.
 *   - A `ResolvedSender` means the message is PK-proxied; this mapping never
 *     changes, so we cache indefinitely (confirmed with PK).
 *   - `null` means the API returned 404 after all retries — i.e. the message
 *     is not PK-proxied.
 *
 * 10k entries ≈ a few MB and covers a healthy recent-message window.
 */
const senderCache = new LruCache<string, ResolvedSender | null>(10_000);

/** De-dupe concurrent lookups of the same message ID. */
const inFlight = new Map<string, Promise<ResolvedSender | null>>();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolve a (possibly) PK-proxied message to the real Discord user behind it.
 *
 * Returns `null` when the message isn't a PK proxy (after retries for the
 * async-DB race). Throws `PkApiError` on non-404 API failures.
 *
 * Results are memoised — safe and cheap to call for every webhook message.
 */
export async function resolveProxiedSender(messageId: string): Promise<ResolvedSender | null> {
    const cached = senderCache.get(messageId);
    if (cached !== undefined) return cached;

    const existing = inFlight.get(messageId);
    if (existing) return existing;

    const promise = doResolve(messageId).finally(() => {
        inFlight.delete(messageId);
    });
    inFlight.set(messageId, promise);
    return promise;
}

async function doResolve(messageId: string): Promise<ResolvedSender | null> {
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const res = await pkFetch(`/messages/${encodeURIComponent(messageId)}`);

        if (res.ok) {
            const data = (await res.json()) as PkMessageResponse;
            const resolved: ResolvedSender = {
                senderId: data.sender,
                systemId: data.system?.id ?? null,
                memberId: data.member?.id ?? null,
                originalMessageId: data.original ?? null,
            };
            senderCache.set(messageId, resolved);
            return resolved;
        }

        if (res.status === 404) {
            if (attempt >= RETRY_DELAYS_MS.length) {
                // Exhausted retries — treat as "not a PK message".
                senderCache.set(messageId, null);
                return null;
            }
            const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
            await sleep(delay);
            attempt++;
            continue;
        }

        if (res.status === 429) {
            // Respect Retry-After if present; otherwise back off 1s.
            const header = res.headers.get('Retry-After');
            const retryAfterSec = header ? Number(header) : NaN;
            const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
                ? retryAfterSec * 1000
                : 1000;
            await sleep(waitMs);
            continue;
        }

        // Anything else (5xx, malformed, etc.) — let the caller decide.
        throw new PkApiError(res.status, `PluralKit API returned ${res.status} for /messages/${messageId}`);
    }
}

// ─── System-by-Discord-user lookup ────────────────────────────────────────────

/**
 * `discordUserId -> systemId | null`.
 *
 * PK system membership doesn't change often, but it *can* — if a user leaves
 * a system or switches accounts. We cache for the process lifetime; bot
 * restarts clear it. A 1h TTL would be defensible; shipping without one for
 * now since the consequence of a stale cache is tolerable (a reaction or two
 * inconsistently gated).
 */
const systemByDiscordCache = new LruCache<string, string | null>(5_000);
const systemInFlight = new Map<string, Promise<string | null>>();

/**
 * Resolve a Discord user ID to their PK system hid, if any.
 *
 * Returns `null` when:
 *   - The user has no PK system (404).
 *   - Their system privacy hides it from `/systems/{discord_id}` lookups.
 *
 * Errors other than 404/403 throw `PkApiError`.
 */
export async function resolveSystemByDiscordUser(discordUserId: string): Promise<string | null> {
    const cached = systemByDiscordCache.get(discordUserId);
    if (cached !== undefined) return cached;

    const existing = systemInFlight.get(discordUserId);
    if (existing) return existing;

    const promise = doResolveSystem(discordUserId).finally(() => {
        systemInFlight.delete(discordUserId);
    });
    systemInFlight.set(discordUserId, promise);
    return promise;
}

async function doResolveSystem(discordUserId: string): Promise<string | null> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const res = await pkFetch(`/systems/${encodeURIComponent(discordUserId)}`);

        if (res.ok) {
            const data = (await res.json()) as PkSystemResponse;
            systemByDiscordCache.set(discordUserId, data.id);
            return data.id;
        }

        // 404 = no system linked. 403 = system hidden by privacy. Both are
        // "nothing to cascade to" from our perspective.
        if (res.status === 404 || res.status === 403) {
            systemByDiscordCache.set(discordUserId, null);
            return null;
        }

        if (res.status === 429) {
            const header = res.headers.get('Retry-After');
            const retryAfterSec = header ? Number(header) : NaN;
            const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
                ? retryAfterSec * 1000
                : 1000;
            await sleep(waitMs);
            continue;
        }

        throw new PkApiError(res.status, `PluralKit API returned ${res.status} for /systems/${discordUserId}`);
    }
}

// ─── Test/ops ─────────────────────────────────────────────────────────────────

/** Testing/ops hook — drop everything. Not used in prod paths. */
export function _clearPkCache(): void {
    (senderCache as unknown as { map: Map<unknown, unknown> }).map.clear();
    (systemByDiscordCache as unknown as { map: Map<unknown, unknown> }).map.clear();
    inFlight.clear();
    systemInFlight.clear();
}
