# Development Plan — One Small Life

The **Cell → Creature vertical slice** is complete and validated. A full
**beginning-to-end path now exists**: Cell → Creature (direct control) → Tribe →
Civilisation → Planetary → Space (a shared data-driven management framework) →
resolved **ending** + species history. Art is placeholder; audio is absent; those are the ongoing work.

Polish landed on every stage: Cell + Creature have predators/rivals with
directional threat cues and trait-driven visuals; the four strategic stages
share a curated event system + rival factions that race you to the objective.

Presentation & surface completed: species-portrait rig (composed from parts),
icon family, settings screen + persistence (reduce-motion/contrast/text/volumes),
new-campaign builder (palette/body/pattern) reflected in portrait + organism,
loading screen, manual save slots, extended play, synthesised audio, play-time
tracking, save-migration framework, and a Playwright critical-journey e2e.

Known remaining: real authored artwork (still Tidepool placeholder vectors),
richer tablet chip-collapsing, deeper trait sets for later stages.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Design & architecture intake, docs, tokens/schema | ✅ done |
| 1 | App & design shell: Laravel, auth, fonts, tokens, primitives, landing, auth screens | ✅ done (save-slot / setup / pause / settings shells pending) |
| 2 | Game shell: Phaser bootstrap, responsive canvas, DOM overlay, interface-shell zones, save indicator, resource chips, objective, speed, alerts, input abstraction, settings persistence | 🟡 mostly done (settings persistence pending) |
| 3 | Shared systems: campaign state ✅, save serialisation + validation ✅, stage transitions ✅, trait defs + requirements/conflicts + card states ✅, trait effects ✅; event eligibility, seeded generation, species history, asset manifest loader, palettes ⬜ | 🟡 in progress |
| 4 | Cell vertical slice: modular renderer ✅, movement ✅, nutrient collection ✅, energy ✅, integrity ✅, objectives ✅, stage completion ✅, trait selection + evolution feedback ✅; representative part kit, threats, environment ⬜ | 🟡 playable + evolvable |
| 5 | Creature vertical slice: initial renderer ✅, side-on habitat ✅, feeding/survival ✅, persistent Cell consequences (inherited traits) ✅, objectives ✅, save/load ✅; pack/social state, creature builder ⬜ | 🟡 playable |
| 6 | Slice validation: keyboard ✅, save reliability ✅, deterministic generation ✅, trait persistence ✅, Cell→Creature transition ✅; responsive, touch targets, reduced motion, performance, asset coherence ⬜ | 🟡 in progress |

Only after Phase 6 should Tribe or later-stage artwork begin.

## What is already done (this session)

- Laravel 13 + Breeze (Blade) on MySQL 8; Pest suite green.
- Tidepool tokens (`resources/css/tokens.css`) + Tailwind theme; self-hosted
  fonts; base layer + ambient motion (reduced-motion aware).
- Reusable Blade primitives: buttons, fields, labels, errors, panels, brand
  mark, wordmark. All six auth screens restyled to Tidepool.
- Landing/title screen.
- Deterministic `Rng` (`resources/game/lib/rng.ts`) + Vitest (7 tests) +
  TypeScript typecheck; Phaser 4 installed.
- Full docs set.

## Vertical-slice backlog (ordered)

1. **Campaign domain + persistence** — `Campaign`, `CampaignSave`,
   `CampaignTrait` models + migrations; `CampaignState` value object; save/load
   controllers + `StoreSaveRequest` validation; ownership policies. Tests:
   ownership, save create/load, invalid payloads, schema version, illegal stage
   transitions, unauthorised access.
2. **Save-slot + new-campaign screens** — slot list, create form (name + seed),
   deterministic seed generation. Tests: slot CRUD, campaign creation.
3. **Trait + event systems (TS)** — load `traits.json`/events; requirements,
   conflicts, eligibility, weighting; card-state resolver. Vitest: requirements,
   conflicts, eligibility, persistent modifiers, serialisation.
4. **Game shell** — `layouts/game.blade.php` interface-shell zones; Phaser boot
   with `Scale.FIT`; DOM↔Phaser event bridge; save-status indicator; resource
   chips; objective; speed control; alert system; input abstraction; settings
   persistence + reduced-motion.
5. **Modular Cell renderer** — Phaser container from `cell-parts.schema.json`;
   representative part kit (≥3 coherent, mechanically distinct organisms);
   placeholder vector parts at correct dimensions; portrait rig. Vitest:
   part-compatibility, portrait == gameplay parts.
6. **Cell loop** — movement, nutrient motes, energy/integrity, threats,
   environment, objectives, evolution feedback, stage completion.
7. **Cell→Creature transition** — export/import persistent consequences; species
   history entries. Vitest: inheritance carries correct traits.
8. **Creature slice** — initial renderer, habitat, feeding/survival, pack/social,
   builder, objectives, save/load.
9. **Species history + stage summary + slice validation** (Phase 6 checklist).
10. **Playwright** — register → login → create lineage → Cell → save → reload →
    select trait → complete Cell → enter Creature.

## Risks

**Technical**
- DOM↔Phaser coordination (HUD alignment to canvas bounds under `Scale.FIT`,
  event bridge complexity). Mitigate: thin typed bridge; measure canvas rect.
- Save validation surface is large; untrusted client state. Mitigate: strict
  form requests + schema versioning + trait projection table.
- Test DB (SQLite) vs dev/production DB (MySQL) divergence. Lower risk since
  the switch to MySQL (DECISIONS D20): there is no driver-specific SQL in the
  codebase and JSON is only touched via Eloquent casts. Mitigate: a MySQL CI job.
- Developer TS unfamiliarity. Mitigate: small readable files, heavy tests, no
  clever abstractions.

**Visual**
- Modular part coherence (parts must read as one silhouette at 40px). Mitigate:
  follow schema coherence rules; silhouette test in review.
- Placeholder art drifting from final boundaries. Mitigate: correct dimensions +
  labelled placeholders in the manifest.

**Scope**
- Six-stage ambition vs. slice discipline. Mitigate: hard gate — no later-stage
  art before Phase 6.
- Prototype copy implying unapproved features (offline, cooldown, NG+).
  Mitigate: audit classification; product decisions logged before building.

## Recommended first implementation task

**Build the campaign domain + persistence layer (backlog item 1).** It is the
backbone every later system saves through, it is pure backend work that plays to
the maintainer's PHP strengths, and it is fully testable with Pest before any
Phaser work begins. Deliver: migrations, `CampaignState`, models, save/load
controllers, `StoreSaveRequest`, ownership policy, and the full ownership/
validation test suite — using the schema and payload in `SAVE_FORMAT.md`.
