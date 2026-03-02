/**
 * 审计测试：ongoingTarget: 'minion' 的牌的 trigger 必须能从 attachedActions 中找到自己
 *
 * 防止的 bug：trigger 回调错误地在 base.ongoingActions 中查找，
 * 但 ongoingTarget: 'minion' 的牌实际存放在 minion.attachedActions 上。
 *
 * 对每个 ongoingTarget: 'minion' 且注册了 onTurnStart/onTurnEnd trigger 的牌，
 * 构造一个状态（牌在 attachedActions 上），调用 fireTriggers，验证产生了事件。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAllCardDefs } from '../data/cards';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import {
    clearOngoingEffectRegistry,
    getRegisteredOngoingEffectIds,
    fireTriggers,
} from '../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import type { SmashUpCore, ActionCardDef, MinionOnBase, BaseInPlay } from '../domain/types';
import type { TriggerTiming } from '../domain/ongoingEffects';

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'test-minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
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

function makeState(bases: BaseInPlay[]): SmashUpCore {
    return {
        players: {
            '0': {
                hand: [], discard: [], deck: [],
                vp: 0, extraMinions: 0, extraActions: 0,
                minionPlayed: false, actionPlayed: false,
            } as any,
            '1': {
                hand: [], discard: [], deck: [],
                vp: 0, extraMinions: 0, extraActions: 0,
                minionPlayed: false, actionPlayed: false,
            } as any,
        },
        bases,
        currentPlayer: '0',
        turnNumber: 2,
        baseDeck: [],
    } as SmashUpCore;
}

// ============================================================================
// 测试
// ============================================================================

describe('审计：ongoingTarget=minion 的牌的 trigger 必须从 attachedActions 查找', () => {
    beforeAll(() => {
        clearRegistry();
        clearOngoingEffectRegistry();
        clearBaseAbilityRegistry();
        clearPowerModifierRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    // 收集所有 ongoingTarget: 'minion' 的行动卡
    const allDefs = getAllCardDefs();
    const minionOngoingCards = allDefs.filter(
        (d): d is ActionCardDef =>
            d.type === 'action' &&
            (d as ActionCardDef).subtype === 'ongoing' &&
            (d as ActionCardDef).ongoingTarget === 'minion',
    );

    // 需要测试的时机
    const timingsToTest: TriggerTiming[] = ['onTurnStart', 'onTurnEnd'];

    for (const cardDef of minionOngoingCards) {
        for (const timing of timingsToTest) {
            it(`[${cardDef.id}] ${timing} trigger 应能从 attachedActions 中找到自己并产生事件`, () => {
                // 跳过 POD 占位符（它们是故意返回空事件的）
                if (cardDef.id.endsWith('_pod')) {
                    return;
                }
                
                // 先检查这张牌是否注册了该时机的 trigger
                const { triggerIds } = getRegisteredOngoingEffectIds();
                const registeredTimings = triggerIds.get(cardDef.id);
                if (!registeredTimings || !registeredTimings.includes(timing)) {
                    // 没注册该时机的 trigger，跳过
                    return;
                }

                // 构造状态：牌在随从的 attachedActions 上（正确位置）
                const minion = makeMinion({
                    uid: 'target-minion',
                    defId: 'test_carrier',
                    controller: '0',
                    owner: '0',
                    attachedActions: [
                        { uid: `${cardDef.id}-uid`, defId: cardDef.id, ownerId: '0' },
                    ],
                });
                const base = makeBase({ minions: [minion] });
                const state = makeState([base]);

                // 调用 fireTriggers
                const result = fireTriggers(state, timing, {
                    state,
                    playerId: '0',
                    random: () => 0.5,
                    now: Date.now(),
                });

                // 必须产生至少一个事件（说明 trigger 找到了牌）
                expect(
                    result.events.length,
                    `[${cardDef.id}] 注册了 ${timing} trigger，但牌在 attachedActions 上时未产生事件。` +
                    `可能是 trigger 回调错误地在 base.ongoingActions 中查找。`,
                ).toBeGreaterThan(0);
            });
        }
    }
});
