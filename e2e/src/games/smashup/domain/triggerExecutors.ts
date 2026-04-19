import type { TitanAwareTriggerTiming, TriggerCallback } from './ongoingEffects';

type TriggerExecutorRegistry = Map<string, Map<TitanAwareTriggerTiming, TriggerCallback>>;

// This registry is populated by ongoingEffects when triggers are registered.
// We keep it separate so the reaction queue resolver can execute a specific trigger instance.
const registry: TriggerExecutorRegistry = new Map();

export function registerTriggerExecutor(sourceDefId: string, timing: TitanAwareTriggerTiming, callback: TriggerCallback): void {
  let t = registry.get(sourceDefId);
  if (!t) {
    t = new Map();
    registry.set(sourceDefId, t);
  }
  t.set(timing, callback);
}

export function getTriggerExecutor(timing: TitanAwareTriggerTiming, sourceDefId: string): TriggerCallback | undefined {
  return registry.get(sourceDefId)?.get(timing);
}

