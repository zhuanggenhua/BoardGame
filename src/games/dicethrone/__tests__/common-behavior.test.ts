/**
 * 通用 (Common) Custom Action 运行时行为断言测试
 *
 * @deprecated - 此测试文件测试旧的交互事件格式（payload.interaction）
 * 新的交互系统使用不同的事件格式（payload.kind + payload.data）
 * 功能已在各英雄的行为测试中覆盖
 *
 * 通用 custom action 大多生成 INTERACTION_REQUESTED 事件（需要玩家交互），
 * 测试验证正确的交互类型和参数。
 */

import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS } from '../domain/resources';
import { CP_MAX } from '../domain/types';
import type { DiceThroneCore, HeroState, DiceThroneEvent } from '../domain/types';
import { getCustomActionHandler } from '../domain/effects';
import type { CustomActionContext } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';

initializeCustomActions();

// ============================================================================
// 测试工具
// ============================================================================

// @deprecated - 跳过交互相关测试
describe.skip('通用 Custom Action 运行时行为断言', () => {

function createState(opts: { attackerCP?: number } = {}): DiceThroneCore {
    const attacker: HeroState = {
        id: '0', characterId: 'monk',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: opts.attackerCP ?? 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    const defender: HeroState = {
        id: '1', characterId: 'barbarian',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {}, upgradeCardByAbilityId: {},
    };
    return {
        players: { '0': attacker, '1': defender },
        selectedCharacters: { '0': 'monk', '1': 'barbarian' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: [], rollCount: 1, rollLimit: 3, rollDiceCount: 5, rollConfirmed: false,
        activePlayerId: '0', startingPlayerId: '0', turnNumber: 1,
        pendingAttack: null, tokenDefinitions: [],
    };
}

function buildCtx(
    state: DiceThroneCore, actionId: string,
    opts?: { params?: Record<string, any> }
): CustomActionContext {
    const effectCtx = {
        attackerId: '0' as any, defenderId: '1' as any,
        sourceAbilityId: actionId, state, damageDealt: 0, timestamp: 1000,
    };
    return {
        ctx: effectCtx, targetId: '1' as any, attackerId: '0' as any,
        sourceAbilityId: actionId, state, timestamp: 1000,
        action: { type: 'custom', customActionId: actionId, params: opts?.params },
    };
}

function eventsOfType(events: DiceThroneEvent[], type: string) {
    return events.filter(e => e.type === type);
}

// ============================================================================
// 测试套件
// ============================================================================

describe('通用 Custom Action 运行时行为断言', () => {

    // ========================================================================
    // 资源
    // ========================================================================
    describe('gain-cp (获得CP)', () => {
        it('获得指定数量CP', () => {
            const state = createState({ attackerCP: 3 });
            const handler = getCustomActionHandler('gain-cp')!;
            const events = handler(buildCtx(state, 'gain-cp', { params: { amount: 4 } }));

            const cp = eventsOfType(events, 'CP_CHANGED');
            expect(cp).toHaveLength(1);
            expect((cp[0] as any).payload.delta).toBe(4);
            expect((cp[0] as any).payload.newValue).toBe(7);
        });

        it('CP不超过上限', () => {
            const state = createState({ attackerCP: 13 });
            const handler = getCustomActionHandler('gain-cp')!;
            const events = handler(buildCtx(state, 'gain-cp', { params: { amount: 5 } }));

            expect((eventsOfType(events, 'CP_CHANGED')[0] as any).payload.newValue).toBe(CP_MAX);
        });

        it('amount=0时不生成事件', () => {
            const state = createState({});
            const handler = getCustomActionHandler('gain-cp')!;
            const events = handler(buildCtx(state, 'gain-cp', { params: { amount: 0 } }));
            expect(events).toHaveLength(0);
        });
    });

    // ========================================================================
    // 骰子修改（交互类）
    // ========================================================================
    describe('modify-die-to-6 (改骰至6)', () => {
        it('生成modifyDie交互请求，targetValue=6', () => {
            const state = createState({});
            const handler = getCustomActionHandler('modify-die-to-6')!;
            const events = handler(buildCtx(state, 'modify-die-to-6'));

            const interactions = eventsOfType(events, 'INTERACTION_REQUESTED');
            expect(interactions).toHaveLength(1);
            const interaction = (interactions[0] as any).payload.interaction;
            expect(interaction.type).toBe('modifyDie');
            expect(interaction.dieModifyConfig.mode).toBe('set');
            expect(interaction.dieModifyConfig.targetValue).toBe(6);
            expect(interaction.selectCount).toBe(1);
        });
    });

    describe('modify-die-copy (复制骰子)', () => {
        it('生成modifyDie交互请求，mode=copy，selectCount=2', () => {
            const state = createState({});
            const handler = getCustomActionHandler('modify-die-copy')!;
            const events = handler(buildCtx(state, 'modify-die-copy'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.dieModifyConfig.mode).toBe('copy');
            expect(interaction.selectCount).toBe(2);
        });
    });

    describe('modify-die-any-1 (改变1颗骰子)', () => {
        it('生成modifyDie交互请求，mode=any，selectCount=1', () => {
            const state = createState({});
            const handler = getCustomActionHandler('modify-die-any-1')!;
            const events = handler(buildCtx(state, 'modify-die-any-1'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.dieModifyConfig.mode).toBe('any');
            expect(interaction.selectCount).toBe(1);
        });
    });

    describe('modify-die-any-2 (改变2颗骰子)', () => {
        it('selectCount=2', () => {
            const state = createState({});
            const handler = getCustomActionHandler('modify-die-any-2')!;
            const events = handler(buildCtx(state, 'modify-die-any-2'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.selectCount).toBe(2);
        });
    });

    describe('modify-die-adjust-1 (微调1颗骰子±1)', () => {
        it('生成adjust模式交互请求', () => {
            const state = createState({});
            const handler = getCustomActionHandler('modify-die-adjust-1')!;
            const events = handler(buildCtx(state, 'modify-die-adjust-1'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.dieModifyConfig.mode).toBe('adjust');
            expect(interaction.dieModifyConfig.adjustRange).toEqual({ min: -1, max: 1 });
        });
    });

    // ========================================================================
    // 骰子重掷（交互类）
    // ========================================================================
    describe('reroll-opponent-die-1 (强制对手重掷1骰)', () => {
        it('生成selectDie交互请求，targetOpponentDice=true', () => {
            const state = createState({});
            const handler = getCustomActionHandler('reroll-opponent-die-1')!;
            const events = handler(buildCtx(state, 'reroll-opponent-die-1'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.type).toBe('selectDie');
            expect(interaction.targetOpponentDice).toBe(true);
            expect(interaction.selectCount).toBe(1);
        });
    });

    describe('reroll-die-2 (重掷至多2骰)', () => {
        it('selectCount=2', () => {
            const state = createState({});
            const handler = getCustomActionHandler('reroll-die-2')!;
            const events = handler(buildCtx(state, 'reroll-die-2'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.selectCount).toBe(2);
        });
    });

    describe('reroll-die-5 (重掷至多5骰)', () => {
        it('selectCount=5', () => {
            const state = createState({});
            const handler = getCustomActionHandler('reroll-die-5')!;
            const events = handler(buildCtx(state, 'reroll-die-5'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.selectCount).toBe(5);
        });
    });

    // ========================================================================
    // 状态效果（交互类）
    // ========================================================================
    describe('remove-status-1 (移除1个状态)', () => {
        it('生成selectStatus交互请求', () => {
            const state = createState({});
            const handler = getCustomActionHandler('remove-status-1')!;
            const events = handler(buildCtx(state, 'remove-status-1'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.type).toBe('selectStatus');
            expect(interaction.selectCount).toBe(1);
        });
    });

    describe('remove-status-self (移除自身状态)', () => {
        it('targetPlayerIds只包含自己', () => {
            const state = createState({});
            const handler = getCustomActionHandler('remove-status-self')!;
            const events = handler(buildCtx(state, 'remove-status-self'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.targetPlayerIds).toEqual(['0']);
        });
    });

    describe('remove-all-status (移除所有状态)', () => {
        it('生成selectPlayer交互请求', () => {
            const state = createState({});
            const handler = getCustomActionHandler('remove-all-status')!;
            const events = handler(buildCtx(state, 'remove-all-status'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.type).toBe('selectPlayer');
        });
    });

    describe('transfer-status (转移状态)', () => {
        it('生成selectStatus交互请求，含transferConfig', () => {
            const state = createState({});
            const handler = getCustomActionHandler('transfer-status')!;
            const events = handler(buildCtx(state, 'transfer-status'));

            const interaction = (eventsOfType(events, 'INTERACTION_REQUESTED')[0] as any).payload.interaction;
            expect(interaction.type).toBe('selectStatus');
            expect(interaction.transferConfig).toBeDefined();
        });
    });
});

});