import Phaser from 'phaser';
import { CREATURE, COLORS } from '../config';

/**
 * A forage item (berry cluster) belonging to a nest. Food is finite: once
 * eaten it stays gone until its respawn timer (CREATURE.foodRespawnSec,
 * ticked by the scene with sim time so pause/speed are respected) brings it
 * back at the same spot. Positions come from the campaign Rng via the nest
 * layout, so a seed forages the same (brief §19).
 */
export class Food {
    readonly sprite: Phaser.GameObjects.Container;
    consumed = false; // guard: not edible again until it respawns
    private respawnIn = 0; // seconds of sim time until respawn

    constructor(private scene: Phaser.Scene, readonly x: number, readonly y: number, readonly foodValue = 1, private readonly regrowSeconds = CREATURE.foodRespawnSec) {
        const berry = scene.add.circle(0, 0, CREATURE.foodRadius, COLORS.food);
        const leaf = scene.add.ellipse(CREATURE.foodRadius * 0.4, -CREATURE.foodRadius * 0.7, CREATURE.foodRadius * 0.9, CREATURE.foodRadius * 0.5, COLORS.brandDeep);
        this.sprite = scene.add.container(x, y, [leaf, berry]).setDepth(5);
    }

    /** Advance the respawn timer while consumed. */
    update(dtSeconds: number): void {
        if (!this.consumed) return;
        this.respawnIn -= dtSeconds;
        if (this.respawnIn <= 0) this.respawn();
    }

    private respawn(): void {
        this.consumed = false;
        this.sprite.setScale(0.6).setAlpha(0).setVisible(true);
        this.scene.tweens.add({ targets: this.sprite, scale: 1, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
    }

    eat(): void {
        this.consumed = true;
        this.respawnIn = this.regrowSeconds;
        this.scene.tweens.add({
            targets: this.sprite,
            scale: 1.5,
            alpha: 0,
            duration: 160,
            ease: 'Cubic.easeOut',
            onComplete: () => this.sprite.setVisible(false).setScale(1),
        });
    }
}
