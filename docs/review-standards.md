# Review Standards

Six recurring review-failure patterns from this project's actual history,
each grounded in the real incident that motivated it — not restated as
abstract principle. Used by human review, conversational review, and the
`design-review` skill (which runs this checklist against a plan before it's
presented, per `docs/feature-workflow.md`'s stage 6 review gate).

Like `docs/feature-workflow.md`, this file is derived from retrospective,
not written speculatively: add a new pattern here only once a real second or
third instance of it has actually happened, the same discipline this
project already applies to generalizing anything else (see
`game-design-spec.md`'s Open Design Gap #9 treatment, and
`docs/feature-workflow.md`'s own §1).

---

## 1. Never accept "done" without pasted output

**Rule:** A claim that `tsc`/`lint`/`test`/`build` passed is only as good as
the actual command invoked and its actual output. "Clean" or "confirmed" is
not verifiable from a description of intent — paste the real terminal
output, every time.

**Incident** (`docs/decisions.md`, 2026-08-11): `npx tsc --noEmit` (bare)
had been silently checking zero files for the entire project's history.
> "`npx tsc --noEmit` (bare) has been silently checking zero files all
> project long... Root cause: `tsconfig.json` at the repo root only has
> `"references"`... no `"files"`/`"include"` of its own — bare `tsc` doesn't
> follow project references without the `-b` (build) flag, so it was
> compiling nothing and trivially 'succeeding' every time... This means the
> type error sat undetected through `tsc`, `lint`, and `test` alike — only
> a real production build surfaces this class of mistake."

Every prior phase that reported "type-check clean" across the project's
history had been reporting a vacuous check — not a lie, but an unverified
claim that happened to be wrong, undetectable until `npm run build`
(`tsc -b && vite build`) finally exercised the real compiler settings by
accident.

**Prevents:** A silently no-op check being trusted as a real one,
indefinitely, because nothing about its output looked different from a real
pass.

---

## 2. Distinguish the user's decision from the assistant's own default within an open option

**Rule:** If a spec or plan leaves something unresolved — an option, a
placeholder, a default chosen for now — say so explicitly as unresolved.
Never write it up as if it were already decided. This applies symmetrically:
don't claim the user settled something they didn't, and don't silently
absorb an assistant-made default into "the plan already covers this."

**Incident** (`docs/decisions.md`, 2026-08-12): the Rapier Duel's guard-break
mechanic.
> "Guard-break: a combatant whose poise is already 0 takes bonus energy
> damage (`GUARD_BREAK_BONUS_DAMAGE`) from a landed Thrust/Dirty Trick —
> added during plan review, not in the original brief. The original brief
> left poise reaching 0 as purely informational (feeding
> `chooseOpponentAction`'s heuristics and the UI only). On review, poise
> hitting 0 with no mechanical consequence at all felt like a missing
> payoff for a whole stat track."

The original design treated "poise-0 has no mechanical consequence" as
settled, when it was really just an unexamined default — nobody had
actually decided that poise should stay purely informational, it just
hadn't been raised as a question. It only became a real, deliberate design
choice once review surfaced it explicitly and someone actually decided.

**Prevents:** A real open design question disappearing into a report that
reads as if it were already resolved.

---

## 3. The reuse-of-meaning test

**Rule:** Before reusing an existing command, field, or mechanism for a new
purpose, ask explicitly — *does this change what it represents to its
other, existing consumers, or only how it gets triggered?* If the former,
it isn't reuse, it's overloading, and needs its own primitive instead.

**Incident** (`docs/decisions.md`, 2026-08-10): `COMMAND_UNLOCK_CLUE`
repurposed as an endeavor-completion flag, then reverted.
> "Endeavor completion (`phase_confront_the_buyer`...) marked via
> `COMMAND_UNLOCK_CLUE` with a dedicated clue ID, not a new command or
> state field... reusing it for `clue_broadsheet_case_closed` cost nothing
> new and matches the session's running preference for reusing an existing
> primitive over inventing a command for a one-off need."

Reverted two entries later:
> "Reversed: endeavor completion no longer uses `COMMAND_UNLOCK_CLUE` as a
> marker... On review, repurposing `unlockedClues` (meant for narrative
> discoveries) as a mechanical 'already paid' flag was the wrong call — it
> solved a real problem (preventing repeat payment) by overloading a system
> that means something else."

The general habit ("reuse an existing primitive over inventing a new one")
was correct as a habit — it was misapplied here specifically because the
question above was never asked before reusing it.

**Prevents:** A primitive silently meaning two incompatible things to two
different call sites, discovered only when one of them breaks.

---

## 4. Check the actual radius of a change

**Rule:** After changing a fact about an entity (a faction, a name, a
value), grep for every other place that fact is asserted — title,
description, related content, doc prose — not just the field that was the
direct target of the change.

**Incident** (`docs/decisions.md`, 2026-08-10): Mara Venn's faction
corrected, her title left stale.
> "Mara Venn's `factionIds` corrected to `[\"faction_wagering_ring\"]`
> only... Her `title` ('City Watch Sergeant') and `description` were
> deliberately left untouched (out of scope for this correction), which
> now reads as narratively inconsistent with her faction — flagged for a
> follow-up content pass, not silently fixed."

Fixed two entries later, once the radius was actually checked:
> "Mara Venn's `title` and `description` updated to match her corrected
> faction, closing the gap flagged two entries above... Left as 'City
> Watch Sergeant'... when only `factionIds` was corrected, which just
> relocated the inconsistency from the faction field to the title/
> description instead of removing it."

**Prevents:** A correctly-scoped change leaving a stale, contradictory
trace elsewhere that nothing automated catches (no schema or referential-
integrity check flags a title that merely *reads* wrong).

---

## 5. Verify environment/tooling assumptions somewhere other than where they were authored

**Rule:** A version pin, a config default, or a "this works" fact needs
checking against the *other* place it's supposed to hold — CI, a clean
checkout, a different machine — not just re-confirmed in the same
environment it was set in.

**Incident** (`docs/decisions.md`, 2026-08-10): Node 20 (CI) vs. Node 24
(local).
> "CI Node version bumped from 20 to 24, matching local. jsdom 28's bundled
> undici (8.0.3+) requires `node:worker_threads.markAsUncloneable`, added
> in Node v21.0.0. CI pinned to Node 20 caused all 6 component test files
> to fail at worker startup (not a test failure — they never ran). Local
> Node 24 has the API and was unaffected, which is why this wasn't caught
> until CI ran it."

Local development had been "passing" the whole time — the assumption (this
Node version works) was true exactly where it was made and nowhere it
actually needed to hold.

**Prevents:** A local-only truth shipping as if it were universal, caught
only when the other environment finally runs it.

---

## 6. Require a written plan, reviewed before code, for cross-cutting or architecturally new work

**Rule:** Anything touching multiple subsystems, introducing a new pattern,
or reinterpreting an existing trigger/call site gets a written plan,
reviewed *before* implementation starts. Not required for small,
well-precedented content work (a new dialogue file following an already-
established pattern doesn't need this weight).

**Incident** (`docs/decisions.md`, 2026-08-10): `entrySoundAsset` almost
wired to the wrong call site.
> "District's `entrySoundAsset` fires once on initial app mount, not from
> `onLeave`... The original plan wired it to `onLeave`, reasoning that's
> the only existing `COMMAND_MOVE_TO_DISTRICT` call site. On review this
> was wrong: `onLeave` fires when stepping out of a POI back into the
> *same* district the player never actually left... This was a semantic
> mismatch, not a technical limitation — nothing stopped the code from
> working, it just would have meant the wrong thing."

Caught *before any code existed*, purely because the plan was written down
and reviewed first — the source incident `docs/feature-workflow.md` §1's
"success case" (category H) generalizes from, and the specific reason that
document requires a written spec before implementation as a mechanism
separate from the Definition of Done's tests.

**Prevents:** Exactly the class of mistake this incident caught for
free — a semantically wrong integration point that no test would have
caught (the code would have worked; it would have meant the wrong thing).
