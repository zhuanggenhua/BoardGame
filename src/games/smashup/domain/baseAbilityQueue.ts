import type { PlayerId } from '../../../engine/types';
import type { SmashUpCore, TriggerQueuedEvent, TriggerInstance } from './types';
import type { BaseAbilityContext, BaseTriggerTiming } from './baseAbilities';
import { SU_EVENTS } from './types';
import {
  getBaseAbilityExecutor,
  getBaseAbilityOptions,
  getExtendedBaseAbilityExecutor,
  getExtendedBaseAbilityOptions,
  hasBaseAbility } from './baseAbilities';
import { createAbilityRuntimeExecutor, createEffectProgram } from './abilityRuntime';
import { isBaseAbilitySuppressed } from './ongoingEffects';
import type { TitanAwareTriggerTiming, TriggerContext } from './ongoingEffects';
import { registerTriggerProgramExecutor } from './triggerExecutors';

type BaseTriggerTimingAsTrigger = BaseTriggerTiming;
type QueuedBaseTriggerContext = TriggerContext & { triggerMinionPower?: number };

function cloneReactionFootprint(
  footprint: import('./types').SmashUpReactionResourceFootprint | undefined,
): import('./types').SmashUpReactionResourceFootprint | undefined {
  if (!footprint) return undefined;
  return {
    reads: [...footprint.reads],
    writes: [...footprint.writes],
    ...(footprint.opensInteraction ? { opensInteraction: true } : {}),
    ...(footprint.fallbackReason ? { fallbackReason: footprint.fallbackReason } : {}),
  };
}

function cloneEffectContractWithBaseSourceContext(
  footprint: import('./types').SmashUpReactionResourceFootprint | undefined,
  baseIndex: number,
): import('./types').SmashUpReactionResourceFootprint | undefined {
  const cloned = cloneReactionFootprint(footprint);
  if (!cloned) return undefined;
  const alreadyReadsBase = cloned.reads.some(ref => ref.kind === 'base' && ref.index === baseIndex);
  return alreadyReadsBase
    ? cloned
    : {
        ...cloned,
        reads: [...cloned.reads, { kind: 'base' as const, index: baseIndex }],
      };
}

function mergeDerivedFootprint(
  primary: import('./types').SmashUpReactionResourceFootprint | undefined,
  secondary: import('./types').SmashUpReactionResourceFootprint | undefined,
): import('./types').SmashUpReactionResourceFootprint | undefined {
  if (!primary) return cloneReactionFootprint(secondary);
  if (!secondary) return cloneReactionFootprint(primary);
  return {
    reads: [...primary.reads, ...secondary.reads],
    writes: [...primary.writes, ...secondary.writes],
    ...(primary.opensInteraction || secondary.opensInteraction ? { opensInteraction: true } : {}),
    ...(primary.fallbackReason ?? secondary.fallbackReason
      ? { fallbackReason: primary.fallbackReason ?? secondary.fallbackReason }
      : {}),
  };
}

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
  const triggerTiming = timingToTriggerTiming(timing);
  const executor = getBaseAbilityExecutor(baseDefId, timing);
  const queuedTriggerCallback = (ctx: QueuedBaseTriggerContext) => {
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
      destroyerId: ctx.destroyerId,
      controllerId: ctx.controllerId,
      reason: ctx.reason,
      rankings: ctx.rankings ? structuredClone(ctx.rankings) : undefined,
      actionTargetBaseIndex: ctx.actionTargetBaseIndex,
      actionTargetType: ctx.actionTargetType,
      actionTargetMinionUid: ctx.actionTargetMinionUid,
      triggerCardUid: ctx.triggerCardUid,
      triggerCardDefId: ctx.triggerCardDefId,
      triggerCardOwnerId: ctx.triggerCardOwnerId,
      frameId: ctx.frameId,
      sourceEventId: ctx.sourceEventId,
      now: ctx.now } as BaseAbilityContext;
    if (!executor) return { events: [] };
    return executor(baseCtx);
  };
  const triggerCallback = (ctx: QueuedBaseTriggerContext) => {
    const baseIndex = requireQueuedBaseIndex(ctx.baseIndex as number | undefined, baseDefId, timing);
    if (isBaseAbilitySuppressed(ctx.state, baseIndex)) return { events: [] };
    return queuedTriggerCallback(ctx);
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
  triggerMinionFromDeck?: boolean;
  destroyerId?: PlayerId;
  controllerId?: PlayerId;
  reason?: string;
  rankings?: { playerId: PlayerId; power: number; vp: number }[];
  actionTargetBaseIndex?: number;
  actionTargetType?: 'base' | 'minion';
  actionTargetMinionUid?: string;
  triggerCardUid?: string;
  triggerCardDefId?: string;
  triggerCardOwnerId?: PlayerId;
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
    triggerMinionFromDeck,
    destroyerId,
    controllerId,
    reason,
    rankings,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    triggerCardUid,
    triggerCardDefId,
    triggerCardOwnerId,
    frameId,
    sourceEventId,
    now } = params;

  const base = core.bases[baseIndex];
  if (!base) return undefined;

  if (!hasBaseAbility(base.defId, timing)) return undefined;
  const options = getBaseAbilityOptions(base.defId, timing);
  const optionContext = {
    state: core,
    baseIndex,
    baseDefId: base.defId,
    playerId: ownerPlayerId,
    minionUid: triggerMinionUid,
    minionDefId: triggerMinionDefId,
    minionPower: triggerMinionPower,
    triggerMinionFromDeck,
    destroyerId,
    controllerId,
    reason,
    rankings: rankings ? structuredClone(rankings) : undefined,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    triggerCardUid,
    triggerCardDefId,
    triggerCardOwnerId,
    frameId,
    sourceEventId,
    now };
  const resolvedOwnerPlayerId = options?.ownerPlayerId?.(optionContext) ?? ownerPlayerId;
  if (!core.turnOrder.includes(resolvedOwnerPlayerId)) return undefined;
  const resolvedOptionContext = {
    ...optionContext,
    playerId: resolvedOwnerPlayerId,
  };
  if (options?.canTrigger && !options.canTrigger(resolvedOptionContext)) {
    return undefined;
  }
  const explicitDerivedFootprint = mergeDerivedFootprint(
    cloneEffectContractWithBaseSourceContext(options?.effectContract, baseIndex),
    options?.deriveFootprint?.(resolvedOptionContext),
  );
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
    ownerPlayerId: resolvedOwnerPlayerId,
    witnessRequirement: 'inPlayAtTriggerTime',
    witnessed: true,
    baseIndex,
    triggerMinionUid,
    triggerMinionDefId,
    triggerMinionPower,
    triggerMinionFromDeck,
    destroyerId,
    controllerId,
    reason,
    rankings: rankings ? structuredClone(rankings) : undefined,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    triggerCardUid,
    triggerCardDefId,
    triggerCardOwnerId,
    ...(explicitDerivedFootprint
      ? {
          derivedFootprint: explicitDerivedFootprint,
        }
      : {}),
    lkiBase: { baseIndex, defId: base.defId } };

  return {
    type: SU_EVENTS.TRIGGER_QUEUED,
    payload: { triggers: [t] },
    timestamp: now } as unknown as TriggerQueuedEvent;
}

export function registerExtendedBaseAbilityAsQueuedTrigger(
  baseDefId: string,
  timing: string,
): void {
  const triggerTiming = timingToTriggerTiming(timing);
  const executor = getExtendedBaseAbilityExecutor(baseDefId, timing);
  const queuedTriggerCallback = (ctx: QueuedBaseTriggerContext) => {
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
      destroyerId: ctx.destroyerId,
      controllerId: ctx.controllerId,
      reason: ctx.reason,
      rankings: ctx.rankings ? structuredClone(ctx.rankings) : undefined,
      actionTargetBaseIndex: ctx.actionTargetBaseIndex,
      actionTargetType: ctx.actionTargetType,
      actionTargetMinionUid: ctx.actionTargetMinionUid,
      triggerCardUid: ctx.triggerCardUid,
      triggerCardDefId: ctx.triggerCardDefId,
      triggerCardOwnerId: ctx.triggerCardOwnerId,
      frameId: ctx.frameId,
      sourceEventId: ctx.sourceEventId,
      now: ctx.now };
    if (!executor) return { events: [] };
    return executor(baseCtx);
  };
  const triggerCallback = (ctx: QueuedBaseTriggerContext) => {
    const baseIndex = requireQueuedBaseIndex(ctx.baseIndex as number | undefined, baseDefId, timing);
    if (isBaseAbilitySuppressed(ctx.state, baseIndex)) return { events: [] };
    return queuedTriggerCallback(ctx);
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
  triggerMinionUid?: string;
  triggerMinionDefId?: string;
  triggerMinionPower?: number;
  triggerMinionFromDeck?: boolean;
  destroyerId?: PlayerId;
  controllerId?: PlayerId;
  reason?: string;
  actionTargetBaseIndex?: number;
  actionTargetType?: 'base' | 'minion';
  actionTargetMinionUid?: string;
  triggerCardUid?: string;
  triggerCardDefId?: string;
  triggerCardOwnerId?: PlayerId;
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
    triggerMinionFromDeck,
    destroyerId,
    controllerId,
    reason,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    triggerCardUid,
    triggerCardDefId,
    triggerCardOwnerId,
    frameId,
    sourceEventId,
    now,
  } = params;
  const base = core.bases[baseIndex];
  if (!base) return undefined;
  const opts = getExtendedBaseAbilityOptions(base.defId, timing);
  if (!opts) return undefined;
  const optionContext = {
    state: core,
    baseIndex,
    baseDefId: base.defId,
    playerId: ownerPlayerId,
    minionUid: triggerMinionUid,
    minionDefId: triggerMinionDefId,
    minionPower: triggerMinionPower,
    triggerMinionFromDeck,
    destroyerId,
    controllerId,
    reason,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    triggerCardUid,
    triggerCardDefId,
    triggerCardOwnerId,
    frameId,
    sourceEventId,
    now,
  };
  const resolvedOwnerPlayerId = opts.ownerPlayerId?.(optionContext) ?? ownerPlayerId;
  if (!core.turnOrder.includes(resolvedOwnerPlayerId)) return undefined;
  const resolvedOptionContext = {
    ...optionContext,
    playerId: resolvedOwnerPlayerId,
  };
  if (opts.canTrigger && !opts.canTrigger(resolvedOptionContext)) {
    return undefined;
  }
  const explicitDerivedFootprint = mergeDerivedFootprint(
    cloneEffectContractWithBaseSourceContext(opts.effectContract, baseIndex),
    opts.deriveFootprint?.(resolvedOptionContext),
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
    ownerPlayerId: resolvedOwnerPlayerId,
    witnessRequirement: 'inPlayAtTriggerTime',
    witnessed: true,
    baseIndex,
    triggerMinionUid,
    triggerMinionDefId,
    triggerMinionPower,
    triggerMinionFromDeck,
    destroyerId,
    controllerId,
    reason,
    actionTargetBaseIndex,
    actionTargetType,
    actionTargetMinionUid,
    triggerCardUid,
    triggerCardDefId,
    triggerCardOwnerId,
    ...(explicitDerivedFootprint
      ? {
          derivedFootprint: explicitDerivedFootprint,
        }
      : {}),
    lkiBase: { baseIndex, defId: base.defId } };

  return {
    type: SU_EVENTS.TRIGGER_QUEUED,
    payload: { triggers: [t] },
    timestamp: now } as unknown as TriggerQueuedEvent;
}
