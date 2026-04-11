/**
 * 战力为 0 但有随从或泰坦力量的玩家应参与计分
 *
 * 规则：只要玩家在基地上有至少 1 个随从，或者在该基地的总力量至少为 1，
 * 就有资格参与该基地计分。泰坦本身不算随从，但其力量指示物提供的力量依然计入资格判断。
 */

import { describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';

const PLAYER_IDS = ['0', '1', '2'] as const;
const systems = smashUpSystemsForTest;

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {
            '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['wizards', 'zombies'] as [string, string], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
            '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
            '2': { id: '2', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['robots', 'aliens'] as [string, string], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
        },
        turnOrder: ['0', '1', '2'],
        currentPlayerIndex: 0,
        bases: [
            { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
        ],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        turnDestroyedMinions: [],
        ...overrides,
    };
}

function runScoreTest(core: SmashUpCore) {
    const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: PLAYER_IDS,
        setup: () => ({ core, sys: { ...createInitialSystemState(PLAYER_IDS, systems), phase: 'playCards' } }),
    });

    return runner.run({
        name: 'zero-power-scoring',
        commands: [{ type: 'ADVANCE_PHASE', playerId: '0', payload: undefined }] as any[],
    });
}

describe('战力为0但有随从的玩家应该参与计分', () => {
    it('战力为 0 的玩家有随从，应该参与计分并获得对应名次的 VP', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits', // breakpoint=16, vpAwards=[4,3,2]
                minions: [
                    { uid: 'c1', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 7, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 12
                    { uid: 'c2', defId: 'pirate_buccaneer', controller: '1', owner: '1', basePower: 3, powerCounters: 0, powerModifier: -3, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 0
                    { uid: 'c3', defId: 'robot_microbot', controller: '2', owner: '2', basePower: 2, powerCounters: 2, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 4
                ],
                ongoingActions: [],
            }],
        });

        const result = runScoreTest(core);
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[0]?.events).toContain('su:base_scored');

        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].vp).toBe(4);
        expect(finalCore.players['2'].vp).toBe(3);
        expect(finalCore.players['1'].vp).toBe(2);
    });

    it('只有 ongoing 卡力量贡献（无随从）的玩家应该参与计分', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [
                    { uid: 'c1', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 11, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] }, // 16
                ],
                ongoingActions: [
                    { uid: 'c2', defId: 'vampire_summon_wolves', ownerId: '1', talentUsed: false, metadata: { powerCounters: 5 } },
                ],
            }],
        });

        const result = runScoreTest(core);
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[0]?.events).toContain('su:base_scored');

        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].vp).toBe(4);
        expect(finalCore.players['1'].vp).toBe(3);
    });

    it('无随从且无力量的玩家不应该参与计分', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [
                    { uid: 'c1', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 11, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            }],
        });

        const result = runScoreTest(core);
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[0]?.events).toContain('su:base_scored');

        const finalCore = result.finalState.core;
        expect(finalCore.players['0'].vp).toBe(4);
        expect(finalCore.players['1'].vp).toBe(0);
        expect(finalCore.players['2'].vp).toBe(0);
    });

    it('只有泰坦且总力量为 0 时不能拿分', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [
                    { uid: 'p0', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 11, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            }],
            titans: [{
                uid: 'titan-1',
                defId: 'ghosts_creampuff_man',
                faction: 'ghosts',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        });

        const result = runScoreTest(core);
        expect(result.steps[0]?.success).toBe(true);
        expect(result.finalState.core.players['1'].vp).toBe(0);
    });

    it('只有泰坦但总力量至少为 1 时可以拿分', () => {
        const core = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [
                    { uid: 'p0', defId: 'wizard_archmage', controller: '0', owner: '0', basePower: 5, powerCounters: 11, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                ],
                ongoingActions: [],
            }],
            titans: [{
                uid: 'titan-1',
                defId: 'ghosts_creampuff_man',
                faction: 'ghosts',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 2,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        });

        const result = runScoreTest(core);
        expect(result.steps[0]?.success).toBe(true);
        expect(result.finalState.core.players['1'].vp).toBe(3);
    });
});
