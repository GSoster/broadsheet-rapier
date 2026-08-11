---
name: verify-phase
description: Run this repo's per-phase Definition of Done checklist (tsc, tests, scope check, judgment-call report, commit message) before declaring any execution-plan.md phase or follow-up done.
---

# verify-phase

Use this at the end of any unit of work on Broadsheet & Rapier /
Thornwall — a phase from `docs/execution-plan.md`, or a follow-up
correction requested mid-phase. It is the repo's standing Definition
of Done (`CONTRIBUTING.md`), turned into a checklist so it doesn't
have to be re-derived and re-typed in prose every time.

## Steps

1. **Type-check.** Run `npx tsc --noEmit`. Must produce no output. If
   it errors, fix before continuing — never report a phase done with a
   red type-check.

2. **Test.** Run `npm run test`. Must show all files/tests passing.
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

3. **Confirm scope.** Run `git status --porcelain` and check the
   changed files match what the phase actually called for — nothing
   under `src/engine/` touched when the task was "add narrative
   content," no unrelated files dragged in. If something unexpected
   shows up, explain why before moving on.

4. **Check CI coverage.** Read `.github/workflows/ci.yml`. It runs
   `npx tsc --noEmit`, `npm run lint`, and `npm run test` generically
   — new test files and new eslint rules are automatically covered by
   those three, no workflow edit needed. But if this phase added a
   *new* verification command (a new `npm run` script, a separate
   typecheck target, an e2e/visual step, a new required tool) that
   isn't one of those three existing steps, CI will silently never run
   it. If that happened, add the step to `ci.yml` and say so in the
   report — don't leave a check that only runs when a human remembers
   to run it locally.

5. **Update `CHANGELOG.md`.** Add an entry under `[Unreleased]` (Keep
   a Changelog style: Added/Changed/Fixed) for what this phase
   actually did, if it touched user-visible behavior — a new command,
   a UI element, a bug fix. Don't defer this to "later" — there's no
   later in a project without dated releases yet; entries only ever
   get written now or never.

6. **Report judgment calls.** Per `CLAUDE.md` §1 ("do not invent
   domain rules — stop and flag the gap"), anywhere a spec was
   ambiguous, silent, or self-contradictory and a decision had to be
   made to keep moving, list it explicitly in the response — don't let
   it pass silently. If the decision is non-obvious enough to matter
   for future work, it likely also belongs in `docs/decisions.md`
   (see that file's existing entries for the expected shape: the
   decision, then *why*).

7. **Propose a commit message**, following `CONTRIBUTING.md`'s
   Conventional Commits format (`type(scope): summary`). Propose only
   — don't commit unless explicitly asked to.

## Output shape

Paste the full `tsc` output (or confirm empty), the full `test`
output, a short list of files touched, confirmation `CHANGELOG.md` was
updated (or a one-line reason it wasn't — e.g. "docs-only phase, no
user-visible change"), any judgment calls, and the proposed commit
message. This is what "phase done" looks like in this repo — don't
shortcut it even when the change feels small.
