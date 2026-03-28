import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, TriggerConsumedEvent } from './types';
import { SU_EVENTS } from './types';
import { getTriggerExecutor } from './triggerExecutors';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { reduce } from './reduce';

export function registerReactionQueueInteractionHandlers(): void {
  registerInteractionHandler('reaction_queue_choose_next', (state, _playerId, value, _iData, random, timestamp) => {
    const { triggerId } = (value ?? {}) as { triggerId?: string };
    if (!triggerId) return { state, events: [] };
    const core = state.core;
    const pending = core.triggerQueue ?? [];
    const t = pending.find(x => x.id === triggerId);
    if (!t) return { state, events: [] };

    const consumed: TriggerConsumedEvent = {
      type: SU_EVENTS.TRIGGER_CONSUMED,
      payload: { triggerId },
      timestamp,
    };
    const exec = getTriggerExecutor(t.timing, t.sourceDefId);
    const events: SmashUpEvent[] = [consumed];
    const coreAfterConsume = reduce(core, consumed as unknown as SmashUpEvent);
    let state2: MatchState<SmashUpCore> = coreAfterConsume === core ? state : { ...state, core: coreAfterConsume };
    if (!exec) return { state: state2, events };

    const lkiTriggerMinion = t.lkiMinion
      ? {
        uid: t.lkiMinion.uid,
        defId: t.lkiMinion.defId,
        owner: t.lkiMinion.owner,
        controller: t.lkiMinion.controller,
        basePower: t.lkiMinion.basePower,
        powerCounters: t.lkiMinion.powerCounters,
        powerModifier: t.lkiMinion.powerModifier,
        tempPowerModifier: t.lkiMinion.tempPowerModifier,
        talentUsed: false,
        attachedActions: [],
      }
      : undefined;

    const result = exec({
      state: coreAfterConsume,
      matchState: state2,
      timing: t.timing,
      sourceCardUid: t.sourceCardUid,
      sourceBaseIndex: t.sourceBaseIndex,
      sourceControllerId: t.sourceControllerId,
      playerId: t.ownerPlayerId,
      baseIndex: t.baseIndex,
      moveFromBaseIndex: t.moveFromBaseIndex,
      moveToBaseIndex: t.moveToBaseIndex,
      rankings: t.rankings,
      triggerMinionUid: t.triggerMinionUid,
      triggerMinionDefId: t.triggerMinionDefId,
      triggerMinionPower: (t as any).triggerMinionPower,
      destroyerId: t.destroyerId,
      triggerMinion: lkiTriggerMinion,
      reason: t.reason,
      affectType: t.affectType,
      actionTargetBaseIndex: (t as any).actionTargetBaseIndex,
      actionTargetType: (t as any).actionTargetType,
      actionTargetMinionUid: (t as any).actionTargetMinionUid,
      random: random as RandomFn,
      now: timestamp,
    } as any);

    const evts = Array.isArray(result) ? result : result.events;
    events.push(...evts);
    const nextState = (!Array.isArray(result) && result.matchState) ? result.matchState : state2;
    return { state: nextState, events };
  });
}

