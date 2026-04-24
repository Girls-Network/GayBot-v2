/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

import { LruCache } from './cache';
import { pluralFetch, PluralApiError } from './client';
import type { PluralMessageResponse, ResolvedPluralSender } from './types';

/*
 * Figures out the real Discord user behind a /p/r proxy message, given a
 * channel ID + message ID. Two things to know going in:
 *
 *  1. /p/r persists proxied messages async, so an immediate lookup can 408
 *     while the row is still being written. ant's advice was just plain
 *     exponential backoff, which is what we do.
 *
 *  2. Results for a given message ID never change (a proxy is a proxy), so
 *     we cache forever. The cache is bounded by LRU; bot restart clears it.
 */

const RETRY_DELAYS_MS: readonly number[] = [500, 1000, 2000];

// Key: `${channelId}:${messageId}`. Value of `null` means "we tried and
// it's not a /p/r message" — cached so we don't keep hammering /p/r for
// every non-proxy webhook that flies past.
const senderCache = new LruCache<string, ResolvedPluralSender | null>(10_000);

// If the same message somehow gets enqueued twice in quick succession
// (shouldn't happen often but can), we don't want two parallel HTTP
// requests. First call does the work, the rest await the same promise.
const inFlight = new Map<string, Promise<ResolvedPluralSender | null>>();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cacheKey(channelId: string, messageId: string): string {
    return `${channelId}:${messageId}`;
}

/**
 * Look up a proxied message. Returns null if /p/r doesn't recognise it
 * (i.e. it isn't a /p/r proxy after all — could be PK, Tupperbox, a plain
 * GitHub webhook, whatever). Throws PluralApiError for anything weirder
 * than a clean 404 or 408 — callers should log and treat as "don't know".
 */
export async function resolveProxiedSender(
    channelId: string,
    messageId: string,
): Promise<ResolvedPluralSender | null> {
    const key = cacheKey(channelId, messageId);

    const cached = senderCache.get(key);
    if (cached !== undefined) return cached;

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = doResolve(channelId, messageId).finally(() => {
        inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
}

async function doResolve(
    channelId: string,
    messageId: string,
): Promise<ResolvedPluralSender | null> {
    const key = cacheKey(channelId, messageId);
    const path = `/messages/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`;
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const res = await pluralFetch(path);

        if (res.ok) {
            const data = (await res.json()) as PluralMessageResponse;

            // /p/r's shape has varied a bit across deploys. Accept either
            // top-level author_id or a nested author.id.
            const senderId = data.author_id ?? data.author?.id ?? null;
            if (!senderId) {
                // We got a 200 but no usable Discord ID. Treat the same as
                // "not something we can act on" and move on.
                senderCache.set(key, null);
                return null;
            }

            const resolved: ResolvedPluralSender = {
                senderId,
                accountId: data.account_id ?? null,
                memberId: data.member_id ?? null,
                originalMessageId: data.original_message_id ?? null,
            };
            senderCache.set(key, resolved);
            return resolved;
        }

        // 404 → not a /p/r message. Don't retry, just remember it so we
        // don't look up the same non-match over and over.
        if (res.status === 404) {
            senderCache.set(key, null);
            return null;
        }

        // 408 → async persist race (see file-top comment). Back off, try
        // again, give up after the last delay.
        if (res.status === 408) {
            if (attempt >= RETRY_DELAYS_MS.length) {
                senderCache.set(key, null);
                return null;
            }
            const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
            await sleep(delay);
            attempt++;
            continue;
        }

        // 429 → we're being rate-limited. Honour Retry-After if it's given,
        // otherwise a flat 1s is a safe guess.
        if (res.status === 429) {
            const header = res.headers.get('Retry-After');
            const retryAfterSec = header ? Number(header) : NaN;
            const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
                ? retryAfterSec * 1000
                : 1000;
            await sleep(waitMs);
            continue;
        }

        // Anything else is unexpected. Pull the body in so we can actually
        // see what /p/r is yelling about (e.g. the auth header format error
        // that cost us half an evening).
        let body = '';
        try {
            body = (await res.text()).slice(0, 500);
        } catch {
            // If even reading the body fails, the status is still useful.
        }
        throw new PluralApiError(
            res.status,
            `/plu/ral API returned ${res.status} for ${path}${body ? `: ${body}` : ''}`,
        );
    }
}

// ─── Account-by-Discord-user lookup (stubbed) ────────────────────────────────

/**
 * This is the /p/r counterpart to PK's resolveSystemByDiscordUser. The idea:
 * give it a Discord user ID, get back the /p/r account they belong to, so
 * opt-outs can cascade across every Discord login that account is linked to.
 *
 * Problem: /p/r's v3 OpenAPI doesn't seem to have an obvious public endpoint
 * for "which account owns this Discord user", and we haven't asked ant yet.
 * Until it does, this returns null and the cascade no-ops for /p/r users —
 * they still get user-level opt-outs, just not cross-account ones.
 *
 * When we get the right endpoint, drop it in here with the same caching
 * shape as the PK version and wire it into messageCreate.
 */
export async function resolveAccountByDiscordUser(
    _discordUserId: string,
): Promise<string | null> {
    return null;
}

// ─── Escape hatches for tests / ops ──────────────────────────────────────────

// Blow away both caches. Not used on any hot path — this exists for tests
// and for when we're poking at things in the REPL.
export function _clearPluralCache(): void {
    (senderCache as unknown as { map: Map<unknown, unknown> }).map.clear();
    inFlight.clear();
}
