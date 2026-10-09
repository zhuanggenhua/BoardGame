import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import {
    resolveForceEndTurnForStalledAi,
    resolveOnlineAiCurrentPlayerId,
} from '../../../engine/transport/onlineAiRecovery';
import type { MatchState } from '../../../engine/types';
import { buildQidahenAiLegalActions } from '../ai';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { createInitialCore } from '../domain/initialCoreSetup';
import type { QidahenCore } from '../domain/types';
import { QidahenDomain } from '../domain';
import { engineConfig } from '../game';

const testRandom = {
    random: () => 0.5,
    d: () => 4,
    range: (min: number) => min,
    shuffle: <T>(array: T[]) => [...array],
};

const createAiState = (core: QidahenCore): MatchState<QidahenCore> => QidahenDomain.normalizeRuntimeState({
    core,
    sys: createInitialSystemState(core.playerIds, engineConfig.systems as any),
});

const applyAiResolution = (
    state: MatchState<QidahenCore>,
    resolution: NonNullable<Awaited<ReturnType<typeof resolveNextLocalAiAction>>>,
): MatchState<QidahenCore> => resolution.action.commands.reduce(
    (nextState, command) => executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems as any,
        },
        nextState,
        {
            type: command.type,
            playerId: resolution.playerId,
            payload: command.payload as Record<string, unknown>,
        } as any,
        testRandom,
        nextState.core.playerIds,
    ).state,
    state,
);

describe('七大恨 AI', () => {
    it('剧本前置选择未完成时，online AI watchdog 应归属待选势力 seat，避免对下一位 AI 发 ADVANCE_PHASE', () => {
        const baseCore = createInitialCore(['0', '1'], 'dingmao-rebellion-1627', false);
        const state = createAiState({
            ...baseCore,
            factions: {
                ...baseCore.factions,
                ming: { ...baseCore.factions.ming, playerId: '1' },
                jin: { ...baseCore.factions.jin, playerId: '0' },
            },
            currentPlayer: '1',
            pendingScenarioCharacterChoices: [{
                id: 'dingmao-rebellion-1627:jin:character:0',
                factionId: 'jin',
                factionName: '后金',
                count: 1,
                characterIds: ['jin-huangtaiji', 'jin-amin', 'jin-daisan'],
                characterNames: ['皇太极', '阿敏', '代善'],
            }],
            pendingScenarioArmamentChoices: [],
        });

        const resolvedPlayerId = engineConfig.onlineAiRecovery?.resolveCurrentPlayerId?.({
            state,
            phase: '',
            fallbackPlayerId: '1',
        });

        expect(resolvedPlayerId).toBe(state.core.factions.jin.playerId);
        expect(resolvedPlayerId).toBe('0');
        expect(resolveOnlineAiCurrentPlayerId(state, {
            engineConfig,
            gameId: 'qidahen',
        })).toBe('0');
        expect(buildQidahenAiLegalActions({ playerId: '1', state })).toEqual([]);
        const jinActions = buildQidahenAiLegalActions({ playerId: '0', state });
        expect(jinActions.length).toBeGreaterThan(0);
        expect(new Set(jinActions.map((action) => action.commands[0]?.type)))
            .toEqual(new Set([QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE]));

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: state,
            seatControllers: {
                '0': { type: 'local-ai' },
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '0': state,
                '1': state,
            },
            engineConfig,
            gameId: 'qidahen',
        });

        expect(engineConfig.onlineAiRecovery?.disableFallbackAdvancePhase).toBe(true);
        expect(candidate?.reason).toBe('active-turn-legal-only');
        expect(candidate?.resolution.action.commands).toEqual([]);
    });

    it('确认阵营阶段会为尚未选择的 AI 座位生成合法阵营动作', () => {
        const baseCore = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', false);
        const state = createAiState({
            ...baseCore,
            factionSelection: {
                availableFactionIds: ['ming', 'mongol', 'jin'],
                selections: { '0': 'ming' },
            },
        });

        const actions = buildQidahenAiLegalActions({ playerId: '1', state });

        expect(actions.map((action) => action.commands[0])).toEqual([
            { type: QIDAHEN_COMMANDS.SELECT_FACTION, payload: { factionId: 'mongol' } },
            { type: QIDAHEN_COMMANDS.SELECT_FACTION, payload: { factionId: 'jin' } },
        ]);
    });

    it('手动代选七大恨阵营时，adapter 应接管未选 AI、识别直接命令并在权威状态确认后释放', () => {
        const baseCore = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', false);
        const pendingState = createAiState({
            ...baseCore,
            factionSelection: {
                availableFactionIds: ['ming', 'mongol', 'jin'],
                selections: { '0': 'ming' },
            },
        });

        expect(engineConfig.onlineAiRecovery?.resolveManualSetupSelectionTakeoverPlayerId?.({
            sharedState: pendingState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBe('1');

        expect(engineConfig.onlineAiRecovery?.resolveManualSetupSelectionActionKindFromCommand?.({
            type: QIDAHEN_COMMANDS.SELECT_FACTION,
            payload: { factionId: 'mongol' },
        })).toBe('faction-selection');

        expect(engineConfig.onlineAiRecovery?.shouldReleaseManualSetupAttemptFromSharedState?.({
            sharedState: createAiState({
                ...pendingState.core,
                factionSelection: {
                    ...pendingState.core.factionSelection!,
                    selections: { '0': 'ming', '1': 'mongol' },
                },
            }),
            playerId: '1',
            actionKind: 'faction-selection',
            selectionId: 'mongol',
        })).toBe(true);

        expect(engineConfig.onlineAiRecovery?.shouldReleaseManualSetupAttemptFromSharedState?.({
            sharedState: createAiState({
                ...pendingState.core,
                factionSelection: null,
            }),
            playerId: '1',
            actionKind: 'faction-selection',
            selectionId: 'mongol',
        })).toBe(true);
    });

    it('手动代选七大恨阵营时，本地 AI 不应自动提交 faction-selection', async () => {
        const baseCore = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', false);
        const state = createAiState({
            ...baseCore,
            factionSelection: {
                availableFactionIds: ['ming', 'mongol', 'jin'],
                selections: { '0': 'ming' },
            },
        });

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'qidahen-manual-faction-selection',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
                '2': { type: 'human' },
            },
        });

        expect(resolution).toBeNull();
    });

    it('会为对应势力生成剧本前置选择动作', () => {
        const core = createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', false);
        const state = createAiState(core);

        const mingActions = buildQidahenAiLegalActions({
            playerId: '0',
            state,
        });
        const mongolActions = buildQidahenAiLegalActions({
            playerId: '1',
            state,
        });
        const jinActions = buildQidahenAiLegalActions({
            playerId: '2',
            state,
        });

        expect(mingActions.length).toBeGreaterThan(0);
        expect(mingActions.every((action) => (
            action.commands[0]?.type === QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE
            || action.commands[0]?.type === QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE
        ))).toBe(true);
        expect(mongolActions).toEqual([]);
        expect(jinActions.length).toBeGreaterThan(0);
    });

    it('本地 AI 能从剧本前置推进到主流程动作', async () => {
        let state = createAiState(createInitialCore(['0', '1', '2'], 'shanhaiguan-1622', true));
        const seatControllers = {
            '0': { type: 'local-ai' as const },
            '1': { type: 'local-ai' as const },
            '2': { type: 'local-ai' as const },
        };
        const seenCommandTypes: string[] = [];
        const visitedPlayers = new Set<string>();

        for (let step = 0; step < 16; step += 1) {
            const resolution = await resolveNextLocalAiAction({
                engineConfig,
                state,
                matchId: `qidahen-ai-pregame-${step}`,
                seatControllers,
            });

            expect(resolution).not.toBeNull();
            if (!resolution) {
                break;
            }

            const commandType = resolution.action.commands[0]?.type ?? '';
            seenCommandTypes.push(commandType);
            visitedPlayers.add(resolution.playerId);

            state = applyAiResolution(state, resolution);

            const reachedMainFlowAcrossAllPlayers = (
                state.core.pendingScenarioCharacterChoices.length === 0
                && state.core.pendingScenarioArmamentChoices.length === 0
                && seenCommandTypes.includes(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE)
                && seenCommandTypes.includes(QIDAHEN_COMMANDS.EXECUTE_ACTION)
                && seenCommandTypes.includes('SYS_INTERACTION_RESPOND')
                && ['0', '1', '2'].every((playerId) => visitedPlayers.has(playerId))
            );
            if (reachedMainFlowAcrossAllPlayers) {
                break;
            }
        }

        expect(state.core.pendingScenarioCharacterChoices).toEqual([]);
        expect(state.core.pendingScenarioArmamentChoices).toEqual([]);
        expect(seenCommandTypes).toContain(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE);
        expect(seenCommandTypes).toContain(QIDAHEN_COMMANDS.EXECUTE_ACTION);
        expect(seenCommandTypes).toContain('SYS_INTERACTION_RESPOND');
        expect(Array.from(visitedPlayers)).toEqual(expect.arrayContaining(['0', '1', '2']));
    });

    it('手牌上限弃牌交互会直接提交合法多选响应', () => {
        const baseCore = createInitialCore(['0', '1', '2']);
        const discardCardIds = baseCore.handCards
            .filter((card) => card.faction === 'ming' && card.status !== 'disabled')
            .slice(0, 2)
            .map((card) => card.id);

        const state = createAiState({
            ...baseCore,
            pendingScenarioCharacterChoices: [],
            pendingScenarioArmamentChoices: [],
            turnPhase: 'hand-limit-discard',
            handLimitDiscardSelection: {
                factionId: 'ming',
                factionName: '大明',
                handLimit: 4,
                handCount: 6,
                requiredDiscardCount: 2,
                candidateCardIds: discardCardIds,
                selectedCardIds: [],
            },
        });
        const actions = buildQidahenAiLegalActions({
            playerId: '0',
            state,
        });

        expect((state.sys.interaction?.current?.data as { ai?: { status?: string } } | undefined)?.ai?.status)
            .toBe('semantic');
        expect(actions[0]?.commands[0]).toMatchObject({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'qidahen-hand-limit-discard-ming',
                optionIds: discardCardIds,
            },
        });
    });
});
