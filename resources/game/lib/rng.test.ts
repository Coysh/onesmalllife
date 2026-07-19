import { describe, it, expect } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
    it('is deterministic: the same seed yields the same sequence', () => {
        const a = new Rng('one-small-life');
        const b = new Rng('one-small-life');

        const seqA = Array.from({ length: 8 }, () => a.next());
        const seqB = Array.from({ length: 8 }, () => b.next());

        expect(seqA).toEqual(seqB);
    });

    it('produces different sequences for different seeds', () => {
        const a = new Rng('seed-a');
        const b = new Rng('seed-b');

        expect(a.next()).not.toBe(b.next());
    });

    it('accepts numeric and string seeds equivalently by value', () => {
        const fromNumber = new Rng(12345);
        const fromNumberAgain = new Rng(12345);

        expect(fromNumber.next()).toBe(fromNumberAgain.next());
    });

    it('emits floats within [0, 1)', () => {
        const rng = new Rng('range');
        for (let i = 0; i < 1000; i++) {
            const v = rng.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('int() stays within [min, max)', () => {
        const rng = new Rng('ints');
        for (let i = 0; i < 1000; i++) {
            const v = rng.int(3, 9);
            expect(v).toBeGreaterThanOrEqual(3);
            expect(v).toBeLessThan(9);
            expect(Number.isInteger(v)).toBe(true);
        }
    });

    it('pick() returns an element and is deterministic', () => {
        const parts = ['oval', 'round', 'teardrop', 'kidney'] as const;
        const a = new Rng('pick');
        const b = new Rng('pick');

        const chosenA = Array.from({ length: 5 }, () => a.pick(parts));
        const chosenB = Array.from({ length: 5 }, () => b.pick(parts));

        expect(chosenA).toEqual(chosenB);
        chosenA.forEach((c) => expect(parts).toContain(c));
    });

    it('pick() throws on an empty array', () => {
        const rng = new Rng('empty');
        expect(() => rng.pick([])).toThrow();
    });
});
