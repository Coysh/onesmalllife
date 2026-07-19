import Phaser from 'phaser';
import { CELL, COLORS } from '../config';
import type { Rng } from '../lib/rng';

/**
 * A toxin cloud — an environmental hazard. Drifts slowly; the cell takes
 * integrity damage each second it spends inside (applied by the scene). Rich
 * nutrients often sit near hazards, so foraging is a risk/reward choice.
 */
export class Hazard {
    readonly circle: Phaser.GameObjects.Arc;
    private angle: number;
    private speed: number;

    constructor(private rng: Rng, private bounds: Phaser.Geom.Rectangle, scene: Phaser.Scene) {
        this.circle = scene.add.circle(0, 0, CELL.hazardRadius, COLORS.danger, 0.14).setDepth(2);
        this.circle.setStrokeStyle(2, COLORS.danger, 0.35);
        const x = this.bounds.left + this.rng.next() * this.bounds.width;
        const y = this.bounds.top + this.rng.next() * this.bounds.height;
        this.circle.setPosition(x, y);
        this.angle = this.rng.next() * Math.PI * 2;
        this.speed = 8 + this.rng.next() * 10;
    }

    get x(): number {
        return this.circle.x;
    }

    get y(): number {
        return this.circle.y;
    }

    get radius(): number {
        return CELL.hazardRadius;
    }

    update(dtSeconds: number): void {
        if (this.rng.chance(0.01)) this.angle += (this.rng.next() - 0.5) * 1.0;
        let nx = this.x + Math.cos(this.angle) * this.speed * dtSeconds;
        let ny = this.y + Math.sin(this.angle) * this.speed * dtSeconds;
        if (nx < this.bounds.left || nx > this.bounds.right) this.angle = Math.PI - this.angle;
        if (ny < this.bounds.top || ny > this.bounds.bottom) this.angle = -this.angle;
        nx = Phaser.Math.Clamp(nx, this.bounds.left, this.bounds.right);
        ny = Phaser.Math.Clamp(ny, this.bounds.top, this.bounds.bottom);
        this.circle.setPosition(nx, ny);
    }
}
