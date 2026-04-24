/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

/**
 * Tiny insertion-order LRU cache.
 *
 * We lean on JS Map's guaranteed insertion-order iteration: on `get`, we
 * re-insert the key to move it to the back, and evict the front when full.
 */
export class LruCache<K, V> {
    private readonly map = new Map<K, V>();

    constructor(private readonly max: number) {
        if (max <= 0) throw new Error('LruCache max must be > 0');
    }

    get(key: K): V | undefined {
        if (!this.map.has(key)) return undefined;
        const value = this.map.get(key) as V;
        // Refresh recency
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.max) {
            const oldest = this.map.keys().next().value as K | undefined;
            if (oldest !== undefined) this.map.delete(oldest);
        }
        this.map.set(key, value);
    }

    delete(key: K): boolean {
        return this.map.delete(key);
    }

    get size(): number {
        return this.map.size;
    }
}
