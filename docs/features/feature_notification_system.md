# Feature: Notification System

## Goal

A short-lived on-screen message ("toast") tells the player, at a glance, whenever something material just happened to their save: currency changed, an item was gained or lost, reputation with an Actor or Faction changed, or an Endeavor was completed. It floats above whatever else is on screen (including open dialogue/minigame overlays), auto-dismisses after a few seconds, and can be dismissed early with a click. Today none of these changes have any feedback beyond the numbers themselves updating somewhere in the UI the player may not be looking at (`WorldClockHud`'s currency readout, the Journal's Inventory/Roster tabs) — a real comprehension gap, not a cosmetic one.

## Classification

Feature/Engine. No existing content or Open Design Gap covers this — confirmed by reading `game-design-spec.md` in full: none of its 14 Open Design Gaps mention player feedback/notifications, so this is new capability, not a gap being resolved.

## Existing-capability check

Nothing existing covers this. Adjacent, reusable pieces:
- **`PlayerState`'s before/after diffing is already implicitly available** at the one place every state change flows through: `dispatchCommand` in `src/engine/store/playerStore.ts`, which already has both the pre-command `store` and the post-command `nextPlayerState` in scope (`playerStore.ts:92-97`).
- **`eventLog`** (`src/engine/store/events.ts`) looks superficially reusable but isn't: it's a raw, verbatim mirror of only the *top-level* dispatched command (`{type, payload, timestamp}`), with no derived delta. Critically — confirmed by reading `COMMAND_SELECT_DIALOGUE_CHOICE`'s and `COMMAND_RESOLVE_MINIGAME`'s handlers in `commands.ts` — **nested commands never go through `dispatchCommand` at all**. A dialogue choice's `commands: StateCommand[]` (or a minigame's `onSuccessCommands`/`onFailureCommands`) are applied via direct recursive calls to `applyCommand` *inside* those handlers, not via the store's `dispatchCommand` wrapper. Since almost every real currency/item/reputation change in this game happens exactly that way (a dialogue choice's consequence, a minigame's outcome), a design that keyed off `eventLog` entries or off the *outer* dispatched command's `type`/`payload` would silently miss the vast majority of real cases. This is the single most important finding from scoping this feature — see Design below.
- **`ManagementDrawer`** is the only existing precedent for a Framer Motion mount/unmount pattern (`AnimatePresence` + `initial`/`animate`/`exit`) — reused directly for each toast's enter/exit animation, not reinvented.
- **Reuse-of-meaning check:** nothing existing is being repurposed. `eventLog` keeps its exact current meaning and is untouched by this feature; the new `notifications` array is new store-only state, not a rename or reuse of `eventLog`.

## Design

**Currency/item/reputation notifications are derived generically by diffing `PlayerState` before vs. after every `dispatchCommand` call**, not by switching on the dispatched command's `type`. This is *because* of the nested-command finding above: only the final, fully-resolved `nextPlayerState` reflects the cumulative effect of however many nested commands actually ran, regardless of dispatch depth. A per-command-type approach would need to be threaded through every place `applyCommand` is called recursively (`commands.ts`'s dialogue-choice and minigame-resolve handlers) to work correctly — diffing the final state sidesteps that entirely, for free, with no changes to `commands.ts`.

```ts
// src/engine/store/notifications.ts (new — mirrors events.ts's placement)
export type NotificationTone = "gain" | "loss" | "info";

export type NotificationEvent =
  | { id: string; timestamp: number; tone: "gain" | "loss"; kind: "CURRENCY"; deltaBronze: number }
  | { id: string; timestamp: number; tone: "gain" | "loss"; kind: "ITEM"; itemId: string; quantity: number }
  | {
      id: string;
      timestamp: number;
      tone: "gain" | "loss";
      kind: "REPUTATION";
      targetType: "actor" | "faction";
      targetId: string;
      amount: number;
    }
  | { id: string; timestamp: number; tone: "info"; kind: "ENDEAVOR_COMPLETE"; endeavorId: string };

// Pure diff: compares two PlayerState slices, returns zero or more raw
// notification events (no id/timestamp yet — assigned by the caller so this
// stays a pure, easily-testable function).
export function diffForNotifications(
  before: PlayerState,
  after: PlayerState
): Array<Omit<NotificationEvent, "id" | "timestamp">> { ... }
```

- **Currency**: compare `currenciesToBronzeEquivalent(before.currencies)` vs. `...(after.currencies)` (reusing the existing exported helper from `commands.ts` — no new conversion logic). Non-zero difference → one `CURRENCY` event carrying the signed bronze delta. Display formatting (converting an arbitrary bronze delta into a "+1 Silver, 4 Bronze"-style string) happens at render time in `App.tsx`, not in the store — same content/display separation as everywhere else.
- **Item**: build a `Map<itemId, quantity>` for `before.inventory` and `after.inventory`, diff every `itemId` appearing in either. Non-zero delta → one `ITEM` event per changed `itemId`.
- **Reputation**: same map-diff shape over `before.reputation.actors`/`.factions` and `after.reputation.actors`/`.factions` (per the user's explicit request to include this now, using the identical mechanism — no separate design needed).
- **Endeavor completion is different and cannot be derived this way** — "terminal phase" is a *content* fact (`EndeavorPhase.nextPhaseOnSuccess` being absent, per `web-implementation.md`'s already-stated "a terminal phase needs no separate complete tracking — reaching it is the representation"), and `src/engine/` (where `dispatchCommand` lives) may never read `src/content/`. Detected instead in `App.tsx` (which already loads `endeavorsById` and already has a `useEffect` reacting to `activeEndeavors` changes for the phase-change dialogue trigger — `feature_dialogue_visibility_and_auto_triggers.md`'s addendum) via a **new, separate** effect:

```ts
// App.tsx — new effect, sibling to the existing phase-change dialogue effect
const prevActiveEndeavorsRef = useRef(activeEndeavors);
useEffect(() => {
  for (const [endeavorId, progress] of Object.entries(activeEndeavors)) {
    const previousPhaseId = prevActiveEndeavorsRef.current[endeavorId]?.currentPhaseId;
    if (previousPhaseId === progress.currentPhaseId) continue; // no transition for this endeavor this render
    const phase = endeavorsById[endeavorId]?.phases[progress.currentPhaseId];
    if (phase && phase.nextPhaseOnSuccess === undefined) {
      pushNotification({ tone: "info", kind: "ENDEAVOR_COMPLETE", endeavorId });
    }
  }
  prevActiveEndeavorsRef.current = activeEndeavors;
}, [activeEndeavors]);
```

**Why the `useRef` seeded with the initial value (not `{}`/`undefined`) matters — a real correctness bug found during design, not a hypothetical:** a naive version of this effect (comparing against nothing on the first run, or comparing against a ref that starts empty) would fire a false "Endeavor Completed!" toast on *every page load* for any save that already has a completed Endeavor from a previous session — since `useEffect` always runs once after the first render regardless of its dependency array's contents. Seeding `useRef(activeEndeavors)` captures whatever the *already-loaded* value is at mount, so the first comparison is always against itself (no transition detected) and only a genuine in-session phase change fires a notification. This exact shape of bug is why the reactive/diffing approach needs this specific guard called out explicitly, not left as an implementation detail to rediscover.

**Store additions** (`playerStore.ts`), store-only like `eventLog` — **not** part of `PlayerState`/`PlayerStateSchema`, **not persisted**. A toast is inherently ephemeral (a page reload mid-toast should show nothing, not resurrect a stale notification), so it doesn't belong in save data any more than `eventLog` does:

```ts
interface PlayerStore extends PlayerState {
  eventLog: StateChangeEvent[];
  notifications: NotificationEvent[];
  dispatchCommand: (command: StateCommand) => void;
  dismissNotification: (id: string) => void;
  // For content-aware call sites outside commands.ts (the Endeavor-completion
  // effect above) that need to add a notification without going through a
  // PlayerState-changing command.
  pushNotification: (event: Omit<NotificationEvent, "id" | "timestamp">) => void;
  ...
}
```

`dispatchCommand` extended to diff and append:
```ts
dispatchCommand: (command) => {
  set((store) => {
    const before = extractPlayerState(store);
    const nextPlayerState = applyCommand(before, command);
    const newEvents = diffForNotifications(before, nextPlayerState).map(toNotificationEvent); // assigns id/timestamp
    return {
      ...nextPlayerState,
      eventLog: [...store.eventLog, createEvent(command)],
      notifications: [...store.notifications, ...newEvents],
    };
  });
},
```

**No new `CommandType`, no `StateCommandSchema` change, no content-schema change.** Notifications are never something content authors dispatch directly — they're a derived side effect of state changes that already happen for other reasons. This keeps the content-facing command vocabulary exactly as-is; nothing in `src/content/` needs to change or gains a new capability to author against.

**Rendering** — new `src/engine/components/NotificationTray.tsx` + a `Toast` subcomponent, mounted unconditionally in `App.tsx` (same "always mounted, self/prop-gated" pattern as `MinigameOverlay`/`DialogueOverlay`, not conditionally rendered by `App.tsx`'s JSX). Per the content/props boundary (`web-implementation.md` §3), `NotificationTray` never reads `src/content/` — `App.tsx` resolves each raw `NotificationEvent` into a locally-owned display shape:

```ts
// NotificationTray.tsx — locally-owned minimal prop shape, same pattern as
// DialogueOverlayNode/NodeInteractionActor
export interface NotificationDisplayItem {
  id: string;
  tone: "gain" | "loss" | "info";
  message: string;
}
export interface NotificationTrayProps {
  notifications: NotificationDisplayItem[];
  onDismiss: (id: string) => void;
}
```
`App.tsx` builds `message` per notification kind (item/endeavor messages need `itemsById`/`endeavorTitles`, both already loaded there; currency messages need no content lookup, formatted directly from `deltaBronze`).

**Position, z-index, stacking, timing** (resolved via user discussion during planning):
- **Top-right, deliberately floating above everything else** — including the `z-50` `DialogueOverlay`/`MinigameOverlay`/`ManagementDrawer` tier, since the player explicitly wants it to read as "this is happening right now, on top of whatever you're doing," not as permanent, position-locked chrome that has to dodge the Journal button. `z-[100]`.
- Stack vertically, newest appended at the bottom, `AnimatePresence` + per-toast `motion.div` (`initial`/`animate`/`exit`) exactly mirroring `ManagementDrawer`'s existing pattern.
- Each toast auto-dismisses after **4.5s** (a named constant, trivially tunable) via a `useEffect`-owned `setTimeout` scoped to that toast's own lifetime (`key={id}` on a per-toast subcomponent so the timer is correctly cleared/reset only when that specific toast unmounts) — plus an always-visible "×" close button dispatching the same `onDismiss(id)` immediately, per the explicit request ("or if the user clicks in closing it").
- Reputation/currency/item notifications naturally self-limit — nothing artificially caps how many can stack at once, since each clears itself within a few seconds.

## Integration points

- `playerStore.ts`'s `dispatchCommand` — the single convergence point for every currency/item/reputation change regardless of dispatch depth (see Design's nested-command finding — this is *why* it's the correct integration point, not merely a convenient one).
- `App.tsx`'s existing `useEffect` block reacting to `activeEndeavors` — a new, separate effect alongside the existing phase-change dialogue-trigger effect, for the reason content-awareness forces this out of the store layer.
- `App.tsx`'s render — `<NotificationTray>` added unconditionally, sibling to `<MinigameOverlay />`/`<DialogueOverlay ... />`.

## Reachability

Immediately reachable from a fresh save with zero new content: currency notifications fire the first time the player Gambles (win or lose) or pays off the Missing Broadsheet's buyer; item notifications fire the first time a duel is won (`item_vantry_rapier`); reputation notifications fire the first time Mara Venn's dialogue grants +5; Endeavor-completion fires the first time either existing Endeavor reaches its terminal phase. No content changes needed for any of this — a genuine systemic win of deriving from state diffs rather than requiring per-choice authoring.

## Consistency check

No existing content or docs assert anything this changes. `game-design-spec.md` gets a new short section documenting the domain-level concept (engine-agnostic: "the player is shown a transient acknowledgement when currency/items/reputation change or an Endeavor completes"); `web-implementation.md` gets the concrete store/component shape, following the same split as every other feature in that pair of docs.

## Environment notes

None — no build/runtime-config-derived values, no timezone/URL construction.

## Test plan

- `notifications.test.ts` (new): `diffForNotifications` — no-op when nothing relevant changed; currency gain/loss; single and multiple simultaneous item deltas; reputation gain/loss for both `actor`/`faction` target types; a combined multi-domain diff (currency + item + reputation all in one before/after pair) — the exact real shape a duel win/loss produces.
- `playerStore.test.ts` (extend): `dispatchCommand` with a **nested-command** dispatch (e.g. `COMMAND_SELECT_DIALOGUE_CHOICE` whose `commands` include `COMMAND_ADJUST_CURRENCY` + `COMMAND_ADD_ITEM`) produces the correct `notifications` entries — this is the specific case the eventLog/per-command-type approach would have silently failed, so it needs its own explicit test, not just incidental coverage. Also: `dismissNotification` removes by id; `resetProgress`/`importSave` clear `notifications` (mirroring `eventLog`'s existing reset behavior).
- `persistence.test.ts` (extend): assert `notifications` is **not** in the persisted key set, alongside the existing `eventLog` assertion — same explicit-inclusion discipline `web-implementation.md` §6 already documents for every `PlayerState` field.
- `NotificationTray.test.tsx` (new, jsdom): renders a list of display items with correct tone-based styling hook (e.g. a class or data attribute distinguishing gain/loss/info — not just color, so this is assertable); clicking "×" calls `onDismiss(id)`; auto-dismiss fires `onDismiss(id)` after the configured duration using `vi.useFakeTimers()`/`advanceTimersByTime` (same pattern as `DuelGame.test.tsx`'s `advance()` helper); a second toast's timer is independent of the first's (added later, still has its own full duration remaining).
- Endeavor-completion effect: no dedicated unit test (App.tsx has no test file, consistent with every other App.tsx-level effect in this project) — covered by the mandatory live `ui-visual-check` pass instead, specifically checking the reload-false-positive case (reload with an already-completed Endeavor in the save → confirm no toast fires).

## Content-schema scaling note

No schema changes. `content-integrity.test.ts`'s existing glob/referential-integrity checks are unaffected — this feature reads existing already-loaded content (`endeavorsById`, `itemsById`) for display-text resolution only, no new content type or field.

## Open questions / explicitly deferred scope

- Clue unlocks (`COMMAND_UNLOCK_CLUE`) and world-clock advancement are not included — not requested, and clue-gain framing ("you learned something") would need its own display-text design (clues have no `name`/title field today, only an id) rather than fitting the existing gain/loss/info tone model cleanly. Flagged, not built.
- No cap on simultaneous toasts — revisit only if real play shows a burst (e.g. many rapid reputation ticks) producing visual clutter worse than the self-limiting few-seconds lifetime already handles.

## Status

**Implemented.**
- CHANGELOG: `[Unreleased]` — "Notification system (`game-design-spec.md` §12)...".
- decisions.md: 2026-08-13 (third follow-up) — the nested-command diffing finding, the `useRef` reload-false-positive guard, the store-only/non-persisted call, and the position/z-index/reputation-scope decisions confirmed directly with the user.
- `game-design-spec.md` §12 added; `web-implementation.md` §10 added; directory structure listing updated.
- Verified live via `ui-visual-check`: currency/item/reputation toasts fire correctly for nested dialogue-choice and duel-outcome commands; Endeavor completion fires exactly once on the real transition; a page reload with an already-completed Endeavor produces **no** false-positive toast (the specific bug the `useRef` seeding guards against).
