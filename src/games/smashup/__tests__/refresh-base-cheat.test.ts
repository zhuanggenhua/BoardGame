/**
 * 刷新基地作弊功能测试
 */

import { describe, it, expect } from 'vitest';
import { smashUpCheatModifier } from '../cheatModifier';
import type { SmashUpCore, BaseInPlay } from '../domain/types';

describe('刷新基地作弊功能', () => {
    it('应该成功刷新指定基地', () => {
        // 准备初始状态
        const core: SmashUpCore = {
            players: {
                '0': {
                    playerId: '0',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
                '1': {
                    playerId: '1',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_old_1',
                    minions: [],
                    ongoingActions: [],
                },
                {
                    defId: 'base_old_2',
                    minions: [],
                    ongoingActions: [],
                },
            ] as BaseInPlay[],
            baseDeck: ['base_new_1', 'base_new_2', 'base_new_3'],
            turnNumber: 1,
            nextUid: 1,
        };

        // 执行刷新基地
        const result = smashUpCheatModifier.refreshBase!(core, 0);

        // 验证状态更新
        expect(result.core.bases[0].defId).toBe('base_new_1');
        expect(result.core.bases[0].minions).toEqual([]);
        expect(result.core.bases[0].ongoingActions).toEqual([]);
        expect(result.core.bases[1].defId).toBe('base_old_2'); // 其他基地不变
        expect(result.core.baseDeck).toEqual(['base_new_2', 'base_new_3']); // 新基地从牌库移除

        // 验证事件生成
        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe('su:base_replaced');
        expect(result.events[0].payload).toMatchObject({
            baseIndex: 0,
            oldBaseDefId: 'base_old_1',
            newBaseDefId: 'base_new_1',
            keepCards: false,
        });
    });

    it('应该清空基地上的随从和行动卡', () => {
        const core: SmashUpCore = {
            players: {
                '0': {
                    playerId: '0',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
                '1': {
                    playerId: '1',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_with_cards',
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'minion_1',
                            playerId: '0',
                            power: 3,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        {
                            uid: 'a1',
                            defId: 'action_1',
                            playerId: '0',
                        },
                    ],
                },
            ] as BaseInPlay[],
            baseDeck: ['base_new'],
            turnNumber: 1,
            nextUid: 1,
        };

        const result = smashUpCheatModifier.refreshBase!(core, 0);

        // 验证新基地是空的
        expect(result.core.bases[0].minions).toEqual([]);
        expect(result.core.bases[0].ongoingActions).toEqual([]);
    });

    it('基地索引无效时应该返回原状态', () => {
        const core: SmashUpCore = {
            players: {
                '0': {
                    playerId: '0',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
                '1': {
                    playerId: '1',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_1',
                    minions: [],
                    ongoingActions: [],
                },
            ] as BaseInPlay[],
            baseDeck: ['base_new'],
            turnNumber: 1,
            nextUid: 1,
        };

        // 测试负数索引
        const result1 = smashUpCheatModifier.refreshBase!(core, -1);
        expect(result1.core).toBe(core);
        expect(result1.events).toEqual([]);

        // 测试超出范围的索引
        const result2 = smashUpCheatModifier.refreshBase!(core, 999);
        expect(result2.core).toBe(core);
        expect(result2.events).toEqual([]);
    });

    it('基地牌库为空时应该返回原状态', () => {
        const core: SmashUpCore = {
            players: {
                '0': {
                    playerId: '0',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
                '1': {
                    playerId: '1',
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    factions: [],
                    talentUsed: false,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_1',
                    minions: [],
                    ongoingActions: [],
                },
            ] as BaseInPlay[],
            baseDeck: [], // 空牌库
            turnNumber: 1,
            nextUid: 1,
        };

        const result = smashUpCheatModifier.refreshBase!(core, 0);
        expect(result.core).toBe(core);
        expect(result.events).toEqual([]);
    });

    describe('刷新所有基地', () => {
        it('应该成功刷新所有基地', () => {
            const core: SmashUpCore = {
                players: {
                    '0': {
                        playerId: '0',
                        deck: [],
                        hand: [],
                        discard: [],
                        vp: 0,
                        factions: [],
                        talentUsed: false,
                    },
                    '1': {
                        playerId: '1',
                        deck: [],
                        hand: [],
                        discard: [],
                        vp: 0,
                        factions: [],
                        talentUsed: false,
                    },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_old_1',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_old_2',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_old_3',
                        minions: [],
                        ongoingActions: [],
                    },
                ] as BaseInPlay[],
                baseDeck: ['base_new_1', 'base_new_2', 'base_new_3', 'base_new_4'],
                turnNumber: 1,
                nextUid: 1,
            };

            const result = smashUpCheatModifier.refreshAllBases!(core);

            // 验证所有基地都被替换
            expect(result.core.bases[0].defId).toBe('base_new_1');
            expect(result.core.bases[1].defId).toBe('base_new_2');
            expect(result.core.bases[2].defId).toBe('base_new_3');

            // 验证所有基地都是空的
            result.core.bases.forEach(base => {
                expect(base.minions).toEqual([]);
                expect(base.ongoingActions).toEqual([]);
            });

            // 验证基地牌库正确更新
            expect(result.core.baseDeck).toEqual(['base_new_4']);

            // 验证生成了3个事件
            expect(result.events).toHaveLength(3);
            result.events.forEach((event, i) => {
                expect(event.type).toBe('su:base_replaced');
                expect(event.payload).toMatchObject({
                    baseIndex: i,
                    oldBaseDefId: `base_old_${i + 1}`,
                    newBaseDefId: `base_new_${i + 1}`,
                    keepCards: false,
                });
            });
        });

        it('基地牌库不足时应该返回原状态', () => {
            const core: SmashUpCore = {
                players: {
                    '0': {
                        playerId: '0',
                        deck: [],
                        hand: [],
                        discard: [],
                        vp: 0,
                        factions: [],
                        talentUsed: false,
                    },
                    '1': {
                        playerId: '1',
                        deck: [],
                        hand: [],
                        discard: [],
                        vp: 0,
                        factions: [],
                        talentUsed: false,
                    },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_1',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_2',
                        minions: [],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_3',
                        minions: [],
                        ongoingActions: [],
                    },
                ] as BaseInPlay[],
                baseDeck: ['base_new_1', 'base_new_2'], // 只有2张，不足3张
                turnNumber: 1,
                nextUid: 1,
            };

            const result = smashUpCheatModifier.refreshAllBases!(core);
            expect(result.core).toBe(core);
            expect(result.events).toEqual([]);
        });
    });
});
