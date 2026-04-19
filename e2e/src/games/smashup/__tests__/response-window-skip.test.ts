/**
 * 响应窗口跳过与重入循环测试
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import type { MinionOnBase, SmashUpCore } from '../domain/types';
import { advanceSmashUpReactionSession, startSmashUpReactionSession } from '../domain/reactionSession';

interface ReactionSessionView {
    responseWindowType?: 'meFirst' | 'afterScoring';
    activePlayerId: string;
    currentPlayerId: string;
}

function getReactionSession(state: MatchState<SmashUpCore>) {
    return (state.sys as MatchState<SmashUpCore>['sys'] & {
        smashupReactionSession?: ReactionSessionView;
    }).smashupReactionSession;
}

function getCurrentChoice(state: MatchState<SmashUpCore>) {
    return asSimpleChoice(state.sys.interaction?.current);
}

function findOptionId(
    choice: NonNullable<ReturnType<typeof getCurrentChoice>>,
    predicate: (option: NonNullable<ReturnType<typeof getCurrentChoice>>['options'][number]) => boolean,
    message: string,
) {
    const option = choice.options.find(predicate);
    if (!option) {
        throw new Error(`${message}: ${JSON.stringify(choice.options.map(item => item.id))}`);
    }
    return option.id;
}

function expectMirroredIndex(state: MatchState<SmashUpCore>, index: number) {
    const mirroredWindow = state.sys.responseWindow?.current;
    if (mirroredWindow?.sourceId === 'smashup_reaction_choose') {
        expect(mirroredWindow.currentResponderIndex).toBe(index);
    }
}

function makeMinion(
    uid: string,
    defId: string,
    owner: PlayerId,
    controller: PlayerId,
    basePower: number,
    powerCounters = 0,
): MinionOnBase {
    return {
        uid,
        defId,
        owner,
        controller,
        basePower,
        powerModifier: 0,
        tempPowerModifier: 0,
        powerCounters,
        attachedActions: [],
        talentUsed: false,
    };
}

function createRunner(
    setup: (playerIds: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>,
) {
    return new GameTestRunner<SmashUpCore, any, any>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: ['0', '1'],
        setup,
    });
}

beforeAll(() => {
    initAllAbilities();
});

describe('响应窗口跳过逻辑', () => {
    it('同轮有人行动后，如果其他玩家没有内容，统一反应选择器会先回到仍可行动的本家', () => {
        const runner = createRunner((playerIds, random) => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases[0] = {
                defId: 'base_the_mothership',
                minions: Array.from({ length: 5 }, (_, index) =>
                    makeMinion(`fake-${index}`, 'test_minion', '0', '0', 5),
                ),
                ongoingActions: [],
            };
            core.players['0'].hand = [
                { uid: 'card-1', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                { uid: 'card-3', defId: 'pirate_full_sail', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'card-2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' },
            ];

            return { core, sys };
        });

        const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advanceResult.success).toBe(true);

        const firstChoice = getCurrentChoice(runner.getState());
        expect(firstChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(firstChoice?.playerId).toBe('0');
        expect(getReactionSession(runner.getState())?.responseWindowType).toBe('meFirst');
        expectMirroredIndex(runner.getState(), 0);

        const playOptionId = findOptionId(
            firstChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-1',
            '找不到全速航行选项',
        );
        const playResult = runner.resolveInteraction('0', { optionId: playOptionId });
        expect(playResult.success).toBe(true);

        const fullSailChoice = getCurrentChoice(runner.getState());
        expect(fullSailChoice?.sourceId).toBe('pirate_full_sail_choose_minion');

        const finishFullSail = runner.resolveInteraction('0', { optionId: 'done' });
        expect(finishFullSail.success).toBe(true);

        const stateAfterPlay = runner.getState();
        expect(getReactionSession(stateAfterPlay)?.activePlayerId).toBe('0');
        expect(getCurrentChoice(stateAfterPlay)?.sourceId).toBe('smashup_reaction_choose');
        expectMirroredIndex(stateAfterPlay, 0);

        const firstPass = runner.resolveInteraction('0', { optionId: 'pass' });
        expect(firstPass.success).toBe(true);

        const stateAfterFirstPass = runner.getState();
        expect(getReactionSession(stateAfterFirstPass)).toBeUndefined();
        expect(getCurrentChoice(stateAfterFirstPass)).toBeUndefined();
        expect(stateAfterFirstPass.sys.responseWindow?.current).toBeUndefined();
    });

    it('smashup_reaction_choose 被 SYS_INTERACTION_CANCEL 收口时，应按 pass 处理并正常关闭 session', () => {
        const runner = createRunner((playerIds, random) => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases[0] = {
                defId: 'base_the_mothership',
                minions: Array.from({ length: 5 }, (_, index) =>
                    makeMinion(`fake-${index}`, 'test_minion', '0', '0', 5),
                ),
                ongoingActions: [],
            };
            core.players['0'].hand = [
                { uid: 'card-1', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                { uid: 'card-3', defId: 'pirate_full_sail', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'card-2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' },
            ];

            return { core, sys };
        });

        const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advanceResult.success).toBe(true);

        const firstChoice = getCurrentChoice(runner.getState());
        expect(firstChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(firstChoice?.playerId).toBe('0');

        const playOptionId = findOptionId(
            firstChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-1',
            '找不到全速航行选项',
        );
        const playResult = runner.resolveInteraction('0', { optionId: playOptionId });
        expect(playResult.success).toBe(true);

        const fullSailChoice = getCurrentChoice(runner.getState());
        expect(fullSailChoice?.sourceId).toBe('pirate_full_sail_choose_minion');

        const finishFullSail = runner.resolveInteraction('0', { optionId: 'done' });
        expect(finishFullSail.success).toBe(true);

        const stateBeforeCancel = runner.getState();
        expect(getReactionSession(stateBeforeCancel)?.activePlayerId).toBe('0');
        expect(getCurrentChoice(stateBeforeCancel)?.sourceId).toBe('smashup_reaction_choose');

        const cancelResult = runner.dispatch('SYS_INTERACTION_CANCEL', {
            playerId: '0',
            reason: 'watchdog-force-pass',
        });
        expect(cancelResult.success).toBe(true);

        const finalState = runner.getState();
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(getCurrentChoice(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
    });

    it('所有玩家都没有可响应内容时，session 会直接关闭', () => {
        const runner = createRunner((playerIds, random) => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases[0] = {
                defId: 'base_the_mothership',
                minions: Array.from({ length: 5 }, (_, index) =>
                    makeMinion(`fake-${index}`, 'test_minion', '0', '0', 5),
                ),
                ongoingActions: [],
            };
            core.players['0'].hand = [
                { uid: 'card-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'card-2', defId: 'robot_microbot_alpha', type: 'minion', owner: '1' },
            ];

            return { core, sys };
        });

        const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advanceResult.success).toBe(true);

        const state = runner.getState();
        expect(getReactionSession(state)).toBeUndefined();
        expect(getCurrentChoice(state)).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
    });

    it('能力子交互失败后会回到统一反应选择器，且当前响应者不提前推进', () => {
        const runner = createRunner((playerIds, random) => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases.forEach(base => {
                base.minions = [];
            });
            core.bases[0] = {
                defId: 'base_the_mothership',
                minions: [
                    makeMinion('minion-1', 'giant_ant_soldier', '0', '0', 3, 2),
                    ...Array.from({ length: 5 }, (_, index) =>
                        makeMinion(`enemy-${index}`, 'test_minion', '1', '1', 5),
                    ),
                ],
                ongoingActions: [],
            };
            core.players['0'].hand = [
                { uid: 'card-1', defId: 'giant_ant_under_pressure', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'card-2', defId: 'pirate_full_sail', type: 'action', owner: '1' },
            ];

            return { core, sys };
        });

        const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advanceResult.success).toBe(true);

        const reactionChoice = getCurrentChoice(runner.getState());
        expect(reactionChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(reactionChoice?.playerId).toBe('0');
        expect(getReactionSession(runner.getState())?.activePlayerId).toBe('0');
        expectMirroredIndex(runner.getState(), 0);

        const playOptionId = findOptionId(
            reactionChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-1',
            '找不到承受压力选项',
        );
        const playResult = runner.resolveInteraction('0', { optionId: playOptionId });
        expect(playResult.success).toBe(true);

        const sourceChoice = getCurrentChoice(runner.getState());
        expect(sourceChoice?.sourceId).toBe('giant_ant_under_pressure_choose_source');

        const sourceOptionId = findOptionId(
            sourceChoice!,
            option => option.value?.minionUid === 'minion-1',
            '找不到承受压力的来源随从',
        );
        const resolveSourceResult = runner.resolveInteraction('0', { optionId: sourceOptionId });
        expect(resolveSourceResult.success).toBe(true);

        const stateAfterFailedChildInteraction = runner.getState();
        const resumedChoice = getCurrentChoice(stateAfterFailedChildInteraction);
        expect(resumedChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).toBe('1');
        expect(getReactionSession(stateAfterFailedChildInteraction)?.activePlayerId).toBe('1');
        const mirroredWindow = stateAfterFailedChildInteraction.sys.responseWindow?.current;
        if (mirroredWindow?.sourceId === 'smashup_reaction_choose') {
            expect(mirroredWindow.currentResponderIndex).toBe(1);
            expect(mirroredWindow.pendingInteractionId).toBeUndefined();
        }
    });
    it('tail responder interaction should not close response window early', () => {
        const runner = new GameTestRunner<SmashUpCore, any, any>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            random: {
                random: () => 0.5,
                d: (max) => Math.ceil(max / 2),
                range: (min, max) => Math.floor((min + max) / 2),
                shuffle: (arr) => [...arr],
            },
            setup: (playerIds: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
                const core = SmashUpDomain.setup(playerIds, random);
                const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

                core.factionSelection = undefined;
                sys.phase = 'scoreBases';

                core.bases[0] = {
                    defId: 'base_the_mothership',
                    minions: Array.from({ length: 5 }, (_, i) => ({
                        uid: `fake-${i}`,
                        defId: 'test_minion',
                        owner: '0' as const,
                        controller: '0' as const,
                        basePower: 5,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    })),
                    ongoingActions: [],
                };

                core.players['0'].hand = [
                    { uid: 'card-p0', defId: 'pirate_full_sail', type: 'action', owner: '0' },
                ];
                core.players['1'].hand = [
                    { uid: 'card-p1-special', defId: 'ninja_hidden_ninja', type: 'action', owner: '1' },
                    { uid: 'card-p1-minion', defId: 'ninja_shinobi', type: 'minion', owner: '1' },
                ];
                const baseState = { core, sys };
                const withSession = startSmashUpReactionSession(baseState, {
                    frameId: 'tail-responder-window',
                    frameKind: 'score-before',
                    phase: 'optional',
                    currentPlayerId: '0',
                    activePlayerId: '1',
                    consecutivePasses: 1,
                    sourceBaseIndex: 0,
                    responseWindowType: 'meFirst',
                });
                const advanced = advanceSmashUpReactionSession(withSession, random, 1);
                return advanced?.state ?? withSession;
            },
        });

        const reactionChoice = getCurrentChoice(runner.getState());
        expect(reactionChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(reactionChoice?.playerId).toBe('1');
        expect(getReactionSession(runner.getState())?.activePlayerId).toBe('1');
        expectMirroredIndex(runner.getState(), 1);

        const playOptionId = findOptionId(
            reactionChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-p1-special',
            '找不到隐身忍者选项',
        );
        const playResult = runner.resolveInteraction('1', { optionId: playOptionId });
        expect(playResult.success).toBe(true);

        const stateAfterPlay = runner.getState();
        expect(stateAfterPlay.sys.interaction?.current?.data?.sourceId).toBe('ninja_hidden_ninja');

        const playOption = stateAfterPlay.sys.interaction!.current!.data.options.find(
            (option: any) => option.value?.cardUid === 'card-p1-minion',
        );
        expect(playOption).toBeDefined();

        const resolveResult = runner.resolveInteraction('1', { optionId: playOption!.id });

        expect(resolveResult.success).toBe(true);
        const stateAfterResolve = runner.getState();
        const resumedChoice = getCurrentChoice(stateAfterResolve);
        expect(resumedChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).toBe('0');
        expect(getReactionSession(stateAfterResolve)?.activePlayerId).toBe('0');
        expectMirroredIndex(stateAfterResolve, 0);
    });

});
