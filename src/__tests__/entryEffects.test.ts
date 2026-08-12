import { describe, expect, it } from "vitest";
import { computeDistrictEntryEffects, computePoiEntryEffects } from "../engine/utils/entryEffects";
import type { PlayerState } from "../engine/types";

describe("computePoiEntryEffects", () => {
  const poi = { id: "poi_crooked_hour_tavern", entrySoundAsset: "/content/assets/audio/tavern_entry.mp3" };
  const endeavorsById = {
    endeavor_the_missing_broadsheet: {
      phases: {
        phase_ask_around: {
          autoDialogueOnEnter: { poiId: "poi_crooked_hour_tavern", dialogueId: "dialogue_mara_venn" },
        },
        phase_confront_the_buyer: {},
      },
    },
  };

  it("produces no effects when neither entrySoundAsset nor a matching trigger exists", () => {
    const bare = { id: "poi_crooked_hour_tavern" };
    const effects = computePoiEntryEffects(bare, {}, {});
    expect(effects).toEqual([]);
  });

  it("produces a SOUND effect when the POI has entrySoundAsset and there's no active endeavor", () => {
    const effects = computePoiEntryEffects(poi, {}, endeavorsById);
    expect(effects).toEqual([{ type: "SOUND", asset: "/content/assets/audio/tavern_entry.mp3" }]);
  });

  it("produces a DIALOGUE effect when the active phase's autoDialogueOnEnter targets this POI", () => {
    const noSound = { id: "poi_crooked_hour_tavern" };
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
    };
    const effects = computePoiEntryEffects(noSound, activeEndeavors, endeavorsById);
    expect(effects).toEqual([{ type: "DIALOGUE", dialogueId: "dialogue_mara_venn", nodeId: undefined }]);
  });

  it("produces both a SOUND and a DIALOGUE effect together", () => {
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
    };
    const effects = computePoiEntryEffects(poi, activeEndeavors, endeavorsById);
    expect(effects).toEqual([
      { type: "SOUND", asset: "/content/assets/audio/tavern_entry.mp3" },
      { type: "DIALOGUE", dialogueId: "dialogue_mara_venn", nodeId: undefined },
    ]);
  });

  it("does not fire when the active phase's autoDialogueOnEnter targets a different POI", () => {
    const otherPoi = { id: "poi_somewhere_else" };
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_ask_around", logHistory: [] },
    };
    const effects = computePoiEntryEffects(otherPoi, activeEndeavors, endeavorsById);
    expect(effects).toEqual([]);
  });

  it("does not fire when the active phase has no autoDialogueOnEnter at all", () => {
    const noSound = { id: "poi_crooked_hour_tavern" };
    const activeEndeavors: PlayerState["activeEndeavors"] = {
      endeavor_the_missing_broadsheet: { currentPhaseId: "phase_confront_the_buyer", logHistory: [] },
    };
    const effects = computePoiEntryEffects(noSound, activeEndeavors, endeavorsById);
    expect(effects).toEqual([]);
  });
});

describe("computeDistrictEntryEffects", () => {
  it("produces a SOUND effect when entrySoundAsset is present", () => {
    const effects = computeDistrictEntryEffects({ entrySoundAsset: "/content/assets/audio/ward_entry.mp3" });
    expect(effects).toEqual([{ type: "SOUND", asset: "/content/assets/audio/ward_entry.mp3" }]);
  });

  it("produces no effects when entrySoundAsset is absent", () => {
    const effects = computeDistrictEntryEffects({});
    expect(effects).toEqual([]);
  });
});
