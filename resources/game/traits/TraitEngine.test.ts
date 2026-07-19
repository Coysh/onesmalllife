import { describe, it, expect } from 'vitest';
import { TraitEngine } from './TraitEngine';
import { resolveCellTuning } from '../config';

const engine = new TraitEngine();

describe('TraitEngine', () => {
    it('loads the cell trait catalogue', () => {
        expect(engine.forStage('cell').length).toBeGreaterThan(3);
        expect(engine.get('biology:membrane_i')).toBeDefined();
    });

    it('locks a trait until its requirements are met', () => {
        const membraneII = engine.get('biology:membrane_ii')!;
        expect(engine.resolveState(membraneII, new Set())).toBe('locked');
        expect(engine.resolveState(membraneII, new Set(['biology:membrane_i']))).toBe('upgradable');
    });

    it('blocks a trait when a conflicting trait is owned', () => {
        const flagellum = engine.get('movement:flagellum')!;
        expect(engine.resolveState(flagellum, new Set(['movement:cilia']))).toBe('blocked');
        expect(engine.canAcquire(flagellum, new Set(['movement:cilia']), 99)).toBe(false);
    });

    it('marks owned traits selected and inherited traits inherited', () => {
        const curious = engine.get('cognition:curious')!;
        expect(engine.resolveState(curious, new Set(['cognition:curious']))).toBe('selected');
        expect(engine.resolveState(curious, new Set(), new Set(['cognition:curious']))).toBe('inherited');
    });

    it('respects point cost in canAcquire', () => {
        const filter = engine.get('feeding:filter')!; // cost 3
        expect(engine.canAcquire(filter, new Set(), 2)).toBe(false);
        expect(engine.canAcquire(filter, new Set(), 3)).toBe(true);
    });

    it('will not re-acquire an owned trait', () => {
        const cilia = engine.get('movement:cilia')!;
        expect(engine.canAcquire(cilia, new Set(['movement:cilia']), 99)).toBe(false);
    });

    it('aggregates effects and feeds them into cell tuning', () => {
        const owned = ['movement:flagellum', 'feeding:filter'];
        const effects = engine.aggregateEffects(owned);
        expect(effects.speedMultiplier).toBeCloseTo(0.28);
        expect(effects.energyPerMote).toBe(4);

        const base = resolveCellTuning();
        const tuned = resolveCellTuning(effects);
        expect(tuned.speed).toBeGreaterThan(base.speed);
        expect(tuned.energyPerMote).toBe(base.energyPerMote + 4);
    });

    it('ignores unknown trait ids when aggregating', () => {
        expect(engine.aggregateEffects(['does:not-exist'])).toEqual({});
    });
});
