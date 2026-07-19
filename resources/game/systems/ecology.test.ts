import { describe, it, expect } from 'vitest';
import {
    PREDATOR_ENERGY,
    tickPredatorEnergy,
    feedPredator,
    updateHuntDrive,
    respawnDelay,
    decayDanger,
    rememberDanger,
    NO_DANGER,
} from './ecology';

describe('predator energy drive', () => {
    it('drains over time, floored at zero', () => {
        expect(tickPredatorEnergy(100, 1)).toBeCloseTo(100 - PREDATOR_ENERGY.drain);
        expect(tickPredatorEnergy(1, 100)).toBe(0); // huge dt can't go negative
    });

    it('a kill replenishes energy, capped at max', () => {
        expect(feedPredator(20)).toBeCloseTo(20 + PREDATOR_ENERGY.killGain);
        expect(feedPredator(90)).toBe(PREDATOR_ENERGY.max);
    });

    it('hunts when hungry and rests when sated, with hysteresis between', () => {
        // Below the hunt threshold → hunt regardless of prior state.
        expect(updateHuntDrive(false, 40)).toBe(true);
        // Above the rest threshold → stop hunting.
        expect(updateHuntDrive(true, 95)).toBe(false);
        // In the dead-band it keeps its current drive (no flicker).
        const mid = (PREDATOR_ENERGY.huntThreshold + PREDATOR_ENERGY.restThreshold) / 2;
        expect(updateHuntDrive(true, mid)).toBe(true);
        expect(updateHuntDrive(false, mid)).toBe(false);
    });

    it('completes a hunt → feed → rest → hunt cycle', () => {
        let energy = 60;
        let hunting = false;
        // Drain until hunting kicks in.
        for (let i = 0; i < 100 && !hunting; i++) {
            energy = tickPredatorEnergy(energy, 0.2);
            hunting = updateHuntDrive(hunting, energy);
        }
        expect(hunting).toBe(true);
        // A kill sates it and it rests.
        energy = feedPredator(energy);
        hunting = updateHuntDrive(hunting, energy);
        expect(hunting).toBe(false);
    });
});

describe('population homeostasis', () => {
    it('respawns fast when thinned, slow when full', () => {
        expect(respawnDelay(0, 4, 4, 14)).toBeCloseTo(4);    // wiped out → quickest recovery
        expect(respawnDelay(4, 4, 4, 14)).toBeCloseTo(14);   // full → slowest
        expect(respawnDelay(2, 4, 4, 14)).toBeCloseTo(9);    // half → midway
    });

    it('never returns less than the minimum or more than the maximum', () => {
        expect(respawnDelay(10, 4, 4, 14)).toBeCloseTo(14); // over baseline clamps to max
        expect(respawnDelay(0, 0, 4, 14)).toBeCloseTo(14);  // undefined baseline → max, no divide-by-zero
    });
});

describe('danger memory', () => {
    it('decays toward nothing with a half-life', () => {
        const m = { x: 100, y: 50, intensity: 1 };
        const half = decayDanger(m, 8, 8);
        expect(half.intensity).toBeCloseTo(0.5);
        expect(half.x).toBe(100); // position is retained while it fades
        // A tiny remnant snaps to the shared NO_DANGER sentinel.
        expect(decayDanger({ x: 1, y: 1, intensity: 1e-5 }, 1, 8)).toBe(NO_DANGER);
    });

    it('reinforces and relocates on a fresh fright, capped at 1', () => {
        const m = rememberDanger(NO_DANGER, 200, 0, 0.6);
        expect(m.intensity).toBeCloseTo(0.6);
        expect(m).toMatchObject({ x: 200, y: 0 });
        const again = rememberDanger(m, 250, 10, 0.6);
        expect(again.intensity).toBe(1); // capped
        expect(again).toMatchObject({ x: 250, y: 10 }); // snaps to the newest spot
    });
});
