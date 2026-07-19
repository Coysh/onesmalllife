/**
 * Data-driven management engine for the strategic stages (Tribe, Civilisation,
 * Planetary, Space). Pure and unit-testable. A stage is defined by resources
 * (each with a per-second rate), actions (spend resources to gain resources or
 * raise rates, sometimes gated by prior actions), a single objective
 * resource/target — and, since grammar v2: a map with sites, MULTIPLE rivals
 * (each with a position, archetype and hidden flag), fog-of-war with a
 * repeatable scout action, and per-event visual specs. This keeps the four
 * late stages as data, not four codebases (brief §12).
 */
import { FACTION } from '../config';

export interface StageResource {
    id: string;
    label: string;
    start: number;
    perTick: number; // base per-second rate
}

export interface StageAction {
    id: string;
    label: string;
    description: string;
    cost: Record<string, number>;
    grants: Record<string, number>; // immediate one-off resource changes
    rate: Record<string, number>; // permanent per-second rate changes
    requires: string[]; // action ids that must be taken first
    once: boolean;
    /**
     * For repeatable actions (once: false): how many times it may be taken, and
     * how much the cost multiplies each time. Without growth a repeatable
     * builder is an infinite-value loop; with it, each new farm costs more than
     * the last and the player must choose where to keep investing.
     */
    maxRepeat?: number;
    costGrowth?: number;
    /** Engine hook: 'scout' reveals the nearest hidden site/rival. */
    special?: string;
    /** CityScene: this action is placed on the map as a building. */
    placement?: boolean;
    /**
     * Where this decision is taken. 'home' → the settlement; 'site:<id>' → a
     * map site; omitted → the panel's Council list (abstract policy). Purely a
     * presentation concern — the engine resolves every action the same way.
     */
    anchor?: string;
}

export interface StageObjective {
    resource: string;
    target: number;
    label: string;
}

export interface StageEventChoice {
    label: string;
    effects: Record<string, number>; // resource deltas (may be negative)
    note: string; // short outcome line for the log
}

/**
 * How an event plays out on the map before its decision modal opens. Purely a
 * presentation concern — the engine never reads `kind`; EventTheatre routes on
 * it, so new members are a pure additive type change. An unknown/missing kind
 * falls back to a gentle pulse rather than crashing.
 */
export interface EventVisual {
    kind:
        // Original generic kinds.
        | 'arrival' | 'weather' | 'raid' | 'construction' | 'launch' | 'secession' | 'anomaly'
        // Bespoke per-event kinds (each has a distinctive EventTheatre animation).
        | 'drought' | 'migration' | 'omen' | 'plague' | 'harvest' | 'storm' | 'bloom' | 'strike'
        | 'signal' | 'discovery' | 'flare' | 'festival' | 'eclipse' | 'colony' | 'uprising' | 'sanctions';
    tint?: string; // hex like "#f2795f" for weather washes
    count?: number; // marching/arriving unit count
    sprite?: string; // unitSprites id
}

export interface StageEvent {
    id: string;
    title: string;
    description: string;
    choices: StageEventChoice[];
    visual?: EventVisual;
    /**
     * 'major' (default) stops the world and asks the player to decide. 'minor'
     * resolves itself into the activity log without interrupting — so the log
     * carries texture and only real decisions demand attention.
     */
    severity?: 'minor' | 'major';
}

export interface StageSite {
    id: string;
    label: string;
    x: number; // 0..1 of map width
    y: number; // 0..1 of map height
    kind: string; // 'resource' | 'village' | 'colony_target' | ...
    resource?: string;
    /** Space stage: founding a colony here adds this rate bonus. */
    rateBonus?: Record<string, number>;
}

export interface StageMap {
    style: 'tribal' | 'era' | 'planet' | 'starmap';
    home: { x: number; y: number }; // 0..1 of map size
    sites: StageSite[];
}

export type RivalArchetype = 'aggressive' | 'trader' | 'builder' | 'enigmatic';

export interface StageRival {
    id: string;
    name: string;
    x: number; // 0..1 of map width
    y: number;
    archetype: RivalArchetype;
    strength: number;
    hidden: boolean;
    /** Sim-seconds after which this power emerges (absent = present from start). */
    emergesAt?: number;
}

export interface OnboardingStep {
    id: string;
    title: string;
    text: string;
}

export interface StageMechanics {
    cityBuild?: boolean;
    conquest?: boolean;
    tradeRoutes?: boolean;
    eras?: boolean;
    ecologyPressure?: boolean;
    colonies?: boolean;
}

export interface StageEra {
    id: string;
    label: string;
    at: number; // objective-resource value at which this era begins
}

/**
 * How a stage talks to its rivals. Each stage names its own verbs so Tribe,
 * Civilisation, Planetary and Space don't all offer "Open trade" — the engine
 * resolves on `kind`, the label/description/cost are content. Omitting the
 * block falls back to the generic set (see DEFAULT_DIPLOMACY).
 */
export type FactionActionKind = 'emissary' | 'trade' | 'undermine' | 'fortify' | 'conquer';

export interface FactionActionSpec {
    id: string;
    label: string;
    description: string;
    kind: FactionActionKind;
    /** Defaults to the stage's primary resource when omitted. */
    costResource?: string;
    /** Defaults to the FACTION constant for this kind. */
    cost?: number;
}

export interface StageDef {
    id: string;
    title: string;
    subtitle: string;
    resources: StageResource[];
    actions: StageAction[];
    objective: StageObjective;
    events: StageEvent[];
    map?: StageMap;
    rivals?: StageRival[];
    fog?: { enabled: boolean; revealRadius: number };
    onboarding?: OnboardingStep[];
    mechanics?: StageMechanics;
    eras?: StageEra[];
    /** Per-stage diplomacy vocabulary; falls back to DEFAULT_DIPLOMACY. */
    diplomacy?: FactionActionSpec[];
    /** Reflavour raids for late stages (e.g. "sanctions"). */
    raidLabel?: string;
    /** Per-stage pacing overrides, in seconds. Fall back to scene defaults. */
    eventIntervalSeconds?: number;
    raidIntervalSeconds?: number;
    /** 'claimSite': a rival milestone claims a map site instead of only a setback. */
    milestoneEffect?: string;
}

export interface RivalState {
    id: string;
    name: string;
    archetype: RivalArchetype;
    x: number; // 0..1
    y: number;
    /** Not yet on the board at all (emerges later in the stage). */
    present: boolean;
    emergesAt: number;
    discovered: boolean;
    strength: number; // 0..100, grows over time
    relationship: number; // -100 (hostile) .. +100 (allied)
    defense: number; // reduces the next raid; decays over time
    progress: number; // the rival's race toward its own milestone
    /**
     * Absorbed for good. A defeated rival stops growing, racing and raiding,
     * and can never be conquered again — without this it regrows from 0 and the
     * conquest action re-enables within seconds (the old farming exploit).
     */
    defeated: boolean;
    /** Seconds until this rival can be marched on again after a failed attempt. */
    conquerCooldown: number;
}

export interface ManagementState {
    defId: string;
    resources: Record<string, { value: number; perTick: number }>;
    taken: string[];
    log: string[];
    rivals: RivalState[];
    /** Revealed fog circles (0..1 map coords). Home is always revealed. */
    discovered: { x: number; y: number; r: number }[];
    /** Sites claimed by a rival (space: lost systems) or by you (colonies). */
    claimedSites: { siteId: string; by: 'you' | 'rival' }[];
}

/** Archetype personality multipliers, applied in tickRivals. */
const ARCHETYPE = {
    aggressive: { growth: 1.25, race: 0.9, drift: -0.45 },
    trader: { growth: 0.85, race: 0.7, drift: 0.2 },
    builder: { growth: 1.0, race: 1.5, drift: 0 },
    enigmatic: { growth: 1.1, race: 1.2, drift: 0 },
} as const satisfies Record<RivalArchetype, { growth: number; race: number; drift: number }>;

function defaultRivals(def: StageDef, fallbackName: string): RivalState[] {
    const defs = def.rivals?.length
        ? def.rivals
        : [{ id: 'r1', name: fallbackName, x: 0.72, y: 0.32, archetype: 'aggressive' as const, strength: FACTION.strengthStart, hidden: false }];
    return defs.map((r) => ({
        id: r.id,
        name: r.name || fallbackName,
        archetype: r.archetype,
        x: r.x,
        y: r.y,
        present: !(r.emergesAt && r.emergesAt > 0),
        emergesAt: r.emergesAt ?? 0,
        discovered: !r.hidden && !(r.emergesAt && r.emergesAt > 0),
        strength: r.strength ?? FACTION.strengthStart,
        relationship: FACTION.relationshipStart,
        defense: 0,
        progress: 0,
        defeated: false,
        conquerCooldown: 0,
    }));
}

export function initManagement(
    def: StageDef,
    seed?: Record<string, number>,
    fallbackRivalName = 'A rival power',
): ManagementState {
    const resources: ManagementState['resources'] = {};
    for (const r of def.resources) {
        resources[r.id] = { value: seed?.[r.id] ?? r.start, perTick: r.perTick };
    }
    const home = def.map?.home ?? { x: 0.25, y: 0.5 };
    return {
        defId: def.id,
        resources,
        taken: [],
        log: [],
        rivals: defaultRivals(def, fallbackRivalName),
        discovered: [{ x: home.x, y: home.y, r: def.fog?.revealRadius ?? 0.2 }],
        claimedSites: [],
    };
}

/**
 * Advance resource values by their current rates. Pass the def to apply
 * mechanics rules (planetary ecologyPressure: a dead biosphere halts positive
 * objective gain until it recovers).
 */
export function tickManagement(state: ManagementState, dtSeconds: number, def?: StageDef): ManagementState {
    const stalledObjective = def && ecologyStalled(state, def) ? def.objective.resource : null;
    const resources = { ...state.resources };
    for (const id of Object.keys(resources)) {
        const r = resources[id];
        const rate = id === stalledObjective && r.perTick > 0 ? 0 : r.perTick;
        resources[id] = { ...r, value: Math.max(0, r.value + rate * dtSeconds) };
    }
    return { ...state, resources };
}

/** Where an action is taken; anchorless actions belong to the Council panel. */
export function actionAnchor(action: StageAction): string {
    return action.anchor ?? 'council';
}

/** Actions anchored to a given map object ('home', 'site:<id>') or 'council'. */
export function actionsForAnchor(def: StageDef, anchor: string): StageAction[] {
    return def.actions.filter((a) => actionAnchor(a) === anchor);
}

/** Abstract decisions with no map home — rendered in the panel. */
export function councilActions(def: StageDef): StageAction[] {
    return actionsForAnchor(def, 'council');
}

/** How many times an action has already been taken. */
export function timesTaken(state: ManagementState, actionId: string): number {
    return state.taken.reduce((n, id) => (id === actionId ? n + 1 : n), 0);
}

/** The cost of the *next* use, after `costGrowth` compounding per repeat. */
export function actionCost(action: StageAction, times: number): Record<string, number> {
    const growth = action.costGrowth ?? 1;
    if (growth === 1 || times === 0) return action.cost;
    const mult = Math.pow(growth, times);
    return Object.fromEntries(
        Object.entries(action.cost).map(([res, amount]) => [res, Math.round(amount * mult)]),
    );
}

export function canTakeAction(state: ManagementState, def: StageDef, actionId: string): boolean {
    const action = def.actions.find((a) => a.id === actionId);
    if (!action) return false;
    const times = timesTaken(state, actionId);
    if (action.once && times > 0) return false;
    if (action.maxRepeat !== undefined && times >= action.maxRepeat) return false;
    if (!action.requires.every((r) => state.taken.includes(r))) return false;
    if (action.special === 'colonise' && colonisableSites(state, def).length === 0) return false;
    return Object.entries(actionCost(action, times)).every(([res, amount]) => (state.resources[res]?.value ?? 0) >= amount);
}

export function takeAction(state: ManagementState, def: StageDef, actionId: string): ManagementState {
    if (!canTakeAction(state, def, actionId)) return state;
    const action = def.actions.find((a) => a.id === actionId)!;

    const resources = { ...state.resources };
    for (const [res, amount] of Object.entries(actionCost(action, timesTaken(state, actionId)))) {
        resources[res] = { ...resources[res], value: resources[res].value - amount };
    }
    for (const [res, amount] of Object.entries(action.grants)) {
        if (resources[res]) resources[res] = { ...resources[res], value: resources[res].value + amount };
    }
    for (const [res, delta] of Object.entries(action.rate)) {
        if (resources[res]) resources[res] = { ...resources[res], perTick: resources[res].perTick + delta };
    }

    return {
        ...state,
        resources,
        taken: [...state.taken, actionId],
        log: [`${action.label}`, ...state.log].slice(0, 8),
    };
}

/** Apply an event choice's resource deltas (clamped at zero), logging the outcome. */
export function applyEventEffects(
    state: ManagementState,
    effects: Record<string, number>,
    note?: string,
): ManagementState {
    const resources = { ...state.resources };
    for (const [res, delta] of Object.entries(effects)) {
        if (resources[res]) {
            resources[res] = { ...resources[res], value: Math.max(0, resources[res].value + delta) };
        }
    }
    return {
        ...state,
        resources,
        log: note ? [note, ...state.log].slice(0, 8) : state.log,
    };
}

// ---- Fog of war -------------------------------------------------------------

/** Is a normalised map point inside any revealed circle? */
export function isRevealed(state: ManagementState, x: number, y: number): boolean {
    return state.discovered.some((c) => Math.hypot(c.x - x, c.y - y) <= c.r);
}

/** Reveal a circle of fog (normalised coords). */
export function revealAt(state: ManagementState, x: number, y: number, r: number): ManagementState {
    return { ...state, discovered: [...state.discovered, { x, y, r }] };
}

export interface ScoutResult {
    state: ManagementState;
    revealed: { kind: 'rival' | 'site'; id: string; name: string; x: number; y: number } | null;
}

/**
 * Scouting reveals the nearest hidden rival or unrevealed site (closest to
 * home first) and marks any rival inside the new light as discovered.
 */
export function applyScout(state: ManagementState, def: StageDef): ScoutResult {
    const home = def.map?.home ?? { x: 0.25, y: 0.5 };
    const radius = def.fog?.revealRadius ?? 0.14;

    type Target = { kind: 'rival' | 'site'; id: string; name: string; x: number; y: number; dist: number };
    const targets: Target[] = [];
    for (const rival of state.rivals) {
        if (rival.present && !rival.discovered) {
            targets.push({ kind: 'rival', id: rival.id, name: rival.name, x: rival.x, y: rival.y, dist: Math.hypot(rival.x - home.x, rival.y - home.y) });
        }
    }
    for (const site of def.map?.sites ?? []) {
        if (!isRevealed(state, site.x, site.y)) {
            targets.push({ kind: 'site', id: site.id, name: site.label, x: site.x, y: site.y, dist: Math.hypot(site.x - home.x, site.y - home.y) });
        }
    }
    if (targets.length === 0) return { state, revealed: null };

    targets.sort((a, b) => a.dist - b.dist);
    const found = targets[0];
    let next = revealAt(state, found.x, found.y, radius);
    next = {
        ...next,
        rivals: next.rivals.map((r) => (r.present && isRevealed(next, r.x, r.y) ? { ...r, discovered: true } : r)),
        log: [`Scouts found ${found.name}.`, ...next.log].slice(0, 8),
    };
    return { state: next, revealed: { kind: found.kind, id: found.id, name: found.name, x: found.x, y: found.y } };
}

export interface ColoniseResult {
    state: ManagementState;
    site: StageSite | null;
}

/**
 * Found a colony at the nearest revealed, unclaimed colony_target site; the
 * site's rateBonus is added permanently. Returns null site if none available
 * (the scene should gate the action on this).
 */
export function colonisableSites(state: ManagementState, def: StageDef): StageSite[] {
    const claimed = new Set(state.claimedSites.map((c) => c.siteId));
    return (def.map?.sites ?? []).filter(
        (s) => s.kind === 'colony_target' && !claimed.has(s.id) && isRevealed(state, s.x, s.y),
    );
}

export function applyColonise(state: ManagementState, def: StageDef): ColoniseResult {
    const home = def.map?.home ?? { x: 0.25, y: 0.5 };
    const open = colonisableSites(state, def)
        .sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
    if (open.length === 0) return { state, site: null };

    const site = open[0];
    const resources = { ...state.resources };
    for (const [res, delta] of Object.entries(site.rateBonus ?? {})) {
        if (resources[res]) resources[res] = { ...resources[res], perTick: resources[res].perTick + delta };
    }
    return {
        state: {
            ...state,
            resources,
            claimedSites: [...state.claimedSites, { siteId: site.id, by: 'you' }],
            log: [`A colony took root in ${site.label}.`, ...state.log].slice(0, 8),
        },
        site,
    };
}

// ---- Rival factions (brief §20, multi-rival since v2) -----------------------

export type FactionStance = 'allied' | 'friendly' | 'neutral' | 'wary' | 'hostile';

export function factionStance(relationship: number): FactionStance {
    if (relationship >= 60) return 'allied';
    if (relationship >= 20) return 'friendly';
    if (relationship > -20) return 'neutral';
    if (relationship > -60) return 'wary';
    return 'hostile';
}

const clampRel = (v: number) => Math.max(-100, Math.min(100, v));

/**
 * Powers scheduled to emerge later announce themselves once the stage clock
 * passes their emergesAt. They arrive discovered — the drama is the arrival.
 */
export function emergeRivals(state: ManagementState, elapsedSeconds: number): { state: ManagementState; emerged: RivalState[] } {
    const emerged: RivalState[] = [];
    const rivals = state.rivals.map((r) => {
        if (r.present || elapsedSeconds < r.emergesAt) return r;
        const risen = { ...r, present: true, discovered: true };
        emerged.push(risen);
        return risen;
    });
    if (emerged.length === 0) return { state, emerged };
    let next = { ...state, rivals };
    for (const r of emerged) {
        next = { ...next, log: [`A new power rises: ${r.name}.`, ...next.log].slice(0, 8) };
    }
    return { state: next, emerged };
}

/** Grow every rival's strength, advance its race, decay its defence bonus. */
export function tickRivals(state: ManagementState, dtSeconds: number): ManagementState {
    return {
        ...state,
        rivals: state.rivals.map((r) => {
            if (!r.present) return r;
            // An absorbed rival is done: no growth, no race, no drift. Only the
            // conquest cooldown keeps ticking down.
            if (r.defeated) {
                return { ...r, conquerCooldown: Math.max(0, r.conquerCooldown - dtSeconds) };
            }
            const p = ARCHETYPE[r.archetype];
            return {
                ...r,
                strength: Math.min(FACTION.strengthMax, r.strength + FACTION.strengthPerTick * p.growth * dtSeconds),
                relationship: clampRel(r.relationship + p.drift * dtSeconds),
                defense: Math.max(0, r.defense - FACTION.defenseDecayPerTick * dtSeconds),
                progress: r.progress + r.strength * FACTION.raceFactor * p.race * dtSeconds,
                conquerCooldown: Math.max(0, r.conquerCooldown - dtSeconds),
            };
        }),
    };
}

export function rivalById(state: ManagementState, rivalId: string): RivalState | undefined {
    return state.rivals.find((r) => r.id === rivalId);
}

/** The rival's race toward its milestone, as a 0..1 ratio. */
export function rivalRaceProgress(rival: RivalState): number {
    return Math.min(1, rival.progress / FACTION.milestone);
}

export interface MilestoneResult {
    state: ManagementState;
    /** Rivals that surged this tick. */
    surged: { rival: RivalState; claimedSiteId: string | null }[];
}

/**
 * Any rival reaching its milestone surges ahead: a hard setback to your
 * objective (soft failure), then its race resets. With milestoneEffect
 * 'claimSite' it also claims the unclaimed site nearest to it.
 */
export function rivalMilestones(state: ManagementState, def: StageDef): MilestoneResult {
    let next = state;
    const surged: MilestoneResult['surged'] = [];
    for (const rival of state.rivals) {
        if (!rival.present || rival.defeated || rival.progress < FACTION.milestone) continue;

        const objId = def.objective.resource;
        const current = next.resources[objId]?.value ?? 0;
        const loss = Math.min(current, FACTION.milestoneSetback);
        next = applyEventEffects(next, { [objId]: -loss }, `${rival.name} surged ahead — lost ${Math.round(loss)} ${objId}.`);

        let claimedSiteId: string | null = null;
        if (def.milestoneEffect === 'claimSite') {
            const claimed = new Set(next.claimedSites.map((c) => c.siteId));
            const open = (def.map?.sites ?? [])
                .filter((s) => !claimed.has(s.id))
                .sort((a, b) => Math.hypot(a.x - rival.x, a.y - rival.y) - Math.hypot(b.x - rival.x, b.y - rival.y));
            if (open.length > 0) {
                claimedSiteId = open[0].id;
                next = {
                    ...next,
                    claimedSites: [...next.claimedSites, { siteId: claimedSiteId, by: 'rival' }],
                    log: [`${rival.name} claimed ${open[0].label}.`, ...next.log].slice(0, 8),
                };
            }
        }

        next = {
            ...next,
            rivals: next.rivals.map((r) => (r.id === rival.id ? { ...r, progress: 0 } : r)),
        };
        surged.push({ rival, claimedSiteId });
    }
    return { state: next, surged };
}

/**
 * A hostile, strong, DISCOVERED rival raids the objective resource. Returns
 * the amount lost (0 if no raid). Defence blunts the damage.
 */
export function rivalRaid(state: ManagementState, def: StageDef, rivalId: string): { state: ManagementState; amount: number } {
    const rival = rivalById(state, rivalId);
    if (!rival || !rival.discovered || rival.defeated) return { state, amount: 0 };
    if (factionStance(rival.relationship) !== 'hostile') return { state, amount: 0 };

    const raw = rival.strength * FACTION.raidStrengthFactor * (1 - rival.defense / 100);
    const objId = def.objective.resource;
    const current = state.resources[objId]?.value ?? 0;
    const amount = Math.min(current, Math.round(raw));
    if (amount <= 0) return { state, amount: 0 };

    const verb = def.raidLabel ?? 'raided';
    const next = applyEventEffects(state, { [objId]: -amount }, `${rival.name} ${verb} — lost ${amount} ${objId}.`);
    return { state: next, amount };
}

export interface FactionActionDef {
    id: string;
    label: string;
    description: string;
    kind: FactionActionKind;
    costResource: string;
    cost: number;
}

/** A rival must be weakened below this strength before it can be conquered. */
export const CONQUER_THRESHOLD = 45;
export const CONQUER_COST = 25;
export const CONQUER_OBJECTIVE_GAIN = 8;
/** Seconds before a failed march can be attempted again on the same rival. */
export const CONQUER_COOLDOWN = 45;

/** The generic vocabulary, used when a stage authors no `diplomacy` block. */
const DEFAULT_DIPLOMACY: FactionActionSpec[] = [
    { id: 'fac_emissary', label: 'Send an emissary', description: 'Ease tensions and improve the relationship.', kind: 'emissary' },
    { id: 'fac_trade', label: 'Open trade', description: 'Trade for gains and goodwill (needs a non-hostile rival).', kind: 'trade', cost: FACTION.tradeCost },
    { id: 'fac_undermine', label: 'Undermine them', description: 'Weaken the rival — but they will resent it.', kind: 'undermine' },
    { id: 'fac_fortify', label: 'Fortify against raids', description: 'Blunt the damage from their next raid.', kind: 'fortify' },
];

const DEFAULT_COST: Record<FactionActionKind, number> = {
    emissary: FACTION.actionCost,
    trade: FACTION.tradeCost,
    undermine: FACTION.actionCost,
    fortify: FACTION.actionCost,
    conquer: CONQUER_COST,
};

/**
 * The stage's diplomacy options. Each stage names its own verbs via
 * `def.diplomacy`; conquest options are still gated on `mechanics.conquest` so
 * a stage cannot offer a march it hasn't enabled.
 */
export function factionActions(def: StageDef): FactionActionDef[] {
    const primary = def.resources[0]?.id ?? '';
    const specs = def.diplomacy?.length ? def.diplomacy : DEFAULT_DIPLOMACY;
    const resolved = specs.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        kind: s.kind,
        costResource: s.costResource ?? primary,
        cost: s.cost ?? DEFAULT_COST[s.kind],
    }));
    const enabled = resolved.filter((a) => a.kind !== 'conquer' || def.mechanics?.conquest);

    // Fall back to the built-in march when a conquest stage authors no
    // conquest verb of its own, so enabling the mechanic is enough.
    if (def.mechanics?.conquest && !enabled.some((a) => a.kind === 'conquer')) {
        enabled.push({
            id: 'fac_conquer',
            label: 'March on them',
            description: `Absorb a weakened rival (their strength must be below ${CONQUER_THRESHOLD} — undermine them first).`,
            kind: 'conquer',
            costResource: primary,
            cost: CONQUER_COST,
        });
    }
    return enabled;
}

/**
 * Odds a march succeeds. A rival at the conquest threshold is close to a coin
 * flip; one ground down to nothing is nearly certain. Fortification defends
 * them too, so undermining first is the real preparation.
 */
export function conquestOdds(rival: RivalState): number {
    const fromStrength = Math.max(0, Math.min(1, rival.strength / CONQUER_THRESHOLD));
    const fromDefense = Math.max(0, Math.min(1, rival.defense / 100));
    return Math.max(0.15, Math.min(0.95, 0.95 - fromStrength * 0.45 - fromDefense * 0.25));
}

export function canTakeFactionAction(state: ManagementState, def: StageDef, actionId: string, rivalId: string): boolean {
    const action = factionActions(def).find((a) => a.id === actionId);
    const rival = rivalById(state, rivalId);
    if (!action || !rival || !rival.discovered) return false;
    if ((state.resources[action.costResource]?.value ?? 0) < action.cost) return false;
    // A rival you have absorbed is out of the game — nothing left to do to it.
    if (rival.defeated) return false;
    if (action.kind === 'trade' && factionStance(rival.relationship) === 'hostile') return false;
    if (action.kind === 'conquer') {
        if (rival.strength >= CONQUER_THRESHOLD) return false;
        if (rival.conquerCooldown > 0) return false;
    }
    return true;
}

/**
 * Resolve a diplomacy action. `roll` is a 0..1 sample supplied by the caller's
 * seeded RNG and is only consulted for conquest; defaulting it to 0 keeps the
 * function deterministic for callers that don't care.
 */
export function applyFactionAction(
    state: ManagementState,
    def: StageDef,
    actionId: string,
    rivalId: string,
    roll = 0,
): ManagementState {
    if (!canTakeFactionAction(state, def, actionId, rivalId)) return state;
    const action = factionActions(def).find((a) => a.id === actionId)!;

    const resources = { ...state.resources };
    resources[action.costResource] = {
        ...resources[action.costResource],
        value: resources[action.costResource].value - action.cost,
    };

    let note = '';
    const rivals = state.rivals.map((r) => {
        if (r.id !== rivalId) return r;
        const f = { ...r };
        switch (action.kind) {
            case 'emissary':
                f.relationship = clampRel(f.relationship + FACTION.emissaryRelationship);
                note = `${action.label}: ${f.name} softened.`;
                break;
            case 'trade':
                f.relationship = clampRel(f.relationship + FACTION.tradeRelationship);
                {
                    const objId = def.objective.resource;
                    if (resources[objId]) resources[objId] = { ...resources[objId], value: resources[objId].value + FACTION.tradeGain };
                }
                note = `${action.label}: ${f.name} paid off.`;
                break;
            case 'undermine':
                f.strength = Math.max(0, f.strength - FACTION.undermineStrength);
                f.relationship = clampRel(f.relationship - FACTION.undermineRelationship);
                f.progress = Math.max(0, f.progress - FACTION.undermineProgress);
                note = `${action.label}: ${f.name} weakened.`;
                break;
            case 'fortify':
                f.defense = Math.min(100, f.defense + FACTION.fortifyDefense);
                note = `${action.label}: braced against ${f.name}.`;
                break;
            case 'conquer':
                if (roll < conquestOdds(f)) {
                    f.defeated = true;
                    f.strength = 0;
                    f.relationship = 0;
                    f.progress = 0;
                    f.defense = 0;
                    {
                        const objId = def.objective.resource;
                        if (resources[objId]) resources[objId] = { ...resources[objId], value: resources[objId].value + CONQUER_OBJECTIVE_GAIN };
                    }
                    note = `${action.label}: you absorbed ${f.name}.`;
                } else {
                    // Repulsed: they dig in and resent you, and you cannot try
                    // again immediately. The cost is spent either way.
                    f.relationship = clampRel(f.relationship - FACTION.undermineRelationship);
                    f.defense = Math.min(100, f.defense + FACTION.fortifyDefense);
                    f.conquerCooldown = CONQUER_COOLDOWN;
                    note = `${action.label}: ${f.name} threw you back.`;
                }
                break;
        }
        return f;
    });

    return {
        ...state,
        resources,
        rivals,
        log: [note, ...state.log].slice(0, 8),
    };
}

// ---- Mechanics rules --------------------------------------------------------

/** Planetary: with ecologyPressure, a dead biosphere halts objective gain. */
export function ecologyStalled(state: ManagementState, def: StageDef): boolean {
    if (!def.mechanics?.ecologyPressure) return false;
    return (state.resources.ecology?.value ?? 1) <= 0;
}

/** The era active at the current objective value (last threshold passed). */
export function currentEra(state: ManagementState, def: StageDef): StageEra | null {
    if (!def.eras?.length) return null;
    const value = state.resources[def.objective.resource]?.value ?? 0;
    let active = def.eras[0];
    for (const era of def.eras) {
        if (value >= era.at) active = era;
    }
    return active;
}

export function objectiveProgress(state: ManagementState, def: StageDef): number {
    const value = state.resources[def.objective.resource]?.value ?? 0;
    return Math.min(1, value / def.objective.target);
}

export function isManagementComplete(state: ManagementState, def: StageDef): boolean {
    return (state.resources[def.objective.resource]?.value ?? 0) >= def.objective.target;
}
