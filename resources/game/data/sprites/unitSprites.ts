import type Phaser from 'phaser';
import { makeTexture } from '../../lib/spriteFactory';

/**
 * Small map-unit sprites for the strategic stages: raiders that march on your
 * settlement, traders and wanderers that arrive at the hearth, warbands,
 * ships crossing starlanes. Drawn once into cached textures (spriteFactory);
 * EventTheatre animates the resulting Images along paths.
 */

export type UnitId =
    | 'raider' | 'wanderer' | 'caravan' | 'warband' | 'ship' | 'beast' | 'crowd' | 'settler'
    // Prop sprites layered by EventTheatre for bespoke event animations.
    | 'banner' | 'lantern';

interface UnitSpec {
    w: number;
    h: number;
    draw: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void;
}

const UNITS: Record<UnitId, UnitSpec> = {
    raider: {
        w: 18, h: 20,
        draw: (g, w) => {
            const cx = w / 2;
            g.fillStyle(0x8a2f28, 1);
            g.fillCircle(cx, 6, 4); // head
            g.fillRoundedRect(cx - 4, 9, 8, 9, 2); // torso
            g.lineStyle(2, 0xf2795f, 1);
            g.lineBetween(cx + 3, 8, cx + 8, 2); // raised spear
        },
    },
    wanderer: {
        w: 16, h: 20,
        draw: (g, w) => {
            const cx = w / 2;
            g.fillStyle(0xc9b8a0, 1);
            g.fillCircle(cx, 6, 4);
            g.fillRoundedRect(cx - 4, 9, 8, 9, 2);
            g.fillStyle(0x8a6f4a, 1);
            g.fillCircle(cx - 5, 12, 3); // bundle on the back
        },
    },
    caravan: {
        w: 30, h: 20,
        draw: (g) => {
            g.fillStyle(0x8a6f4a, 1);
            g.fillRoundedRect(4, 6, 20, 9, 3); // wagon
            g.fillStyle(0xf5b955, 0.9);
            g.fillRect(6, 3, 16, 4); // cargo canopy
            g.fillStyle(0x3d2415, 1);
            g.fillCircle(9, 16, 3);
            g.fillCircle(19, 16, 3); // wheels
        },
    },
    warband: {
        w: 26, h: 20,
        draw: (g) => {
            for (const ox of [4, 12, 20]) {
                g.fillStyle(0x8a2f28, 1);
                g.fillCircle(ox, 7, 3.4);
                g.fillRoundedRect(ox - 3, 9, 6, 8, 2);
            }
            g.lineStyle(2, 0xf2795f, 1);
            g.lineBetween(20, 8, 25, 2);
        },
    },
    ship: {
        w: 26, h: 14,
        draw: (g, _w, h) => {
            const cy = h / 2;
            g.fillStyle(0xbfe8f5, 1);
            g.fillTriangle(24, cy, 4, cy - 5, 4, cy + 5); // hull
            g.fillStyle(0x4fd4c4, 0.9);
            g.fillTriangle(6, cy - 4, 1, cy - 8, 6, cy); // fin
            g.fillTriangle(6, cy + 4, 1, cy + 8, 6, cy);
            g.fillStyle(0xf5b955, 0.9);
            g.fillCircle(3, cy, 2); // drive glow
        },
    },
    beast: {
        w: 26, h: 18,
        draw: (g) => {
            g.fillStyle(0x8a6f4a, 1);
            g.fillEllipse(13, 9, 18, 11); // body
            g.fillCircle(22, 6, 4); // head
            g.fillStyle(0x5d4a30, 1);
            g.fillRect(6, 13, 3, 5);
            g.fillRect(16, 13, 3, 5); // legs
            g.lineStyle(2, 0xe6d8b8, 1);
            g.lineBetween(23, 4, 26, 1); // horn
        },
    },
    crowd: {
        w: 30, h: 18,
        draw: (g) => {
            for (const [ox, oy] of [[5, 6], [13, 4], [21, 6], [9, 9], [17, 9], [25, 8]]) {
                g.fillStyle(0x8fa8a4, 1);
                g.fillCircle(ox, oy, 3);
                g.fillRoundedRect(ox - 2.5, oy + 2, 5, 6, 1.5);
            }
        },
    },
    settler: {
        w: 20, h: 20,
        draw: (g, w) => {
            const cx = w / 2;
            g.fillStyle(0x8fe9d6, 1);
            g.fillCircle(cx, 6, 4);
            g.fillRoundedRect(cx - 4, 9, 8, 9, 2);
            g.lineStyle(2, 0x4fd4c4, 1);
            g.lineBetween(cx - 4, 10, cx - 9, 4); // banner pole
            g.fillStyle(0x4fd4c4, 1);
            g.fillTriangle(cx - 9, 4, cx - 9, 9, cx - 14, 6.5);
        },
    },
    // A raised protest banner (strike/uprising): a tall pole with a flag.
    banner: {
        w: 16, h: 26,
        draw: (g, w, h) => {
            const cx = w / 2;
            g.fillStyle(0x6b5844, 1);
            g.fillRect(cx - 1, 2, 2, h - 2); // pole
            g.fillStyle(0xf2795f, 1);
            g.fillTriangle(cx + 1, 3, cx + 1, 13, cx + 12, 8); // pennant
            g.fillStyle(0xffd9c8, 0.9);
            g.fillCircle(cx, 2, 2); // finial
        },
    },
    // A drifting festival lantern: a warm glowing paper light.
    lantern: {
        w: 12, h: 18,
        draw: (g, w) => {
            const cx = w / 2;
            g.lineStyle(1, 0x8a6f4a, 1);
            g.lineBetween(cx, 0, cx, 4); // string
            g.fillStyle(0xf5b955, 1);
            g.fillRoundedRect(cx - 4, 4, 8, 10, 3); // body
            g.fillStyle(0xfff2c8, 0.95);
            g.fillCircle(cx, 9, 2.6); // inner glow
        },
    },
};

/** Ensure a unit sprite texture exists; returns its key. */
export function unitTexture(scene: Phaser.Scene, id: UnitId): string {
    const spec = UNITS[id] ?? UNITS.wanderer;
    return makeTexture(scene, `osl-unit-${id}`, spec.w, spec.h, spec.draw);
}

export function isUnitId(id: string | undefined): id is UnitId {
    return !!id && id in UNITS;
}
