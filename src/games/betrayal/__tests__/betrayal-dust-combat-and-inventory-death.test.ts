import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveBetrayalDeathStateSummary,
    resolveCorpseLootTargets,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerInventory,
    setTestTraitTrack,
    setHighCapacityPhysicalDamageTracks,
    repeatTraitsForPendingDamage,
    collectRuntimePossessionCards,
    collectRuntimePossessionCardNames,
    setDiscoveredTestRoom,
    placeActiveTestExplorerInRoom,
    lethalTraitsForPendingDamage,
    createDustHauntCore,
    createDustTradeAndCorpseLootReadyCore,
    createDustNonTraitorRabbitFootDeathReadyCore,
    type BetrayalTraitKey,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveBetrayalHauntTokenInstances } from '../hauntTokenModel';

describe('Betrayal first scenario runtime - dust combat and inventory death', () => {
it('灰尘普通攻击致死会先等待伤害分配，确认后才变狂热病患并触发叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            amount: 4,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['2']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.endgameResult).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['0'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['1', '2']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

it('灰尘普通攻击本会触发叛徒终局时，兔脚成功会先回滚死亡并保持作祟继续', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['1', '2']));
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
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['2']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it('灰尘普通攻击本会触发叛徒终局时，兔脚仍失败才进入叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
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
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['0'],
        });
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['1', '2']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
    });

it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘当前攻击武器「$card.name」本会触发叛徒终局时，兔脚成功会先回滚死亡', ({
        card,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase, card.name).toBe('haunt');
        expect(core.endgameResult, card.name).toBeNull();
        expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toEqual(expect.arrayContaining(['1', '2']));
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid, card.name).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase, card.name).toBe('haunt');
        expect(core.endgameResult, card.name).toBeNull();
        expect(core.recentRoll?.latestLabel, card.name).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toEqual(['2']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), card.name).toEqual(['skull', 'rope', 'map']);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId), card.name).not.toContain('1');
        expect(core.usedCardIdsThisTurn, card.name).toEqual(expect.arrayContaining(['haunt-attack', card.id, 'rope']));
    });

it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘当前攻击武器「$card.name」本会触发叛徒终局时，兔脚仍失败才进入叛徒胜利', ({
        card,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase, card.name).toBe('haunt');
        expect(core.endgameResult, card.name).toBeNull();
        expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid, card.name).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase, card.name).toBe('endgame');
        expect(core.endgameResult, card.name).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['0'],
        });
        expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toEqual(expect.arrayContaining(['1', '2']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), card.name).toEqual(['skull', 'rope', 'map']);
        expect(core.usedCardIdsThisTurn, card.name).toEqual(expect.arrayContaining(['haunt-attack', card.id, 'rope']));
    });

it('灰尘阶段攻击武器仍按回合开始和已用限制参与攻击并禁止交易', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setHighCapacityPhysicalDamageTracks(core, '1');
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', 'hunting-knife']));
        expect(core.activityLog[0]?.text).toContain('使用砍刀');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const tradeUsedWeapon = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardId: 'hunting-knife',
                targetPlayerId: '1',
            }),
        );
        expect(tradeUsedWeapon.valid).toBe(false);
        expect(tradeUsedWeapon.error).toContain('本回合已经使用过的持有物不能交易');
    });

it('灰尘阶段武器攻击永久感染者致死后仍生成狂热病患并掩埋遗物', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [{ id: 'ring', name: '指环', kind: 'omen' }],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        const defeatedTraitor = findTestExplorer(core, '1');
        expect(core.phase).toBe('haunt');
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', 'hunting-knife']));
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(defeatedTraitor.inventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            damageKind: 'mental' as const,
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘阶段当前攻击武器「$card.name」致死都会生成狂热病患并掩埋遗物', ({
        card,
        damageKind,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [{ id: 'map', name: '地图', kind: 'item' }],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );

        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', card.id]));
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind,
            playerId: '1',
            allowSkull: true,
        });
        expect(findTestExplorer(core, '1').inventory.map((item) => item.id)).toEqual(['map']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            damageKind: 'mental' as const,
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘阶段攻击武器「$card.name」触发头骨失败后，兔脚成功会回滚狂热病患化且不掩埋遗物', ({
        card,
        damageKind,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            damageKind,
            playerId: '1',
            allowSkull: true,
        });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeDefined();
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

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id)).toEqual(['skull', 'rope', 'map']);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining([card.id, 'rope']));
    });

it.each([
        {
            card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 1],
        },
        {
            card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
            damageKind: 'physical' as const,
            lethalTrait: 'might' as const,
            rollPips: [3, 3, 3, 3, 1],
        },
        {
            card: { id: 'ring', name: '指环', kind: 'omen' as const },
            damageKind: 'mental' as const,
            lethalTrait: 'sanity' as const,
            rollPips: [3, 3, 1],
        },
    ])('灰尘阶段攻击武器「$card.name」触发头骨失败后，兔脚仍失败会保持狂热病患化并掩埋遗物', ({
        card,
        damageKind,
        lethalTrait,
        rollPips,
    }) => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '0');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'hallway',
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                        { id: 'map', name: '地图', kind: 'item' },
                    ],
                }
                : explorer
        ));
        setTestExplorerInventory(core, '0', [card]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        setTestTraitTrack(core, '0', 'might', [2], 0, 0);
        setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
        setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
        setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: card.id },
            100,
            createBetrayalScriptedRandom(...rollPips),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            damageKind,
            playerId: '1',
            allowSkull: true,
        });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, lethalTrait) },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id)).toEqual(['skull', 'rope', 'map']);

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
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining([card.id, 'rope']));
    });

it('当前三张攻击武器下，当前运行持有牌全集在头骨失败且兔脚成功后都不掩埋', () => {
        const verifiedWeaponNames: string[] = [];
        const weaponCases = [
            {
                card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
                lethalTrait: 'might' as const,
                rollPips: [3, 3, 1],
            },
            {
                card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
                lethalTrait: 'might' as const,
                rollPips: [3, 3, 3, 3, 1],
            },
            {
                card: { id: 'ring', name: '指环', kind: 'omen' as const },
                lethalTrait: 'sanity' as const,
                rollPips: [3, 3, 1],
            },
        ];

        for (const weapon of weaponCases) {
            const verifiedCardNames: string[] = [];

            for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '0');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? {
                        ...explorer,
                        roomId: 'hallway',
                        inventory: [
                            { id: 'skull', name: '头骨', kind: 'omen' },
                            { id: 'rope', name: '兔脚', kind: 'item' },
                            ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
                        ],
                    }
                    : explorer
            ));
            setTestExplorerInventory(core, '0', [weapon.card]);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '0', 'might', [2], 0, 0);
            setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
            setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
            setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.HAUNT_ATTACK,
                '0',
                { target: 'hero', targetPlayerId: '1', weaponCardId: weapon.card.id },
                100,
                createBetrayalScriptedRandom(...weapon.rollPips),
            );
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: lethalTraitsForPendingDamage(core, weapon.lethalTrait) },
                101,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeDefined();
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, card.name).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                102,
                createBetrayalScriptedRandom(3),
            );

            const expectedInventoryIds = [
                'skull',
                'rope',
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
            ];
            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('阻止死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeUndefined();
            expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), card.name).toEqual(expectedInventoryIds);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), card.name).not.toContain('1');
            expect(core.usedCardIdsThisTurn, card.name).toEqual(expect.arrayContaining(['haunt-attack', weapon.card.id, 'rope']));
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
            verifiedWeaponNames.push(weapon.card.name);
        }

        expect(verifiedWeaponNames).toEqual(['砍刀', '匕首', '指环']);
    });

it('当前三张攻击武器下，当前运行持有牌全集在头骨失败且兔脚仍失败后都会掩埋并不可搜尸', () => {
        const verifiedWeaponNames: string[] = [];
        const weaponCases = [
            {
                card: { id: 'hunting-knife', name: '砍刀', kind: 'item' as const },
                lethalTrait: 'might' as const,
                rollPips: [3, 3, 1],
            },
            {
                card: { id: 'dagger', name: '匕首', kind: 'omen' as const },
                lethalTrait: 'might' as const,
                rollPips: [3, 3, 3, 3, 1],
            },
            {
                card: { id: 'ring', name: '指环', kind: 'omen' as const },
                lethalTrait: 'sanity' as const,
                rollPips: [3, 3, 1],
            },
        ];

        for (const weapon of weaponCases) {
            const verifiedCardNames: string[] = [];

            for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '0');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? {
                        ...explorer,
                        roomId: 'hallway',
                        inventory: [
                            { id: 'skull', name: '头骨', kind: 'omen' },
                            { id: 'rope', name: '兔脚', kind: 'item' },
                            ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
                        ],
                    }
                    : explorer
            ));
            setTestExplorerInventory(core, '0', [weapon.card]);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '0', 'might', [2], 0, 0);
            setTestTraitTrack(core, '0', 'speed', [2, 3, 3], 2, 0);
            setTestTraitTrack(core, '0', 'sanity', [2], 0, 0);
            setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'knowledge', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'sanity', [1, 1, 1], 1, 1);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.HAUNT_ATTACK,
                '0',
                { target: 'hero', targetPlayerId: '1', weaponCardId: weapon.card.id },
                100,
                createBetrayalScriptedRandom(...weapon.rollPips),
            );
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: lethalTraitsForPendingDamage(core, weapon.lethalTrait) },
                101,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeDefined();
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, card.name).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                102,
                createBetrayalScriptedRandom(1),
            );

            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toMatchObject({
                name: '狂热病患',
                roomId: 'hallway',
            });
            expect(findTestExplorer(core, '1').inventory, card.name).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(corpse, card.name).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
            expect(core.usedCardIdsThisTurn, card.name).toEqual(expect.arrayContaining(['haunt-attack', weapon.card.id, 'rope']));
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
            verifiedWeaponNames.push(weapon.card.name);
        }

        expect(verifiedWeaponNames).toEqual(['砍刀', '匕首', '指环']);
    });

it('当前运行持有牌全集在普通攻击头骨失败且兔脚成功后都不掩埋', () => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '0');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? {
                        ...explorer,
                        roomId: 'hallway',
                        inventory: [
                            { id: 'skull', name: '头骨', kind: 'omen' },
                            { id: 'rope', name: '兔脚', kind: 'item' },
                            ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
                        ],
                    }
                    : explorer
            ));
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '0', 'might', [2], 0, 0);
            setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.HAUNT_ATTACK,
                '0',
                { target: 'hero', targetPlayerId: '1' },
                100,
                createBetrayalScriptedRandom(3, 3, 1),
            );
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: lethalTraitsForPendingDamage(core, 'might') },
                101,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeDefined();
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, card.name).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                102,
                createBetrayalScriptedRandom(3),
            );

            const expectedInventoryIds = [
                'skull',
                'rope',
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
            ];
            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('阻止死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeUndefined();
            expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), card.name).toEqual(expectedInventoryIds);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), card.name).not.toContain('1');
            expect(core.usedCardIdsThisTurn, card.name).toEqual(expect.arrayContaining(['haunt-attack', 'rope']));
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('当前运行持有牌全集在普通攻击头骨失败且兔脚仍失败后都会掩埋并不可搜尸', () => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '0');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '1'
                    ? {
                        ...explorer,
                        roomId: 'hallway',
                        inventory: [
                            { id: 'skull', name: '头骨', kind: 'omen' },
                            { id: 'rope', name: '兔脚', kind: 'item' },
                            ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
                        ],
                    }
                    : explorer
            ));
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '0', 'might', [2], 0, 0);
            setTestTraitTrack(core, '1', 'might', [1, 1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'speed', [1, 1, 1], 1, 1);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.HAUNT_ATTACK,
                '0',
                { target: 'hero', targetPlayerId: '1' },
                100,
                createBetrayalScriptedRandom(3, 3, 1),
            );
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: lethalTraitsForPendingDamage(core, 'might') },
                101,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeDefined();
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, card.name).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                102,
                createBetrayalScriptedRandom(1),
            );

            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toMatchObject({
                name: '狂热病患',
                roomId: 'hallway',
            });
            expect(findTestExplorer(core, '1').inventory, card.name).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(corpse, card.name).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
            expect(core.usedCardIdsThisTurn, card.name).toEqual(expect.arrayContaining(['haunt-attack', 'rope']));
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('灰尘永久叛徒因普通攻击伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-ordinary-attack-lethal',
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

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

it('灰尘永久叛徒死亡变狂热病患时会掩埋物品和预兆，尸体不可搜刮', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-dead-traitor-buries-possessions',
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

        const deadTraitor = findTestExplorer(core, '1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(deadTraitor.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(corpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
    });

it('灰尘非叛徒死亡时不会掩埋遗物，尸体仍可被同房探索者搜刮', () => {
        let core = createDustHauntCore();
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds).not.toContain('1');

        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-dead-non-traitor-keeps-corpse-loot',
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

        const deadNonTraitor = findTestExplorer(core, '1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(deadNonTraitor.inventory.map((card) => card.id)).toEqual(['map', 'omen-book']);

        activateTestExplorer(core, '2');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';

        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).toContain('1');
        const corpseBeforeLoot = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(corpseBeforeLoot).toMatchObject({
            itemCount: 1,
            omenCount: 1,
            canBeLootedByCurrentExplorer: true,
            lootableCardIds: ['map', 'omen-book'],
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '2', {
            sourcePlayerId: '1',
            cardId: 'map',
        });

        const looter = findTestExplorer(core, '2');
        const corpseAfterLoot = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
        expect(looter.inventory.map((card) => card.id)).toContain('map');
        expect(corpseAfterLoot).toMatchObject({
            inventory: [{ id: 'omen-book', name: '书本', kind: 'omen' }],
            itemCount: 0,
            omenCount: 1,
            lootedThisTurn: true,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('1');
    });

it('灰尘同回合先交易后仍可搜刮非叛徒尸体，交易和搜尸预算互不合并', () => {
        let core = createDustTradeAndCorpseLootReadyCore();

        const tradeBeforeLoot = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '2',
                cardId: 'rope',
            }),
        );
        expect(tradeBeforeLoot.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '2',
            cardId: 'rope',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '2', {
            accept: true,
        });

        expect(core.tradeUsedThisTurnPlayerIds).toContain('0');
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toEqual([]);
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['omen-book']);
        expect(findTestExplorer(core, '2').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope']);

        const lootAfterTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
                sourcePlayerId: '1',
                cardId: 'corpse-map',
            }),
        );
        expect(lootAfterTrade.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
            sourcePlayerId: '1',
            cardId: 'corpse-map',
        });

        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['omen-book', 'corpse-map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['corpse-skull']);

        const secondTradeSameTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '2',
                cardId: 'omen-book',
            }),
        );
        expect(secondTradeSameTurn.valid).toBe(false);
        if (!secondTradeSameTurn.valid) {
            expect(secondTradeSameTurn.error).toContain('本回合已经完成过交易');
        }

        const secondLootSameCorpse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
                sourcePlayerId: '1',
                cardId: 'corpse-skull',
            }),
        );
        expect(secondLootSameCorpse.valid).toBe(false);
        if (!secondLootSameCorpse.valid) {
            expect(secondLootSameCorpse.error).toContain('搜刮尸体必须先选择尸体和具体持有物');
        }
    });

it('灰尘同回合先搜刮非叛徒尸体后仍可交易，搜尸和交易预算互不合并', () => {
        let core = createDustTradeAndCorpseLootReadyCore();

        const lootBeforeTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
                sourcePlayerId: '1',
                cardId: 'corpse-map',
            }),
        );
        expect(lootBeforeTrade.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
            sourcePlayerId: '1',
            cardId: 'corpse-map',
        });

        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('1');
        expect(core.tradeUsedThisTurnPlayerIds).toEqual([]);
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['rope', 'omen-book', 'corpse-map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['corpse-skull']);

        const tradeAfterLoot = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '2',
                cardId: 'rope',
            }),
        );
        expect(tradeAfterLoot.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '2',
            cardId: 'rope',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '2', {
            accept: true,
        });

        expect(core.tradeUsedThisTurnPlayerIds).toContain('0');
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['omen-book', 'corpse-map']);
        expect(findTestExplorer(core, '2').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope']);

        const secondLootSameCorpse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
                sourcePlayerId: '1',
                cardId: 'corpse-skull',
            }),
        );
        expect(secondLootSameCorpse.valid).toBe(false);
        if (!secondLootSameCorpse.valid) {
            expect(secondLootSameCorpse.error).toContain('搜刮尸体必须先选择尸体和具体持有物');
        }

        const secondTradeSameTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '2',
                cardId: 'omen-book',
            }),
        );
        expect(secondTradeSameTurn.valid).toBe(false);
        if (!secondTradeSameTurn.valid) {
            expect(secondTradeSameTurn.error).toContain('本回合已经完成过交易');
        }
    });

it('灰尘非叛徒头骨失败后兔脚成功会回滚死亡且不留下可搜尸体', () => {
        let core = createDustNonTraitorRabbitFootDeathReadyCore();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();

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
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId)).not.toContain('1');
        expect(resolveBetrayalHauntTokenInstances(core).map((token) => token.id)).not.toContain('corpse-1');

        activateTestExplorer(core, '2');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it('灰尘非叛徒头骨失败后兔脚仍失败会保留尸体遗物并允许同房搜刮', () => {
        let core = createDustNonTraitorRabbitFootDeathReadyCore();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );
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
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);

        activateTestExplorer(core, '2');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';

        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).toContain('1');
        const corpseBeforeLoot = resolveBetrayalDeathStateSummary(core).corpses.find((corpse) => corpse.playerId === '1');
        expect(corpseBeforeLoot).toMatchObject({
            itemCount: 2,
            omenCount: 1,
            canBeLootedByCurrentExplorer: true,
            lootableCardIds: ['skull', 'rope', 'map'],
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '2', {
            sourcePlayerId: '1',
            cardId: 'map',
        });

        expect(findTestExplorer(core, '2').inventory.map((card) => card.id)).toContain('map');
        const corpseAfterLoot = resolveBetrayalDeathStateSummary(core).corpses.find((corpse) => corpse.playerId === '1');
        expect(corpseAfterLoot).toMatchObject({
            inventory: [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
            ],
            lootedThisTurn: true,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
    });

it('灰尘永久叛徒最终死亡变狂热病患时会掩埋全部当前运行持有牌', () => {
        const buriedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [{ ...card }];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            setTestTraitTrack(core, '1', 'might', [1], 0, 0);
            setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: `dust-buries-${card.id}`,
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
                100,
                createBetrayalScriptedRandom(1, 1, 1),
            );

            const deadTraitor = findTestExplorer(core, '1');
            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            buriedCardNames.push(card.name);
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(deadTraitor.inventory, card.name).toEqual([]);
            expect(core.currentExplorerInventory, card.name).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(corpse, card.name).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
        }

        expect(buriedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('灰尘永久叛徒因作祟后火炉房伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            playerId: '1',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', { traits: ['might'] });

        expect(core.currentPlayer).toBe('2');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'ground-north',
        });
        expect(core.endgameResult).toBeNull();
    });

it('灰尘火炉房伤害本会触发叛徒终局时，兔脚成功会先回滚死亡并交接回合', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            playerId: '1',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
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

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.recentRoll).toBeNull();
        expect(core.endgameResult).toBeNull();
    });

it('灰尘火炉房伤害本会触发叛徒终局时，兔脚仍失败会触发叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            playerId: '1',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
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
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘永久叛徒因作祟后倒塌房间坠落伤害死亡时也会变成狂热病患', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '2',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });
        expect(core.pendingDamageAllocation).toBeNull();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '1',
            amount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', {
            traits: ['might', 'speed'],
        });

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'basement-landing',
        });
        expect(core.endgameResult).toBeNull();
    });

it('灰尘倒塌房间坠落伤害本会触发叛徒终局时，兔脚成功会先回滚死亡并保留坠落位置', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '2',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });
        expect(core.pendingDamageAllocation).toBeNull();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '1',
            amount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
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
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '1')?.roomId).toBe('basement-landing');
        expect(core.recentRoll).toBeNull();
        expect(core.endgameResult).toBeNull();
    });

it('灰尘倒塌房间坠落伤害本会触发叛徒终局时，兔脚仍失败会保留坠落位置并触发叛徒胜利', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(core, '1', 'might', [1], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn).toMatchObject({
            roomName: '倒塌房间',
            nextPlayerId: '2',
            previousDestinationRoomId: 'basement-landing',
            previousPhysicalDamage: 2,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '倒塌房间',
            damageKind: 'physical',
            playerId: '1',
            amount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
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
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('当前两类房间伤害下，当前运行持有牌全集在头骨失败且兔脚成功后都不掩埋，盔甲归零例外不进入死亡', () => {
        const expectedCardNames = collectRuntimePossessionCardNames();
        const roomDamageCases = [
            {
                label: '火炉房',
                roomId: 'ground-north',
                expectedRoomId: 'ground-north',
                damageTraits: ['might'] as BetrayalTraitKey[],
                room: {
                    name: '火炉房',
                    hint: '在此结束回合会受到房间伤害。',
                    tags: ['伤害'],
                    discoveryReward: null,
                    visualId: 'furnaceRoom',
                    endTurnEffect: 'physicalDamage1',
                },
            },
            {
                label: '倒塌房间',
                roomId: 'upper-north',
                expectedRoomId: 'basement-landing',
                damageTraits: ['might', 'speed'] as BetrayalTraitKey[],
                room: {
                    name: '倒塌房间',
                    hint: '速度检定失败会坠落到地下室起始点。',
                    tags: ['上层', '伤害'],
                    discoveryReward: null,
                    visualId: 'collapsedRoom',
                    endTurnEffect: 'speedCheckFallToBasement',
                },
            },
        ];
        const verifiedLabels: string[] = [];

        expect(collectRuntimePossessionCards().map((card) => card.name)).toEqual(expectedCardNames);

        for (const roomCase of roomDamageCases) {
            for (const card of collectRuntimePossessionCards()) {
                let core = createDustHauntCore();
                placeActiveTestExplorerInRoom(core, '1', roomCase.roomId);
                setDiscoveredTestRoom(core, roomCase.roomId, roomCase.room);
                core.currentExplorer.inventory = [
                    { id: 'skull', name: '头骨', kind: 'omen' },
                    { id: 'rope', name: '兔脚', kind: 'item' },
                    ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
                ];
                core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
                core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
                core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
                core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
                core.currentExplorerTraits = { ...core.currentExplorer.traits };

                core = applyBetrayalCommand(
                    core,
                    BETRAYAL_COMMANDS.END_TURN,
                    '1',
                    {},
                    100,
                    roomCase.label === '倒塌房间' ? createBetrayalScriptedRandom(1, 3) : BETRAYAL_FIXED_RANDOM,
                );

                if (roomCase.label === '倒塌房间') {
                    expect(core.currentExplorer.roomId, `${roomCase.label}:${card.name}`).toBe('basement-landing');
                    expect(core.recentRoll?.kind, `${roomCase.label}:${card.name}`).toBe('roomEndTurnTraitCheck');
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});
                }

                const effectiveDamageAmount = Math.max(0, roomCase.damageTraits.length - (card.id === 'armor' ? 1 : 0));
                const expectedInventoryIds = [
                    'skull',
                    'rope',
                    ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
                ];
                if (effectiveDamageAmount === 0) {
                    expect(core.pendingDamageAllocation, `${roomCase.label}:${card.name}`).toBeNull();
                    expect(core.currentPlayer, `${roomCase.label}:${card.name}`).toBe('2');
                    expect(core.recentRoll, `${roomCase.label}:${card.name}`).toBeNull();
                    expect(core.scenarioRuntime.deadExplorerPlayerIds, `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), `${roomCase.label}:${card.name}`).toEqual(expectedInventoryIds);
                    expect(resolveCorpseLootTargets(core).map((target) => target.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(core.usedCardIdsThisTurn, `${roomCase.label}:${card.name}`).not.toContain('rope');
                    verifiedLabels.push(`${roomCase.label}:${card.name}`);
                    continue;
                }

                expect(core.pendingDamageAllocation, `${roomCase.label}:${card.name}`).toMatchObject({
                    sourceTitle: roomCase.label,
                    damageKind: 'physical',
                    playerId: '1',
                    amount: effectiveDamageAmount,
                    allowSkull: true,
                    nextPlayerId: '2',
                });
                const assignedTraits = roomCase.damageTraits.slice(0, effectiveDamageAmount);

                core = applyBetrayalCommand(
                    core,
                    BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                    '1',
                    { traits: assignedTraits },
                    101,
                    createBetrayalScriptedRandom(1, 2, 2),
                );

                expect(core.recentRoll?.kind, `${roomCase.label}:${card.name}`).toBe('deathPrevention');
                expect(core.recentRoll?.latestLabel, `${roomCase.label}:${card.name}`).toBe('正常死亡');
                expect(core.scenarioRuntime.deadExplorerPlayerIds, `${roomCase.label}:${card.name}`).toContain('1');
                expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${roomCase.label}:${card.name}`).toContain('1');
                expect(BetrayalDomain.validate(
                    { core, sys: {} as never },
                    createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
                ).valid, `${roomCase.label}:${card.name}`).toBe(true);

                core = applyBetrayalCommand(
                    core,
                    BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                    '1',
                    { cardId: 'rope', dieIndex: 0 },
                    102,
                    createBetrayalScriptedRandom(3),
                );

                expect(core.currentExplorer.roomId, `${roomCase.label}:${card.name}`).toBe(roomCase.expectedRoomId);
                expect(core.recentRoll?.kind, `${roomCase.label}:${card.name}`).toBe('deathPrevention');
                expect(core.recentRoll?.latestLabel, `${roomCase.label}:${card.name}`).toBe('阻止死亡');
                expect(core.scenarioRuntime.deadExplorerPlayerIds, `${roomCase.label}:${card.name}`).not.toContain('1');
                expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${roomCase.label}:${card.name}`).not.toContain('1');
                expect(core.monsters.find((monster) => monster.id === 'feverish-1'), `${roomCase.label}:${card.name}`).toBeUndefined();
                expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), `${roomCase.label}:${card.name}`).toEqual(expectedInventoryIds);
                expect(core.currentExplorerInventory.map((inventoryCard) => inventoryCard.id), `${roomCase.label}:${card.name}`).toEqual(expectedInventoryIds);
                expect(resolveCorpseLootTargets(core).map((target) => target.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                expect(core.usedCardIdsThisTurn, `${roomCase.label}:${card.name}`).toContain('rope');
                verifiedLabels.push(`${roomCase.label}:${card.name}`);
            }
        }

        expect(verifiedLabels).toEqual(roomDamageCases.flatMap((roomCase) => (
            expectedCardNames.map((cardName) => `${roomCase.label}:${cardName}`)
        )));
    });

it('当前两类房间伤害下，当前运行持有牌全集在头骨失败且兔脚仍失败后都会掩埋并不可搜尸，盔甲归零例外不进入死亡', () => {
        const expectedCardNames = collectRuntimePossessionCardNames();
        const roomDamageCases = [
            {
                label: '火炉房',
                roomId: 'ground-north',
                expectedMonsterRoomId: 'ground-north',
                damageTraits: ['might'] as BetrayalTraitKey[],
                room: {
                    name: '火炉房',
                    hint: '在此结束回合会受到房间伤害。',
                    tags: ['伤害'],
                    discoveryReward: null,
                    visualId: 'furnaceRoom',
                    endTurnEffect: 'physicalDamage1',
                },
            },
            {
                label: '倒塌房间',
                roomId: 'upper-north',
                expectedMonsterRoomId: 'basement-landing',
                damageTraits: ['might', 'speed'] as BetrayalTraitKey[],
                room: {
                    name: '倒塌房间',
                    hint: '速度检定失败会坠落到地下室起始点。',
                    tags: ['上层', '伤害'],
                    discoveryReward: null,
                    visualId: 'collapsedRoom',
                    endTurnEffect: 'speedCheckFallToBasement',
                },
            },
        ];
        const verifiedLabels: string[] = [];

        expect(collectRuntimePossessionCards().map((card) => card.name)).toEqual(expectedCardNames);

        for (const roomCase of roomDamageCases) {
            for (const card of collectRuntimePossessionCards()) {
                let core = createDustHauntCore();
                placeActiveTestExplorerInRoom(core, '1', roomCase.roomId);
                setDiscoveredTestRoom(core, roomCase.roomId, roomCase.room);
                core.currentExplorer.inventory = [
                    { id: 'skull', name: '头骨', kind: 'omen' },
                    { id: 'rope', name: '兔脚', kind: 'item' },
                    ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
                ];
                core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
                core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
                core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
                core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
                setTestTraitTrack(core, '1', 'might', [1], 0, 0);
                setTestTraitTrack(core, '1', 'speed', [1], 0, 0);
                core.currentExplorerTraits = { ...core.currentExplorer.traits };

                core = applyBetrayalCommand(
                    core,
                    BETRAYAL_COMMANDS.END_TURN,
                    '1',
                    {},
                    100,
                    roomCase.label === '倒塌房间' ? createBetrayalScriptedRandom(1, 3) : BETRAYAL_FIXED_RANDOM,
                );

                if (roomCase.label === '倒塌房间') {
                    expect(core.currentExplorer.roomId, `${roomCase.label}:${card.name}`).toBe('basement-landing');
                    expect(core.recentRoll?.kind, `${roomCase.label}:${card.name}`).toBe('roomEndTurnTraitCheck');
                    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});
                }

                const effectiveDamageAmount = Math.max(0, roomCase.damageTraits.length - (card.id === 'armor' ? 1 : 0));
                const expectedInventoryIds = [
                    'skull',
                    'rope',
                    ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
                ];
                if (effectiveDamageAmount === 0) {
                    expect(core.pendingDamageAllocation, `${roomCase.label}:${card.name}`).toBeNull();
                    expect(core.currentPlayer, `${roomCase.label}:${card.name}`).toBe('2');
                    expect(core.recentRoll, `${roomCase.label}:${card.name}`).toBeNull();
                    expect(core.scenarioRuntime.deadExplorerPlayerIds, `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), `${roomCase.label}:${card.name}`).toEqual(expectedInventoryIds);
                    expect(resolveCorpseLootTargets(core).map((target) => target.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                    expect(core.usedCardIdsThisTurn, `${roomCase.label}:${card.name}`).not.toContain('rope');
                    verifiedLabels.push(`${roomCase.label}:${card.name}`);
                    continue;
                }

                expect(core.pendingDamageAllocation, `${roomCase.label}:${card.name}`).toMatchObject({
                    sourceTitle: roomCase.label,
                    damageKind: 'physical',
                    playerId: '1',
                    amount: effectiveDamageAmount,
                    allowSkull: true,
                    nextPlayerId: '2',
                });
                const assignedTraits = roomCase.damageTraits.slice(0, effectiveDamageAmount);

                core = applyBetrayalCommand(
                    core,
                    BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                    '1',
                    { traits: assignedTraits },
                    101,
                    createBetrayalScriptedRandom(1, 2, 2),
                );

                expect(core.recentRoll?.kind, `${roomCase.label}:${card.name}`).toBe('deathPrevention');
                expect(core.recentRoll?.latestLabel, `${roomCase.label}:${card.name}`).toBe('正常死亡');
                expect(core.scenarioRuntime.deadExplorerPlayerIds, `${roomCase.label}:${card.name}`).toContain('1');
                expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${roomCase.label}:${card.name}`).toContain('1');
                expect(BetrayalDomain.validate(
                    { core, sys: {} as never },
                    createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
                ).valid, `${roomCase.label}:${card.name}`).toBe(true);

                core = applyBetrayalCommand(
                    core,
                    BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                    '1',
                    { cardId: 'rope', dieIndex: 0 },
                    102,
                    createBetrayalScriptedRandom(1),
                );

                const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
                expect(core.recentRoll?.kind, `${roomCase.label}:${card.name}`).toBe('deathPrevention');
                expect(core.recentRoll?.latestLabel, `${roomCase.label}:${card.name}`).toBe('正常死亡');
                expect(core.scenarioRuntime.deadExplorerPlayerIds, `${roomCase.label}:${card.name}`).toContain('1');
                expect(core.scenarioRuntime.dust?.feverishPlayerIds, `${roomCase.label}:${card.name}`).toContain('1');
                expect(core.monsters.find((monster) => monster.id === 'feverish-1'), `${roomCase.label}:${card.name}`).toMatchObject({
                    name: '狂热病患',
                    roomId: roomCase.expectedMonsterRoomId,
                });
                expect(findTestExplorer(core, '1').inventory, `${roomCase.label}:${card.name}`).toEqual([]);
                expect(core.currentExplorerInventory, `${roomCase.label}:${card.name}`).toEqual([]);
                expect(resolveCorpseLootTargets(core).map((target) => target.playerId), `${roomCase.label}:${card.name}`).not.toContain('1');
                expect(corpse, `${roomCase.label}:${card.name}`).toMatchObject({
                    itemCount: 0,
                    omenCount: 0,
                    canBeLootedByCurrentExplorer: false,
                    lootableCardIds: [],
                });
                expect(core.usedCardIdsThisTurn, `${roomCase.label}:${card.name}`).toContain('rope');
                verifiedLabels.push(`${roomCase.label}:${card.name}`);
            }
        }

        expect(verifiedLabels).toEqual(roomDamageCases.flatMap((roomCase) => (
            expectedCardNames.map((cardName) => `${roomCase.label}:${cardName}`)
        )));
    });
});
