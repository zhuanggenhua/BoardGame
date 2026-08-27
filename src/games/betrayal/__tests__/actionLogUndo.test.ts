import { describe, expect, it } from 'vitest';
import {
    createInitialSystemState,
    createSeededRandom,
    executePipeline,
} from '../../../engine/pipeline';
import { buildActionLogRows } from '../../../components/game/utils/actionLogFormat';
import { setUndoAiSeatIds, UNDO_COMMANDS } from '../../../engine/systems/UndoSystem';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
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
    type BetrayalTraitKey,
} from '../game';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
import {
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
} from '../testing/firstScenarioTestUtils';

const playerIds = ['0', '1', '2'];

const setupState = (): MatchState<BetrayalCore> => ({
    core: engineConfig.domain.setup(playerIds, createSeededRandom('betrayal-action-log-setup')),
    sys: createInitialSystemState(playerIds, engineConfig.systems, 'local:betrayal-action-log'),
});

const runCommand = (
    state: MatchState<BetrayalCore>,
    command: Command,
    random: RandomFn = createSeededRandom(`betrayal-action-log-${command.timestamp ?? 0}`),
): MatchState<BetrayalCore> => {
    const result = executePipeline(
        {
            domain: engineConfig.domain,
            systems: engineConfig.systems,
        },
        state,
        command as BetrayalCommand,
        random,
        playerIds,
    );
    expect(result.success).toBe(true);
    return result.state;
};

const findAvailableExplorerId = (state: MatchState<BetrayalCore>) => {
    const occupied = new Set(Object.values(state.core.selectedExplorerByPlayerId));
    return EXPLORER_CATALOG.find((explorer) => !occupied.has(explorer.explorerId))!.explorerId;
};

const setupStartedScenarioState = (): MatchState<BetrayalCore> => ({
    core: createStartedFirstScenarioCore(),
    sys: createInitialSystemState(playerIds, engineConfig.systems, 'local:betrayal-started-action-log'),
});

const eventByName = (name: string) => {
    const event = BETRAYAL_DISCOVERY_POOLS.events.find((candidate) => candidate.name === name);
    if (!event) {
        throw new Error(`山屋测试夹具缺少事件牌：${name}`);
    }
    return event;
};

const mentalTraitTotal = (core: BetrayalCore, playerId: string): number => {
    const explorer = [core.currentExplorer, ...core.otherExplorers].find((candidate) => (
        candidate.playerId === playerId
    ));
    if (!explorer) {
        throw new Error(`山屋测试夹具找不到玩家 ${playerId} 的探索者`);
    }
    return explorer.traits.knowledge + explorer.traits.sanity;
};

const buildVisibleTraitTrack = (
    trait: BetrayalTraitKey,
    value: number,
): BetrayalCore['currentExplorer']['traitTracks'][BetrayalTraitKey] => {
    const values = [1, 2, 3, 4, 5];
    const position = values.indexOf(value);
    if (position < 0) {
        throw new Error(`山屋测试夹具属性轨不支持 ${trait}=${value}`);
    }
    return {
        trackId: `action-log-test-${trait}`,
        values,
        position,
        startPosition: position,
        criticalPosition: 0,
        skullPosition: -1,
        maxPosition: values.length - 1,
    };
};

const setCurrentExplorerVisibleTrait = (
    core: BetrayalCore,
    trait: BetrayalTraitKey,
    value: number,
): void => {
    core.currentExplorer.traitTracks = {
        ...core.currentExplorer.traitTracks,
        [trait]: buildVisibleTraitTrack(trait, value),
    };
    core.currentExplorer.traits = {
        ...core.currentExplorer.traits,
        [trait]: value,
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
};

const cloneGroundRoomTemplate = (
    room: BetrayalCore['roomDiscoveryOrderByFloor']['ground'][number],
): BetrayalCore['roomDiscoveryOrderByFloor']['ground'][number] => ({
    ...room,
    tags: [...room.tags],
    doorways: [...room.doorways],
});

const pinGroundNorthToKitchenEventRoom = (core: BetrayalCore): void => {
    const kitchen = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find(
        (room) => room.visualId === 'kitchen',
    );
    if (!kitchen || kitchen.discoverySymbol !== 'event') {
        throw new Error('山屋测试夹具缺少事件房间：厨房');
    }

    const orderedGroundRooms = [
        cloneGroundRoomTemplate(kitchen),
        ...core.roomDiscoveryOrderByFloor.ground
            .filter((room) => room.visualId !== 'kitchen')
            .map(cloneGroundRoomTemplate),
    ];
    core.roomDiscoveryOrderByFloor = {
        ...core.roomDiscoveryOrderByFloor,
        ground: orderedGroundRooms,
    };
    core.roomDiscoveryDeck = [
        ...orderedGroundRooms.map((room) => ({
            floor: 'ground' as const,
            room: cloneGroundRoomTemplate(room),
        })),
        ...core.roomDiscoveryOrderByFloor.upper.map((room) => ({
            floor: 'upper' as const,
            room: {
                ...room,
                tags: [...room.tags],
                doorways: [...room.doorways],
            },
        })),
        ...core.roomDiscoveryOrderByFloor.basement.map((room) => ({
            floor: 'basement' as const,
            room: {
                ...room,
                tags: [...room.tags],
                doorways: [...room.doorways],
            },
        })),
    ];
};

describe('小黑屋操作日志与撤回', () => {
    it('全部正式命令有日志白名单，撤回白名单独立排除纯确认命令', () => {
        const commands = Object.values(BETRAYAL_COMMANDS);
        expect(BETRAYAL_ACTION_LOG_ALLOWLIST).toEqual(commands);
        expect(BETRAYAL_UNDO_ALLOWLIST).not.toBe(BETRAYAL_ACTION_LOG_ALLOWLIST);
        for (const command of BETRAYAL_UNDO_ALLOWLIST) {
            expect(commands).toContain(command);
        }
        expect(BETRAYAL_UNDO_ALLOWLIST).toEqual(expect.arrayContaining([
            BETRAYAL_COMMANDS.SELECT_EXPLORER,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD,
            BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE,
        ]));
        for (const confirmationCommand of [
            BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
            BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
            BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL,
            BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL,
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
        ]) {
            expect(BETRAYAL_UNDO_ALLOWLIST).not.toContain(confirmationCommand);
        }
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
            [BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD]: { candidateId: 'friends-forever' },
            [BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD]: {},
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

    it('探索事件触发和事件结果会进入玩家操作日志', () => {
        let state = setupStartedScenarioState();
        state.core.drawOrder = ['event'];
        state.core.eventOrder = [eventByName('无线电广播')];
        state.core.deckCounts.event = state.core.eventOrder.length;
        pinGroundNorthToKitchenEventRoom(state.core);

        state = runCommand(state, {
            type: BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            playerId: '0',
            payload: { roomId: 'hallway' },
            timestamp: 10,
        });
        state = runCommand(state, {
            type: BETRAYAL_COMMANDS.EXPLORE_ROOM,
            playerId: '0',
            payload: { roomId: 'ground-north' },
            timestamp: 20,
        }, createBetrayalScriptedRandom(3, 3));

        expect(state.core.latestDiscovery?.title).toBe('无线电广播');
        expect(state.core.recentRoll).toMatchObject({
            sourceTitle: '无线电广播',
            dice: [2, 2],
            latestLabel: '获得 1 点知识',
        });
        expect(state.core.pendingEventRollResolution).toMatchObject({
            sourceTitle: '无线电广播',
        });

        expect(state.sys.actionLog.entries).toHaveLength(4);
        expect(state.sys.actionLog.entries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: BETRAYAL_COMMANDS.MOVE_TO_ROOM,
                segments: [expect.objectContaining({
                    key: 'actionLog.moveToRoom',
                    params: { playerId: '0', room: '门厅' },
                })],
            }),
            expect.objectContaining({
                kind: BETRAYAL_COMMANDS.EXPLORE_ROOM,
                segments: [expect.objectContaining({
                    key: 'actionLog.exploreRoom',
                    params: { playerId: '0', room: '厨房' },
                })],
            }),
            expect.objectContaining({
                kind: 'ROOM_EXPLORED',
                segments: [expect.objectContaining({
                    key: 'actionLog.exploreRoomEvent',
                    params: { playerId: '0', room: '厨房', event: '无线电广播' },
                })],
            }),
            expect.objectContaining({
                kind: 'ROOM_EXPLORED',
                segments: [expect.objectContaining({
                    key: 'actionLog.eventRollResult',
                    params: {
                        playerId: '0',
                        event: '无线电广播',
                        roll: '投 2 颗骰子',
                        total: 4,
                        result: '获得 1 点知识',
                    },
                })],
            }),
        ]));

        const serializedLog = JSON.stringify(state.sys.actionLog.entries);
        expect(serializedLog).not.toContain('ground-north');
        expect(serializedLog).not.toContain('eventOrder');
        expect(serializedLog).not.toContain('"player":1');

        const displayRows = buildActionLogRows(state.sys.actionLog.entries, {
            newestFirst: false,
            formatTime: () => '',
            getPlayerLabel: (playerId) => (String(playerId) === '0' ? '薇薇安' : `玩家${playerId}`),
        });
        const resolvedParams = displayRows.flatMap((row) => row.segments.map((segment) => (
            segment.type === 'i18n' ? segment.params : undefined
        )));
        expect(resolvedParams).toEqual(expect.arrayContaining([
            expect.objectContaining({ playerId: '薇薇安' }),
        ]));
        expect(JSON.stringify(resolvedParams)).not.toContain('玩家 1');
    });

    it('无线电广播低点数分支会重新投一颗伤害骰并写入玩家操作日志', () => {
        let state = setupStartedScenarioState();
        state.core.drawOrder = ['event'];
        state.core.eventOrder = [eventByName('无线电广播')];
        state.core.deckCounts.event = state.core.eventOrder.length;
        state.core.currentExplorer = {
            ...state.core.currentExplorer,
            inventory: [],
        };
        setCurrentExplorerVisibleTrait(state.core, 'knowledge', 4);
        setCurrentExplorerVisibleTrait(state.core, 'sanity', 4);
        state.core.currentExplorerTraits = { ...state.core.currentExplorer.traits };
        state.core.currentExplorerInventory = [];
        pinGroundNorthToKitchenEventRoom(state.core);

        state = runCommand(state, {
            type: BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            playerId: '0',
            payload: { roomId: 'hallway' },
            timestamp: 10,
        });
        state = runCommand(state, {
            type: BETRAYAL_COMMANDS.EXPLORE_ROOM,
            playerId: '0',
            payload: { roomId: 'ground-north' },
            timestamp: 20,
        }, createBetrayalScriptedRandom(1, 1, 3));

        expect(state.core.recentRoll).toMatchObject({
            sourceTitle: '无线电广播',
            dice: [0, 0],
            latestLabel: '受到一颗骰子的精神伤害',
        });
        expect(state.core.recentRoll?.eventDamagePreviewResults).toEqual([{
            damageKind: 'mental',
            rolls: [2],
            total: 2,
            appliedAmount: 2,
        }]);
        expect(mentalTraitTotal(state.core, '0')).toBe(8);

        for (const playerId of playerIds) {
            state = runCommand(state, {
                type: BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
                playerId,
                payload: { rollId: state.core.recentRoll?.id },
                timestamp: 30 + Number(playerId),
            });
        }

        expect(state.core.pendingEventRollResolution).toBeNull();
        expect(state.core.recentRoll?.eventEffectSnapshot?.damageRolls).toEqual([2]);
        expect(state.core.recentRoll?.eventEffectSnapshot?.rolledDamageResults).toEqual([{
            damageKind: 'mental',
            rolls: [2],
            total: 2,
            appliedAmount: 2,
        }]);
        expect(mentalTraitTotal(state.core, '0')).toBe(6);
        expect(state.core.currentExplorer.traits.knowledge).toBe(2);
        expect(state.core.currentExplorer.traits.sanity).toBe(4);

        expect(state.sys.actionLog.entries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
                segments: [expect.objectContaining({
                    key: 'actionLog.eventRolledMentalDamageResult',
                    params: {
                        playerId: '0',
                        event: '无线电广播',
                        damageRolls: '2',
                        damageTotal: 2,
                        appliedDamage: 2,
                    },
                })],
            }),
        ]));

        const displayRows = buildActionLogRows(state.sys.actionLog.entries, {
            newestFirst: false,
            formatTime: () => '',
            getPlayerLabel: (playerId) => (String(playerId) === '0' ? '薇薇安' : `玩家${playerId}`),
        });
        const resolvedParams = displayRows.flatMap((row) => row.segments.map((segment) => (
            segment.type === 'i18n' ? segment.params : undefined
        )));
        expect(resolvedParams).toEqual(expect.arrayContaining([
            expect.objectContaining({
                playerId: '薇薇安',
                event: '无线电广播',
                damageRolls: '2',
                damageTotal: 2,
                appliedDamage: 2,
            }),
        ]));
        expect(JSON.stringify(resolvedParams)).not.toContain('玩家 1');
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
