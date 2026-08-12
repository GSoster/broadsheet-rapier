import { describe, expect, it } from "vitest";
import {
  chooseOpponentAction,
  DIRTY_TRICK_DAMAGE,
  DIRTY_TRICK_POISE_DRAIN,
  evaluateDuelTurn,
  FEINT_POISE_DRAIN,
  GUARD_BREAK_BONUS_DAMAGE,
  OPPONENT_HEALTHY_ENERGY_THRESHOLD,
  OPPONENT_LOW_POISE_THRESHOLD,
  RIPOSTE_COUNTER_DAMAGE,
  TAUNT_POISE_DRAIN_BASE,
  TAUNT_POISE_DRAIN_REPUTATION_BONUS,
  TAUNT_REPUTATION_THRESHOLD,
  THRUST_DAMAGE,
  type DuelContext,
} from "../engine/minigames/duel";

function makeContext(overrides: Partial<DuelContext> = {}): DuelContext {
  return {
    player: { energy: 100, poise: 100 },
    opponent: { energy: 100, poise: 100 },
    distance: "IN_MEASURE",
    lastPlayerAction: null,
    playerReputation: { factions: {}, actors: {} },
    ...overrides,
  };
}

describe("evaluateDuelTurn — distance legality", () => {
  it("Thrust fizzles when not in measure", () => {
    const context = makeContext({ distance: "OUT_OF_MEASURE" });
    const result = evaluateDuelTurn(context, "THRUST", "FEINT");
    expect(result.opponent.energy).toBe(100);
  });

  it("Dirty Trick fizzles when not at close quarters", () => {
    const context = makeContext({ distance: "IN_MEASURE" });
    const result = evaluateDuelTurn(context, "DIRTY_TRICK", "FEINT");
    expect(result.opponent.energy).toBe(100);
    expect(result.opponent.poise).toBe(100);
  });

  it("Dirty Trick lands when at close quarters", () => {
    const context = makeContext({ distance: "CLOSE_QUARTERS" });
    const result = evaluateDuelTurn(context, "DIRTY_TRICK", "FEINT");
    expect(result.opponent.energy).toBe(100 - DIRTY_TRICK_DAMAGE);
    // Opponent's own Feint drains the *player's* poise, not its own — only
    // the player's Dirty Trick drains the opponent's poise this turn.
    expect(result.opponent.poise).toBe(100 - DIRTY_TRICK_POISE_DRAIN);
    expect(result.player.poise).toBe(100 - FEINT_POISE_DRAIN);
  });
});

describe("evaluateDuelTurn — parry interactions", () => {
  it("mutual thrust: both take damage", () => {
    const context = makeContext();
    const result = evaluateDuelTurn(context, "THRUST", "THRUST");
    expect(result.player.energy).toBe(100 - THRUST_DAMAGE);
    expect(result.opponent.energy).toBe(100 - THRUST_DAMAGE);
  });

  it("mutual parry: nothing happens", () => {
    const context = makeContext();
    const result = evaluateDuelTurn(context, "PARRY_RIPOSTE", "PARRY_RIPOSTE");
    expect(result.player.energy).toBe(100);
    expect(result.opponent.energy).toBe(100);
  });

  it("player thrusts, opponent parries: only the opponent's riposte lands", () => {
    const context = makeContext();
    const result = evaluateDuelTurn(context, "THRUST", "PARRY_RIPOSTE");
    expect(result.player.energy).toBe(100 - RIPOSTE_COUNTER_DAMAGE);
    expect(result.opponent.energy).toBe(100);
  });

  it("opponent thrusts, player parries: only the player's riposte lands", () => {
    const context = makeContext();
    const result = evaluateDuelTurn(context, "PARRY_RIPOSTE", "THRUST");
    expect(result.opponent.energy).toBe(100 - RIPOSTE_COUNTER_DAMAGE);
    expect(result.player.energy).toBe(100);
  });
});

describe("evaluateDuelTurn — Feint", () => {
  it("drains the opponent's poise and closes distance one step", () => {
    const context = makeContext({ distance: "OUT_OF_MEASURE" });
    const result = evaluateDuelTurn(context, "FEINT", "PARRY_RIPOSTE");
    expect(result.opponent.poise).toBe(100 - FEINT_POISE_DRAIN);
    expect(result.distance).toBe("IN_MEASURE");
  });

  it("stays at close quarters when already there", () => {
    const context = makeContext({ distance: "CLOSE_QUARTERS" });
    const result = evaluateDuelTurn(context, "FEINT", "PARRY_RIPOSTE");
    expect(result.distance).toBe("CLOSE_QUARTERS");
  });

  it("mutual Feint shifts distance only once (idempotent)", () => {
    const context = makeContext({ distance: "OUT_OF_MEASURE" });
    const result = evaluateDuelTurn(context, "FEINT", "FEINT");
    expect(result.distance).toBe("IN_MEASURE");
    expect(result.player.poise).toBe(100 - FEINT_POISE_DRAIN);
    expect(result.opponent.poise).toBe(100 - FEINT_POISE_DRAIN);
  });
});

describe("evaluateDuelTurn — Taunt", () => {
  it("drains only the base amount below the reputation threshold", () => {
    const context = makeContext({
      playerReputation: { factions: { faction_wagering_ring: TAUNT_REPUTATION_THRESHOLD - 1 }, actors: {} },
    });
    const result = evaluateDuelTurn(context, "TAUNT", "PARRY_RIPOSTE");
    expect(result.opponent.poise).toBe(100 - TAUNT_POISE_DRAIN_BASE);
  });

  it("drains the bonus amount at the reputation threshold", () => {
    const context = makeContext({
      playerReputation: { factions: { faction_wagering_ring: TAUNT_REPUTATION_THRESHOLD }, actors: {} },
    });
    const result = evaluateDuelTurn(context, "TAUNT", "PARRY_RIPOSTE");
    expect(result.opponent.poise).toBe(100 - TAUNT_POISE_DRAIN_BASE - TAUNT_POISE_DRAIN_REPUTATION_BONUS);
  });

  it("drains the bonus amount above the reputation threshold", () => {
    const context = makeContext({
      playerReputation: { factions: { faction_wagering_ring: TAUNT_REPUTATION_THRESHOLD + 50 }, actors: {} },
    });
    const result = evaluateDuelTurn(context, "TAUNT", "PARRY_RIPOSTE");
    expect(result.opponent.poise).toBe(100 - TAUNT_POISE_DRAIN_BASE - TAUNT_POISE_DRAIN_REPUTATION_BONUS);
  });

  it("defaults to below-threshold behavior when the faction reputation is unset", () => {
    const context = makeContext();
    const result = evaluateDuelTurn(context, "TAUNT", "PARRY_RIPOSTE");
    expect(result.opponent.poise).toBe(100 - TAUNT_POISE_DRAIN_BASE);
  });
});

describe("evaluateDuelTurn — guard break", () => {
  it("adds bonus damage when the defender's poise is already 0 at the start of the turn", () => {
    const context = makeContext({ opponent: { energy: 100, poise: 0 } });
    const result = evaluateDuelTurn(context, "THRUST", "FEINT");
    expect(result.opponent.energy).toBe(100 - THRUST_DAMAGE - GUARD_BREAK_BONUS_DAMAGE);
  });

  it("does not apply retroactively when this same turn's Dirty Trick is what drops poise to 0", () => {
    const context = makeContext({ distance: "CLOSE_QUARTERS", opponent: { energy: 100, poise: DIRTY_TRICK_POISE_DRAIN } });
    const result = evaluateDuelTurn(context, "DIRTY_TRICK", "FEINT");
    expect(result.opponent.poise).toBe(0);
    expect(result.opponent.energy).toBe(100 - DIRTY_TRICK_DAMAGE);
  });

  it("never applies to riposte counter-damage", () => {
    const context = makeContext({ player: { energy: 100, poise: 0 } });
    const result = evaluateDuelTurn(context, "PARRY_RIPOSTE", "THRUST");
    expect(result.opponent.energy).toBe(100 - RIPOSTE_COUNTER_DAMAGE);
  });
});

describe("evaluateDuelTurn — outcome", () => {
  it("is ONGOING while both combatants have energy", () => {
    const context = makeContext();
    const result = evaluateDuelTurn(context, "PARRY_RIPOSTE", "PARRY_RIPOSTE");
    expect(result.outcome).toBe("ONGOING");
  });

  it("is PLAYER_VICTORY when the opponent's energy reaches 0", () => {
    const context = makeContext({ opponent: { energy: THRUST_DAMAGE, poise: 100 } });
    const result = evaluateDuelTurn(context, "THRUST", "FEINT");
    expect(result.opponent.energy).toBe(0);
    expect(result.outcome).toBe("PLAYER_VICTORY");
  });

  it("is PLAYER_DEFEAT when the player's energy reaches 0", () => {
    const context = makeContext({ player: { energy: THRUST_DAMAGE, poise: 100 } });
    const result = evaluateDuelTurn(context, "FEINT", "THRUST");
    expect(result.player.energy).toBe(0);
    expect(result.outcome).toBe("PLAYER_DEFEAT");
  });

  it("resolves a simultaneous mutual knockout as PLAYER_DEFEAT (arbitrary tie-break)", () => {
    const context = makeContext({
      player: { energy: THRUST_DAMAGE, poise: 100 },
      opponent: { energy: THRUST_DAMAGE, poise: 100 },
    });
    const result = evaluateDuelTurn(context, "THRUST", "THRUST");
    expect(result.player.energy).toBe(0);
    expect(result.opponent.energy).toBe(0);
    expect(result.outcome).toBe("PLAYER_DEFEAT");
  });

  it("energy never clamps below 0", () => {
    const context = makeContext({ opponent: { energy: 1, poise: 100 } });
    const result = evaluateDuelTurn(context, "THRUST", "FEINT");
    expect(result.opponent.energy).toBe(0);
  });
});

describe("chooseOpponentAction", () => {
  it("Feints when own poise is at or below the low-poise threshold", () => {
    const context = makeContext({ opponent: { energy: 100, poise: OPPONENT_LOW_POISE_THRESHOLD } });
    expect(chooseOpponentAction(context)).toBe("FEINT");
  });

  it("Parries after the player's last action was aggressive (Thrust)", () => {
    const context = makeContext({
      opponent: { energy: 100, poise: 100 },
      lastPlayerAction: "THRUST",
    });
    expect(chooseOpponentAction(context)).toBe("PARRY_RIPOSTE");
  });

  it("Parries after the player's last action was aggressive (Dirty Trick)", () => {
    const context = makeContext({
      opponent: { energy: 100, poise: 100 },
      lastPlayerAction: "DIRTY_TRICK",
    });
    expect(chooseOpponentAction(context)).toBe("PARRY_RIPOSTE");
  });

  it("Thrusts when healthy and in measure", () => {
    const context = makeContext({
      distance: "IN_MEASURE",
      opponent: { energy: OPPONENT_HEALTHY_ENERGY_THRESHOLD + 1, poise: 100 },
    });
    expect(chooseOpponentAction(context)).toBe("THRUST");
  });

  it("uses Dirty Trick when healthy and at close quarters", () => {
    const context = makeContext({
      distance: "CLOSE_QUARTERS",
      opponent: { energy: OPPONENT_HEALTHY_ENERGY_THRESHOLD + 1, poise: 100 },
    });
    expect(chooseOpponentAction(context)).toBe("DIRTY_TRICK");
  });

  it("Feints to close distance when out of measure", () => {
    const context = makeContext({
      distance: "OUT_OF_MEASURE",
      opponent: { energy: OPPONENT_HEALTHY_ENERGY_THRESHOLD + 1, poise: 100 },
    });
    expect(chooseOpponentAction(context)).toBe("FEINT");
  });

  it("falls back to an injected-random tie-break when unhealthy but in range", () => {
    const context = makeContext({
      distance: "IN_MEASURE",
      opponent: { energy: OPPONENT_HEALTHY_ENERGY_THRESHOLD, poise: 100 },
    });
    expect(chooseOpponentAction(context, () => 0)).toBe("FEINT");
    expect(chooseOpponentAction(context, () => 0.99)).toBe("PARRY_RIPOSTE");
  });

  it("never returns TAUNT across a spread of contexts and random values", () => {
    const distances: Array<DuelContext["distance"]> = ["OUT_OF_MEASURE", "IN_MEASURE", "CLOSE_QUARTERS"];
    const energies = [0, 20, 40, 60, 100];
    const poises = [0, 20, 30, 60, 100];
    const randoms = [0, 0.25, 0.5, 0.75, 0.99];
    for (const distance of distances) {
      for (const energy of energies) {
        for (const poise of poises) {
          for (const r of randoms) {
            const context = makeContext({ distance, opponent: { energy, poise } });
            expect(chooseOpponentAction(context, () => r)).not.toBe("TAUNT");
          }
        }
      }
    }
  });
});
