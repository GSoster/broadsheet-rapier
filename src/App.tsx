import { useEffect, useRef, useState } from "react";
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
import { NotificationTray } from "./engine/components/NotificationTray";
import { resolveNotificationMessage } from "./notificationResolution";

import settlementRaw from "./content/settlements/settlement_valdeombra_city.json";
import districtRaw from "./content/districts/district_lantern_ward.json";
import poiRaw from "./content/pois/poi_crooked_hour_tavern.json";
import poiWidowmakerAlleyRaw from "./content/pois/poi_widowmaker_alley.json";
import actorRaw from "./content/actors/actor_mara_venn.json";
import actorBookkeeperRaw from "./content/actors/actor_bookkeeper.json";
import actorAnselmDrayeRaw from "./content/actors/actor_anselm_draye.json";
import actorDuroVantryRaw from "./content/actors/actor_duro_vantry.json";
import endeavorRaw from "./content/endeavors/endeavor_the_missing_broadsheet.json";
import endeavorDebtInSteelRaw from "./content/endeavors/endeavor_a_debt_in_steel.json";
import dialogueMaraVennRaw from "./content/dialogues/dialogue_mara_venn.json";
import dialogueBookkeeperDefaultRaw from "./content/dialogues/dialogue_bookkeeper_default.json";
import dialogueDuroVantryDefaultRaw from "./content/dialogues/dialogue_duro_vantry_default.json";
import dialogueTheChallengeRaw from "./content/dialogues/dialogue_the_challenge.json";
import dialogueAnselmRecruitRaw from "./content/dialogues/dialogue_anselm_recruit.json";
import dialogueWidowmakerArrivalRaw from "./content/dialogues/dialogue_widowmaker_arrival.json";
import dialogueTheOfferRaw from "./content/dialogues/dialogue_the_offer.json";
import dialogueReckoningWinRaw from "./content/dialogues/dialogue_reckoning_win.json";
import dialogueReckoningLoseRaw from "./content/dialogues/dialogue_reckoning_lose.json";
import itemRapierRaw from "./content/items/item_rapier.json";
import itemVantryRapierRaw from "./content/items/item_vantry_rapier.json";
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
import { isNodeUnlocked } from "./engine/utils/isNodeUnlocked";

// Every content file is parsed through its schema here, once, at module
// load — see contentLoader.ts for why. Nothing below this point ever reads
// a *Raw import directly.
const settlement = loadContent(SettlementSchema, settlementRaw, "settlement_valdeombra_city");
const district = loadContent(DistrictSchema, districtRaw, "district_lantern_ward");
const poi = loadContent(PoiSchema, poiRaw, "poi_crooked_hour_tavern");
const poiWidowmakerAlley = loadContent(PoiSchema, poiWidowmakerAlleyRaw, "poi_widowmaker_alley");
const actor = loadContent(ActorSchema, actorRaw, "actor_mara_venn");
const actorBookkeeper = loadContent(ActorSchema, actorBookkeeperRaw, "actor_bookkeeper");
const actorAnselmDraye = loadContent(ActorSchema, actorAnselmDrayeRaw, "actor_anselm_draye");
const actorDuroVantry = loadContent(ActorSchema, actorDuroVantryRaw, "actor_duro_vantry");
const endeavor = loadContent(EndeavorSchema, endeavorRaw, "endeavor_the_missing_broadsheet");
const endeavorDebtInSteel = loadContent(EndeavorSchema, endeavorDebtInSteelRaw, "endeavor_a_debt_in_steel");
const dialogueMaraVenn = loadContent(DialogueSchema, dialogueMaraVennRaw, "dialogue_mara_venn");
const dialogueBookkeeperDefault = loadContent(
  DialogueSchema,
  dialogueBookkeeperDefaultRaw,
  "dialogue_bookkeeper_default"
);
const dialogueDuroVantryDefault = loadContent(
  DialogueSchema,
  dialogueDuroVantryDefaultRaw,
  "dialogue_duro_vantry_default"
);
const dialogueTheChallenge = loadContent(DialogueSchema, dialogueTheChallengeRaw, "dialogue_the_challenge");
const dialogueAnselmRecruit = loadContent(DialogueSchema, dialogueAnselmRecruitRaw, "dialogue_anselm_recruit");
const dialogueWidowmakerArrival = loadContent(
  DialogueSchema,
  dialogueWidowmakerArrivalRaw,
  "dialogue_widowmaker_arrival"
);
const dialogueTheOffer = loadContent(DialogueSchema, dialogueTheOfferRaw, "dialogue_the_offer");
const dialogueReckoningWin = loadContent(DialogueSchema, dialogueReckoningWinRaw, "dialogue_reckoning_win");
const dialogueReckoningLose = loadContent(DialogueSchema, dialogueReckoningLoseRaw, "dialogue_reckoning_lose");
const itemRapier = loadContent(ItemSchema, itemRapierRaw, "item_rapier");
const itemVantryRapier = loadContent(ItemSchema, itemVantryRapierRaw, "item_vantry_rapier");
const factionCityWatch = loadContent(FactionSchema, factionCityWatchRaw, "faction_city_watch");
const factionWageringRing = loadContent(FactionSchema, factionWageringRingRaw, "faction_wagering_ring");

const pois = [poi, poiWidowmakerAlley];
const actors = [actor, actorBookkeeper, actorAnselmDraye, actorDuroVantry];
const factions = [factionCityWatch, factionWageringRing];
const endeavors = [endeavor, endeavorDebtInSteel];
const endeavorsById = Object.fromEntries(endeavors.map((e) => [e.id, e]));

const dialogueList = [
  dialogueMaraVenn,
  dialogueBookkeeperDefault,
  dialogueDuroVantryDefault,
  dialogueTheChallenge,
  dialogueAnselmRecruit,
  dialogueWidowmakerArrival,
  dialogueTheOffer,
  dialogueReckoningWin,
  dialogueReckoningLose,
];
const dialogues = Object.fromEntries(dialogueList.map((d) => [d.id, d]));
const itemList = [itemRapier, itemVantryRapier];
const itemsById: Record<string, ItemDisplayData> = Object.fromEntries(
  itemList.map((item) => [
    item.id,
    { name: item.name, description: item.description, imageAsset: item.imageAsset },
  ])
);
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

// Content-derived lookup maps feeding notificationResolution.ts — small and
// cheap enough to build unconditionally at module load, same tier as
// factionsById/rosterEntries above.
const itemNames = Object.fromEntries(itemList.map((item) => [item.id, item.name]));
const actorNames = Object.fromEntries(actors.map((a) => [a.id, a.name]));
const factionNames = Object.fromEntries(factions.map((f) => [f.id, f.name]));
const endeavorTitles = Object.fromEntries(endeavors.map((e) => [e.id, e.title]));
const phaseObjectives = Object.fromEntries(
  endeavors.map((e) => [e.id, Object.fromEntries(Object.entries(e.phases).map(([phaseId, phase]) => [phaseId, phase.objectiveText]))])
);
// Same "no nextPhaseOnSuccess = terminal = reaching it is the
// representation of completion" rule the notification system's
// Endeavor-completion effect uses (web-implementation.md §3/§10) — reused
// here, not reinvented, so the Endeavors tab's active/completed split
// agrees with what already triggers a "Completed: ..." toast.
const phaseIsTerminal = Object.fromEntries(
  endeavors.map((e) => [
    e.id,
    Object.fromEntries(Object.entries(e.phases).map(([phaseId, phase]) => [phaseId, phase.nextPhaseOnSuccess === undefined])),
  ])
);

function App() {
  const currentLocation = usePlayerStore((state) => state.currentLocation);
  const currencies = usePlayerStore((state) => state.currencies);
  const activeEndeavors = usePlayerStore((state) => state.activeEndeavors);
  const unlockedNodes = usePlayerStore((state) => state.unlockedNodes);
  const dialogueProgress = usePlayerStore((state) => state.dialogueProgress);
  const activeDialogue = usePlayerStore((state) => state.activeDialogue);
  const dispatchCommand = usePlayerStore((state) => state.dispatchCommand);
  const notifications = usePlayerStore((state) => state.notifications);
  const dismissNotification = usePlayerStore((state) => state.dismissNotification);
  const pushNotification = usePlayerStore((state) => state.pushNotification);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  // Purely cosmetic click-acknowledgement for "Pay off the buyer" — the
  // action itself is deliberately repeatable with no one-time gate
  // (web-implementation.md §3), so this doesn't disable the action
  // permanently, only long enough for a click to visibly register instead
  // of looking unresponsive (the currency toast is the only other feedback,
  // and it's easy to miss if you're not looking at the corner).
  const [buyerJustPaid, setBuyerJustPaid] = useState(false);

  // Turns a computed EntryEffect into the actual side effect. Lives inside
  // App() (not a top-level function) since DIALOGUE effects need
  // dispatchCommand/dialogues/dialogueProgress from component scope.
  function executeEntryEffect(effect: EntryEffect) {
    if (effect.type === "SOUND") {
      playSound(effect.asset);
      return;
    }
    if (effect.type === "START_ENDEAVOR") {
      dispatchCommand({
        type: "COMMAND_START_ENDEAVOR",
        payload: { endeavorId: effect.endeavorId, initialPhaseId: effect.initialPhaseId },
      });
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

  // Fires an EndeavorPhase's onPoiEnter for the POI the player is
  // ALREADY standing in, when a phase change makes it newly applicable —
  // the onSelectPoi call site only fires on the POI-selection moment
  // itself, which misses this case (docs/features/
  // feature_dialogue_visibility_and_auto_triggers.md addendum).
  // Deliberately narrower than onSelectPoi's full effect list: SOUND/
  // START_ENDEAVOR are excluded (replaying entry SFX or re-starting an
  // endeavor on every unrelated phase change would be a regression), and
  // it never fires over an already-open dialogue.
  useEffect(() => {
    if (currentLocation.poiId && activeDialogue === null) {
      const target = pois.find((p) => p.id === currentLocation.poiId);
      if (target) {
        computePoiEntryEffects(target, activeEndeavors, endeavorsById, unlockedNodes)
          .filter((effect): effect is Extract<EntryEffect, { type: "DIALOGUE" }> => effect.type === "DIALOGUE")
          .forEach(executeEntryEffect);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndeavors]);

  // Fires an "Endeavor completed" notification the moment an Endeavor's
  // phase transitions INTO a terminal one (no nextPhaseOnSuccess) — separate
  // from the dialogue-trigger effect above since this needs to compare
  // against the PREVIOUS phase, not just react to the current one.
  // prevActiveEndeavorsRef is seeded with activeEndeavors itself (not {}/
  // undefined) so the first comparison after mount is always against
  // itself — otherwise a save reloaded with an already-completed Endeavor
  // would fire a false "completed" toast on every page load, since this
  // effect still runs once after the first render regardless of its
  // dependency array. See docs/features/feature_notification_system.md.
  const prevActiveEndeavorsRef = useRef(activeEndeavors);
  useEffect(() => {
    for (const [endeavorId, progress] of Object.entries(activeEndeavors)) {
      const previousPhaseId = prevActiveEndeavorsRef.current[endeavorId]?.currentPhaseId;
      if (previousPhaseId === progress.currentPhaseId) continue;
      const phase = endeavorsById[endeavorId]?.phases[progress.currentPhaseId];
      if (phase && phase.nextPhaseOnSuccess === undefined) {
        pushNotification({ tone: "info", kind: "ENDEAVOR_COMPLETE", endeavorId });
      }
    }
    prevActiveEndeavorsRef.current = activeEndeavors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEndeavors]);

  const currentPoi = pois.find((p) => p.id === currentLocation.poiId);

  const openDialogue = activeDialogue ? dialogues[activeDialogue.dialogueId] : null;
  const openNode = openDialogue
    ? openDialogue.nodes[resolveDialogueEntryNodeId(openDialogue, dialogueProgress[openDialogue.id])]
    : null;
  // Matched by display name, not Actor.dialogueId — a scene an Actor
  // *appears* in (an Endeavor's/EndeavorPhase's onPoiEnter, or a minigame's
  // onSuccessCommands/onFailureCommands opening a reckoning dialogue) is
  // very often not that Actor's own home dialogue (see
  // docs/features/content_a_debt_in_steel.md's dialogueId-split design and
  // game-design-spec.md Open Design Gap #14). DialogueNode.speaker is
  // already a free-text display string that content authors keep in sync
  // with the speaking Actor's name, so matching on it resolves a portrait
  // for every scene that Actor speaks in, not just their own.
  const speakerActor = actors.find((a) => a.name === openNode?.speaker);

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
          label: buyerJustPaid ? "Paid ✓" : canAfford ? "Pay off the buyer (1 silver)" : "Pay off the buyer (need 1 silver)",
          disabled: buyerJustPaid || !canAfford,
          onClick: () => {
            dispatchCommand({
              type: "COMMAND_ADJUST_CURRENCY",
              payload: { denomination: "silver", amount: -1 },
            });
            setBuyerJustPaid(true);
            window.setTimeout(() => setBuyerJustPaid(false), 1200);
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
            .map((a) => ({ id: a.id, name: a.name, title: a.title, isUnlocked: isNodeUnlocked(a, a.id, unlockedNodes) }))}
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
          // BEHAVIOR FIX (not new scope): this previously read p.isUnlocked
          // directly, the static content default only — PlayerState.unlockedNodes
          // (written by COMMAND_UNLOCK_NODE / EndeavorPhase.unlocksNodesOnComplete)
          // was never consulted, so a POI's lock state could never actually
          // change at runtime. See game-design-spec.md Open Design Gap #13,
          // docs/features/feature_node_unlock_rendering.md, docs/decisions.md.
          pois={pois.map((p) => ({ id: p.id, name: p.name, isUnlocked: isNodeUnlocked(p, p.id, unlockedNodes) }))}
          onSelectPoi={(poiId) => {
            const target = pois.find((p) => p.id === poiId);
            if (target) {
              computePoiEntryEffects(target, activeEndeavors, endeavorsById, unlockedNodes).forEach(executeEntryEffect);
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
        endeavorTitles={endeavorTitles}
        phaseObjectives={phaseObjectives}
        phaseIsTerminal={phaseIsTerminal}
        items={itemsById}
        roster={rosterEntries}
      />
      <MinigameOverlay />
      <DialogueOverlay
        dialogueId={activeDialogue?.dialogueId ?? ""}
        node={openNode}
        speakerImageAsset={speakerActor?.imageAsset}
      />
      <NotificationTray
        notifications={notifications.map((event) =>
          resolveNotificationMessage(event, { itemNames, actorNames, factionNames, endeavorTitles })
        )}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

export default App;
