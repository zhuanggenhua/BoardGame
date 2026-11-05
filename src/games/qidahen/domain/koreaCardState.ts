import { qidahenKoreaSpecialPreview } from '../ui/cardAtlas';
import type { QidahenCore, QidahenFactionId, QidahenHandCard } from './types';

export type QidahenKoreaDeckCard = Omit<QidahenHandCard, 'faction' | 'status'>;

/** 同包TTS ObjectStates[7]的完整24实体；正式开局洗牌，翻弃牌时不洗。 */
export const QIDAHEN_KOREA_DECK_CARD_IDS = [1708, 1703, 1760, 1701, 1709, 1703, 1701, 1704, 1700, 1750, 1709, 1702, 1707, 1705, 1740, 1702, 1709, 1700, 1720, 1700, 1730, 1706, 1703, 1701] as const;
export const QIDAHEN_KOREA_CARD_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 30, 40, 50, 60] as const;

const specialFaces: Record<number, Pick<QidahenHandCard, 'label' | 'cardKind' | 'armamentId' | 'rulesSummary'>> = {
    1700: { label: '朝鲜动乱', cardKind: 'event', armamentId: null, rulesSummary: '对一个相邻自己控制区域且部队少于 2 的朝鲜区域使用；对大明而言有船锚标志的地区均视为相邻。该区域转为打出者控制，建立 1 个等级 2 雇佣军部队。原部队必须撤退到临近区域，无法撤退则消灭。' },
    1701: { label: '朝鲜水师', cardKind: 'event', armamentId: null, rulesSummary: '进行一次进攻调度行动；本次经过朝鲜区域的部队可使用水路移动；骑兵通过水路移动发生野战不可劫掠；城战进攻方可从水路、陆路各推进 1 个部队攻城，战场宽度变 2；本次大明不可利用水路避战。' },
    1702: { label: '火炮技术', cardKind: 'armament', armamentId: 'artillery-tech', rulesSummary: '炮兵部队可训练等级 +1，原始值为 0；每个炮兵部队掷骰点数 +1。' },
    1703: { label: '逃人归还', cardKind: 'event', armamentId: null, rulesSummary: '指定 1 个玩家，查看其手上全部朝鲜手牌，抽取其中 1 张加入自己手牌；若打出者占领汉城，可再额外抽取 1 张上述目标的朝鲜手牌。' },
};

export function buildInitialQidahenKoreaPile(shuffle: (cards: QidahenKoreaDeckCard[]) => QidahenKoreaDeckCard[] = cards => cards): QidahenKoreaDeckCard[] {
    return shuffle(QIDAHEN_KOREA_DECK_CARD_IDS.map((cardId, index) => ({
        ...(specialFaces[cardId] ?? { label: '银两', cardKind: 'silver' as const, armamentId: null, rulesSummary: null }),
        id: `korea-${index + 1}`,
        originDeck: 'korea' as const,
        cardDefId: `qidahen-korea-${cardId}`,
        previewRef: qidahenKoreaSpecialPreview(QIDAHEN_KOREA_CARD_SLOTS.indexOf((cardId % 100) as typeof QIDAHEN_KOREA_CARD_SLOTS[number])),
        previewKind: 'unknown' as const,
        previewIdentityId: `qidahen-korea-${cardId}`,
        accent: 'neutral' as const,
    })));
}

export function drawQidahenKoreaCards(state: QidahenCore, factionId: QidahenFactionId, requested: number): QidahenCore {
    let drawPile = [...state.koreaDrawPile];
    let discardPile = [...state.koreaDiscardPile];
    const drawn: QidahenHandCard[] = [];
    for (let index = 0; index < requested; index += 1) {
        if (drawPile.length === 0) { drawPile = discardPile; discardPile = []; }
        const card = drawPile.shift();
        if (!card) break;
        drawn.push({ ...card, faction: factionId, status: 'payable' });
    }
    return {
        ...state,
        koreaDrawPile: drawPile,
        koreaDiscardPile: discardPile,
        koreaDeckCount: drawPile.length,
        koreaDiscardCount: discardPile.length,
        handCards: [...state.handCards, ...drawn],
        factions: { ...state.factions, [factionId]: { ...state.factions[factionId], handCount: state.factions[factionId].handCount + drawn.length } },
    };
}
