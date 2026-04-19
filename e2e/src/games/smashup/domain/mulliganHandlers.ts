import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent } from './types';
import { SU_EVENTS, STARTING_HAND_SIZE } from './types';
import type { InteractionHandler } from './abilityInteractionHandlers';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import type { HandShuffledIntoDeckEvent, CardsDrawnEvent, StartingHandMulliganUsedEvent } from './types';

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
      { id: 'keep', label: '保留手牌', value: { choice: 'keep' }, displayMode: 'button' as const },
      { id: 'mulligan', label: '重抽一次', value: { choice: 'mulligan' }, displayMode: 'button' as const },
    ],
    { sourceId: STARTING_HAND_MULLIGAN_SOURCE_ID, targetType: 'generic' },
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

    // mulligan: shuffle hand+deck into a fresh deck order, then draw starting hand
    const all = [...player.hand, ...player.deck];
    const shuffled = (random as RandomFn).shuffle(all);
    const newDeckUids = shuffled.map(c => c.uid);
    const drawCount = Math.min(STARTING_HAND_SIZE, shuffled.length);
    const drawnUids = shuffled.slice(0, drawCount).map(c => c.uid);

    const shuffleEvt: HandShuffledIntoDeckEvent = {
      type: SU_EVENTS.HAND_SHUFFLED_INTO_DECK,
      payload: { playerId, newDeckUids, reason: STARTING_HAND_MULLIGAN_SOURCE_ID },
      timestamp,
    } as any;
    const drawnEvt: CardsDrawnEvent = {
      type: SU_EVENTS.CARDS_DRAWN,
      payload: { playerId, count: drawCount, cardUids: drawnUids },
      timestamp: timestamp + 1,
    } as any;
    const usedEvt: StartingHandMulliganUsedEvent = {
      type: SU_EVENTS.STARTING_HAND_MULLIGAN_USED,
      payload: { playerId, used: true },
      timestamp: timestamp + 2,
    } as any;

    return { state, events: [shuffleEvt, drawnEvt, usedEvt] as unknown as SmashUpEvent[] };
  };

  registerInteractionHandler(STARTING_HAND_MULLIGAN_SOURCE_ID, handler);
}

