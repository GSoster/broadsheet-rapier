/**
 * src/__tests__/modifiers.test.ts
 *
 * Executable form of `docs/features/feature_modifier_system.md` §2.4 and §2.7.
 * Written before `src/engine/modifiers.ts` exists — it will fail to compile
 * until that module lands at stage 1, then pass once the implementation
 * matches the decisions recorded in the spec.
 *
 * Deliberately asserts no balance numbers. Every constant here is a test
 * fixture, not a game value (§2.10, "What not to test").
 */

import { describe, expect, it } from "vitest";

import {
  applyModifiers,
  selectModifiers,
  type Modifier,
} from "../engine/modifiers";

/**
 * Builds a Modifier with the provenance fields defaulted, so each case shows
 * only the fields under test. `sourceId`/`sourceLabel` exist for tooltips
 * (§2.4) and never affect matching or arithmetic.
 */
function mod(
  fields: Pick<Modifier, "key" | "op" | "value"> & Partial<Modifier>,
): Modifier {
  return {
    sourceId: "item_test_fixture",
    sourceLabel: "Test Fixture",
    ...fields,
  };
}

describe("selectModifiers — the targeting rule", () => {
  // §2.4: "A modifier matches a query when the query's target is at least as
  // specific as the modifier's."

  const untargeted = mod({
    key: "REPUTATION_GAIN",
    op: "PERCENT",
    value: 0.1,
    sourceId: "item_generic_charm",
  });

  const targetedAtWatch = mod({
    key: "REPUTATION_GAIN",
    op: "PERCENT",
    value: 0.25,
    targetId: "faction_city_watch",
    sourceId: "item_letter_of_introduction",
  });

  const set: Modifier[] = [untargeted, targetedAtWatch];

  it("returns an untargeted modifier for an untargeted query", () => {
    expect(selectModifiers([untargeted], "REPUTATION_GAIN")).toEqual([
      untargeted,
    ]);
  });

  it("applies an untargeted modifier to a targeted query", () => {
    // A general bonus covers every specific case.
    expect(
      selectModifiers([untargeted], "REPUTATION_GAIN", "faction_city_watch"),
    ).toEqual([untargeted]);
  });

  it("matches a targeted modifier against its own target", () => {
    expect(
      selectModifiers(
        [targetedAtWatch],
        "REPUTATION_GAIN",
        "faction_city_watch",
      ),
    ).toEqual([targetedAtWatch]);
  });

  it("does not match a targeted modifier against a different target", () => {
    expect(
      selectModifiers([targetedAtWatch], "REPUTATION_GAIN", "faction_thieves"),
    ).toEqual([]);
  });

  it("EXCLUDES a targeted modifier from an untargeted query", () => {
    // The decided row of §2.4's table. A specific modifier does not leak into
    // a general query. Chosen because the opposite reading fails silently:
    // a call site that forgot its targetId would apply the City Watch
    // letter's bonus to every faction, with nothing raising an error.
    expect(selectModifiers([targetedAtWatch], "REPUTATION_GAIN")).toEqual([]);
  });

  it("returns only the untargeted modifier from a mixed set, untargeted query", () => {
    expect(selectModifiers(set, "REPUTATION_GAIN")).toEqual([untargeted]);
  });

  it("returns both from a mixed set when the query names the target", () => {
    expect(
      selectModifiers(set, "REPUTATION_GAIN", "faction_city_watch"),
    ).toEqual([untargeted, targetedAtWatch]);
  });

  it("never returns modifiers belonging to another key", () => {
    const otherKey = mod({
      key: "CURRENCY_GAIN",
      op: "PERCENT",
      value: 0.5,
    });
    expect(selectModifiers([...set, otherKey], "REPUTATION_GAIN")).toEqual([
      untargeted,
    ]);
  });
});

describe("applyModifiers — arithmetic", () => {
  // §2.7: max(0, round((base + ΣFLAT) × (1 + ΣPERCENT)))

  it("returns the base unchanged for an empty set", () => {
    // The inertness guarantee (§2.10). Every existing test in the suite
    // depends on this identity holding.
    expect(applyModifiers(10, [], "DUEL_DAMAGE_DEALT")).toBe(10);
  });

  it("returns the base unchanged when no modifier matches the key", () => {
    const other = mod({ key: "CURRENCY_GAIN", op: "FLAT", value: 99 });
    expect(applyModifiers(10, [other], "DUEL_DAMAGE_DEALT")).toBe(10);
  });

  it("adds a positive FLAT modifier", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 2 });
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(12);
  });

  it("subtracts a negative FLAT modifier", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: -3 });
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(7);
  });

  it("applies a positive PERCENT modifier", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.5 });
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(15);
  });

  it("applies a negative PERCENT modifier", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: -0.5 });
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(5);
  });

  it("sums multiple FLAT modifiers", () => {
    const a = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 2 });
    const b = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 3 });
    expect(applyModifiers(10, [a, b], "DUEL_DAMAGE_DEALT")).toBe(15);
  });

  it("sums PERCENT modifiers additively, not multiplicatively", () => {
    // §2.7: the deliberate omission of PoE's multiplicative "more" tier.
    // 10 × (1 + 0.2 + 0.2) = 14, NOT 10 × 1.2 × 1.2 = 14.4.
    const a = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.2 });
    const b = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.2 });
    expect(applyModifiers(10, [a, b], "DUEL_DAMAGE_DEALT")).toBe(14);
  });

  it("applies FLAT before PERCENT", () => {
    // (10 + 2) × 1.5 = 18, not 10 × 1.5 + 2 = 17.
    const flat = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 2 });
    const pct = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.5 });
    expect(applyModifiers(10, [flat, pct], "DUEL_DAMAGE_DEALT")).toBe(18);
  });

  it("respects targeting", () => {
    const m = mod({
      key: "REPUTATION_GAIN",
      op: "PERCENT",
      value: 1,
      targetId: "faction_city_watch",
    });
    expect(
      applyModifiers(5, [m], "REPUTATION_GAIN", "faction_city_watch"),
    ).toBe(10);
    expect(applyModifiers(5, [m], "REPUTATION_GAIN", "faction_thieves")).toBe(
      5,
    );
    expect(applyModifiers(5, [m], "REPUTATION_GAIN")).toBe(5);
  });
});

describe("applyModifiers — order independence", () => {
  it("produces the same result regardless of set order", () => {
    // ModifierSet is a list, but the arithmetic must be order-free.
    // A future refactor (short-circuiting, early return, in-place reduce)
    // could silently break this.
    const a = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: 3 });
    const b = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.25 });
    const c = mod({ key: "DUEL_DAMAGE_DEALT", op: "FLAT", value: -1 });

    const forward = applyModifiers(10, [a, b, c], "DUEL_DAMAGE_DEALT");
    const shuffled = applyModifiers(10, [c, a, b], "DUEL_DAMAGE_DEALT");
    const reversed = applyModifiers(10, [c, b, a], "DUEL_DAMAGE_DEALT");

    expect(shuffled).toBe(forward);
    expect(reversed).toBe(forward);
  });
});

describe("applyModifiers — the zero clamp", () => {
  // §2.7: "a modifier can reduce a value to nothing; it can never invert it."
  // Two independent paths reach a negative, and both must clamp.

  it("clamps when PERCENT modifiers sum below −100%", () => {
    const a = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: -0.6 });
    const b = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: -0.6 });
    // 10 × (1 − 1.2) = −2 without the clamp.
    expect(applyModifiers(10, [a, b], "DUEL_DAMAGE_DEALT")).toBe(0);
  });

  it("clamps when ΣFLAT exceeds the base", () => {
    // The path an earlier revision of the spec missed. This is the dangerous
    // one: §2.8 feeds applyModifiers a magnitude and reapplies the sign
    // afterwards, so a negative return would flip a currency LOSS into a GAIN.
    const m = mod({ key: "CURRENCY_LOSS", op: "FLAT", value: -15 });
    expect(applyModifiers(10, [m], "CURRENCY_LOSS")).toBe(0);
  });

  it("clamps when FLAT and PERCENT combine into a negative", () => {
    const flat = mod({ key: "CURRENCY_LOSS", op: "FLAT", value: -12 });
    const pct = mod({ key: "CURRENCY_LOSS", op: "PERCENT", value: 0.5 });
    // (10 − 12) × 1.5 = −3 without the clamp.
    expect(applyModifiers(10, [flat, pct], "CURRENCY_LOSS")).toBe(0);
  });

  it("reduces to exactly zero without going negative", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: -1 });
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(0);
  });
});

describe("applyModifiers — rounding", () => {
  // §3.2: Math.round, applied once at the end, never per-step.

  it("rounds a half up", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.25 });
    // 10 × 1.25 = 12.5 → 13
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(13);
  });

  it("rounds a half up when reducing too", () => {
    const m = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: -0.25 });
    // 10 × 0.75 = 7.5 → 8
    expect(applyModifiers(10, [m], "DUEL_DAMAGE_DEALT")).toBe(8);
  });

  it("rounds once at the end, not per modifier", () => {
    // Three +10% modifiers: 10 × 1.3 = 13 exactly.
    // Rounding per-step would give 11 → 12.1 → 12 → 13.2 → 13, which happens
    // to agree here; the assertion that matters is the fractional case below.
    const a = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.1 });
    const b = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.1 });
    const c = mod({ key: "DUEL_DAMAGE_DEALT", op: "PERCENT", value: 0.15 });
    // 10 × 1.35 = 13.5 → 14. Per-step rounding would drift off this.
    expect(applyModifiers(10, [a, b, c], "DUEL_DAMAGE_DEALT")).toBe(14);
  });

  it("preserves a small percentage on a large base", () => {
    // The reason §2.8 converts currency to bronze before modifying:
    // +5% of 60 bronze is a real 3 bronze, where +5% of 3 silver would
    // round away to nothing.
    const m = mod({ key: "CURRENCY_GAIN", op: "PERCENT", value: 0.05 });
    expect(applyModifiers(60, [m], "CURRENCY_GAIN")).toBe(63);
  });

  it("rounds a small percentage on a small base away to nothing", () => {
    // Documented consequence, not a defect — asserted so a future change to
    // the rounding policy (§3.2) surfaces here rather than in balance.
    const m = mod({ key: "CURRENCY_GAIN", op: "PERCENT", value: 0.05 });
    expect(applyModifiers(3, [m], "CURRENCY_GAIN")).toBe(3);
  });
});

describe("applyModifiers — a zero base", () => {
  it("leaves a zero base at zero under PERCENT", () => {
    const m = mod({ key: "CURRENCY_GAIN", op: "PERCENT", value: 0.5 });
    expect(applyModifiers(0, [m], "CURRENCY_GAIN")).toBe(0);
  });

  it("does add a FLAT modifier to a zero base", () => {
    // applyModifiers itself has no opinion about zero. The guarantee that a
    // no-op currency adjustment stays a no-op lives at the call site, where
    // Math.sign(0) === 0 zeroes the result (§2.8). Asserted here so the
    // division of responsibility is explicit rather than assumed.
    const m = mod({ key: "CURRENCY_GAIN", op: "FLAT", value: 5 });
    expect(applyModifiers(0, [m], "CURRENCY_GAIN")).toBe(5);
  });
});
