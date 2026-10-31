import { describe, expect, it } from 'vitest';
import { createInitialCore } from '../domain/initialCoreSetup';
import { drawQidahenKoreaCards } from '../domain/koreaCardState';
import { discardQidahenHandCards } from '../domain/handCardState';
import { executeQidahenSelectedAction } from '../domain/selectedActionExecution';
import { getQidahenArtilleryTechnologyCount } from '../domain/armamentStateAccessors';

describe('朝鲜牌的真实牌库、收入和归属', () => {
    it('TTS朝鲜牌24张、15种卡面，初始没有弃牌', () => {
        const core = createInitialCore(['0', '1', '2']);
        expect(core.koreaDrawPile).toHaveLength(24);
        expect(new Set(core.koreaDrawPile.map(card => card.cardDefId)).size).toBe(15);
        expect(core.koreaDrawPile.filter(card => card.cardKind === 'event')).toHaveLength(9);
        expect(core.koreaDrawPile.filter(card => card.cardKind === 'armament')).toHaveLength(2);
        expect(core.koreaDrawPile.filter(card => card.cardKind === 'silver')).toHaveLength(13);
        expect(core.koreaDiscardCount).toBe(0);
    });

    it('任意势力抽到后均成为可操作手牌，弃掉后回朝鲜堆并按原序翻回', () => {
        let core = createInitialCore(['0', '1', '2']);
        const original = core.koreaDrawPile.map(card => card.id);
        core = drawQidahenKoreaCards(core, 'jin', 24);
        expect(core.koreaDeckCount).toBe(0);
        expect(core.handCards.filter(card => card.originDeck === 'korea' && card.faction === 'jin')).toHaveLength(24);
        const discarded = discardQidahenHandCards(core, original.slice(0, 2));
        core = { ...core, ...discarded };
        expect(core.factions.jin.discardPileCount).toBe(0);
        expect(core.koreaDiscardCount).toBe(2);
        core = drawQidahenKoreaCards(core, 'ming', 2);
        expect(core.handCards.slice(-2).map(card => card.id)).toEqual(original.slice(0, 2));
        expect(core.koreaDiscardCount).toBe(0);
    });

    it('正式手牌行动支付朝鲜牌时保留真实归属，普通弃牌堆不会混入', () => {
        let core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        core = drawQidahenKoreaCards({ ...core, currentPlayer: '0' }, 'ming', 1);
        const card = core.handCards.find(candidate => candidate.originDeck === 'korea')!;
        const resolved = executeQidahenSelectedAction(core, '0', 'recruit', [card.id], 123);
        expect(resolved.koreaDiscardPile.map(candidate => candidate.id)).toEqual([card.id]);
        expect(resolved.factions.ming.discardPileCount).toBe(0);
        expect(resolved.handCards.some(candidate => candidate.id === card.id)).toBe(false);
    });

    it('朝鲜火炮技术实际研发后按朝鲜规则回弃牌堆，科技效果保留', () => {
        let core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        core = drawQidahenKoreaCards({ ...core, currentPlayer: '0' }, 'ming', 12);
        const card = core.handCards.find(candidate => candidate.cardDefId === 'qidahen-korea-1702')!;
        const payment = core.handCards.find(candidate => candidate.faction === 'ming' && candidate.originDeck !== 'korea')!;
        const resolved = executeQidahenSelectedAction(core, '0', 'upgrade-armament', [card.id, payment.id], 124);
        expect(resolved.koreaDiscardPile.map(candidate => candidate.id)).toContain(card.id);
        expect(resolved.factions.ming.developedCards.some(candidate => candidate.id === card.id)).toBe(false);
        expect(getQidahenArtilleryTechnologyCount(resolved, 'ming')).toBe(2);
    });
});
