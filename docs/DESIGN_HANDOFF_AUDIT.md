# Design Handoff Audit — One Small Life

This document audits the supplied design handoff
(`One Small Life Design Brief-handoff.zip`) and maps it to the production
Laravel + Tailwind + Phaser implementation.

The handoff is a **Claude Design** export: a set of `.dc.html` prototypes plus
token files. The `.dc.html` files are **prototypes, not production templates** —
they load a proprietary `support.js` runtime and use custom `<x-dc>`, `<helmet>`,
`<sc-for>` elements and `DCLogic` scripts. **None of that runtime ships.** We read
the prototypes for their visual rules and reimplement them as Blade + Tailwind +
TypeScript. Locked direction: **Tidepool**.

---

## 1. Design inventory

| Handoff file | What it specifies |
|---|---|
| `README.md` | Handoff is a Claude Design export; primary screen is `Sample Screens 2.dc.html`; prototypes are not production code. |
| `tokens.css` | The full CSS custom-property token set (brand, foundation, text, status, resources, traits, radii, spacing, shadows, typography, motion, z-index). **Source of truth.** |
| `tailwind.theme.js` | `theme.extend` mirror of the tokens for Tailwind. **Source of truth.** |
| `cell-parts.schema.json` | Modular Cell organism schema: canvas, layer order, anchors, max-parts, mirroring, colour mask, coherence rules, portrait method, part library. **Source of truth for Cell composition.** |
| `Design Tokens.dc.html` | Visual rendering of the token system + AA contrast ratios + "combinations to avoid". |
| `Brand Foundation.dc.html` | Brand mark (nucleus in evolutionary rings + satellite dots), wordmark ("Small" in teal), lockups, favicon scaling, personality, don'ts. |
| `Interface Shell.dc.html` | The persistent chrome: edge-floating translucent glass zones, corner zone map, direct-control→management adaptation ladder, tablet rules. |
| `Cell HUD.dc.html` | Cell stage HUD: Energy/Integrity/Evolution/Objective/Threat/Environment; living meters; vital states (colour+shape+label). |
| `Creature HUD and Builder.dc.html` | Creature HUD + modular creature builder layout. |
| `Trait Cards.dc.html` | One reusable trait card; four categories (colour+shape); seven states; fixed slot grid. |
| `Modular Cell System.dc.html` | Narrative companion to `cell-parts.schema.json` (layer order, tinting, coherence). |
| `Icon System.dc.html` | 24px grid, 2px stroke, stroke default / filled active, ~21 icons, SVG symbol sprite via `<use>` + `currentColor`. |
| `Motion and Feedback.dc.html` | Motion durations (120/200/300/600ms), reduced-motion behaviour. |
| `Environment and Structures.dc.html` | Environment/backdrop and structure grammar for later stages. |
| `Asset Manifest.dc.html` | Prioritised production asset list (Tier 1–5), naming convention, reuse markers. |
| `Sample Screens.dc.html` | In-game HUD sample screens. |
| `Sample Screens 2.dc.html` | **Primary screen.** Account/system/end screens: Registration, Login (error state), Pause, Settings, Species history, Campaign ending, Extended play. |
| `Implementation Handoff.dc.html` | Meta doc: how to consume the handoff. |
| `Master Prompts.dc.html` | Meta doc: generation prompts (not product content). |
| `Visual Directions.dc.html` | The three-direction exploration (Tidepool selected — do not reopen). |
| `support.js` | **Design-tool runtime. Never ships.** |

---

## 2. Screen matrix

Status legend: ✅ implemented · 🟡 partial/placeholder · ⬜ not started (planned).

| Screen | Route | Blade view | Components | TS controller | Phaser scene | Status |
|---|---|---|---|---|---|---|
| Landing / title | `GET /` | `welcome.blade.php` | `ui.brand-mark`, `ui.wordmark`, `ui.button` | — | — | ✅ |
| Registration | `GET/POST /register` | `auth/register` | text-input, input-label, input-error, primary-button | — | — | ✅ |
| Login (+ error state) | `GET/POST /login` | `auth/login` | same + auth-session-status | — | — | ✅ |
| Forgot password | `GET/POST /forgot-password` | `auth/forgot-password` | same | — | — | ✅ |
| Reset password | `GET/POST /reset-password` | `auth/reset-password` | same | — | — | ✅ |
| Confirm password | `GET/POST /confirm-password` | `auth/confirm-password` | same | — | — | ✅ |
| Verify email | `GET /verify-email` | `auth/verify-email` | primary-button | — | — | ✅ |
| Authenticated shell | `GET /dashboard` | `layouts/app`, `dashboard` | navigation | — | — | 🟡 (Breeze default; Tidepool restyle deferred to game-shell phase) |
| Account settings | `GET /profile` | `profile/edit` | Breeze profile partials | — | — | 🟡 (functional, not yet Tidepool) |
| Save-slot selection | `GET /campaigns` | ⬜ | `ui.panel`, species-portrait | slot controller | — | ⬜ |
| New-campaign setup | `GET /campaigns/create` | ⬜ | form primitives | — | — | ⬜ |
| Loading screen | (client) | ⬜ | — | boot loader | preload scene | ⬜ |
| Main Cell view | `GET /play/{campaign}` | `game/cell` | HUD components | cell HUD controller | `CellScene` | ⬜ |
| Main Creature view | `GET /play/{campaign}` | `game/creature` | HUD + builder | creature controllers | `CreatureScene` | ⬜ |
| Pause menu | (overlay) | `game/pause` | `ui.panel`, `ui.button` | pause controller | — | ⬜ |
| Settings | (overlay) | `game/settings` | tabs, toggles, sliders | settings controller | — | ⬜ |
| Trait selection | (overlay) | `game/traits` | trait-card | trait drawer controller | — | ⬜ |
| Creature builder | (overlay) | `game/builder` | builder controls | builder controller | portrait rig | ⬜ |
| Event decision modal | (overlay) | `game/event` | `ui.panel`, `ui.button` | event controller | — | ⬜ |
| Evolution transition | (overlay) | — | — | transition controller | fx | ⬜ |
| Species history | `GET /campaigns/{c}/history` | `campaigns/history` | timeline | history controller | — | ⬜ |
| Stage-completion summary | (overlay) | `game/stage-summary` | `ui.panel`, portrait | — | — | ⬜ |
| Campaign ending | `GET /campaigns/{c}/ending` | `campaigns/ending` | portrait, stats | — | fx | ⬜ |
| Extended-play choice | (overlay) | `campaigns/extended` | option cards | — | — | ⬜ |

---

## 3. Component matrix

| Handoff component | Production component | Status |
|---|---|---|
| Interface shell | `layouts/game.blade.php` (planned) + edge-zone partials | ⬜ |
| Resource chips | `ui.resource-chip` (planned) | ⬜ |
| Vital meters | `ui.vital-meter` (planned) | ⬜ |
| Objective panel | `ui.objective` (planned) | ⬜ |
| Threat cue | `ui.threat-cue` (planned) | ⬜ |
| Environment panel | `ui.environment` (planned) | ⬜ |
| Speed control | `ui.speed-control` (planned) | ⬜ |
| Trait card | `ui.trait-card` (planned) | ⬜ |
| Event modal | `ui.event-modal` (planned) | ⬜ |
| Creature builder | `ui.creature-builder` (planned) | ⬜ |
| Save-status indicator | `ui.save-status` (planned) | ⬜ |
| Species portrait | `ui.species-portrait` (composed from runtime parts) | ⬜ |
| Stage summary | `ui.stage-summary` (planned) | ⬜ |
| Icon sprite set | `ui.icon` + symbol sprite (planned) | ⬜ |
| Buttons | `ui.button`, `primary/secondary/danger-button` | ✅ |
| Form inputs | `text-input`, `input-label`, `input-error` | ✅ |
| Panels | `ui.panel` (solid + glass) | ✅ |
| Brand mark / wordmark | `ui.brand-mark`, `ui.wordmark` | ✅ |
| Tabs | `ui.tabs` (planned, for Settings) | ⬜ |
| Toggle controls | `ui.toggle` (planned, for Settings) | ⬜ |
| Alerts / error states | `input-error`, `auth-session-status`; `ui.alert` (planned) | 🟡 |

---

## 4. Behaviour discrepancies

Prototype copy that implies functionality. Each is labelled per the brief's
source-of-truth hierarchy. **Visual examples are not silently promoted to features.**

| Prototype element | Classification | Handling |
|---|---|---|
| "Play offline first — account optional until you sync" (Registration) | **Visual example only** — the brief §22 says persistent campaigns require an authenticated account; no offline guest campaigns unless separately approved. | Copy **not** implemented. Registration uses neutral copy. |
| "3 failed attempts adds a cooldown" (Login error) | **Deferred possibility** — Laravel already rate-limits login; a bespoke cooldown message is not required. | Not implemented as shown; standard Laravel throttling remains. |
| "New Game+" (Extended play) | **Requires a product decision** — brief §21 says do not implement NG+ merely because it appears in the prototype. | Deferred; noted in `DECISIONS.md`. |
| "Autosave keeps the last three states" | **Requires a product decision** — save-retention count not confirmed. | Deferred; save format supports it but count is unset. |
| "4.1 billion simulated years / 6 stages" (Ending) | **Visual example only** — illustrative stat copy. | Ending stats will be generated from real campaign data. |
| Species-history example events | **Visual example only** | Timeline renders real recorded events; sample events are placeholders. |
| "Reduce motion" / "Colour-blind cues" ON by default (Settings) | **Confirmed requirement** — aligns with brief §26 accessibility. | Will honour `prefers-reduced-motion`; colour+shape+label everywhere. |

---

## 5. Design decisions (prototype → production)

- **Tokens** live in `resources/css/tokens.css` (CSS custom properties, verbatim
  from the handoff except font-family stacks) and are mirrored in
  `tailwind.config.js` `theme.extend`. One source, two consumers.
- **Fonts** (Bricolage Grotesque, Hanken Grotesk, Space Mono) are **self-hosted**
  via `@fontsource` and bundled by Vite — no Google/Bunny CDN at runtime. The
  variable families register as `"… Variable"`, so token stacks lead with those
  names and keep the plain names as fallback.
- **Rendering boundary** (brief §8): Phaser owns the world; the DOM owns all HUD,
  menus, text and modals. HUD is a Blade/HTML layer above the canvas.
- **Reusable primitives** consolidate prototype styling: buttons, fields, labels,
  errors, panels, brand mark/wordmark. Auth pages share these so all six render
  consistently with no per-page style duplication.
- **No prototype runtime**: `support.js`, `<x-dc>`, `<sc-for>`, `DCLogic` and
  `data-dc-script` blocks are never shipped. Their `renderVals()` data is treated
  as spec, reimplemented as component props/data.
- **Accessibility is standing**: focus-visible ring uses `--osl-focus-ring`;
  status/error use colour **and** a glyph; reduced-motion halts ambient animation
  while preserving information.

---

## 6. Acceptance checklist (implemented screens)

Landing + auth screens verified against the handoff:

- [x] Visual hierarchy matches (brand mark → wordmark → tagline → CTAs).
- [x] Token colours only (no stray hex in views).
- [x] Typography roles: Bricolage display, Hanken body, Space Mono labels.
- [x] Spacing on the 4px base.
- [x] Controls have hover/active/focus/disabled states.
- [x] Error states present (coral chip + "!" glyph).
- [x] Tablet behaviour: stacked CTAs, ≥44px targets.
- [x] Focus states visible and token-coloured.
- [x] Text readable (≥14px body, ≥12px labels; AA on `#061418`).
- [x] Repeated patterns use shared components.
- [x] No prototype runtime code copied.
- [x] No unapproved feature inferred from placeholder copy (offline/cooldown/NG+).
