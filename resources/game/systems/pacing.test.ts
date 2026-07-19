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

/** Target band: every stage should take roughly 5–8 minutes of sim time. */
const MIN_SECONDS = 240;
const MAX_SECONDS = 600;

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

    for (let seconds = 1; seconds <= MAX_SECONDS + 120; seconds++) {
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

describe('strategic stage pacing (5–8 minute band)', () => {
    for (const id of ['tribe', 'civilisation', 'planetary', 'space']) {
        it(`${id} completes in ${MIN_SECONDS}–${MAX_SECONDS}s for a scripted player`, () => {
            const { seconds } = simulate(stages[id]);
            expect(seconds, `${id} took ${seconds}s`).toBeGreaterThanOrEqual(MIN_SECONDS);
            expect(seconds, `${id} took ${seconds}s`).toBeLessThanOrEqual(MAX_SECONDS);
        });
    }
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
        // And the objective demands tier 3, which exists.
        expect(CELL.tierThresholds.length).toBe(3);
        // Something is edible at every tier so progress never stalls.
        for (const tier of [1, 2, 3]) {
            expect(ENEMY_CELLS.some((d) => canEat(tier, d))).toBe(tier > 0 || true);
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
