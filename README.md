# One Small Life

> One small life. An entire universe of possibilities.
> From one cell to the stars.

One Small Life is a free, single-player, browser-based evolution game. You guide
**one continuous lineage** from a single cell through creatures, tribes,
civilisations, a planet, and finally the stars. It is built as a Laravel monolith
with a Blade/Tailwind interface and Phaser gameplay scenes, in the **Tidepool**
visual direction (warm bioluminescent life over a dark teal-black tank).

The playable arc is in place end to end: campaign creation, the staged
Cell→Creature→Tribe→Civilisation→Planet→Stars progression, trait selection and
portrait composition, autosave plus manual save slots, the run chronicle,
ending resolution, and opt-in unlisted sharing of a finished lineage. See
[`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) for what remains.

## Gameplay at a glance

- **One lineage, six stages.** A campaign carries a single continuous lineage;
  each stage transition mutates the same `CampaignState` rather than starting over.
- **Traits are cumulative.** Choices taken as a cell still read on the creature
  and the civilisation that follow (`app/Domain/Species/TraitCatalog.php`).
- **Deterministic.** A campaign's seed drives generation, so the same seed
  replays identically — which is what makes the save format migratable
  (`app/Domain/Saves/SaveMigrator.php`).
- **Saves.** One rolling autosave plus numbered manual slots, both versioned and
  validated server-side; the browser is never trusted with campaign state.

## Documentation

| Doc | Contents |
|---|---|
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | Product definition, Tidepool direction, stage scope, traits, endings |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, rendering boundary, directory structure, trust boundary |
| [docs/DESIGN_HANDOFF_AUDIT.md](docs/DESIGN_HANDOFF_AUDIT.md) | Design inventory, screen & component matrices, behaviour discrepancies |
| [docs/SAVE_FORMAT.md](docs/SAVE_FORMAT.md) | Campaign-state model, DB schema, save payload, validation |
| [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md) | Trait / event / palette / part data formats |
| [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) | Asset tiers, naming, placeholder policy |
| [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) | Phases, vertical-slice backlog, risks, next task |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture & product decision log |

## Tech stack

Laravel 13 · PHP 8.3+ · Laravel Breeze (Blade) · Tailwind CSS v3 · TypeScript ·
Phaser 4 · Vite 8 · PostgreSQL 16 · Pest · Vitest · Playwright.

## Local development

Prerequisites: PHP 8.3+ (`composer.json` requires `^8.3`), Composer,
**Node 20+** (Vite 8 requires 20.19+), PostgreSQL 16.

```bash
# 1. Dependencies
composer install
npm install

# 2. Environment
cp .env.example .env          # if you don't already have a .env
php artisan key:generate
# set DB_CONNECTION=pgsql and the one_small_life database in .env

# 3. Database
createdb one_small_life
php artisan migrate

# 4. Run (two terminals)
php artisan serve             # http://127.0.0.1:8000
npm run dev                   # Vite dev server / HMR
```

Production build: `npm run build`.

## Tests

```bash
php artisan test     # Pest — auth, campaign flow, saves, endings, chronicle, sharing
npm test             # Vitest — deterministic TS game logic
npm run test:e2e     # Playwright — full-journey / stage-progression specs
npm run typecheck    # tsc --noEmit
```

Pest runs against a separate test database; see `phpunit.xml`.

## Design system

- Tokens: `resources/css/tokens.css` (CSS custom properties, Tidepool).
- Tailwind theme mirror: `tailwind.config.js`.
- Fonts: self-hosted via `@fontsource` (Bricolage Grotesque, Hanken Grotesk,
  Space Mono) — no runtime CDN.
- Reusable Blade primitives under `resources/views/components/` (+ `ui/`).

## Deployment

Target: a personal VPS via Ploi, auto-deploying from GitHub. The app has no
runtime LLM dependency.

Full step-by-step instructions: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Architecture and trust boundary: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
