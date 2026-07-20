import Phaser from 'phaser';
import { CELL, COLORS, WORLD, resolveCellTuning, type CellTuning, type OrganismPalette } from '../config';
import { Rng } from '../lib/rng';
import { compass } from '../lib/compass';
import { ambientParticles, lightShafts, applyCameraFx } from '../lib/atmosphere';
import { setupWorld, setZoomTier } from '../lib/worldCamera';
import { withinRange } from '../lib/geometry';
import { makeTexture } from '../lib/spriteFactory';
import { Minimap } from '../ui/Minimap';
import { TraitEngine } from '../traits/TraitEngine';
import { CellOrganism } from '../entities/CellOrganism';
import { Mote } from '../entities/Mote';
import { EnemyCell } from '../entities/EnemyCell';
import { Hazard } from '../entities/Hazard';
import { ENEMY_CELLS, ENEMY_CELL_BY_ID } from '../data/sprites/cellSprites';
import { tierFor, nextTierAt, threatens, shouldHunt, contactDamage, canOverpower } from '../systems/cellGrowth';
import { aggregatePartEffects, mergeEffects, type CombatStats } from '../systems/partEffects';
import type { AppearanceV2 } from '../data/cell-parts';
import {
    initialVitals,
    tickVitals,
    absorbMote,
    absorbPrey,
    damage,
    objectiveProgress,
    isStageComplete,
    isStageFailed,
    type Vitals,
} from '../systems/cellVitals';
import type { EventBus, PauseSource } from '../bootstrap/events';

export interface CellSceneData {
    bus: EventBus;
    seed: string;
    species: string;
    resources?: Partial<Vitals>;
    traits?: string[];
    palette?: OrganismPalette;
    appearance?: AppearanceV2;
}

/**
 * Stage 1 — Cell. A big scrolling microcosm (WORLD.cellWidth×cellHeight): you
 * start microscopic among cells that dwarf and ignore you, grow through three
 * size tiers (systems/cellGrowth) — each tier-up scales the organism, zooms
 * the camera out, and flips former threats into prey. Rules live in
 * systems/cellVitals + cellGrowth; this scene owns rendering, input and the
 * world. It talks to the DOM HUD only through the EventBus.
 */
export class CellScene extends Phaser.Scene {
    private bus!: EventBus;
    private seed = 'default';
    private species = 'Your lineage';
    private initialResources?: Partial<Vitals>;

    private rng!: Rng;
    private cell!: CellOrganism;
    private motes: Mote[] = [];
    private enemies: EnemyCell[] = [];
    private enemyCap = Infinity;
    private hazards: Hazard[] = [];
    private minimap!: Minimap;
    private lastHitAt = -9999;
    private invulnUntil = 0;
    private tier = 1;
    private currentThreat: string | null = null;
    private bounds!: Phaser.Geom.Rectangle;
    private vitals: Vitals = initialVitals();

    private traitEngine = new TraitEngine();
    private owned = new Set<string>();
    private tuning: CellTuning = resolveCellTuning();
    private initialTraits: string[] = [];
    private palette?: OrganismPalette;
    private appearance?: AppearanceV2;
    private combat: CombatStats = aggregatePartEffects(undefined).combat;

    private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private pointerActive = false;
    private speedMultiplier = 1;
    private pauseSources = new Set<PauseSource>();
    private ended = false;
    private hudAccumulator = 0;
    private minimapAccumulator = 0;
    // One reusable particle emitter per burst colour (see spawnBurst): avoids
    // allocating N Arc GameObjects + N tweens on every absorb.
    private burstEmitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();

    constructor() {
        super('Cell');
    }

    init(data: CellSceneData): void {
        this.bus = data.bus;
        this.seed = data.seed ?? this.seed;
        this.species = data.species ?? this.species;
        this.initialResources = data.resources;
        this.initialTraits = data.traits ?? [];
        this.palette = data.palette;
        this.appearance = data.appearance;
    }

    create(): void {
        this.rng = new Rng(this.seed);
        this.vitals = { ...initialVitals(), ...this.initialResources };
        this.owned = new Set(this.initialTraits);
        this.recomputeTuning();
        this.ended = false;
        // Scene instances are reused across restart; drop emitters from the
        // previous run (their GameObjects were destroyed on shutdown).
        this.burstEmitters.clear();
        this.minimapAccumulator = 0;

        const W = WORLD.cellWidth;
        const H = WORLD.cellHeight;

        // The microcosm: a deep gradient across the whole world, warm glow
        // pools scattered by seed, drifting light shafts and plankton motes.
        this.cameras.main.setBackgroundColor(COLORS.bg);
        const bg = this.add.graphics().setDepth(-3);
        bg.fillGradientStyle(0x0b2b31, 0x0b2b31, 0x030809, 0x030809, 1);
        bg.fillRect(0, 0, W, H);

        const glow = this.add.graphics().setDepth(-2);
        for (let i = 0; i < 10; i++) {
            const gx = this.rng.next() * W;
            const gy = this.rng.next() * H;
            glow.fillStyle(this.rng.chance(0.3) ? COLORS.secondary : COLORS.brandDeep, 0.05 + this.rng.next() * 0.07);
            glow.fillCircle(gx, gy, 260 + this.rng.next() * 380);
        }

        lightShafts(this, W, H, COLORS.brandHi);
        ambientParticles(this, { width: W, height: H, color: COLORS.brandHi, depth: -1, frequency: 90, scale: [0.05, 0.16], alpha: 0.3 });
        ambientParticles(this, { width: W, height: H, color: COLORS.brand, depth: 20, frequency: 160, scale: [0.1, 0.28], alpha: 0.25 });
        applyCameraFx(this.cameras.main, 0.9, 0.5);

        const margin = 60;
        this.bounds = new Phaser.Geom.Rectangle(margin, margin, W - margin * 2, H - margin * 2);

        this.cell = new CellOrganism(this, W / 2, H / 2, this.palette, this.appearance);
        this.tier = tierFor(this.vitals.absorbed);
        this.cell.setBaseScale(CELL.tierScale[this.tier - 1]);

        this.motes = Array.from({ length: CELL.moteCount }, () => new Mote(this, this.rng, this.bounds));
        this.hazards = Array.from({ length: CELL.hazardCount }, () => new Hazard(this.rng, this.bounds, this));
        this.enemies = [];
        for (const def of ENEMY_CELLS) {
            for (let i = 0; i < def.count; i++) {
                const enemy = new EnemyCell(this, this.rng, this.bounds, def, this.enemies.length);
                enemy.respawn({ x: W / 2, y: H / 2 }, 500);
                this.enemies.push(enemy);
            }
        }
        // Colony kills spawn edible fragments (below). They respawn rather than
        // dying, so without a ceiling the per-frame enemy loop would grow every
        // colony kill across a long session — cap headroom over the start count.
        this.enemyCap = this.enemies.length + 32;
        this.currentThreat = null;
        this.lastHitAt = -9999;
        this.invulnUntil = 0;
        this.refreshVisuals();

        setupWorld(this, { width: W, height: H }, { follow: this.cell.container, zoom: CELL.tierZoom[this.tier - 1] });
        this.minimap = new Minimap(this, { width: W, height: H });
        this.updateMinimap(); // paint once immediately; update() throttles it thereafter

        // Input: WASD + arrows, plus hold-pointer to swim toward the cursor.
        const kb = this.input.keyboard!;
        this.keys = {
            up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.cursors = kb.createCursorKeys();
        this.input.on('pointerdown', () => (this.pointerActive = true));
        this.input.on('pointerup', () => (this.pointerActive = false));

        // DOM → scene intents.
        this.bus.on('intent:pause', () => this.setPauseSource('manual', true));
        this.bus.on('intent:resume', () => this.setPauseSource('manual', false));
        this.bus.on('intent:pause-change', ({ source, paused }) => this.setPauseSource(source, paused));
        this.bus.on('intent:set-speed', ({ multiplier }) => (this.speedMultiplier = multiplier));
        this.bus.on('intent:acquire-trait', ({ traitId }) => this.acquireTrait(traitId));
        this.bus.on('intent:retry', () => {
            if (!this.ended) return;
            this.scene.restart({
                bus: this.bus,
                seed: this.seed,
                species: this.species,
                traits: this.initialTraits,
                palette: this.palette,
                appearance: this.appearance,
            } as CellSceneData);
        });

        // Dev toolbar accelerators (buttons only exist in the local env).
        this.bus.on('intent:dev-grant', () => {
            this.vitals = { ...this.vitals, energy: 100, integrity: 100, evolution: this.vitals.evolution + 20 };
            this.emitHud();
            this.emitTraits();
        });
        this.bus.on('intent:dev-complete', () => {
            this.vitals = { ...this.vitals, absorbed: CELL.objectiveTarget };
            this.emitHud();
        });
        this.bus.on('intent:dev-die', () => {
            if (!this.ended) this.failStage();
        });

        // Periodic autosave at a safe cadence (not every frame — brief §22).
        this.time.addEvent({ delay: 15000, loop: true, callback: () => this.emitSnapshot() });

        this.emitHud();
        this.emitTraits();
        this.emitSnapshot();
    }

    private recomputeTuning(): void {
        // Creator part effects are the baseline; acquired traits stack on top.
        const parts = aggregatePartEffects(this.appearance);
        this.combat = parts.combat;
        this.tuning = resolveCellTuning(mergeEffects(parts.effects, this.traitEngine.aggregateEffects(this.owned)));
    }

    /** Cached soft dot texture for burst emitters, keyed by colour. */
    private burstTextureKey(hex: number): string {
        return makeTexture(this, `osl-burst-${hex.toString(16)}`, 8, 8, (g) => {
            g.fillStyle(hex, 1);
            g.fillCircle(4, 4, 3);
        });
    }

    /** Lazily build (once) a reusable, non-emitting burst emitter for a colour. */
    private burstEmitter(hex: number): Phaser.GameObjects.Particles.ParticleEmitter {
        let emitter = this.burstEmitters.get(hex);
        if (!emitter) {
            emitter = this.add
                .particles(0, 0, this.burstTextureKey(hex), {
                    // Matches the old per-particle pop: ~18–36px of travel over
                    // 300ms (≈60–120px/s), fading and shrinking to 0.3 scale.
                    speed: { min: 60, max: 120 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 1, end: 0.3 },
                    alpha: { start: 1, end: 0 },
                    lifespan: 300,
                    emitting: false,
                })
                .setDepth(6);
            this.burstEmitters.set(hex, emitter);
        }
        return emitter;
    }

    /** A quick radial particle pop for feedback. */
    private spawnBurst(x: number, y: number, color: number, count: number): void {
        // Determinism: the previous implementation drew two rng.next() values
        // per particle (angle + distance jitter). Entities share THIS same
        // campaign rng and draw from it every frame, so we must advance it by
        // the identical amount here or their motion would desync. The visual
        // scatter now comes from the pooled emitter instead of these values.
        for (let i = 0; i < count; i++) {
            this.rng.next();
            this.rng.next();
        }
        this.burstEmitter(color).explode(count, x, y);
    }

    private refreshVisuals(): void {
        this.cell.applyVisuals(this.traitEngine.aggregateVisuals(this.owned));
    }

    private acquireTrait(traitId: string): void {
        const trait = this.traitEngine.get(traitId);
        if (!trait) return;
        if (!this.traitEngine.canAcquire(trait, this.owned, this.vitals.evolution)) return;

        this.vitals = { ...this.vitals, evolution: this.vitals.evolution - trait.cost };
        this.owned.add(traitId);
        this.recomputeTuning();
        this.refreshVisuals();
        this.cell.pulse(); // brief evolution feedback
        this.spawnBurst(this.cell.x, this.cell.y, COLORS.evolution, 14);
        this.bus.emit('sfx', { name: 'evolve' });

        this.emitHud();
        this.emitTraits();
        this.emitSnapshot();
    }

    private emitTraits(): void {
        const entries = this.traitEngine.forStage('cell').map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            cost: t.cost,
            state: this.traitEngine.resolveState(t, this.owned),
            benefits: t.benefits,
            costs: t.costs,
            affordable: this.traitEngine.canAcquire(t, this.owned, this.vitals.evolution),
            rarity: t.rarity,
            leadsTo: this.traitEngine.leadsTo(t.id),
        }));
        this.bus.emit('traits:update', { entries, evolution: this.vitals.evolution });
    }

    private readInput(): { vx: number; vy: number } {
        let dx = 0;
        let dy = 0;
        if (this.keys.left.isDown || this.cursors.left.isDown) dx -= 1;
        if (this.keys.right.isDown || this.cursors.right.isDown) dx += 1;
        if (this.keys.up.isDown || this.cursors.up.isDown) dy -= 1;
        if (this.keys.down.isDown || this.cursors.down.isDown) dy += 1;

        if (this.pointerActive && dx === 0 && dy === 0) {
            const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
            const ang = Phaser.Math.Angle.Between(this.cell.x, this.cell.y, p.x, p.y);
            const dist = Phaser.Math.Distance.Between(this.cell.x, this.cell.y, p.x, p.y);
            if (dist > 6) {
                dx = Math.cos(ang);
                dy = Math.sin(ang);
            }
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }
        return { vx: dx * this.tuning.speed, vy: dy * this.tuning.speed };
    }

    /** Growth bookkeeping after any absorb: tier-ups scale + zoom the world out. */
    private checkGrowth(time: number): void {
        const newTier = tierFor(this.vitals.absorbed);
        if (newTier <= this.tier) return;
        this.tier = newTier;
        this.invulnUntil = time + CELL.tierInvulnMs;
        this.cell.setBaseScale(CELL.tierScale[this.tier - 1]);
        setZoomTier(this, CELL.tierZoom[this.tier - 1]);
        this.cell.pulse();
        this.spawnBurst(this.cell.x, this.cell.y, COLORS.evolution, 22);
        this.cameras.main.flash(280, 143, 233, 214);
        this.bus.emit('sfx', { name: 'evolve' });
        this.emitHud();
    }

    update(_time: number, delta: number): void {
        if (this.pauseSources.size > 0 || this.ended) return;
        const dt = (delta / 1000) * this.speedMultiplier;

        const { vx, vy } = this.readInput();
        this.cell.setVelocity(vx, vy);
        this.cell.update(dt, this.bounds);

        for (const mote of this.motes) {
            mote.update(dt);
            if (mote.consumed) continue;
            const reach = this.cell.radius + CELL.moteRadius + CELL.absorbPadding;
            if (withinRange(this.cell.x, this.cell.y, mote.x, mote.y, reach)) {
                const multiplier = mote.rich ? CELL.richMoteMultiplier : 1;
                this.spawnBurst(mote.x, mote.y, mote.rich ? COLORS.energy : COLORS.food, mote.rich ? 10 : 6);
                mote.absorb((x, y) => this.isSafeMoteSpawn(x, y));
                this.vitals = absorbMote(this.vitals, this.tuning, multiplier);
                this.bus.emit('sfx', { name: mote.rich ? 'absorb-rich' : 'absorb' });
                this.checkGrowth(_time);
            }
        }

        // Environmental hazards: toxin clouds damage integrity while inside.
        let inHazard = false;
        for (const hazard of this.hazards) {
            hazard.update(dt);
            if (withinRange(this.cell.x, this.cell.y, hazard.x, hazard.y, hazard.radius)) {
                inHazard = true;
                this.vitals = damage(this.vitals, CELL.hazardDamagePerSec * dt);
            }
        }

        // Enemy cells: tier-relative — prey pops, threats bite, hunters chase.
        // Player position is identical for every enemy this frame — build it once
        // (not one throwaway object per enemy) to keep the loop allocation-free.
        const player = { x: this.cell.x, y: this.cell.y };
        let nearestDist = Infinity;
        let nearestHunter: EnemyCell | null = null;
        for (const enemy of this.enemies) {
            const dist = enemy.update(dt, player, this.tier);
            if (enemy.consumed) continue;

            if (shouldHunt(this.tier, enemy.def) && dist < nearestDist) {
                nearestDist = dist;
                nearestHunter = enemy;
            }

            const contact = this.cell.radius + enemy.radius;
            if (dist > contact) continue;

            const overpower = !enemy.consumed &&
                canOverpower(this.tier, this.combat.attack, enemy.def) &&
                _time >= this.invulnUntil &&
                _time - this.lastHitAt >= CELL.predatorHitCooldownMs;
            if (overpower) {
                // Strong enough to win the contested fight — eat it, take a hit.
                this.lastHitAt = _time;
                this.vitals = damage(this.vitals, contactDamage(enemy.def.damage, this.combat.defense));
                this.cameras.main.shake(100, 0.004);
            }
            if (enemy.edibleBy(this.tier) || overpower) {
                this.spawnBurst(enemy.x, enemy.y, COLORS.food, 12);
                const def = enemy.def;
                enemy.eaten(this.tier);
                this.vitals = absorbPrey(this.vitals, this.tuning, def.growth, def.energy);
                this.bus.emit('sfx', { name: 'absorb-rich' });
                // Colonies burst apart into edible fragments where they died
                // (only while under the cap, so the enemy list stays bounded).
                if (def.splitsInto && ENEMY_CELL_BY_ID[def.splitsInto] && this.enemies.length < this.enemyCap) {
                    for (let i = 0; i < 2; i++) {
                        const frag = new EnemyCell(this, this.rng, this.bounds, ENEMY_CELL_BY_ID[def.splitsInto], this.enemies.length + i);
                        frag.container.setPosition(
                            Phaser.Math.Clamp(enemy.x + (this.rng.next() - 0.5) * 80, this.bounds.left, this.bounds.right),
                            Phaser.Math.Clamp(enemy.y + (this.rng.next() - 0.5) * 80, this.bounds.top, this.bounds.bottom),
                        );
                        this.enemies.push(frag);
                    }
                }
                this.checkGrowth(_time);
            } else if (
                threatens(this.tier, enemy.def) &&
                _time >= this.invulnUntil &&
                _time - this.lastHitAt >= CELL.predatorHitCooldownMs
            ) {
                this.lastHitAt = _time;
                this.vitals = damage(this.vitals, contactDamage(enemy.def.damage, this.combat.defense));
                this.knockback(enemy);
                this.cameras.main.shake(120, 0.006);
                this.bus.emit('sfx', { name: 'hit' });
            }
        }
        this.currentThreat = this.computeThreat(nearestHunter, nearestDist) ?? (inHazard ? 'Toxins — drift clear' : null);

        this.vitals = tickVitals(this.vitals, dt, this.cell.isMoving(), this.tuning);

        // The minimap is decorative; a few-frame lag is invisible. Redraw it
        // ~every 100ms instead of every frame to avoid a full Graphics clear +
        // per-dot redraw (and the entries array build) on every tick.
        this.minimapAccumulator += delta;
        if (this.minimapAccumulator >= 100) {
            this.minimapAccumulator = 0;
            this.updateMinimap();
        }

        this.hudAccumulator += delta;
        if (this.hudAccumulator >= 100) {
            this.hudAccumulator = 0;
            this.emitHud();
            this.emitTraits();
        }

        if (isStageComplete(this.vitals)) return this.completeStage();
        if (isStageFailed(this.vitals)) return this.failStage();
    }

    private updateMinimap(): void {
        const entries: import('../ui/Minimap').MinimapEntry[] = [
            { x: this.cell.x, y: this.cell.y, color: COLORS.brandHi, size: 3.5 },
        ];
        for (const mote of this.motes) {
            if (!mote.consumed) entries.push({ x: mote.x, y: mote.y, color: COLORS.food, size: mote.rich ? 2 : 1.2 });
        }
        // Threats appear only within sense range — sensory parts will widen this.
        for (const enemy of this.enemies) {
            if (enemy.consumed) continue;
            if (!withinRange(this.cell.x, this.cell.y, enemy.x, enemy.y, this.combat.senseRadius)) continue;
            const color = enemy.edibleBy(this.tier) ? COLORS.evolution : COLORS.danger;
            entries.push({ x: enemy.x, y: enemy.y, color, size: Math.max(1.5, enemy.radius / 14) });
        }
        this.minimap.update(entries);
    }

    private knockback(enemy: EnemyCell): void {
        const ang = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.cell.x, this.cell.y);
        const nx = Phaser.Math.Clamp(this.cell.x + Math.cos(ang) * CELL.predatorKnockback, this.bounds.left + this.cell.radius, this.bounds.right - this.cell.radius);
        const ny = Phaser.Math.Clamp(this.cell.y + Math.sin(ang) * CELL.predatorKnockback, this.bounds.top + this.cell.radius, this.bounds.bottom - this.cell.radius);
        this.cell.container.setPosition(nx, ny);
    }

    private computeThreat(nearest: EnemyCell | null, dist: number): string | null {
        if (!nearest || dist > CELL.predatorAlertRadius) return null;
        const dx = this.cell.x - nearest.x;
        const dy = this.cell.y - nearest.y;
        return `Predator — flee ${compass(dx, dy)}`;
    }

    private emitHud(): void {
        const next = nextTierAt(this.vitals.absorbed);
        const objectiveLabel = next !== null
            ? `Grow — size tier ${this.tier}/${CELL.tierThresholds.length} (${this.vitals.absorbed}/${next} to grow)`
            : `Thrive at full size (${this.vitals.absorbed}/${CELL.objectiveTarget})`;
        this.bus.emit('hud:update', {
            species: this.species,
            stage: 'Stage 1 · Cell',
            energy: Math.round(this.vitals.energy),
            integrity: Math.round(this.vitals.integrity),
            evolution: this.vitals.evolution,
            energyLabel: 'Energy',
            integrityLabel: 'Integrity',
            evolutionLabel: 'Evolution',
            objectiveLabel,
            objectiveProgress: objectiveProgress(this.vitals),
            threat: this.currentThreat ?? (this.vitals.energy < 20 ? 'Low energy — find nutrients' : null),
        });
    }

    /** Excludes the player and toxins when a consumed nutrient returns. */
    private isSafeMoteSpawn(x: number, y: number): boolean {
        if (withinRange(x, y, this.cell.x, this.cell.y, this.cell.radius + 100)) return false;
        return !this.hazards.some((hazard) => withinRange(x, y, hazard.x, hazard.y, hazard.radius + CELL.moteRadius + 20));
    }

    private setPauseSource(source: PauseSource, paused: boolean): void {
        if (paused) this.pauseSources.add(source);
        else this.pauseSources.delete(source);
        this.bus.emit('game:pause-state', { paused: this.pauseSources.size > 0, sources: [...this.pauseSources] });
        if (source === 'manual' && paused) this.emitSnapshot();
    }

    private emitSnapshot(): void {
        if (this.ended && !isStageComplete(this.vitals)) return;
        this.bus.emit('save:snapshot', {
            stage: 'cell',
            completed: isStageComplete(this.vitals),
            traits: [...this.owned],
            resources: {
                energy: Math.round(this.vitals.energy),
                integrity: Math.round(this.vitals.integrity),
                evolution: this.vitals.evolution,
                absorbed: this.vitals.absorbed,
            },
        });
    }

    private completeStage(): void {
        this.ended = true;
        this.emitHud();
        this.emitSnapshot();
        this.bus.emit('sfx', { name: 'complete' });
        this.bus.emit('stage:complete', {
            stage: 'cell',
            nextStage: 'creature',
            summary: `${this.species} reached multicellular life, banking ${this.vitals.evolution} evolution points.`,
        });
    }

    private failStage(): void {
        // A death MOMENT, not an instant reset: the cell ruptures and dissolves,
        // the tank darkens, and a card offers to try again (wired in create()).
        this.ended = true;
        this.currentThreat = null;
        this.bus.emit('sfx', { name: 'hit' });
        this.cameras.main.shake(260, 0.008);
        this.cameras.main.flash(320, 70, 12, 12);

        // Rupture: a burst of the cell's own matter, then it fades and shrinks.
        this.spawnBurst(this.cell.x, this.cell.y, COLORS.danger, 16);
        this.spawnBurst(this.cell.x, this.cell.y, this.palette?.albedo ?? COLORS.brand, 16);
        this.tweens.add({
            targets: this.cell.container,
            alpha: 0,
            scale: 0.3,
            angle: 40,
            duration: 650,
            ease: 'Cubic.easeIn',
        });

        this.emitSnapshot();
        this.time.delayedCall(700, () => {
            this.bus.emit('stage:failed', {
                stage: 'cell',
                title: 'The lineage falters',
                summary: `${this.species} grew to size tier ${this.tier} and absorbed ${this.vitals.absorbed} before the tank reclaimed it. Try again.`,
            });
        });
    }
}
