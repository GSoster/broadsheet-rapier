# Feature Workflow

This document defines the repeatable process for taking a feature — engine capability or content/adventure — from first conversation to done, in a way that leaves a durable, cross-linked paper trail (`docs/features/` → `CHANGELOG.md` → `docs/decisions.md`) instead of only living in chat history.

It was derived from a retrospective on this project's actual history, not written speculatively — Section 1 names the specific risk categories that retrospective found; Section 2 is the process designed to catch them. Re-read Section 1 before assuming the process is complete; it exists to catch *these* categories, and a category not listed here isn't necessarily covered.

---

## 1. Risk categories (why this process exists)

Seven repeatable risk categories showed up across this project's phases so far, plus one success case worth preserving deliberately.

**A. Reachability gaps.** A feature is correct and unit-tested in isolation, but unreachable from a real player's path. The dice minigame was fully built and tested, but the player started with zero currency, so "Gamble" was permanently disabled on a fresh save. Nothing static catches this — only running the app from a genuinely fresh state does.

**B. Reuse-of-meaning vs. reuse-of-mechanism.** This project's own good habit (reuse an existing primitive instead of inventing a new command) was once misapplied to *meaning*: `COMMAND_UNLOCK_CLUE` was repurposed as an "endeavor completed" flag, overloading what the clue system represents to its other consumers. Caught in review, reverted. The distinguishing question: does reusing this thing change what it *represents* to its other existing consumers, or only *how* it gets triggered?

**C. Data/reference drift after a correctly-scoped change.** The change does exactly what was asked; a semantically-coupled fact elsewhere goes stale because the coupling isn't tracked anywhere machine-checkable. Mara Venn's `factionIds` was corrected, but her title/description stayed watch-affiliated for two more turns. A doc paragraph asserting "no negative-balance protection" went stale the moment that behavior shipped. `Shift` was defined independently in two files before being centralized.

**D. Environment assumptions that only fail elsewhere.** Local Node 24, CI pinned to Node 20 — invisible until CI actually ran the thing that needed Node ≥21.

**E. Unverified implicit contracts.** A design decision is made and reasoned about correctly, even documented in prose — but nothing *checks* it. `eventLog` exclusion from persistence was designed right from the start, but had zero test coverage until explicitly requested, several phases later.

**F. Test/validation coverage that doesn't scale with growth.** `schemas.test.ts`'s hand-picked fixture imports silently stopped covering new content the moment a second faction file was added, until replaced by the glob-based `content-integrity.test.ts`.

**G. Process discipline debt.** `CONTRIBUTING.md` mandated `CHANGELOG.md` updates from early on; it sat empty for five feature phases until pointed out. A written rule with no enforcement mechanism decays under time pressure.

**H. The success case.** When the audio feature's plan proposed wiring `entrySoundAsset` to `onLeave` (the only existing `COMMAND_MOVE_TO_DISTRICT` call site), review caught — *before any code existed* — that `onLeave` means "left a POI," not "arrived in a district." Same shape of mistake as category C, caught for free because it was written down and reviewed first. **This is why Section 2 requires a written spec before implementation, separately from the Definition of Done's tests**: categories A and E were only ever caught by running the app or being explicitly asked to verify; B/C/D-shaped risks are what a reviewed spec catches beforehand. The two mechanisms catch different things — this workflow needs both.

**On enforcement, read honestly:** the Reachability check and Consistency sweep steps below (targeting A and C) are **manual, with no automated backstop** — the same category of risk as G itself (a written rule that only helps if actually followed). Don't overstate what this workflow guarantees: it structures the right questions and creates a paper trail, but nothing forces a skipped reachability check to fail loudly the way a broken test does. That's exactly why both are restated as explicit, numbered steps in the `verify-phase` skill (checked every phase) rather than left as something this doc merely describes and hopes gets remembered.

---

## 2. Stages

1. **Intake** — the feature/content idea is described in conversation (by you, or later, an AI-authored adventure outline — see §6).
2. **Classify** — Feature/Engine spec or Content/Adventure spec (templates in §4). Small fixes and pure process/infra work (a CI tweak, a skill update, a one-off doc correction) stay outside this workflow; `docs/decisions.md` alone still covers those, as it always has.
3. **Sequencing** — if this is a Content/Adventure spec, confirm every engine capability it needs already exists (§4's "existing-capability check" is the actual gate, not a separate step). **Content development is its own phase, sequenced after the engine/feature phase(s) it depends on** — not a per-instance pause-or-substitute decision made mid-implementation. If the existing-capability check finds a gap, that gap becomes (or maps to) a Feature/Engine spec, and the content spec's implementation waits until that feature spec is built and landed. This is the default assumption for how content work gets sequenced, not a rule that only fires when a surprise gap turns up — and it applies the same way regardless of whether the content spec was human- or AI-authored.
4. **Draft the spec** as a real file under `docs/features/` (§3) — the gate that catches categories B, C, D, F before code, the way review just did for audio's `onLeave` case.
5. **Review** — conversational; approval gate before implementation starts.
6. **Implement**, per the existing Definition of Done (`tsc`/`test`/`lint`, tests alongside logic).
7. **Reachability check** — for anything with a player-facing entry point, verify it from a genuinely fresh state: the dev-only **Reset Progress** button (`ManagementDrawer`) + reload, not hand-clearing `localStorage`. Targets category A. Manual — see the enforcement note in §1.
8. **Consistency sweep** — grep for other references to whatever entity/value this feature touched. Targets category C. Also manual — `content-integrity.test.ts`'s referential-integrity checks (§5) catch *broken references* automatically, but not attribute-level drift like a stale title.
9. **Docs sync** — re-read any doc paragraph whose truth this feature changed, not just the section being added to.
10. **CHANGELOG.md entry** — required, not optional, per the existing Definition of Done.
11. **decisions.md entries** for non-obvious calls — unchanged from current practice.
12. **Spec status update** — mark the spec `Implemented`, linking to its CHANGELOG entry and decisions.md entries. Closes the loop.

---

## 3. Where specs live

`docs/features/`, one file per feature, filename prefixed by type: `feature_<slug>.md` / `content_<slug>.md` — mirroring this project's existing type-prefixed content-ID convention (`poi_`, `actor_`, `faction_`) rather than inventing a new naming scheme. `docs/features/README.md` indexes them (title, type, status, one line) since — unlike `CHANGELOG.md`/`decisions.md`, which are single append-only files — a directory of many small files needs its own discoverable entry point.

**Revisit trigger:** once `docs/features/` exceeds roughly 20 files, revisit whether a flat directory (plus the README index) is still the right structure, or whether it needs subdividing (e.g. by type, or an archive for long-superseded specs). Same discipline already applied to the nested-`CLAUDE.md` deferral in §7 — a concrete, checkable trigger, not "eventually."

**Cross-referencing:** a spec's `## Status` line points forward to its CHANGELOG entry and decisions.md entries once implemented. CHANGELOG entries substantial enough to have gotten a spec link back to it. Not mandatory for every single line — not every change is spec-worthy.

---

## 4. Spec template

### Base sections (both types)

- **Goal** — one paragraph, player-facing.
- **Classification** — Feature/Engine or Content/Adventure.
- **Existing-capability check** — what commands/schemas/content/patterns already cover part of this. Explicit sub-question: *if reusing an existing primitive, does this change what it means to its other consumers?* (targets B). For a Content/Adventure spec, this section **is** the sequencing gate from §2 stage 3 — any gap found here becomes a Feature/Engine spec dependency, not something worked around inline.
- **Integration points** — every dispatch/mount/trigger location this hooks into, each with a one-line justification of *why that's the correct semantic moment*. This is the exact question that caught the `onLeave` mistake before it shipped; the template makes it mandatory instead of incidental.
- **Reachability** — how does a brand-new player, from a fresh save, actually encounter this? (targets A)
- **Consistency check** — what other content/docs reference the thing(s) this touches? (targets C)
- **Environment notes** — does this rely on anything that might differ between local and CI? (targets D; usually N/A, but forces the check)
- **Test plan** — including any "should never happen"/invariant-style assertions, not just happy-path coverage (targets E)
- **Content-schema scaling note** — does `content-integrity.test.ts`'s glob (and now its referential-integrity checks, §5) already cover this, or does a new pattern need adding? (targets F) **If this phase adds or changes a content schema field with `.default(...)`, also confirm it's reachable through `App.tsx`'s parse-on-load path (`src/contentLoader.ts`'s `loadContent`, `web-implementation.md`'s Content Loading section) — `content-integrity.test.ts`/`schemas.test.ts` only ever exercise the *parsed* shape and will pass even if a raw content file omits the field, which is exactly the gap that caused a real runtime crash during the dialogue-branching phase (see `docs/decisions.md`). A schema default is not proven reachable by a passing schema test alone.**
- **Open questions / explicitly deferred scope.**
- **Status** — `Draft` → `Approved` → `Implemented (CHANGELOG: "…"; decisions.md: "…")`.

### Feature/Engine spec adds

- New `CommandType`(s), schema fields, or engine subsystem directory needed?
- Where in `src/engine/` does this live — an existing subsystem, or a new one (like `audio/` was)?
- Does it change the CQRS contract (new command shape, new event)?
- Backward compatibility — does existing content need updating to stay valid?

### Content/Adventure spec adds

- References **only** existing engine capability — no new command types, minigame types, or schema fields. (If one's needed, see §2 stage 3 — this spec waits on a Feature/Engine spec, it doesn't invent inline.)
- Endeavor phase outline: phases, required clues, unlock triggers, which existing `MinigameType`s are involved, which existing commands drive reputation/currency effects.
- Actor/District/POI list — existing entities reused vs. new ones authored (new ones still validate against existing schemas only).
- **Tone check** — explicit reference to `narrative-inspirations.md`'s priority hierarchy and `world-lore.md`'s era constraints. Content specs are precisely where tone/lore drift would first appear. Authorship-agnostic — applies the same whether a human or an AI drafted the outline.
- **Balance flag, not balance invention** — if the outline implies specific reward/cost numbers, flag against the still-open economy-balance gap (`game-design-spec.md`) rather than inventing figures.

---

## 5. `content-integrity.test.ts`: referential integrity

Beyond schema validation, this file also checks that cross-references between content files actually resolve: `Actor.factionIds` → existing `Faction`, `POI.actorIds` → existing `Actor` (and the reverse: that `Actor`'s `poiId` points back), `District.poiIds` → existing `POI` (and the reverse: that `POI`'s `districtId` points back). This catches a **broken reference** automatically — a typo'd id, a deleted file nothing else was updated for.

**It does not catch attribute-level drift** — a title or description going stale after a related field changes (category C's actual failure mode, e.g. Mara Venn's title). That still needs the manual consistency sweep (§2 stage 8). Referential integrity and attribute consistency are different problems; only the first is automatable with the current content model.

Scoped deliberately to the three relationships above. Other reference-shaped fields (`controllingFactionId`, `factionInfluence` keys, `District.settlementId`, `Endeavor.unlocksNodesOnComplete`) are equally checkable in principle but out of scope for this pass — noted so the gap is explicit, not silently assumed covered.

---

## 6. Note for later: AI-authored content specs

Flagging where this workflow currently assumes a human wrote the outline, since content specs may eventually be AI-proposed (per your stated intent to eventually have adventures proposed as a surprise, not just authored by you):

- **Review (§2 stage 5)** currently assumes proposer and reviewer share a trust boundary. An AI-drafted outline needs a distinct review role before it's trusted enough to implement — not designed here.
- **§2 stage 3's sequencing rule** assumes a human decides when a capability gap exists and how it's resolved. Whether an AI outline-generator may identify and request new engine capability, or must always stay within existing capability and flag gaps for a human to triage, is open.
- The **tone-check** and **balance-flag** sections are validation steps, not authorship-dependent — they're written to work unchanged regardless of who drafted the outline.

---

## 7. Declined, with reasoning (don't re-litigate without new evidence)

**A `PostToolUse` hook running `tsc`+`lint` after every edit — declined.** Checked every category-A-through-G finding above against it: `tsc`/`lint` were clean throughout every real incident in this project's history; every one was semantic/integration/process, not a type or lint error. It would have had zero counterfactual effect on any of them. Not harmful, but solves the wrong layer — not recommended as a response to these findings.

**Directory-scoped `CLAUDE.md` files (`src/content/`, `src/engine/`) — not yet.** Plausible but weak help for B/C (ambient reminders only work if reread at the right moment; the spec template forces the same questions structurally instead, which is stronger). Revisit once `src/content/` has enough actors/districts/factions that tone/lore reminders would plausibly get missed by someone not re-reading `narrative-inspirations.md` in full each time — a concrete trigger, not "eventually."
