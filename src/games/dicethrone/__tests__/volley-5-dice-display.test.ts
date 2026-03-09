/**
 * Volley（万箭齐发）多骰展示回归测试
 *
 * 目标：
 * 1. 确认当前实现会发出 5 个独立 BONUS_DIE_ROLLED 事件 + 1 个汇总事件
 * 2. 确认会生成 displayOnly settlement，供 BonusDieOverlay 展示全部 5 颗骰子
 * 3. 确认 bonusDamage 与缠绕状态正确落地
 */

import { describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { diceThroneSystemsForTest } from '../game';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { STATUS_IDS } from '../domain/ids';
import { createQueuedRandom, cmd } from './test-utils';
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
    state.core.dice = [1, 2, 3, 4, 5] as typeof state.core.dice;
    state.core.pendingAttack = {
        attackerId: '0',
        defenderId: '1',
        isDefendable: true,
        damage: 5,
        bonusDamage: 0,
    };

    return state;
}

describe('Volley 5 Dice Display', () => {
    it('应发出 5 个独立奖励骰事件和 1 个汇总事件', () => {
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
            expect(event.payload.effectKey).toBe('bonusDie.effect.volley');
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

        expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(bowCount);

        const entangleEvent = eventStream.find(entry =>
            entry.event.type === 'STATUS_APPLIED'
            && (entry.event as any).payload.statusId === STATUS_IDS.ENTANGLE
            && (entry.event as any).payload.targetId === '1'
        );
        expect(entangleEvent).toBeDefined();

        const settlementEvent = eventStream.find(entry => entry.event.type === 'BONUS_DICE_REROLL_REQUESTED');
        expect(settlementEvent).toBeDefined();
        expect((settlementEvent!.event as any).payload.settlement.dice).toHaveLength(5);
        expect((settlementEvent!.event as any).payload.settlement.displayOnly).toBe(true);
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
});
