/**
 * SmashUp CheatResourceModifier 功能测试
 *
 * 测试作弊适配器的资源读写和发牌操作。
 */

import { describe, it, expect } from 'vitest';
import { smashUpCheatModifier } from '../cheatModifier';
import type { SmashUpCore, CardInstance } from '../domain/types';

/** 创建最小测试用游戏状态 */
function makeCore(overrides?: Partial<{ p0Hand: CardInstance[]; p0Deck: CardInstance[]; p0Vp: number }>): SmashUpCore {
    const card = (uid: string, defId: string): CardInstance => ({
        uid, defId, type: 'minion', owner: '0',
    });
    return {
        players: {
            '0': {
                id: '0', vp: overrides?.p0Vp ?? 3,
                hand: overrides?.p0Hand ?? [card('h1', 'dino_war_raptor')],
                deck: overrides?.p0Deck ?? [card('d1', 'pirate_first_mate'), card('d2', 'dino_armor_stego'), card('d3', 'robot_microbot')],
                discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: ['dinosaurs', 'pirates'],
            },
            '1': {
                id: '1', vp: 0,
                hand: [], deck: [], discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: ['robots', 'wizards'],
            },
        },
        turnOrder: ['0', '1'], currentPlayerIndex: 0,
        bases: [], baseDeck: [], turnNumber: 1, nextUid: 100,
    };
}

describe('SmashUp CheatResourceModifier', () => {
    describe('getResource / setResource', () => {
        it('读取 vp 资源', () => {
            const core = makeCore({ p0Vp: 7 });
            expect(smashUpCheatModifier.getResource(core, '0', 'vp')).toBe(7);
        });

        it('未知资源返回 undefined', () => {
            const core = makeCore();
            expect(smashUpCheatModifier.getResource(core, '0', 'magic')).toBeUndefined();
        });

        it('设置 vp 资源', () => {
            const core = makeCore({ p0Vp: 3 });
            const next = smashUpCheatModifier.setResource(core, '0', 'vp', 10);
            expect(next.players['0'].vp).toBe(10);
            // 其他状态不变
            expect(next.players['1'].vp).toBe(0);
        });

        it('设置未知资源返回原状态', () => {
            const core = makeCore();
            const next = smashUpCheatModifier.setResource(core, '0', 'magic', 5);
            expect(next).toBe(core);
        });
    });

    describe('dealCardByIndex', () => {
        it('按索引将卡牌从牌库移到手牌', () => {
            const core = makeCore();
            const next = smashUpCheatModifier.dealCardByIndex(core, '0', 1);
            // 牌库减少 1 张
            expect(next.players['0'].deck).toHaveLength(2);
            // 手牌增加 1 张
            expect(next.players['0'].hand).toHaveLength(2);
            // 移动的是索引 1 的卡（dino_armor_stego）
            expect(next.players['0'].hand[1].defId).toBe('dino_armor_stego');
            // 牌库中不再包含该卡
            expect(next.players['0'].deck.find(c => c.defId === 'dino_armor_stego')).toBeUndefined();
        });

        it('索引 0 移动牌库顶部卡牌', () => {
            const core = makeCore();
            const next = smashUpCheatModifier.dealCardByIndex(core, '0', 0);
            expect(next.players['0'].hand[1].defId).toBe('pirate_first_mate');
        });

        it('无效索引（负数）返回原状态', () => {
            const core = makeCore();
            const next = smashUpCheatModifier.dealCardByIndex(core, '0', -1);
            expect(next).toBe(core);
        });

        it('无效索引（超出范围）返回原状态', () => {
            const core = makeCore();
            const next = smashUpCheatModifier.dealCardByIndex(core, '0', 99);
            expect(next).toBe(core);
        });

        it('空牌库返回原状态', () => {
            const core = makeCore({ p0Deck: [] });
            const next = smashUpCheatModifier.dealCardByIndex(core, '0', 0);
            expect(next).toBe(core);
        });

        it('不影响其他玩家状态', () => {
            const core = makeCore();
            const next = smashUpCheatModifier.dealCardByIndex(core, '0', 0);
            expect(next.players['1']).toEqual(core.players['1']);
        });
    });
});
