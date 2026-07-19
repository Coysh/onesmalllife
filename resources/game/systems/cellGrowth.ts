/**
 * Stage 1 growth tiers + predation rules, pure so they are testable without
 * Phaser. The player's cell grows through 3 size tiers as it absorbs; each
 * tier-up flips the food chain — species of a lower tier become prey, equal
 * tiers are contested, higher tiers stay threats.
 */
import { CELL } from '../config';

export interface PreyLike {
    tier: number;
    /** Passive species are edible at EQUAL tier and never deal damage. */
    passive: boolean;
    hunts: boolean;
    flees: boolean;
    damage: number;
}

/** 1-based growth tier for an absorbed count. */
export function tierFor(absorbed: number, thresholds: readonly number[] = CELL.tierThresholds): number {
    let tier = 1;
    for (let i = 1; i < thresholds.length; i++) {
        if (absorbed >= thresholds[i]) tier = i + 1;
    }
    return tier;
}

/** Absorbed count needed for the next tier, or null at max tier. */
export function nextTierAt(absorbed: number, thresholds: readonly number[] = CELL.tierThresholds): number | null {
    for (let i = 1; i < thresholds.length; i++) {
        if (absorbed < thresholds[i]) return thresholds[i];
    }
    return null;
}

/** Can a player at this tier eat the given species? */
export function canEat(playerTier: number, prey: PreyLike): boolean {
    return prey.passive ? playerTier >= prey.tier : playerTier > prey.tier;
}

/** Does contact with this species hurt the player at this tier? */
export function threatens(playerTier: number, prey: PreyLike): boolean {
    return !prey.passive && !canEat(playerTier, prey) && prey.damage > 0;
}

/** Should this species actively chase the player? */
export function shouldHunt(playerTier: number, prey: PreyLike): boolean {
    return prey.hunts && playerTier <= prey.tier;
}

/** Should this species dash away from the player? */
export function shouldFlee(playerTier: number, prey: PreyLike): boolean {
    return prey.flees && canEat(playerTier, prey);
}

/** Damage the player takes on a contested contact, blunted by defense. */
export function contactDamage(baseDamage: number, defense: number): number {
    return Math.max(3, baseDamage - defense);
}

/**
 * An equal-tier hostile can be overpowered by a strong enough attacker: the
 * player eats it but takes one contested hit. Attack builds earn their keep.
 */
export function canOverpower(playerTier: number, attack: number, prey: PreyLike): boolean {
    return !prey.passive && prey.tier === playerTier && attack > prey.damage;
}
