# Contributing

This is a solo, closed-source project (see `LICENSE`). This file exists to keep development consistent between sessions and tools (Claude Code, this chat, or manual edits), not to invite outside contributions.

## Before Writing Anything

1. Read `CLAUDE.md` and everything under `docs/`.
2. Check `docs/execution-plan.md` for the current phase. Work in phase order — don't start a later phase before the current one is reviewed.
3. If a task isn't covered by the docs, stop and ask. Don't assume or invent an answer.

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
- Every schema in `src/content/schemas/` needs at least one valid and one invalid fixture in `src/__tests__/`.
- Run `npm run test` and `npx tsc --noEmit` before considering any phase done. Both must pass clean.

## Content Authoring

- All JSON under `src/content/` must validate against its Zod schema before being committed.
- Tone and mechanics follow the priority hierarchy in `docs/narrative-inspirations.md` — Section 1 for character/dialogue/quests, Section 2 for atmosphere, Section 3 for UI/interaction only (never narrative tone).
- Era/tech/magic constraints in `docs/world-lore.md` are strict, not suggestions (no anachronistic tech, no high-fantasy combat magic).

## Changelog

Log meaningful additions under `[Unreleased]` in `CHANGELOG.md` as you go, not at the end of a session. Move entries to a dated version section on release.

## Definition of Done (every phase)

A phase is not complete until all five are true:
1. `npx tsc --noEmit` passes clean — paste the actual terminal output.
2. `npm run test` passes clean — paste the actual terminal output.
3. Any new command handler, store logic, or other non-trivial pure
   function introduced this phase has unit test coverage in the same
   phase — not deferred to a later "testing phase." Type-checking is
   not a substitute for behavioral verification.
4. The full contents of every file created or changed are shown,
   unless the user explicitly waives this for a given phase.
5. Every judgment call or ambiguity is listed explicitly, never
   silently resolved.

Do not proceed to the next phase until the user explicitly approves.