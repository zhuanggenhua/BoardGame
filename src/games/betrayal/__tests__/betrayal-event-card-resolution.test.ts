import { describe, expect, it } from 'vitest';
import { resolveMoveTargetRooms } from '../movementReadModel';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import {
    acknowledgePendingCardResolutions,
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
    setScenarioTestTurnMovement,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    BETRAYAL_DISCOVERY_POOLS,
    resolveInventoryEffectId,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerRoom,
    discoverTestRoom,
    setTestExplorerInventory,
    setTestOmenInventoryForHauntRoll,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    setHighCapacityGeneralDamageTracks,
    traitTrackPosition,
    traitTrackPositionTotal,
    repeatTraitsForPendingDamage,
    expectPendingDamageForTest,
    resolvePendingDamageForTest,
    acknowledgeSingleEventEffectResolution,
    exploreConfiguredEventByName,
    triggerUponReflectionHaunt,
    prepareMirrorCurseBreaker,
    exploreConfiguredEventByNameFromRoom,
    placeActiveTestExplorerInRoom,
    type BetrayalCore,
    type BetrayalTraitKey,
} from './helpers/firstScenarioRuntimeHarness';
import {
    resolveBetrayalHauntSetupCommandPreviews,
    resolveBetrayalHauntSetupProgress,
} from '../hauntSetupModel';
import {
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterTurnRuntimeState,
    resolveBetrayalNormalMonsterAttackTargets,
} from '../monsterActionReadModel';
import { resolveBetrayalHauntTokenInstances } from '../hauntTokenModel';

describe('Betrayal first scenario runtime - event card resolution', () => {
it('最深的壁橱按官方锁定文本执行抽物品、精神伤害和地下室放置分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('最深的壁橱');
        expect(core.latestDiscovery?.detail).toContain('速度检定 4');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4, sanity: 4, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 1');
        expect(core.latestDiscovery?.detail).toContain('受到 1 点精神伤害');
        expectPendingDamageForTest(core, {
            sourceTitle: '最深的壁橱',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        core = resolvePendingDamageForTest(core, ['knowledge']);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.pendingDamageAllocation).toBeNull();

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, might: 4, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 1, 3);
        const mightPositionBeforeClosetDamage = traitTrackPosition(core, '0', 'might');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始点');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expectPendingDamageForTest(core, {
            sourceTitle: '最深的壁橱',
            damageKind: 'physical',
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeClosetDamage);
        core = resolvePendingDamageForTest(core, ['might', 'might']);
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeClosetDamage - 2);
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(2);
        expect(core.pendingDamageAllocation).toBeNull();
    });

it('嘎吱的木门按官方锁定文本执行知识检定和楼层起始点放置', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('嘎吱的木门');
        expect(core.latestDiscovery?.detail).toContain('知识检定 6');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始板块');
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 4');
        expect(core.latestDiscovery?.detail).toContain('放置到地面层起始板块');
        expect(core.currentExplorer.roomId).toBe('grand-staircase');
        expect(core.activeRoomId).toBe('grand-staircase');
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始板块');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('脑状食品按官方锁定文本执行力量检定三档、属性选择和通用伤害分配', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('脑状食品');
        expect(core.latestDiscovery?.detail).toContain('力量检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点力量或速度');
        expect(core.pendingEventChoice?.sourceTitle).toBe('脑状食品');

        const moveBeforeReadingEvent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' }),
        );
        expect(moveBeforeReadingEvent.valid).toBe(false);
        if (!moveBeforeReadingEvent.valid) {
            expect(moveBeforeReadingEvent.error).toContain('请先处理当前事件');
        }

        const endTurnBeforeReadingEvent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(endTurnBeforeReadingEvent.valid).toBe(false);
        if (!endTurnBeforeReadingEvent.valid) {
            expect(endTurnBeforeReadingEvent.error).toContain('请先处理当前事件');
        }

        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {}),
        );
        expect(missingTrait.valid).toBe(false);

        const speedPositionBeforeChoice = core.currentExplorer.traitTracks.speed.position;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeChoice + 1);
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '脑状食品',
            stepKind: 'event-effect',
            text: '事件效果：速度 +1',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.turnEndedByDiscovery).toBe(false);
        expect(core.recentRoll).toBeNull();
        expect(core.recommendedAction).toBe('move');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 4, 5], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [1, 3, 4, 4, 5], 2, 2);
        const speedPositionBeforeCompound = core.currentExplorer.traitTracks.speed.position;
        const sanityPositionBeforeCompound = core.currentExplorer.traitTracks.sanity.position;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 2');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点速度并失去 1 点神志');
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeCompound + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traitTracks.sanity.position).toBe(sanityPositionBeforeCompound - 1);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '0', trait, [1, 3, 4, 5], 2, 2);
        }
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 2 点通用伤害');
        expect(core.pendingEventChoice?.sourceTitle).toBe('脑状食品');

        const missingDamageTraits = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['might'] }),
        );
        expect(missingDamageTraits.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { traits: ['might', 'knowledge'] },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 2（力量、知识）');
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '脑状食品',
            stepKind: 'event-effect',
            text: '事件效果：通用伤害 2（力量、知识）',
            index: 1,
            total: 1,
        });
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('事件一般伤害不能绕过页面分配到作祟前已临界属性', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 2, 1);
        core.pendingEventChoice = {
            id: 'test-critical-general-damage-choice',
            playerId: '0',
            sourceTitle: '临界伤害领域校验',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might', 'speed'],
                recommendedAction: 'endTurn',
            },
        };

        const lockedTraitDamage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['might'] }),
        );
        expect(lockedTraitDamage.valid).toBe(false);

        const validSpeedDamage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['speed'] }),
        );
        expect(validSpeedDamage.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { traits: ['speed'] },
        );

        expect(core.currentExplorer.traitTracks.might.position).toBe(0);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(1);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（速度）');
    });

it('上古旧宅按官方锁定文本选择速度或力量检定、目标板块和伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 5,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 4, 3);
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3, 4, 5], 3, 3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('上古旧宅');
        expect(core.pendingEventChoice?.sourceTitle).toBe('上古旧宅');
        const missingTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' }),
        );
        expect(missingTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'upper-landing' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('速度检定 10');
        expect(core.latestDiscovery?.detail).toContain('放置到任意板块');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始点');
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '上古旧宅', '放置到上层起始点');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        const invalidUpperTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'might',
                targetRoomId: 'upper-landing',
                traits: ['might'],
            }),
        );
        expect(invalidUpperTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'might', targetRoomId: 'hallway', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 4');
        expect(core.latestDiscovery?.detail).toContain('放置到任意地面层板块，并受到 1 点通用伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（力量）');
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '上古旧宅', '通用伤害 1（力量）');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 2,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        const invalidGroundTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'speed',
                targetRoomId: 'hallway',
            }),
        );
        expect(invalidGroundTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'basement-landing' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 2');
        expect(core.latestDiscovery?.detail).toContain('放置到任意地下室板块，并受到 1 点精神伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始点');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expectPendingDamageForTest(core, {
            sourceTitle: '上古旧宅',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        core = resolvePendingDamageForTest(core, ['knowledge']);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '上古旧宅', '精神伤害');
    });

it('吊死鬼按官方锁定文本执行四项属性连续检定', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 3,
                speed: 3,
                knowledge: 3,
                sanity: 3,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '0', trait, [1, 2, 2, 3, 4], 3);
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('吊死鬼');
        expect(core.latestDiscovery?.detail).toContain('每项属性各检定一次');
        expect(core.recentAllTraitCheck?.results.map((result) => [result.trait, result.total, result.passed])).toEqual([
            ['might', 4, true],
            ['speed', 0, false],
            ['knowledge', 4, true],
            ['sanity', 0, false],
        ]);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(2);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(2);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 3,
                speed: 3,
                knowledge: 3,
                sanity: 3,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '0', trait, [1, 2, 2, 3, 4], 3);
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2),
        );

        expect(core.recentAllTraitCheck?.results.every((result) => result.passed)).toBe(true);
        expect(core.pendingEventChoice?.sourceTitle).toBe('吊死鬼');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        core = acknowledgeSingleEventEffectResolution(core, '吊死鬼', '知识 +1');
    });

it('一条秘密通道按官方锁定文本放置秘密通道标志物并选择第二目标板块', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('一条秘密通道');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('secretPassage');

        const invalidSameRoom = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'ground-north' }),
        );
        expect(invalidSameRoom.valid).toBe(false);

        const knowledgePositionBeforeSecretPassage = traitTrackPosition(core, '0', 'knowledge');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'basement-landing' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBeforeSecretPassage + 1);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'basement-landing')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.latestDiscovery?.detail).toContain('在当前板块放置秘密通道标志物');
        expect(core.latestDiscovery?.detail).toContain('在地下室起始点放置秘密通道标志物');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-landing');

        core.movesRemaining = 1;
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一条秘密通道',
            stepKind: 'event-effect',
            text: expect.stringContaining('秘密通道'),
            index: 1,
            total: 1,
        });
        const moveBeforeAcknowledgingSecretPassage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(moveBeforeAcknowledgingSecretPassage.valid).toBe(false);
        if (!moveBeforeAcknowledgingSecretPassage.valid) {
            expect(moveBeforeAcknowledgingSecretPassage.error).toContain('请先确认当前翻牌结算');
        }
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        const sameTurnSecretPassageMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(sameTurnSecretPassageMove.valid).toBe(false);
        if (!sameTurnSecretPassageMove.valid) {
            expect(sameTurnSecretPassageMove.error).toContain('回合已经结束');
        }

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        const invalidUpperTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'upper-landing' }),
        );
        expect(invalidUpperTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'hallway' },
        );

        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'hallway')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一条秘密通道',
            stepKind: 'event-effect',
            text: expect.stringContaining('秘密通道'),
            index: 1,
            total: 1,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'basement-landing' },
        );

        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'basement-landing')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一条秘密通道',
            stepKind: 'event-effect',
            text: expect.stringContaining('秘密通道'),
            index: 1,
            total: 1,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
    });

it('蜘蛛按官方锁定文本选择属性并放置到相邻板块', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 4, 5], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [1, 3, 4, 4, 5], 2, 2);
        const speedPositionBeforeSpiderChoice = core.currentExplorer.traitTracks.speed.position;
        const sanityPositionBeforeSpiderChoice = core.currentExplorer.traitTracks.sanity.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('蜘蛛！');
        expect(core.pendingEventChoice?.sourceTitle).toBe('蜘蛛！');

        const invalidTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'speed',
                targetRoomId: 'upper-landing',
            }),
        );
        expect(invalidTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'hallway' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeSpiderChoice + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorerTraits.speed).toBe(core.currentExplorer.traits.speed);
        expect(core.currentExplorer.traitTracks.sanity.position).toBe(sanityPositionBeforeSpiderChoice);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.currentExplorerTraits.sanity).toBe(core.currentExplorer.traits.sanity);
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        core = acknowledgeSingleEventEffectResolution(core, '蜘蛛！', '速度 +1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 5], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [1, 3, 4, 5], 2, 2);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '蜘蛛！', '神志 -1');
    });

it.each([
        { eventName: '不可能的房间', randomResults: [3, 3, 3, 3], expectedDetail: '抽取一张物品卡' },
        { eventName: '地狱蝙蝠', randomResults: [3, 3, 3, 3], expectedDetail: '放置到相邻板块', expectedPendingMode: 'placeExplorerInAdjacentRoom' },
        { eventName: '断手', randomResults: [], expectedDetail: '可选择承受伤害并抽取物品', expectedPendingMode: 'optionalEffect' },
        { eventName: '怪异的镜子', randomResults: [], expectedDetail: '可选择进行作祟检定', expectedPendingMode: 'optionalHauntRoll' },
        { eventName: '花团锦簇', randomResults: [], expectedDetail: '通用伤害 1', expectedPendingMode: 'compound' },
        { eventName: '晦暗暴风夜', randomResults: [3, 3, 3, 3], expectedDetail: '神志 +1' },
        { eventName: '技术难点', randomResults: [], expectedDetail: '放置到下一楼层起始点', expectedRoomId: 'basement-landing' },
        { eventName: '佳馔满桌', randomResults: [], expectedDetail: '选择知识或神志进行检定', expectedPendingMode: 'chooseTraitRoll' },
        { eventName: '禁忌知识', randomResults: [2, 2, 1, 1], expectedDetail: '获得 1 点知识并失去 1 点神志' },
        { eventName: '可怜的尤里克', randomResults: [3, 3, 3, 3], expectedDetail: '知识 +1' },
        { eventName: '轮到约拿了', randomResults: [], expectedDetail: '可选择弃置非武器物品', expectedPendingMode: 'optionalItemEffect' },
        { eventName: '秘密升降机', randomResults: [], expectedDetail: '不同区域', expectedPendingMode: 'placeExplorerInDiscoveredRoomByFloor' },
        { eventName: '神秘液体', randomResults: [], expectedDetail: '可选择喝下神秘液体', expectedPendingMode: 'optionalEventRoll' },
        { eventName: '无线电广播', randomResults: [3, 3], expectedDetail: '知识 +1' },
        { eventName: '摇曳灯光', randomResults: [], expectedDetail: '选择速度或力量进行检定', expectedPendingMode: 'chooseTraitRoll' },
        { eventName: '一罐器官', randomResults: [1, 1, 1, 1], expectedDetail: '力量 -1' },
        { eventName: '一声呼救', randomResults: [3, 3, 3, 3], expectedDetail: '放置在所在区域的任意板块', expectedPendingMode: 'placeExplorerInDiscoveredRoomByFloor' },
        { eventName: '着火的人', randomResults: [2, 2, 1, 1], expectedDetail: '放置到入口大厅', expectedRoomId: 'entrance-hall' },
        { eventName: '片刻希望', randomResults: [], expectedDetail: '放置祝福' },
        { eventName: '游魂', randomResults: [], expectedDetail: '可选择埋葬一件物品', expectedPendingMode: 'optionalItemEffect' },
    ])('新增配置事件 $eventName 探索时进入运行消费入口', ({
        eventName,
        randomResults,
        expectedDetail,
        expectedPendingMode,
        expectedRoomId,
    }) => {
        const core = exploreConfiguredEventByName(eventName, randomResults);

        expect(core.latestDiscovery?.title).toBe(eventName);
        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        if (expectedPendingMode) {
            expect(core.pendingEventChoice).toMatchObject({
                sourceTitle: eventName,
                effect: { mode: expectedPendingMode },
            });
            expect(core.turnEndedByDiscovery).toBe(false);
        } else {
            expect(core.pendingEventChoice).toBeNull();
        }
        if (expectedRoomId) {
            expect(core.currentExplorer.roomId).toBe(expectedRoomId);
        }
    });

it('新增配置事件的待选择效果可以通过玩家指令完成最小结算', () => {
        let core = exploreConfiguredEventByName('地狱蝙蝠', [3, 3, 3, 3]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'hallway' });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        core = acknowledgeSingleEventEffectResolution(core, '地狱蝙蝠', '放置到门厅');

        core = exploreConfiguredEventByName('断手');
        const brokenHandInventoryBefore = core.currentExplorer.inventory.length;
        const brokenHandPhysicalBefore = traitTrackPositionTotal(core, '0', ['might', 'speed']);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.inventory).toHaveLength(brokenHandInventoryBefore + 1);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '断手',
            damageKind: 'physical',
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(brokenHandPhysicalBefore);
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['might', 'speed']));
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(brokenHandPhysicalBefore - 2);
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        core = acknowledgeSingleEventEffectResolution(core, '断手', '抽取一张物品卡');

        core = exploreConfiguredEventByName('怪异的镜子');
        const mirrorInventoryBefore = core.currentExplorer.inventory.length;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.inventory).toHaveLength(mirrorInventoryBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        core = acknowledgeSingleEventEffectResolution(core, '怪异的镜子', '抽取一张物品卡');

        core = exploreConfiguredEventByName('花团锦簇');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
            targetRoomId: 'hallway',
            traits: ['might'],
        });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（力量）');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        core = acknowledgeSingleEventEffectResolution(core, '花团锦簇', '通用伤害 1（力量）');

        core = exploreConfiguredEventByName('佳馔满桌');
        const feastSpeedBefore = traitTrackPosition(core, '0', 'speed');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.trait).toBe('knowledge');
        expect(traitTrackPosition(core, '0', 'speed')).toBe(feastSpeedBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        core = acknowledgeSingleEventEffectResolution(core, '佳馔满桌', '速度 +1');

        core = exploreConfiguredEventByName('秘密升降机');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'upper-landing' });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始点');
        core = acknowledgeSingleEventEffectResolution(core, '秘密升降机', '放置到上层起始点');

        core = exploreConfiguredEventByName('神秘液体');
        const mysteryTraitPositionsBefore = {
            might: traitTrackPosition(core, '0', 'might'),
            speed: traitTrackPosition(core, '0', 'speed'),
            knowledge: traitTrackPosition(core, '0', 'knowledge'),
            sanity: traitTrackPosition(core, '0', 'sanity'),
        };
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(traitTrackPosition(core, '0', 'might')).toBe(mysteryTraitPositionsBefore.might + 1);
        expect(traitTrackPosition(core, '0', 'speed')).toBe(mysteryTraitPositionsBefore.speed + 1);
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(mysteryTraitPositionsBefore.knowledge + 1);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(mysteryTraitPositionsBefore.sanity + 1);
        expect(core.latestDiscovery?.detail).toContain('每项属性 +1');
        core = acknowledgeSingleEventEffectResolution(core, '神秘液体', '每项属性 +1');

        core = exploreConfiguredEventByName('摇曳灯光');
        const flickerSpeedBefore = traitTrackPosition(core, '0', 'speed');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.trait).toBe('speed');
        expect(traitTrackPosition(core, '0', 'speed')).toBe(flickerSpeedBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        core = acknowledgeSingleEventEffectResolution(core, '摇曳灯光', '速度 +1');

        core = exploreConfiguredEventByName('一声呼救', [3, 3, 3, 3]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'hallway' });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        core = acknowledgeSingleEventEffectResolution(core, '一声呼救', '放置到门厅');
    });

it('新增配置事件的房间目标会按卡面范围拒绝非法板块', () => {
        let core = exploreConfiguredEventByName('地狱蝙蝠', [3, 3, 3, 3]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'entrance-hall' }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个已发现的相邻板块。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'ground-east' }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个已发现的相邻板块。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'hallway' });
        expect(core.currentExplorer.roomId).toBe('hallway');

        core = exploreConfiguredEventByName('秘密升降机');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'hallway' }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个有效目标板块。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'ground-east' }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个有效目标板块。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'upper-landing' });
        expect(core.currentExplorer.roomId).toBe('upper-landing');

        core = exploreConfiguredEventByName('一声呼救', [3, 3, 3, 3]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'upper-landing' }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个有效目标板块。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'ground-east' }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个有效目标板块。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'hallway' });
        expect(core.currentExplorer.roomId).toBe('hallway');

        core = exploreConfiguredEventByName('花团锦簇');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                targetRoomId: 'upper-landing',
                traits: ['might'],
            }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个有效目标板块。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                targetRoomId: 'basement-landing',
                traits: ['might'],
            }),
        )).toMatchObject({ valid: true });

        core = exploreConfiguredEventByName('花团锦簇', [], (draft) => {
            draft.rooms = draft.rooms.map((room) => (
                room.id === 'hallway'
                    ? { ...room, visualId: 'conservatory', name: '温室' }
                    : room
            ));
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                targetRoomId: 'entrance-hall',
                traits: ['might'],
            }),
        )).toMatchObject({
            valid: false,
            error: '该事件必须选择一个有效目标板块。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
            targetRoomId: 'hallway',
            traits: ['might'],
        });
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('放置到温室');
    });

it('怪异的镜子作祟检定成功会进入 7 号作祟代表揭示态', () => {
        const core = triggerUponReflectionHaunt();

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(7);
        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('upon-reflection');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntTraitorResolution?.teamModel).toBe('no-traitor');
        expect(core.scenarioRuntime.hauntFirstPlayerResolution?.reasonLabel).toBe('作祟揭秘者左侧玩家先行动');
        expect(core.scenarioRuntime.hauntResolutionRepresentativeOnly).toBe(true);
        expect(core.scenarioRuntime.uponReflection?.revealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.uponReflection?.secretCombination).toMatchObject({
            trait: expect.any(String),
            omenId: expect.any(String),
            omenName: expect.any(String),
            roomName: expect.any(String),
        });
        const mirrorBeings = core.monsters.filter((monster) => monster.definitionId === 'upon-reflection-mirror-being');
        expect(mirrorBeings).toHaveLength(2);
        expect(mirrorBeings.every((monster) => monster.roomId === 'entrance-hall')).toBe(true);
        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            active: true,
            hauntCardNumber: 7,
            status: 'manual-check-required',
            resolvedCount: 4,
            manualCheckCount: 2,
            representativeOnly: true,
        });
        const previews = resolveBetrayalHauntSetupCommandPreviews(core).previews;
        expect(previews).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entryId: 'place-mirror-beings',
                    queueStatus: 'resolved',
                    action: 'place-monster-tokens',
                    targetMonsterIds: mirrorBeings.map((monster) => monster.id),
                }),
                expect.objectContaining({
                    entryId: 'deal-secret-mirror-combination',
                    queueStatus: 'resolved',
                    evidence: ['秘密组合已写入作祟揭秘者私密状态。'],
                }),
            ]),
        );
        expect(previews.find((preview) => preview.entryId === 'deal-secret-mirror-combination')?.contractGaps)
            .not.toContain('full-haunt-definition');
    });

it('镜中怪物普通攻击按神志结算精神伤害', () => {
        let core = triggerUponReflectionHaunt();
        const revealerPlayerId = core.scenarioRuntime.uponReflection!.revealerPlayerId;
        const mirrorBeing = core.monsters.find((monster) => monster.definitionId === 'upon-reflection-mirror-being');
        expect(mirrorBeing).toBeDefined();
        const targetHeroId = '1';
        const mirrorRoomId = mirrorBeing!.roomId;
        findTestExplorer(core, targetHeroId).roomId = mirrorRoomId;
        setHighCapacityGeneralDamageTracks(core, targetHeroId);
        const heroPhysicalPositionBefore = traitTrackPositionTotal(core, targetHeroId, ['might', 'speed']);
        const heroMentalPositionBefore = traitTrackPositionTotal(core, targetHeroId, ['knowledge', 'sanity']);

        expect(resolveBetrayalNormalMonsterAttackTargets(core, mirrorBeing!.id)).toMatchObject({
            defaultAttackTrait: 'sanity',
            targetPlayerIds: expect.arrayContaining([targetHeroId]),
            canResolveWithExistingCommand: true,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            revealerPlayerId,
            { monsterId: mirrorBeing!.id, targetPlayerId: targetHeroId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            sourceTitle: '镜中怪物攻击',
            attack: {
                target: 'hero',
                defenderPlayerId: targetHeroId,
                damageKind: 'mental',
                weaponAttackTrait: 'sanity',
            },
        });
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            playerId: targetHeroId,
            damageKind: 'mental',
            allowedTraits: ['knowledge', 'sanity'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, targetHeroId, ['might', 'speed'])).toBe(heroPhysicalPositionBefore);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            targetHeroId,
            { traits: repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']) },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, targetHeroId, ['might', 'speed'])).toBe(heroPhysicalPositionBefore);
        expect(traitTrackPositionTotal(core, targetHeroId, ['knowledge', 'sanity'])).toBeLessThan(heroMentalPositionBefore);
    });

it('镜中怪物移动目标只允许朝最近探索者缩短距离', () => {
        const core = triggerUponReflectionHaunt();
        const mirrorBeing = core.monsters.find((monster) => monster.definitionId === 'upon-reflection-mirror-being');
        expect(mirrorBeing).toBeDefined();
        discoverTestRoom(core, 'ground-east', '东侧测试房间');
        setTestExplorerRoom(core, '0', 'entrance-hall');
        setTestExplorerRoom(core, '1', 'hallway');
        setTestExplorerRoom(core, '2', 'basement-landing');
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: [mirrorBeing!.id],
            skippedMonsterIdsThisTurn: [],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: { [mirrorBeing!.id]: 3 },
        };

        expect(resolveBetrayalMonsterMoveTargetRooms(core, mirrorBeing!.id).map((room) => room.id))
            .toEqual(['hallway']);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, core.currentPlayer, {
                monsterId: mirrorBeing!.id,
                roomId: 'ground-east',
            }),
        )).toMatchObject({ valid: false });
    });

it('镜中怪物最近距离平手时允许作祟揭秘者选择任一等距路径', () => {
        let core = triggerUponReflectionHaunt();
        const revealerPlayerId = core.scenarioRuntime.uponReflection!.revealerPlayerId;
        const mirrorBeing = core.monsters.find((monster) => monster.definitionId === 'upon-reflection-mirror-being');
        expect(mirrorBeing).toBeDefined();
        discoverTestRoom(core, 'ground-east', '东侧测试房间');
        setTestExplorerRoom(core, '0', 'entrance-hall');
        setTestExplorerRoom(core, '1', 'hallway');
        setTestExplorerRoom(core, '2', 'ground-east');
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: [mirrorBeing!.id],
            skippedMonsterIdsThisTurn: [],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: { [mirrorBeing!.id]: 3 },
        };

        expect(resolveBetrayalMonsterMoveTargetRooms(core, mirrorBeing!.id).map((room) => room.id).sort())
            .toEqual(['ground-east', 'hallway']);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, revealerPlayerId, {
                monsterId: mirrorBeing!.id,
                roomId: 'ground-east',
            }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, revealerPlayerId, {
            monsterId: mirrorBeing!.id,
            roomId: 'ground-east',
        });

        expect(core.monsters.find((monster) => monster.id === mirrorBeing!.id)?.roomId)
            .toBe('ground-east');
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById[mirrorBeing!.id])
            .toBe(2);
    });

it('镜中怪物已同房时不允许离开最近探索者所在房间', () => {
        const core = triggerUponReflectionHaunt();
        const mirrorBeing = core.monsters.find((monster) => monster.definitionId === 'upon-reflection-mirror-being');
        expect(mirrorBeing).toBeDefined();
        discoverTestRoom(core, 'ground-east', '东侧测试房间');
        setTestExplorerRoom(core, '0', 'entrance-hall');
        setTestExplorerRoom(core, '1', 'entrance-hall');
        setTestExplorerRoom(core, '2', 'basement-landing');
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: [mirrorBeing!.id],
            skippedMonsterIdsThisTurn: [],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: { [mirrorBeing!.id]: 3 },
        };

        expect(resolveBetrayalMonsterMoveTargetRooms(core, mirrorBeing!.id)).toEqual([]);
        expect(resolveBetrayalNormalMonsterAttackTargets(core, mirrorBeing!.id)).toMatchObject({
            targetPlayerIds: expect.arrayContaining(['1']),
            canResolveWithExistingCommand: true,
        });
        expect(resolveBetrayalNormalMonsterAttackTargets(core, mirrorBeing!.id)?.targetPlayerIds)
            .not.toContain('0');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, core.currentPlayer, {
                monsterId: mirrorBeing!.id,
                roomId: 'hallway',
            }),
        )).toMatchObject({ valid: false });
    });

it('怪异的镜子秘密组合只对作祟揭秘者可见', () => {
        const core = triggerUponReflectionHaunt();

        const revealerView = BetrayalDomain.playerView?.(core, '0') as BetrayalCore;
        const heroView = BetrayalDomain.playerView?.(core, '1') as BetrayalCore;

        expect(revealerView.scenarioRuntime.uponReflection?.secretCombination)
            .toEqual(core.scenarioRuntime.uponReflection?.secretCombination);
        expect(heroView.scenarioRuntime.uponReflection?.secretCombination).toBeNull();
        expect(heroView.scenarioRuntime.uponReflection?.revealerPlayerId).toBe('0');
    });

it('怪异的镜子作祟中探索事件符号房间不抽事件且不结束回合', () => {
        let core = triggerUponReflectionHaunt();
        activateTestExplorer(core, '1');
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        const eventCard: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        };
        core.eventOrder = [eventCard];
        core.deckCounts.event = core.eventOrder.length;
        const eventOrderBefore = core.eventOrder.map((event) => event.name);
        const discardCountBefore = core.discardCounts.event;
        const mightBefore = core.currentExplorer.traits.might;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: targetRoomId! });

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '事件符号',
            summary: '镜中沉默',
            detail: expect.stringContaining('不会结束回合'),
        });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.discardCounts.event).toBe(discardCountBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(eventOrderBefore);
        expect(core.turnEndedByDiscovery).toBe(false);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(7);
        expect(core.activityLog[0]?.text).toContain('镜中沉默使事件符号无事发生');
    });

it('作祟揭秘者镜中提示会把所选事件牌放一边且不结算事件', () => {
        let core = triggerUponReflectionHaunt();
        activateTestExplorer(core, '0');
        const hintedEvent: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        };
        const remainingEvent: BetrayalCore['eventOrder'][number] = {
            name: '远处低语',
            text: '远处有人低语。进行 1 次神志检定。',
        };
        core.eventOrder = [hintedEvent, remainingEvent];
        core.deckCounts.event = core.eventOrder.length;
        core.discardCounts.event = 0;
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.GIVE_MIRROR_HINT,
            '0',
            { eventName: '阴影扑面', targetPlayerId: '1' },
        );

        expect(core.eventOrder.map((event) => event.name)).toEqual(['远处低语']);
        expect(core.deckCounts.event).toBe(1);
        expect(core.discardCounts.event).toBe(0);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.scenarioRuntime.uponReflection?.hintedEvents).toEqual([
            expect.objectContaining({
                revealerPlayerId: '0',
                targetPlayerId: '1',
                eventName: '阴影扑面',
                eventText: '阴影扑向你。失去 1 点力量。',
                turnNumber: core.turnNumber,
            }),
        ]);
        expect(core.activityLog[0]?.text).toContain('该事件不结算并放到一边');
    });

it('非作祟揭秘者不能使用镜中提示', () => {
        const core = triggerUponReflectionHaunt();
        core.eventOrder = [{
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        }];
        core.deckCounts.event = core.eventOrder.length;

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '1', {
                eventName: '阴影扑面',
                targetPlayerId: '1',
            }),
        )).toMatchObject({
            valid: false,
            error: '只有作祟揭秘者能给出镜中提示。',
        });
    });

it('镜中提示不能选择不存在的事件牌，且同回合只能给一次提示', () => {
        let core = triggerUponReflectionHaunt();
        activateTestExplorer(core, '0');
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
            {
                name: '远处低语',
                text: '远处有人低语。进行 1 次神志检定。',
            },
        ];
        core.deckCounts.event = core.eventOrder.length;

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '0', {
                eventName: '不存在的事件',
                targetPlayerId: '1',
            }),
        )).toMatchObject({
            valid: false,
            error: '镜中提示只能选择当前事件牌堆中的事件牌。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.GIVE_MIRROR_HINT,
            '0',
            { eventName: '阴影扑面', targetPlayerId: '1' },
        );

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.GIVE_MIRROR_HINT, '0', {
                eventName: '远处低语',
                targetPlayerId: '1',
            }),
        )).toMatchObject({
            valid: false,
            error: '作祟揭秘者本回合已经给过镜中提示。',
        });
    });

it('破咒 0-4 不给反馈且不会结束怪异的镜子作祟', () => {
        let core = triggerUponReflectionHaunt();
        const attempt = prepareMirrorCurseBreaker(core);
        setTestTraitTrack(core, '1', attempt.trait, [1], 0, 0);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE,
            '1',
            { trait: attempt.trait, omenId: attempt.omenId },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll).toMatchObject({
            kind: 'hauntActionTraitCheck',
            sourceTitle: '破咒',
            latestLabel: '无反馈',
        });
        expect(core.scenarioRuntime.uponReflection?.breakAttempts).toHaveLength(1);
        expect(core.scenarioRuntime.uponReflection?.breakAttempts[0]).toMatchObject({
            playerId: '1',
            successRoll: false,
            combinationCorrect: false,
        });
    });

it('破咒 5+ 但组合不正确时只给否定反馈且不泄露秘密项', () => {
        let core = triggerUponReflectionHaunt();
        const secret = core.scenarioRuntime.uponReflection?.secretCombination;
        if (!secret) {
            throw new Error('测试夹具缺少怪异的镜子秘密组合');
        }
        const wrongTrait = (['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[])
            .find((trait) => trait !== secret.trait)!;
        const attempt = prepareMirrorCurseBreaker(core, '1', wrongTrait);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE,
            '1',
            { trait: wrongTrait, omenId: attempt.omenId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('组合不正确');
        expect(core.scenarioRuntime.uponReflection?.breakAttempts[0]).toMatchObject({
            successRoll: true,
            combinationCorrect: false,
        });
        const publicFeedback = [
            core.recentRoll?.latestLabel,
            ...core.activityLog.map((entry) => entry.text),
        ].join(' ');
        expect(publicFeedback).not.toContain(secret.omenName);
        expect(publicFeedback).not.toContain(secret.roomName);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE, '1', {
                trait: wrongTrait,
                omenId: attempt.omenId,
            }),
        )).toMatchObject({
            valid: false,
            error: '该作祟特殊行动本回合已经使用。',
        });
    });

it('破咒 5+ 且 Trait/Omen/Room 全中会让英雄赢得怪异的镜子', () => {
        let core = triggerUponReflectionHaunt();
        const attempt = prepareMirrorCurseBreaker(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE,
            '1',
            { trait: attempt.trait, omenId: attempt.omenId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'upon-reflection',
            outcome: 'survivors',
        });
        expect(core.recentRoll?.latestLabel).toBe('破咒成功');
        expect(core.activityLog.map((entry) => entry.text).join(' ')).toContain('英雄破除镜中诅咒');
    });

it('作祟揭秘者不能执行破咒', () => {
        const core = triggerUponReflectionHaunt();
        const attempt = prepareMirrorCurseBreaker(core, '0');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE, '0', {
                trait: attempt.trait,
                omenId: attempt.omenId,
            }),
        )).toMatchObject({
            valid: false,
            error: '作祟揭秘者被困镜中，不能执行破咒。',
        });
    });

it('新增配置事件的剩余可配置分支会按规则写入状态', () => {
        let core = exploreConfiguredEventByName('断手');
        const brokenHandInventoryBefore = core.currentExplorer.inventory.length;
        const brokenHandPhysicalBefore = traitTrackPositionTotal(core, '0', ['might', 'speed']);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.inventory).toHaveLength(brokenHandInventoryBefore);
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(brokenHandPhysicalBefore);
        expect(core.latestDiscovery?.detail).toContain('无事发生');

        core = exploreConfiguredEventByName('怪异的镜子', [], (draft) => {
            setTestOmenInventoryForHauntRoll(draft);
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
        });
        expect(core.pendingEventChoice?.effect.mode).toBe('optionalHauntRoll');
        const mirrorSanityBefore = traitTrackPosition(core, '0', 'sanity');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.phase).toBe('preHaunt');
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(mirrorSanityBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        core = acknowledgeSingleEventEffectResolution(core, '怪异的镜子', '神志 +1');

        core = exploreConfiguredEventByName('佳馔满桌', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
            setTestTraitTrack(draft, '0', 'speed', [1, 2, 3, 4, 5], 2, 2);
        });
        const feastSanitySpeedBefore = traitTrackPosition(core, '0', 'speed');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'sanity', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(3, 3, 2),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.trait).toBe('sanity');
        expect(traitTrackPosition(core, '0', 'speed')).toBe(feastSanitySpeedBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('速度 +1');

        core = exploreConfiguredEventByName('佳馔满桌', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'sanity', [1, 1, 1, 1, 1], 3, 3);
        });
        const feastFailurePhysicalBefore = traitTrackPositionTotal(core, '0', ['might', 'speed']);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'sanity', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.trait).toBe('sanity');
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(feastFailurePhysicalBefore - 1);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（力量）');

        core = exploreConfiguredEventByName('神秘液体');
        const mysteriousDeclinePositions = {
            might: traitTrackPosition(core, '0', 'might'),
            speed: traitTrackPosition(core, '0', 'speed'),
            knowledge: traitTrackPosition(core, '0', 'knowledge'),
            sanity: traitTrackPosition(core, '0', 'sanity'),
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });
        expect(core.pendingEventChoice).toBeNull();
        expect(traitTrackPosition(core, '0', 'might')).toBe(mysteriousDeclinePositions.might);
        expect(traitTrackPosition(core, '0', 'speed')).toBe(mysteriousDeclinePositions.speed);
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(mysteriousDeclinePositions.knowledge);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(mysteriousDeclinePositions.sanity);
        expect(core.latestDiscovery?.detail).toContain('无事发生');

        const mysteryLiquidCases = [
            {
                rolls: [3, 3, 2],
                expectedDetail: '力量与速度 +1',
                deltas: { might: 1, speed: 1, knowledge: 0, sanity: 0 },
            },
            {
                rolls: [3, 2, 2],
                expectedDetail: '知识与神志 +1',
                deltas: { might: 0, speed: 0, knowledge: 1, sanity: 1 },
            },
            {
                rolls: [3, 2, 1],
                expectedDetail: '知识 +1，力量 -1',
                deltas: { might: -1, speed: 0, knowledge: 1, sanity: 0 },
            },
            {
                rolls: [2, 2, 1],
                expectedDetail: '知识与神志 -1',
                deltas: { might: 0, speed: 0, knowledge: -1, sanity: -1 },
            },
            {
                rolls: [2, 1, 1],
                expectedDetail: '力量与速度 -1',
                deltas: { might: -1, speed: -1, knowledge: 0, sanity: 0 },
            },
            {
                rolls: [1, 1, 1],
                expectedDetail: '每项属性 -1',
                deltas: { might: -1, speed: -1, knowledge: -1, sanity: -1 },
            },
        ] as const;

        for (const { rolls, expectedDetail, deltas } of mysteryLiquidCases) {
            core = exploreConfiguredEventByName('神秘液体', [], (draft) => {
                for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                    setTestTraitTrack(draft, '0', trait, [1, 2, 3, 4, 5], 2, 2);
                }
            });
            const before = {
                might: traitTrackPosition(core, '0', 'might'),
                speed: traitTrackPosition(core, '0', 'speed'),
                knowledge: traitTrackPosition(core, '0', 'knowledge'),
                sanity: traitTrackPosition(core, '0', 'sanity'),
            };
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '0',
                { accept: true },
                100,
                createBetrayalScriptedRandom(...rolls),
            );
            expect(core.pendingEventChoice).toBeNull();
            expect(traitTrackPosition(core, '0', 'might')).toBe(before.might + deltas.might);
            expect(traitTrackPosition(core, '0', 'speed')).toBe(before.speed + deltas.speed);
            expect(traitTrackPosition(core, '0', 'knowledge')).toBe(before.knowledge + deltas.knowledge);
            expect(traitTrackPosition(core, '0', 'sanity')).toBe(before.sanity + deltas.sanity);
            expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        }

        core = exploreConfiguredEventByName('摇曳灯光', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'might', [1, 2, 3, 4, 5], 2, 2);
            setTestTraitTrack(draft, '0', 'speed', [1, 2, 3, 4, 5], 2, 2);
        });
        const flickerMightSpeedBefore = traitTrackPosition(core, '0', 'speed');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'might' },
            100,
            createBetrayalScriptedRandom(3, 3, 2),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.trait).toBe('might');
        expect(traitTrackPosition(core, '0', 'speed')).toBe(flickerMightSpeedBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('速度 +1');

        core = exploreConfiguredEventByName('摇曳灯光', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'might', [1, 1, 1, 1, 1], 3, 3);
        });
        const flickerPhysicalBefore = traitTrackPositionTotal(core, '0', ['might', 'speed']);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'might' },
            100,
            createBetrayalScriptedRandom(1, 3),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.kind).toBe('eventRolledDamage');
        expect(core.recentRoll?.sourceEventRoll?.trait).toBe('might');
        expectPendingDamageForTest(core, {
            sourceTitle: '摇曳灯光',
            damageKind: 'physical',
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(flickerPhysicalBefore);
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['might', 'speed']));
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(flickerPhysicalBefore - 2);
        expect(core.pendingDamageAllocation).toBeNull();
    });

it('新增配置事件的自动分支会写入属性、移动或抽牌状态', () => {
        let itemDeckBefore = 0;
        let core = exploreConfiguredEventByName('不可能的房间', [3, 3, 3, 3], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            itemDeckBefore = draft.deckCounts.item;
        });
        expect(core.currentExplorer.inventory).toHaveLength(1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');

        let sanityPositionBefore = 0;
        core = exploreConfiguredEventByName('晦暗暴风夜', [3, 3, 3, 3], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
            sanityPositionBefore = traitTrackPosition(draft, '0', 'sanity');
        });
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(sanityPositionBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('神志 +1');

        let knowledgePositionBefore = 0;
        core = exploreConfiguredEventByName('可怜的尤里克', [3, 3, 3, 3], (draft) => {
            setTestTraitTrack(draft, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
            knowledgePositionBefore = traitTrackPosition(draft, '0', 'knowledge');
        });
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('知识 +1');

        let forbiddenKnowledgeBefore = 0;
        let forbiddenSanityBefore = 0;
        core = exploreConfiguredEventByName('禁忌知识', [2, 2, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
            forbiddenKnowledgeBefore = traitTrackPosition(draft, '0', 'knowledge');
            forbiddenSanityBefore = traitTrackPosition(draft, '0', 'sanity');
        });
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(forbiddenKnowledgeBefore + 1);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(forbiddenSanityBefore - 1);
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识并失去 1 点神志');

        let radioKnowledgeBefore = 0;
        core = exploreConfiguredEventByName('无线电广播', [3, 3], (draft) => {
            setTestTraitTrack(draft, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
            radioKnowledgeBefore = traitTrackPosition(draft, '0', 'knowledge');
        });
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(radioKnowledgeBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('知识 +1');

        let organMightBefore = 0;
        core = exploreConfiguredEventByName('一罐器官', [1, 1, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'might', [1, 2, 3, 4, 5], 2, 2);
            organMightBefore = traitTrackPosition(draft, '0', 'might');
        });
        expect(traitTrackPosition(core, '0', 'might')).toBe(organMightBefore - 1);
        expect(core.latestDiscovery?.detail).toContain('力量 -1');

        let organItemDeckBefore = 0;
        core = exploreConfiguredEventByName('一罐器官', [3, 3, 3, 3], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            organItemDeckBefore = draft.deckCounts.item;
        });
        expect(core.currentExplorer.inventory).toHaveLength(1);
        expect(core.deckCounts.item).toBe(organItemDeckBefore - 1);
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');

        let technicalMentalBefore = 0;
        core = exploreConfiguredEventByNameFromRoom('技术难点', 'basement-landing', 'basement-east', [], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
            technicalMentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expectPendingDamageForTest(core, {
            sourceTitle: '技术难点',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(traitTrackPositionTotal(core, '0', ['knowledge', 'sanity'])).toBe(technicalMentalBefore);
        expect(core.latestDiscovery?.detail).toContain('放置到下一楼层起始点');
        core = resolvePendingDamageForTest(core, ['sanity']);
        expect(traitTrackPositionTotal(core, '0', ['knowledge', 'sanity'])).toBe(technicalMentalBefore - 1);
        expect(core.pendingDamageAllocation).toBeNull();

        core = exploreConfiguredEventByName('着火的人', [2, 2, 1, 1]);
        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.latestDiscovery?.detail).toContain('放置到入口大厅');
    });

it('新增配置事件的成功属性分支会按卡面提升对应属性', () => {
        let forbiddenKnowledgeBefore = 0;
        let forbiddenSanityBefore = 0;
        let core = exploreConfiguredEventByName('禁忌知识', [3, 3, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'knowledge', [1, 2, 3, 4, 5], 2, 2);
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
            forbiddenKnowledgeBefore = traitTrackPosition(draft, '0', 'knowledge');
            forbiddenSanityBefore = traitTrackPosition(draft, '0', 'sanity');
        });
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(forbiddenKnowledgeBefore + 1);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(forbiddenSanityBefore);
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');

        let burningSanityBefore = 0;
        core = exploreConfiguredEventByName('着火的人', [3, 3, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 2, 2);
            burningSanityBefore = traitTrackPosition(draft, '0', 'sanity');
        });
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(burningSanityBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
    });

it('新增配置事件的失败伤害分支会写入物理或精神伤害状态', () => {
        const expectAndResolveDeferredDamage = (
            targetCore: BetrayalCore,
            expected: {
                sourceTitle: string;
                damageKind: 'physical' | 'mental';
                originalAmount: number;
                allowedTraits: BetrayalTraitKey[];
                beforeTotal: number;
                detailText: string;
            },
        ): BetrayalCore => {
            expect(targetCore.latestDiscovery?.detail).toContain(expected.detailText);
            expectPendingDamageForTest(targetCore, {
                sourceTitle: expected.sourceTitle,
                damageKind: expected.damageKind,
                originalAmount: expected.originalAmount,
                allowedTraits: expected.allowedTraits,
            });
            expect(traitTrackPositionTotal(targetCore, '0', expected.allowedTraits)).toBe(expected.beforeTotal);
            const appliedAmount = targetCore.pendingDamageAllocation?.amount ?? 0;
            expect(appliedAmount).toBeGreaterThan(0);
            const resolvedCore = resolvePendingDamageForTest(
                targetCore,
                repeatTraitsForPendingDamage(targetCore, expected.allowedTraits),
            );
            expect(traitTrackPositionTotal(resolvedCore, '0', expected.allowedTraits)).toBe(
                expected.beforeTotal - appliedAmount,
            );
            expect(resolvedCore.pendingDamageAllocation).toBeNull();
            return resolvedCore;
        };

        let mentalBefore = 0;
        let core = exploreConfiguredEventByName('不可能的房间', [1, 3, 3], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 1, 1, 1, 1], 3, 3);
            mentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '不可能的房间',
            damageKind: 'mental',
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
            beforeTotal: mentalBefore,
            detailText: '重新投掷 1 颗骰子',
        });

        let physicalBefore = 0;
        core = exploreConfiguredEventByName('地狱蝙蝠', [1, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'speed', [1, 1, 1, 1, 1], 3, 3);
            physicalBefore = traitTrackPositionTotal(draft, '0', ['might', 'speed']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '地狱蝙蝠',
            damageKind: 'physical',
            originalAmount: 1,
            allowedTraits: ['might', 'speed'],
            beforeTotal: physicalBefore,
            detailText: '受到 1 点物理伤害',
        });

        core = exploreConfiguredEventByName('晦暗暴风夜', [1, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'knowledge', [1, 1, 1, 1, 1], 3, 3);
            mentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '晦暗暴风夜',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
            beforeTotal: mentalBefore,
            detailText: '受到 1 点精神伤害',
        });

        core = exploreConfiguredEventByName('禁忌知识', [1, 2, 2], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 1, 1, 1, 1], 3, 3);
            mentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '禁忌知识',
            damageKind: 'mental',
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
            beforeTotal: mentalBefore,
            detailText: '重新投掷 2 颗骰子',
        });

        core = exploreConfiguredEventByName('可怜的尤里克', [1, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 1, 1, 1, 1], 3, 3);
            mentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '可怜的尤里克',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
            beforeTotal: mentalBefore,
            detailText: '受到 1 点精神伤害',
        });

        core = exploreConfiguredEventByName('无线电广播', [1, 1, 3], (draft) => {
            mentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '无线电广播',
            damageKind: 'mental',
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
            beforeTotal: mentalBefore,
            detailText: '重新投掷 1 颗骰子',
        });

        core = exploreConfiguredEventByName('一声呼救', [1, 1, 1], (draft) => {
            setTestTraitTrack(draft, '0', 'knowledge', [1, 1, 1, 1, 1], 3, 3);
            mentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        core = expectAndResolveDeferredDamage(core, {
            sourceTitle: '一声呼救',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
            beforeTotal: mentalBefore,
            detailText: '受到 1 点精神伤害',
        });

        let burningPhysicalBefore = 0;
        let burningMentalBefore = 0;
        core = exploreConfiguredEventByName('着火的人', [1, 3, 2], (draft) => {
            setTestTraitTrack(draft, '0', 'sanity', [1, 1, 1, 1, 1], 3, 3);
            burningPhysicalBefore = traitTrackPositionTotal(draft, '0', ['might', 'speed']);
            burningMentalBefore = traitTrackPositionTotal(draft, '0', ['knowledge', 'sanity']);
        });
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '着火的人',
            damageKind: 'physical',
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(burningPhysicalBefore);
        const burningPhysicalDamage = core.pendingDamageAllocation?.amount ?? 0;
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['might', 'speed']));
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(
            burningPhysicalBefore - burningPhysicalDamage,
        );
        expectPendingDamageForTest(core, {
            sourceTitle: '着火的人',
            damageKind: 'mental',
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(traitTrackPositionTotal(core, '0', ['knowledge', 'sanity'])).toBe(burningMentalBefore);
        const burningMentalDamage = core.pendingDamageAllocation?.amount ?? 0;
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']));
        expect(traitTrackPositionTotal(core, '0', ['knowledge', 'sanity'])).toBe(
            burningMentalBefore - burningMentalDamage,
        );
        expect(core.pendingDamageAllocation).toBeNull();
    });

it('轮到约拿了、片刻希望和游魂完成物品选择与祝福骰结算', () => {
        const removeItemFromDeck = (targetCore: BetrayalCore, cardId: string) => {
            targetCore.possessionOrderByKind.item = targetCore.possessionOrderByKind.item.filter(
                (card) => resolveInventoryEffectId(card.id) !== cardId,
            );
            targetCore.deckCounts.item = targetCore.possessionOrderByKind.item.length;
        };

        let core = exploreConfiguredEventByName('轮到约拿了', [], (draft) => {
            setTestExplorerInventory(draft, '0', [
                { id: 'map', name: '地图', kind: 'item' },
                { id: 'hunting-knife', name: '砍刀', kind: 'item' },
            ]);
            removeItemFromDeck(draft, 'map');
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4, 5], 1, 1);
        });

        const jonahMissingCard = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }),
        );
        expect(jonahMissingCard.valid).toBe(false);
        if (!jonahMissingCard.valid) {
            expect(jonahMissingCard.error).toContain('有效持有物');
        }

        const jonahWeaponCard = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                accept: true,
                cardId: 'hunting-knife',
            }),
        );
        expect(jonahWeaponCard.valid).toBe(false);
        if (!jonahWeaponCard.valid) {
            expect(jonahWeaponCard.error).toContain('有效持有物');
        }

        const jonahSanityBefore = traitTrackPosition(core, '0', 'sanity');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
            accept: true,
            cardId: 'map',
        });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.inventory.map((card) => card.id)).toEqual(['hunting-knife']);
        expect(core.possessionOrderByKind.item.some((card) => resolveInventoryEffectId(card.id) === 'map')).toBe(false);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(jonahSanityBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('弃置地图');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        core = acknowledgeSingleEventEffectResolution(core, '轮到约拿了', '弃置地图');

        core = exploreConfiguredEventByName('片刻希望');
        const blessedRoomId = core.currentExplorer.roomId;
        expect(core.rooms.find((room) => room.id === blessedRoomId)?.markerTokens ?? []).toContain('blessing');
        expect(resolveBetrayalHauntTokenInstances(core).find((token) => token.id === `room-marker-${blessedRoomId}-blessing`)).toMatchObject({
            label: '祝福',
            source: 'event-effect',
            ruleNotes: ['祝福所在房间的属性检定额外增加 1 颗骰子。'],
        });
        core = acknowledgeSingleEventEffectResolution(core, '片刻希望', '放置祝福');

        core = exploreConfiguredEventByName('摇曳灯光', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'speed', [1, 2, 3, 4, 5], 1, 1);
        });
        const eventRoomId = core.currentExplorer.roomId;
        core.rooms = core.rooms.map((room) => (
            room.id === eventRoomId
                ? { ...room, markerTokens: Array.from(new Set([...(room.markerTokens ?? []), 'blessing' as const])) }
                : room
        ));
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(0, 0, 0),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.kind).toBe('eventRolledDamage');
        expect(core.recentRoll?.sourceEventRoll?.dice).toHaveLength(3);
        expect(core.recentRoll?.sourceEventRoll?.passiveBonus).toBe(0);
        core = acknowledgeSingleEventEffectResolution(core, '摇曳灯光', '速度检定');

        core = exploreConfiguredEventByName('游魂', [], (draft) => {
            setTestExplorerInventory(draft, '0', [{ id: 'map', name: '地图', kind: 'item' }]);
            removeItemFromDeck(draft, 'map');
            setTestTraitTrack(draft, '0', 'knowledge', [1, 2, 3, 4, 5], 1, 1);
        });
        const spiritKnowledgeBefore = traitTrackPosition(core, '0', 'knowledge');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
            accept: true,
            cardId: 'map',
            trait: 'knowledge',
        });
        const itemDeckBottom = core.possessionOrderByKind.item[core.possessionOrderByKind.item.length - 1];
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(resolveInventoryEffectId(itemDeckBottom?.id ?? '')).toBe('map');
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(spiritKnowledgeBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('埋葬地图');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        core = acknowledgeSingleEventEffectResolution(core, '游魂', '埋葬地图');

        core = exploreConfiguredEventByName('游魂', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4], 3, 3);
        });
        const spiritInventoryBefore = core.currentExplorer.inventory.length;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );
        expect(core.pendingEventChoice).toBeNull();
        expect(core.recentRoll?.trait).toBe('sanity');
        expect(core.recentRoll?.dice).toHaveLength(4);
        expect(core.currentExplorer.inventory).toHaveLength(spiritInventoryBefore + 1);
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        core = acknowledgeSingleEventEffectResolution(core, '游魂', '抽取一张物品卡');

        core = exploreConfiguredEventByName('游魂', [], (draft) => {
            setTestExplorerInventory(draft, '0', []);
            setTestTraitTrack(draft, '0', 'sanity', [1, 2, 3, 4], 3, 3);
            setTestTraitTrack(draft, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        });
        const spiritMightBefore = traitTrackPosition(core, '0', 'might');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(0, 0, 0, 0),
        );
        expect(core.pendingEventChoice).toMatchObject({
            sourceTitle: '游魂',
            effect: { mode: 'generalDamageChoice' },
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
            traits: ['might'],
        });
        expect(core.pendingEventChoice).toBeNull();
        expect(traitTrackPosition(core, '0', 'might')).toBe(spiritMightBefore - 1);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（力量）');
        core = acknowledgeSingleEventEffectResolution(core, '游魂', '通用伤害 1（力量）');
    });

it('盔甲和头戴耳机不会阻挡通用伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [
            {
                name: '通用伤害边界',
                effect: {
                    mode: 'generalDamage',
                    amount: 2,
                    traits: ['might', 'sanity'],
                    recommendedAction: 'endTurn',
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'armor', name: '盔甲', kind: 'omen' },
                { id: 'radio', name: '头戴耳机', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;
        const sanityBefore = core.currentExplorer.traits.sanity;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.might).toBe(mightBefore - 1);
        expect(core.currentExplorer.traits.sanity).toBe(sanityBefore - 1);
    });
});
