import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { resolveNextLocalAiAction } from '../../../engine/ai';
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
