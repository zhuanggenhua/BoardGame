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
    registerBaseScoringSuppression,
    registerCardAbilitySuppression,
    registerPodOngoingAliases,
    collectTriggers,
    clearOngoingEffectRegistry,
    getOngoingEffectRegistrySize,
    getRegisteredOngoingEffectIds,
    isMinionProtected,
    isOperationRestricted,
    isBaseScoringSuppressed,
    isCardSuppressed,
    getConsumableProtectionSource,
    fireTriggers,
    fireTriggerForSource,
    getBaseRestrictions,
} from '../domain/ongoingEffects';
import type { SmashUpCore, MinionOnBase, BaseInPlay, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { buildAffectRecords } from '../domain/affect';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false,
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

        test('getRegisteredOngoingEffectIds 会暴露 base scoring suppression sourceId，供审计层读取', () => {
            registerBaseScoringSuppression('time_travelers_stasis_field', () => true);

            const ids = getRegisteredOngoingEffectIds();
            expect(ids.baseScoringSuppressionIds.has('time_travelers_stasis_field')).toBe(true);
        });

        test('_pod alias 也应继承 base scoring suppression', () => {
            registerBaseScoringSuppression('time_travelers_stasis_field', () => true);
            registerPodOngoingAliases();

            const base = makeBase({
                ongoingActions: [{ uid: 'stasis-pod-1', defId: 'time_travelers_stasis_field_pod', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isBaseScoringSuppressed(state, 0)).toBe(true);
        });

        test('getRegisteredOngoingEffectIds 不应暴露无实体的自动 _pod alias sourceId', () => {
            registerProtection('ghost_haunting', 'destroy', () => true);
            registerProtection('synthetic_guard', 'destroy', () => true);

            registerPodOngoingAliases();

            const ids = getRegisteredOngoingEffectIds();
            expect(ids.protectionIds.has('ghost_haunting_pod')).toBe(true);
            expect(ids.protectionIds.has('synthetic_guard_pod')).toBe(false);
        });

        test('getRegisteredOngoingEffectIds 会暴露真实存在的 POD ongoing sourceId', () => {
            registerProtection('time_travelers_stasis_field', 'destroy', () => true);

            registerPodOngoingAliases();

            const ids = getRegisteredOngoingEffectIds();
            expect(ids.protectionIds.has('time_travelers_stasis_field_pod')).toBe(true);
        });

        test('同一状态连续查询卡牌压制时复用已计算结果', () => {
            let calls = 0;
            registerCardAbilitySuppression('test_suppressor', () => {
                calls += 1;
                return ['target-1'];
            });

            const state = makeState([
                makeBase({
                    minions: [
                        makeMinion({ uid: 'source-1', defId: 'test_suppressor' }),
                        makeMinion({ uid: 'target-1', defId: 'test_target' }),
                    ],
                }),
            ]);

            expect(isCardSuppressed(state, 'target-1')).toBe(true);
            expect(isCardSuppressed(state, 'target-1')).toBe(true);
            expect(isCardSuppressed(state, 'source-1')).toBe(false);
            expect(calls).toBe(1);
        });

        test('POD alias 若继承 consumable protection，仍应保留 consumable 语义', () => {
            registerProtection('alias_guard', 'destroy', (ctx) => ctx.targetMinion.defId === 'guard-target', {
                consumable: true,
            });

            registerPodOngoingAliases();

            const targetMinion = makeMinion({ uid: 'guard-target', defId: 'guard-target' });
            const state = makeState([
                makeBase({
                    minions: [targetMinion],
                    ongoingActions: [{ uid: 'guard-source', defId: 'alias_guard_pod', ownerId: '0' }],
                }),
            ]);

            expect(getConsumableProtectionSource(state, targetMinion, 0, '1', 'destroy')).toEqual({
                uid: 'guard-source',
                defId: 'alias_guard_pod',
                ownerId: '0',
                controllerId: '0',
            });
        });

        test('consumable protection source 不应在同宿主两张不同控制者的同名 attached action 中错 detach 第一张', () => {
            registerProtection('trickster_hideout', 'action', (ctx) => {
                return ctx.targetMinion.attachedActions.some((attachedHideout) => {
                    if (attachedHideout.defId !== 'trickster_hideout') return false;
                    const controllerId = (attachedHideout.metadata as any)?.sourceControllerId ?? attachedHideout.ownerId;
                    return ctx.targetMinion.controller === controllerId && ctx.sourcePlayerId !== controllerId;
                });
            }, { consumable: true });

            const targetMinion = makeMinion({
                uid: 'hideout-host',
                controller: '0',
                attachedActions: [
                    { uid: 'hideout-opponent', defId: 'trickster_hideout', ownerId: '1', metadata: { sourceControllerId: '1' } } as any,
                    { uid: 'hideout-protector', defId: 'trickster_hideout', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                ],
            });
            const state = makeState([makeBase({ minions: [targetMinion] })]);

            expect(getConsumableProtectionSource(state, targetMinion, 0, '1', 'action')).toEqual({
                uid: 'hideout-protector',
                defId: 'trickster_hideout',
                ownerId: '1',
                controllerId: '0',
            });
        });

        test('consumable protection source 不应在同基地两张不同控制者的同名 ongoing 中错 detach 第一张', () => {
            registerProtection('trickster_hideout', 'action', (ctx) => {
                const base = ctx.state.bases[ctx.targetBaseIndex];
                return base?.ongoingActions.some((baseHideout) => {
                    if (baseHideout.defId !== 'trickster_hideout') return false;
                    const controllerId = (baseHideout.metadata as any)?.sourceControllerId ?? baseHideout.ownerId;
                    return ctx.targetMinion.controller === controllerId && ctx.sourcePlayerId !== controllerId;
                }) ?? false;
            }, { consumable: true });

            const targetMinion = makeMinion({
                uid: 'base-hideout-host',
                controller: '0',
            });
            const state = makeState([makeBase({
                minions: [targetMinion],
                ongoingActions: [
                    { uid: 'base-hideout-opponent', defId: 'trickster_hideout', ownerId: '1', metadata: { sourceControllerId: '1' } } as any,
                    { uid: 'base-hideout-protector', defId: 'trickster_hideout', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                ],
            })]);

            expect(getConsumableProtectionSource(state, targetMinion, 0, '1', 'action')).toEqual({
                uid: 'base-hideout-protector',
                defId: 'trickster_hideout',
                ownerId: '1',
                controllerId: '0',
            });
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
            }, {});

            const base = makeBase({
                ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
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
            }], {});

            const base = makeBase(); // 无 ongoing
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
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
            const { events } = fireTriggers(state, 'onMinionPlayed', {
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
            }], {});
            registerTrigger('trigger_b', 'onMinionPlayed', () => [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: '1', count: 1, cardUids: ['b'] },
                timestamp: 0,
            }], {});

            const base = makeBase({
                minions: [
                    makeMinion({ defId: 'trigger_a', uid: 'ta-1' }),
                    makeMinion({ defId: 'trigger_b', uid: 'tb-1' }),
                ],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect(events[1].type).toBe(SU_EVENTS.CARDS_DRAWN);
        });

        test('fireTriggers non-perInstance source selection 应跳过 canTrigger 不合格的同名 source', () => {
            registerTrigger('test_shared_source_choice', 'onMinionDestroyed', (ctx) => [{
                type: 'TEST_EVENT' as any,
                payload: {
                    sourceCardUid: ctx.sourceCardUid,
                    sourceControllerId: ctx.sourceControllerId,
                },
                timestamp: ctx.now,
            } as SmashUpEvent], {
                playerContext: 'sourceController',
                canTrigger: ctx => ctx.sourceControllerId === '1',
            });

            const state = makeState([
                makeBase({
                    minions: [
                        makeMinion({ uid: 'source-p0', defId: 'test_shared_source_choice', controller: '0' }),
                        makeMinion({ uid: 'source-p1', defId: 'test_shared_source_choice', controller: '1' }),
                        makeMinion({ uid: 'victim-a', defId: 'robot_microbot', controller: '0' }),
                    ],
                }),
            ]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'victim-a',
                triggerMinionDefId: 'robot_microbot',
                triggerMinion: state.bases[0].minions.find(minion => minion.uid === 'victim-a'),
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect((events[0] as any).payload).toEqual({
                sourceCardUid: 'source-p1',
                sourceControllerId: '1',
            });
        });

        test('sourceController 解析到不在 turnOrder 的 ownerPlayerId 时，不应排 queued trigger', () => {
            registerTrigger('ghost_source', 'onTurnStart', () => [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: '0', count: 1, cardUids: ['x'] },
                timestamp: 0,
            }], {
                optional: true,
                playerContext: 'sourceController',
            });

            const ghostMinion = makeMinion({
                uid: 'ghost-source',
                defId: 'ghost_source',
                controller: 'ghost' as any,
                owner: '0',
            });
            const state = makeState([makeBase({ minions: [ghostMinion] })]);

            const queued = collectTriggers(state, 'onTurnStart', {
                playerId: '0',
                now: 1,
            });

            expect(queued).toBeUndefined();
        });

        test('eventPlayer 不在 turnOrder 时，不应排 queued trigger', () => {
            registerTrigger('normal_source', 'onTurnStart', () => [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: '0', count: 1, cardUids: ['x'] },
                timestamp: 0,
            }], {
                optional: true,
            });

            const source = makeMinion({
                uid: 'normal-source',
                defId: 'normal_source',
                controller: '0',
                owner: '0',
            });
            const state = makeState([makeBase({ minions: [source] })]);

            const queued = collectTriggers(state, 'onTurnStart', {
                playerId: 'ghost' as any,
                now: 1,
            });

            expect(queued).toBeUndefined();
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
            }], {});

            const minion = makeMinion({
                uid: 'm-1',
                attachedActions: [{ uid: 'eh-1', defId: 'escape_hatch', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
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
        test('fireTriggerForSource 非 perInstance 来源应优先绑定 triggerMinionUid 对应的实例', () => {
            registerTrigger('test_source', 'onTurnStart', (ctx) => [{
                type: 'TEST_EVENT' as any,
                payload: {
                    sourceCardUid: ctx.sourceCardUid,
                    sourceBaseIndex: ctx.sourceBaseIndex,
                },
                timestamp: ctx.now,
            } as SmashUpEvent], {});

            const first = makeMinion({ uid: 'source-a', defId: 'test_source' });
            const second = makeMinion({ uid: 'source-b', defId: 'test_source' });
            const state = makeState([
                makeBase({ minions: [first] }),
                makeBase({ minions: [second] }),
            ]);

            const result = fireTriggerForSource(state, 'test_source', 'onTurnStart', {
                state,
                playerId: '0',
                triggerMinionUid: 'source-b',
                random: dummyRandom,
                now: 1,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload).toEqual({
                sourceCardUid: 'source-b',
                sourceBaseIndex: 1,
            });
        });

        test('fireTriggerForSource non-perInstance source selection 应跳过 canTrigger 不合格的同名 source', () => {
            registerTrigger('test_shared_source_choice', 'onMinionDestroyed', (ctx) => [{
                type: 'TEST_EVENT' as any,
                payload: {
                    sourceCardUid: ctx.sourceCardUid,
                    sourceControllerId: ctx.sourceControllerId,
                },
                timestamp: ctx.now,
            } as SmashUpEvent], {
                playerContext: 'sourceController',
                canTrigger: ctx => ctx.sourceControllerId === '1',
            });

            const state = makeState([
                makeBase({
                    minions: [
                        makeMinion({ uid: 'source-p0', defId: 'test_shared_source_choice', controller: '0' }),
                        makeMinion({ uid: 'source-p1', defId: 'test_shared_source_choice', controller: '1' }),
                    ],
                }),
            ]);

            const result = fireTriggerForSource(state, 'test_shared_source_choice', 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                random: dummyRandom,
                now: 1,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload).toEqual({
                sourceCardUid: 'source-p1',
                sourceControllerId: '1',
            });
        });

        test('fireTriggerForSource 在显式 sourceCardUid 已指向不合格实例时，不应回退到别的同名 source', () => {
            registerTrigger('test_shared_source_choice', 'onMinionDestroyed', (ctx) => [{
                type: 'TEST_EVENT' as any,
                payload: {
                    sourceCardUid: ctx.sourceCardUid,
                    sourceControllerId: ctx.sourceControllerId,
                },
                timestamp: ctx.now,
            } as SmashUpEvent], {
                playerContext: 'sourceController',
                canTrigger: ctx => ctx.sourceControllerId === '1',
            });

            const state = makeState([
                makeBase({
                    minions: [
                        makeMinion({ uid: 'source-p0', defId: 'test_shared_source_choice', controller: '0' }),
                        makeMinion({ uid: 'source-p1', defId: 'test_shared_source_choice', controller: '1' }),
                    ],
                }),
            ]);

            const result = fireTriggerForSource(state, 'test_shared_source_choice', 'onMinionDestroyed', {
                state,
                playerId: '0',
                sourceCardUid: 'source-p0',
                random: dummyRandom,
                now: 2,
            });

            expect(result.events).toHaveLength(0);
        });

        test('fireTriggerForSource 支持 globalZones=deck', () => {
            registerTrigger('test_global', 'onTurnStart', (ctx) => [{
                type: 'TEST_EVENT' as any,
                payload: { hit: true },
                timestamp: ctx.now,
            } as SmashUpEvent], {
                global: true,
                globalZones: ['deck'],
            });

            const state = makeState([makeBase()]);
            state.players['0'].deck = [{
                uid: 'c-1',
                defId: 'test_global',
                type: 'action',
                owner: '0',
            }];

            const result = fireTriggerForSource(state, 'test_global', 'onTurnStart', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload).toEqual({ hit: true });
        });

        test('fireTriggerForSource 在显式 global source uid 已失配时，应保留显式 provenance 而不偷换成别的同名 discard source', () => {
            registerTrigger('test_global_residual', 'onTurnStart', (ctx) => [{
                type: 'TEST_EVENT' as any,
                payload: {
                    sourceCardUid: ctx.sourceCardUid,
                    sourceControllerId: ctx.sourceControllerId,
                },
                timestamp: ctx.now,
            } as SmashUpEvent], {
                global: true,
                globalZones: ['discard'],
                playerContext: 'sourceController',
            });

            const state = makeState([makeBase()]);
            state.players['0'].discard = [{
                uid: 'other-copy',
                defId: 'test_global_residual',
                type: 'action',
                owner: '0',
            }];

            const result = fireTriggerForSource(state, 'test_global_residual', 'onTurnStart', {
                state,
                playerId: '1',
                sourceCardUid: 'missing-copy',
                sourceControllerId: '1',
                random: dummyRandom,
                now: 3,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload).toEqual({
                sourceCardUid: 'missing-copy',
                sourceControllerId: '1',
            });
        });
    });
});

describe('Affect 分类', () => {
    test('MINION_RETURNED、MINION_CONTROL_CHANGED、CARD_SUPPRESSED 被正确分类为随从 affect', () => {
        const minion = makeMinion({
            uid: 'm-1',
            defId: 'test_minion',
            controller: '0',
            owner: '0',
        });
        const state = makeState([makeBase({ minions: [minion] })]);

        const returned = buildAffectRecords(state, {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'm-1',
                minionDefId: 'test_minion',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'pirate_shanghai',
                sourcePlayerId: '1',
                sourceCardUid: 'a-1',
                sourceDefId: 'pirate_shanghai',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as SmashUpEvent);
        expect(returned).toHaveLength(1);
        expect(returned[0]).toMatchObject({
            targetKind: 'minion',
            targetUid: 'm-1',
            baseIndex: 0,
            affectType: 'return',
            countsForOnMinionAffected: true,
            sourcePlayerId: '1',
            sourceCardUid: 'a-1',
            sourceDefId: 'pirate_shanghai',
        });

        const controlChanged = buildAffectRecords(state, {
            type: SU_EVENTS.MINION_CONTROL_CHANGED,
            payload: {
                minionUid: 'm-1',
                minionDefId: 'test_minion',
                baseIndex: 0,
                ownerId: '0',
                fromControllerId: '0',
                toControllerId: '1',
                sourcePlayerId: '1',
                sourceCardUid: 'a-2',
                sourceDefId: 'ghost_make_contact',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
                reason: 'ghost_make_contact',
            },
            timestamp: 1001,
        } as SmashUpEvent);
        expect(controlChanged).toHaveLength(1);
        expect(controlChanged[0]).toMatchObject({
            targetKind: 'minion',
            affectType: 'control_change',
            countsForOnMinionAffected: true,
            sourceDefId: 'ghost_make_contact',
        });

        const suppressed = buildAffectRecords(state, {
            type: SU_EVENTS.CARD_SUPPRESSED,
            payload: {
                cardUid: 'm-1',
                baseIndex: 0,
                suppressorPlayerId: '1',
                cardType: 'minion',
                reason: 'wizard_mass_enchantment',
                sourcePlayerId: '1',
                sourceCardUid: 'a-3',
                sourceDefId: 'wizard_mass_enchantment',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1002,
        } as SmashUpEvent);
        expect(suppressed).toHaveLength(1);
        expect(suppressed[0]).toMatchObject({
            targetKind: 'minion',
            affectType: 'cancel_ability',
            countsForOnMinionAffected: true,
            sourceDefId: 'wizard_mass_enchantment',
        });

        const attached = buildAffectRecords(state, {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'borrowed-ongoing',
                defId: 'trickster_hideout',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'm-1',
            },
            timestamp: 1003,
        } as SmashUpEvent);
        expect(attached).toHaveLength(1);
        expect(attached[0]).toMatchObject({
            targetKind: 'minion',
            affectType: 'attach_action',
            countsForOnMinionAffected: true,
            sourcePlayerId: '0',
            sourceControllerId: '0',
            sourceCardUid: 'borrowed-ongoing',
            sourceDefId: 'trickster_hideout',
        });
    });

    test('CARD_TO_DECK_TOP/BOTTOM 会把在场卡分类为 shuffle_into_deck', () => {
        const minion = makeMinion({
            uid: 'm-1',
            defId: 'test_minion',
            controller: '0',
            owner: '0',
            attachedActions: [{ uid: 'attach-1', defId: 'test_attached_action', ownerId: '0' }],
        });
        const state = makeState([makeBase({
            minions: [minion],
            ongoingActions: [{ uid: 'ongoing-1', defId: 'test_ongoing_action', ownerId: '0' }],
        })]);

        const bottom = buildAffectRecords(state, {
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: {
                cardUid: 'm-1',
                defId: 'test_minion',
                ownerId: '0',
                reason: 'pirate_full_sail',
                sourcePlayerId: '1',
                sourceCardUid: 'a-1',
                sourceDefId: 'pirate_full_sail',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as SmashUpEvent);
        expect(bottom).toHaveLength(1);
        expect(bottom[0]).toMatchObject({
            targetKind: 'minion',
            targetUid: 'm-1',
            affectType: 'shuffle_into_deck',
            countsForOnMinionAffected: true,
        });

        const top = buildAffectRecords(state, {
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: {
                cardUid: 'ongoing-1',
                defId: 'test_ongoing_action',
                ownerId: '0',
                reason: 'wizard_word_of_recall',
                sourcePlayerId: '1',
                sourceCardUid: 'a-2',
                sourceDefId: 'wizard_word_of_recall',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1001,
        } as SmashUpEvent);
        expect(top).toHaveLength(1);
        expect(top[0]).toMatchObject({
            targetKind: 'ongoing',
            targetUid: 'ongoing-1',
            affectType: 'shuffle_into_deck',
            countsForOnMinionAffected: false,
        });
    });

    test('PERMANENT_POWER_ADDED 正负都算 power_change', () => {
        const minion = makeMinion({ uid: 'm-1', defId: 'test_minion', controller: '0', owner: '0' });
        const state = makeState([makeBase({ minions: [minion] })]);

        const positive = buildAffectRecords(state, {
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: {
                minionUid: 'm-1',
                baseIndex: 0,
                amount: 2,
                reason: 'robot_augmentation',
                sourcePlayerId: '0',
                sourceCardUid: 'a-1',
                sourceDefId: 'robot_augmentation',
                sourceControllerId: '0',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as SmashUpEvent);
        expect(positive).toHaveLength(1);
        expect(positive[0]).toMatchObject({
            affectType: 'power_change',
            countsForOnMinionAffected: true,
            sourceDefId: 'robot_augmentation',
        });

        const negative = buildAffectRecords(state, {
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: {
                minionUid: 'm-1',
                baseIndex: 0,
                amount: -2,
                reason: 'sleep_spores',
                sourcePlayerId: '1',
                sourceCardUid: 'a-2',
                sourceDefId: 'killer_plant_sleep_spores',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1001,
        } as SmashUpEvent);
        expect(negative).toHaveLength(1);
        expect(negative[0]).toMatchObject({
            affectType: 'power_change',
            countsForOnMinionAffected: true,
            sourceDefId: 'killer_plant_sleep_spores',
        });
    });

    test('BASE_ABILITY_SUPPRESSED 只记为基地被影响，不进入 onMinionAffected', () => {
        const state = makeState([makeBase({ defId: 'base_the_central_brain' })]);

        const records = buildAffectRecords(state, {
            type: SU_EVENTS.BASE_ABILITY_SUPPRESSED,
            payload: {
                baseIndex: 0,
                suppressorPlayerId: '1',
                reason: 'wizard_mass_enchantment',
                sourcePlayerId: '1',
                sourceCardUid: 'a-1',
                sourceDefId: 'wizard_mass_enchantment',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as SmashUpEvent);

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
            targetKind: 'base',
            baseIndex: 0,
            affectType: 'cancel_ability',
            countsForOnMinionAffected: false,
        });
    });

    test('ONGOING_DETACHED、CARD_TRANSFERRED、ACTION_PLAYED 不会被当成随从 affect', () => {
        const minion = makeMinion({
            uid: 'm-1',
            defId: 'test_minion',
            controller: '0',
            owner: '0',
            attachedActions: [{ uid: 'attach-1', defId: 'test_attached_action', ownerId: '0' }],
        });
        const state = makeState([makeBase({ minions: [minion] })]);

        const detached = buildAffectRecords(state, {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'attach-1',
                defId: 'test_attached_action',
                ownerId: '0',
                reason: 'test_attached_action_expired',
                sourcePlayerId: '1',
                sourceCardUid: 'a-1',
                sourceDefId: 'pirate_shanghai',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
            },
            timestamp: 1000,
        } as SmashUpEvent);
        expect(detached).toHaveLength(1);
        expect(detached[0]).toMatchObject({
            targetKind: 'attached_action',
            countsForOnMinionAffected: false,
        });

        const transferred = buildAffectRecords(state, {
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: {
                cardUid: 'h-1',
                defId: 'test_action',
                fromPlayerId: '1',
                toPlayerId: '0',
                reason: 'trade',
            },
            timestamp: 1001,
        } as SmashUpEvent);
        expect(transferred).toEqual([]);

        const played = buildAffectRecords(state, {
            type: SU_EVENTS.ACTION_PLAYED,
            payload: {
                playerId: '0',
                cardUid: 'a-1',
                defId: 'test_action',
            },
            timestamp: 1002,
        } as SmashUpEvent);
        expect(played).toEqual([]);
    });
});


// ============================================================================
// 基地限制信息查询测试
// ============================================================================

describe('getBaseRestrictions', () => {
    test('返回 Block the Path 限制信息', () => {
        const base = makeBase({
            ongoingActions: [
                { uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.PIRATES } },
            ],
        });
        const state = makeState([base]);

        const restrictions = getBaseRestrictions(state, 0);

        expect(restrictions).toHaveLength(1);
        expect(restrictions[0]).toEqual({
            type: 'blocked_faction',
            displayText: SMASHUP_FACTION_IDS.PIRATES,
            sourceDefId: 'trickster_block_the_path',
        });
    });

    test('同一基地两张不同 blockedFaction 的 Block the Path 并存时，不应只返回第一张同名来源的限制信息', () => {
        const base = makeBase({
            ongoingActions: [
                { uid: 'bp-pirates', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.PIRATES } },
                { uid: 'bp-robots', defId: 'trickster_block_the_path', ownerId: '1', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } },
            ],
        });
        const state = makeState([base]);

        const restrictions = getBaseRestrictions(state, 0);

        expect(restrictions).toEqual([
            {
                type: 'blocked_faction',
                displayText: SMASHUP_FACTION_IDS.PIRATES,
                sourceDefId: 'trickster_block_the_path',
            },
            {
                type: 'blocked_faction',
                displayText: SMASHUP_FACTION_IDS.ROBOTS,
                sourceDefId: 'trickster_block_the_path',
            },
        ]);
    });

    test('POD 版 Block the Path 也返回限制信息并保留真实来源 defId', () => {
        const base = makeBase({
            ongoingActions: [
                { uid: 'bp-1', defId: 'trickster_block_the_path_pod', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } },
            ],
        });
        const state = makeState([base]);

        const restrictions = getBaseRestrictions(state, 0);

        expect(restrictions).toHaveLength(1);
        expect(restrictions[0]).toEqual({
            type: 'blocked_faction',
            displayText: SMASHUP_FACTION_IDS.ROBOTS,
            sourceDefId: 'trickster_block_the_path_pod',
        });
    });

    test('无限制时返回空数组', () => {
        const base = makeBase();
        const state = makeState([base]);

        const restrictions = getBaseRestrictions(state, 0);

        expect(restrictions).toEqual([]);
    });

    test('Block the Path 无 metadata 时不返回限制', () => {
        const base = makeBase({
            ongoingActions: [
                { uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0' },
            ],
        });
        const state = makeState([base]);

        const restrictions = getBaseRestrictions(state, 0);

        expect(restrictions).toEqual([]);
    });
});
