import { describe, it, expect } from 'vitest';
import {
    initManagement,
    tickManagement,
    canTakeAction,
    takeAction,
    applyScout,
    applyColonise,
    tickRivals,
    emergeRivals,
    rivalRaid,
    rivalMilestones,
    factionStance,
    factionActions,
    canTakeFactionAction,
    applyFactionAction,
    isManagementComplete,
    type StageDef,
    type ManagementState,
} from './managementState';
import stagesData from '../data/stages.json';
import { CELL, CREATURE, WORLD } from '../config';
import { ENEMY_CELLS } from '../data/sprites/cellSprites';
import { canEat } from './cellGrowth';

const stages = stagesData.stages as unknown as Record<string, StageDef>;

/**
 * Target band per stage, in sim-seconds. Most stages sit at roughly 5–8
 * minutes. Space is the finale and a sandbox: the design brief asks for a much
 * longer stage, and it ends when the player chooses to send the last ship
 * rather than the moment the number is met — so its band is far wider.
 */
const BANDS: Record<string, { min: number; max: number }> = {
    tribe: { min: 240, max: 600 },
    civilisation: { min: 240, max: 600 },
    planetary: { min: 240, max: 600 },
    space: { min: 600, max: 2400 },
};
/** The longest any stage may take — the simulation's hard stop. */
const SIM_LIMIT = 2400;

/**
 * A scripted "reasonable player": once per second, take the first affordable
 * decision (respecting gates); scout when a fog stage still hides things and
 * food allows; colonise when a system opens up. Rivals tick, raid on the real
 * cadence and surge at milestones — the same pressure a live game applies.
 * Curated events are randomised in-game, so they're excluded here (their
 * choices roughly balance out).
 */
function simulate(def: StageDef): { seconds: number; state: ManagementState } {
    let state = initManagement(def);
    const raidIntervalSec = 20;
    let raidClock = 0;

    for (let seconds = 1; seconds <= SIM_LIMIT + 120; seconds++) {
        state = tickManagement(state, 1, def);
        state = tickRivals(state, 1);
        state = emergeRivals(state, seconds).state;
        state = rivalMilestones(state, def).state;

        raidClock += 1;
        if (raidClock >= raidIntervalSec) {
            raidClock = 0;
            const hostiles = state.rivals.filter((r) => r.discovered && factionStance(r.relationship) === 'hostile');
            if (hostiles.length > 0) {
                state = rivalRaid(state, def, hostiles[0].id).state;
            }
        }

        // Basic diplomacy: keep the angriest discovered rival from staying
        // hostile (a real player answers raids with emissaries or walls).
        // Each stage names its own verbs, so resolve the peace-making option by
        // kind rather than by a hardcoded id.
        const emissary = factionActions(def).find((a) => a.kind === 'emissary');
        const angriest = [...state.rivals]
            .filter((r) => r.discovered)
            .sort((a, b) => a.relationship - b.relationship)[0];
        if (emissary && angriest && angriest.relationship < -50 && canTakeFactionAction(state, def, emissary.id, angriest.id)) {
            state = applyFactionAction(state, def, emissary.id, angriest.id);
        }

        // One decision per second at most (humans read before clicking).
        for (const action of def.actions) {
            if (!canTakeAction(state, def, action.id)) continue;
            // Taking the helm is a mode switch, not an economic decision — a
            // scripted player models the economy, so skip it.
            if (action.special === 'flight') continue;
            if (action.special === 'scout') {
                // Scout only while something findable is still hidden.
                const hiddenRival = state.rivals.some((r) => r.present && !r.discovered);
                const hiddenSite = (def.map?.sites ?? []).some(
                    (s) => !state.discovered.some((c) => Math.hypot(c.x - s.x, c.y - s.y) <= c.r),
                );
                if (!hiddenRival && !hiddenSite) continue;
                state = takeAction(state, def, action.id);
                state = applyScout(state, def).state;
            } else if (action.special === 'colonise') {
                state = takeAction(state, def, action.id);
                state = applyColonise(state, def).state;
            } else {
                state = takeAction(state, def, action.id);
            }
            break;
        }

        if (isManagementComplete(state, def)) return { seconds, state };
    }
    return { seconds: Infinity, state };
}

describe('strategic stage pacing (per-stage band)', () => {
    for (const [id, band] of Object.entries(BANDS)) {
        it(`${id} completes in ${band.min}–${band.max}s for a scripted player`, () => {
            const { seconds } = simulate(stages[id]);
            expect(seconds, `${id} took ${seconds}s`).toBeGreaterThanOrEqual(band.min);
            expect(seconds, `${id} took ${seconds}s`).toBeLessThanOrEqual(band.max);
        });
    }

    // The finale must not evict the player the instant the number is met.
    it('space ends on the player\'s command, not automatically', () => {
        expect(stages.space.mechanics?.endOnDemand).toBe(true);
        expect(stages.space.actions.some((a) => a.special === 'finish')).toBe(true);
    });
});

describe('direct-control stage pacing (derived bounds)', () => {
    it('cell: eating the objective takes minutes of travel, not seconds', () => {
        // Best case: the player eats everything on contact. The limiting factor
        // is travel between food. Average spacing of N motes over the world:
        const area = WORLD.cellWidth * WORLD.cellHeight;
        const spacing = Math.sqrt(area / CELL.moteCount);
        const eats = CELL.objectiveTarget; // 1 growth per mote minimum
        const travelSeconds = (eats * spacing) / CELL.speed;
        // Even a perfect straight-line player spends minutes travelling.
        expect(travelSeconds).toBeGreaterThan(50);
        // The final tier must be reachable before the objective completes,
        // otherwise the last growth tier is content the player never sees.
        const maxTier = CELL.tierThresholds.length;
        expect(CELL.objectiveTarget).toBeGreaterThan(CELL.tierThresholds[maxTier - 1]);
        // Something is edible at every tier so progress never stalls.
        for (let tier = 1; tier <= maxTier; tier++) {
            expect(ENEMY_CELLS.some((d) => canEat(tier, d))).toBe(true);
        }
        // And every tier below the top still has a genuine threat in it, so
        // growing up the chain always means outgrowing something.
        for (let tier = 1; tier < maxTier; tier++) {
            expect(ENEMY_CELLS.some((d) => d.damage > 0 && !canEat(tier, d))).toBe(true);
        }
    });

    it('creature: nest food supply forces multi-nest foraging over minutes', () => {
        const totalPerCycle = CREATURE.nestCount * CREATURE.foodPerNest;
        // The target cannot be met from one nest's stock alone.
        expect(CREATURE.objectiveTarget).toBeGreaterThan(CREATURE.foodPerNest * CREATURE.nourishPerBite * 3);
        // With respawns the target is reachable.
        expect(totalPerCycle * CREATURE.nourishPerBite).toBeGreaterThanOrEqual(CREATURE.objectiveTarget * 0.8);
        // Travel floor: eat objectiveTarget bites spaced across nests.
        const area = WORLD.creatureWidth * WORLD.creatureHeight;
        const nestSpacing = Math.sqrt(area / CREATURE.nestCount);
        const nestVisits = CREATURE.objectiveTarget / (CREATURE.foodPerNest * CREATURE.nourishPerBite);
        const travelSeconds = (nestVisits * nestSpacing) / CREATURE.speed;
        expect(travelSeconds).toBeGreaterThan(25);
    });
});
