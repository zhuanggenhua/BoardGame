/**
 * 便衣忍者无随从场景测试
 * 
 * 验证：当玩家手牌中有便衣忍者但没有随从时，打出便衣忍者后 Me First! 窗口应该正确处理
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../types';
import { smashUpSystemsForTest } from '../game';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

beforeAll(() => {
    // 系统已在 game.ts 中初始化
});

const systems = smashUpSystemsForTest;

function makeTestCore(): MatchState<SmashUpCore> {
    const core: SmashUpCore = {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [
                    // P0 只有便衣忍者，没有随从
                    {
                        uid: 'hidden_ninja',
                        defId: 'ninja_hidden_ninja',
                        type: 'action',
                        owner: '0',
                    },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['ninjas', 'pirates'],
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['dinosaurs', 'aliens'],
                minionsPlayedPerBase: {},
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_pirate_cove',
                minions: [
                    {
                        uid: 'm1',
                        defId: 'dino_war_raptor',
                        controller: '0',
                        owner: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'm2',
                        defId: 'dino_king_rex',
                        controller: '0',
                        owner: '0',
                        basePower: 7,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'm3',
                        defId: 'pirate_king',
                        controller: '1',
                        owner: '1',
                        basePower: 5,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'm4',
                        defId: 'pirate_first_mate',
                        controller: '1',
                        owner: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_tortuga',
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_the_jungle',
                minions: [],
                ongoingActions: [],
            },
        ],
        baseDeck: ['base_inventors_salon'],
        turnNumber: 1,
        nextUid: 100,
        turnDestroyedMinions: [],
    };

    return {
        core,
        sys: {
            ...createInitialSystemState(systems, ['0', '1']),
            phase: 'playCards',
        },
    };
}

describe('便衣忍者无随从场景', () => {
    it('P0 手牌中只有便衣忍者（无随从）时，Me First! 窗口应该自动关闭', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: ['0', '1'],
            setup: () => makeTestCore(),
        });

        const result = runner.run({
            name: '推进到 scoreBases',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 验证：Me First! 窗口应该自动关闭（因为便衣忍者没有随从可选，实际不可用）
        expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        
        // 验证：应该停在 scoreBases，海盗湾交互已创建
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        expect(result.finalState.sys.interaction?.current?.playerId).toBe('1');
        expect(result.finalState.sys.interaction?.current?.data?.sourceId).toBe('base_pirate_cove');
    });

    it('P0 手牌中有便衣忍者和随从时，Me First! 窗口应该保持打开', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: ['0', '1'],
            setup: () => {
                const state = makeTestCore();
                // 给 P0 添加一个随从
                state.core.players['0'].hand.push({
                    uid: 'minion1',
                    defId: 'pirate_first_mate',
                    type: 'minion',
                    owner: '0',
                });
                return state;
            },
        });

        const result = runner.run({
            name: '推进到 scoreBases',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 验证：Me First! 窗口应该保持打开（因为便衣忍者有随从可选）
        expect(result.finalState.sys.phase).toBe('scoreBases');
        expect(result.finalState.sys.responseWindow?.current).toBeDefined();
        expect(result.finalState.sys.responseWindow?.current?.windowType).toBe('meFirst');
        expect(result.finalState.sys.responseWindow?.current?.responderQueue).toContain('0');
    });
});
