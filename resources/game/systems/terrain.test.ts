import { describe, it, expect } from 'vitest';
import {
    generateTerrain,
    inWater,
    biomeAt,
    TERRAIN_MARGIN,
    NEST_MIN_DISTANCE,
    SPAWN_CLEAR_RADIUS,
} from './terrain';
import { WORLD } from '../config';

const W = WORLD.creatureWidth;
const H = WORLD.creatureHeight;

describe('terrain generation', () => {
    it('is deterministic: the same seed produces identical terrain', () => {
        const a = generateTerrain('campaign-42', W, H);
        const b = generateTerrain('campaign-42', W, H);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('different seeds produce different terrain', () => {
        const a = generateTerrain('campaign-42', W, H);
        const b = generateTerrain('campaign-43', W, H);
        expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    });

    it('produces 3-4 biome patches of known kinds', () => {
        for (const seed of ['a', 'b', 'c', 'd', 'e']) {
            const t = generateTerrain(seed, W, H);
            expect(t.biomes.length).toBeGreaterThanOrEqual(3);
            expect(t.biomes.length).toBeLessThanOrEqual(4);
            for (const b of t.biomes) {
                expect(['meadow', 'forest', 'rock']).toContain(b.kind);
            }
        }
    });

    it('places 9 nests, spread with a pairwise minimum distance', () => {
        for (const seed of ['a', 'b', 'c', 'd', 'e']) {
            const t = generateTerrain(seed, W, H);
            expect(t.nests.length).toBe(9);
            for (let i = 0; i < t.nests.length; i++) {
                for (let j = i + 1; j < t.nests.length; j++) {
                    const d = Math.hypot(t.nests[i].x - t.nests[j].x, t.nests[i].y - t.nests[j].y);
                    // Generation may relax the spacing slightly if sampling
                    // stalls, but never below half the target.
                    expect(d).toBeGreaterThanOrEqual(NEST_MIN_DISTANCE * 0.5);
                }
            }
        }
    });

    it('keeps nests and features inside the world margin and out of water', () => {
        const t = generateTerrain('bounds-check', W, H);
        for (const n of t.nests) {
            expect(n.x).toBeGreaterThanOrEqual(TERRAIN_MARGIN);
            expect(n.x).toBeLessThanOrEqual(W - TERRAIN_MARGIN);
            expect(n.y).toBeGreaterThanOrEqual(TERRAIN_MARGIN);
            expect(n.y).toBeLessThanOrEqual(H - TERRAIN_MARGIN);
            expect(inWater(t.waters, n.x, n.y, 100)).toBe(false);
        }
        for (const f of t.features) {
            expect(f.x).toBeGreaterThanOrEqual(TERRAIN_MARGIN);
            expect(f.x).toBeLessThanOrEqual(W - TERRAIN_MARGIN);
            expect(f.y).toBeGreaterThanOrEqual(TERRAIN_MARGIN);
            expect(f.y).toBeLessThanOrEqual(H - TERRAIN_MARGIN);
            expect(inWater(t.waters, f.x, f.y)).toBe(false);
        }
    });

    it('keeps water clear of the spawn point at the world centre', () => {
        for (const seed of ['a', 'b', 'c', 'd', 'e']) {
            const t = generateTerrain(seed, W, H);
            expect(t.waters.length).toBeGreaterThanOrEqual(2);
            expect(inWater(t.waters, W / 2, H / 2, SPAWN_CLEAR_RADIUS * 0.5)).toBe(false);
        }
    });

    it('inWater is a padded ellipse containment test', () => {
        const waters = [{ x: 1000, y: 1000, rx: 200, ry: 100 }];
        expect(inWater(waters, 1000, 1000)).toBe(true);
        expect(inWater(waters, 1199, 1000)).toBe(true);
        expect(inWater(waters, 1201, 1000)).toBe(false);
        expect(inWater(waters, 1201, 1000, 10)).toBe(true); // padding widens it
        expect(inWater(waters, 1000, 1099)).toBe(true);
        expect(inWater(waters, 1000, 1101)).toBe(false);
    });

    it('biomeAt reports water inside ponds and meadow in the open', () => {
        const t = {
            biomes: [{ kind: 'forest' as const, x: 500, y: 500, rx: 300, ry: 300 }],
            waters: [{ x: 2000, y: 2000, rx: 200, ry: 100 }],
        };
        expect(biomeAt(t, 500, 500)).toBe('forest');
        expect(biomeAt(t, 2000, 2000)).toBe('water');
        expect(biomeAt(t, 3500, 400)).toBe('meadow');
    });
});
