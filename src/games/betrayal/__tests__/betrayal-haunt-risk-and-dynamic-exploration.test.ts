import { describe, expect, it } from 'vitest';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    startFirstScenarioFromCharacterSelect,
    setNextDiscoverySymbolRoomsForAllFloors,
    acknowledgeAnyPendingCardResolutions,
    createOpenFrontierHauntTestCore,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal first scenario runtime - haunt risk and dynamic exploration', () => {
it.each(BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((omen) => [omen.name, omen] as const))(
        '抽到预兆「%s」会记录对应作祟检定骰面',
        (_omenName, omen) => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['omen'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
        core.possessionOrderByKind.omen = [
            omen,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];
        const expectedDiceCount = 1 + [core.currentExplorer, ...core.otherExplorers]
            .reduce((count, explorer) => count + explorer.inventory.filter((card) => card.kind === 'omen').length, 0);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.latestDiscovery?.title).toBe(omen.name);
        expect(core.latestDiscovery?.detail).toContain('作祟检定');
        expect(core.latestDiscovery?.detail).toContain('抽到预兆后进行作祟检定');
        expect(core.latestDiscovery?.detail).not.toContain(`${core.scenarioRuntime.hauntRollThreshold}+ 作祟开始`);
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.sourceTitle).toBe(omen.name);
        expect(core.recentRoll?.rollLabel).toBe('作祟检定');
        expect(core.recentRoll?.dice).toEqual(Array.from({ length: expectedDiceCount }, () => 1));
        expect(core.recentRoll?.latestLabel).toBe('未触发作祟');
        expect(core.phase).toBe('preHaunt');
        },
    );

it('最后一张预兆会自动触发作祟', () => {
        const core = createStartedFirstScenarioCore();
        core.exploreIndex = 2;
        core.deckCounts.omen = 1;
        core.currentExplorer.roomId = 'hallway';
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        const events = BetrayalDomain.execute({ core, sys: {} as never }, command, createBetrayalScriptedRandom(1));
        const roomExplored = events.find((event) => event.type === 'ROOM_EXPLORED');

        expect(roomExplored?.type).toBe('ROOM_EXPLORED');
        if (roomExplored?.type === 'ROOM_EXPLORED') {
            expect(roomExplored.payload.hauntTriggered).toBe(true);
        }
    });

it('作祟阶段探索新房间会正常结算发现，但不会再进行作祟检定', () => {
        let core = createOpenFrontierHauntTestCore('0');
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        const firstEvent: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点速度。',
            effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
        };
        const secondEvent: BetrayalCore['eventOrder'][number] = {
            name: '第二张测试事件',
            text: '用于确认事件牌堆顺序。',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        };
        core.eventOrder = [firstEvent, secondEvent];
        core.deckCounts.event = core.eventOrder.length;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();
        const speedBeforeExplore = findTestExplorer(core, '0').traits.speed;

        expect(core.phase).toBe('haunt');
        expect(core.rooms.some((room) => room.state === 'unexplored')).toBe(true);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: targetRoomId! }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: targetRoomId! });

        expect(core.rooms.find((room) => room.id === targetRoomId)?.state).toBe('discovered');
        expect(core.currentExplorer.roomId).toBe(targetRoomId);
        expect(core.latestDiscovery?.title).toBe('阴影扑面');
        expect(core.pendingEventChoice).toBeNull();
        expect(findTestExplorer(core, '0').traits.speed).toBe(speedBeforeExplore - 1);
        expect(core.eventOrder.map((event) => event.name)).toEqual(['第二张测试事件', '阴影扑面']);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.recentRoll?.kind).not.toBe('hauntRoll');
    });

it('翻开未知房间时会把新房间门位旋转到当前开放门位，不再靠黄色连接补丁伪造门', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = startFirstScenarioFromCharacterSelect(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' }, 100, createBetrayalScriptedRandom(1));

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        expect(discoveredRoom?.entryRoomId).toBe('upper-landing');
        expect(discoveredRoom?.entryEdge).toBe('north');
        expect(discoveredRoom?.doorways.some((doorway) => (
            doorway.edge === 'south' && doorway.connectsToRoomId === 'upper-landing'
        ))).toBe(true);
    });

it('正式探索会从真实开放门位动态生成下一批未知房间，并在探索后结束当前回合', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gymnasium')!,
        ];

        expect(core.rooms.some((room) => room.id === 'upper-north' && room.state === 'unexplored')).toBe(true);
        expect(core.rooms.some((room) => room.id === 'frontier-upper-north-east')).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' }, 100, createBetrayalScriptedRandom(1));

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        const dynamicFrontier = core.rooms.find((room) => room.id === 'frontier-upper-north-west');
        expect(discoveredRoom?.state).toBe('discovered');
        expect(dynamicFrontier?.state).toBe('unexplored');
        expect(dynamicFrontier?.doorways).toEqual([
            { edge: 'east', connectsToRoomId: 'upper-north' },
        ]);
        expect(discoveredRoom?.doorways.some((doorway) => (
            doorway.edge === 'west' && doorway.connectsToRoomId === 'frontier-upper-north-west'
        ))).toBe(true);
        expect(core.movesRemaining).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.recommendedAction).toBe('endTurn');

        const moveAfterDiscovery = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'frontier-upper-north-west' }),
        );
        expect(moveAfterDiscovery.valid).toBe(false);
        if (!moveAfterDiscovery.valid) {
            expect(moveAfterDiscovery.error).toContain('请先确认当前翻牌结算');
        }

        core = acknowledgeAnyPendingCardResolutions(core);
        const moveAfterResolution = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'frontier-upper-north-west' }),
        );
        expect(moveAfterResolution.valid).toBe(false);
        if (!moveAfterResolution.valid) {
            expect(moveAfterResolution.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.turnEndedByDiscovery).toBe(false);
    });
});
