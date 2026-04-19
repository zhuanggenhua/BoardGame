interface HandInteractionBusyParams {
  hasAbilityMode: boolean;
  hasActiveEventMode: boolean;
  hasEngineInteraction: boolean;
  hasSwInteraction: boolean;
}

export function shouldBlockHandInteraction({
  hasAbilityMode,
  hasActiveEventMode,
  hasEngineInteraction,
  hasSwInteraction,
}: HandInteractionBusyParams): boolean {
  if (hasAbilityMode || hasActiveEventMode) return true;
  if (!hasEngineInteraction) return false;
  return hasSwInteraction;
}
