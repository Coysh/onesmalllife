# Content Format — One Small Life

Content is **data-driven** (brief §14, §19). Traits, events, palettes and part
metadata are JSON/TypeScript so balance can change without code changes. Content
is versioned (`contentVersion`) and referenced by stable string ids.

## Traits (`resources/game/data/traits.json`)

One shared trait model across all stages. A trait:

```jsonc
{
  "id": "biology:membrane_ii",
  "name": "Reinforced Membrane",
  "description": "A tougher membrane that resists toxins and cold.",
  "category": "biological",            // biological | behavioural | cultural | technological
  "stageIntroduced": "cell",
  "requires": ["biology:membrane_i"],
  "conflicts": ["biology:mucus_coat"],
  "benefits": ["+integrity", "+cold_tolerance"],
  "costs": ["-motility"],
  "tags": ["biology:armoured", "environment:cold"],
  "visualAttachments": { "membrane": "double" },
  "laterStageModifiers": { "tribe": ["+shelter_quality"] },
  "eventModifiers": { "cold_snap": "favourable" },
  "evolutionWeight": 3,
  "rarity": "common",                  // common | uncommon | rare | legendary
  "upgradeOf": "biology:membrane_i",
  "inheritable": true,
  "permanent": false
}
```

Rules are **tag-driven** where practical (e.g. `diet:carnivore`,
`behaviour:social`, `environment:cold`). Category → colour **and** shape is
enforced in the UI (never colour alone): biological=drop/green,
behavioural=spark/amber, cultural=weave/pink, technological=hex/sky.

## Trait card states (brief §14)

Available · Selected/Equipped · Upgradable · New · Locked · Excluded/Blocked ·
Inherited. Each state is expressed with colour **plus** border/glyph/label.

## Events

```jsonc
{
  "id": "cold_snap",
  "stages": ["cell", "creature"],
  "eligibility": {
    "requiresTags": ["environment:cold"],
    "excludesTags": [],
    "minStageProgress": 0.2
  },
  "weight": 5,
  "choices": [
    { "id": "endure", "label": "Endure", "effects": ["-energy", "+cold_tolerance"] },
    { "id": "migrate", "label": "Drift to warmer water", "effects": ["-time", "reset_threat"] }
  ]
}
```

Events are **eligible-then-weighted**: the generator filters by eligibility
(tags, stage, progress), then picks by weight via `Rng`. Outcomes prefer soft
failure (setbacks) over campaign-ending punishment (brief §12, §21).

## Palettes (`resources/game/data/palettes.json`)

```jsonc
{
  "id": "warm-01",
  "name": "Warm shallows",
  "albedo": "#c98f5a",       // multiplicative setTint target base
  "accent": "#f2b56a",       // pattern accent
  "detail": "#7a4a2a"
}
```

12 palettes for the Cell part library. One palette per organism (coherence rule).

## Cell parts (`resources/game/data/cell-parts.schema.json`)

Copied verbatim from the handoff. Defines canvas (256²), layer order (11 layers),
normalised anchors, max-parts, mirroring (flip at container level), the two-layer
colour mask (tintable greyscale albedo + fixed detail), coherence rules, and the
portrait method (composed from the same runtime parts — never separate art).

Part library (representative subset first): 8 bodies, 6 membranes, 6 feeding, 6
movement, 6 sensory, 6 defense, 8 patterns, 12 palettes.

## Asset naming (brief §16)

`stage_category_asset_variant_state.ext` — e.g. `cell_body_oval_01.svg`,
`ui_icon_energy_active.svg`, `biome_micro_background_warm.webp`. Text is never
baked into assets. Placeholders use the correct filename, dimensions and
attachment metadata, and are labelled in the asset manifest.
