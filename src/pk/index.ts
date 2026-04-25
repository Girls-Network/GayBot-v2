/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Public surface of the PK module. Everything outside src/pk/ should
// import from this file rather than reaching into the individual
// modules — that way when we eventually fold this under
// src/proxy/{pk,plural,shared}/ (along with the parallel /p/r setup),
// the only thing that needs to change is this barrel.
//
// Kept intentionally small: only the few symbols messageCreate and the
// reaction-prefs commands actually need. If you find yourself adding
// to it, double-check whether the new caller really shouldn't be
// living inside src/pk/ instead.

// The two main entry points — message ID → real sender, and Discord
// user ID → PK system hid. Both are cached and de-duped internally.
export { resolveProxiedSender, resolveSystemByDiscordUser } from './resolver';

// Error type for non-404/403 failures, and the User-Agent string
// (exported so it can be checked from tests / shared with /p/r if we
// ever want to confirm we're using the same UA across both clients).
export { PkApiError, PK_USER_AGENT } from './client';

// Type-only exports so consumers can name our shapes without dragging
// in the runtime modules.
export type { ResolvedSender, PkMessageResponse, PkSystemResponse } from './types';
