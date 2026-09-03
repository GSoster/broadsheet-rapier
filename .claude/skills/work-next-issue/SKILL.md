---
name: work-next-issue
description: Pick the next issue off the "Broadsheet & Rapier Backlog" GitHub Project and drive it through docs/feature-workflow.md's full stage sequence end to end, autonomously — selection, spec draft, design-review, implementation, verify-phase's Definition of Done, reachability, docs sync, commit/push, and issue close. Use when asked to "work the next issue," "pick up the backlog," or run this project's standing autonomous-pickup loop.
---

# work-next-issue

Drives exactly **one** backlog issue through `docs/feature-workflow.md`'s
14 stages, unattended, the same way every phase in this project's history
has actually been done — just without a human re-typing the process each
time. This skill doesn't replace `feature-workflow.md`, `verify-phase`,
`design-review`, or `CONTRIBUTING.md` — it drives them, in order, invoking
the existing skills rather than re-stating their content.

**This is genuinely autonomous by design, including the final push and
issue close.** That's the point of the skill — a human isn't expected to
be watching. The guardrails below (clean-tree check, DoD gate, explicit
halt-and-report on real ambiguity) are what keep that safe, not a
confirmation prompt before the last step. If you want a supervised run
instead — reviewing before push — say so when invoking it; that's a real,
easy override, not the default.

**One open process question this skill inherited, not resolved:**
`CONTRIBUTING.md`'s `## Branching` section says to branch and merge for
anything beyond a trivial doc fix; actual practice across every phase in
this project's history has been to push straight to `main`. This skill
follows actual practice (direct-to-`main`, gated on a clean Definition of
Done) because that's the real, revealed standard — but the conflict itself
is tracked as its own backlog issue (search for "branching rule
contradicts actual practice"). If that issue resolves the other way
(actually start branching), Step 8 below needs updating to match.

## Step 0 — Preconditions

- `gh --version` — confirm the CLI is available (per `CLAUDE.md`'s GitHub
  interaction guidance). If missing from `PATH`, locate the installed
  executable directly rather than falling back to hand-rolled REST calls.
- `git status` — the working tree must be clean before touching anything.
  If it isn't, **stop and report** what's dirty; don't discard someone's
  in-progress work to make room (per this project's own git-safety
  standing rule).
- `git pull origin main` — start from the real current `main`, not a
  stale local copy.

## Step 1 — Pick the issue

The Project board (`gh project list --owner GSoster`, currently project
**#2**, "Broadsheet & Rapier Backlog") is the authoritative backlog —
`docs/feature-workflow.md` §2 stage 3 treats "an existing Backlog issue"
and "the Project board's Backlog column" as the same thing.

1. **Self-heal orphaned issues first.** Cross-check
   `gh issue list --state open --label feature-engine` and
   `--label content-adventure` against the board
   (`gh project item-list 2 --owner GSoster --format json`). An open,
   labeled issue that isn't on the board at all is a real gap this project
   has hit twice before (issues #3 and #4 were created but never added) —
   add it (`gh project item-add`) with Status "Backlog" before doing
   anything else.
2. **Re-derive the board's field ids live** —
   `gh project field-list 2 --owner GSoster --format json` — rather than
   trusting hardcoded ones. (As of this writing: project id
   `PVT_kwHOAFyT584BhKCq`, Status field id
   `PVTSSF_lAHOAFyT584BhKCqzhgG3PQ`, options Backlog / Ready to Scope /
   In Progress / Done — treat this as a fallback reference only; re-derive
   if any `gh project item-edit` call using these ids fails.)
3. **Selection rule**, applied in order:
   - Prefer Status "Ready to Scope" over "Backlog" — a human already
     promoted it, so it outranks FIFO order.
   - Within the same status, take the **lowest issue number** (oldest,
     FIFO) — not "most interesting," not re-prioritized by guesswork.
   - Skip anything already "In Progress" or "Done", and skip the two
     `[Test] ...` template-verification issues (#1/#2) — fixtures, not
     real work.
   - If nothing qualifies, **stop and report** "backlog is empty" — don't
     invent work to stay busy.
4. Read the full issue (`gh issue view <n>`) — its Description +
   "What existing capability might this touch or need?" is the seed for
   Step 4's spec draft, not a substitute for it (`CONTRIBUTING.md`:
   "Issues are not a replacement for spec rigor").
5. Move the item's Status to "In Progress" immediately — the signal to a
   human glancing at the board that this issue is claimed, before any code
   exists.

**Resuming an interrupted run:** if an item is already "In Progress" with
a matching `docs/features/*.md` file already in `Draft` status and
uncommitted related changes on disk, resume from wherever that state
implies rather than restarting from issue selection.

## Step 2 — Classify and confirm stages 2-4

- The issue's label (`feature-engine` or `content-adventure`) is stage 2's
  classification, already decided at intake — don't re-litigate it.
- Stage 3 (Issue) is already satisfied — this issue *is* that stage.
- **Stage 4 (Sequencing), Content/Adventure issues only:** do the
  existing-capability check now. If it needs engine capability that
  doesn't exist yet, **stop implementing inline** — search open issues for
  the missing capability; if none exists, file one (`feature_engine.yml`,
  same as any live-decided idea per stage 3). Comment the blocking
  dependency on the original issue, move its Status back to "Backlog" (not
  "In Progress" — it isn't actionable yet), and end the run reporting this
  outcome.

## Step 3 — Small-fix carve-out check

Some issues are explicitly pure process/infra work per
`docs/feature-workflow.md` §2 stage 2's carve-out (a CI tweak, a one-off
doc correction) — several issues already in this backlog say so directly
in their own body. If so:

- Skip Step 4's full spec + `design-review` weight.
- Still run the complete Definition of Done (Step 5).
- Still write a `docs/decisions.md` entry for any real judgment call.
- Still close the issue linking the commit (Step 8) — small-fix work still
  gets the same closing chain, just not the spec file.

If it's genuinely ambiguous whether the carve-out applies, **don't**
default to the lighter path — treat it as a full spec instead. That's the
safer, more conservative default, consistent with this project's own bias
toward a written, reviewed plan before code
(`docs/review-standards.md` Standard 6).

## Step 4 — Draft the spec (stage 5) — skipped if Step 3 applied

- Write `docs/features/feature_<slug>.md` or `content_<slug>.md` per
  `docs/feature-workflow.md` §4's template: Goal, Classification, Issue
  (link the number), Existing-capability check, Integration points,
  Reachability, Consistency check, Environment notes, Test plan,
  Content-schema scaling note, Open questions, Status: `Draft`.
- **Invoke the `design-review` skill** against the drafted spec before
  treating it as ready to implement — mandatory per that skill's own
  frontmatter for anything cross-cutting or architecturally new, which
  covers most of what reaches this stage.
- **Genuine domain ambiguity is a hard stop, not a judgment call.** Per
  `CLAUDE.md` §1: do not invent a rule absent from `game-design-spec.md`/
  `web-implementation.md` (minigame mechanics, reputation thresholds,
  economy numbers, undocumented narrative facts). If the issue needs one,
  **stop here** — comment the specific blocking question on the issue,
  move Status back to "Backlog", end the run. Implementation-detail
  choices (naming, file placement, which existing pattern to extend) are
  fine to decide autonomously, exactly as this project's own history
  already does — but record them explicitly in the spec's Open Questions
  and, later, in the `decisions.md` entry. Never silently.

## Step 5 — Implement (stage 7)

- Follow the spec. Reuse existing patterns/utilities before inventing new
  ones — check `docs/decisions.md` and the relevant `src/engine/`
  directory structure first, the same habit this project's own history
  repeatedly credits for avoiding duplicate mechanisms.
- **Invoke the `verify-phase` skill's full checklist** before considering
  implementation done. All of it, not a subset — tsc, lint, test, build,
  reachability, consistency sweep, scope confirmation, CI-coverage check,
  CHANGELOG entry, judgment-call report, commit message.

## Step 6 — Reachability & consistency sweep (stages 8-9)

Already covered by `verify-phase`'s own steps 5-6 — but for a
player-facing change, actually exercise it, don't just plan to. Use the
dev-only Reset Progress button + reload for a genuinely fresh state where
that's practical; where it isn't (state that can't be reached from a cold
start without dozens of manual steps), this project's own precedent is a
documented, explicitly-named deviation — headless-browser automation
(Playwright) against a real dev server, or direct `localStorage` seeding
matching the store's actual persisted shape — stated as what it is, not
silently substituted for the real standard.

## Step 7 — Docs sync, CHANGELOG, decisions.md, spec status (stages 10-13)

- Re-read every doc paragraph whose *truth* changed, not just the section
  being added to.
- `docs/engine.md` update required if the CQRS dispatch flow, `EntryEffect`
  pattern, Dialogue/Minigame system, or the engine↔content boundary
  changed.
- `CHANGELOG.md` entry required (`verify-phase` step 9) — already covered
  if that skill was actually run in full.
- `docs/decisions.md` entry for every non-obvious call made anywhere in
  this run — this is where Step 4/5's judgment calls get a permanent
  record, not just a mention in the final report.
- Flip the spec's `## Status` to `Implemented`, linked to the CHANGELOG
  entry and the decisions.md entries. Add the row to
  `docs/features/README.md`'s index.

## Step 8 — Commit, push, close (stage 14)

- Stage only what this issue actually touched — review `git status` after
  staging, never blind `git add -A`. Per this project's own git-safety
  habits, double-check nothing unexpected (a stray scratch file, an
  unrelated edit) rode along, and check file contents before staging
  anything that could plausibly hold a secret.
- Commit using Conventional Commits (`CONTRIBUTING.md`): `type(scope):
  summary`, body explaining *why*, ending with `Closes #<n>` so the push
  auto-closes the issue — this project's established pattern for every
  phase so far.
- **Push directly to `main`** — see this file's header note on the
  branching-vs-practice conflict. Gated strictly on Step 5's Definition of
  Done being fully clean; never push on a red `tsc`/lint/test/build.
- Confirm the issue actually closed
  (`gh issue view <n> --json state -q .state`). If the auto-close keyword
  didn't fire, close explicitly with a comment linking the shipping
  commit hash(es), the spec file, and the CHANGELOG entry — the same
  closing-comment shape every prior issue in this repo already uses.
- Move the Project item's Status to "Done".

## Output shape

End every run — completed or halted — with:
- Which issue was picked, and why (which selection-rule branch fired).
- Outcome: completed, or exactly where/why it stopped (domain ambiguity,
  missing engine capability, empty backlog, dirty working tree, a DoD
  failure that couldn't be resolved).
- The full Definition of Done output (`verify-phase`'s own output shape),
  if implementation happened.
- Every judgment call made, and where it's now recorded
  (`docs/decisions.md` entry, by name).
- The closing chain: issue → spec (if any) → commit hash(es) → CHANGELOG
  entry.
