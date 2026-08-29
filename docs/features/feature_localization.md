# Feature: Localization (i18n)

## Goal

Let the player pick a display language (English, default; Português — Brasil,
initially) from a dropdown, and have both the game's UI chrome (buttons,
tooltips, HUD labels, the duel log) and any translated content (dialogue,
actor/settlement/POI/faction/item names and descriptions, endeavor titles)
render in that language. The mechanism itself never requires every piece of
content to be translated before it ships — untranslated content falls back
to English per-field rather than erroring or showing blank text — but as of
this revision, every content file in the project (all 26: settlements,
districts, POIs, actors, factions, endeavors, dialogues, items) actually has
a `pt-BR` overlay, not just a proof-of-concept slice.

## Classification

Feature/Engine.

## Issue

#4.

## Existing-capability check

Nothing in the engine or content schemas has any locale awareness today —
confirmed by a full audit of `src/content/schemas/`, every `src/engine/`
component, `notificationResolution.ts`, and `dialogueResolution.ts`. This is
net-new capability, not something reusing an existing primitive for a new
purpose, so the reuse-of-meaning question (does this change what something
already means to its other consumers?) mostly doesn't apply — with one real
exception, addressed directly:

- **`contentLoader.ts`'s `loadContent`** is extended, not changed: a new
  sibling function, `loadLocalizedContent` (`src/contentLocalization.ts`),
  calls the existing `loadContent` for the canonical (English) file exactly
  as every other content type does today, then separately parses and merges
  an optional locale overlay on top. `loadContent`'s own signature, behavior,
  and every existing call site are untouched — this is composition, not a
  changed meaning.
- **`TriggerableSchema`/`ModifierSourceSchema`** (`src/content/schemas/shared.ts`)
  are the direct precedent for this phase's new overlay schemas: a small,
  composable Zod fragment, reused across multiple content types where the
  shape is identical (`BaseNodeTranslatableSchema`, reused for Settlement/
  District/POI/Faction/Item), with bespoke fragments where it isn't
  (`ActorTranslatableSchema`, `EndeavorTranslatableSchema`,
  `DialogueTranslatableSchema`).
- **`usePlayerStore`'s `persist` middleware** is the direct precedent for
  `useLocaleStore` — a second, wholly independent Zustand store with its own
  `persist` config and localStorage key, not a new field bolted onto the
  existing store.
- **No existing command, schema field, or engine mechanism is repurposed.**

## Integration points

- **`App.tsx`, module scope**: alongside every existing `loadContent(Schema,
  xRaw, "label")` call, a parallel `import.meta.glob('../content/**/*.pt-BR.json',
  { eager: true })` discovers whichever overlay files actually exist —
  currently every content file has one, but the mechanism itself makes no
  assumption of that and degrades gracefully for any id without one.
  **Genericized, not a hardcoded per-entity list**: every canonical array
  (`pois`, `actors`, `factions`, `items`, `endeavors`, `dialogueList`, plus
  `settlement`/`district` individually) is mapped through
  `applyLocaleOverlay(canonical, overlaySchema, overlayRaw, label, merge)`
  inside a `useMemo` keyed on `locale` — adding a new overlay file for any
  existing id is picked up automatically, with no `App.tsx` code change.
  Correct moment: this must happen at the same module-scope load point the
  English content already loads at, so a locale switch never needs to
  re-fetch content — only the (cheap) overlay merge recomputes, keyed on the
  *current* locale reactively, not on load.
- **`App.tsx`, one new `useEffect`**: keyed on `useLocaleStore`'s `locale`,
  calls `i18n.changeLanguage(locale)`. Correct moment: the same "store value
  changes → side effect fires" shape already used for `activeModifiers`
  (`docs/features/feature_modifier_system.md`) — locale changing is exactly
  the trigger i18next needs to know about, nothing else should call
  `changeLanguage`.
- **New `LanguageSelector` component, mounted inside `WorldClockHud`**
  (an implementation-fit refinement of the plan's "near `WorldClockHud`" —
  `WorldClockHud` already *is* the header/HUD-level component the user
  chose, so mounting inside it rather than as a separate App.tsx-level
  sibling avoids a redundant wiring layer): the one and only place
  `useLocaleStore.setLocale` is called from player interaction.
- **Every `src/engine/` component with a hardcoded string or raw-enum
  render** (duel, dice, world clock, navigation, management drawer, dialogue
  overlay, minigame overlay, asset fallback, notification resolution — full
  catalog in Test plan) integrates via `useTranslation()`'s `t()`, replacing
  the literal string or enum value at its exact existing render site — no
  new render paths invented, only the string source changes.

## Reachability

**UI chrome**: reachable immediately from a fresh save — the language
dropdown is always visible (header/HUD-level, not buried in the Journal
drawer), and every UI-chrome string this phase touches switches instantly.

**Translated content**: originally shipped for one vertical slice (the
starter settlement, district, POI, Mara Venn, and her dialogue tree) as
proof + reachability, with the remaining ~20 files sequenced as follow-on
content work. That follow-on work has since landed in the same phase — every
content file in the project now has a `pt-BR` overlay (settlements,
districts, POIs, actors, factions, endeavors, dialogues, items). The
per-field English fallback is still real and still load-bearing (a future
new content file, or a third locale, lands with no overlay and degrades
gracefully) — it's simply not currently exercised by anything already
shipped, since nothing is untranslated anymore.

**A real bug the full-content pass surfaced and fixed**: when only the
vertical slice existed, `App.tsx`'s localization wiring was a hardcoded
per-entity list (six named `loadLocalizedContent` calls). Authoring the
remaining ~20 overlay files revealed that Endeavors and Items were never
wired into that list at all — their overlay files validated correctly
against `content-integrity.test.ts`, but nothing in `App.tsx` ever resolved
them, so `endeavorTitles`/`phaseObjectives`/item names/descriptions stayed
English regardless of locale. Fixed by generalizing the mechanism (see
Integration points) — `applyLocaleOverlay` mapped generically over every
content array — rather than extending the hardcoded list further. Caught by
actually testing the newly-translated content in a real browser, not by
inspection; see `docs/decisions.md`.

**Verified via a real headless-browser pass against the dev server** (not
just unit tests), confirming every claim above with actual output, not
assertion:
- Switching the header dropdown to Português (Brasil) immediately translated
  every piece of UI chrome checked: `DIÁRIO`, `AVANÇAR TURNO`, `← VOLTAR`,
  `Bairro do Lampião` (district), `A Hora Torta` (POI, both the world-nav
  button label and, once inside, the heading/description), `??? (bloqueado)`
  (locked-node placeholder), `Apostar` (the Gamble action), and the currency
  abbreviations (`0o 2p 10b`).
- Inside the POI, `Mara Venn · Frequentadora do Círculo das Apostas`
  rendered fully translated (actor name intentionally untouched — a proper
  noun — title translated), while the untranslated `actor_bookkeeper`
  rendered as `The Bookkeeper · Wagering Ring Bookkeeper` — unmodified
  English, not blank, not an error, confirming the per-field fallback works
  exactly as designed for content with no overlay at all.
- Opening Mara Venn's dialogue showed her fully translated node text and
  both choices in Portuguese (`Mais um panfleto que silenciou e ninguém
  está falando sobre isso...` / `O que você sabe sobre isso?` /
  `Deixa pra lá.`).
- **The specific live-update case**: with that dialogue still open,
  switching the dropdown back to English updated the *currently displayed*
  node's speaker label, body text, and both choices to English immediately
  (`Another broadsheet gone quiet and nobody's talking...` /
  `What do you know about it?` / `Never mind.`) — confirmed without closing
  and reopening the dialogue, proving the `useMemo`-keyed-on-`locale`
  content resolution is genuinely reactive, not memoized-once-per-mount.
- Zero console errors across the entire pass.
- **A second pass, after the full-content translation and the bug fix
  above**, confirmed the fix against the previously-broken entities: the
  Endeavors tab showed `Uma Dívida em Aço` / `O Panfleto Desaparecido`
  (translated titles) with translated objective text; the Inventory tab
  showed all five items fully translated (`Espada de Duelo`, `Espada de
  Vantry`, `Espada do Duelista`, `Carta de Apresentação`, `Pingente da Moeda
  Fácil`); Widowmaker Alley (`Beco das Viúvas`) and Duro Vantry (`O Segundo
  do Círculo`) and his dialogue rendered correctly; and — the trickiest
  case, since `actor_bookkeeper`'s `name` was itself translated (`The
  Bookkeeper` → `O Contador`, a descriptive title rather than a proper
  name) — every dialogue where that Actor speaks (`dialogue_bookkeeper_default`,
  `dialogue_the_challenge`) has its `speaker` field translated to the exact
  same string, confirmed by the portrait-matching speaker label rendering
  correctly as `O CONTADOR` with no mismatch. Zero console errors.

**A specific reachability case this architecture invites and must be
checked explicitly**: switching locale while a dialogue is already open.
Since the merged, locale-resolved dialogue content is derived from the
overlay-glob lookup keyed on the locale store (not re-fetched per render by
default), the currently-displayed node's `speaker`/`text`/choice `text` must
update live if the player switches language mid-conversation — not only the
next time a dialogue is opened. Verified as part of the manual reachability
pass (see Test plan).

## Consistency check

- `game-design-spec.md`'s Open Design Gaps list has no existing entry for
  localization — it wasn't a previously-tracked gap, so this phase adds
  itself as new capability rather than implying it resolves something
  already logged.
- `CLAUDE.md`'s Tech Stack Boundary line ("React, Pure TypeScript, Vite,
  Tailwind CSS, Zustand, Framer Motion, Lucide-React, Vitest, Zod,
  `@testing-library/react`, and `jsdom`") is asserted as project law
  ("MUST follow exactly as written") and currently omits i18next/
  react-i18next — updated in the same phase as the dependency is added, not
  left silently stale.
- `content-integrity.test.ts`'s 8 existing per-type `import.meta.glob`
  calls currently match every `*.json` file in each content directory
  unconditionally — once `.pt-BR.json` overlay files exist alongside
  canonical files in the same directories, those globs would incorrectly
  try to validate an overlay file against the full canonical schema and fail
  (an overlay deliberately omits required fields). See Content-schema
  scaling note below for the concrete partitioning fix.
- `docs/engine.md` and `docs/web-implementation.md` currently describe the
  content-loading pipeline and directory structure with no locale dimension
  at all — both updated in this phase (see Status).

## Environment notes

A new runtime dependency (i18next + react-i18next) needs confirming under
this project's actual test environment, not assumed from local dev-server
behavior — `react-i18next`'s `useTranslation()` hook must be verified to
behave correctly under Vitest's `jsdom` environment before any component
test relying on it is trusted. This is the same category of risk as the
documented Node 20 (CI) vs. Node 24 (local) mismatch (`docs/decisions.md`,
2026-08-10) — a dependency that "just works" wherever it was first tried is
not the same as confirmed working everywhere it needs to.

## Test plan

- `src/__tests__/contentLocalization.test.ts` — the merge functions, one
  per content shape: an overlay field wins over canonical when present, an
  absent overlay field falls back to canonical English, the dialogue
  choice-array merge matches by `id` (not array position), and an overlay
  referencing a node/choice `id` that doesn't exist in the canonical file is
  asserted to fail loudly (not silently ignored) via the referential-
  integrity check below.
- `src/__tests__/localeStore.test.ts` — defaults to `'en'`, `setLocale`
  persists under its own key, and — the actual proof the decoupling
  decision holds — confirmed absent from `persistence.test.ts`'s
  `PlayerState` key-list assertion (no change to that file at all).
- `src/__tests__/components/LanguageSelector.test.tsx` — selecting a
  language updates the store and the rendered `t()` output.
- **An i18n key-completeness test**: every key present in `en.ts` also
  exists in `pt-BR.ts`, and vice versa — cheap, and prevents the same class
  of silent drift `content-integrity.test.ts`'s glob already prevents for
  content coverage, applied to UI strings instead.
- **The unified currency formatter tested against real Portuguese plural
  forms** (0/1/2+ of each denomination), asserting it routes through
  i18next's `count`-based interpolation (`t('currency.gold', { count: n })`
  with `_one`/`_other`-suffixed `pt-BR.ts` keys) and produces grammatically
  correct output at each count — not merely that the formatter calls `t()`
  at all. This is the concrete proof for why i18next was chosen over a
  hand-rolled `t()` (see decisions.md): a naive `` `${count} ${t('gold')}` ``
  concatenation is exactly the class of bug a real plural-rules engine
  exists to prevent.
- `content-integrity.test.ts` extended per the scaling note below.
- `schemas.test.ts` — valid/invalid fixtures for each new overlay schema,
  per `CONTRIBUTING.md`'s existing rule that every schema needs both.
- Full catalog of hardcoded strings/raw-enum renders migrated to `t()`,
  each getting the same "empty modifier set is inert" style treatment
  applied here as "switching locale changes only rendered text, never
  identifiers/logic": `duel.ts`'s `ACTION_LABELS` and ~14 interpolated log
  templates (fixing the pre-existing FEINT/TAUNT inconsistency where those
  two lines hardcode the action name literally instead of referencing
  `ACTION_LABELS`, in the same migration); `DuelGame.tsx`'s action/distance
  descriptions and button labels; `DiceGame.tsx`'s labels and Even/Odd
  text; `WorldClockHud.tsx`'s Shift/Season/Weather raw-enum renders (today
  printed as literal `"MORNING"` etc. with no label map at all — only icon
  maps exist) and the day counter; `WorldNavigationView.tsx`/
  `NodeInteractionCanvas.tsx`'s duplicated `"??? (locked)"` literal
  (consolidated to one shared key); `ManagementDrawer.tsx`'s tabs, headers,
  and empty states (the `import.meta.env.DEV`-only World Clock panel stays
  English-only — it never reaches a real player); `DialogueOverlay.tsx`'s
  Close button; `MinigameOverlay.tsx`'s fallback text/buttons;
  `AssetFallback.tsx`'s `"MISSING: "` prefix; `notificationResolution.ts`'s
  template phrases; and the three independent hardcoded currency-formatting
  implementations (`WorldClockHud.tsx`, `DiceGame.tsx`,
  `notifications.ts`'s `formatCurrencyDelta`) unified into one locale-aware
  formatter.
- **Manual reachability pass** (see Reachability above): fresh state →
  switch language → confirm UI chrome and Mara Venn's translated content
  render correctly, untranslated content falls back to English, export→
  import doesn't change language, reload preserves it, and — the specific
  live-update case — switching locale while Mara Venn's dialogue is already
  open updates the currently-displayed node's text without closing/
  reopening it.

## Content-schema scaling note

`content-integrity.test.ts`'s 8 existing per-type globs
(`import.meta.glob("../content/<type>/*.json", ...)`) must be **partitioned**,
not just widened: filtering the existing glob's matched paths to exclude any
path containing `.pt-BR.json` (or any future locale suffix) keeps validating
canonical files against their full schema exactly as today, and a new,
parallel glob group per translatable content type validates `.pt-BR.json`
overlay files against that type's overlay schema instead. A referential-
integrity check (same spirit as the existing actor↔faction/poi↔actor checks)
confirms every overlay file's base id (derived from its filename — overlay
schemas carry no internal `id` field, since the filename is already the
unique key) matches a real canonical file's id, so a typo'd or orphaned
overlay fails loudly instead of being silently ignored.

Per this note's own standing requirement (`docs/feature-workflow.md` §4):
the merged, locale-resolved object is proven reachable through
`loadLocalizedContent`'s real `loadContent` calls in a test, not just a
standalone schema `.parse()` — `contentLocalization.test.ts` exercises the
actual function App.tsx calls, not a hand-rolled equivalent.

## Open questions / explicitly deferred scope

- **Locale-specific assets** (audio/images) are not built now —
  `resolveAssetUrl` stays locale-unaware. No content currently needs it (no
  `audio/` directory exists on disk yet at all), and inventing the scheme
  ahead of a real need would be premature, the same reasoning previously
  deferred hooks in this project's history (e.g. `onExit`) were declined
  under.
- ~~Translating the remaining ~20 content files~~ — **done**, in the same
  phase. Every content file in the project now has a `pt-BR` overlay. The
  incremental, non-blocking mechanism (a missing overlay always falls back
  to English) remains exactly as designed for whatever content is authored
  next.
- **`'en'` is the deliberate default, with no browser-language
  auto-detection.** Considered and rejected, not left as i18next's
  out-of-the-box behavior unconsidered: the brief explicitly names English
  as default, and auto-detecting from `navigator.language` would silently
  switch a Brazilian Portuguese browser to `pt-BR` on first load — the
  dropdown is meant to be the one source of truth for locale selection.
- **A third+ language** (Spanish named as a likely next candidate) is not
  built now, but `LOCALES`/the overlay-file convention/i18next's resource
  structure are all designed to extend by adding a value, a set of overlay
  files, and a `resources` entry — no architectural change anticipated,
  though not proven until it's actually done once.
- **`App.tsx`'s two inline POI-action strings** ("Gamble", "Pay off the
  buyer...") are treated as engine/UI strings this phase (translated via
  `t()`), not moved into content JSON — moving them would be an unrelated
  content-modeling refactor, out of scope here.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "Localization (`docs/features/feature_localization.md`)...", plus the `formatCurrencyDelta` wording-change entry under Changed.
- decisions.md (2026-08-29, "localization"): the four user-decided architectural forks and their real reasoning, the enum-identifier-vs-label boundary, overlay filename-as-identity, the deliberate `'en'`-no-autodetect default, personal names never translated, the `App.tsx` reactivity restructuring the reachability requirement forced, `LanguageSelector`'s mount-point refinement, and the currency-formatter unification.
