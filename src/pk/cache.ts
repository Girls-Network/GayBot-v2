/*
 * Copyright (c) 2026 Aria Rees & Clove Nytrix Doughmination Twilight
 * Licensed under the MIT Licence.
 * See LICENCE in the project root for full licence information.
 */

// Tiny LRU cache built on top of Map. Works because Map iterates in
// insertion order, so the oldest key is always .keys().next() — no
// separate doubly-linked-list bookkeeping. Every get() bumps the key
// by delete+re-set so the "oldest" pointer stays honest.
export class LruCache<K, V> {
    private readonly map = new Map<K, V>();

    constructor(private readonly max: number) {
        if (max <= 0) throw new Error('LruCache max must be > 0');
    }

    get(key: K): V | undefined {
        if (!this.map.has(key)) return undefined;
        const value = this.map.get(key) as V;
        // Bump this key to the "most recent" end of the Map.
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
