import Phaser from 'phaser';
import { prefersReducedMotion } from './motion';

/**
 * Shared atmosphere helpers — parallax ambient particles, light shafts and
 * camera bloom/vignette — so every stage feels deep and alive (the Tidepool
 * "warm lamp over a dark tank" look). All decorative motion is skipped under
 * reduced motion. Camera FX are WebGL-only and guarded.
 */

/** A soft radial dot texture, generated once, for glowing particles. */
export function ensureSoftDot(scene: Phaser.Scene, key = 'osl-soft-dot', radius = 16): string {
    if (scene.textures.exists(key)) return key;
    const g = scene.add.graphics();
    for (let r = radius; r > 0; r--) {
        g.fillStyle(0xffffff, 0.05);
        g.fillCircle(radius, radius, r);
    }
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy(); // remove the helper; the texture persists
    return key;
}

interface MoteOpts {
    width: number;
    height: number;
    color: number;
    quantity?: number;
    frequency?: number;
    rise?: boolean;
    scale?: [number, number];
    depth?: number;
    alpha?: number;
}

/** Drifting glowing particles (rising bubbles / floating pollen). */
export function ambientParticles(scene: Phaser.Scene, opts: MoteOpts): Phaser.GameObjects.Particles.ParticleEmitter | null {
    if (prefersReducedMotion()) return null;
    const key = ensureSoftDot(scene);
    const rise = opts.rise ?? true;
    const [sMin, sMax] = opts.scale ?? [0.05, 0.22];

    const emitter = scene.add.particles(0, 0, key, {
        x: { min: 0, max: opts.width },
        y: rise ? opts.height + 20 : { min: 0, max: opts.height },
        lifespan: { min: 6000, max: 12000 },
        speedY: rise ? { min: -26, max: -8 } : { min: -8, max: 8 },
        speedX: { min: -8, max: 8 },
        scale: { min: sMin, max: sMax },
        alpha: { start: opts.alpha ?? 0.45, end: 0 },
        frequency: opts.frequency ?? 420,
        quantity: opts.quantity ?? 1,
        blendMode: 'ADD',
        tint: opts.color,
    });
    emitter.setDepth(opts.depth ?? 1);
    return emitter;
}

/** A few soft light shafts angled from the top — underwater/sunlight feel. */
export function lightShafts(scene: Phaser.Scene, width: number, height: number, color = 0x8fe9d6): void {
    if (prefersReducedMotion()) return;
    for (let i = 0; i < 3; i++) {
        const x = width * (0.2 + 0.3 * i) + (i % 2 === 0 ? -40 : 40);
        const shaft = scene.add.polygon(
            0,
            0,
            [x - 30, 0, x + 30, 0, x + 130, height, x + 40, height],
            color,
            0.05,
        ).setOrigin(0, 0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: shaft, alpha: { from: 0.03, to: 0.09 }, duration: 4000 + i * 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
}

interface CameraFxControls {
    addVignette?: (x: number, y: number, radius: number, strength: number) => unknown;
    addBloom?: (color: number, ox: number, oy: number, blur: number, strength: number, steps: number) => unknown;
}

/** Camera bloom + vignette for atmospheric depth (WebGL only; guarded). */
export function applyCameraFx(camera: Phaser.Cameras.Scene2D.Camera, bloomStrength = 0.9, vignetteStrength = 0.55): void {
    const fx = (camera as unknown as { postFX?: CameraFxControls }).postFX;
    if (!fx?.addBloom) return; // Canvas renderer or unsupported — skip gracefully
    try {
        fx.addVignette?.(0.5, 0.5, 0.9, vignetteStrength);
        fx.addBloom(0xffffff, 1, 1, 1.1, bloomStrength, 4);
    } catch {
        /* FX unsupported in this context */
    }
}
