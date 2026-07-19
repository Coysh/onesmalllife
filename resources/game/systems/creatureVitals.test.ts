import { describe, it, expect } from 'vitest';
import {
    initialCreatureVitals,
    tickCreatureVitals,
    eat,
    damageCreature,
    addNourishment,
    packNourishRate,
    creatureObjectiveProgress,
    isCreatureStageComplete,
    isCreatureStageFailed,
} from './creatureVitals';
import { CREATURE, resolveCreatureTuning } from '../config';

describe('creatureVitals', () => {
    it('starts at configured values', () => {
        const v = initialCreatureVitals();
        expect(v.health).toBe(CREATURE.healthStart);
        expect(v.hunger).toBe(CREATURE.hungerStart);
        expect(v.nourishment).toBe(0);
    });

    it('grows hungrier over time', () => {
        const v = tickCreatureVitals(initialCreatureVitals(), 1);
        expect(v.hunger).toBeGreaterThan(CREATURE.hungerStart);
    });

    it('drains health while starving', () => {
        const starving = { health: 50, hunger: 100, nourishment: 0, evolution: 0 };
        const after = tickCreatureVitals(starving, 1);
        expect(after.health).toBeLessThan(50);
    });

    it('recovers health when well fed', () => {
        const fed = { health: 50, hunger: 10, nourishment: 0, evolution: 0 };
        const after = tickCreatureVitals(fed, 1);
        expect(after.health).toBeGreaterThan(50);
    });

    it('eating relieves hunger, adds nourishment, and banks evolution', () => {
        const start = { health: 80, hunger: 60, nourishment: 0, evolution: 0 };
        const after = eat(start);
        expect(after.hunger).toBeLessThan(60);
        expect(after.nourishment).toBe(1);
        expect(after.evolution).toBe(CREATURE.evolutionPerBite);
    });

    it('completes when nourishment reaches the target', () => {
        let v = initialCreatureVitals();
        for (let i = 0; i < CREATURE.objectiveTarget; i++) v = eat(v);
        expect(isCreatureStageComplete(v)).toBe(true);
        expect(creatureObjectiveProgress(v)).toBe(1);
    });

    it('a pack passively adds nourishment toward raising young', () => {
        expect(packNourishRate(0)).toBe(0);
        expect(packNourishRate(3)).toBeCloseTo(3 * CREATURE.packNourishPerSec);
        const v = addNourishment(initialCreatureVitals(), packNourishRate(4) * 2);
        expect(v.nourishment).toBeCloseTo(4 * CREATURE.packNourishPerSec * 2);
    });

    it('damageCreature reduces health and clamps at zero', () => {
        expect(damageCreature({ health: 30, hunger: 20, nourishment: 0, evolution: 0 }, 14).health).toBe(16);
        expect(damageCreature({ health: 10, hunger: 20, nourishment: 0, evolution: 0 }, 50).health).toBe(0);
    });

    it('fails only on a health wipe-out', () => {
        expect(isCreatureStageFailed({ health: 0, hunger: 100, nourishment: 0, evolution: 0 })).toBe(true);
        expect(isCreatureStageFailed({ health: 1, hunger: 100, nourishment: 0, evolution: 0 })).toBe(false);
    });

    it('inherited speed/efficiency traits improve the tuning', () => {
        const base = resolveCreatureTuning();
        const tuned = resolveCreatureTuning({ speedMultiplier: 0.2, energyPerMote: 5 });
        expect(tuned.speed).toBeGreaterThan(base.speed);
        expect(tuned.hungerReliefPerBite).toBeGreaterThan(base.hungerReliefPerBite);
    });
});
