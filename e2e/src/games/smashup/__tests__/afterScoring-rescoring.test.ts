/**
 * afterScoring 真实链路与统一反应入口测试
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import { asSimpleChoice, createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
import { SmashUpDomain } from '../domain';
import { smashUpSystemsForTest } from '../game';
import type { MinionOnBase, SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';

interface ReactionSessionView {
    responseWindowType?: 'meFirst' | 'afterScoring';
    activePlayerId: string;
    currentPlayerId: string;
}

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

function collectBaseEventCount(events: SmashUpEvent[], type: typeof SU_EVENTS.BASE_SCORED | typeof SU_EVENTS.BASE_CLEARED | typeof SU_EVENTS.BASE_REPLACED) {
    return events.filter(event => event.type === type).length;
}

function advanceToAfterScoring(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
) {
    const eventLog: SmashUpEvent[] = [];

    const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
    expect(advance.success).toBe(true);
    eventLog.push(...advance.events);

    for (let guard = 0; guard < 6; guard += 1) {
        const state = runner.getState();
        const session = getReactionSession(state);
        if (session?.responseWindowType === 'afterScoring') {
            const choice = getCurrentChoice(state);
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

        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_SCORED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_CLEARED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_REPLACED)).toBe(1);

        const finalState = runner.getState();
        expect(getReactionSession(finalState)).toBeUndefined();
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
        expect(finalState.core.bases[0].defId).toBe('base_secret_garden');
        expect(finalState.core.bases[1].minions.find(minion => minion.uid === 'm3')?.powerCounters).toBe(7);
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

        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_CLEARED)).toBe(1);
        expect(collectBaseEventCount(eventLog, SU_EVENTS.BASE_REPLACED)).toBe(1);
        expect(getReactionSession(runner.getState())).toBeUndefined();
        expect(runner.getState().core.bases[0].defId).toBe('base_secret_garden');
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

            sys.interaction.current = createSimpleChoice(
                'existing-base-choice',
                '0',
                '已有基地选择',
                [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' }],
                { sourceId: 'existing-base-choice', targetType: 'button' },
            );
            (sys as typeof sys & { smashupReactionSession?: ReactionSessionView }).smashupReactionSession = {
                frameId: 'score-after:0:test',
                responseWindowType: 'afterScoring',
                activePlayerId: '0',
                currentPlayerId: '0',
            };
            sys.responseWindow = {
                ...(sys.responseWindow ?? {}),
                current: undefined,
            };

            return { sys, core };
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
});
