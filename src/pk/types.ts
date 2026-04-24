/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

/** Fields from GET /v2/systems/{ref} we actually use. */
export interface PkSystemResponse {
    /** Short 5-char hid. */
    id: string;
    uuid: string;
    name: string | null;
}

/** Fields from GET /v2/messages/{id} we actually use. */
export interface PkMessageResponse {
    id: string;
    /** Discord message ID of the pre-proxy message (deleted by PK). */
    original: string | null;
    /** Discord user ID of the real sender. */
    sender: string;
    channel: string;
    guild: string | null;
    system: { id: string; uuid: string } | null;
    member: { id: string; uuid: string; name: string } | null;
}

/** What we pass around internally after resolving a PK message. */
export interface ResolvedSender {
    /** The real Discord user ID behind the proxy. */
    senderId: string;
    /** PK system hid (null if system privacy hides it). */
    systemId: string | null;
    /** PK member hid (null if member privacy hides it). */
    memberId: string | null;
    /** ID of the original (pre-proxy) Discord message, if reported. */
    originalMessageId: string | null;
}
