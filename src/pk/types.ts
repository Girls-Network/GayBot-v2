/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Type definitions for PluralKit API responses and our internal resolver
// output. Only the fields we actually use are listed — PK responses are
// significantly bigger (avatars, descriptions, privacy flags, etc.) but
// pulling those into the type would imply we depend on them. We don't.
//
// If PK ever adds a field we want, add it here. If they remove one of these,
// resolver.ts will tell us via runtime null-check.

/** Fields from GET /v2/systems/{ref} we actually use. */
export interface PkSystemResponse {
    /** Short 5-char hid (e.g. "abcde"). What we use as our system key on disk. */
    id: string;
    /** Stable UUID — never used directly, included for completeness. */
    uuid: string;
    /** System display name. Null if the system is unnamed or privacy-hidden. */
    name: string | null;
}

/** Fields from GET /v2/messages/{id} we actually use. */
export interface PkMessageResponse {
    /** PK's own internal message ID — not the same as Discord's. */
    id: string;
    /**
     * Discord message ID of the *original* (pre-proxy) message, the one PK
     * deleted before sending the webhook copy. Null if PK doesn't have it
     * recorded for some reason.
     */
    original: string | null;
    /** Discord user ID of the real sender behind the proxy webhook. */
    sender: string;
    /** Channel ID the proxied message landed in. */
    channel: string;
    /** Guild ID. Null for DMs (which we don't process anyway). */
    guild: string | null;
    /**
     * The PK system that proxied this message. Null when the system has
     * marked itself private — sender is still populated, system isn't.
     */
    system: { id: string; uuid: string } | null;
    /**
     * The specific member (alter/headmate) that fronted for this message.
     * Null when member-level privacy is on, even if system is visible.
     */
    member: { id: string; uuid: string; name: string } | null;
}

/**
 * Our internal "I resolved this message, here's what matters" shape.
 * Returned by the resolver and consumed by reaction logic that needs
 * to know who really sent the message and what scopes it falls into.
 *
 * All four fields can be the empty/null case independently — privacy
 * flags can hide system without hiding member or vice versa, and the
 * pre-proxy message ID can be missing even when everything else is fine.
 */
export interface ResolvedSender {
    /** The real Discord user ID behind the proxy webhook. Always set. */
    senderId: string;
    /** PK system hid. Null if system-level privacy is hiding it. */
    systemId: string | null;
    /** PK member hid. Null if member-level privacy is hiding it. */
    memberId: string | null;
    /** Discord ID of the original pre-proxy message. Null if PK didn't report one. */
    originalMessageId: string | null;
}
