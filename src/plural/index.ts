/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Barrel for the /plu/ral module. Everything outside src/plural/ should
// import from here, not from the individual files — keeps the seams clean
// for when we eventually fold this under src/proxy/plural/ alongside the
// PK module (which exposes a near-identical surface from src/pk/index.ts).
//
// Symbols are deliberately limited to what messageCreate actually needs:
// resolve a proxied message → real sender, plus the (currently stubbed)
// account-cascade hook for opt-out propagation across linked Discord
// logins. If you need anything more, consider whether the caller should
// live inside src/plural/ instead.

// Resolvers — the message ID one is live; the account-by-Discord-user
// one is a stub returning null until we get the right endpoint from ant.
export { resolveProxiedSender, resolveAccountByDiscordUser } from "./resolver";

// Error class, shared User-Agent (matched to PK's), and a token-presence
// check the rest of the codebase can use to gate auth-only behaviours
// without having to peek at process.env directly.
export { PluralApiError, PLURAL_USER_AGENT, hasPluralToken } from "./client";

// Types only — no runtime cost on the import side.
export type { ResolvedPluralSender, PluralMessageResponse } from "./types";
