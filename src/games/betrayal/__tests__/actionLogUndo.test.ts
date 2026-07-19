import { describe, expect, it } from 'vitest';
import {
    createInitialSystemState,
    createSeededRandom,
    executePipeline,
} from '../../../engine/pipeline';
import { setUndoAiSeatIds, UNDO_COMMANDS } from '../../../engine/systems/UndoSystem';
import type { Command, MatchState } from '../../../engine/types';
import {
    BETRAYAL_ACTION_LOG_ALLOWLIST,
    BETRAYAL_UNDO_ALLOWLIST,
    formatBetrayalActionEntry,
} from '../actionLog';
import {
    BETRAYAL_COMMANDS,
    engineConfig,
    EXPLORER_CATALOG,
    type BetrayalCommand,
    type BetrayalCore,
} from '../game';
import { createStartedFirstScenarioCore } from '../testing/firstScenarioTestUtils';

const playerIds = ['0', '1', '2'];

const setupState = (): MatchState<BetrayalCore> => ({
    core: engineConfig.domain.setup(playerIds, createSeededRandom('betrayal-action-log-setup')),
    sys: createInitialSystemState(playerIds, engineConfig.systems, 'local:betrayal-action-log'),
});

const runCommand = (
    state: MatchState<BetrayalCore>,
    command: Command,
): MatchState<BetrayalCore> => {
    const result = executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems,
        },
        state,
        command as BetrayalCommand,
        createSeededRandom(`betrayal-action-log-${command.timestamp ?? 0}`),
        playerIds,
    );
    expect(result.success).toBe(true);
    return result.state;
};

const findAvailableExplorerId = (state: MatchState<BetrayalCore>) => {
    const occupied = new Set(Object.values(state.core.selectedExplorerByPlayerId));
    return EXPLORER_CATALOG.find((explorer) => !occupied.has(explorer.explorerId))!.explorerId;
};

describe('小黑屋操作日志与撤回', () => {
    it('全部正式命令共用同一日志和撤回白名单', () => {
        const commands = Object.values(BETRAYAL_COMMANDS);
        expect(BETRAYAL_ACTION_LOG_ALLOWLIST).toEqual(commands);
        expect(BETRAYAL_UNDO_ALLOWLIST).toEqual(commands);
        expect(engineConfig.disableUndo).not.toBe(true);
        expect(engineConfig.systems.map((system) => system.id)).toEqual(
            expect.arrayContaining(['actionLog', 'undo', 'cheat']),
        );
    });

    it('全部正式命令都有公开日志摘要且不复写私密参数', () => {
        const core = createStartedFirstScenarioCore();
        const state: MatchState<BetrayalCore> = {
            core,
            sys: createInitialSystemState(playerIds, engineConfig.systems, 'local:betrayal-action-log-format'),
        };
        const payloadByCommand: Partial<Record<string, Record<string, unknown>>> = {
            [BETRAYAL_COMMANDS.SELECT_EXPLORER]: { explorerId: 'secret-explorer-id' },
            [BETRAYAL_COMMANDS.START_SCENARIO]: { scenarioId: 'first-scenario' },
            [BETRAYAL_COMMANDS.MOVE_TO_ROOM]: { roomId: 'hallway', useSkeletonKey: true },
            [BETRAYAL_COMMANDS.EXPLORE_ROOM]: { roomId: 'ground-north' },
            [BETRAYAL_COMMANDS.USE_POSSESSION]: {
                cardId: 'secret-card-id',
                targetRoomIdsByTokenId: { secretToken: 'secret-room-id' },
            },
            [BETRAYAL_COMMANDS.USE_RABBIT_FOOT]: { cardId: 'secret-rabbit-foot', dieIndex: 0 },
            [BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE]: {
                accept: true,
                trait: 'might',
                traits: ['might', 'speed'],
                targetRoomId: 'secret-event-room',
            },
            [BETRAYAL_COMMANDS.TRADE_POSSESSION]: {
                cardId: 'secret-trade-card',
                cardIds: ['secret-trade-card'],
                targetPlayerId: '1',
            },
            [BETRAYAL_COMMANDS.LOOT_CORPSE]: {
                sourcePlayerId: 'secret-corpse-player',
                cardId: 'secret-corpse-card',
            },
            [BETRAYAL_COMMANDS.HAUNT_ATTACK]: {
                target: 'hero',
                targetPlayerId: '1',
                weaponCardId: 'secret-weapon-card',
            },
        };

        const commandTypes = Object.values(BETRAYAL_COMMANDS);
        const entries = commandTypes.map((type, index) => (
            formatBetrayalActionEntry({
                command: {
                    type,
                    playerId: '0',
                    payload: payloadByCommand[type] ?? {},
                    timestamp: index + 1,
                },
                state,
                events: [],
            })
        ));

        expect(commandTypes.filter((_, index) => !entries[index])).toEqual([]);
        const serialized = JSON.stringify(entries);
        expect(serialized).not.toContain('secret-');
        expect(serialized).not.toContain('targetRoomIdsByTokenId');
        expect(serialized).not.toContain('weaponCardId');
    });

    it('真人动作生成快照和日志，撤回后两者同步回退', () => {
        let state = setupState();
        const explorerId = findAvailableExplorerId(state);

        state = runCommand(state, {
            type: BETRAYAL_COMMANDS.SELECT_EXPLORER,
            playerId: '0',
            payload: { explorerId },
            timestamp: 1,
        });

        expect(state.core.selectedExplorerByPlayerId['0']).toBe(explorerId);
        expect(state.sys.undo.snapshots).toHaveLength(1);
        expect(state.sys.actionLog.entries).toHaveLength(1);

        state = runCommand(state, {
            type: UNDO_COMMANDS.REQUEST_UNDO,
            playerId: '0',
            payload: { localAutoApprove: true },
            timestamp: 2,
        });

        expect(state.core.selectedExplorerByPlayerId['0']).not.toBe(explorerId);
        expect(state.sys.undo.snapshots).toHaveLength(0);
        expect(state.sys.actionLog.entries).toHaveLength(0);
    });

    it('AI 动作写入公开日志但不占用真人撤回快照', () => {
        let state = setUndoAiSeatIds(setupState(), ['1']);
        const explorerId = findAvailableExplorerId(state);

        state = runCommand(state, {
            type: BETRAYAL_COMMANDS.SELECT_EXPLORER,
            playerId: '1',
            payload: { explorerId },
            timestamp: 1,
        });

        expect(state.core.selectedExplorerByPlayerId['1']).toBe(explorerId);
        expect(state.sys.actionLog.entries).toHaveLength(1);
        expect(state.sys.undo.snapshots).toHaveLength(0);
    });
});
