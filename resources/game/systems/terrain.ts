/**
 * Creature-stage terrain generation: pure, deterministic, Phaser-free.
 * Given a seed it lays out biome patches, decorative features, impassable
 * water bodies and food nests across the top-down world. The scene only
 * renders what this module decides — the same seed always produces the same
 * habitat (brief §19).
 */
import { Rng } from '../lib/rng';

export type BiomeKind = 'meadow' | 'forest' | 'rock' | 'water';

export type FeatureKind = 'grass' | 'rock' | 'tree' | 'bush' | 'flower';

/** A soft elliptical tint region — purely visual, features bias toward it. */
export interface BiomePatch {
    kind: Exclude<BiomeKind, 'water'>;
    x: number;
    y: number;
    rx: number;
    ry: number;
}

export interface TerrainFeature {
    kind: FeatureKind;
    /** Sprite variant index (trees have 4, others fewer — see creatureSprites). */
    variant: number;
    x: number;
    y: number;
    scale: number;
}

/** An impassable pond/lake, tested with ellipse containment. */
export interface WaterBody {
    x: number;
    y: number;
    rx: number;
    ry: number;
}

/** A food respawn point. Herbivore herds graze around their nest. */
export interface Nest {
    x: number;
    y: number;
    biome: BiomeKind;
}

export interface Terrain {
    width: number;
    height: number;
    biomes: BiomePatch[];
    features: TerrainFeature[];
    waters: WaterBody[];
    nests: Nest[];
}

/** World-edge margin nothing generates inside. */
export const TERRAIN_MARGIN = 140;
/** Minimum pairwise distance between nests, so foraging means exploring. */
export const NEST_MIN_DISTANCE = 900;
/** Waters keep clear of the world centre (the player spawn). */
export const SPAWN_CLEAR_RADIUS = 620;

/** Number of tree sprite variants (creatureSprites draws one per index). */
export const TREE_VARIANTS = 4;

/** True when (x, y) is inside any water body, padded outward by `pad`. */
export function inWater(waters: readonly WaterBody[], x: number, y: number, pad = 0): boolean {
    for (const w of waters) {
        const dx = (x - w.x) / (w.rx + pad);
        const dy = (y - w.y) / (w.ry + pad);
        if (dx * dx + dy * dy <= 1) return true;
    }
    return false;
}

/** The biome tint under a point (meadow when no patch covers it). */
export function biomeAt(terrain: Pick<Terrain, 'biomes' | 'waters'>, x: number, y: number): BiomeKind {
    if (inWater(terrain.waters, x, y)) return 'water';
    for (const b of terrain.biomes) {
        const dx = (x - b.x) / b.rx;
        const dy = (y - b.y) / b.ry;
        if (dx * dx + dy * dy <= 1) return b.kind;
    }
    return 'meadow';
}

/** Feature mix per biome: [grass, rock, tree, bush, flower] weights. */
const FEATURE_WEIGHTS: Record<Exclude<BiomeKind, 'water'>, [number, number, number, number, number]> = {
    meadow: [5, 0.5, 0.6, 1.2, 2.4],
    forest: [1.6, 0.5, 5, 2, 0.5],
    rock: [1, 5, 0.4, 0.6, 0.3],
};

const FEATURE_KINDS: readonly FeatureKind[] = ['grass', 'rock', 'tree', 'bush', 'flower'];

function pickFeatureKind(rng: Rng, biome: BiomeKind): FeatureKind {
    const weights = FEATURE_WEIGHTS[biome === 'water' ? 'meadow' : biome];
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return FEATURE_KINDS[i];
    }
    return 'grass';
}

const VARIANT_COUNT: Record<FeatureKind, number> = {
    grass: 3,
    rock: 3,
    tree: TREE_VARIANTS,
    bush: 2,
    flower: 3,
};

/**
 * Generate the whole habitat from a seed. Same seed → identical terrain.
 * `featureDensity` exists for tests; the game uses the default.
 */
export function generateTerrain(seed: string, width: number, height: number, featureDensity = 1): Terrain {
    const rng = new Rng(`${seed}:terrain`);
    const m = TERRAIN_MARGIN;
    const cx = width / 2;
    const cy = height / 2;

    // Biome patches: 3–4 large soft ellipses.
    const kinds: Array<Exclude<BiomeKind, 'water'>> = ['meadow', 'forest', 'rock'];
    const biomeCount = 3 + (rng.chance(0.6) ? 1 : 0);
    const biomes: BiomePatch[] = [];
    for (let i = 0; i < biomeCount; i++) {
        biomes.push({
            kind: i < 3 ? kinds[i] : kinds[rng.int(0, kinds.length)],
            x: m + rng.next() * (width - m * 2),
            y: m + rng.next() * (height - m * 2),
            rx: 700 + rng.next() * 900,
            ry: 500 + rng.next() * 700,
        });
    }

    // Water bodies: 2–3 impassable ponds, kept off the spawn point.
    const waters: WaterBody[] = [];
    const waterCount = 2 + (rng.chance(0.5) ? 1 : 0);
    for (let i = 0; i < waterCount; i++) {
        for (let tries = 0; tries < 30; tries++) {
            const rx = 200 + rng.next() * 200;
            const ry = 130 + rng.next() * 150;
            const x = m + rx + rng.next() * (width - (m + rx) * 2);
            const y = m + ry + rng.next() * (height - (m + ry) * 2);
            const clearOfSpawn = Math.hypot(x - cx, y - cy) > SPAWN_CLEAR_RADIUS + Math.max(rx, ry);
            const clearOfOthers = waters.every((w) => Math.hypot(x - w.x, y - w.y) > w.rx + rx + 200);
            if (clearOfSpawn && clearOfOthers) {
                waters.push({ x, y, rx, ry });
                break;
            }
        }
    }

    // Nests: spread across the map with a pairwise minimum distance so the
    // player has to roam. Distance requirement relaxes if sampling stalls.
    const nests: Nest[] = [];
    const partial = { biomes, waters };
    const nestCount = 9;
    let minDist = NEST_MIN_DISTANCE;
    while (nests.length < nestCount) {
        let placed = false;
        for (let tries = 0; tries < 60 && !placed; tries++) {
            const x = m + rng.next() * (width - m * 2);
            const y = m + rng.next() * (height - m * 2);
            if (inWater(waters, x, y, 160)) continue;
            if (nests.some((n) => Math.hypot(x - n.x, y - n.y) < minDist)) continue;
            nests.push({ x, y, biome: biomeAt(partial, x, y) });
            placed = true;
        }
        if (!placed) minDist *= 0.85; // extremely rare; keeps generation total
    }

    // Decorative features, biased by the biome they land in. Positions in
    // water are skipped (reeds at the shoreline would be a later flourish).
    const featureCount = Math.round(340 * featureDensity);
    const features: TerrainFeature[] = [];
    for (let i = 0; i < featureCount; i++) {
        const x = m + rng.next() * (width - m * 2);
        const y = m + rng.next() * (height - m * 2);
        if (inWater(waters, x, y, 30)) continue;
        const kind = pickFeatureKind(rng, biomeAt(partial, x, y));
        features.push({
            kind,
            variant: rng.int(0, VARIANT_COUNT[kind]),
            x,
            y,
            scale: 0.8 + rng.next() * 0.5,
        });
    }

    return { width, height, biomes, features, waters, nests };
}
