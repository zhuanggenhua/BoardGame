/**
 * 雷霆万钧技能测试
 * 
 * 测试场景：
 * 1. 触发雷霆万钧技能（3个掌面）
 * 2. 验证投掷3个奖励骰
 * 3. 验证重掷交互显示（有太极标记时）
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { diceThroneSystemsForTest } from '../game';
import { createQueuedRandom, getCardById } from './test-utils';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { initHeroState } from '../domain/characters';
import { TOKEN_IDS } from '../domain/ids';
import { MONK_CARDS } from '../heroes/monk/cards';
import { RESOURCE_IDS } from '../domain/resources';

const monkSetupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'monk' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'barbarian' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createMonkState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, diceThroneSystemsForTest, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: diceThroneSystemsForTest };
    for (const c of monkSetupCommands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    state.core.selectedCharacters['1'] = 'monk';
    state.core.players['1'] = initHeroState('1', 'monk', random);
    return state;
}

describe('雷霆万钧技能', () => {
    it('应该投掷3个奖励骰并提供重掷交互（有太极标记时）', () => {
        // 骰子序列：
        // - 进攻掷骰 5 次（前3个会被使用）→ [3,3,3,1,1] = 3 Palm + 2 其他
        // - 奖励骰 3 次 → [4,5,6]
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 4, 5, 6]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                
                // 玩家0有2个太极标记
                state.core.players['0'].tokens = { [TOKEN_IDS.TAIJI]: 2 };
                
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: '雷霆万钧技能（有太极标记）',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // main1 → offensiveRoll
                { type: 'ROLL_DICE', playerId: '0', payload: {} }, // 掷骰 → [3,3,3,1,1]
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // offensiveRoll → defensiveRoll
                { type: 'ROLL_DICE', playerId: '1', payload: {} }, // 防御方掷骰
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} }, // 跳过防御技能
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} }, // defensiveRoll → main2（触发攻击结算）
            ],
        });

        // 验证命令执行成功
        expect(result.steps[0].success).toBe(true);

        // 验证 pendingBonusDiceSettlement 被设置
        expect(result.finalState.core.pendingBonusDiceSettlement).toBeDefined();
        expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(3);
        expect(result.finalState.core.pendingBonusDiceSettlement?.attackerId).toBe('0');
        expect(result.finalState.core.pendingBonusDiceSettlement?.rerollCostTokenId).toBe(TOKEN_IDS.TAIJI);
        expect(result.finalState.core.pendingBonusDiceSettlement?.rerollCostAmount).toBe(2);
        expect(result.finalState.core.pendingBonusDiceSettlement?.maxRerollCount).toBe(1);

        // 验证事件流中有 BONUS_DIE_ROLLED 事件
        const eventStream = result.finalState.sys.eventStream?.entries || [];
        const bonusDieEvents = eventStream.filter(e => e.event.type === 'BONUS_DIE_ROLLED');
        expect(bonusDieEvents).toHaveLength(3); // 应该有3个奖励骰投掷事件

        // 验证事件流中有 BONUS_DICE_REROLL_REQUESTED 事件
        const rerollRequestedEvents = eventStream.filter(e => e.event.type === 'BONUS_DICE_REROLL_REQUESTED');
        expect(rerollRequestedEvents).toHaveLength(1); // 应该有1个重掷请求事件

    });

    it('弹一手修改雷霆万钧奖励骰后，应按改后的点数和结算伤害', () => {
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 4, 5, 6]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                state.core.selectedCharacters['1'] = 'barbarian';
                state.core.players['1'] = initHeroState('1', 'barbarian', random);
                state.core.players['0'].tokens = {};
                state.core.players['1'].tokens = {};
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [getCardById('card-flick')];
                state.core.players['1'].resources[RESOURCE_IDS.CP] = 3;
                return state;
            },
            silent: true,
        });

        const opened = runner.run({
            name: '雷霆万钧奖励骰打开弹一手响应窗口',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { type: 'ROLL_DICE', playerId: '0', payload: {} },
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { type: 'ROLL_DICE', playerId: '1', payload: {} },
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} },
            ],
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.steps.every(step => step.success)).toBe(true);
        expect(opened.finalState.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            sourceAbilityId: 'thunder-strike',
            attackerId: '0',
            targetId: '1',
            allowDiceModification: true,
            opensAfterRollConfirmedResponseWindow: true,
        });
        const openedDiceValues = opened.finalState.core.pendingBonusDiceSettlement?.dice.map(die => die.value) ?? [];
        expect(openedDiceValues).toHaveLength(3);
        expect(opened.finalState.sys.responseWindow?.current).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
        });
        const targetDieIndex = 2;
        const targetDieValue = openedDiceValues[targetDieIndex] ?? 1;
        const modifiedDieValue = targetDieValue < 6 ? targetDieValue + 1 : targetDieValue - 1;
        const expectedModifiedDamage = openedDiceValues.reduce((sum, value, index) => (
            sum + (index === targetDieIndex ? modifiedDieValue : value)
        ), 0);

        runner.setState(opened.finalState);
        const playedFlick = runner.dispatch('PLAY_CARD', { playerId: '1', cardId: 'card-flick' });
        expect(playedFlick.success).toBe(true);
        expect(playedFlick.finalState.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();

        const modified = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: targetDieIndex, newValue: modifiedDieValue });
        expect(modified.success).toBe(true);
        expect(modified.finalState.core.pendingBonusDiceSettlement?.dice.find(die => die.index === targetDieIndex)).toMatchObject({
            value: modifiedDieValue,
        });

        const confirmedCard = runner.dispatch('SYS_INTERACTION_CONFIRM', { playerId: '1' });
        expect(confirmedCard.success).toBe(true);
        expect(confirmedCard.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(confirmedCard.finalState.core.players['1'].discard.some(card => card.id === 'card-flick')).toBe(true);

        const defenderHpBeforeSettle = confirmedCard.finalState.core.players['1'].resources[RESOURCE_IDS.HP];
        const settled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
        expect(settled.success).toBe(true);
        expect(settled.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.finalState.core.pendingDamage).toBeUndefined();
        expect(settled.finalState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(defenderHpBeforeSettle - expectedModifiedDamage);

        const damageEvent = settled.events.find(event => event.type === 'DAMAGE_DEALT');
        expect(damageEvent?.payload).toMatchObject({
            targetId: '1',
            amount: expectedModifiedDamage,
            actualDamage: expectedModifiedDamage,
            sourceAbilityId: 'thunder-strike',
            sourcePlayerId: '0',
        });
    });

    it('雷霆万钧奖励骰伤害结算前应该允许攻击方使用气增伤', () => {
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 4, 5, 6]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                state.core.players['0'].tokens = { [TOKEN_IDS.TAIJI]: 2 };
                state.core.players['1'].tokens = {};
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: '雷霆万钧奖励骰伤害可用气增伤',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { type: 'ROLL_DICE', playerId: '0', payload: {} },
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { type: 'ROLL_DICE', playerId: '1', payload: {} },
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { type: 'SKIP_BONUS_DICE_REROLL', playerId: '0', payload: {} },
                { type: 'USE_TOKEN', playerId: '0', payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 } },
            ],
        });

        expect(result.finalState.core.pendingDamage).toMatchObject({
            responseType: 'beforeDamageDealt',
            responderId: '0',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            sourceAbilityId: 'thunder-strike',
            originalDamage: 18,
            currentDamage: 19,
            damageScope: 'attack',
        });
        expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(1);
    });

    it('风暴突袭 II 奖励骰伤害结算前应该允许攻击方使用气增伤', () => {
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 4, 5, 6]);
        const stormAssault = MONK_CARDS.find(card => card.id === 'card-storm-assault-2');
        expect(stormAssault).toBeDefined();

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                state.core.players['0'].tokens = { [TOKEN_IDS.TAIJI]: 1 };
                state.core.players['1'].tokens = {};
                state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
                state.core.players['0'].hand = stormAssault ? [{ ...stormAssault }] : [];
                state.core.players['1'].hand = [];
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: '风暴突袭 II 奖励骰伤害可用气增伤',
            commands: [
                { type: 'PLAY_UPGRADE_CARD', playerId: '0', payload: { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { type: 'ROLL_DICE', playerId: '0', payload: {} },
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
                { type: 'ROLL_DICE', playerId: '1', payload: {} },
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} },
                { type: 'SKIP_BONUS_DICE_REROLL', playerId: '0', payload: {} },
                { type: 'USE_TOKEN', playerId: '0', payload: { tokenId: TOKEN_IDS.TAIJI, amount: 1 } },
            ],
        });

        expect(result.finalState.core.pendingDamage).toMatchObject({
            responseType: 'beforeDamageDealt',
            responderId: '0',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            sourceAbilityId: 'thunder-strike',
            originalDamage: 18,
            currentDamage: 19,
            damageScope: 'attack',
        });
        expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(0);
    });

    it('应该直接结算伤害（没有太极标记时）', () => {
        // 骰子序列：
        // - 进攻掷骰 5 次（前3个会被使用）→ [3,3,3,1,1] = 3 Palm + 2 其他
        // - 奖励骰 3 次 → [4,5,6]
        const queuedRandom = createQueuedRandom([3, 3, 3, 1, 1, 4, 5, 6]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createMonkState(playerIds, random);
                state.core.selectedCharacters['1'] = 'barbarian';
                state.core.players['1'] = initHeroState('1', 'barbarian', random);
                
                // 玩家0没有太极标记
                state.core.players['0'].tokens = {};
                state.core.players['1'].tokens = {};
                state.core.players['0'].hand = [];
                state.core.players['1'].hand = [];
                
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: '雷霆万钧技能（无太极标记）',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // main1 → offensiveRoll
                { type: 'ROLL_DICE', playerId: '0', payload: {} }, // 掷骰 → [3,3,3,1,1]
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
                { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'thunder-strike' } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, // offensiveRoll → defensiveRoll
                { type: 'ROLL_DICE', playerId: '1', payload: {} }, // 防御方掷骰
                { type: 'CONFIRM_ROLL', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} }, // 跳过防御技能
                { type: 'ADVANCE_PHASE', playerId: '1', payload: {} }, // defensiveRoll exit → 攻击结算 + displayOnly 结算暂停
                { type: 'SKIP_BONUS_DICE_REROLL', playerId: '0', payload: {} }, // 确认骰子结果 → 推进到 main2
            ],
        });

        // 验证命令执行成功
        expect(result.steps[0].success).toBe(true);

        // ADVANCE_PHASE 后 displayOnly settlement 被设置，SKIP_BONUS_DICE_REROLL 后被清除
        // 验证中间状态：ADVANCE_PHASE 步骤应产生 BONUS_DICE_REROLL_REQUESTED
        const advanceStep = result.steps.find(s => s.step === 9);
        expect(advanceStep?.events).toContain('BONUS_DICE_REROLL_REQUESTED');

        // 最终状态：settlement 已被 SKIP_BONUS_DICE_REROLL 清除
        expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();

        // 验证事件流中有 BONUS_DIE_ROLLED 事件
        const eventStream = result.finalState.sys.eventStream?.entries || [];
        const bonusDieEvents = eventStream.filter(e => e.event.type === 'BONUS_DIE_ROLLED');
        expect(bonusDieEvents).toHaveLength(3); // 应该有3个奖励骰投掷事件

        // 验证事件流中有 DAMAGE_DEALT 事件
        const damageEvents = eventStream.filter(e => e.event.type === 'DAMAGE_DEALT');
        expect(damageEvents.length).toBeGreaterThan(0); // 应该有伤害事件

        // 验证玩家1受到伤害
        const initialHp = 50;
        const currentHp = result.finalState.core.players['1'].resources?.hp ?? 0;
        expect(currentHp).toBeLessThan(initialHp); // HP 应该减少
    });
});
