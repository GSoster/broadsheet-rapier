# Skills Index

One directory per Claude Code skill, each with its own `SKILL.md` (and
optional supporting files, like `simple-english/references/` and
`simple-english/LICENSE`). This index exists for the same reason
`docs/features/README.md` does — a flat directory of many small files needs
its own discoverable entry point, since `name`+`description` frontmatter
alone isn't enough to compare skills at a glance.

The **Trigger description** column is quoted verbatim from each skill's own
`SKILL.md` frontmatter `description` field, not paraphrased — so this index
can't silently drift out of sync with what a skill actually says. If a
skill's description changes, update the quote here in the same change.

| Skill | Purpose | Mode | Trigger description (verbatim, from SKILL.md frontmatter) |
|---|---|---|---|
| [verify-phase](verify-phase/SKILL.md) | Per-phase Definition of Done checklist | Mandatory — every phase/follow-up | Run this repo's per-phase Definition of Done checklist (tsc, lint, tests, build, scope check, judgment-call report, commit message) before declaring any execution-plan.md phase or follow-up done. |
| [ui-visual-check](ui-visual-check/SKILL.md) | Real-browser UI verification via Playwright | Explicit — deliberate UI milestones only | Launch the Vite dev server and drive the app in headless Chromium via Playwright to visually verify UI, for deliberate milestones only — not routine per-phase verification (see verify-phase for that). |
| [endeavor-content](endeavor-content/SKILL.md) | Author a new Endeavor's dialogue-driven content | Explicit — when authoring new Endeavor content | Author a new dialogue-driven Endeavor's content (phases, dialogues, Actors, POIs) for Broadsheet & Rapier, using only patterns confirmed real across the two Endeavors built so far. |
| [design-review](design-review/SKILL.md) | Six-point review checklist run against Claude Code's own plan | Mandatory — every plan, except small/well-precedented content work | Run docs/review-standards.md's six-point checklist against Claude Code's OWN plan before presenting it for approval — mandatory for any plan that isn't small, well-precedented content work, not a suggestion to consider. |
| [simple-english](simple-english/SKILL.md) | ASD-STE100 Simplified Technical English for this repo's own docs/process artifacts | Explicit — only the six named doc/process surfaces, or when STE is named directly | Write or rewrite ASD-STE100 Simplified Technical English for this repo's own documentation and process artifacts: everything under docs/, CONTRIBUTING.md, CHANGELOG.md, docs/decisions.md, commit messages, and PR descriptions. Use when asked to write or check these, or when the user says "STE", "Simplified Technical English", "ASD-STE100", or "de-slop". Never for src/content/ (narrative dialogue/content JSON), narrative prose discussion, code, or code comments — out of scope by design, see Project Scope below. |
| [work-next-issue](work-next-issue/SKILL.md) | Autonomously pick and fully drive the next backlog issue through feature-workflow.md | Explicit — invoked to run the standing autonomous-pickup loop | Pick the next issue off the "Broadsheet & Rapier Backlog" GitHub Project and drive it through docs/feature-workflow.md's full stage sequence end to end, autonomously — selection, spec draft, design-review, implementation, verify-phase's Definition of Done, reachability, docs sync, commit/push, and issue close. Use when asked to "work the next issue," "pick up the backlog," or run this project's standing autonomous-pickup loop. |

**Revisit trigger:** once this directory exceeds roughly 15 skills, revisit
whether a flat table is still the right format — same discipline
`docs/features/README.md` applies to its own ~20-file trigger: a flat list
scanned by eye stops scaling before that.
