import { describe, expect, it } from "vitest";
import { computeDistrictEntryEffects, computePoiEntryEffects } from "../engine/utils/entryEffects";
import type { PlayerState } from "../engine/types";

describe("computePoiEntryEffects", () => {
  const poi = {
    id: "poi_crooked_hour_tavern",
    onEnter: [{ type: "SOUND" as const, asset: "/content/assets/audio/tavern_entry.mp3" }],
  };
  const endeavorsById = {
    endeavor_the_missing_broadsheet: {
      id: "endeavor_the_missing_broadsheet",
      isUnlocked: true,
      initialPhaseId: "phase_ask_around",
      phases: {
        phase_ask_around: {
          onPoiEnter: {
            poiId: "poi_crooked_hour_tavern",
            onEnter: [{ type: "DIALOGUE" as const, dialogueId: "dialogue_mara_venn" }],
          },
        },
        phase_confront_the_buyer: {},
      },
    },
  };

  it("produces no effects when there's no onEnter and no matching trigger", () => {
    const bare = { id: "poi_crooked_hour_tavern", onEnter: [] };
    const effects = computePoiEntryEffects(bare, {}, {}, {});
    expect(effects).toEqual([]);
  });

  it("produces a SOUND effect when the POI has onEnter and there's no active endeavor", () => {
    const effects = computePoiEntryEffects(poi, {}, endeavorsById, {});
    expect(effects).toEqual([{ type: "SOUND", asset: "/content/assets/audio/tavern_entry.mp3" }]);
  });

  it("produces a DIALOGUE effect when the active phase's onPoiEnter targets this POI", () => {
    const noSound = { id: "poi_crooked_hour_tavern", onEnter: [] };
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
    };
    const effects = computePoiEntryEffects(noSound, activeEndeavors, endeavorsById, {});
    expect(effects).toEqual([{ type: "DIALOGUE", dialogueId: "dialogue_mara_venn" }]);
  });

  it("produces both a SOUND and a DIALOGUE effect together", () => {
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
    };
    const effects = computePoiEntryEffects(poi, activeEndeavors, endeavorsById, {});
    expect(effects).toEqual([
      { type: "SOUND", asset: "/content/assets/audio/tavern_entry.mp3" },
      { type: "DIALOGUE", dialogueId: "dialogue_mara_venn" },
    ]);
  });

  it("does not fire when the active phase's onPoiEnter targets a different POI", () => {
    const otherPoi = { id: "poi_somewhere_else", onEnter: [] };
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
    };
    const effects = computePoiEntryEffects(otherPoi, activeEndeavors, endeavorsById, {});
    expect(effects).toEqual([]);
  });

  it("does not fire when the active phase has no onPoiEnter at all", () => {
    const noSound = { id: "poi_crooked_hour_tavern", onEnter: [] };
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_confront_the_buyer", logHistory: [] },
    };
    const effects = computePoiEntryEffects(noSound, activeEndeavors, endeavorsById, {});
    expect(effects).toEqual([]);
  });

  describe("endeavor-level onPoiEnter (auto-start)", () => {
    const startPoi = { id: "poi_salt_quay_warehouse", onEnter: [] };
    const endeavorsWithStart = {
      endeavor_a_debt_in_steel: {
        id: "endeavor_a_debt_in_steel",
        isUnlocked: true,
        initialPhaseId: "phase_the_challenge",
        phases: {},
        onPoiEnter: {
          poiId: "poi_salt_quay_warehouse",
          onEnter: [{ type: "DIALOGUE" as const, dialogueId: "dialogue_anselm_draye" }],
        },
      },
    };

    it("fires START_ENDEAVOR + DIALOGUE for a not-yet-started, unlocked endeavor whose onPoiEnter.poiId matches", () => {
      const effects = computePoiEntryEffects(startPoi, {}, endeavorsWithStart, {});
      expect(effects).toEqual([
        { type: "START_ENDEAVOR", endeavorId: "endeavor_a_debt_in_steel", initialPhaseId: "phase_the_challenge" },
        { type: "DIALOGUE", dialogueId: "dialogue_anselm_draye" },
      ]);
    });

    it("does not fire for an endeavor already in activeEndeavors, at any phase", () => {
      const activeEndeavors: PlayerState["activeEndeavors"] = {
        endeavor_a_debt_in_steel: { currentPhaseId: "phase_the_challenge", logHistory: [] },
      };
      const effects = computePoiEntryEffects(startPoi, activeEndeavors, endeavorsWithStart, {});
      expect(effects).toEqual([]);
    });

    it("does not fire for an endeavor already in activeEndeavors even at its terminal (completed) phase", () => {
      const activeEndeavors: PlayerState["activeEndeavors"] = {
        endeavor_a_debt_in_steel: { currentPhaseId: "phase_some_terminal_phase", logHistory: ["phase_the_challenge"] },
      };
      const effects = computePoiEntryEffects(startPoi, activeEndeavors, endeavorsWithStart, {});
      expect(effects).toEqual([]);
    });

    it("does not fire when the endeavor is locked (static isUnlocked false, no matching unlockedNodes entry)", () => {
      const lockedEndeavors = {
        endeavor_a_debt_in_steel: { ...endeavorsWithStart.endeavor_a_debt_in_steel, isUnlocked: false },
      };
      const effects = computePoiEntryEffects(startPoi, {}, lockedEndeavors, {});
      expect(effects).toEqual([]);
    });

    it("fires once the locked endeavor becomes unlocked via unlockedNodes", () => {
      const lockedEndeavors = {
        endeavor_a_debt_in_steel: { ...endeavorsWithStart.endeavor_a_debt_in_steel, isUnlocked: false },
      };
      const effects = computePoiEntryEffects(startPoi, {}, lockedEndeavors, { endeavor_a_debt_in_steel: true });
      expect(effects).toEqual([
        { type: "START_ENDEAVOR", endeavorId: "endeavor_a_debt_in_steel", initialPhaseId: "phase_the_challenge" },
        { type: "DIALOGUE", dialogueId: "dialogue_anselm_draye" },
      ]);
    });

    it("does not fire when onPoiEnter targets a different POI", () => {
      const effects = computePoiEntryEffects({ id: "poi_somewhere_else", onEnter: [] }, {}, endeavorsWithStart, {});
      expect(effects).toEqual([]);
    });
  });
});

describe("computeDistrictEntryEffects", () => {
  it("produces a SOUND effect when onEnter is present", () => {
    const effects = computeDistrictEntryEffects({
      onEnter: [{ type: "SOUND", asset: "/content/assets/audio/ward_entry.mp3" }],
    });
    expect(effects).toEqual([{ type: "SOUND", asset: "/content/assets/audio/ward_entry.mp3" }]);
  });

  it("produces no effects when onEnter is empty", () => {
    const effects = computeDistrictEntryEffects({ onEnter: [] });
    expect(effects).toEqual([]);
  });
});
