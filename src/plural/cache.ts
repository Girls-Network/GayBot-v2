/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// The LRU cache lives in ../pk/cache right now because PK was written first
// and there's nothing PK-specific about it. Re-exporting here so everything
// under src/plural/ imports its cache from a sibling file — when we eventually
// move both modules under src/proxy/ with a shared/ folder, this file is
// where the rewrite lands.
export { LruCache } from '../pk/cache';
