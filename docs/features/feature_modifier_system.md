# Modifier System — Design Spec

**Issue:** #3

**Status:** Implemented (stages 1–3 of §2.9; stage 4/equipping deferred per
§3.1). Directly touches gaps **#11** (duel equipment scaling) and **#12**
(equipped state / `stackable`), interacts with **#9** (repeatable
activities — the dice loop, see §2.8) and **#7** (no cooldown on repeated
conversations — see the note below), and gives gap **#2** (reputation
tiers) a place to land later
without inventing it now.

> **On gap #7 and reputation modifiers.** A `+25% REPUTATION_GAIN` letter
> combined with uncapped repeat conversations does farm reputation 25% faster.
> Unlike the currency case (§2.8), this is **self-limiting**: reputation is
> bounded at +100 (`game-design-spec.md` §8), so the modifier changes how fast
> a ceiling is reached, not whether it can be exceeded. No carve-out needed —
> noted so the asymmetry with currency is deliberate rather than overlooked.

**Revision 5 — ready to land as `docs/features/feature_modifier_system.md`.**
Corrections from a direct read of the codebase, plus the last open decision:

- **§2.8 pseudocode corrected.** `COMMAND_ADJUST_CURRENCY`'s real payload is
  `{ denomination, amount }`; there is no `deltaBronze` on it. (That field is
  real but belongs to `NotificationEvent`'s `CURRENCY` variant — derived and
  read-only.) The modifier now applies to a **bronze-equivalent magnitude**,
  which turns out to be required for correctness, not tidiness. No payload
  rename; no breaking change to existing content — confirmed in §2.8.
- **§2.7 clamp widened, fixing a real bug.** The correction above exposed a
  second inversion path: `ΣFLAT` exceeding the base produces a negative
  subtotal, which — because §2.8 reapplies the sign after the fact — would
  flip a currency *loss* into a *gain*. `applyModifiers` now clamps its
  result, not just its percentage multiplier.
- **§2.4 targeting semantics decided**, no longer either/or: an untargeted
  query returns only untargeted modifiers. Reasoning and truth table in §2.4.
- **§2.8 gained a named limitation** — modifiers resolve as of the start of a
  dispatch — with the traced mechanism and a concrete revisit trigger.
- **Recursion sites confirmed exhaustive by grep** (two, both already named),
  now recorded as evidence rather than assumption.
- **`src/__tests__/modifiers.test.ts` written in full**, shipping alongside
  this spec.

**Revision 4.** The gambling carve-out (§2.8) is **confirmed**, with the
expected-value derivation that justifies it and an explanation of why a
cooldown is orthogonal rather than substitutable. Reputation's parallel case
is noted as self-limiting (§0). Gap citations for the dice loop corrected from
#7 to #9. A third item added to §3.7: whether launching a minigame already
costs a Shift, which may be an unimplemented existing rule.

**Revision 3.** Changes from revision 2:

- **All §3 decisions resolved.** Equipping (stage 3) is **deferred** with a
  concrete revisit trigger; rounding is `Math.round`; one `CURRENCY_GAIN` key;
  no opponent modifiers. See §3.
- **§2.10 expanded** from a file list into testing principles, with the
  inertness rule as the load-bearing guarantee.
- **§2.11 added** — a step-by-step procedure for adding a new modifier key,
  written to be handed to Claude Code directly.
- One `CURRENCY_GAIN` key covers every currency gain from any source. The sign
  rule in §2.8 already did this; §3.3 no longer poses it as a choice.

*Revision 2 changes, retained: modifiers applied inside the command handler
rather than by rewriting payloads (§2.8); modifier key derived from command
type + sign of the delta (§2.8); ops `FLAT | PERCENT`, both accepting negative
values (§2.4); Stellaris duration/decay rejected (§2.3).*

This document covers two sequenced questions:

- **Part 1** — an evaluation of Entity Component System (ECS) as an
  architectural direction. Conclusion: don't adopt it, borrow two specific
  ideas, and note that the paradigm this project actually converged on has a
  third primitive it hasn't built yet.
- **Part 2** — the modifier system, designed as that third primitive.

---

## 0. Correction to the premise

The framing this design started from said *"no Item content schema exists at
all."* That isn't accurate against the current docs, and it materially
simplifies the recommendation:

- `web-implementation.md` §5 already specifies **Item**: base node fields,
  `imageAsset: string` (required, unlike every other node type),
  `stackable: boolean`.
- `web-implementation.md` §7 lists `src/content/schemas/item.schema.ts` and a
  `src/content/items/` folder.
- `item_rapier` is the one authored instance.

So there is a content-side Item type with a schema and a folder. What's
missing is (a) any modifier field on it, (b) any *runtime* concept of
equipping, and (c) any enforcement of `stackable` (gap #12). **Adding
modifiers is a new composable schema fragment on an existing content type, not
a new content type.** That's a meaningfully smaller change than the premise
implied, and it's consistent with how `TriggerableSchema` was added to
District/POI rather than inventing a new node kind.

---

# PART 1 — Entity Component System

## 1.1 Verdict

**Confirmed. Don't adopt ECS. Borrow two ideas, both of which the codebase is
already doing informally — plus a third, the one the reviewer named
independently (§1.5c), which turns out to be the whole of Part 2.**

## 1.2 The two things are answers to different questions

ECS and the Clausewitz trigger/effect split get compared a lot because both
are described as "composition over inheritance," but they solve different
problems:

| | ECS | Clausewitz-style |
|---|---|---|
| **Problem it solves** | runtime storage layout + behaviour dispatch over many entities | letting non-programmers author conditional game logic as data |
| **Unit of composition** | a component struct attached to an entity id at runtime | a declarative block in a content file |
| **Who writes it** | engine programmers | content authors |
| **When composition changes** | every frame, at runtime | at authoring time |
| **Validation** | none (attach whatever, whenever) | schema-validated at load |

This project's convergence on trigger/effect is real, but ECS is not the next
station on that line. The next station on that line is **more Clausewitz**.

## 1.3 The sharper frame: you have two of three primitives

Clausewitz script has three primitives, not two:

1. **Triggers** — pure boolean tests against state, no side effects.
   → You have this: `DialogueRequirement` + `evaluateDialogueRequirement`.
2. **Effects** — imperative one-shots that change state.
   → You have this: `StateCommand` + `applyCommand`, and the
   `EntryEffect`/`TriggerableSchema` layer that fires them on a condition.
3. **Modifiers** — declarative, continuous adjustments to a named value,
   contributed by many sources, aggregated at the moment a calculation runs.
   → **You do not have this.** `THRUST_DAMAGE` is a constant;
   `COMMAND_ADJUST_CURRENCY` is flat; there is no per-combatant stat layer.

Every motivating example in Part 2 — a better rapier, a +5% pendant, a
reputation letter — is a modifier. None of them is a trigger or an effect.
This is why they feel awkward to express with the machinery that exists: the
machinery is genuinely missing a primitive, and that primitive has a
well-understood shape.

That reframing does more work than the ECS comparison does, and it's the
reason Part 2 recommends what it recommends.

## 1.4 Why full ECS adoption would be a net loss here, concretely

Not a generic "you're too small" argument — specific costs against this
codebase:

**The performance benefit is exactly zero.** ECS's cache-coherent iteration
pays off when you iterate thousands of like entities per frame. This game has
a handful of districts, POIs and actors, no simulation tick, and renders
through React. There is no hot loop to optimise.

**ECS's storage model is mutable-arena; yours is immutable-value.** ECS worlds
are designed to be mutated in place by systems. `PlayerState` is a persisted,
Zod-validated, exportable *value* that command handlers replace wholesale.
These aren't stylistic preferences on either side — they're the load-bearing
assumptions of each design.

**Four existing mechanisms would degrade if `PlayerState` became an
entity/component store:**

- `persistence.test.ts`'s deliberately hand-maintained key list — the
  mechanism that forces a conscious "should this persist?" decision per field
  — has nothing to enumerate once state is `Record<entityId, Record<componentType, unknown>>`.
- `PlayerStateSchema`'s structural import validation weakens to "a bag of
  unknown components," which is roughly no validation.
- `diffForNotifications` currently knows it's comparing `currencies`,
  `inventory`, `reputation`. Against a generic component store it becomes a
  generic differ that can't tell a meaningful change from a bookkeeping one.
- The engine ↔ content boundary (`engine.md` §5) gets pressure applied to it,
  because ECS's natural instinct is to load content *into* the world as
  components — which is exactly the direction the boundary forbids.

**A library (bitecs, miniplex) would be a second state model.** It would sit
beside Zustand + `PlayerState` and immediately create the "two competing
mental models" risk flagged for Part 2 — but at the level of *where state
lives*, which is worse than having it at the level of *how bonuses are
calculated*.

## 1.5 What to borrow

**(a) Composable capability fragments — already happening, worth naming.**
`TriggerableSchema` and `PoiEntryTriggerSchema` are ECS's
composition-over-inheritance idea applied at the *schema* level, where it
costs nothing and buys load-time validation. Make it an explicit convention:
`src/content/schemas/shared.ts` is a library of capability fragments that
content types opt into by composition, and a new cross-cutting capability
becomes a fragment there rather than a field on one node type. Part 2's
`ModifierSourceSchema` is the next one.

The important part: this is **compile-time and load-time** composition, via
Zod + TypeScript unions. That gives you ECS's flexibility benefit with
authoring-time error messages a runtime component registry can't produce.
You already have the good half.

**(b) Entity-as-id with sparse side tables — also already happening.**
`unlockedNodes: Record<string, boolean>`, `reputation.actors: Record<string, number>`,
`activeEndeavors: Record<string, {...}>`, `dialogueProgress: Record<string, {...}>`
are all sparse per-entity component stores keyed by content id. Naming that
pattern gives a default answer for new dynamic per-entity state: it goes in
`PlayerState` as `Record<entityId, T>`, keyed by id, not as a field on a
content type. Part 2 uses this directly for `equipped`.

**(c) Query-time aggregation across sources — the one that matters most.**
The reviewer named this as the actually-appealing part of ECS: *a system that
computes a current value by reading data contributed from several independent
sources*, rather than each source having pre-written its contribution into
stored state. That's correct, it's what Part 2 is, and it's the single idea
worth taking.

The discipline that makes it safe is one rule: **the aggregated value is never
stored — only computed, at the moment it's needed.** Nothing to invalidate,
nothing to reverse, nothing new in the save file. See §2.1 for why the
alternative is a bug factory.

Note the corollary for wording: an "active" or "enabled" modifier is
**derived** from what's owned/equipped, never a persisted flag. The moment
"enabled" becomes stored state, the un-apply problem comes back.

**Do not borrow:** systems/world/archetype registries, runtime component
add/remove, or any ECS library.

## 1.6 The one place ECS-shaped thinking almost wins — and still loses

The closest thing to a genuine ECS-shaped problem in the codebase is
**gap #14**: an Actor reused across several Endeavors, needing different
dialogue depending on which is currently relevant. "One entity, behaviour that
varies by attached context" is ECS's home turf.

But the better answer there is still the Clausewitz one: replace
`Actor.dialogueId: string` with a priority-ordered
`dialogues: Array<{ requires?: DialogueRequirement; dialogueId: string }>`,
resolved by the first passing requirement — reusing
`evaluateDialogueRequirement` unchanged, staying content-authored and
schema-validated. That's less machinery, more validation, and no second state
model.

Noted as evidence for the verdict, **not** a recommendation to build it.
Gap #14 needs its own spec like everything else in that list.

---

# PART 2 — Modifier System

## 2.1 Framing: a modifier is not an effect

The original brief suggested modelling an item's bonus as *an effect gated by
an on-equipped/on-owned trigger*. That specific shape doesn't work, though the
instinct behind it — compose with what exists, don't build a parallel
mechanism — is right.

An effect is an imperative one-shot: *do this now*. Expressing a rapier's
bonus as an effect means dispatching something like
`COMMAND_ADJUST_DAMAGE_BONUS` on equip, which requires:

- a persistent accumulated-stat field in `PlayerState`,
- a correct inverse dispatched on unequip, on item loss, on save import,
- and correctness under nested `applyCommand` recursion.

That's the classic buff-applied-twice / buff-never-removed bug factory, and
it puts derived values into the save file where they'll drift from content the
first time you rebalance an item.

Clausewitz doesn't do this either. Its `triggered_modifier` is **a modifier
with a condition**, not an effect with a condition. The modifier is never
"applied" to stored state — it's *aggregated at query time* from whatever
sources currently qualify.

So: modifiers compose with the **trigger** idea (a condition decides whether a
modifier is live) but not with the **effect pipeline**. They're the third
primitive, sibling to the other two, sharing the condition vocabulary. This is
the same conclusion §1.5c reaches from the ECS side.

## 2.2 Stellaris vs ARPG: hybrid, and which half comes from where

("PoE" = Path of Exile. "ARPG affix system" = the Diablo/PoE family, where an
item carries a list of named stat bonuses that apply while it's equipped.)

| Aspect | Stellaris/Clausewitz | ARPG (Diablo/PoE) | Recommendation |
|---|---|---|---|
| Source variety | many heterogeneous kinds (buildings, traits, edicts, techs, opinions) | essentially one (equipment) | **Stellaris.** Items are the first source here, not the only plausible one — a reputation tier or an active endeavor phase could grant modifiers later. |
| Condition model | `triggered_modifier` = live while condition true | equipped-slot check | **Stellaris**, with equip-gating as one condition among others. |
| Duration/decay | `add_modifier = { days = 3600 }` | none | **Rejected** — confirmed by review. See §2.3. |
| Identification | global named modifier keys | rolled affixes from a pool | **Stellaris' named keys**, hand-authored (no rolling — §2.3). |
| Arithmetic | `((base + Σadd) × (1 + Σmult)) × (1 − reduction)` | `(base + Σflat) × (1 + Σincreased) × ∏(1 + more)` | **ARPG**, minus the `more` tier (§2.7). Note both traditions converged on the same `(base + Σflat) × (1 + Σpercent)` core independently. |
| Stacking philosophy | mostly additive within a category | explicit two-tier: additive pool + rare multiplicative | **ARPG's**, minus the multiplicative tier at launch (§2.7). |

**Short version: Stellaris skeleton, ARPG arithmetic.**

## 2.3 What to explicitly reject from each

**Reject Stellaris' timed/duration modifiers.** *(Confirmed by review.)* They
assume a continuous tick. Your world clock is four discrete shifts and a day
counter; there's no natural `days = 3600`. Building it means new expiry logic
in the clock *and* storing active timed modifiers in `PlayerState` — real
save-format weight for a case no motivating example needs. If a temporary
modifier is ever wanted, express it as a *condition* ("while `endeavor_x` is
in `phase_y`", "while shift is `NIGHT`"), reusing `DialogueRequirement`'s
existing shape. That's `triggered_modifier`, which is the part of Stellaris
that does fit.

**Reject ARPG affix generation.** Tiers, prefix/suffix pools, rolled ranges,
item rarity — all of it exists to make loot generation interesting at volume.
This is a hand-authored game with a handful of named items where every bonus
should be a deliberate narrative choice. Author modifiers by hand in the item
JSON.

## 2.4 Types (engine, pure, no content imports)

`src/engine/modifiers.ts` — new file, pure functions only, unit-testable,
zero `src/content/` awareness (same discipline as `minigames/dice.ts`).

```typescript
// A closed union. Adding a key is a deliberate act — the same
// forcing-function reasoning as persistence.test.ts's hand-maintained
// key list. A typo in content fails at loadContent(), not silently.
export const MODIFIER_KEYS = [
  // Duel — applied directly inside duel.ts, no command involved
  'DUEL_DAMAGE_DEALT',
  'DUEL_DAMAGE_TAKEN',
  'DUEL_STARTING_POISE',
  // Command-driven — key derived from command type + sign (§2.8)
  'CURRENCY_GAIN',
  'CURRENCY_LOSS',
  'REPUTATION_GAIN',
  'REPUTATION_LOSS',
] as const;
export type ModifierKey = typeof MODIFIER_KEYS[number];

/** FLAT: absolute amount. PERCENT: fraction of base.
 *  Both accept negative values — a modifier can raise or lower a value
 *  in either form. { op: 'FLAT', value: -1 } and
 *  { op: 'PERCENT', value: -0.1 } are both valid and meaningful. */
export type ModifierOp = 'FLAT' | 'PERCENT';

export interface Modifier {
  key: ModifierKey;
  op: ModifierOp;
  value: number;          // PERCENT: fraction, 0.05 = +5%, -0.1 = −10%
  targetId?: string;      // narrows to one faction/actor/etc.
                          // absent = applies to every target for this key
  sourceId: string;       // the item id that granted it
  sourceLabel: string;    // resolved display name, filled by the bridge
}

export type ModifierSet = readonly Modifier[];

/** Every modifier matching key, under the targeting rule below. */
export function selectModifiers(
  set: ModifierSet, key: ModifierKey, targetId?: string
): Modifier[];

/** max(0, round((base + ΣFLAT) × (1 + ΣPERCENT))) */
export function applyModifiers(
  base: number, set: ModifierSet, key: ModifierKey, targetId?: string
): number;
```

### The targeting rule

**A modifier matches a query when the query's target is at least as specific
as the modifier's.**

| `modifier.targetId` | query `targetId` | match | reading |
|---|---|---|---|
| absent | absent | ✅ | general modifier, general query |
| absent | `faction_x` | ✅ | a general modifier applies to every specific case |
| `faction_x` | `faction_x` | ✅ | exact |
| `faction_x` | `faction_y` | ❌ | different target |
| `faction_x` | **absent** | ❌ | **a specific modifier does not apply to a general query** |

The last row is the one that needed deciding, and it's decided as **exclusive**
— an untargeted query returns only untargeted modifiers.

**Reasoning: the failure modes are asymmetric.** Under the wildcard reading,
a calculation site that forgets to pass its target would silently apply a City
Watch letter's bonus to *every* faction — a wrong number the player sees, with
nothing raising an error. Under the exclusive reading, the same mistake
produces a *missing* bonus, which is visible and traceable. When two readings
are both defensible, take the one whose failure mode is loud.

Two supporting reasons:

- **`selectModifiers` is primarily a calculation primitive.** `applyModifiers`
  is built on it, and every calculation site knows its own target. Defaulting
  it toward the display case optimises for the secondary consumer.
- **The display case is better served by a different shape anyway.** A stat
  screen wants "all modifiers, grouped by target," which is a `ModifierSet`
  filter in the UI layer — it's a plain array. Overloading the calculation
  primitive with wildcard semantics to serve a need it models poorly is the
  wrong trade.

Asserted in `src/__tests__/modifiers.test.ts` (all five rows), which is
written to be dropped in at stage 1.

**Why `PERCENT` rather than PoE's `INCREASED`:** the requirement is that
modifiers work in both directions, and `{ op: 'INCREASED', value: -0.1 }`
reads as a contradiction. `PERCENT` is direction-neutral. The rename costs
nothing since the `more` tier isn't being shipped (§2.7), which is the only
thing `increased` was ever contrasted against.

**On the query API question (`getModifiers(scope, key): number` vs. a list the
caller aggregates):** ship **both, layered**. `applyModifiers` is what every
calculation site calls — one line, no aggregation logic duplicated per site.
`selectModifiers` is the same lookup without the arithmetic, and it's what a
"+2 damage — Duellist's Rapier" tooltip needs. `applyModifiers` is implemented
on top of `selectModifiers`, so exposing both costs one extra export, not an
extra mechanism. Given tooltips are wanted eventually, carrying `sourceId` /
`sourceLabel` on `Modifier` from day one avoids a later rework of every
content file.

**On scope:** deliberately **no `scope` parameter.** Stellaris needs scopes
because it has many planets and many countries. Here the only scope is "the
player." Namespace inside the key instead (`DUEL_DAMAGE_DEALT`), and use
`targetId` for the genuinely parameterised case (a letter that boosts
reputation with one specific faction). Adding a scope parameter now would be
inventing a domain rule speculatively. If per-opponent modifiers ever become
real, add it then (§3.4).

**Why `targetId` rather than encoding the faction into the key string:**
keeps `ModifierKey` a closed enum (typo-catchable at load), and lets
`content-integrity.test.ts` validate that every authored `targetId` resolves
to a real entity — the same check it already does for other id references.

## 2.5 Content side

New capability fragment in `src/content/schemas/shared.ts`, composed into
`ItemSchema` exactly as `TriggerableSchema` composes into District/POI:

```typescript
export const ModifierGrantSchema = z.object({
  key: z.enum(MODIFIER_KEYS),         // imported from src/engine/types
  op: z.enum(['FLAT', 'PERCENT']),
  value: z.number(),                  // may be negative
  targetId: z.string().optional(),
}).strict();

export const ModifierSourceSchema = z.object({
  modifiers: z.array(ModifierGrantSchema).default([]),
});
```

Note `MODIFIER_KEYS` gets re-exported from `src/engine/types` alongside
`SHIFTS` — that's the existing sanctioned direction for schemas to import
runtime Zod-adjacent values from the engine (`engine.md` §5).

**Modifiers live as a field on Item, not in a separate modifier-definition
file.** Indirection through a `modifierId` pays off in Stellaris because
hundreds of buildings share modifier bundles. Here, a handful of hand-authored
items each carry bespoke bonuses; a separate file buys an id-resolution step
and a dangling-reference test, and buys nothing else. Same reasoning that
made `Endeavor.onPoiEnter` synthesise its `START_ENDEAVOR` from the Endeavor's
own fields rather than introduce a second source of truth.

Authored examples:

```json
{
  "id": "item_duelists_rapier",
  "name": "Duellist's Rapier",
  "slot": "WEAPON",
  "modifiers": [
    { "key": "DUEL_DAMAGE_DEALT",   "op": "FLAT", "value": 2 },
    { "key": "DUEL_STARTING_POISE", "op": "FLAT", "value": 10 }
  ]
}
```

```json
{
  "id": "item_letter_of_introduction",
  "name": "Letter of Introduction",
  "modifiers": [
    { "key": "REPUTATION_GAIN", "op": "PERCENT",
      "value": 0.25, "targetId": "faction_city_watch" }
  ]
}
```

```json
{
  "id": "item_pendant_of_easy_coin",
  "name": "Pendant of Easy Coin",
  "slot": "PENDANT",
  "modifiers": [
    { "key": "CURRENCY_GAIN", "op": "PERCENT", "value": 0.05 }
  ]
}
```

A negative example, to show both directions work — a cursed blade that hits
harder but leaves you open:

```json
{
  "id": "item_notched_sabre",
  "name": "Notched Sabre",
  "slot": "WEAPON",
  "modifiers": [
    { "key": "DUEL_DAMAGE_DEALT", "op": "FLAT",    "value":  3 },
    { "key": "DUEL_DAMAGE_TAKEN", "op": "PERCENT", "value":  0.2 }
  ]
}
```

No `slot` on the letter — see next section.

## 2.6 Owned vs. equipped

> **Everything in this section below the first rule is DEFERRED** — see §3.1.
> Stages 1–2 ship **owned-gating only**. The slot design is kept here so it
> doesn't have to be re-derived when the revisit trigger fires, and so the
> owned/equipped rule below is on record as the intended eventual shape.
> Treat it as a sketch to be re-specced, not as an approved build.

Some things hold one item (a rapier), some hold several (rings). That resolves
with **one field**, not two mechanisms:

> **An Item with a `slot` is equip-gated. An Item without a `slot` is
> owned-gated.**

The letter works in your pocket. The rapier has to be drawn. No separate
`while: OWNED | EQUIPPED` discriminant — `slot`'s presence *is* the
discriminant, which means content can't author the contradictory combination.

### Slot model — capacity, not enumerated slots

```typescript
// src/engine/types — engine vocabulary, not content entity ids
export const EQUIP_SLOTS = ['WEAPON', 'PENDANT', 'RING'] as const;
export type EquipSlot = typeof EQUIP_SLOTS[number];

export const SLOT_CAPACITY: Record<EquipSlot, number> = {
  WEAPON: 1,
  PENDANT: 1,
  RING: 3,   // placeholder, same treatment as THRUST_DAMAGE
};

// PlayerState gains exactly one field:
equipped: Record<EquipSlot, string[]>;   // itemIds
```

Recommended over enumerated singular slots (`RING_1`, `RING_2`, …) because
capacity is one tunable number rather than an enum edit plus a
`persistence.test.ts` key decision each time, and because the UI doesn't need
to know that `RING_1` and `RING_2` are interchangeable — they're the same
slot.

Invariants, enforced in the command handler (pure, testable):

- `equipped[slot].length <= SLOT_CAPACITY[slot]`
- an itemId appears **at most once** across all slots
- an itemId can only occupy the slot its content declares — which the handler
  can't check itself (it can't read content), so `COMMAND_EQUIP_ITEM`'s
  payload carries the slot, per the existing content-derived-payload pattern
  (`web-implementation.md` §3). Same shape as `costShifts` on
  `COMMAND_MOVE_TO_POI`.

Two new commands: `COMMAND_EQUIP_ITEM { itemId, slot }` and
`COMMAND_UNEQUIP_ITEM { itemId }`. Both added to `StateCommandSchema`.
`equipped` added to `persistence.test.ts`'s key list (it should persist).

### Quantity independence — and why it matters

**A modifier contributes once regardless of `quantity`.** Owning three
identical letters gives you one letter's bonus; the same itemId can occupy
only one slot.

This isn't just simpler — it's a deliberate firewall around **gap #12**.
`stackable` is currently unenforced: `COMMAND_ADD_ITEM` merges by itemId and
sums quantity regardless. A quantity-scaled modifier would turn that known,
currently-harmless gap into a balance exploit the moment any item is granted
twice. Presence-based contribution means gap #12 stays a cosmetic
inconsistency instead of becoming a bug with gameplay consequences, and it can
be fixed on its own timeline.

## 2.7 Stacking rules

**`(base + ΣFLAT) × (1 + ΣPERCENT)`, rounded once at the end.**

Both ops accept negative values, so "increase or decrease, flat or
percentage" is four cases handled by two ops and a sign — no extra vocabulary.

**Ship `FLAT` and `PERCENT` only. Omit PoE's multiplicative `more` tier.**
Percentages stacking additively creates diminishing returns — in PoE, +20%
then another +20% is a ×1.4 multiplier, so the second source is effectively
worth 16.7%. That diminishing curve is a *deliberate balance tool* in a game
with hundreds of stacking sources, and `more` exists to give rare items a way
to escape it. With two to four sources on a hand-authored item set, additive
percentages are simply predictable, and the escape hatch has nothing to escape
from. `ModifierOp` is a union — adding a third op later is additive,
non-breaking, and should wait for a real case.

**Against "take the highest."** Stellaris and Diablo 2 both use
does-not-stack rules in places, but as anti-exploit measures in systems with
many overlapping sources. Here it would be surprising to the player ("why did
my second ring do nothing?") and would need a per-key policy table. If one
specific key ever genuinely needs it, make it a policy on that key in the
registry rather than an op on individual modifiers — one rule per stat is
explicable, per-modifier stacking behaviour isn't.

**Clamping — the result, not just the multiplier.**

```
max(0, round((base + ΣFLAT) × (1 + ΣPERCENT)))
```

There are **two** independent ways the arithmetic can invert a value, and an
earlier revision of this spec guarded only one of them:

- `PERCENT` modifiers summing below −1.0 (e.g. two at −0.6) produce a negative
  multiplier.
- `ΣFLAT` exceeding `base` (e.g. `FLAT −15` against a base of 10) produces a
  negative subtotal *before* any percentage is applied.

The second is the more dangerous, because §2.8 feeds `applyModifiers` a
**magnitude** and reapplies the sign afterwards. A negative return value there
doesn't just produce a small number — it flips direction. A `CURRENCY_LOSS`
modifier of `FLAT −15` against a 10-bronze loss would turn a loss into a
5-bronze *gain*.

Clamping the final result at 0 covers both cases with one rule, and states the
principle §2.7 already relied on: **a modifier can reduce a value to nothing;
it can never invert it.** Both cases are asserted in
`src/__tests__/modifiers.test.ts`.

**Rounding:** `Math.round`, applied once at the end of `applyModifiers`, never
per-step. For currency, round on the bronze-equivalent before
`COMMAND_ADJUST_CURRENCY` normalises. `Math.round` over `Math.floor` because
at duel-damage magnitudes (single digits) flooring silently eats most small
percentage bonuses. Flagged in §3 as a tunable — it's a real balance decision
at these numbers.

## 2.8 Applying modifiers — inside the handler

**This section changed in revision 2.** Revision 1 resolved modified amounts
in the bridge layer before dispatch. The reviewer's proposal — the handler
applies modifiers to the result of the command it's already executing — is
better, and it's what's specified here. It keeps the modified value inside the
one pipeline that already owns all state change, and it means content authors
write the base number and nothing else.

### Getting the ModifierSet into the handler

**The constraint:** modifiers are authored in item JSON. `src/engine/` may
never read `src/content/`. So the handler cannot look up items itself.

**Resolution happens in the bridge layer, as data.** New file
`src/modifierResolution.ts` — third sibling to `dialogueResolution.ts` and
`notificationResolution.ts`, for exactly the reason those two exist (needs
`src/content/`-derived data, so it lives outside `src/engine/`). Three
instances is this project's own bar for generalising a pattern.

```typescript
// src/modifierResolution.ts
export function collectActiveModifiers(
  playerState: PlayerState,
  items: Record<string, Item>,
): ModifierSet;
```

Walks `inventory` and `equipped`, pulls each item's `modifiers`, filters by
the owned/equipped rule, stamps `sourceId` and `sourceLabel` (`item.name`),
returns a flat list. Pure, testable, no React. **Derived every time — never
stored in `PlayerState`.**

**Delivery: an optional context argument on `applyCommand`.**

```typescript
applyCommand(state, command, ctx?: { modifiers?: ModifierSet })
```

Threaded through the two recursive call sites (`COMMAND_RESOLVE_MINIGAME`'s
consequence loop, `COMMAND_SELECT_DIALOGUE_CHOICE`'s command loop) so nested
content-authored commands get modified identically to top-level ones — which
is the whole point, since that's where rewards actually live.

**These two are exhaustive — verified by grep against the codebase, not
inferred.** No third recursive `applyCommand` site exists. That matters
because a missed one would silently skip modifier application for whatever
content routes through it, and the failure would look like a content bug
rather than a plumbing bug. If a third recursion is ever added, threading
`ctx` through it is not optional.

Handlers stay pure functions of their inputs; `ctx` is just another input.
Nothing enters `PlayerState`. `dispatchCommand` supplies it from a
**store-only** `activeModifiers` field — same tier as `eventLog` and
`notifications`, not `PlayerState`, not persisted, cleared by
`resetProgress`/`importSave` — which `App.tsx` sets via a `useEffect` on
`inventory`/`equipped`.

This also mirrors `DuelContext`'s own "one extensible context object rather
than positional parameters" decision, so both delivery routes end up shaped
the same way.

*(Rejected alternative: putting the resolved `ModifierSet` in `PlayerState`.
It denormalises content into the save file, so a save goes stale the moment an
item is rebalanced.)*

### Known limitation: modifiers resolve as of the **start** of a dispatch

This is a real, traced consequence of the `useEffect` delivery path — not a
hypothetical. Stating it as a named semantic rather than leaving it to be
discovered:

> **The `ModifierSet` applied throughout a `dispatchCommand` call — including
> every nested `applyCommand` recursion inside it — reflects the player's
> items as they were *before* that dispatch began.**

**Why, precisely.** `dispatchCommand`'s `set()` and any `useEffect` reacting
to it are two separate store writes across two separate render cycles. They
are never synchronous with each other. So an effect that recomputes
`activeModifiers` from `inventory`/`equipped` cannot observe a change made by
the dispatch that is still running. The codebase already contains this exact
two-hop shape: `App.tsx`'s endeavor-completion notification effect reacts to
`activeEndeavors` one cycle after the dispatch that changed it.

**What it means concretely.** A dialogue choice whose `commands` are
`[COMMAND_ADD_ITEM(pendant), COMMAND_ADJUST_CURRENCY(+100)]` grants the
pendant and pays out in the same recursive loop. The pendant's +5% does **not**
apply to that +100. It applies from the next dispatch onward.

**Why it's being left as-is.** The behaviour is defensible on its own terms —
arguably it's the semantics you'd choose deliberately, since benefiting from
an item in the same instant you receive it is the odder of the two readings.
It's documented here so it reads as a decision rather than a bug when someone
eventually hits it.

**Revisit trigger:** *the first time content wants a single command batch to
both grant a modifier-bearing item and have that modifier apply within that
same batch.*

**The shape of the fix, so it isn't re-derived later.** Replace the snapshot
with a resolver: `ctx.resolveModifiers?: (state: PlayerState) => ModifierSet`
instead of `ctx.modifiers`. The bridge supplies a closure over its loaded item
content, so `applyCommand` can re-derive the set mid-batch against the state
it currently holds — while still never importing `src/content/` itself. One
`ctx` field changes; the handlers' call shape doesn't. Not built now: it
trades an inspectable plain array for a closure and re-walks inventory per
command, which is a poor trade until a real content case demands it.

### The key is derived from command type + sign

**The problem:** `COMMAND_ADJUST_CURRENCY` is dispatched both for rewards and
for costs — "Pay off the buyer" in `endeavor_the_missing_broadsheet` uses it
for a payment. A `+5% currency` pendant applied indiscriminately would inflate
that cost.

**The rule:** the sign of the delta picks the key.

| Command | delta ≥ 0 | delta < 0 |
|---|---|---|
| `COMMAND_ADJUST_CURRENCY` | `CURRENCY_GAIN` | `CURRENCY_LOSS` |
| `COMMAND_ADJUST_REPUTATION` | `REPUTATION_GAIN` | `REPUTATION_LOSS` |

**Modifiers scale the magnitude, then the sign is reapplied.** This is what
makes loss modifiers read correctly: a `CURRENCY_LOSS` modifier of
`PERCENT -0.1` means *you lose 10% less*, not *you lose 10% more*.

> **Corrected in revision 5.** Earlier revisions wrote this pseudocode against
> a `deltaBronze` field on the command payload. That field does not exist on
> `COMMAND_ADJUST_CURRENCY`. `deltaBronze` is real, but belongs to
> `NotificationEvent`'s `CURRENCY` variant
> (`src/engine/store/notifications.ts`) — a *derived, read-only* value computed
> by diffing state before and after a dispatch, for display. The two were
> conflated. The real payload is
> `{ denomination: "gold" | "silver" | "bronze"; amount: number }`.

The correction matters for more than accuracy: **the modifier must be applied
to a bronze-equivalent magnitude, not to `payload.amount` in its own
denomination.** `applyModifiers` rounds, so applying +5% to
`{ denomination: "silver", amount: 3 }` in silver gives `3.15 → 3` and the
bonus vanishes entirely. In bronze it's `60 → 63`, which the handler's existing
carry logic then re-splits correctly. Doing the arithmetic in the coarsest unit
destroys every percentage smaller than the unit itself.

The handler already converts to a bronze-equivalent figure internally
(`web-implementation.md` §4: *"converted to a single bronze-equivalent figure,
adjusted, then re-split into gold/silver/bronze"*), so the modifier slots into
a conversion that already happens — no new conversion, and no converting back:

```typescript
// commands.ts — COMMAND_ADJUST_CURRENCY handler
// payload: { denomination: "gold" | "silver" | "bronze"; amount: number;
//            modifierKey?: ModifierKey }

// EXISTING: the payload's amount becomes a signed bronze-equivalent delta,
// using the same 20:20 ratios the carry/borrow logic already applies.
const deltaInBronze = toBronzeEquivalent(payload.denomination, payload.amount);

// NEW: modify the magnitude in bronze, then reapply the sign.
const key = payload.modifierKey
  ?? (payload.amount >= 0 ? 'CURRENCY_GAIN' : 'CURRENCY_LOSS');
const magnitude = applyModifiers(
  Math.abs(deltaInBronze), ctx?.modifiers ?? [], key
);
const modifiedDeltaInBronze = Math.sign(deltaInBronze) * magnitude;

// EXISTING, unchanged: add to the player's total bronze-equivalent,
// clamp at the zero floor, re-split into gold/silver/bronze.
```

**Confirmed: still no payload rename and no breaking change to content.** The
only payload addition is the optional `modifierKey?`. Every existing authored
`COMMAND_ADJUST_CURRENCY` — `{ denomination: "bronze", amount: 50 }` and
friends — is untouched, and behaves identically when no modifier is active.
`StateCommandSchema` gains one `.optional()` field, which is additive under
`.strict()`.

**Two edge cases worth a test** (both in §2.10):

- `amount === 0`. The key derivation picks `CURRENCY_GAIN` (via `>= 0`), but
  `Math.sign(0) === 0`, so the result is 0 regardless of what modifiers exist.
  A `FLAT` modifier must not conjure currency out of a no-op adjustment.
- The `FLAT`-overshoot inversion described in §2.7. This is exactly the call
  site where it would do damage, since the sign is reapplied after the fact.

Reputation is the same shape but simpler — a single unit, so no
denomination conversion — and it passes the target for narrowing:

```typescript
const key = payload.amount >= 0 ? 'REPUTATION_GAIN' : 'REPUTATION_LOSS';
const magnitude = applyModifiers(
  Math.abs(payload.amount), ctx?.modifiers ?? [],
  key, payload.factionId ?? payload.actorId
);
```

**Zero authoring burden.** Existing content JSON needs no changes at all — a
dialogue choice granting `+5` reputation keeps saying `+5`, and the letter
makes it `+6`. This is the main advantage over revision 1's explicit-marker
design.

**Free notification correctness:** the modified amount lands in `PlayerState`
before `diffForNotifications` runs, so the tray reports the true final delta
with no notification-system changes at all.

### The one escape valve: `modifierKey` override

The sign rule can't distinguish *kinds* of gain. Specifically it cannot tell
an endeavor reward from **dice winnings** — and that one matters.

**The dice game is exactly EV-neutral, and a gain-only modifier breaks that.**
Two d6 produce an even sum in 18 of 36 outcomes. A win nets `+wager`, a loss
`−wager`, so expected value is precisely zero — which is what
`game-design-spec.md` §10 designed it to be.

Apply a `+5% CURRENCY_GAIN` pendant. The win is a positive delta and gets
modified; the loss is negative and doesn't. Per throw:

```
EV = 0.5 × (+1.05 · w)  +  0.5 × (−1.00 · w)  =  +0.025 · w
```

At `MAX_WAGER = 100` that's +2.5 bronze per throw, indefinitely.

**The mechanism is the asymmetry, not the repetition.** This distinction
determines what actually fixes it:

- **A cooldown or shift cost bounds the *rate*.** EV stays positive, so the
  player still farms, just more slowly — and the change applies to every
  player, including ones carrying no modifier at all.
- **The carve-out preserves the *invariant*.** Dice remains a fair coin flip
  regardless of inventory.

They are orthogonal. Anti-grind pacing is worth designing (it belongs to
**gap #9**, which already names the dice minigame as its first instance), but
it is not a substitute for this carve-out.

So `COMMAND_ADJUST_CURRENCY`'s payload gains an optional
`modifierKey?: ModifierKey`, used to name a narrower key that generic
modifiers don't match. **Exactly one authored site needs it today:** the dice
launcher names `CURRENCY_GAMBLING_WINNINGS`, and since no item is keyed to
that, gambling payouts are unmodified.

**The decisive argument is legibility, not balance.** §9 chose dice for being
"pure chance, transparent odds ... legible to the player at a glance." An item
sitting in the player's inventory that silently shifts those odds defeats the
minigame's stated design intent, and the player has no way to observe it
happening. A balance problem can be tuned; a legibility problem can't.

### If you *do* want a gambling item later

Two shapes are available, and the carve-out is what makes both authorable:

- **An edge** — keyed to `CURRENCY_GAMBLING_WINNINGS`, deliberately positive
  EV. Fine if that's the intent, and now it's an intent rather than a
  side effect.
- **Variance without edge** — the more interesting one. Key the same
  percentage to *both* gain and loss, so swings get bigger while EV stays
  zero. A gambler's charm that makes the game more exciting without making it
  profitable. Authorable today as two modifier entries; impossible if a
  generic `CURRENCY_GAIN` item leaks into the loop.

### Check before designing any cooldown

`game-design-spec.md` §4 already states: *"Performing a heavy action or
minigame costs 1 Shift."* Nothing in `web-implementation.md` §9's DICE section
mentions dispatching `COMMAND_ADVANCE_SHIFT`, and `DiceGame` re-dispatches
`COMMAND_START_MINIGAME` on every stepper click — which would be odd
behaviour if launching cost a shift.

**So the anti-grind mechanism may already be specified and simply
unimplemented.** Worth confirming in code before designing a new one, because
the two options differ sharply in cost: a shift cost needs **no new state at
all**, while a per-shift cooldown needs something like `lastPlayedShift` in
`PlayerState` — save-format surface, with all the caution §3.1 applies to
that. Not this spec's call either way; noted so the cheaper option gets
considered first.

**The rule, stated once:** *an adjustment resolves against exactly one key —
the one its payload names, or the one derived from its sign. Never both, never
a sum across keys.* One key per adjustment is explicable to a content author;
key aggregation isn't.

Keys used this way are added to `MODIFIER_KEYS` like any other, so a typo
still fails at content load.

### Duel — a context extension, no command involved

Duel damage isn't dispatched as a command, so it takes the other route, which
**gap #11 already reserved**:

`DuelContext` gains `modifiers: ModifierSet`. `App.tsx` computes it and passes
it to `DuelGame.tsx` as a prop (same shape as the existing injectable
`random`/`playSound` props); `DuelGame` puts it in the context it builds.
`evaluateDuelTurn` / `chooseOpponentAction` **signatures don't change** —
which is precisely what `DuelContext` was deliberately shaped for. Inside,
`THRUST_DAMAGE` becomes
`applyModifiers(THRUST_DAMAGE, ctx.modifiers, 'DUEL_DAMAGE_DEALT')`. The
constants stay as base values; nothing about them is wrong, they were just
never modifiable.

## 2.9 Rollout: incremental, with one rule

**Incremental, four stages.** The "two competing mental models" worry is real
but it's a risk of *two ways to add a bonus*, not of *some sites not yet
having bonuses*. A duel constant no modifier touches yet isn't a competing
model — it's a base value, which is what it will still be afterwards.

**The rule that prevents the split:** once stage 1 lands, **no new
calculation site may hardcode a bonus.** Any new bonus goes through
`modifiers.ts`. Existing sites migrate on their own schedule. Worth a line in
`CLAUDE.md`.

| Stage | Contents | Player-visible? |
|---|---|---|
| **1** | `modifiers.ts`, `ModifierSourceSchema`, Item `modifiers` field, `modifierResolution.ts` (owned-only), wire **duel damage** only | No, until an item is authored |
| **2** | `applyCommand` ctx param, sign-derived keys in the currency/reputation handlers, `modifierKey` override on the dice launcher | Yes |
| **3** | Tooltips / stat display via `selectModifiers` | Yes |
| **~~4~~** | ~~`equipped`, `COMMAND_EQUIP_ITEM`/`UNEQUIP`, `SLOT_CAPACITY`, persistence key, equip UI~~ | **Deferred — §3.1** |

**Stages 1–3 are the whole of what gets built.** Equipping is deferred until a
second item competes for the same role (§3.1); until then every modifier
source is owned-gated, which covers the letter and the pendant. The rapier's
bonus can still be authored — it just applies while carried rather than while
wielded, which is a fiction question rather than a mechanism one until there's
a second rapier to choose against.

*(Stage ordering changed twice: revision 1 put equipping second, revision 2
demoted it behind the currency/reputation path, and revision 3 defers it
entirely. The consistent reason is that each later version found more of the
motivating value sitting in the modifier layer rather than in the selection
UI.)*

**Why duel damage first:** it's a pure deterministic function with an existing
test file; `DuelContext` was *explicitly designed* to absorb this without a
signature change (gap #11); and it has no in-content trigger yet, so a
regression during the proving run cannot reach a player. It's the ideal
proving ground and the project already reserved it for this.

**Why tooltips come last:** stage 3 needs no new data — `sourceId` and
`sourceLabel` are on every `Modifier` from stage 1, and `selectModifiers` is
already the function `applyModifiers` is built on. It's presentation work
against a complete model, which is why it's safe to leave until the numbers
are worth explaining to a player.

## 2.10 Testing

This follows `CONTRIBUTING.md`'s existing Definition of Done — it doesn't
propose a parallel standard. What's below is the part specific to this
feature: which properties matter, and which don't.

### The load-bearing guarantee: inertness

**Every existing test in the suite must pass unmodified, with no changes to
its setup, once each stage lands.**

This is the single most valuable property in the whole feature, and it should
be stated as an acceptance criterion rather than discovered by running the
suite. It's achievable because every seam is designed to be a no-op by
default:

- `applyModifiers(x, [], key) === x` — an empty set is the identity.
- `applyCommand(state, command)` with `ctx` omitted behaves exactly as it does
  today. The parameter is optional; the handlers fall back to `[]`.
- `evaluateDuelTurn` / `chooseOpponentAction` signatures don't change at all.

If an existing test needs editing to accommodate a stage, that's a signal the
seam is wrong — not a signal to edit the test.

### What to test

**`modifiers.test.ts`** — the arithmetic, exhaustively, since every other site
depends on it being right:

- **The targeting rule — all five rows of §2.4's table**, including the
  decided one: a targeted modifier does *not* appear in an untargeted query.
- All four direction cases: positive `FLAT`, negative `FLAT`, positive
  `PERCENT`, negative `PERCENT`.
- **Order independence.** `ModifierSet` is a list, so assert that shuffling it
  produces an identical result. This is a real invariant that a future
  refactor could silently break.
- **Both zero-clamp paths** (§2.7): `PERCENT` summing below −1.0, *and*
  `ΣFLAT` exceeding the base. The second is the one that would invert a
  currency loss into a gain.
- Rounding boundaries — `x.5` in both directions, given `Math.round`'s
  asymmetry on negatives.
- Empty-set identity.

**This file is written out in full** and ships alongside this spec. It's
executable spec: dropped in at stage 1, it fails to compile until
`src/engine/modifiers.ts` exists, then passes when the implementation matches
the decisions recorded here.

**`modifierResolution.test.ts`** — owned vs. equipped filtering, quantity
independence (three copies of one item contribute once), `sourceLabel`
stamping, and an item with no `modifiers` field at all.

**`commands.test.ts`** — **sign routing is the critical case**, because it's
where the design's main hazard lives:

- a `CURRENCY_GAIN` modifier must leave a negative `amount` untouched (the
  "Pay off the buyer" regression);
- a `PERCENT` modifier must produce the same result for
  `{ denomination: "silver", amount: 3 }` as for
  `{ denomination: "bronze", amount: 60 }` — proving the modifier is applied
  to the bronze-equivalent and not to the payload's raw `amount`;
- `amount: 0` yields no change, even with a `FLAT` modifier active;
- a large negative `FLAT` on a `CURRENCY_LOSS` must not invert the loss into
  a gain (the §2.7 clamp, exercised at the call site where it matters);
- a `CURRENCY_LOSS` modifier with a negative value must *reduce* the magnitude
  of a loss, not increase it;
- a `modifierKey` override wins over the sign-derived key;
- modifiers reach **nested** commands — a `COMMAND_SELECT_DIALOGUE_CHOICE`
  whose `commands` contain a currency adjustment must have that adjustment
  modified. This is the case a naive implementation misses, since the
  recursion is internal to `commands.ts`.

**`content-integrity.test.ts`** — every authored `targetId` resolves to a real
entity; every `slot` is in `EQUIP_SLOTS`. Key validity comes free from
`z.enum`, so it needs no test of its own.

**`persistence.test.ts`** — no change in stages 1–3. Nothing in this feature
adds a `PlayerState` field; that's a property worth noticing rather than a
gap. `equipped` would be the first, if and when the deferred equip work lands
(§3.1).

### What not to test

- **Balance numbers.** `THRUST_DAMAGE`, `SLOT_CAPACITY.RING`, the pendant's
  `0.05` — all placeholders, same status as `dice.ts`'s wager constants.
  Asserting them locks in numbers that exist to be tuned. Test that a modifier
  *applies*, not what the result equals in absolute terms.
- **Determinism plumbing.** Modifiers introduce no randomness. Don't add an
  injectable `RandomSource` to `modifiers.ts` by reflex — `dice.ts` and
  `duel.ts` have one because they roll; this doesn't.

---

## 2.11 Procedure: adding a new modifier key

A checklist, written to be handed to Claude Code as-is. The point is that
adding a key is mechanical and bounded — no design judgement required at the
point of use, because the judgement was made here.

**1. Add the key to `MODIFIER_KEYS`** in `src/engine/types`. Grouped by
subsystem, and gain/loss keys are added **as a pair** even if only one has a
use today — a lone `X_GAIN` invites someone to later invent a different shape
for `X_LOSS`.

**2. Decide the delivery route.** Exactly two exist:

- **Command-driven** — the value passes through a `StateCommand` payload.
  The key is derived from command type + sign (§2.8).
- **Direct** — the value is a constant at a calculation site (`duel.ts`).
  The call site invokes `applyModifiers` itself.

If the answer is "neither," stop: the value has no delivery route yet, and
inventing a third one is a design change that needs its own spec entry.

**3a. If command-driven, and that command doesn't yet consume modifiers,**
add the derivation to its handler — the two-line shape from §2.8:

```typescript
const key = payload.modifierKey ?? (payload.amount >= 0 ? 'X_GAIN' : 'X_LOSS');
const magnitude = applyModifiers(Math.abs(payload.amount), ctx?.modifiers ?? [], key);
const amount = Math.sign(payload.amount) * magnitude;
```

Modify the **magnitude**, then reapply the sign. Never modify a signed value
directly — that's how a "lose 10% less" modifier turns into "lose 10% more."

**3b. If direct,** replace the constant at the call site:

```typescript
// before
const damage = THRUST_DAMAGE;
// after
const damage = applyModifiers(THRUST_DAMAGE, ctx.modifiers, 'DUEL_DAMAGE_DEALT');
```

**Keep the constant.** It's the base value, and it stays exactly as
meaningful as it was. Never inline it, never delete it.

**4. Add tests** — one in `modifiers.test.ts` proving the key is inert with an
empty set, and one at the call site proving existing behaviour is unchanged
when no modifier is present. Per §2.10, don't assert balance numbers.

**5. Do not author content for the key** in the same change unless a specific
item actually needs it now. An unused key is harmless; a speculative item is
content debt.

**6. Docs sync** — per `docs/feature-workflow.md` §2 stage 9. Add the key to
`web-implementation.md`'s modifier key table. Update `docs/engine.md` only if
the *flow* changed (a new delivery route, a new call site kind), not for a key
added to an existing route.

### Rules that must not be violated

Stated here so they're one place to point at in review:

1. **The aggregate is never stored.** No derived stat field in `PlayerState`,
   ever. Computed at the point of use, every time.
2. **`src/engine/modifiers.ts` never imports from `src/content/`.** The
   `ModifierSet` always arrives as an argument.
3. **One key per adjustment.** The key the payload names, or the one derived
   from its sign — never both, never summed across keys.
4. **No `scope` parameter.** Namespace inside the key; use `targetId` for
   entity narrowing (§2.4).
5. **No new hardcoded bonus at any calculation site** once stage 1 lands
   (§2.9).

---

# 3. Decisions — resolved

## 3.1 Equipping: **deferred**, with a concrete revisit trigger

**Decision: build stages 1–2 now. Do not build stage 3 until a second item
exists that competes for the same role.**

The motivating vision — one rapier that raises damage, another that lowers
what a fight costs you, a third that reduces damage taken, so the player picks
a play style — is a good goal, and it's worth being precise about which half
of this feature actually delivers it.

**That vision is a modifier-system feature, not an equip-system feature.**
Differing bonus *shapes* is exactly what stages 1–2 make expressible. Equipping
is only the selection mechanism layered on top. Building stages 1–2 now
preserves the whole vision; building stage 3 now only adds a UI for choosing
between one item.

### The trade-off, concretely

**Cost of building it now:**

- `equipped` becomes **save-format surface**, and `importSave` has *no version
  migration logic* (`web-implementation.md` §6). A field's shape is cheap to
  change while nothing has saved it and expensive afterwards. Committing to
  `Record<EquipSlot, string[]>` before any content exercises it means guessing
  at a shape you'll then be stuck with.
- `SLOT_CAPACITY` numbers get invented with no content to tune them against.
  `RING: 3` would be a number chosen because it sounds right.
- Equip UI in `ManagementDrawer`, exercised by one item.
- Two new commands, `StateCommandSchema` entries, and handler invariants
  (capacity, uniqueness, slot-match) — all real, all testable, all currently
  guarding nothing.

**Cost of building it later:** almost nothing, because **every part of stage 3
is additive**:

- `slot?: EquipSlot` on `ItemSchema` — one optional field.
- `equipped` on `PlayerState` — additive, *provided it's schema-defaulted*
  (see the warning below).
- `collectActiveModifiers` gains a second branch alongside the owned one.
- Any items authored meanwhile under owned-gating get a `slot` added — a
  handful of JSON edits, and the modifier declarations themselves don't
  change at all.

That asymmetry is the answer. There is no forward-compatibility work to do now
to keep the option open; deferring costs you a few JSON edits later, and
building early costs you a save-format commitment made blind.

> ⚠️ **Whenever `equipped` does land, it must be declared with `.default(...)`
> in `PlayerStateSchema`, not as a required field.** `importSave` performs a
> structural check with no migration step, so a required new field would make
> every pre-existing save file fail to import. True whether stage 3 lands now
> or in a year — worth carrying forward into whatever spec covers it.

### Revisit trigger

**When a second item is authored that competes for the same role as an
existing one.** Concrete and checkable, rather than "when the project is
bigger."

### One blocker the equip system wouldn't have solved anyway

"A rapier that reduces its resource consumption" **has no resource to reduce.**
The duel tracks `energy` (health) and `poise` (guard); no action costs a
per-use resource. That play style needs a *duel mechanic* change — an action
cost, or a stamina track — which is its own design gap, not something the
modifier layer produces. Logged in §3.7.

## 3.2 Rounding: `Math.round` ✅

Recommendation accepted. Applied once at the end of `applyModifiers`, never
per-step. `Math.floor` would silently swallow most `PERCENT` modifiers at
single-digit duel-damage magnitudes; `Math.ceil` would make every trivial
bonus worth a full point. Note for tests: `Math.round` is asymmetric on
negatives (`Math.round(-0.5) === -0`), which is why §2.10 asks for boundary
cases in both directions.

## 3.3 Currency keys: **one** ✅

A single `CURRENCY_GAIN` applies to every currency gain from any source —
endeavor rewards, sales, found coin — and `CURRENCY_LOSS` to every loss. No
per-source keys. The sign rule in §2.8 delivers this with zero authoring
burden: existing content JSON is untouched, and the handler picks the key.

The one carve-out stands: the dice launcher names
`CURRENCY_GAMBLING_WINNINGS` explicitly. Dice is exactly EV-neutral by design,
and a gain-only modifier makes it positive-EV — the full derivation, and why a
cooldown wouldn't substitute for this, is in §2.8. That's one string at one
authored site, not a per-source key scheme.

## 3.4 Opponent modifiers: **no** ✅

`DuelContext.modifiers` is the player's, implicitly and by documentation. Not
built, not stubbed — consistent with how `lockpicking.ts` doesn't exist.

Forward note only, so it isn't lost: if opponent modifiers ever become real
(gap #11 mentions an opponent's weapon informing `chooseOpponentAction`), the
field splits into `player.modifiers` / `opponent.modifiers`, and the
opponent's would come from `DuelConfig` rather than inventory. `DuelContext`
absorbs that as a context extension without touching either function's
signature — the same property that made it the right first call site.

## 3.5 Reputation tiers: **not a decision — a note**

I flagged this as needing an answer in revision 2. On reflection it doesn't,
and the earlier framing overstated it.

**What the connection is.** Reputation is currently a *trigger* input — a
number that gates dialogue choices. Gap #2 asks what happens when it should
have systematic effects: at high standing with the City Watch, their district's
prices drop, or their members hit you less hard. Those are modifiers from a
source that isn't an item.

**Why it doesn't force anything now.** The recommended design already
accommodates a second source at no cost:

- `Modifier` carries `sourceId` / `sourceLabel` as plain strings, not
  item-specific fields — a faction tier can populate them unchanged.
- `collectActiveModifiers(playerState, content)` already receives the whole
  `PlayerState`, which contains `reputation`. A tier source is a second loop
  in one function.
- Content-side, it would be a `ModifierSourceSchema` fragment composed into
  `FactionSchema` — the same composition move, on a different node type.

Nothing in stages 1–4 changes either way. Gap #2 still needs its own spec
before anyone builds tiers; this just records that the modifier layer is where
their effects would land, so that spec doesn't invent a parallel mechanism.

## 3.6 Adding new keys: **see §2.11**

Answered as a procedure rather than a decision. §2.11 is a step-by-step
checklist plus a five-rule invariant list, written to be handed to Claude Code
directly.

The seven initial keys derive from the three motivating examples, gap #11's
poise note, and the gain/loss pairing rule. No eighth is known to be wanted.

## 3.7 New gaps surfaced by this design

Both need their own spec before implementation, same as every entry in
`game-design-spec.md`'s list. Recording them here so they're not lost:

**A. The duel has no per-action resource.** Surfaced by §3.1's play-style
vision. `energy` is health and `poise` is guard; nothing is spent to act, so
"an item that reduces what your attacks cost" is currently unexpressible.
Whether the duel should gain a stamina/initiative track is a mechanic
question, not a modifier question.

**B. Equip slots and their capacities are unspecified.** Deferred by §3.1.
When the revisit trigger fires, that spec covers `EQUIP_SLOTS`,
`SLOT_CAPACITY`, the two commands and their invariants, the equip UI, and the
`.default(...)` requirement on `PlayerStateSchema`.

**C. Does launching a minigame actually cost a Shift?** Not a new gap — a
possible *implementation* gap in an existing rule. `game-design-spec.md` §4
says a minigame costs 1 Shift; nothing in `web-implementation.md` §9 shows
`COMMAND_ADVANCE_SHIFT` being dispatched when one launches. If it's genuinely
unimplemented, that's the cheapest available anti-grind for the dice loop
(gap #9) — no new `PlayerState` field, no new command, a rule already written
down. Worth confirming in code before any cooldown mechanism is designed.
Independent of this spec either way: it changes the dice loop's pacing, not
whether the §2.8 carve-out is needed.

---

# 4. Draft entry for `docs/decisions.md`

> **ECS evaluated and declined; modifier system adopted as the missing third
> primitive.** ECS was assessed against the existing CQRS/trigger/effect
> architecture and rejected for adoption: its performance benefits require
> large homogeneous entity populations this game doesn't have, and its
> mutable-arena storage model is structurally opposed to `PlayerState` being
> an immutable, Zod-validated, persisted value — adoption would degrade
> `persistence.test.ts`'s deliberate key list, `PlayerStateSchema`,
> `diffForNotifications`, and put pressure on the engine ↔ content boundary.
> Three ideas were borrowed: composable capability schema fragments
> (`TriggerableSchema`, now `ModifierSourceSchema`), entity-as-id sparse side
> tables (`unlockedNodes`, now `equipped`), and — the one that motivated the
> evaluation — query-time aggregation of a value from several independent
> sources, with the discipline that the aggregate is *never stored*, only
> computed at the point of use.
>
> The evaluation reframed the architecture as Clausewitz's three primitives —
> triggers (`DialogueRequirement`), effects (`StateCommand`/`EntryEffect`), and
> modifiers — of which the third was missing. Modifiers are deliberately
> **not** modelled as trigger-gated effects: an effect would require derived
> stat state in `PlayerState` plus a correct inverse on unequip, whereas
> query-time aggregation keeps the save file free of derived values.
>
> Stellaris supplies the skeleton (named keys, condition-gated sources,
> query-time aggregation); Path of Exile supplies the arithmetic
> (`(base + ΣFLAT) × (1 + ΣPERCENT)`, clamped at zero, rounded once).
> Stellaris' duration/decay model was rejected (the world clock is discrete
> shifts, not a continuous tick) and ARPG affix rolling was rejected
> (hand-authored content).
>
> Modifiers are applied **inside the command handler**, with the modifier key
> derived from command type and the sign of the amount (`CURRENCY_GAIN` vs.
> `CURRENCY_LOSS`), scaling the bronze-equivalent magnitude before the sign is
> reapplied — in bronze rather than the payload's own denomination, because
> rounding in a coarse unit destroys any percentage smaller than that unit.
> `applyModifiers` clamps its result at zero, so a modifier can reduce a value
> to nothing but never invert it; without that clamp a large negative `FLAT`
> would turn a loss into a gain. Targeting is exclusive: a modifier scoped to
> one faction never appears in an unscoped query, chosen because the opposite
> reading fails silently. Because the key is derived rather than authored,
> existing content JSON needs no changes. One limitation is accepted and
> documented rather than fixed: modifiers resolve as of the start of a
> dispatch, so an item granted and used within the same command batch does
> not modify that batch, and a `+5% currency` item cannot inflate a *cost*.
> An optional `modifierKey` payload override exists for the
> one case the sign rule can't distinguish — gambling payouts. Dice is exactly
> EV-neutral (18 of 36 outcomes are even), so a gain-only modifier makes it
> positive-EV and, per gap #9's uncapped repetition, an unbounded money press.
> A cooldown would bound the rate but not restore the invariant, so the two
> are orthogonal; the carve-out was chosen primarily to preserve §9's stated
> "transparent odds, legible at a glance" design intent, which an item
> silently shifting the odds would defeat.
>
> **Equipping was deliberately deferred**, not forgotten. The play-style goal
> that motivated it (items with differing bonus *shapes*, not just bigger
> numbers) is delivered by the modifier layer itself; equip slots are only the
> selection mechanism on top. Because every part of that work is additive —
> an optional `slot` field, a defaulted `PlayerState` key, a second branch in
> `collectActiveModifiers` — deferring costs a few JSON edits later, whereas
> building early would commit the save format to a shape no content had yet
> exercised. Revisit trigger: **the first time a second item competes for the
> same role.** Two gaps were logged for it: the duel's absent per-action
> resource, and the equip-slot spec itself.

---

## Reachability

`feature_rapier_duel.md`'s own Reachability section declared Duel
**deliberately unreachable** from a fresh save at the time it shipped — no
dev-console dispatch mechanism was ever built anywhere in this repo
(`ManagementDrawer.tsx`'s only dev tools are `resetProgress` and
`devSetWorldClock`), and that phase relied entirely on unit/component tests.
Since then, `content_a_debt_in_steel.md` gave Duel a real in-content trigger
(a dialogue-triggered duel), so it's reachable through normal play today.

For this phase, primary verification is unit/component test coverage
(`modifiers.test.ts`, `modifierResolution.test.ts`, extended `commands.test.ts`
and `duel.test.ts`, all passing — see the shipping commit's Definition of
Done output). Because none of the three motivating items has an in-content
acquisition path yet (no POI reward or dialogue grant wires them into the
world — out of scope for this phase), confirming the duel-damage wiring
against a real player-facing run needed a way to reach a state that owns
`item_duellists_rapier`.

**Correction made while actually performing this check**: the plan assumed
the store's existing `importSave` action would be the vehicle. It exists
(`playerStore.ts`) and is unit-tested, but has no UI entry point anywhere in
the app — no button, no file input, nothing wired to call it. So the actual
mechanism used was one level lower: seeding `localStorage`'s
`broadsheet_rapier_player_state` key directly (the same key/shape zustand's
`persist` middleware reads on load) with a hand-crafted `PlayerState` owning
`item_duellists_rapier` and sitting at `dialogue_the_offer`'s
`node_pre_duel` — then driving the real app in a headless browser
(Playwright) through "Begin the duel." into A Debt in Steel's real duel
trigger against Duro Vantry, Feint-then-Thrust, on both a with-item and a
baseline (no-item) run.

Result: the with-item run logged "Your Thrust lands for 18 energy" (15 base
+ 3 flat from the Duellist's Rapier, tooltip correctly showing "Damage
bonus: +3 from Duellist's Rapier"); the baseline run logged "Your Thrust
lands for 15 energy." Both runs logged the opponent's own Thrust against the
player unchanged at 15 in both cases — confirming `DUEL_DAMAGE_DEALT` only
affects damage flowing from the player to the opponent, per §2.9's stage-1
scope. Zero console errors in either run. This is a deliberate substitute
for stage 8's normal Reset-Progress standard, not that standard itself —
named explicitly here because reaching a state that owns an unacquirable
item requires it.
