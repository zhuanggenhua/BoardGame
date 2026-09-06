import type {
  BetrayalCore,
  BetrayalInventoryCard,
  BetrayalRoomNode,
  BetrayalTraitKey,
  UseEffectProfile,
} from "./game";
import type { BetrayalAttackWeaponCardStatus } from "./attackRules";
import { resolveInventoryEffectId } from "./possessionEffects";

export function mergeEventTraitChoices(
  ...choices: BetrayalTraitKey[][]
): BetrayalTraitKey[] {
  return Array.from(new Set(choices.flat()));
}

export function resolveEventTraitChoices(
  effect: UseEffectProfile,
): BetrayalTraitKey[] {
  if (effect.mode === "chooseTraitRoll") {
    return effect.allowedTraits;
  }
  if (effect.mode === "chosenTrait" || effect.mode === "healChosenTrait") {
    return effect.chosenTrait ? [] : effect.allowedTraits;
  }
  if (effect.mode === "compound") {
    return effect.effects.flatMap(resolveEventTraitChoices);
  }
  return [];
}

export function resolveEventPreviewEffect(
  core: BetrayalCore,
  effect: UseEffectProfile,
  selectedTrait: BetrayalTraitKey | null,
): UseEffectProfile | null {
  if (effect.mode !== "chooseTraitRoll") {
    return effect;
  }
  if (!selectedTrait || !effect.allowedTraits.includes(selectedTrait)) {
    return null;
  }
  const previewTotal = core.currentExplorer.traits[selectedTrait];
  return (
    [...effect.branches]
      .sort((left, right) => right.min - left.min)
      .find((branch) => previewTotal >= branch.min)?.effect ??
    effect.branches[effect.branches.length - 1]?.effect ??
    null
  );
}

export function resolveEventTargetRooms(
  core: BetrayalCore,
  effect: UseEffectProfile | null,
): BetrayalRoomNode[] {
  if (!effect) {
    return [];
  }
  if (effect.mode === "compound") {
    return effect.effects.flatMap((childEffect) =>
      resolveEventTargetRooms(core, childEffect),
    );
  }
  if (effect.mode === "placeExplorerInDiscoveredRoomByFloor") {
    const currentRoom = core.rooms.find(
      (room) => room.id === core.currentExplorer.roomId,
    );
    const requiredRoom = effect.requiredIfDiscoveredVisualIds?.length
      ? core.rooms.find(
          (room) =>
            room.state === "discovered" &&
            effect.requiredIfDiscoveredVisualIds!.includes(room.visualId),
        )
      : null;
    return core.rooms.filter(
      (room) => {
        if (room.state !== "discovered") {
          return false;
        }
        if (requiredRoom) {
          return room.id === requiredRoom.id;
        }
        if (effect.targetRoomScope === "anyDiscovered") {
          return true;
        }
        if (effect.targetRoomScope === "groundDiscovered") {
          return room.floor === "ground";
        }
        if (effect.targetRoomScope === "basementDiscovered") {
          return room.floor === "basement";
        }
        if (effect.targetRoomScope === "groundOrBasementDiscovered") {
          return room.floor === "ground" || room.floor === "basement";
        }
        if (effect.targetRoomScope === "sameFloorDiscovered") {
          return Boolean(currentRoom && room.floor === currentRoom.floor);
        }
        if (effect.targetRoomScope === "differentFloorDiscovered") {
          return Boolean(currentRoom && room.floor !== currentRoom.floor);
        }
        return false;
      },
    );
  }
  if (effect.mode === "placeExplorerInAdjacentRoom") {
    const currentRoom = core.rooms.find(
      (room) => room.id === core.currentExplorer.roomId,
    );
    if (!currentRoom) {
      return [];
    }
    const connectedRoomIds = new Set(currentRoom.connectedRoomIds);
    for (const doorway of currentRoom.doorways) {
      if (doorway.connectsToRoomId) {
        connectedRoomIds.add(doorway.connectsToRoomId);
      }
    }
    return core.rooms.filter(
      (room) => room.state === "discovered" && connectedRoomIds.has(room.id),
    );
  }
  if (effect.mode === "placeSecretPassageToken") {
    if (!effect.targetRoomScope) {
      return [];
    }
    return core.rooms.filter(
      (room) =>
        room.state === "discovered" &&
        room.id !== core.currentExplorer.roomId &&
        !room.markerTokens?.includes("secretPassage") &&
        (!effect.targetRoomScope ||
          effect.targetRoomScope === "anyOtherDiscovered" ||
          (effect.targetRoomScope === "groundDiscovered" &&
            room.floor === "ground") ||
          (effect.targetRoomScope === "basementDiscovered" &&
            room.floor === "basement")),
    );
  }
  return [];
}

export function resolveEventGeneralDamageChoice(
  effect: UseEffectProfile | null,
): Extract<UseEffectProfile, { mode: "generalDamageChoice" }> | null {
  if (!effect) {
    return null;
  }
  if (effect.mode === "generalDamageChoice") {
    return effect;
  }
  if (effect.mode === "compound") {
    for (const childEffect of effect.effects) {
      const damageChoice = resolveEventGeneralDamageChoice(childEffect);
      if (damageChoice) {
        return damageChoice;
      }
    }
  }
  return null;
}

export function resolveEventActionEffect(
  effect: UseEffectProfile,
  accept: boolean,
): UseEffectProfile {
  if (effect.mode === "optionalItemEffect") {
    return accept ? effect.acceptEffect : effect.declineEffect;
  }
  if (!accept && effect.mode === "optionalHauntRoll") {
    return effect.skippedOrStartedEffect;
  }
  if (
    accept &&
    effect.mode === "allTraitChecks" &&
    effect.results?.every((result) => result.passed)
  ) {
    return effect.allPassEffect;
  }
  return effect;
}

export function resolveEventItemChoiceCards(
  inventory: readonly BetrayalInventoryCard[],
  effect: UseEffectProfile | null,
  attackWeaponCardStatuses: readonly BetrayalAttackWeaponCardStatus[],
): BetrayalInventoryCard[] {
  if (effect?.mode !== "optionalItemEffect") {
    return [];
  }
  const attackWeaponEffectIds = new Set(
    attackWeaponCardStatuses.map((status) =>
      resolveInventoryEffectId(status.card.id),
    ),
  );
  return inventory.filter((card) => {
    if (card.kind !== "item") {
      return false;
    }
    if (effect.itemFilter === "nonWeaponItem") {
      return !attackWeaponEffectIds.has(resolveInventoryEffectId(card.id));
    }
    return true;
  });
}
