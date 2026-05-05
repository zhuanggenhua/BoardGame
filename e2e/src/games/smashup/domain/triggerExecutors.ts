import type { SmashUpCore, SmashUpEvent } from './types';
import type { TitanAwareTriggerTiming, TriggerCallback, TriggerContext } from './ongoingEffects';
import {
  createAbilityRuntimeExecutor,
  createEffectProgram,
  executeAbilityRuntimeExecutor,
  type AbilityRuntimeExecutor,
} from './abilityRuntime';

type TriggerProgramExecutor = AbilityRuntimeExecutor<TriggerContext, SmashUpCore, SmashUpEvent>;
type TriggerProgramExecutorRegistry = Map<string, Map<TitanAwareTriggerTiming, TriggerProgramExecutor>>;

// This registry is populated by ongoingEffects when triggers are registered.
// Queued triggers now execute exclusively through the ability runtime executor contract.
const programRegistry: TriggerProgramExecutorRegistry = new Map();

function upsertProgramExecutor(
  sourceDefId: string,
  timing: TitanAwareTriggerTiming,
  executor: TriggerProgramExecutor,
): void {
  let timingMap = programRegistry.get(sourceDefId);
  if (!timingMap) {
    timingMap = new Map();
    programRegistry.set(sourceDefId, timingMap);
  }
  timingMap.set(timing, executor);
}

export function registerTriggerExecutor(sourceDefId: string, timing: TitanAwareTriggerTiming, callback: TriggerCallback): void {
  upsertProgramExecutor(
    sourceDefId,
    timing,
    createAbilityRuntimeExecutor(
      createEffectProgram((context: TriggerContext) => callback(context)),
    ),
  );
}

export function registerTriggerProgramExecutor(
  sourceDefId: string,
  timing: TitanAwareTriggerTiming,
  executor: TriggerProgramExecutor,
): void {
  upsertProgramExecutor(sourceDefId, timing, executor);
}

export function requireTriggerProgramExecutor(
  timing: TitanAwareTriggerTiming,
  sourceDefId: string,
): TriggerProgramExecutor {
  const executor = programRegistry.get(sourceDefId)?.get(timing);
  if (!executor) {
    throw new Error(`SmashUp queued trigger 缺少 ability runtime executor: ${sourceDefId}@${timing}`);
  }
  return executor;
}

export function executeTriggerProgramExecutor(
  timing: TitanAwareTriggerTiming,
  sourceDefId: string,
  context: TriggerContext,
) {
  return executeAbilityRuntimeExecutor(requireTriggerProgramExecutor(timing, sourceDefId), context);
}
