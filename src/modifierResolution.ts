import type { Modifier, ModifierSet } from "./engine/modifiers";
import type { PlayerState } from "./engine/types";
import type { Item } from "./content/schemas/item.schema";

// Bridge layer: aggregating a ModifierSet requires item content (src/content/),
// which src/engine/ never imports — same reason dialogueResolution.ts/
// notificationResolution.ts live outside src/engine/ rather than inside it.
// Owned-only this phase (docs/features/feature_modifier_system.md §2.6):
// any inventory entry with quantity > 0 contributes its item's modifiers
// once, regardless of quantity ("quantity independence", §2.6).
// Only reads `inventory`, typed as a PlayerState slice rather than requiring
// a full PlayerState — App.tsx can select just `inventory` from the store
// without reconstructing the whole shape.
export function collectActiveModifiers(
  playerState: Pick<PlayerState, "inventory">,
  items: Record<string, Item>
): ModifierSet {
  const modifiers: Modifier[] = [];
  for (const entry of playerState.inventory) {
    if (entry.quantity <= 0) continue;
    const item = items[entry.itemId];
    if (!item) continue;
    for (const grant of item.modifiers) {
      modifiers.push({
        key: grant.key,
        op: grant.op,
        value: grant.value,
        targetId: grant.targetId,
        sourceId: item.id,
        sourceLabel: item.name,
      });
    }
  }
  return modifiers;
}
