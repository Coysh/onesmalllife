import Phaser from 'phaser';
import { CELL, COLORS } from '../config';
import { Rng } from '../lib/rng';
import { enemyCellTexture, CELL_VARIANTS, type EnemyCellDef } from '../data/sprites/cellSprites';
import { canEat, shouldFlee, shouldHunt } from '../systems/cellGrowth';
import { turnToward } from '../systems/creatureBehaviour';

/**
 * One enemy cell of a given archetype (data/sprites/cellSprites). Behavior is
 * tier-relative: it wanders, hunts a smaller player, or flees a larger one.
 * The body is a cached texture; only the alert ring and a slow breathing
 * scale are live. The scene handles contact outcomes (eat vs damage).
 */
export class EnemyCell {
    readonly container: Phaser.GameObjects.Container;
    readonly def: EnemyCellDef;
    consumed = false;
    private ring: Phaser.GameObjects.Arc;
    private body: Phaser.GameObjects.Image;
    private angle: number;
    private breathe: number;
    private behaviourRng: Rng;

    constructor(private scene: Phaser.Scene, private rng: Rng, private bounds: Phaser.Geom.Rectangle, def: EnemyCellDef, index = 0) {
        this.def = def;

        this.ring = scene.add.circle(0, 0, def.radius + 10, COLORS.danger, 0);
        this.ring.setStrokeStyle(2, COLORS.danger, 0.9);
        // Each cell is one of several seeded generated variants → the tank is
        // full of individually distinct organisms, not identical shapes.
        const variant = rng.int(0, CELL_VARIANTS);
        this.body = scene.add.image(0, 0, enemyCellTexture(scene, def, variant));

        this.container = scene.add.container(0, 0, [this.ring, this.body]).setDepth(8);
        this.angle = rng.next() * Math.PI * 2;
        this.breathe = rng.next() * Math.PI * 2;
        this.respawn(null);
        // Per-cell wander substream, independent of the shared generation stream.
        this.behaviourRng = new Rng(`${def.id}:${index}:${Math.round(this.x)}`);
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

    /** Place somewhere in the world, away from `avoid` if given. */
    respawn(avoid: { x: number; y: number } | null, minDist = 700): void {
        for (let tries = 0; tries < 20; tries++) {
            const x = this.bounds.left + this.rng.next() * this.bounds.width;
            const y = this.bounds.top + this.rng.next() * this.bounds.height;
            if (!avoid || Phaser.Math.Distance.Between(x, y, avoid.x, avoid.y) >= minDist) {
                this.container.setPosition(x, y);
                break;
            }
        }
        this.consumed = false;
        this.container.setAlpha(1).setScale(1);
        this.container.setVisible(true);
    }

    /**
     * Advance one step. Returns the distance to the player so the scene can
     * resolve contact and threat cues.
     */
    update(dtSeconds: number, player: { x: number; y: number }, playerTier: number): number {
        if (this.consumed) return Infinity;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        const hunting = shouldHunt(playerTier, this.def) && this.def.detectRadius > 0 && dist <= this.def.detectRadius;
        const fleeing = shouldFlee(playerTier, this.def) && this.def.detectRadius > 0 && dist <= this.def.detectRadius;

        let speed = this.def.wanderSpeed;
        if (hunting) {
            this.angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            speed = this.def.chaseSpeed;
        } else if (fleeing) {
            this.angle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
            speed = this.def.chaseSpeed;
        } else {
            // Idle drift: a continuous gentle heading wander (Tier 1) instead of
            // the old occasional random flick — organelles glide, not twitch.
            const drift = this.angle + (this.behaviourRng.next() - 0.5) * 2.4 * dtSeconds * 3;
            this.angle = turnToward(this.angle, drift, 2.4 * dtSeconds);
        }

        let nx = this.x + Math.cos(this.angle) * speed * dtSeconds;
        let ny = this.y + Math.sin(this.angle) * speed * dtSeconds;
        if (nx < this.bounds.left || nx > this.bounds.right) this.angle = Math.PI - this.angle;
        if (ny < this.bounds.top || ny > this.bounds.bottom) this.angle = -this.angle;
        nx = Phaser.Math.Clamp(nx, this.bounds.left, this.bounds.right);
        ny = Phaser.Math.Clamp(ny, this.bounds.top, this.bounds.bottom);
        this.container.setPosition(nx, ny);

        // Sleek/lance swimmers point where they're going.
        if (this.def.look.family === 'sleek' || this.def.look.family === 'lance') {
            this.body.rotation = this.angle;
        }

        // Soft breathing; alert ring pulses only while actively hunting.
        this.breathe += dtSeconds;
        this.body.setScale(1 + Math.sin(this.breathe * 1.6) * 0.03);
        const alert = hunting && dist <= CELL.predatorAlertRadius;
        this.ring.setAlpha(alert ? 0.5 + 0.5 * Math.abs(Math.sin(this.scene.time.now / 180)) : 0);

        return dist;
    }

    /** Eaten by the player: pop, then respawn far away after a beat. */
    eaten(playerTier: number, onRespawn?: () => void): void {
        this.consumed = true;
        this.scene.tweens.add({
            targets: this.container,
            scale: 1.5,
            alpha: 0,
            duration: 220,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.container.setVisible(false);
                this.scene.time.delayedCall(6000 + this.rng.next() * 6000, () => {
                    // Only respawn what the player can still meaningfully meet:
                    // everything stays relevant — prey feeds, threats pressure.
                    this.respawn(null);
                    onRespawn?.();
                });
            },
        });
        void playerTier;
    }

    /** True when the player can currently eat this species. */
    edibleBy(playerTier: number): boolean {
        return !this.consumed && canEat(playerTier, this.def);
    }
}
