import Phaser from 'phaser';
import { COLORS } from '../../config';
import { ManagementScene } from '../ManagementScene';
import { buildingTexture, isEraId, type EraId } from '../../data/sprites/buildingSprites';
import { currentEra, canTakeAction } from '../../systems/managementState';
import {
    emptyPlan, place, autoPlace, canPlace, cellToWorld, worldToCell, roadPath,
    CITY_CELL, CITY_RADIUS, type CityPlan,
} from '../../systems/cityPlan';

/** Buildings render over-size so they stay readable at minimum zoom. */
const BUILDING_SCALE = 1.25;

/**
 * Stage 4 — Civilisation. Extends the shared strategic scene with a real
 * city: placement-flagged decisions enter a ghost-building mode (pick a grid
 * cell around the capital), roads auto-draw back to the hearth, and era
 * thresholds re-skin every placed building as technology climbs. Building
 * positions are not persisted — restored campaigns re-lay the same city
 * deterministically via autoPlace.
 */
export class CityScene extends ManagementScene {
    private plan: CityPlan = emptyPlan();
    private buildingSprites: { placementIndex: number; image: Phaser.GameObjects.Image }[] = [];
    private roads!: Phaser.GameObjects.Graphics;
    private grid!: Phaser.GameObjects.Graphics;
    private ghost: Phaser.GameObjects.Image | null = null;
    private placingActionId: string | null = null;
    private eraId: EraId = 'bronze';

    create(): void {
        this.plan = emptyPlan();
        this.buildingSprites = [];
        this.placingActionId = null;
        super.create();
        this.eraId = this.resolveEra();

        // Placement input: move the ghost, click to confirm, Esc to cancel.
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.updateGhost(p));
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.confirmPlacement(p));
        this.input.keyboard?.on('keydown-ESC', () => this.cancelPlacement());
    }

    protected buildLivingScene(): void {
        this.roads = this.add.graphics().setDepth(4);
        this.grid = this.add.graphics().setDepth(3);
        super.buildLivingScene();
    }

    private resolveEra(): EraId {
        const era = currentEra(this.state, this.def);
        return isEraId(era?.id) ? era!.id : 'bronze';
    }

    /** Placement actions enter ghost mode instead of resolving immediately. */
    protected doAction(actionId: string, rivalId?: string): void {
        const action = this.def.actions.find((a) => a.id === actionId);
        if (action?.placement && !this.placingActionId) {
            if (!canTakeAction(this.state, this.def, actionId)) return;
            this.beginPlacement(actionId);
            return;
        }
        super.doAction(actionId, rivalId);
    }

    /**
     * A decision landed. Player-placed buildings were already put on the grid
     * (pendingPlacementIndex); restored/non-interactive ones land on the next
     * free spiral cell so reloaded cities re-lay deterministically.
     */
    protected onActionBuilt(actionId: string): void {
        const action = this.def.actions.find((a) => a.id === actionId);
        if (!action?.placement) {
            super.onActionBuilt(actionId);
            return;
        }
        if (this.pendingPlacementIndex !== null) {
            this.spawnBuilding(this.pendingPlacementIndex);
            return;
        }
        const before = this.plan.placements.length;
        this.plan = autoPlace(this.plan, actionId);
        if (this.plan.placements.length > before) this.spawnBuilding(this.plan.placements.length - 1);
    }

    private placementArmedAt = 0;

    private beginPlacement(actionId: string): void {
        this.placingActionId = actionId;
        this.placementArmedAt = this.time.now;
        this.panEnabled = false;
        this.ghost = this.add.image(0, 0, buildingTexture(this, actionId, this.eraId)).setDepth(11).setAlpha(0.75);
        this.drawGrid(true);
        this.updateGhost(this.input.activePointer);
    }

    private cancelPlacement(): void {
        this.placingActionId = null;
        this.panEnabled = true;
        this.ghost?.destroy();
        this.ghost = null;
        this.drawGrid(false);
    }

    private updateGhost(p: Phaser.Input.Pointer): void {
        if (!this.ghost || !this.placingActionId) return;
        const world = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        const home = this.map.home;
        const { gx, gy } = worldToCell(home.x, home.y, world.x, world.y);
        const snapped = cellToWorld(home.x, home.y, gx, gy);
        this.ghost.setPosition(snapped.x, snapped.y);
        this.ghost.setTint(canPlace(this.plan, gx, gy) ? 0xffffff : 0xf2795f);
    }

    private confirmPlacement(p: Phaser.Input.Pointer): void {
        if (!this.placingActionId) return;
        // Debounce: the click that opened placement mode must not confirm it.
        if (this.time.now - this.placementArmedAt < 250) return;
        const actionId = this.placingActionId;
        const world = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        const home = this.map.home;
        const { gx, gy } = worldToCell(home.x, home.y, world.x, world.y);
        if (!canPlace(this.plan, gx, gy)) return; // click elsewhere or cancel

        this.cancelPlacement();
        this.plan = place(this.plan, actionId, gx, gy);
        // Resolve the underlying decision through the normal path; the parent
        // calls onActionBuilt, which would auto-place — so mark it consumed.
        this.pendingPlacementIndex = this.plan.placements.length - 1;
        super.doAction(actionId);
        this.pendingPlacementIndex = null;
    }

    private pendingPlacementIndex: number | null = null;

    private spawnBuilding(placementIndex: number): void {
        const placement = this.plan.placements[placementIndex];
        if (!placement) return;
        const home = this.map.home;
        const pos = cellToWorld(home.x, home.y, placement.gx, placement.gy);
        const image = this.add.image(pos.x, pos.y, buildingTexture(this, placement.actionId, this.eraId)).setDepth(5).setScale(0);
        // Slightly over-scaled: at STRAT_ZOOM_MIN (0.55) a 40px sprite renders
        // ~22px, which is too small to read against the terrain detail.
        this.tweens.add({ targets: image, scale: BUILDING_SCALE, duration: 320, ease: 'Back.easeOut' });
        this.buildingSprites.push({ placementIndex, image });
        this.drawRoads();
    }

    private drawRoads(): void {
        if (!this.roads) return;
        this.roads.clear();
        // Roads were near-invisible at 0.35 alpha in a colour close to the
        // ground; they need to read as a network holding the city together.
        // Dark casing first, then a pale surface on top, so the network reads
        // at any zoom instead of blending into the ground.
        this.roads.lineStyle(7, 0x2a2419, 0.3);
        this.strokeRoadNetwork();
        this.roads.lineStyle(4, 0xc4b48a, 0.75);
        this.strokeRoadNetwork();
    }

    private strokeRoadNetwork(): void {
        if (!this.roads) return;
        const home = this.map.home;
        for (const placement of this.plan.placements) {
            const path = roadPath(placement);
            for (let i = 0; i < path.length - 1; i++) {
                const a = cellToWorld(home.x, home.y, path[i][0], path[i][1]);
                const b = cellToWorld(home.x, home.y, path[i + 1][0], path[i + 1][1]);
                this.roads.lineBetween(a.x, a.y, b.x, b.y);
            }
        }
    }

    private drawGrid(visible: boolean): void {
        if (!this.grid) return;
        this.grid.clear();
        if (!visible) return;
        const home = this.map.home;
        this.grid.lineStyle(1, COLORS.brandHi, 0.18);
        const extent = CITY_RADIUS * CITY_CELL + CITY_CELL / 2;
        for (let gx = -CITY_RADIUS; gx <= CITY_RADIUS + 1; gx++) {
            const x = home.x + gx * CITY_CELL - CITY_CELL / 2;
            this.grid.lineBetween(x, home.y - extent, x, home.y + extent);
        }
        for (let gy = -CITY_RADIUS; gy <= CITY_RADIUS + 1; gy++) {
            const y = home.y + gy * CITY_CELL - CITY_CELL / 2;
            this.grid.lineBetween(home.x - extent, y, home.x + extent, y);
        }
    }

    /** Era watch: when technology crosses a threshold, the whole city re-skins. */
    protected updateLivingScene(dtSeconds: number): void {
        super.updateLivingScene(dtSeconds);
        const era = this.resolveEra();
        if (era !== this.eraId) {
            this.eraId = era;
            for (const { placementIndex, image } of this.buildingSprites) {
                const placement = this.plan.placements[placementIndex];
                if (!placement) continue;
                image.setTexture(buildingTexture(this, placement.actionId, era));
                this.tweens.add({
                    targets: image,
                    scale: { from: BUILDING_SCALE * 0.8, to: BUILDING_SCALE },
                    duration: 360,
                    ease: 'Back.easeOut',
                });
            }
            this.cameras.main.flash(400, 245, 233, 201);
            this.bus.emit('sfx', { name: 'evolve' });
        }
    }
}
