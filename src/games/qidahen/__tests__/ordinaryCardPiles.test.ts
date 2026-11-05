import { describe, expect, it } from 'vitest';
import { createInitialCore } from '../domain/initialCoreSetup';
import { appendDrawnHandCards, discardQidahenHandCards, drawFromFactionPile } from '../domain/handCardState';
import { QidahenDomain } from '../domain';
import { playerView } from '../domain/view';
import { QIDAHEN_SPECIAL_CARD_ATLAS_INDICES } from '../domain/specialCards';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from '../domain/ordinaryHandCardIdentities';
import type { RandomFn } from '../../../engine/types';

const random: RandomFn = { random: () => 0.5, d: () => 1, range: min => min, shuffle: items => [...items] };

describe('七大恨实际牌库与特典开关', () => {
    it.each([false, true])('开关%s从同一牌库发牌，基础计数包含场外军备', enabled => {
        const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true, undefined, enabled);
        const expected = enabled ? [39, 16, 10] : [36, 13, 7];
        (['ming', 'mongol', 'jin'] as const).forEach((id, index) => {
            const faction = core.factions[id];
            expect(faction.drawPileCount).toBe(expected[index]);
            expect(faction.discardPile).toEqual([]);
            const cards = [...core.handCards.filter(card => card.faction === id), ...faction.drawPile];
            const specialDefIds = QIDAHEN_SPECIAL_CARD_ATLAS_INDICES[id].map(atlasIndex => (
                QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find(identity => identity.atlasIndex === atlasIndex)!.cardDefId
            ));
            expect(cards.filter(card => specialDefIds.includes(card.cardDefId!))).toHaveLength(enabled ? 3 : 0);
            expect(new Set(cards.map(card => card.id)).size).toBe(cards.length);
        });
    });

    it('耗尽时翻回真实弃牌，保留实体与顺序', () => {
        const core = createInitialCore(['0', '1', '2']);
        const paid = core.handCards.filter(card => card.faction === 'jin').slice(0, 2).reverse();
        const discarded = discardQidahenHandCards(core, paid.map(card => card.id));
        const originalPile = discarded.factions.jin.drawPile;
        const result = drawFromFactionPile(discarded.factions, 'jin', originalPile.length + 2);
        expect(result.cards.map(card => card.id)).toEqual([...originalPile, ...paid].map(card => card.id));
        expect(result.factions.jin.drawPileCount).toBe(0);
        expect(result.factions.jin.discardPileCount).toBe(0);
        expect(appendDrawnHandCards(discarded.handCards, result.cards, 'ming').filter(card => paid.some(p => p.id === card.id)).every(card => card.faction === 'ming')).toBe(true);
    });

    it('创建房间的扩展选择进入局内剧本选择状态，默认关闭', () => {
        expect(QidahenDomain.setup(['0', '1', '2'], random).specialCardsEnabled).toBe(false);
        const core = QidahenDomain.setup(['0', '1', '2'], random, { setupSelections: { specialCards: 'enabled', qidahenInMatchScenarioVote: 'enabled' } });
        expect(core.specialCardsEnabled).toBe(true);
        expect(core.scenarioVote).not.toBeNull();
    });

    it('客户端看不到任何人的牌库顺序和对手手牌', () => {
        const core = createInitialCore(['0', '1', '2']);
        const view = playerView(core, '0');
        expect(view.handCards!.every(card => card.faction === 'ming')).toBe(true);
        for (const faction of Object.values(view.factions!)) {
            expect(faction.drawPile).toEqual([]);
            expect(faction.discardPile).toEqual([]);
        }
        expect(view.factions!.ming.drawPileCount).toBe(36);
    });

    it('正常setup使用引擎随机源洗牌，固定TTS顺序仅用于显式测试或教程配置', () => {
        let shuffles = 0;
        const reversed = QidahenDomain.setup(['0', '1', '2'], { ...random, shuffle: items => { shuffles += 1; return [...items].reverse(); } });
        const fixed = QidahenDomain.setup(['0', '1', '2'], random);
        expect(shuffles).toBe(5);
        expect(reversed.handCards.filter(card => card.faction === 'ming').map(card => card.cardDefId))
            .not.toEqual(fixed.handCards.filter(card => card.faction === 'ming').map(card => card.cardDefId));
        expect(reversed.koreaDrawPile.map(card => card.id)).toEqual([...fixed.koreaDrawPile].reverse().map(card => card.id));
    });
});
