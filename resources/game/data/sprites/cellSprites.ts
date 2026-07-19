import type Phaser from 'phaser';
import { makeTexture } from '../../lib/spriteFactory';
import { Rng } from '../../lib/rng';

/**
 * Enemy cell archetypes for Stage 1. Seven behavioural species spanning the
 * three growth tiers — but each is drawn as a PROCEDURALLY GENERATED cell
 * (composeCell): a real organism with a body, membrane, nucleus, organelles
 * and cilia/flagella/spikes, not a plain circle. Every archetype has several
 * seeded VARIANTS so the world is full of individually distinct cells; each is
 * cached once (lib/spriteFactory) and rendered as a cheap Image.
 *
 * Predation rules live in systems/cellGrowth — this file is the bestiary:
 * stats, behaviour flags and the look that drives the generator.
 */

export type CellFamily = 'blob' | 'sleek' | 'colony' | 'jelly' | 'lance';

export interface CellLook {
    family: CellFamily;
    body: number;
    accent: number;
    nucleus: number;
    membrane: 'smooth' | 'ridged' | 'spiky' | 'wavy';
    movement: 'cilia' | 'flagella' | 'jet' | 'none';
    spikes: number; // defensive spike count (0 = none)
    translucent?: boolean;
}

export interface EnemyCellDef {
    id: string;
    /** Size tier 1..3 relative to the player's growth tiers. */
    tier: 1 | 2 | 3;
    passive: boolean;
    hunts: boolean;
    flees: boolean;
    radius: number;
    wanderSpeed: number;
    chaseSpeed: number;
    detectRadius: number;
    damage: number;
    count: number;
    growth: number;
    energy: number;
    splitsInto?: string;
    look: CellLook;
}

/** How many seeded appearance variants each archetype generates. */
export const CELL_VARIANTS = 5;

export const ENEMY_CELLS: readonly EnemyCellDef[] = [
    {
        id: 'drifter', tier: 1, passive: true, hunts: false, flees: false,
        radius: 14, wanderSpeed: 26, chaseSpeed: 26, detectRadius: 0,
        damage: 0, count: 16, growth: 1, energy: 7,
        look: { family: 'blob', body: 0x3f7d6d, accent: 0x8fe9d6, nucleus: 0x2b6c5c, membrane: 'smooth', movement: 'cilia', spikes: 0 },
    },
    {
        id: 'darter', tier: 1, passive: true, hunts: false, flees: true,
        radius: 10, wanderSpeed: 60, chaseSpeed: 240, detectRadius: 260,
        damage: 0, count: 12, growth: 1, energy: 6,
        look: { family: 'sleek', body: 0x5d8f4a, accent: 0xa9d977, nucleus: 0x3f6b2f, membrane: 'smooth', movement: 'flagella', spikes: 0 },
    },
    {
        id: 'spikeling', tier: 1, passive: false, hunts: false, flees: false,
        radius: 16, wanderSpeed: 34, chaseSpeed: 34, detectRadius: 0,
        damage: 8, count: 10, growth: 2, energy: 12,
        look: { family: 'blob', body: 0x7d4a2a, accent: 0xc27f4a, nucleus: 0x3d2415, membrane: 'spiky', movement: 'none', spikes: 11 },
    },
    {
        id: 'stalker', tier: 2, passive: false, hunts: true, flees: false,
        radius: 24, wanderSpeed: 70, chaseSpeed: 175, detectRadius: 380,
        damage: 16, count: 6, growth: 3, energy: 20,
        look: { family: 'blob', body: 0x8a2f28, accent: 0xf2795f, nucleus: 0x2a0f0c, membrane: 'spiky', movement: 'flagella', spikes: 8 },
    },
    {
        id: 'colony', tier: 2, passive: false, hunts: false, flees: false,
        radius: 46, wanderSpeed: 16, chaseSpeed: 16, detectRadius: 0,
        damage: 6, count: 5, growth: 4, energy: 26, splitsInto: 'drifter',
        look: { family: 'colony', body: 0x4a6d8f, accent: 0x88b7d9, nucleus: 0x2f4d68, membrane: 'smooth', movement: 'none', spikes: 0 },
    },
    {
        id: 'jelly_giant', tier: 3, passive: false, hunts: false, flees: false,
        radius: 80, wanderSpeed: 10, chaseSpeed: 10, detectRadius: 0,
        damage: 12, count: 3, growth: 6, energy: 40,
        look: { family: 'jelly', body: 0x6d5a8f, accent: 0xc9b8e9, nucleus: 0x4a3a6b, membrane: 'wavy', movement: 'cilia', spikes: 0, translucent: true },
    },
    {
        id: 'apex_lancer', tier: 3, passive: false, hunts: true, flees: false,
        radius: 30, wanderSpeed: 80, chaseSpeed: 215, detectRadius: 520,
        damage: 22, count: 2, growth: 8, energy: 50,
        look: { family: 'lance', body: 0x8f2a4a, accent: 0xd94a6d, nucleus: 0x5d1a30, membrane: 'ridged', movement: 'jet', spikes: 0 },
    },
    {
        // Tier-1 passive grazer — soft, harmless, edible from the very start.
        id: 'sporeling', tier: 1, passive: true, hunts: false, flees: false,
        radius: 12, wanderSpeed: 30, chaseSpeed: 30, detectRadius: 0,
        damage: 0, count: 14, growth: 1, energy: 6,
        look: { family: 'blob', body: 0xb7a13f, accent: 0xf0e08a, nucleus: 0x7d6a1f, membrane: 'wavy', movement: 'cilia', spikes: 0 },
    },
    {
        // Tier-2 sleek hostile — a whipping flagellate that stings on contact.
        id: 'coilworm', tier: 2, passive: false, hunts: false, flees: false,
        radius: 20, wanderSpeed: 52, chaseSpeed: 52, detectRadius: 0,
        damage: 10, count: 6, growth: 3, energy: 18,
        look: { family: 'sleek', body: 0x2f7d74, accent: 0x6fe0cf, nucleus: 0x1a4d47, membrane: 'ridged', movement: 'flagella', spikes: 0 },
    },
    {
        // Tier-3 apex hunter — a dark jetting lance; never becomes prey.
        id: 'voidmaw', tier: 3, passive: false, hunts: true, flees: false,
        radius: 34, wanderSpeed: 74, chaseSpeed: 205, detectRadius: 500,
        damage: 24, count: 2, growth: 8, energy: 52,
        look: { family: 'lance', body: 0x241a33, accent: 0x7d5ad9, nucleus: 0x120b1c, membrane: 'ridged', movement: 'jet', spikes: 0 },
    },
] as const;

export const ENEMY_CELL_BY_ID: Record<string, EnemyCellDef> = Object.fromEntries(
    ENEMY_CELLS.map((d) => [d.id, d]),
);

// ---- Procedural cell generator ---------------------------------------------

const clamp8 = (v: number) => Math.max(0, Math.min(255, v | 0));

/** Jitter an RGB hex a little (per-variant colour individuality). */
function varyColor(rng: Rng, hex: number): number {
    const j = () => (rng.next() - 0.5) * 40;
    return (clamp8(((hex >> 16) & 255) + j()) << 16) | (clamp8(((hex >> 8) & 255) + j()) << 8) | clamp8((hex & 255) + j());
}

/** Multiply a hex colour toward white (>1) or black (<1). */
function shade(hex: number, f: number): number {
    return (clamp8(((hex >> 16) & 255) * f) << 16) | (clamp8(((hex >> 8) & 255) * f) << 8) | clamp8((hex & 255) * f);
}

function drawColony(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rng: Rng, look: CellLook, r: number): void {
    const lobes = 5 + Math.floor(rng.next() * 3);
    for (let i = 0; i < lobes; i++) {
        const a = (i / lobes) * Math.PI * 2 + rng.next() * 0.4;
        const d = i === 0 ? 0 : r * (0.45 + rng.next() * 0.35);
        const lr = (i === 0 ? 0.55 : 0.32 + rng.next() * 0.16) * r;
        const ox = Math.cos(a) * d;
        const oy = Math.sin(a) * d;
        g.fillStyle(varyColor(rng, look.body), 0.62);
        g.fillCircle(cx + ox, cy + oy, lr);
        g.lineStyle(1.5, shade(look.accent, 1), 0.6);
        g.strokeCircle(cx + ox, cy + oy, lr);
        g.fillStyle(look.nucleus, 0.7);
        g.fillCircle(cx + ox - lr * 0.15, cy + oy, lr * 0.3);
        g.fillStyle(shade(look.accent, 1.2), 0.8);
        g.fillCircle(cx + ox - lr * 0.25, cy + oy - lr * 0.25, lr * 0.16);
    }
}

/** Compose one procedurally-generated cell into a texture-local Graphics. */
function composeCell(g: Phaser.GameObjects.Graphics, w: number, h: number, rng: Rng, look: CellLook, r: number): void {
    const cx = w / 2;
    const cy = h / 2;
    if (look.family === 'colony') {
        drawColony(g, cx, cy, rng, look, r);
        return;
    }

    const body = varyColor(rng, look.body);
    const accent = varyColor(rng, look.accent);
    const nuc = varyColor(rng, look.nucleus);
    const a = look.translucent ? 0.42 : 1;
    const wide = look.family === 'sleek' || look.family === 'lance';
    const brx = wide ? r * 1.35 : r * (0.94 + rng.next() * 0.14);
    const bry = wide ? r * 0.78 : r * (0.94 + rng.next() * 0.14);
    const rim = Math.max(brx, bry);

    // Defensive spikes / flagella / jet sit behind the body.
    if (look.spikes > 0 || look.membrane === 'spiky') {
        const n = look.spikes > 0 ? look.spikes : 10;
        g.fillStyle(shade(accent, 0.92), a * 0.95);
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + rng.next() * 0.12;
            g.fillTriangle(
                cx + Math.cos(ang - 0.16) * brx, cy + Math.sin(ang - 0.16) * bry,
                cx + Math.cos(ang + 0.16) * brx, cy + Math.sin(ang + 0.16) * bry,
                cx + Math.cos(ang) * (rim + 8), cy + Math.sin(ang) * (rim + 8),
            );
        }
    }
    if (look.movement === 'flagella') {
        g.lineStyle(2, accent, a * 0.8);
        for (const oy of [-3, 3]) {
            g.beginPath();
            g.moveTo(cx - brx, cy + oy);
            g.lineTo(cx - brx - 14, cy + oy + (rng.next() - 0.5) * 8);
            g.lineTo(cx - brx - 24, cy + oy - 4);
            g.strokePath();
        }
    } else if (look.movement === 'jet') {
        g.fillStyle(accent, a * 0.5);
        g.fillCircle(cx - brx - 6, cy, 3.5);
        g.fillCircle(cx - brx - 13, cy, 2.2);
    }

    // Body + sheen.
    g.fillStyle(body, a);
    g.fillEllipse(cx, cy, brx * 2, bry * 2);
    g.fillStyle(0xffffff, a * 0.12);
    g.fillEllipse(cx - brx * 0.3, cy - bry * 0.35, brx * 0.8, bry * 0.6);

    // Pattern speckles.
    g.fillStyle(accent, a * 0.5);
    for (let i = 0, sp = 2 + Math.floor(rng.next() * 4); i < sp; i++) {
        const ang = rng.next() * Math.PI * 2;
        const d = rng.next() * 0.68;
        g.fillCircle(cx + Math.cos(ang) * brx * d, cy + Math.sin(ang) * bry * d, 1.4 + rng.next() * 1.6);
    }

    // Membrane.
    g.lineStyle(look.membrane === 'ridged' ? 2.5 : 2, shade(body, 0.7), a * 0.9);
    g.strokeEllipse(cx, cy, brx * 2, bry * 2);
    if (look.membrane === 'ridged') {
        g.lineStyle(1, accent, a * 0.5);
        for (let i = 0; i < 14; i++) {
            const ang = (i / 14) * Math.PI * 2;
            g.lineBetween(cx + Math.cos(ang) * (brx - 2), cy + Math.sin(ang) * (bry - 2), cx + Math.cos(ang) * (brx + 2), cy + Math.sin(ang) * (bry + 2));
        }
    } else if (look.membrane === 'wavy') {
        g.lineStyle(1.5, accent, a * 0.5);
        for (let i = 0; i < 24; i++) {
            const a0 = (i / 24) * Math.PI * 2;
            const a1 = ((i + 1) / 24) * Math.PI * 2;
            const k = 1 + (i % 2 ? 0.05 : -0.03);
            g.lineBetween(cx + Math.cos(a0) * brx * k, cy + Math.sin(a0) * bry * k, cx + Math.cos(a1) * brx, cy + Math.sin(a1) * bry);
        }
    }

    // Cilia fringe.
    if (look.movement === 'cilia') {
        g.lineStyle(1.5, accent, a * 0.6);
        const n = Math.max(10, Math.floor(rim / 3));
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2;
            g.lineBetween(cx + Math.cos(ang) * brx, cy + Math.sin(ang) * bry, cx + Math.cos(ang) * (brx + 5), cy + Math.sin(ang) * (bry + 5));
        }
    }

    // Nucleus + organelles.
    g.fillStyle(nuc, a * 0.72);
    g.fillCircle(cx - brx * 0.1, cy, r * 0.32);
    g.fillStyle(shade(nuc, 1.35), a);
    g.fillCircle(cx - brx * 0.1, cy, r * 0.14);
    g.fillStyle(accent, a * 0.55);
    for (let i = 0, org = 1 + Math.floor(rng.next() * 3); i < org; i++) {
        const ang = rng.next() * Math.PI * 2;
        const d = 0.3 + rng.next() * 0.4;
        g.fillCircle(cx + Math.cos(ang) * brx * d, cy + Math.sin(ang) * bry * d, 2 + rng.next() * 2);
    }

    // Jelly tendrils.
    if (look.family === 'jelly') {
        g.lineStyle(2, accent, a * 0.5);
        for (let i = -3; i <= 3; i++) {
            const x = cx + i * (brx / 3.5);
            g.lineBetween(x, cy + bry * 0.6, x + (i % 2 ? 6 : -6), cy + bry * 1.15);
        }
    }

    // Predator eye up front (sleek/lance hunters).
    if (look.family === 'lance') {
        g.fillStyle(shade(body, 0.5), a);
        g.fillCircle(cx + brx * 0.6, cy, r * 0.18);
        g.fillStyle(0xf2b8c9, a * 0.9);
        g.fillCircle(cx + brx * 0.7, cy - 2, 2.5);
    }
}

/** How many food-cell appearance variants to generate. */
export const FOOD_VARIANTS = 5;

/** A tiny nutrient cell — clearly food (small, soft, round, never spiky). */
function drawFoodCell(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rng: Rng, r: number, rich: boolean): void {
    const base = varyColor(rng, rich ? 0xf5b955 : 0xc8e06a);
    g.fillStyle(base, 0.95);
    g.fillCircle(cx, cy, r);
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.42);
    g.lineStyle(1.5, shade(base, 0.7), 0.85);
    g.strokeCircle(cx, cy, r);
    g.fillStyle(shade(base, 0.72), 0.7);
    g.fillCircle(cx + (rng.next() - 0.5) * r * 0.4, cy + (rng.next() - 0.5) * r * 0.4, r * 0.3);
    // A soft ring of cilia so it reads as a little organism, not a dot.
    g.lineStyle(1, shade(base, 1.25), 0.5);
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        g.lineBetween(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + 2.6), cy + Math.sin(a) * (r + 2.6));
    }
    if (rich) {
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(cx, cy, r * 0.16);
    }
}

/** A generated food-cell variant texture; returns its cache key. */
export function foodCellTexture(scene: Phaser.Scene, variant = 0, rich = false): string {
    const key = `osl-food-${rich ? 'r' : 'n'}-${variant}`;
    const r = rich ? 9 : 7;
    const size = Math.ceil((r + 5) * 2);
    return makeTexture(scene, key, size, size, (g, gw, gh) => drawFoodCell(g, gw / 2, gh / 2, new Rng(`food:${rich}:${variant}`), r, rich));
}

/** A generated variant texture for an archetype; returns its cache key. */
export function enemyCellTexture(scene: Phaser.Scene, def: EnemyCellDef, variant = 0): string {
    const key = `osl-cell-${def.id}-v${variant}`;
    const wide = def.look.family === 'sleek' || def.look.family === 'lance';
    const w = Math.ceil((def.radius * (wide ? 1.6 : 1) + 30) * 2);
    const h = Math.ceil((def.radius + 26) * 2);
    return makeTexture(scene, key, w, h, (g, gw, gh) => composeCell(g, gw, gh, new Rng(`${def.id}:v${variant}`), def.look, def.radius));
}
