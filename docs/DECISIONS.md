# Architecture & Product Decisions — One Small Life

A running log of decisions and the reasoning behind them. Newest at the top.
Format: **Decision** — context → choice → consequence.

## 2026-07-18 — Foundation session

### D1. Stack: Laravel 13 + Breeze (Blade) + Tailwind v3 + Phaser 4 + Vite
Laravel monolith per brief §8. Breeze Blade stack gives first-party, low-JS auth
that a PHP developer can maintain. Breeze installed Tailwind **v3** (classic
`tailwind.config.js`), which is convenient because the handoff's
`tailwind.theme.js` is a `theme.extend` drop-in. Phaser 4 for gameplay scenes
(added but not yet wired). Consequence: no React; interactive UI is Blade +
small TS controllers + Phaser.

### D2. Database: PostgreSQL locally and in production
Chosen over the SQLite-local pattern so local matches the Ploi/VPS target
exactly. Installed `postgresql@16` via Homebrew; app DB is `one_small_life`.
Consequence: migrations and JSON columns are authored against Postgres.

### D3. Tests run on in-memory SQLite
`phpunit.xml` keeps Laravel's default `DB_CONNECTION=sqlite`, `:memory:` for
speed and isolation. Consequence: Postgres-specific SQL must be exercised
separately (a CI job against Postgres is planned) — noted so we don't assume
SQLite coverage proves Postgres behaviour.

### D4. Fonts self-hosted via @fontsource
Brief §7 wants a reliable production font approach and forbids committing
unlicensed fonts. The three families are OFL-licensed; `@fontsource` self-hosts
them and Vite bundles the woff2. No runtime CDN. The variable packages register
as `"… Variable"`, so token font stacks lead with those names.

### D5. Node 20 via Homebrew
The machine had Node 14 (too old for Vite 8 / Phaser tooling). Installed
`node@20` (keg-only; add to PATH). Consequence: developers must have Node 18+.

### D6. Deterministic RNG foundation now
Added `resources/game/lib/rng.ts` (mulberry32 + xmur3 seed hash) with Vitest
coverage. It is the seam every generator will use (brief §19). Small, readable,
portable.

### D7. Prototype behaviours NOT implemented
Per brief §3 and the audit: "Play offline first", the login-cooldown message,
and "New Game+" are visual examples / unapproved — deliberately omitted. They
are recorded as deferred, to be raised as product decisions later.

### D8. TypeScript 7 (native compiler)
`npm i -D typescript` resolved to 7.x (native `tsc`). It removed `baseUrl`;
`tsconfig.json` uses relative `paths` instead. `npm run typecheck` is green.

### D9. Autosave via a validated JSON endpoint
The client posts `CampaignState` to `POST /play/{campaign}/save` at safe points
(stage complete, pause, every 15s). `StoreSaveRequest` validates shape, allowed
stages, schema version and numeric ranges; the controller enforces ownership
(policy) and legal stage transitions; active traits are projected into
`campaign_traits`. Slot 0 is the autosave. Gotcha fixed: the default
`bootstrap/app.php` only rendered JSON errors for `api/*`, so validation on the
save route redirected (302) instead of returning 422 — now also renders JSON
when `$request->expectsJson()`.

### Open decisions (need a product call before the relevant phase)
- Autosave retention count (prototype said "last three").
- Whether New Game+ ships at all.
- Save-slot limit per account.
- Email verification on/off for first release (currently Breeze default: off).
