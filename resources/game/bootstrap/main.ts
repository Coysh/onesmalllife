import Phaser from 'phaser';
import { DESIGN_WIDTH, DESIGN_HEIGHT, COLORS } from '../config';
import { CellScene, type CellSceneData } from '../scenes/CellScene';
import { CreatureScene, type CreatureSceneData, type CreatureBuildState } from '../scenes/CreatureScene';
import type { SavedManagement } from '../systems/managementState';
import { ManagementScene, type ManagementSceneData } from '../scenes/ManagementScene';
import { CityScene } from '../scenes/strategic/CityScene';
import { EventBus } from './events';
import { HudController } from '../ui/HudController';
import { SaveClient } from '../saves/SaveClient';
import { TraitDrawerController } from '../ui/TraitDrawerController';
import { ManagementController } from '../ui/ManagementController';
import { EventModalController } from '../ui/EventModalController';
import { OnboardingController } from '../ui/OnboardingController';
import { DietController } from '../ui/DietController';
import { AdaptController } from '../ui/AdaptController';
import { CreatureBuilderController } from '../ui/CreatureBuilderController';
import { SelectionBarController } from '../ui/SelectionBarController';
import { TransitionController } from '../ui/TransitionController';
import { DevToolsController } from '../ui/DevToolsController';
import { AudioEngine } from '../audio/AudioEngine';
import { isStrategicStage } from '../lib/stages';
import { installDisplayResolution } from '../lib/displayResolution';
import type { Vitals } from '../systems/cellVitals';
import type { CreatureVitals } from '../systems/creatureVitals';

/**
 * Game boot. Mounts a Phaser canvas into #game-canvas and the DOM HUD onto
 * #game-hud, wires them through one EventBus, loads the server-provided campaign
 * state, and starts autosaving via SaveClient. The server stays the source of
 * truth for what campaign is loaded (config comes from #game-root data-*).
 */
function readState(): Record<string, unknown> {
    const el = document.getElementById('campaign-state');
    if (!el?.textContent) return {};
    try {
        return JSON.parse(el.textContent) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function pickNumbers<T extends object>(source: Record<string, number> | undefined, keys: (keyof T & string)[]): Partial<T> {
    const out: Partial<T> = {};
    if (!source) return out;
    for (const key of keys) {
        if (typeof source[key] === 'number') (out as Record<string, number>)[key] = source[key];
    }
    return out;
}

function currentStage(state: Record<string, unknown>): string {
    const progress = state.progress as { currentStage?: string } | undefined;
    return progress?.currentStage ?? 'cell';
}

function hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

function readAppearance(state: Record<string, unknown>): import('../data/cell-parts').AppearanceV2 | undefined {
    const a = (state.species as { appearance?: Record<string, unknown> } | undefined)?.appearance;
    if (!a || typeof a !== 'object') return undefined;
    return a as unknown as import('../data/cell-parts').AppearanceV2;
}

function readPalette(state: Record<string, unknown>): { albedo: number; accent: number; detail: number } | undefined {
    const p = (state.species as { palette?: { albedo: string; accent: string; detail: string } } | undefined)?.palette;
    if (!p) return undefined;
    try {
        return { albedo: hexToNum(p.albedo), accent: hexToNum(p.accent), detail: hexToNum(p.detail) };
    } catch {
        return undefined;
    }
}

function boot(): void {
    const rootEl = document.getElementById('game-root');
    const canvasParent = document.getElementById('game-canvas');
    const hudEl = document.getElementById('game-hud');
    if (!rootEl || !canvasParent || !hudEl) return;

    const bus = new EventBus();
    new HudController(hudEl, bus);
    new TraitDrawerController(hudEl, bus);
    new ManagementController(hudEl, bus);
    new EventModalController(hudEl, bus);
    new OnboardingController(hudEl, bus);
    new DietController(hudEl, bus);
    new AdaptController(hudEl, bus);
    new CreatureBuilderController(hudEl, bus);
    new SelectionBarController(hudEl, bus);
    new TransitionController(hudEl, bus);
    new DevToolsController(hudEl, bus);

    // Audio unlocks on the first user gesture (browsers block autoplay).
    const audio = new AudioEngine(bus);
    const unlock = () => {
        audio.unlock();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const state = readState();

    // Autosave to the server (if a save URL was provided by the server).
    const saveUrl = rootEl.dataset.saveUrl;
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    if (saveUrl) {
        new SaveClient(saveUrl, csrf, state, bus);
    }

    const seed = rootEl.dataset.seed ?? 'one-small-life';
    const species = rootEl.dataset.species ?? 'Your lineage';
    const palette = readPalette(state);
    const appearance = readAppearance(state);
    const resources = state.resources as Record<string, number> | undefined;
    const traitsBlock = state.traits as { active?: string[]; inherited?: string[] } | undefined;
    const activeTraits = Array.isArray(traitsBlock?.active) ? traitsBlock!.active : [];
    const inheritedTraits = Array.isArray(traitsBlock?.inherited) ? traitsBlock!.inherited : [];

    let game: Phaser.Game;
    try {
        game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: canvasParent,
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            backgroundColor: COLORS.bg,
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        });
    } catch {
        // No WebGL and no Canvas 2D (rare, locked-down machines): show a
        // friendly message in the existing loading element instead of a blank
        // screen or an uncaught error.
        const loadingEl = document.getElementById('game-loading');
        if (loadingEl) {
            loadingEl.textContent = "This device can't run the game canvas.";
            loadingEl.removeAttribute('hidden');
        }
        return;
    }

    // Render the canvas backing store at the display's true pixel density
    // (capped at 2×), with a runtime frame-rate guard. Logical coordinates stay
    // at DESIGN_WIDTH×DESIGN_HEIGHT — this only raises the drawing-buffer
    // resolution so the canvas is crisp on Retina displays.
    installDisplayResolution(game, { designWidth: DESIGN_WIDTH, designHeight: DESIGN_HEIGHT });

    const completed = Boolean((state.progress as { completed?: boolean } | undefined)?.completed);

    // Toggle the DOM HUD between direct-control and management layouts.
    const stage = currentStage(state);
    const mode = isStrategicStage(stage) ? 'management' : 'direct';
    hudEl.querySelectorAll<HTMLElement>('[data-mode="direct"]').forEach((el) => (el.hidden = mode !== 'direct'));
    hudEl.querySelectorAll<HTMLElement>('[data-mode="management"]').forEach((el) => (el.hidden = mode !== 'management'));

    // Start the scene for the campaign's current stage, exactly once, with data.
    if (isStrategicStage(stage)) {
        const data: ManagementSceneData = {
            bus,
            seed,
            species,
            stageId: stage,
            resources,
            // What this stage recorded last time: the charted map, the worlds
            // held, and the powers met.
            stageState: (state.stageState as Record<string, SavedManagement> | undefined)?.[stage],
            traits: inheritedTraits,
            freePlay: completed, // a finished lineage keeps playing without re-completing
        };
        // Civilisation gets the city-building subclass; the rest share the base scene.
        const SceneClass = stage === 'civilisation' ? CityScene : ManagementScene;
        game.scene.add('Management', SceneClass, true, data);
    } else if (stage === 'creature') {
        const data: CreatureSceneData = {
            bus,
            seed,
            species,
            resources: pickNumbers<CreatureVitals>(resources, ['health', 'hunger', 'nourishment', 'evolution']),
            traits: inheritedTraits.length ? inheritedTraits : activeTraits,
            palette,
            appearance,
            diet: resources?.diet === 1 ? 'carnivore' : resources?.diet === 0 ? 'herbivore' : undefined,
            stageState: (state.stageState as Record<string, CreatureBuildState> | undefined)?.creature,
        };
        game.scene.add('Creature', CreatureScene, true, data);
    } else {
        const data: CellSceneData = {
            bus,
            seed,
            species,
            resources: pickNumbers<Vitals>(resources, ['energy', 'integrity', 'evolution', 'absorbed']),
            traits: activeTraits,
            palette,
            appearance,
        };
        game.scene.add('Cell', CellScene, true, data);
    }

    // Reveal the world once booted.
    document.getElementById('game-loading')?.setAttribute('hidden', '');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
