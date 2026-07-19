/**
 * Creature AI — Tier 1 (believable individual behaviour) and Tier 2 (awareness
 * of other creatures). Pure and deterministic: no Phaser, no globals, no wall
 * clock. Each function takes the slice of the world a creature can perceive and
 * returns how it wants to move this frame; entities/WildCreature (and EnemyCell)
 * apply the result — movement, water, bounds, rendering — and the scene supplies
 * the perceived neighbours.
 *
 * Determinism: all randomness comes from an injected Rng-like `{ next() }`. In
 * game each creature owns a substream seeded from its own spawn data, so
 * behaviour never draws from the shared world-generation stream (which the seed
 * tests guard). In tests a fixed stub makes every decision reproducible.
 */

export type BehaviourState = 'graze' | 'rest' | 'wander' | 'flee' | 'return' | 'patrol' | 'chase';

/** The minimum a steering function needs to know about a creature. */
export interface Mover {
    x: number;
    y: number;
    /** Current travel heading, radians. */
    heading: number;
    /** Groups herd-mates for flocking; only same-species movers cohere. */
    speciesId: string;
}

export interface Point {
    x: number;
    y: number;
}

export interface RngLike {
    next(): number;
}

export interface Decision {
    /** Desired heading this frame, already eased toward from the current one. */
    heading: number;
    /** Travel speed in world units/second (0 = hold position). */
    speed: number;
    state: BehaviourState;
    /** Seconds remaining before a new calm state is picked. */
    stateTimer: number;
    /** Locked specifically onto the player — drives the HUD threat cue and ring. */
    chasingPlayer: boolean;
    /** Set when a herbivore just fled a threat — the position that scared it, so
     * the caller can lay down a danger memory (Tier 3). */
    threat?: Point | null;
}

/** A remembered fright a herbivore drifts away from (Tier 3, systems/ecology). */
export interface DangerLike {
    x: number;
    y: number;
    intensity: number;
}

const TAU = Math.PI * 2;
/** Eased turn rate (rad/sec) for calm movement; fleeing/chasing turn faster. */
const MAX_TURN = 3.2;
/** Random heading drift used by wandering. */
const WANDER_JITTER = 2.6;

// ---- Angle & distance helpers ---------------------------------------------

/** Normalise an angle to (-π, π]. */
export function wrapAngle(a: number): number {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
}

export function angleTo(from: Point, to: Point): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
}

export function dist(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Step `current` toward `target` by at most `maxDelta`, along the shortest arc. */
export function turnToward(current: number, target: number, maxDelta: number): number {
    const diff = wrapAngle(target - current);
    if (Math.abs(diff) <= maxDelta) return wrapAngle(target);
    return wrapAngle(current + Math.sign(diff) * maxDelta);
}

/** Interpolate from angle `a` toward `b` by fraction `t` along the shortest arc. */
export function blendAngle(a: number, b: number, t: number): number {
    return wrapAngle(a + wrapAngle(b - a) * t);
}

/** Nearest item within `maxDist`. Loops with no allocation beyond the result. */
export function nearestOf<T extends Point>(
    from: Point,
    items: readonly T[],
    maxDist = Infinity,
): { item: T; dist: number } | null {
    let best: T | null = null;
    let bestD = maxDist;
    for (const it of items) {
        const d = Math.hypot(from.x - it.x, from.y - it.y);
        if (d < bestD) {
            bestD = d;
            best = it;
        }
    }
    return best ? { item: best, dist: bestD } : null;
}

function norm(x: number, y: number): [number, number] {
    const m = Math.hypot(x, y);
    return m < 1e-6 ? [0, 0] : [x / m, y / m];
}

export interface FlockOpts {
    /** Only same-species movers within this radius influence steering. */
    neighbourRadius: number;
    /** Below this gap, movers actively push apart. */
    separationRadius: number;
    weightSeparation: number;
    weightAlignment: number;
    weightCohesion: number;
}

/** Herd steering (Reynolds boids): separation + alignment + cohesion combined
 * into a single desired heading. Same-species only; skips `self` by identity.
 * Returns null when no herd-mate is in range (nothing to steer toward). */
export function flockHeading(self: Mover, herd: readonly Mover[], opts: FlockOpts): number | null {
    let aliX = 0, aliY = 0, cohX = 0, cohY = 0, sepX = 0, sepY = 0, n = 0;
    for (const m of herd) {
        if (m === self || m.speciesId !== self.speciesId) continue;
        const dx = self.x - m.x;
        const dy = self.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d > opts.neighbourRadius) continue;
        n++;
        aliX += Math.cos(m.heading);
        aliY += Math.sin(m.heading);
        cohX += m.x;
        cohY += m.y;
        if (d < opts.separationRadius && d > 1e-4) {
            const w = (opts.separationRadius - d) / opts.separationRadius;
            sepX += (dx / d) * w;
            sepY += (dy / d) * w;
        }
    }
    if (n === 0) return null;
    cohX = cohX / n - self.x;
    cohY = cohY / n - self.y;
    const [ax, ay] = norm(aliX, aliY);
    const [cx, cy] = norm(cohX, cohY);
    const [sx, sy] = norm(sepX, sepY);
    const vx = ax * opts.weightAlignment + cx * opts.weightCohesion + sx * opts.weightSeparation;
    const vy = ay * opts.weightAlignment + cy * opts.weightCohesion + sy * opts.weightSeparation;
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) return null;
    return Math.atan2(vy, vx);
}

/** Loose cohesion that keeps a grazing herd together. */
const HERD_FLOCK: FlockOpts = { neighbourRadius: 260, separationRadius: 72, weightSeparation: 1.5, weightAlignment: 0.6, weightCohesion: 0.7 };
/** Pure separation so a panicking herd fans out instead of stacking. */
const SCATTER_FLOCK: FlockOpts = { neighbourRadius: 130, separationRadius: 96, weightSeparation: 1, weightAlignment: 0, weightCohesion: 0 };
/** How far a remembered danger keeps a grazing herd away (Tier 3). */
const DANGER_AVOID_RADIUS = 340;

// ---- Role deciders ---------------------------------------------------------

export interface HerbivoreInput {
    self: Mover;
    home: Point;
    /** All nearby herbivores (may include self and other species — filtered). */
    herd: readonly Mover[];
    /** Predator positions to flee from. */
    predators: readonly Point[];
    player: Point;
    def: { wanderSpeed: number; runSpeed: number; detectRadius: number; homeLeash: number };
    state: BehaviourState;
    stateTimer: number;
    dt: number;
    rng: RngLike;
    /** A remembered fright to drift grazing away from (Tier 3). */
    danger?: DangerLike | null;
}

/**
 * Herbivore: graze/rest/wander around home on a timed cycle (Tier 1), bolt from
 * the nearest danger — a predator OR the player — and fan out as a herd while
 * fleeing, and loosely stay together via cohesion while calm (Tier 2). While
 * calm it also drifts away from any remembered danger spot (Tier 3), so a herd
 * that has been hunted relocates off the hot ground.
 */
export function decideHerbivore(inp: HerbivoreInput): Decision {
    const { self, home, herd, predators, player, def, dt, rng, danger } = inp;

    // Tier 2 — flee the nearest threat (a predator or the player).
    const nearPred = nearestOf(self, predators, def.detectRadius);
    const playerD = dist(self, player);
    let threat: Point | null = null;
    let threatD = Infinity;
    if (nearPred) {
        threat = nearPred.item;
        threatD = nearPred.dist;
    }
    if (playerD <= def.detectRadius && playerD < threatD) {
        threat = player;
    }
    if (threat) {
        const away = angleTo(threat, self); // threat → self = directly away
        const scatter = flockHeading(self, herd, SCATTER_FLOCK);
        const heading = scatter != null ? blendAngle(away, scatter, 0.25) : away;
        // Report the fright so the caller can lay down a danger memory.
        return { heading: turnToward(self.heading, heading, MAX_TURN * 2 * dt), speed: def.runSpeed, state: 'flee', stateTimer: 0.5, chasingPlayer: false, threat: { x: threat.x, y: threat.y } };
    }

    // Strayed too far from the grazing grounds — head home.
    if (dist(self, home) > def.homeLeash) {
        const heading = turnToward(self.heading, angleTo(self, home), MAX_TURN * dt);
        return { heading, speed: def.wanderSpeed, state: 'return', stateTimer: 0, chasingPlayer: false };
    }

    // Tier 1 — calm state machine (graze / rest / wander) on a timed cycle.
    let state = inp.state;
    let timer = inp.stateTimer - dt;
    if (timer <= 0 || state === 'flee' || state === 'return') {
        const r = rng.next();
        state = r < 0.55 ? 'graze' : r < 0.78 ? 'rest' : 'wander';
        timer = state === 'graze' ? 2 + rng.next() * 3 : state === 'rest' ? 1.5 + rng.next() * 2 : 1.5 + rng.next() * 2.5;
    }

    // Tier 2 — cohesion keeps the herd loosely together.
    const flock = flockHeading(self, herd, HERD_FLOCK);
    // Tier 3 — steer away from a remembered danger spot while it is still felt.
    let avoid: number | null = null;
    if (danger && danger.intensity > 0.25 && dist(self, danger) < DANGER_AVOID_RADIUS) {
        avoid = angleTo(danger, self); // danger → self = away from it
    }

    let heading = self.heading;
    let speed = 0;
    if (state === 'wander') {
        const drift = self.heading + (rng.next() - 0.5) * WANDER_JITTER * dt * 4;
        let target = flock != null ? blendAngle(drift, flock, 0.45) : drift;
        if (avoid != null) target = blendAngle(target, avoid, 0.4 * danger!.intensity);
        heading = turnToward(self.heading, target, MAX_TURN * dt);
        speed = def.wanderSpeed;
    } else if (avoid != null) {
        // Danger lingers on the grazing ground — drift off it rather than settle.
        heading = turnToward(self.heading, avoid, MAX_TURN * 0.6 * dt);
        speed = def.wanderSpeed * 0.5;
    } else {
        // graze/rest: mostly still, drifting gently toward the herd if it moves off.
        if (flock != null) heading = turnToward(self.heading, flock, MAX_TURN * 0.4 * dt);
        speed = state === 'graze' ? def.wanderSpeed * 0.14 : 0;
    }
    return { heading, speed, state, stateTimer: timer, chasingPlayer: false };
}

export interface PredatorInput {
    self: Mover;
    home: Point;
    /** Herbivore positions the predator may stalk. */
    prey: readonly Point[];
    player: Point;
    def: { wanderSpeed: number; runSpeed: number; detectRadius: number; territoryRadius: number };
    state: BehaviourState;
    stateTimer: number;
    dt: number;
    rng: RngLike;
    /** Tier 3 hunger drive: when false (a sated predator) it won't stalk prey.
     * Defaults to true so callers that don't model energy behave as before. */
    huntPrey?: boolean;
}

/**
 * Predator: patrols its den (Tier 1), locks onto the player when it enters the
 * territory, and — only while hungry (Tier 3 `huntPrey`) — stalks the nearest
 * herbivore that strays into range (Tier 2). A leash keeps pursuit inside the
 * territory so hunts stay local: predators lunge, scatter a herd, then peel back
 * toward the den. Player defence is independent of hunger, so difficulty for the
 * player is unchanged whether the predator is fed or starving.
 */
export function decidePredator(inp: PredatorInput): Decision {
    const { self, home, prey, player, def, dt, rng } = inp;
    const huntPrey = inp.huntPrey ?? true;
    const distHome = dist(self, home);
    const canPursue = distHome <= def.territoryRadius * 1.15;

    // The player is both threat and prize — prioritise it inside the territory.
    if (canPursue && dist(player, home) <= def.territoryRadius && dist(self, player) <= def.detectRadius) {
        const heading = turnToward(self.heading, angleTo(self, player), MAX_TURN * dt);
        return { heading, speed: def.runSpeed, state: 'chase', stateTimer: 0, chasingPlayer: true };
    }
    // Otherwise, if hungry, stalk the nearest herbivore in the territory.
    if (canPursue && huntPrey) {
        const target = nearestOf(self, prey, def.detectRadius);
        if (target && dist(target.item, home) <= def.territoryRadius) {
            const heading = turnToward(self.heading, angleTo(self, target.item), MAX_TURN * dt);
            return { heading, speed: def.runSpeed * 0.92, state: 'chase', stateTimer: 0, chasingPlayer: false };
        }
    }

    // Drifted to the edge — pull back toward the den.
    if (distHome > def.territoryRadius * 0.8) {
        const heading = turnToward(self.heading, angleTo(self, home), MAX_TURN * dt);
        return { heading, speed: def.wanderSpeed, state: 'return', stateTimer: 0, chasingPlayer: false };
    }

    // Patrol: a slow, smooth wander around the den.
    let timer = inp.stateTimer - dt;
    if (timer <= 0) timer = 1.5 + rng.next() * 2;
    const drift = self.heading + (rng.next() - 0.5) * WANDER_JITTER * dt * 3;
    const heading = turnToward(self.heading, drift, MAX_TURN * 0.7 * dt);
    return { heading, speed: def.wanderSpeed, state: 'patrol', stateTimer: timer, chasingPlayer: false };
}

/**
 * A lone smooth wanderer (unjoined kin, drifting cells): no goals, just organic
 * heading drift instead of the old jittery random flick.
 */
export function decideWander(self: Mover, wanderSpeed: number, stateTimer: number, dt: number, rng: RngLike): Decision {
    const drift = self.heading + (rng.next() - 0.5) * WANDER_JITTER * dt * 3;
    const heading = turnToward(self.heading, drift, MAX_TURN * 0.6 * dt);
    return { heading, speed: wanderSpeed, state: 'wander', stateTimer: stateTimer - dt, chasingPlayer: false };
}
