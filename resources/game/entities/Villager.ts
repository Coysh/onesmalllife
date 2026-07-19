import Phaser from 'phaser';
import type { Rng } from '../lib/rng';

/**
 * A little inhabitant of a strategic-stage settlement. Wanders around a home
 * point so the top-down region feels alive and populated (addresses "no
 * movement" — the strategic stages now show your people, buildings and rival).
 */
export class Villager {
    readonly container: Phaser.GameObjects.Container;
    private tx: number;
    private ty: number;
    private speed: number;

    constructor(
        scene: Phaser.Scene,
        private rng: Rng,
        private homeX: number,
        private homeY: number,
        private radius: number,
        tint: number,
    ) {
        // A little variety of builds and shades so a settlement isn't clones.
        const shade = (hex: number, f: number) => {
            const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) * f));
            const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) * f));
            const b = Math.max(0, Math.min(255, (hex & 255) * f));
            return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
        };
        const skin = shade(tint, 0.82 + rng.next() * 0.36);
        const parts: Phaser.GameObjects.GameObject[] = [];
        switch (rng.int(0, 3)) {
            case 0: // stocky
                parts.push(scene.add.ellipse(0, 2, 7, 8, skin), scene.add.circle(0, -5, 3.2, skin));
                break;
            case 1: // tall
                parts.push(scene.add.ellipse(0, 3, 5, 11, skin), scene.add.circle(0, -6, 2.6, skin));
                break;
            default: // average, with a little cloak fleck
                parts.push(scene.add.ellipse(0, 2, 6, 9, skin), scene.add.circle(0, -5, 3, skin), scene.add.circle(0, 3, 2, shade(skin, 0.7), 0.8));
        }
        this.container = scene.add.container(homeX, homeY, parts).setDepth(6);
        this.speed = 18 + rng.next() * 14;
        this.tx = homeX;
        this.ty = homeY;
        this.pickTarget();
    }

    private pickTarget(): void {
        const a = this.rng.next() * Math.PI * 2;
        const d = this.rng.next() * this.radius;
        this.tx = this.homeX + Math.cos(a) * d;
        this.ty = this.homeY + Math.sin(a) * d;
    }

    setHome(x: number, y: number): void {
        this.homeX = x;
        this.homeY = y;
    }

    update(dtSeconds: number): void {
        const dx = this.tx - this.container.x;
        const dy = this.ty - this.container.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 3) {
            if (this.rng.chance(0.02)) this.pickTarget();
            return;
        }
        this.container.x += (dx / dist) * this.speed * dtSeconds;
        this.container.y += (dy / dist) * this.speed * dtSeconds;
        this.container.setScale(dx < 0 ? -1 : 1, 1);
    }

    destroy(): void {
        this.container.destroy();
    }
}
