/**
 * Typed event bridge between the Phaser world and the DOM HUD.
 *
 * The rendering boundary (brief §8) keeps gameplay in Phaser and all UI text in
 * the DOM. They never call into each other directly — they talk through this
 * small bus. The scene emits world/state events; DOM controllers listen and
 * update chrome. DOM controls emit intents; the scene listens.
 */

export interface HudState {
    species: string;
    stage: string; // e.g. "Stage 1 · Cell"
    energy: number; // 0..100 (meter 1)
    integrity: number; // 0..100 (meter 2)
    evolution: number; // banked points (meter 3)
    // Per-stage meter labels (Cell: Energy/Integrity/Evolution; Creature: Hunger/Health/Growth).
    energyLabel: string;
    integrityLabel: string;
    evolutionLabel: string;
    objectiveLabel: string;
    objectiveProgress: number; // 0..1
    threat: string | null; // directional warning word, or null
}

export interface StageCompletePayload {
    stage: string;
    nextStage: string | null;
    summary: string;
}

/** A direct-control stage failed — shown as a death moment, then retry. */
export interface StageFailedPayload {
    stage: string;
    title: string;
    summary: string;
}

export interface SaveSnapshot {
    stage: string;
    completed: boolean;
    traits: string[];
    // Per-stage numeric resources (Cell: energy/integrity/evolution/absorbed;
    // Creature: hunger/health/nourishment). Kept generic so each stage stores
    // its own; the server validates every value is a bounded number.
    resources: Record<string, number>;
}

export type SaveStatus = 'saving' | 'saved' | 'error';

export interface TraitEntry {
    id: string;
    name: string;
    description: string;
    category: string;
    cost: number;
    state: string; // TraitState
    benefits: string[];
    costs: string[];
    affordable: boolean;
    rarity: string;
    leadsTo: string[];
}

export interface TraitsUpdate {
    entries: TraitEntry[];
    evolution: number;
}

export interface ManagementResourceView {
    id: string;
    label: string;
    value: number;
    perTick: number;
}

export interface ManagementActionView {
    id: string;
    label: string;
    description: string;
    costLabel: string;
    affordable: boolean;
    taken: boolean;
    /**
     * Set when this decision is taken somewhere on the map ('home' /
     * 'site:<id>'). The panel lists it so the player can see everything
     * available, but clicking it travels there rather than acting at a
     * distance. Absent for abstract Council decisions.
     */
    locate?: string;
    /** Human-readable place, e.g. "at your settlement". */
    locationLabel?: string;
}

export interface FactionView {
    id: string;
    name: string;
    archetype: string;
    strength: number;
    relationship: number;
    stance: string;
    defense: number;
    raceProgress: number; // 0..1 toward the rival's milestone
}

export interface ManagementUpdate {
    title: string;
    subtitle: string;
    objectiveLabel: string;
    objectiveProgress: number;
    /** Era banner (civilisation) or mechanic status line (planetary stall). */
    statusLine: string | null;
    resources: ManagementResourceView[];
    /**
     * Decisions with no map anchor ("council" actions) — shown in the panel.
     * Anchored actions (build at a site/home, diplomacy) reach the player
     * through the contextual bottom bar instead (management:select).
     */
    actions: ManagementActionView[];
    /** Discovered rivals (status readouts; their actions live on the bar). */
    factions: FactionView[];
    /** Rivals still hidden in the fog. */
    hiddenRivals: number;
    log: string[];
}

/**
 * A map object the player selected — its actions fill the contextual bottom
 * bar. `kind` 'rival' actions are diplomacy (the bar attaches the rival id).
 */
export interface SelectionView {
    kind: 'home' | 'site' | 'rival';
    id: string;
    label: string;
    sublabel: string | null;
    actions: ManagementActionView[];
}

export interface EventView {
    title: string;
    description: string;
    /** Option labels only — the cost is deliberately not previewed. */
    choices: string[];
    /** A glyph representing the event (drought, plague, festival…). */
    icon?: string;
}

/**
 * What a decision actually cost or won, revealed *after* the player commits.
 * Previewing the numbers would remove the weight of the choice; hiding them
 * afterwards would leave the player unsure what just happened.
 */
export interface EventOutcomeView {
    note: string;
    effects: Record<string, number>;
    /** Resource id → display label, for rendering effects readably. */
    resourceLabels?: Record<string, string>;
}

/**
 * A significant world moment the player didn't choose — a rival overtaking you,
 * a new power arriving, a site lost. These used to land silently in the
 * activity log, so the turning points of a stage went unnoticed.
 */
export interface NoticeView {
    title: string;
    description: string;
    icon?: string;
}

export interface OnboardingView {
    stageId: string;
    steps: { id: string; title: string; text: string }[];
}

/** Event name → payload type. */
export interface GameEventMap {
    'hud:update': Partial<HudState>;
    'stage:complete': StageCompletePayload;
    'stage:failed': StageFailedPayload;
    'save:snapshot': SaveSnapshot;
    'save:status': SaveStatus;
    'traits:update': TraitsUpdate;
    'management:update': ManagementUpdate;
    /** A map object was selected — fill the contextual bottom bar. */
    'management:select': SelectionView;
    /** Nothing selected — hide the bottom bar. */
    'management:deselect': void;
    'event:show': EventView;
    'event:outcome': EventOutcomeView;
    'notice:show': NoticeView;
    'onboarding:show': OnboardingView;
    /** Creature stage start: ask the player to pick a diet. */
    'creature:choose-diet': void;
    /**
     * Creature stage start, after diet: shape the body your cell grew into by
     * taking one adaptation for free. The design carries forward from Stage 1
     * rather than being redrawn.
     */
    'creature:choose-adaptation': { options: { id: string; name: string; description: string }[] };
    'intent:choose-adaptation': { traitId: string };
    'sfx': { name: string };
    'game:pause': void;
    'game:resume': void;
    'intent:pause': void;
    'intent:resume': void;
    'intent:set-speed': { multiplier: number };
    'intent:acquire-trait': { traitId: string };
    /** Player chose to try the stage again after failing. */
    'intent:retry': void;
    /** Player picked how their creature feeds. */
    'intent:choose-diet': { diet: 'herbivore' | 'carnivore' };
    'intent:management-action': { actionId: string; rivalId?: string };
    /** Focus the map on where a decision is taken ('home' / 'site:<id>'). */
    'intent:locate': { anchor: string };
    'intent:event-choice': { index: number };
    /** The player has read the outcome; unfreeze the stage. */
    'intent:event-dismiss': void;
    /** Strategic-map zoom step from the HUD (+1 in, -1 out). */
    'intent:zoom': { delta: number };
    /** The player closed the contextual bar — the scene should clear selection. */
    'intent:deselect': void;
    /** Dev toolbar (local env only): playtesting accelerators. */
    'intent:dev-grant': void;
    'intent:dev-complete': void;
    'intent:dev-die': void;
}

type Handler<T> = (payload: T) => void;
type AnyHandler = (payload: never) => void;

export class EventBus {
    private handlers = new Map<keyof GameEventMap, Set<AnyHandler>>();

    on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }
        set.add(handler as AnyHandler);
        return () => this.off(event, handler);
    }

    off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
        this.handlers.get(event)?.delete(handler as AnyHandler);
    }

    emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
        this.handlers.get(event)?.forEach((h) => (h as Handler<GameEventMap[K]>)(payload));
    }
}
