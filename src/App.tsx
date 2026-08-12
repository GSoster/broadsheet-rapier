import { useEffect, useState } from "react";
import { usePlayerStore } from "./engine/store/playerStore";
import { currenciesToBronzeEquivalent } from "./engine/store/commands";
import { clampWager } from "./engine/minigames/dice";
import { playSound } from "./engine/audio/playSound";
import { WorldClockHud } from "./engine/components/WorldClockHud";
import { WorldNavigationView } from "./engine/components/WorldNavigationView";
import { NodeInteractionCanvas, type NodeInteractionAction } from "./engine/components/NodeInteractionCanvas";
import { ManagementDrawer } from "./engine/components/ManagementDrawer";
import { MinigameOverlay } from "./engine/components/MinigameOverlay";
import { DialogueOverlay } from "./engine/components/DialogueOverlay";

import settlementRaw from "./content/settlements/settlement_valdeombra_city.json";
import districtRaw from "./content/districts/district_lantern_ward.json";
import poiRaw from "./content/pois/poi_crooked_hour_tavern.json";
import actorRaw from "./content/actors/actor_mara_venn.json";
import endeavorRaw from "./content/endeavors/endeavor_the_missing_broadsheet.json";
import dialogueMaraVennRaw from "./content/dialogues/dialogue_mara_venn.json";
import itemRapierRaw from "./content/items/item_rapier.json";
import factionCityWatchRaw from "./content/factions/faction_city_watch.json";
import factionWageringRingRaw from "./content/factions/faction_wagering_ring.json";
import { SettlementSchema } from "./content/schemas/settlement.schema";
import { DistrictSchema } from "./content/schemas/district.schema";
import { PoiSchema } from "./content/schemas/poi.schema";
import { ActorSchema } from "./content/schemas/actor.schema";
import { EndeavorSchema } from "./content/schemas/endeavor.schema";
import { DialogueSchema } from "./content/schemas/dialogue.schema";
import { ItemSchema } from "./content/schemas/item.schema";
import { FactionSchema } from "./content/schemas/faction.schema";
import type { ItemDisplayData, RosterEntryData } from "./engine/components/ManagementDrawer";
import { loadContent } from "./contentLoader";
import { resolveDialogueEntryNodeId } from "./dialogueResolution";
import { computeDistrictEntryEffects, computePoiEntryEffects, type EntryEffect } from "./engine/utils/entryEffects";

// Every content file is parsed through its schema here, once, at module
// load — see contentLoader.ts for why. Nothing below this point ever reads
// a *Raw import directly.
const settlement = loadContent(SettlementSchema, settlementRaw, "settlement_valdeombra_city");
const district = loadContent(DistrictSchema, districtRaw, "district_lantern_ward");
const poi = loadContent(PoiSchema, poiRaw, "poi_crooked_hour_tavern");
const actor = loadContent(ActorSchema, actorRaw, "actor_mara_venn");
const endeavor = loadContent(EndeavorSchema, endeavorRaw, "endeavor_the_missing_broadsheet");
const dialogueMaraVenn = loadContent(DialogueSchema, dialogueMaraVennRaw, "dialogue_mara_venn");
const itemRapier = loadContent(ItemSchema, itemRapierRaw, "item_rapier");
const factionCityWatch = loadContent(FactionSchema, factionCityWatchRaw, "faction_city_watch");
const factionWageringRing = loadContent(FactionSchema, factionWageringRingRaw, "faction_wagering_ring");

const pois = [poi];
const actors = [actor];
const factions = [factionCityWatch, factionWageringRing];
const endeavors = [endeavor];
const endeavorsById = Object.fromEntries(endeavors.map((e) => [e.id, e]));

const dialogues = { [dialogueMaraVenn.id]: dialogueMaraVenn };
const itemsById: Record<string, ItemDisplayData> = {
  [itemRapier.id]: {
    name: itemRapier.name,
    description: itemRapier.description,
    imageAsset: itemRapier.imageAsset,
  },
};
const factionsById = Object.fromEntries(factions.map((f) => [f.id, f]));
const rosterEntries: RosterEntryData[] = actors.map((a) => ({
  id: a.id,
  name: a.name,
  title: a.title,
  description: a.description,
  imageAsset: a.imageAsset,
  factionNames: a.factionIds.map((fid) => factionsById[fid]?.name ?? fid),
  dialogueId: a.dialogueId,
}));

const ENDEAVOR_ID = "endeavor_the_missing_broadsheet";

function App() {
  const currentLocation = usePlayerStore((state) => state.currentLocation);
  const currencies = usePlayerStore((state) => state.currencies);
  const activeEndeavors = usePlayerStore((state) => state.activeEndeavors);
  const dialogueProgress = usePlayerStore((state) => state.dialogueProgress);
  const activeDialogue = usePlayerStore((state) => state.activeDialogue);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  // Turns a computed EntryEffect into the actual side effect. Lives inside
  // App() (not a top-level function) since DIALOGUE effects need
  // dispatchCommand/dialogues/dialogueProgress from component scope.
  function executeEntryEffect(effect: EntryEffect) {
    if (effect.type === "SOUND") {
      playSound(effect.asset);
      return;
    }
    const nodeId = effect.nodeId ?? resolveDialogueEntryNodeId(dialogues[effect.dialogueId], dialogueProgress[effect.dialogueId]);
    dispatchCommand({
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: effect.dialogueId, nodeId },
    });
    dispatchCommand({ type: "COMMAND_OPEN_DIALOGUE", payload: { dialogueId: effect.dialogueId } });
  }

  useEffect(() => {
    computeDistrictEntryEffects(district).forEach(executeEntryEffect);
    // district is a static top-level import today, so this effect correctly
    // runs once on mount; once real district-to-district travel exists,
    // district will need to become reactive and this effect's dependencies
    // must be revisited, or entry sound will silently stop firing on
    // district changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPoi = pois.find((p) => p.id === currentLocation.poiId);

  const openDialogue = activeDialogue ? dialogues[activeDialogue.dialogueId] : null;
  const openNode = openDialogue
    ? openDialogue.nodes[resolveDialogueEntryNodeId(openDialogue, dialogueProgress[openDialogue.id])]
    : null;
  const speakerActor = actors.find((a) => a.dialogueId === activeDialogue?.dialogueId);

  const handleSelectActor = (actorId: string) => {
    setSelectedActorId(actorId);
    const selected = actors.find((a) => a.id === actorId);
    const dialogue = selected ? dialogues[selected.dialogueId] : undefined;
    if (!dialogue) return;

    const entryNodeId = resolveDialogueEntryNodeId(dialogue, dialogueProgress[dialogue.id]);
    dispatchCommand({
      type: "COMMAND_ENTER_DIALOGUE_NODE",
      payload: { dialogueId: dialogue.id, nodeId: entryNodeId },
    });
    dispatchCommand({ type: "COMMAND_OPEN_DIALOGUE", payload: { dialogueId: dialogue.id } });
  };

  function buildPoiActions(activePoi: (typeof pois)[number]): NodeInteractionAction[] {
    const actions: NodeInteractionAction[] = [];

    if (activePoi.id === "poi_crooked_hour_tavern") {
      actions.push({
        id: "action_gamble",
        label: "Gamble",
        onClick: () => {
          const wager = clampWager(20, currenciesToBronzeEquivalent(currencies));
          dispatchCommand({
            type: "COMMAND_START_MINIGAME",
            payload: {
              type: "DICE",
              sourceId: activePoi.id,
              config: { wager },
              onSuccessCommands: [
                { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "bronze", amount: wager } },
              ],
              onFailureCommands: [
                { type: "COMMAND_ADJUST_CURRENCY", payload: { denomination: "bronze", amount: -wager } },
              ],
            },
          });
        },
      });

      const endeavorState = activeEndeavors[ENDEAVOR_ID];
      if (endeavorState?.currentPhaseId === "phase_confront_the_buyer") {
        const canAfford = currenciesToBronzeEquivalent(currencies) >= 20;
        actions.push({
          id: "action_pay_off_buyer",
          label: canAfford ? "Pay off the buyer (1 silver)" : "Pay off the buyer (need 1 silver)",
          disabled: !canAfford,
          onClick: () => {
            dispatchCommand({
              type: "COMMAND_ADJUST_CURRENCY",
              payload: { denomination: "silver", amount: -1 },
            });
          },
        });
      }
    }

    return actions;
  }

  return (
    <div className="min-h-screen bg-neutral-950 pt-14 text-indigo-100">
      <WorldClockHud />

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed right-4 top-16 z-30 rounded border border-indigo-800 bg-neutral-900 px-3 py-1 text-xs uppercase tracking-wide hover:border-indigo-500"
      >
        Journal
      </button>

      {currentPoi ? (
        <NodeInteractionCanvas
          poiName={currentPoi.name}
          poiDescription={currentPoi.description}
          imageAsset={currentPoi.imageAsset}
          actors={actors
            .filter((a) => currentPoi.actorIds.includes(a.id))
            .map((a) => ({ id: a.id, name: a.name, title: a.title }))}
          selectedActorId={selectedActorId}
          actions={buildPoiActions(currentPoi)}
          onSelectActor={handleSelectActor}
          onLeave={() => {
            setSelectedActorId(null);
            dispatchCommand({ type: "COMMAND_CLOSE_DIALOGUE", payload: {} });
            dispatchCommand({
              type: "COMMAND_MOVE_TO_DISTRICT",
              payload: { districtId: currentLocation.districtId },
            });
          }}
        />
      ) : (
        <WorldNavigationView
          settlementName={settlement.name}
          districtName={district.name}
          pois={pois.map((p) => ({ id: p.id, name: p.name, isUnlocked: p.isUnlocked }))}
          onSelectPoi={(poiId) => {
            const target = pois.find((p) => p.id === poiId);
            if (target) {
              computePoiEntryEffects(target, activeEndeavors, endeavorsById).forEach(executeEntryEffect);
            }
            dispatchCommand({
              // target.costShifts is guaranteed present (PoiSchema's
              // .default(0) applied at load time by contentLoader.ts) once
              // target itself resolves — the `? :` only covers "no matching
              // poi found", not a missing/undefaulted field.
              type: "COMMAND_MOVE_TO_POI",
              payload: { poiId, costShifts: target ? target.costShifts : 0 },
            });
          }}
        />
      )}

      <ManagementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        endeavorTitles={{ [endeavor.id]: endeavor.title }}
        items={itemsById}
        roster={rosterEntries}
      />
      <MinigameOverlay />
      <DialogueOverlay
        dialogueId={activeDialogue?.dialogueId ?? ""}
        node={openNode}
        speakerImageAsset={speakerActor?.imageAsset}
      />
    </div>
  );
}

export default App;
