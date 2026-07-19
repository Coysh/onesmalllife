# Asset Manifest — One Small Life

Naming: `stage_category_asset_variant_state.ext` (brief §16). SVG for modular
parts and icons; WebP for textured backgrounds/overlays; JSON for palettes and
metadata. Text is never baked into assets. Produce tiers in order; do **not**
author later-stage art until the vertical slice is validated.

Placeholder policy: when final art is missing, use a simple Tidepool-compatible
vector placeholder at the **correct** filename, dimensions and attachment
metadata, labelled here. Never build gameplay around placeholder dimensions.

## Status

Nothing final yet. The **Cell part schema** (`cell-parts.schema.json`) and
**tokens** are in place; all Tier-1 art is still to be produced (placeholders
first).

## Tier 1 — Essential vertical slice (~34 assets)

| Asset group | Count | Size | Notes |
|---|---|---|---|
| `cell_body_*` | 8 | 256² | tintable greyscale albedo |
| `cell_organelle_*` | 4 | — | fixed-colour detail |
| `cell_membrane_*` | 6 | 256² | must suit body silhouette |
| `cell_feeding_*` | 6 | 128² | L/R mirror via container flip |
| `cell_movement_*` | 6 | 128² | cilia + flagellum get 3-frame idle |
| `cell_sensory_* / cell_defense_*` | 12 | 128² | |
| `cell_pattern_*` | 8 | SVG | one per organism, masked to body |
| palettes | 12 | JSON | one palette per organism |
| `biome_micro_background_*` | 1×3 | WebP 2048×1152 | 3 palettes × 3 parallax layers — only opaque asset |
| `cell_nutrient_mote` | 1 | 48² | 4-frame absorb pop |

Tier 1 must yield **≥3 visually coherent, mechanically distinct organisms**
(placeholders acceptable) to prove the modular + portrait system.

## Tier 2 — Cell polish (~20)
Predator variants (3, idle frames), absorb/damage FX, atmospheric overlays,
evolution burst (512², ~10 frames, 600ms). After the base loop works.

## Tier 3 — Creature polish (~26)
Creature bodies (10, 512²), heads/eyes/mouths, limb/tail sets (walk frames),
sensory/defensive, shore/forest backdrops (WebP, day/dusk, 3 layers), props.
After Cell is stable.

## Tier 4 — Shared interface (~30, in parallel where the slice needs it)
Icon family (~21, single SVG symbol sprite via `<use>` + `currentColor`), HUD
glass chips (9-slice), trait-card frames (4 categories × 7 states), wordmark +
app icon lockups (SVG + PNG down to 16²), species-portrait rig (runtime — no
separate raster art).

## Tier 5 — Later stages (SPECIFIED, NOT PRODUCED)
Tribe / Civilisation / Planetary / Space kits. A hold, not a backlog — they
exist only to validate that the modular grammar extends to top-down maps and
modular structures.

## Already present

| Asset | Location | Kind |
|---|---|---|
| Brand mark | `resources/views/components/ui/brand-mark.blade.php` | inline SVG |
| Wordmark | `resources/views/components/ui/wordmark.blade.php` | text component |
| Fonts (Bricolage, Hanken, Space Mono) | `node_modules/@fontsource*` → bundled | self-hosted woff2 |
| Cell part schema | `resources/game/data/cell-parts.schema.json` | JSON (to be copied in Phase 3) |

## 2026-07 status — procedural sprite catalogues (no raster assets yet)

All art remains code-drawn, but is now generated ONCE into cached textures via
`resources/game/lib/spriteFactory.ts` and organised as catalogues:

- `data/sprites/cellSprites.ts` — 7 enemy cell archetypes (Stage 1 bestiary)
- `data/sprites/creatureSprites.ts` — terrain features + 6 wild species
- `data/sprites/unitSprites.ts` — strategic map units (raider, wanderer,
  caravan, warband, ship, beast, crowd, settler)
- `data/sprites/buildingSprites.ts` — civilisation buildings × 3 era skins

The player organism is still drawn live (`entities/CellOrganism`) from the
part catalogue `data/cell-parts.catalog.json`, which supersedes the Tier-1
list here as the live source of part ids. The schema grammar in
`cell-parts.schema.json` still governs layer order/anchors for future raster
art; any future SVG/WebP assets should replace the draw functions in these
catalogues without changing call sites.
