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
