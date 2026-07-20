/**
 * Shared design + tuning constants. Kept in one place so a maintainer can
 * balance the game without hunting through scene code.
 */

/** 16:9 design canvas (brief §9). Phaser Scale.FIT letterboxes to this. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/**
 * World sizes per stage — worlds are much larger than the viewport and the
 * camera scrolls/zooms within them (see lib/worldCamera). Direct-control
 * stages get roaming room; strategic maps are 2× the canvas for pan + fog.
 */
export const WORLD = {
    cellWidth: 4000,
    cellHeight: 3000,
    creatureWidth: 7200,
    creatureHeight: 4600,
    // Strategic maps are deliberately large so the world feels vast: the
    // camera starts zoomed in over home (STRAT_START_ZOOM) and the map opens
    // up as you scout. Sites/rivals use normalised coords so they spread with
    // the world automatically.
    stratWidth: 4600,
    stratHeight: 2600,
} as const;

/** Strategic camera: start close over home; the map reveals as you explore. */
export const STRAT_START_ZOOM = 1.35;
export const STRAT_ZOOM_MIN = 0.55;
export const STRAT_ZOOM_MAX = 1.9;

/** A player-chosen organism palette (Phaser hex numbers). */
export interface OrganismPalette {
    albedo: number;
    accent: number;
    detail: number;
}

/** Tidepool token colours as Phaser-friendly hex numbers. */
export const COLORS = {
    bg: 0x061418,
    bg2: 0x0a2429,
    brand: 0x4fd4c4,
    brandHi: 0x8fe9d6,
    brandDeep: 0x2b9c8b,
    secondary: 0xf5b955,
    energy: 0xf5b955,
    integrity: 0xf2795f,
    evolution: 0x8fe9d6,
    food: 0xc8e06a,
    danger: 0xf2795f,
    membrane: 0x2b9c8b,
    predatorBody: 0x8a2f28,
} as const;

/**
 * Cell tuning that active traits modify. Derived from CELL + summed trait
 * effects (see TraitEngine.aggregateEffects). Kept small and pure so the same
 * numbers drive both movement (scene) and vitals (cellVitals).
 */
export interface CellTuning {
    speed: number;
    energyDrainPerSecMoving: number;
    energyDrainPerSecIdle: number;
    energyPerMote: number;
    evolutionPerMote: number;
    integrityRegenPerSec: number;
}

export interface CellTraitEffects {
    speedMultiplier?: number;
    energyPerMote?: number;
    evolutionPerMote?: number;
    energyDrainPerSecMoving?: number;
    integrityRegenPerSec?: number;
}

export function resolveCellTuning(effects: CellTraitEffects = {}): CellTuning {
    return {
        speed: Math.max(60, CELL.speed * (1 + (effects.speedMultiplier ?? 0))),
        energyDrainPerSecMoving: Math.max(0.5, CELL.energyDrainPerSecMoving + (effects.energyDrainPerSecMoving ?? 0)),
        energyDrainPerSecIdle: CELL.energyDrainPerSecIdle,
        energyPerMote: Math.max(1, CELL.energyPerMote + (effects.energyPerMote ?? 0)),
        evolutionPerMote: Math.max(1, CELL.evolutionPerMote + (effects.evolutionPerMote ?? 0)),
        integrityRegenPerSec: Math.max(0, CELL.integrityRegenPerSec + (effects.integrityRegenPerSec ?? 0)),
    };
}

/** Rival-faction tuning for the strategic stages (brief §20: lightweight discrete sim). */
export const FACTION = {
    strengthStart: 22,
    strengthPerTick: 0.5, // per second
    strengthMax: 100,
    relationshipStart: 0, // -100 hostile … +100 allied
    raidIntervalMs: 20000,
    raidStrengthFactor: 0.15, // fraction of strength drained from the objective resource
    defenseDecayPerTick: 1.4,
    // diplomacy action outcomes
    emissaryRelationship: 18,
    tradeRelationship: 6,
    tradeGain: 5,
    undermineStrength: 22,
    undermineRelationship: 18,
    fortifyDefense: 34,
    actionCost: 10, // cost in the stage's primary resource
    tradeCost: 6,
    // The rival races you toward its own milestone. Tuned for MULTIPLE rivals
    // racing at once (grammar v2) — per-rival pressure is gentler than the old
    // single-rival numbers, but it adds up across two or three powers.
    raceFactor: 0.008, // progress per second = strength * raceFactor (× archetype)
    milestone: 120, // progress needed for the rival to surge ahead
    milestoneSetback: 12, // objective resource lost when the rival surges
    undermineProgress: 40, // undermining also sets their race back
} as const;

export const RIVAL_NAMES = [
    'the Ashfolk', 'the Reedborn', 'the Stonekin', 'the Palefins',
    'the Duskrunners', 'the Hollow Ones', 'the Brackish', 'the Sunless',
] as const;

/** Creature-stage tuning + effects (reuses the shared trait-effect shape). */
export interface CreatureTuning {
    speed: number;
    hungerRisePerSec: number;
    healthRegenPerSec: number;
    hungerReliefPerBite: number;
    nourishPerBite: number;
}

export function resolveCreatureTuning(effects: CellTraitEffects = {}): CreatureTuning {
    return {
        speed: Math.max(80, CREATURE.speed * (1 + (effects.speedMultiplier ?? 0))),
        hungerRisePerSec: CREATURE.hungerRisePerSec,
        healthRegenPerSec: Math.max(0, CREATURE.healthRegenPerSec + (effects.integrityRegenPerSec ?? 0)),
        hungerReliefPerBite: Math.max(4, CREATURE.hungerReliefPerBite + (effects.energyPerMote ?? 0)),
        nourishPerBite: Math.max(1, CREATURE.nourishPerBite + (effects.evolutionPerMote ?? 0)),
    };
}

/** Cell-stage tuning. The stage plays out in a 4000×3000 scrolling world. */
export const CELL = {
    speed: 260, // px/s at 1x
    energyStart: 80,
    integrityStart: 100,
    energyDrainPerSecMoving: 2.6,
    energyDrainPerSecIdle: 0.6,
    energyPerMote: 9,
    evolutionPerMote: 1,
    integrityRegenPerSec: 1.2,
    moteCount: 90,
    moteRadius: 9,
    cellRadius: 20, // display hitbox radius at tier 1 (grows per tier)
    absorbPadding: 6,
    objectiveTarget: 190, // total growth (motes + eaten cells) to reach multicellular
    /**
     * Growth tiers: absorbed-count thresholds at which the organism grows a
     * size tier. On tier-up the cell scales up, the camera zooms out and
     * formerly dangerous cells become prey (see systems/cellGrowth).
     * Four tiers, so the stage keeps introducing new prey and new predators
     * across its length rather than running out of food chain half way.
     */
    tierThresholds: [0, 15, 35, 62, 105, 150],
    tierScale: [1, 1.4, 1.9, 2.5, 3.1, 3.6], // organism display scale per tier
    tierZoom: [1, 0.78, 0.58, 0.44, 0.36, 0.30], // camera zoom per tier — the world "expands"
    tierInvulnMs: 2500, // grace period after growing
    // Threat handling shared by all enemy cell archetypes
    predatorAlertRadius: 360, // threat cue shows within this range
    predatorHitCooldownMs: 1200,
    predatorKnockback: 200,
    predatorMaxChaseSec: 4,
    predatorDisengageSec: 2,
    moteRespawnSec: 8,
    // Base combat stats (part effects modify these from the creator)
    baseAttack: 10,
    baseDefense: 0,
    senseRadius: 620, // minimap/threat awareness range
    // Environmental hazards + rare nutrients
    hazardCount: 8,
    hazardRadius: 80,
    hazardDamagePerSec: 9,
    richMoteChance: 0.16,
    richMoteMultiplier: 3,
} as const;

/**
 * Creature-stage base numbers (hunger runs 0 = full … 100 = starving).
 * The stage plays out in a WORLD.creatureWidth×creatureHeight top-down world:
 * food lives in scattered nests, so pacing = travel between nests while hunger
 * pushes back. Wild species live in data/sprites/creatureSprites.
 */
export const CREATURE = {
    speed: 300, // px/s at 1x — the world is big; travel must feel brisk
    // Movement feel: velocity eases toward input rather than snapping.
    accelLerpPerSec: 7, // how fast velocity converges on the input direction
    dragLerpPerSec: 3.5, // how fast the creature coasts to a stop
    healthStart: 100,
    hungerStart: 25,
    hungerRisePerSec: 2.0,
    healthRegenPerSec: 1.6, // when not starving
    healthDrainPerSecStarving: 4.5, // when hunger is maxed
    hungerReliefPerBite: 20,
    nourishPerBite: 1,
    evolutionPerBite: 1, // banked toward creature adaptations (separate currency)
    hungerCalmThreshold: 60, // below this, health recovers
    foodRadius: 12,
    creatureRadius: 34,
    bitePadding: 8,
    objectiveTarget: 40, // nourishment to raise young / establish the species
    // Nests: finite food that respawns, spread so the player must explore.
    nestCount: 9,
    foodPerNest: 4,
    foodRespawnSec: 25,
    nestDiscoverRadius: 700, // seen once within this range → pinned on the minimap
    // Predators (threat) — per-species stats live on the species defs.
    predatorAlertRadius: 380, // threat cue shows while a chaser is this close
    predatorHitCooldownMs: 1300,
    predatorKnockback: 220,
    senseRadius: 650, // minimap threat awareness range
    // Kin / pack (social pillar)
    kinCount: 4,
    kinRadius: 22,
    kinJoinPadding: 10,
    packNourishPerSec: 0.2, // passive nourishment per kin in the pack
} as const;
