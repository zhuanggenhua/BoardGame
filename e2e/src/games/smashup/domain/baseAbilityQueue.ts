import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, TriggerQueuedEvent, TriggerInstance } from './types';
import type { BaseAbilityContext, BaseTriggerTiming } from './baseAbilities';
import { SU_EVENTS } from './types';
import {
  getBaseAbilityExecutor,
  getBaseAbilityOptions,
  getExtendedBaseAbilityExecutor,
  getExtendedBaseAbilityOptions,
  hasBaseAbility,
} from './baseAbilities';
import { createAbilityRuntimeExecutor, createEffectProgram } from './abilityRuntime';
import { isBaseAbilitySuppressed } from './ongoingEffects';
import type { TitanAwareTriggerTiming, TriggerContext } from './ongoingEffects';
import { requireTriggerEffectContract, wrapTriggerCallbackWithEffectContract } from './triggerEffectContract';
import { registerTriggerProgramExecutor } from './triggerExecutors';

type BaseTriggerTimingAsTrigger = BaseTriggerTiming;
type QueuedBaseTriggerContext = TriggerContext & { triggerMinionPower?: number };

function requireQueuedBaseIndex(baseIndex: number | undefined, baseDefId: string, timing: string): number {
  if (baseIndex === undefined) {
    throw new Error(`SmashUp base ability queued trigger 缺少 baseIndex: ${baseDefId}@${timing}`);
  }
  return baseIndex;
}

function timingToTriggerTiming(timing: BaseTriggerTimingAsTrigger | string): TitanAwareTriggerTiming {
  return timing as TitanAwareTriggerTiming;
}

export function registerBaseAbilityAsQueuedTrigger(
  baseDefId: string,
  timing: BaseTriggerTimingAsTrigger,
): void {
  const options = getBaseAbilityOptions(baseDefId, timing);
  const triggerTiming = timingToTriggerTiming(timing);
  const executor = getBaseAbilityExecutor(baseDefId, timing);
  const declaredContract = requireTriggerEffectContract(
    baseDefId,
    triggerTiming,
    options?.effectContract,
    'baseAbility.registerQueued',
  );
  const guardedTriggerCallback = wrapTriggerCallbackWithEffectContract(
    baseDefId,
    triggerTiming,
    (ctx: QueuedBaseTriggerContext) => {
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
        frameId: ctx.frameId,
        sourceEventId: ctx.sourceEventId,
        now: ctx.now,
      } as BaseAbilityContext;
      if (!executor) return { events: [] };
      return executor(baseCtx);
    },
    declaredContract,
  );
  const triggerCallback = (ctx: QueuedBaseTriggerContext) => {
    const baseIndex = requireQueuedBaseIndex(ctx.baseIndex as number | undefined, baseDefId, timing);
    if (isBaseAbilitySuppressed(ctx.state, baseIndex)) return { events: [] };
    return guardedTriggerCallback(ctx);
  };
  registerTriggerProgramExecutor(
    baseDefId,
    triggerTiming,
    createAbilityRuntimeExecutor(
      createEffectProgram(triggerCallback),
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
  const effectContract = requireTriggerEffectContract(
    base.defId,
    timingToTriggerTiming(timing),
    options?.effectContract,
    'collectTriggers',
  );
  if (options?.canTrigger && !options.canTrigger({
    state: core,
    baseIndex,
    baseDefId: base.defId,
    playerId: ownerPlayerId,
    minionUid: triggerMinionUid,
    minionDefId: triggerMinionDefId,
    minionPower: triggerMinionPower,
    rankings,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    now,
  })) {
    return undefined;
  }
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
    effectContract,
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
  const options = getExtendedBaseAbilityOptions(baseDefId, timing);
  const triggerTiming = timingToTriggerTiming(timing);
  const executor = getExtendedBaseAbilityExecutor(baseDefId, timing);
  const declaredContract = requireTriggerEffectContract(
    baseDefId,
    triggerTiming,
    options?.effectContract,
    'extendedBaseAbility.registerQueued',
  );
  const guardedTriggerCallback = wrapTriggerCallbackWithEffectContract(
    baseDefId,
    triggerTiming,
    (ctx: QueuedBaseTriggerContext) => {
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
      if (!executor) return { events: [] };
      return executor(baseCtx);
    },
    declaredContract,
  );
  const triggerCallback = (ctx: QueuedBaseTriggerContext) => {
    const baseIndex = requireQueuedBaseIndex(ctx.baseIndex as number | undefined, baseDefId, timing);
    if (isBaseAbilitySuppressed(ctx.state, baseIndex)) return { events: [] };
    return guardedTriggerCallback(ctx);
  };
  registerTriggerProgramExecutor(
    baseDefId,
    triggerTiming,
    createAbilityRuntimeExecutor(
      createEffectProgram(triggerCallback),
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
  const effectContract = requireTriggerEffectContract(
    base.defId,
    timingToTriggerTiming(timing),
    opts.effectContract,
    'collectTriggers',
  );

  // Ensure executor exists for queue consumption.
  registerExtendedBaseAbilityAsQueuedTrigger(base.defId, timing);

  const mandatory = opts.mandatory ?? true;
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
    effectContract,
    baseIndex,
    lkiBase: { baseIndex, defId: base.defId },
  };

  return {
    type: SU_EVENTS.TRIGGER_QUEUED,
    payload: { triggers: [t] },
    timestamp: now,
  } as unknown as TriggerQueuedEvent;
}
