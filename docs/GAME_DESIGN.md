# Game Design — One Small Life

> One small life. An entire universe of possibilities.

## Product definition

One Small Life is a focused, single-player, browser-based evolution game. The
player guides **one continuous lineage** from a primitive cell through creatures,
tribes, civilisations, a whole planet, and finally the stars. Even at
interstellar scale, the game keeps the sense that everything began with one small
organism. A normal campaign runs ~5–8 hours; the player's species, choices and
generated history become the story (no heavy predetermined narrative). After an
ending, optional extended play continues the lineage.

It is **not** a scientific simulator, survival game, city-builder, grand-strategy
sim, or infinite galaxy. Scale is created through procedural combinations,
reusable modular art, meaningful persistent choices, generated names/histories,
lightweight faction simulation, trait interactions, curated events and branching
endings — never by simulating thousands of invisible entities.

## Visual direction — Tidepool

Rounded-organic flat vector; warm bioluminescent colour over a dark teal-black
foundation ("the tank"); soft translucent HUD; bold readable silhouettes;
restrained gradients; soft atmospheric depth. Friendly but sophisticated.
The impression: *a warm lamp over a dark tank, not a cold scientific simulator.*
Avoid photorealism, pixel art, 3D, mobile-game gloss, excessive cuteness, dense
grand-strategy UI, DNA-helix/rocket clichés, or any imitation of other games.

## Core principles

- **Controlled scope** — feel big without simulating everything.
- **Faster pacing** — a choice, discovery, threat, reward, mutation or milestone
  should always be near; avoid grind, unopposed travel and progress-bar waiting.
- **Meaningful continuity** — early traits shape later choices, faction
  reactions, tech, events, resource needs, and ending availability. No single
  optimal path; strong traits carry costs and trade-offs.
- **Soft failure** — bad decisions cause setbacks (population/territory loss,
  shortages, rivals advancing), not instant game-over. A stage only fails when no
  viable continuation remains; then restart the stage or restore a checkpoint —
  never delete the lineage.

## Stage-by-stage scope table

| # | Stage | View | Target length | Core loop / systems | Key HUD |
|---|---|---|---|---|---|
| 1 | Cell | 2D side-on, direct control | 20–30 min | explore, absorb, avoid/confront, adapt, evolve, reach multicellular | Energy, Integrity, Evolution, Objective, Threat, Environment |
| 2 | Creature | 2D side-on, direct + light mgmt | 45–60 min | forage, shelter, meet species, compete, reproduce, pass on adaptations, socialise | Health, Hunger/Energy, Social, Habitat, Pack/Family, Evolution |
| 3 | Tribe | Top-down regional map | 45–60 min | food, materials, roles, relationships, territory, construction, culture, rivals | resources, population, relationships |
| 4 | Civilisation | Top-down strategy map | 60–90 min | settlements, tech, culture, diplomacy, conflict, exploration, impact | settlements, tech, diplomacy |
| 5 | Planetary | Simplified global map | 45–75 min | planet-scale decisions: unify, federate, dominate, survive a crisis, repair, launch a space programme | planet health, factions, research |
| 6 | Space | Stylised 2D star map | 90–150 min | explore, colonise, research, diplomacy, resources, anomalies, legacy, endings | star map, resources, research |

Guidelines, not timers. Every star system must justify itself with at least one
meaningful feature (resource, civilisation, mystery, hazard, event, discovery,
or ending choice) — no endless identical planets.

## Trait system

One data-driven trait model shared across stages (see `CONTENT_FORMAT.md`). Four
UI categories, each colour **and** shape: Biological, Behavioural, Cultural,
Technological. Persistent categories (diet, body, movement, senses, defence,
reproduction, intelligence, social, aggression, environment, cooperation,
curiosity, cultural philosophy) carry forward and gate later options.

## Modular organism system

The Cell organism is composed from layered parts in a Phaser container using
`cell-parts.schema.json`: 11-layer order, normalised anchors, container-level
facing flip, top-left lighting, tintable greyscale albedo + fixed detail, one
pattern and one shared shadow per organism. The **species portrait is composed
from the identical runtime parts** (128² frame, ~80% scale, facing right) so it
can never drift from the playable creature.

## Endings (brief §21)

~5 ending families, resulting from accumulated decisions (not one final choice),
with original names. Themes may include: interstellar federation, ecological
stewardship, expansionist empire, technological transcendence, seeding new life,
or deliberate isolation. The ending sequence shows the species portrait, final
civilisation state, major inherited traits, key historical events, the ending
achieved, key stats, and a generated legacy summary closing on the sentiment
*"It began with one small life."* Then optional extended play. New Game+ is **not**
assumed — it is a separate product decision.

## 2026-07 Immersion & Scale overhaul (implemented)

Every stage now plays in a **scrolling world larger than the viewport**
(`lib/worldCamera`, `ui/Minimap`); art stays code-drawn flat vector but is
cached into textures for scale (`lib/spriteFactory`, catalogues under
`data/sprites/`).

- **Creator**: Spore-style part builder (body/membrane/feeding/movement/
  sensory/defense/pattern/palette) with real stat effects
  (`data/cell-parts.catalog.json` — single source for PHP validation,
  portraits, stat bars and in-game tuning via `systems/partEffects`).
- **Cell**: 4000×3000 microcosm, 3 growth tiers with camera zoom-out
  (`systems/cellGrowth`), 7 enemy cell archetypes whose food-chain position
  flips as you grow; equal-tier fights can be won with a high-attack build.
- **Creature**: 5120×3600 top-down habitat (`systems/terrain` seeded biomes,
  nests, water), herbivore herds + territorial predators + kin
  (`entities/WildCreature`), momentum movement, finite respawning nest food.
- **Strategic grammar v2** (`data/stages.json`): per-stage map + sites,
  MULTIPLE rivals with archetypes (aggressive/trader/builder/enigmatic), fog
  of war + repeatable scouting, onboarding coach marks, per-event map visuals
  played by `scenes/strategic/EventTheatre` (raider marches, arrivals,
  weather washes, launches) over `scenes/strategic/StrategicMap`.
- **Civilisation** is a `CityScene` subclass: placement-flagged decisions are
  physically placed on a city grid (`systems/cityPlan`), roads auto-draw,
  era thresholds re-skin every building (bronze→iron→classical), trade routes
  run caravans, and weakened rivals can be conquered (`fac_conquer`).
- **Planetary**: whole-globe map whose land greys and smogs as ecology falls;
  ecology at 0 stalls unity (`ecologyStalled`); rivals are power blocs whose
  "raids" are sanctions.
- **Space**: fogged starmap; repeatable probes reveal systems, colonies claim
  them (rate bonuses + starlanes); the enigmatic elder rival claims systems
  at its milestones (`milestoneEffect: claimSite`).
- **Pacing** is regression-tested: `systems/pacing.test.ts` scripts a
  reasonable player through every strategic stage and asserts completion in
  240–600 sim-seconds; direct stages have derived travel-time floors.
