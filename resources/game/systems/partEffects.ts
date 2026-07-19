/**
 * Aggregates the stat effects of a player's chosen cell parts (appearance v2)
 * into (a) the shared CellTraitEffects shape — merged with trait effects
 * before resolveCellTuning — and (b) combat stats (attack/defense/sense) used
 * by the tier-relative predation rules. Pure, so the same numbers drive the
 * builder's stat bars, the scene, and tests.
 */
import { CELL, type CellTraitEffects } from '../config';
import { PART_SLOTS, partById, type AppearanceV2, type PartEffectValues } from '../data/cell-parts';

export interface CombatStats {
    attack: number;
    defense: number;
    senseRadius: number;
}

export interface AggregatedPartEffects {
    effects: CellTraitEffects;
    combat: CombatStats;
}

export function aggregatePartEffects(appearance: Partial<AppearanceV2> | undefined): AggregatedPartEffects {
    const sum: Required<PartEffectValues> = {
        speed: 0, attack: 0, defense: 0, senseRadius: 0, energyPerMote: 0, energyDrain: 0, integrityRegen: 0,
    };
    if (appearance) {
        for (const slot of PART_SLOTS) {
            const part = partById(slot, appearance[slot] as string | undefined);
            if (!part) continue;
            for (const [key, value] of Object.entries(part.effects) as [keyof PartEffectValues, number][]) {
                sum[key] += value;
            }
        }
    }
    return {
        effects: {
            speedMultiplier: sum.speed,
            energyPerMote: sum.energyPerMote,
            energyDrainPerSecMoving: sum.energyDrain,
            integrityRegenPerSec: sum.integrityRegen,
        },
        combat: {
            attack: CELL.baseAttack + sum.attack,
            defense: CELL.baseDefense + sum.defense,
            senseRadius: CELL.senseRadius + sum.senseRadius,
        },
    };
}

/** Merge trait effects on top of part effects (both are additive deltas). */
export function mergeEffects(a: CellTraitEffects, b: CellTraitEffects): CellTraitEffects {
    const keys: (keyof CellTraitEffects)[] = [
        'speedMultiplier', 'energyPerMote', 'evolutionPerMote', 'energyDrainPerSecMoving', 'integrityRegenPerSec',
    ];
    const out: CellTraitEffects = {};
    for (const key of keys) {
        const total = (a[key] ?? 0) + (b[key] ?? 0);
        if (total !== 0) out[key] = total;
    }
    return out;
}
