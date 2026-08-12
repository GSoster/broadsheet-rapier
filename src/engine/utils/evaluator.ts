import type { DialogueRequirement, PlayerState } from "../types";

// Signature deviates from the design doc's literal two-argument sketch
// (playerState, requirement?) — resolving `nodeVisits`' omitted-`nodeId` case
// ("the node this requirement is attached to") and keying into
// `dialogueProgress` both require knowing which node/dialogue is currently
// being evaluated, so those are passed explicitly rather than inferred.
export function evaluateDialogueRequirement(
  playerState: PlayerState,
  requirement: DialogueRequirement | undefined,
  currentNodeId: string,
  dialogueId: string
): boolean {
  if (!requirement) return true;

  if (requirement.requiredClues) {
    const hasAllClues = requirement.requiredClues.every((clueId) =>
      playerState.unlockedClues.includes(clueId)
    );
    if (!hasAllClues) return false;
  }

  if (requirement.minActorReputation) {
    const { actorId, value } = requirement.minActorReputation;
    const current = playerState.reputation.actors[actorId] ?? 0;
    if (current < value) return false;
  }

  if (requirement.minFactionReputation) {
    const { factionId, value } = requirement.minFactionReputation;
    const current = playerState.reputation.factions[factionId] ?? 0;
    if (current < value) return false;
  }

  if (requirement.allowedShifts) {
    if (!requirement.allowedShifts.includes(playerState.worldClock.shift)) return false;
  }

  if (requirement.nodeVisits) {
    const { nodeId, min, max } = requirement.nodeVisits;
    const targetNodeId = nodeId ?? currentNodeId;
    const count = playerState.dialogueProgress[dialogueId]?.visitCounts[targetNodeId] ?? 0;
    if (min !== undefined && count < min) return false;
    if (max !== undefined && count > max) return false;
  }

  return true;
}
