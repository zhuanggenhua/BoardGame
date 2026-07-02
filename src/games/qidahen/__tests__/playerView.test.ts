import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import type { QidahenCore } from '../domain/types';

const fakeRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

describe('QidahenDomain.playerView', () => {
    it('联机视角只保留当前玩家所属阵营的手牌实体', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], fakeRandom);

        const mingView = QidahenDomain.playerView?.(core, core.factions.ming.playerId) as Partial<QidahenCore>;
        const jinView = QidahenDomain.playerView?.(core, core.factions.jin.playerId) as Partial<QidahenCore>;

        expect(mingView.handCards?.length).toBeGreaterThan(0);
        expect(mingView.handCards?.every((card) => card.faction === 'ming')).toBe(true);
        expect(jinView.handCards?.length).toBeGreaterThan(0);
        expect(jinView.handCards?.every((card) => card.faction === 'jin')).toBe(true);
    });

    it('联机视角不会保留其他阵营正在支付的手牌 id', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], fakeRandom);
        const mongolCardIds = core.handCards
            .filter((card) => card.faction === 'mongol')
            .slice(0, 2)
            .map((card) => card.id);

        const mutatedCore: QidahenCore = {
            ...core,
            selectedPaymentCardIds: mongolCardIds,
        };
        const mingView = QidahenDomain.playerView?.(mutatedCore, core.factions.ming.playerId) as Partial<QidahenCore>;
        const mongolView = QidahenDomain.playerView?.(mutatedCore, core.factions.mongol.playerId) as Partial<QidahenCore>;

        expect(mingView.selectedPaymentCardIds).toEqual([]);
        expect(mongolView.selectedPaymentCardIds).toEqual(mongolCardIds);
    });

    it('联机视角不会泄漏其他阵营正在直点的手牌行动 id', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], fakeRandom);
        const jinCardId = core.handCards.find((card) => card.faction === 'jin')?.id;
        expect(jinCardId).toBeTruthy();

        const mutatedCore: QidahenCore = {
            ...core,
            selectedHandActionCardId: jinCardId!,
        };
        const mingView = QidahenDomain.playerView?.(mutatedCore, core.factions.ming.playerId) as Partial<QidahenCore>;
        const jinView = QidahenDomain.playerView?.(mutatedCore, core.factions.jin.playerId) as Partial<QidahenCore>;

        expect(mingView.selectedHandActionCardId).toBeNull();
        expect(jinView.selectedHandActionCardId).toBe(jinCardId);
    });

    it('联机视角只向所属阵营展示自己的手牌上限弃牌选择', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], fakeRandom);
        const jinCardIds = core.handCards
            .filter((card) => card.faction === 'jin')
            .slice(0, 2)
            .map((card) => card.id);
        expect(jinCardIds.length).toBe(2);

        const mutatedCore: QidahenCore = {
            ...core,
            handLimitDiscardSelection: {
                factionId: 'jin',
                factionName: '后金',
                handLimit: 4,
                handCount: 6,
                requiredDiscardCount: 2,
                candidateCardIds: jinCardIds,
                selectedCardIds: [jinCardIds[0]],
            },
        };
        const mingView = QidahenDomain.playerView?.(mutatedCore, core.factions.ming.playerId) as Partial<QidahenCore>;
        const jinView = QidahenDomain.playerView?.(mutatedCore, core.factions.jin.playerId) as Partial<QidahenCore>;

        expect(mingView.handLimitDiscardSelection).toBeNull();
        expect(jinView.handLimitDiscardSelection).toMatchObject({
            factionId: 'jin',
            candidateCardIds: jinCardIds,
            selectedCardIds: [jinCardIds[0]],
        });
    });
});
