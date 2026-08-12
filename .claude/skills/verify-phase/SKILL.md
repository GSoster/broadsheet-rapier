---
name: verify-phase
description: Run this repo's per-phase Definition of Done checklist (tsc, lint, tests, scope check, judgment-call report, commit message) before declaring any execution-plan.md phase or follow-up done.
---

# verify-phase

Use this at the end of any unit of work on Broadsheet & Rapier /
Thornwall — a phase from `docs/execution-plan.md`, or a follow-up
correction requested mid-phase. It is the repo's standing Definition
of Done (`CONTRIBUTING.md`), turned into a checklist so it doesn't
have to be re-derived and re-typed in prose every time.

## Steps

1. **Type-check.** Run `npx tsc -b --noEmit` — **not** bare `npx tsc
   --noEmit`. The root `tsconfig.json` only has `"references"`, no
   `"files"`/`"include"`; bare `tsc` silently checks zero files and
   always "succeeds" without `-b` to follow the references into
   `tsconfig.app.json`/`tsconfig.node.json`. This was discovered the
   hard way — every "tsc clean" claimed all session, and every CI
   "Type check" step, was vacuous until `npm run build` (which uses
   `tsc -b`) surfaced a real, pre-existing error nothing had caught.
   Must produce no output. If it errors, fix before continuing — never
   report a phase done with a red type-check.

2. **Lint.** Run `npm run lint`. Must produce no output/errors. This is
   **not** covered by step 1 — `tsc` and ESLint check different things
   (e.g. `prefer-const` on a variable that's mutated-in-place but never
   reassigned is a lint error, not a type error), and CI runs them as
   two separate steps in this exact order (`.github/workflows/ci.yml`:
   Type check → Lint → Test). A phase that only ran `tsc`+`test`
   locally shipped a real lint-only CI failure once for exactly this
   reason (see `docs/decisions.md`) — don't skip this step because
   `tsc` was clean.

3. **Test.** Run `npm run test`. Must show all files/tests passing.
   Per `CONTRIBUTING.md`'s Definition of Done, tests are written
   *alongside* the logic that needs them, in the same phase, not
   deferred:
   - Logic in `src/engine/{store,minigames}` → Vitest, `node`
     environment (the project default).
   - Components in `src/engine/components/` → Vitest +
     `@testing-library/react`, with `// @vitest-environment jsdom` at
     the top of the test file (see any file in
     `src/__tests__/components/` for the pattern). Structure/behavior
     tests only — "renders X from these props," "clicking Y fires
     this callback." Not visual/pixel tests; that's a separate,
     occasional pass via the `ui-visual-check` skill, not routine
     per-phase work.
   - A schema in `src/content/schemas/` needs at least one valid and
     one invalid fixture in `schemas.test.ts` (`CONTRIBUTING.md`). A
     new *content file* under an existing schema needs no test
     changes — `content-integrity.test.ts` globs `src/content/**` and
     validates every real file automatically; only check that this
     test file's glob patterns still cover any newly-added content
     subfolder.
   - If this phase adds or changes a schema field with `.default(...)`,
     a passing `content-integrity.test.ts`/`schemas.test.ts` does **not**
     prove it's safe — both only ever exercise the *parsed* shape.
     Confirm the field is actually reachable through `App.tsx`'s
     parse-on-load path (`src/contentLoader.ts`) instead; this is the
     real, previously-live gap that let a raw content file omit a
     defaulted field and crash at runtime with every test green
     (`docs/decisions.md`).

4. **Reachability check.** For anything with a player-facing entry
   point (a new action, minigame, UI element), verify it from a
   genuinely fresh state — use the dev-only Reset Progress button
   (`ManagementDrawer`) + reload, not hand-editing `localStorage`. Per
   `docs/feature-workflow.md` Category A: this is manual and has no
   automated backstop, same enforcement risk as a skipped CHANGELOG
   entry — it only happens if actually done, so do it, don't just note
   that it should be done.

5. **Consistency sweep.** Grep for other references to any entity/value
   this phase changed (a renamed field, a corrected faction, a changed
   title) — `content-integrity.test.ts` catches *broken references*
   automatically, but not attribute-level drift (a stale title after a
   related field changes). Per `docs/feature-workflow.md` Category C:
   also manual, also unenforced by anything automatic — same discipline
   as the reachability check above.

6. **Confirm scope.** Run `git status --porcelain` and check the
   changed files match what the phase actually called for — nothing
   under `src/engine/` touched when the task was "add narrative
   content," no unrelated files dragged in. If something unexpected
   shows up, explain why before moving on.

7. **Check CI coverage.** Read `.github/workflows/ci.yml`. It runs
   `npx tsc -b --noEmit`, `npm run lint`, and `npm run test` — steps 1,
   2, and 3 above already cover all three locally, so new test files
   and new eslint rules need no workflow edit. But if this phase added
   a *new* verification command (a new `npm run` script, a separate
   typecheck target, an e2e/visual step, a new required tool) that
   isn't one of those three existing steps, CI will silently never run
   it. If that happened, add the step to `ci.yml` and say so in the
   report — don't leave a check that only runs when a human remembers
   to run it locally.

8. **Update `CHANGELOG.md`.** Add an entry under `[Unreleased]` (Keep
   a Changelog style: Added/Changed/Fixed) for what this phase
   actually did, if it touched user-visible behavior — a new command,
   a UI element, a bug fix. Don't defer this to "later" — there's no
   later in a project without dated releases yet; entries only ever
   get written now or never.

9. **Report judgment calls.** Per `CLAUDE.md` §1 ("do not invent
   domain rules — stop and flag the gap"), anywhere a spec was
   ambiguous, silent, or self-contradictory and a decision had to be
   made to keep moving, list it explicitly in the response — don't let
   it pass silently. If the decision is non-obvious enough to matter
   for future work, it likely also belongs in `docs/decisions.md`
   (see that file's existing entries for the expected shape: the
   decision, then *why*). For anything feature-shaped (new engine
   capability or new content), check whether it should have had a
   `docs/features/` spec per `docs/feature-workflow.md` — retroactively
   backfilling one is better than never having one.

10. **Propose a commit message**, following `CONTRIBUTING.md`'s
    Conventional Commits format (`type(scope): summary`). Propose only
    — don't commit unless explicitly asked to.

## Output shape

Paste the full `tsc` output (or confirm empty), the full `lint`
output (or confirm empty), the full `test` output, a short list of
files touched, confirmation `CHANGELOG.md` was updated (or a one-line
reason it wasn't — e.g. "docs-only phase, no user-visible change"),
any judgment calls, and the proposed commit message. This is what
"phase done" looks like in this repo — don't shortcut it even when the
change feels small.
