# Feature Specs Index

One file per feature/content spec, per `docs/feature-workflow.md`. Filenames prefixed by type: `feature_<slug>.md` (engine/feature capability) or `content_<slug>.md` (content/adventure). Revisit this flat structure once the directory exceeds roughly 20 files (`docs/feature-workflow.md` §3).

| File | Type | Status | Summary |
|---|---|---|---|
| [feature_dice_minigame.md](feature_dice_minigame.md) | Feature | Implemented | 2d6 even/odd dice minigame, currency borrow-down, Mara Venn reputation loop. Backfilled. |
| [feature_audio_system.md](feature_audio_system.md) | Feature | Implemented | Fail-silent `playSound` utility; dice win/lose SFX; content-driven `entrySoundAsset`. Backfilled. |

## Other notable process/tooling findings

Not a feature or content spec, but significant enough to need its own entry point rather than being buried in `docs/decisions.md`'s linear log:

- **`npx tsc --noEmit` (bare) was silently checking zero files project-wide, the whole project's history until this was caught.** The root `tsconfig.json` has only `"references"`, no `"files"`/`"include"` — bare `tsc` doesn't follow project references without `-b`. Every "clean type-check" claimed across every phase so far, including CI's "Type check" step, was vacuous; lint didn't catch it either (no type-aware linting configured). Surfaced by accident when `npm run build` (which correctly uses `tsc -b`) failed on a real, previously-invisible error. Fixed to `npx tsc -b --noEmit` everywhere it's used (`ci.yml`, `CONTRIBUTING.md`, the `verify-phase` skill); confirmed clean via a full forced rebuild (`tsc -b --force`), not just the one error path that happened to surface. See `docs/decisions.md` (search "silently checking zero files") and `CHANGELOG.md`'s `[Unreleased]` → Fixed section.
