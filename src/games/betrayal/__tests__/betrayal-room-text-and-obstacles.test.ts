import { describe, expect, it } from 'vitest';
import {
    resolveBetrayalMoveCost,
    resolveMoveTargetRooms,
} from '../movementReadModel';
import {
    acknowledgePendingCardResolutions,
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveRecentRollRerollSelectableDieIndices,
    BETRAYAL_DISCOVERY_POOLS,
    setTestExplorerTraits,
    setTestRoomDiscoveryDeck,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    setHighCapacityGeneralDamageTracks,
    traitTrackPosition,
    traitTrackPositionTotal,
    physicalTraitTotal,
    repeatTraitsForPendingDamage,
    acknowledgeAnyPendingCardResolutions,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal first scenario runtime - room text and obstacles', () => {
it('雕像发现事件符号板块时可选择不抽事件卡且不结算事件效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('等待选择是否跳过事件');
        expect(core.latestDiscovery?.detail).toContain('可选择跳过事件或继续抽取事件牌');
        expect(core.pendingEventChoice).toMatchObject({
            playerId: '0',
            sourceKind: 'event-symbol-skip',
            acceptLabel: '用雕像跳过事件',
            declineLabel: '抽取事件牌',
            eventSymbolSkip: { method: 'idol' },
        });
        expect(core.currentExplorer.traits.might).toBe(mightBefore);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('已用雕像跳过');
        expect(core.latestDiscovery?.detail).toContain('没有抽取或结算事件卡');
        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.resolutionSteps ?? []).toEqual([]);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.discardCounts.event).toBe(0);
        expect(core.eventOrder.map((event) => event.name)).toEqual(['阴影扑面']);
        expect(core.activityLog[0]?.text).toContain('使用雕像跳过了事件');

        const currentPlayerBeforeEndTurn = core.currentPlayer;
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, currentPlayerBeforeEndTurn, {}),
        )).toMatchObject({ valid: true });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, currentPlayerBeforeEndTurn, {});
        expect(core.currentPlayer).not.toBe(currentPlayerBeforeEndTurn);
        expect(core.turnEndedByDiscovery).toBe(false);
    });

it('雕像会让事件中的力量检定结果 +1', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [
            {
                name: '沉重铁门',
                roll: {
                    trait: 'might',
                    branches: [
                        { min: 5, label: '推开铁门，获得 1 点力量', effect: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被铁门撞伤，失去 1 点力量', effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
            },
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
        );
        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('等待选择是否跳过事件');
        expect(core.pendingEventChoice).toMatchObject({
            sourceKind: 'event-symbol-skip',
            acceptLabel: '用雕像跳过事件',
            declineLabel: '抽取事件牌',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.detail).toContain('力量检定 5');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点力量');
        expect(core.currentExplorer.traits.might).toBe(mightBefore + 1);
    });

it('没有雕像或不是事件符号板块时，不能声明用雕像跳过事件', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        const withoutIdol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true }),
        );
        expect(withoutIdol.valid).toBe(false);
        if (!withoutIdol.valid) {
            expect(withoutIdol.error).toContain('不能使用雕像');
        }

        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        core.drawOrder = ['item'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'item');

        const nonEventRoom = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true }),
        );
        expect(nonEventRoom.valid).toBe(false);
        if (!nonEventRoom.valid) {
            expect(nonEventRoom.error).toContain('事件符号板块');
        }
    });

it('洗衣滑槽在探索者结束回合时放置到地下室起始点', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'laundryChute')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('洗衣滑槽');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const movedExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(movedExplorer.roomId).toBe('basement-landing');
        expect(core.currentPlayer).toBe('1');
    });

it('密道楼梯发现后会固定连通门厅', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'secretStaircase')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('密道楼梯');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('hallway');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-east');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        expect(core.currentExplorer.roomId).toBe('basement-east');
    });

it('墓园和地下洞窟发现后会固定连通', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'graveyard')!,
        ];
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'undergroundCavern')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('墓园');
        core = acknowledgePendingCardResolutions(core);

        core = {
            ...core,
            activeRoomId: 'basement-landing',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'basement-landing',
            },
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('地下洞窟');
        core = acknowledgePendingCardResolutions(core);

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('ground-north');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        expect(core.currentExplorer.roomId).toBe('ground-north');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-east');
    });

it('长廊发现后会固定连通舞厅', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'ballroom')!,
        ];
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gallery')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('舞厅');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = {
            ...core,
            activeRoomId: 'upper-landing',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'upper-landing',
            },
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('长廊');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('ground-north');
    });

it('储物间发现时获得 1 点力量', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'larder')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        const mightPositionBefore = traitTrackPosition(core, '0', 'might');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });

        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('储物间');
        expect(traitTrackPosition(core, '0', 'might')).toBe(mightPositionBefore + 1);
    });

it('体育馆发现时获得 1 点速度', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gymnasium')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const speedPositionBefore = traitTrackPosition(core, '0', 'speed');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });

        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('体育馆');
        expect(traitTrackPosition(core, '0', 'speed')).toBe(speedPositionBefore + 1);
    });

it('杂物间发现时会在房间上放置障碍物标记', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });

        const junkRoom = core.rooms.find((room) => room.id === 'basement-east');
        expect(junkRoom?.name).toBe('杂物间');
        expect(junkRoom?.markerTokens).toContain('obstacle');
    });

it('当前所有房间文字直接效果都会先进入翻牌确认队列', () => {
        const cases = [
            {
                floor: 'ground' as const,
                visualId: 'chapel',
                targetRoomId: 'ground-north',
                expectedRoomName: '礼拜堂',
                expectedText: '房间效果：礼拜堂，神志 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                },
            },
            {
                floor: 'upper' as const,
                visualId: 'library',
                targetRoomId: 'upper-north',
                expectedRoomName: '图书馆',
                expectedText: '房间效果：图书馆，知识 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
                },
            },
            {
                floor: 'upper' as const,
                visualId: 'study',
                targetRoomId: 'upper-north',
                expectedRoomName: '书房',
                expectedText: '房间效果：书房，知识 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
                },
            },
            {
                floor: 'upper' as const,
                visualId: 'gymnasium',
                targetRoomId: 'upper-north',
                expectedRoomName: '体育馆',
                expectedText: '房间效果：体育馆，速度 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
                },
            },
            {
                floor: 'basement' as const,
                visualId: 'larder',
                targetRoomId: 'basement-east',
                expectedRoomName: '储物间',
                expectedText: '房间效果：储物间，力量 +1',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
                },
            },
            {
                floor: 'basement' as const,
                visualId: 'junkRoom',
                targetRoomId: 'basement-east',
                expectedRoomName: '杂物间',
                expectedText: '房间效果：杂物间，放置障碍物标记',
                moveToFloor(core: BetrayalCore): BetrayalCore {
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
                    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
                },
            },
        ];

        for (const testCase of cases) {
            let core = createStartedFirstScenarioCore();
            core.drawOrder = ['item'];
            const roomTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor[testCase.floor]
                .find((room) => room.visualId === testCase.visualId)!;
            core.roomDiscoveryOrderByFloor[testCase.floor] = [roomTemplate];

            core = testCase.moveToFloor(core);
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: testCase.targetRoomId });

            expect(core.rooms.find((room) => room.id === testCase.targetRoomId)?.name).toBe(testCase.expectedRoomName);
            expect(core.latestDiscovery?.resolutionSteps?.[0]).toMatchObject({
                kind: 'room-effect',
                text: testCase.expectedText,
            });
            expect(core.pendingCardResolutionQueue[0]).toMatchObject({
                stepKind: 'room-effect',
                cardName: testCase.expectedText,
                text: testCase.expectedText,
                index: 1,
            });
            expect(core.pendingCardResolutionQueue[0]?.deckKind).toBeUndefined();
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
            )).toMatchObject({
                valid: false,
                error: '请先确认当前翻牌结算。',
            });

            core = acknowledgeAnyPendingCardResolutions(core);
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
            ).valid).toBe(true);
        }
    });

it('离开带障碍物标记的房间需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core.turnEndedByDiscovery = false;

        core.movesRemaining = 1;
        const blockedMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(blockedMove.valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.movesRemaining).toBe(0);
    });

it('作祟后同房间敌对探索者会作为障碍物，离开需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core = {
            ...core,
            phase: 'haunt',
            activeRoomId: 'hallway',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'hallway',
            },
            otherExplorers: core.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
            )),
            scenarioRuntime: {
                ...core.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 1,
                traitorPlayerId: '1',
            },
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
        expect(resolveBetrayalMoveCost(core, '2')).toBe(1);
        core.movesRemaining = 1;
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' });
        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.movesRemaining).toBe(0);
    });

it('自由混战作祟中其他探索者会作为敌对阻碍', () => {
        const baseCore = createStartedFirstScenarioCore();
        const core: BetrayalCore = {
            ...baseCore,
            phase: 'haunt' as const,
            activeRoomId: 'hallway',
            currentExplorer: {
                ...baseCore.currentExplorer,
                roomId: 'hallway',
            },
            otherExplorers: baseCore.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
            )),
            scenarioRuntime: {
                ...baseCore.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 12,
                traitorPlayerId: null,
                hauntTraitorResolution: {
                    hauntCardNumber: 12,
                    policy: 'free-for-all',
                    traitorPlayerId: null,
                    teamModel: 'free-for-all',
                    reasonLabel: '自由混战',
                    candidatePlayerIds: [],
                    excludedPlayerIds: [],
                    tieBreak: 'none',
                    representativeOnly: false,
                },
            },
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
        expect(resolveBetrayalMoveCost(core, '2')).toBe(1);
    });

it('作祟后同房间怪物会作为英雄障碍物，离开需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core = {
            ...core,
            phase: 'haunt',
            activeRoomId: 'hallway',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'hallway',
            },
            scenarioRuntime: {
                ...core.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 12,
                traitorPlayerId: '1',
            },
            monsters: [{
                id: 'test-monster',
                name: '测试怪物',
                portraitAsset: 'betrayal/cards/back-monster',
                roomId: 'hallway',
                might: 3,
                speed: 3,
                damage: 1,
            }],
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
        core.movesRemaining = 1;
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' });
        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.movesRemaining).toBe(0);
    });

it('无叛徒作祟中怪物仍会作为英雄障碍物', () => {
        const baseCore = createStartedFirstScenarioCore();
        const core: BetrayalCore = {
            ...baseCore,
            phase: 'haunt',
            activeRoomId: 'hallway',
            currentExplorer: {
                ...baseCore.currentExplorer,
                roomId: 'hallway',
            },
            scenarioRuntime: {
                ...baseCore.scenarioRuntime,
                hauntTriggered: true,
                hauntCardNumber: 4,
                traitorPlayerId: null,
                hauntTraitorResolution: {
                    hauntCardNumber: 4,
                    policy: 'no-traitor',
                    traitorPlayerId: null,
                    teamModel: 'no-traitor',
                    reasonLabel: '无叛徒',
                    candidatePlayerIds: [],
                    excludedPlayerIds: [],
                    tieBreak: 'none',
                    representativeOnly: true,
                },
            },
            monsters: [{
                id: 'test-monster',
                name: '测试怪物',
                portraitAsset: 'betrayal/cards/back-monster',
                roomId: 'hallway',
                might: 3,
                speed: 3,
                damage: 1,
            }],
        };

        expect(resolveBetrayalMoveCost(core)).toBe(2);
    });

it('图书馆发现时获得 1 点知识', () => {
        let core = createStartedFirstScenarioCore();
        const libraryTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'library')!;
        core.roomDiscoveryOrderByFloor.upper = [
            libraryTemplate,
            libraryTemplate,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgePositionBefore = traitTrackPosition(core, '0', 'knowledge');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('图书馆');
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBefore + 1);
    });

it('书房发现时获得 1 点知识', () => {
        let core = createStartedFirstScenarioCore();
        const studyTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'study')!;
        core.roomDiscoveryOrderByFloor.upper = [
            studyTemplate,
            studyTemplate,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgePositionBefore = traitTrackPosition(core, '0', 'knowledge');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('书房');
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBefore + 1);
    });

it('房间文字提升属性后，后续事件属性检定应使用提升后的骰数', () => {
        let core = createStartedFirstScenarioCore();
        const towerTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'tower')!;
        const eventStudyTemplate = {
            ...towerTemplate,
            name: '测试事件书房',
            hint: '测试用事件符号房间，先结算房间文字再结算事件检定',
            tags: [...towerTemplate.tags, '知识', '调查'],
            discoveryEffect: 'gainKnowledge1' as const,
        };
        core.drawOrder = ['event'];
        core.eventOrder = [
            BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!,
        ];
        setTestRoomDiscoveryDeck(core, [{ floor: 'upper', room: eventStudyTemplate }]);
        setTestExplorerTraits(core, '0', { might: 3, speed: 3, knowledge: 3, sanity: 3 });
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5, 6], 2, 2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgePositionBefore = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'upper-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('测试事件书房');
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.rollLabel).toBe('知识检定');
        expect(core.recentRoll?.dice).toEqual([1, 1, 1, 1]);
        expect(core.recentRoll?.latestLabel).toBe('获得 1 点知识');
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBefore + 2);
    });

it('器械库发现时展示物品牌直到武器，拿取武器并埋葬其余展示牌', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('器械库');
        expect(core.currentExplorer.inventory.map((card) => card.name)).toContain('砍刀');
        expect(core.currentExplorer.inventory.some((card) => card.id.startsWith('hunting-knife-armory-'))).toBe(true);
        expect(core.discardCounts.item).toBe(0);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
        expect(core.possessionOrderByKind.item.map((card) => card.name)).toEqual(['急救包']);
    });

it('器械库无发现符号时不会再按旧运行时顺序抽下一张物品牌', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['item'];
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'flashlight')!,
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('器械库');
        expect(core.currentExplorer.inventory.map((card) => card.name)).toContain('砍刀');
        expect(core.currentExplorer.inventory.some((card) => card.id.startsWith('hunting-knife-armory-'))).toBe(true);
        expect(core.currentExplorer.inventory.some((card) => card.id === 'flashlight-0')).toBe(false);
        expect(core.latestDiscovery?.kind).toBe('none');
        expect(core.latestDiscovery?.title).toBe('器械库');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => step.text)).toEqual([
            '展示后埋葬急救包',
            '器械库获得砍刀',
        ]);
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => step.kind)).toEqual([
            'buried-room-discovery-card',
            'room-discovery-card',
        ]);
        expect(core.pendingCardResolutionQueue.map((resolution) => ({
            stepKind: resolution.stepKind,
            text: resolution.text,
            index: resolution.index,
            total: resolution.total,
            processCards: resolution.processCards?.map((card) => ({
                cardName: card.cardName,
                outcome: card.outcome,
                text: card.text,
            })),
        }))).toEqual([
            {
                stepKind: 'room-discovery-card',
                text: '展示后埋葬急救包；器械库获得砍刀',
                index: 1,
                total: 1,
                processCards: [
                    { cardName: '急救包', outcome: 'buried', text: '展示后埋葬急救包' },
                    { cardName: '砍刀', outcome: 'gained', text: '器械库获得砍刀' },
                ],
            },
        ]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue[0]?.acknowledgedPlayerIds).toEqual(['0']);
        expect(core.pendingCardResolutionQueue.map((resolution) => resolution.index)).toEqual([1]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '1', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue[0]?.acknowledgedPlayerIds).toEqual(['0', '1']);
        expect(core.pendingCardResolutionQueue.map((resolution) => resolution.index)).toEqual([1]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '2', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
        expect(core.discardCounts.item).toBe(0);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
        expect(core.possessionOrderByKind.item.map((card) => card.name)).toEqual(['手电筒', '急救包']);
    });

it('倒塌房间结束回合速度检定失败时坠落并承受物理伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        const traitsBeforeFall = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 2, 1, 3),
        );

        const fallenExplorer = core.currentExplorer;
        expect(fallenExplorer.roomId).toBe('basement-landing');
        expect(fallenExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' }),
        ).valid).toBe(false);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {}),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '0',
            allowedTraits: ['might', 'speed'],
            nextPlayerId: '1',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('basement-landing');
        expect(physicalTraitTotal(core, '0')).toBeLessThan(traitsBeforeFall.might + traitsBeforeFall.speed);
    });

it('兔脚可以重掷倒塌房间结束回合速度检定，并按新结果回算坠落', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
            },
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'rope', name: '兔脚', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'rope'];
        const traitsBeforeFall = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 2),
        );

        const fallenExplorer = core.currentExplorer;
        expect(fallenExplorer.roomId).toBe('basement-landing');
        expect(fallenExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const safeExplorer = core.currentExplorer;
        expect(safeExplorer.roomId).toBe('upper-north');
        expect(safeExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.recentRoll?.latestLabel).toContain('没有坠落');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('upper-north');
    });

it('幸运硬币可以重掷倒塌房间结束回合空白骰，并按新结果取消坠落', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'lucky-coin', name: '幸运硬币', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'lucky-coin'];
        setHighCapacityGeneralDamageTracks(core, '0', 4, 6);
        const traitsBeforeFall = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 3),
        );

        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.currentExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.dice).toEqual([0, 1, 1, 1]);
        expect(resolveRecentRollRerollSelectableDieIndices(core.recentRoll!, 'lucky-coin')).toEqual([0]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM, '0', { cardId: 'lucky-coin', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM,
            '0',
            { cardId: 'lucky-coin', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.currentExplorer.roomId).toBe('upper-north');
        expect(core.currentExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.recentRoll?.dice).toEqual([2, 1, 1, 1]);
        expect(core.recentRoll?.latestLabel).toContain('没有坠落');
        expect(core.usedCardIdsThisTurn).toContain('lucky-coin');
        expect(core.pendingDamageAllocation).toBeNull();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('upper-north');
    });

it('幸运硬币重掷倒塌房间仍为空白时，先分配精神伤害再确认坠落伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'lucky-coin', name: '幸运硬币', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'lucky-coin'];
        setHighCapacityGeneralDamageTracks(core, '0', 4, 6);
        const sanityPositionBeforeLuckyCoin = traitTrackPosition(core, '0', 'sanity');
        const physicalPositionTotalBeforeFall = traitTrackPositionTotal(core, '0', ['might', 'speed']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 3),
        );

        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '1',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM,
            '0',
            { cardId: 'lucky-coin', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.latestLabel).toContain('坠落');
        expect(core.recentRoll?.dice).toEqual([0, 1, 1, 1]);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '幸运硬币',
            damageKind: 'mental',
            amount: 1,
            playerId: '0',
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先分配当前伤害。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', {
            traits: ['sanity'],
        });

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(sanityPositionBeforeLuckyCoin - 1);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {}),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            amount: 2,
            playerId: '0',
            nextPlayerId: '1',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', {
            traits: repeatTraitsForPendingDamage(core, ['might', 'speed']),
        });

        expect(core.currentPlayer).toBe('1');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll).toBeNull();
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('basement-landing');
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(physicalPositionTotalBeforeFall - 2);
    });

it('倒塌房间结束回合速度检定成功时不会坠落或受伤', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');
        core = acknowledgeAnyPendingCardResolutions(core);

        const explorerBefore = { ...core.currentExplorer };
        const mightBefore = core.currentExplorer.traits.might;
        const speedBefore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const safeExplorer = core.currentExplorer;
        expect(safeExplorer.roomId).toBe(explorerBefore.roomId);
        expect(safeExplorer.traits.might).toBe(mightBefore);
        expect(safeExplorer.traits.speed).toBe(speedBefore);
        expect(core.activityLog[0]?.text).toContain('没有坠落');
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
    });

it('狗和面具会让倒塌房间速度检定结果 +1', () => {
        const speedBonusOmens = [
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];

        for (const omen of speedBonusOmens) {
            let core = createStartedFirstScenarioCore();
            core.roomDiscoveryOrderByFloor.upper = [
                BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
            ];
            core.currentExplorer = {
                ...core.currentExplorer,
                traits: {
                    ...core.currentExplorer.traits,
                    speed: 4,
                },
                inventory: [omen],
            };
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [...core.currentExplorer.inventory];

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
            core = acknowledgeAnyPendingCardResolutions(core);

            const mightBefore = core.currentExplorer.traits.might;
            const speedBefore = core.currentExplorer.traits.speed;

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.END_TURN,
                '0',
                {},
                100,
                createBetrayalScriptedRandom(2, 2, 2, 2),
            );

            const explorerAfter = core.currentExplorer;
            expect(explorerAfter.roomId).toBe('upper-north');
            expect(explorerAfter.traits.might).toBe(mightBefore);
            expect(explorerAfter.traits.speed).toBe(speedBefore);
            expect(core.currentPlayer).toBe('0');
            expect(core.recentRoll?.roomEndTurn?.nextPlayerId).toBe('1');
        }
    });
});
