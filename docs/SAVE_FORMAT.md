# Save Format — One Small Life

## Principles (brief §22–23)

- Server owns persistence; the client is untrusted.
- Major metadata is relational; complex stage state is validated JSON.
- Versioned: every save stores `seed`, `generatorVersion`, `contentVersion`,
  `saveSchemaVersion` so it can be regenerated and migrated.
- Autosave happens at **safe points**, not every frame.

## Shared campaign-state model

```
CampaignState
├── identity        { id, name, createdAt, lastPlayedAt, playTimeSeconds }
├── ownership       { userId }
├── generation      { seed, generatorVersion, contentVersion, saveSchemaVersion }
├── progress        { currentStage, completed, endingId|null }
├── species         { name, dietTag, portraitSpec, ... }        # see below
├── traits          { inherited[], active[] }                    # persistent
├── history[]       { t, category, title, description }          # timeline events
├── world           { biome, factionsKnown[], resourceState }
├── resources       { energy, integrity, evolutionPoints, ... }  # stage-relevant
├── unlocks         { traitsUnlocked[], stagesUnlocked[] }
├── endingProgress  { pillarScores{} }
├── stageState      { <stageId>: { ...opaque validated JSON... } }
└── checkpoint      { lastSafeStage, at }
```

Persistent trait categories that must survive stage transitions (brief §12):
diet, body structure, movement, senses, defence, reproduction, intelligence,
social behaviour, aggression, environmental adaptation, cooperation, curiosity,
cultural philosophy.

## Database schema (relational metadata)

```
users                      # Breeze default
  id, name, email, password, timestamps

campaigns
  id (uuid)
  user_id            -> users.id (cascade)
  name
  seed               string        # deterministic generation
  generator_version  string
  content_version    string
  save_schema_version integer
  current_stage      string        # cell|creature|tribe|civilisation|planetary|space
  completed          boolean
  ending_id          string null
  play_time_seconds  integer default 0
  species_name       string null
  last_played_at     timestamp null
  timestamps

campaign_saves            # slots + autosaves for a campaign
  id
  campaign_id        -> campaigns.id (cascade)
  slot               integer        # 0 = autosave, 1..n = manual
  label              string null
  stage              string
  save_schema_version integer
  state              jsonb          # validated CampaignState blob
  created_at, updated_at

campaign_traits           # queryable projection of active/inherited traits
  id
  campaign_id        -> campaigns.id (cascade)
  trait_id           string
  inherited          boolean
  acquired_stage     string
  unique (campaign_id, trait_id)
```

`campaign_traits` is a denormalised projection for querying and server-side
validation (does the player legitimately own this trait?). The authoritative
copy is inside `campaign_saves.state`. Temporary per-frame values never get their
own table (brief §22).

## Save-payload example (`campaign_saves.state`)

```json
{
  "saveSchemaVersion": 1,
  "identity": {
    "id": "9f2c1b7e-...",
    "name": "Tidewalkers",
    "createdAt": "2026-07-18T22:00:00Z",
    "lastPlayedAt": "2026-07-18T22:41:00Z",
    "playTimeSeconds": 2460
  },
  "generation": {
    "seed": "tidewalkers-7f3a",
    "generatorVersion": "0.1.0",
    "contentVersion": "0.1.0"
  },
  "progress": { "currentStage": "cell", "completed": false, "endingId": null },
  "species": {
    "name": "Tidewalkers",
    "dietTag": "diet:filter",
    "portraitSpec": {
      "body": "oval", "membrane": "ridged", "feeding": "filter",
      "movement": "cilia", "sensory": ["eyespot"], "defense": "mucus",
      "pattern": "speckle", "palette": "warm-01", "facing": "right"
    }
  },
  "traits": {
    "inherited": [],
    "active": ["biology:membrane_i", "cognition:curious"]
  },
  "history": [
    { "t": 0, "category": "origin", "title": "First light", "description": "A single cell stirs in the warm shallows." },
    { "t": 640, "category": "biological", "title": "Membrane thickens", "description": "Integrity improved; cold tolerance up." }
  ],
  "world": { "biome": "warm-shallows", "factionsKnown": [], "resourceState": { "nutrients": 0.7, "oxygen": 0.6 } },
  "resources": { "energy": 72, "integrity": 88, "evolutionPoints": 2 },
  "unlocks": { "traitsUnlocked": ["biology:membrane_ii"], "stagesUnlocked": ["cell"] },
  "endingProgress": { "pillarScores": {} },
  "stageState": {
    "cell": { "objectiveId": "reach_multicellular", "objectiveProgress": 0.35, "position": { "x": 512, "y": 300 } },
    "creature": {
      "version": 1,
      "equipped": { "locomotion": "steady-legs", "feeding": "grazing-jaws", "adaptation": "watchful-senses" },
      "unlocked": ["steady-legs", "grazing-jaws", "hunting-fangs", "watchful-senses"],
      "collected": []
    }
  },
  "checkpoint": { "lastSafeStage": "cell", "at": "2026-07-18T22:40:00Z" }
}
```

## Validation (server-side, on save)

A `StoreSaveRequest` validates: `saveSchemaVersion` is known; `currentStage` is a
legal value; stage transition is legal (no skipping); every `trait_id` exists in
the catalogue and is legally owned; numeric resources are within range; the
`portraitSpec` references real part ids from `cell-parts.schema.json`; the
campaign belongs to the authenticated user.

## Migrations

When `saveSchemaVersion` increases, a migrator upgrades older `state` blobs on
load. Migrators are pure functions `stateV(n) -> stateV(n+1)`, applied in
sequence. Never mutate a stored blob in place without bumping the version.

## 2026-07 appearance v2 (no save-blob schema bump)

The builder now stores **appearance v2** on `campaigns.appearance` (not in the
save blob): `{version: 2, palette, body, membrane, feeding, movement, sensory,
defense, pattern}` — part ids validated against
`resources/game/data/cell-parts.catalog.json` via `App\Domain\Species\PartCatalog`.
Legacy v1 appearances (`{palette:int, body:int, pattern:bool}`) are normalised
at read time by `PartCatalog::toV2()`; no migration writes are needed, so
`CampaignState::SCHEMA_VERSION` stays at 1. `PlayController` exposes the
normalised appearance to the client as `state.species.appearance`.

Strategic-stage extras that are intentionally NOT persisted: fog reveals,
building placements (re-laid deterministically by `systems/cityPlan.autoPlace`
from the taken-actions list), and onboarding seen-state (client-side
localStorage). Resources remain the only per-stage numbers in the save.
