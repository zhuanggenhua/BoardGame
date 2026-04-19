/**
 * DiceThrone 牌库相关事件构造器
 *
 * 规则依据：若你需要抽牌但牌库为空，则将弃牌堆洗混形成新的牌库。
 * 该逻辑必须在事件层表达（写入洗牌后的顺序），以确保回放确定性。
 */

import type { RandomFn } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneEvent, DeckShuffledEvent, CardDrawnEvent } from './types';

export function buildDrawEvents(
    state: DiceThroneCore,
    playerId: string,
    count: number,
    random: RandomFn,
    sourceCommandType: string,
    timestamp: number = 0,
    sourceAbilityId?: string,
): DiceThroneEvent[] {
    if (count <= 0) return [];

    const player = state.players[playerId];
    if (!player) return [];

    // 使用副本模拟抽牌过程，确保一次性抽多张时顺序正确
    let deck = [...player.deck];
    let discard = [...player.discard];

    const events: DiceThroneEvent[] = [];

    for (let i = 0; i < count; i++) {
        if (deck.length === 0) {
            if (discard.length === 0) break;

            const shuffled = random.shuffle([...discard]);
            const deckCardIds = shuffled.map(c => c.id);

            const shuffleEvent: DeckShuffledEvent = {
                type: 'DECK_SHUFFLED',
                payload: {
                    playerId,
                    deckCardIds,
                },
                sourceCommandType,
                timestamp,
            };
            events.push(shuffleEvent);

            deck = [...shuffled];
            discard = [];
        }

        const top = deck.shift();
        if (!top) break;

        const drawEvent: CardDrawnEvent = {
            type: 'CARD_DRAWN',
            payload: {
                playerId,
                cardId: top.id,
                ...(sourceAbilityId ? { sourceAbilityId } : {}),
            },
            sourceCommandType,
            timestamp,
        };
        events.push(drawEvent);
    }

    return events;
}
