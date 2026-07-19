import { describe, it, expect } from 'vitest';
import {
    wrapAngle,
    angleTo,
    turnToward,
    blendAngle,
    nearestOf,
    flockHeading,
    decideHerbivore,
    decidePredator,
    decideWander,
    type Mover,
    type HerbivoreInput,
    type PredatorInput,
} from './creatureBehaviour';

/** A deterministic rng stub cycling through fixed values (default mid-range). */
const rngOf = (...values: number[]) => {
    let i = 0;
    return { next: () => (values.length ? values[i++ % values.length] : 0.5) };
};

const mover = (x: number, y: number, heading = 0, speciesId = 'a'): Mover => ({ x, y, heading, speciesId });

const HERB_DEF = { wanderSpeed: 40, runSpeed: 260, detectRadius: 220, homeLeash: 300 };
const PRED_DEF = { wanderSpeed: 60, runSpeed: 280, detectRadius: 420, territoryRadius: 560 };

function herbInput(over: Partial<HerbivoreInput> = {}): HerbivoreInput {
    return {
        self: mover(0, 0),
        home: { x: 0, y: 0 },
        herd: [],
        predators: [],
        player: { x: 10_000, y: 10_000 }, // far away by default
        def: HERB_DEF,
        state: 'graze',
        stateTimer: 5,
        dt: 0.1,
        rng: rngOf(0.5),
        ...over,
    };
}

function predInput(over: Partial<PredatorInput> = {}): PredatorInput {
    return {
        self: mover(0, 0),
        home: { x: 0, y: 0 },
        prey: [],
        player: { x: 10_000, y: 10_000 },
        def: PRED_DEF,
        state: 'patrol',
        stateTimer: 5,
        dt: 0.1,
        rng: rngOf(0.5),
        ...over,
    };
}

describe('angle helpers', () => {
    it('wraps angles into (-π, π]', () => {
        expect(wrapAngle(0)).toBeCloseTo(0);
        expect(wrapAngle(Math.PI * 2)).toBeCloseTo(0);
        // ±π are the same heading; accept either sign at that boundary.
        expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI);
        expect(Math.abs(wrapAngle(-Math.PI * 3))).toBeCloseTo(Math.PI);
        expect(wrapAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    });

    it('angleTo points from source toward target', () => {
        expect(angleTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
        expect(angleTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
    });

    it('turnToward steps by at most maxDelta and snaps when within reach', () => {
        expect(turnToward(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
        expect(turnToward(0, 0.05, 0.1)).toBeCloseTo(0.05);
        // Shortest arc across the ±π seam: from 3.0 toward -3.0 goes the short way up.
        expect(turnToward(3.0, -3.0, 0.1)).toBeCloseTo(3.1);
    });

    it('blendAngle interpolates along the shortest arc', () => {
        expect(blendAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4);
        expect(Math.abs(blendAngle(3.0, -3.0, 0.5))).toBeCloseTo(Math.PI, 1);
    });
});

describe('nearestOf', () => {
    it('returns the nearest item and its distance', () => {
        const found = nearestOf({ x: 0, y: 0 }, [{ x: 10, y: 0 }, { x: 3, y: 4 }, { x: 100, y: 0 }]);
        expect(found?.item).toEqual({ x: 3, y: 4 });
        expect(found?.dist).toBeCloseTo(5);
    });

    it('respects the max distance and returns null when nothing is in range', () => {
        expect(nearestOf({ x: 0, y: 0 }, [{ x: 100, y: 0 }], 50)).toBeNull();
        expect(nearestOf({ x: 0, y: 0 }, [], 50)).toBeNull();
    });
});

describe('flockHeading', () => {
    it('steers away from a close same-species neighbour (separation)', () => {
        const self = mover(0, 0);
        // Herd-mate just to the right and close → steer left (≈ π).
        const heading = flockHeading(self, [self, mover(20, 0)], {
            neighbourRadius: 300, separationRadius: 100, weightSeparation: 2, weightAlignment: 0, weightCohesion: 0,
        });
        expect(heading).not.toBeNull();
        expect(Math.abs(wrapAngle(heading! - Math.PI))).toBeLessThan(0.01);
    });

    it('steers toward the herd centroid (cohesion)', () => {
        const self = mover(0, 0);
        // Two mates up and to the right → cohesion heads toward them (≈ π/4).
        const heading = flockHeading(self, [self, mover(100, 100), mover(120, 100)], {
            neighbourRadius: 400, separationRadius: 10, weightSeparation: 0, weightAlignment: 0, weightCohesion: 1,
        });
        expect(heading).toBeCloseTo(Math.PI / 4, 1);
    });

    it('ignores other species and skips self, returning null when alone', () => {
        const self = mover(0, 0, 0, 'a');
        expect(flockHeading(self, [self], HERD)).toBeNull();
        expect(flockHeading(self, [self, mover(20, 0, 0, 'b')], HERD)).toBeNull();
    });

    const HERD = { neighbourRadius: 300, separationRadius: 80, weightSeparation: 1, weightAlignment: 1, weightCohesion: 1 };
});

describe('decideHerbivore', () => {
    it('grazes calmly and nearly still when no threat is near', () => {
        const d = decideHerbivore(herbInput({ state: 'graze', stateTimer: 5 }));
        expect(d.state).toBe('graze');
        expect(d.speed).toBeLessThan(HERB_DEF.wanderSpeed); // a slow nibble, not a run
        expect(d.chasingPlayer).toBe(false);
    });

    it('flees directly away from a predator within detect range', () => {
        // Predator to the right → flee left (heading ≈ π), at run speed. dt=1 so
        // the eased turn reaches the target in one step, making direction exact.
        const d = decideHerbivore(herbInput({ predators: [{ x: 120, y: 0 }], dt: 1 }));
        expect(d.state).toBe('flee');
        expect(d.speed).toBe(HERB_DEF.runSpeed);
        expect(Math.abs(wrapAngle(d.heading - Math.PI))).toBeLessThan(0.4);
    });

    it('also flees the player when the player is the nearest threat', () => {
        const d = decideHerbivore(herbInput({ player: { x: 0, y: 100 }, dt: 1 }));
        expect(d.state).toBe('flee');
        // Player below → flee upward (heading ≈ -π/2).
        expect(Math.abs(wrapAngle(d.heading - -Math.PI / 2))).toBeLessThan(0.4);
    });

    it('does not flee a predator beyond detect range', () => {
        const d = decideHerbivore(herbInput({ predators: [{ x: HERB_DEF.detectRadius + 50, y: 0 }] }));
        expect(d.state).not.toBe('flee');
    });

    it('returns home when it has strayed past the leash', () => {
        const d = decideHerbivore(herbInput({ self: mover(HERB_DEF.homeLeash + 100, 0), home: { x: 0, y: 0 }, dt: 1 }));
        expect(d.state).toBe('return');
        // Home is to the left → head left (≈ π).
        expect(Math.abs(wrapAngle(d.heading - Math.PI))).toBeLessThan(0.4);
    });

    it('is deterministic for identical inputs and rng', () => {
        const a = decideHerbivore(herbInput({ state: 'wander', stateTimer: 5, rng: rngOf(0.9, 0.1) }));
        const b = decideHerbivore(herbInput({ state: 'wander', stateTimer: 5, rng: rngOf(0.9, 0.1) }));
        expect(a).toEqual(b);
    });

    it('reports the threat that scared it so a danger memory can be laid down', () => {
        const d = decideHerbivore(herbInput({ predators: [{ x: 100, y: 0 }] }));
        expect(d.state).toBe('flee');
        expect(d.threat).toEqual({ x: 100, y: 0 });
    });

    it('drifts away from a remembered danger while grazing (Tier 3)', () => {
        // No live threat, but it remembers being frightened just to the right.
        const d = decideHerbivore(herbInput({
            state: 'graze', stateTimer: 5, danger: { x: 200, y: 0, intensity: 1 }, dt: 2,
        }));
        expect(d.speed).toBeGreaterThan(0); // won't settle on the danger spot
        // Danger to the right → drift left (heading ≈ π).
        expect(Math.abs(wrapAngle(d.heading - Math.PI))).toBeLessThan(0.4);
    });

    it('ignores a faded danger memory', () => {
        const d = decideHerbivore(herbInput({ state: 'rest', stateTimer: 5, danger: { x: 200, y: 0, intensity: 0.1 } }));
        expect(d.speed).toBe(0); // resting undisturbed
    });
});

describe('decidePredator', () => {
    it('locks onto the player inside its territory and flags chasingPlayer', () => {
        const d = decidePredator(predInput({ player: { x: 200, y: 0 }, dt: 1 }));
        expect(d.state).toBe('chase');
        expect(d.chasingPlayer).toBe(true);
        expect(d.speed).toBe(PRED_DEF.runSpeed);
        expect(Math.abs(wrapAngle(d.heading - 0))).toBeLessThan(0.4); // toward the player (right)
    });

    it('stalks the nearest prey when no player is near, without the player flag', () => {
        const d = decidePredator(predInput({ prey: [{ x: 0, y: 150 }], dt: 1 }));
        expect(d.state).toBe('chase');
        expect(d.chasingPlayer).toBe(false);
        expect(Math.abs(wrapAngle(d.heading - Math.PI / 2))).toBeLessThan(0.4); // toward prey (down)
    });

    it('will not pursue past the territory leash', () => {
        // Sitting well outside its own territory: it must return, not chase.
        const d = decidePredator(predInput({
            self: mover(PRED_DEF.territoryRadius * 1.3, 0),
            player: { x: PRED_DEF.territoryRadius * 1.3 + 50, y: 0 }, // player right next to it, but home is far
        }));
        expect(d.state).toBe('return');
        expect(d.chasingPlayer).toBe(false);
    });

    it('patrols with a bounded wander when idle', () => {
        const d = decidePredator(predInput({ state: 'patrol', stateTimer: 5 }));
        expect(d.state).toBe('patrol');
        expect(d.speed).toBe(PRED_DEF.wanderSpeed);
    });

    it('a sated predator (huntPrey false) ignores prey but still patrols', () => {
        const d = decidePredator(predInput({ prey: [{ x: 0, y: 150 }], huntPrey: false }));
        expect(d.state).toBe('patrol');
    });

    it('a sated predator still defends its territory against the player', () => {
        const d = decidePredator(predInput({ player: { x: 200, y: 0 }, huntPrey: false, dt: 1 }));
        expect(d.state).toBe('chase');
        expect(d.chasingPlayer).toBe(true);
    });
});

describe('decideWander', () => {
    it('drifts at wander speed and eases the heading', () => {
        const d = decideWander(mover(0, 0, 0), 55, 3, 0.1, rngOf(0.9));
        expect(d.state).toBe('wander');
        expect(d.speed).toBe(55);
        // A single 0.1s step can only turn the heading a little.
        expect(Math.abs(wrapAngle(d.heading))).toBeLessThan(0.4);
    });
});
