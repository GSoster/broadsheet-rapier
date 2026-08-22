---
name: design-review
description: Run docs/review-standards.md's six-point checklist against Claude Code's OWN plan before presenting it for approval — mandatory for any plan that isn't small, well-precedented content work, not a suggestion to consider.
---

# design-review

Use this while still in plan mode, before calling `ExitPlanMode` — this is
a check on the plan itself, before code exists, not a retrospective audit
after implementation (that's `verify-phase`'s job, for a different moment).
Mandatory for anything cross-cutting or architecturally new; skippable only
for small, well-precedented content work, mirroring `docs/review-standards.md`
§6's own carve-out (a new dialogue file following an established pattern
doesn't need this weight).

## Steps

1. **Load `docs/review-standards.md`** before finalizing any plan. Its six
   patterns are each grounded in a real incident from this project's
   history (`docs/decisions.md`) — re-read them, don't work from memory of
   what they roughly say.

2. **Run all six checks against the plan being prepared:**

   - **Pasted output, not assertions.** Does the plan's verification
     section specify pasting real command output (`tsc`, `lint`, `test`,
     `build`, or whatever else applies), not just asserting "tests will
     pass" or "this should work"? (Standard 1 — the `tsc -b` incident: a
     check that was never actually exercising anything looked identical to
     a real pass for the entire project's history.)
   - **User decision vs. assistant default.** Does the plan clearly
     separate what the user has explicitly decided from what's a
     default/recommendation being proposed within an option left open? Any
     judgment call not yet confirmed by the user must be written as a
     flagged open question, not stated as settled. (Standard 2 — the
     poise-as-informational incident: an unexamined default got treated as
     a design decision until review asked the question.)
   - **Reuse-of-meaning.** For any existing command/field/mechanism the
     plan proposes reusing: does this change what it *represents* to its
     *other* existing consumers, or only *how* it gets triggered? State the
     answer explicitly in the plan — don't skip the question because reuse
     "feels" right. (Standard 3 — `COMMAND_UNLOCK_CLUE` reused as a
     completion flag, then reverted for overloading its meaning.)
   - **Radius of change.** For any changed fact (a value, a name, a
     relationship) — has the plan identified everything else that
     references it, via an actual grep, not an assumption that nothing
     else does? (Standard 4 — Mara Venn's title staying stale after her
     faction was corrected.)
   - **Environment/tooling assumptions.** For anything that depends on a
     version, config default, or "this works here" fact — has the plan
     noted where else it needs to hold true (CI, a clean checkout, a
     different machine), and whether that's actually been checked, not
     just assumed from the current environment? (Standard 5 — Node 20 CI
     vs. Node 24 local.)
   - **Written-plan weight check.** Is this cross-cutting or
     architecturally new work — already getting the scrutiny of being in
     plan mode, reviewed before code, as it should be? Or is it small,
     well-precedented content work where that full weight would be
     over-formalizing? State which one it is; don't apply heavy process to
     trivial work or skip real review on substantial work. (Standard 6 —
     the `entrySoundAsset`/`onLeave` semantic mismatch caught for free
     because it was written down and reviewed first.)

3. **Fix the plan before calling `ExitPlanMode`** if any check fails or is
   ambiguous. This happens *before* presenting the plan to the user, not as
   something to note and move past.

4. **State the check explicitly as part of what's shown to the user** —
   not hidden deliberation. A short pass through which of the six were
   relevant and how each was satisfied. Skip stating a check only when it's
   genuinely inapplicable (e.g., no reused primitive at all in a docs-only
   change) — say so briefly in one line; don't silently omit it.

## Output shape

A short checklist-style confirmation, appended to the plan or stated just
before `ExitPlanMode` — not a separate report, not deferred until after
implementation. Six lines is enough: one per standard, each either how it
was satisfied or why it's inapplicable here.
