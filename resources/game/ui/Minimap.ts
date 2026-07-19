import Phaser from 'phaser';
import { COLORS, DESIGN_WIDTH, DESIGN_HEIGHT } from '../config';
import type { WorldSpec } from '../lib/worldCamera';

/**
 * A screen-pinned minimap for the scrolling worlds. Scenes feed it dots
 * (player, food, threats, settlements) each update; it renders them scaled
 * into a small framed map plus the camera's current view rectangle.
 *
 * The main camera's zoom scales even scrollFactor-0 objects, so layout()
 * counter-scales and re-anchors the container every update — this keeps the
 * minimap glued to its screen corner across zoom tiers without a second
 * camera or scene.
 */

export interface MinimapEntry {
    x: number;
    y: number;
    color: number;
    /** Dot radius in minimap pixels (default 2). */
    size?: number;
    alpha?: number;
}

export interface MinimapOpts {
    /** Minimap width in px; height follows the world aspect. */
    width?: number;
    /** Screen-space anchor of the top-left corner. */
    anchorX?: number;
    anchorY?: number;
    /**
     * Called with world coordinates when the player clicks or drags the map.
     * Scenes decide how to move (centre, clamp, wrap) rather than the widget.
     */
    onSeek?: (worldX: number, worldY: number) => void;
}

/** How much larger the expanded map is than its pinned size. */
const EXPANDED_SCALE = 2;

export class Minimap {
    private readonly container: Phaser.GameObjects.Container;
    private readonly dots: Phaser.GameObjects.Graphics;
    private readonly viewRect: Phaser.GameObjects.Graphics;
    private readonly mapW: number;
    private readonly mapH: number;
    private readonly anchorX: number;
    private readonly anchorY: number;
    private readonly toggle: Phaser.GameObjects.Graphics;
    private readonly onSeek?: (worldX: number, worldY: number) => void;
    private hovered = false;
    private seeking = false;
    private expanded = false;

    constructor(private scene: Phaser.Scene, private world: WorldSpec, opts: MinimapOpts = {}) {
        this.onSeek = opts.onSeek;
        this.mapW = opts.width ?? 188;
        this.mapH = Math.round(this.mapW * (world.height / world.width));
        this.anchorX = opts.anchorX ?? 16;
        this.anchorY = opts.anchorY ?? DESIGN_HEIGHT - this.mapH - 148;

        const frame = scene.add.graphics();
        frame.fillStyle(0x04100f, 0.72);
        frame.fillRoundedRect(0, 0, this.mapW, this.mapH, 8);
        frame.lineStyle(1.5, COLORS.brandDeep, 0.7);
        frame.strokeRoundedRect(0, 0, this.mapW, this.mapH, 8);

        this.viewRect = scene.add.graphics();
        this.dots = scene.add.graphics();

        // Click or drag anywhere on the map to send the camera there.
        const seekZone = scene.add.zone(0, 0, this.mapW, this.mapH).setOrigin(0, 0);
        seekZone.setInteractive({ useHandCursor: true });
        seekZone.on('pointerover', () => { this.hovered = true; });
        seekZone.on('pointerout', () => { this.hovered = false; });
        seekZone.on('pointerdown', (_p: Phaser.Input.Pointer, lx: number, ly: number) => {
            this.seeking = true;
            this.seek(lx, ly);
        });
        seekZone.on('pointermove', (p: Phaser.Input.Pointer, lx: number, ly: number) => {
            if (this.seeking && p.isDown) this.seek(lx, ly);
        });
        scene.input.on('pointerup', () => { this.seeking = false; });

        // Expand toggle, top-right of the frame.
        this.toggle = scene.add.graphics();
        this.drawToggle();
        const toggleZone = scene.add.zone(this.mapW - 22, 2, 20, 20).setOrigin(0, 0);
        toggleZone.setInteractive({ useHandCursor: true });
        toggleZone.on('pointerover', () => { this.hovered = true; });
        toggleZone.on('pointerout', () => { this.hovered = false; });
        toggleZone.on('pointerdown', () => {
            this.expanded = !this.expanded;
            this.drawToggle();
        });

        this.container = scene.add.container(this.anchorX, this.anchorY, [
            frame, this.viewRect, this.dots, seekZone, this.toggle, toggleZone,
        ]);
        this.container.setDepth(1000).setScrollFactor(0);
    }

    /** True while the pointer is over the map — scenes use this to not pan. */
    get pointerOver(): boolean {
        return this.hovered;
    }

    private seek(localX: number, localY: number): void {
        if (!this.onSeek) return;
        this.onSeek(
            (Phaser.Math.Clamp(localX, 0, this.mapW) / this.mapW) * this.world.width,
            (Phaser.Math.Clamp(localY, 0, this.mapH) / this.mapH) * this.world.height,
        );
    }

    private drawToggle(): void {
        this.toggle.clear();
        this.toggle.fillStyle(0x04100f, 0.8);
        this.toggle.fillRoundedRect(this.mapW - 22, 2, 20, 20, 5);
        this.toggle.lineStyle(1.4, COLORS.brandHi, 0.85);
        this.toggle.strokeRoundedRect(this.mapW - 22, 2, 20, 20, 5);
        // Arrows out when collapsed, in when expanded.
        const cx = this.mapW - 12;
        const cy = 12;
        const r = this.expanded ? 3 : 6;
        this.toggle.lineBetween(cx - r, cy - r, cx + r, cy + r);
        this.toggle.lineBetween(cx - r, cy + r, cx + r, cy - r);
    }

    /** Map a world coordinate to minimap-local pixels. */
    private toMap(x: number, y: number): [number, number] {
        return [
            Phaser.Math.Clamp((x / this.world.width) * this.mapW, 2, this.mapW - 2),
            Phaser.Math.Clamp((y / this.world.height) * this.mapH, 2, this.mapH - 2),
        ];
    }

    /** Redraw dots + camera view rectangle and keep the map glued on screen. */
    update(entries: MinimapEntry[]): void {
        this.layout();

        const cam = this.scene.cameras.main;
        this.viewRect.clear();
        this.viewRect.lineStyle(1, COLORS.brandHi, 0.45);
        const [vx, vy] = this.toMap(cam.worldView.x, cam.worldView.y);
        const vw = (cam.worldView.width / this.world.width) * this.mapW;
        const vh = (cam.worldView.height / this.world.height) * this.mapH;
        this.viewRect.strokeRect(vx, vy, Math.min(vw, this.mapW - vx - 2), Math.min(vh, this.mapH - vy - 2));

        this.dots.clear();
        for (const e of entries) {
            const [mx, my] = this.toMap(e.x, e.y);
            this.dots.fillStyle(e.color, e.alpha ?? 1);
            this.dots.fillCircle(mx, my, e.size ?? 2);
        }
    }

    /** Counter the main camera's zoom so the map stays anchored and unscaled. */
    private layout(): void {
        const z = this.scene.cameras.main.zoom;
        const halfW = DESIGN_WIDTH / 2;
        const halfH = DESIGN_HEIGHT / 2;
        // Expanding scales the whole container; children keep drawing in
        // unscaled map pixels, and pointer local coords stay in that space too.
        this.container.setScale((this.expanded ? EXPANDED_SCALE : 1) / z);
        this.container.setPosition(halfW + (this.anchorX - halfW) / z, halfH + (this.anchorY - halfH) / z);
    }

    setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }

    destroy(): void {
        this.container.destroy(true);
    }
}
