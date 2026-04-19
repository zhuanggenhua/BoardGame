/**
 * 自定义牌组 → 游戏牌组构建器
 *
 * 将 SerializedCustomDeck（存储/传输态）转换为与 createDeckByFactionId 相同结构的牌组对象，
 * 用于游戏初始化时替代预构筑牌组。
 *
 * 核心逻辑：
 * - 召唤师、起始单位位置、城门位置等"棋盘布局"信息来自召唤师所属阵营的预构筑配置
 * - 牌组中的卡牌（deck 数组）来自自定义牌组的手动选择卡牌
 */

import type {
    UnitCard,
    EventCard,
    StructureCard,
    CellCoord,
    FactionId,
    SerializedCustomDeck,
} from '../domain/types';
import { createDeckByFactionId } from './factions';
import { buildCardRegistry } from './cardRegistry';
import type { CardRegistry } from './cardRegistry';

// ============================================================================
// 类型定义
// ============================================================================

/** createDeckByFactionId 的返回类型（与预构筑牌组结构一致） */
export interface GameDeckData {
    summoner: UnitCard;
    summonerPosition: CellCoord;
    startingUnits: { unit: UnitCard; position: CellCoord }[];
    startingGate: StructureCard;
    startingGatePosition: CellCoord;
    deck: (UnitCard | EventCard | StructureCard)[];
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 根据 SerializedCustomDeck 生成与 createDeckByFactionId 相同结构的牌组对象
 *
 * 设计决策：
 * - 棋盘布局（召唤师位置、起始单位位置、城门位置）来自召唤师所属阵营的预构筑配置
 * - 起始单位卡牌也来自预构筑配置（因为它们与位置绑定，且是自动填充的）
 * - deck 数组中的卡牌来自自定义牌组的手动选择卡牌（SerializedCustomDeck.cards）
 *
 * @param customDeck 序列化的自定义牌组数据
 * @param registry 可选的卡牌注册表（不传则自动构建）
 * @returns 与 createDeckByFactionId 相同结构的牌组对象
 * @throws 当召唤师阵营无效或注册表中找不到卡牌时抛出错误
 */
export function buildGameDeckFromCustom(
    customDeck: SerializedCustomDeck,
    registry?: CardRegistry,
): GameDeckData {
    const cardRegistry = registry ?? buildCardRegistry();

    // 从召唤师所属阵营获取预构筑配置（用于棋盘布局信息）
    const factionDeck = createDeckByFactionId(customDeck.summonerFaction);

    // 查找召唤师卡牌
    const summonerCard = cardRegistry.get(customDeck.summonerId);
    if (!summonerCard || summonerCard.cardType !== 'unit' || summonerCard.unitClass !== 'summoner') {
        throw new Error(`无效的召唤师 ID: ${customDeck.summonerId}`);
    }
    const summoner = summonerCard as UnitCard;

    // 棋盘布局信息来自预构筑配置
    const { summonerPosition, startingUnits, startingGate, startingGatePosition } = factionDeck;

    // 构建 deck 数组：从自定义牌组的手动选择卡牌中展开
    const deck = buildDeckArray(customDeck, cardRegistry);

    return {
        summoner,
        summonerPosition,
        startingUnits,
        startingGate,
        startingGatePosition,
        deck,
    };
}

// ============================================================================
// 内部辅助函数
// ============================================================================

/**
 * 从 SerializedCustomDeck.cards 构建 deck 数组
 *
 * 将 { cardId, count } 展开为实际的卡牌对象数组，
 * 每张卡牌的 id 添加索引后缀以保证唯一性。
 */
function buildDeckArray(
    customDeck: SerializedCustomDeck,
    registry: CardRegistry,
): (UnitCard | EventCard | StructureCard)[] {
    const deck: (UnitCard | EventCard | StructureCard)[] = [];

    for (const entry of customDeck.cards) {
        const card = registry.get(entry.cardId);
        if (!card) {
            console.warn(`[deckBuilder] 卡牌 ${entry.cardId} 在注册表中未找到，已跳过`);
            continue;
        }

        // 按数量展开卡牌，每张添加索引后缀保证 ID 唯一
        for (let i = 0; i < entry.count; i++) {
            deck.push({ ...card, id: `${card.id}-${i}` });
        }
    }

    return deck;
}
