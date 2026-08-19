/**
 * 响应窗口跳过与重入循环测试
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import { SU_COMMANDS, SU_EVENTS, type MinionOnBase, type SmashUpCore, type TriggerInstance } from '../domain/types';
import { makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';
import {
    cancelPrompt,
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getSimpleChoicePrompt,
} from './helpers';
import {
    advanceSmashUpReactionSession,
    buildReactionOptions,
    getSmashUpReactionSession,
    resolveSmashUpReactionChoice,
    startSmashUpReactionSession,
} from '../domain/reactionSession';
import { registerTriggerExecutor } from '../domain/triggerExecutors';
import { getSmashUpReactionWindowContext, getSmashUpReactionWindowPresentation } from '../domain/reactionWindowState';

function getReactionSession(state: MatchState<SmashUpCore>) {
    return getSmashUpReactionSession(state);
}

function getCurrentChoice(state: MatchState<SmashUpCore>) {
    return getOptionalSimpleChoicePrompt(state);
}

function findOptionId(
    choice: NonNullable<ReturnType<typeof getCurrentChoice>>,
    predicate: (option: any) => boolean,
    message: string,
) {
    return getPromptOption(choice, predicate, message).id;
}

function expectReactionPresentationIndex(state: MatchState<SmashUpCore>, index: number) {
    const presentation = getSmashUpReactionWindowPresentation(state);
    expect(presentation?.currentResponderIndex).toBe(index);
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
    it('暂停模式下 optional 全让过只发出 trigger 消费事件，不提前改写 core', () => {
        const random: RandomFn = {
            random: () => 0,
            d: () => 1,
            range: (min) => min,
            shuffle: (items) => [...items],
        };
        const trigger: TriggerInstance = {
            id: 'optional-trigger-1',
            timing: 'afterScoring',
            sourceDefId: 'test_optional_source',
            mandatory: false,
            resolutionClass: 'optional',
            frameId: 'score-after:test',
            ownerPlayerId: '0',
            witnessRequirement: 'none',
            witnessed: true,
        };
        const core = makeState({
            players: { '0': makePlayer('0') },
            turnOrder: ['0'],
            triggerQueue: [trigger],
        });
        const state = startSmashUpReactionSession(makeMatchState(core), {
            frameId: 'score-after:test',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            responseWindowType: 'afterScoring',
        });

        const resolved = resolveSmashUpReactionChoice(
            state,
            random,
            100,
            { kind: 'pass' },
        );

        expect(resolved.events.map(event => event.type)).toEqual([SU_EVENTS.TRIGGER_CONSUMED]);
        expect(resolved.state.core.triggerQueue?.map(item => item.id)).toEqual(['optional-trigger-1']);
    });

    it('暂停模式下选择 queued trigger 只发出消费事件，不提前从 core 移除 trigger', () => {
        registerTriggerExecutor('test_projection_trigger', 'afterScoring', () => []);
        const random: RandomFn = {
            random: () => 0,
            d: () => 1,
            range: (min) => min,
            shuffle: (items) => [...items],
        };
        const trigger: TriggerInstance = {
            id: 'chosen-trigger-1',
            timing: 'afterScoring',
            sourceDefId: 'test_projection_trigger',
            mandatory: true,
            resolutionClass: 'mandatory',
            frameId: 'score-after:chosen',
            ownerPlayerId: '0',
            witnessRequirement: 'none',
            witnessed: true,
        };
        const core = makeState({
            players: { '0': makePlayer('0') },
            turnOrder: ['0'],
            triggerQueue: [trigger],
        });
        const state = startSmashUpReactionSession(makeMatchState(core), {
            frameId: 'score-after:chosen',
            frameKind: 'score-after',
            phase: 'mandatory',
            activePlayerId: '0',
            currentPlayerId: '0',
            responseWindowType: 'afterScoring',
        });

        const resolved = resolveSmashUpReactionChoice(
            state,
            random,
            101,
            { kind: 'trigger', triggerId: 'chosen-trigger-1' },
        );

        expect(resolved.events.map(event => event.type)).toEqual([SU_EVENTS.TRIGGER_CONSUMED]);
        expect(resolved.state.core.triggerQueue?.map(item => item.id)).toEqual(['chosen-trigger-1']);
    });

    it('su:reaction_pass 请求事件经过领域后处理时不应提前推进 live ReactionSession', () => {
        const random: RandomFn = {
            random: () => 0,
            d: () => 1,
            range: (min) => min,
            shuffle: (items) => [...items],
        };
        const state = startSmashUpReactionSession(
            makeMatchState(makeState({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
            })),
            {
                frameId: 'score-after:post-process-control-request',
                frameKind: 'score-after',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                responseWindowType: 'afterScoring',
            },
        );
        const requestEvent = {
            id: 'reaction-pass-request:event',
            type: SU_EVENTS.REACTION_PASS_REQUESTED,
            timestamp: 102,
            payload: { playerId: '0', reason: 'player_pass' },
        } as any;

        const rawProcessed = SmashUpDomain.postProcessSystemEvents!(
            state.core,
            [requestEvent],
            random,
            state,
            { inputEventsAlreadyReduced: true },
        );
        const processed = Array.isArray(rawProcessed)
            ? { events: rawProcessed, matchState: undefined }
            : rawProcessed;

        expect(processed.events).toEqual([requestEvent]);
        expect(getReactionSession(processed.matchState ?? state)?.activePlayerId).toBe('0');
        expect(getReactionSession(processed.matchState ?? state)?.passedPlayerIds).toEqual([]);
    });

    it('su:reaction_pass 应直接推进 live ReactionSession，不依赖通用 RESPONSE_PASS 镜像', () => {
        const runner = createRunner(() => startSmashUpReactionSession(
            makeMatchState(makeState({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
            })),
            {
                frameId: 'score-after:direct-reaction-pass',
                frameKind: 'score-after',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                responseWindowType: 'afterScoring',
            },
        ));

        expect(getReactionSession(runner.getState())?.activePlayerId).toBe('0');

        const passResult = runner.dispatch(SU_COMMANDS.REACTION_PASS, {
            playerId: '0',
            reason: 'player_pass',
        });

        expect(passResult.success).toBe(true);
        expect(passResult.events.map(event => event.type)).toContain(SU_EVENTS.REACTION_PASS_REQUESTED);
        expect(getReactionSession(passResult.finalState)?.activePlayerId).toBe('1');
        expect(getReactionSession(passResult.finalState)?.passedPlayerIds).toEqual(['0']);
        expect(passResult.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(getSmashUpReactionWindowPresentation(passResult.finalState)?.activePlayerId).toBe('1');
    });

    it('su:reaction_pass 只能由 live ReactionSession 当前响应者发出', () => {
        const runner = createRunner(() => startSmashUpReactionSession(
            makeMatchState(makeState({
                players: { '0': makePlayer('0'), '1': makePlayer('1') },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
            })),
            {
                frameId: 'score-after:reject-non-active-pass',
                frameKind: 'score-after',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                responseWindowType: 'afterScoring',
            },
        ));

        const passResult = runner.dispatch(SU_COMMANDS.REACTION_PASS, {
            playerId: '1',
            reason: 'player_pass',
        });

        expect(passResult.success).toBe(false);
        expect(passResult.error).toBe('等待当前响应者让过');
        expect(getReactionSession(passResult.finalState)?.activePlayerId).toBe('0');
    });

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
        expectReactionPresentationIndex(runner.getState(), 0);

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
        expectReactionPresentationIndex(stateAfterPlay, 0);

        const firstPass = runner.resolveInteraction('0', { optionId: 'pass' });
        expect(firstPass.success).toBe(true);

        const stateAfterFirstPass = runner.getState();
        expect(getReactionSession(stateAfterFirstPass)).toBeUndefined();
        expect(getCurrentChoice(stateAfterFirstPass)).toBeUndefined();
        expect(stateAfterFirstPass.sys.responseWindow?.current).toBeUndefined();
    });

    it('全速航行在 Me First 计分响应窗口中选随从和目标基地后应真实移动随从', () => {
        const runner = createRunner((playerIds, random) => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases[0] = {
                defId: 'base_the_mothership',
                minions: [
                    makeMinion('friendly-first-mate', 'pirate_first_mate', '0', '0', 3),
                    ...Array.from({ length: 4 }, (_, index) =>
                        makeMinion(`scoring-anchor-${index}`, 'test_minion', '0', '0', 5),
                    ),
                ],
                ongoingActions: [],
            };
            core.bases[1] = {
                defId: 'base_the_factory',
                minions: [],
                ongoingActions: [],
            };
            core.players['0'].hand = [
                { uid: 'card-1', defId: 'pirate_full_sail', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];

            return { core, sys };
        });

        const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advanceResult.success).toBe(true);

        const reactionChoice = getCurrentChoice(runner.getState());
        expect(reactionChoice?.sourceId).toBe('smashup_reaction_choose');
        const playOptionId = findOptionId(
            reactionChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-1',
            '找不到全速航行选项',
        );
        const playResult = runner.resolveInteraction('0', { optionId: playOptionId });
        expect(playResult.success).toBe(true);

        const minionChoice = getSimpleChoicePrompt(runner.getState(), 'pirate_full_sail_choose_minion');
        const minionOption = getPromptOption(
            minionChoice,
            (option: any) => option.value?.minionUid === 'friendly-first-mate',
            '找不到全速航行要移动的随从',
        );
        const chooseMinionResult = runner.resolveInteraction('0', { optionId: minionOption.id });
        expect(chooseMinionResult.success).toBe(true);

        const baseChoice = getSimpleChoicePrompt(runner.getState(), 'pirate_full_sail_choose_base');
        const baseOption = getPromptOption(
            baseChoice,
            (option: any) => option.value?.baseIndex === 1,
            '找不到全速航行目标基地',
        );
        const moveResult = runner.resolveInteraction('0', { optionId: baseOption.id });
        expect(moveResult.success).toBe(true);
        expect(moveResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'friendly-first-mate',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                sourceDefId: 'pirate_full_sail',
                reason: 'pirate_full_sail',
            }),
        }));

        const finalState = runner.getState();
        expect(finalState.core.bases[0].minions.some(minion => minion.uid === 'friendly-first-mate')).toBe(false);
        expect(finalState.core.bases[1].minions.some(minion => minion.uid === 'friendly-first-mate')).toBe(true);
        expect(getCurrentChoice(finalState)?.sourceId).toBe('pirate_full_sail_choose_minion');
    });

    it('smashup_reaction_choose 被 cancelPrompt 收口时，应按 pass 处理并正常关闭 session', () => {
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

        const cancelResult = cancelPrompt(stateBeforeCancel, '0', 'watchdog-force-pass');
        expect(cancelResult.success).toBe(true);

        const finalState = cancelResult.finalState;
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(getCurrentChoice(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
    });

    it('smashup_reaction_choose 的旧 play_action option 若已从 live hand 消失，应按 stale pass 收口而不是误打出旧牌', () => {
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

        const staleOptionId = findOptionId(
            firstChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-1',
            '找不到将要失效的全速航行选项',
        );
        const staleOption = firstChoice!.options.find(option => option.id === staleOptionId);
        expect(staleOption).toBeDefined();

        const staleState = runner.getState();
        runner.setState({
            ...staleState,
            core: {
                ...staleState.core,
                players: {
                    ...staleState.core.players,
                    '0': {
                        ...staleState.core.players['0'],
                        hand: staleState.core.players['0'].hand.filter(card => card.uid !== 'card-1'),
                    },
                },
            },
            sys: {
                ...staleState.sys,
                interaction: {
                    ...staleState.sys.interaction,
                    current: undefined,
                },
            },
        });

        const resolved = resolveSmashUpReactionChoice(
            runner.getState(),
            { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
            2,
            staleOption!.value as any,
        );

        const finalState = resolved.state;
        expect(getReactionSession(finalState)?.activePlayerId).toBe('0');
        expect(getCurrentChoice(finalState)?.sourceId).toBe('smashup_reaction_choose');
        expect(getCurrentChoice(finalState)?.playerId).toBe('0');
        expect(getCurrentChoice(finalState)?.options.some(option =>
            option.value?.kind === 'play_action' && option.value?.cardUid === 'card-3',
        )).toBe(true);
        expect(finalState.core.players['0'].hand.some(card => card.uid === 'card-1')).toBe(false);
        expect(finalState.core.players['0'].discard.some(card => card.uid === 'card-1')).toBe(false);
        expect(finalState.core.bases[0].ongoingActions.some(card => card.uid === 'card-1')).toBe(false);
    });

    it('smashup_reaction_choose 的旧 play_minion option 若已从 live hand 消失，应按 stale pass 收口而不是误打出旧随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-m1', 'ninja_shinobi', '0'),
                        makeCard('card-a1', 'pirate_full_sail', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        const withSession = startSmashUpReactionSession(ms, {
            frameId: 'score-before:0:stale-minion',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });
        const prompted = advanceSmashUpReactionSession(
            withSession,
            { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
            1,
        );
        expect(prompted).toBeDefined();

        const firstChoice = getCurrentChoice(prompted!.state);
        expect(firstChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(firstChoice?.playerId).toBe('0');

        const staleMinionOptionId = findOptionId(
            firstChoice!,
            option => option.value?.kind === 'play_minion' && option.value?.cardUid === 'card-m1',
            '找不到将要失效的随从出牌选项',
        );
        const staleMinionOption = firstChoice!.options.find(option => option.id === staleMinionOptionId);
        expect(staleMinionOption).toBeDefined();

        const staleState = {
            ...prompted!.state,
            core: {
                ...prompted!.state.core,
                players: {
                    ...prompted!.state.core.players,
                    '0': {
                        ...prompted!.state.core.players['0'],
                        hand: prompted!.state.core.players['0'].hand.filter(card => card.uid !== 'card-m1'),
                    },
                },
            },
            sys: {
                ...prompted!.state.sys,
                interaction: {
                    ...prompted!.state.sys.interaction,
                    current: undefined,
                },
            },
        };

        const resolved = resolveSmashUpReactionChoice(
            staleState,
            { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
            2,
            staleMinionOption!.value as any,
        );

        const finalState = resolved.state;
        expect(getReactionSession(finalState)?.activePlayerId).toBe('0');
        expect(getCurrentChoice(finalState)?.sourceId).toBe('smashup_reaction_choose');
        expect(getCurrentChoice(finalState)?.playerId).toBe('0');
        expect(getCurrentChoice(finalState)?.options.some(option =>
            option.value?.kind === 'play_action' && option.value?.cardUid === 'card-a1',
        )).toBe(true);
        expect(finalState.core.players['0'].hand.some(card => card.uid === 'card-m1')).toBe(false);
        expect(finalState.core.players['0'].discard.some(card => card.uid === 'card-m1')).toBe(false);
        expect(finalState.core.bases[0].minions.some(minion => minion.uid === 'card-m1')).toBe(false);
    });

    it('smashup_reaction_choose 的打出到基地选项应显示真实基地名而不是基地编号', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-m1', 'ninja_shinobi', '0'),
                        makeCard('card-a1', 'ninja_hidden_ninja', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_mothership'),
                makeBase('base_the_factory', [
                    makeMinion('anchor-1', 'test_minion', '0', '0', 25),
                ]),
            ],
            scoringEligibleBaseIndices: [1],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        const withSession = startSmashUpReactionSession(ms, {
            frameId: 'score-before:base-label',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 1,
            responseWindowType: 'meFirst',
        });
        const session = getReactionSession(withSession)!;

        const options = buildReactionOptions(withSession, session, 1);
        const playMinionOption = options.find(option =>
            option.value.kind === 'play_minion' && option.value.cardUid === 'card-m1' && option.value.baseIndex === 1,
        );
        const playActionOption = options.find(option =>
            option.value.kind === 'play_action' && option.value.cardUid === 'card-a1' && option.value.targetBaseIndex === 1,
        );

        expect(playMinionOption).toBeDefined();
        expect(playMinionOption?.displayMode).toBe('card');
        expect(playMinionOption?.label).toContain('436-1337工厂');
        expect(playMinionOption?.label).not.toContain('基地 2');
        expect(playMinionOption?.labelParams).toEqual({
            name: 'cards.ninja_shinobi.name',
            baseName: 'cards.base_the_factory.name',
        });

        expect(playActionOption).toBeDefined();
        expect(playActionOption?.displayMode).toBe('card');
        expect(playActionOption?.label).toContain('436-1337工厂');
        expect(playActionOption?.label).not.toContain('基地 2');
        expect(playActionOption?.labelParams).toEqual({
            name: 'cards.ninja_hidden_ninja.name',
            baseName: 'cards.base_the_factory.name',
        });

        const passOption = options.find(option => option.value.kind === 'pass');
        expect(passOption?.displayMode).toBe('button');
    });

    it('invalid activePlayerId 不在 turnOrder 时，应回退到合法当前玩家而不是跳过首个响应者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-a1', 'pirate_full_sail', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        const withSession = startSmashUpReactionSession(ms, {
            frameId: 'score-before:0:invalid-active-player',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: 'ghost' as PlayerId,
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

        const prompted = advanceSmashUpReactionSession(
            withSession,
            { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
            1,
        );

        expect(prompted).toBeDefined();
        expect(getReactionSession(prompted!.state)?.activePlayerId).toBe('0');
        expect(getCurrentChoice(prompted!.state)?.sourceId).toBe('smashup_reaction_choose');
        expect(getCurrentChoice(prompted!.state)?.playerId).toBe('0');
        expect(getCurrentChoice(prompted!.state)?.options.some(option =>
            option.value?.kind === 'play_action' && option.value?.cardUid === 'card-a1',
        )).toBe(true);
        expectReactionPresentationIndex(prompted!.state, 0);
    });

    it('reactionWindowState 读取到 ghost session 时，也应回退到合法当前玩家而不是暴露非法 responder', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-a1', 'pirate_full_sail', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        ms.sys.resolution = {
            activeFrameId: 'ghost-frame',
            frames: [{
                id: 'ghost-frame',
                kind: 'smashup:reaction:score-before',
                ownerGame: 'smashup',
                ownerSystem: 'smashup-reaction',
                ownerToken: 'smashup:reaction:ghost-frame',
                ordering: 'responder-round',
                status: 'running',
                step: 'optional',
                phase: 'scoreBases',
                phaseGate: 'block-advance-when-blocked',
                metadata: {
                    smashupReactionSession: {
                        frameId: 'ghost-frame',
                        frameKind: 'score-before',
                        phase: 'optional',
                        activePlayerId: 'ghost' as PlayerId,
                        currentPlayerId: 'ghost' as PlayerId,
                        consecutivePasses: 0,
                        responseWindowType: 'meFirst',
                        sourceBaseIndex: 0,
                    },
                },
            }],
        } as any;

        const context = getSmashUpReactionWindowContext(ms);
        expect(context?.activePlayerId).toBe('0');
        expect(context?.currentPlayerId).toBe('0');

        ms.sys.responseWindow = {
            current: {
                id: 'mirrored-window',
                windowType: 'meFirst',
                sourceId: 'smashup_reaction_choose',
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
                resolutionFrameId: 'ghost-frame',
            },
        } as any;

        const presentation = getSmashUpReactionWindowPresentation(ms);
        expect(presentation?.activePlayerId).toBe('0');
        expect(presentation?.currentPlayerId).toBe('0');
        expect(presentation?.responderQueue).toEqual(['0', '1']);
        expect(presentation?.currentResponderIndex).toBe(0);
    });

    it('reactionWindowPresentation 的 passedPlayers 应来自 live session，而不是镜像 responseWindow', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-a1', 'pirate_full_sail', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        ms.sys.resolution = {
            activeFrameId: 'passed-authority-frame',
            frames: [{
                id: 'passed-authority-frame',
                kind: 'smashup:reaction:score-before',
                ownerGame: 'smashup',
                ownerSystem: 'smashup-reaction',
                ownerToken: 'smashup:reaction:passed-authority-frame',
                ordering: 'responder-round',
                status: 'running',
                step: 'optional',
                phase: 'scoreBases',
                phaseGate: 'block-advance-when-blocked',
                metadata: {
                    smashupReactionSession: {
                        frameId: 'passed-authority-frame',
                        frameKind: 'score-before',
                        phase: 'optional',
                        activePlayerId: '1',
                        currentPlayerId: '0',
                        consecutivePasses: 1,
                        passedPlayerIds: ['0'],
                        responseWindowType: 'meFirst',
                        sourceBaseIndex: 0,
                    },
                },
            }],
        } as any;
        ms.sys.responseWindow = {
            current: {
                id: 'stale-mirror-window',
                windowType: 'meFirst',
                sourceId: 'smashup_reaction_choose',
                responderQueue: ['0', '1'],
                currentResponderIndex: 1,
                passedPlayers: ['1', 'ghost'],
                resolutionFrameId: 'passed-authority-frame',
            },
        } as any;

        const presentation = getSmashUpReactionWindowPresentation(ms);
        expect(presentation?.activePlayerId).toBe('1');
        expect(presentation?.passedPlayers).toEqual(['0']);
    });

    it('reactionWindowPresentation 应直接来自 live session，不能依赖可见 responseWindow 镜像', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-a1', 'pirate_full_sail', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        ms.sys.resolution = {
            activeFrameId: 'latent-frame',
            frames: [{
                id: 'latent-frame',
                kind: 'smashup:reaction:score-before',
                ownerGame: 'smashup',
                ownerSystem: 'smashup-reaction',
                ownerToken: 'smashup:reaction:latent-frame',
                ordering: 'responder-round',
                status: 'running',
                step: 'optional',
                phase: 'scoreBases',
                phaseGate: 'block-advance-when-blocked',
                metadata: {
                    smashupReactionSession: {
                        frameId: 'latent-frame',
                        frameKind: 'score-before',
                        phase: 'optional',
                        activePlayerId: '0',
                        currentPlayerId: '0',
                        consecutivePasses: 0,
                        responseWindowType: 'meFirst',
                        sourceBaseIndex: 0,
                    },
                },
            }],
        } as any;
        ms.sys.responseWindow = { current: undefined } as any;
        ms.sys.interaction = { current: undefined, queue: [] } as any;

        expect(getSmashUpReactionWindowContext(ms)?.activePlayerId).toBe('0');
        const presentation = getSmashUpReactionWindowPresentation(ms);
        expect(presentation?.activePlayerId).toBe('0');
        expect(presentation?.currentPlayerId).toBe('0');
        expect(presentation?.responderQueue).toEqual(['0', '1']);
        expect(presentation?.currentResponderIndex).toBe(0);
        expect(presentation?.passedPlayers).toEqual([]);
    });

    it('reactionWindowState 不再从 legacy responderQueue 生成 Smash Up 响应上下文', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('card-a1', 'pirate_full_sail', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        ms.sys.responseWindow = {
            current: {
                id: 'legacy-window',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: ['ghost', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
                sourceBaseIndex: 0,
            },
        } as any;

        const context = getSmashUpReactionWindowContext(ms);
        expect(context).toBeUndefined();

        const presentation = getSmashUpReactionWindowPresentation(ms);
        expect(presentation).toBeUndefined();
    });

    it('smashup_reaction_choose 的旧 activate_special option 若已从 live base 消失，应刷新并保留当前响应者的剩余 live 选项', () => {
        const runner = createRunner((playerIds, random) => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.players['0'].hand = [
                { uid: 'card-a1', defId: 'pirate_full_sail', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];
            core.bases[0] = {
                defId: 'base_primate_park',
                breakpoint: 20,
                minions: [
                    makeMinion('anchor-a', 'time_travelers_jumper', '0', '0', 10),
                    makeMinion('mole-a', 'super_spies_mole', '0', '0', 2),
                    makeMinion('enemy-a', 'sharks_hammerhead', '1', '1', 10),
                ],
                ongoingActions: [],
            };

            return { core, sys };
        });

        const advanceResult = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advanceResult.success).toBe(true);

        const firstChoice = getCurrentChoice(runner.getState());
        expect(firstChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(firstChoice?.playerId).toBe('0');

        const staleSpecialOptionId = findOptionId(
            firstChoice!,
            option => option.value?.kind === 'activate_special' && option.value?.minionUid === 'mole-a',
            '找不到将要失效的 Mole special 选项',
        );
        const staleSpecialOption = firstChoice!.options.find(option => option.id === staleSpecialOptionId);
        expect(staleSpecialOption).toBeDefined();
        expect(firstChoice?.options.some(option =>
            option.value?.kind === 'play_action' && option.value?.cardUid === 'card-a1',
        )).toBe(true);

        const staleState = {
            ...runner.getState(),
            core: {
                ...runner.getState().core,
                bases: runner.getState().core.bases.map((base, baseIndex) => (
                    baseIndex !== 0
                        ? base
                        : {
                            ...base,
                            minions: base.minions.filter(minion => minion.uid !== 'mole-a'),
                        }
                )),
            },
            sys: {
                ...runner.getState().sys,
                interaction: {
                    ...runner.getState().sys.interaction,
                    current: undefined,
                },
            },
        };

        const resolved = resolveSmashUpReactionChoice(
            staleState,
            { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
            2,
            staleSpecialOption!.value as any,
        );

        const finalState = resolved.state;
        expect(getReactionSession(finalState)?.activePlayerId).toBe('0');
        expect(getCurrentChoice(finalState)?.sourceId).toBe('smashup_reaction_choose');
        expect(getCurrentChoice(finalState)?.playerId).toBe('0');
        expect(getCurrentChoice(finalState)?.options.some(option =>
            option.value?.kind === 'play_action' && option.value?.cardUid === 'card-a1',
        )).toBe(true);
        expect(getCurrentChoice(finalState)?.options.some(option =>
            option.value?.kind === 'activate_special' && option.value?.minionUid === 'mole-a',
        )).toBe(false);
        expect(finalState.core.bases[0].minions.some(minion => minion.uid === 'mole-a')).toBe(false);
        expect(resolved.events).toEqual([]);
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
            core.bases[1] = {
                defId: 'base_the_hive',
                minions: [
                    makeMinion('friendly-target', 'test_minion', '0', '0', 2),
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
        expectReactionPresentationIndex(runner.getState(), 0);

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

        const staleState = runner.getState();
        runner.setState({
            ...staleState,
            core: {
                ...staleState.core,
                bases: staleState.core.bases.map((base, baseIndex) => (
                    baseIndex !== 0
                        ? base
                        : {
                            ...base,
                            minions: base.minions.map((minion) => (
                                minion.uid !== 'minion-1'
                                    ? minion
                                    : {
                                        ...minion,
                                        powerCounters: 0,
                                    }
                            )),
                        }
                )),
            },
        });

        const resolveSourceResult = runner.resolveInteraction('0', { optionId: sourceOptionId });
        expect(resolveSourceResult.success).toBe(true);

        const stateAfterFailedChildInteraction = runner.getState();
        const resumedChoice = getCurrentChoice(stateAfterFailedChildInteraction);
        expect(resumedChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).toBe('1');
        expect(getReactionSession(stateAfterFailedChildInteraction)?.activePlayerId).toBe('1');
        expectReactionPresentationIndex(stateAfterFailedChildInteraction, 1);
        expect(stateAfterFailedChildInteraction.sys.responseWindow?.current).toBeUndefined();
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
        expectReactionPresentationIndex(runner.getState(), 1);

        const playOptionId = findOptionId(
            reactionChoice!,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'card-p1-special',
            '找不到隐身忍者选项',
        );
        const playResult = runner.resolveInteraction('1', { optionId: playOptionId });
        expect(playResult.success).toBe(true);

        const stateAfterPlay = runner.getState();
        const hiddenNinjaChoice = getSimpleChoicePrompt(stateAfterPlay, 'ninja_hidden_ninja');
        const playOption = getPromptOption(
            hiddenNinjaChoice,
            (option: any) => option.value?.cardUid === 'card-p1-minion',
            '找不到隐身忍者打出随从选项',
        );

        const resolveResult = runner.resolveInteraction('1', { optionId: playOption.id });

        expect(resolveResult.success).toBe(true);
        const stateAfterResolve = runner.getState();
        const resumedChoice = getCurrentChoice(stateAfterResolve);
        expect(resumedChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).toBe('0');
        expect(getReactionSession(stateAfterResolve)?.activePlayerId).toBe('0');
        expectReactionPresentationIndex(stateAfterResolve, 0);
    });

});
