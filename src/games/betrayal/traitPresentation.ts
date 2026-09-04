import type {
  BetrayalCore,
  BetrayalExplorerSummary,
  BetrayalTraitKey,
  BetrayalTraitTrackState,
} from "./game";

export const TRAIT_DAMAGE_ORDER: BetrayalTraitKey[] = [
  "might",
  "speed",
  "knowledge",
  "sanity",
];

type ExplorerBoardMarkerAnchor = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

const EXPLORER_BOARD_MARKER_RANGE: Record<
  BetrayalTraitKey,
  ExplorerBoardMarkerAnchor
> = {
  might: { from: { x: 14.5, y: 44.5 }, to: { x: 35.5, y: 23.5 } },
  speed: { from: { x: 18.5, y: 79.5 }, to: { x: 18.5, y: 54.5 } },
  knowledge: { from: { x: 85.5, y: 44.5 }, to: { x: 64.5, y: 23.5 } },
  sanity: { from: { x: 81.5, y: 79.5 }, to: { x: 81.5, y: 54.5 } },
};

export function resolveHighestTraitChoice(
  traits: Record<BetrayalTraitKey, number>,
  choices: readonly BetrayalTraitKey[],
): BetrayalTraitKey {
  return choices.reduce(
    (bestTrait, trait) =>
      traits[trait] > traits[bestTrait] ? trait : bestTrait,
    choices[0] ?? "knowledge",
  );
}

export function resolveExplorerTraitTrack(
  explorer: BetrayalExplorerSummary,
  trait: BetrayalTraitKey,
): BetrayalTraitTrackState {
  const track = explorer.traitTracks?.[trait];
  if (track && Array.isArray(track.values) && track.values.length > 0) {
    return track;
  }
  const value = explorer.traits[trait] ?? 0;
  return {
    trackId: `${explorer.explorerId}-${trait}-fallback`,
    values: [value],
    position: 0,
    startPosition: 0,
    criticalPosition: 0,
    skullPosition: -1,
    maxPosition: 0,
  };
}

export function clampTraitTrackPosition(
  track: BetrayalTraitTrackState,
): number {
  return Math.max(
    track.skullPosition,
    Math.min(track.maxPosition, track.position),
  );
}

export function resolveTraitTrackValueAtPosition(
  track: BetrayalTraitTrackState,
  position: number,
): number {
  if (position <= track.skullPosition) {
    return 0;
  }
  const clampedPosition = Math.max(
    track.criticalPosition,
    Math.min(track.maxPosition, position),
  );
  return (
    track.values[clampedPosition] ??
    track.values[track.criticalPosition] ??
    0
  );
}

export function resolveTraitTrackSlots(
  track: BetrayalTraitTrackState,
): number[] {
  const valuePositions = track.values.map((_, index) => index);
  return track.skullPosition < 0
    ? [track.skullPosition, ...valuePositions]
    : valuePositions;
}

export function resolveTraitDamageFloorPosition(
  track: BetrayalTraitTrackState,
  phase: BetrayalCore["phase"],
): number {
  return phase === "haunt" ? track.skullPosition : track.criticalPosition;
}

export function resolveTraitDamageAssignableSteps(
  explorer: BetrayalExplorerSummary,
  trait: BetrayalTraitKey,
  phase: BetrayalCore["phase"],
): number {
  const track = resolveExplorerTraitTrack(explorer, trait);
  const currentPosition = clampTraitTrackPosition(track);
  const floorPosition = resolveTraitDamageFloorPosition(track, phase);
  return Math.max(0, currentPosition - floorPosition);
}

export function pruneSelectedDamageTraits(
  selectedTraits: BetrayalTraitKey[],
  allowedTraits: BetrayalTraitKey[],
  amount: number,
  explorer: BetrayalExplorerSummary,
  phase: BetrayalCore["phase"],
): BetrayalTraitKey[] {
  const allowed = new Set(allowedTraits);
  const counts = new Map<BetrayalTraitKey, number>();
  const pruned: BetrayalTraitKey[] = [];
  for (const trait of selectedTraits) {
    if (!allowed.has(trait) || pruned.length >= amount) {
      continue;
    }
    const currentCount = counts.get(trait) ?? 0;
    const maxCount = Math.min(
      amount,
      resolveTraitDamageAssignableSteps(explorer, trait, phase),
    );
    if (currentCount >= maxCount) {
      continue;
    }
    pruned.push(trait);
    counts.set(trait, currentCount + 1);
  }
  return pruned;
}

export function countSelectedDamageTrait(
  selectedTraits: BetrayalTraitKey[],
  trait: BetrayalTraitKey,
): number {
  return selectedTraits.filter((selectedTrait) => selectedTrait === trait)
    .length;
}

export function adjustSelectedDamageTrait({
  selectedTraits,
  trait,
  delta,
  allowedTraits,
  amount,
  explorer,
  phase,
}: {
  selectedTraits: BetrayalTraitKey[];
  trait: BetrayalTraitKey;
  delta: -1 | 1;
  allowedTraits: BetrayalTraitKey[];
  amount: number;
  explorer: BetrayalExplorerSummary;
  phase: BetrayalCore["phase"];
}): BetrayalTraitKey[] {
  const selected = pruneSelectedDamageTraits(
    selectedTraits,
    allowedTraits,
    amount,
    explorer,
    phase,
  );
  const currentCount = countSelectedDamageTrait(selected, trait);
  if (delta < 0) {
    if (currentCount <= 0) {
      return selected;
    }
    const removeIndex = selected.lastIndexOf(trait);
    return selected.filter((_, index) => index !== removeIndex);
  }
  const maxTraitCount = Math.min(
    amount,
    resolveTraitDamageAssignableSteps(explorer, trait, phase),
  );
  if (
    !allowedTraits.includes(trait) ||
    currentCount >= maxTraitCount ||
    selected.length >= amount
  ) {
    return selected;
  }
  return [...selected, trait];
}

export function resolveTrackPositionPercent(
  slots: number[],
  position: number,
): number {
  if (slots.length <= 1) {
    return 50;
  }
  const slotIndex = slots.indexOf(position);
  const safeIndex =
    slotIndex >= 0
      ? slotIndex
      : slots.findIndex((candidate) => candidate >= position);
  const clampedIndex =
    safeIndex >= 0 ? safeIndex : position < slots[0]! ? 0 : slots.length - 1;
  return (clampedIndex / (slots.length - 1)) * 100;
}

export function resolveExplorerBoardMarkerPosition(
  trait: BetrayalTraitKey,
  position: number,
  maxPosition: number,
): { left: string; top: string } {
  const range = EXPLORER_BOARD_MARKER_RANGE[trait];
  const clampedPosition = Math.max(0, Math.min(maxPosition, Math.round(position)));
  const progress = clampedPosition / Math.max(1, maxPosition);
  return {
    left: `${range.from.x + (range.to.x - range.from.x) * progress}%`,
    top: `${range.from.y + (range.to.y - range.from.y) * progress}%`,
  };
}
