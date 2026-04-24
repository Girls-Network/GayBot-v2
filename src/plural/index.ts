/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Barrel for the /plu/ral module. Everything outside src/plural/ should
// import from here, not from the individual files — keeps the seams clean
// for when we eventually fold this under src/proxy/plural/.

export {
    resolveProxiedSender,
    resolveAccountByDiscordUser,
} from './resolver';
export {
    PluralApiError,
    PLURAL_USER_AGENT,
    hasPluralToken,
} from './client';
export type {
    ResolvedPluralSender,
    PluralMessageResponse,
} from './types';
