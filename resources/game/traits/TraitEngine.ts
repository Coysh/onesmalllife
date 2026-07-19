import traitsData from '../data/traits.json';

/**
 * Data-driven trait system shared across stages (brief §14). This engine is pure
 * — no Phaser, no DOM — so requirements, conflicts, card states and stat effects
 * are all unit-testable. The scene and the evolution drawer consume it.
 */

export type TraitCategory = 'biological' | 'behavioural' | 'cultural' | 'technological';

export interface TraitEffects {
    speedMultiplier?: number;
    energyPerMote?: number;
    evolutionPerMote?: number;
    energyDrainPerSecMoving?: number;
    integrityRegenPerSec?: number;
}

export interface Trait {
    id: string;
    name: string;
    description: string;
    category: TraitCategory;
    stageIntroduced: string;
    requires: string[];
    conflicts: string[];
    cost: number;
    benefits: string[];
    costs: string[];
    tags: string[];
    effects: TraitEffects;
    visualAttachments?: Record<string, string>;
    rarity: string;
    upgradeOf: string | null;
    inheritable: boolean;
}

/** The seven designed card states (brief §14). */
export type TraitState =
    | 'available'
    | 'selected'
    | 'upgradable'
    | 'new'
    | 'locked'
    | 'blocked'
    | 'inherited';

const EFFECT_KEYS: (keyof TraitEffects)[] = [
    'speedMultiplier',
    'energyPerMote',
    'evolutionPerMote',
    'energyDrainPerSecMoving',
    'integrityRegenPerSec',
];

export class TraitEngine {
    readonly traits: Trait[];
    private byId: Map<string, Trait>;

    constructor(traits: Trait[] = traitsData.traits as unknown as Trait[]) {
        this.traits = traits;
        this.byId = new Map(traits.map((t) => [t.id, t]));
    }

    get(id: string): Trait | undefined {
        return this.byId.get(id);
    }

    /** Traits available at a given stage. */
    forStage(stage: string): Trait[] {
        return this.traits.filter((t) => t.stageIntroduced === stage);
    }

    private requirementsMet(trait: Trait, owned: Set<string>): boolean {
        return trait.requires.every((r) => owned.has(r));
    }

    private conflictOwned(trait: Trait, owned: Set<string>): boolean {
        return trait.conflicts.some((c) => owned.has(c));
    }

    /** Resolve the display/interaction state of a trait for a given campaign. */
    resolveState(trait: Trait, owned: Set<string>, inherited: Set<string> = new Set()): TraitState {
        if (inherited.has(trait.id)) return 'inherited';
        if (owned.has(trait.id)) return 'selected';
        if (this.conflictOwned(trait, owned)) return 'blocked';
        if (!this.requirementsMet(trait, owned)) return 'locked';
        // An upgrade of an owned trait reads as "upgradable".
        if (trait.upgradeOf && owned.has(trait.upgradeOf)) return 'upgradable';
        return 'available';
    }

    /** Can this trait be acquired right now with the given points? */
    canAcquire(trait: Trait, owned: Set<string>, points: number): boolean {
        if (owned.has(trait.id)) return false;
        if (this.conflictOwned(trait, owned)) return false;
        if (!this.requirementsMet(trait, owned)) return false;
        return points >= trait.cost;
    }

    /** Names of traits this one unlocks (via requirement or upgrade). */
    leadsTo(id: string): string[] {
        return this.traits
            .filter((t) => t.requires.includes(id) || t.upgradeOf === id)
            .map((t) => t.name);
    }

    /** Merge the visual attachments of every owned trait (later traits win per slot). */
    aggregateVisuals(owned: Iterable<string>): Record<string, string> {
        const visuals: Record<string, string> = {};
        for (const id of owned) {
            const trait = this.byId.get(id);
            if (!trait?.visualAttachments) continue;
            Object.assign(visuals, trait.visualAttachments);
        }
        return visuals;
    }

    /** Sum the effects of every owned trait. */
    aggregateEffects(owned: Iterable<string>): TraitEffects {
        const total: TraitEffects = {};
        for (const id of owned) {
            const trait = this.byId.get(id);
            if (!trait) continue;
            for (const key of EFFECT_KEYS) {
                const v = trait.effects[key];
                if (typeof v === 'number') total[key] = (total[key] ?? 0) + v;
            }
        }
        return total;
    }
}
