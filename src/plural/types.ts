/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

/*
 * Types for /p/r's API (currently v3).
 *
 * We only model the fields we actually touch, so the shape here isn't the
 * whole response — just what we pluck out. When v5 ships, the base URL
 * changes from api.plural.gg to plural.gg/api and auth becomes mandatory,
 * but the field names on this endpoint shouldn't shift much. Worth a quick
 * re-check of this file during that migration regardless.
 */

// Raw shape coming back from GET /messages/{channel_id}/{message_id}.
export interface PluralMessageResponse {
    id: string;
    channel_id: string;

    // The real Discord user behind the proxy. /p/r seems to return this as
    // author_id on recent responses, but older or alternate shapes nest it
    // under author.id, so we accept both and the resolver picks whichever
    // is populated.
    author_id?: string;
    author?: { id?: string } | null;

    // account_id is what we'd use to cascade opt-outs across every Discord
    // login tied to one /p/r account. ant confirmed usergroups ≠ PK systems
    // (they're just groups, same as PK's groups), so the account is the
    // right cascade key — not the usergroup.
    account_id?: string | null;
    member_id?: string | null;

    // If /p/r can tell us the pre-proxy Discord message ID, we take it. Not
    // currently used for anything, but cheap to carry.
    original_message_id?: string | null;
}

// What the rest of the bot actually consumes. Keep this small and stable;
// if the upstream shape shifts we adapt in the resolver, not here.
export interface ResolvedPluralSender {
    // Real Discord user ID. This is the key thing — opt-outs check against it.
    senderId: string;
    // /p/r account the sender's on, when the API tells us. Null if hidden
    // or we just didn't get it back.
    accountId: string | null;
    memberId: string | null;
    originalMessageId: string | null;
}
