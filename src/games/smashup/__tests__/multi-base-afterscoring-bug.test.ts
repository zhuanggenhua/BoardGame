/**
 * 测试多个基地同时计分时 afterScoring 触发问题
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
import { asSimpleChoice, INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { makeMinion, makeBase, makePlayer, makeCard } from './helpers';
import { smashUpSystemsForTest } from '../game';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { defaultTestRandom, runCommand } from './testRunner';

function findOption(choice: any, predicate: (opt: any) => boolean): string {
    const option = choice.options.find(predicate);
    if (!option) {
        throw new Error(`找不到匹配的选项: ${JSON.stringify(choice.options.map((item: any) => item.id))}`);
    }
    return option.id;
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

function resolvePirateKingFirstMateScoringChain(
    stateWithMultiBaseChoice: MatchState<SmashUpCore>,
    runner: CommandRunner,
) {
    const multiBaseChoice = asSimpleChoice(stateWithMultiBaseChoice.sys.interaction?.current)!;
    expect(multiBaseChoice).toBeTruthy();
    expect(multiBaseChoice.sourceId).toBe('multi_base_scoring');
    const chooseTortuga = findOption(multiBaseChoice, (option: any) => option.value?.baseIndex === 0);

    const chooseBase = runner(stateWithMultiBaseChoice, {
        type: 'SYS_INTERACTION_RESPOND',
        playerId: '0',
        payload: { optionId: chooseTortuga },
    });
    expect(chooseBase.success).toBe(true);

    const pirateKingChoice = asSimpleChoice(chooseBase.finalState.sys.interaction?.current)!;
    expect(pirateKingChoice).toBeTruthy();
    expect(pirateKingChoice.sourceId).toBe('pirate_king_move');
    const movePirateKing = findOption(pirateKingChoice, (option: any) => option.value?.move === true);

    const resolvePirateKing = runner(chooseBase.finalState, {
        type: 'SYS_INTERACTION_RESPOND',
        playerId: '0',
        payload: { optionId: movePirateKing },
    });
    expect(resolvePirateKing.success).toBe(true);

    const tortugaChoice = asSimpleChoice(resolvePirateKing.finalState.sys.interaction?.current)!;
    expect(tortugaChoice).toBeTruthy();
    expect(tortugaChoice.sourceId).toBe('base_tortuga');
    const chooseReserveMinion = findOption(
        tortugaChoice,
        (option: any) => option.value?.minionUid === 'reserve-p1' && option.value?.fromBaseIndex === 2,
    );

    const resolveTortuga = runner(resolvePirateKing.finalState, {
        type: 'SYS_INTERACTION_RESPOND',
        playerId: '1',
        payload: { optionId: chooseReserveMinion },
    });
    expect(resolveTortuga.success).toBe(true);

    const firstMateChoice = asSimpleChoice(resolveTortuga.finalState.sys.interaction?.current)!;
    expect(firstMateChoice).toBeTruthy();
    expect(firstMateChoice.sourceId).toBe('pirate_first_mate_choose_base');
    const moveFirstMate = findOption(firstMateChoice, (option: any) => option.value?.baseIndex === 2);

    const resolveFirstMate = runner(resolveTortuga.finalState, {
        type: 'SYS_INTERACTION_RESPOND',
        playerId: '0',
        payload: { optionId: moveFirstMate },
    });
    expect(resolveFirstMate.success).toBe(true);

    return {
        chooseBase,
        resolvePirateKing,
        resolveTortuga,
        resolveFirstMate,
        finalState: resolveFirstMate.finalState,
        chainEvents: [
            ...chooseBase.events,
            ...resolvePirateKing.events,
            ...resolveTortuga.events,
            ...resolveFirstMate.events,
        ],
    };
}

function assertPirateKingFirstMateChainResult(
    finalState: MatchState<SmashUpCore>,
    allEvents: SmashUpEvent[],
) {
    const scoredBaseDefIds = allEvents
        .filter(event => event.type === SU_EVENTS.BASE_SCORED)
        .map(event => (event.payload as { baseDefId: string }).baseDefId);

    expect(finalState.sys.interaction?.current).toBeFalsy();
    expect(finalState.sys.phase).toBe('playCards');
    expect(finalState.core.currentPlayerIndex).toBe(1);

    expect(allEvents.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(2);
    expect(scoredBaseDefIds).toEqual(['base_tortuga', 'base_the_jungle']);
    expect(allEvents.filter(event => event.type === SU_EVENTS.BASE_CLEARED)).toHaveLength(2);
    expect(allEvents.filter(event => event.type === SU_EVENTS.BASE_REPLACED)).toHaveLength(2);
    expect(allEvents.filter(event => event.type === SU_EVENTS.MINION_MOVED)).toHaveLength(3);

    expect(finalState.core.players['0'].vp).toBe(6);
    expect(finalState.core.players['1'].vp).toBe(3);
    expect(finalState.core.bases.map(base => base.defId)).toEqual([
        'base_central_brain',
        'base_cave_of_shinies',
        'base_secret_garden',
    ]);
    expect(finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['reserve-p1']);
    expect(finalState.core.bases[1].minions).toHaveLength(0);
    expect(finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual(['mate-0']);
    const remainingMinionUids = finalState.core.bases.flatMap(base => base.minions.map(minion => minion.uid));
    expect(remainingMinionUids).not.toContain('king-0');
    expect(remainingMinionUids).not.toContain('jungle-p0');
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
        expect(result.finalState.sys.interaction?.current).toBeDefined();
        expect((result.finalState.sys.interaction?.current?.data as any)?.sourceId).toBe('multi_base_scoring');
        
        // 验证：交互选项包含 3 个基地
        const options = (result.finalState.sys.interaction?.current?.data as any)?.options as any[];
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
                { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'base-0' } },
            ],
        });

        // 验证：应该有 BASE_SCORED 事件
        const allEvents = result.steps.flatMap(step => step.events);
        const scoredEvents = allEvents.filter((e: string) => e === 'su:base_scored');
        
        console.log('=== Handler 测试结果 ===');
        console.log('BASE_SCORED 事件数量:', scoredEvents.length);
        console.log('所有事件:', allEvents);
        console.log('玩家分数:', {
            p0: result.finalState.core.players['0'].vp,
            p1: result.finalState.core.players['1'].vp,
        });
        
        // 至少应该有 1 个基地被计分
        expect(scoredEvents.length).toBeGreaterThanOrEqual(1);
        
        // 验证：玩家应该获得了分数
        const p0Score = result.finalState.core.players['0'].vp;
        const p1Score = result.finalState.core.players['1'].vp;
        expect(p0Score + p1Score).toBeGreaterThan(0);
    });

    it('三个基地同时计分时，第二次选择后最后一个基地只会自动结算一次', () => {
        const advance = runCommand(createThreeBaseAutoFinishSetup(), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);

        const firstChoice = asSimpleChoice(advance.finalState.sys.interaction?.current)!;
        expect(firstChoice).toBeTruthy();
        expect(firstChoice.sourceId).toBe('multi_base_scoring');
        const chooseTsars = findOption(firstChoice, (option: any) => option.value?.baseIndex === 2);

        const firstRespond = runCommand(advance.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: chooseTsars },
        });
        expect(firstRespond.success).toBe(true);

        const secondChoice = asSimpleChoice(firstRespond.finalState.sys.interaction?.current)!;
        expect(secondChoice).toBeTruthy();
        expect(secondChoice.sourceId).toBe('multi_base_scoring');
        expect(secondChoice.options).toHaveLength(2);
        const chooseJungle = findOption(secondChoice, (option: any) => option.value?.baseIndex === 0);

        const secondRespond = runCommand(firstRespond.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: chooseJungle },
        });
        expect(secondRespond.success).toBe(true);
        expect(secondRespond.finalState.sys.interaction?.current).toBeFalsy();

        expect(secondRespond.finalState.core.players['0'].vp).toBe(9);
        expect(secondRespond.finalState.core.players['1'].vp).toBe(7);
        expect(secondRespond.finalState.core.bases.map(base => base.defId)).toEqual([
            'base_cave_of_shinies',
            'base_rhodes_plaza',
            'base_central_brain',
        ]);
        expect(secondRespond.finalState.core.baseDeck).toEqual(['base_the_factory']);
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

    it('复杂链路：计分前从手牌打出便衣忍者后，海盗王 + 托尔图加 + 大副链仍只结算一次', () => {
        const initialState = createPirateKingFirstMateWithHandSpecialSetup();

        const advance = runCommandWithFullSystems(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.responseWindow?.current?.windowType).toBe('meFirst');
        expect(advance.finalState.sys.interaction?.current).toBeFalsy();

        const playHiddenNinja = runCommandWithFullSystems(advance.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hidden-0', targetBaseIndex: 0 },
        });
        expect(playHiddenNinja.success).toBe(true);

        const hiddenNinjaChoice = asSimpleChoice(playHiddenNinja.finalState.sys.interaction?.current)!;
        expect(hiddenNinjaChoice).toBeTruthy();
        expect(hiddenNinjaChoice.sourceId).toBe('ninja_hidden_ninja');
        const chooseHandShinobi = findOption(
            hiddenNinjaChoice,
            (option: any) => option.value?.cardUid === 'shinobi-hand-0',
        );

        const resolveHiddenNinja = runCommandWithFullSystems(playHiddenNinja.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseHandShinobi },
        });
        expect(resolveHiddenNinja.success).toBe(true);
        expect(resolveHiddenNinja.finalState.sys.responseWindow?.current).toBeFalsy();

        const chain = resolvePirateKingFirstMateScoringChain(resolveHiddenNinja.finalState, runCommandWithFullSystems);
        const allEvents = [
            ...advance.events,
            ...playHiddenNinja.events,
            ...resolveHiddenNinja.events,
            ...chain.chainEvents,
        ] as SmashUpEvent[];

        assertPirateKingFirstMateChainResult(chain.finalState, allEvents);
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
        expect(resolveHiddenNinja.finalState.core.players['0'].hand).toHaveLength(0);
    });

    it('海盗王选择不移动时，afterScoring 窗口内打出无效特殊牌不应导致托尔图加重复计分', () => {
        const initialState = createPirateKingNoMoveAfterScoringResponseSetup();

        const advance = runCommandWithFullSystems(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
        });
        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.responseWindow?.current?.windowType).toBe('meFirst');

        const playHiddenNinja = runCommandWithFullSystems(advance.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hidden-0', targetBaseIndex: 0 },
        });
        expect(playHiddenNinja.success).toBe(true);

        const hiddenNinjaChoice = asSimpleChoice(playHiddenNinja.finalState.sys.interaction?.current)!;
        expect(hiddenNinjaChoice).toBeTruthy();
        expect(hiddenNinjaChoice.sourceId).toBe('ninja_hidden_ninja');
        const chooseHandShinobi = findOption(
            hiddenNinjaChoice,
            (option: any) => option.value?.cardUid === 'shinobi-hand-0',
        );
        const resolveHiddenNinja = runCommandWithFullSystems(playHiddenNinja.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseHandShinobi },
        });
        expect(resolveHiddenNinja.success).toBe(true);
        expect(resolveHiddenNinja.finalState.sys.responseWindow?.current?.windowType).toBe('meFirst');

        const playUnderPressureInMeFirst = runCommandWithFullSystems(resolveHiddenNinja.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'pressure-1', targetBaseIndex: 1 },
        });
        expect(playUnderPressureInMeFirst.success).toBe(true);
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
        expect(playUnderPressureInMeFirst.finalState.sys.responseWindow?.current).toBeFalsy();

        const multiBaseChoice = asSimpleChoice(playUnderPressureInMeFirst.finalState.sys.interaction?.current)!;
        expect(multiBaseChoice).toBeTruthy();
        expect(multiBaseChoice.sourceId).toBe('multi_base_scoring');
        const chooseTortuga = findOption(multiBaseChoice, (option: any) => option.value?.baseIndex === 0);
        const chooseBase = runCommandWithFullSystems(playUnderPressureInMeFirst.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseTortuga },
        });
        expect(chooseBase.success).toBe(true);

        const pirateKingChoice = asSimpleChoice(chooseBase.finalState.sys.interaction?.current)!;
        expect(pirateKingChoice).toBeTruthy();
        expect(pirateKingChoice.sourceId).toBe('pirate_king_move');
        const stayOption = findOption(pirateKingChoice, (option: any) => option.value?.move === false);
        const resolvePirateKing = runCommandWithFullSystems(chooseBase.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: stayOption },
        });
        expect(resolvePirateKing.success).toBe(true);
        expect(resolvePirateKing.finalState.sys.phase).toBe('scoreBases');
        expect(resolvePirateKing.finalState.sys.responseWindow?.current?.windowType).toBe('afterScoring');

        const tortugaAfterScoringChoice = asSimpleChoice(resolvePirateKing.finalState.sys.interaction?.current)!;
        expect(tortugaAfterScoringChoice).toBeTruthy();
        expect(tortugaAfterScoringChoice.sourceId).toBe('base_tortuga');
        const skipTortugaMove = findOption(
            tortugaAfterScoringChoice,
            (option: any) => option.id === 'skip' || option.value?.skip === true,
        );
        const resolveTortugaAfterScoring = runCommandWithFullSystems(resolvePirateKing.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            payload: { optionId: skipTortugaMove },
        });
        expect(resolveTortugaAfterScoring.success).toBe(true);

        const firstMateAfterScoringChoice = asSimpleChoice(resolveTortugaAfterScoring.finalState.sys.interaction?.current)!;
        expect(firstMateAfterScoringChoice).toBeTruthy();
        expect(firstMateAfterScoringChoice.sourceId).toBe('pirate_first_mate_choose_base');
        const skipFirstMateMove = findOption(
            firstMateAfterScoringChoice,
            (option: any) => option.id === 'skip' || option.value?.skip === true,
        );
        const resolveFirstMateAfterScoring = runCommandWithFullSystems(resolveTortugaAfterScoring.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: skipFirstMateMove },
        });
        expect(resolveFirstMateAfterScoring.success).toBe(true);
        expect(resolveFirstMateAfterScoring.finalState.sys.interaction?.current).toBeFalsy();
        expect(resolveFirstMateAfterScoring.finalState.sys.responseWindow?.current?.windowType).toBe('afterScoring');

        const tortugaScoredEventsBeforeResponse = resolvePirateKing.events.filter(event =>
            event.type === SU_EVENTS.BASE_SCORED
            && (event.payload as { baseDefId?: string } | undefined)?.baseDefId === 'base_tortuga',
        );
        expect(tortugaScoredEventsBeforeResponse).toHaveLength(1);

        const clearOrReplaceBeforeResponse = resolvePirateKing.events.filter(event => {
            if (event.type !== SU_EVENTS.BASE_CLEARED && event.type !== SU_EVENTS.BASE_REPLACED) {
                return false;
            }
            const payload = event.payload as { baseDefId?: string; oldBaseDefId?: string } | undefined;
            return payload?.baseDefId === 'base_tortuga' || payload?.oldBaseDefId === 'base_tortuga';
        });
        expect(clearOrReplaceBeforeResponse).toHaveLength(0);

        const playNoTargetSpecial = runCommandWithFullSystems(resolveFirstMateAfterScoring.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'champ-1', targetBaseIndex: 0 },
        });
        expect(playNoTargetSpecial.success).toBe(true);

        const allEvents = [
            ...advance.events,
            ...playHiddenNinja.events,
            ...resolveHiddenNinja.events,
            ...playUnderPressureInMeFirst.events,
            ...chooseBase.events,
            ...resolvePirateKing.events,
            ...resolveTortugaAfterScoring.events,
            ...resolveFirstMateAfterScoring.events,
            ...playNoTargetSpecial.events,
        ] as SmashUpEvent[];

        const tortugaScoredAll = allEvents.filter(event =>
            event.type === SU_EVENTS.BASE_SCORED
            && (event.payload as { baseDefId?: string } | undefined)?.baseDefId === 'base_tortuga',
        );
        expect(tortugaScoredAll).toHaveLength(1);
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

        const firstChoice = asSimpleChoice(state.sys.interaction?.current)!;
        expect(firstChoice).toBeTruthy();
        expect(firstChoice.sourceId).toBe('pirate_king_move');
        const stayPirateKing = findOption(firstChoice, (option: any) => option.value?.move === false);
        const resolvePirateKing = runCommandWithFullSystems(state, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: stayPirateKing },
        });
        expect(resolvePirateKing.success).toBe(true);
        sourceIds.push('pirate_king_move');
        allEvents.push(...(resolvePirateKing.events as SmashUpEvent[]));
        state = resolvePirateKing.finalState;

        while (state.sys.interaction?.current) {
            const choice = asSimpleChoice(state.sys.interaction.current)!;
            expect(choice).toBeTruthy();
            sourceIds.push(choice.sourceId);

            expect(['base_tortuga', 'pirate_first_mate_choose_base']).toContain(choice.sourceId);
            const skipOptionId = findOption(
                choice,
                (option: any) => option.id === 'skip' || option.value?.skip === true,
            );
            const responderId = state.sys.interaction.current.playerId;
            const resolved = runCommandWithFullSystems(state, {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: responderId,
                payload: { optionId: skipOptionId },
            });
            expect(resolved.success).toBe(true);
            allEvents.push(...(resolved.events as SmashUpEvent[]));
            state = resolved.finalState;
        }

        expect(sourceIds.filter(id => id === 'base_tortuga')).toHaveLength(1);
        expect(sourceIds.filter(id => id === 'pirate_first_mate_choose_base')).toHaveLength(4);
        expect(sourceIds).toHaveLength(6);

        const tortugaScoredEvents = allEvents.filter(event =>
            event.type === SU_EVENTS.BASE_SCORED
            && (event.payload as { baseDefId?: string } | undefined)?.baseDefId === 'base_tortuga',
        );
        expect(tortugaScoredEvents).toHaveLength(1);

        expect(state.sys.phase).toBe('playCards');
        expect(state.core.currentPlayerIndex).toBe(1);
    });
});
