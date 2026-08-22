# Contributing

This is a solo, closed-source project (see `LICENSE`). This file exists to keep development consistent between sessions and tools (Claude Code, this chat, or manual edits), not to invite outside contributions.

## Before Writing Anything

1. Read `CLAUDE.md` and everything under `docs/`.
2. Check `docs/execution-plan.md` for the current phase. Work in phase order — don't start a later phase before the current one is reviewed.
3. If a task isn't covered by the docs, stop and ask. Don't assume or invent an answer.
4. For anything feature-shaped (new engine capability, new minigame, new content/adventure) beyond a small fix, follow `docs/feature-workflow.md` — draft a spec under `docs/features/` before implementing, per that doc's process.

## Backlog: Issues vs. Specs

Ideas get captured as lightweight GitHub Issues (`feature_engine.yml` or
`content_adventure.yml` templates) as they come up in discussion — title,
short description, a rough note on existing capability/content touched.
This is intake only, not a substitute for `docs/feature-workflow.md`.

Flow: idea discussed -> captured as an Issue -> sits in the "Backlog" column
of the GitHub Project -> when picked up, a real spec is written under
`docs/features/` per `feature-workflow.md` as usual, moving the issue to
"In Progress" -> issue closed (linked to the spec/PR) once the spec's status
is Implemented.

Issues are not a replacement for spec rigor — full existing-capability
analysis, classification detail, and tone/lore checks still happen only in
the `docs/features/` spec at pickup time.

## Commit Conventions

Conventional Commits format: `type(scope): summary`

- `feat` — new functionality (a command handler, a UI component, a schema)
- `fix` — bug fix
- `content` — narrative/JSON content under `src/content/` (settlements, actors, endeavors, etc.)
- `docs` — changes to `docs/`, `CLAUDE.md`, `README.md`
- `test` — test additions or changes
- `chore` — tooling, dependencies, config

Examples:
```
feat(store): implement COMMAND_ADVANCE_SHIFT handler
content(actors): add actor_mara_venn
docs(system-rules): add faction influence fields
test(schemas): add POI schema validation fixtures
```

## Branching

`main` stays deployable. For anything beyond a trivial doc fix, branch as `phase/<n>-<short-name>` (e.g. `phase/1-engine-types`) or `feature/<short-name>`, then merge to `main` once the phase is confirmed working.

## Code Standards

- TypeScript strict mode, no `any` — use `unknown` and narrow via the relevant Zod schema instead.
- `src/engine/` stays generic and decoupled from narrative content — no hardcoded lore, IDs, or strings that belong in `src/content/`.
- Command handlers are pure where possible: given the same state and command, produce the same result.
- No dead code, no commented-out blocks left in place — delete or don't commit it.
- Every schema in `src/content/schemas/` needs at least one valid and one invalid fixture in `src/__tests__/schemas.test.ts` (hand-crafted edge cases for the schema's *shape*). Separately, `src/__tests__/content-integrity.test.ts` globs every real file under `src/content/` and validates it against its schema automatically — new content files need no test changes to be covered by it, only `schemas.test.ts` needs a new fixture when a new schema itself is added.
- **Any component test file whose component takes 3+ required props needs a local default-props helper (`function renderX(overrides = {})`, or a `makeXProps(overrides)` returning the defaults), not full prop lists repeated in every test.** `commands.test.ts` already does this for `PlayerState` (`makeState(overrides)`); component tests didn't have an equivalent, and `ManagementDrawer`'s prop list grew twice in one project history (`items`, then `roster`), rippling a one-line addition into ~15 existing render calls each time. A helper turns that into a one-line change at the helper definition. Retrofit an existing test file's helper the next time you're already touching it for another reason — not a mandatory standalone pass.
- **Definition of Done includes tests alongside the logic that needs them, in the same phase — not deferred to a later testing phase.** This applies to `src/engine/{store,minigames}` logic (Vitest, `node` environment) and to `src/engine/components/` (Vitest + `@testing-library/react` + `jsdom`, structure/behavior tests — e.g. "renders X from these props," "clicking Y fires this callback"). A full visual/rendering pass (Playwright, a real browser, screenshots) is *not* required every phase — reserve it for deliberate UI milestones via the `ui-visual-check` skill, not routine per-phase verification.
- Run `npm run test` and `npx tsc -b --noEmit` before considering any phase done. Both must pass clean. Use `-b` (build/project-references mode) — the root `tsconfig.json` has no `"files"`/`"include"`, only `"references"`, so bare `tsc --noEmit` silently checks nothing and always "passes."

## Content Authoring

- All JSON under `src/content/` must validate against its Zod schema before being committed. `npm run test` enforces this automatically via `content-integrity.test.ts` — a new content file that fails schema validation fails the suite, no separate step needed.
- Tone and mechanics follow the priority hierarchy in `docs/narrative-inspirations.md` — Section 1 for character/dialogue/quests, Section 2 for atmosphere, Section 3 for UI/interaction only (never narrative tone).
- Era/tech/magic constraints in `docs/world-lore.md` are strict, not suggestions (no anachronistic tech, no high-fantasy combat magic).

## Changelog

Log meaningful additions under `[Unreleased]` in `CHANGELOG.md` as you go, not at the end of a session. Move entries to a dated version section on release.

## Definition of Done (every phase)

A phase is not complete until all eight are true:
1. `npx tsc -b --noEmit` passes clean — paste the actual terminal output. (Not bare `npx tsc --noEmit` — see Code Standards above.)
2. `npm run lint` passes clean — paste the actual terminal output. Not a substitute for or covered by #1: `tsc` and ESLint catch different things (e.g. `prefer-const` isn't a type error), and CI runs both as separate steps — a phase that only checks `tsc`+`test` locally can still fail CI on lint alone. This exact gap shipped once for real (see `docs/decisions.md`), which is why it's now spelled out here instead of assumed under "the usual checks."
3. `npm run test` passes clean — paste the actual terminal output.
4. `npm run build` passes clean — paste the actual terminal output. Not fully covered by #1: `.github/workflows/deploy.yml` runs `npm run build` (which is `tsc -b && vite build`) on every push to `main` to publish GitHub Pages, and Vite's bundling/asset-resolution step is a real, separate failure mode from plain type-checking — the same shape of gap that made #2 necessary (a CI workflow runs a check no local step mirrored). Re-running `tsc -b` here is harmless/fast (incremental).
5. Any new command handler, store logic, or other non-trivial pure
   function introduced this phase has unit test coverage in the same
   phase — not deferred to a later "testing phase." Type-checking is
   not a substitute for behavioral verification.
6. The full contents of every file created or changed are shown,
   unless the user explicitly waives this for a given phase.
7. Every judgment call or ambiguity is listed explicitly, never
   silently resolved.
8. `CHANGELOG.md`'s `[Unreleased]` section has an entry for what this
   phase actually added/changed/fixed, in Keep a Changelog terms —
   not deferred to "later." A phase that touches user-visible behavior
   (a new command, a new UI element, a bug fix) with no changelog
   entry is not done.

Do not proceed to the next phase until the user explicitly approves.