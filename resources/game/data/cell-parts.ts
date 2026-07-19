import catalog from './cell-parts.catalog.json';

/**
 * Typed accessor over the shared cell-part catalogue (cell-parts.catalog.json)
 * — the same file PHP reads for the builder, validation and portraits. See
 * systems/partEffects for stat aggregation.
 */

export interface PartEffectValues {
    speed?: number; // speed multiplier delta
    attack?: number;
    defense?: number;
    senseRadius?: number; // px delta
    energyPerMote?: number;
    energyDrain?: number; // per-sec delta while moving
    integrityRegen?: number; // per-sec delta
}

export interface CellPartDef {
    id: string;
    label: string;
    blurb: string;
    effects: PartEffectValues;
    rx?: number;
    ry?: number;
}

export type PartSlot = 'body' | 'membrane' | 'feeding' | 'movement' | 'sensory' | 'defense' | 'pattern';

export const PART_SLOTS: readonly PartSlot[] = ['body', 'membrane', 'feeding', 'movement', 'sensory', 'defense', 'pattern'];

/** Player-chosen appearance, normalised server-side (PartCatalog::toV2). */
export interface AppearanceV2 {
    version: 2;
    palette: number;
    body: string;
    membrane: string;
    feeding: string;
    movement: string;
    sensory: string;
    defense: string;
    pattern: string;
}

const slots = catalog.slots as Record<PartSlot, CellPartDef[]>;

export function partOptions(slot: PartSlot): readonly CellPartDef[] {
    return slots[slot] ?? [];
}

export function partById(slot: PartSlot, id: string | undefined): CellPartDef | undefined {
    return partOptions(slot).find((p) => p.id === id);
}

export const DEFAULT_APPEARANCE: AppearanceV2 = {
    version: 2,
    palette: 1,
    body: 'oval',
    membrane: 'smooth',
    feeding: 'filter',
    movement: 'cilia',
    sensory: 'eyespot',
    defense: 'none',
    pattern: 'speckle',
};
