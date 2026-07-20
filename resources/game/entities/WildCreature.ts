import Phaser from 'phaser';
import { CREATURE, COLORS } from '../config';
import { Rng } from '../lib/rng';
import { inWater, type WaterBody } from '../systems/terrain';
import { wildTexture, type WildSpeciesDef } from '../data/sprites/creatureSprites';
import {
    decideHerbivore,
    decidePredator,
    decideWander,
    type BehaviourState,
    type Decision,
    type Mover,
} from '../systems/creatureBehaviour';
import {
    PREDATOR_ENERGY,
    tickPredatorEnergy,
    feedPredator,
    updateHuntDrive,
    decayDanger,
    rememberDanger,
    NO_DANGER,
    type DangerMemory,
} from '../systems/ecology';

/**
 * One wild animal of a species from data/sprites/creatureSprites. Movement is
 * decided by the pure systems/creatureBehaviour module (Tier 1 individual
 * behaviour + Tier 2 awareness of other creatures); this class only applies the
 * result — water/bounds collision, rotation, breathing — and holds the render
 * objects. Roles:
 *  - herbivores graze/rest/wander around home in a loose herd, and bolt from the
 *    nearest threat (a predator OR the player), fanning out as they flee;
 *  - predators patrol a den, lock onto the player inside their territory, and
 *    otherwise stalk the nearest herbivore that strays into range;
 *  - kin wander until touched, then join the pack and trail the player.
 * Behaviour randomness comes from a per-creature substream seeded from spawn
 * data, so it never perturbs the shared world-generation RNG stream.
 */
export class WildCreature implements Mover {
    readonly container: Phaser.GameObjects.Container;
    readonly def: WildSpeciesDef;
    readonly home: { x: number; y: number };
    joined = false;
    chasing = false;
    consumed = false; // a carnivore player ate this prey; hidden until it respawns
    private ring: Phaser.GameObjects.Arc;
    private body: Phaser.GameObjects.Image;
    private angle: number;
    private breathe: number;
    private state: BehaviourState;
    private stateTimer: number;
    private behaviourRng: Rng;
    // Tier 3 ecology drives.
    private energy: number; // predators: hunger; a kill refills it, idling drains it
    private hunting = false; // predator drive: actively stalking prey (hysteresis)
    private danger: DangerMemory = NO_DANGER; // herbivore: last place it was frightened

    constructor(
        private scene: Phaser.Scene,
        private rng: Rng,
        private bounds: Phaser.Geom.Rectangle,
        def: WildSpeciesDef,
        home: { x: number; y: number },
        private waters: readonly WaterBody[],
        index = 0,
    ) {
        this.def = def;
        this.home = home;

        this.ring = scene.add.circle(0, 0, def.radius + 10, COLORS.danger, 0);
        this.ring.setStrokeStyle(2, COLORS.danger, 0.9);
        this.body = scene.add.image(0, 0, wildTexture(scene, def));

        this.container = scene.add.container(0, 0, [this.ring, this.body]).setDepth(8);
        if (def.role === 'kin') this.container.setAlpha(0.9);
        this.angle = rng.next() * Math.PI * 2;
        this.breathe = rng.next() * Math.PI * 2;

        // Spawn near home (herbivores/predators) or exactly at it (kin's
        // "home" is already a random roaming point picked by the scene).
        const spread = def.role === 'kin' ? 0 : 120;
        this.container.setPosition(
            Phaser.Math.Clamp(home.x + (rng.next() - 0.5) * spread * 2, bounds.left, bounds.right),
            Phaser.Math.Clamp(home.y + (rng.next() - 0.5) * spread * 2, bounds.top, bounds.bottom),
        );

        // Per-creature behaviour substream: independent of the shared generation
        // stream, seeded from data that already exists so it stays deterministic.
        this.behaviourRng = new Rng(`${def.id}:${Math.round(home.x)}:${Math.round(home.y)}:${index}`);
        this.state = def.role === 'predator' ? 'patrol' : 'graze';
        this.stateTimer = this.behaviourRng.next() * 3; // stagger so a herd isn't in lockstep
        // Predators start partly fed so hunts begin at staggered times, not all at once.
        this.energy = PREDATOR_ENERGY.max * (0.5 + this.behaviourRng.next() * 0.35);
    }

    get x(): number {
        return this.container.x;
    }

    get y(): number {
        return this.container.y;
    }

    get radius(): number {
        return this.def.radius;
    }

    /** Current travel heading — satisfies the behaviour module's Mover shape. */
    get heading(): number {
        return this.angle;
    }

    /** Species key for herd grouping (flocking only cohere with same species). */
    get speciesId(): string {
        return this.def.id;
    }

    /** Predator drive: is it currently hungry enough to be stalking prey? */
    get isHunting(): boolean {
        return this.hunting;
    }

    /** A predator caught prey — replenish its energy and give a small feed pulse. */
    feed(): void {
        this.energy = feedPredator(this.energy);
        this.hunting = updateHuntDrive(this.hunting, this.energy);
        this.scene.tweens.add({ targets: this.body, scale: 1.25, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    }

    /** Push a predator visibly away after it lands a hit. */
    recoilFrom(x: number, y: number, distance = 70): void {
        let dx = this.x - x;
        let dy = this.y - y;
        if (dx === 0 && dy === 0) {
            dx = Math.cos(this.angle);
            dy = Math.sin(this.angle);
        }
        const length = Math.hypot(dx, dy) || 1;
        const nx = Phaser.Math.Clamp(this.x + (dx / length) * distance, this.bounds.left, this.bounds.right);
        const ny = Phaser.Math.Clamp(this.y + (dy / length) * distance, this.bounds.top, this.bounds.bottom);
        if (!inWater(this.waters, nx, ny, this.def.radius * 0.5)) this.container.setPosition(nx, ny);
        this.angle = Math.atan2(dy, dx);
        this.body.rotation = this.angle;
    }

    /**
     * Prey: caught (by the player or a predator) — pop, then respawn near home
     * after `delaySeconds` (the scene scales this with population so a thinned
     * herd recovers faster; falls back to a random beat if unspecified).
     */
    eaten(delaySeconds?: number): void {
        this.consumed = true;
        this.ring.setAlpha(0);
        const delay = (delaySeconds ?? 5 + this.rng.next() * 5) * 1000;
        this.scene.tweens.add({
            targets: this.container,
            scale: 1.4,
            alpha: 0,
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.container.setVisible(false);
                this.scene.time.delayedCall(delay, () => this.respawnNearHome());
            },
        });
    }

    private respawnNearHome(): void {
        this.consumed = false;
        const spread = 120;
        this.container
            .setVisible(true)
            .setAlpha(1)
            .setScale(1)
            .setPosition(
                Phaser.Math.Clamp(this.home.x + (this.rng.next() - 0.5) * spread * 2, this.bounds.left, this.bounds.right),
                Phaser.Math.Clamp(this.home.y + (this.rng.next() - 0.5) * spread * 2, this.bounds.top, this.bounds.bottom),
            );
        this.state = 'graze';
        this.stateTimer = this.behaviourRng.next() * 2;
        this.danger = NO_DANGER; // a fresh start forgets old frights
    }

    /** Kin only: touched by the player — join the pack. */
    join(): void {
        this.joined = true;
        this.container.setAlpha(1);
        this.scene.tweens.add({ targets: this.container, scale: 1.2, duration: 200, yoyo: true, ease: 'Cubic.easeOut' });
    }

    /**
     * Advance one step. `ctx` carries what this creature can perceive: the alive
     * herbivore/predator lists (built once per frame by the scene) for herd and
     * hunt awareness, and a slot angle for joined kin. Returns the distance to
     * the player so the scene can resolve contact (damage, pack joins) and cues.
     */
    update(
        dtSeconds: number,
        player: { x: number; y: number },
        ctx: { herbivores?: readonly Mover[]; predators?: readonly Mover[]; slotAngle?: number } = {},
    ): number {
        if (this.consumed) return Infinity;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (this.def.role === 'kin') {
            if (this.joined) {
                // Joined kin trail the player at a fixed slot; no water/bounds fuss.
                const slotAngle = ctx.slotAngle ?? 0;
                const followDist = CREATURE.creatureRadius + 52;
                const tx = player.x + Math.cos(slotAngle) * followDist;
                const ty = player.y + Math.sin(slotAngle) * followDist;
                const prevX = this.container.x;
                this.container.x = Phaser.Math.Linear(this.container.x, tx, Math.min(1, 4 * dtSeconds));
                this.container.y = Phaser.Math.Linear(this.container.y, ty, Math.min(1, 4 * dtSeconds));
                if (Math.abs(this.container.x - prevX) > 0.5) {
                    this.body.rotation = Phaser.Math.Angle.RotateTo(this.body.rotation, slotAngle + Math.PI, 6 * dtSeconds);
                }
                this.breathe += dtSeconds;
                this.body.setScale(1 + Math.sin(this.breathe * 1.8) * 0.03);
                return dist;
            }
            // Unjoined kin: a calm smooth wander until met.
            this.applyDecision(decideWander(this, this.def.wanderSpeed, this.stateTimer, dtSeconds, this.behaviourRng), dtSeconds);
            return dist;
        }

        let decision: Decision;
        if (this.def.role === 'predator') {
            // Tier 3: hunger drains, drive updates with hysteresis; a sated
            // predator (huntPrey false) stops stalking prey but still defends.
            this.energy = tickPredatorEnergy(this.energy, dtSeconds);
            this.hunting = updateHuntDrive(this.hunting, this.energy);
            decision = decidePredator({
                self: this, home: this.home, prey: ctx.herbivores ?? [], player,
                def: this.def, state: this.state, stateTimer: this.stateTimer, dt: dtSeconds, rng: this.behaviourRng,
                huntPrey: this.hunting,
            });
        } else {
            // Tier 3: fade the danger memory, steer grazing away from what's left.
            this.danger = decayDanger(this.danger, dtSeconds, 8);
            decision = decideHerbivore({
                self: this, home: this.home, herd: ctx.herbivores ?? [], predators: ctx.predators ?? [], player,
                def: this.def, state: this.state, stateTimer: this.stateTimer, dt: dtSeconds, rng: this.behaviourRng,
                danger: this.danger.intensity > 0 ? this.danger : null,
            });
            // If it bolted, remember the spot so the herd later relocates off it.
            if (decision.threat) this.danger = rememberDanger(this.danger, decision.threat.x, decision.threat.y, 0.6);
        }

        this.chasing = decision.chasingPlayer;
        this.applyDecision(decision, dtSeconds);

        // Alert ring pulses only while actively hunting the player.
        const alert = this.chasing && dist <= CREATURE.predatorAlertRadius;
        this.ring.setAlpha(alert ? 0.5 + 0.5 * Math.abs(Math.sin(this.scene.time.now / 180)) : 0);
        return dist;
    }

    /** Move per the decision, respecting world bounds and impassable water. */
    private applyDecision(d: Decision, dt: number): void {
        this.state = d.state;
        this.stateTimer = d.stateTimer;
        this.angle = d.heading;

        if (d.speed > 0.01) {
            let nx = this.x + Math.cos(this.angle) * d.speed * dt;
            let ny = this.y + Math.sin(this.angle) * d.speed * dt;
            if (nx < this.bounds.left || nx > this.bounds.right) this.angle = Math.PI - this.angle;
            if (ny < this.bounds.top || ny > this.bounds.bottom) this.angle = -this.angle;
            nx = Phaser.Math.Clamp(nx, this.bounds.left, this.bounds.right);
            ny = Phaser.Math.Clamp(ny, this.bounds.top, this.bounds.bottom);
            if (inWater(this.waters, nx, ny, this.def.radius * 0.5)) {
                // Water is impassable: turn away and try again next frame.
                this.angle += Math.PI + (this.behaviourRng.next() - 0.5) * 0.8;
                // Commit the turn immediately: body heading must match actual movement.
                this.body.rotation = this.angle;
            } else {
                this.container.setPosition(nx, ny);
            }
            this.body.rotation = Phaser.Math.Angle.RotateTo(this.body.rotation, this.angle, 8 * dt);
        }

        this.breathe += dt;
        this.body.setScale(1 + Math.sin(this.breathe * 1.8) * 0.03);
    }
}
