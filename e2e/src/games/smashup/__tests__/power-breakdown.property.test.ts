/**
 * 大杀四方 - 力量 Breakdown 属性测试
 *
 * Feature: unified-damage-buff-system
 *
 * **Validates: Requirements 5.1, 5.2, 5.4, 5.5**
 *
 * Property 9: 大杀四方力量明细总和一致性
 * Property 10: 大杀四方力量 Breakdown 完整性
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
    getOngoingPowerModifierDetails,
    getOngoingPowerModifier,
    getEffectivePower,
    getEffectivePowerBreakdown,
    clearPowerModifierRegistry,
} from '../domain/ongoingModifiers';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { makeMinion, makePlayer, makeState } from './helpers';
import type { MinionOnBase, BaseInPlay, OngoingActionOnBase, SmashUpCore } from '../domain/types';

// ============================================================================
// 初始化：注册所有能力（含 ongoing modifier）
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

/** 创建基地上的 ongoing 行动卡 */
function makeOngoing(defId: string, ownerId: string, uid?: string): OngoingActionOnBase {
    return { uid: uid ?? `ongoing-${defId}`, defId, ownerId };
}

/** 创建带随从和 ongoing 的基地 */
function makeBase(
    defId: string,
    minions: MinionOnBase[],
    ongoingActions: OngoingActionOnBase[] = [],
): BaseInPlay {
    return { defId, minions, ongoingActions };
}

// ============================================================================
// 生成器
// ============================================================================

/** 基础力量（1~10，大杀四方随从力量范围） */
const arbBasePower = () => fc.integer({ min: 1, max: 10 });

/** 永久力量修正（-3~+5，+1 指示物等） */
const arbPowerModifier = () => fc.integer({ min: -3, max: 5 });

/** 临时力量修正（-5~+5，回合结束清零） */
const arbTempPowerModifier = () => fc.integer({ min: -5, max: 5 });

/** 手牌数量（0~10，影响幽灵系能力） */
const arbHandSize = () => fc.integer({ min: 0, max: 10 });

/** 生成随从 uid */
const arbMinionUid = (prefix: string) => fc.integer({ min: 1, max: 999 }).map(n => `${prefix}-${n}`);

// ============================================================================
// Property 9: 大杀四方力量明细总和一致性
// ============================================================================

describe('Property 9: 大杀四方力量明细总和一致性', () => {

    /**
     * **Validates: Requirements 5.4, 5.5**
     *
     * 核心不变量：getOngoingPowerModifierDetails 返回的明细值总和
     * 必须等于 getOngoingPowerModifier 返回的总值。
     */
    it('明细总和等于 getOngoingPowerModifier 总值（无 ongoing 修正场景）', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                arbTempPowerModifier(),
                (basePower, powerMod, tempPowerMod) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    minion.tempPowerModifier = tempPowerMod;

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const details = getOngoingPowerModifierDetails(state, minion, 0);
                    const detailSum = details.reduce((sum, d) => sum + d.value, 0);
                    const total = getOngoingPowerModifier(state, minion, 0);

                    expect(detailSum).toBe(total);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.4, 5.5**
     *
     * 有 ongoing 修正时（忍者毒药 -4），明细总和仍等于总值。
     */
    it('明细总和等于 getOngoingPowerModifier 总值（忍者毒药场景）', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                fc.integer({ min: 1, max: 3 }), // 毒药数量
                (basePower, powerMod, poisonCount) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    // 附着毒药到随从上
                    minion.attachedActions = Array.from({ length: poisonCount }, (_, i) => ({
                        uid: `poison-${i}`,
                        defId: 'ninja_poison',
                        ownerId: '1',
                    }));

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const details = getOngoingPowerModifierDetails(state, minion, 0);
                    const detailSum = details.reduce((sum, d) => sum + d.value, 0);
                    const total = getOngoingPowerModifier(state, minion, 0);

                    expect(detailSum).toBe(total);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.5**
     *
     * getEffectivePower 的返回值与增强前一致：
     * max(0, basePower + powerModifier + tempPowerModifier + ongoingModifier)
     */
    it('getEffectivePower 与手动计算一致', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                arbTempPowerModifier(),
                fc.boolean(), // 是否附着升级卡
                (basePower, powerMod, tempPowerMod, hasUpgrade) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    minion.tempPowerModifier = tempPowerMod;
                    if (hasUpgrade) {
                        minion.attachedActions = [{
                            uid: 'upgrade-1',
                            defId: 'dino_upgrade',
                            ownerId: '0',
                        }];
                    }

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const ongoingMod = getOngoingPowerModifier(state, minion, 0);
                    const expected = Math.max(0, basePower + powerMod + tempPowerMod + ongoingMod);
                    const actual = getEffectivePower(state, minion, 0);

                    expect(actual).toBe(expected);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.4**
     *
     * 催眠孢子（base ongoing，对手随从 -1）场景下明细总和一致性。
     */
    it('明细总和等于总值（催眠孢子 base ongoing 场景）', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                fc.integer({ min: 1, max: 3 }), // 催眠孢子数量
                (basePower, sporeCount) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    const ongoingActions = Array.from({ length: sporeCount }, (_, i) =>
                        makeOngoing('killer_plant_sleep_spores', '1', `spore-${i}`),
                    );

                    const state = makeState({
                        bases: [makeBase('test_base', [minion], ongoingActions)],
                    });

                    const details = getOngoingPowerModifierDetails(state, minion, 0);
                    const detailSum = details.reduce((sum, d) => sum + d.value, 0);
                    const total = getOngoingPowerModifier(state, minion, 0);

                    expect(detailSum).toBe(total);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.4, 5.5**
     *
     * 幽灵系能力（手牌数影响力量）场景下明细总和一致性。
     */
    it('明细总和等于总值（幽灵不散阴魂 + 手牌数场景）', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbHandSize(),
                (basePower, handSize) => {
                    const minion = makeMinion('m1', 'ghost_haunting', '0', basePower);
                    const hand = Array.from({ length: handSize }, (_, i) => ({
                        uid: `card-${i}`,
                        defId: 'test_card',
                        type: 'minion' as const,
                        owner: '0',
                    }));

                    const state = makeState({
                        players: {
                            '0': makePlayer('0', { hand }),
                            '1': makePlayer('1'),
                        },
                        bases: [makeBase('test_base', [minion])],
                    });

                    const details = getOngoingPowerModifierDetails(state, minion, 0);
                    const detailSum = details.reduce((sum, d) => sum + d.value, 0);
                    const total = getOngoingPowerModifier(state, minion, 0);

                    expect(detailSum).toBe(total);
                },
            ),
            { numRuns: 200 },
        );
    });
});


// ============================================================================
// Property 10: 大杀四方力量 Breakdown 完整性
// ============================================================================

describe('Property 10: 大杀四方力量 Breakdown 完整性', () => {

    /**
     * **Validates: Requirements 5.1, 5.2**
     *
     * 核心不变量：basePower + permanentModifier + tempModifier + sum(ongoingDetails.value) === finalPower
     * （finalPower 已经过 Math.max(0, ...) 截断）
     */
    it('breakdown 各项之和等于 finalPower（无 ongoing 修正）', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                arbTempPowerModifier(),
                (basePower, powerMod, tempPowerMod) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    minion.tempPowerModifier = tempPowerMod;

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const bd = getEffectivePowerBreakdown(state, minion, 0);
                    const ongoingSum = bd.ongoingDetails.reduce((sum, d) => sum + d.value, 0);
                    const rawTotal = bd.basePower + bd.permanentModifier + bd.tempModifier + ongoingSum;

                    expect(bd.finalPower).toBe(Math.max(0, rawTotal));
                    expect(bd.basePower).toBe(basePower);
                    expect(bd.permanentModifier).toBe(powerMod);
                    expect(bd.tempModifier).toBe(tempPowerMod);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.1, 5.2**
     *
     * 有 ongoing 修正时（忍者毒药 -4），breakdown 仍满足总和等式。
     */
    it('breakdown 各项之和等于 finalPower（忍者毒药场景）', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                fc.integer({ min: 1, max: 3 }),
                (basePower, powerMod, poisonCount) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    minion.attachedActions = Array.from({ length: poisonCount }, (_, i) => ({
                        uid: `poison-${i}`,
                        defId: 'ninja_poison',
                        ownerId: '1',
                    }));

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const bd = getEffectivePowerBreakdown(state, minion, 0);
                    const ongoingSum = bd.ongoingDetails.reduce((sum, d) => sum + d.value, 0);
                    const rawTotal = bd.basePower + bd.permanentModifier + bd.tempModifier + ongoingSum;

                    expect(bd.finalPower).toBe(Math.max(0, rawTotal));

                    // 毒药应出现在 ongoingDetails 中
                    const poisonDetail = bd.ongoingDetails.find(d => d.sourceDefId === 'ninja_poison');
                    expect(poisonDetail).toBeDefined();
                    expect(poisonDetail!.value).toBe(poisonCount * -4);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.2**
     *
     * 所有非零 ongoing 修正来源都出现在 breakdown 的 ongoingDetails 中。
     */
    it('所有非零 ongoing 修正来源都出现在 ongoingDetails 中', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                fc.boolean(), // 是否附着升级卡（dino_upgrade +2）
                fc.boolean(), // 是否附着毒药（ninja_poison -4）
                (basePower, hasUpgrade, hasPoison) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    const attached: { uid: string; defId: string; ownerId: string }[] = [];
                    if (hasUpgrade) {
                        attached.push({ uid: 'upgrade-1', defId: 'dino_upgrade', ownerId: '0' });
                    }
                    if (hasPoison) {
                        attached.push({ uid: 'poison-1', defId: 'ninja_poison', ownerId: '1' });
                    }
                    minion.attachedActions = attached;

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const bd = getEffectivePowerBreakdown(state, minion, 0);

                    // 验证每个非零 ongoing 修正都有对应的 detail
                    if (hasUpgrade) {
                        const upgradeDet = bd.ongoingDetails.find(d => d.sourceDefId === 'dino_upgrade');
                        expect(upgradeDet).toBeDefined();
                        expect(upgradeDet!.value).toBe(2);
                    }
                    if (hasPoison) {
                        const poisonDet = bd.ongoingDetails.find(d => d.sourceDefId === 'ninja_poison');
                        expect(poisonDet).toBeDefined();
                        expect(poisonDet!.value).toBe(-4);
                    }

                    // 总和等式始终成立
                    const ongoingSum = bd.ongoingDetails.reduce((sum, d) => sum + d.value, 0);
                    const rawTotal = bd.basePower + bd.permanentModifier + bd.tempModifier + ongoingSum;
                    expect(bd.finalPower).toBe(Math.max(0, rawTotal));
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.1, 5.2**
     *
     * breakdown 的 finalPower 与 getEffectivePower 返回值一致。
     */
    it('breakdown.finalPower 与 getEffectivePower 一致', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                arbTempPowerModifier(),
                fc.boolean(), // 是否有 ongoing 修正
                (basePower, powerMod, tempPowerMod, hasOngoing) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    minion.tempPowerModifier = tempPowerMod;
                    if (hasOngoing) {
                        minion.attachedActions = [{
                            uid: 'upgrade-1',
                            defId: 'dino_upgrade',
                            ownerId: '0',
                        }];
                    }

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const bd = getEffectivePowerBreakdown(state, minion, 0);
                    const effectivePower = getEffectivePower(state, minion, 0);

                    expect(bd.finalPower).toBe(effectivePower);
                },
            ),
            { numRuns: 200 },
        );
    });

    /**
     * **Validates: Requirements 5.2**
     *
     * 无任何修正时 ongoingDetails 为空数组，basePower === finalPower。
     */
    it('无修正时 ongoingDetails 为空，basePower === finalPower', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                (basePower) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    // powerModifier 默认为 0，tempPowerModifier 默认 undefined

                    const state = makeState({
                        bases: [makeBase('test_base', [minion])],
                    });

                    const bd = getEffectivePowerBreakdown(state, minion, 0);

                    expect(bd.ongoingDetails).toEqual([]);
                    expect(bd.permanentModifier).toBe(0);
                    expect(bd.tempModifier).toBe(0);
                    expect(bd.finalPower).toBe(basePower);
                },
            ),
            { numRuns: 100 },
        );
    });

    /**
     * **Validates: Requirements 5.1, 5.2**
     *
     * 多种 ongoing 修正组合场景（base ongoing + minion attached）下 breakdown 完整性。
     */
    it('多种 ongoing 修正组合下 breakdown 完整性', () => {
        fc.assert(
            fc.property(
                arbBasePower(),
                arbPowerModifier(),
                arbTempPowerModifier(),
                fc.boolean(), // 催眠孢子（base ongoing，对手随从 -1）
                fc.boolean(), // 恐龙升级（minion attached +2）
                (basePower, powerMod, tempPowerMod, hasSleepSpores, hasUpgrade) => {
                    const minion = makeMinion('m1', 'test_minion', '0', basePower);
                    minion.powerModifier = powerMod;
                    minion.tempPowerModifier = tempPowerMod;

                    if (hasUpgrade) {
                        minion.attachedActions = [{
                            uid: 'upgrade-1',
                            defId: 'dino_upgrade',
                            ownerId: '0',
                        }];
                    }

                    const ongoingActions: OngoingActionOnBase[] = [];
                    if (hasSleepSpores) {
                        // 催眠孢子由对手放置，对非 owner 随从 -1
                        ongoingActions.push(makeOngoing('killer_plant_sleep_spores', '1'));
                    }

                    const state = makeState({
                        bases: [makeBase('test_base', [minion], ongoingActions)],
                    });

                    const bd = getEffectivePowerBreakdown(state, minion, 0);
                    const ongoingSum = bd.ongoingDetails.reduce((sum, d) => sum + d.value, 0);
                    const rawTotal = bd.basePower + bd.permanentModifier + bd.tempModifier + ongoingSum;

                    // 核心等式
                    expect(bd.finalPower).toBe(Math.max(0, rawTotal));

                    // 与 getEffectivePower 一致
                    expect(bd.finalPower).toBe(getEffectivePower(state, minion, 0));
                },
            ),
            { numRuns: 200 },
        );
    });
});
