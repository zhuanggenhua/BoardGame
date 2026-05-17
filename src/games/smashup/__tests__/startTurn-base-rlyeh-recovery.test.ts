/**
 * startTurn / base_rlyeh 响应恢复合同。
 *
 * 锁定 `P0 endTurn -> P1 startTurn -> base_rlyeh onTurnStart prompt` 这条真实系统链：
 * - 回合切换时应停在 `startTurn`
 * - `base_rlyeh` prompt 应可见且可响应
 * - 响应后流程应恢复到 `playCards`
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearRegistry } from '../domain/abilityRegistry';
import { SmashUpDomain } from '../domain';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type {
    CardInstance,
    MinionOnBase,
    PlayerState,
    SmashUpCommand,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { smashUpSystemsForTest } from '../game';
import {
    expectNoPrompt,
    getPromptSourceId,
    getSimpleChoicePrompt,
    respondToPrompt,
} from './helpers';

const PLAYER_IDS: PlayerId[] = ['0', '1'];

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function makeMinion(uid: string, controller: string, power: number, defId = 'alien_invader'): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(
    id: string,
    factions: [string, string] = [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
): PlayerState {
    const hand: CardInstance[] = [];
    const deck: CardInstance[] = [];
    for (let i = 0; i < 5; i += 1) {
        hand.push(makeCard(`${id}_h${i}`, 'alien_invader', 'minion', id));
    }
    for (let i = 0; i < 15; i += 1) {
        deck.push(makeCard(`${id}_d${i}`, 'alien_invader', 'minion', id));
    }
    return {
        id,
        vp: 0,
        hand,
        deck,
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions,
    };
}

function createRunner(setup: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        silent: true,
        setup,
    });
}

function expectSuccessfulResult<T extends { success: boolean; error?: string }>(
    result: T,
    message: string,
): asserts result is T & { success: true } {
    expect(result.success, result.error ? `${message}: ${result.error}` : message).toBe(true);
    if (!result.success) {
        throw new Error(result.error ? `${message}: ${result.error}` : message);
    }
}

function expectAllStepsSucceeded(result: { steps: Array<{ success: boolean; step: number; commandType: string; error?: string }> }) {
    for (const step of result.steps) {
        expect(step.success, `Step ${step.step} (${step.commandType}) 失败: ${step.error}`).toBe(true);
    }
}

describe('startTurn / base_rlyeh 响应恢复', () => {
    function createRlyehSetup() {
        return (ids: PlayerId[], _random: RandomFn): MatchState<SmashUpCore> => {
            const core: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]),
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [
                    {
                        defId: 'base_rlyeh',
                        minions: [makeMinion('rlyeh_m1', '1', 3)],
                        ongoingActions: [],
                    },
                    { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                    { defId: 'base_central_brain', minions: [], ongoingActions: [] },
                ],
                baseDeck: ['base_castle_blood'],
                turnNumber: 1,
                nextUid: 200,
            };

            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            sys.phase = 'playCards';

            return { core, sys };
        };
    }

    it('P0 结束回合后，P1 startTurn 的 base_rlyeh prompt 应可响应并恢复到 playCards', () => {
        const runner = createRunner(createRlyehSetup());

        const result1 = runner.run({
            name: 'startTurn base_rlyeh prompt recovery',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });
        expectAllStepsSucceeded(result1);

        const state1 = result1.finalState;
        expect(state1.sys.phase).toBe('startTurn');
        expect(state1.core.currentPlayerIndex).toBe(1);

        const rlyehPrompt = getSimpleChoicePrompt(state1, 'base_rlyeh');
        expect(rlyehPrompt.id).toBe('base_rlyeh_0');
        expect(getPromptSourceId(rlyehPrompt)).toBe('base_rlyeh');

        const result2 = respondToPrompt(state1, 'skip', '1');
        expectSuccessfulResult(result2, '响应拉莱耶 prompt 失败');

        const finalState = result2.finalState;
        expect(finalState.sys.phase).toBe('playCards');
        expect(finalState.core.currentPlayerIndex).toBe(1);
        expectNoPrompt(finalState);
    });
});
