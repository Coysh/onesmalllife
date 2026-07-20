import Phaser from 'phaser';
import { CELL } from '../config';
import type { Rng } from '../lib/rng';
import { foodCellTexture, FOOD_VARIANTS } from '../data/sprites/cellSprites';

/**
 * A drifting nutrient — a tiny GENERATED food cell (not a plain dot): a soft
 * round organism, green for common food and amber for rich, in several seeded
 * variants so the tank teems with little life. Kept visually distinct from the
 * enemy cells (small, soft, never spiky) so food never reads as prey/threat.
 * When absorbed it pops and respawns so the tank always has food. Positions
 * come from the campaign Rng so a given seed drifts identically (brief §19).
 */
export class Mote {
    readonly sprite: Phaser.GameObjects.Image;
    rich = false;
    consumed = false; // guard: not absorbable again until it respawns
    private angle: number;
    private speed: number;
    private spin: number;
    private respawnRemaining = 0;
    private respawnValidator?: (x: number, y: number) => boolean;

    constructor(private scene: Phaser.Scene, private rng: Rng, private bounds: Phaser.Geom.Rectangle) {
        this.sprite = scene.add.image(0, 0, foodCellTexture(scene, 0, false)).setDepth(5);
        this.angle = 0;
        this.speed = 0;
        this.spin = 0;
        this.respawn();
    }

    get x(): number {
        return this.sprite.x;
    }

    get y(): number {
        return this.sprite.y;
    }

    respawn(isValid?: (x: number, y: number) => boolean): void {
        let x = this.bounds.left + this.rng.next() * this.bounds.width;
        let y = this.bounds.top + this.rng.next() * this.bounds.height;
        // Keep placement deterministic: every attempt consumes exactly two
        // draws and falls back to the final deterministic candidate.
        for (let attempt = 0; attempt < 20 && isValid && !isValid(x, y); attempt++) {
            x = this.bounds.left + this.rng.next() * this.bounds.width;
            y = this.bounds.top + this.rng.next() * this.bounds.height;
        }
        this.consumed = false;
        this.respawnRemaining = 0;
        this.respawnValidator = undefined;
        this.rich = this.rng.chance(CELL.richMoteChance);
        this.sprite
            .setTexture(foodCellTexture(this.scene, this.rng.int(0, FOOD_VARIANTS), this.rich))
            .setPosition(x, y)
            .setScale(1)
            .setAlpha(0.95)
            .setVisible(true)
            .setRotation(this.rng.next() * Math.PI * 2);
        this.angle = this.rng.next() * Math.PI * 2;
        this.speed = 12 + this.rng.next() * 16;
        this.spin = (this.rng.next() - 0.5) * 0.6;
    }

    update(dtSeconds: number): void {
        if (this.consumed) {
            this.respawnRemaining -= dtSeconds;
            if (this.respawnRemaining <= 0) this.respawn(this.respawnValidator);
            return;
        }
        // slow wander with occasional heading nudge + a gentle drift-spin
        if (this.rng.chance(0.01)) {
            this.angle += (this.rng.next() - 0.5) * 1.2;
        }
        let nx = this.sprite.x + Math.cos(this.angle) * this.speed * dtSeconds;
        let ny = this.sprite.y + Math.sin(this.angle) * this.speed * dtSeconds;
        if (nx < this.bounds.left || nx > this.bounds.right) this.angle = Math.PI - this.angle;
        if (ny < this.bounds.top || ny > this.bounds.bottom) this.angle = -this.angle;
        nx = Phaser.Math.Clamp(nx, this.bounds.left, this.bounds.right);
        ny = Phaser.Math.Clamp(ny, this.bounds.top, this.bounds.bottom);
        this.sprite.setPosition(nx, ny);
        this.sprite.rotation += this.spin * dtSeconds;
    }

    /** Quick absorb pop, then reappear elsewhere. */
    absorb(isValid?: (x: number, y: number) => boolean): void {
        this.consumed = true;
        this.respawnRemaining = CELL.moteRespawnSec;
        this.respawnValidator = isValid;
        this.scene.tweens.add({
            targets: this.sprite,
            scale: 1.6,
            alpha: 0,
            duration: 160,
            ease: 'Cubic.easeOut',
            onComplete: () => this.sprite.setVisible(false),
        });
    }
}
