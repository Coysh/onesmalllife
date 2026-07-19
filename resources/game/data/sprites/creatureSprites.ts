import type Phaser from 'phaser';
import { makeTexture } from '../../lib/spriteFactory';
import type { FeatureKind } from '../../systems/terrain';

/**
 * Stage 2 art catalogue: top-down terrain features and the wild bestiary.
 * Everything is flat-vector drawn once into cached textures (lib/spriteFactory)
 * so the 5120×3600 world stays cheap. Wild species bodies are drawn facing +x;
 * WildCreature rotates the image toward its heading.
 *
 * NOTE ON VARIANT COUNTS: systems/terrain owns VARIANT_COUNT (grass 3, rock 3,
 * tree 4, bush 2, flower 3) and only ever requests those indices. Each FEATURES
 * array below is kept at exactly that length so every variant is a distinct,
 * hand-drawn silhouette rather than a wrapped repeat.
 */

type DrawFn = (g: Phaser.GameObjects.Graphics, w: number, h: number) => void;

// ---- Terrain features ------------------------------------------------------

interface FeatureSpec {
    size: [number, number];
    draw: DrawFn;
}

const GRASS_GREENS = [0x2e5d3a, 0x39704a, 0x27543f];

function canopy(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, base: number, hi: number, lobes: number, phase: number): void {
    g.fillStyle(0x000000, 0.22);
    g.fillCircle(cx + r * 0.16, cy + r * 0.16, r);
    g.fillStyle(base, 1);
    g.fillCircle(cx, cy, r * 0.8);
    for (let i = 0; i < lobes; i++) {
        const a = phase + (i / lobes) * Math.PI * 2;
        g.fillCircle(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.42);
    }
    g.fillStyle(hi, 0.55);
    g.fillCircle(cx - r * 0.28, cy - r * 0.3, r * 0.4);
}

/** A conifer seen from above: a dark spiky star with a pale growing crown. */
function conifer(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.fillStyle(0x000000, 0.22);
    g.fillCircle(cx + r * 0.16, cy + r * 0.16, r * 0.92);
    const points = 9;
    g.fillStyle(0x1c3f2b, 1);
    for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2;
        const a2 = ((i + 0.5) / points) * Math.PI * 2;
        g.fillTriangle(
            cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35,
            cx + Math.cos(a2) * r * 0.35, cy + Math.sin(a2) * r * 0.35,
            cx + Math.cos((a + a2) / 2) * r * 1.05, cy + Math.sin((a + a2) / 2) * r * 1.05,
        );
    }
    g.fillStyle(0x24512f, 1);
    g.fillCircle(cx, cy, r * 0.55);
    g.fillStyle(0x3f7d43, 0.7);
    g.fillCircle(cx - r * 0.12, cy - r * 0.12, r * 0.28);
}

/** A palm / tropical crown: teal-green fronds radiating from a bright core. */
function palmCrown(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(cx + r * 0.16, cy + r * 0.16, r * 0.85);
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * Math.PI * 2 + 0.3;
        g.fillStyle(i % 2 ? 0x2e4d44 : 0x437063, 1);
        const perp = a + Math.PI / 2;
        const px = Math.cos(perp) * r * 0.2;
        const py = Math.sin(perp) * r * 0.2;
        // an elongated frond blade as a triangle radiating outward
        g.fillTriangle(
            cx + px, cy + py,
            cx - px, cy - py,
            cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05,
        );
    }
    g.fillStyle(0x2b9c8b, 0.9);
    g.fillCircle(cx, cy, r * 0.34);
    g.fillStyle(0x8fe9d6, 0.5);
    g.fillCircle(cx - r * 0.08, cy - r * 0.08, r * 0.18);
}

const FEATURES: Record<FeatureKind, FeatureSpec[]> = {
    // 0 clumped tuft · 1 tall reeds · 2 arching fern
    grass: [
        {
            size: [26, 24],
            draw: (g, w, h) => {
                const cx = w / 2, base = h - 3;
                g.lineStyle(2.5, GRASS_GREENS[0], 0.95);
                for (let i = -2; i <= 2; i++) g.lineBetween(cx + i * 3, base, cx + i * 5, base - 12 - Math.abs(i));
                g.lineStyle(2, 0x6fbf7a, 0.5);
                g.lineBetween(cx, base, cx, base - 15);
            },
        },
        {
            size: [22, 30],
            draw: (g, w, h) => {
                const cx = w / 2, base = h - 3;
                g.lineStyle(2.5, GRASS_GREENS[1], 0.95);
                for (let i = -1; i <= 1; i++) g.lineBetween(cx + i * 4, base, cx + i * 6, base - 24);
                g.fillStyle(0xc7a24a, 0.9); // seed heads
                for (let i = -1; i <= 1; i++) g.fillEllipse(cx + i * 6, base - 24, 3, 6);
            },
        },
        {
            size: [34, 26],
            draw: (g, w, h) => {
                const cx = w / 2, base = h - 3;
                g.lineStyle(2, 0x2f6b47, 0.9);
                for (const dir of [-1, 1]) {
                    for (let s = 0; s < 5; s++) {
                        const t = s / 4;
                        g.lineBetween(cx, base, cx + dir * (4 + t * 13), base - 4 - t * 18);
                    }
                }
                g.lineStyle(2, 0x6fbf7a, 0.5);
                g.lineBetween(cx, base, cx, base - 20);
            },
        },
    ],
    // 0 rounded boulder · 1 jagged shard · 2 mossy pebble cluster
    rock: [
        {
            size: [40, 34],
            draw: (g, w, h) => {
                const cx = w / 2, cy = h / 2;
                g.fillStyle(0x000000, 0.25);
                g.fillEllipse(cx + 2, cy + 4, w * 0.8, h * 0.6);
                g.fillStyle(0x5a6068, 1);
                g.fillEllipse(cx, cy, w * 0.78, h * 0.62);
                g.fillStyle(0x8a929c, 0.7);
                g.fillEllipse(cx - 4, cy - 4, w * 0.3, h * 0.22);
            },
        },
        {
            size: [38, 40],
            draw: (g, w, h) => {
                const cx = w / 2, cy = h / 2;
                g.fillStyle(0x000000, 0.25);
                g.fillEllipse(cx + 2, cy + 5, w * 0.7, h * 0.4);
                g.fillStyle(0x565c66, 1);
                g.fillTriangle(cx - 14, cy + 14, cx + 15, cy + 12, cx - 1, cy - 16);
                g.fillStyle(0x7c848f, 0.8);
                g.fillTriangle(cx - 1, cy - 16, cx + 15, cy + 12, cx + 4, cy - 2);
            },
        },
        {
            size: [42, 32],
            draw: (g, w, h) => {
                const cx = w / 2, cy = h / 2;
                g.fillStyle(0x000000, 0.25);
                g.fillEllipse(cx + 2, cy + 4, w * 0.82, h * 0.5);
                g.fillStyle(0x5a6068, 1);
                g.fillEllipse(cx - 7, cy + 2, 22, 17);
                g.fillEllipse(cx + 9, cy + 4, 15, 13);
                g.fillEllipse(cx + 2, cy - 5, 13, 11);
                g.fillStyle(0x3f7d43, 0.5); // moss caps
                g.fillEllipse(cx - 8, cy - 4, 12, 6);
                g.fillEllipse(cx + 8, cy - 1, 8, 4);
            },
        },
    ],
    // 0 broadleaf · 1 conifer · 2 olive · 3 teal palm
    tree: [
        { size: [92, 92], draw: (g, w, h) => canopy(g, w / 2, h / 2, w * 0.42, 0x1f4d33, 0x2e6b47, 5, 0) },
        { size: [90, 90], draw: (g, w, h) => conifer(g, w / 2, h / 2, w * 0.44) },
        { size: [88, 88], draw: (g, w, h) => canopy(g, w / 2, h / 2, w * 0.4, 0x455d24, 0x5d7d36, 6, 1.3) },
        { size: [94, 94], draw: (g, w, h) => palmCrown(g, w / 2, h / 2, w * 0.44) },
    ],
    // 0 berry bush · 1 flowering shrub
    bush: [
        {
            size: [46, 44],
            draw: (g, w, h) => {
                canopy(g, w / 2, h / 2, w * 0.36, 0x2e6b47, 0x6fbf7a, 4, 0);
                g.fillStyle(0xb23b5a, 0.95); // berries
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 + 0.4;
                    g.fillCircle(w / 2 + Math.cos(a) * w * 0.24, h / 2 + Math.sin(a) * h * 0.22, 2.6);
                }
            },
        },
        {
            size: [46, 44],
            draw: (g, w, h) => {
                canopy(g, w / 2, h / 2, w * 0.36, 0x3f7d43, 0x6fbf7a, 4, 0.9);
                for (let i = 0; i < 7; i++) { // blossoms
                    const a = (i / 7) * Math.PI * 2;
                    const bx = w / 2 + Math.cos(a) * w * 0.22;
                    const by = h / 2 + Math.sin(a) * h * 0.2;
                    g.fillStyle(0xf0d78a, 0.95);
                    g.fillCircle(bx, by, 3);
                    g.fillStyle(0xfff2c9, 1);
                    g.fillCircle(bx, by, 1.2);
                }
            },
        },
    ],
    // 0 daisy · 1 bell/tulip · 2 star aster
    flower: [
        {
            size: [22, 22],
            draw: (g, w, h) => {
                const cx = w / 2, cy = h / 2;
                g.fillStyle(0x39704a, 0.9);
                g.fillCircle(cx, cy, 4);
                g.fillStyle(0xf5b955, 0.95);
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    g.fillCircle(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5, 3.2);
                }
                g.fillStyle(0xfff2c9, 1);
                g.fillCircle(cx, cy, 2.2);
            },
        },
        {
            size: [20, 24],
            draw: (g, w, h) => {
                const cx = w / 2, cy = h / 2;
                g.lineStyle(2, 0x39704a, 0.9);
                g.lineBetween(cx, cy + 9, cx, cy - 2);
                g.fillStyle(0xd97ba6, 0.95); // bell cup
                g.fillEllipse(cx, cy - 4, 11, 9);
                g.fillTriangle(cx - 5, cy - 4, cx + 5, cy - 4, cx, cy + 4);
                g.fillStyle(0xf3c4d8, 0.8);
                g.fillEllipse(cx - 1, cy - 6, 5, 4);
            },
        },
        {
            size: [22, 22],
            draw: (g, w, h) => {
                const cx = w / 2, cy = h / 2;
                g.fillStyle(0x8fe9d6, 0.95); // many thin petals
                for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2;
                    g.fillEllipse(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 2, 5);
                }
                g.fillStyle(0x2b9c8b, 1);
                g.fillCircle(cx, cy, 3);
                g.fillStyle(0xfff2c9, 1);
                g.fillCircle(cx, cy, 1.4);
            },
        },
    ],
};

/** Ensure a terrain feature variant's texture exists; returns its key. */
export function featureTexture(scene: Phaser.Scene, kind: FeatureKind, variant: number): string {
    const specs = FEATURES[kind];
    const spec = specs[variant % specs.length];
    return makeTexture(scene, `osl-terrain-${kind}-${variant % specs.length}`, spec.size[0], spec.size[1], spec.draw);
}

/** A food nest: a shallow scrape of earth ringed with grass. */
export function nestTexture(scene: Phaser.Scene): string {
    return makeTexture(scene, 'osl-creature-nest', 76, 76, (g, w, h) => {
        const cx = w / 2, cy = h / 2;
        g.fillStyle(0x000000, 0.2);
        g.fillEllipse(cx, cy + 2, 62, 50);
        g.fillStyle(0x4d3b26, 1);
        g.fillEllipse(cx, cy, 56, 44);
        g.fillStyle(0x2e2417, 0.9);
        g.fillEllipse(cx, cy, 38, 28);
        g.lineStyle(2, 0x39704a, 0.8);
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const x = cx + Math.cos(a) * 30, y = cy + Math.sin(a) * 24;
            g.lineBetween(x, y, x + Math.cos(a) * 7, y + Math.sin(a) * 7);
        }
    });
}

// ---- Wild species ----------------------------------------------------------

export type WildRole = 'herbivore' | 'predator' | 'kin';

export interface WildSpeciesDef {
    id: string;
    /** Display name for threat cues ("Marshfang — flee north"). */
    name: string;
    role: WildRole;
    radius: number;
    wanderSpeed: number;
    /** Flee (herbivores) or chase (predators) speed. */
    runSpeed: number;
    /** Range at which herbivores panic / predators lock on. */
    detectRadius: number;
    /** Predators only: they chase inside this circle around their den. */
    territoryRadius: number;
    /** Herbivores only: graze leash around their nest. */
    homeLeash: number;
    /** Predator contact damage to the player's health. */
    damage: number;
    /** Herd/pack size spawned per nest or den. */
    groupSize: number;
    draw: DrawFn;
}

interface QuadOpts {
    /** Tail length factor along -x. */
    tail?: number;
    /** Bushy tuft at the tail tip. */
    tailTuft?: boolean;
    ears?: boolean;
    stripes?: boolean;
    /** Domed carapace across the back. */
    shell?: boolean;
    /** Segmented armour plates along the spine. */
    plates?: boolean;
    /** Forward-splayed horn pair (length factor). */
    horns?: number;
    /** Downward tusk pair (length factor). */
    tusks?: number;
    /** Elongated neck; head sits this much further forward. */
    neck?: number;
    /** Raised shoulder hump. */
    hump?: boolean;
    /** Spiky dorsal ridge. */
    bristle?: boolean;
    /** Body length factor (default 1.9). */
    long?: number;
    /** Muzzle length factor. */
    snout?: number;
    /** Head radius factor (default 0.55). */
    head?: number;
}

/** A generic top-down quadruped facing +x: body + head + limb/tail hints. */
function quadruped(
    g: Phaser.GameObjects.Graphics, w: number, h: number, r: number,
    body: number, accent: number, opts: QuadOpts = {},
): void {
    const cx = w / 2, cy = h / 2;
    const long = opts.long ?? 1.9;
    const headR = r * (opts.head ?? 0.55);
    g.fillStyle(0x000000, 0.24);
    g.fillEllipse(cx + 2, cy + 3, r * (long + 0.4), r * 1.5);
    // tail (drawn behind the body)
    if (opts.tail) {
        g.fillStyle(accent, 0.95);
        const tx = cx - r * (long * 0.55 + 0.15);
        g.fillEllipse(tx, cy, r * opts.tail, r * 0.32);
        if (opts.tailTuft) {
            g.fillStyle(accent, 1);
            g.fillCircle(tx - r * opts.tail * 0.6, cy, r * 0.3);
        }
    }
    // limb hints
    g.fillStyle(accent, 0.9);
    for (const [lx, ly] of [[-0.5, -0.75], [-0.5, 0.75], [0.45, -0.7], [0.45, 0.7]]) {
        g.fillEllipse(cx + lx * r, cy + ly * r, r * 0.45, r * 0.3);
    }
    // body along +x
    g.fillStyle(body, 1);
    g.fillEllipse(cx - r * 0.1, cy, r * long, r * 1.25);
    if (opts.hump) {
        g.fillStyle(body, 1);
        g.fillCircle(cx - r * 0.35, cy, r * 0.82);
        g.fillStyle(0xffffff, 0.08);
        g.fillCircle(cx - r * 0.45, cy - r * 0.18, r * 0.5);
    }
    if (opts.shell) {
        g.fillStyle(accent, 1);
        g.fillEllipse(cx - r * 0.1, cy, r * 1.5, r * 1.0);
        g.lineStyle(1.5, body, 0.7);
        g.strokeEllipse(cx - r * 0.1, cy, r * 1.1, r * 0.7);
    }
    if (opts.plates) {
        g.fillStyle(accent, 0.9);
        for (let i = -1; i <= 2; i++) g.fillEllipse(cx - i * r * 0.45, cy, r * 0.28, r * 1.0);
        g.lineStyle(1.5, body, 0.6);
        for (let i = -1; i <= 2; i++) g.strokeEllipse(cx - i * r * 0.45, cy, r * 0.28, r * 1.0);
    }
    if (opts.stripes) {
        g.fillStyle(accent, 0.75);
        for (let i = -1; i <= 1; i++) g.fillEllipse(cx + i * r * 0.42, cy, r * 0.16, r * 1.05);
    }
    if (opts.bristle) {
        g.fillStyle(accent, 1);
        for (let i = -2; i <= 2; i++) {
            const bx = cx + i * r * 0.3;
            g.fillTriangle(bx - r * 0.1, cy - r * 1.05, bx + r * 0.1, cy - r * 1.05, bx, cy - r * 1.5);
        }
    }
    // neck + head
    const neck = opts.neck ?? 0;
    const hx = cx + r * (0.95 + neck);
    if (neck > 0) {
        g.fillStyle(body, 1);
        g.fillEllipse((cx + r * 0.6 + hx) / 2, cy, r * (neck + 0.6), r * 0.42);
    }
    g.fillStyle(body, 1);
    g.fillCircle(hx, cy, headR);
    if (opts.snout) {
        g.fillStyle(body, 1);
        g.fillEllipse(hx + headR * 0.7, cy, r * opts.snout, r * 0.28);
    }
    if (opts.horns) {
        g.fillStyle(0xefe6d0, 0.95);
        for (const s of [-1, 1]) {
            g.fillTriangle(
                hx, cy + s * headR * 0.6,
                hx + headR * 0.3, cy + s * headR * 0.3,
                hx + r * opts.horns, cy + s * r * opts.horns * 0.9,
            );
        }
    }
    if (opts.tusks) {
        g.fillStyle(0xf2ead2, 0.95);
        for (const s of [-1, 1]) {
            g.fillTriangle(
                hx + headR * 0.5, cy + s * headR * 0.4,
                hx + headR * 0.9, cy + s * headR * 0.2,
                hx + r * (0.7 + opts.tusks), cy + s * headR * 0.9,
            );
        }
    }
    if (opts.ears) {
        g.fillStyle(body, 1);
        g.fillCircle(hx - headR * 0.3, cy - headR * 0.9, headR * 0.4);
        g.fillCircle(hx - headR * 0.3, cy + headR * 0.9, headR * 0.4);
    }
    g.fillStyle(0x06201d, 1);
    g.fillCircle(hx + headR * 0.4, cy - headR * 0.35, r * 0.1);
    g.fillCircle(hx + headR * 0.4, cy + headR * 0.35, r * 0.1);
    // dorsal highlight
    g.fillStyle(0xffffff, 0.1);
    g.fillEllipse(cx - r * 0.2, cy - r * 0.25, r * 1.2, r * 0.45);
}

/** A small top-down bird / flitting critter facing +x: rounded body, wings, beak. */
function bird(
    g: Phaser.GameObjects.Graphics, w: number, h: number, r: number,
    body: number, wing: number, beak: number,
): void {
    const cx = w / 2, cy = h / 2;
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx + 2, cy + 3, r * 1.8, r * 1.2);
    // fanned tail
    g.fillStyle(wing, 0.9);
    g.fillTriangle(cx - r * 0.9, cy, cx - r * 1.7, cy - r * 0.55, cx - r * 1.7, cy + r * 0.55);
    // outspread wings
    g.fillStyle(wing, 1);
    for (const s of [-1, 1]) g.fillEllipse(cx - r * 0.1, cy + s * r * 0.85, r * 1.3, r * 0.55);
    // body
    g.fillStyle(body, 1);
    g.fillEllipse(cx, cy, r * 1.5, r * 0.95);
    // head + beak
    g.fillCircle(cx + r * 0.95, cy, r * 0.5);
    g.fillStyle(beak, 1);
    g.fillTriangle(cx + r * 1.3, cy - r * 0.18, cx + r * 1.3, cy + r * 0.18, cx + r * 2.0, cy);
    // eye + sheen
    g.fillStyle(0x06201d, 1);
    g.fillCircle(cx + r * 1.05, cy - r * 0.16, r * 0.09);
    g.fillStyle(0xffffff, 0.14);
    g.fillEllipse(cx - r * 0.1, cy - r * 0.28, r * 0.9, r * 0.35);
}

/** A serpentine stalker facing +x: an S-curved chain of tapering segments + a wedge head. */
function serpent(
    g: Phaser.GameObjects.Graphics, w: number, h: number, r: number,
    body: number, accent: number,
): void {
    const cx = w / 2, cy = h / 2;
    const segs = 9;
    const len = r * 3.2;
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(cx + 2, cy + 3, len, r * 0.9);
    for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1);
        const x = cx - len / 2 + t * len;
        const y = cy + Math.sin(t * Math.PI * 2) * r * 0.5;
        const rad = r * (0.28 + 0.4 * Math.sin(t * Math.PI)) + r * 0.18 * t;
        g.fillStyle(i % 2 ? accent : body, 1);
        g.fillCircle(x, y, rad);
    }
    // wedge head at the +x end
    const hx = cx + len / 2;
    const hy = cy + Math.sin(Math.PI * 2) * r * 0.5;
    g.fillStyle(body, 1);
    g.fillTriangle(hx - r * 0.3, hy - r * 0.55, hx - r * 0.3, hy + r * 0.55, hx + r * 0.9, hy);
    g.fillStyle(0xc4442f, 1); // forked tongue
    g.fillTriangle(hx + r * 0.8, hy, hx + r * 1.4, hy - r * 0.16, hx + r * 1.4, hy + r * 0.16);
    g.fillStyle(0xf2d24a, 1); // eyes
    g.fillCircle(hx - r * 0.05, hy - r * 0.24, r * 0.12);
    g.fillCircle(hx - r * 0.05, hy + r * 0.24, r * 0.12);
    g.fillStyle(0x06201d, 1);
    g.fillCircle(hx + r * 0.02, hy - r * 0.24, r * 0.05);
    g.fillCircle(hx + r * 0.02, hy + r * 0.24, r * 0.05);
}

export const WILD_SPECIES: readonly WildSpeciesDef[] = [
    // --- Herbivores ---------------------------------------------------------
    {
        id: 'thistlehop', name: 'Thistlehop', role: 'herbivore',
        radius: 16, wanderSpeed: 46, runSpeed: 300, detectRadius: 240,
        territoryRadius: 0, homeLeash: 320, damage: 0, groupSize: 3,
        draw: (g, w, h) => quadruped(g, w, h, 14, 0xb8935d, 0x8a6b40, { tail: 0.5, ears: true }),
    },
    {
        id: 'moss_grazer', name: 'Moss grazer', role: 'herbivore',
        radius: 26, wanderSpeed: 30, runSpeed: 250, detectRadius: 210,
        territoryRadius: 0, homeLeash: 380, damage: 0, groupSize: 3,
        draw: (g, w, h) => quadruped(g, w, h, 22, 0x6d8f5a, 0x4a6b3d, { tail: 0.7, stripes: true }),
    },
    {
        id: 'shellback', name: 'Shellback', role: 'herbivore',
        radius: 20, wanderSpeed: 18, runSpeed: 120, detectRadius: 150,
        territoryRadius: 0, homeLeash: 240, damage: 0, groupSize: 2,
        draw: (g, w, h) => quadruped(g, w, h, 17, 0x8f8468, 0x5d5540, { shell: true }),
    },
    {
        id: 'fenstrider', name: 'Fenstrider', role: 'herbivore',
        radius: 24, wanderSpeed: 34, runSpeed: 240, detectRadius: 260,
        territoryRadius: 0, homeLeash: 440, damage: 0, groupSize: 3,
        // tall long-necked grazer with a whisk tail
        draw: (g, w, h) => quadruped(g, w, h, 19, 0xc9b06a, 0x9c8546, { neck: 0.95, tail: 0.5, tailTuft: true, long: 1.7, head: 0.42 }),
    },
    {
        id: 'bristleback', name: 'Bristleback', role: 'herbivore',
        radius: 22, wanderSpeed: 26, runSpeed: 210, detectRadius: 190,
        territoryRadius: 0, homeLeash: 300, damage: 0, groupSize: 3,
        // low tusked forager with a spiny hump
        draw: (g, w, h) => quadruped(g, w, h, 18, 0x6b5842, 0x463829, { tusks: 0.7, hump: true, bristle: true, snout: 0.5, long: 2.0, head: 0.5 }),
    },
    {
        id: 'dapple_doe', name: 'Dapple doe', role: 'herbivore',
        radius: 20, wanderSpeed: 42, runSpeed: 290, detectRadius: 250,
        territoryRadius: 0, homeLeash: 360, damage: 0, groupSize: 3,
        // slender horned browser
        draw: (g, w, h) => quadruped(g, w, h, 16, 0xcf9d6a, 0xf2e6cf, { horns: 1.1, tail: 0.4, ears: true, neck: 0.4, long: 1.7, head: 0.46 }),
    },
    {
        id: 'reed_pipit', name: 'Reed pipit', role: 'herbivore',
        radius: 12, wanderSpeed: 58, runSpeed: 330, detectRadius: 220,
        territoryRadius: 0, homeLeash: 300, damage: 0, groupSize: 4,
        // tiny harmless ground bird
        draw: (g, w, h) => bird(g, w, h, 11, 0x7c9fb0, 0x4c6b7d, 0xe0a24a),
    },
    // --- Predators ----------------------------------------------------------
    {
        id: 'marshfang', name: 'Marshfang', role: 'predator',
        radius: 28, wanderSpeed: 60, runSpeed: 265, detectRadius: 420,
        territoryRadius: 560, homeLeash: 0, damage: 14, groupSize: 1,
        // heavy striped ambusher
        draw: (g, w, h) => quadruped(g, w, h, 24, 0x8a2f28, 0x5d1f1a, { tail: 1.0, ears: true, stripes: true }),
    },
    {
        id: 'dusk_prowler', name: 'Dusk prowler', role: 'predator',
        radius: 22, wanderSpeed: 80, runSpeed: 305, detectRadius: 480,
        territoryRadius: 700, homeLeash: 0, damage: 10, groupSize: 1,
        // lean night stalker
        draw: (g, w, h) => quadruped(g, w, h, 19, 0x4a3d5d, 0x2e2440, { tail: 1.2, ears: true }),
    },
    {
        id: 'rill_hound', name: 'Rill hound', role: 'predator',
        radius: 20, wanderSpeed: 90, runSpeed: 335, detectRadius: 500,
        territoryRadius: 720, homeLeash: 0, damage: 8, groupSize: 2,
        // lean pack-hunter (den spawns a pair)
        draw: (g, w, h) => quadruped(g, w, h, 17, 0xa8622f, 0x6e3d1c, { tail: 0.9, tailTuft: true, ears: true, snout: 0.55, long: 2.1, head: 0.46 }),
    },
    {
        id: 'silt_serpent', name: 'Silt serpent', role: 'predator',
        radius: 22, wanderSpeed: 50, runSpeed: 290, detectRadius: 460,
        territoryRadius: 640, homeLeash: 0, damage: 12, groupSize: 1,
        // serpentine stalker
        draw: (g, w, h) => serpent(g, w, h, 16, 0x3d6b4a, 0x27543f),
    },
    // --- Kin ---------------------------------------------------------------
    {
        id: 'kin', name: 'Kin', role: 'kin',
        radius: 22, wanderSpeed: 55, runSpeed: 0, detectRadius: 0,
        territoryRadius: 0, homeLeash: 0, damage: 0, groupSize: 1,
        draw: (g, w, h) => quadruped(g, w, h, 18, 0x2b9c8b, 0x1d6e62, { tail: 0.8 }),
    },
] as const;

export const HERBIVORES = WILD_SPECIES.filter((s) => s.role === 'herbivore');
export const PREDATORS = WILD_SPECIES.filter((s) => s.role === 'predator');
export const KIN_SPECIES = WILD_SPECIES.find((s) => s.id === 'kin')!;

/** Ensure a wild species' body texture exists; returns its key. */
export function wildTexture(scene: Phaser.Scene, def: WildSpeciesDef): string {
    const pad = 18;
    const size = Math.ceil((def.radius + pad) * 2.7);
    return makeTexture(scene, `osl-wild-${def.id}`, size, size, def.draw);
}
