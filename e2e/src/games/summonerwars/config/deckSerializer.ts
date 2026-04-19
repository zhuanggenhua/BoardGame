/**
 * 牌组序列化/反序列化模块
 *
 * 将 DeckDraft（编辑态）与 SerializedCustomDeck（存储/传输态）互相转换。
 * 序列化采用引用式（cardId + count），而非完整卡牌对象，
 * 以减少存储体积并保证数据一致性。
 */

import type { Card, UnitCard, FactionId, SerializedCustomDeck, SerializedCardEntry } from '../domain/types';
import type { CardRegistry } from './cardRegistry';
import { resolveFactionId } from './factions';
import type { DeckDraft } from './deckValidation';

// ============================================================================
// 类型重导出（从 domain/types.ts 导入，保持向后兼容）
// ============================================================================

export type { SerializedCardEntry, SerializedCustomDeck } from '../domain/types';

// ============================================================================
// 序列化函数
// ============================================================================

/**
 * 将 DeckDraft 序列化为 SerializedCustomDeck
 *
 * 只序列化 manualCards（用户手动添加的卡牌），
 * autoCards（起始单位、史诗事件、城门）由召唤师决定，反序列化时可重建。
 *
 * @throws 当 DeckDraft 没有召唤师时抛出错误
 */
export function serializeDeck(draft: DeckDraft): SerializedCustomDeck {
    if (!draft.summoner) {
        throw new Error('无法序列化没有召唤师的牌组');
    }

    const cards: SerializedCardEntry[] = [];

    draft.manualCards.forEach(({ card, count }, _cardId) => {
        // 从卡牌中提取阵营信息
        const faction = extractFaction(card);
        cards.push({
            cardId: card.id,
            faction,
            count,
        });
    });

    return {
        name: draft.name,
        summonerId: draft.summoner.id,
        summonerFaction: resolveFactionId(draft.summoner.faction),
        cards,
        ...(draft.freeMode ? { freeMode: true } : {}),
    };
}

// ============================================================================
// 反序列化函数
// ============================================================================

/** 反序列化时跳过的卡牌警告信息 */
export interface DeserializeWarning {
    cardId: string;
    faction: FactionId;
    message: string;
}

/** 反序列化结果（包含可能的警告） */
export interface DeserializeResult {
    deck: DeckDraft;
    warnings: DeserializeWarning[];
}

/**
 * 将 SerializedCustomDeck 反序列化为 DeckDraft
 *
 * 通过 CardRegistry 查找完整卡牌对象。
 * 找不到的卡牌会被跳过并记录警告，不阻塞加载。
 *
 * 注意：autoCards 不在此函数中重建，因为需要游戏配置中的起始单位/史诗事件/城门数据。
 * 调用方应在获得 DeckDraft 后，根据召唤师信息填充 autoCards。
 */
export function deserializeDeck(
    data: SerializedCustomDeck,
    registry: CardRegistry,
): DeserializeResult {
    const warnings: DeserializeWarning[] = [];

    // 查找召唤师
    const summoner = registry.get(data.summonerId) ?? null;
    if (!summoner) {
        warnings.push({
            cardId: data.summonerId,
            faction: data.summonerFaction,
            message: `召唤师 ${data.summonerId} 在注册表中未找到`,
        });
    }

    // 验证召唤师类型
    const validSummoner = summoner && summoner.cardType === 'unit' && summoner.unitClass === 'summoner'
        ? summoner as UnitCard
        : null;

    if (summoner && !validSummoner) {
        warnings.push({
            cardId: data.summonerId,
            faction: data.summonerFaction,
            message: `${data.summonerId} 不是有效的召唤师卡牌`,
        });
    }

    // 重建 manualCards
    const manualCards = new Map<string, { card: Card; count: number }>();

    for (const entry of data.cards) {
        const card = registry.get(entry.cardId);
        if (!card) {
            warnings.push({
                cardId: entry.cardId,
                faction: entry.faction,
                message: `卡牌 ${entry.cardId} 在注册表中未找到，已跳过`,
            });
            continue;
        }

        manualCards.set(entry.cardId, {
            card,
            count: entry.count,
        });
    }

    return {
        deck: {
            name: data.name,
            summoner: validSummoner,
            autoCards: [], // 由调用方根据召唤师信息填充
            manualCards,
            ...(data.freeMode ? { freeMode: true } : {}),
        },
        warnings,
    };
}

// ============================================================================
// 内部辅助函数
// ============================================================================

/** 从卡牌中提取阵营 ID（三种卡牌类型均有 faction 字段） */
function extractFaction(card: Card): FactionId {
    return resolveFactionId(card.faction);
}
