/**
 * 召唤师战争 - 先锋军团技能执行器
 */

import type { GameEvent } from '../../../../engine/types';
import type { UnitCard } from '../types';
import { SW_EVENTS } from '../types';
import { isFortressUnit } from '../ids';
import { abilityExecutorRegistry } from './registry';
import type { SWAbilityContext } from './types';

/** 城塞之力 */
abilityExecutorRegistry.register('fortress_power', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, payload, ownerId: playerId, timestamp } = ctx;
  const targetCardId = payload.targetCardId as string | undefined;
  if (!targetCardId) return { events };

  const fpPlayer = core.players[playerId as '0' | '1'];
  const fpCard = fpPlayer.discard.find(c => c.id === targetCardId);
  if (!fpCard || fpCard.cardType !== 'unit') return { events };
  if (!isFortressUnit(fpCard as UnitCard)) return { events };

  events.push({
    type: SW_EVENTS.CARD_RETRIEVED,
    payload: { playerId, cardId: targetCardId, source: 'discard' },
    timestamp,
  });
  return { events };
});

/** 指引 */
abilityExecutorRegistry.register('guidance', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, ownerId: playerId, timestamp } = ctx;
  const guidancePlayer = core.players[playerId as '0' | '1'];
  const guidanceDraw = Math.min(2, guidancePlayer.deck.length);

  if (guidanceDraw > 0) {
    events.push({
      type: SW_EVENTS.CARD_DRAWN,
      payload: { playerId, count: guidanceDraw },
      timestamp,
    });
  }
  return { events };
});

/** 圣光箭 */
abilityExecutorRegistry.register('holy_arrow', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const discardCardIds = payload.discardCardIds as string[] | undefined;
  if (!discardCardIds || discardCardIds.length === 0) return { events };

  const haPlayer = core.players[playerId as '0' | '1'];
  const validDiscards = discardCardIds.filter(id => haPlayer.hand.some(c => c.id === id));
  if (validDiscards.length > 0) {
    events.push({
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId, delta: validDiscards.length },
      timestamp,
    });
    for (const cardId of validDiscards) {
      events.push({
        type: SW_EVENTS.CARD_DISCARDED,
        payload: { playerId, cardId },
        timestamp,
      });
    }
    events.push({
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: sourcePosition, delta: validDiscards.length },
      timestamp,
    });
  }
  return { events };
});

/** 治疗 */
abilityExecutorRegistry.register('healing', (ctx: SWAbilityContext) => {
  const events: GameEvent[] = [];
  const { core, sourceUnit, sourcePosition, payload, ownerId: playerId, timestamp } = ctx;
  const healDiscardId = payload.targetCardId as string | undefined;
  if (!healDiscardId) return { events };

  const healPlayer = core.players[playerId as '0' | '1'];
  if (!healPlayer.hand.some(c => c.id === healDiscardId)) return { events };

  events.push({
    type: SW_EVENTS.CARD_DISCARDED,
    payload: { playerId, cardId: healDiscardId },
    timestamp,
  });
  events.push({
    type: SW_EVENTS.HEALING_MODE_SET,
    payload: { position: sourcePosition, unitId: sourceUnit.instanceId },
    timestamp,
  });
  return { events };
});
