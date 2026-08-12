import { describe, expect, it } from "vitest";
import { evaluateDialogueRequirement } from "../engine/utils/evaluator";
import { initialPlayerState } from "../engine/store/playerStore";
import type { PlayerState } from "../engine/types";

function makeState(overrides: Partial<PlayerState> = {}): PlayerState {
  return { ...initialPlayerState, ...overrides };
}

const NODE_ID = "node_engaged";
const DIALOGUE_ID = "dialogue_mara_venn";

describe("evaluateDialogueRequirement", () => {
  it("returns true when no requirement is given", () => {
    const state = makeState();
    expect(evaluateDialogueRequirement(state, undefined, NODE_ID, DIALOGUE_ID)).toBe(true);
  });

  describe("requiredClues", () => {
    it("true when every required clue is unlocked", () => {
      const state = makeState({ unlockedClues: ["clue_a", "clue_b"] });
      expect(
        evaluateDialogueRequirement(state, { requiredClues: ["clue_a", "clue_b"] }, NODE_ID, DIALOGUE_ID)
      ).toBe(true);
    });

    it("false when a required clue is missing", () => {
      const state = makeState({ unlockedClues: ["clue_a"] });
      expect(
        evaluateDialogueRequirement(state, { requiredClues: ["clue_a", "clue_b"] }, NODE_ID, DIALOGUE_ID)
      ).toBe(false);
    });

    it("true when requiredClues is an empty array", () => {
      const state = makeState();
      expect(evaluateDialogueRequirement(state, { requiredClues: [] }, NODE_ID, DIALOGUE_ID)).toBe(true);
    });
  });

  describe("minActorReputation", () => {
    it("true at exactly the threshold", () => {
      const state = makeState({ reputation: { factions: {}, actors: { actor_mara_venn: 10 } } });
      expect(
        evaluateDialogueRequirement(
          state,
          { minActorReputation: { actorId: "actor_mara_venn", value: 10 } },
          NODE_ID,
          DIALOGUE_ID
        )
      ).toBe(true);
    });

    it("false below the threshold", () => {
      const state = makeState({ reputation: { factions: {}, actors: { actor_mara_venn: 9 } } });
      expect(
        evaluateDialogueRequirement(
          state,
          { minActorReputation: { actorId: "actor_mara_venn", value: 10 } },
          NODE_ID,
          DIALOGUE_ID
        )
      ).toBe(false);
    });

    it("treats an absent actor's reputation as 0", () => {
      const state = makeState();
      expect(
        evaluateDialogueRequirement(
          state,
          { minActorReputation: { actorId: "actor_unknown", value: 1 } },
          NODE_ID,
          DIALOGUE_ID
        )
      ).toBe(false);
    });
  });

  describe("minFactionReputation", () => {
    it("true at exactly the threshold", () => {
      const state = makeState({ reputation: { factions: { faction_city_watch: 5 }, actors: {} } });
      expect(
        evaluateDialogueRequirement(
          state,
          { minFactionReputation: { factionId: "faction_city_watch", value: 5 } },
          NODE_ID,
          DIALOGUE_ID
        )
      ).toBe(true);
    });

    it("false below the threshold", () => {
      const state = makeState({ reputation: { factions: { faction_city_watch: 4 }, actors: {} } });
      expect(
        evaluateDialogueRequirement(
          state,
          { minFactionReputation: { factionId: "faction_city_watch", value: 5 } },
          NODE_ID,
          DIALOGUE_ID
        )
      ).toBe(false);
    });
  });

  describe("allowedShifts", () => {
    it("true when the current shift is a member", () => {
      const state = makeState({ worldClock: { shift: "EVENING", day: 1, season: "SPRING", weather: "CLEAR" } });
      expect(
        evaluateDialogueRequirement(state, { allowedShifts: ["EVENING", "NIGHT"] }, NODE_ID, DIALOGUE_ID)
      ).toBe(true);
    });

    it("false when the current shift is not a member", () => {
      const state = makeState({ worldClock: { shift: "MORNING", day: 1, season: "SPRING", weather: "CLEAR" } });
      expect(
        evaluateDialogueRequirement(state, { allowedShifts: ["EVENING", "NIGHT"] }, NODE_ID, DIALOGUE_ID)
      ).toBe(false);
    });
  });

  describe("nodeVisits", () => {
    it("omitted nodeId resolves against the current node", () => {
      const state = makeState({
        dialogueProgress: { [DIALOGUE_ID]: { currentNodeId: NODE_ID, visitCounts: { [NODE_ID]: 1 } } },
      });
      expect(evaluateDialogueRequirement(state, { nodeVisits: { max: 1 } }, NODE_ID, DIALOGUE_ID)).toBe(true);
    });

    it("explicit nodeId cross-references a different node's visit count", () => {
      const state = makeState({
        dialogueProgress: {
          [DIALOGUE_ID]: { currentNodeId: NODE_ID, visitCounts: { node_greeting: 2, [NODE_ID]: 1 } },
        },
      });
      expect(
        evaluateDialogueRequirement(
          state,
          { nodeVisits: { nodeId: "node_greeting", min: 2 } },
          NODE_ID,
          DIALOGUE_ID
        )
      ).toBe(true);
    });

    it("max: 1 is true on the first visit (already incremented before evaluation)", () => {
      const state = makeState({
        dialogueProgress: { [DIALOGUE_ID]: { currentNodeId: NODE_ID, visitCounts: { [NODE_ID]: 1 } } },
      });
      expect(evaluateDialogueRequirement(state, { nodeVisits: { max: 1 } }, NODE_ID, DIALOGUE_ID)).toBe(true);
    });

    it("max: 1 is false on the second visit", () => {
      const state = makeState({
        dialogueProgress: { [DIALOGUE_ID]: { currentNodeId: NODE_ID, visitCounts: { [NODE_ID]: 2 } } },
      });
      expect(evaluateDialogueRequirement(state, { nodeVisits: { max: 1 } }, NODE_ID, DIALOGUE_ID)).toBe(false);
    });

    it("min: 2 is false on the first visit", () => {
      const state = makeState({
        dialogueProgress: { [DIALOGUE_ID]: { currentNodeId: NODE_ID, visitCounts: { [NODE_ID]: 1 } } },
      });
      expect(evaluateDialogueRequirement(state, { nodeVisits: { min: 2 } }, NODE_ID, DIALOGUE_ID)).toBe(false);
    });

    it("min: 2 is true on the second visit", () => {
      const state = makeState({
        dialogueProgress: { [DIALOGUE_ID]: { currentNodeId: NODE_ID, visitCounts: { [NODE_ID]: 2 } } },
      });
      expect(evaluateDialogueRequirement(state, { nodeVisits: { min: 2 } }, NODE_ID, DIALOGUE_ID)).toBe(true);
    });

    it("treats a missing visit count as 0", () => {
      const state = makeState();
      expect(evaluateDialogueRequirement(state, { nodeVisits: { min: 1 } }, NODE_ID, DIALOGUE_ID)).toBe(false);
    });
  });
});
