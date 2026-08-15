/**
 * scoreBases / base_tortuga 响应恢复合同。
 *
 * 锁定 `scoreBases -> Me First! -> base_tortuga afterScoring prompt -> 规则收尾`：
 * - 计分阶段应暂停等待亚军响应
 * - 点选响应后应清掉当前 prompt，并继续完成清场/换基地
 * - 不应把 prompt 悬空带到后续阶段
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
import { SU_EVENTS } from '../domain/types';
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
    getPromptOption,
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

describe('scoreBases / base_tortuga 响应恢复', () => {
    function createTortugaScoringSetup() {
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
                        defId: 'base_tortuga',
                        minions: [
                            makeMinion('tort_m0', '0', 20),
                            makeMinion('tort_m1', '1', 10),
                        ],
                        ongoingActions: [],
                    },
                    { defId: 'base_tar_pits', minions: [makeMinion('reserve_p1', '1', 2)], ongoingActions: [] },
                    { defId: 'base_central_brain', minions: [], ongoingActions: [] },
                ],
                baseDeck: ['base_castle_blood', 'base_the_homeworld'],
                turnNumber: 1,
                nextUid: 200,
            };

            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            sys.phase = 'playCards';

            return { core, sys };
        };
    }

    it('托尔图加 afterScoring prompt 应暂停计分链，并在响应后完成后续收尾', () => {
        const runner = createRunner(createTortugaScoringSetup());

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expectSuccessfulResult(advance, '进入 scoreBases 失败');
        expect(runner.getState().sys.responseWindow?.current).toBeUndefined();

        const finalState = runner.getState();
        expect(finalState.sys.phase).toBe('scoreBases');
        expect(finalState.core.currentPlayerIndex).toBe(0);
        expect((finalState.sys as any).flowHalted).toBe(true);

        const prompt = getSimpleChoicePrompt(finalState, 'base_tortuga');
        expect(getPromptSourceId(prompt)).toBe('base_tortuga');
        expect(prompt.playerId).toBe('1');

        const allEvents = advance.events.map(event => event.type);
        expect(allEvents.includes(SU_EVENTS.BASE_SCORED)).toBe(true);

        const moveReserveMinion = getPromptOption(
            prompt,
            option => option.value?.minionUid === 'reserve_p1' && option.value?.fromBaseIndex === 1,
            '托尔图加应提供其他基地的亚军随从',
        );

        const resolvePrompt = respondToPrompt(finalState, moveReserveMinion.id, '1');
        expectSuccessfulResult(resolvePrompt, '响应托尔图加 prompt 失败');

        const resolvedState = resolvePrompt.finalState;
        expect(resolvedState.sys.phase).toBe('playCards');
        expect(resolvedState.core.currentPlayerIndex).toBe(1);
        expect((resolvedState.sys as any).flowHalted).not.toBe(true);
        expectNoPrompt(resolvedState);
        expect(resolvePrompt.events.map(event => event.type)).toContain('SYS_INTERACTION_RESOLVED');
        expect(resolvePrompt.events.map(event => event.type)).toContain(SU_EVENTS.BASE_CLEARED);
        expect(resolvePrompt.events.map(event => event.type)).toContain(SU_EVENTS.BASE_REPLACED);
        expect(resolvePrompt.events.map(event => event.type)).toContain(SU_EVENTS.MINION_MOVED);
        expect(resolvedState.core.bases[0].defId).toBe('base_castle_blood');
        expect(resolvedState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['reserve_p1']);
        expect(resolvedState.core.bases[1].minions.map(minion => minion.uid)).toEqual([]);
    });
});
