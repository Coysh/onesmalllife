import Phaser from 'phaser';
import { COLORS, RIVAL_NAMES, STRAT_START_ZOOM, STRAT_ZOOM_MIN, STRAT_ZOOM_MAX } from '../config';
import { Rng } from '../lib/rng';
import { Villager } from '../entities/Villager';
import { ambientParticles, applyCameraFx } from '../lib/atmosphere';
import { setupWorld } from '../lib/worldCamera';
import { textResolution } from '../lib/displayResolution';
import { Minimap, type MinimapEntry } from '../ui/Minimap';
import { StrategicMap } from './strategic/StrategicMap';
import { EventTheatre } from './strategic/EventTheatre';
import { unitTexture } from '../data/sprites/unitSprites';
import { makeTexture } from '../lib/spriteFactory';
import stagesData from '../data/stages.json';
import {
    initManagement,
    tickManagement,
    takeAction,
    canTakeAction,
    applyEventEffects,
    applyScout,
    applyColonise,
    colonyBySite,
    colonyActions,
    canTakeColonyAction,
    applyColonyAction,
    addRival,
    isRevealed,
    revealAt,
    emergeRivals,
    objectiveProgress,
    isManagementComplete,
    tickRivals,
    tickColonies,
    rivalRaid,
    rivalMilestones,
    rivalRaceProgress,
    rivalById,
    factionStance,
    factionActions,
    canTakeFactionAction,
    applyFactionAction,
    actionsForAnchor,
    actionAnchor,
    actionCost,
    actionAvailability,
    timesTaken,
    saveManagement,
    councilActions,
    ecologyStalled,
    currentEra,
    type StageDef,
    type StageAction,
    type StageEvent,
    type ManagementState,
    type RivalState,
    type StageSite,
    type SavedManagement,
    type Colony,
} from '../systems/managementState';
import { nextStageId } from '../lib/stages';
import type { EventBus, ManagementActionView, PauseSource } from '../bootstrap/events';

type Selection = { kind: 'home' | 'site' | 'rival' | 'colony'; id: string };

/** A glyph representing each event kind, for the modal + a floating map badge. */
const EVENT_ICONS: Record<string, string> = {
    drought: '☀️', migration: '🦬', omen: '☄️', arrival: '👣', weather: '🌤️',
    plague: '☣️', harvest: '🌾', construction: '🏗️', bloom: '🌸', storm: '⛈️',
    strike: '✊', secession: '🚩', signal: '📡', discovery: '🛸', flare: '☀️',
    launch: '🚀', anomaly: '❖', raid: '⚔️', festival: '🎆', eclipse: '🌑',
    colony: '🪐', uprising: '🔥', sanctions: '⛔',
};

/**
 * Flight tuning. Zoom sits outside the strategic clamp (0.55–1.9) because
 * piloting wants a closer, faster-reading view than the chart does.
 */
const FLIGHT_ZOOM = 1.15;
const FLIGHT_SPEED = 700; // world px/s at full thrust
const FLIGHT_ACCEL_LERP = 3.2;
const FLIGHT_DRAG_LERP = 0.9; // released controls coast a long way
const FLIGHT_BURN_PER_SEC = 1.6; // alloy spent while under power
const ARRIVAL_RADIUS = 200; // world px within which you have "made orbit"
/** How far the view pulls back between a standstill and full speed. */
const FLIGHT_ZOOM_SPREAD = 0.28;
const TURN_RATE = 6; // radians/s the hull swings toward its heading
const DUST_COUNT = 140;
const DUST_FIELD = 2600; // world px square the dust is recycled within

/** Why a system is worth the journey, in words. */
const SYSTEM_FEATURE_LABEL: Record<string, string> = {
    natives: 'something lives here',
    anomaly: 'an anomaly reads on the instruments',
    hazard: 'hazardous',
    derelict: 'something was here before you',
};

function eventIcon(kind: string | undefined): string {
    return (kind && EVENT_ICONS[kind]) || '❖';
}

const STAGES = stagesData.stages as unknown as Record<string, StageDef>;

export interface ManagementSceneData {
    bus: EventBus;
    seed: string;
    species: string;
    stageId: string; // tribe | civilisation | planetary | space
    resources?: Record<string, number>;
    /** Restored per-stage state: map charted, colonies, powers met. */
    stageState?: SavedManagement;
    traits?: string[];
    freePlay?: boolean; // completed lineage: keep managing without re-completing
}

/**
 * The strategic stages (Tribe → Space). One scene drives all four from data
 * (data/stages.json, grammar v2) via the pure managementState engine, over a
 * scrolling world map (StrategicMap) where events physically play out
 * (EventTheatre): raiders march, caravans arrive, weather turns. Multiple
 * rivals live on the map — some hidden in fog until scouted. CityScene
 * subclasses this for Civilisation's building placement; the protected hooks
 * below are its extension points.
 */
export class ManagementScene extends Phaser.Scene {
    protected bus!: EventBus;
    protected seed = 'default';
    protected species = 'Your lineage';
    protected stageId = 'tribe';
    private seedResources?: Record<string, number>;
    private savedStageState?: SavedManagement;
    private freePlay = false;

    protected def!: StageDef;
    protected state!: ManagementState;
    protected rng!: Rng;
    protected map!: StrategicMap;
    protected theatre!: EventTheatre;
    private minimap!: Minimap;
    private speedMultiplier = 1;
    protected pauseSources = new Set<PauseSource>();
    private ended = false;
    private accumulator = 0;
    private minimapAccumulator = 0;
    private eventClock = 0;
    private raidClock = 0;
    protected villagers: Villager[] = [];
    protected buildings: Phaser.GameObjects.Container[] = [];
    private rivalMarkers = new Map<string, Phaser.GameObjects.Container>();
    private tradeRoutes = new Map<string, { line: Phaser.GameObjects.Graphics; unit: Phaser.GameObjects.Image }>();
    private markedSites = new Set<string>();
    /** The currently-selected map object whose actions fill the bottom bar. */
    protected selected: Selection | null = null;
    private selectionRing?: Phaser.GameObjects.Arc;
    private selectionRingBaseX = 0;
    /** Planet stage: the map wraps east–west; the camera loops and objects follow. */
    private wrapsHorizontally = false;
    private wrapTargets: { obj: { x: number }; baseX: number }[] = [];
    private homeWorld?: Phaser.GameObjects.Container;
    /** Space stage two-phase: true while zoomed in on the homeworld, before launch. */
    private spaceInOrbit = false;
    private siteHits: { obj: { x: number }; baseX: number }[] = [];
    protected pendingEvent: StageEvent | null = null;
    private theatreBusy = false;
    private elapsedSec = 0;
    private dragStart: { x: number; y: number; sx: number; sy: number } | null = null;
    private dragMoved = 0;
    /** True only between a pointerdown on the map canvas and its pointerup. */
    private pointerDownOnMap = false;
    /** CityScene turns panning off while the player is placing a building. */
    protected panEnabled = true;
    /**
     * Event/raid cadence. Defaults are deliberately sparse — these are scaled
     * by the speed multiplier, so at 4× a 24s interval fired every 6 real
     * seconds and events dominated the stage. Stages may override in
     * stages.json via eventIntervalSeconds / raidIntervalSeconds.
     */
    private eventIntervalMs = 48000;
    private raidIntervalMs = 34000;
    /** Ids fired recently, newest first — used to avoid repeats. */
    private recentEventIds: string[] = [];

    // ---- Flight mode (space) ------------------------------------------------
    /**
     * Piloting is a distinct mode, not an overlay on the strategy controls:
     * while flying, drag-to-pan and click-to-select are off, the camera follows
     * the ship, and zoom leaves the strategic clamp. The simulation keeps
     * running underneath, which is what makes distance cost something.
     */
    private flying = false;
    private ship?: Phaser.GameObjects.Image;
    private shipVel = { x: 0, y: 0 };
    private flightKeys?: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;
    private escKey?: Phaser.Input.Keyboard.Key;
    /** Systems already arrived at this flight, so arrival fires once each. */
    private visitedThisFlight = new Set<string>();
    /** The system whose encounter is currently open, if any. */
    private encounterSite: StageSite | null = null;
    /**
     * Near-field dust recycled around the ship. The starfield is fixed in world
     * space and reads as static at speed; these stream past the hull and are
     * what actually sells motion.
     */
    private flightDust: Phaser.GameObjects.Arc[] = [];
    private thrustPlume?: Phaser.GameObjects.Graphics;
    /** Smoothed heading, so the ship banks into a turn instead of snapping. */
    private shipHeading = 0;

    constructor(key = 'Management') {
        super(key);
    }

    init(data: ManagementSceneData): void {
        this.bus = data.bus;
        this.seed = data.seed ?? this.seed;
        this.species = data.species ?? this.species;
        this.stageId = data.stageId ?? this.stageId;
        this.seedResources = data.resources;
        this.savedStageState = data.stageState;
        this.freePlay = data.freePlay ?? false;
    }

    create(): void {
        this.def = STAGES[this.stageId] ?? STAGES.tribe;
        this.rng = new Rng(`${this.seed}:${this.stageId}:events`);
        const fallbackRival = this.rng.pick(RIVAL_NAMES);
        this.state = initManagement(this.def, this.seedResources, fallbackRival, this.savedStageState);
        this.eventClock = 0;
        this.raidClock = 0;
        this.minimapAccumulator = 0;
        this.pendingEvent = null;
        this.recentEventIds = [];
        this.ended = false;
        if (this.def.eventIntervalSeconds) this.eventIntervalMs = this.def.eventIntervalSeconds * 1000;
        if (this.def.raidIntervalSeconds) this.raidIntervalMs = this.def.raidIntervalSeconds * 1000;

        this.map = new StrategicMap(this, this.def, this.seed);
        this.theatre = new EventTheatre(this, this.map.width, this.map.height);
        this.map.build(this.state);
        this.buildLivingScene();

        ambientParticles(this, { width: this.map.width, height: this.map.height, color: COLORS.brandHi, rise: false, depth: 30, frequency: 300, scale: [0.04, 0.12], alpha: 0.22 });
        // Light bloom: at 0.5 it lifted the whole frame's blacks and flattened
        // the contrast the city relies on to stand out from the terrain.
        applyCameraFx(this.cameras.main, 0.22, 0.42);

        // Camera: free pan (drag) within a large map, starting zoomed in over
        // home so the world feels vast and opens up as you scout.
        const cam = setupWorld(this, { width: this.map.width, height: this.map.height });
        // The planet reads best a little zoomed out; space begins in tight orbit
        // of the homeworld and pulls back to the starmap on the first probe;
        // the others start close so the world feels vast up front.
        const style0 = this.def.map?.style;
        this.spaceInOrbit = style0 === 'starmap';
        cam.setZoom(style0 === 'planet' ? 0.8 : this.spaceInOrbit ? 3.4 : STRAT_START_ZOOM);
        cam.centerOn(this.map.home.x, this.map.home.y);
        this.applyCameraSafeArea();
        this.scale.on('resize', () => this.applyCameraSafeArea());

        // The planet wraps east–west: drop the horizontal camera bound (we clamp
        // Y and wrap X manually) and register the objects that follow the loop.
        this.wrapsHorizontally = this.def.map?.style === 'planet';
        if (this.wrapsHorizontally) {
            cam.removeBounds();
            this.registerWrapTargets();
        }
        this.minimap = new Minimap(this, { width: this.map.width, height: this.map.height }, {
            anchorY: 96,
            // Click or drag the minimap to jump the camera across the map.
            onSeek: (worldX, worldY) => {
                cam.centerOn(worldX, worldY);
                this.applyWrap();
            },
        });
        this.updateMinimap(); // paint once immediately; update() throttles it thereafter
        // pointerdown fires only for presses on the game canvas (Phaser adds
        // it to the canvas, not the window) — so it marks a real map press.
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            // A press on the minimap belongs to the minimap: don't start a
            // camera drag underneath it, and don't count it as a map click.
            if (this.minimap.pointerOver) {
                this.pointerDownOnMap = false;
                return;
            }
            this.pointerDownOnMap = true;
            if (!this.panEnabled) return;
            this.dragStart = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
            this.dragMoved = 0;
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!this.dragStart || !p.isDown) return;
            this.dragMoved = Math.max(this.dragMoved, Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y));
            cam.setScroll(
                this.dragStart.sx - (p.x - this.dragStart.x) / cam.zoom,
                this.dragStart.sy - (p.y - this.dragStart.y) / cam.zoom,
            );
            this.applyWrap(); // loop the planet as you drag past the edge
        });

        // A world-spanning backdrop hit area: clicking empty map deselects.
        // topOnly input means any object above it wins, so real targets select.
        // Gate on pointerDownOnMap so a stray window-level pointerup from a DOM
        // HUD click (Phaser listens on the window for up) can't deselect.
        const bg = this.add.rectangle(this.map.width / 2, this.map.height / 2, this.map.width, this.map.height, 0x000000, 0.001).setDepth(-10);
        bg.setInteractive();
        bg.on('pointerup', () => {
            if (this.isMapClick()) this.deselect();
        });

        // Reset the press flag after every up (fires last, on the window).
        this.input.on('pointerup', () => {
            this.dragStart = null;
            this.pointerDownOnMap = false;
        });
        this.selectionRing = this.add.circle(0, 0, 30).setStrokeStyle(2, COLORS.brandHi, 0.9).setDepth(9).setVisible(false);

        // Zoom: mouse wheel + HUD buttons, clamped so the map never tears.
        this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
            this.applyZoom(dy > 0 ? -1 : 1);
        });
        this.bus.on('intent:zoom', ({ delta }) => this.applyZoom(delta));

        this.bus.on('intent:pause', () => this.setPauseSource('manual', true));
        this.bus.on('intent:resume', () => this.setPauseSource('manual', false));
        this.bus.on('intent:pause-change', ({ source, paused }) => this.setPauseSource(source, paused));
        this.bus.on('intent:set-speed', ({ multiplier }) => (this.speedMultiplier = multiplier));
        this.bus.on('intent:management-action', ({ actionId, rivalId, siteId }) => this.doAction(actionId, rivalId, siteId));
        this.bus.on('intent:deselect', () => this.deselect());
        this.bus.on('intent:locate', ({ anchor }) => this.locate(anchor));
        this.bus.on('intent:event-choice', ({ index }) => this.resolveEvent(index));
        this.bus.on('intent:event-dismiss', () => {
            this.pendingEvent = null;
        });

        // Dev toolbar accelerators (buttons only exist in the local env).
        this.bus.on('intent:dev-grant', () => {
            for (const r of this.def.resources) {
                if (r.id === this.def.objective.resource) continue;
                this.state = applyEventEffects(this.state, { [r.id]: 100 });
            }
            this.emitManagement();
        });
        this.bus.on('intent:dev-complete', () => {
            const objId = this.def.objective.resource;
            const current = this.state.resources[objId]?.value ?? 0;
            this.state = applyEventEffects(this.state, { [objId]: this.def.objective.target - current });
            this.emitManagement();
            // A stage that ends on demand would otherwise sit there waiting.
            if (this.def.mechanics?.endOnDemand && !this.freePlay) this.completeStage();
        });

        this.time.addEvent({ delay: 15000, loop: true, callback: () => this.emitSnapshot() });

        // First-time explanation of how this stage plays (dismissed state is
        // remembered client-side by the OnboardingController).
        if (this.def.onboarding?.length) {
            this.bus.emit('onboarding:show', { stageId: this.stageId, steps: this.def.onboarding });
        }

        this.emitHud();
        this.emitManagement();
        this.emitSnapshot();
    }

    /** Spawn the settlement's people, buildings for prior decisions, rival camps. */
    protected buildLivingScene(): void {
        const rng = new Rng(`${this.seed}:${this.stageId}:pop`);
        const home = this.map.home;
        const style = this.def.map?.style;

        const labelStyle = { fontFamily: 'monospace', fontSize: '13px', color: '#8fa8a4' } as const;
        this.add.text(home.x, home.y - 130, `${this.species}`, labelStyle).setResolution(textResolution()).setOrigin(0.5).setDepth(7);

        if (style === 'starmap') {
            // Space is a two-phase stage: you begin in close orbit of your
            // homeworld (a full planet), then pull back to the starmap.
            this.buildSpaceHome(home.x, home.y);
        } else if (style === 'planet') {
            // Planetary: the map IS the planet, so home is your capital city on
            // the globe — a bright marker, not a floating world.
            this.buildCapital(home.x, home.y);
        } else {
            // A hearth at the settlement centre + people who wander it.
            this.add.circle(home.x, home.y, 10, COLORS.brand, 0.9).setDepth(5);
            this.add.circle(home.x, home.y, 5, COLORS.secondary, 1).setDepth(6);
            for (let i = 0; i < 5; i++) {
                this.villagers.push(new Villager(this, rng, home.x, home.y, 100, COLORS.brandHi));
            }
        }

        // A building for each decision already taken (restored campaigns).
        this.state.taken.forEach((id) => {
            const action = this.def.actions.find((a) => a.id === id);
            if (action && !action.special) this.onActionBuilt(action.id);
        });

        // Rival markers: a campfire on land, a hostile world in space/planet.
        for (const rival of this.state.rivals) this.buildRivalMarker(rival);

        // Clicking the hearth selects your settlement (its build actions) — but
        // only when the stage anchors any there, on the same rule as sites
        // below. Without this a stage with no 'home' actions answers a click on
        // your own capital with an empty bar.
        if (actionsForAnchor(this.def, 'home').length > 0) {
            const hearthHit = this.add.circle(home.x, home.y, 40, 0xffffff, 0.001).setDepth(5);
            hearthHit.setInteractive({ useHandCursor: true });
            hearthHit.on('pointerup', () => {
                if (this.isMapClick()) this.selectHome();
            });
        }

        // Sites with anchored actions are click targets (their actions fill
        // the bar). Flavour-only sites stay non-interactive markers so a click
        // never opens an empty bar — except on the starmap, where the systems
        // ARE the content: every one can be surveyed, settled or managed.
        const starmap = this.def.map?.style === 'starmap';
        for (const site of this.def.map?.sites ?? []) {
            if (!starmap && actionsForAnchor(this.def, `site:${site.id}`).length === 0) continue;
            const pos = this.map.at(site.x, site.y);
            const hit = this.add.circle(pos.x, pos.y, 26, 0xffffff, 0.001).setDepth(4);
            hit.setInteractive({ useHandCursor: true });
            hit.on('pointerup', () => {
                if (this.isMapClick()) this.selectSite(site.id);
            });
            this.siteHits.push({ obj: hit, baseX: pos.x });
        }
    }

    /** A rival's map presence. Also used for powers met during play. */
    protected buildRivalMarker(rival: RivalState): void {
        const style = this.def.map?.style;
        const pos = this.map.at(rival.x, rival.y);
        const name = this.add.text(0, -34, rival.name, { fontFamily: 'monospace', fontSize: '13px', color: '#f2795f' }).setResolution(textResolution()).setOrigin(0.5);
        const parts: Phaser.GameObjects.GameObject[] = [];
        if (style === 'starmap' || style === 'planet') {
            parts.push(this.add.circle(0, 0, 20, COLORS.danger, 0.1)); // hostile glow
            parts.push(this.add.circle(0, 0, 12, COLORS.predatorBody));
            parts.push(this.add.circle(-3, -3, 4, COLORS.danger, 0.8)); // lit limb
        } else {
            parts.push(this.add.circle(0, 0, 12, COLORS.predatorBody)); // camp
            parts.push(this.add.circle(0, 2, 5, COLORS.danger, 0.9)); // fire
            parts.push(this.add.triangle(0, -14, 0, 0, 10, 0, 5, -12, COLORS.danger)); // banner
        }
        const marker = this.add.container(pos.x, pos.y, [...parts, name]).setDepth(6);
        marker.setVisible(rival.discovered);
        // Clicking a camp selects it — its diplomacy fills the bottom bar.
        marker.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
        marker.on('pointerup', () => {
            if (this.isMapClick()) this.selectRival(rival.id);
        });
        this.rivalMarkers.set(rival.id, marker);
    }

    /**
     * True only for a genuine tap on the map: the press started on the canvas
     * (pointerDownOnMap) and barely moved. This rejects the stray window-level
     * pointerup Phaser receives when the player clicks a DOM HUD element over
     * the canvas — which would otherwise select/deselect behind the overlay.
     */
    private isMapClick(): boolean {
        // Flight turns off panning, but selecting must keep working — otherwise
        // nothing on the map can be clicked while you have the helm, which is
        // exactly when you most want to inspect what you have just found.
        return this.pointerDownOnMap && this.dragMoved < 8 && (this.panEnabled || this.flying);
    }

    // ---- Selection (contextual bottom bar) ----------------------------------

    private actionViewOf(a: StageAction, withLocation = false): ManagementActionView {
        const anchor = actionAnchor(a);
        const located = withLocation && anchor !== 'council';
        // Repeatable actions price the *next* copy and show how many you have;
        // they only read as "done" once their cap is reached.
        const times = timesTaken(this.state, a.id);
        const cost = actionCost(a, times);
        const maxed = a.maxRepeat !== undefined && times >= a.maxRepeat;

        // An action gated by a prerequisite must say so. Showing an affordable
        // cost on a disabled button reads as a broken button, not a locked one.
        const unmet = a.requires.filter((r) => !this.state.taken.includes(r));
        const locked = unmet.length > 0;
        const availability = actionAvailability(this.state, this.def, a.id);
        const unmetLabels = unmet.map((r) => this.def.actions.find((x) => x.id === r)?.label ?? r);

        // Ending the stage waits on the objective, not on a prerequisite chain.
        if (a.special === 'finish') {
            const ready = isManagementComplete(this.state, this.def);
            return {
                id: a.id,
                label: a.label,
                description: ready
                    ? a.description
                    : `Not yet. ${this.def.objective.label} first.`,
                costLabel: ready ? 'End the story' : 'Not yet',
                affordable: ready,
                taken: false,
                ...(located ? { locate: anchor, locationLabel: this.anchorLabel(anchor) } : {}),
            };
        }

        return {
            id: a.id,
            label: !a.once && times > 0 ? `${a.label} ×${times}` : a.label,
            description: availability.message ?? (locked ? `Requires ${unmetLabels.join(', ')}.` : a.description),
            costLabel: availability.message ?? Object.entries(cost).map(([res, n]) => `${n} ${this.def.resources.find((resource) => resource.id === res)?.label ?? res}`).join(' · ') || 'free',
            affordable: availability.allowed,
            taken: (a.once && times > 0) || maxed,
            ...(located ? { locate: anchor, locationLabel: this.anchorLabel(anchor) } : {}),
        };
    }

    /**
     * Travel to where a decision is taken and select it there, so the panel can
     * advertise every action without letting the player act at a distance.
     */
    private locate(anchor: string): void {
        if (this.ended) return;
        if (anchor === 'home') {
            this.focusMapPoint(this.map.home.x, this.map.home.y, 420);
            this.selectHome();
            return;
        }
        const siteId = anchor.startsWith('site:') ? anchor.slice(5) : '';
        const site = this.def.map?.sites.find((s) => s.id === siteId);
        if (!site) return;
        const pos = this.map.at(site.x, site.y);
        this.focusMapPoint(pos.x, pos.y, 420);
        this.selectSite(site.id);
    }

    protected focusMapPoint(x: number, y: number, duration = 420): void {
        this.cameras.main.pan(x, y, duration, 'Sine.easeInOut');
    }

    private applyCameraSafeArea(): void {
        const sidebar = document.querySelector<HTMLElement>('[data-management-sidebar]');
        const rect = this.game.canvas?.getBoundingClientRect();
        if (!sidebar || !rect || rect.width <= 0 || window.innerWidth < 640) return;
        const visibleWidth = this.scale.width * Math.max(0.35, 1 - sidebar.getBoundingClientRect().width / rect.width);
        this.cameras.main.setViewport(0, 0, visibleWidth, this.scale.height);
    }

    /** Where an anchored decision is taken, in words. */
    private anchorLabel(anchor: string): string {
        if (anchor === 'home') return 'at your settlement';
        const site = this.def.map?.sites.find((s) => `site:${s.id}` === anchor);
        return site ? `at ${site.label}` : 'on the map';
    }

    private factionActionViews(rivalId: string): ManagementActionView[] {
        return factionActions(this.def).map((a) => ({
            id: a.id,
            label: a.label,
            description: a.description,
            costLabel: `${a.cost} ${a.costResource}`,
            affordable: canTakeFactionAction(this.state, this.def, a.id, rivalId),
            taken: false,
        }));
    }

    private selectHome(): void {
        this.selected = { kind: 'home', id: 'home' };
        this.focusMapPoint(this.map.home.x, this.map.home.y, 400);
        this.emitSelection();
    }

    private selectSite(siteId: string): void {
        const site = this.def.map?.sites.find((s) => s.id === siteId);
        if (!site) return;
        const pos = this.map.at(site.x, site.y);
        if (this.map.isFogged(this.state, pos.x, pos.y)) return; // can't act on the unknown
        // A settled system is a colony first: it answers with its own actions.
        this.selected = colonyBySite(this.state, siteId)
            ? { kind: 'colony', id: siteId }
            : { kind: 'site', id: siteId };
        this.emitSelection();
    }

    private selectRival(rivalId: string): void {
        const rival = rivalById(this.state, rivalId);
        if (!rival || !rival.discovered) return;
        this.selected = { kind: 'rival', id: rivalId };
        this.emitSelection();
    }

    protected deselect(): void {
        if (!this.selected) return;
        this.selected = null;
        this.selectionRing?.setVisible(false);
        this.bus.emit('management:deselect', undefined);
    }

    /** What this system is, in words — world type, feature, or who holds it. */
    private siteSublabel(site: StageSite): string | null {
        if (site.resource) return `Rich in ${site.resource}`;
        if (this.state.rivalClaims.includes(site.id)) return 'Held by another power';
        const native = this.nativePowerAt(site.id);
        if (native) return `Home of ${native.name} — select them to deal with them`;
        const world = site.world;
        if (!world) return null;
        const feature = world.feature ? ` · ${SYSTEM_FEATURE_LABEL[world.feature]}` : '';
        return `${world.type} world${feature}`;
    }

    /**
     * Actions offered at an unsettled system. Settling is done *here*, at the
     * system itself, rather than from an abstract Council button.
     */
    /** A power met in play that lives at this system, if any. */
    private nativePowerAt(siteId: string): RivalState | undefined {
        return this.state.rivals.find((r) => r.id === `native:${siteId}` && r.present && !r.defeated);
    }

    private systemActionViews(site: StageSite): ManagementActionView[] {
        if (site.kind !== 'colony_target') return [];
        if (colonyBySite(this.state, site.id)) return []; // already ours
        if (this.state.rivalClaims.includes(site.id)) return [];
        // Somebody already lives here. Their world is not yours to settle —
        // deal with them instead, on their marker.
        if (this.nativePowerAt(site.id)) return [];

        const settle = this.def.actions.find((a) => a.special === 'colonise');
        if (!settle) return [];

        const cost = actionCost(settle, timesTaken(this.state, settle.id));
        // Gate on the real action — it carries prerequisites (shipyards) as
        // well as cost, and a button that looks affordable but does nothing is
        // worse than one that is plainly disabled.
        const unmet = settle.requires.filter((r) => !this.state.taken.includes(r));
        const blocked = unmet.length > 0;

        return [{
            id: `settle:${site.id}`,
            label: 'Found a colony here',
            description: blocked
                ? `Requires ${unmet.map((r) => this.def.actions.find((a) => a.id === r)?.label ?? r).join(', ')}.`
                : settle.description,
            costLabel: blocked
                ? 'Locked'
                : Object.entries(cost).map(([res, n]) => `${n} ${res}`).join(' · ') || 'free',
            affordable: canTakeAction(this.state, this.def, settle.id) && isRevealed(this.state, site.x, site.y),
            taken: false,
        }];
    }

    private colonyActionViews(colony: Colony): ManagementActionView[] {
        return colonyActions(colony).map((a) => ({
            id: a.id,
            label: a.label,
            description: a.description,
            costLabel: `${a.cost} ${a.costResource}`,
            affordable: canTakeColonyAction(this.state, a.id, colony.siteId),
            taken: false,
        }));
    }

    /** Build + emit the selection payload for the bottom bar; move the ring. */
    protected emitSelection(): void {
        const sel = this.selected;
        if (!sel) return;
        let label = '';
        let sublabel: string | null = null;
        let actions: ManagementActionView[] = [];
        let rx = this.map.home.x;
        let ry = this.map.home.y;
        let ringR = 42;

        if (sel.kind === 'home') {
            label = 'Your settlement';
            sublabel = 'The heart of your people';
            actions = actionsForAnchor(this.def, 'home').map((a) => this.actionViewOf(a));
        } else if (sel.kind === 'site') {
            const site = this.def.map?.sites.find((s) => s.id === sel.id);
            if (!site) return this.deselect();
            const pos = this.map.at(site.x, site.y);
            rx = pos.x; ry = pos.y; ringR = 26;
            label = site.label;
            sublabel = this.siteSublabel(site);
            actions = [
                ...actionsForAnchor(this.def, `site:${sel.id}`).map((a) => this.actionViewOf(a)),
                ...this.systemActionViews(site),
            ];
        } else if (sel.kind === 'colony') {
            const colony = colonyBySite(this.state, sel.id);
            if (!colony) return this.deselect();
            const site = this.def.map?.sites.find((s) => s.id === sel.id);
            const pos = site ? this.map.at(site.x, site.y) : { x: rx, y: ry };
            rx = pos.x; ry = pos.y; ringR = 26;
            label = colony.name;
            sublabel = `${colony.worldType} · ${Math.floor(colony.population)}/${colony.capacity} people`
                + (colony.specialisation ? ` · ${colony.specialisation}` : '');
            actions = this.colonyActionViews(colony);
        } else {
            const rival = rivalById(this.state, sel.id);
            if (!rival || !rival.discovered) return this.deselect();
            const pos = this.map.at(rival.x, rival.y);
            rx = pos.x; ry = pos.y; ringR = 30;
            label = rival.name;
            sublabel = `${factionStance(rival.relationship)} · ${rival.archetype}`;
            actions = this.factionActionViews(sel.id);
        }

        this.selectionRing?.setPosition(rx, ry).setRadius(ringR).setVisible(true);
        this.selectionRingBaseX = rx; // wrap follows this on the planet stage
        this.bus.emit('management:select', { kind: sel.kind, id: sel.id, label, sublabel, actions });
    }

    /** Your homeworld: a full planet (ocean, continents, clouds) with orbiters. */
    private buildSpaceHome(x: number, y: number): void {
        const r = 150;
        const key = `osl-homeworld-${this.seed}`;
        const rng = new Rng(`${this.seed}:homeworld`);
        makeTexture(this, key, (r + 12) * 2, (r + 12) * 2, (g, w, h) => {
            const cx = w / 2;
            const cy = h / 2;
            g.fillStyle(0x8fbfe0, 0.16); g.fillCircle(cx, cy, r + 8); // atmosphere
            g.fillStyle(0x1d5a7a, 1); g.fillCircle(cx, cy, r); // ocean
            for (let i = 0; i < 7; i++) { // continents (kept inside the disc)
                const a = rng.next() * Math.PI * 2;
                const d = rng.next() * r * 0.5;
                const br = r * (0.18 + rng.next() * 0.2);
                g.fillStyle(0x4f7d45, 1); g.fillCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, br);
                g.fillStyle(0x5f8d50, 0.6); g.fillCircle(cx + Math.cos(a) * d - br * 0.2, cy + Math.sin(a) * d - br * 0.25, br * 0.6);
            }
            for (let i = 0; i < 5; i++) { // clouds
                const a = rng.next() * Math.PI * 2;
                const d = rng.next() * r * 0.68;
                g.fillStyle(0xffffff, 0.12); g.fillEllipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.42, r * 0.16);
            }
            g.fillStyle(0xffffff, 0.1); g.fillCircle(cx - r * 0.32, cy - r * 0.32, r * 0.5); // lit limb
        });
        this.add.image(x, y, key).setDepth(5);
        // Orbiting stations sweep around the world.
        for (let i = 0; i < 3; i++) {
            const orbit = this.add.container(x, y, [this.add.image(r + 22 + i * 20, 0, unitTexture(this, 'ship'))]).setDepth(6);
            orbit.rotation = (i / 3) * Math.PI * 2;
            this.tweens.add({ targets: orbit, rotation: orbit.rotation + Math.PI * 2, duration: 9000 + i * 4000, repeat: -1, ease: 'Linear' });
        }
    }

    /** Your capital city on the planet: a bright marker with a gentle pulse. */
    private buildCapital(x: number, y: number): void {
        const halo = this.add.circle(0, 0, 15, COLORS.brandHi, 0.16);
        const dot = this.add.circle(0, 0, 7, COLORS.brand);
        const core = this.add.circle(0, 0, 3.5, 0xffffff, 0.9);
        const ring = this.add.circle(0, 0, 11, 0x000000, 0).setStrokeStyle(2, COLORS.brandHi, 0.8);
        this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 1900, repeat: -1, ease: 'Sine.easeOut' });
        this.homeWorld = this.add.container(x, y, [halo, dot, core, ring]).setDepth(7);
    }

    /** Objects that follow the horizontal wrap on the planet stage. */
    private registerWrapTargets(): void {
        this.wrapTargets = [];
        if (this.homeWorld) this.wrapTargets.push({ obj: this.homeWorld, baseX: this.map.home.x });
        for (const rival of this.state.rivals) {
            const marker = this.rivalMarkers.get(rival.id);
            if (marker) this.wrapTargets.push({ obj: marker, baseX: this.map.at(rival.x, rival.y).x });
        }
        for (const m of this.map.wrapMarkers()) this.wrapTargets.push(m);
        for (const h of this.siteHits) this.wrapTargets.push(h);
        this.applyWrap();
    }

    /** Loop the camera east–west; move wrapped objects into the nearest tile. */
    private applyWrap(): void {
        if (!this.wrapsHorizontally) return;
        const cam = this.cameras.main;
        const W = this.map.width;
        const viewH = cam.height / cam.zoom;
        cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, this.map.height - viewH));
        cam.scrollX = Phaser.Math.Wrap(cam.scrollX, 0, W);
        const camMid = cam.scrollX + (cam.width / cam.zoom) / 2;
        const nearest = (baseX: number): number => baseX + W * Math.round((camMid - baseX) / W);
        for (const t of this.wrapTargets) t.obj.x = nearest(t.baseX);
        if (this.selected && this.selectionRing?.visible) this.selectionRing.x = nearest(this.selectionRingBaseX);
    }

    /** Step the strategic-map zoom (wheel or HUD buttons). */
    private applyZoom(delta: number): void {
        if (this.spaceInOrbit) return; // locked in orbit until you launch
        if (this.flying) return; // flight owns the zoom while you have the helm
        const cam = this.cameras.main;
        const next = Phaser.Math.Clamp(cam.zoom + delta * 0.18, STRAT_ZOOM_MIN, STRAT_ZOOM_MAX);
        this.tweens.add({ targets: cam, zoom: next, duration: 180, ease: 'Sine.easeOut' });
    }

    /** Space: the first probe breaks orbit — the camera pulls back to the stars. */
    private leaveOrbit(): void {
        if (!this.spaceInOrbit) return;
        this.spaceInOrbit = false;
        this.bus.emit('sfx', { name: 'evolve' });
        this.cameras.main.flash(400, 80, 120, 140);
        this.tweens.add({ targets: this.cameras.main, zoom: 0.95, duration: 2800, ease: 'Sine.easeInOut' });
    }

    protected addBuilding(): void {
        const home = this.map.home;
        const n = this.buildings.length;
        const rng = new Rng(`${this.seed}:${this.stageId}:build:${n}`);
        const angle = (n / 8) * Math.PI * 2 + (rng.next() - 0.5) * 0.5;
        const ring = 44 + Math.floor(n / 8) * 26 + rng.next() * 10;
        const x = home.x + Math.cos(angle) * ring;
        const y = home.y + Math.sin(angle) * ring;

        const hut = this.add.container(x, y, this.buildingParts(rng)).setDepth(5).setScale(0);
        this.tweens.add({ targets: hut, scale: 0.85 + rng.next() * 0.35, duration: 320, ease: 'Back.easeOut' });
        this.buildings.push(hut);
    }

    /** A varied, stage-themed structure: huts on land, domes on a planet, stations in space. */
    private buildingParts(rng: Rng): Phaser.GameObjects.GameObject[] {
        const style = this.def.map?.style;
        const wall = COLORS.brandDeep;
        const roof = rng.chance(0.5) ? COLORS.secondary : 0xc98f5a;

        if (style === 'starmap') {
            // Orbital station: a hub with solar vanes.
            return [
                this.add.rectangle(0, 0, 5, 5, roof),
                this.add.rectangle(0, 0, 20, 2.5, COLORS.brandHi, 0.85),
                this.add.circle(-10, 0, 2.4, COLORS.secondary),
                this.add.circle(10, 0, 2.4, COLORS.secondary),
                this.add.circle(0, 0, 3, wall),
            ];
        }
        if (style === 'planet') {
            // A habitat dome with an antenna.
            return [
                this.add.ellipse(0, 3, 20, 9, wall),
                this.add.ellipse(0, 1, 16, 12, COLORS.brandHi, 0.5),
                this.add.rectangle(0, -6, 1.5, 8, COLORS.secondary),
                this.add.circle(0, -10, 2, COLORS.secondary),
            ];
        }

        // Land settlements: four hut silhouettes with size jitter.
        const s = 0.85 + rng.next() * 0.5;
        switch (rng.int(0, 4)) {
            case 0: // square hut
                return [
                    this.add.rectangle(0, 0, 16 * s, 14 * s, wall),
                    this.add.triangle(0, -10 * s, -10 * s, 0, 10 * s, 0, 0, -9 * s, roof),
                ];
            case 1: // round hut with a domed thatch
                return [
                    this.add.circle(0, 2, 8 * s, wall),
                    this.add.ellipse(0, -4 * s, 18 * s, 10 * s, roof),
                ];
            case 2: // longhouse
                return [
                    this.add.rectangle(0, 2, 26 * s, 11 * s, wall),
                    this.add.rectangle(0, -5 * s, 28 * s, 6 * s, roof),
                ];
            default: // watchtower
                return [
                    this.add.rectangle(0, 2, 11 * s, 20 * s, wall),
                    this.add.triangle(0, -9 * s, -8 * s, 0, 8 * s, 0, 0, -12 * s, roof),
                ];
        }
    }

    private lungeRival(rivalId: string, intensity: number): void {
        const marker = this.rivalMarkers.get(rivalId);
        if (!marker) return;
        const home = this.map.home;
        const dx = home.x - marker.x;
        const dy = home.y - marker.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.tweens.add({
            targets: marker,
            x: marker.x + (dx / dist) * 180 * intensity,
            y: marker.y + (dy / dist) * 180 * intensity,
            duration: 260,
            yoyo: true,
            ease: 'Cubic.easeInOut',
        });
    }

    protected updateLivingScene(dtSeconds: number): void {
        for (const v of this.villagers) v.update(dtSeconds);

        // Population grows as the stage progresses — settlements only. Space
        // and planet stages seed no wandering people (odd seen from orbit).
        const isStar = this.def.map?.style === 'planet' || this.def.map?.style === 'starmap';
        const home = this.map.home;
        const target = 5 + Math.floor(objectiveProgress(this.state, this.def) * 9);
        if (!isStar && this.villagers.length < target && this.villagers.length < 14) {
            const rng = new Rng(`${this.seed}:${this.stageId}:pop:${this.villagers.length}`);
            this.villagers.push(new Villager(this, rng, home.x, home.y, 100, COLORS.brandHi));
        }

        // Rival camps swell with strength; newly discovered ones appear.
        for (const rival of this.state.rivals) {
            const marker = this.rivalMarkers.get(rival.id);
            if (!marker) continue;
            if (rival.discovered && !marker.visible) {
                marker.setVisible(true).setAlpha(0);
                this.tweens.add({ targets: marker, alpha: 1, duration: 500 });
            }
            marker.setScale(0.7 + (rival.strength / 100) * 0.8);
        }

        this.updateTradeRoutes();

        // Systems claimed since the last frame get marked on the map; your own
        // colonies also get a lane home with a looping courier ship.
        for (const colony of this.state.colonies) {
            if (!this.markedSites.has(colony.siteId)) {
                this.markedSites.add(colony.siteId);
                this.map.markSite(colony.siteId, 'you');
                this.addColonyLane(colony.siteId);
            }
        }
        for (const siteId of this.state.rivalClaims) {
            if (!this.markedSites.has(siteId)) {
                this.markedSites.add(siteId);
                this.map.markSite(siteId, 'rival');
            }
        }

        if (this.def.mechanics?.ecologyPressure) {
            this.map.updateEcology((this.state.resources.ecology?.value ?? 0) / 100);
        }
    }

    /** A permanent lane from home to one of your colonies, with a courier. */
    private addColonyLane(siteId: string): void {
        const site = this.def.map?.sites.find((s) => s.id === siteId);
        if (!site) return;
        const home = this.map.home;
        const pos = this.map.at(site.x, site.y);
        const line = this.add.graphics().setDepth(3);
        line.lineStyle(2, COLORS.brandHi, 0.3);
        this.drawRoute(line, home, pos);
        const unitId = this.def.map?.style === 'starmap' ? 'ship' : 'caravan';
        const unit = this.add.image(home.x, home.y, unitTexture(this, unitId)).setDepth(8);
        this.tweens.add({ targets: unit, x: pos.x, y: pos.y, duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    /** Persistent routes + looping couriers to every friendly/allied rival. */
    private updateTradeRoutes(): void {
        if (!this.def.mechanics?.tradeRoutes) return;
        if (this.wrapsHorizontally) return; // routes across a looping map would tear
        const home = this.map.home;
        for (const rival of this.state.rivals) {
            const stance = factionStance(rival.relationship);
            const open = rival.discovered && (stance === 'friendly' || stance === 'allied');
            const existing = this.tradeRoutes.get(rival.id);
            if (open && !existing) {
                const pos = this.map.at(rival.x, rival.y);
                const line = this.add.graphics().setDepth(3);
                line.lineStyle(2, COLORS.secondary, 0.35);
                this.drawRoute(line, home, pos);
                const unitId = this.def.map?.style === 'starmap' ? 'ship' : 'caravan';
                const unit = this.add.image(home.x, home.y, unitTexture(this, unitId)).setDepth(8);
                this.tweens.add({
                    targets: unit,
                    x: pos.x, y: pos.y,
                    duration: 6000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
                this.tradeRoutes.set(rival.id, { line, unit });
            } else if (!open && existing) {
                existing.line.destroy();
                existing.unit.destroy();
                this.tradeRoutes.delete(rival.id);
            }
        }
    }

    /** A gently-curved dashed route between two points. */
    private drawRoute(g: Phaser.GameObjects.Graphics, a: { x: number; y: number }, b: { x: number; y: number }): void {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2 - 40;
        const curve = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(a.x, a.y),
            new Phaser.Math.Vector2(midX, midY),
            new Phaser.Math.Vector2(b.x, b.y),
        );
        const points = curve.getPoints(24);
        for (let i = 0; i < points.length - 1; i += 2) {
            g.lineBetween(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
        }
    }

    protected doAction(actionId: string, rivalId?: string, siteId?: string): void {
        if (this.ended) return;
        if (actionId.startsWith('fac_')) {
            const target = rivalId ?? this.state.rivals.find((r) => r.discovered)?.id;
            if (!target || !canTakeFactionAction(this.state, this.def, actionId, target)) return;
            this.state = applyFactionAction(this.state, this.def, actionId, target, this.rng.next());
        } else if (actionId.startsWith('settle:')) {
            // Settling a named system: pay the stage's colonise action, but
            // plant the colony exactly where the player chose.
            const target = actionId.slice('settle:'.length);
            const settle = this.def.actions.find((a) => a.special === 'colonise');
            if (!settle || !canTakeAction(this.state, this.def, settle.id)) return;
            this.state = takeAction(this.state, this.def, settle.id);
            this.resolveColonise(target);
            // The system is ours now — re-point the selection at the colony.
            this.selected = { kind: 'colony', id: target };
        } else if (actionId.startsWith('col_')) {
            const target = siteId ?? (this.selected?.kind === 'colony' ? this.selected.id : undefined);
            if (!target || !canTakeColonyAction(this.state, actionId, target)) return;
            this.state = applyColonyAction(this.state, actionId, target);
        } else {
            const action = this.def.actions.find((a) => a.id === actionId);
            if (!action || !canTakeAction(this.state, this.def, actionId)) return;
            // Don't charge for a helm you already hold.
            if (action.special === 'flight' && this.flying) return;
            this.state = takeAction(this.state, this.def, actionId);
            if (action.special === 'finish') {
                this.exitFlight();
                this.completeStage();
                return;
            } else if (action.special === 'flight') {
                this.enterFlight();
            } else if (action.special === 'scout') {
                if (this.spaceInOrbit) this.leaveOrbit(); // first probe breaks orbit
                this.resolveScout();
            } else if (action.special === 'colonise') {
                this.resolveColonise();
            } else {
                this.onActionBuilt(action.id);
            }
        }
        this.bus.emit('sfx', { name: 'click' });
        this.emitManagement();
        if (this.selected) this.emitSelection(); // keep the bar's affordability live
        this.emitSnapshot();
    }

    /** Hook: a non-special action landed — raise something visible. CityScene overrides. */
    protected onActionBuilt(_actionId: string): void {
        this.addBuilding();
    }

    private resolveScout(): void {
        const { state, revealed } = applyScout(this.state, this.def);
        this.state = state;
        this.map.updateFog(this.state);
        if (revealed) {
            const pos = this.map.at(revealed.x, revealed.y);
            // Pan to the discovery and ping it.
            this.focusMapPoint(pos.x, pos.y, 700);
            const ping = this.add.circle(pos.x, pos.y, 12, COLORS.brandHi, 0).setStrokeStyle(2, COLORS.brandHi, 0.9).setDepth(21);
            this.tweens.add({ targets: ping, scale: 3, alpha: 0, duration: 900, onComplete: () => ping.destroy() });
            if (this.def.map?.style === 'starmap') {
                void this.theatre.playLaunch(this.map.home, pos);
            }
        }
    }

    private resolveColonise(siteId?: string): void {
        const { state, site } = applyColonise(this.state, this.def, siteId, this.elapsedSec);
        this.state = state;
        if (site) {
            const pos = this.map.at(site.x, site.y);
            void this.theatre.playLaunch(this.map.home, pos);
        }
    }

    update(_time: number, delta: number): void {
        // A pending event freezes the sim until the player decides.
        if (this.pauseSources.size > 0 || this.ended || this.pendingEvent || this.theatreBusy) return;
        const dt = (delta / 1000) * this.speedMultiplier;
        this.elapsedSec += dt;
        this.state = tickManagement(this.state, dt, this.def);
        this.state = tickRivals(this.state, dt);
        this.state = tickColonies(this.state, dt);

        // Piloting runs on real frame time, not sim-speed: the ship should not
        // fly four times faster because the stage clock is at 4×.
        if (this.flying) this.updateFlight(delta / 1000);

        // New powers rise partway through the stage — announce them loudly.
        const emergence = emergeRivals(this.state, this.elapsedSec);
        if (emergence.emerged.length > 0) {
            this.state = emergence.state;
            for (const rival of emergence.emerged) {
                const pos = this.map.at(rival.x, rival.y);
                this.focusMapPoint(pos.x, pos.y, 800);
                const ping = this.add.circle(pos.x, pos.y, 16, COLORS.danger, 0).setStrokeStyle(3, COLORS.danger, 0.9).setDepth(21);
                this.tweens.add({ targets: ping, scale: 3.4, alpha: 0, duration: 1100, repeat: 1, onComplete: () => ping.destroy() });
            }
            this.bus.emit('sfx', { name: 'event' });
            this.emitManagement();
            const arrival = emergence.emerged[0];
            this.bus.emit('notice:show', {
                title: `A new power rises: ${arrival.name}`,
                description: `${arrival.name} has emerged on your map. They will grow, and they will have their own designs.`,
                icon: '◆',
            });
        }

        this.updateLivingScene(Math.min(0.05, delta / 1000));

        // Rivals racing to their milestones: a surge is a hard setback.
        const milestones = rivalMilestones(this.state, this.def);
        if (milestones.surged.length > 0) {
            this.state = milestones.state;
            this.cameras.main.shake(200, 0.006);
            for (const surge of milestones.surged) this.lungeRival(surge.rival.id, 1);
            // A rival overtaking you is a turning point — surface it rather
            // than leaving it to scroll past in the log.
            const surge = milestones.surged[0];
            const claimed = surge.claimedSiteId
                ? ` They have taken ${this.siteLabel(surge.claimedSiteId)}.`
                : '';
            this.bus.emit('notice:show', {
                title: `${surge.rival.name} surges ahead`,
                description:
                    `${surge.rival.name} has reached a milestone before you, and you have lost ground in ` +
                    `${this.def.objective.label.toLowerCase()}.${claimed}`,
                icon: '▲',
            });
        }

        // A random discovered hostile rival raids on a cadence.
        this.raidClock += dt * 1000;
        if (this.raidClock >= this.raidIntervalMs) {
            this.raidClock = 0;
            const hostiles = this.state.rivals.filter((r) => r.discovered && factionStance(r.relationship) === 'hostile');
            if (hostiles.length > 0) {
                const raider = hostiles[this.rng.int(0, hostiles.length)];
                this.playRaid(raider);
            }
        }

        // Fire a curated event on a cadence (scaled by speed via dt).
        this.eventClock += dt * 1000;
        if (this.eventClock >= this.eventIntervalMs && this.def.events.length > 0) {
            this.eventClock = 0;
            this.raiseEvent();
        }

        // Decorative minimap: redraw ~every 100ms rather than every frame. The
        // camera wrap below stays per-frame — it drives visible object looping.
        this.minimapAccumulator += delta;
        if (this.minimapAccumulator >= 100) {
            this.minimapAccumulator = 0;
            this.updateMinimap();
        }
        this.applyWrap();

        this.accumulator += delta;
        if (this.accumulator >= 120) {
            this.accumulator = 0;
            this.emitManagement();
            if (this.selected) this.emitSelection(); // refresh affordability + ring
            this.emitHud();
        }

        // A stage that ends on demand waits for the player to say so.
        if (!this.freePlay && !this.def.mechanics?.endOnDemand && isManagementComplete(this.state, this.def)) {
            this.completeStage();
        }
    }

    private setPauseSource(source: PauseSource, paused: boolean): void {
        if (paused) this.pauseSources.add(source);
        else this.pauseSources.delete(source);
        this.bus.emit('game:pause-state', { paused: this.pauseSources.size > 0, sources: [...this.pauseSources] });
        if (source === 'manual' && paused) this.emitSnapshot();
    }

    /** Raiders visibly march before the numbers land. */
    private playRaid(raider: RivalState): void {
        this.theatreBusy = true;
        const from = this.map.at(raider.x, raider.y);
        // Land: raiders march. Space/planet: a hostile strike streaks in from
        // orbit (marching warbands make no sense on a globe or starmap).
        const style = this.def.map?.style;
        const approach = style === 'starmap' || style === 'planet'
            ? this.theatre.playLaunch(from, this.map.home)
            : this.theatre.playRaid(from, this.map.home, 3);
        void approach.then(() => {
            const { state, amount } = rivalRaid(this.state, this.def, raider.id);
            this.state = state;
            this.theatreBusy = false;
            if (amount > 0) {
                this.cameras.main.shake(150, 0.006);
                this.cameras.main.flash(220, 90, 20, 20);
                this.emitManagement();
            }
        });
    }

    /** A floating icon that rises and fades above where an event happens. */
    private floatEventIcon(icon: string, pos: { x: number; y: number }): void {
        const label = this.add.text(pos.x, pos.y - 20, icon, { fontSize: '30px' })
            .setResolution(textResolution()).setOrigin(0.5).setDepth(22).setScale(0);
        this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: label, y: pos.y - 70, alpha: 0, duration: 2200, delay: 700, ease: 'Sine.easeIn', onComplete: () => label.destroy() });
    }

    private updateMinimap(): void {
        const entries: MinimapEntry[] = [
            { x: this.map.home.x, y: this.map.home.y, color: COLORS.brandHi, size: 3.5 },
        ];
        for (const site of this.def.map?.sites ?? []) {
            const pos = this.map.at(site.x, site.y);
            if (!this.map.isFogged(this.state, pos.x, pos.y)) {
                entries.push({ x: pos.x, y: pos.y, color: COLORS.food, size: 2 });
            }
        }
        for (const rival of this.state.rivals) {
            if (!rival.discovered) continue;
            const pos = this.map.at(rival.x, rival.y);
            entries.push({ x: pos.x, y: pos.y, color: COLORS.danger, size: 2.6 });
        }
        this.minimap.update(entries);
    }

    /**
     * Pick an event the player hasn't just seen. Uniform random over a pool of
     * seven repeats constantly; preferring unseen ones makes the stage's
     * curated set feel like a set rather than a shuffle.
     */
    private pickEvent(): StageEvent {
        const events = this.def.events;
        const fresh = events.filter((e) => !this.recentEventIds.includes(e.id));
        const event = this.rng.pick(fresh.length > 0 ? fresh : events);
        // Remember roughly half the pool, so repeats need a full cycle first.
        this.recentEventIds = [event.id, ...this.recentEventIds].slice(0, Math.max(1, Math.floor(events.length / 2)));
        return event;
    }

    // ---- Flight mode --------------------------------------------------------

    /** Take the helm: hand the camera and the controls to a ship. */
    private enterFlight(): void {
        if (this.flying || this.def.map?.style !== 'starmap') return;
        this.flying = true;
        this.visitedThisFlight.clear();
        this.deselect();
        this.panEnabled = false; // dragging steers nothing; it would fight the follow
        if (this.spaceInOrbit) this.leaveOrbit();

        const start = this.ship ?? this.add.image(this.map.home.x, this.map.home.y, unitTexture(this, 'ship'));
        this.ship = start.setDepth(9).setVisible(true);
        this.ship.setPosition(this.map.home.x, this.map.home.y);
        this.shipVel = { x: 0, y: 0 };

        const kb = this.input.keyboard;
        if (kb) {
            this.flightKeys ??= {
                up: [kb.addKey('W'), kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP)],
                down: [kb.addKey('S'), kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)],
                left: [kb.addKey('A'), kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)],
                right: [kb.addKey('D'), kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)],
            };
            this.escKey ??= kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        }

        this.buildFlightVisuals();

        const cam = this.cameras.main;
        cam.startFollow(this.ship, true, 0.08, 0.08);
        this.tweens.add({ targets: cam, zoom: FLIGHT_ZOOM, duration: 700, ease: 'Sine.easeInOut' });

        this.bus.emit('sfx', { name: 'evolve' });
        this.bus.emit('notice:show', {
            title: 'You have the helm',
            description: 'Steer with WASD or the arrow keys. Fly to a system to survey it. '
                + 'Every second under power burns alloy — press Esc to return to the chart.',
            icon: '🚀',
        });
    }

    /** One-time dust field + engine plume, reused across flights. */
    private buildFlightVisuals(): void {
        const ship = this.ship!;
        if (this.flightDust.length === 0) {
            for (let i = 0; i < DUST_COUNT; i++) {
                const dot = this.add
                    .circle(0, 0, this.rng.next() < 0.25 ? 2 : 1, 0xbfe8f5, 0.35 + this.rng.next() * 0.4)
                    .setDepth(8);
                // Scatter around the ship to begin with; updateFlightVisuals
                // recycles them from here on.
                dot.x = ship.x + (this.rng.next() - 0.5) * DUST_FIELD;
                dot.y = ship.y + (this.rng.next() - 0.5) * DUST_FIELD;
                this.flightDust.push(dot);
            }
        }
        this.thrustPlume ??= this.add.graphics().setDepth(8);
        for (const d of this.flightDust) d.setVisible(true);
        this.thrustPlume.setVisible(true);
    }

    /**
     * Stream dust past the hull and draw the engine plume. Dust that falls
     * behind is wrapped to the far side, so a small fixed pool covers an
     * unbounded flight.
     */
    private updateFlightVisuals(speed: number, thrusting: boolean): void {
        const ship = this.ship!;
        const half = DUST_FIELD / 2;
        for (const dot of this.flightDust) {
            let dx = dot.x - ship.x;
            let dy = dot.y - ship.y;
            if (dx > half) dx -= DUST_FIELD;
            else if (dx < -half) dx += DUST_FIELD;
            if (dy > half) dy -= DUST_FIELD;
            else if (dy < -half) dy += DUST_FIELD;
            dot.setPosition(ship.x + dx, ship.y + dy);
            // Faster travel makes the dust brighter, like motes caught in a light.
            dot.setAlpha(0.25 + Math.min(1, speed / FLIGHT_SPEED) * 0.5);
        }

        const g = this.thrustPlume!;
        g.clear();
        if (!thrusting && speed < 40) return;

        // A flickering cone off the stern, longer the harder you burn.
        const power = thrusting ? 1 : Math.min(1, speed / FLIGHT_SPEED) * 0.45;
        const len = (22 + Math.min(1, speed / FLIGHT_SPEED) * 26) * power * (0.85 + this.rng.next() * 0.3);
        const back = this.shipHeading + Math.PI;
        const bx = ship.x + Math.cos(back) * 12;
        const by = ship.y + Math.sin(back) * 12;
        const spread = 0.28;
        for (const [scale, colour, alpha] of [[1, 0x4fd4c4, 0.35], [0.6, 0x8fe9d6, 0.6]] as const) {
            g.fillStyle(colour, alpha * power);
            g.fillTriangle(
                bx + Math.cos(back + spread) * 7 * scale, by + Math.sin(back + spread) * 7 * scale,
                bx + Math.cos(back - spread) * 7 * scale, by + Math.sin(back - spread) * 7 * scale,
                bx + Math.cos(back) * len * scale, by + Math.sin(back) * len * scale,
            );
        }
    }

    /** Hand control back to the chart. */
    private exitFlight(): void {
        if (!this.flying) return;
        this.flying = false;
        this.panEnabled = true;
        const cam = this.cameras.main;
        cam.stopFollow();
        this.tweens.add({ targets: cam, zoom: 0.95, duration: 600, ease: 'Sine.easeInOut' });
        this.ship?.setVisible(false);
        for (const dot of this.flightDust) dot.setVisible(false);
        this.thrustPlume?.clear().setVisible(false);
    }

    /** Steer, burn fuel, and notice what you have arrived at. */
    private updateFlight(dt: number): void {
        const ship = this.ship;
        const keys = this.flightKeys;
        if (!ship || !keys) return;

        if (this.escKey?.isDown) {
            this.exitFlight();
            return;
        }

        const down = (list: Phaser.Input.Keyboard.Key[]) => list.some((k) => k.isDown);
        let ax = (down(keys.right) ? 1 : 0) - (down(keys.left) ? 1 : 0);
        let ay = (down(keys.down) ? 1 : 0) - (down(keys.up) ? 1 : 0);
        const thrusting = ax !== 0 || ay !== 0;
        if (thrusting) {
            const len = Math.hypot(ax, ay) || 1;
            ax /= len;
            ay /= len;
        }

        // Momentum, matching the Creature stage's handling rather than a third
        // movement feel: velocity eases toward input and coasts when released.
        const lerp = thrusting ? FLIGHT_ACCEL_LERP : FLIGHT_DRAG_LERP;
        const targetX = ax * FLIGHT_SPEED;
        const targetY = ay * FLIGHT_SPEED;
        const t = Math.min(1, lerp * dt);
        this.shipVel.x += (targetX - this.shipVel.x) * t;
        this.shipVel.y += (targetY - this.shipVel.y) * t;

        // Fuel: only thrust burns alloy, so drifting is free and running dry is
        // a setback rather than a dead end.
        if (thrusting) {
            const alloy = this.state.resources.alloy;
            if (alloy && alloy.value > 0) {
                this.state = applyEventEffects(this.state, { alloy: -FLIGHT_BURN_PER_SEC * dt });
            } else {
                this.shipVel.x *= 0.2;
                this.shipVel.y *= 0.2;
            }
        }

        ship.x = Phaser.Math.Clamp(ship.x + this.shipVel.x * dt, 0, this.map.width);
        ship.y = Phaser.Math.Clamp(ship.y + this.shipVel.y * dt, 0, this.map.height);

        const speed = Math.hypot(this.shipVel.x, this.shipVel.y);
        if (speed > 8) {
            // Ease the heading rather than snapping it, so turns read as banking.
            const target = Math.atan2(this.shipVel.y, this.shipVel.x);
            this.shipHeading = Phaser.Math.Angle.RotateTo(this.shipHeading, target, TURN_RATE * dt);
            ship.setRotation(this.shipHeading);
        }

        // Pull the view back a little at speed — the world opens up as you run.
        const cam = this.cameras.main;
        const wanted = FLIGHT_ZOOM - (speed / FLIGHT_SPEED) * FLIGHT_ZOOM_SPREAD;
        cam.zoom += (wanted - cam.zoom) * Math.min(1, 1.5 * dt);

        this.updateFlightVisuals(speed, thrusting);
        this.checkArrival(ship.x, ship.y);
    }

    /**
     * What is waiting at a world, and what you can do about it. Authored here
     * rather than in stages.json because an encounter is a function of the
     * world's feature, not of the individual system.
     */
    private encounterFor(site: StageSite): StageEvent | null {
        const feature = site.world?.feature;
        if (!feature) return null;

        const at = site.label;
        const encounters: Record<string, StageEvent> = {
            natives: {
                id: `encounter:${site.id}`,
                title: `Life on ${at}`,
                description: `The signal resolves into speech. Something already lives here, and it has noticed you.`,
                choices: [
                    { label: 'Answer them', effects: { research: 14 }, note: `You spoke first at ${at}, and were answered.` },
                    { label: 'Watch, and say nothing', effects: { legacy: 6 }, note: `You watched ${at} a while, and left them unaware.` },
                ],
                visual: { kind: 'signal' },
            },
            anomaly: {
                id: `encounter:${site.id}`,
                title: `An anomaly at ${at}`,
                description: `The instruments disagree with each other. Whatever is out here does not behave like matter should.`,
                choices: [
                    { label: 'Take the ship closer', effects: { research: 22, alloy: -10 }, note: `${at} gave up something your physics cannot yet hold.` },
                    { label: 'Log it and keep your distance', effects: { legacy: 5 }, note: `You marked ${at} on the chart and let it be.` },
                ],
                visual: { kind: 'anomaly' },
            },
            hazard: {
                id: `encounter:${site.id}`,
                title: `${at} is hostile`,
                description: `Radiation, debris and a star that flares without warning. Nothing here is free.`,
                choices: [
                    { label: 'Push through', effects: { alloy: -16, research: 12 }, note: `You crossed ${at} and paid for it in hull.` },
                    { label: 'Skirt the worst of it', effects: { alloy: -5 }, note: `You went the long way around ${at}.` },
                ],
                visual: { kind: 'flare' },
            },
            derelict: {
                id: `encounter:${site.id}`,
                title: `Something was here before you`,
                description: `A hull drifts at ${at}, dark and long dead. It is not of any make you know.`,
                choices: [
                    { label: 'Board and strip it', effects: { alloy: 20, research: -4 }, note: `You cut ${at}'s derelict apart for what it was worth.` },
                    { label: 'Read its logs first', effects: { research: 16 }, note: `The derelict at ${at} told you how it died.` },
                ],
                visual: { kind: 'discovery' },
            },
        };
        return encounters[feature] ?? null;
    }

    /** Flying within reach of a system charts it and brings it up. */
    private checkArrival(x: number, y: number): void {
        const site = this.map.siteNear(x, y, ARRIVAL_RADIUS);
        if (!site || this.visitedThisFlight.has(site.id)) return;
        this.visitedThisFlight.add(site.id);

        // Arriving in person charts the system, whether or not a probe found it.
        if (!isRevealed(this.state, site.x, site.y)) {
            this.state = revealAt(this.state, site.x, site.y, this.def.fog?.revealRadius ?? 0.14);
            this.map.updateFog(this.state);
            this.state = applyEventEffects(this.state, {}, `You made orbit at ${site.label}.`);
        }

        // Making orbit should feel like an arrival, not a log line.
        const pos = this.map.at(site.x, site.y);
        for (const delay of [0, 160]) {
            const ring = this.add
                .circle(pos.x, pos.y, 22, 0x000000, 0)
                .setStrokeStyle(2, COLORS.brandHi, 0.9)
                .setDepth(10);
            this.tweens.add({
                targets: ring, scale: 3.2, alpha: 0, delay, duration: 900,
                ease: 'Sine.easeOut', onComplete: () => ring.destroy(),
            });
        }
        this.cameras.main.flash(220, 60, 120, 130);

        this.bus.emit('sfx', { name: 'event' });
        this.selectSite(site.id); // its actions — survey, settle, manage — open here
        this.emitManagement();

        // First time here: whatever the world is holding happens now.
        const encounter = this.encounterFor(site);
        if (encounter && !this.state.encountered.includes(site.id)) {
            this.state = { ...this.state, encountered: [...this.state.encountered, site.id] };
            this.raiseEncounter(encounter, site);
        }
    }

    /**
     * Open an encounter as a decision. It rides the normal event machinery —
     * the sim freezes, the modal shows the choice, and the outcome is revealed
     * afterwards — but remembers the system so first contact can seat a power.
     */
    private raiseEncounter(encounter: StageEvent, site: StageSite): void {
        this.pendingEvent = encounter;
        this.encounterSite = site;
        this.bus.emit('sfx', { name: 'event' });
        this.bus.emit('event:show', {
            title: encounter.title,
            description: encounter.description,
            choices: encounter.choices.map((c) => c.label),
            icon: eventIcon(encounter.visual?.kind),
        });
    }

    /**
     * Answering a native world seats them as a real power on the map, with
     * their own strength and their own opinion of you. Generated in play rather
     * than authored, which is what makes the galaxy feel inhabited.
     */
    private seatNativePower(site: StageSite): void {
        const id = `native:${site.id}`;
        if (this.state.rivals.some((r) => r.id === id)) return;

        const rng = new Rng(`${this.seed}:contact:${site.id}`);
        const archetypes = ['trader', 'builder', 'enigmatic', 'aggressive'] as const;
        const stem = site.label.split(' ')[0];
        this.state = addRival(this.state, {
            id,
            name: `the ${stem} ${rng.pick(['Concord', 'Assembly', 'Chorus', 'Kindred', 'Watch'])}`,
            archetype: rng.pick([...archetypes]),
            x: site.x,
            y: site.y,
            present: true,
            emergesAt: 0,
            discovered: true,
            strength: 18 + Math.floor(rng.next() * 20),
            // They start neutral-warm: you did, after all, speak first.
            relationship: 15,
            defense: 0,
            progress: 0,
        });
        this.buildRivalMarker(this.state.rivals.find((r) => r.id === id)!);
        this.emitManagement();
    }

    private siteLabel(siteId: string): string {
        return this.def.map?.sites.find((s) => s.id === siteId)?.label ?? 'a territory';
    }

    private raiseEvent(): void {
        const event = this.pickEvent();
        this.pendingEvent = event;
        this.bus.emit('sfx', { name: 'event' });

        // Play the event on the map first, then open the decision modal.
        const discovered = this.state.rivals.filter((r) => r.discovered);
        const rival = discovered.length > 0 ? discovered[this.rng.int(0, discovered.length)] : undefined;
        const sites = this.def.map?.sites ?? [];
        const site = sites.length > 0 ? sites[this.rng.int(0, sites.length)] : undefined;
        const rivalPos = rival ? this.map.at(rival.x, rival.y) : undefined;
        const sitePos = site ? this.map.at(site.x, site.y) : undefined;
        const icon = eventIcon(event.visual?.kind);
        this.floatEventIcon(icon, sitePos ?? rivalPos ?? this.map.home);
        this.theatreBusy = true;
        void this.theatre
            .play(event.visual, { home: this.map.home, rival: rivalPos, site: sitePos })
            .then(() => {
                this.theatreBusy = false;

                this.bus.emit('event:show', {
                    title: event.title,
                    description: event.description,
                    choices: event.choices.map((c) => c.label),
                    icon,
                });
            });
    }

    private resolveEvent(index: number): void {
        const event = this.pendingEvent;
        if (!event) return;
        const choice = event.choices[index] ?? event.choices[0];
        this.state = applyEventEffects(this.state, choice.effects, choice.note);

        // Answering a native world (the first choice) seats them as a power.
        const site = this.encounterSite;
        this.encounterSite = null;
        if (site && site.world?.feature === 'natives' && index === 0) {
            this.seatNativePower(site);
        }

        this.emitManagement();
        this.emitSnapshot();

        // Stay frozen while the modal reveals what the decision actually did;
        // 'intent:event-dismiss' releases it.
        this.bus.emit('event:outcome', {
            note: choice.note,
            effects: choice.effects,
            resourceLabels: Object.fromEntries(this.def.resources.map((r) => [r.id, r.label])),
        });
    }

    protected emitHud(): void {
        this.bus.emit('hud:update', {
            species: this.species,
            stage: this.def.title,
            objectiveLabel: this.def.objective.label,
            objectiveProgress: objectiveProgress(this.state, this.def),
            threat: null,
        });
    }

    /** Hook: extra status line under the objective (era banner, eco stall). */
    protected statusLine(): string | null {
        if (ecologyStalled(this.state, this.def)) {
            return 'Unity is paused, but Industry continues. Fund restoration to recover.';
        }
        const ecology = this.state.resources.ecology;
        if (ecology && ecology.perTick < 0) return `Ecology declining: ${ecology.perTick.toFixed(1)}/s`;
        // The finale is finished when the player says so, so say so.
        if (this.def.mechanics?.endOnDemand && isManagementComplete(this.state, this.def)) {
            return 'Your legacy is secured. Keep exploring, or send the last ship from your homeworld when you are ready.';
        }
        const era = currentEra(this.state, this.def);
        return era ? `Era: ${era.label}` : null;
    }

    protected emitManagement(): void {
        this.bus.emit('management:update', {
            title: this.def.title,
            subtitle: this.def.subtitle,
            objectiveLabel: `${this.def.objective.label} (${Math.floor(this.state.resources[this.def.objective.resource]?.value ?? 0)}/${this.def.objective.target})`,
            objectiveProgress: objectiveProgress(this.state, this.def),
            statusLine: this.statusLine(),
            resources: this.def.resources.map((r) => ({
                id: r.id,
                label: r.label,
                value: Math.floor(this.state.resources[r.id]?.value ?? 0),
                perTick: Math.round((this.state.resources[r.id]?.perTick ?? 0) * 10) / 10,
            })),
            // The panel lists every decision so nothing is hidden behind
            // knowing to click the right thing on the map. Council decisions
            // act directly; anchored ones carry a `locate` and travel there.
            actions: [
                // Colonising is no longer an abstract button that picks a
                // system for you — you settle the world you are looking at.
                ...councilActions(this.def)
                    .filter((a) => a.special !== 'colonise')
                    .map((a) => this.actionViewOf(a)),
                ...this.def.actions
                    .filter((a) => actionAnchor(a) !== 'council')
                    .map((a) => this.actionViewOf(a, true)),
            ],
            factions: this.state.rivals
                .filter((r) => r.discovered)
                .map((r) => ({
                    id: r.id,
                    name: r.name,
                    archetype: r.archetype,
                    strength: Math.round(r.strength),
                    relationship: Math.round(r.relationship),
                    stance: factionStance(r.relationship),
                    defense: Math.round(r.defense),
                    raceProgress: rivalRaceProgress(r),
                })),
            // Only scoutable powers count as "hidden"; not-yet-emerged ones stay unhinted.
            hiddenRivals: this.state.rivals.filter((r) => r.present && !r.discovered).length,
            log: this.state.log,
        });
    }

    protected emitSnapshot(): void {
        if (this.ended && !isManagementComplete(this.state, this.def)) return;
        const resources: Record<string, number> = {};
        for (const id of Object.keys(this.state.resources)) {
            resources[id] = Math.round(this.state.resources[id].value * 10) / 10;
        }
        this.bus.emit('save:snapshot', {
            stage: this.stageId,
            completed: isManagementComplete(this.state, this.def),
            traits: [], // strategic stages add no cell/creature traits; inherited stay in state.traits.inherited
            resources,
            // The charted map, the worlds held, and who has been met.
            stageState: saveManagement(this.state),
        });
    }

    private completeStage(): void {
        this.ended = true;
        this.emitManagement();
        this.emitSnapshot();
        this.bus.emit('stage:complete', {
            stage: this.stageId,
            nextStage: nextStageId(this.stageId),
            summary: `${this.species} ${this.def.objective.label.toLowerCase()}.`,
        });
    }
}
