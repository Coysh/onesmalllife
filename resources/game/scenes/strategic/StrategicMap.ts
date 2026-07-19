import Phaser from 'phaser';
import { COLORS, WORLD } from '../../config';
import { Rng } from '../../lib/rng';
import { ensureSoftDot, ambientParticles } from '../../lib/atmosphere';
import { textResolution } from '../../lib/displayResolution';
import type { ManagementState, StageDef, StageSite } from '../../systems/managementState';

/**
 * Colour palettes for the land branch (tribal wilds vs cultivated era).
 * Light is assumed to come from the top-left throughout, so every landform
 * gets a lighter lit face (…Lit) and a darker cast shadow (…Shade).
 */
interface LandPalette {
    grassLo: number; grassHi: number;
    hillBase: number; hillLit: number; hillShade: number;
    rockBase: number; rockLit: number; rockShade: number;
    forestBase: number; forestLit: number; forestShade: number;
    marsh: number;
    water: number; waterHi: number; bank: number;
    field: number; fieldAlt: number; furrow: number;
    trail: number;
    bush: number; reed: number;
    flowers: readonly number[];
}

const LAND_TRIBAL: LandPalette = {
    grassLo: 0x1f4632, grassHi: 0x2f5e3f,
    hillBase: 0x2b5a3e, hillLit: 0x4c8158, hillShade: 0x142e21,
    rockBase: 0x4f564a, rockLit: 0x767c6b, rockShade: 0x282b23,
    forestBase: 0x1a3d2a, forestLit: 0x356b43, forestShade: 0x0e2417,
    marsh: 0x2c4a37,
    water: 0x2f6f8a, waterHi: 0x67b0c4, bank: 0xb6a172,
    field: 0x5f7a2b, fieldAlt: 0x74893a, furrow: 0x3c5220,
    trail: 0x715f47,
    bush: 0x35673f, reed: 0x7f9a4a,
    flowers: [0xe8d36a, 0xe4a0b6, 0xd8e2f2, 0xe8a15c, 0xcfe07a],
};

const LAND_ERA: LandPalette = {
    grassLo: 0x35502a, grassHi: 0x496a33,
    hillBase: 0x466536, hillLit: 0x6d9350, hillShade: 0x22351c,
    rockBase: 0x59564a, rockLit: 0x817d6b, rockShade: 0x2c2a22,
    forestBase: 0x274a2a, forestLit: 0x4a7a44, forestShade: 0x152c15,
    marsh: 0x3a4f2f,
    water: 0x36768d, waterHi: 0x74b6c8, bank: 0xc3ad78,
    // Farmland sits deliberately darker and less saturated than it looks
    // "natural" for: at full brightness it matched the luminance of the
    // player's own buildings and the city dissolved into the fields.
    field: 0x66742f, fieldAlt: 0x76803c, furrow: 0x49521f,
    trail: 0x7a6647,
    bush: 0x4a7a3c, reed: 0x94a752,
    flowers: [0xf0dc78, 0xf0b0c0, 0xe6ecf6, 0xf0b468, 0xdcec83],
};

/**
 * Renders a strategic stage's world map: terrain styled per map.style
 * (tribal plains / era farmland / living planet / starmap), resource sites,
 * the home settlement glow, rival camps, and a fog-of-war overlay whose
 * revealed circles come from the pure state. The camera pans freely within
 * the map; ManagementScene owns input and the sim.
 */
export class StrategicMap {
    readonly width = WORLD.stratWidth;
    readonly height = WORLD.stratHeight;

    private fog?: Phaser.GameObjects.RenderTexture;
    private fogDrawn = 0; // how many reveal circles are already erased
    private siteLabels = new Map<string, Phaser.GameObjects.Container>();
    private ecologyOverlay?: Phaser.GameObjects.Graphics;

    constructor(private scene: Phaser.Scene, private def: StageDef, private seed: string) {}

    /** Density multiplier so a larger world stays as detailed, not emptier. */
    private get areaScale(): number {
        return (this.width * this.height) / (2560 * 1440);
    }

    /** World-space position of a normalised (0..1) map coordinate. */
    at(x: number, y: number): { x: number; y: number } {
        return { x: x * this.width, y: y * this.height };
    }

    get home(): { x: number; y: number } {
        const h = this.def.map?.home ?? { x: 0.25, y: 0.5 };
        return this.at(h.x, h.y);
    }

    /** Draw the full backdrop; call once from create(). */
    build(state: ManagementState): void {
        const style = this.def.map?.style ?? 'tribal';
        // Ocean fills beyond the tile as the planet camera wraps horizontally.
        const bg = style === 'starmap' ? 0x03060c : style === 'planet' ? 0x123a52 : COLORS.bg;
        this.scene.cameras.main.setBackgroundColor(bg);
        const rng = new Rng(`${this.seed}:${this.def.id}:map`);
        const g = this.scene.add.graphics().setDepth(0);

        if (style === 'starmap') {
            this.drawStarfield(g, rng);
        } else if (style === 'planet') {
            this.drawPlanet(g, rng);
        } else {
            this.drawLand(g, rng, style);
        }

        // The home settlement glow (a soft aura on land/star maps; the planet
        // marks its capital differently, so skip the big disc there).
        const home = this.home;
        if (style !== 'planet') {
            g.fillStyle(COLORS.brandHi, 0.12);
            g.fillCircle(home.x, home.y, 150);
        }

        // Sites: labelled markers, hidden under fog until revealed.
        for (const site of this.def.map?.sites ?? []) {
            this.addSiteMarker(site);
        }

        if (this.def.fog?.enabled) this.buildFog(state);
        if (this.def.mechanics?.ecologyPressure) {
            this.ecologyOverlay = this.scene.add.graphics().setDepth(2);
        }
    }

    /**
     * A layered, textured strategic landscape (tribal wilds / era farmland).
     * Painted once, back-to-front, into a single static Graphics: base ground,
     * rolling relief with top-left lighting, biome patches, water with banks,
     * forest canopies, cultivation, trails from home, fine scatter and a soft
     * vignette. Everything is scaled by areaScale so the huge map stays dense,
     * and everything is deterministic through the passed rng.
     */
    private drawLand(g: Phaser.GameObjects.Graphics, rng: Rng, style: string): void {
        const scale = this.areaScale;
        const W = this.width;
        const H = this.height;
        const era = style === 'era';
        const P = era ? LAND_ERA : LAND_TRIBAL;
        const n = (base: number) => Math.max(1, Math.round(base * scale));

        // --- Layer 0: base ground fill + mottling ----------------------------
        g.fillStyle(P.grassLo, 1);
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < n(70); i++) {
            const x = rng.next() * W;
            const y = rng.next() * H;
            g.fillStyle(rng.chance(0.5) ? P.grassHi : P.grassLo, 0.12 + rng.next() * 0.14);
            g.fillEllipse(x, y, 360 + rng.next() * 520, 240 + rng.next() * 360);
        }

        // --- Water first (compute geometry, then draw so land tints hug it) ---
        // A lake or two, and rivers that wander the map. Home gets a river.
        const home = this.home;
        const lakes: { x: number; y: number; rx: number; ry: number }[] = [];
        for (let i = 0; i < n(2) + 1; i++) {
            lakes.push({
                x: (0.2 + rng.next() * 0.6) * W,
                y: (0.2 + rng.next() * 0.6) * H,
                rx: 180 + rng.next() * 260,
                ry: 130 + rng.next() * 180,
            });
        }
        const rivers: { x: number; y: number }[][] = [];
        const riverCount = n(2) + 1;
        for (let r = 0; r < riverCount; r++) {
            // The first river threads past the home area to feel inhabited.
            const startTop = rng.chance(0.5);
            let rx = r === 0 ? home.x + (rng.next() - 0.5) * 200 : rng.next() * W;
            let ry = r === 0 ? 0 : startTop ? 0 : rng.next() * H;
            let dirx = (rng.next() - 0.5) * 120;
            const pts: { x: number; y: number }[] = [{ x: rx, y: ry }];
            let guard = 0;
            while (ry < H && rx > -100 && rx < W + 100 && guard++ < 60) {
                dirx += (rng.next() - 0.5) * 90;
                dirx = Phaser.Math.Clamp(dirx, -170, 170);
                rx += dirx;
                ry += 110 + rng.next() * 120;
                pts.push({ x: rx, y: ry });
            }
            rivers.push(pts);
        }

        // --- Layer 1: rolling relief (hills / highlands) ---------------------
        // Soft shaded landforms give the map its sense of elevation.
        for (let i = 0; i < n(26); i++) {
            const x = rng.next() * W;
            const y = rng.next() * H;
            const rx = 220 + rng.next() * 360;
            const ry = rx * (0.6 + rng.next() * 0.2);
            const rocky = rng.chance(era ? 0.16 : 0.26);
            if (rocky) {
                this.drawLandform(g, x, y, rx * 0.7, ry * 0.7, P.rockBase, P.rockLit, P.rockShade, 0.85);
                // Bare rock speckle on highlands.
                for (let k = 0; k < 5; k++) {
                    g.fillStyle(P.rockLit, 0.5);
                    g.fillCircle(x + (rng.next() - 0.5) * rx, y - ry * 0.3 + (rng.next() - 0.5) * ry * 0.4, 3 + rng.next() * 5);
                }
            } else {
                this.drawLandform(g, x, y, rx, ry, P.hillBase, P.hillLit, P.hillShade, 0.55);
            }
        }

        // --- Layer 2: marsh tint hugging the water ---------------------------
        for (const lk of lakes) {
            g.fillStyle(P.marsh, 0.35);
            g.fillEllipse(lk.x, lk.y, lk.rx * 2.4, lk.ry * 2.4);
        }
        for (const pts of rivers) {
            for (let i = 0; i < pts.length; i += 2) {
                if (!rng.chance(0.5)) continue;
                g.fillStyle(P.marsh, 0.28);
                g.fillEllipse(pts[i].x, pts[i].y, 240 + rng.next() * 160, 180 + rng.next() * 120);
            }
        }

        // --- Layer 3: water bodies with sandy banks + highlight --------------
        for (const lk of lakes) {
            g.fillStyle(P.bank, 0.55);
            g.fillEllipse(lk.x, lk.y, lk.rx * 2 + 34, lk.ry * 2 + 34);
            g.fillStyle(P.water, 0.92);
            g.fillEllipse(lk.x, lk.y, lk.rx * 2, lk.ry * 2);
            g.fillStyle(P.waterHi, 0.22); // top-left glint
            g.fillEllipse(lk.x - lk.rx * 0.3, lk.y - lk.ry * 0.35, lk.rx * 0.9, lk.ry * 0.55);
        }
        for (const pts of rivers) {
            const w = 12 + rng.next() * 8;
            this.strokePolyline(g, pts, w + 9, P.bank, 0.5);   // muddy bank
            this.strokePolyline(g, pts, w, P.water, 0.8);       // channel
            this.strokePolyline(g, pts, w * 0.4, P.waterHi, 0.35); // current highlight
        }

        // --- Layer 4: forest masses (clustered canopies, lit rims) -----------
        const forestCount = n(era ? 7 : 12);
        for (let i = 0; i < forestCount; i++) {
            const x = rng.next() * W;
            const y = rng.next() * H;
            this.drawCanopy(g, rng, x, y, 130 + rng.next() * 190, P);
        }

        // --- Layer 5: cultivation (era leans farmed; tribal a few clearings) -
        // Fewer patches in the era style: dense farmland was the main source of
        // visual noise competing with the city itself.
        const patchCount = n(era ? 6 : 3);
        for (let i = 0; i < patchCount; i++) {
            const x = 0.08 * W + rng.next() * 0.84 * W;
            const y = 0.08 * H + rng.next() * 0.84 * H;
            if (era && rng.chance(0.4)) {
                this.drawOrchard(g, rng, x, y, P);
            } else {
                this.drawFields(g, rng, x, y, era, P);
            }
        }

        // --- Layer 6: trails linking the home area outward -------------------
        const spokes = n(4) + 2;
        for (let s = 0; s < spokes; s++) {
            const ang = (s / spokes) * Math.PI * 2 + rng.next() * 0.6;
            const len = 380 + rng.next() * 900;
            const pts: { x: number; y: number }[] = [{ x: home.x, y: home.y }];
            let px = home.x;
            let py = home.y;
            const steps = 4 + Math.floor(rng.next() * 4);
            for (let k = 0; k < steps; k++) {
                px += Math.cos(ang) * (len / steps) + (rng.next() - 0.5) * 120;
                py += Math.sin(ang) * (len / steps) + (rng.next() - 0.5) * 120;
                pts.push({ x: px, y: py });
            }
            this.dashedPolyline(g, pts, 16, 12, era ? 3 : 2, P.trail, era ? 0.5 : 0.35);
        }

        // --- Layer 7: fine scatter (rocks, bushes, flowers, reeds) -----------
        for (let i = 0; i < n(120); i++) {
            const x = rng.next() * W;
            const y = rng.next() * H;
            const roll = rng.next();
            if (roll < 0.34) {
                // bush: soft blob with a lit top
                g.fillStyle(P.forestShade, 0.5);
                g.fillCircle(x + 1.5, y + 2, 6 + rng.next() * 4);
                g.fillStyle(P.bush, 0.7);
                g.fillCircle(x, y, 5 + rng.next() * 4);
                g.fillStyle(P.forestLit, 0.45);
                g.fillCircle(x - 2, y - 2, 2.5 + rng.next() * 2);
            } else if (roll < 0.6) {
                // rock: two-tone pebble, lit top-left
                const rr = 3 + rng.next() * 5;
                g.fillStyle(P.rockShade, 0.6);
                g.fillCircle(x + 1, y + 1.5, rr);
                g.fillStyle(P.rockBase, 0.85);
                g.fillCircle(x, y, rr);
                g.fillStyle(P.rockLit, 0.6);
                g.fillCircle(x - rr * 0.3, y - rr * 0.35, rr * 0.45);
            } else if (roll < 0.85) {
                // flower dab
                g.fillStyle(rng.pick(P.flowers), 0.75);
                g.fillCircle(x, y, 2 + rng.next() * 2);
            } else {
                // tuft of grass
                g.fillStyle(P.grassHi, 0.5);
                g.fillEllipse(x, y, 8 + rng.next() * 8, 3 + rng.next() * 3);
            }
        }
        // Reeds hugging the water edges.
        for (const lk of lakes) {
            for (let i = 0; i < n(10); i++) {
                const a = rng.next() * Math.PI * 2;
                const x = lk.x + Math.cos(a) * (lk.rx + 6 + rng.next() * 22);
                const y = lk.y + Math.sin(a) * (lk.ry + 6 + rng.next() * 22);
                g.lineStyle(1.5, P.reed, 0.6);
                g.lineBetween(x, y, x + (rng.next() - 0.5) * 4, y - 8 - rng.next() * 8);
            }
        }
        for (const pts of rivers) {
            for (let i = 1; i < pts.length; i++) {
                if (!rng.chance(0.35)) continue;
                const x = pts[i].x + (rng.next() - 0.5) * 30;
                const y = pts[i].y + (rng.next() - 0.5) * 24;
                g.lineStyle(1.5, P.reed, 0.5);
                g.lineBetween(x, y, x + (rng.next() - 0.5) * 4, y - 7 - rng.next() * 7);
            }
        }

        // --- Layer 8: gentle vignette at the extremes (below fog) ------------
        const corners: [number, number][] = [[0, 0], [W, 0], [0, H], [W, H]];
        for (const [cx, cy] of corners) {
            for (let k = 0; k < 3; k++) {
                g.fillStyle(0x02090b, 0.06);
                g.fillEllipse(cx, cy, W * (0.9 - k * 0.18), H * (0.9 - k * 0.18));
            }
        }
    }

    /** Soft shaded landform: cast shadow (down-right), body, lit cap (up-left). */
    private drawLandform(
        g: Phaser.GameObjects.Graphics,
        x: number, y: number, rx: number, ry: number,
        base: number, lit: number, shade: number, baseAlpha: number,
    ): void {
        g.fillStyle(shade, baseAlpha * 0.55);
        g.fillEllipse(x + rx * 0.12, y + ry * 0.16, rx * 1.04, ry * 1.04);
        g.fillStyle(base, baseAlpha);
        g.fillEllipse(x, y, rx, ry);
        g.fillStyle(lit, baseAlpha * 0.55);
        g.fillEllipse(x - rx * 0.16, y - ry * 0.22, rx * 0.7, ry * 0.6);
    }

    /** A forest mass: overlapping canopy blobs, each shaded and lit-rimmed. */
    private drawCanopy(
        g: Phaser.GameObjects.Graphics,
        rng: Rng, cx: number, cy: number, spread: number, P: LandPalette,
    ): void {
        const blobs = 7 + Math.floor(rng.next() * 8);
        // Soft under-shadow grounding the whole mass.
        g.fillStyle(P.forestShade, 0.4);
        g.fillEllipse(cx + spread * 0.1, cy + spread * 0.16, spread * 2.1, spread * 1.5);
        const pts: { x: number; y: number; r: number }[] = [];
        for (let b = 0; b < blobs; b++) {
            const a = rng.next() * Math.PI * 2;
            const d = rng.next() * spread;
            pts.push({
                x: cx + Math.cos(a) * d,
                y: cy + Math.sin(a) * d * 0.72,
                r: 26 + rng.next() * 40,
            });
        }
        for (const p of pts) { // canopy bodies
            g.fillStyle(P.forestBase, 0.92);
            g.fillCircle(p.x, p.y, p.r);
        }
        for (const p of pts) { // lit rims on the top-left of each crown
            g.fillStyle(P.forestLit, 0.5);
            g.fillCircle(p.x - p.r * 0.32, p.y - p.r * 0.34, p.r * 0.45);
        }
    }

    /** A block of cultivated field strips with furrow lines. */
    private drawFields(
        g: Phaser.GameObjects.Graphics,
        rng: Rng, x: number, y: number, era: boolean, P: LandPalette,
    ): void {
        const cols = era ? 3 + Math.floor(rng.next() * 4) : 2 + Math.floor(rng.next() * 2);
        const rows = era ? 2 + Math.floor(rng.next() * 3) : 1 + Math.floor(rng.next() * 2);
        const pw = 40 + rng.next() * 34;
        const ph = 26 + rng.next() * 20;
        const rot = (rng.next() - 0.5) * 0.5;
        const ca = Math.cos(rot);
        const sa = Math.sin(rot);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const lx = (c - cols / 2) * (pw + 4);
                const ly = (r - rows / 2) * (ph + 4);
                const fx = x + lx * ca - ly * sa;
                const fy = y + lx * sa + ly * ca;
                g.fillStyle(rng.chance(0.5) ? P.field : P.fieldAlt, era ? 0.5 : 0.32);
                g.fillRect(fx - pw / 2, fy - ph / 2, pw, ph);
                // furrows
                g.lineStyle(1, P.furrow, 0.4);
                for (let f = 1; f < 4; f++) {
                    const yy = fy - ph / 2 + (ph / 4) * f;
                    g.lineBetween(fx - pw / 2, yy, fx + pw / 2, yy);
                }
            }
        }
    }

    /** A regular grid of small trees — an orchard, for the settled era. */
    private drawOrchard(
        g: Phaser.GameObjects.Graphics,
        rng: Rng, x: number, y: number, P: LandPalette,
    ): void {
        const cols = 4 + Math.floor(rng.next() * 4);
        const rows = 3 + Math.floor(rng.next() * 3);
        const gap = 24 + rng.next() * 14;
        g.fillStyle(P.grassHi, 0.25);
        g.fillRect(x - (cols * gap) / 2 - 10, y - (rows * gap) / 2 - 10, cols * gap + 20, rows * gap + 20);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tx = x + (c - cols / 2) * gap;
                const ty = y + (r - rows / 2) * gap;
                g.fillStyle(P.forestShade, 0.5);
                g.fillCircle(tx + 2, ty + 2, 7);
                g.fillStyle(P.forestBase, 0.9);
                g.fillCircle(tx, ty, 6);
                g.fillStyle(P.forestLit, 0.5);
                g.fillCircle(tx - 2, ty - 2, 2.5);
            }
        }
    }

    /** Stroke a polyline as a single connected path. */
    private strokePolyline(
        g: Phaser.GameObjects.Graphics,
        pts: { x: number; y: number }[], width: number, color: number, alpha: number,
    ): void {
        if (pts.length < 2) return;
        g.lineStyle(width, color, alpha);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.strokePath();
    }

    /** Draw a dashed line along a polyline (for faint trails). */
    private dashedPolyline(
        g: Phaser.GameObjects.Graphics,
        pts: { x: number; y: number }[], dash: number, gap: number,
        width: number, color: number, alpha: number,
    ): void {
        g.lineStyle(width, color, alpha);
        let pen = 0; // distance along the current dash/gap cycle
        let drawing = true;
        for (let i = 1; i < pts.length; i++) {
            let ax = pts[i - 1].x;
            let ay = pts[i - 1].y;
            const bx = pts[i].x;
            const by = pts[i].y;
            let seg = Math.hypot(bx - ax, by - ay);
            const ux = (bx - ax) / (seg || 1);
            const uy = (by - ay) / (seg || 1);
            while (seg > 0) {
                const remaining = (drawing ? dash : gap) - pen;
                const step = Math.min(remaining, seg);
                const nx = ax + ux * step;
                const ny = ay + uy * step;
                if (drawing) g.lineBetween(ax, ay, nx, ny);
                ax = nx;
                ay = ny;
                seg -= step;
                pen += step;
                if (pen >= (drawing ? dash : gap)) {
                    pen = 0;
                    drawing = !drawing;
                }
            }
        }
    }

    /**
     * A living planet, drawn to read clearly as land vs sea: a deep ocean, a
     * lat/long graticule, continents of shaded "countries" with sandy coasts
     * and faint borders, and ice caps at the poles. Everything periodic in X
     * and painted at −W / 0 / +W so the map wraps seamlessly east–west (the
     * camera loops horizontally — see ManagementScene).
     */
    private drawPlanet(g: Phaser.GameObjects.Graphics, rng: Rng): void {
        const W = this.width;
        const H = this.height;
        const OCEAN = 0x123a52;
        const COAST = 0xc7ab72;
        const COUNTRY = [0x4f6b3a, 0x577140, 0x60814a, 0x486537, 0x6b8c4e, 0x415c32];
        const BORDER = 0x2f4326;

        // Ocean (extends across the three tiles the wrapped camera can view).
        g.fillStyle(OCEAN, 1);
        g.fillRect(-W, 0, W * 3, H);
        for (let i = 0; i < 8; i++) {
            g.fillStyle(0x0d2b3f, 0.14);
            g.fillEllipse(rng.next() * W, rng.next() * H, 500 + rng.next() * 520, 300 + rng.next() * 340);
        }

        // Graticule — longitude lines every W/12 tile seamlessly; latitudes span.
        g.lineStyle(1, 0x9fd0e0, 0.05);
        const lon = 12;
        for (let i = -lon; i <= lon * 2; i++) g.lineBetween((i / lon) * W, 0, (i / lon) * W, H);
        for (let j = 1; j < 8; j++) g.lineBetween(-W, (j / 8) * H, W * 2, (j / 8) * H);

        // Continents: clusters of shaded country-blobs, generated once.
        interface Blob { ox: number; oy: number; rx: number; ry: number; color: number }
        interface Continent { cx: number; cy: number; blobs: Blob[]; borders: { a: number; off: number; len: number }[] }
        const continents: Continent[] = [];
        for (let i = 0; i < Math.round(5 * this.areaScale); i++) {
            const cx = rng.next() * W;
            const cy = H * (0.18 + 0.64 * rng.next());
            const blobs: Blob[] = [];
            const n = 4 + Math.floor(rng.next() * 4);
            for (let b = 0; b < n; b++) {
                blobs.push({
                    ox: (rng.next() - 0.5) * 340, oy: (rng.next() - 0.5) * 220,
                    rx: 140 + rng.next() * 170, ry: 100 + rng.next() * 120,
                    color: COUNTRY[Math.floor(rng.next() * COUNTRY.length)],
                });
            }
            const borders: { a: number; off: number; len: number }[] = [];
            for (let k = 0; k < 1 + Math.floor(rng.next() * 3); k++) {
                borders.push({ a: rng.next() * Math.PI, off: (rng.next() - 0.5) * 160, len: 90 + rng.next() * 120 });
            }
            continents.push({ cx, cy, blobs, borders });
        }

        // Guarantee a home continent under the capital so it sits on land.
        const hn = this.def.map?.home ?? { x: 0.32, y: 0.52 };
        continents.push({
            cx: hn.x * W, cy: hn.y * H,
            blobs: [
                { ox: 0, oy: 0, rx: 240, ry: 180, color: COUNTRY[0] },
                { ox: -180, oy: 60, rx: 150, ry: 130, color: COUNTRY[2] },
                { ox: 190, oy: -40, rx: 160, ry: 120, color: COUNTRY[4] },
                { ox: 40, oy: 150, rx: 140, ry: 110, color: COUNTRY[1] },
            ],
            borders: [{ a: 0.4, off: 0, len: 160 }, { a: 1.9, off: 60, len: 130 }],
        });

        const paint = (dx: number): void => {
            for (const c of continents) for (const b of c.blobs) { // sandy coast rim
                g.fillStyle(COAST, 1);
                g.fillEllipse(c.cx + dx + b.ox, c.cy + b.oy, b.rx + 11, b.ry + 11);
            }
            for (const c of continents) for (const b of c.blobs) { // country fill
                g.fillStyle(b.color, 1);
                g.fillEllipse(c.cx + dx + b.ox, c.cy + b.oy, b.rx, b.ry);
                g.fillStyle(0xffffff, 0.06); // north-lit sheen
                g.fillEllipse(c.cx + dx + b.ox - 6, c.cy + b.oy - 10, b.rx * 0.55, b.ry * 0.5);
            }
            g.lineStyle(1.5, BORDER, 0.45); // short internal borders (stay on land)
            for (const c of continents) for (const bd of c.borders) {
                const mx = c.cx + dx + bd.off;
                g.lineBetween(mx - Math.cos(bd.a) * bd.len, c.cy - Math.sin(bd.a) * bd.len, mx + Math.cos(bd.a) * bd.len, c.cy + Math.sin(bd.a) * bd.len);
            }
        };
        paint(-W);
        paint(0);
        paint(W);

        // Ice caps at the poles (periodic in X → tile seamlessly).
        g.fillStyle(0xe4f0f6, 0.9);
        g.fillEllipse(W / 2, -30, W * 3, 160);
        g.fillEllipse(W / 2, H + 30, W * 3, 160);
        g.fillStyle(0xe4f0f6, 0.28);
        g.fillEllipse(W / 2, 70, W * 3, 130);
        g.fillEllipse(W / 2, H - 70, W * 3, 130);
    }

    private drawStarfield(g: Phaser.GameObjects.Graphics, rng: Rng): void {
        for (let i = 0; i < Math.round(320 * this.areaScale); i++) {
            const x = rng.next() * this.width;
            const y = rng.next() * this.height;
            const tint = rng.chance(0.12) ? 0xbfe8f5 : rng.chance(0.08) ? 0xf5b955 : 0xffffff;
            g.fillStyle(tint, 0.25 + rng.next() * 0.6);
            g.fillCircle(x, y, rng.chance(0.85) ? 1 : 2);
        }
        // A soft galactic band.
        g.fillStyle(0x2b3c6b, 0.18);
        g.fillEllipse(this.width * 0.55, this.height * 0.4, this.width * 1.1, 340);
    }

    private addSiteMarker(site: StageSite): void {
        const pos = this.at(site.x, site.y);
        const style = this.def.map?.style;
        const parts: Phaser.GameObjects.GameObject[] = [];
        if (style === 'starmap') {
            parts.push(this.scene.add.circle(0, 0, 10, 0xbfe8f5, 0.25));
            parts.push(this.scene.add.circle(0, 0, 5, 0xf5e9c9, 1));
        } else if (site.kind === 'village') {
            parts.push(this.scene.add.rectangle(0, 0, 14, 12, 0x8a6f4a));
            parts.push(this.scene.add.triangle(0, -9, -9, 0, 9, 0, 0, -8, 0xc9b8a0));
        } else {
            parts.push(this.scene.add.circle(0, 0, 7, COLORS.food, 0.9));
        }
        const label = this.scene.add
            .text(0, -24, site.label, { fontFamily: 'monospace', fontSize: '12px', color: '#8fa8a4' })
            .setResolution(textResolution())
            .setOrigin(0.5);
        const marker = this.scene.add.container(pos.x, pos.y, [...parts, label]).setDepth(4);
        this.siteLabels.set(site.id, marker);
    }

    /** Site markers + their base world-x, for the horizontally-wrapping planet camera. */
    wrapMarkers(): { obj: Phaser.GameObjects.Container; baseX: number }[] {
        const out: { obj: Phaser.GameObjects.Container; baseX: number }[] = [];
        for (const site of this.def.map?.sites ?? []) {
            const c = this.siteLabels.get(site.id);
            if (c) out.push({ obj: c, baseX: site.x * this.width });
        }
        return out;
    }

    /** Mark a claimed site (rival takeover greys it; your colony brightens it). */
    markSite(siteId: string, by: 'you' | 'rival'): void {
        const marker = this.siteLabels.get(siteId);
        if (!marker) return;
        if (by === 'rival') {
            marker.setAlpha(0.45);
            marker.add(this.scene.add.circle(0, 0, 13, COLORS.danger, 0).setStrokeStyle(2, COLORS.danger, 0.8));
        } else {
            marker.add(this.scene.add.circle(0, 0, 13, COLORS.brand, 0).setStrokeStyle(2, COLORS.brandHi, 0.9));
        }
    }

    // ---- Fog of war ---------------------------------------------------------

    private buildFog(state: ManagementState): void {
        this.fog = this.scene.add.renderTexture(0, 0, this.width, this.height).setOrigin(0, 0).setDepth(20);
        this.fog.fill(0x020a0c, 0.86);
        this.fogDrawn = 0;
        this.updateFog(state);
    }

    /** Erase any newly revealed circles from the darkness. */
    updateFog(state: ManagementState): void {
        if (!this.fog) return;
        const dotKey = ensureSoftDot(this.scene, 'osl-fog-dot', 128);
        while (this.fogDrawn < state.discovered.length) {
            const c = state.discovered[this.fogDrawn++];
            const px = c.x * this.width;
            const py = c.y * this.height;
            const radius = c.r * this.width;
            // Layered soft erases: a hard clear core + feathered edge.
            const img = new Phaser.GameObjects.Image(this.scene, 0, 0, dotKey);
            for (const [scale, alpha] of [[2.4, 1], [2.0, 1], [1.6, 1]] as const) {
                img.setDisplaySize(radius * scale, radius * scale).setAlpha(alpha);
                this.fog.erase(img, px, py);
            }
            img.destroy();
        }
    }

    /** Is a world-space point currently under fog? (for hiding live markers) */
    isFogged(state: ManagementState, worldX: number, worldY: number): boolean {
        if (!this.def.fog?.enabled) return false;
        const nx = worldX / this.width;
        const ny = worldY / this.height;
        return !state.discovered.some((c) => Math.hypot(c.x - nx, c.y - ny) <= c.r);
    }

    private smog: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

    /** Planetary: tint the world by ecology health (green → ash) + smog. */
    updateEcology(ecology01: number): void {
        if (!this.ecologyOverlay) return;
        this.ecologyOverlay.clear();
        const strain = 1 - Phaser.Math.Clamp(ecology01, 0, 1);
        if (strain > 0.05) {
            // Span the three tiles the wrapping camera can view.
            this.ecologyOverlay.fillStyle(0x4a4038, strain * 0.5);
            this.ecologyOverlay.fillRect(-this.width, 0, this.width * 3, this.height);
        }
        // Smog drifts over the world once the strain gets serious.
        if (strain > 0.45 && !this.smog) {
            this.smog = ambientParticles(this.scene, {
                width: this.width, height: this.height, color: 0x4a4038,
                rise: false, depth: 21, frequency: 260, scale: [0.6, 1.4], alpha: 0.3,
            });
        } else if (strain <= 0.45 && this.smog) {
            this.smog.destroy();
            this.smog = null;
        }
    }
}
