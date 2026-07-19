import { describe, it, expect } from 'vitest';
import { aggregatePartEffects, mergeEffects } from './partEffects';
import { DEFAULT_APPEARANCE, PART_SLOTS, partOptions, type AppearanceV2 } from '../data/cell-parts';
import { CELL, resolveCellTuning } from '../config';

describe('part catalogue', () => {
    it('every slot has options with unique ids', () => {
        for (const slot of PART_SLOTS) {
            const options = partOptions(slot);
            expect(options.length).toBeGreaterThanOrEqual(4);
            expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
        }
    });

    it('the default appearance resolves in every slot', () => {
        const agg = aggregatePartEffects(DEFAULT_APPEARANCE);
        expect(agg.combat.attack).toBeGreaterThan(0);
        expect(agg.combat.senseRadius).toBeGreaterThan(CELL.senseRadius); // default eyespot adds sense
    });
});

describe('aggregatePartEffects', () => {
    it('sums effects across slots into tuning + combat', () => {
        const speedy: AppearanceV2 = {
            ...DEFAULT_APPEARANCE, body: 'elongated', movement: 'jet', defense: 'none',
        };
        const tanky: AppearanceV2 = {
            ...DEFAULT_APPEARANCE, body: 'round', movement: 'pseudopods', defense: 'thick_wall', membrane: 'double',
        };
        const fast = aggregatePartEffects(speedy);
        const tank = aggregatePartEffects(tanky);

        expect(fast.effects.speedMultiplier!).toBeGreaterThan(tank.effects.speedMultiplier ?? 0);
        expect(tank.combat.defense).toBeGreaterThan(fast.combat.defense);
        // Speed builds pay for it in energy drain.
        expect(fast.effects.energyDrainPerSecMoving!).toBeGreaterThan(0);
    });

    it('feeds into resolveCellTuning like trait effects do', () => {
        const { effects } = aggregatePartEffects({ ...DEFAULT_APPEARANCE, movement: 'twin_flagella' });
        const tuning = resolveCellTuning(effects);
        expect(tuning.speed).toBeGreaterThan(CELL.speed);
    });

    it('handles missing/undefined appearance with base stats', () => {
        const agg = aggregatePartEffects(undefined);
        expect(agg.combat).toEqual({ attack: CELL.baseAttack, defense: CELL.baseDefense, senseRadius: CELL.senseRadius });
        expect(agg.effects.speedMultiplier ?? 0).toBe(0);
    });
});

describe('mergeEffects', () => {
    it('adds overlapping keys and keeps distinct ones', () => {
        const merged = mergeEffects(
            { speedMultiplier: 0.1, energyPerMote: 2 },
            { speedMultiplier: 0.05, integrityRegenPerSec: 1 },
        );
        expect(merged.speedMultiplier).toBeCloseTo(0.15);
        expect(merged.energyPerMote).toBe(2);
        expect(merged.integrityRegenPerSec).toBe(1);
    });
});
