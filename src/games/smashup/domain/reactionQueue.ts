import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { SmashUpCore, SmashUpEvent, TriggerConsumedEvent, TriggerInstance } from './types';
import { SU_EVENTS } from './types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getCurrentPlayerId } from './types';
import { getTriggerExecutor } from './triggerExecutors';
import { reduce } from './reduce';
import { getBaseDef, getCardDef } from '../data/cards';

function getClockwiseOrder(turnOrder: PlayerId[], startingPlayerId: PlayerId): PlayerId[] {
  const idx = turnOrder.indexOf(startingPlayerId);
  if (idx < 0) return [...turnOrder];
  return [...turnOrder.slice(idx), ...turnOrder.slice(0, idx)];
}

function chooseNextTriggerOwner(core: SmashUpCore): PlayerId {
  const pending = core.triggerQueue ?? [];
  const current = getCurrentPlayerId(core);

  // Wiki: mandatory triggers resolve first, ordered by current player.
  // We model this by making the current player the decider whenever any pending trigger is mandatory.
  if (pending.some(t => t.mandatory)) {
    return current;
  }

  // Wiki: optional triggers are offered in clockwise order starting from current player.
  // We approximate this by letting the first player in clockwise order who owns any pending trigger decide.
  const order = getClockwiseOrder(core.turnOrder ?? [], current);
  for (const pid of order) {
    if (pending.some(t => t.ownerPlayerId === pid)) return pid;
  }
  return current;
}

function getReactionTimingLabelKey(timing: TriggerInstance['timing']): string {
  switch (timing) {
    case 'onMinionPlayed':
    case 'onActionPlayed':
    case 'onBaseRevealed':
    case 'onMinionDestroyed':
    case 'onMinionMoved':
    case 'onMinionAffected':
    case 'onMinionDiscardedFromBase':
    case 'onTurnEnd':
    case 'onTurnStart':
    case 'beforeScoring':
    case 'afterScoring':
      return `ui.reaction_timing.${timing}`;
    default:
      return 'ui.reaction_timing.unknown';
  }
}

function buildReactionQueueOptionLabel(trigger: TriggerInstance): string {
  const sourceDef = getCardDef(trigger.sourceDefId) ?? getBaseDef(trigger.sourceDefId);
  const sourceLabel = sourceDef ? `cards.${trigger.sourceDefId}.name` : trigger.sourceDefId;
  return `${sourceLabel} · ${getReactionTimingLabelKey(trigger.timing)}`;
}

export function maybeResolveReactionQueue(
  state: MatchState<SmashUpCore>,
  random: RandomFn,
  now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
  const core = state.core;
  const pending = core.triggerQueue ?? [];
  if (pending.length === 0) return undefined;

  // if only one trigger, execute directly
  if (pending.length === 1) {
    const t = pending[0];
    const exec = getTriggerExecutor(t.timing, t.sourceDefId);
    const consumed: TriggerConsumedEvent = {
      type: SU_EVENTS.TRIGGER_CONSUMED,
      payload: { triggerId: t.id },
      timestamp: now,
    };
    const events: SmashUpEvent[] = [consumed];
    const coreAfterConsume = reduce(core, consumed as unknown as SmashUpEvent);
    if (exec) {
      const result = exec({
        state: coreAfterConsume,
        matchState: { ...state, core: coreAfterConsume },
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
        triggerMinionPower: t.triggerMinionPower,
        destroyerId: t.destroyerId,
        triggerMinion: t.lkiMinion
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
          : undefined,
        reason: t.reason,
        affectType: t.affectType,
        actionTargetBaseIndex: t.actionTargetBaseIndex,
        actionTargetType: (t as any).actionTargetType,
        actionTargetMinionUid: t.actionTargetMinionUid,
        random,
        now,
      } as any);
      const evts = Array.isArray(result) ? result : result.events;
      events.push(...evts);
      const ms = (!Array.isArray(result) && result.matchState) ? result.matchState : undefined;
      return { state: ms ?? { ...state, core: coreAfterConsume }, events };
    }
    return { state: { ...state, core: coreAfterConsume }, events };
  }

  // if any interaction is already pending, don't interfere (multi-trigger ordering needs a prompt)
  if (state.sys.interaction?.current) return undefined;

  // choose who decides ordering at this step
  const decider = chooseNextTriggerOwner(core);

  // multiple triggers: ask decider to choose next trigger to resolve
  const options = pending
    .filter(t => t.mandatory ? decider === getCurrentPlayerId(core) : t.ownerPlayerId === decider)
    .map(t => ({
      id: t.id,
      label: buildReactionQueueOptionLabel(t),
      value: { triggerId: t.id },
      displayMode: 'button' as const,
    }));
  if (options.length === 0) return undefined;

  const interaction = createSimpleChoice(
    `reaction_queue_${now}`,
    decider,
    '选择要结算的反应（同时触发排序）',
    options,
    { sourceId: 'reaction_queue_choose_next', targetType: 'button' },
  );
  return { state: queueInteraction(state, interaction), events: [] };
}
