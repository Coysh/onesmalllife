import Phaser from 'phaser';
import { CELL, COLORS, type OrganismPalette } from '../config';
import { prefersReducedMotion } from '../lib/motion';
import { DEFAULT_APPEARANCE, partById, type AppearanceV2 } from '../data/cell-parts';

/**
 * The player's cell, composed as a Phaser Container of layered parts following
 * cell-parts.schema.json's layer order. The membrane, feeding/sensory/defense
 * "features" and movement layers are redrawn from the cell's acquired traits
 * (see applyVisuals) so evolution is visible on the organism itself — the same
 * runtime parts that a species portrait would use (brief §15). Facing flips at
 * the container level, never per part.
 */
export class CellOrganism {
    readonly container: Phaser.GameObjects.Container;
    private membrane: Phaser.GameObjects.Graphics;
    private features: Phaser.GameObjects.Graphics;
    private movement: Phaser.GameObjects.Graphics;
    private defenseGlow: Phaser.GameObjects.Arc;

    private vx = 0;
    private vy = 0;
    private targetRotation = 0;
    private idlePhase = 0;
    private baseScale = 1;
    private readonly appearance: AppearanceV2;
    private readonly r = CELL.cellRadius;
    private readonly albedo: number;
    private readonly accent: number;
    private readonly detail: number;

    constructor(scene: Phaser.Scene, x: number, y: number, palette?: OrganismPalette, appearance?: AppearanceV2) {
        const r = this.r;
        this.appearance = appearance ?? DEFAULT_APPEARANCE;
        this.albedo = palette?.albedo ?? COLORS.brandDeep;
        this.accent = palette?.accent ?? COLORS.brandHi;
        this.detail = palette?.detail ?? COLORS.brand;

        // Body proportions come from the chosen body part (34×30-ish on a
        // 100-unit viewBox → scaled to the display radius).
        const bodyDef = partById('body', this.appearance.body);
        const brx = r * ((bodyDef?.rx ?? 32) / 32);
        const bry = r * ((bodyDef?.ry ?? 32) / 32);

        const shadow = scene.add.ellipse(0, r * 0.5, brx * 2.1, bry * 0.9, 0x000000, 0.28);
        this.defenseGlow = scene.add.circle(0, 0, r * 1.35, this.accent, 0); // hidden until a defense part/trait
        const body = scene.add.ellipse(0, 0, brx * 2, bry * 2, this.albedo);

        const pattern = scene.add.graphics();
        this.drawPattern(pattern, brx, bry);

        const nucleus = scene.add.circle(-r * 0.12, -r * 0.06, r * 0.42, this.detail, 0.55);
        const nucleusCore = scene.add.circle(-r * 0.12, -r * 0.06, r * 0.18, this.accent);

        this.membrane = scene.add.graphics();
        this.features = scene.add.graphics();
        this.movement = scene.add.graphics();

        const highlight = scene.add.circle(-r * 0.38, -r * 0.4, r * 0.22, 0xffffff, 0.14);

        this.container = scene.add.container(x, y, [
            shadow, this.defenseGlow, body, pattern, nucleus, nucleusCore,
            this.membrane, this.features, this.movement, highlight,
        ]);
        this.container.setDepth(10);

        // Default (unevolved) look.
        this.applyVisuals({});
    }

    get x(): number {
        return this.container.x;
    }

    get y(): number {
        return this.container.y;
    }

    get radius(): number {
        return this.r * this.baseScale;
    }

    /** Grow (or set) the organism's size tier scale; tweened unless reduced motion. */
    setBaseScale(scale: number): void {
        this.baseScale = scale;
        if (prefersReducedMotion()) {
            this.container.setScale(scale);
            return;
        }
        this.container.scene.tweens.add({
            targets: this.container,
            scale,
            duration: 700,
            ease: 'Back.easeOut',
        });
    }

    /** The chosen-pattern overlay, styled per pattern part id. */
    private drawPattern(g: Phaser.GameObjects.Graphics, brx: number, bry: number): void {
        const style = this.appearance.pattern;
        if (style === 'plain') return;
        g.fillStyle(this.accent, 0.2);
        g.lineStyle(2, this.accent, 0.22);
        switch (style) {
            case 'stripe':
                for (let i = -1; i <= 1; i++) {
                    g.lineBetween(-brx * 0.55, i * bry * 0.42 - 4, brx * 0.55, i * bry * 0.42 + 4);
                }
                break;
            case 'ring':
                g.strokeEllipse(0, 0, brx * 1.1, bry * 1.1);
                break;
            case 'radial':
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2;
                    g.lineBetween(Math.cos(a) * brx * 0.25, Math.sin(a) * bry * 0.25, Math.cos(a) * brx * 0.8, Math.sin(a) * bry * 0.8);
                }
                break;
            case 'dotcore':
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    g.fillCircle(Math.cos(a) * brx * 0.22, Math.sin(a) * bry * 0.22, 2.2);
                }
                break;
            default: // speckle / mottle / gradient → scattered flecks
                for (const [px, py] of [[-8, -6], [6, -10], [10, 6], [-10, 8], [0, 2]]) {
                    g.fillCircle(px * (brx / this.r), py * (bry / this.r), 2.4);
                }
        }
    }

    /**
     * Redraw the organism's parts. The player's chosen appearance is the
     * baseline; trait-driven attachments (e.g. {membrane:'double'}) fill any
     * slot the player left at its default — evolution augments, never erases.
     */
    applyVisuals(attachments: Record<string, string>): void {
        const r = this.r;
        const ap = this.appearance;
        attachments = {
            membrane: ap.membrane !== 'smooth' ? ap.membrane : (attachments.membrane ?? ap.membrane),
            movement: ap.movement !== 'cilia' ? ap.movement : (attachments.movement ?? ap.movement),
            feeding: ap.feeding ?? attachments.feeding,
            sensory: ap.sensory !== 'eyespot' ? ap.sensory : (attachments.sensory ?? ''),
            defense: ap.defense !== 'none' ? ap.defense : (attachments.defense ?? ''),
        };

        // Membrane ------------------------------------------------------
        this.membrane.clear();
        const membraneStyle = attachments.membrane ?? 'smooth';
        const weight = membraneStyle === 'double' || membraneStyle === 'ridged' ? 4 : 3;
        this.membrane.lineStyle(weight, this.detail, 0.9);
        this.membrane.strokeCircle(0, 0, r);
        if (membraneStyle === 'double') {
            this.membrane.lineStyle(2, this.accent, 0.6);
            this.membrane.strokeCircle(0, 0, r - 5);
        }
        if (membraneStyle === 'ridged') {
            this.membrane.lineStyle(1.5, this.accent, 0.5);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                this.membrane.lineBetween(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2), Math.cos(a) * (r + 3), Math.sin(a) * (r + 3));
            }
        }
        if (membraneStyle === 'softspike') {
            this.membrane.fillStyle(this.detail, 0.8);
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                this.membrane.fillTriangle(
                    Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r,
                    Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r,
                    Math.cos(a) * (r + 6), Math.sin(a) * (r + 6),
                );
            }
        }
        if (membraneStyle === 'granular') {
            this.membrane.fillStyle(this.accent, 0.5);
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                this.membrane.fillCircle(Math.cos(a) * r, Math.sin(a) * r, 2);
            }
        }
        if (membraneStyle === 'wavy') {
            this.membrane.lineStyle(1.5, this.accent, 0.6);
            for (let i = 0; i < 24; i++) {
                const a = (i / 24) * Math.PI * 2;
                const b = ((i + 1) / 24) * Math.PI * 2;
                const ra = r + (i % 2 === 0 ? 2.5 : -1.5);
                const rb = r + (i % 2 === 0 ? -1.5 : 2.5);
                this.membrane.lineBetween(Math.cos(a) * ra, Math.sin(a) * ra, Math.cos(b) * rb, Math.sin(b) * rb);
            }
        }

        // Movement (trailing edge) -------------------------------------
        this.movement.clear();
        const move = attachments.movement ?? 'cilia';
        this.movement.lineStyle(2, this.accent, 0.7);
        if (move === 'flagellum' || move === 'twin_flagella') {
            const count = move === 'twin_flagella' ? 2 : 1;
            for (let t = 0; t < count; t++) {
                const oy = count === 2 ? (t === 0 ? -6 : 6) : 0;
                this.movement.beginPath();
                this.movement.moveTo(-r, oy);
                this.movement.lineTo(-r - 16, oy + 6);
                this.movement.lineTo(-r - 26, oy - 4);
                this.movement.strokePath();
            }
        } else if (move === 'jet') {
            this.movement.fillStyle(this.detail, 0.9);
            this.movement.fillTriangle(-r + 2, -6, -r + 2, 6, -r - 12, 0);
            this.movement.fillStyle(this.accent, 0.5);
            this.movement.fillCircle(-r - 16, 0, 3.5);
            this.movement.fillCircle(-r - 23, 0, 2.2);
        } else if (move === 'fin') {
            this.movement.fillStyle(this.accent, 0.55);
            this.movement.beginPath();
            this.movement.moveTo(-r * 0.2, -r * 0.9);
            this.movement.lineTo(-r - 14, 0);
            this.movement.lineTo(-r * 0.2, r * 0.9);
            this.movement.closePath();
            this.movement.fillPath();
        } else if (move === 'pseudopods') {
            this.movement.fillStyle(this.albedo, 0.9);
            for (let i = -1; i <= 1; i++) {
                this.movement.fillEllipse(-r - 5, i * (r * 0.5), 14, 8);
            }
        } else {
            // cilia / fin / pseudopods → a fringe
            for (let i = -2; i <= 2; i++) {
                const cy = i * (r * 0.28);
                this.movement.lineBetween(-r, cy, -r - 9, cy + 2);
            }
        }

        // Features: feeding + sensory + defense ------------------------
        this.features.clear();
        this.container.alpha = 1; // reset; only camouflage dims the whole cell

        // Feeding organ at the leading edge (right). Unknown ids fall back
        // to the generic mouth so trait attachments can't crash the draw.
        const feeding = attachments.feeding;
        const fx = r * 0.9;
        if (feeding) {
            switch (feeding) {
                case 'filter': // 3 short baleen slits
                    this.features.lineStyle(2, this.detail, 0.85);
                    for (const oy of [-r * 0.18, 0, r * 0.18]) {
                        this.features.lineBetween(fx, oy - r * 0.09, fx, oy + r * 0.09);
                    }
                    break;
                case 'gullet': // big dark mouth
                    this.features.fillStyle(0x06201d, 0.9);
                    this.features.fillCircle(fx, 0, r * 0.26);
                    break;
                case 'pseudopod': // two blunt arm lobes
                    this.features.fillStyle(this.albedo, 0.95);
                    this.features.fillEllipse(fx + 3, -r * 0.24, r * 0.34, r * 0.24);
                    this.features.fillEllipse(fx + 3, r * 0.24, r * 0.34, r * 0.24);
                    break;
                case 'groove': // a notch/channel
                    this.features.lineStyle(2.5, this.detail, 0.85);
                    this.features.lineBetween(fx - r * 0.2, -r * 0.18, fx + r * 0.14, 0);
                    this.features.lineBetween(fx - r * 0.2, r * 0.18, fx + r * 0.14, 0);
                    break;
                case 'proboscis': // a thin needle protruding
                    this.features.lineStyle(2, this.detail, 0.95);
                    this.features.lineBetween(fx - r * 0.1, 0, fx + r * 0.5, 0);
                    this.features.fillStyle(this.detail, 0.95);
                    this.features.fillCircle(fx + r * 0.5, 0, 1.8);
                    break;
                case 'pore': // 3 tiny dots
                    this.features.fillStyle(this.detail, 0.85);
                    for (const oy of [-r * 0.16, 0, r * 0.16]) this.features.fillCircle(fx, oy, 1.8);
                    break;
                default: // generic mouth (unknown / trait ids)
                    this.features.fillStyle(this.detail, 0.85);
                    this.features.fillCircle(fx, 0, r * 0.22);
                    this.features.fillStyle(0x06201d, 0.9);
                    this.features.fillCircle(fx + r * 0.08, 0, r * 0.1);
            }
        }

        // Sensory (front-upper). Unknown ids fall back to the eyespot dot.
        const sensory = attachments.sensory;
        const sx = r * 0.4, sy = -r * 0.44;
        switch (sensory) {
            case 'photosensor': // small bar/strip
                this.features.fillStyle(COLORS.integrity, 1);
                this.features.fillRect(sx - r * 0.18, sy - r * 0.05, r * 0.36, r * 0.1);
                break;
            case 'chemobristle': // 3 tiny bristle hairs
                this.features.lineStyle(1.5, this.accent, 0.9);
                for (let i = -1; i <= 1; i++) {
                    this.features.lineBetween(sx + i * 3, sy, sx + i * 5, sy - r * 0.3);
                }
                break;
            case 'stalk_eye': // raised stalk + eye
                this.features.lineStyle(2, this.accent, 0.8);
                this.features.lineBetween(sx, sy, r * 0.6, -r * 0.72);
                this.features.fillStyle(COLORS.integrity, 1);
                this.features.fillCircle(r * 0.6, -r * 0.72, r * 0.14);
                break;
            case 'pit': // dark crater ring
                this.features.lineStyle(2.5, this.detail, 0.9);
                this.features.strokeCircle(sx, sy, r * 0.16);
                this.features.fillStyle(0x06201d, 0.8);
                this.features.fillCircle(sx, sy, r * 0.07);
                break;
            case 'antenna': // two long thin antennae
                this.features.lineStyle(1.5, this.accent, 0.85);
                this.features.lineBetween(sx, sy, sx + r * 0.18, sy - r * 0.72);
                this.features.lineBetween(sx + r * 0.1, sy, sx + r * 0.42, sy - r * 0.6);
                break;
            default: // eyespot (also '' / unknown)
                this.features.fillStyle(COLORS.integrity, 1);
                this.features.fillCircle(sx, sy, r * 0.16);
        }

        // Defense (outer). Mucus keeps the soft glow; each other id draws a
        // distinct silhouette. Unknown ids fall back to the glow, never crash.
        const defense = attachments.defense;
        this.defenseGlow.setFillStyle(this.accent, 0);
        switch (defense) {
            case '':
            case undefined:
                break;
            case 'toxin_sac': // green-tinted sac on the flank
                this.features.fillStyle(0x7dc95e, 0.9);
                this.features.fillCircle(-r * 0.2, r * 0.72, r * 0.2);
                this.features.lineStyle(1.5, 0x4f8a3a, 0.8);
                this.features.strokeCircle(-r * 0.2, r * 0.72, r * 0.2);
                break;
            case 'spike_ring': // ring of small triangles outside the membrane
                this.features.fillStyle(this.detail, 0.85);
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2;
                    this.features.fillTriangle(
                        Math.cos(a - 0.1) * r, Math.sin(a - 0.1) * r,
                        Math.cos(a + 0.1) * r, Math.sin(a + 0.1) * r,
                        Math.cos(a) * (r + 8), Math.sin(a) * (r + 8),
                    );
                }
                break;
            case 'thick_wall': // a second heavy outline
                this.features.lineStyle(5, this.detail, 0.9);
                this.features.strokeCircle(0, 0, r + 4);
                break;
            case 'spines': // 5 long lances
                this.features.lineStyle(2.5, this.detail, 0.95);
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 + 0.3;
                    this.features.lineBetween(Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r + 18), Math.sin(a) * (r + 18));
                }
                break;
            case 'camouflage': // dappled patches + translucent cell
                this.container.alpha = 0.72;
                this.features.fillStyle(this.detail, 0.3);
                for (const [px, py] of [[-r * 0.4, -r * 0.3], [r * 0.3, r * 0.4], [r * 0.5, -r * 0.4], [-r * 0.3, r * 0.5]]) {
                    this.features.fillCircle(px, py, r * 0.18);
                }
                break;
            case 'mucus':
            default: // soft glow (mucus and unknown ids)
                this.defenseGlow.setFillStyle(this.accent, 0.14);
        }
    }

    pulse(): void {
        this.container.scene.tweens.add({
            targets: this.container,
            scale: this.baseScale * 1.15,
            duration: 300,
            yoyo: true,
            ease: 'Cubic.easeOut',
            onComplete: () => this.container.setScale(this.baseScale),
        });
    }

    setVelocity(vx: number, vy: number): void {
        this.vx = vx;
        this.vy = vy;
        // Full 360° facing: turn toward the direction of travel.
        if (this.isMoving()) {
            this.targetRotation = Math.atan2(vy, vx);
        }
    }

    isMoving(): boolean {
        return Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1;
    }

    update(dtSeconds: number, bounds: Phaser.Geom.Rectangle): void {
        const nx = Phaser.Math.Clamp(this.container.x + this.vx * dtSeconds, bounds.left + this.radius, bounds.right - this.radius);
        const ny = Phaser.Math.Clamp(this.container.y + this.vy * dtSeconds, bounds.top + this.radius, bounds.bottom - this.radius);
        this.container.setPosition(nx, ny);

        // Smoothly rotate toward the heading; gently sway when idle.
        if (this.isMoving()) {
            this.container.rotation = Phaser.Math.Angle.RotateTo(this.container.rotation, this.targetRotation, 9 * dtSeconds);
        } else if (!prefersReducedMotion()) {
            this.idlePhase += dtSeconds;
            this.container.rotation += Math.sin(this.idlePhase * 1.4) * 0.004;
        }
    }
}
