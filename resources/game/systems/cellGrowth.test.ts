import { describe, it, expect } from 'vitest';
import { tierFor, nextTierAt, canEat, threatens, shouldHunt, shouldFlee, contactDamage, type PreyLike } from './cellGrowth';
import { CELL } from '../config';
import { ENEMY_CELLS } from '../data/sprites/cellSprites';

const species = (over: Partial<PreyLike>): PreyLike => ({
    tier: 1, passive: false, hunts: false, flees: false, damage: 10, ...over,
});

// Derived from config rather than hardcoded, so adding a growth tier is a
// config change and not a test rewrite.
const THRESHOLDS = CELL.tierThresholds;
const MAX_TIER = THRESHOLDS.length;

describe('cellGrowth tiers', () => {
    it('maps absorbed counts onto every configured tier', () => {
        expect(tierFor(0)).toBe(1);
        THRESHOLDS.forEach((threshold, i) => {
            const tier = i + 1;
            expect(tierFor(threshold)).toBe(tier);
            if (i > 0) expect(tierFor(threshold - 1)).toBe(tier - 1);
        });
        expect(tierFor(9999)).toBe(MAX_TIER);
    });

    it('reports the next threshold, and null at max tier', () => {
        for (let i = 0; i < THRESHOLDS.length - 1; i++) {
            expect(nextTierAt(THRESHOLDS[i])).toBe(THRESHOLDS[i + 1]);
        }
        expect(nextTierAt(THRESHOLDS[MAX_TIER - 1])).toBeNull();
    });

    it('reaching the objective implies max tier (completion always shows the top tier)', () => {
        expect(tierFor(CELL.objectiveTarget)).toBe(MAX_TIER);
    });

    it('tier arrays stay the same length, or the scene reads past the end', () => {
        expect(CELL.tierScale.length).toBe(MAX_TIER);
        expect(CELL.tierZoom.length).toBe(MAX_TIER);
    });
});

describe('predation rules', () => {
    it('passive species are edible at equal tier, hostile ones only below', () => {
        expect(canEat(1, species({ tier: 1, passive: true }))).toBe(true);
        expect(canEat(1, species({ tier: 1, passive: false }))).toBe(false);
        expect(canEat(2, species({ tier: 1, passive: false }))).toBe(true);
        expect(canEat(3, species({ tier: 3, passive: false }))).toBe(false);
    });

    it('threatens only when hostile, inedible and damaging', () => {
        expect(threatens(1, species({ tier: 2, damage: 16 }))).toBe(true);
        expect(threatens(3, species({ tier: 2, damage: 16 }))).toBe(false); // now prey
        expect(threatens(1, species({ tier: 1, passive: true, damage: 0 }))).toBe(false);
    });

    it('hunters chase at or below their tier; fleers run from what can eat them', () => {
        const stalker = species({ tier: 2, hunts: true });
        expect(shouldHunt(1, stalker)).toBe(true);
        expect(shouldHunt(2, stalker)).toBe(true);
        expect(shouldHunt(3, stalker)).toBe(false);
        const darter = species({ tier: 1, passive: true, flees: true });
        expect(shouldFlee(1, darter)).toBe(true);
        expect(shouldFlee(0, darter)).toBe(false);
    });

    it('defense blunts contact damage with a floor', () => {
        expect(contactDamage(16, 5)).toBe(11);
        expect(contactDamage(16, 30)).toBe(3);
    });

    it('the bestiary flips the food chain across tiers', () => {
        const byId = Object.fromEntries(ENEMY_CELLS.map((d) => [d.id, d]));
        // The stalker hunts a tier-1 player but is prey to a tier-3 player.
        expect(shouldHunt(1, byId.stalker)).toBe(true);
        expect(canEat(3, byId.stalker)).toBe(true);
        // Apex threats never become food.
        expect(canEat(3, byId.jelly_giant)).toBe(false);
        expect(canEat(3, byId.apex_lancer)).toBe(false);
        // Something is edible from the very start.
        expect(ENEMY_CELLS.some((d) => canEat(1, d))).toBe(true);
    });
});
