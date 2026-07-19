/**
 * Creature-stage vitals: pure functions, unit-testable without Phaser.
 * Hunger runs 0 (full) → 100 (starving). Let hunger max out and health drains;
 * eat to relieve hunger and gather nourishment toward raising young. Soft
 * failure: only a health wipe-out fails the stage (brief §12).
 */
import { CREATURE, type CreatureTuning, resolveCreatureTuning } from '../config';

export interface CreatureVitals {
    health: number; // 0..100
    hunger: number; // 0..100 (0 = full)
    nourishment: number; // progress toward raising young
    evolution: number; // banked points to spend on creature adaptations
}

export function initialCreatureVitals(): CreatureVitals {
    return {
        health: CREATURE.healthStart,
        hunger: CREATURE.hungerStart,
        nourishment: 0,
        evolution: 0,
    };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const BASE_TUNING: CreatureTuning = resolveCreatureTuning();

export function tickCreatureVitals(
    v: CreatureVitals,
    dtSeconds: number,
    tuning: CreatureTuning = BASE_TUNING,
): CreatureVitals {
    const hunger = clamp(v.hunger + tuning.hungerRisePerSec * dtSeconds);

    let health = v.health;
    if (hunger >= 100) {
        health = clamp(health - CREATURE.healthDrainPerSecStarving * dtSeconds);
    } else if (hunger < CREATURE.hungerCalmThreshold) {
        health = clamp(health + tuning.healthRegenPerSec * dtSeconds);
    }

    return { ...v, hunger, health };
}

/** Take health damage (e.g. from a rival). */
export function damageCreature(v: CreatureVitals, amount: number): CreatureVitals {
    return { ...v, health: clamp(v.health - amount) };
}

/**
 * Eat a meal, scaling the nourishment/evolution it yields (hunger is always
 * fully relieved by a bite). Diet drives the multiplier: a herbivore's forage
 * and a carnivore's kill both feed, but by different amounts (see CreatureScene).
 */
export function eatWith(v: CreatureVitals, tuning: CreatureTuning = BASE_TUNING, nourishMult = 1): CreatureVitals {
    return {
        ...v,
        hunger: clamp(v.hunger - tuning.hungerReliefPerBite),
        nourishment: v.nourishment + tuning.nourishPerBite * nourishMult,
        // Each meal also banks a little evolution to spend on adaptations —
        // a separate currency from the nourishment objective, so evolving
        // never stalls raising your young.
        evolution: v.evolution + CREATURE.evolutionPerBite * nourishMult,
    };
}

export function eat(v: CreatureVitals, tuning: CreatureTuning = BASE_TUNING): CreatureVitals {
    return eatWith(v, tuning, 1);
}

/** Add nourishment (e.g. from foraging, or passively from a pack raising young). */
export function addNourishment(v: CreatureVitals, amount: number): CreatureVitals {
    return { ...v, nourishment: v.nourishment + amount };
}

/** Passive nourishment per second from a pack of the given size. */
export function packNourishRate(packSize: number): number {
    return packSize * CREATURE.packNourishPerSec;
}

export function creatureObjectiveProgress(v: CreatureVitals): number {
    return Math.min(1, v.nourishment / CREATURE.objectiveTarget);
}

export function isCreatureStageComplete(v: CreatureVitals): boolean {
    return v.nourishment >= CREATURE.objectiveTarget;
}

export function isCreatureStageFailed(v: CreatureVitals): boolean {
    return v.health <= 0;
}
