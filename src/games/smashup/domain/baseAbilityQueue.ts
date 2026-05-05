import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, TriggerQueuedEvent, TriggerInstance } from './types';
import type { BaseAbilityContext, BaseTriggerTiming } from './baseAbilities';
import { SU_EVENTS } from './types';
import { getBaseAbilityOptions, getExtendedBaseAbilityOptions, hasBaseAbility, triggerBaseAbility, triggerExtendedBaseAbility } from './baseAbilities';
import { createAbilityRuntimeExecutor, createEffectProgram } from './abilityRuntime';
import { registerTriggerProgramExecutor } from './triggerExecutors';

type BaseTriggerTimingAsTrigger = BaseTriggerTiming;

function requireQueuedBaseIndex(baseIndex: number | undefined, baseDefId: string, timing: string): number {
  if (baseIndex === undefined) {
    throw new Error(`SmashUp base ability queued trigger 缺少 baseIndex: ${baseDefId}@${timing}`);
  }
  return baseIndex;
}

function timingToTriggerTiming(timing: BaseTriggerTimingAsTrigger): import('./ongoingEffects').TitanAwareTriggerTiming {
  return timing as unknown as import('./ongoingEffects').TitanAwareTriggerTiming;
}

export function registerBaseAbilityAsQueuedTrigger(
  baseDefId: string,
  timing: BaseTriggerTimingAsTrigger,
): void {
  registerTriggerProgramExecutor(
    baseDefId,
    timingToTriggerTiming(timing),
    createAbilityRuntimeExecutor(
      createEffectProgram((ctx: any) => {
        const baseIndex = requireQueuedBaseIndex(ctx.baseIndex as number | undefined, baseDefId, timing);
        const baseCtx: BaseAbilityContext = {
          state: ctx.state,
          matchState: ctx.matchState,
          random: ctx.random,
          baseIndex,
          baseDefId: baseDefId,
          playerId: ctx.playerId,
          minionUid: ctx.triggerMinionUid,
          minionDefId: ctx.triggerMinionDefId,
          minionPower: ctx.triggerMinionPower,
          rankings: ctx.rankings,
          actionTargetBaseIndex: ctx.actionTargetBaseIndex,
          actionTargetType: ctx.actionTargetType,
          actionTargetMinionUid: ctx.actionTargetMinionUid,
          now: ctx.now,
        };
        return triggerBaseAbility(baseDefId, timing, baseCtx);
      }),
    ),
  );
}

export function collectBaseAbilityTriggers(params: {
  core: SmashUpCore;
  timing: BaseTriggerTimingAsTrigger;
  /** who the rules say is the reacting/deciding player for ordering */
  ownerPlayerId: PlayerId;
  /** base ability context */
  baseIndex: number;
  triggerMinionUid?: string;
  triggerMinionDefId?: string;
  triggerMinionPower?: number;
  rankings?: { playerId: PlayerId; power: number; vp: number }[];
  actionTargetBaseIndex?: number;
  actionTargetType?: 'base' | 'minion';
  actionTargetMinionUid?: string;
  frameId?: string;
  sourceEventId?: string;
  now: number;
}): TriggerQueuedEvent | undefined {
  const {
    core,
    timing,
    ownerPlayerId,
    baseIndex,
    triggerMinionUid,
    triggerMinionDefId,
    triggerMinionPower,
    rankings,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    frameId,
    sourceEventId,
    now,
  } = params;

  const base = core.bases[baseIndex];
  if (!base) return undefined;

  if (!hasBaseAbility(base.defId, timing)) return undefined;
  const options = getBaseAbilityOptions(base.defId, timing);
  // Witness rule (base as source): it must still be in play when the trigger is queued.
  // Since we are queueing from the live bases array, this is satisfied here.

  const mandatory = options?.mandatory ?? true;
  const t: TriggerInstance = {
    id: `${timing}:${base.defId}:${now}:0`,
    timing: timingToTriggerTiming(timing),
    sourceDefId: base.defId,
    sourceControllerId: undefined,
    sourceBaseIndex: baseIndex,
    mandatory,
    resolutionClass: mandatory ? 'mandatory' : 'optional',
    frameId: frameId ?? `${timing}:${sourceEventId ?? now}`,
    sourceEventId: sourceEventId ?? `${timing}:${now}`,
    ownerPlayerId,
    witnessRequirement: 'inPlayAtTriggerTime',
    witnessed: true,
    orderingFootprint: options?.orderingFootprint,
    baseIndex,
    triggerMinionUid,
    triggerMinionDefId,
    triggerMinionPower,
    rankings,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    lkiBase: { baseIndex, defId: base.defId },
  };

  return {
    type: SU_EVENTS.TRIGGER_QUEUED,
    payload: { triggers: [t] },
    timestamp: now,
  } as unknown as TriggerQueuedEvent;
}

export function registerExtendedBaseAbilityAsQueuedTrigger(
  baseDefId: string,
  timing: string,
): void {
  registerTriggerProgramExecutor(
    baseDefId,
    timingToTriggerTiming(timing as any),
    createAbilityRuntimeExecutor(
      createEffectProgram((ctx: any) => {
        const baseIndex = requireQueuedBaseIndex(ctx.baseIndex as number | undefined, baseDefId, timing);
        const baseCtx: BaseAbilityContext = {
          state: ctx.state,
          matchState: ctx.matchState,
          random: ctx.random,
          baseIndex,
          baseDefId,
          playerId: ctx.playerId,
          minionUid: ctx.triggerMinionUid,
          minionDefId: ctx.triggerMinionDefId,
          minionPower: ctx.triggerMinionPower,
          rankings: ctx.rankings,
          actionTargetBaseIndex: ctx.actionTargetBaseIndex,
          actionTargetType: ctx.actionTargetType,
          actionTargetMinionUid: ctx.actionTargetMinionUid,
          now: ctx.now,
        };
        return triggerExtendedBaseAbility(baseDefId, timing, baseCtx);
      }),
    ),
  );
}

export function collectExtendedBaseAbilityTriggers(params: {
  core: SmashUpCore;
  timing: string;
  ownerPlayerId: PlayerId;
  baseIndex: number;
  frameId?: string;
  sourceEventId?: string;
  now: number;
}): TriggerQueuedEvent | undefined {
  const { core, timing, ownerPlayerId, baseIndex, frameId, sourceEventId, now } = params;
  const base = core.bases[baseIndex];
  if (!base) return undefined;
  const opts = getExtendedBaseAbilityOptions(base.defId, timing);
  if (!opts) return undefined;

  // Ensure executor exists for queue consumption.
  registerExtendedBaseAbilityAsQueuedTrigger(base.defId, timing);

  const mandatory = opts.mandatory ?? true;
  const t: TriggerInstance = {
    id: `${timing}:${base.defId}:${now}:0`,
    timing: timingToTriggerTiming(timing as any),
    sourceDefId: base.defId,
    sourceControllerId: undefined,
    sourceBaseIndex: baseIndex,
    mandatory,
    resolutionClass: mandatory ? 'mandatory' : 'optional',
    frameId: frameId ?? `${timing}:${sourceEventId ?? now}`,
    sourceEventId: sourceEventId ?? `${timing}:${now}`,
    ownerPlayerId,
    witnessRequirement: 'inPlayAtTriggerTime',
    witnessed: true,
    orderingFootprint: opts.orderingFootprint,
    baseIndex,
    lkiBase: { baseIndex, defId: base.defId },
  };

  return {
    type: SU_EVENTS.TRIGGER_QUEUED,
    payload: { triggers: [t] },
    timestamp: now,
  } as any;
}
