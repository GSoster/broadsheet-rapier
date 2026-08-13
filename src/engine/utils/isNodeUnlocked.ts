// COMMAND_UNLOCK_NODE and EndeavorPhase.unlocksNodesOnComplete both only
// ever set true — confirmed explicitly, not left implicit: every
// unlockedNodes write site in commands.ts was checked, and there is no
// command or code path anywhere that ever sets a node back to false or
// removes an entry. unlockedNodes is therefore monotonic: once true,
// permanently true for the rest of the save. isNodeUnlocked relies on
// this — it's a plain OR, not a live/reactive lock that could ever
// re-lock something.
//
// See docs/features/feature_node_unlock_rendering.md: this closes a real
// gap where the static isUnlocked content field and the dynamic
// unlockedNodes save-state record were never actually merged anywhere,
// so a player-earned unlock had no visible effect.
export function isNodeUnlocked(
  node: { isUnlocked: boolean },
  nodeId: string,
  unlockedNodes: Record<string, boolean>
): boolean {
  return node.isUnlocked || !!unlockedNodes[nodeId];
}
