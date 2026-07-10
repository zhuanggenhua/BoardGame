import { buildAiDecisionContext } from '../../../engine/ai';
import { resolveNextLocalAiAction } from '../../../engine/ai/localRunner';
import { createReplayAdapter } from '../../../engine/adapter';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import {
    BETRAYAL_AI_ACTION_KINDS,
} from '../ai';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    betrayalAiRuntime,
    engineConfig,
    type BetrayalCommand,
    type BetrayalCore,
} from '../game';
import { BETRAYAL_MANIFEST } from '../manifest';
import {
    applyBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioReadyToExorciseCore,
    createFirstScenarioReadyToLearnAboutJackCore,
    createFirstScenarioReadyToStudyExorcismCore,
    createFirstScenarioReadyToTraitorVictoryCore,
    createHeroAttackTraitorReadyCore,
    createStartedFirstScenarioCore,
} from '../testing/firstScenarioTestUtils';

function stateOf(core: BetrayalCore, seed = 'betrayal-ai-test'): MatchState<BetrayalCore> {
    const adapter = createReplayAdapter(BetrayalDomain, seed);
    return {
        ...adapter.setup(core.playerIds),
        core,
    };
}

function buildContext(state: MatchState<BetrayalCore>, playerId: string) {
    return buildAiDecisionContext({
        gameId: 'betrayal',
        matchId: 'betrayal-ai-test',
        playerId,
        visibleState: state,
        rulesVersion: null,
        decisionBudgetMs: 250,
        source: 'local',
        seatController: { type: 'local-ai', minimumActionDelayMs: 0 },
    });
}

function buildActions(state: MatchState<BetrayalCore>, playerId: string) {
    return betrayalAiRuntime.buildLegalActions({ playerId, state });
}

function applyAiResolution(
    state: MatchState<BetrayalCore>,
    resolution: NonNullable<Awaited<ReturnType<typeof resolveNextLocalAiAction>>>,
    random: RandomFn = createBetrayalScriptedRandom(),
): MatchState<BetrayalCore> {
    return resolution.action.commands.reduce((nextState, command) => executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems,
        },
        nextState,
        {
            type: command.type,
            playerId: resolution.playerId,
            payload: command.payload,
            timestamp: 100,
        } as BetrayalCommand,
        random,
        nextState.core.playerIds,
    ).state, state);
}

describe('小黑屋本地 AI', () => {
    test('manifest 开启本地 AI，默认把其余座位设为 AI，远程 AI 保持关闭', () => {
        expect(BETRAYAL_MANIFEST.ai).toEqual({
            capture: true,
            localAi: true,
            remoteAi: false,
            defaultLocalAiSeats: 'all-opponents',
        });
    });

    test('选角阶段只生成未被占用的探索者，并在选中后确认', () => {
        const adapter = createReplayAdapter(BetrayalDomain, 'betrayal-ai-character-select');
        let state = adapter.setup(['0', '1', '2']);
        state = adapter.execute(state, {
            type: BETRAYAL_COMMANDS.SELECT_EXPLORER,
            playerId: '0',
            payload: { explorerId: 'jaden-jones' },
            timestamp: 1,
        }).state;

        const selectActions = buildActions(state, '1');
        expect(selectActions.length).toBeGreaterThan(0);
        expect(selectActions.every((action) => action.kind === BETRAYAL_AI_ACTION_KINDS.SELECT_EXPLORER)).toBe(true);
        expect(selectActions.some((action) => action.metadata?.explorerId === 'jaden-jones')).toBe(false);

        const selectedAction = selectActions[0]!;
        state = adapter.execute(state, {
            type: selectedAction.commands[0]!.type,
            playerId: '1',
            payload: selectedAction.commands[0]!.payload,
            timestamp: 2,
        }).state;

        expect(buildActions(state, '1'))
            .toHaveLength(1);
        expect(buildActions(state, '1')[0]?.kind)
            .toBe(BETRAYAL_AI_ACTION_KINDS.CONFIRM_EXPLORER);
    });

    test('非当前 AI 不会生成运行时动作', () => {
        const state = stateOf(createStartedFirstScenarioCore());

        expect(buildActions(state, '1')).toEqual([]);
    });

    test('待处理事件选择只生成领域校验通过的动作', () => {
        const core = createStartedFirstScenarioCore();
        core.pendingEventChoice = {
            id: 'ai-choice',
            playerId: '0',
            sourceTitle: '选择属性',
            effect: {
                mode: 'chooseTraitRoll',
                prompt: '选择一个属性',
                allowedTraits: ['knowledge', 'sanity'],
                branches: [{
                    min: 0,
                    label: '完成',
                    effect: { mode: 'none', recommendedAction: 'endTurn' },
                }],
                recommendedAction: 'endTurn',
            },
        };
        const state = stateOf(core);
        const actions = buildActions(state, '0');

        expect(actions.map((action) => action.metadata?.trait)).toEqual(['knowledge', 'sanity']);
        for (const action of actions) {
            const command = action.commands[0]!;
            expect(BetrayalDomain.validate(state, {
                type: command.type,
                playerId: '0',
                payload: command.payload,
                timestamp: 1,
            } as never).valid).toBe(true);
        }
    });

    test('英雄 AI 在图书馆优先调查杰克', () => {
        const state = stateOf(createFirstScenarioReadyToLearnAboutJackCore());
        const actions = buildActions(state, '0');

        expect(actions.some((action) => action.kind === BETRAYAL_AI_ACTION_KINDS.LEARN_ABOUT_JACK)).toBe(true);
        expect(betrayalAiRuntime.localPolicies?.baseline.decide(buildContext(state, '0'))?.actionId)
            .toBe(BETRAYAL_AI_ACTION_KINDS.LEARN_ABOUT_JACK);
    });

    test('英雄 AI 在事件房间优先研究驱魔法阵', () => {
        const state = stateOf(createFirstScenarioReadyToStudyExorcismCore());
        const actions = buildActions(state, '0');

        expect(actions.some((action) => action.kind === BETRAYAL_AI_ACTION_KINDS.STUDY_EXORCISM)).toBe(true);
        expect(betrayalAiRuntime.localPolicies?.baseline.decide(buildContext(state, '0'))?.actionId)
            .toBe(BETRAYAL_AI_ACTION_KINDS.STUDY_EXORCISM);
    });

    test('英雄 AI 在两处法阵完成后会驱魔并进入英雄终局', async () => {
        const state = stateOf(createFirstScenarioReadyToExorciseCore());
        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'betrayal-ai-exorcise-finish',
            seatControllers: {
                '0': { type: 'local-ai', minimumActionDelayMs: 0 },
                '1': { type: 'human' },
                '2': { type: 'human' },
            },
        });

        expect(resolution?.action.kind).toBe(BETRAYAL_AI_ACTION_KINDS.EXORCISE_JACK);
        expect(resolution).not.toBeNull();
        if (!resolution) return;

        const nextState = applyAiResolution(
            state,
            resolution,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );
        expect(nextState.core.phase).toBe('endgame');
        expect(nextState.core.endgameResult?.outcome).toBe('survivors');
    });

    test('叛徒 AI 与英雄同房时优先攻击英雄', () => {
        const state = stateOf(createFirstScenarioReadyToTraitorVictoryCore());
        const actions = buildActions(state, '2');

        expect(actions.some((action) => action.kind === BETRAYAL_AI_ACTION_KINDS.TRAITOR_ATTACK_HERO)).toBe(true);
        expect(betrayalAiRuntime.localPolicies?.baseline.decide(buildContext(state, '2'))?.actionId)
            .toMatch(/^traitor-attack-hero:/);
    });

    test('叛徒死亡后轮到其行动时会生成杰克之灵移动动作', () => {
        let core = createHeroAttackTraitorReadyCore();
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        const state = stateOf(core);
        const actions = buildActions(state, '2');

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(actions.some((action) => action.kind === BETRAYAL_AI_ACTION_KINDS.MOVE_TO_ROOM)).toBe(true);
        expect(actions.some((action) => action.kind === BETRAYAL_AI_ACTION_KINDS.END_TURN)).toBe(true);
    });

    test('公共 AI runner 能在英雄目标状态解析出真实命令', async () => {
        const state = stateOf(createFirstScenarioReadyToLearnAboutJackCore());
        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'betrayal-ai-runner-test',
            seatControllers: {
                '0': { type: 'local-ai', minimumActionDelayMs: 0 },
                '1': { type: 'human' },
                '2': { type: 'human' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe(BETRAYAL_AI_ACTION_KINDS.LEARN_ABOUT_JACK);
        expect(resolution?.action.commands[0]?.type).toBe(BETRAYAL_COMMANDS.LEARN_ABOUT_JACK);
    });

    test('公共 AI runner 能连续执行恶兆前动作并把回合交给下一位玩家', async () => {
        let state = stateOf(createStartedFirstScenarioCore(), 'betrayal-ai-continuous-turn');
        const initialPlayerId = state.core.currentPlayer;
        const seenActionKinds: string[] = [];
        const seatControllers = {
            '0': { type: 'local-ai' as const, minimumActionDelayMs: 0 },
            '1': { type: 'human' as const },
            '2': { type: 'human' as const },
        };

        for (let step = 0; step < 8 && state.core.currentPlayer === initialPlayerId; step += 1) {
            const resolution = await resolveNextLocalAiAction({
                engineConfig,
                state,
                matchId: `betrayal-ai-continuous-turn-${step}`,
                seatControllers,
            });

            expect(resolution).not.toBeNull();
            if (!resolution) break;

            seenActionKinds.push(resolution.action.kind);
            state = applyAiResolution(state, resolution);
        }

        expect(seenActionKinds).toContain(BETRAYAL_AI_ACTION_KINDS.EXPLORE_ROOM);
        expect(state.core.currentPlayer).not.toBe(initialPlayerId);
    });

    test('全 AI 对局会真实分配 AI 叛徒并通过杰克之灵推进到终局', async () => {
        const playerIds = ['0', '1', '2'];
        const random = createSeededRandom('betrayal-ai-full-audit');
        let state: MatchState<BetrayalCore> = {
            core: engineConfig.domain.setup(playerIds, random),
            sys: createInitialSystemState(playerIds, engineConfig.systems, engineConfig.systemsConfig),
        };
        const seatControllers = Object.fromEntries(playerIds.map((playerId) => [
            playerId,
            { type: 'local-ai' as const, minimumActionDelayMs: 0 },
        ]));
        let sawAiTraitor = false;
        let sawTraitorAttack = false;
        let sawHeroAttack = false;
        let sawJackSpiritControl = false;
        let sawCorpseAttack = false;
        let executedSteps = 0;

        for (; executedSteps < 160 && !state.core.endgameResult; executedSteps += 1) {
            const resolution = await resolveNextLocalAiAction({
                engineConfig,
                state,
                matchId: `betrayal-ai-full-audit-${executedSteps}`,
                seatControllers,
            });

            expect(resolution).not.toBeNull();
            if (!resolution) break;

            const traitorPlayerId = state.core.scenarioRuntime.traitorPlayerId;
            if (traitorPlayerId) {
                sawAiTraitor = true;
                sawTraitorAttack ||= resolution.action.kind === BETRAYAL_AI_ACTION_KINDS.TRAITOR_ATTACK_HERO;
                sawHeroAttack ||= resolution.action.kind === BETRAYAL_AI_ACTION_KINDS.HERO_ATTACK_TRAITOR;
                const traitorIsDead = state.core.scenarioRuntime.deadExplorerPlayerIds.includes(traitorPlayerId);
                if (traitorIsDead) {
                    sawJackSpiritControl ||= (
                        resolution.playerId === traitorPlayerId
                        && resolution.action.kind === BETRAYAL_AI_ACTION_KINDS.MOVE_TO_ROOM
                    );
                    sawCorpseAttack ||= resolution.action.kind === BETRAYAL_AI_ACTION_KINDS.HERO_ATTACK_TRAITOR;
                }
            }

            state = applyAiResolution(state, resolution, random);
        }

        expect(new Set(Object.values(state.core.selectedExplorerByPlayerId))).toHaveLength(playerIds.length);
        expect(state.core.readyPlayerIds).toHaveLength(playerIds.length);
        expect(sawAiTraitor).toBe(true);
        expect(state.core.scenarioRuntime.traitorPlayerId).toBe(state.core.scenarioRuntime.hauntRevealerPlayerId);
        expect(sawTraitorAttack).toBe(true);
        expect(sawHeroAttack).toBe(true);
        expect(sawJackSpiritControl).toBe(true);
        expect(sawCorpseAttack).toBe(false);
        expect(executedSteps).toBeLessThan(160);
        expect(state.core.phase).toBe('endgame');
        expect(state.core.endgameResult?.outcome).toBe('traitor');
    });
});
