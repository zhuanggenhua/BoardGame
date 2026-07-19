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

const resolveAllPendingScenarioChoices = (state: MatchState<QidahenCore>): MatchState<QidahenCore> => {
    for (const group of [...state.core.pendingScenarioCharacterChoices]) {
        const playerId = state.core.factions[group.factionId].playerId;
        const characterIds = group.characterIds.slice(0, group.count);
        const command = {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
            playerId,
            payload: { groupId: group.id, characterIds },
        };
        expect(QidahenDomain.validate(state, command as never)).toEqual({ valid: true });
        state = applyCommand(state, command);
    }

    for (const group of [...state.core.pendingScenarioArmamentChoices]) {
        const playerId = state.core.factions[group.factionId].playerId;
        const armamentIds = group.armamentIds.slice(0, group.count);
        const command = {
            type: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,
            playerId,
            payload: { groupId: group.id, armamentIds },
        };
        expect(QidahenDomain.validate(state, command as never)).toEqual({ valid: true });
        state = applyCommand(state, command);
    }

    return state;
};

const resolveFactionSelections = (state: MatchState<QidahenCore>): MatchState<QidahenCore> => {
    const selections = [
        { playerId: '0', factionId: 'jin' },
        { playerId: '1', factionId: 'ming' },
        { playerId: '2', factionId: 'mongol' },
    ] as const;
    for (const selection of selections) {
        const command = {
            type: QIDAHEN_COMMANDS.SELECT_FACTION,
            playerId: selection.playerId,
            payload: { factionId: selection.factionId },
        };
        expect(QidahenDomain.validate(state, command as never)).toEqual({ valid: true });
        state = applyCommand(state, command);
    }
    return state;
};

describe('七大恨局内剧本选择', () => {
    it('剧本选择阶段会阻断正式行动命令，只允许房主选择剧本', () => {
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

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '1',
            payload: { scenarioId: 'shanhaiguan-1622' },
        } as never)).toEqual({ valid: false, error: 'unknownAction' });
    });

    it('房主点选剧本后会先进入阵营确认，再开放对应的人物军备前置', () => {
        let state = createVoteState(['0', '1', '2']);

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '0',
            payload: { scenarioId: 'shanhaiguan-1622' },
        });
        expect(state.core.scenarioVote).toBeNull();
        expect(state.core.scenarioId).toBe('shanhaiguan-1622');
        expect(state.core.scenarioLabel).toBe('剧本二：山海关之议（1622）');
        expect(state.core.factionSelection).toEqual({
            availableFactionIds: ['ming', 'mongol', 'jin'],
            selections: {},
        });
        expect(state.core.pendingScenarioCharacterChoices).toHaveLength(3);
        expect(state.core.pendingScenarioArmamentChoices).toHaveLength(2);
    });

    it('阵营不能被两个玩家重复占用，全部确认后按选择结果绑定席位', () => {
        let state = createVoteState(['0', '1', '2']);
        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '0',
            payload: { scenarioId: 'shanhaiguan-1622' },
        });

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.SELECT_FACTION,
            playerId: '0',
            payload: { factionId: 'jin' },
        });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.SELECT_FACTION,
            playerId: '1',
            payload: { factionId: 'jin' },
        } as never)).toEqual({ valid: false, error: 'unknownAction' });

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.SELECT_FACTION,
            playerId: '1',
            payload: { factionId: 'ming' },
        });
        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.SELECT_FACTION,
            playerId: '2',
            payload: { factionId: 'mongol' },
        });

        expect(state.core.factionSelection).toBeNull();
        expect(state.core.factions.jin.playerId).toBe('0');
        expect(state.core.factions.ming.playerId).toBe('1');
        expect(state.core.factions.mongol.playerId).toBe('2');
        expect(state.core.currentPlayer).toBe('1');
    });

    it('局内剧本选择后，各阵营完成前置项才会放行正式行动', () => {
        let state = createVoteState(['0', '1', '2']);

        state = applyCommand(state, {
            type: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            playerId: '0',
            payload: { scenarioId: 'shanhaiguan-1622' },
        });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: state.core.currentPlayer,
            payload: { actionId: 'raid' },
        } as never)).toEqual({ valid: false, error: 'pendingScenarioChoices' });

        state = resolveFactionSelections(state);
        state = resolveAllPendingScenarioChoices(state);

        expect(state.core.scenarioVote).toBeNull();
        expect(state.core.factionSelection).toBeNull();
        expect(state.core.pendingScenarioCharacterChoices).toEqual([]);
        expect(state.core.pendingScenarioArmamentChoices).toEqual([]);
        const interactionData = state.sys.interaction?.current?.data as {
            qidahenInternalDispatchSelection?: { candidates: Array<{ id: string }> };
        } | undefined;
        const internalDispatchChoiceId = interactionData?.qidahenInternalDispatchSelection?.candidates[0]?.id;
        expect(internalDispatchChoiceId).toBeTruthy();
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            playerId: state.core.currentPlayer,
            payload: { choiceId: internalDispatchChoiceId },
        } as never)).toEqual({ valid: true });
    });
});
