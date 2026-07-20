import { describe, it, expect } from 'vitest';
import {
    initManagement,
    tickManagement,
    canTakeAction,
    actionAvailability,
    takeAction,
    applyEventEffects,
    applyScout,
    applyColonise,
    colonisableSites,
    colonyRates,
    addRival,
    applyColonyAction,
    saveManagement,
    isRevealed,
    objectiveProgress,
    isManagementComplete,
    tickRivals,
    emergeRivals,
    rivalRaid,
    rivalMilestones,
    rivalRaceProgress,
    factionStance,
    factionActions,
    canTakeFactionAction,
    applyFactionAction,
    actionsForAnchor,
    councilActions,
    ecologyStalled,
    currentEra,
    type StageDef,
    type ManagementState,
    type FactionActionKind,
} from './managementState';
import stagesData from '../data/stages.json';

const stages = stagesData.stages as unknown as Record<string, StageDef>;

/** The first discovered rival's id (tribe starts with the Ashfolk visible). */
const firstRival = (s: ManagementState) => s.rivals.find((r) => r.discovered)!.id;
/** Stages name their own diplomacy verbs, so look options up by behaviour. */
const byKind = (def: StageDef, kind: FactionActionKind) => factionActions(def).find((a) => a.kind === kind)!.id;

describe('managementState', () => {
    it('explains a missing prerequisite before resource shortfalls', () => {
        const def = stages.civilisation;
        const state = initManagement(def);
        state.resources.food.value = 999;
        state.resources.gold.value = 999;
        const availability = actionAvailability(state, def, 'aqueduct');
        expect(availability).toMatchObject({ allowed: false, reason: 'missing-requirement' });
        expect(availability.message).toContain('Raise granaries');
    });
    it('initialises resources from the stage definition', () => {
        const s = initManagement(stages.tribe);
        expect(s.resources.food.value).toBe(25);
        expect(s.resources.culture.value).toBe(0);
        expect(s.taken).toEqual([]);
    });

    it('ticks resources by their per-second rates', () => {
        const s = tickManagement(initManagement(stages.tribe), 2);
        expect(s.resources.food.value).toBeCloseTo(25 + 1.2 * 2);
    });

    it('gates actions behind their required predecessors', () => {
        const def = stages.tribe;
        let s = initManagement(def);
        expect(canTakeAction(s, def, 'songs')).toBe(false); // needs huts
        s = takeAction(s, def, 'huts');
        expect(canTakeAction(s, def, 'songs')).toBe(true);
    });

    it('refuses actions the player cannot afford', () => {
        const def = stages.tribe;
        const s = { ...initManagement(def) };
        s.resources.materials.value = 0;
        expect(canTakeAction(s, def, 'huts')).toBe(false); // huts cost materials
    });

    it('applies action cost, grants and rate changes', () => {
        const def = stages.tribe;
        let s = initManagement(def);
        s = takeAction(s, def, 'huts'); // needed for songs
        const songs = def.actions.find((a) => a.id === 'songs')!;
        const before = s.resources.food.value;
        s = takeAction(s, def, 'songs');
        expect(s.resources.food.value).toBe(before - songs.cost.food);
        expect(s.resources.culture.perTick).toBeCloseTo(songs.rate.culture);
        expect(s.taken).toContain('songs');
    });

    it('does not take a once-only action twice, but repeatable actions repeat', () => {
        const def = stages.tribe;
        let s = takeAction(initManagement(def), def, 'huts');
        const takenCount = s.taken.length;
        s = takeAction(s, def, 'huts');
        expect(s.taken.length).toBe(takenCount);

        // Scouting is repeatable.
        s.resources.food.value = 100;
        s = takeAction(s, def, 'scout');
        s = takeAction(s, def, 'scout');
        expect(s.taken.filter((id) => id === 'scout').length).toBe(2);
    });

    it('completes when the objective resource reaches its target', () => {
        const def = stages.tribe;
        const s = initManagement(def);
        s.resources.culture.value = def.objective.target;
        expect(isManagementComplete(s, def)).toBe(true);
        expect(objectiveProgress(s, def)).toBe(1);
    });

    it('applies event effects, clamping resources at zero and logging', () => {
        const def = stages.tribe;
        let s = initManagement(def);
        s.resources.food.value = 5;
        s = applyEventEffects(s, { food: -10, culture: 3 }, 'Rationed through the drought.');
        expect(s.resources.food.value).toBe(0); // clamped
        expect(s.resources.culture.value).toBe(3);
        expect(s.log[0]).toBe('Rationed through the drought.');
    });
});

describe('fog + scouting', () => {
    it('starts with only home revealed; hidden rivals stay undiscovered', () => {
        const def = stages.tribe;
        const s = initManagement(def);
        expect(isRevealed(s, def.map!.home.x, def.map!.home.y)).toBe(true);
        // Scoutable hidden rivals + one power that has not emerged yet.
        expect(s.rivals.filter((r) => r.present && !r.discovered).length).toBe(3);
        expect(s.rivals.filter((r) => !r.present).length).toBe(1);
    });

    it('scouting reveals the nearest hidden target and eventually every present rival', () => {
        const def = stages.tribe;
        let s = initManagement(def);
        let found = 0;
        for (let i = 0; i < 12; i++) {
            const result = applyScout(s, def);
            s = result.state;
            if (result.revealed) found += 1;
        }
        expect(found).toBeGreaterThan(0);
        expect(s.rivals.filter((r) => r.present).every((r) => r.discovered)).toBe(true);
        // Not-yet-emerged powers can never be scouted out early.
        expect(s.rivals.filter((r) => !r.present).every((r) => !r.discovered)).toBe(true);
        // Once everything findable is known, scouting reports nothing new.
        expect(applyScout(s, def).revealed).toBeNull();
    });

    it('emergent powers rise at their appointed hour, announced and discovered', () => {
        const def = stages.tribe;
        let s = initManagement(def);
        const sleeper = s.rivals.find((r) => !r.present)!;

        // Too early: nothing changes, and the sleeper does not grow.
        expect(emergeRivals(s, sleeper.emergesAt - 1).emerged).toHaveLength(0);
        const early = tickRivals(s, 30).rivals.find((r) => r.id === sleeper.id)!;
        expect(early.strength).toBe(sleeper.strength);

        // At its hour it arrives discovered, with a log line, exactly once.
        const rise = emergeRivals(s, sleeper.emergesAt);
        expect(rise.emerged.map((r) => r.id)).toEqual([sleeper.id]);
        s = rise.state;
        expect(s.rivals.find((r) => r.id === sleeper.id)!.discovered).toBe(true);
        expect(s.log[0]).toContain(sleeper.name);
        expect(emergeRivals(s, sleeper.emergesAt + 100).emerged).toHaveLength(0);
    });
});

describe('rivals (multi-faction)', () => {
    it('initialises every rival from the stage data with archetypes', () => {
        const s = initManagement(stages.tribe);
        expect(s.rivals.length).toBe(5);
        expect(s.rivals.map((r) => r.archetype)).toContain('trader');
        expect(s.rivals.map((r) => r.archetype)).toContain('builder');
    });

    it('falls back to one synthesized rival for stages without rival data', () => {
        const def = { ...stages.tribe, rivals: undefined };
        const s = initManagement(def, undefined, 'the Palefins');
        expect(s.rivals.length).toBe(1);
        expect(s.rivals[0].name).toBe('the Palefins');
        expect(s.rivals[0].discovered).toBe(true);
    });

    it('archetypes grow differently: aggressive outpaces trader in strength', () => {
        let s = initManagement(stages.tribe);
        s = tickRivals(s, 30);
        const aggressive = s.rivals.find((r) => r.archetype === 'aggressive')!;
        const trader = s.rivals.find((r) => r.archetype === 'trader')!;
        expect(aggressive.strength - 24).toBeGreaterThan(trader.strength - 18);
        // Aggressive rivals also drift toward hostility on their own.
        expect(aggressive.relationship).toBeLessThan(0);
    });

    it('maps relationship to a stance', () => {
        expect(factionStance(70)).toBe('allied');
        expect(factionStance(0)).toBe('neutral');
        expect(factionStance(-80)).toBe('hostile');
    });

    it('only DISCOVERED hostile rivals raid, draining the objective resource', () => {
        const def = stages.tribe;
        const s = initManagement(def);
        s.resources.culture.value = 30;
        const rival = s.rivals[0];
        rival.strength = 80;

        // neutral → no raid
        expect(rivalRaid(s, def, rival.id).amount).toBe(0);

        // hostile + discovered → raids
        rival.relationship = -80;
        const { state, amount } = rivalRaid(s, def, rival.id);
        expect(amount).toBeGreaterThan(0);
        expect(state.resources.culture.value).toBe(30 - amount);

        // hostile but hidden → never raids
        const hidden = s.rivals.find((r) => !r.discovered)!;
        hidden.relationship = -80;
        hidden.strength = 80;
        expect(rivalRaid(s, def, hidden.id).amount).toBe(0);
    });

    it('defence blunts raid damage', () => {
        const def = stages.tribe;
        const base = initManagement(def);
        base.resources.culture.value = 50;
        base.rivals[0].strength = 80;
        base.rivals[0].relationship = -80;

        const undefended = rivalRaid(base, def, base.rivals[0].id).amount;
        base.rivals[0].defense = 80;
        const fortified = rivalRaid(base, def, base.rivals[0].id).amount;
        expect(fortified).toBeLessThan(undefended);
    });

    it('diplomacy actions target one rival and leave the others untouched', () => {
        const def = stages.tribe;
        const s = initManagement(def);
        s.resources.food.value = 50;
        s.resources.materials.value = 50;
        const target = firstRival(s);

        const after = applyFactionAction(s, def, byKind(def, 'emissary'), target);
        expect(after.rivals.find((r) => r.id === target)!.relationship).toBeGreaterThan(0);
        expect(after.rivals.filter((r) => r.id !== target).every((r) => r.relationship === 0)).toBe(true);

        const undermined = applyFactionAction(s, def, byKind(def, 'undermine'), target);
        expect(undermined.rivals.find((r) => r.id === target)!.strength).toBeLessThan(s.rivals[0].strength);
    });

    it('blocks trade with hostile rivals, undiscovered rivals, and empty purses', () => {
        const def = stages.tribe;
        const s = initManagement(def);
        s.resources.food.value = 50;
        s.resources.materials.value = 50;
        const target = firstRival(s);
        s.rivals[0].relationship = -80;
        expect(canTakeFactionAction(s, def, byKind(def, 'trade'), target)).toBe(false);

        const hidden = s.rivals.find((r) => !r.discovered)!;
        expect(canTakeFactionAction(s, def, byKind(def, 'emissary'), hidden.id)).toBe(false);

        s.resources.food.value = 0;
        expect(canTakeFactionAction(s, def, byKind(def, 'emissary'), target)).toBe(false);
    });

    // Each strategic stage must speak in its own voice — this is the whole
    // point of the per-stage `diplomacy` block.
    it('every strategic stage names its own diplomacy verbs', () => {
        const labelsByStage = ['tribe', 'civilisation', 'planetary', 'space'].map(
            (id) => factionActions(stages[id]).map((a) => a.label),
        );
        for (const labels of labelsByStage) expect(labels.length).toBeGreaterThanOrEqual(4);

        // No label is shared between any two stages.
        const all = labelsByStage.flat();
        expect(new Set(all).size).toBe(all.length);

        // Costs resolve to real resources of that stage.
        for (const id of ['tribe', 'civilisation', 'planetary', 'space']) {
            const ids = new Set(stages[id].resources.map((r) => r.id));
            for (const a of factionActions(stages[id])) expect(ids.has(a.costResource)).toBe(true);
        }
    });

    it('civilisation: conquest absorbs only a weakened rival and pays out', () => {
        const def = stages.civilisation;
        const s = initManagement(def);
        s.resources.food.value = 100;
        s.resources.gold.value = 100; // marching is paid for in gold, not grain
        const target = firstRival(s);
        expect(factionActions(def).some((a) => a.kind === 'conquer')).toBe(true);

        // Too strong to conquer.
        s.rivals[0].strength = 80;
        expect(canTakeFactionAction(s, def, 'fac_conquer', target)).toBe(false);

        // Weakened → conquerable; absorbing it neutralises them and grants tech.
        s.rivals[0].strength = 30;
        expect(canTakeFactionAction(s, def, 'fac_conquer', target)).toBe(true);
        const after = applyFactionAction(s, def, 'fac_conquer', target, 0);
        expect(after.rivals[0].strength).toBe(0);
        expect(after.resources.tech.value).toBeGreaterThan(0);
        // Already absorbed → cannot conquer again.
        expect(canTakeFactionAction(after, def, 'fac_conquer', target)).toBe(false);
    });

    it('tribe has no conquest action (mechanics-gated)', () => {
        expect(factionActions(stages.tribe).some((a) => a.id === 'fac_conquer')).toBe(false);
    });

    // Regression: conquest used to zero a rival's strength while leaving it in
    // play, so tickRivals regrew it from 0 and the march re-enabled seconds
    // later — farmable for unlimited objective gain.
    it('civilisation: an absorbed rival never returns, however much time passes', () => {
        const def = stages.civilisation;
        const s = initManagement(def);
        s.resources.food.value = 1000;
        s.resources.gold.value = 1000;
        const target = firstRival(s);
        s.rivals[0].strength = 10;

        let after = applyFactionAction(s, def, 'fac_conquer', target, 0);
        expect(after.rivals[0].defeated).toBe(true);
        const wonTech = after.resources.tech.value;

        // Let the clock run well past the old ~2s re-enable window.
        for (let i = 0; i < 120; i++) after = tickRivals(after, 1);

        expect(after.rivals[0].strength).toBe(0);
        expect(canTakeFactionAction(after, def, 'fac_conquer', target)).toBe(false);
        expect(after.resources.tech.value).toBe(wonTech);
        // A defeated rival is out of the game entirely.
        expect(rivalRaid(after, def, target).amount).toBe(0);
        expect(rivalMilestones(after, def).surged.length).toBe(0);
    });

    it('civilisation: a repulsed march costs you and locks out a retry', () => {
        const def = stages.civilisation;
        const s = initManagement(def);
        s.resources.food.value = 1000;
        s.resources.gold.value = 1000;
        const target = firstRival(s);
        s.rivals[0].strength = 44; // near the threshold → poor odds

        // roll of 1 always exceeds the odds, so this attempt fails.
        const after = applyFactionAction(s, def, 'fac_conquer', target, 1);
        expect(after.rivals[0].defeated).toBe(false);
        expect(after.resources.tech.value).toBe(s.resources.tech.value);
        expect(after.rivals[0].conquerCooldown).toBeGreaterThan(0);
        expect(canTakeFactionAction(after, def, 'fac_conquer', target)).toBe(false);
    });

    it('rival milestones set you back and reset their race', () => {
        const def = stages.tribe;
        const s = initManagement(def);
        s.resources.culture.value = 40;
        s.rivals[0].progress = 999;

        const { state, surged } = rivalMilestones(s, def);
        expect(surged.length).toBe(1);
        expect(state.resources.culture.value).toBeLessThan(40);
        expect(state.rivals[0].progress).toBe(0);
        expect(rivalMilestones(state, def).surged.length).toBe(0);
        expect(rivalRaceProgress(state.rivals[0])).toBe(0);
    });
});

describe('action anchors (map bottom-bar routing)', () => {
    it('routes tribe located actions to home/sites and abstract ones to Council', () => {
        const def = stages.tribe;
        expect(actionsForAnchor(def, 'home').map((a) => a.id)).toContain('huts');
        expect(actionsForAnchor(def, 'home').map((a) => a.id)).toContain('rituals');
        expect(actionsForAnchor(def, 'site:grove').map((a) => a.id)).toEqual(['forage']);
        expect(actionsForAnchor(def, 'site:flint').map((a) => a.id)).toEqual(['tools']);
        // Scouting has no place on the map — it stays in the Council.
        expect(councilActions(def).map((a) => a.id)).toContain('scout');
        expect(councilActions(def).map((a) => a.id)).not.toContain('huts');
    });

    it('every anchored action still resolves through the normal engine path', () => {
        const def = stages.tribe;
        let s = initManagement(def);
        // "forage" is site-anchored but takeAction is anchor-agnostic.
        expect(canTakeAction(s, def, 'forage')).toBe(true);
        s = takeAction(s, def, 'forage');
        expect(s.taken).toContain('forage');
        expect(s.resources.food.perTick).toBeGreaterThan(def.resources[0].perTick);
    });

    it('partitions every stage cleanly into Council (anchorless) and anchored', () => {
        for (const id of ['tribe', 'civilisation', 'planetary', 'space']) {
            const def = stages[id];
            const council = councilActions(def).map((a) => a.id);
            const anchored = def.actions.filter((a) => (a.anchor ?? 'council') !== 'council').map((a) => a.id);
            expect(new Set([...council, ...anchored]).size).toBe(def.actions.length);
            expect(council.filter((x) => anchored.includes(x))).toHaveLength(0);
            for (const a of councilActions(def)) expect(a.anchor).toBeUndefined();
        }
    });
});

describe('mechanics rules', () => {
    it('planetary: unity stalls while ecology is exhausted', () => {
        const def = stages.planetary;
        const s = initManagement(def);
        s.resources.unity.perTick = 1;
        s.resources.ecology.value = 0;
        expect(ecologyStalled(s, def)).toBe(true);
        const ticked = tickManagement(s, 5, def);
        expect(ticked.resources.unity.value).toBe(0); // no gain while stalled
        s.resources.ecology.value = 20;
        expect(tickManagement(s, 5, def).resources.unity.value).toBeGreaterThan(0);
    });

    it('civilisation: eras advance with the objective resource', () => {
        const def = stages.civilisation;
        const s = initManagement(def);
        expect(currentEra(s, def)?.id).toBe('bronze');
        s.resources.tech.value = def.eras![1].at + 1;
        expect(currentEra(s, def)?.id).toBe('iron');
        s.resources.tech.value = def.eras![2].at + 1;
        expect(currentEra(s, def)?.id).toBe('classical');
    });

    it('space: colonising claims the nearest revealed system and adds its rate', () => {
        const def = stages.space;
        let s = initManagement(def);
        expect(colonisableSites(s, def).length).toBe(0); // all fogged at start
        expect(canTakeAction({ ...s, resources: { ...s.resources, alloy: { value: 99, perTick: 0 }, research: { value: 99, perTick: 0 } }, taken: ['shipyards'] }, def, 'colonies')).toBe(false);

        // Probe until something colonisable appears.
        for (let i = 0; i < 8 && colonisableSites(s, def).length === 0; i++) {
            s = applyScout(s, def).state;
        }
        expect(colonisableSites(s, def).length).toBeGreaterThan(0);

        const { state, site } = applyColonise(s, def);
        expect(site).not.toBeNull();
        expect(state.colonies.length).toBe(1);
        // Output is derived from the colony, not baked into the base rate — so
        // the stage's own perTick is untouched and the colony contributes live.
        expect(state.resources.legacy.perTick).toBe(s.resources.legacy.perTick);
        expect(Object.values(colonyRates(state)).some((r) => r > 0)).toBe(true);
    });

    it('space: you colonise the system you name, not the nearest one', () => {
        const def = stages.space;
        let s = initManagement(def);
        // Reveal the whole chart so every system is a candidate.
        s = { ...s, discovered: [{ x: 0.5, y: 0.5, r: 5 }] };

        const open = colonisableSites(s, def);
        const chosen = open[open.length - 1]; // deliberately not the nearest
        const { state, site } = applyColonise(s, def, chosen.id);

        expect(site?.id).toBe(chosen.id);
        expect(state.colonies[0].siteId).toBe(chosen.id);
    });

    it('space: a lost colony takes its production with it', () => {
        const def = stages.space;
        let s = initManagement(def);
        s = { ...s, discovered: [{ x: 0.5, y: 0.5, r: 5 }] };
        s = applyColonise(s, def).state;

        const withColony = colonyRates(s);
        expect(Object.values(withColony).some((r) => r > 0)).toBe(true);

        const without = colonyRates({ ...s, colonies: [] });
        expect(Object.values(without).every((r) => r === 0)).toBe(true);
    });

    it('space: a power met in play joins the map and can be dealt with', () => {
        const def = stages.space;
        let s = initManagement(def);
        const before = s.rivals.length;

        s = addRival(s, {
            id: 'native:aurelia', name: 'the Aurelia Concord', archetype: 'trader',
            x: 0.78, y: 0.55, present: true, emergesAt: 0, discovered: true,
            strength: 20, relationship: 15, defense: 0, progress: 0,
        });

        expect(s.rivals.length).toBe(before + 1);
        const met = s.rivals.find((r) => r.id === 'native:aurelia')!;
        expect(met.discovered).toBe(true);
        expect(s.log[0]).toContain('First contact');

        // They are a real power: the stage's own diplomacy applies to them.
        s.resources.research.value = 100;
        s.resources.alloy.value = 100;
        expect(canTakeFactionAction(s, def, byKind(def, 'emissary'), met.id)).toBe(true);

        // And contact happens once — meeting them again is a no-op.
        const again = addRival(s, { ...met });
        expect(again.rivals.length).toBe(s.rivals.length);
    });

    it('space: a galaxy survives a save and reload', () => {
        const def = stages.space;
        let s = initManagement(def);
        s = { ...s, discovered: [{ x: 0.5, y: 0.5, r: 5 }] };
        s = takeAction(s, def, 'shipyards');
        s = applyColonise(s, def, 'nadir', 120).state;
        // Top up alloy without disturbing the rate shipyards granted.
        s = { ...s, resources: { ...s.resources, alloy: { ...s.resources.alloy, value: 500 } } };
        s = applyColonyAction(s, 'col_spec_research', 'nadir');
        s = addRival(s, {
            id: 'native:aurelia', name: 'the Aurelia Chorus', archetype: 'trader',
            x: 0.78, y: 0.55, present: true, emergesAt: 0, discovered: true,
            strength: 20, relationship: 15, defense: 0, progress: 0,
        });
        s = { ...s, encountered: ['nadir', 'aurelia'], rivalClaims: ['cinder'] };

        // Round-trip through the saved slice, as the server stores it.
        const restored = initManagement(def, undefined, 'A rival power', JSON.parse(JSON.stringify(saveManagement(s))));

        expect(restored.colonies).toHaveLength(1);
        expect(restored.colonies[0].name).toBe(s.colonies[0].name);
        expect(restored.colonies[0].specialisation).toBe('research');
        expect(restored.rivals.some((r) => r.id === 'native:aurelia')).toBe(true);
        expect(restored.encountered).toEqual(['nadir', 'aurelia']);
        expect(restored.rivalClaims).toEqual(['cinder']);
        expect(restored.discovered).toHaveLength(1);

        // Rates granted by past decisions are re-derived from `taken`, not
        // stored — so a reloaded stage produces exactly what it did before.
        expect(restored.resources.alloy.perTick).toBeCloseTo(s.resources.alloy.perTick);
        expect(colonyRates(restored)).toEqual(colonyRates(s));
    });

    it('space: a corrupt or empty saved slice falls back to a fresh stage', () => {
        const def = stages.space;
        const restored = initManagement(def, undefined, 'A rival power', {
            colonies: 'not-an-array' as never,
            rivals: undefined,
        });

        expect(restored.colonies).toEqual([]);
        expect(restored.rivals.length).toBeGreaterThan(0); // authored rivals return
        expect(restored.discovered).toHaveLength(1); // home is revealed
    });

    it("space: the elder rival's milestone claims a system you have seen", () => {
        const def = stages.space;
        let s = initManagement(def);
        s = { ...s, discovered: [{ x: 0.5, y: 0.5, r: 5 }] };
        s.rivals[0].discovered = true;
        s.rivals[0].progress = 999;

        const { state, surged } = rivalMilestones(s, def);
        expect(surged[0].claimedSiteId).not.toBeNull();
        expect(state.rivalClaims.length).toBe(1);
    });

    // Regression: the rival used to take the nearest unclaimed site of ANY
    // kind, revealed or not — so a system the player had never seen could be
    // lost silently, and the log would name a place they'd never heard of.
    it('space: a rival cannot claim a system still under fog', () => {
        const def = stages.space;
        const s = initManagement(def); // only home is revealed
        s.rivals[0].discovered = true;
        s.rivals[0].progress = 999;

        const { state, surged } = rivalMilestones(s, def);
        expect(surged[0].claimedSiteId).toBeNull();
        expect(state.rivalClaims).toEqual([]);
    });
});

describe('stage data integrity', () => {
    it('defines all four strategic stages with reachable objectives, maps and events', () => {
        for (const id of ['tribe', 'civilisation', 'planetary', 'space']) {
            const def = stages[id];
            expect(def).toBeDefined();
            expect(def.objective.target).toBeGreaterThan(0);
            expect(def.resources.some((r) => r.id === def.objective.resource)).toBe(true);
            expect(def.events.length).toBeGreaterThanOrEqual(3);
            for (const event of def.events) {
                expect(event.choices.length).toBeGreaterThan(0);
            }
            expect(def.map?.sites.length).toBeGreaterThan(0);
            expect(def.rivals?.length).toBeGreaterThan(0);
            expect(def.onboarding?.length).toBeGreaterThan(0);
        }
    });
});
