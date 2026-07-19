import type Phaser from 'phaser';
import { makeTexture } from '../../lib/spriteFactory';

/**
 * Civilisation building sprites: one silhouette per placeable decision, in
 * three era skins (bronze/iron/classical). Era changes re-texture every
 * placed building so the whole city visibly ages (CityScene). Cached via
 * spriteFactory: texture key = building + era.
 */

export type EraId = 'bronze' | 'iron' | 'classical';

interface EraPalette {
    wall: number;
    roof: number;
    trim: number;
}

const ERAS: Record<EraId, EraPalette> = {
    bronze: { wall: 0x8a6f4a, roof: 0xc98f5a, trim: 0x5d4a30 },
    iron: { wall: 0x7d7a72, roof: 0x8a2f28, trim: 0x4a4844 },
    classical: { wall: 0xc9c2b0, roof: 0x2b9c8b, trim: 0x8a8474 },
};

type DrawFn = (g: Phaser.GameObjects.Graphics, p: EraPalette, w: number, h: number) => void;

const BUILDINGS: Record<string, DrawFn> = {
    farms: (g, p, w, h) => {
        // Field rows + a small barn.
        g.fillStyle(0x6f8a2f, 0.7);
        g.fillRect(2, h - 12, w - 4, 10);
        g.lineStyle(1.5, 0x4a5c20, 0.9);
        for (let x = 5; x < w - 4; x += 5) g.lineBetween(x, h - 11, x, h - 3);
        g.fillStyle(p.wall, 1);
        g.fillRect(w / 2 - 6, h - 22, 12, 10);
        g.fillStyle(p.roof, 1);
        g.fillTriangle(w / 2 - 8, h - 22, w / 2 + 8, h - 22, w / 2, h - 30);
    },
    markets: (g, p, w, h) => {
        // Stalls with striped awnings.
        for (const ox of [4, w / 2 + 2]) {
            g.fillStyle(p.wall, 1);
            g.fillRect(ox, h - 14, 12, 10);
            g.fillStyle(p.roof, 1);
            g.fillRect(ox - 2, h - 18, 16, 5);
            g.fillStyle(0xf5e9c9, 0.9);
            g.fillRect(ox + 2, h - 18, 3, 5);
            g.fillRect(ox + 9, h - 18, 3, 5);
        }
    },
    granary: (g, p, w, h) => {
        // A fat round store with a domed cap.
        g.fillStyle(p.wall, 1);
        g.fillRect(w / 2 - 9, h - 20, 18, 16);
        g.fillStyle(p.roof, 1);
        g.fillEllipse(w / 2, h - 20, 22, 10);
        g.fillStyle(p.trim, 1);
        g.fillRect(w / 2 - 2, h - 10, 4, 6);
    },
    writing: (g, p, w, h) => {
        // A scribe hall: tall door, tablet mark.
        g.fillStyle(p.wall, 1);
        g.fillRect(w / 2 - 10, h - 22, 20, 18);
        g.fillStyle(p.roof, 1);
        g.fillTriangle(w / 2 - 12, h - 22, w / 2 + 12, h - 22, w / 2, h - 32);
        g.fillStyle(p.trim, 1);
        g.fillRect(w / 2 - 3, h - 12, 6, 8);
        g.lineStyle(1.5, 0xf5e9c9, 0.9);
        g.lineBetween(w / 2 - 7, h - 17, w / 2 - 1, h - 17);
        g.lineBetween(w / 2 + 1, h - 17, w / 2 + 7, h - 17);
    },
    academy: (g, p, w, h) => {
        // Columns under a wide pediment.
        g.fillStyle(p.wall, 1);
        g.fillRect(w / 2 - 12, h - 20, 24, 16);
        g.fillStyle(p.trim, 1);
        for (const ox of [-9, -3, 3, 9]) g.fillRect(w / 2 + ox - 1, h - 18, 2.5, 14);
        g.fillStyle(p.roof, 1);
        g.fillTriangle(w / 2 - 14, h - 20, w / 2 + 14, h - 20, w / 2, h - 30);
    },
    aqueduct: (g, p, w, h) => {
        // Arched water bridge.
        g.fillStyle(p.wall, 1);
        g.fillRect(2, h - 18, w - 4, 6);
        g.fillStyle(p.trim, 1);
        for (const ox of [6, 16, 26]) {
            g.fillRect(ox, h - 12, 4, 8);
        }
        g.fillStyle(0x2f6f8a, 0.9);
        g.fillRect(2, h - 20, w - 4, 3);
    },
    settle: (g, p, w, h) => {
        // A daughter settlement: two small houses + banner.
        for (const ox of [6, w - 18]) {
            g.fillStyle(p.wall, 1);
            g.fillRect(ox, h - 14, 12, 10);
            g.fillStyle(p.roof, 1);
            g.fillTriangle(ox - 2, h - 14, ox + 14, h - 14, ox + 6, h - 22);
        }
        g.lineStyle(2, 0x4fd4c4, 1);
        g.lineBetween(w / 2, h - 4, w / 2, h - 26);
        g.fillStyle(0x4fd4c4, 1);
        g.fillTriangle(w / 2, h - 26, w / 2, h - 20, w / 2 + 8, h - 23);
    },
};

const FALLBACK: DrawFn = (g, p, w, h) => {
    g.fillStyle(p.wall, 1);
    g.fillRect(w / 2 - 8, h - 18, 16, 14);
    g.fillStyle(p.roof, 1);
    g.fillTriangle(w / 2 - 10, h - 18, w / 2 + 10, h - 18, w / 2, h - 27);
};

/**
 * Everything the player builds sits on this: a dark footing plate ringed in the
 * brand teal, plus a soft shadow. Terrain never uses that teal, so anything
 * carrying this ring reads as yours at a glance — without it, bronze walls
 * (#8a6f4a) on cultivated fields (#8a9a3f) are nearly the same luminance and
 * the city dissolves into the farmland.
 */
function drawFooting(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    const cx = w / 2;
    const cy = h - 5;
    // Contact shadow, widest and faintest first.
    g.fillStyle(0x061418, 0.22);
    g.fillEllipse(cx, cy + 2.5, w - 4, 12);
    g.fillStyle(0x061418, 0.3);
    g.fillEllipse(cx, cy + 1, w - 10, 9);
    // The plate itself: a dark base that any warm wall colour reads against.
    g.fillStyle(0x123038, 0.85);
    g.fillEllipse(cx, cy, w - 12, 8.5);
    g.lineStyle(1.5, 0x4fd4c4, 0.85);
    g.strokeEllipse(cx, cy, w - 12, 8.5);
}

/** Texture for a building action in a given era (cached). */
export function buildingTexture(scene: Phaser.Scene, actionId: string, era: EraId): string {
    const draw = BUILDINGS[actionId] ?? FALLBACK;
    const palette = ERAS[era] ?? ERAS.bronze;
    // Canvas is taller than the 36×34 the silhouettes were drawn for, leaving
    // room for the footing; every draw fn is bottom-anchored via `h`, so they
    // ride on top of it. Key is versioned so cached v1 textures aren't reused.
    return makeTexture(scene, `osl-bld-${actionId}-${era}-v2`, 40, 40, (g, w, h) => {
        drawFooting(g, w, h);
        draw(g, palette, w, h - 6);
    });
}

export function isEraId(id: string | undefined): id is EraId {
    return id === 'bronze' || id === 'iron' || id === 'classical';
}
