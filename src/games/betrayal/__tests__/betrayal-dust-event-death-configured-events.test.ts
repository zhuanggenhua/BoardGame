import { describe, expect, it } from 'vitest';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    setScenarioTestTurnMovement,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveBetrayalDeathStateSummary,
    resolveCorpseLootTargets,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    declinePendingEventSymbolSkipForTest,
    activateTestExplorer,
    setTestExplorerTraits,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    repeatTraitsForPendingDamage,
    expectPendingDamageForTest,
    resolvePendingDamageForTest,
    collectRuntimePossessionCards,
    collectRuntimePossessionCardNames,
    placeActiveTestExplorerInRoom,
    createDustHauntCore,
    placeCurrentExplorerInDustResearchRoom,
    type BetrayalCore,
    type BetrayalTraitKey,
} from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal first scenario runtime - dust configured event death coverage', () => {
it.each([
        {
            eventName: '外星几何',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '失去 1 点速度',
            expectedDamageTraits: ['speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '蜘蛛！',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1, 2], 0, 0);
            },
            randoms: [3, 2, 2, 2],
            expectedDetail: '获得 1 点速度并失去 1 点神志',
            expectedDamageTraits: ['sanity'] as BetrayalTraitKey[],
        },
        {
            eventName: '一种怪异的感觉',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            },
            randoms: [1, 1, 2, 2, 2],
            expectedDetail: '失去 1 点力量',
            expectedDamageTraits: ['might'] as BetrayalTraitKey[],
        },
        {
            eventName: '葬礼',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'sanity', [2], 0, 0);
            },
            randoms: [2, 2, 2, 2, 2],
            expectedDetail: '失去 1 点神志',
            expectedDamageTraits: ['sanity'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实直接失去属性事件「$eventName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        randoms,
        expectedDetail,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...randoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });
        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: expectedDamageTraits.length,
            damageTraits: expectedDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it.each([
        {
            eventName: '夜幕众星',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [4], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { trait: 'speed' },
            choiceRandoms: [2, 2, 2, 2, 2, 2, 2],
            expectedDetail: '失去 1 点所选属性',
            expectedDamageTraits: ['speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '一瓶微尘',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1, 2], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { accept: false },
            choiceRandoms: [2, 2, 2],
            expectedDetail: '力量 -1',
            expectedDamageTraits: ['might'] as BetrayalTraitKey[],
        },
        {
            eventName: '一条秘密通道',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [4], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [1, 1, 1, 1],
            choicePayload: { targetRoomId: 'basement-landing' },
            choiceRandoms: [2, 2, 2],
            expectedDetail: '神志 -1',
            expectedDamageTraits: ['sanity'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实选择型直接失去属性事件「$eventName」结算后触发头骨死亡保护', ({
        eventName,
        setupTracks,
        exploreRandoms,
        choicePayload,
        choiceRandoms,
        expectedDetail,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...exploreRandoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });
        expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            choicePayload,
            101,
            createBetrayalScriptedRandom(...choiceRandoms),
        );

        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: expectedDamageTraits.length,
            damageTraits: expectedDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it.each([
        {
            eventName: '标本剥制',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 1 点物理伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '小丑房间',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 2 点精神伤害',
            expectedDamageAmount: 2,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            eventName: '咬一口！',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 3 点物理伤害',
            expectedDamageAmount: 3,
            expectedDamageTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
        {
            eventName: '磁带播放器',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 1 点精神伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            eventName: '在你背后！',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            randoms: [1, 2, 2, 2],
            expectedDetail: '受到 1 点物理伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实一般伤害事件「$eventName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        randoms,
        expectedDetail,
        expectedDamageAmount,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...randoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });
        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        const expectedDeathDamageKind = core.pendingDamageAllocation?.damageKind ?? 'general';
        const expectedDeathDamageTraits = core.pendingDamageAllocation
            ? repeatTraitsForPendingDamage(core, expectedDamageTraits)
            : expectedDamageTraits;
        const expectedDeathDamageAmount = core.pendingDamageAllocation?.amount ?? expectedDamageAmount;
        if (core.pendingDamageAllocation) {
            expectPendingDamageForTest(core, {
                sourceTitle: eventName,
                originalAmount: expectedDamageAmount,
                allowedTraits: expectedDamageTraits,
            });
            expect(core.recentRoll?.kind).not.toBe('deathPrevention');
            expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
            core = resolvePendingDamageForTest(core, expectedDeathDamageTraits, 102, [1, 2, 2]);
        }
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: expectedDeathDamageKind,
            damageAmount: expectedDeathDamageAmount,
            damageTraits: expectedDeathDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it.each([
        {
            caseName: '电话铃声精神伤害',
            eventName: '电话铃声',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [2, 1, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '重新投掷 1 颗骰子',
            expectedDamageKind: 'mental' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '电话铃声物理伤害',
            eventName: '电话铃声',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            exploreRandoms: [1, 1, 3, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '重新投掷 2 颗骰子',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 4,
        },
        {
            caseName: '小机器人物理伤害',
            eventName: '小机器人',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            exploreRandoms: [1, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '重新投掷 1 颗骰子',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '最深的壁橱物理伤害',
            eventName: '最深的壁橱',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            },
            exploreRandoms: [1, 3, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '重新投掷 1 颗骰子',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '肉质苔癣精神伤害',
            eventName: '肉质苔癣',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { accept: true },
            choiceRandoms: [1, 1, 3, 2, 2, 2],
            expectedDetail: '重新投掷 1 颗骰子',
            expectedDamageKind: 'mental' as const,
            expectedDamageAmount: 2,
        },
        {
            caseName: '一抹鲜红物理伤害',
            eventName: '一抹鲜红',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { accept: false },
            choiceRandoms: [3, 2, 2, 2],
            expectedDetail: '重新投掷 1 颗骰子',
            expectedDamageKind: 'physical' as const,
            expectedDamageAmount: 2,
        },
    ] as const)('灰尘真实掷骰伤害事件「$caseName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        exploreRandoms,
        choicePayload,
        choiceRandoms,
        expectedDetail,
        expectedDamageKind,
        expectedDamageAmount,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...exploreRandoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });

        if (choicePayload) {
            expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                choicePayload,
                101,
                createBetrayalScriptedRandom(...choiceRandoms),
            );
        }

        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        expectPendingDamageForTest(core, {
            sourceTitle: eventName,
            damageKind: expectedDamageKind,
            originalAmount: expectedDamageAmount,
            allowedTraits: expectedDamageKind === 'mental' ? ['knowledge', 'sanity'] : ['might', 'speed'],
        });
        expect(core.recentRoll?.kind).not.toBe('deathPrevention');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();

        const damageTraits = repeatTraitsForPendingDamage(
            core,
            expectedDamageKind === 'mental' ? ['knowledge', 'sanity'] : ['might', 'speed'],
        );
        core = resolvePendingDamageForTest(core, damageTraits, 102, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: expectedDamageKind,
            damageAmount: damageTraits.length,
            damageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: core.currentExplorer.roomId,
        });
    });

it.each([
        {
            caseName: '最深的壁橱精神伤害',
            eventName: '最深的壁橱',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [2], 0, 0);
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [2, 1, 2, 2, 2],
            choicePayload: undefined,
            choiceRandoms: [] as const,
            expectedDetail: '受到 1 点精神伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            caseName: '脑状食品底档通用伤害',
            eventName: '脑状食品',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
            },
            exploreRandoms: [1],
            choicePayload: { traits: ['might', 'knowledge'] as BetrayalTraitKey[] },
            choiceRandoms: [2, 2, 2],
            expectedDetail: '通用伤害 2（力量、知识）',
            expectedDamageAmount: 2,
            expectedDamageTraits: ['might', 'knowledge'] as BetrayalTraitKey[],
        },
        {
            caseName: '上古旧宅地面通用伤害',
            eventName: '上古旧宅',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [3], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { trait: 'might' as const, targetRoomId: 'hallway', traits: ['might'] as BetrayalTraitKey[] },
            choiceRandoms: [2, 2, 2, 2, 2, 2],
            expectedDetail: '通用伤害 1（力量）',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['might'] as BetrayalTraitKey[],
        },
        {
            caseName: '上古旧宅地下精神伤害',
            eventName: '上古旧宅',
            setupTracks: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'speed', [2], 0, 0);
                setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
                setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
            },
            exploreRandoms: [] as const,
            choicePayload: { trait: 'speed' as const, targetRoomId: 'basement-landing' },
            choiceRandoms: [1, 1, 2, 2, 2],
            expectedDetail: '受到 1 点精神伤害',
            expectedDamageAmount: 1,
            expectedDamageTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘真实复合/选择伤害事件「$caseName」扣到骷髅时触发头骨死亡保护', ({
        eventName,
        setupTracks,
        exploreRandoms,
        choicePayload,
        choiceRandoms,
        expectedDetail,
        expectedDamageAmount,
        expectedDamageTraits,
    }) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setupTracks(core);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(...exploreRandoms),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: eventName,
        });

        if (choicePayload) {
            expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                choicePayload,
                101,
                createBetrayalScriptedRandom(...choiceRandoms),
            );
        }

        expect(core.latestDiscovery?.detail).toContain(expectedDetail);
        const expectedDeathDamageKind = core.pendingDamageAllocation?.damageKind ?? 'general';
        const expectedDeathDamageTraits = core.pendingDamageAllocation
            ? repeatTraitsForPendingDamage(core, expectedDamageTraits)
            : expectedDamageTraits;
        const expectedDeathDamageAmount = core.pendingDamageAllocation?.amount ?? expectedDamageAmount;
        if (core.pendingDamageAllocation) {
            expectPendingDamageForTest(core, {
                sourceTitle: eventName,
                originalAmount: expectedDamageAmount,
                allowedTraits: expectedDamageTraits,
            });
            expect(core.recentRoll?.kind).not.toBe('deathPrevention');
            expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
            core = resolvePendingDamageForTest(core, expectedDeathDamageTraits, 102, [1, 2, 2]);
        }
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: expectedDeathDamageKind,
            damageAmount: expectedDeathDamageAmount,
            damageTraits: expectedDeathDamageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: core.currentExplorer.roomId,
        });
    });

it('灰尘吊死鬼全属性检定失败扣到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '吊死鬼',
        });
        expect(core.recentAllTraitCheck?.results.every((result) => !result.passed)).toBe(true);
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 4,
            damageTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it('灰尘固定属性事件一般伤害分到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '固定灰尘伤害',
            text: '固定扣减力量。',
            effect: {
                mode: 'generalDamage',
                amount: 1,
                traits: ['might'],
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '固定灰尘伤害',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it('灰尘固定属性事件一般伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '固定灰尘伤害',
            text: '固定扣减力量。',
            effect: {
                mode: 'generalDamage',
                amount: 1,
                traits: ['might'],
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘掷骰事件物理伤害扣到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '掷骰灰尘伤害',
            text: '掷骰造成物理伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'physical',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '掷骰灰尘伤害',
        });
        expectPendingDamageForTest(core, {
            sourceTitle: '掷骰灰尘伤害',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.recentRoll?.kind).not.toBe('deathPrevention');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        const damageTraits = repeatTraitsForPendingDamage(core, ['might', 'speed']);
        core = resolvePendingDamageForTest(core, damageTraits, 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'physical',
            damageAmount: damageTraits.length,
            damageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it('灰尘掷骰事件物理伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '掷骰灰尘伤害',
            text: '掷骰造成物理伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'physical',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expectPendingDamageForTest(core, {
            sourceTitle: '掷骰灰尘伤害',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        const damageTraits = repeatTraitsForPendingDamage(core, ['might', 'speed']);
        core = resolvePendingDamageForTest(core, damageTraits, 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘掷骰事件精神伤害扣到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '掷骰灰尘精神伤害',
            text: '掷骰造成精神伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'mental',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '掷骰灰尘精神伤害',
        });
        expectPendingDamageForTest(core, {
            sourceTitle: '掷骰灰尘精神伤害',
            damageKind: 'mental',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(core.recentRoll?.kind).not.toBe('deathPrevention');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        const damageTraits = repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']);
        core = resolvePendingDamageForTest(core, damageTraits, 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'mental',
            damageAmount: damageTraits.length,
            damageTraits,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it('灰尘掷骰事件精神伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '掷骰灰尘精神伤害',
            text: '掷骰造成精神伤害。',
            effect: {
                mode: 'rolledDamage',
                dice: 1,
                damageKind: 'mental',
                recommendedAction: 'endTurn',
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expectPendingDamageForTest(core, {
            sourceTitle: '掷骰灰尘精神伤害',
            damageKind: 'mental',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
        });
        const damageTraits = repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']);
        core = resolvePendingDamageForTest(core, damageTraits, 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘复合事件内嵌一般伤害扣到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '复合灰尘伤害',
            text: '先造成伤害，再放置障碍物。',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamage',
                        amount: 1,
                        traits: ['might'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeObstacleToken',
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '复合灰尘伤害',
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
    });

it('灰尘复合事件内嵌一般伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '复合灰尘伤害',
            text: '先造成伤害，再放置障碍物。',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamage',
                        amount: 1,
                        traits: ['might'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeObstacleToken',
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it.each(collectRuntimePossessionCards().map((card) => [card.name, card] as const))(
        '当前运行持有牌全集：%s 在复合事件副作用头骨失败且兔脚成功后都不掩埋',
        (cardName, card) => {
            let core = createDustHauntCore();
            placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
            setScenarioTestTurnMovement(core, 6);
            core.drawOrder = ['event'];
            setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
            core.eventOrder = [{
                name: '复合灰尘伤害',
                text: '先造成伤害，再放置障碍物。',
                effect: {
                    mode: 'compound',
                    recommendedAction: 'endTurn',
                    effects: [
                        {
                            mode: 'generalDamage',
                            amount: 1,
                            traits: ['might'],
                            recommendedAction: 'endTurn',
                        },
                        {
                            mode: 'placeObstacleToken',
                            recommendedAction: 'endTurn',
                        },
                    ],
                },
            }];
            core.deckCounts.event = core.eventOrder.length;
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
            expect(targetRoomId, cardName).toBeTruthy();

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '1',
                { roomId: targetRoomId! },
                100,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            core = declinePendingEventSymbolSkipForTest(core);
            expect(core.recentRoll?.kind, cardName).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, cardName).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).toContain('1');
            expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens, cardName).toContain('obstacle');
            expect(core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id), cardName).toContain(card.id);
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, cardName).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                101,
                createBetrayalScriptedRandom(3),
            );

            const expectedInventoryIds = [
                'skull',
                'rope',
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
            ];
            expect(core.recentRoll?.kind, cardName).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, cardName).toBe('阻止死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), cardName).toBeUndefined();
            expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens, cardName).toContain('obstacle');
            expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), cardName).toEqual(expectedInventoryIds);
            expect(core.currentExplorerInventory.map((inventoryCard) => inventoryCard.id), cardName).toEqual(expectedInventoryIds);
            expect(resolveCorpseLootTargets(core).map((corpseTarget) => corpseTarget.playerId), cardName).not.toContain('1');
            expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), cardName).not.toContain('1');
            expect(core.usedCardIdsThisTurn, cardName).toContain('rope');
        },
    );

it('灰尘复合事件内嵌一般伤害头骨失败后，兔脚仍失败会保留副作用并掩埋遗物', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '复合灰尘伤害',
            text: '先造成伤害，再放置障碍物。',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamage',
                        amount: 1,
                        traits: ['might'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeObstacleToken',
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens).toContain('obstacle');
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it.each(collectRuntimePossessionCards().map((card) => [card.name, card] as const))(
        '当前运行持有牌全集：%s 在复合事件副作用头骨失败且兔脚仍失败后都会掩埋并不可搜尸',
        (cardName, card) => {
            let core = createDustHauntCore();
            placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
            setScenarioTestTurnMovement(core, 6);
            core.drawOrder = ['event'];
            setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
            core.eventOrder = [{
                name: '复合灰尘伤害',
                text: '先造成伤害，再放置障碍物。',
                effect: {
                    mode: 'compound',
                    recommendedAction: 'endTurn',
                    effects: [
                        {
                            mode: 'generalDamage',
                            amount: 1,
                            traits: ['might'],
                            recommendedAction: 'endTurn',
                        },
                        {
                            mode: 'placeObstacleToken',
                            recommendedAction: 'endTurn',
                        },
                    ],
                },
            }];
            core.deckCounts.event = core.eventOrder.length;
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
            expect(targetRoomId, cardName).toBeTruthy();

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '1',
                { roomId: targetRoomId! },
                100,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            core = declinePendingEventSymbolSkipForTest(core);
            expect(core.recentRoll?.kind, cardName).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, cardName).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).toContain('1');
            expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens, cardName).toContain('obstacle');
            expect(core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id), cardName).toContain(card.id);
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, cardName).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                101,
                createBetrayalScriptedRandom(1),
            );

            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(core.recentRoll?.kind, cardName).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, cardName).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), cardName).toMatchObject({
                name: '狂热病患',
                roomId: targetRoomId,
            });
            expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens, cardName).toContain('obstacle');
            expect(findTestExplorer(core, '1').inventory, cardName).toEqual([]);
            expect(core.currentExplorerInventory, cardName).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((corpseTarget) => corpseTarget.playerId), cardName).not.toContain('1');
            expect(corpse, cardName).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
            expect(core.usedCardIdsThisTurn, cardName).toContain('rope');
        },
    );

it('灰尘直接失去属性事件头骨失败后，兔脚成功会回滚死亡且不掩埋非武器遗物', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '外星几何',
        });
        expect(core.latestDiscovery?.detail).toContain('失去 1 点速度');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([
            'skull',
            'rope',
            'map',
            'omen-book',
        ]);
        expect(resolveCorpseLootTargets(core).map((target) => target.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘直接失去属性事件头骨失败后，兔脚仍失败会掩埋非武器遗物且不可搜刮', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '外星几何',
        });
        expect(core.latestDiscovery?.detail).toContain('失去 1 点速度');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([
            'skull',
            'rope',
            'map',
            'omen-book',
        ]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((target) => target.playerId)).not.toContain('1');
        expect(corpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘掷骰伤害事件头骨失败后，兔脚成功会回滚死亡且不掩埋非武器遗物', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '小机器人',
        });
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '小机器人',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.recentRoll?.kind).not.toBe('deathPrevention');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        core = resolvePendingDamageForTest(core, ['might', 'speed'], 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'physical',
            damageAmount: 2,
            damageTraits: ['might', 'speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([
            'skull',
            'rope',
            'first-aid-kit',
            'mask',
        ]);
        expect(resolveCorpseLootTargets(core).map((target) => target.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it.each([
        {
            label: '直接失去属性事件',
            eventEffect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' } as const,
            expectedDeathPrevention: {
                cardId: 'skull',
                damageKind: 'general',
                damageAmount: 1,
                damageTraits: ['speed'],
            },
        },
        {
            label: '掷骰伤害事件',
            eventEffect: { mode: 'rolledDamage', damageKind: 'physical', dice: 1, rolls: [2], recommendedAction: 'endTurn' } as const,
            expectedDeathPrevention: {
                cardId: 'skull',
                damageKind: 'physical',
                damageAmount: 2,
                damageTraits: ['might', 'speed'],
            },
        },
    ])('当前运行持有牌全集在$label头骨失败且兔脚成功后都不掩埋', ({
        eventEffect,
        expectedDeathPrevention,
        label,
    }) => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingEventChoice = {
                id: `dust-${label}-${card.id}`,
                playerId: '1',
                sourceTitle: label,
                acceptLabel: '结算事件',
                declineLabel: '跳过',
                effect: {
                    mode: 'optionalEventRoll',
                    roll: {
                        dice: 1,
                        label: '事件检定',
                        branches: [
                            { min: 0, label: '结算事件效果', effect: eventEffect },
                        ],
                    },
                },
            };
            expect(core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id), `${label}:${card.name}`).toContain(card.id);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                { accept: true },
                100,
                createBetrayalScriptedRandom(1, 2, 2, 2),
            );

            expect(core.latestDiscovery, `${label}:${card.name}`).toMatchObject({
                kind: 'event',
                title: label,
            });
            let expectedDeathPreventionForCore = expectedDeathPrevention;
            if (eventEffect.mode === 'rolledDamage') {
                expectPendingDamageForTest(core, {
                    sourceTitle: label,
                    damageKind: 'physical',
                    originalAmount: 2,
                    allowedTraits: ['might', 'speed'],
                });
                expect(core.recentRoll?.kind, `${label}:${card.name}`).not.toBe('deathPrevention');
                expect(core.scenarioRuntime.deadExplorerPlayerIds, `${label}:${card.name}`).not.toContain('1');
                expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${label}:${card.name}`).not.toContain('1');
                const damageTraits = repeatTraitsForPendingDamage(core, ['might', 'speed']);
                expectedDeathPreventionForCore = {
                    ...expectedDeathPrevention,
                    damageAmount: damageTraits.length,
                    damageTraits,
                };
                core = resolvePendingDamageForTest(core, damageTraits, 101, [1, 2, 2]);
            }
            expect(core.recentRoll?.kind, `${label}:${card.name}`).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, `${label}:${card.name}`).toBe('正常死亡');
            expect(core.recentRoll?.deathPrevention, `${label}:${card.name}`).toMatchObject(expectedDeathPreventionForCore);
            expect(core.scenarioRuntime.deadExplorerPlayerIds, `${label}:${card.name}`).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${label}:${card.name}`).toContain('1');

            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, `${label}:${card.name}`).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                101,
                createBetrayalScriptedRandom(3),
            );

            const expectedInventoryIds = [
                'skull',
                'rope',
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
            ];
            expect(core.recentRoll?.kind, `${label}:${card.name}`).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, `${label}:${card.name}`).toBe('阻止死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, `${label}:${card.name}`).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${label}:${card.name}`).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), `${label}:${card.name}`).toBeUndefined();
            expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), `${label}:${card.name}`).toEqual(expectedInventoryIds);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), `${label}:${card.name}`).not.toContain('1');
            expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), `${label}:${card.name}`).not.toContain('1');
            expect(core.usedCardIdsThisTurn, `${label}:${card.name}`).toContain('rope');
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it.each([
        {
            label: '直接失去属性事件',
            eventEffect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' } as const,
            expectedDeathPrevention: {
                cardId: 'skull',
                damageKind: 'general',
                damageAmount: 1,
                damageTraits: ['speed'],
            },
        },
        {
            label: '掷骰伤害事件',
            eventEffect: { mode: 'rolledDamage', damageKind: 'physical', dice: 1, rolls: [2], recommendedAction: 'endTurn' } as const,
            expectedDeathPrevention: {
                cardId: 'skull',
                damageKind: 'physical',
                damageAmount: 2,
                damageTraits: ['might', 'speed'],
            },
        },
    ])('当前运行持有牌全集在$label头骨失败且兔脚仍失败后都会掩埋并不可搜尸', ({
        eventEffect,
        expectedDeathPrevention,
        label,
    }) => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingEventChoice = {
                id: `dust-${label}-${card.id}-rabbit-foot-failed`,
                playerId: '1',
                sourceTitle: label,
                acceptLabel: '结算事件',
                declineLabel: '跳过',
                effect: {
                    mode: 'optionalEventRoll',
                    roll: {
                        dice: 1,
                        label: '事件检定',
                        branches: [
                            { min: 0, label: '结算事件效果', effect: eventEffect },
                        ],
                    },
                },
            };
            expect(core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id), `${label}:${card.name}`).toContain(card.id);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                { accept: true },
                100,
                createBetrayalScriptedRandom(1, 2, 2, 2),
            );

            expect(core.latestDiscovery, `${label}:${card.name}`).toMatchObject({
                kind: 'event',
                title: label,
            });
            let expectedDeathPreventionForCore = expectedDeathPrevention;
            if (eventEffect.mode === 'rolledDamage') {
                expectPendingDamageForTest(core, {
                    sourceTitle: label,
                    damageKind: 'physical',
                    originalAmount: 2,
                    allowedTraits: ['might', 'speed'],
                });
                expect(core.recentRoll?.kind, `${label}:${card.name}`).not.toBe('deathPrevention');
                expect(core.scenarioRuntime.deadExplorerPlayerIds, `${label}:${card.name}`).not.toContain('1');
                expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${label}:${card.name}`).not.toContain('1');
                const damageTraits = repeatTraitsForPendingDamage(core, ['might', 'speed']);
                expectedDeathPreventionForCore = {
                    ...expectedDeathPrevention,
                    damageAmount: damageTraits.length,
                    damageTraits,
                };
                core = resolvePendingDamageForTest(core, damageTraits, 101, [1, 2, 2]);
            }
            expect(core.recentRoll?.kind, `${label}:${card.name}`).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, `${label}:${card.name}`).toBe('正常死亡');
            expect(core.recentRoll?.deathPrevention, `${label}:${card.name}`).toMatchObject(expectedDeathPreventionForCore);
            expect(core.scenarioRuntime.deadExplorerPlayerIds, `${label}:${card.name}`).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${label}:${card.name}`).toContain('1');

            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, `${label}:${card.name}`).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                101,
                createBetrayalScriptedRandom(1),
            );

            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(core.recentRoll?.kind, `${label}:${card.name}`).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, `${label}:${card.name}`).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, `${label}:${card.name}`).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${label}:${card.name}`).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), `${label}:${card.name}`).toMatchObject({
                name: '狂热病患',
                roomId: 'hallway',
            });
            expect(findTestExplorer(core, '1').inventory, `${label}:${card.name}`).toEqual([]);
            expect(core.currentExplorerInventory, `${label}:${card.name}`).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), `${label}:${card.name}`).not.toContain('1');
            expect(corpse, `${label}:${card.name}`).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
            expect(core.usedCardIdsThisTurn, `${label}:${card.name}`).toContain('rope');
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('灰尘掷骰伤害事件头骨失败后，兔脚仍失败会掩埋非武器遗物且不可搜刮', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(1, 3, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '小机器人',
        });
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '小机器人',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.recentRoll?.kind).not.toBe('deathPrevention');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        core = resolvePendingDamageForTest(core, ['might', 'speed'], 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'physical',
            damageAmount: 2,
            damageTraits: ['might', 'speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([
            'skull',
            'rope',
            'first-aid-kit',
            'mask',
        ]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((target) => target.playerId)).not.toContain('1');
        expect(corpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘普通伤害死亡后若所有探索者都已是叛徒或死亡则叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1', '2'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-ordinary-damage-completes-traitors',
            playerId: '1',
            sourceTitle: '攻击',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
    });

it('灰尘剧本发出疾病交换请求后不会重新展示上一次投骰结果', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        setTestExplorerTraits(core, '1', { knowledge: 3 });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: core.currentExplorer.roomId }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );
        expect(core.recentRoll?.sourceTitle).toBe('寻找解药');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );

        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toMatchObject({
            requesterPlayerId: '1',
            targetPlayerId: '0',
        });
        expect(core.recentRoll).toBeNull();
    });
});
