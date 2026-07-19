import Phaser from 'phaser';
import { prefersReducedMotion } from './motion';

/**
 * Shared scrolling-world camera helpers. Every stage's world is now larger
 * than the viewport: the camera follows the player (direct-control stages) or
 * pans freely (strategic stages) inside world bounds, and zoom tiers let the
 * world visibly "expand" as the organism grows. Kept as thin wrappers over
 * Phaser's camera so scenes share one idiom instead of five copies.
 */

export interface WorldSpec {
    width: number;
    height: number;
}

export interface SetupWorldOpts {
    /** Object for the camera to follow (round-pixels on, lerped). */
    follow?: Phaser.GameObjects.GameObject;
    /** Initial zoom (1 = native). */
    zoom?: number;
    /** Follow lerp 0..1 — lower is floatier. */
    lerp?: number;
}

/** Bound the main camera to the world and optionally follow a target. */
export function setupWorld(scene: Phaser.Scene, spec: WorldSpec, opts: SetupWorldOpts = {}): Phaser.Cameras.Scene2D.Camera {
    const cam = scene.cameras.main;
    cam.setBounds(0, 0, spec.width, spec.height);
    if (opts.zoom !== undefined) cam.setZoom(opts.zoom);
    if (opts.follow) {
        const lerp = opts.lerp ?? 0.09;
        cam.startFollow(opts.follow, true, lerp, lerp);
    }
    return cam;
}

/** Tween the camera to a new zoom tier (instant under reduced motion). */
export function setZoomTier(scene: Phaser.Scene, zoom: number, durationMs = 1100): void {
    const cam = scene.cameras.main;
    if (prefersReducedMotion()) {
        cam.setZoom(zoom);
        return;
    }
    scene.tweens.add({ targets: cam, zoom, duration: durationMs, ease: 'Sine.easeInOut' });
}

/** Pin a game object to the screen (HUD-space) rather than the world. */
export function pinToCamera<T extends Phaser.GameObjects.Components.ScrollFactor>(obj: T): T {
    obj.setScrollFactor(0);
    return obj;
}
