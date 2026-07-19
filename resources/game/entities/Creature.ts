import Phaser from 'phaser';
import { CREATURE, COLORS, type OrganismPalette } from '../config';
import { prefersReducedMotion } from '../lib/motion';
import { Rng } from '../lib/rng';
import { DEFAULT_APPEARANCE, partById, type AppearanceV2 } from '../data/cell-parts';

/**
 * The player's creature, a top-down modular body that rotates toward its
 * heading (like CellOrganism). The base body is derived from the player's
 * chosen cell appearance (AppearanceV2) so the animal reads as a descendant
 * of the created cell: body proportions, back pattern, tail/legs, dorsal
 * defense gear, head sensory detail and snout all follow the same part ids.
 * Inherited traits then reshape it via applyVisuals (dorsal plates, tail fin,
 * snout, eye-stalk, sheen) so the lineage's history stays visible (brief §15).
 * Movement has momentum: velocity eases toward the input direction
 * (CREATURE.accelLerpPerSec) and coasts to a stop (dragLerpPerSec). Legs
 * wiggle while moving and dust kicks up behind it — both skipped under
 * reduced motion.
 */
export class Creature {
    readonly container: Phaser.GameObjects.Container;
    private features: Phaser.GameObjects.Graphics;
    private sheen: Phaser.GameObjects.Ellipse;
    private legs: Phaser.GameObjects.Ellipse[] = [];
    private targetVx = 0;
    private targetVy = 0;
    private vx = 0;
    private vy = 0;
    private targetRotation = 0;
    private gaitPhase = 0;
    private idlePhase = 0;
    private dustAccumulator = 0;
    /** Decorative-only jitter (dust) — still seeded, never Math.random(). */
    private readonly fx = new Rng('creature-dust');
    private readonly r = CREATURE.creatureRadius;
    private baseSheenAlpha = 0;

    constructor(private scene: Phaser.Scene, x: number, y: number, palette?: OrganismPalette, appearance?: AppearanceV2) {
        const r = this.r;
        const ap = appearance ?? DEFAULT_APPEARANCE;
        const albedo = palette?.albedo ?? COLORS.brand;
        const accent = palette?.accent ?? COLORS.brandHi;
        const detail = palette?.detail ?? COLORS.brandDeep;

        // Body proportions from the chosen body part (rx/ry on a ~32 base),
        // clamped so visuals stay within ~±20% of the collision radius.
        const bodyDef = partById('body', ap.body);
        const sx = Phaser.Math.Clamp((bodyDef?.rx ?? 32) / 32, 0.85, 1.2);
        const sy = Phaser.Math.Clamp((bodyDef?.ry ?? 32) / 32, 0.85, 1.2);
        const headX = r * (0.85 * sx + 0.1);
        const rear = -r * (0.1 + 0.95 * sx);

        // Top-down body, drawn facing +x. Legs sit either side of the torso.
        const shadow = scene.add.ellipse(0, r * 0.18, r * 2.3 * sx, r * 1.6 * sy, 0x000000, 0.26);
        this.sheen = scene.add.ellipse(0, 0, r * 2.2 * sx, r * 1.7 * sy, accent, 0);
        const tail = scene.add.graphics();
        this.drawTail(tail, ap.movement, rear, sy, detail, albedo);
        const stumpy = ap.movement === 'pseudopods';
        const haunch = ap.movement === 'jet';
        for (const [lx, ly, rearLeg] of [[-r * 0.45, -r * 0.66, 1], [-r * 0.45, r * 0.66, 1], [r * 0.5, -r * 0.6, 0], [r * 0.5, r * 0.6, 0]]) {
            const w = r * (stumpy ? 0.68 : 0.5) * (haunch && rearLeg ? 1.35 : 1);
            const h = r * (stumpy ? 0.46 : 0.32) * (haunch && rearLeg ? 1.3 : 1);
            this.legs.push(scene.add.ellipse(lx, ly * sy, w, h, detail));
        }
        const body = scene.add.ellipse(-r * 0.1, 0, r * 1.9 * sx, r * 1.25 * sy, albedo);
        const back = scene.add.ellipse(-r * 0.2, 0, r * 1.2 * sx, r * 0.8 * sy, accent, 0.3);
        const pattern = scene.add.graphics();
        this.drawPattern(pattern, ap.pattern, r * 0.85 * sx, r * 0.55 * sy, accent);
        const head = scene.add.circle(headX, 0, r * 0.58, albedo);
        const stalked = ap.sensory === 'stalk_eye';
        const eyeL = scene.add.circle(headX + r * (stalked ? 0.05 : 0.15), -r * (stalked ? 0.42 : 0.22), r * 0.11, 0x06201d);
        const eyeR = scene.add.circle(headX + r * (stalked ? 0.05 : 0.15), r * (stalked ? 0.42 : 0.22), r * 0.11, 0x06201d);
        const base = scene.add.graphics();
        this.drawBaseFeatures(base, ap, headX, sx, sy, accent, detail);
        this.features = scene.add.graphics();
        const highlight = scene.add.ellipse(-r * 0.25, -r * 0.28, r * 1.1 * sx, r * 0.4 * sy, 0xffffff, 0.12);

        this.container = scene.add.container(x, y, [
            shadow, this.sheen, ...this.legs, tail, body, back, pattern, head, eyeL, eyeR, base, this.features, highlight,
        ]);
        this.container.setDepth(10);
        if (ap.defense === 'camouflage') this.container.setAlpha(0.85);
        this.baseSheenAlpha = ap.defense === 'mucus' ? 0.14 : 0;

        this.applyVisuals({});
    }

    get x(): number {
        return this.container.x;
    }

    get y(): number {
        return this.container.y;
    }

    get radius(): number {
        return this.r;
    }

    /** Tail per movement part: whip flagella, brush cilia, broad fin, stubby jet, none for pseudopods. */
    private drawTail(g: Phaser.GameObjects.Graphics, move: string, rear: number, sy: number, detail: number, albedo: number): void {
        const r = this.r;
        if (move === 'flagellum' || move === 'twin_flagella') {
            g.lineStyle(3.5, detail, 0.9);
            const offsets = move === 'twin_flagella' ? [-r * 0.28 * sy, r * 0.28 * sy] : [0];
            for (const oy of offsets) {
                g.beginPath();
                g.moveTo(rear + r * 0.2, oy);
                g.lineTo(rear - r * 0.7, oy + r * 0.25);
                g.lineTo(rear - r * 1.4, oy - r * 0.2);
                g.strokePath();
            }
        } else if (move === 'cilia') {
            g.lineStyle(3, detail, 0.85);
            for (let i = -2; i <= 2; i++) {
                const cy = i * r * 0.16 * sy;
                g.lineBetween(rear + r * 0.15, cy, rear - r * 0.35, cy * 1.4);
            }
        } else if (move === 'fin') {
            g.fillStyle(detail, 0.9);
            g.fillTriangle(rear + r * 0.25, 0, rear - r * 0.75, -r * 0.55 * sy, rear - r * 0.75, r * 0.55 * sy);
        } else if (move === 'jet') {
            g.fillStyle(detail, 0.95);
            g.fillTriangle(rear + r * 0.2, -r * 0.22, rear + r * 0.2, r * 0.22, rear - r * 0.4, 0);
        } else if (move === 'pseudopods') {
            g.fillStyle(albedo, 0.9);
            g.fillEllipse(rear + r * 0.15, 0, r * 0.45, r * 0.4);
        } else {
            g.fillStyle(detail, 1);
            g.fillEllipse(rear + r * 0.1, 0, r * 1.1, r * 0.45);
        }
    }

    /** Back markings in the same family as the cell's chosen pattern. */
    private drawPattern(g: Phaser.GameObjects.Graphics, style: string, brx: number, bry: number, accent: number): void {
        if (style === 'plain') return;
        g.fillStyle(accent, 0.4);
        g.lineStyle(2, accent, 0.42);
        switch (style) {
            case 'stripe':
                for (let i = -1; i <= 1; i++) {
                    const px = i * brx * 0.45 - this.r * 0.2;
                    g.lineBetween(px - 3, -bry * 0.9, px + 3, bry * 0.9);
                }
                break;
            case 'ring':
                g.strokeEllipse(-this.r * 0.2, 0, brx * 1.1, bry * 1.1);
                break;
            case 'radial':
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    g.lineBetween(-this.r * 0.2 + Math.cos(a) * brx * 0.25, Math.sin(a) * bry * 0.25, -this.r * 0.2 + Math.cos(a) * brx * 0.85, Math.sin(a) * bry * 0.85);
                }
                break;
            case 'dotcore':
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    g.fillCircle(-this.r * 0.2 + Math.cos(a) * brx * 0.3, Math.sin(a) * bry * 0.3, 2.6);
                }
                break;
            default: // speckle / mottle / gradient → scattered flecks
                for (const [px, py] of [[-14, -6], [-2, -11], [6, 7], [-18, 8], [2, 0], [-8, 12]]) {
                    g.fillCircle(px * (brx / this.r), py * (bry / this.r), 2.6);
                }
        }
    }

    /** Head/snout/back detail per feeding, sensory and defense part ids. */
    private drawBaseFeatures(g: Phaser.GameObjects.Graphics, ap: AppearanceV2, headX: number, sx: number, sy: number, accent: number, detail: number): void {
        const r = this.r;

        // Feeding → snout.
        if (ap.feeding === 'gullet') {
            g.fillStyle(detail, 0.9);
            g.fillEllipse(headX + r * 0.45, 0, r * 0.55, r * 0.45);
        } else if (ap.feeding === 'proboscis') {
            g.fillStyle(detail, 0.95);
            g.fillTriangle(headX + r * 0.35, -r * 0.09, headX + r * 0.35, r * 0.09, headX + r * 1.0, 0);
        } else if (ap.feeding === 'filter') {
            g.fillStyle(detail, 0.9);
            g.fillEllipse(headX + r * 0.5, 0, r * 0.62, r * 0.26);
        } else if (ap.feeding === 'pseudopod') {
            g.lineStyle(3, detail, 0.9);
            for (let i = -1; i <= 1; i++) {
                g.lineBetween(headX + r * 0.4, i * r * 0.14, headX + r * 0.8, i * r * 0.26);
            }
        }

        // Sensory → head detail (default eyes already placed; extras here).
        if (ap.sensory === 'antenna') {
            g.lineStyle(2.5, detail, 0.9);
            g.lineBetween(headX + r * 0.2, -r * 0.2, headX + r * 0.7, -r * 0.6);
            g.lineBetween(headX + r * 0.2, r * 0.2, headX + r * 0.7, r * 0.6);
            g.fillStyle(accent, 1);
            g.fillCircle(headX + r * 0.7, -r * 0.6, r * 0.09);
            g.fillCircle(headX + r * 0.7, r * 0.6, r * 0.09);
        } else if (ap.sensory === 'stalk_eye') {
            g.lineStyle(3, detail, 0.9);
            g.lineBetween(headX - r * 0.05, -r * 0.18, headX + r * 0.05, -r * 0.4);
            g.lineBetween(headX - r * 0.05, r * 0.18, headX + r * 0.05, r * 0.4);
        } else if (ap.sensory === 'photosensor') {
            g.fillStyle(accent, 0.85);
            g.fillEllipse(headX + r * 0.12, 0, r * 0.16, r * 0.62);
        } else if (ap.sensory === 'chemobristle') {
            g.lineStyle(1.5, detail, 0.85);
            for (const wy of [-1, 1]) {
                g.lineBetween(headX + r * 0.3, wy * r * 0.1, headX + r * 0.62, wy * r * 0.34);
                g.lineBetween(headX + r * 0.3, wy * r * 0.16, headX + r * 0.55, wy * r * 0.48);
            }
        }

        // Defense → back armour (mucus → sheen, camouflage → alpha, set in ctor).
        if (ap.defense === 'spike_ring' || ap.defense === 'spines') {
            g.fillStyle(detail, 0.95);
            for (let i = -1; i <= 2; i++) {
                const px = i * r * 0.42 * sx - r * 0.2;
                g.fillTriangle(px - 6, -6, px - 6, 6, px + 9, 0);
            }
        } else if (ap.defense === 'thick_wall') {
            g.lineStyle(2.5, detail, 0.7);
            for (let i = 0; i < 3; i++) {
                g.strokeEllipse(-r * 0.2 - i * r * 0.22 * sx, 0, r * (1.0 - i * 0.2) * sx, r * (0.7 - i * 0.12) * sy);
            }
        } else if (ap.defense === 'toxin_sac') {
            g.fillStyle(COLORS.danger, 0.85);
            g.fillCircle(-r * 0.55 * sx, r * 0.35 * sy, r * 0.26);
            g.fillStyle(0xffffff, 0.25);
            g.fillCircle(-r * 0.62 * sx, r * 0.28 * sy, r * 0.09);
        } else if (ap.defense === 'camouflage') {
            g.fillStyle(detail, 0.28);
            for (const [px, py] of [[-16, -8], [-4, 6], [8, -5], [-10, 12], [14, 4], [-22, 2]]) {
                g.fillCircle(px * sx, py * sy, 3);
            }
        }
    }

    /** Reshape from inherited trait attachments, e.g. {membrane:'double', movement:'flagellum'}. */
    applyVisuals(attachments: Record<string, string>): void {
        const r = this.r;
        this.features.clear();

        // Membrane → dorsal plates along the spine.
        if (attachments.membrane === 'double' || attachments.membrane === 'ridged') {
            this.features.fillStyle(COLORS.brandDeep, 0.9);
            for (let i = -1; i <= 2; i++) {
                const px = i * r * 0.42 - r * 0.2;
                this.features.fillTriangle(px - 6, -4, px - 6, 4, px + 7, 0);
            }
        }
        // Movement → a larger tail fin trailing behind.
        if (attachments.movement === 'flagellum' || attachments.movement === 'twin_flagella') {
            this.features.fillStyle(COLORS.brandDeep, 0.85);
            this.features.fillTriangle(-r * 1.25, 0, -r * 1.95, -r * 0.5, -r * 1.95, r * 0.5);
        }
        // Feeding → a snout/beak on the head.
        if (attachments.feeding) {
            this.features.fillStyle(COLORS.secondary, 0.95);
            this.features.fillTriangle(r * 1.4, -r * 0.14, r * 1.4, r * 0.14, r * 1.8, 0);
        }
        // Sensory → an antenna with a sensor tip.
        if (attachments.sensory) {
            this.features.lineStyle(3, COLORS.brand, 0.9);
            this.features.lineBetween(r * 0.95, -r * 0.35, r * 1.35, -r * 0.75);
            this.features.fillStyle(COLORS.integrity, 1);
            this.features.fillCircle(r * 1.38, -r * 0.78, r * 0.16);
        }
        // Defense → a sheen overlay (kept if the appearance already grants one).
        this.sheen.setFillStyle(COLORS.brandHi, Math.max(this.baseSheenAlpha, attachments.defense ? 0.16 : 0));
    }

    /** Set the desired velocity; actual velocity eases toward it (momentum). */
    setVelocity(vx: number, vy: number): void {
        this.targetVx = vx;
        this.targetVy = vy;
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
            this.targetRotation = Math.atan2(vy, vx);
        }
    }

    isMoving(): boolean {
        return Math.hypot(this.vx, this.vy) > 8;
    }

    pulse(): void {
        this.scene.tweens.add({
            targets: this.container,
            scaleX: 1.12,
            scaleY: 1.12,
            duration: 300,
            yoyo: true,
            ease: 'Cubic.easeOut',
            onComplete: () => this.container.setScale(1),
        });
    }

    /** A tiny fading dust circle kicked up behind the moving creature. */
    private puffDust(): void {
        const back = this.container.rotation + Math.PI;
        const px = this.x + Math.cos(back) * this.r * 1.1 + (this.fx.next() - 0.5) * 8;
        const py = this.y + Math.sin(back) * this.r * 1.1 + (this.fx.next() - 0.5) * 8;
        const dot = this.scene.add.circle(px, py, 3 + this.fx.next() * 3, 0xcbbfa3, 0.28).setDepth(4);
        this.scene.tweens.add({
            targets: dot,
            alpha: 0,
            scale: 2,
            duration: 420,
            ease: 'Cubic.easeOut',
            onComplete: () => dot.destroy(),
        });
    }

    /**
     * Ease velocity toward the input, move within bounds and rotate toward the
     * heading. `blocked` (e.g. water) vetoes a step per-axis so the creature
     * slides along shorelines instead of sticking.
     */
    update(dtSeconds: number, bounds: Phaser.Geom.Rectangle, blocked?: (x: number, y: number) => boolean): void {
        const hasInput = Math.abs(this.targetVx) > 1 || Math.abs(this.targetVy) > 1;
        const rate = Math.min(1, (hasInput ? CREATURE.accelLerpPerSec : CREATURE.dragLerpPerSec) * dtSeconds);
        this.vx += (this.targetVx - this.vx) * rate;
        this.vy += (this.targetVy - this.vy) * rate;

        let nx = Phaser.Math.Clamp(this.container.x + this.vx * dtSeconds, bounds.left + this.r, bounds.right - this.r);
        let ny = Phaser.Math.Clamp(this.container.y + this.vy * dtSeconds, bounds.top + this.r, bounds.bottom - this.r);
        if (blocked?.(nx, ny)) {
            // Try each axis alone so the creature slides along the obstacle.
            if (!blocked(nx, this.container.y)) {
                ny = this.container.y;
                this.vy *= 0.5;
            } else if (!blocked(this.container.x, ny)) {
                nx = this.container.x;
                this.vx *= 0.5;
            } else {
                nx = this.container.x;
                ny = this.container.y;
                this.vx *= 0.3;
                this.vy *= 0.3;
            }
        }
        this.container.setPosition(nx, ny);

        const reduced = prefersReducedMotion();
        if (this.isMoving()) {
            this.container.rotation = Phaser.Math.Angle.RotateTo(this.container.rotation, this.targetRotation, 8 * dtSeconds);
            if (!reduced) {
                // Leg wiggle: alternate diagonal pairs while striding.
                const speedRatio = Math.min(1, Math.hypot(this.vx, this.vy) / CREATURE.speed);
                this.gaitPhase += dtSeconds * (6 + 8 * speedRatio);
                const swing = Math.sin(this.gaitPhase) * this.r * 0.16 * speedRatio;
                this.legs[0].x = -this.r * 0.45 + swing;
                this.legs[3].x = this.r * 0.5 + swing;
                this.legs[1].x = -this.r * 0.45 - swing;
                this.legs[2].x = this.r * 0.5 - swing;
                // Dust puffs at a cadence scaled by speed.
                this.dustAccumulator += dtSeconds * speedRatio;
                if (this.dustAccumulator >= 0.12) {
                    this.dustAccumulator = 0;
                    this.puffDust();
                }
            }
        } else if (!reduced) {
            // Idle sway.
            this.idlePhase += dtSeconds;
            this.container.rotation += Math.sin(this.idlePhase * 1.4) * 0.004;
        }
    }
}
