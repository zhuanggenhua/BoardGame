/**
 * 持续效果拦截框架测试
 *
 * 覆盖 protection/restriction/trigger 三种拦截器的注册、查询与清理。
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
    registerProtection,
    registerRestriction,
    registerTrigger,
    clearOngoingEffectRegistry,
    getOngoingEffectRegistrySize,
    isMinionProtected,
    isOperationRestricted,
    fireTriggers,
} from '../domain/ongoingEffects';
import type { SmashUpCore, MinionOnBase, BaseInPlay, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerModifier: 0,
        talentUsed: false,
        attachedActions: [],
        ...overrides,
    };
}

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return {
        defId: 'test_base',
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

/** 构建最小可用的 SmashUpCore */
function makeState(bases: BaseInPlay[]): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0', vp: 0, hand: [], deck: [], discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: ['test_a', 'test_b'],
            },
            '1': {
                id: '1', vp: 0, hand: [], deck: [], discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: ['test_c', 'test_d'],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
    };
}

const dummyRandom = { random: () => 0.5 } as any;

// ============================================================================
// 测试
// ============================================================================

describe('持续效果拦截框架', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
    });

    describe('注册表基础', () => {
        test('初始注册表为空', () => {
            const size = getOngoingEffectRegistrySize();
            expect(size.protection).toBe(0);
            expect(size.restriction).toBe(0);
            expect(size.trigger).toBe(0);
        });

        test('注册后大小正确', () => {
            registerProtection('warbot', 'destroy', () => true);
            registerRestriction('dome', 'play_action', () => true);
            registerTrigger('flame_trap', 'onMinionPlayed', () => []);

            const size = getOngoingEffectRegistrySize();
            expect(size.protection).toBe(1);
            expect(size.restriction).toBe(1);
            expect(size.trigger).toBe(1);
        });

        test('clearOngoingEffectRegistry 清空所有注册', () => {
            registerProtection('warbot', 'destroy', () => true);
            registerRestriction('dome', 'play_action', () => true);
            registerTrigger('flame_trap', 'onMinionPlayed', () => []);
            clearOngoingEffectRegistry();

            const size = getOngoingEffectRegistrySize();
            expect(size.protection).toBe(0);
            expect(size.restriction).toBe(0);
            expect(size.trigger).toBe(0);
        });
    });

    describe('protection 保护拦截器', () => {
        test('场上有保护来源时随从受保护', () => {
            // 注册：warbot 不可被消灭
            registerProtection('robot_warbot', 'destroy', (ctx) => {
                return ctx.targetMinion.defId === 'robot_warbot';
            });

            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1' });
            const base = makeBase({ minions: [warbot] });
            const state = makeState([base]);

            expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
        });

        test('场上无保护来源时不受保护', () => {
            registerProtection('robot_warbot', 'destroy', () => true);

            const normalMinion = makeMinion({ defId: 'normal', uid: 'n-1' });
            const base = makeBase({ minions: [normalMinion] });
            const state = makeState([base]);

            // robot_warbot 不在场上，拦截器不生效
            expect(isMinionProtected(state, normalMinion, 0, '1', 'destroy')).toBe(false);
        });

        test('保护类型不匹配时不受保护', () => {
            registerProtection('robot_warbot', 'destroy', () => true);

            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1' });
            const base = makeBase({ minions: [warbot] });
            const state = makeState([base]);

            // 查询 move 保护，但只注册了 destroy 保护
            expect(isMinionProtected(state, warbot, 0, '1', 'move')).toBe(false);
        });

        test('ongoing 行动卡作为保护来源', () => {
            registerProtection('ninja_smoke_bomb', 'affect', (ctx) => {
                // 保护同基地己方随从不受对手影响
                return ctx.targetMinion.controller !== ctx.sourcePlayerId;
            });

            const myMinion = makeMinion({ defId: 'ninja_a', uid: 'n-1', controller: '0' });
            const base = makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'affect')).toBe(true);
            // 自己不受保护限制
            expect(isMinionProtected(state, myMinion, 0, '0', 'affect')).toBe(false);
        });

        test('随从附着行动卡作为保护来源', () => {
            registerProtection('trickster_hideout', 'affect', (ctx) => {
                // 检查目标随从是否附着了 hideout
                return ctx.targetMinion.attachedActions.some(a => a.defId === 'trickster_hideout');
            });

            const protectedMinion = makeMinion({
                defId: 'trickster_a', uid: 't-1', controller: '0',
                attachedActions: [{ uid: 'ho-1', defId: 'trickster_hideout', ownerId: '0' }],
            });
            const base = makeBase({ minions: [protectedMinion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, protectedMinion, 0, '1', 'affect')).toBe(true);
        });
    });

    describe('restriction 限制拦截器', () => {
        test('场上有限制来源时操作被限制', () => {
            registerRestriction('steampunk_ornate_dome', 'play_action', (ctx) => {
                // 对手不能在此基地打行动卡
                const base = ctx.state.bases[ctx.baseIndex];
                return base?.ongoingActions.some(
                    o => o.defId === 'steampunk_ornate_dome' && o.ownerId !== ctx.playerId
                ) ?? false;
            });

            const base = makeBase({
                ongoingActions: [{ uid: 'od-1', defId: 'steampunk_ornate_dome', ownerId: '0' }],
            });
            const state = makeState([base]);

            // 对手（P1）被限制
            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(true);
            // 自己（P0）不被限制
            expect(isOperationRestricted(state, 0, '0', 'play_action')).toBe(false);
        });

        test('场上无限制来源时不被限制', () => {
            registerRestriction('steampunk_ornate_dome', 'play_action', () => true);

            const base = makeBase(); // 无 ongoing
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(false);
        });

        test('限制类型不匹配时不被限制', () => {
            registerRestriction('block_the_path', 'play_minion', () => true);

            const base = makeBase({
                ongoingActions: [{ uid: 'bp-1', defId: 'block_the_path', ownerId: '0' }],
            });
            const state = makeState([base]);

            // 查询 play_action，但只注册了 play_minion
            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(false);
        });

        test('extra 数据传递到 checker', () => {
            registerRestriction('trickster_block_the_path', 'play_minion', (ctx) => {
                const blockedFaction = ctx.extra?.blockedFaction as string | undefined;
                const minionFaction = ctx.extra?.minionFaction as string | undefined;
                return blockedFaction !== undefined && minionFaction === blockedFaction;
            });

            const base = makeBase({
                ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_minion', {
                blockedFaction: SMASHUP_FACTION_IDS.ROBOTS,
                minionFaction: SMASHUP_FACTION_IDS.ROBOTS,
            })).toBe(true);

            expect(isOperationRestricted(state, 0, '1', 'play_minion', {
                blockedFaction: SMASHUP_FACTION_IDS.ROBOTS,
                minionFaction: SMASHUP_FACTION_IDS.NINJAS,
            })).toBe(false);
        });
    });

    describe('trigger 触发拦截器', () => {
        test('场上有触发来源时产生事件', () => {
            registerTrigger('trickster_flame_trap', 'onMinionPlayed', (ctx) => {
                // 其他玩家打出随从时消灭该随从
                if (!ctx.triggerMinionUid || !ctx.triggerMinionDefId) return [];
                // 检查场上是否有 flame_trap 且不是自己的
                for (const base of ctx.state.bases) {
                    for (const ongoing of base.ongoingActions) {
                        if (ongoing.defId === 'trickster_flame_trap' && ongoing.ownerId !== ctx.playerId) {
                            return [{
                                type: SU_EVENTS.MINION_DESTROYED,
                                payload: {
                                    minionUid: ctx.triggerMinionUid,
                                    minionDefId: ctx.triggerMinionDefId,
                                    fromBaseIndex: ctx.baseIndex ?? 0,
                                    ownerId: ctx.playerId,
                                    reason: 'trickster_flame_trap',
                                },
                                timestamp: ctx.now,
                            }];
                        }
                    }
                }
                return [];
            });

            const base = makeBase({
                ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
            });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1', // 对手打出随从
                baseIndex: 0,
                triggerMinionUid: 'new-minion',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
        });

        test('场上无触发来源时不产生事件', () => {
            registerTrigger('trickster_flame_trap', 'onMinionPlayed', () => [{
                type: SU_EVENTS.MINION_DESTROYED,
                payload: { minionUid: 'x', minionDefId: 'x', fromBaseIndex: 0, ownerId: '1', reason: 'test' },
                timestamp: 0,
            }]);

            const base = makeBase(); // 无 ongoing
            const state = makeState([base]);

            const events = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('时机不匹配时不触发', () => {
            registerTrigger('diff_engine', 'onTurnEnd', () => [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: '0', count: 1, cardUids: ['x'] },
                timestamp: 0,
            }]);

            const minion = makeMinion({ defId: 'diff_engine' });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            // 查询 onMinionPlayed，但注册的是 onTurnEnd
            const events = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('多个触发器同时生效', () => {
            registerTrigger('trigger_a', 'onMinionPlayed', () => [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: '0', count: 1, cardUids: ['a'] },
                timestamp: 0,
            }]);
            registerTrigger('trigger_b', 'onMinionPlayed', () => [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: '1', count: 1, cardUids: ['b'] },
                timestamp: 0,
            }]);

            const base = makeBase({
                minions: [
                    makeMinion({ defId: 'trigger_a', uid: 'ta-1' }),
                    makeMinion({ defId: 'trigger_b', uid: 'tb-1' }),
                ],
            });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
        });
    });

    describe('来源活跃性检查', () => {
        test('随从作为来源', () => {
            registerProtection('robot_warbot', 'destroy', (ctx) => {
                return ctx.targetMinion.defId === 'robot_warbot';
            });

            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1' });
            const base = makeBase({ minions: [warbot] });
            const state = makeState([base]);

            expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
        });

        test('基地 ongoing 行动卡作为来源', () => {
            registerRestriction('ornate_dome', 'play_action', () => true);

            const base = makeBase({
                ongoingActions: [{ uid: 'od-1', defId: 'ornate_dome', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(true);
        });

        test('随从附着行动卡作为来源', () => {
            registerTrigger('escape_hatch', 'onMinionDestroyed', () => [{
                type: SU_EVENTS.MINION_RETURNED,
                payload: { minionUid: 'x', minionDefId: 'x', fromBaseIndex: 0, toPlayerId: '0', reason: 'escape_hatch' },
                timestamp: 0,
            }]);

            const minion = makeMinion({
                uid: 'm-1',
                attachedActions: [{ uid: 'eh-1', defId: 'escape_hatch', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
        });

        test('来源在其他基地也算活跃', () => {
            registerProtection('robot_warbot', 'destroy', () => true);

            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1' });
            const base0 = makeBase({ minions: [warbot] }); // warbot 在基地 0
            const targetMinion = makeMinion({ defId: 'some_minion', uid: 'sm-1' });
            const base1 = makeBase({ minions: [targetMinion] }); // 目标在基地 1
            const state = makeState([base0, base1]);

            // warbot 在基地 0，但保护检查的目标在基地 1
            // isSourceActive 检查全局，所以 warbot 算活跃
            expect(isMinionProtected(state, targetMinion, 1, '1', 'destroy')).toBe(true);
        });
    });
});
