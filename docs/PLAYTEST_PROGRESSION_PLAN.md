# Codex execution brief: Playtest progression and clarity pass

## Goal

Implement the requested playtest changes across creation and Stages 1–5 while preserving deterministic world generation, existing save compatibility, and the DOM HUD ↔ Phaser event boundary.

The intended result is:

- Creation stats are understandable.
- Stage 1 lasts approximately twice as long without making its opening grindy.
- Stage 2 has a genuine creature-building and part-discovery loop.
- Stages 3–5 always offer meaningful ways to develop the player’s own society.
- Strategic actions clearly explain their costs, requirements, and effects.
- Era progression and attacks are visually readable.
- Events always pause the simulation.
- No progression state can become permanently stuck.

## Product decisions already made

Use these choices without asking again:

- Stage 2 gets a bounded three-slot creature builder, not a freeform editor.
- Herbivores primarily eat visible vegetation.
- Stages 3–5 get capped, escalating repeatable projects.
- Civilisation eras add both visual changes and new projects.
- Stage 1’s objective is doubled while preserving its current early pacing.
- All event decisions pause until dismissed.
- The pause button belongs alongside the speed controls.
- Creature-part collection is optional for completing Stage 2; it enriches the run but is not a mandatory collectathon.

## Recommended implementation order

1. Shared pause, resource, and action-presentation infrastructure.
2. Save schema v2 and creature-build persistence.
3. Creation screen clarity.
4. Stage 1 pacing and pursuit.
5. Stage 2 builder, collectibles, vegetation, and collision fix.
6. Strategic-stage action feedback and camera safe area.
7. Stage-specific Stage 3–5 content.
8. Unit, feature, and browser tests.
9. Full build/type/test pass and manual visual QA.

---

## 1. Shared pause behavior

### Required behavior

Replace the independent manual/event pause behavior with reason-aware pause state so one overlay cannot accidentally resume another pause.

Use pause sources:

```ts
type PauseSource = 'manual' | 'event' | 'creature-builder';
```

Add event-bus intents/state notifications equivalent to:

```ts
'intent:pause-change': {
    source: PauseSource;
    paused: boolean;
};

'game:pause-state': {
    paused: boolean;
    sources: PauseSource[];
};
```

Each scene should maintain a set of active pause sources and skip simulation updates whenever the set is non-empty.

### Manual pause

- Move the pause toggle into the same panel as 1×, 2×, and 4×.
- Use a familiar `⏸ Pause` / `▶ Resume` label and update `aria-pressed`.
- Remove the duplicate top-right pause button.
- Keep the existing full pause menu for manual pauses.
- Event and builder pauses must not open the manual save/settings menu.

### Event pause

- As soon as an event begins, activate the `event` pause source.
- Keep resource production, rival simulation, attacks, movement, hunger, and objective progress frozen throughout the map animation, decision, and outcome display.
- Clear the event pause only when the outcome’s Continue button is pressed.
- Route formerly `minor` strategic events through the modal rather than silently selecting choice zero.
- Add a short “Game paused while you decide” line to the event modal.

If a future direct-control event uses the same event modal, it must inherit this behavior automatically.

### Files primarily involved

- `resources/game/bootstrap/events.ts`
- `resources/game/ui/HudController.ts`
- `resources/game/ui/EventModalController.ts`
- `resources/game/scenes/CellScene.ts`
- `resources/game/scenes/CreatureScene.ts`
- `resources/game/scenes/ManagementScene.ts`
- `resources/views/game/play.blade.php`

---

## 2. Save schema v2 and creature-build state

The Stage 2 build cannot be stored in numeric `resources`. Add validated structured stage state.

### New save shape

Bump `CampaignState::SCHEMA_VERSION` from 1 to 2 and add:

```json
{
  "stageState": {
    "creature": {
      "version": 1,
      "equipped": {
        "locomotion": "steady-legs",
        "feeding": "grazing-jaws",
        "adaptation": "watchful-senses"
      },
      "unlocked": [
        "steady-legs",
        "grazing-jaws",
        "hunting-fangs",
        "watchful-senses"
      ],
      "collected": []
    }
  }
}
```

`collected` records world collectible IDs, while `unlocked` records part IDs. Keep them separate so reloading never respawns an already-collected relic.

### Snapshot changes

Extend `SaveSnapshot` with optional structured stage state:

```ts
stageState?: Record<string, unknown>;
```

`SaveClient` must merge the incoming stage’s state into the existing `state.stageState` rather than replacing every stage’s state.

When advancing from Creature to Tribe:

- Preserve `stageState.creature`.
- Clear only Stage 2’s live numeric resources.
- Preserve the creature build for history/ending use.

### Migration

The v1 → v2 migrator should:

- Add an empty `stageState` when absent.
- For existing Creature saves, create a default creature build.
- Derive feeding from the old numeric diet:
  - `diet === 1` → `hunting-fangs`
  - otherwise → `grazing-jaws`
- Use `steady-legs` and `watchful-senses` for the other defaults.
- Map known existing creature trait IDs to equivalent unlocked parts where possible.
- Keep legacy trait IDs in the trait history; do not delete them.

### Validation

Add a server-side creature-part catalogue reader, following the existing cell-part catalogue pattern.

Validate:

- Equipped keys are exactly the supported slots.
- Every equipped/unlocked part ID exists.
- Equipped parts are present in `unlocked`.
- Collected IDs are strings from the known collectible catalogue.
- Arrays have sensible maximum sizes.
- Unknown object keys do not become trusted gameplay state.

### Files primarily involved

- `app/Domain/Campaigns/CampaignState.php`
- `app/Domain/Saves/SaveMigrator.php`
- `app/Http/Requests/StoreSaveRequest.php`
- `resources/game/saves/SaveClient.ts`
- `resources/game/bootstrap/main.ts`
- `docs/SAVE_FORMAT.md`

---

## 3. Creation screen stat clarity

### Replace ambiguous Efficiency display

The current value such as `13 / 3.5` combines two unrelated units. Render it as two explicit lines:

```text
Food gained       13 energy per mote
Movement cost     3.5 energy per second
```

Do not display a single Efficiency progress bar. Either remove that bar or replace it with two compact bars carrying their own labels.

Keep the underlying calculation unchanged:

- Food gained = base energy per mote + part modifiers.
- Movement cost = base moving drain + part modifiers.

### Attribute help

Add an accessible information button beside every attribute:

- Speed — “How quickly your cell moves through the world.”
- Attack — “How much damage you deal when colliding with prey or threats.”
- Defense — “Reduces damage taken from hostile cells and hazards.”
- Sense — “How far away food and danger can be detected or shown.”
- Food gained — “How much energy one ordinary nutrient restores.”
- Movement cost — “How much energy is consumed each second while moving.”

Requirements:

- Hover shows the explanation.
- Keyboard focus shows the explanation.
- Touch/click toggles it.
- Use `aria-describedby` or an equivalent accessible relationship.
- Do not rely only on the native `title` attribute.
- Ensure the help does not cover the selected-part controls on small screens.

Update the creation Playwright test to check both the explicit efficiency units and one keyboard-opened help description.

---

## 4. Stage 1: double length without slowing the opening

### Completion and growth tiers

Change the growth objective from 95 to 190.

Preserve the current early thresholds and append two late tiers:

```ts
tierThresholds: [0, 15, 35, 62, 105, 150]
tierScale:      [1, 1.4, 1.9, 2.5, 3.1, 3.6]
tierZoom:       [1, 0.78, 0.58, 0.44, 0.36, 0.30]
objectiveTarget: 190
```

Verify the minimum zoom does not expose areas outside world bounds.

Extend the enemy/prey size relationships so each added tier introduces at least one newly edible enemy class and retains at least one meaningful threat.

### Nutrient availability

Do not simply double the starting nutrient density, as that would shorten traversal and make the opening easier.

Instead:

- Keep approximately the current active nutrient count.
- Respawn consumed ordinary nutrients after eight simulation seconds.
- Keep a cap equal to the configured active count.
- Choose replacement positions deterministically from the scene RNG.
- Do not spawn inside hazards, directly under the player, or outside world margins.
- Preserve the current rich-mote probability.

This ensures the 190 target is always reachable without crowding the early map.

### Enemy pursuit duration

The “chasing too long” report belongs to Stage 1.

Add pursuit state to hostile `EnemyCell` instances:

- Maximum continuous player chase: four simulation seconds.
- After the limit, enter a two-second disengage cooldown.
- During disengage, return toward the cell’s home/wander region.
- The enemy cannot reacquire the player during cooldown.
- After cooldown, it may reacquire normally if the player is still within alert range.
- Immediately disengage if the player exceeds the normal chase leash.
- Reset chase duration after a complete disengagement.

Keep the red threat indicator visible only during active pursuit.

### Stage 1 tests

Add tests for:

- All six growth tiers.
- Completion only at 190.
- Early thresholds unchanged.
- A predator disengaging after four seconds.
- Reacquisition being blocked during cooldown.
- Reacquisition working after cooldown.
- Nutrient respawn respecting the active cap and exclusion zones.

---

## 5. Stage 2: creature builder and collectible parts

### Replace the current opening flow

Remove the separate:

1. Diet modal
2. One-free-adaptation modal

Replace them with one full “Evolve your creature” overlay before Stage 2 simulation begins.

The overlay should include:

- A reference thumbnail of the Stage 1 cell.
- A live preview of the evolved creature.
- Three part slots.
- A clear confirmation button.
- Stat/effect summaries for each selected part.
- Feeding choices that clearly state Herbivore or Carnivore.
- Copy explaining that more parts can be found during the stage.

The initial visual must still inherit:

- Palette.
- Body proportions.
- Pattern.
- Relevant membrane/feeding/movement/sensory/defense details from Stage 1.

### Part slots and catalogue

Create a new data-driven creature-part catalogue with these slots:

```ts
type CreaturePartSlot =
    | 'locomotion'
    | 'feeding'
    | 'adaptation';
```

Each part definition should contain:

```ts
interface CreaturePartDef {
    id: string;
    slot: CreaturePartSlot;
    name: string;
    description: string;
    diet?: 'herbivore' | 'carnivore';
    effects: {
        speedMultiplier?: number;
        hungerRisePerSec?: number;
        forageMultiplier?: number;
        preyMultiplier?: number;
        contactDamageMultiplier?: number;
        senseRadius?: number;
    };
    visual: {
        attachment: string;
    };
    starter: boolean;
}
```

### Starter parts

Provide these unlocked at Stage 2 start:

- `steady-legs`
  - Locomotion.
  - No modifier.
- `grazing-jaws`
  - Feeding.
  - Herbivore.
  - Normal vegetation reward; prey provides negligible nourishment.
- `hunting-fangs`
  - Feeding.
  - Carnivore.
  - Normal prey reward; vegetation provides only emergency hunger relief.
- `watchful-senses`
  - Adaptation.
  - No modifier beyond the base sense radius.

The player must choose one feeding part, making the separate diet value unnecessary for new saves.

### Discoverable upgrades

Place six deterministic relics across the Stage 2 world, two per slot:

- `bounding-legs`
  - +15% movement speed.
  - +0.2 hunger per second.
- `endurance-feet`
  - −5% movement speed.
  - −0.25 hunger per second.
- `grinding-molars`
  - Herbivore.
  - +50% nourishment from vegetation.
- `serrated-fangs`
  - Carnivore.
  - +50% nourishment from hunted prey.
- `thick-hide`
  - −25% predator contact damage.
  - −8% movement speed.
- `keen-eyes`
  - +250 world units of sense radius.

Relics must:

- Be distributed across separate biome/landmark regions.
- Never spawn in water.
- Never spawn at the initial player position.
- Be marked on the minimap only after entering sense range.
- Use a visually distinct non-food silhouette.
- Pause the game when collected.
- Open the creature builder with the new part highlighted.
- Allow “Equip now” or “Keep current”.
- Remain unlocked and available from the persistent Creature button.
- Never respawn after reload.

### Replace the Stage 2 trait drawer

During Stage 2:

- Rename the bottom-right Traits button to `Creature`.
- Open the creature builder instead of the generic trait drawer.
- Keep inherited Stage 1 traits active internally.
- Do not offer new purchasable creature traits alongside the part system.
- Convert existing creature-trait content into part definitions or legacy mappings.
- Change the third HUD meter from Evolution to `Parts`, displayed as `collected / 6`.
- Stop granting spendable evolution currency from Stage 2 food.
- Keep Growth/Nourishment as the stage completion resource.

Collecting all parts must not be required to finish the stage.

---

## 6. Stage 2 herbivore foraging

### Make visible vegetation functional

Extend terrain features with gameplay state:

```ts
interface TerrainFeature {
    // existing fields
    edible?: boolean;
    foodValue?: number;
    regrowSeconds?: number;
}
```

Use edible vegetation for:

- Grass.
- Flowers.
- Berry bushes.

Suggested base values:

- Grass: 0.6 nourishment, 14-second regrowth.
- Flower: 0.8 nourishment, 18-second regrowth.
- Berry bush: 1.4 nourishment, 25-second regrowth.

Apply the equipped feeding part’s multiplier.

### Presentation

- Edible plants get a subtle highlight/pulse within the player’s sense radius.
- Consumed plants fade or flatten and visibly regrow.
- Decorative vegetation without gameplay value should be visually quieter.
- Remove yellow-dot food as the herbivore’s primary interaction.
- Nests remain visible landmarks containing clusters of edible vegetation.
- Herbivore onboarding must explicitly say to graze the visible vegetation.
- Carnivore onboarding must explicitly say to hunt moving herbivores.

Carnivores may eat vegetation for hunger relief at 25% effectiveness, but it should contribute almost no growth.

### Stage 2 objective pacing

Keep the current growth target initially. Rebalance only if the new vegetation loop completes substantially faster than the existing stage.

Target playtest range:

- Herbivore: regular feeding opportunity every 10–20 seconds while exploring.
- Carnivore: fewer but richer successful feeds.
- Neither diet should require prolonged aimless walking.

---

## 7. Stage 2 red-enemy overlap/facing bug

The reported behavior suggests the predator can remain overlapped or fail to reconcile its movement heading with its rendered rotation.

### Fix requirements

- Resolve creature/wildlife overlap by separating the two entities to at least their combined collision radius.
- Use the previous valid separation direction when both centers are exactly equal.
- Apply separation before calculating the next chase heading.
- When water or bounds force a heading change, commit the corrected heading back to behavior state.
- Rotate the rendered body toward the corrected movement heading, not the stale requested heading.
- Do not allow the predator to occupy a fixed offset that follows the player indefinitely.
- Preserve the existing hit cooldown and knockback.
- Add a short post-hit predator recoil so the player can visibly see the contact.

### Tests

Cover:

- Exact center overlap.
- Vertical and horizontal overlap.
- Water-forced turn.
- Bounds-forced turn.
- Body rotation matching actual movement.
- Predator no longer following at a permanently fixed player-relative offset.

---

## 8. Strategic resource and action clarity

### Resource descriptions

Extend `StageResource`:

```ts
interface StageResource {
    id: string;
    label: string;
    description: string;
    start: number;
    perTick: number;
}
```

Add descriptions for every strategic resource, including Stage 6 for consistency.

Required Stage 3–5 descriptions:

- Food — sustains people and pays for growth, gatherings, and expeditions.
- Materials — wood, stone, hides, and crafted supplies used for construction.
- People — the tribe’s available population and workforce.
- Culture — shared identity and traditions; Stage 3’s objective.
- Wealth — tradeable value used to fund buildings, diplomacy, and institutions.
- Technology — accumulated knowledge; Stage 4’s objective and era trigger.
- Industry — productive capacity used to fund global projects.
- Ecology — biosphere health; low ecology can stall unity.
- Unity — planetary cooperation; Stage 5’s objective.

Render an accessible info control beside each resource label.

### Never expose internal resource IDs

All visible costs, event effects, tooltips, and logs must resolve through the resource definition’s display label.

Examples:

- `25 Wealth`, never `25 gold`.
- `+0.9 Food/s`, not `food: 0.9`.
- `−10 Ecology`, not `ecology -10`.

### Action availability

Centralize action availability instead of returning only a boolean:

```ts
interface ActionAvailability {
    allowed: boolean;
    reason:
        | 'available'
        | 'maxed'
        | 'missing-requirement'
        | 'insufficient-resources'
        | 'era-locked'
        | 'no-target';
    message: string | null;
}
```

`canTakeAction` may remain as a wrapper around `actionAvailability(...).allowed`.

Use this priority for disabled explanations:

1. Repeat cap reached.
2. Era not unlocked.
3. Required project missing.
4. No valid target.
5. Resource shortfall.

Action views should include:

```ts
effectLabel: string;
availabilityMessage: string | null;
locationLabel?: string;
```

Examples:

- `Effect: +0.9 Food/s`
- `Requires: Raise granaries`
- `Need 8 more Wealth`
- `Built 3/5 · next cost 23 Materials`

This specifically fixes the aqueduct case: if the player has enough Food and Wealth but has not built a granary, the disabled card must say so.

Update action-card signatures so changes to cost, effect, count, or availability cause a rerender.

---

## 9. Located strategic actions must feel like actions

The sidebar currently lists actions that merely navigate to their map anchor.

### Sidebar behavior

Located action cards must visibly say:

```text
At: Foraging grove
Go there to organise foraging
```

Use a `Go to site` button rather than styling navigation exactly like an immediate action.

After navigation:

- Select the correct site automatically.
- Highlight the intended action in the contextual bar.
- Keep the card description visible.
- Do not require the player to rediscover which button they originally clicked.

### On successful action

Show a compact outcome toast for approximately three seconds:

```text
Foraging organised
Food production +0.9/s
```

Also create a map-level visual at the correct anchor:

- Organise foraging: gatherers, baskets, or a harvest patch at the grove.
- Learn toolmaking: a work area/fire/flint effect at the flint beds.
- Fish weirs: a structure at the river.
- Cave paintings: markings at the cave.
- Planetary industry: industrial structure at the selected region.
- Green technology: clean-energy or regrowth effect at the selected region.

On reload, reconstruct these visuals deterministically from `state.taken`.

Do not place every strategic action’s generic building at the home settlement.

---

## 10. Strategic camera safe area

The management sidebar is approximately 26rem wide and currently overlays part of the Phaser camera.

### Required behavior

On desktop management stages:

- Measure the actual visible sidebar width.
- Convert that CSS width into Phaser design coordinates using the canvas-to-DOM scale.
- Set the strategic camera viewport to the unobscured left portion.
- Recalculate camera bounds when the browser resizes or the panel width changes.
- Keep the minimap and selection bar inside the unobscured area.
- Direct-control scenes continue using the full viewport.

All automatic camera movements must use a shared `focusMapPoint()` helper:

- Located actions.
- New rival arrivals.
- Raid introductions.
- Event theatre.
- Scout discoveries.
- Site selection.
- Era/city focus moments.

The focused target must land near the center of the unobscured map viewport, never beneath the sidebar.

Ensure the camera can still pan far enough to bring world-edge rivals into view. Camera clamping must use the reduced viewport width.

---

## 11. Stage 3 improvements

### Repeatable self-development

Keep Songs, Rituals, and Totem as meaningful one-time cultural milestones.

Add:

```json
{
  "id": "community_gathering",
  "label": "Host a community gathering",
  "description": "Food, stories and shared work deepen the tribe’s identity.",
  "cost": {
    "food": 18,
    "materials": 6
  },
  "grants": {
    "culture": 3
  },
  "rate": {
    "culture": 0.08
  },
  "requires": ["songs"],
  "once": false,
  "maxRepeat": 5,
  "costGrowth": 1.5,
  "anchor": "home"
}
```

This guarantees the player can continue developing the tribe after completing the one-time cultural chain.

Retain existing repeatable projects such as huts, foraging, toolmaking, weirs, paintings, salt, and thicket harvesting, but make their effects and repeat counts explicit in the UI.

### Attack readability

Strategic raids should last at least 2.1 real-time seconds, regardless of 1×/2×/4× simulation speed:

1. 500 ms camera focus and warning.
2. 900 ms visible enemy approach.
3. 350 ms impact/defense effect.
4. 350 ms consequence display.

Show the attacker’s name and the exact lost resource after impact.

Do not apply the resource loss before the visible impact.

---

## 12. Stage 4 improvements

### Wealth/gold consistency

Keep `gold` as the internal resource ID if desired, but expose only `Wealth` in the UI.

Audit:

- Action cards.
- Contextual selection bar.
- Diplomacy costs.
- Event outcomes.
- Dev tools.
- Activity log.
- Objective/status copy.

### Era unlock field

Extend `StageAction` with:

```ts
availableFromEra?: 'bronze' | 'iron' | 'classical';
```

Era-locked projects remain visible but disabled with messages such as:

```text
Unlocks in the Iron Age
```

### Era transition presentation

When Technology crosses 45 or 90:

- Pause strategic simulation using an event-like transition pause.
- Show an era title card for approximately 1.2 seconds.
- Display a short explanation of what became available.
- Reskin all existing placed buildings.
- Update roads, map/city color treatment, and ambient details.
- Play the existing evolution sound and a restrained flash.
- Resume only after the transition finishes.

Iron Age must be visibly different from Bronze even before the player places a new building.

### Era-specific repeatable projects

Add:

#### Bronze Age: Civic works

```json
{
  "id": "civic_works",
  "label": "Commission civic works",
  "cost": {"food": 15, "gold": 12},
  "rate": {"tech": 0.08},
  "requires": ["markets"],
  "once": false,
  "maxRepeat": 4,
  "costGrowth": 1.5,
  "placement": true,
  "anchor": "home",
  "availableFromEra": "bronze"
}
```

#### Iron Age: Expand foundries

```json
{
  "id": "foundries",
  "label": "Expand the foundries",
  "cost": {"food": 18, "gold": 22},
  "rate": {"tech": 0.14, "gold": 0.2},
  "requires": ["writing"],
  "once": false,
  "maxRepeat": 4,
  "costGrowth": 1.55,
  "placement": true,
  "anchor": "home",
  "availableFromEra": "iron"
}
```

#### Classical Age: Public institutions

```json
{
  "id": "institutions",
  "label": "Found public institutions",
  "cost": {"food": 25, "gold": 35},
  "rate": {"tech": 0.22},
  "requires": ["academy"],
  "once": false,
  "maxRepeat": 4,
  "costGrowth": 1.6,
  "placement": true,
  "anchor": "home",
  "availableFromEra": "classical"
}
```

Create era-appropriate building visuals for these actions.

---

## 13. Stage 5 improvements

### Clarify located projects

`Build industry` and `Green technology` must use the located-action flow described above:

- Sidebar clearly says where the action occurs.
- Navigation automatically selects the region and highlights the action.
- Performing the action shows its immediate and rate effects.
- A visible regional structure/effect appears.

### Guaranteed ecology recovery

Add a Council action:

```json
{
  "id": "habitat_restoration",
  "label": "Fund habitat restoration",
  "description": "Restore damaged ecosystems and establish permanent recovery programmes.",
  "cost": {
    "industry": 18
  },
  "grants": {
    "ecology": 10
  },
  "rate": {
    "ecology": 0.25
  },
  "requires": ["green"],
  "once": false,
  "maxRepeat": 8,
  "costGrowth": 1.45
}
```

Requirements:

- It must remain usable when Ecology is zero.
- Industry must continue accumulating while Unity is stalled.
- The action’s immediate Ecology grant must occur before the next ecology tick.
- The maximum eight purchases must be sufficient to turn every legal industrial build combination into a positive ecology rate.
- Add a warning when Ecology is falling:
  - `Ecology declining: −0.2/s`
- At zero:
  - `Unity is paused, but Industry continues. Fund restoration to recover.`

Test the worst legal action combination and confirm that the player can always recover without rival interaction or a random event.

### Prevent settlements in water

For the Planetary map, build the land mask around gameplay coordinates rather than independently from them.

Before random decorative continents are added, guarantee a land patch beneath:

- Home.
- Every actionable site.
- Every rival.
- Every arrival point.

Use a minimum land radius of approximately 140 world units around each anchor and blend those patches into larger continent shapes.

Add a pure `isPlanetLand(x, y)` helper used by generation tests. Every site/rival/home coordinate must return true.

Water remains valid as visual space, but no settlement or clickable regional marker may be placed in it.

---

## 14. Automated tests

### Vitest

Add or extend tests for:

- Creation efficiency formatting helper, if extracted.
- Six Stage 1 tiers and 190 completion target.
- Stage 1 pursuit duration and cooldown.
- Deterministic nutrient respawning.
- Creature-part catalogue validation.
- Part effect aggregation.
- Feeding part determining diet.
- Herbivore/carnivore reward multipliers.
- Edible feature regrowth.
- Relic placement outside water/spawn exclusion.
- Relic persistence and no respawn after collection.
- Exact-overlap wildlife separation.
- Rendered heading matching corrected movement.
- Action availability reasons.
- Resource label resolution.
- Repeat count and cost growth.
- Era action gating.
- Habitat restoration recovering the worst legal ecology rate.
- Planetary anchors always landing on land.

### Laravel feature tests

Add coverage for:

- v1 → v2 save migration.
- Default Creature state derived from old diet values.
- Valid Stage 2 build save.
- Rejection of unknown part IDs.
- Rejection of equipped-but-not-unlocked parts.
- Preserving Creature state when advancing to Tribe.
- Manual save/restore retaining creature build state.

### Playwright

Update/add journeys for:

- Creation stat help opens with keyboard focus.
- Efficiency uses explicit units.
- Stage 2 opens the combined creature builder.
- Selecting grazing jaws starts an herbivore build.
- Builder confirmation starts onboarding.
- Creature button reopens the builder.
- Event modal pauses and Continue resumes.
- Pause control appears beside speed controls.
- Stage 3 action card exposes effect and location.
- Repeatable action increments its count and next cost.
- Aqueduct disabled state explains its missing prerequisite.
- Stage 4 action costs say Wealth.
- Iron Era transition reveals an Iron project.
- Stage 5 restoration remains available at zero Ecology.
- Strategic focus targets remain left of the sidebar.

### Verification commands

Run:

```bash
npm run typecheck
npm test
php artisan test
npm run build
npm run test:e2e
```

Do not finish with known TypeScript errors, failing tests, or browser console errors.

---

## 15. Manual acceptance checklist

- A creator configuration that previously showed `13 / 3.5` now explains both values and units.
- Stage 1 reaches its old final tier at roughly the previous point, then continues through two new tiers to 190.
- A Stage 1 enemy visibly gives up after sustained pursuit.
- Stage 2 never shows the old diet and single-adaptation modal sequence.
- A herbivore can eat visible grass, flowers, and bushes without searching for yellow dots.
- Walking directly over a red Stage 2 enemy cannot make it attach above the player.
- At least one optional creature relic is easy to discover during an ordinary Stage 2 run.
- Organise Foraging and Learn Toolmaking visibly alter their map sites and explain their production change.
- A Stage 3 raid can be followed visually from warning through impact.
- Players can continue increasing Culture after the unique cultural milestones.
- Every strategic resource has accessible explanatory text.
- Aqueduct clearly states whether it lacks Wealth, Food, or a granary prerequisite.
- Iron Age produces an unmistakable transition and unlocks foundries.
- A new rival at the right map edge appears in the playable viewport, not under the sidebar.
- Stage 5 settlements appear on land.
- Ecology can recover from zero through a player-controlled action.
- Every event freezes the game until its outcome is dismissed.

## Out of scope

- A freeform Spore-style mesh/body editor.
- More than three active creature-part slots.
- Making all six Stage 2 collectibles mandatory.
- A separate economy/rules simulation for each Civilisation era.
- Unlimited strategic construction.
- Replacing the existing strategic engine with stage-specific scene implementations.
