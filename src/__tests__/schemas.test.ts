import { describe, expect, it } from "vitest";
import { SettlementSchema } from "../content/schemas/settlement.schema";
import { DistrictSchema } from "../content/schemas/district.schema";
import { PoiSchema } from "../content/schemas/poi.schema";
import { ActorSchema } from "../content/schemas/actor.schema";
import { FactionSchema } from "../content/schemas/faction.schema";
import { EndeavorSchema } from "../content/schemas/endeavor.schema";
import { DialogueSchema } from "../content/schemas/dialogue.schema";
import { ItemSchema } from "../content/schemas/item.schema";

import validSettlement from "../content/settlements/settlement_valdeombra_city.json";
import validDistrict from "../content/districts/district_lantern_ward.json";
import validPoi from "../content/pois/poi_crooked_hour_tavern.json";
import validActor from "../content/actors/actor_mara_venn.json";
import validFaction from "../content/factions/faction_city_watch.json";
import validEndeavor from "../content/endeavors/endeavor_the_missing_broadsheet.json";
import validDialogue from "../content/dialogues/dialogue_mara_venn.json";
import validItem from "../content/items/item_rapier.json";

describe("SettlementSchema", () => {
  it("accepts the starter settlement fixture", () => {
    expect(SettlementSchema.safeParse(validSettlement).success).toBe(true);
  });

  it("rejects a settlement missing districtIds", () => {
    const invalid: Record<string, unknown> = { ...validSettlement };
    delete invalid.districtIds;
    expect(SettlementSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("DistrictSchema", () => {
  it("accepts the starter district fixture", () => {
    expect(DistrictSchema.safeParse(validDistrict).success).toBe(true);
  });

  it("rejects a district with a non-boolean isUnlocked", () => {
    const invalid = { ...validDistrict, isUnlocked: "yes" };
    expect(DistrictSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts a district without entrySoundAsset", () => {
    const withoutSound: Record<string, unknown> = { ...validDistrict };
    delete withoutSound.entrySoundAsset;
    expect(DistrictSchema.safeParse(withoutSound).success).toBe(true);
  });

  it("accepts a district with entrySoundAsset", () => {
    const withSound = { ...validDistrict, entrySoundAsset: "/content/assets/audio/lantern_ward_entry.mp3" };
    expect(DistrictSchema.safeParse(withSound).success).toBe(true);
  });
});

describe("PoiSchema", () => {
  it("accepts the starter poi fixture", () => {
    expect(PoiSchema.safeParse(validPoi).success).toBe(true);
  });

  it("rejects a poi with an invalid Shift value", () => {
    const invalid = { ...validPoi, availableShifts: ["EVENING", "MIDNIGHT"] };
    expect(PoiSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts a poi without entrySoundAsset", () => {
    const withoutSound: Record<string, unknown> = { ...validPoi };
    delete withoutSound.entrySoundAsset;
    expect(PoiSchema.safeParse(withoutSound).success).toBe(true);
  });

  it("accepts a poi with entrySoundAsset", () => {
    const withSound = { ...validPoi, entrySoundAsset: "/content/assets/audio/crooked_hour_tavern_entry.mp3" };
    expect(PoiSchema.safeParse(withSound).success).toBe(true);
  });
});

describe("ActorSchema", () => {
  it("accepts the starter actor fixture", () => {
    expect(ActorSchema.safeParse(validActor).success).toBe(true);
  });

  it("rejects an actor missing dialogueId", () => {
    const invalid: Record<string, unknown> = { ...validActor };
    delete invalid.dialogueId;
    expect(ActorSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("FactionSchema", () => {
  it("accepts the starter faction fixture", () => {
    expect(FactionSchema.safeParse(validFaction).success).toBe(true);
  });

  it("rejects a faction missing description", () => {
    const invalid: Record<string, unknown> = { ...validFaction };
    delete invalid.description;
    expect(FactionSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("EndeavorSchema", () => {
  it("accepts the starter endeavor fixture", () => {
    expect(EndeavorSchema.safeParse(validEndeavor).success).toBe(true);
  });

  it("rejects an endeavor phase missing unlocksNodesOnComplete", () => {
    const invalid = {
      ...validEndeavor,
      phases: {
        phase_ask_around: {
          id: "phase_ask_around",
          objectiveText: "Ask around.",
        },
      },
    };
    expect(EndeavorSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts a phase with autoDialogueOnEnter", () => {
    const withTrigger = {
      ...validEndeavor,
      phases: {
        ...validEndeavor.phases,
        phase_ask_around: {
          ...validEndeavor.phases.phase_ask_around,
          autoDialogueOnEnter: { poiId: "poi_crooked_hour_tavern", dialogueId: "dialogue_mara_venn" },
        },
      },
    };
    expect(EndeavorSchema.safeParse(withTrigger).success).toBe(true);
  });

  it("rejects an autoDialogueOnEnter with an unexpected extra key (.strict())", () => {
    const invalid = {
      ...validEndeavor,
      phases: {
        ...validEndeavor.phases,
        phase_ask_around: {
          ...validEndeavor.phases.phase_ask_around,
          autoDialogueOnEnter: {
            poiId: "poi_crooked_hour_tavern",
            dialogueId: "dialogue_mara_venn",
            unexpectedKey: true,
          },
        },
      },
    };
    expect(EndeavorSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("DialogueSchema", () => {
  it("accepts the starter dialogue fixture", () => {
    expect(DialogueSchema.safeParse(validDialogue).success).toBe(true);
  });

  it("rejects a dialogue missing startNodeId", () => {
    const invalid: Record<string, unknown> = { ...validDialogue };
    delete invalid.startNodeId;
    expect(DialogueSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a choice command with an unknown command type", () => {
    const invalid = {
      ...validDialogue,
      nodes: {
        ...validDialogue.nodes,
        node_greeting: {
          ...validDialogue.nodes.node_greeting,
          choices: [
            {
              id: "choice_bad",
              text: "bad",
              commands: [{ type: "COMMAND_DOES_NOT_EXIST", payload: {} }],
            },
          ],
        },
      },
    };
    expect(DialogueSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a command payload with an unexpected extra key (.strict())", () => {
    const invalid = {
      ...validDialogue,
      nodes: {
        ...validDialogue.nodes,
        node_greeting: {
          ...validDialogue.nodes.node_greeting,
          choices: [
            {
              id: "choice_bad",
              text: "bad",
              commands: [{ type: "COMMAND_ADVANCE_SHIFT", payload: { unexpectedKey: true } }],
            },
          ],
        },
      },
    };
    expect(DialogueSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("ItemSchema", () => {
  it("accepts the starter item fixture", () => {
    expect(ItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("rejects an item missing imageAsset (required here, unlike the base schema)", () => {
    const invalid: Record<string, unknown> = { ...validItem };
    delete invalid.imageAsset;
    expect(ItemSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an item missing stackable", () => {
    const invalid: Record<string, unknown> = { ...validItem };
    delete invalid.stackable;
    expect(ItemSchema.safeParse(invalid).success).toBe(false);
  });
});
