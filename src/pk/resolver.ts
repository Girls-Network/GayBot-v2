/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { LruCache } from './cache';
import { pkFetch, PkApiError } from './client';
import type { PkMessageResponse, PkSystemResponse, ResolvedSender } from './types';

// PK saves metadata async after proxying, so we'll 404 briefly. Their devs
// recommend bailing after ~3–5s of exponential backoff.
const RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

// Map messageId -> ResolvedSender | null. ResolvedSender = PK-proxied msg
// (never changes, cache forever). null = 404 after retries (not PK proxied).
// 10k entries ≈ a few MB, covers recent-message window.
const senderCache = new LruCache<string, ResolvedSender | null>(10_000);

// If two shards see the same message near-simultaneously we don't want
// both firing requests off. First caller does the fetch, anyone else
// joining in gets the same promise.
const inFlight = new Map<string, Promise<ResolvedSender | null>>();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns the real sender behind a (maybe) PK-proxied message, or null
// if it turns out not to be PK at all (we retry for the async-DB race
// first, see the file-top comment). Anything else blowing up surfaces
// as a PkApiError for the caller to log.
//
// Cached forever — proxy identity doesn't change once set.
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

// Discord user ID -> system hid (or null if they're not plural / hid by
// privacy). System membership doesn't change often, but it *can* when
// someone leaves or switches account. We could slap a TTL on but haven't
// bothered: the worst case is a reaction or two inconsistently gated
// until the next restart, which is tolerable.
const systemByDiscordCache = new LruCache<string, string | null>(5_000);
const systemInFlight = new Map<string, Promise<string | null>>();

// Returns the invoker's PK system hid or null if they don't have one.
// "Don't have one" covers both "not plural" (404) and "plural but hiding
// it from the /systems/{discord_id} endpoint" (403) — both are the same
// "nothing to cascade to" from our side, so we flatten them. Any other
// status throws so the caller can log.
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
