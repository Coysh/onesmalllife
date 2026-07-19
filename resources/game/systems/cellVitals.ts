/**
 * Cell-stage vitals: pure functions so the rules are testable without Phaser.
 * The scene owns rendering and input; this owns the numbers.
 */
import { CELL, resolveCellTuning, type CellTuning } from '../config';

export interface Vitals {
    energy: number; // 0..100
    integrity: number; // 0..100
    evolution: number; // banked points
    absorbed: number; // motes absorbed this stage
}

export function initialVitals(): Vitals {
    return {
        energy: CELL.energyStart,
        integrity: CELL.integrityStart,
        evolution: 0,
        absorbed: 0,
    };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const BASE_TUNING: CellTuning = resolveCellTuning();

/** Advance vitals by dt seconds. Moving costs more energy; integrity slowly repairs. */
export function tickVitals(v: Vitals, dtSeconds: number, moving: boolean, tuning: CellTuning = BASE_TUNING): Vitals {
    const drainRate = moving ? tuning.energyDrainPerSecMoving : tuning.energyDrainPerSecIdle;
    let energy = v.energy - drainRate * dtSeconds;
    let integrity = v.integrity + tuning.integrityRegenPerSec * dtSeconds;

    // Starvation damages integrity rather than ending the run outright (soft failure).
    if (energy <= 0) {
        integrity += energy * 0.5; // energy is negative here → integrity drops
        energy = 0;
    }

    return { ...v, energy: clamp(energy), integrity: clamp(integrity) };
}

/** Take integrity damage (e.g. from a predator or toxin). */
export function damage(v: Vitals, amount: number): Vitals {
    return { ...v, integrity: clamp(v.integrity - amount) };
}

/** Absorb one nutrient mote. Rich motes pass a multiplier > 1. */
export function absorbMote(v: Vitals, tuning: CellTuning = BASE_TUNING, multiplier = 1): Vitals {
    return {
        ...v,
        energy: clamp(v.energy + tuning.energyPerMote * multiplier),
        evolution: v.evolution + tuning.evolutionPerMote * multiplier,
        absorbed: v.absorbed + 1,
    };
}

/** Eat a smaller cell: a bigger meal than a mote (growth counts several absorbs). */
export function absorbPrey(v: Vitals, tuning: CellTuning = BASE_TUNING, growth = 1, energy = 10): Vitals {
    return {
        ...v,
        energy: clamp(v.energy + energy),
        evolution: v.evolution + growth * tuning.evolutionPerMote,
        absorbed: v.absorbed + growth,
    };
}

/** Objective progress 0..1 toward reaching multicellular life. */
export function objectiveProgress(v: Vitals): number {
    return Math.min(1, v.absorbed / CELL.objectiveTarget);
}

/** The stage is failed only when no viable continuation remains (brief §12). */
export function isStageFailed(v: Vitals): boolean {
    return v.integrity <= 0;
}

export function isStageComplete(v: Vitals): boolean {
    return v.absorbed >= CELL.objectiveTarget;
}
