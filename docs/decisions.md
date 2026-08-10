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
