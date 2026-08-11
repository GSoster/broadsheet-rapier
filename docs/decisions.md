# Decision Log

Tracks *why* a call was made, not *what* was added (see `CHANGELOG.md` for that). One dated entry per meaningful decision. Newest at bottom.

## 2026-08-10

**Project title finalized as "Broadsheet & Rapier".**
"The Hollow Atlas" was an earlier working title, replaced. Engine identity finalized as "Thornwall" (not "thornwall-engine").

**Princess Trainer added as a UI/UX & interaction-mechanics inspiration, kept separate from narrative inspirations.**
It's a game, not a book, and has no bearing on tone, dialogue, or lore — only on interaction structure (stat-driven menus, time-slot scheduling, discrete location transitions, modal overlays). Placed in its own section of `narrative-inspirations.md` rather than merged into the Section 1/2 priority hierarchy, to avoid it leaking into narrative tone generation.

**Actor faction affiliation modeled as `factionIds: string[]` rather than a single `factionId`.**
An Actor can plausibly belong to more than one faction or have shifting allegiances; a single optional field couldn't represent that.

**District/POI given optional `controllingFactionId` and `factionInfluence` fields.**
Needed for locations to plausibly be contested or influenced by multiple factions rather than only cleanly owned or neutral.

**Territory deferred — no schema, no content, no reference field on Settlement.**
Not needed until macro-world/regional travel is actually implemented; adding it now would be unused scaffolding.

**`COMMAND_NEXT_DAY` made internal-only.**
It's a derived consequence of `COMMAND_ADVANCE_SHIFT` rolling past `NIGHT`, not an independent player action. Exposing it as a dispatchable UI command would let it be triggered out of sequence.

**`importSave` validates against `PlayerStateSchema` before writing to state, but without version migration logic.**
Protects against corrupted or hand-edited save files causing a crash. Full migration handling deferred until the state shape is stable enough that migrations are actually needed.

**Tailwind CSS v4 used instead of v3, changing the original setup plan.**
`npx tailwindcss init -p` no longer works in v4 — the CLI/init flow was removed upstream. v4 integrates via the `@tailwindcss/vite` plugin directly, no `postcss.config.js` or `tailwind.config.js`. Chosen over pinning to v3 because v4 is the current supported line going forward.

**`docs/system-rules.md` split into `docs/game-design-spec.md` (engine-agnostic) and `docs/web-implementation.md` (React/TS/Zustand-specific).**
The project may migrate off web technology (e.g. to Godot) in the future. Mixing domain rules (world clock, currency, content model) with implementation details (TypeScript interfaces, Zustand persistence, Tailwind classes) in one file meant a future migration would require manually untangling which parts still apply. Splitting means `game-design-spec.md` should survive a migration unchanged, and `web-implementation.md` is the only file that needs full replacement.

**Execution plan scoped explicitly as "Phase 0 — Technical Scaffold".**
The original plan covered engine types, schemas, store, starter content, tests, and UI shell — but no actual gameplay mechanics (minigame resolution, reputation effects, economy balance). Left unscoped, an implementer would have had to invent those to make anything "playable." Scaffold is now bounded to proving the architecture with inert content; gameplay mechanics require their own spec before implementation continues past it.

**`COMMAND_NEXT_DAY`'s internal-only status enforced structurally, not just by convention.**
The earlier decision (above) said it shouldn't be exposed as a UI action, but nothing stopped code from dispatching it directly. `applyCommand` now throws if `COMMAND_NEXT_DAY` is dispatched, and the day-rollover logic was moved into a private function called only by the `COMMAND_ADVANCE_SHIFT` handler. Prevents the derived-consequence-only guarantee from silently eroding as more UI code starts calling `dispatchCommand`.

**Content-derived data (POI `costShifts`, Endeavor phase IDs, `unlocksNodesOnComplete`) passed via command payload instead of looked up by the store.**
`src/engine/` may never import `src/content/`, but several command handlers (`COMMAND_MOVE_TO_POI`, `COMMAND_START_ENDEAVOR`, `COMMAND_ADVANCE_ENDEAVOR_PHASE`) need values that only exist in content JSON. Rather than weakening the decoupling rule, the caller — which does have content access — supplies those values as part of the payload. Documented in `web-implementation.md` §3 so Phase 6 (UI) follows the same pattern instead of reaching into content from the engine.

**`COMMAND_ADJUST_CURRENCY` auto-normalizes bronze→silver→gold on every adjustment; no negative-balance protection added.**
`game-design-spec.md` §5 states the 20:20 conversion rate but doesn't say whether it's applied automatically; auto-normalizing was inferred from `execution-plan.md` Phase 5 mentioning a "currency conversion boundaries (400 bronze = 1 gold)" store test. Negative-balance handling (e.g. blocking an unaffordable purchase) was deliberately left out — that's part of the economy-balance open design gap, not a structural/type concern, and inventing it now would preempt that spec.

**`worldClock.weather` added to `PlayerState` as a display-only field, no weather mechanic invented.**
`execution-plan.md`'s Phase 6 spec for `WorldClockHud` requires showing weather, but `PlayerState` had no weather field at all and `game-design-spec.md` §4 never defined its representation. Rather than skip the HUD element or invent a weather-change mechanic, added a minimal `Weather` enum (`CLEAR | RAIN | FOG | STORM`, mirroring the existing `Shift`/`Season` const-array pattern) purely so the field exists and can render. It starts at `CLEAR` and nothing currently changes it — no `CommandType` sets weather, since how/when it should change is undefined. Also promoted `Season` to the same named-const-array pattern as `Shift` while touching this code, for the same drift-prevention reason `Shift` was promoted earlier. The "nothing updates it" gap is now formalized as `game-design-spec.md`'s Open Design Gap #5, rather than only living in this log entry — so an implementer scanning gaps (not decisions) still finds it.

**`MinigameLauncherPayload.config`'s eventual shape (a discriminated union) logged as a formal open gap, not just fixed as `unknown` and left implicit.**
Changing `config: Record<string, any>` to `Record<string, unknown>` (see below) closes the immediate lint/strictness violation, but `unknown` is still a placeholder, not a real type — it says nothing about what a `DUEL` config vs. a `FISHING` config actually needs. Recorded in `game-design-spec.md`'s minigame-mechanics gap entry that once mechanics are specified, `config` should become `DuelConfig | LockpickingConfig | FishingConfig | DiceConfig` keyed off `type`, so the follow-up isn't lost between now and whenever that spec gets written.

**`config: Record<string, any>` changed to `Record<string, unknown>` in both `engine/types/index.ts` and `web-implementation.md` §4's code sample.**
`any` violated `CONTRIBUTING.md`'s "no any" rule (caught by `npm run lint`, not `tsc`, which doesn't flag it) — but it had been copied verbatim from `web-implementation.md` §4's own spec text in Phase 1, so fixing the code without fixing the doc would have made them diverge again. Both changed together, plus a comment in `index.ts` marking it a placeholder pending the minigame-mechanics spec.

**Component testing (`@testing-library/react` + `jsdom`) added to the tech stack as a standing rule, not a one-off.**
Phase 6 shipped six UI components with zero automated coverage — verified only via a manual Playwright/browser pass, which doesn't run on every future change the way `npm run test` does. Rather than re-litigate "does the DoD apply to UI" every phase, added the two packages to `CLAUDE.md`'s tech-stack boundary and wrote the rule directly into `CONTRIBUTING.md`: structure/behavior component tests (jsdom) are required alongside logic tests from now on; a full visual/real-browser pass (Playwright) is reserved for deliberate milestones via the new `ui-visual-check` skill, not routine per-phase work — screenshots are expensive and slow to be the default verification method for every small change.

**Dialogue branching logged as an open gap rather than left undiscovered.**
`Actor.initialDialogue` is one static string per Actor. The state needed to vary it (`activeEndeavors`, `unlockedClues`, `reputation`) already exists in `PlayerState`, which makes it tempting to wire up "if phase X, show line Y" ad hoc the next time an Actor needs more depth. Recorded as `game-design-spec.md` Open Design Gap #6 instead, since the actual mechanism (priority order between conditions, how much branching, authoring format) isn't specified and shouldn't be invented mid-feature.

**Engine UI components take content-derived data as props; only `App.tsx` imports `src/content/` directly.**
`web-implementation.md` §3 bars `src/engine/` from importing `src/content/`, but `WorldNavigationView` and `NodeInteractionCanvas` need settlement/district/POI/actor names and descriptions to render anything. Rather than weaken the boundary, `App.tsx` (outside `src/engine/`) does the content lookups and passes resolved data down as props — the same pattern already used for content-derived command payloads, applied to rendering.

**Actor-selection state (which NPC's dialogue is showing) kept as local React state, not added to `PlayerState`.**
It's view state — which panel of an already-open POI you're looking at — not something that needs to survive a reload or export. Adding it to `PlayerState`/`PlayerStateSchema` would have meant inventing a new persisted field with no gameplay meaning yet.

**"Leaving a POI" reuses `COMMAND_MOVE_TO_DISTRICT` instead of adding a new command.**
`COMMAND_MOVE_TO_DISTRICT` targeting the current `districtId` already clears `poiId` at zero shift cost, which is exactly "step back out to the district view." Adding a dedicated `COMMAND_LEAVE_POI` would have duplicated existing, already-tested behavior.

**`MinigameOverlay.tsx` added to the component directory tree; it wasn't in the original `web-implementation.md` §7 list.**
`execution-plan.md`'s Phase 6 section requires rendering the minigame modal overlay, but the five named components in §7 didn't include one for it. Added as its own file (full-screen modal, `activeMinigame`-driven, dispatches `COMMAND_RESOLVE_MINIGAME` with a hardcoded victory/defeat choice — no mechanic logic) rather than folding it into an existing component, and updated §7's file list to match.

**Testing moved from a dedicated end-phase to alongside implementation.**
Phase 3's command/store logic (shift rollover, currency conversion,
reputation clamping) shipped and was approved across two phases with
zero behavioral test coverage — only type-checking. Deferring all
tests to Phase 5 meant real logic bugs could sit undetected for
multiple approval cycles. Definition of Done now requires tests
alongside any new logic in the same phase it's introduced.

**CI Node version bumped from 20 to 24, matching local.**
jsdom 28's bundled undici (8.0.3+) requires `node:worker_threads.markAsUncloneable`,
added in Node v21.0.0. CI pinned to Node 20 caused all 6 component test files to
fail at worker startup (not a test failure — they never ran). Local Node 24 has
the API and was unaffected, which is why this wasn't caught until CI ran it.
Aligning versions everywhere going forward avoids this class of "works locally,
fails in CI" gap.

**Node version centralized into `.nvmrc`, rather than just fixing the CI number.**
Bumping `ci.yml`'s hardcoded `node-version: '24'` (above) fixed the immediate
failure but left two separately maintained copies of the same fact — nothing
stopping them from silently drifting apart again the next time either one
changes. Added `.nvmrc` (`24`) as the single source of truth: `ci.yml` now
reads `node-version-file: '.nvmrc'` instead of a hardcoded value, and
`package.json`'s `"engines": { "node": ">=24" }` makes `npm install` itself
warn locally on a mismatch. README points at `.nvmrc` so a human setting up
the repo sees the same requirement, not a fourth copy of the number.