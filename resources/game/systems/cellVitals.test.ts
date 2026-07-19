import { describe, it, expect } from 'vitest';
import {
    initialVitals,
    tickVitals,
    absorbMote,
    damage,
    objectiveProgress,
    isStageComplete,
    isStageFailed,
} from './cellVitals';
import { CELL } from '../config';

describe('cellVitals', () => {
    it('starts at configured values', () => {
        const v = initialVitals();
        expect(v.energy).toBe(CELL.energyStart);
        expect(v.integrity).toBe(CELL.integrityStart);
        expect(v.absorbed).toBe(0);
    });

    it('drains more energy while moving than idle', () => {
        const base = initialVitals();
        const moving = tickVitals(base, 1, true);
        const idle = tickVitals(base, 1, false);
        expect(moving.energy).toBeLessThan(idle.energy);
    });

    it('clamps energy at 0 and does not exceed 100', () => {
        let v = { ...initialVitals(), energy: 1 };
        v = tickVitals(v, 10, true); // huge drain
        expect(v.energy).toBe(0);

        let full = { ...initialVitals(), integrity: 100 };
        full = tickVitals(full, 5, false);
        expect(full.integrity).toBeLessThanOrEqual(100);
    });

    it('absorbing a mote raises energy, evolution and count', () => {
        const v = absorbMote(initialVitals());
        expect(v.energy).toBe(Math.min(100, CELL.energyStart + CELL.energyPerMote));
        expect(v.evolution).toBe(CELL.evolutionPerMote);
        expect(v.absorbed).toBe(1);
    });

    it('a rich mote (multiplier) grants more evolution', () => {
        const base = absorbMote(initialVitals());
        const rich = absorbMote(initialVitals(), undefined, 3);
        expect(rich.evolution).toBe(base.evolution * 3);
    });

    it('completes the stage at the objective target', () => {
        let v = initialVitals();
        for (let i = 0; i < CELL.objectiveTarget; i++) v = absorbMote(v);
        expect(isStageComplete(v)).toBe(true);
        expect(objectiveProgress(v)).toBe(1);
    });

    it('damage reduces integrity and clamps at zero', () => {
        const v = { ...initialVitals(), integrity: 30 };
        expect(damage(v, 18).integrity).toBe(12);
        expect(damage(v, 100).integrity).toBe(0);
    });

    it('fails only when integrity reaches zero (soft failure)', () => {
        expect(isStageFailed({ ...initialVitals(), integrity: 0 })).toBe(true);
        expect(isStageFailed({ ...initialVitals(), integrity: 1 })).toBe(false);
        // low energy alone does not fail the stage
        expect(isStageFailed({ ...initialVitals(), energy: 0, integrity: 40 })).toBe(false);
    });
});
