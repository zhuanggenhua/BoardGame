import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent } from './types';
import { SU_EVENTS, STARTING_HAND_SIZE } from './types';
import type { InteractionHandler } from './abilityInteractionHandlers';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { drawCards } from './utils';
import type { CardsDiscardedEvent, CardsDrawnEvent, DeckReshuffledEvent, RevealHandEvent, StartingHandMulliganUsedEvent } from './types';

export const STARTING_HAND_MULLIGAN_SOURCE_ID = 'starting_hand_mulligan';

export function maybeQueueStartingHandMulliganPrompt(
  state: MatchState<SmashUpCore>,
  playerId: PlayerId,
  now: number,
): MatchState<SmashUpCore> {
  const interaction = createSimpleChoice(
    `${STARTING_HAND_MULLIGAN_SOURCE_ID}_${playerId}_${now}`,
    playerId,
    '起手无随从：是否重抽一次？（只能重抽一次）',
    [
      {
        id: 'keep',
        label: '保留手牌',
        labelKey: 'ui.starting_hand_mulligan_keep_option',
        value: { choice: 'keep' },
        displayMode: 'button' as const,
      },
      {
        id: 'mulligan',
        label: '重抽一次',
        labelKey: 'ui.starting_hand_mulligan_redraw_option',
        value: { choice: 'mulligan' },
        displayMode: 'button' as const,
      },
    ],
    {
      sourceId: STARTING_HAND_MULLIGAN_SOURCE_ID,
      targetType: 'generic',
      titleKey: 'ui.starting_hand_mulligan_title',
    },
  );
  return queueInteraction(state, interaction);
}

export function registerMulliganInteractionHandlers(): void {
  const handler: InteractionHandler = (state, playerId, value, _iData, random, timestamp) => {
    const core = state.core;
    const player = core.players[playerId];
    if (!player) return { state, events: [] };

    // one-time guard
    if (player.startingHandMulliganUsed) return { state, events: [] };

    const choice = (value as any)?.choice as 'keep' | 'mulligan' | undefined;
    if (!choice || choice === 'keep') {
      const used: StartingHandMulliganUsedEvent = {
        type: SU_EVENTS.STARTING_HAND_MULLIGAN_USED,
        payload: { playerId, used: false },
        timestamp,
      } as any;
      return { state, events: [used] };
    }

    // mulligan: reveal and discard the original no-minion hand, then draw a new hand.
    const originalHand = [...player.hand];
    const originalHandUids = originalHand.map(card => card.uid);
    const revealEvt: RevealHandEvent = {
      type: SU_EVENTS.REVEAL_HAND,
      payload: {
        targetPlayerId: playerId,
        viewerPlayerId: 'all',
        sourcePlayerId: playerId,
        cards: originalHand.map(card => ({ uid: card.uid, defId: card.defId })),
        reason: STARTING_HAND_MULLIGAN_SOURCE_ID,
      },
      timestamp,
    };
    const discardEvt: CardsDiscardedEvent = {
      type: SU_EVENTS.CARDS_DISCARDED,
      payload: { playerId, cardUids: originalHandUids },
      timestamp: timestamp + 1,
    };
    const ownDiscardedCards = originalHand.filter(card => (core.players[card.owner] ? card.owner : playerId) === playerId);
    const drawSourcePlayer = {
      ...player,
      hand: [],
      discard: [...player.discard, ...ownDiscardedCards],
    };
    const drawResult = drawCards(drawSourcePlayer, STARTING_HAND_SIZE, random);
    const events: SmashUpEvent[] = [revealEvt, discardEvt] as unknown as SmashUpEvent[];

    if (drawResult.reshuffledDeckUids && drawResult.reshuffledDeckUids.length > 0) {
      const reshuffleEvt: DeckReshuffledEvent = {
        type: SU_EVENTS.DECK_RESHUFFLED,
        payload: { playerId, deckUids: drawResult.reshuffledDeckUids },
        timestamp: timestamp + 2,
      };
      events.push(reshuffleEvt as unknown as SmashUpEvent);
    }
    if (drawResult.drawnUids.length > 0) {
      const drawnEvt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: drawResult.drawnUids.length, cardUids: drawResult.drawnUids },
        timestamp: timestamp + 3,
      };
      events.push(drawnEvt as unknown as SmashUpEvent);
    }
    const usedEvt: StartingHandMulliganUsedEvent = {
      type: SU_EVENTS.STARTING_HAND_MULLIGAN_USED,
      payload: { playerId, used: true },
      timestamp: timestamp + 4,
    };
    events.push(usedEvt as unknown as SmashUpEvent);

    return { state, events };
  };

  registerInteractionHandler(STARTING_HAND_MULLIGAN_SOURCE_ID, handler);
}

