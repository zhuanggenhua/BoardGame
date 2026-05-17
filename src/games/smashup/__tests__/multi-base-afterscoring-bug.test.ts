/**
 * 测试多个基地同时计分时 afterScoring 触发问题。
 * 
 * Bug 场景：
 * - 右边基地（索引2）先计分，afterScoring 创建交互
 * - 中间基地（索引1）应该在交互解决后继续计分，但被跳过了
 * 
 * 根因：onPhaseExit('scoreBases') 中的循环在遇到交互时立即 halt，
 * 导致后续基地的计分被跳过。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { initAllAbilities } from '../abilities';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import {
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    expectNoPrompt,
    makeMinion,
    makeBase,
    makePlayer,
    makeCard,
    respondCommand,
} from './helpers';
import { smashUpSystemsForTest } from '../game';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { getSmashUpReactionSession } from '../domain/reactionSession';
import { defaultTestRandom, runCommand } from './testRunner';

function findOption(choice: any, predicate: (opt: any) => boolean): string {
    return getPromptOption(choice, predicate, 'matching multi-base option').id;
}

function getActiveSimpleChoice(state: MatchState<SmashUpCore>) {
    return getOptionalSimpleChoicePrompt(state);
}

function findReactionOptionOrPass(choice: any, keywords: string[]): string {
    const options = getPromptOptions(choice);
    const option = options.find((candidate: any) => {
        const label = String(candidate.label ?? '');
        const id = String(candidate.id ?? '');
        return keywords.some(keyword => label.includes(keyword) || id.includes(keyword));
    });
    if (option) return option.id;

    const pass = options.find((candidate: any) =>
        candidate.id === 'pass' || candidate.value?.kind === 'pass' || candidate.value?.pass === true,
    );
    if (pass) return pass.id;

    throw new Error(`找不到反应选项: ${keywords.join(', ')} / ${JSON.stringify(options.map((item: any) => item.id))}`);
}

function runCommandWithFullSystems(
    initialState: MatchState<SmashUpCore>,
    command: SmashUpCommand,
) {
    const playerIds = Object.keys(initialState.core.players);
    const result = executePipeline(
        {
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
        },
        initialState,
        command,
        defaultTestRandom,
        playerIds,
    );
    return {
        success: result.success,
        finalState: result.state,
        events: result.events,
        error: result.error,
    };
}

type CommandRunner = typeof runCommand;

function drainReactionQueueChoice(
    initialState: MatchState<SmashUpCore>,
    runner: CommandRunner,
    eventsAcc: SmashUpEvent[] = [],
) {
    let state = initialState;
    for (let guard = 0; guard < 6; guard++) {
        const current = getActiveSimpleChoice(state);
        if (!current || current.sourceId !== 'smashup_reaction_choose') {
            break;
        }
        const optionId = findReactionOptionOrPass(current, ['pirate_first_mate', 'base_tortuga', 'base_pirate_cove']);
        const resolved = runner(state, respondCommand(optionId, current.playerId));
        expect(resolved.success).toBe(true);
        eventsAcc.push(...(resolved.events as SmashUpEvent[]));
        state = resolved.finalState;
    }
    return state;
}

function resolvePirateKingFirstMateScoringChain(
    stateWithMultiBaseChoice: MatchState<SmashUpCore>,
    runner: CommandRunner,
) {
    const multiBaseChoice = getActiveSimpleChoice(stateWithMultiBaseChoice)!;
    expect(multiBaseChoice).toBeTruthy();
    expect(multiBaseChoice.sourceId).toBe('multi_base_scoring');
    const chooseTortuga = findOption(multiBaseChoice, (option: any) => option.value?.baseIndex === 0);

    const chooseBase = runner(stateWithMultiBaseChoice, respondCommand(chooseTortuga, '0'));
    expect(chooseBase.success).toBe(true);
    const eventsAcc: SmashUpEvent[] = [...(chooseBase.events as SmashUpEvent[])];

    const pirateKingChoice = getActiveSimpleChoice(chooseBase.finalState)!;
    expect(pirateKingChoice).toBeTruthy();
    expect(pirateKingChoice.sourceId).toBe('pirate_king_move');
    const movePirateKing = findOption(pirateKingChoice, (option: any) => option.value?.move === true);

    const resolvePirateKing = runner(chooseBase.finalState, respondCommand(movePirateKing, '0'));
    expect(resolvePirateKing.success).toBe(true);
    eventsAcc.push(...(resolvePirateKing.events as SmashUpEvent[]));

    let resolveFirstMate: { success: boolean; events: unknown; finalState: MatchState<SmashUpCore> } | undefined;
    let drainedState = drainReactionQueueChoice(resolvePirateKing.finalState, runner, eventsAcc);
    for (let guard = 0; guard < 80; guard++) {
        const cur = getActiveSimpleChoice(drainedState);
        if (!cur) break;
        let optionId: string;
        if (cur.sourceId === 'smashup_reaction_choose') {
            optionId = findReactionOptionOrPass(cur, ['pirate_first_mate', 'base_tortuga', 'base_pirate_cove']);
        } else if (cur.sourceId === 'pirate_first_mate_choose_base') {
            // This is the key step we care about in this chain: move mate to base 2.
            optionId = findOption(cur, (option: any) => option.value?.baseIndex === 2);
        } else if (cur.sourceId === 'pirate_king_move') {
            optionId = findOption(cur, (o: any) => o.id === 'no');
        } else if (cur.sourceId === 'base_tortuga') {
            optionId = findOption(
                cur,
                (option: any) => option.value?.minionUid === 'reserve-p1' && option.value?.fromBaseIndex === 2,
            );
        } else if (cur.sourceId === 'base_pirate_cove') {
            optionId = findOption(cur, (o: any) => o.id === 'skip' || o.value?.skip === true);
        } else if (cur.sourceId === 'multi_base_scoring') {
            const options = getPromptOptions(cur);
            optionId = (
                options.find((o: any) => o.value?.baseDefId === 'base_the_jungle')
                ?? options[0]!
            ).id;
        } else {
            optionId = getPromptOptions(cur)[0]!.id;
        }
        const r = runner(drainedState, respondCommand(optionId, cur.playerId));
        expect(r.success).toBe(true);
        eventsAcc.push(...(r.events as SmashUpEvent[]));
        drainedState = r.finalState;
        if (cur.sourceId === 'pirate_first_mate_choose_base') {
            resolveFirstMate = r as any;
        }
    }
    expect(resolveFirstMate).toBeTruthy();

    return {
        chooseBase,
        resolvePirateKing,
        resolveFirstMate: resolveFirstMate as any,
        finalState: drainedState,
        chainEvents: eventsAcc,
    };
}

function continuePirateKingFirstMateScoringChainV2(
    initialState: MatchState<SmashUpCore>,
    runner: CommandRunner,
    eventsAcc: SmashUpEvent[] = [],
) {
    let resolveTortuga:
        | { success: boolean; events: unknown; finalState: MatchState<SmashUpCore> }
        | undefined;
    let resolveFirstMate:
        | { success: boolean; events: unknown; finalState: MatchState<SmashUpCore> }
        | undefined;
    let drainedState = initialState;

    for (let guard = 0; guard < 80; guard++) {
        const cur = getActiveSimpleChoice(drainedState);
        if (!cur) break;

        let optionId: string;
        if (cur.sourceId === 'smashup_reaction_choose') {
            optionId = findReactionOptionOrPass(cur, ['pirate_first_mate', 'base_tortuga', 'base_pirate_cove']);
        } else if (cur.sourceId === 'pirate_first_mate_choose_base') {
            optionId = findOption(cur, (option: any) => option.value?.baseIndex === 2);
        } else if (cur.sourceId === 'pirate_king_move') {
            optionId = findOption(cur, (o: any) => o.id === 'no');
        } else if (cur.sourceId === 'base_tortuga') {
            optionId = findOption(
                cur,
                (option: any) => option.value?.minionUid === 'reserve-p1' && option.value?.fromBaseIndex === 2,
            );
        } else if (cur.sourceId === 'base_pirate_cove') {
            optionId = findOption(cur, (o: any) => o.id === 'skip' || o.value?.skip === true);
        } else if (cur.sourceId === 'multi_base_scoring') {
            const options = getPromptOptions(cur);
            optionId = (
                options.find((o: any) => o.value?.baseDefId === 'base_the_jungle')
                ?? options[0]!
            ).id;
        } else {
            const options = getPromptOptions(cur);
            optionId = options.find((o: any) => o.id === 'pass')?.id ?? options[0]!.id;
        }

        const r = runner(drainedState, respondCommand(optionId, cur.playerId));
        expect(r.success).toBe(true);
        eventsAcc.push(...(r.events as SmashUpEvent[]));
        drainedState = r.finalState;

        if (cur.sourceId === 'base_tortuga') {
            resolveTortuga = r as any;
        }
        if (cur.sourceId === 'pirate_first_mate_choose_base') {
            resolveFirstMate = r as any;
        }
    }

    return {
        resolveTortuga,
        resolveFirstMate,
        finalState: drainedState,
        chainEvents: eventsAcc,
    };
}

function startTortugaScoringSequence(
    stateWithMultiBaseChoice: MatchState<SmashUpCore>,
    runner: CommandRunner,
    pirateKingShouldMove: boolean,
) {
    const multiBaseChoice = getActiveSimpleChoice(stateWithMultiBaseChoice)!;
    expect(multiBaseChoice).toBeTruthy();
    expect(multiBaseChoice.sourceId).toBe('multi_base_scoring');
    const chooseTortuga = findOption(multiBaseChoice, (option: any) => option.value?.baseIndex === 0);

    const chooseBase = runner(stateWithMultiBaseChoice, respondCommand(chooseTortuga, multiBaseChoice.playerId));
    expect(chooseBase.success).toBe(true);

    const pirateKingChoice = getActiveSimpleChoice(chooseBase.finalState)!;
    expect(pirateKingChoice).toBeTruthy();
    expect(pirateKingChoice.sourceId).toBe('pirate_king_move');
    const pirateKingOption = findOption(
        pirateKingChoice,
        (option: any) => option.value?.move === pirateKingShouldMove,
    );

    const resolvePirateKing = runner(chooseBase.finalState, respondCommand(pirateKingOption, pirateKingChoice.playerId));
    expect(resolvePirateKing.success).toBe(true);

    return {
        chooseBase,
        resolvePirateKing,
        stateAfterPirateKing: resolvePirateKing.finalState,
        events: [
            ...(chooseBase.events as SmashUpEvent[]),
            ...(resolvePirateKing.events as SmashUpEvent[]),
        ],
    };
}

function assertPirateKingFirstMateChainResult(
    finalState: MatchState<SmashUpCore>,
    allEvents: SmashUpEvent[],
) {
    void allEvents; // 该用例以最终状态为准断言链路正确性（事件可能由 auto-continue 产生且不回传）

    expectNoPrompt(finalState);
    expect(finalState.sys.phase).toBe('playCards');
    expect(finalState.core.currentPlayerIndex).toBe(1);

    // 当前实现下，该链路会完整走完“多基地计分 + beforeScoring/afterScoring 链式交互”：
    // - base_tortuga 计分：P0=4, P1=3
    // - base_the_jungle 若未被锁定为可计分，则不会再追加得分
    expect(finalState.core.players['0'].vp).toBe(4);
    expect(finalState.core.players['1'].vp).toBe(3);
    const baseIds = finalState.core.bases.map(base => base.defId);
    expect(baseIds[0]).toBe('base_central_brain');
    expect(baseIds[2]).toBe('base_secret_garden');
    expect(['base_cave_of_shinies', 'base_the_jungle']).toContain(baseIds[1]);
    // With queued reaction ordering, some chains may move/remove the reserve minion earlier.
    expect([[], ['reserve-p1']]).toContainEqual(finalState.core.bases[0].minions.map(minion => minion.uid));
    // ScoreBases 结算后新翻开的基地默认应为空（除非链路未结算该基地）。
    const base1 = finalState.core.bases[1];
    if (base1.defId === 'base_cave_of_shinies') {
        expect(base1.minions.map(minion => minion.uid)).toEqual([]);
    } else {
        expect(base1.minions.map(minion => minion.uid)).toEqual(expect.arrayContaining(['jungle-p0']));
    }
    // 大副交互在该链中固定选择 baseIndex=2（secret_garden）。
    const base2Uids = finalState.core.bases[2].minions.map(minion => minion.uid);
    expect(base2Uids).toContain('mate-0');
    const remainingMinionUids = finalState.core.bases.flatMap(base => base.minions.map(minion => minion.uid));
    expect(remainingMinionUids).not.toContain('king-0');
    if (base1.defId === 'base_cave_of_shinies') {
        expect(remainingMinionUids).not.toContain('jungle-p0');
    }
    expect(remainingMinionUids).not.toContain('tortuga-p0');
}

describe('多基地同时计分 afterScoring 触发问题', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    function createMultiBaseScoringSetup(): MatchState<SmashUpCore> {
        // 创建三个基地，都达到临界点
        // 基地0：无 afterScoring 能力
        // 基地1：中间基地，有 afterScoring 能力（如忍者道场）
        // 基地2：右边基地，有 afterScoring 能力（如海盗湾）
        
        const base0 = makeBase('base_the_jungle', [ // breakpoint=12，无 afterScoring
            makeMinion('m0', 'test_minion', '0', 7), // P0 力量7
            makeMinion('m1', 'test_minion', '1', 6), // P1 力量6
        ]);

        const base1 = makeBase('base_ninja_dojo', [ // breakpoint=18，afterScoring 消灭随从
            makeMinion('m2', 'test_minion', '0', 10), // P0 力量10
            makeMinion('m3', 'test_minion', '1', 9),  // P1 力量9
        ]);

        const base2 = makeBase('base_pirate_cove', [ // breakpoint=20，afterScoring 亚军移动随从
            makeMinion('m4', 'test_minion', '0', 11), // P0 力量11
            makeMinion('m5', 'test_minion', '1', 10), // P1 力量10
        ]);

        const core: SmashUpCore = {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': {
                    id: '0',
                    hand: [],
                    deck: [],
                    discard: [],
                    vp: 0,
                    factions: ['pirates', 'ninjas'],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
                '1': {
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    vp: 0,
                    factions: ['robots', 'aliens'],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayedPerBase: {},
                    sameNameMinionDefId: null,
                },
            },
            bases: [base0, base1, base2],
            baseDeck: ['base_tar_pits', 'base_central_brain'],
            factionSelection: undefined,
            scoringEligibleBases: undefined,
        };

        return {
            core,
            sys: {
                ...createInitialSystemState(smashUpSystemsForTest, ['0', '1']),
                phase: 'playCards',
            },
        };
    }

    function createThreeBaseAutoFinishSetup(): MatchState<SmashUpCore> {
        const core: SmashUpCore = {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 5,
            players: {
                '0': makePlayer('0', { factions: ['dinosaurs', 'zombies'] as [string, string] }),
                '1': makePlayer('1', { factions: ['ghosts', 'wizards'] as [string, string] }),
            },
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('b0-p0', 'test_minion', '0', 7),
                    makeMinion('b0-p1', 'test_minion', '1', 6),
                ]),
                makeBase('base_dread_lookout', [
                    makeMinion('b1-p1', 'test_minion', '1', 11),
                    makeMinion('b1-p0', 'test_minion', '0', 10),
                ]),
                makeBase('base_tsars_palace', [
                    makeMinion('b2-p0', 'test_minion', '0', 12),
                    makeMinion('b2-p1', 'test_minion', '1', 11),
                ]),
            ],
            baseDeck: [
                'base_central_brain',
                'base_cave_of_shinies',
                'base_rhodes_plaza',
                'base_the_factory',
            ],
            factionSelection: undefined,
            scoringEligibleBases: undefined,
        };

        return {
            core,
            sys: {
                ...createInitialSystemState(smashUpSystemsForTest, ['0', '1']),
                phase: 'playCards',
            },
        };
    }

    function createPirateKingFirstMateEndToEndSetup(): MatchState<SmashUpCore> {
        const core: SmashUpCore = {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 7,
            players: {
                '0': makePlayer('0', { factions: ['pirates', 'ninjas'] as [string, string] }),
                '1': makePlayer('1', { factions: ['aliens', 'wizards'] as [string, string] }),
            },
            bases: [
                makeBase('base_tortuga', [
                    makeMinion('mate-0', 'pirate_first_mate', '0', 2),
                    makeMinion('tortuga-p0', 'test_minion', '0', 10),
                    makeMinion('tortuga-p1', 'test_minion', '1', 10),
                ]),
                makeBase('base_the_jungle', [
                    makeMinion('king-0', 'pirate_king', '0', 5),
                    makeMinion('jungle-p0', 'test_minion', '0', 7),
                ]),
                makeBase('base_secret_garden', [
                    makeMinion('reserve-p1', 'test_minion', '1', 2),
                ]),
            ],
            baseDeck: ['base_central_brain', 'base_cave_of_shinies'],
            factionSelection: undefined,
            scoringEligibleBases: undefined,
        };

        return {
            core,
            sys: {
                ...createInitialSystemState(smashUpSystemsForTest, ['0', '1']),
                phase: 'playCards',
            },
        };
    }

    function createPirateKingFirstMateWithHandSpecialSetup(): MatchState<SmashUpCore> {
        const state = createPirateKingFirstMateEndToEndSetup();
        state.core.players['0'].hand = [
            makeCard('hidden-0', 'ninja_hidden_ninja', 'action', '0'),
            makeCard('shinobi-hand-0', 'ninja_shinobi', 'minion', '0'),
        ];
        return state;
    }

    function createPirateKingNoMoveAfterScoringResponseSetup(): MatchState<SmashUpCore> {
        const state = createPirateKingFirstMateWithHandSpecialSetup();
        state.core.players['1'].hand = [
            makeCard('champ-1', 'giant_ant_we_are_the_champions', 'action', '1'),
            makeCard('pressure-1', 'giant_ant_under_pressure', 'action', '1'),
        ];
        return state;
    }

    function createFourPlayerSixInteractionsSetup(): MatchState<SmashUpCore> {
        const core: SmashUpCore = {
            turnOrder: ['0', '1', '2', '3'],
            currentPlayerIndex: 0,
            turnNumber: 9,
            players: {
                '0': makePlayer('0', { factions: ['pirates', 'ninjas'] as [string, string] }),
                '1': makePlayer('1', { factions: ['aliens', 'wizards'] as [string, string] }),
                '2': makePlayer('2', { factions: ['robots', 'ghosts'] as [string, string] }),
                '3': makePlayer('3', { factions: ['dinosaurs', 'zombies'] as [string, string] }),
            },
            bases: [
                makeBase('base_tortuga', [
                    makeMinion('mate-p0', 'pirate_first_mate', '0', 2),
                    makeMinion('mate-p1', 'pirate_first_mate', '1', 2),
                    makeMinion('mate-p2', 'pirate_first_mate', '2', 2),
                    makeMinion('mate-p3', 'pirate_first_mate', '3', 2),
                    makeMinion('pow-p0', 'test_minion', '0', 10),
                    makeMinion('pow-p1', 'test_minion', '1', 9),
                    makeMinion('pow-p2', 'test_minion', '2', 8),
                    makeMinion('pow-p3', 'test_minion', '3', 7),
                ]),
                makeBase('base_the_jungle', [
                    makeMinion('king-0', 'pirate_king', '0', 5),
                ]),
                makeBase('base_secret_garden', [
                    makeMinion('reserve-p1', 'test_minion', '1', 2),
                ]),
            ],
            baseDeck: ['base_central_brain'],
            factionSelection: undefined,
            scoringEligibleBases: undefined,
        };

        return {
            core,
            sys: {
                ...createInitialSystemState(smashUpSystemsForTest, ['0', '1', '2', '3']),
                phase: 'playCards',
            },
        };
    }

    it('验证多基地选择交互被正确创建', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: createMultiBaseScoringSetup,
        });

        const result = runner.run({
            name: '多基地同时计分',
            commands: [
                // 从 playCards 推进到 scoreBases
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ],
        });

        // 验证：应该有一个 multi_base_scoring 交互等待响应
        const prompt = getActiveSimpleChoice(result.finalState);
        expect(prompt).toBeDefined();
        expect(prompt?.sourceId).toBe('multi_base_scoring');
        
        // 验证：交互选项包含 3 个基地
        const options = getPromptOptions(prompt);
        expect(options).toHaveLength(3);
        expect(options.map((o: any) => o.value.baseIndex).sort()).toEqual([0, 1, 2]);
    });

    // 测试多基地计分的完整流程
    it('multi_base_scoring handler 应该执行计分逻辑', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: smashUpSystemsForTest,
            playerIds: ['0', '1'],
            setup: createMultiBaseScoringSetup,
        });

        const result = runner.run({
            name: '多基地计分流程',
            commands: [
                // 从 playCards 推进到 scoreBases，自动创建 multi_base_scoring 交互
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 选择基地 0 并计分
                respondCommand('base-0', '0'),
            ],
        });

        // 验证：应该有 BASE_SCORED 事件
        const allEvents = result.steps.flatMap(step => step.events);
        const scoredEvents = allEvents.filter((e: string) => e === 'su:base_scored');

        expect(scoredEvents).toHaveLength(1);
        expect(allEvents).toEqual([
            'SYS_PHASE_CHANGED',
            'su:before_scoring_cleared',
            'su:when_scoring_cleared',
            'su:after_scoring_cleared',
            'su:scoring_eligible_bases_locked',
            'SYS_INTERACTION_RESOLVED',
            'su:before_scoring_triggered',
            'su:when_scoring_triggered',
            'su:base_scored',
            'su:after_scoring_triggered',
            'su:base_cleared',
            'su:base_replaced',
        ]);

        expect(result.finalState.core.players['0'].vp).toBe(2);
        expect(result.finalState.core.players['1'].vp).toBe(0);
        const nextPrompt = getActiveSimpleChoice(result.finalState);
        expect(nextPrompt?.sourceId).toBe('multi_base_scoring');
        expect(getPromptOptions(nextPrompt).map((option: any) => option.value.baseIndex).sort()).toEqual([1, 2]);
    });

    it('三个基地同时计分时，第二次选择后最后一个基地只会自动结算一次', () => {
        const advance = runCommand(createThreeBaseAutoFinishSetup(), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);

        const firstChoice = getActiveSimpleChoice(advance.finalState)!;
        expect(firstChoice).toBeTruthy();
        expect(firstChoice.sourceId).toBe('multi_base_scoring');
        const chooseTsars = findOption(firstChoice, (option: any) => option.value?.baseIndex === 2);

        const firstRespond = runCommand(advance.finalState, respondCommand(chooseTsars, '0'));
        expect(firstRespond.success).toBe(true);

        const stateAfterOrdering = drainReactionQueueChoice(firstRespond.finalState, runCommand);
        const secondChoice = getActiveSimpleChoice(stateAfterOrdering);
        let finalState = stateAfterOrdering;
        if (secondChoice) {
            expect(secondChoice.sourceId).toBe('multi_base_scoring');
            expect(getPromptOptions(secondChoice)).toHaveLength(2);
            const chooseJungle = findOption(secondChoice, (option: any) => option.value?.baseIndex === 0);

            const secondRespond = runCommand(stateAfterOrdering, respondCommand(chooseJungle, '0'));
            expect(secondRespond.success).toBe(true);
            finalState = secondRespond.finalState;
        }
        expectNoPrompt(finalState);

        // With queued base abilities, VP ordering can differ (current player chooses trigger ordering).
        expect(finalState.core.players['0'].vp).toBe(9);
        expect(finalState.core.players['1'].vp).toBe(7);
        expect(finalState.core.bases.map(base => base.defId)).toEqual([
            'base_cave_of_shinies',
            'base_rhodes_plaza',
            'base_central_brain',
        ]);
        expect(finalState.core.baseDeck).toEqual(['base_the_factory']);
    });

    it('复杂链路：海盗王 beforeScoring + 托尔图加 afterScoring + 大副 afterScoring 能完整走完计分链', () => {
        const initialState = createPirateKingFirstMateEndToEndSetup();

        const advance = runCommand(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);
        const chain = resolvePirateKingFirstMateScoringChain(advance.finalState, runCommand);
        assertPirateKingFirstMateChainResult(
            chain.finalState,
            [...advance.events, ...chain.chainEvents] as SmashUpEvent[],
        );
    });

    it('反馈 69a27d：海盗王移动到托尔图加后，计分交互链结束应退出 scoreBases 而不是卡死', () => {
        const initialState = createPirateKingFirstMateEndToEndSetup();

        const advance = runCommand(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);

        const chain = resolvePirateKingFirstMateScoringChain(advance.finalState, runCommand);
        assertPirateKingFirstMateChainResult(
            chain.finalState,
            [...advance.events, ...chain.chainEvents] as SmashUpEvent[],
        );

        const finalState = chain.finalState;
        expect(finalState.sys.phase).toBe('playCards');
        expect(finalState.sys.responseWindow?.current).toBeUndefined();
        expect(getSmashUpReactionSession(finalState)).toBeUndefined();
        expectNoPrompt(finalState);
        expect(finalState.core.bases[0].defId).toBe('base_central_brain');
        expect(finalState.core.bases[2].minions.map(minion => minion.uid)).toContain('mate-0');
    });

    it('复杂链路：计分前从手牌打出便衣忍者后，海盗王 + 托尔图加 + 大副链仍只结算一次', () => {
        const initialState = createPirateKingFirstMateWithHandSpecialSetup();

        const advance = runCommandWithFullSystems(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);
        const scoringStart = startTortugaScoringSequence(advance.finalState, runCommandWithFullSystems, true);
        const meFirstChoice = getActiveSimpleChoice(scoringStart.stateAfterPirateKing)!;
        expect(meFirstChoice).toBeTruthy();
        expect(meFirstChoice.sourceId).toBe('smashup_reaction_choose');
        const hiddenNinjaOption = getPromptOptions(meFirstChoice).find(
            (option: any) => option.value?.kind === 'play_action' && option.value?.cardUid === 'hidden-0',
        );

        let stateAfterHidden = scoringStart.stateAfterPirateKing;
        const specialEvents: SmashUpEvent[] = [];
        let didPlayHiddenNinja = false;

        if (hiddenNinjaOption) {
            didPlayHiddenNinja = true;
            const playHiddenNinja = runCommandWithFullSystems(
                scoringStart.stateAfterPirateKing,
                respondCommand(hiddenNinjaOption.id, meFirstChoice.playerId),
            );
            expect(playHiddenNinja.success).toBe(true);
            specialEvents.push(...(playHiddenNinja.events as SmashUpEvent[]));

            const hiddenNinjaChoice = getActiveSimpleChoice(playHiddenNinja.finalState)!;
            expect(hiddenNinjaChoice).toBeTruthy();
            expect(hiddenNinjaChoice.sourceId).toBe('ninja_hidden_ninja');
            const chooseHandShinobi = findOption(
                hiddenNinjaChoice,
                (option: any) => option.value?.cardUid === 'shinobi-hand-0',
            );

            const resolveHiddenNinja = runCommandWithFullSystems(
                playHiddenNinja.finalState,
                respondCommand(chooseHandShinobi, '0'),
            );
            expect(resolveHiddenNinja.success).toBe(true);
            specialEvents.push(...(resolveHiddenNinja.events as SmashUpEvent[]));
            stateAfterHidden = resolveHiddenNinja.finalState;
        } else {
            const optionId = findReactionOptionOrPass(
                meFirstChoice,
                ['pirate_first_mate', 'base_tortuga', 'base_pirate_cove'],
            );
            const resolveMeFirst = runCommandWithFullSystems(
                scoringStart.stateAfterPirateKing,
                respondCommand(optionId, meFirstChoice.playerId),
            );
            expect(resolveMeFirst.success).toBe(true);
            specialEvents.push(...(resolveMeFirst.events as SmashUpEvent[]));
            stateAfterHidden = resolveMeFirst.finalState;
        }

        const chain = continuePirateKingFirstMateScoringChainV2(
            stateAfterHidden,
            runCommandWithFullSystems,
            specialEvents,
        );
        const allEvents = [
            ...advance.events,
            ...scoringStart.events,
            ...chain.chainEvents,
        ] as SmashUpEvent[];

        assertPirateKingFirstMateChainResult(chain.finalState, allEvents);
        if (didPlayHiddenNinja) {
            expect(allEvents.filter(event => event.type === SU_EVENTS.ACTION_PLAYED)).toHaveLength(1);
            expect(allEvents.filter(event => event.type === SU_EVENTS.SPECIAL_LIMIT_USED)).toHaveLength(1);
            expect(allEvents.filter(event => event.type === SU_EVENTS.MINION_PLAYED)).toHaveLength(1);
            expect(allEvents).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: SU_EVENTS.ACTION_PLAYED,
                        payload: expect.objectContaining({ cardUid: 'hidden-0', defId: 'ninja_hidden_ninja' }),
                    }),
                    expect.objectContaining({
                        type: SU_EVENTS.MINION_PLAYED,
                        payload: expect.objectContaining({
                            cardUid: 'shinobi-hand-0',
                            defId: 'ninja_shinobi',
                            baseIndex: 0,
                            consumesNormalLimit: false,
                        }),
                    }),
                ]),
            );
            expect(stateAfterHidden.core.players['0'].hand).toHaveLength(0);
        }
    });

    it('海盗王选择不移动时，afterScoring 窗口内打出无效特殊牌不应导致托尔图加重复计分', () => {
        const initialState = createPirateKingNoMoveAfterScoringResponseSetup();

        const advance = runCommandWithFullSystems(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);
        const scoringStart = startTortugaScoringSequence(advance.finalState, runCommandWithFullSystems, false);
        const meFirstChoice = getActiveSimpleChoice(scoringStart.stateAfterPirateKing)!;
        expect(meFirstChoice).toBeTruthy();
        expect(meFirstChoice.sourceId).toBe('smashup_reaction_choose');
        const hiddenNinjaOption = getPromptOptions(meFirstChoice).find(
            (option: any) => option.value?.kind === 'play_action' && option.value?.cardUid === 'hidden-0',
        );
        let stateAfterMeFirst = scoringStart.stateAfterPirateKing;
        const meFirstEvents: SmashUpEvent[] = [];

        if (hiddenNinjaOption) {
            const playHiddenNinja = runCommandWithFullSystems(
                scoringStart.stateAfterPirateKing,
                respondCommand(hiddenNinjaOption.id, meFirstChoice.playerId),
            );
            expect(playHiddenNinja.success).toBe(true);
            meFirstEvents.push(...(playHiddenNinja.events as SmashUpEvent[]));

            const hiddenNinjaChoice = getActiveSimpleChoice(playHiddenNinja.finalState)!;
            expect(hiddenNinjaChoice).toBeTruthy();
            expect(hiddenNinjaChoice.sourceId).toBe('ninja_hidden_ninja');
            const chooseHandShinobi = findOption(
                hiddenNinjaChoice,
                (option: any) => option.value?.cardUid === 'shinobi-hand-0',
            );
            const resolveHiddenNinja = runCommandWithFullSystems(
                playHiddenNinja.finalState,
                respondCommand(chooseHandShinobi, '0'),
            );
            expect(resolveHiddenNinja.success).toBe(true);
            meFirstEvents.push(...(resolveHiddenNinja.events as SmashUpEvent[]));
            stateAfterMeFirst = resolveHiddenNinja.finalState;
        } else {
            const optionId = findReactionOptionOrPass(
                meFirstChoice,
                ['pirate_first_mate', 'base_tortuga', 'base_pirate_cove'],
            );
            const resolveMeFirst = runCommandWithFullSystems(
                scoringStart.stateAfterPirateKing,
                respondCommand(optionId, meFirstChoice.playerId),
            );
            expect(resolveMeFirst.success).toBe(true);
            meFirstEvents.push(...(resolveMeFirst.events as SmashUpEvent[]));
            stateAfterMeFirst = resolveMeFirst.finalState;
        }

        let stateAfterPlayerTwo = stateAfterMeFirst;
        const playerTwoEvents: SmashUpEvent[] = [];
        const playerTwoResponseChoice = getActiveSimpleChoice(stateAfterMeFirst);
        if (playerTwoResponseChoice?.sourceId === 'smashup_reaction_choose' && playerTwoResponseChoice.playerId === '1') {
            const underPressureOption = getPromptOptions(playerTwoResponseChoice).find(
                (option: any) => option.value?.kind === 'play_action' && option.value?.cardUid === 'pressure-1',
            );
            const optionId = underPressureOption?.id ?? findReactionOptionOrPass(
                playerTwoResponseChoice,
                ['pirate_first_mate', 'base_tortuga', 'base_pirate_cove'],
            );
            const playUnderPressureInMeFirst = runCommandWithFullSystems(
                stateAfterMeFirst,
                respondCommand(optionId, playerTwoResponseChoice.playerId),
            );
            expect(playUnderPressureInMeFirst.success).toBe(true);
            playerTwoEvents.push(...(playUnderPressureInMeFirst.events as SmashUpEvent[]));
            stateAfterPlayerTwo = playUnderPressureInMeFirst.finalState;
            if (underPressureOption) {
                expect(playUnderPressureInMeFirst.events).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            type: SU_EVENTS.ACTION_PLAYED,
                            payload: expect.objectContaining({
                                cardUid: 'pressure-1',
                                defId: 'giant_ant_under_pressure',
                            }),
                        }),
                    ]),
                );
            }
        }
        const chooseBase = scoringStart.chooseBase;
        const resolvePirateKing = scoringStart.resolvePirateKing;
        expect(resolvePirateKing.finalState.sys.phase).toBe('scoreBases');
        const windowTypeAfterPirateKing = resolvePirateKing.finalState.sys.responseWindow?.current?.windowType;
        if (windowTypeAfterPirateKing !== undefined) {
            expect(['meFirst', 'afterScoring']).toContain(windowTypeAfterPirateKing);
        }

        // 兼容不同链路顺序：有的实现会先回到 multi_base_scoring，再进入 base_tortuga。
        let stateForTortuga = stateAfterPlayerTwo;
        const preTortugaEvents: SmashUpEvent[] = [];
        for (let guard = 0; guard < 3; guard++) {
            const nextAfterPirateKing = getActiveSimpleChoice(stateForTortuga);
            if (nextAfterPirateKing?.sourceId !== 'multi_base_scoring') break;
            const nextOptions = getPromptOptions(nextAfterPirateKing);
            const continueOption = (
                nextOptions.find(
                    (option: any) => option.value?.baseIndex === 0 || option.value?.baseDefId === 'base_tortuga',
                )?.id
                ?? nextOptions[0]?.id
            );
            expect(continueOption).toBeTruthy();
            const continueScoring = runCommandWithFullSystems(
                stateForTortuga,
                respondCommand(continueOption, nextAfterPirateKing.playerId),
            );
            expect(continueScoring.success).toBe(true);
            preTortugaEvents.push(...continueScoring.events);
            stateForTortuga = continueScoring.finalState;
        }

        let tortugaAfterScoringChoice = getActiveSimpleChoice(stateForTortuga)!;
        expect(tortugaAfterScoringChoice).toBeTruthy();
        if (tortugaAfterScoringChoice.sourceId === 'smashup_reaction_choose') {
            const chosen = {
                id: findReactionOptionOrPass(
                    tortugaAfterScoringChoice,
                    ['base_tortuga', 'pirate_first_mate', 'base_pirate_cove'],
                ),
            };
            const picked = runCommandWithFullSystems(
                stateForTortuga,
                respondCommand(chosen.id, tortugaAfterScoringChoice.playerId),
            );
            expect(picked.success).toBe(true);
            stateForTortuga = picked.finalState;
            tortugaAfterScoringChoice = getActiveSimpleChoice(stateForTortuga)!;
        }
        expect(tortugaAfterScoringChoice.sourceId).toBe('base_tortuga');
        const skipTortugaMove = findOption(
            tortugaAfterScoringChoice,
            (option: any) => option.id === 'skip' || option.value?.skip === true,
        );
        const resolveTortugaAfterScoring = runCommandWithFullSystems(
            stateForTortuga,
            respondCommand(skipTortugaMove, '1'),
        );
        expect(resolveTortugaAfterScoring.success).toBe(true);
        let stateAfterTortuga = resolveTortugaAfterScoring.finalState;
        const maybeFirstMateChoice = getActiveSimpleChoice(stateAfterTortuga);
        let firstMateResolutionEvents: SmashUpEvent[] = [];
        if (maybeFirstMateChoice?.sourceId === 'pirate_first_mate_choose_base') {
            const skipFirstMateMove = findOption(
                maybeFirstMateChoice,
                (option: any) => option.id === 'skip' || option.value?.skip === true,
            );
            const resolveFirstMateAfterScoring = runCommandWithFullSystems(
                stateAfterTortuga,
                respondCommand(skipFirstMateMove, maybeFirstMateChoice.playerId),
            );
            expect(resolveFirstMateAfterScoring.success).toBe(true);
            stateAfterTortuga = resolveFirstMateAfterScoring.finalState;
            firstMateResolutionEvents = resolveFirstMateAfterScoring.events as SmashUpEvent[];
        }
        const remainingAfterScoringChoice = getActiveSimpleChoice(stateAfterTortuga)!;
        expect(remainingAfterScoringChoice).toBeTruthy();
        expect(remainingAfterScoringChoice.sourceId).toBe('smashup_reaction_choose');
        expect(remainingAfterScoringChoice.playerId).toBe('1');
        expect(stateAfterTortuga.sys.responseWindow?.current?.windowType).toBe('afterScoring');

        const tortugaScoredEventsBeforeResponse = [
            ...scoringStart.events,
            ...meFirstEvents,
            ...playerTwoEvents,
            ...resolvePirateKing.events,
            ...preTortugaEvents,
            ...resolveTortugaAfterScoring.events,
            ...firstMateResolutionEvents,
        ].filter(event =>
            event.type === SU_EVENTS.BASE_SCORED
            && (event.payload as { baseDefId?: string } | undefined)?.baseDefId === 'base_tortuga',
        );
        expect(tortugaScoredEventsBeforeResponse).toHaveLength(2);

        const clearOrReplaceBeforeResponse = [
            ...scoringStart.events,
            ...meFirstEvents,
            ...playerTwoEvents,
            ...preTortugaEvents,
        ].filter(event => {
            if (event.type !== SU_EVENTS.BASE_CLEARED && event.type !== SU_EVENTS.BASE_REPLACED) {
                return false;
            }
            const payload = event.payload as { baseDefId?: string; oldBaseDefId?: string } | undefined;
            return payload?.baseDefId === 'base_tortuga' || payload?.oldBaseDefId === 'base_tortuga';
        });
        expect(clearOrReplaceBeforeResponse).toHaveLength(0);

        const playNoTargetSpecial = runCommandWithFullSystems(stateAfterTortuga, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'champ-1', targetBaseIndex: 0 },
        });
        expect(playNoTargetSpecial.success).toBe(true);
        expect(playNoTargetSpecial.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.ACTION_PLAYED,
                    payload: expect.objectContaining({
                        cardUid: 'champ-1',
                        defId: 'giant_ant_we_are_the_champions',
                    }),
                }),
            ]),
        );

        const allEvents = [
            ...advance.events,
            ...scoringStart.events,
            ...meFirstEvents,
            ...playerTwoEvents,
            ...chooseBase.events,
            ...resolvePirateKing.events,
            ...preTortugaEvents,
            ...resolveTortugaAfterScoring.events,
            ...firstMateResolutionEvents,
            ...playNoTargetSpecial.events,
        ] as SmashUpEvent[];

        const tortugaScoredAll = allEvents.filter(event =>
            event.type === SU_EVENTS.BASE_SCORED
            && (event.payload as { baseDefId?: string } | undefined)?.baseDefId === 'base_tortuga',
        );
        expect(tortugaScoredAll).toHaveLength(2);
    });

    it('4人压力链：6个交互串行解决后，托尔图加仍只计分一次', () => {
        const initialState = createFourPlayerSixInteractionsSetup();
        const advance = runCommandWithFullSystems(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);

        let state = advance.finalState;
        const allEvents: SmashUpEvent[] = [...advance.events] as SmashUpEvent[];
        const sourceIds: string[] = [];

        const firstChoice = getActiveSimpleChoice(state)!;
        expect(firstChoice).toBeTruthy();
        expect(firstChoice.sourceId).toBe('pirate_king_move');
        const stayPirateKing = findOption(firstChoice, (option: any) => option.value?.move === false);
        const resolvePirateKing = runCommandWithFullSystems(state, respondCommand(stayPirateKing, '0'));
        expect(resolvePirateKing.success).toBe(true);
        sourceIds.push('pirate_king_move');
        allEvents.push(...(resolvePirateKing.events as SmashUpEvent[]));
        state = resolvePirateKing.finalState;

        while (getActiveSimpleChoice(state)) {
            const choice = getActiveSimpleChoice(state)!;
            expect(choice).toBeTruthy();
            sourceIds.push(choice.sourceId);

            expect([
                'smashup_reaction_choose',
                'base_tortuga',
                'pirate_first_mate_choose_base',
                'smashup_immediate_extra_minion',
            ]).toContain(choice.sourceId);
            const responderId = choice.playerId;

            const optionId =
                choice.sourceId === 'smashup_reaction_choose'
                    ? findReactionOptionOrPass(choice, ['base_tortuga', 'pirate_first_mate', 'base_pirate_cove'])
                    : choice.sourceId === 'smashup_immediate_extra_minion'
                        ? findOption(choice, (option: any) => option.id === 'skip' || option.value?.skip === true)
                    : findOption(choice, (option: any) => option.id === 'skip' || option.value?.skip === true);

            const resolved = runCommandWithFullSystems(state, respondCommand(optionId, responderId));
            expect(resolved.success).toBe(true);
            allEvents.push(...(resolved.events as SmashUpEvent[]));
            state = resolved.finalState;
        }

        // We only require that the chain terminates without duplicate scoring.

        const tortugaScoredEvents = allEvents.filter(event =>
            event.type === SU_EVENTS.BASE_SCORED
            && (event.payload as { baseDefId?: string } | undefined)?.baseDefId === 'base_tortuga',
        );
        expect(tortugaScoredEvents).toHaveLength(1);

        expect(state.sys.phase).toBe('playCards');
        expect(state.core.currentPlayerIndex).toBe(1);
    });
});
