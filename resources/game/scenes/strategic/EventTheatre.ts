import Phaser from 'phaser';
import { COLORS } from '../../config';
import { prefersReducedMotion } from '../../lib/motion';
import { makeTexture } from '../../lib/spriteFactory';
import { unitTexture, isUnitId, type UnitId } from '../../data/sprites/unitSprites';
import type { EventVisual } from '../../systems/managementState';

type Pt = { x: number; y: number };
type Ctx = { home: Pt; rival?: Pt; site?: Pt };

const hexToNum = (hex: string | undefined, fallback: number): number =>
    hex ? parseInt(hex.replace('#', ''), 16) : fallback;

/**
 * Plays strategic events out ON the map before their decision modal opens.
 * Every strategic event routes to a bespoke on-theme beat: raiders march and
 * torch the settlement, herds migrate across the plain, plagues spread sickly
 * motes from a city, harvests and blooms burst gold and teal over the land,
 * crowds raise banners, beacons pulse expanding rings, stars flare. Each beat
 * resolves a Promise (~1–2.5s) so the scene can delay the modal until the
 * action lands; lingering cleanup fades out afterwards. Reduced motion resolves
 * instantly with no animation.
 */
export class EventTheatre {
    constructor(private scene: Phaser.Scene, private worldW: number, private worldH: number) {}

    // ---- Shared primitives --------------------------------------------------

    private spawnUnits(id: UnitId, count: number, x: number, y: number): Phaser.GameObjects.Image[] {
        const key = unitTexture(this.scene, id);
        const units: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < count; i++) {
            units.push(this.scene.add.image(x + (i % 3) * 20 - 20, y + Math.floor(i / 3) * 16, key).setDepth(9));
        }
        return units;
    }

    private walk(units: Phaser.GameObjects.Image[], tx: number, ty: number, durationMs: number): Promise<void> {
        return new Promise((resolve) => {
            if (units.length === 0) return resolve();
            let done = 0;
            units.forEach((u, i) => {
                this.scene.tweens.add({
                    targets: u,
                    x: tx + (i % 3) * 20 - 20,
                    y: ty + Math.floor(i / 3) * 16,
                    duration: durationMs + i * 90,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        if (++done === units.length) resolve();
                    },
                });
                // A subtle walking bob.
                this.scene.tweens.add({ targets: u, angle: { from: -4, to: 4 }, duration: 220, yoyo: true, repeat: Math.ceil(durationMs / 440) });
            });
        });
    }

    private fadeOut(objs: Phaser.GameObjects.GameObject[], delayMs = 600): void {
        if (objs.length === 0) return;
        this.scene.time.delayedCall(delayMs, () => {
            this.scene.tweens.add({ targets: objs, alpha: 0, duration: 500, onComplete: () => objs.forEach((o) => o.destroy()) });
        });
    }

    /** A cached soft round mote texture for particle emitters, keyed by colour. */
    private moteKey(hex: number): string {
        return makeTexture(this.scene, `osl-mote-${hex.toString(16)}`, 10, 10, (g) => {
            g.fillStyle(hex, 0.35);
            g.fillCircle(5, 5, 5);
            g.fillStyle(hex, 1);
            g.fillCircle(5, 5, 3);
        });
    }

    /** Explode a one-off particle burst at a point, cleaning itself up. */
    private burst(
        x: number,
        y: number,
        hex: number,
        opts: { count?: number; speed?: number; lifespan?: number; scale?: number; gravityY?: number; angle?: { min: number; max: number } } = {},
    ): void {
        const lifespan = opts.lifespan ?? 900;
        const count = opts.count ?? 14;
        const emitter = this.scene.add
            .particles(x, y, this.moteKey(hex), {
                speed: { min: (opts.speed ?? 70) * 0.35, max: opts.speed ?? 70 },
                angle: opts.angle ?? { min: 0, max: 360 },
                scale: { start: opts.scale ?? 0.9, end: 0 },
                alpha: { start: 0.95, end: 0 },
                lifespan,
                gravityY: opts.gravityY ?? 0,
                emitting: false,
            })
            .setDepth(11);
        emitter.explode(count);
        this.scene.time.delayedCall(lifespan + 250, () => emitter.destroy());
    }

    /** A single expanding ring that fades as it grows. */
    private ring(x: number, y: number, hex: number, opts: { radius?: number; scale?: number; duration?: number; delay?: number; width?: number } = {}): Phaser.GameObjects.Arc {
        const arc = this.scene.add
            .circle(x, y, opts.radius ?? 10, hex, 0)
            .setStrokeStyle(opts.width ?? 2.5, hex, 0.85)
            .setDepth(10)
            .setScale(0.2);
        this.scene.tweens.add({
            targets: arc,
            scale: opts.scale ?? 3,
            alpha: 0,
            duration: opts.duration ?? 900,
            delay: opts.delay ?? 0,
            ease: 'Sine.easeOut',
            onComplete: () => arc.destroy(),
        });
        return arc;
    }

    /** A whole-world colour wash that swells in then drifts away. */
    private wash(hex: number, peak = 0.14, holdMs = 2200): Promise<void> {
        const rect = this.scene.add.rectangle(this.worldW / 2, this.worldH / 2, this.worldW, this.worldH, hex, 0).setDepth(15);
        return new Promise<void>((resolve) => {
            this.scene.tweens.add({
                targets: rect,
                fillAlpha: peak,
                duration: 650,
                onComplete: () => {
                    this.scene.tweens.add({ targets: rect, fillAlpha: 0, duration: 2200, delay: holdMs, onComplete: () => rect.destroy() });
                    resolve();
                },
            });
        });
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
    }

    // ---- Original generic beats --------------------------------------------

    /**
     * A raid: raiders spawn at the rival camp, march on the settlement, torch
     * it (flash + smoke), and withdraw. Resolves when the torching lands.
     */
    async playRaid(from: Pt, to: Pt, count = 3): Promise<void> {
        if (prefersReducedMotion()) return;
        const units = this.spawnUnits('raider', count, from.x, from.y);
        await this.walk(units, to.x + 40, to.y + 20, 1400);

        // Torch flash + smoke plume.
        const flash = this.scene.add.circle(to.x, to.y, 34, 0xf2795f, 0.55).setDepth(10);
        this.scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 480, onComplete: () => flash.destroy() });
        for (let i = 0; i < 5; i++) {
            const puff = this.scene.add.circle(to.x + i * 7 - 14, to.y - 6, 6 + i * 2, 0x4a4038, 0.5).setDepth(10);
            this.scene.tweens.add({ targets: puff, y: to.y - 60 - i * 14, alpha: 0, scale: 1.9, duration: 1100 + i * 160, onComplete: () => puff.destroy() });
        }

        // March home again.
        void this.walk(units, from.x, from.y, 1200).then(() => units.forEach((u) => u.destroy()));
    }

    /** An arrival: units walk in from the nearest map edge to the hearth. */
    async playArrival(to: Pt, sprite: string | undefined, count: number): Promise<void> {
        if (prefersReducedMotion()) return;
        const id: UnitId = isUnitId(sprite) ? sprite : 'wanderer';
        const fromX = to.x < this.worldW / 2 ? -30 : this.worldW + 30;
        const units = this.spawnUnits(id, count, fromX, to.y + 60);
        await this.walk(units, to.x + 50, to.y + 40, 1500);
        this.fadeOut(units, 2600);
    }

    /** A weather/climate wash over the whole world. */
    async playWeather(tintHex: string | undefined): Promise<void> {
        if (prefersReducedMotion()) return;
        await this.wash(hexToNum(tintHex, COLORS.secondary), 0.14, 2200);
    }

    /** Construction: scaffolding pulse at a spot (rival city rises, etc.). */
    async playConstruction(at: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const frame = this.scene.add.rectangle(at.x, at.y - 8, 22, 18).setStrokeStyle(2, COLORS.secondary, 0.9).setDepth(9).setScale(0);
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: frame, scale: 1, duration: 420, ease: 'Back.easeOut', onComplete: () => resolve() });
        });
        // A second storey rises to sell the growth.
        const upper = this.scene.add.rectangle(at.x, at.y - 24, 16, 12).setStrokeStyle(2, COLORS.secondary, 0.7).setDepth(9).setScale(0);
        this.scene.tweens.add({ targets: upper, scale: 1, duration: 380, delay: 120, ease: 'Back.easeOut' });
        this.fadeOut([frame, upper], 1800);
    }

    /** A ship launches from one point to another (starmap probes/colonies). */
    async playLaunch(from: Pt, to: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const ship = this.scene.add.image(from.x, from.y, unitTexture(this.scene, 'ship')).setDepth(9);
        ship.setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));
        const trail = this.scene.add.graphics().setDepth(8);
        trail.lineStyle(1.5, 0x8fe9d6, 0.4);
        trail.lineBetween(from.x, from.y, to.x, to.y);
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: ship, x: to.x, y: to.y, duration: 1300, ease: 'Sine.easeInOut', onComplete: () => resolve() });
        });
        this.fadeOut([ship, trail], 700);
    }

    /** A region flashes and greys (planetary secession). */
    async playSecession(at: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const ring = this.scene.add.circle(at.x, at.y, 60, COLORS.danger, 0).setStrokeStyle(3, COLORS.danger, 0.9).setDepth(10);
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: ring, scale: 1.6, duration: 600, yoyo: true, repeat: 1, onComplete: () => resolve() });
        });
        this.fadeOut([ring], 400);
    }

    /** A pulsing anomaly glow (sky omens, strange signals). */
    async playAnomaly(at: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const glow = this.scene.add.circle(at.x, at.y, 16, 0xbfe8f5, 0.7).setDepth(10);
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: glow, scale: 2.4, alpha: 0.15, duration: 520, yoyo: true, repeat: 2, onComplete: () => resolve() });
        });
        this.fadeOut([glow], 300);
    }

    // ---- Bespoke per-event beats -------------------------------------------

    /** Drought: a parched amber wash with dust motes rising off cracked ground. */
    async playDrought(tintHex: string | undefined): Promise<void> {
        if (prefersReducedMotion()) return;
        const tint = hexToNum(tintHex, 0xf2b56a);
        for (let i = 0; i < 6; i++) {
            const x = this.worldW * (0.25 + i * 0.09);
            const y = this.worldH * (0.5 + (i % 2) * 0.12);
            const dust = this.scene.add.circle(x, y, 5 + (i % 3) * 3, 0xd8b98a, 0.5).setDepth(11);
            this.scene.tweens.add({ targets: dust, y: y - 50 - i * 8, x: x + 20, alpha: 0, scale: 1.8, duration: 1600 + i * 120, onComplete: () => dust.destroy() });
        }
        await this.wash(tint, 0.18, 1900);
    }

    /** Migration: a strung-out line of beasts crosses the plain edge to edge. */
    async playMigration(sprite: string | undefined, count: number): Promise<void> {
        if (prefersReducedMotion()) return;
        const id: UnitId = isUnitId(sprite) ? sprite : 'beast';
        const key = unitTexture(this.scene, id);
        const y = this.worldH * 0.56;
        const units: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < count; i++) units.push(this.scene.add.image(-60 - i * 46, y + (i % 2) * 18, key).setDepth(9));
        await new Promise<void>((resolve) => {
            let done = 0;
            units.forEach((u, i) => {
                this.scene.tweens.add({ targets: u, x: this.worldW + 80, duration: 2000, delay: i * 90, ease: 'Sine.easeInOut', onComplete: () => { if (++done === units.length) resolve(); } });
                this.scene.tweens.add({ targets: u, y: `+=6`, duration: 300, yoyo: true, repeat: 8, delay: i * 90 });
            });
        });
        units.forEach((u) => u.destroy());
    }

    /** Omen: a burning light streaks across the night sky over home, then flares. */
    async playOmen(home: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const tint = 0x1a2740;
        const startX = home.x - 220;
        const endX = home.x + 200;
        const y0 = this.worldH * 0.12;
        const light = this.scene.add.circle(startX, y0, 6, 0xfff2c8, 1).setDepth(13);
        // A fading trail of embers dropped along the arc.
        const trailTimer = this.scene.time.addEvent({
            delay: 55,
            repeat: 20,
            callback: () => {
                const ember = this.scene.add.circle(light.x, light.y, 3.5, 0xf5b955, 0.8).setDepth(12);
                this.scene.tweens.add({ targets: ember, alpha: 0, scale: 0.3, duration: 700, onComplete: () => ember.destroy() });
            },
        });
        void this.wash(tint, 0.1, 900);
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: light, x: endX, duration: 1300, ease: 'Sine.easeIn' });
            this.scene.tweens.add({ targets: light, y: y0 + 60, duration: 1300, ease: 'Quad.easeIn', onComplete: () => resolve() });
        });
        trailTimer.remove();
        this.burst(light.x, light.y, 0xffd9a0, { count: 12, speed: 90, lifespan: 700 });
        this.fadeOut([light], 120);
    }

    /** Plague: sickly motes seep outward from a city as murk rings spread. */
    async playPlague(at: Pt, tintHex: string | undefined, count: number): Promise<void> {
        if (prefersReducedMotion()) return;
        const tint = hexToNum(tintHex, 0x8a2f6f);
        this.ring(at.x, at.y, tint, { scale: 3.4, duration: 1400 });
        this.ring(at.x, at.y, tint, { scale: 3.4, duration: 1400, delay: 320 });
        this.burst(at.x, at.y, tint, { count, speed: 55, lifespan: 1500, gravityY: -8, scale: 1.1 });
        await this.wait(1500);
    }

    /** Harvest: a golden bloom bursts up over the terraces. */
    async playHarvest(at: Pt, tintHex: string | undefined, count: number): Promise<void> {
        if (prefersReducedMotion()) return;
        const gold = hexToNum(tintHex, 0xc8e06a);
        this.burst(at.x, at.y + 20, gold, { count, speed: 120, lifespan: 1400, gravityY: -30, angle: { min: 250, max: 290 }, scale: 1.1 });
        this.burst(at.x - 40, at.y + 20, 0xf5b955, { count: Math.round(count * 0.6), speed: 90, lifespan: 1300, gravityY: -20, angle: { min: 250, max: 290 } });
        this.burst(at.x + 40, at.y + 20, 0xf5b955, { count: Math.round(count * 0.6), speed: 90, lifespan: 1300, gravityY: -20, angle: { min: 250, max: 290 } });
        await this.wash(gold, 0.1, 1500);
    }

    /** Storm: a dark wash with diagonal wind streaks and lightning flashes. */
    async playStorm(tintHex: string | undefined): Promise<void> {
        if (prefersReducedMotion()) return;
        const tint = hexToNum(tintHex, 0xf2795f);
        for (let i = 0; i < 10; i++) {
            const x = this.worldW * (0.1 + i * 0.09);
            const streak = this.scene.add.graphics().setDepth(12);
            streak.lineStyle(2, 0xbfd0d8, 0.5);
            streak.lineBetween(x, -20, x - 60, this.worldH + 20);
            streak.setAlpha(0);
            this.scene.tweens.add({ targets: streak, alpha: 0.6, x: -80, duration: 900, delay: i * 70, yoyo: true, onComplete: () => streak.destroy() });
        }
        // Two lightning flashes.
        for (const d of [500, 1200]) {
            const flash = this.scene.add.rectangle(this.worldW / 2, this.worldH / 2, this.worldW, this.worldH, 0xffffff, 0).setDepth(16);
            this.scene.tweens.add({ targets: flash, fillAlpha: 0.35, duration: 90, delay: d, yoyo: true, onComplete: () => flash.destroy() });
        }
        await this.wash(tint, 0.2, 1600);
    }

    /** Bloom: teal life bursts and expanding rings ripple from restored seas. */
    async playBloom(at: Pt, tintHex: string | undefined, count: number): Promise<void> {
        if (prefersReducedMotion()) return;
        const teal = hexToNum(tintHex, 0x4fd4c4);
        this.ring(at.x, at.y, teal, { scale: 4, duration: 1500 });
        this.ring(at.x, at.y, teal, { scale: 4, duration: 1500, delay: 300 });
        this.burst(at.x, at.y, teal, { count, speed: 100, lifespan: 1500, scale: 1.1 });
        this.burst(at.x, at.y, 0x8fe9d6, { count: Math.round(count * 0.5), speed: 60, lifespan: 1300 });
        await this.wash(teal, 0.11, 1500);
    }

    /** Strike/uprising: a crowd gathers at home and raises banners aloft. */
    async playStrike(home: Pt, danger = false): Promise<void> {
        if (prefersReducedMotion()) return;
        const crowd = this.spawnUnits('crowd', danger ? 8 : 6, home.x, home.y + 90);
        void this.walk(crowd, home.x, home.y + 44, 1300);
        // Banners rise and sway above the gathering.
        const key = unitTexture(this.scene, 'banner');
        const banners: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < 3; i++) {
            const b = this.scene.add.image(home.x + (i - 1) * 34, home.y + 40, key).setDepth(10).setScale(0).setOrigin(0.5, 1);
            banners.push(b);
            this.scene.tweens.add({ targets: b, scale: 1, y: home.y + 24, duration: 500, delay: 700 + i * 130, ease: 'Back.easeOut' });
            this.scene.tweens.add({ targets: b, angle: { from: -8, to: 8 }, duration: 520, yoyo: true, repeat: 4, delay: 1200 + i * 130 });
        }
        if (danger) void this.wash(COLORS.danger, 0.12, 1200);
        await this.wait(1800);
        this.fadeOut([...crowd, ...banners], 1400);
    }

    /** Signal: a beacon pulses at a site, spitting expanding concentric rings. */
    async playSignal(at: Pt, tintHex: string | undefined): Promise<void> {
        if (prefersReducedMotion()) return;
        const tint = hexToNum(tintHex, 0xbfe8f5);
        const core = this.scene.add.circle(at.x, at.y, 8, tint, 0.9).setDepth(12);
        this.scene.tweens.add({ targets: core, scale: 1.6, alpha: 0.4, duration: 420, yoyo: true, repeat: 3 });
        for (let i = 0; i < 3; i++) this.ring(at.x, at.y, tint, { scale: 3.6, duration: 1300, delay: i * 380 });
        await this.wait(1900);
        this.fadeOut([core], 200);
    }

    /** Discovery: rings pulse at a site as an alien craft glides toward home. */
    async playDiscovery(home: Pt, at: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        for (let i = 0; i < 3; i++) this.ring(at.x, at.y, 0x8fe9d6, { scale: 3.4, duration: 1200, delay: i * 300 });
        const glyph = this.scene.add.image(at.x, at.y, unitTexture(this.scene, 'ship')).setDepth(10).setScale(0.6).setTint(0xbfe8f5);
        glyph.setRotation(Phaser.Math.Angle.Between(at.x, at.y, home.x, home.y));
        const midX = at.x + (home.x - at.x) * 0.45;
        const midY = at.y + (home.y - at.y) * 0.45;
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: glyph, x: midX, y: midY, scale: 1, duration: 1500, ease: 'Sine.easeInOut', onComplete: () => resolve() });
        });
        this.fadeOut([glyph], 500);
    }

    /** Flare: the home star convulses — a bright core, radiating arcs, gold wash. */
    async playFlare(home: Pt, tintHex: string | undefined): Promise<void> {
        if (prefersReducedMotion()) return;
        const gold = hexToNum(tintHex, 0xf5b955);
        const core = this.scene.add.circle(home.x, home.y, 12, 0xfff2c8, 0.95).setDepth(13);
        this.scene.tweens.add({ targets: core, scale: 2.4, alpha: 0.3, duration: 500, yoyo: true, repeat: 2 });
        for (let i = 0; i < 8; i++) {
            const ang = (Math.PI * 2 * i) / 8;
            const streak = this.scene.add.graphics().setDepth(12);
            streak.lineStyle(2.5, gold, 0.8);
            streak.lineBetween(home.x, home.y, home.x + Math.cos(ang) * 20, home.y + Math.sin(ang) * 20);
            streak.setAlpha(0);
            this.scene.tweens.add({
                targets: streak,
                alpha: 0.7,
                scaleX: 4,
                scaleY: 4,
                duration: 900,
                delay: 200 + i * 30,
                yoyo: true,
                onComplete: () => streak.destroy(),
            });
        }
        this.burst(home.x, home.y, gold, { count: 20, speed: 150, lifespan: 1000 });
        await this.wash(gold, 0.16, 1400);
        this.fadeOut([core], 200);
    }

    /** Festival: lanterns drift up from home under bursting fireworks. */
    async playFestival(home: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const key = unitTexture(this.scene, 'lantern');
        const lanterns: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < 5; i++) {
            const l = this.scene.add.image(home.x + (i - 2) * 22, home.y + 20, key).setDepth(10);
            lanterns.push(l);
            this.scene.tweens.add({ targets: l, y: home.y - 120 - i * 10, x: `+=${(i - 2) * 12}`, duration: 2200, ease: 'Sine.easeOut' });
            this.scene.tweens.add({ targets: l, alpha: 0, duration: 900, delay: 1500, onComplete: () => l.destroy() });
        }
        // Staggered firework bursts overhead.
        const colours = [0xf5b955, 0x4fd4c4, 0xf2795f, 0x8fe9d6];
        for (let i = 0; i < 4; i++) {
            const bx = home.x + (i - 1.5) * 60;
            const by = home.y - 80 - (i % 2) * 30;
            this.scene.time.delayedCall(200 + i * 380, () => this.burst(bx, by, colours[i % colours.length], { count: 18, speed: 130, lifespan: 900, gravityY: 30 }));
        }
        await this.wait(1900);
    }

    /** Eclipse: a shadow disc slides across home, dimming the world. */
    async playEclipse(home: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const dim = this.scene.add.rectangle(this.worldW / 2, this.worldH / 2, this.worldW, this.worldH, 0x05070f, 0).setDepth(15);
        const disc = this.scene.add.circle(home.x - 140, home.y - 40, 46, 0x05070f, 0.95).setStrokeStyle(2, 0xf5b955, 0.6).setDepth(16);
        this.scene.tweens.add({ targets: dim, fillAlpha: 0.3, duration: 900, yoyo: true, hold: 500 });
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: disc, x: home.x + 140, y: home.y + 40, duration: 2200, ease: 'Sine.easeInOut', onComplete: () => resolve() });
        });
        this.fadeOut([disc, dim], 100);
    }

    /** Colony: a ship descends to a site and settles in a burst of dust and green. */
    async playColony(home: Pt, at: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const ship = this.scene.add.image(home.x, home.y, unitTexture(this.scene, 'ship')).setDepth(10);
        ship.setRotation(Phaser.Math.Angle.Between(home.x, home.y, at.x, at.y));
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: ship, x: at.x, y: at.y, duration: 1400, ease: 'Sine.easeIn', onComplete: () => resolve() });
        });
        this.burst(at.x, at.y, 0xd8b98a, { count: 14, speed: 80, lifespan: 800, gravityY: 40 });
        this.ring(at.x, at.y, 0x8fe9d6, { scale: 3, duration: 900 });
        const flag = this.scene.add.image(at.x, at.y, unitTexture(this.scene, 'settler')).setDepth(10).setScale(0);
        this.scene.tweens.add({ targets: flag, scale: 1, duration: 400, ease: 'Back.easeOut' });
        await this.wait(500);
        this.fadeOut([ship, flag], 900);
    }

    /** Sanctions: a cold grey blockade ring tightens around home. */
    async playSanctions(home: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        const ring = this.scene.add.circle(home.x, home.y, 90, 0x8fa8a4, 0).setStrokeStyle(3, 0x8fa8a4, 0.85).setDepth(12).setScale(1.6);
        await new Promise<void>((resolve) => {
            this.scene.tweens.add({ targets: ring, scale: 0.9, duration: 1100, ease: 'Sine.easeIn', onComplete: () => resolve() });
        });
        this.scene.tweens.add({ targets: ring, alpha: { from: 0.85, to: 0.3 }, duration: 400, yoyo: true, repeat: 2 });
        void this.wash(0x8fa8a4, 0.1, 1200);
        this.fadeOut([ring], 900);
    }

    /** Fallback: a gentle expanding pulse for an unknown/missing kind. */
    async playPulse(at: Pt): Promise<void> {
        if (prefersReducedMotion()) return;
        this.ring(at.x, at.y, COLORS.brandHi, { scale: 2.8, duration: 900 });
        await this.wait(900);
    }

    // ---- Routing ------------------------------------------------------------

    /** Route an event's visual spec to its animation. */
    async play(visual: EventVisual | undefined, ctx: Ctx): Promise<void> {
        if (!visual) return;
        const home = ctx.home;
        const rival = ctx.rival ?? { x: this.worldW * 0.8, y: this.worldH * 0.3 };
        const site = ctx.site ?? { x: this.worldW * 0.6, y: this.worldH * 0.55 };
        switch (visual.kind) {
            // Original generic beats.
            case 'raid':
                return this.playRaid(rival, home, visual.count ?? 3);
            case 'arrival':
                return this.playArrival(home, visual.sprite, visual.count ?? 2);
            case 'weather':
                return this.playWeather(visual.tint);
            case 'construction':
                return this.playConstruction(ctx.rival ?? home);
            case 'launch':
                return this.playLaunch(home, ctx.site ?? ctx.rival ?? { x: this.worldW * 0.7, y: this.worldH * 0.3 });
            case 'secession':
                return this.playSecession(site);
            case 'anomaly':
                return this.playAnomaly(site);
            // Bespoke beats.
            case 'drought':
                return this.playDrought(visual.tint);
            case 'migration':
                return this.playMigration(visual.sprite, visual.count ?? 5);
            case 'omen':
                return this.playOmen(home);
            case 'plague':
                return this.playPlague(site, visual.tint, visual.count ?? 18);
            case 'harvest':
                return this.playHarvest(home, visual.tint, visual.count ?? 16);
            case 'storm':
                return this.playStorm(visual.tint);
            case 'bloom':
                return this.playBloom(site, visual.tint, visual.count ?? 18);
            case 'strike':
                return this.playStrike(home, false);
            case 'uprising':
                return this.playStrike(home, true);
            case 'signal':
                return this.playSignal(site, visual.tint);
            case 'discovery':
                return this.playDiscovery(home, site);
            case 'flare':
                return this.playFlare(home, visual.tint);
            case 'festival':
                return this.playFestival(home);
            case 'eclipse':
                return this.playEclipse(home);
            case 'colony':
                return this.playColony(home, site);
            case 'sanctions':
                return this.playSanctions(home);
            default:
                // Unknown/missing kind → a gentle generic pulse rather than a crash.
                return this.playPulse(home);
        }
    }
}
