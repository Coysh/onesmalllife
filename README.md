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

Laravel 13 · PHP 8.4 · Laravel Breeze (Blade) · Tailwind CSS v3 · TypeScript ·
Phaser 4 · Vite 8 · MySQL 8 · Pest · Vitest · Playwright · DDEV (local).

## Local development

Local development runs in [DDEV](https://ddev.com), so the only prerequisites on
your machine are DDEV and a container runtime (Docker Desktop, OrbStack, or
Colima). PHP, Node, Composer and MySQL all live in the containers — nothing is
installed on the host.

```bash
ddev start                    # builds/starts containers, writes DB creds into .env
ddev composer install
ddev npm ci
ddev exec php artisan key:generate
ddev exec php artisan migrate
```

Then open <https://onesmalllife.ddev.site>.

For HMR while you work:

```bash
ddev npm run dev              # Vite at https://onesmalllife.ddev.site:5173
```

`vite.config.js` detects DDEV via `IS_DDEV_PROJECT` and binds `0.0.0.0` with a
`wss` HMR endpoint the host browser can reach; outside DDEV it falls back to
Vite's normal localhost defaults, so a native `npm run dev` still works.

The container versions are pinned in `.ddev/config.yaml` and deliberately track
the Ploi target: **PHP 8.4**, **MySQL 8.0**, **Node 20**.

Useful commands:

```bash
ddev ssh                      # shell in the web container
ddev mysql                    # mysql client against the project DB
ddev describe                 # URLs, ports, service status
ddev stop                     # stop containers (ddev poweroff stops all projects)
```

Production build: `ddev npm run build`.

## Tests

```bash
ddev exec php artisan test   # Pest — auth, campaign flow, saves, endings, chronicle, sharing
ddev npm test                # Vitest — deterministic TS game logic
ddev npm run test:e2e        # Playwright — full-journey / stage-progression specs
ddev npm run typecheck       # tsc --noEmit
```

Pest runs against in-memory SQLite (`phpunit.xml`), so it needs no local MySQL
and leaves your dev database alone. The Playwright e2e specs do **not** — they
register real accounts against whatever `.env` points at.

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
