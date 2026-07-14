import { describe, expect, it } from 'vitest';
import { applyCasualtiesToSpecialStacks } from '../domain/pendingBattleCombatSupport';
import type { QidahenSpecialTroopStack } from '../domain/types';

describe('七大恨战斗伤亡辅助规则', () => {
    it('链炮阵会先逐个移除炮兵，剩余损伤再由最高等级非炮兵承受', () => {
        const stacks: QidahenSpecialTroopStack[] = [
            {
                id: 'ming-artillery-lv1',
                label: '大明炮兵',
                faction: 'ming',
                troopKind: 'artillery',
                count: 2,
                level: 1,
                pieceIds: ['ming-artillery-1', 'ming-artillery-2'],
            },
            {
                id: 'ming-infantry-lv3',
                label: '大明三级步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 1,
                level: 3,
                pieceIds: ['ming-infantry-3'],
            },
            {
                id: 'ming-infantry-lv2',
                label: '大明二级步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 1,
                level: 2,
                pieceIds: ['ming-infantry-2'],
            },
        ];

        const withoutChainCannon = applyCasualtiesToSpecialStacks(stacks, 1);
        expect(withoutChainCannon).toEqual([
            expect.objectContaining({ id: 'ming-artillery-lv1', count: 2 }),
            expect.objectContaining({ id: 'ming-infantry-lv2', count: 1 }),
        ]);

        const withChainCannon = applyCasualtiesToSpecialStacks(stacks, 3, 'artillery-first');
        expect(withChainCannon).toEqual([
            expect.objectContaining({ id: 'ming-infantry-lv2', count: 1 }),
        ]);
    });
});
