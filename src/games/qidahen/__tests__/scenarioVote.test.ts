import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import type { QidahenCore } from '../domain/types';
import { engineConfig } from '../game';
import { QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD } from '../roomSetup';

const testRandom = {
    random: () => 0.5,
    d: () => 4,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

const createVoteState = (playerIds: string[]): MatchState<QidahenCore> => ({
    core: QidahenDomain.setup(playerIds, testRandom, {
        setupSelections: {
            [QIDAHEN_IN_MATCH_SCENARIO_VOTE_FIELD]: 'enabled',
        },
    }),
    sys: createInitialSystemState(playerIds, engineConfig.systems as any),
});

const applyCommand = (
    state: MatchState<QidahenCore>,
    command: { type: string; playerId: string; payload: Record<string, unknown> },
) => executePipeline(
    { domain: engineConfig.domain, systems: engineConfig.systems as any },
    state,
    command as never,
    testRandom,
    state.core.playerIds,
).state;

describe('七大恨局内剧本投票', () => {
    it('投票阶段会阻断正式行动命令，直到所有席位投完票', () => {
        const state = createVoteState(['0', '1', '2']);

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '0',
            payload: { scenarioId: 'shanhaiguan-1622' },
        } as never)).toEqual({ valid: true });

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        } as never)).toEqual({ valid: false, error: 'pendingScenarioChoices' });
    });

    it('全部席位投完票后会切到获胜剧本，并进入对应的人物军备前置', () => {
        let state = createVoteState(['0', '1', '2']);

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '0',
            payload: { scenarioId: 'shanhaiguan-1622' },
        });
        expect(state.core.scenarioVote?.votes['0']).toBe('shanhaiguan-1622');
        expect(state.core.pendingScenarioCharacterChoices).toEqual([]);

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '1',
            payload: { scenarioId: 'shanhaiguan-1622' },
        });
        expect(state.core.scenarioVote?.votes['1']).toBe('shanhaiguan-1622');

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '2',
            payload: { scenarioId: 'post-sarhu-1619' },
        });

        expect(state.core.scenarioVote).toBeNull();
        expect(state.core.scenarioId).toBe('shanhaiguan-1622');
        expect(state.core.scenarioLabel).toBe('剧本二：山海关之议（1622）');
        expect(state.core.pendingScenarioCharacterChoices).toHaveLength(3);
        expect(state.core.pendingScenarioArmamentChoices).toHaveLength(2);
    });
});
