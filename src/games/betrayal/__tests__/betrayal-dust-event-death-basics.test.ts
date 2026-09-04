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
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    repeatTraitsForPendingDamage,
    expectPendingDamageForTest,
    resolvePendingDamageForTest,
    collectRuntimePossessionCards,
    placeActiveTestExplorerInRoom,
    createDustHauntCore,
} from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal first scenario runtime - dust event death basics', () => {
it('灰尘永久叛徒因事件一般伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-lethal',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '1', { traits: ['might'] }),
        );
        expect(validation).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(core.endgameResult).toBeNull();
    });

it('灰尘真实事件副作用致死后若所有探索者都已是叛徒或死亡则叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.deckCounts.event = core.eventOrder.length;
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
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
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '标本剥制',
        });
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expectPendingDamageForTest(core, {
            sourceTitle: '标本剥制',
            damageKind: 'physical',
            originalAmount: 1,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['might', 'speed']));
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners).toEqual(['2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
    });

it('灰尘真实事件副作用致死本会终局时，兔脚成功会先回滚死亡并保留副作用', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
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
            createBetrayalScriptedRandom(1, 2, 2, 1),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '标本剥制',
        });
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expectPendingDamageForTest(core, {
            sourceTitle: '标本剥制',
            damageKind: 'physical',
            originalAmount: 1,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');

        core = resolvePendingDamageForTest(core, ['might'], 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘真实事件副作用致死本会终局时，兔脚仍失败会保留副作用并触发叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
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
            createBetrayalScriptedRandom(1, 2, 2, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expectPendingDamageForTest(core, {
            sourceTitle: '标本剥制',
            damageKind: 'physical',
            originalAmount: 1,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');

        core = resolvePendingDamageForTest(core, ['might'], 101, [1, 2, 2]);

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 2 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 2 },
            102,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.rooms.find((room) => room.id === targetRoomId)?.markerTokens ?? []).toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘事件一般伤害分到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-success',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['might'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.endgameResult).toBeNull();
    });

it('灰尘事件一般伤害分到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-failed',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

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
            roomId: 'hallway',
        });
    });

it('灰尘事件一般伤害头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingEventChoice = {
            id: 'dust-event-general-damage-skull-rabbit-foot-success',
            playerId: '1',
            sourceTitle: '事件一般伤害',
            effect: {
                mode: 'generalDamageChoice',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '1',
            { traits: ['might'] },
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
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'first-aid-kit']);
    });

it.each(collectRuntimePossessionCards().map((card) => [card.name, card] as const))(
        '当前运行持有牌全集：%s 在普通事件一般伤害头骨失败且兔脚成功后都不掩埋',
        (cardName, card) => {
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
            setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingEventChoice = {
                id: 'dust-event-general-damage-skull-rabbit-foot-success-all-cards',
                playerId: '1',
                sourceTitle: '事件一般伤害',
                effect: {
                    mode: 'generalDamageChoice',
                    amount: 1,
                    allowedTraits: ['might'],
                    recommendedAction: 'endTurn',
                },
            };

            expect(core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id), cardName).toContain(card.id);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                { traits: ['might'] },
                100,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            core = declinePendingEventSymbolSkipForTest(core);
            expect(core.recentRoll?.kind, cardName).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, cardName).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).toContain('1');

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
            expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), cardName).toEqual(expectedInventoryIds);
            expect(core.currentExplorerInventory.map((inventoryCard) => inventoryCard.id), cardName).toEqual(expectedInventoryIds);
            expect(resolveCorpseLootTargets(core).map((corpseTarget) => corpseTarget.playerId), cardName).not.toContain('1');
            expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), cardName).not.toContain('1');
            expect(core.usedCardIdsThisTurn, cardName).toContain('rope');
        },
    );

it.each(collectRuntimePossessionCards().map((card) => [card.name, card] as const))(
        '当前运行持有牌全集：%s 在普通事件一般伤害头骨失败且兔脚仍失败后都会掩埋并不可搜尸',
        (cardName, card) => {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingEventChoice = {
                id: 'dust-event-general-damage-skull-rabbit-foot-failed',
                playerId: '1',
                sourceTitle: '事件一般伤害',
                effect: {
                    mode: 'generalDamageChoice',
                    amount: 1,
                    allowedTraits: ['might'],
                    recommendedAction: 'endTurn',
                },
            };

            expect(core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id), cardName).toContain(card.id);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
                '1',
                { traits: ['might'] },
                100,
                createBetrayalScriptedRandom(1, 1, 1),
            );

            expect(core.recentRoll?.kind).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).toContain('1');

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

            expect(core.recentRoll?.kind).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, cardName).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, cardName).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), cardName).toMatchObject({
                name: '狂热病患',
                roomId: 'hallway',
            });
            expect(core.usedCardIdsThisTurn, cardName).toContain('rope');
            expect(findTestExplorer(core, '1').inventory, cardName).toEqual([]);
            expect(core.currentExplorerInventory, cardName).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId), cardName).not.toContain('1');
            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(corpse, cardName).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
        },
    );

it('灰尘直接降属性事件扣到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '直接灰尘降属性',
            text: '阴影扑向你。失去 1 点力量。',
            effect: {
                mode: 'trait',
                trait: 'might',
                amount: -1,
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
            title: '直接灰尘降属性',
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

it('灰尘直接降属性事件头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '直接灰尘降属性',
            text: '阴影扑向你。失去 1 点力量。',
            effect: {
                mode: 'trait',
                trait: 'might',
                amount: -1,
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

it('灰尘脑状食品中档失去神志扣到骷髅时也触发头骨死亡保护', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1, 2], 0, 0);
        setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '脑状食品',
        });
        expect(core.latestDiscovery?.detail).toContain('力量检定 1');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点速度并失去 1 点神志');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 1,
            damageTraits: ['sanity'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: targetRoomId,
        });
    });

it('灰尘脑状食品头骨失败后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.deckCounts.event = core.eventOrder.length;
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1, 2], 0, 0);
        setTestTraitTrack(core, '1', 'sanity', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
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
});
