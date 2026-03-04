/**
 * 便衣忍者交互 Bug 复现测试
 * 
 * Bug 描述：用户在 Me First! 窗口打出便衣忍者后，没有创建选择随从的交互
 * 
 * 状态快照显示：
 * - specialLimitUsed: {"ninja_hidden_ninja":[0]} - 能力被执行
 * - 手牌有 2 个随从：ninja_tiger_assassin 和 ninja_acolyte
 * - sys.interaction.current 为 undefined - 没有交互被创建
 */

import { describe, it, expect } from 'vitest';
import { SmashUpDomain } from '../domain';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../types';
import { smashUpSystemsForTest } from '../game';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { SU_COMMANDS } from '../domain/types';

const systems = smashUpSystemsForTest;

function makeTestCore(): MatchState<SmashUpCore> {
    const core: SmashUpCore = {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [
                    { uid: 'c38', defId: 'ninja_infiltrate', type: 'action', owner: '0' },
                    { uid: 'c36', defId: 'ninja_seeing_stars', type: 'action', owner: '0' },
                    { uid: 'c40', defId: 'ninja_poison', type: 'action', owner: '0' },
                    { uid: 'c15', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                    { uid: 'c23', defId: 'ninja_tiger_assassin', type: 'minion', owner: '0' },
                    { uid: 'c37', defId: 'ninja_disguise', type: 'action', owner: '0' },
                    { uid: 'c28', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
                    { uid: 'c35', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
                ],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['ninjas', 'pirates'],
                minionsPlayedPerBase: { '0': 1 },
                sameNameMinionDefId: null,
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 1,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['dinosaurs', 'aliens'],
                minionsPlayedPerBase: { '0': 1 },
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_mothership',
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
                    {
                        uid: 'c27',
                        defId: 'ninja_acolyte',
                        controller: '0',
                        owner: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        playedThisTurn: true,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_ninja_dojo',
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_temple_of_goju',
                minions: [],
                ongoingActions: [],
            },
        ],
        baseDeck: ['base_inventors_salon'],
        turnNumber: 4,
        nextUid: 100,
        turnDestroyedMinions: [],
        scoringEligibleBaseIndices: [0],
    };

    return {
        core,
        sys: {
            ...createInitialSystemState(systems, ['0', '1']),
            phase: 'scoreBases',
            responseWindow: {
                current: {
                    windowId: 'meFirst_scoreBases_1000',
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                    windowType: 'meFirst',
                    sourceId: 'scoreBases',
                },
            },
        },
    };
}

describe('便衣忍者交互 Bug 复现', () => {
    it('P0 在 Me First! 窗口打出便衣忍者应该创建选择随从的交互', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: ['0', '1'],
            setup: () => makeTestCore(),
        });

        const result = runner.run({
            name: '打出便衣忍者',
            commands: [
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: {
                        cardUid: 'c35',
                        targetBaseIndex: 0,
                    },
                } as any,
            ],
        });

        console.log('=== Final State ===');
        console.log('specialLimitUsed:', result.finalState.core.specialLimitUsed);
        console.log('interaction.current:', result.finalState.sys.interaction?.current);
        console.log('interaction.queue:', result.finalState.sys.interaction?.queue);
        console.log('hand:', result.finalState.core.players['0'].hand.map(c => ({ uid: c.uid, defId: c.defId, type: c.type })));

        // 验证：specialLimitUsed 应该被记录
        expect(result.finalState.core.specialLimitUsed).toEqual({ ninja_hidden_ninja: [0] });

        // 验证：应该创建了选择随从的交互
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        expect(result.finalState.sys.interaction?.current?.playerId).toBe('0');
        expect(result.finalState.sys.interaction?.current?.data?.sourceId).toBe('ninja_hidden_ninja');
    });
});
