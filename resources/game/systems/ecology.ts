/**
 * Creature AI — Tier 3: emergent ecology. Pure, deterministic drives layered on
 * top of the Tier 1/2 steering in systems/creatureBehaviour:
 *  - predator hunger: energy drains over time and is replenished by a kill, so
 *    a fed predator rests (ignores prey) and a hungry one hunts — the engine of
 *    the predator/prey rhythm;
 *  - population homeostasis: eaten herbivores respawn on a delay that scales with
 *    how full their species is, so a herd thins under heavy predation and
 *    recovers when it eases — bounded swings that can neither go extinct nor
 *    explode (the pool is fixed, deaths are always temporary);
 *  - danger memory: herbivores remember where they were last frightened and
 *    drift their grazing away from it, so the map's danger hot-spots move.
 *
 * Everything here is a number-in/number-out function so it is fully unit tested
 * and never touches Phaser, the clock, or the shared RNG stream.
 */

export interface PredatorEnergyParams {
    max: number;
    /** Energy lost per second just by living. */
    drain: number;
    /** Energy gained from catching one herbivore. */
    killGain: number;
    /** Below this, a resting predator starts hunting again. */
    huntThreshold: number;
    /** Above this, a hunting predator is sated and stops chasing prey. */
    restThreshold: number;
}

/** Sensible defaults tuned for a ~14s hunt→feed→rest→hunt cycle. */
export const PREDATOR_ENERGY: PredatorEnergyParams = {
    max: 100,
    drain: 3.2,
    killGain: 55,
    huntThreshold: 55,
    restThreshold: 85,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Drain a predator's energy for one frame (floored at 0). */
export function tickPredatorEnergy(energy: number, dt: number, p: PredatorEnergyParams = PREDATOR_ENERGY): number {
    return clamp(energy - p.drain * dt, 0, p.max);
}

/** Replenish energy from a catch (capped at max). */
export function feedPredator(energy: number, p: PredatorEnergyParams = PREDATOR_ENERGY): number {
    return clamp(energy + p.killGain, 0, p.max);
}

/**
 * Hysteresis so a predator commits to hunting instead of flickering at a single
 * threshold: it begins hunting once energy falls below `huntThreshold` and only
 * gives up once a kill pushes it back above `restThreshold`.
 */
export function updateHuntDrive(hunting: boolean, energy: number, p: PredatorEnergyParams = PREDATOR_ENERGY): boolean {
    if (energy <= p.huntThreshold) return true;
    if (energy >= p.restThreshold) return false;
    return hunting;
}

/**
 * How long an eaten herbivore stays gone before respawning. Scales with how full
 * the species already is: a thinned population (`alive` well below `baseline`)
 * recovers quickly, a full one respawns slowly. Bounds the swing — the pool size
 * caps growth, and deaths are never permanent, so nothing goes extinct.
 */
export function respawnDelay(alive: number, baseline: number, minDelay: number, maxDelay: number): number {
    if (baseline <= 0) return maxDelay;
    const fullness = clamp(alive / baseline, 0, 1);
    return minDelay + (maxDelay - minDelay) * fullness;
}

export interface DangerMemory {
    x: number;
    y: number;
    /** 0 (forgotten) … 1 (just frightened here). */
    intensity: number;
}

export const NO_DANGER: DangerMemory = { x: 0, y: 0, intensity: 0 };

/** Fade a danger memory toward nothing with a fixed half-life. */
export function decayDanger(m: DangerMemory, dt: number, halfLifeSec: number): DangerMemory {
    if (m.intensity <= 1e-3) return NO_DANGER;
    const factor = Math.pow(0.5, dt / halfLifeSec);
    return { x: m.x, y: m.y, intensity: m.intensity * factor };
}

/**
 * Record a fresh fright at (x, y): snap the remembered spot to the new danger
 * and reinforce its intensity (capped at 1).
 */
export function rememberDanger(m: DangerMemory, x: number, y: number, amount: number): DangerMemory {
    return { x, y, intensity: clamp(m.intensity + amount, 0, 1) };
}
