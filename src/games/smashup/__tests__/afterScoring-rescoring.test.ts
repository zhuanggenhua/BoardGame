/**
 * afterScoring 真实链路与统一反应入口测试
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
import { SmashUpDomain } from '../domain';
import { getSmashUpReactionSession, startSmashUpReactionSession } from '../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import { smashUpSystemsForTest } from '../game';
import type { MinionOnBase, SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { getOptionalSimpleChoicePrompt, getPromptOptions, withCurrentPrompt } from './helpers';

const PLAYER_IDS: PlayerId[] = ['0', '1'];

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
    setup: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>,
): GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent> {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        setup,
    });
}

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
    const options = getPromptOptions(choice);
    const option = options.find(predicate);
    if (!option) {
        throw new Error(`${message}: ${JSON.stringify(options.map(item => item.id))}`);
    }
    return option.id;
}

function findQueuedTriggerOptionId(
    state: MatchState<SmashUpCore>,
    choice: NonNullable<ReturnType<typeof getCurrentChoice>>,
    sourceDefId: string,
    message: string,
) {
    const triggersById = new Map(
        (state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
    );
    const options = getPromptOptions(choice);
    const option = options.find((candidate: any) => {
        const triggerId = candidate?.value?.triggerId;
        return triggerId && triggersById.get(triggerId)?.sourceDefId === sourceDefId;
    });
    if (!option) {
        throw new Error(`${message}: ${JSON.stringify(options.map(item => item.id))}`);
    }
    return option.id;
}

function collectBaseEventCount(events: SmashUpEvent[], type: typeof SU_EVENTS.BASE_SCORED | typeof SU_EVENTS.BASE_CLEARED | typeof SU_EVENTS.BASE_REPLACED) {
    return events.filter(event => event.type === type).length;
}

function advancePostScoringDelay(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    eventLog: SmashUpEvent[],
) {
    const state = runner.getState();
    if (state.sys.phase !== 'scoreBases') {
        return { success: true, events: [] as SmashUpEvent[], finalState: state };
    }
    const playerId = state.core.turnOrder[state.core.currentPlayerIndex]!;
    const advance = runner.dispatch('ADVANCE_PHASE', { playerId });
    expect(advance.success).toBe(true);
    eventLog.push(...advance.events);
    return advance;
}

function drainScoreBasesDelayUntilPromptOrIdle(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    eventLog: SmashUpEvent[],
) {
    for (let guard = 0; guard < 8; guard += 1) {
        const state = runner.getState();
        if (getCurrentChoice(state)) {
            break;
        }
        if (state.sys.phase !== 'scoreBases') {
            break;
        }
        advancePostScoringDelay(runner, eventLog);
    }
}

function advanceToAfterScoring(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    actingPlayerId: PlayerId = '0',
    options: { allowDirectAfterScoringSourceIds?: string[] } = {},
) {
    const eventLog: SmashUpEvent[] = [];
    const allowDirectAfterScoringSourceIds = new Set(options.allowDirectAfterScoringSourceIds ?? []);

    const advance = runner.dispatch('ADVANCE_PHASE', { playerId: actingPlayerId });
    expect(advance.success).toBe(true);
    eventLog.push(...advance.events);

    for (let guard = 0; guard < 6; guard += 1) {
        const state = runner.getState();
        const session = getReactionSession(state);
        if (session?.responseWindowType === 'afterScoring') {
            const choice = getCurrentChoice(state);
            if (choice?.sourceId && allowDirectAfterScoringSourceIds.has(choice.sourceId)) {
                return { advance, eventLog, choice: choice! };
            }
            expect(choice?.sourceId).toBe('smashup_reaction_choose');
            return { advance, eventLog, choice: choice! };
        }

        if (session?.responseWindowType === 'meFirst') {
            const choice = getCurrentChoice(state);
            expect(choice?.sourceId).toBe('smashup_reaction_choose');
            const pass = runner.resolveInteraction(choice!.playerId, { optionId: 'pass' });
            expect(pass.success).toBe(true);
            eventLog.push(...pass.events);
            continue;
        }

        throw new Error('未能进入 afterScoring 统一反应入口');
    }

    throw new Error('等待 afterScoring 超时');
}

beforeAll(() => {
    initAllAbilities();
});

describe('After Scoring 响应窗口 - 真实链路', () => {
    it('afterScoring 通过统一反应入口打出我们乃最强后，不会重新给同一基地计分', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('m1', 'alien_invader', '0', '0', 3, 7),
                        makeMinion('m2', 'ninja_shinobi', '1', '1', 2, 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [makeMinion('m3', 'robot_microbot_alpha', '0', '0', 2, 0)],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].hand = [
                { uid: 'c1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner);
        const playOptionId = findOptionId(
            choice,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'c1',
            '找不到我们乃最强的统一反应入口',
        );

        const playResult = runner.resolveInteraction('0', { optionId: playOptionId });
        expect(playResult.success).toBe(true);
        eventLog.push(...playResult.events);

        const sourceChoice = getCurrentChoice(runner.getState());
        expect(sourceChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        const chooseSource = runner.resolveInteraction(
            '0',
            {
                optionId: findOptionId(
                    sourceChoice!,
                    option => option.value?.minionUid === 'm1',
                    '找不到力量来源随从',
                ),
            },
        );
        expect(chooseSource.success).toBe(true);
        eventLog.push(...chooseSource.events);

        const targetChoice = getCurrentChoice(runner.getState());
        expect(targetChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const chooseTarget = runner.resolveInteraction(
            '0',
            {
                optionId: findOptionId(
                    targetChoice!,
                    option => option.value?.minionUid === 'm3',
                    '找不到力量目标随从',
                ),
            },
        );
        expect(chooseTarget.success).toBe(true);
        eventLog.push(...chooseTarget.events);

        const amountChoice = getCurrentChoice(runner.getState());
        expect(amountChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_amount');
        const chooseAmount = runner.resolveInteraction('0', {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 7, value: 7 },
        });
        expect(chooseAmount.success).toBe(true);
        eventLog.push(...chooseAmount.events);

        for (let guard = 0; guard < 4; guard += 1) {
            const pendingChoice = getCurrentChoice(runner.getState());
            if (pendingChoice?.sourceId !== 'smashup_reaction_choose') break;
            const passResult = runner.resolveInteraction(pendingChoice.playerId, { optionId: 'pass' });
            expect(passResult.success).toBe(true);
            eventLog.push(...passResult.events);
        }
        drainScoreBasesDelayUntilPromptOrIdle(runner, eventLog);

        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_SCORED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_CLEARED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_REPLACED)).toBe(1);

        const finalState = runner.getState();
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
        expect(finalState.core.bases[1].minions.find(minion => minion.uid === 'm3')?.powerCounters).toBe(7);
    });

    it('afterScoring 通过统一反应入口打出我们乃最强后若没有合法接收目标，应直接反馈并自动收口而不是卡死', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('m1', 'alien_invader', '0', '0', 3, 7),
                        makeMinion('m2', 'ninja_shinobi', '1', '1', 2, 2),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].hand = [
                { uid: 'c1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner);
        const playOptionId = findOptionId(
            choice,
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'c1',
            '找不到我们乃最强的统一反应入口',
        );
        const playResult = runner.resolveInteraction('0', { optionId: playOptionId });
        expect(playResult.success).toBe(true);
        eventLog.push(...playResult.events);
        expect(
            playResult.events.some(
                event => event.type === SU_EVENTS.ABILITY_FEEDBACK
                    && (
                        (event as { payload?: { feedbackKey?: string; messageKey?: string } }).payload?.feedbackKey === 'feedback.no_valid_targets'
                        || (event as { payload?: { feedbackKey?: string; messageKey?: string } }).payload?.messageKey === 'feedback.no_valid_targets'
                    ),
            ),
        ).toBe(true);
        expect(getCurrentChoice(runner.getState())).toBeUndefined();

        drainScoreBasesDelayUntilPromptOrIdle(runner, eventLog);

        const finalState = runner.getState();
        expect(getCurrentChoice(finalState)).toBeUndefined();
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_SCORED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_CLEARED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_REPLACED)).toBe(1);
    });

    it('afterScoring 同一基地内玩家已让过后，其他玩家出牌结算不应把已让过玩家重新拉回响应窗', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('p0-source', 'giant_ant_worker', '0', '0', 3, 4),
                        makeMinion('p1-source', 'giant_ant_soldier', '1', '1', 2, 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [makeMinion('p0-target', 'alien_invader', '0', '0', 3, 0)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hill',
                    minions: [makeMinion('p1-target', 'robot_microbot_alpha', '1', '1', 2, 0)],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].hand = [
                { uid: 'p0-champs', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'p1-champs', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '1' },
            ];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner);
        const passResult = runner.resolveInteraction(choice.playerId, { optionId: 'pass' });
        expect(passResult.success).toBe(true);
        eventLog.push(...passResult.events);

        const playerOneChoice = getCurrentChoice(runner.getState());
        expect(playerOneChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(playerOneChoice?.playerId).toBe('1');

        const playResult = runner.resolveInteraction('1', {
            optionId: findOptionId(
                playerOneChoice!,
                option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p1-champs',
                '找不到 1 号玩家的我们乃最强统一反应入口',
            ),
        });
        expect(playResult.success).toBe(true);
        eventLog.push(...playResult.events);

        const sourceChoice = getCurrentChoice(runner.getState());
        expect(sourceChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        const chooseSource = runner.resolveInteraction('1', {
            optionId: findOptionId(
                sourceChoice!,
                option => option.value?.minionUid === 'p1-source',
                '找不到 1 号玩家的力量来源随从',
            ),
        });
        expect(chooseSource.success).toBe(true);
        eventLog.push(...chooseSource.events);

        const targetChoice = getCurrentChoice(runner.getState());
        expect(targetChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const chooseTarget = runner.resolveInteraction('1', {
            optionId: findOptionId(
                targetChoice!,
                option => option.value?.minionUid === 'p1-target',
                '找不到 1 号玩家的力量目标随从',
            ),
        });
        expect(chooseTarget.success).toBe(true);
        eventLog.push(...chooseTarget.events);

        const chooseAmount = runner.resolveInteraction('1', {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 3, value: 3 },
        });
        expect(chooseAmount.success).toBe(true);
        eventLog.push(...chooseAmount.events);

        const resumedChoice = getCurrentChoice(runner.getState());
        expect(resumedChoice?.sourceId).not.toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).not.toBe('0');
        expect(getReactionSession(runner.getState())).toBeUndefined();

        drainScoreBasesDelayUntilPromptOrIdle(runner, eventLog);

        const finalState = runner.getState();
        expect(getCurrentChoice(finalState)).toBeUndefined();
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
    });

    it('afterScoring 当前玩家打出一张响应牌后，对手显式让过不应提前关闭，应回到当前玩家继续响应', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('p0-source', 'giant_ant_worker', '0', '0', 3, 4),
                        makeMinion('p1-source', 'giant_ant_soldier', '1', '1', 2, 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [
                        makeMinion('p0-target', 'alien_invader', '0', '0', 3, 0),
                        makeMinion('p0-local-a', 'innsmouth_the_locals', '0', '0', 2, 0),
                        makeMinion('p0-local-b', 'innsmouth_the_locals', '0', '0', 2, 0),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hill',
                    minions: [makeMinion('p1-target', 'robot_microbot_alpha', '1', '1', 2, 0)],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].hand = [
                { uid: 'p0-champs', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                { uid: 'p0-return', defId: 'innsmouth_return_to_the_sea', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'p1-champs', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '1' },
            ];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner);
        const playResult = runner.resolveInteraction('0', {
            optionId: findOptionId(
                choice,
                option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p0-champs',
                '找不到 0 号玩家第一张 afterScoring 响应牌',
            ),
        });
        expect(playResult.success).toBe(true);
        eventLog.push(...playResult.events);

        const sourceChoice = getCurrentChoice(runner.getState());
        expect(sourceChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        const chooseSource = runner.resolveInteraction('0', {
            optionId: findOptionId(
                sourceChoice!,
                option => option.value?.minionUid === 'p0-source',
                '找不到 0 号玩家的力量来源随从',
            ),
        });
        expect(chooseSource.success).toBe(true);
        eventLog.push(...chooseSource.events);

        const targetChoice = getCurrentChoice(runner.getState());
        expect(targetChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const chooseTarget = runner.resolveInteraction('0', {
            optionId: findOptionId(
                targetChoice!,
                option => option.value?.minionUid === 'p0-target',
                '找不到 0 号玩家的力量目标随从',
            ),
        });
        expect(chooseTarget.success).toBe(true);
        eventLog.push(...chooseTarget.events);

        const chooseAmount = runner.resolveInteraction('0', {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 3, value: 3 },
        });
        expect(chooseAmount.success).toBe(true);
        eventLog.push(...chooseAmount.events);

        const playerOneChoice = getCurrentChoice(runner.getState());
        expect(playerOneChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(playerOneChoice?.playerId).toBe('1');
        expect(getPromptOptions(playerOneChoice!).some(
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p1-champs',
        )).toBe(true);

        const passResult = runner.dispatch(SU_COMMANDS.REACTION_PASS, {
            playerId: '1',
            reason: 'ai_pass',
        });
        expect(passResult.success).toBe(true);
        eventLog.push(...passResult.events);

        const resumedChoice = getCurrentChoice(runner.getState());
        expect(resumedChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).toBe('0');
        expect(getPromptOptions(resumedChoice!).some(
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p0-return',
        )).toBe(true);
        expect(getReactionSession(runner.getState())?.activePlayerId).toBe('0');
    });

    it('afterScoring 当前玩家打出一张响应牌后，对手也打出响应牌不应提前关闭，应回到当前玩家继续响应', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('p0-source', 'giant_ant_worker', '0', '0', 3, 4),
                        makeMinion('p1-source', 'giant_ant_soldier', '1', '1', 2, 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [
                        makeMinion('p0-target', 'alien_invader', '0', '0', 3, 0),
                        makeMinion('p0-local-a', 'innsmouth_the_locals', '0', '0', 2, 0),
                        makeMinion('p0-local-b', 'innsmouth_the_locals', '0', '0', 2, 0),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hill',
                    minions: [makeMinion('p1-target', 'robot_microbot_alpha', '1', '1', 2, 0)],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].hand = [
                { uid: 'p0-champs', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                { uid: 'p0-return', defId: 'innsmouth_return_to_the_sea', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [
                { uid: 'p1-champs', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '1' },
            ];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner);
        const playPlayerZero = runner.resolveInteraction('0', {
            optionId: findOptionId(
                choice,
                option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p0-champs',
                '找不到 0 号玩家第一张 afterScoring 响应牌',
            ),
        });
        expect(playPlayerZero.success).toBe(true);
        eventLog.push(...playPlayerZero.events);

        const playerZeroSourceChoice = getCurrentChoice(runner.getState());
        expect(playerZeroSourceChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        const choosePlayerZeroSource = runner.resolveInteraction('0', {
            optionId: findOptionId(
                playerZeroSourceChoice!,
                option => option.value?.minionUid === 'p0-source',
                '找不到 0 号玩家的力量来源随从',
            ),
        });
        expect(choosePlayerZeroSource.success).toBe(true);
        eventLog.push(...choosePlayerZeroSource.events);

        const playerZeroTargetChoice = getCurrentChoice(runner.getState());
        expect(playerZeroTargetChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const choosePlayerZeroTarget = runner.resolveInteraction('0', {
            optionId: findOptionId(
                playerZeroTargetChoice!,
                option => option.value?.minionUid === 'p0-target',
                '找不到 0 号玩家的力量目标随从',
            ),
        });
        expect(choosePlayerZeroTarget.success).toBe(true);
        eventLog.push(...choosePlayerZeroTarget.events);

        const choosePlayerZeroAmount = runner.resolveInteraction('0', {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 3, value: 3 },
        });
        expect(choosePlayerZeroAmount.success).toBe(true);
        eventLog.push(...choosePlayerZeroAmount.events);

        const playerOneChoice = getCurrentChoice(runner.getState());
        expect(playerOneChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(playerOneChoice?.playerId).toBe('1');
        const playPlayerOne = runner.resolveInteraction('1', {
            optionId: findOptionId(
                playerOneChoice!,
                option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p1-champs',
                '找不到 1 号玩家的 afterScoring 响应牌',
            ),
        });
        expect(playPlayerOne.success).toBe(true);
        eventLog.push(...playPlayerOne.events);

        const playerOneSourceChoice = getCurrentChoice(runner.getState());
        expect(playerOneSourceChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        const choosePlayerOneSource = runner.resolveInteraction('1', {
            optionId: findOptionId(
                playerOneSourceChoice!,
                option => option.value?.minionUid === 'p1-source',
                '找不到 1 号玩家的力量来源随从',
            ),
        });
        expect(choosePlayerOneSource.success).toBe(true);
        eventLog.push(...choosePlayerOneSource.events);

        const playerOneTargetChoice = getCurrentChoice(runner.getState());
        expect(playerOneTargetChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const choosePlayerOneTarget = runner.resolveInteraction('1', {
            optionId: findOptionId(
                playerOneTargetChoice!,
                option => option.value?.minionUid === 'p1-target',
                '找不到 1 号玩家的力量目标随从',
            ),
        });
        expect(choosePlayerOneTarget.success).toBe(true);
        eventLog.push(...choosePlayerOneTarget.events);

        const choosePlayerOneAmount = runner.resolveInteraction('1', {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 2, value: 2 },
        });
        expect(choosePlayerOneAmount.success).toBe(true);
        eventLog.push(...choosePlayerOneAmount.events);

        const resumedChoice = getCurrentChoice(runner.getState());
        expect(resumedChoice?.sourceId).toBe('smashup_reaction_choose');
        expect(resumedChoice?.playerId).toBe('0');
        expect(getPromptOptions(resumedChoice!).some(
            option => option.value?.kind === 'play_action' && option.value?.cardUid === 'p0-return',
        )).toBe(true);
        expect(getReactionSession(runner.getState())?.activePlayerId).toBe('0');
    });

    it('afterScoring 窗口打开时不会提前清场换基地，全部让过后只补发一次', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('m1', 'alien_invader', '0', '0', 3, 10),
                        makeMinion('m2', 'ninja_shinobi', '1', '1', 2, 8),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].hand = [
                { uid: 'c1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const { advance, eventLog, choice } = advanceToAfterScoring(runner);
        expect(collectBaseEventCount(advance.events, SU_EVENTS.BASE_CLEARED)).toBe(0);
        expect(collectBaseEventCount(advance.events, SU_EVENTS.BASE_REPLACED)).toBe(0);
        expect(runner.getState().core.bases[0].defId).toBe('base_the_jungle');
        expect(getReactionSession(runner.getState())?.responseWindowType).toBe('afterScoring');

        const passResult = runner.resolveInteraction(choice.playerId, { optionId: 'pass' });
        expect(passResult.success).toBe(true);
        eventLog.push(...passResult.events);
        drainScoreBasesDelayUntilPromptOrIdle(runner, eventLog);

        const finalState = runner.getState();
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
    });

    it('afterScoring 在同基地内转移力量且总分不变时，也只会清场并换基地一次', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_hill',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', '0', 3, 5),
                        makeMinion('m2', 'giant_ant_soldier', '0', '0', 2, 0),
                        makeMinion('m3', 'ninja_shinobi', '1', '1', 5, 8),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_egg_chamber'];
            core.players['0'].hand = [
                { uid: 'c1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner);
        const playResult = runner.resolveInteraction(
            '0',
            {
                optionId: findOptionId(
                    choice,
                    option => option.value?.kind === 'play_action' && option.value?.cardUid === 'c1',
                    '找不到我们乃最强的统一反应入口',
                ),
            },
        );
        expect(playResult.success).toBe(true);
        eventLog.push(...playResult.events);

        const sourceChoice = getCurrentChoice(runner.getState());
        expect(sourceChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        const chooseSource = runner.resolveInteraction(
            '0',
            {
                optionId: findOptionId(
                    sourceChoice!,
                    option => option.value?.minionUid === 'm1',
                    '找不到同基地内的来源随从',
                ),
            },
        );
        expect(chooseSource.success).toBe(true);
        eventLog.push(...chooseSource.events);

        const targetChoice = getCurrentChoice(runner.getState());
        expect(targetChoice?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const chooseTarget = runner.resolveInteraction(
            '0',
            {
                optionId: findOptionId(
                    targetChoice!,
                    option => option.value?.minionUid === 'm2',
                    '找不到同基地内的目标随从',
                ),
            },
        );
        expect(chooseTarget.success).toBe(true);
        eventLog.push(...chooseTarget.events);

        const chooseAmount = runner.resolveInteraction('0', {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 5, value: 5 },
        });
        expect(chooseAmount.success).toBe(true);
        eventLog.push(...chooseAmount.events);
        drainScoreBasesDelayUntilPromptOrIdle(runner, eventLog);

        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_SCORED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_CLEARED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_REPLACED)).toBe(1);

        const finalState = runner.getState();
        expect(finalState.core.bases[0].defId).toBe('base_egg_chamber');
        expect(finalState.core.bases[0].minions).toHaveLength(0);
    });

    it('已有 simple-choice 时不能直接越过它出牌，解完后会先回到统一反应入口再进入子交互', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'scoreBases';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [makeMinion('m1', 'alien_invader', '0', '0', 3, 10)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hill',
                    minions: [makeMinion('m2', 'robot_microbot_alpha', '0', '0', 2, 0)],
                    ongoingActions: [],
                },
            ];
            core.players['0'].hand = [
                { uid: 'c1', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];

            const existingChoiceState = withCurrentPrompt({ sys, core }, createSimpleChoice(
                'existing-base-choice',
                '0',
                '已有基地选择',
                [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' }],
                { sourceId: 'existing-base-choice', targetType: 'button' },
            ));
            const baseRef = createScoringBaseRef(core, 0);
            if (!baseRef) {
                throw new Error('无法构造 afterScoring rescoring 测试用 scoring base ref');
            }
            const scoreState = setScoringSession(existingChoiceState, {
                ...createScoringSession(core, [0]),
                currentBaseRef: baseRef,
                currentStep: 'awaiting-response-window',
            });
            const started = startSmashUpReactionSession(scoreState, {
                frameId: 'score-after:0:test',
                frameKind: 'score-after',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                consecutivePasses: 0,
                responseWindowType: 'afterScoring',
            });
            return {
                ...started,
                sys: {
                    ...started.sys,
                    responseWindow: {
                        ...(started.sys.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
        });

        const directPlay = runner.dispatch(SU_COMMANDS.PLAY_ACTION, {
            playerId: '0',
            cardUid: 'c1',
            targetBaseIndex: 0,
        });
        expect(directPlay.success).toBe(false);
        expect(directPlay.error).toBe('请先完成当前选择');

        const clearCurrentChoice = runner.resolveInteraction('0', { optionId: 'skip' });
        expect(clearCurrentChoice.success).toBe(true);
        const reactionChoice = getCurrentChoice(runner.getState());
        expect(reactionChoice?.sourceId).toBe('smashup_reaction_choose');

        const playFromChooser = runner.resolveInteraction(
            '0',
            {
                optionId: findOptionId(
                    reactionChoice!,
                    option => option.value?.kind === 'play_action' && option.value?.cardUid === 'c1',
                    '找不到统一反应入口里的我们乃最强',
                ),
            },
        );
        expect(playFromChooser.success).toBe(true);
        expect(getCurrentChoice(runner.getState())?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
    });

    it('base_greenhouse 在 afterScoring 选牌落地后会正常收口，不会卡在 scoreBases', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_greenhouse',
                    minions: [
                        makeMinion('m1', 'alien_invader', '0', '0', 13, 0),
                        makeMinion('m2', 'robot_microbot_alpha', '0', '0', 11, 0),
                        makeMinion('m3', 'ninja_shinobi', '1', '1', 8, 0),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].deck = [
                { uid: 'deck-minion', defId: 'alien_collector', type: 'minion', owner: '0' },
            ];
            core.players['0'].hand = [];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner, '0', {
            allowDirectAfterScoringSourceIds: ['base_greenhouse'],
        });
        let greenhouseChoice = choice;
        if (choice.sourceId === 'smashup_reaction_choose') {
            const chooseGreenhouse = runner.resolveInteraction('0', {
                optionId: findQueuedTriggerOptionId(
                    runner.getState(),
                    choice,
                    'base_greenhouse',
                    '找不到温室的统一反应入口',
                ),
            });
            expect(chooseGreenhouse.success).toBe(true);
            eventLog.push(...chooseGreenhouse.events);
            greenhouseChoice = getCurrentChoice(runner.getState())!;
        }
        expect(greenhouseChoice?.sourceId).toBe('base_greenhouse');
        const chooseDeckMinion = runner.resolveInteraction('0', {
            optionId: findOptionId(
                greenhouseChoice!,
                option => option.value?.cardUid === 'deck-minion',
                '找不到温室牌库随从选项',
            ),
        });
        expect(chooseDeckMinion.success).toBe(true);
        eventLog.push(...chooseDeckMinion.events);
        drainScoreBasesDelayUntilPromptOrIdle(runner, eventLog);

        const finalState = runner.getState();
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_SCORED)).toBe(1);
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
        expect(['startTurn', 'playCards']).toContain(finalState.sys.phase);
        expect(finalState.core.currentPlayerIndex).toBe(1);
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
        expect(finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['deck-minion']);
        expect(finalState.core.players['0'].deck).toHaveLength(0);
        const nextChoice = getCurrentChoice(finalState);
        if (nextChoice) {
            expect(nextChoice.sourceId).toBe('smashup_immediate_extra_minion');
            expect(nextChoice.playerId).toBe('1');
        }
    });

    it('base_great_library 与 alien_scout 同时进入 afterScoring 时，先结算抽牌也不会触发命令异常', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            core.currentPlayerIndex = 1;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_great_library',
                    minions: [
                        makeMinion('scout-0', 'alien_scout', '0', '0', 3, 12),
                        makeMinion('bot-1', 'robot_microbot_alpha', '1', '1', 2, 12),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden'];
            core.players['0'].deck = [
                { uid: 'p0-deck-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            ];
            core.players['0'].discard = [];
            core.players['0'].hand = [];
            core.players['1'].deck = [];
            core.players['1'].discard = [
                { uid: 'p1-discard-1', defId: 'wizard_neophyte', type: 'minion', owner: '1' },
                { uid: 'p1-discard-2', defId: 'wizard_portal', type: 'action', owner: '1' },
            ];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const { eventLog, choice } = advanceToAfterScoring(runner, '1', {
            allowDirectAfterScoringSourceIds: ['alien_scout_return'],
        });
        expect(choice.sourceId).toBe('alien_scout_return');

        const player1Reshuffle = eventLog.find(event =>
            event.type === SU_EVENTS.DECK_RESHUFFLED
            && (event as any).payload?.playerId === '1',
        );
        expect(player1Reshuffle).toBeDefined();

        const drawEvents = eventLog.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    payload: expect.objectContaining({
                        playerId: '0',
                        count: 1,
                        cardUids: ['p0-deck-1'],
                    }),
                }),
                expect.objectContaining({
                    payload: expect.objectContaining({
                        playerId: '1',
                        count: 1,
                        cardUids: ['p1-discard-1'],
                    }),
                }),
            ]),
        );

        const nextChoice = getCurrentChoice(runner.getState());
        expect(nextChoice?.sourceId).toBe('alien_scout_return');
        expect(runner.getState().core.players['1'].hand.map(card => card.uid)).toContain('p1-discard-1');
    });

    it('afterScoring 把随从移到新基地后若使其达标，应继续把新基地纳入本轮计分', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('mate-0', 'pirate_first_mate', '0', '0', 2, 0),
                        makeMinion('ally-0', 'dino_king_rex', '0', '0', 10, 0),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_pirate_cove',
                    minions: [
                        makeMinion('target-a', 'alien_invader', '0', '0', 8, 0),
                        makeMinion('target-b', 'robot_zapbot', '0', '0', 7, 0),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden', 'base_tar_pits'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const eventLog: SmashUpEvent[] = [];
        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);
        eventLog.push(...advance.events);

        let firstMateChoice: ReturnType<typeof getCurrentChoice> | undefined;
        for (let guard = 0; guard < 8; guard += 1) {
            const state = runner.getState();
            const choice = getCurrentChoice(state);
            const session = getReactionSession(state);

            if (choice?.sourceId === 'pirate_first_mate_choose_base') {
                firstMateChoice = choice;
                break;
            }

            if (choice?.sourceId === 'smashup_reaction_choose') {
                const optionId = findQueuedTriggerOptionId(
                    state,
                    choice,
                    'pirate_first_mate',
                    '找不到大副的统一反应入口',
                );
                const resolved = runner.resolveInteraction(choice.playerId, { optionId });
                expect(resolved.success).toBe(true);
                eventLog.push(...resolved.events);
                continue;
            }

            if (session?.responseWindowType === 'meFirst' && choice?.sourceId === 'smashup_reaction_choose') {
                const pass = runner.resolveInteraction(choice.playerId, { optionId: 'pass' });
                expect(pass.success).toBe(true);
                eventLog.push(...pass.events);
                continue;
            }

            throw new Error(`未能进入大副计分后移动交互: ${JSON.stringify({
                phase: state.sys.phase,
                interactionSourceId: choice?.sourceId ?? null,
                responseWindowType: session?.responseWindowType ?? null,
            })}`);
        }

        expect(firstMateChoice?.sourceId).toBe('pirate_first_mate_choose_base');
        const moveMate = runner.resolveInteraction('0', {
            optionId: findOptionId(
                firstMateChoice!,
                option => option.value?.baseIndex === 1,
                '找不到大副移动到基地 1 的选项',
            ),
        });
        expect(moveMate.success).toBe(true);
        eventLog.push(...moveMate.events);

        for (let guard = 0; guard < 8; guard += 1) {
            const state = runner.getState();
            const pendingChoice = getCurrentChoice(state);

            if (!pendingChoice) {
                if (state.sys.phase === 'scoreBases') {
                    advancePostScoringDelay(runner, eventLog);
                    continue;
                }
                break;
            }

            if (pendingChoice.sourceId === 'pirate_first_mate_choose_base') {
                const skipMove = runner.resolveInteraction(pendingChoice.playerId, { optionId: 'skip' });
                expect(skipMove.success).toBe(true);
                eventLog.push(...skipMove.events);
                continue;
            }

            if (pendingChoice.sourceId === 'smashup_reaction_choose') {
                const pass = runner.resolveInteraction(pendingChoice.playerId, { optionId: 'pass' });
                expect(pass.success).toBe(true);
                eventLog.push(...pass.events);
                continue;
            }

            throw new Error(`第二次计分后的交互未按预期收口: ${pendingChoice.sourceId}`);
        }

        const finalState = runner.getState();
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_SCORED)).toBe(2);
        expect(finalState.core.players['0'].vp).toBe(5);
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
        expect(finalState.core.bases[1].defId).toBe('base_tar_pits');
        expect(['startTurn', 'playCards']).toContain(finalState.sys.phase);
        expect(finalState.core.currentPlayerIndex).toBe(1);
    });

});
