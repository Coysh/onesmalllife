/** The bounded Stage 2 build. IDs are persisted in stageState.creature. */
export type CreaturePartSlot = 'locomotion' | 'feeding' | 'adaptation';
export type CreatureDiet = 'herbivore' | 'carnivore';

export interface CreaturePartDef {
    id: string;
    slot: CreaturePartSlot;
    name: string;
    description: string;
    diet?: CreatureDiet;
    effects: {
        speedMultiplier?: number;
        hungerRisePerSec?: number;
        forageMultiplier?: number;
        preyMultiplier?: number;
        contactDamageMultiplier?: number;
        senseRadius?: number;
    };
    visual: { attachment: string };
    starter: boolean;
}

export const CREATURE_PARTS: readonly CreaturePartDef[] = [
    { id: 'steady-legs', slot: 'locomotion', name: 'Steady legs', description: 'A dependable gait for the new land.', effects: {}, visual: { attachment: 'legs' }, starter: true },
    { id: 'grazing-jaws', slot: 'feeding', name: 'Grazing jaws', description: 'Feed well on visible vegetation.', diet: 'herbivore', effects: { forageMultiplier: 1 }, visual: { attachment: 'jaws' }, starter: true },
    { id: 'hunting-fangs', slot: 'feeding', name: 'Hunting fangs', description: 'Feed well on hunted prey.', diet: 'carnivore', effects: { preyMultiplier: 1 }, visual: { attachment: 'fangs' }, starter: true },
    { id: 'watchful-senses', slot: 'adaptation', name: 'Watchful senses', description: 'A balanced awareness of the land.', effects: {}, visual: { attachment: 'eyes' }, starter: true },
    { id: 'bounding-legs', slot: 'locomotion', name: 'Bounding legs', description: '+15% movement speed; hunger rises faster.', effects: { speedMultiplier: 0.15, hungerRisePerSec: 0.2 }, visual: { attachment: 'long-legs' }, starter: false },
    { id: 'endurance-feet', slot: 'locomotion', name: 'Endurance feet', description: 'Move a little slower; hunger rises more slowly.', effects: { speedMultiplier: -0.05, hungerRisePerSec: -0.25 }, visual: { attachment: 'broad-feet' }, starter: false },
    { id: 'grinding-molars', slot: 'feeding', name: 'Grinding molars', description: '+50% nourishment from vegetation.', diet: 'herbivore', effects: { forageMultiplier: 1.5 }, visual: { attachment: 'molars' }, starter: false },
    { id: 'serrated-fangs', slot: 'feeding', name: 'Serrated fangs', description: '+50% nourishment from hunted prey.', diet: 'carnivore', effects: { preyMultiplier: 1.5 }, visual: { attachment: 'serrated-fangs' }, starter: false },
    { id: 'thick-hide', slot: 'adaptation', name: 'Thick hide', description: 'Take less predator damage; move more slowly.', effects: { contactDamageMultiplier: 0.75, speedMultiplier: -0.08 }, visual: { attachment: 'hide' }, starter: false },
    { id: 'keen-eyes', slot: 'adaptation', name: 'Keen eyes', description: 'See food, relics and danger from farther away.', effects: { senseRadius: 250 }, visual: { attachment: 'keen-eyes' }, starter: false },
];

export const CREATURE_PART_BY_ID: Readonly<Record<string, CreaturePartDef>> = Object.fromEntries(CREATURE_PARTS.map((part) => [part.id, part]));
export const CREATURE_PART_SLOTS: readonly CreaturePartSlot[] = ['locomotion', 'feeding', 'adaptation'];

export function creatureDiet(equipped: Record<CreaturePartSlot, string>): CreatureDiet {
    return CREATURE_PART_BY_ID[equipped.feeding]?.diet ?? 'herbivore';
}
