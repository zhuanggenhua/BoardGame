import type { PlayerId, RandomFn } from '../../../engine/types';
import type { CardInstance, PlayerState } from './types';
import { getFactionCards } from '../data/cards';

/** 将派系卡牌定义展开为卡牌实例列表 */
export function buildDeck(
    factions: [string, string],
    owner: PlayerId,
    startUid: number,
    random: RandomFn
): { deck: CardInstance[]; nextUid: number } {
    const cards: CardInstance[] = [];
    let uid = startUid;
    for (const factionId of factions) {
        const defs = getFactionCards(factionId);
        for (const def of defs) {
            for (let i = 0; i < def.count; i++) {
                cards.push({
                    uid: `c${uid++}`,
                    defId: def.id,
                    type: def.type,
                    owner,
                });
            }
        }
    }
    return { deck: random.shuffle(cards), nextUid: uid };
}

/** 从牌库顶部抽牌 */
export function drawCards(
    player: PlayerState,
    count: number,
    random: RandomFn
): {
    hand: CardInstance[];
    deck: CardInstance[];
    discard: CardInstance[];
    drawnUids: string[];
    reshuffledDeckUids?: string[];
} {
    let deck = [...player.deck];
    let discard = [...player.discard];
    const drawn: CardInstance[] = [];
    let reshuffledDeckUids: string[] | undefined;

    for (let i = 0; i < count; i++) {
        if (deck.length === 0 && discard.length > 0) {
            deck = random.shuffle([...discard]);
            discard = [];
            if (!reshuffledDeckUids) {
                reshuffledDeckUids = deck.map(card => card.uid);
            }
        }
        if (deck.length === 0) break;
        drawn.push(deck[0]);
        deck = deck.slice(1);
    }

    return {
        hand: [...player.hand, ...drawn],
        deck,
        discard,
        drawnUids: drawn.map(c => c.uid),
        reshuffledDeckUids,
    };
}
