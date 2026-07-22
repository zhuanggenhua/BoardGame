/**
 * Volley（万箭齐发）多骰展示回归测试
 *
 * 目标：
 * 1. 确认当前实现会发出 5 个独立 BONUS_DIE_ROLLED 事件 + 1 个汇总事件
 * 2. 确认会创建可被改骰响应的奖励骰结算窗口
 * 3. 确认弹一手修改奖励骰后，bonusDamage 与缠绕状态按改后结果落地
 */

import { describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { diceThroneSystemsForTest } from '../game';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { STATUS_IDS } from '../domain/ids';
import { createQueuedRandom, cmd, getCardById } from './test-utils';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';

const setupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'moon_elf' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'barbarian' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createVolleyState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, diceThroneSystemsForTest, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: diceThroneSystemsForTest };

    for (const command of setupCommands) {
        const result = executePipeline(
            pipelineConfig,
            state,
            { ...command, timestamp: Date.now() } as DiceThroneCommand,
            random,
            playerIds,
        );
        if (result.success) {
            state = result.state as MatchState<DiceThroneCore>;
        }
    }

    const player = state.core.players['0'];
    const volleyCard = MOON_ELF_CARDS.find(card => card.id === 'volley');
    if (!volleyCard) {
        throw new Error('未找到 Volley 卡牌');
    }

    player.hand = [{ ...volleyCard }];
    player.deck = player.deck.filter(card => card.id !== 'volley');
    player.resources.CP = 3;

    state.core.phase = 'offensiveRoll';
    state.sys.phase = 'offensiveRoll';
    state.core.rollCount = 1;
    state.core.rollConfirmed = true;
    state.core.dice = state.core.dice.map((die, index) => ({
        ...die,
        value: [1, 2, 3, 4, 5][index] ?? die.value,
        isKept: false,
    }));
    state.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        sourceAbilityId: 'longbow',
        damage: 5,
        bonusDamage: 0,
    };

    return state;
}

function createVolleyCopyState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const state = createVolleyState(playerIds, random);
    state.core.players['0'].hand = [getCardById('volley'), getCardById('card-me-too')];
    state.core.players['0'].resources.CP = 5;
    state.core.dice = state.core.dice.map((die, index) => ({
        ...die,
        value: [2, 2, 2, 1, 5][index] ?? die.value,
        isKept: false,
    }));
    state.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        sourceAbilityId: 'longbow-4-2',
        damage: 6,
        bonusDamage: 0,
        attackModifierBonusDamage: 0,
    } as any;
    return state;
}

describe('Volley 5 Dice Display', () => {
    it('应发出 5 个独立奖励骰事件、1 个汇总事件，并创建可响应的 displayOnly settlement', () => {
        const queuedRandom = createQueuedRandom([1, 2, 3, 4, 5]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createVolleyState(playerIds, random);
                state.core.players['1'].hand = [getCardById('card-flick')];
                state.core.players['1'].resources.CP = 3;
                return state;
            },
            silent: true,
        });

        const result = runner.run({
            name: 'Volley 5 Dice Display',
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'volley' }),
            ],
        });

        const eventStream = result.finalState.sys.eventStream?.entries ?? [];
        const bonusDieEvents = eventStream.filter(entry => entry.event.type === 'BONUS_DIE_ROLLED');

        expect(bonusDieEvents).toHaveLength(6);

        for (let index = 0; index < 5; index += 1) {
            const event = bonusDieEvents[index].event as any;
            expect(event.payload.value).toBe(index + 1);
            expect(event.payload.effectKey).toBeUndefined();
            expect(event.payload.effectParams).toEqual({ value: index + 1, index });
        }

        const rolledFaces = bonusDieEvents.slice(0, 5).map(entry => (entry.event as any).payload.face);
        const bowCount = rolledFaces.filter(face => face === 'bow').length;

        const summaryEvent = bonusDieEvents[5].event as any;
        expect(summaryEvent.payload.effectKey).toBe('bonusDie.effect.volley.result');
        expect(summaryEvent.payload.effectParams).toEqual({
            bowCount,
            bonusDamage: bowCount,
        });

        const settlementEvent = eventStream.find(entry => entry.event.type === 'BONUS_DICE_REROLL_REQUESTED');
        expect(settlementEvent).toBeDefined();
        expect(result.finalState.core.pendingBonusDiceSettlement).toMatchObject({
            displayOnly: true,
            customResolutionId: 'moon-elf-volley',
            allowDiceModification: true,
            opensAfterRollConfirmedResponseWindow: bowCount > 0,
        });
        expect(result.finalState.sys.responseWindow?.current).toMatchObject({
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
        });
        expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(0);
        expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage ?? 0).toBe(0);
    });

    it('弹一手修改万箭齐发奖励骰后，应按改后的弓面数加伤并施加缠绕', () => {
        const queuedRandom = createQueuedRandom([1, 2, 3, 4, 5]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => {
                const state = createVolleyState(playerIds, random);
                state.core.players['1'].hand = [getCardById('card-flick')];
                state.core.players['1'].resources.CP = 3;
                return state;
            },
            silent: true,
        });

        const opened = runner.run({
            name: 'Volley bonus dice opens response',
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'volley' }),
            ],
        });

        expect(opened.assertionErrors).toEqual([]);
        expect(opened.finalState.core.pendingBonusDiceSettlement?.dice.map(die => die.value)).toEqual([1, 2, 3, 4, 5]);
        expect(opened.finalState.core.pendingBonusDiceSettlement?.dice.filter(die => die.face === 'bow')).toHaveLength(3);
        expect(opened.finalState.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');

        runner.setState(opened.finalState);
        const playedFlick = runner.dispatch('PLAY_CARD', { playerId: '1', cardId: 'card-flick' });
        expect(playedFlick.success).toBe(true);
        expect(playedFlick.finalState.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();

        const modified = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 2, newValue: 4 });
        expect(modified.success).toBe(true);
        expect(modified.finalState.core.pendingBonusDiceSettlement?.dice.find(die => die.index === 2)).toMatchObject({
            value: 4,
            face: 'foot',
        });

        const confirmedCard = runner.dispatch('SYS_INTERACTION_CONFIRM', { playerId: '1' });
        expect(confirmedCard.success).toBe(true);
        expect(confirmedCard.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(confirmedCard.finalState.core.players['1'].discard.some(card => card.id === 'card-flick')).toBe(true);

        const settled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
        expect(settled.success).toBe(true);
        expect(settled.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(settled.finalState.core.pendingAttack?.bonusDamage).toBe(2);
        expect(settled.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(2);
        expect(settled.finalState.core.players['1'].statusEffects[STATUS_IDS.ENTANGLE]).toBe(1);
    });

    it('奖励骰事件时间戳应严格递增，便于 UI 按顺序展示', () => {
        const queuedRandom = createQueuedRandom([1, 2, 3, 4, 5]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => createVolleyState(playerIds, random),
            silent: true,
        });

        const result = runner.run({
            name: 'Volley Timestamps',
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'volley' }),
            ],
        });

        const eventStream = result.finalState.sys.eventStream?.entries ?? [];
        const bonusDieEvents = eventStream.filter(entry => entry.event.type === 'BONUS_DIE_ROLLED');

        expect(bonusDieEvents).toHaveLength(6);

        for (let index = 1; index < bonusDieEvents.length; index += 1) {
            const prevTimestamp = bonusDieEvents[index - 1].event.timestamp;
            const currTimestamp = bonusDieEvents[index].event.timestamp;
            expect(currTimestamp).toBeGreaterThan(prevTimestamp);
        }
    });

    it('copy 模式首个同值源骰选择不应提前清空 Volley 加伤', () => {
        const queuedRandom = createQueuedRandom([1, 2, 3, 4, 5]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: diceThroneSystemsForTest,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, random) => createVolleyCopyState(playerIds, random),
            silent: true,
        });

        const result = runner.run({
            name: 'Volley copy source no-op should keep bonus',
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'volley' }),
                cmd('SKIP_BONUS_DICE_REROLL', '0'),
                cmd('PLAY_CARD', '0', { cardId: 'card-me-too' }),
                cmd('MODIFY_DIE', '0', { dieId: 4, newValue: 5 }),
            ],
        });

        expect(result.assertionErrors).toEqual([]);
        expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('longbow-4-2');
        expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(3);
        expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(3);
        expect(result.finalState.core.players['0'].pendingBonusDamage).toBeUndefined();
        expect((result.finalState.sys.interaction?.current?.data as any)?.completedDieIds).toEqual([4]);
    });
});
