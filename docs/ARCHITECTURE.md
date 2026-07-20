# Architecture — One Small Life

## Stack

| Concern | Choice |
|---|---|
| Framework | Laravel 13 (PHP 8.4) |
| Auth | Laravel Breeze, Blade stack |
| Views | Blade + Tailwind CSS v3 |
| Interactive UI | TypeScript controllers (no SPA framework) |
| Gameplay | Phaser 4 scenes |
| Build | Vite 8 |
| Database | MySQL 8 |
| PHP tests | Pest |
| TS tests | Vitest |
| E2E | Playwright (critical journeys) |
| Local env | DDEV (PHP 8.4, MySQL 8.0, Node 20) |

## Rendering boundary (brief §8)

```
┌───────────────────────────────────────────────┐
│ DOM / Blade HUD layer  (z: hud → tooltip)      │  ← text, menus, modals,
│   • resource chips, vitals, objective          │    trait cards, settings,
│   • trait drawer, event modal, pause, settings │    save status, a11y labels
├───────────────────────────────────────────────┤
│ Phaser canvas  (z: world)                      │  ← organisms, environment,
│   • world, movement, collision, world FX       │    predators, collectibles
└───────────────────────────────────────────────┘
```

The DOM never renders gameplay; Phaser never renders standard UI text. They
communicate through a thin event bridge (a typed pub/sub), so the HUD reacts to
world events and input controls dispatch intents into the scene.

## Phaser composition (brief §9)

- `Scale.FIT`, 16:9 design canvas, letterboxed.
- DOM HUD positioned relative to the actual canvas bounds.
- SVG parts loaded at intended display size (Cell source 256², displayed ~160²,
  portrait 128²) — never load huge textures and downscale blindly.

## Directory structure

```
app/
  Domain/
    Campaigns/        # CampaignState aggregate, stage contract
    Saves/            # serialisation, validation, migrations
    Species/          # species identity, portrait spec
    Traits/           # trait catalogue, requirements/conflicts
    Events/           # event eligibility
  Http/
    Controllers/
    Requests/         # form-request validation (save payloads, setup)
  Models/             # User, Campaign, Save, ...

resources/
  css/
    app.css           # imports fonts + tokens + tailwind layers + base
    tokens.css        # Tidepool design tokens (CSS custom properties)
  views/
    layouts/          # guest, app, (game — planned)
    components/
      ui/             # brand-mark, wordmark, panel, button (+ planned HUD kit)
      ...             # Breeze primitives restyled to Tidepool
    auth/ campaigns/ game/
  game/               # TypeScript + Phaser
    lib/              # rng.ts (+ tests) and shared utilities
    bootstrap/ scenes/ entities/ systems/ state/
    generation/ traits/ events/ saves/ input/ ui/
    assets/ data/

docs/
tests/ Feature/ Unit/
```

Later-stage asset folders (`tribe/`, `civilisation/`, `planetary/`, `space/`)
exist only when needed — empty until the vertical slice is validated.

## Domain contract (brief §23)

A shared `CampaignState` is the single aggregate. Each stage implements a common
contract: `start`, `load`, `pause`, `save`, `complete`, `fail`,
`exportConsequences`, `importConsequences`. Separate concerns: rendering, input,
rules, state, generation, save serialisation, content definitions, asset
metadata, DOM controllers.

## Trust boundary (brief §22)

The browser runs the live simulation; the server owns persistence. No arbitrary
client state is trusted. Every save is validated server-side for shape, allowed
identifiers/traits, numeric ranges, legal stage transitions, ownership and schema
version. Major metadata is relational; complex stage state is validated JSON.

## Determinism (brief §19)

All procedural generation flows from a stored seed through `Rng`
(`resources/game/lib/rng.ts`). Saves store seed, generator version, content
version and save-schema version so a campaign can be regenerated/migrated.
