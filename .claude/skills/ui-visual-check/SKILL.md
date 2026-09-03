---
name: ui-visual-check
description: Launch the Vite dev server and drive the app in headless Chromium via Playwright to visually verify UI, for deliberate milestones only — not routine per-phase verification (see verify-phase for that).
---

# ui-visual-check

A real-browser pass for Broadsheet & Rapier's UI: launches the Vite
dev server, drives headless Chromium through the app's
viewport-swap navigation, and screenshots the result. Reserve this
for deliberate UI milestones (a new viewport, a new interaction flow,
a visual regression you actually suspect) — not for routine per-phase
verification, which is `npm run test`'s job (component tests under
`src/__tests__/components/`, see `verify-phase`).

`chromium-cli` is not available in this environment. This project
uses the Playwright CLI directly instead — no local `playwright`
dependency needed for the basic `screenshot` command; a throwaway
local install is needed only for scripted interactions (clicks).

## One-time setup (skip if already done this session)

Playwright's browser binary is cached globally
(`~/AppData/Local/ms-playwright` on Windows) once installed — check
before reinstalling:

```bash
npx --yes playwright install chromium
```

This downloads ~115MB the first time; subsequent runs are instant.

## Dev server

```bash
cd <repo root>
(npm run dev > /tmp/vite_dev.log 2>&1 &)
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

Stop it when done: `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill` on
Unix. **`lsof` is not installed on this project's Windows/Git-Bash
environment** — it silently no-ops there instead of failing loudly, so
the dev server keeps running unnoticed. Use PowerShell instead:
`Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`
(via the PowerShell tool, not Bash — `$_`/`ForEach-Object` don't survive
Bash's quoting).

## Simple screenshot (no interaction)

The Playwright CLI's `screenshot` subcommand works via `npx` with no
local install:

```bash
npx --yes playwright screenshot --wait-for-timeout 1500 --full-page \
  http://localhost:5173 <scratchpad>/screenshot.png
```

## Scripted interaction (clicks, navigation)

The CLI's `screenshot` command is one-shot — for a click-through
sequence (e.g. nav view → enter a POI → talk to an actor → open the
journal drawer), write a small Playwright script and run it with a
throwaway local install in the scratchpad directory (not the
project's `node_modules` — this is a dev tool, not a project
dependency):

```bash
cd <scratchpad dir>
npm init -y >/dev/null 2>&1
npm install playwright --no-save   # reuses the already-cached browser binary
```

Then a script like:

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://localhost:5173');
  await page.waitForSelector('text=The Crooked Hour');
  await page.click('text=The Crooked Hour');       // WorldNavigationView -> NodeInteractionCanvas
  await page.screenshot({ path: process.argv[2], fullPage: true });

  await page.click('text=Journal');                // opens ManagementDrawer
  await page.waitForTimeout(400);
  await page.screenshot({ path: process.argv[3], fullPage: true });

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  await browser.close();
})();
```

Run it with `node <scratchpad>/script.js <out1.png> <out2.png>`.

**A navigation can land on an already-open overlay — screenshot before
scripting the next click, don't assume the landing screen is bare.**
This project's content frequently auto-triggers a dialogue on POI entry
(`Triggerable`/`onPoiEnter`, see `feature_triggerable_effects.md`) — a
click sequence written against a bare `NodeInteractionCanvas` can hang
for the full Playwright timeout with `<div class="fixed inset-0
z-50 ...">... intercepts pointer events` in the error, because a
`DialogueOverlay`/`MinigameOverlay` is already covering the target
element. Screenshot immediately after each navigation step first; only
add the next click once you can see what's actually on screen.

**Always check `CONSOLE_ERRORS` before declaring success.** A 404 for
a missing content asset is expected (it proves `AssetFallback`'s
placeholder path) — anything else (a thrown exception, a React error
boundary trip) is a real failure the screenshot alone won't show you.

## What to look at

- The current viewport (`WorldNavigationView` or
  `NodeInteractionCanvas`) matches `currentLocation.poiId` state as
  expected.
- `AssetFallback` shows its purple "MISSING: ..." placeholder for any
  asset path that has no real file yet — this is correct, not a bug,
  until real assets are added.
- `WorldClockHud` values update after an action that should cost a
  shift, and don't after one that shouldn't (per
  `game-design-spec.md` §4's movement-cost rules).

## Cleanup

Kill the dev server (see the platform-specific commands under "Dev
server" above). The scratchpad's throwaway `node_modules`/
`package.json` can be left or removed — it's outside the repo and
never committed.
