/**
 * Deterministic seeded random number generator.
 *
 * Every One Small Life campaign is generated from a stored seed (see the brief,
 * §19 Procedural generation). The same seed must always produce the same world,
 * so generation never uses Math.random() directly — it uses a Rng created here.
 *
 * Implementation: mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 * It is intentionally simple so it is easy to read, port, and reason about.
 */

/** A string seed is hashed to a 32-bit integer with xmur3. */
function hashSeed(seed: string): number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
}

export class Rng {
    private state: number;

    constructor(seed: number | string) {
        this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    }

    /** Next float in [0, 1). */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** Integer in [minInclusive, maxExclusive). */
    int(minInclusive: number, maxExclusive: number): number {
        return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
    }

    /** Uniformly pick one element from a non-empty array. */
    pick<T>(items: readonly T[]): T {
        if (items.length === 0) {
            throw new Error('Rng.pick() requires a non-empty array');
        }
        return items[this.int(0, items.length)];
    }

    /** Return true with the given probability (0..1). */
    chance(probability: number): boolean {
        return this.next() < probability;
    }
}
