import type { GameEvent } from '../../../engine/types';
import type { BoardUnit, CellCoord, EventCard, PlayerId, SummonerWarsCore } from './types';
import { SW_EVENTS } from './types';
import { triggerAbilities } from './abilityResolver';
import {
  findUnitByInstanceId,
  getPlayerUnits,
  getSummoner,
  getUnitAbilities,
  manhattanDistance,
  normalizeUnitBoosts,
} from './helpers';
import { getBaseCardId, CARD_IDS } from './ids';
import { reduceEvent } from './reduce';
import { createAbilityTriggeredEvent } from './execute/helpers';

function isActiveEvent(core: SummonerWarsCore, playerId: PlayerId, cardId: string, baseId: string): boolean {
  return core.players[playerId].activeEvents.some(event =>
    event.id === cardId && getBaseCardId(event.id) === baseId
  );
}

function getActiveEventsByBaseId(core: SummonerWarsCore, playerId: PlayerId, baseId: string) {
  return core.players[playerId].activeEvents.filter(event => getBaseCardId(event.id) === baseId);
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === '0' ? '1' : '0';
}

function getContinuanceSummoner(core: SummonerWarsCore, playerId: PlayerId): BoardUnit | undefined {
  const summoner = getSummoner(core, playerId);
  if (!summoner) return undefined;
  if (!getUnitAbilities(summoner, core).includes('yongheng_continuance')) return undefined;
  if (normalizeUnitBoosts(summoner.boosts) < 2) return undefined;
  return summoner;
}

export function interceptYonghengContinuanceEvent(
  core: SummonerWarsCore,
  event: GameEvent,
): GameEvent | GameEvent[] | null {
  if (event.type !== SW_EVENTS.ACTIVE_EVENT_DISCARDED) return event;
  const payload = event.payload as {
    playerId?: PlayerId;
    cardId?: string;
    yonghengContinuanceResolved?: boolean;
  };
  if (!payload.playerId || !payload.cardId || payload.yonghengContinuanceResolved) return event;
  const player = core.players[payload.playerId];
  const activeEvent = player?.activeEvents.find(card => card.id === payload.cardId);
  if (!activeEvent) return event;
  const summoner = getContinuanceSummoner(core, payload.playerId);
  if (!summoner) return event;

  return createAbilityTriggeredEvent(
    'yongheng_continuance',
    summoner.instanceId,
    summoner.position,
    event.timestamp ?? 0,
    {
      actionId: 'yongheng_continuance_retain',
      targetOwner: payload.playerId,
      targetCardId: activeEvent.id,
    },
  );
}

function reserveLearningEvent(
  core: SummonerWarsCore,
  playerId: PlayerId,
  reservedCharges: Map<string, number>,
): EventCard | undefined {
  for (const learning of getActiveEventsByBaseId(core, playerId, CARD_IDS.YONGHENG_LEARNING)) {
    const key = `${playerId}:${learning.id}`;
    const remaining = normalizeUnitBoosts(learning.charges) - (reservedCharges.get(key) ?? 0);
    if (remaining <= 0) continue;
    reservedCharges.set(key, (reservedCharges.get(key) ?? 0) + 1);
    return learning;
  }
  return undefined;
}

function getLearningReclaimEvents(
  core: SummonerWarsCore,
  discardedOwner: PlayerId,
  discardedCardId: string,
  timestamp: number,
  reservedCharges: Map<string, number>,
): GameEvent[] {
  const learningOwner = opponentOf(discardedOwner);
  const learning = reserveLearningEvent(core, learningOwner, reservedCharges);
  if (!learning) return [];
  const reserved = reservedCharges.get(`${learningOwner}:${learning.id}`) ?? 1;
  const nextCharges = Math.max(0, normalizeUnitBoosts(learning.charges) - reserved);
  return [
    {
      type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
      payload: {
        playerId: learningOwner,
        eventCardId: learning.id,
        charges: nextCharges,
        sourceAbilityId: 'yongheng_learning',
      },
      timestamp,
    },
    {
      type: SW_EVENTS.CARD_RETRIEVED,
      payload: {
        playerId: discardedOwner,
        fromPlayerId: discardedOwner,
        toPlayerId: learningOwner,
        cardId: discardedCardId,
        sourceAbilityId: 'yongheng_learning',
        eventCardId: learning.id,
      },
      timestamp,
    },
  ];
}

export function getYonghengDefenderAfterAttackEvents(
  core: SummonerWarsCore,
  defender: BoardUnit | undefined,
  defenderPosition: CellCoord,
  attacker: BoardUnit,
  attackerPosition: CellCoord,
  timestamp: number,
): GameEvent[] {
  if (!defender || defender.owner === attacker.owner) return [];
  if (!getUnitAbilities(defender, core).includes('yongheng_kinetic_siphon')) return [];
  return triggerAbilities('afterAttack', {
    state: core,
    sourceUnit: defender,
    sourcePosition: defenderPosition,
    ownerId: defender.owner,
    targetUnit: attacker,
    targetPosition: attackerPosition,
    targetOwner: attacker.owner,
    timestamp,
  });
}

export function getYonghengPostProcessEvents(
  core: SummonerWarsCore,
  events: GameEvent[],
  timestamp: number,
): GameEvent[] {
  const extraEvents: GameEvent[] = [];
  let workingCore = core;
  const reservedLearningCharges = new Map<string, number>();

  for (const event of events) {
    if (event.type === SW_EVENTS.EVENT_PLAYED) {
      const payload = event.payload as {
        playerId?: PlayerId;
        cardId?: string;
        isActive?: boolean;
        isAttachment?: boolean;
        isStructureEvent?: boolean;
      };
      if (
        payload.playerId
        && payload.cardId
        && !payload.isActive
        && !payload.isAttachment
        && !payload.isStructureEvent
      ) {
        extraEvents.push(...getLearningReclaimEvents(
          workingCore,
          payload.playerId,
          payload.cardId,
          timestamp,
          reservedLearningCharges,
        ));
      }
    }

    if (event.type === SW_EVENTS.CARD_DRAWN) {
      const payload = event.payload as { playerId?: PlayerId; count?: number };
      if ((payload.count ?? 0) > 0 && payload.playerId) {
        for (const insight of getActiveEventsByBaseId(workingCore, payload.playerId, CARD_IDS.YONGHENG_INSIGHT)) {
          extraEvents.push({
            type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
            payload: {
              playerId: payload.playerId,
              eventCardId: insight.id,
              sourceAbilityId: 'yongheng_insight',
            },
            timestamp,
          });
        }
        if (
          payload.playerId === workingCore.currentPlayer
          && getActiveEventsByBaseId(workingCore, payload.playerId, CARD_IDS.YONGHENG_MENTAL_INVASION).length > 0
        ) {
          const summoner = getSummoner(workingCore, payload.playerId);
          if (summoner) {
            extraEvents.push(createAbilityTriggeredEvent(
              'yongheng_mental_invasion',
              summoner.instanceId,
              summoner.position,
              timestamp,
            ));
          }
        }
      }
    }

    if (event.type === SW_EVENTS.UNIT_MOVED) {
      const payload = event.payload as {
        unitId?: string;
        from?: CellCoord;
        to?: CellCoord;
      };
      if (payload.unitId && payload.to) {
        const movedUnit = findUnitByInstanceId(workingCore, payload.unitId);
        if (movedUnit) {
          const targetOwner = movedUnit.owner;
          const opponentId = targetOwner === '0' ? '1' : '0';
          if (workingCore.players[targetOwner].hand.length > 0) {
            const fearSource = getPlayerUnits(workingCore, opponentId).find(unit =>
              getUnitAbilities(unit, workingCore).includes('yongheng_arouse_fear')
              && manhattanDistance(unit.position, payload.to!) === 1
            );
            if (fearSource) {
              extraEvents.push(createAbilityTriggeredEvent(
                'yongheng_arouse_fear',
                fearSource.instanceId,
                fearSource.position,
                timestamp,
                {
                  actionId: 'yongheng_arouse_fear_discard',
                  targetOwner,
                },
              ));
            }
          }
        }
      }
    }

    if (event.type === SW_EVENTS.UNIT_SUMMONED) {
      const payload = event.payload as {
        playerId?: PlayerId;
        position?: CellCoord;
      };
      if (payload.playerId && payload.position && workingCore.players[payload.playerId].hand.length > 0) {
        const opponentId = payload.playerId === '0' ? '1' : '0';
        const punishSource = getPlayerUnits(workingCore, opponentId).find(unit =>
          getUnitAbilities(unit, workingCore).includes('yongheng_punish')
          && manhattanDistance(unit.position, payload.position!) <= 2
        );
        if (punishSource) {
          extraEvents.push(createAbilityTriggeredEvent(
            'yongheng_punish',
            punishSource.instanceId,
            punishSource.position,
            timestamp,
            {
              actionId: 'yongheng_punish_discard',
              targetOwner: payload.playerId,
            },
          ));
        }
      }
    }

    if (event.type === SW_EVENTS.ACTIVE_EVENT_DISCARDED) {
      const payload = event.payload as { playerId?: PlayerId; cardId?: string };
      if (payload.playerId && payload.cardId && isActiveEvent(workingCore, payload.playerId, payload.cardId, CARD_IDS.YONGHENG_LEARNING)) {
        const learning = workingCore.players[payload.playerId].activeEvents.find(activeEvent => activeEvent.id === payload.cardId);
        const charges = normalizeUnitBoosts(learning?.charges);
        const summoner = getSummoner(workingCore, payload.playerId);
        if (charges > 0 && summoner) {
          extraEvents.push({
            type: SW_EVENTS.UNIT_CHARGED,
            payload: {
              position: summoner.position,
              delta: charges,
              sourceAbilityId: 'yongheng_learning',
            },
            timestamp,
          });
        }
      }
      if (payload.playerId && payload.cardId) {
        extraEvents.push(...getLearningReclaimEvents(
          workingCore,
          payload.playerId,
          payload.cardId,
          timestamp,
          reservedLearningCharges,
        ));
      }
    }

    workingCore = reduceEvent(workingCore, event);
  }

  return extraEvents;
}
