import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import { createInitialCore } from '../domain/initialCoreSetup';
import { QIDAHEN_ORDINARY_CHRONOLOGY_CARDS } from '../domain/chronologyCards';
import { qidahenMongolHandPreview } from '../ui/cardAtlas';
import { playerView } from '../domain/view';
import type { RandomFn } from '../../../engine/types';

const random: RandomFn = { random: () => 0.5, range: min => min, d: () => 1, shuffle: items => [...items].reverse() };

describe('实际纪年卡身份、洗牌与公开范围', () => {
    it.each([['post-sarhu-1619', 1301, 1], ['shanhaiguan-1622', 1302, 2], ['dingmao-rebellion-1627', 1300, 0]] as const)('%s今年使用剧本起始卡，不借用普通纪年preview索引', (scenario, cardId, previewIndex) => {
        const core = createInitialCore(['0', '1', '2'], scenario);
        expect(core.chronology.currentCardId).toBe(cardId);
        expect(core.yearCards[0].previewRef).toEqual(qidahenMongolHandPreview(previewIndex));
        expect(core.chronology.drawPile).toHaveLength(12);
        expect(core.chronology.drawPile).not.toContain(cardId);
    });
    it('只洗实际十二张普通牌，重复图面1360不生成实体', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random, { scenario: 'post-sarhu-1619' });
        expect(core.chronology.drawPile).toEqual(QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.map(card => card.cardId).reverse());
        expect(new Set(core.chronology.drawPile).size).toBe(12);
        expect(core.chronology.drawPile).not.toContain(1360);
        expect(core.yearCards[1].previewRef).toEqual(QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.at(-1)!.previewRef);
    });
    it('客户端只得到公开下一张；三势力均无凭空赠送的纪年分', () => {
        const core = createInitialCore(['0', '1', '2']);
        const view = playerView(core, '0');
        expect(view.chronology!.drawPile).toEqual([core.chronology.drawPile[0]]);
        expect(Object.values(core.factions).map(faction => faction.vp)).toEqual([0, 0, 0]);
    });
});
