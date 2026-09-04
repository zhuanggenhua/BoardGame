import { describe, expect, it } from 'vitest';
import {
    acknowledgePendingCardResolutions,
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCorpseLootReadyCore,
    createExchangeReadyCore,
    createFirstScenarioHauntCore,
    createJackSpiritReviveReadyCore,
    createJackSpiritPostReviveAttackReadyCore,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    EXPLORER_CATALOG,
    resolveBetrayalDeathStateSummary,
    BETRAYAL_DISCOVERY_POOLS,
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
    findTestExplorer,
    setTestExplorerRoom,
    setNextDiscoverySymbolRoomsForAllFloors,
    setHighCapacityPhysicalDamageTracks,
    traitTrackPositionTotal,
    repeatTraitsForPendingDamage,
    requireRuntimeOmenCard,
    lethalTraitsForPendingDamage,
} from './helpers/firstScenarioRuntimeHarness';
import {
    resolveBetrayalHauntRisk,
    resolveBetrayalNumberTracks,
    resolveBetrayalOmenCount,
} from '../hauntProgress';

describe('Betrayal first scenario runtime - jack revival, corpse loot, and haunt risk', () => {
it('死叛徒回合攻击英雄时应按 Jack’s Spirit 的房间和数值行动', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : explorer
        ));
        const attackValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero' }),
        );
        expect(attackValidation.valid).toBe(false);

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: core.scenarioRuntime.jackSpiritRoomId! }
                : explorer
        ));
        setHighCapacityPhysicalDamageTracks(core, '0');
        const hero = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        const heroPhysicalPositionBefore = traitTrackPositionTotal(core, '0', ['might', 'speed']);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.playerId).toBe('2');
        expect(core.recentRoll?.dice.length).toBeGreaterThan(0);
        expect(core.recentRoll?.attack?.target).toBe('hero');
        expect(core.recentRoll?.attack?.defenderPlayerId).toBe('0');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '0',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBe(heroPhysicalPositionBefore);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const updatedHero = findTestExplorer(core, '0');
        expect(updatedHero.traits.might + updatedHero.traits.speed).toBe(hero.traits.might + hero.traits.speed);
        expect(traitTrackPositionTotal(core, '0', ['might', 'speed'])).toBeLessThan(heroPhysicalPositionBefore);
        expect(core.pendingDamageAllocation).toBeNull();
    });

it('英雄持有 Knowledge of Jack 时，被 Jack’s Spirit 攻击也应获得 +2 防御加成', () => {
        let withoutBonus = createFirstScenarioHauntCore();
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(withoutBonus, 'might') },
        );
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.END_TURN, '0', {});
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));
        setTestExplorerRoom(withoutBonus, '0', withoutBonus.scenarioRuntime.jackSpiritRoomId!);
        setHighCapacityPhysicalDamageTracks(withoutBonus, '0');
        const noBonusHeroPositionBefore = traitTrackPositionTotal(withoutBonus, '0', ['might', 'speed']);
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        expect(withoutBonus.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '0',
        });
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(withoutBonus, ['might', 'speed']) },
        );
        const noBonusHeroPositionAfter = traitTrackPositionTotal(withoutBonus, '0', ['might', 'speed']);

        let withBonus = createFirstScenarioHauntCore();
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(withBonus, 'might') },
        );
        withBonus.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.END_TURN, '0', {});
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));
        setTestExplorerRoom(withBonus, '0', withBonus.scenarioRuntime.jackSpiritRoomId!);
        setHighCapacityPhysicalDamageTracks(withBonus, '0');
        const bonusHeroPositionBefore = traitTrackPositionTotal(withBonus, '0', ['might', 'speed']);
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        expect(withBonus.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '0',
        });
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(withBonus, ['might', 'speed']) },
        );
        const bonusHeroPositionAfter = traitTrackPositionTotal(withBonus, '0', ['might', 'speed']);

        const noBonusLoss = noBonusHeroPositionBefore - noBonusHeroPositionAfter;
        const bonusLoss = bonusHeroPositionBefore - bonusHeroPositionAfter;

        expect(noBonusLoss).toBeGreaterThan(bonusLoss);
    });

it('Jack’s Spirit 回到尸体房间后，应在怪物回合开始时复活叛徒并移除 spirit', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(3, 2, 2));

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.recentRoll?.kind).toBe('monsterMoveRoll');
        expect(core.recentRoll?.dice).toEqual([2, 1, 1]);
        expect(core.movesRemaining).toBe(4);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-landing' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('upper-landing');
        expect(core.movesRemaining).toBe(3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('grand-staircase');
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');
        expect(core.movesRemaining).toBe(1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-east' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.movesRemaining).toBe(0);

        const moveAfterAllowanceSpent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' }),
        );
        expect(moveAfterAllowanceSpent.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBeNull();
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')).toBeUndefined();
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.currentExplorer.traits.might).toBeGreaterThan(1);
        const template = EXPLORER_CATALOG.find((explorer) => explorer.explorerId === core.currentExplorer.explorerId)!;
        expect(core.currentExplorer.traits.might).toBe(template.traits.might);
        expect(core.currentExplorer.traits.speed).toBe(template.traits.speed);
    });

it('同房间尸体上的 Item/Omen 应可每回合搜刮 1 件，且同一尸体同回合不能连续搜刮', () => {
        let core = createCorpseLootReadyCore();
        let deathState = resolveBetrayalDeathStateSummary(core);

        expect(deathState).toMatchObject({
            hauntDeathRulesActive: true,
            livingExplorerPlayerIds: ['1', '2'],
            deadExplorerPlayerIds: ['0'],
            corpseLootedThisTurnPlayerIds: [],
        });
        expect(deathState.corpses[0]).toMatchObject({
            playerId: '0',
            roomId: 'hallway',
            roomName: '门厅',
            shouldLayTokenFlat: true,
            itemCount: 1,
            omenCount: 1,
            lootedThisTurn: false,
            canBeLootedByCurrentExplorer: true,
            lootableCardIds: ['corpse-item-1', 'corpse-omen-1'],
        });

        const missingCardValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0' }),
        );
        expect(missingCardValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-item-1' });

        const lootedByTeammate = core.currentExplorer.playerId === '1'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        const corpseAfterLoot = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        expect(lootedByTeammate.inventory.length).toBeGreaterThan(1);
        expect(corpseAfterLoot.inventory).toHaveLength(1);
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('0');
        deathState = resolveBetrayalDeathStateSummary(core);
        expect(deathState.corpses[0]).toMatchObject({
            playerId: '0',
            inventory: [{ id: 'corpse-omen-1', name: '黑暗预兆', kind: 'omen' }],
            itemCount: 0,
            omenCount: 1,
            lootedThisTurn: true,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });

        const secondLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-omen-1' }),
        );
        expect(secondLootValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('1');

        const nextTurnLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-omen-1' }),
        );
        expect(nextTurnLootValidation.valid).toBe(true);
    });

it('搜尸前置态应把真实页面停在可点击正式搜尸动作的运行时', () => {
        const core = createCorpseLootReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.activeRoomId).toBe('hallway');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.recommendedAction).toBe('trade');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.inventory).toHaveLength(2);
    });

it('杰克之灵复活前置态应停在只差结束当前回合就会复活叛徒的运行时', () => {
        const core = createJackSpiritReviveReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.jackSpiritHasMovedSinceRelease).toBe(true);
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-east');
    });

it('叛徒复活后的前置态应停在同房间可直接攻击英雄的运行时', () => {
        const core = createJackSpiritPostReviveAttackReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.currentExplorer.roomId).toBe('basement-east');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('basement-east');
        expect(core.recommendedAction).toBe('move');
    });

it('预兆状态按所有玩家当前持有预兆总数派生', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.currentExplorer.inventory = [
            requireRuntimeOmenCard('omen-book'),
            { id: 'item-alpha', name: '物品A', kind: 'item' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                requireRuntimeOmenCard(index === 0 ? 'dog' : 'mask'),
            ],
        }));

        const risk = resolveBetrayalHauntRisk(core);

        expect(resolveBetrayalOmenCount(core)).toBe(3);
        expect(risk.omenCount).toBe(3);
        expect(risk.nextRollDiceCount).toBe(4);
        expect(risk.threshold).toBe(5);
        expect(risk.hauntStarted).toBe(false);

        const riskTrack = resolveBetrayalNumberTracks(core).find((track) => track.id === 'haunt-risk');
        expect(riskTrack).toMatchObject({
            kind: 'haunt-risk',
            label: '预兆状态',
            value: 3,
            min: 0,
            max: 9,
            targetValue: 9,
            currentLabel: '预兆 3',
            targetLabel: '牌堆末张',
            statusLabel: '预兆已发现',
            progressPercent: 33,
            source: 'base-rule',
            representativeOnly: false,
        });
    });

it('交易转移预兆后，预兆状态仍按全员总数而不是当前玩家持有数派生', () => {
        let core = createExchangeReadyCore();
        const riskBeforeTrade = resolveBetrayalHauntRisk(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardIds: ['omen-book'],
            targetCardIds: ['map'],
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        const currentPlayerOmenCount = core.currentExplorer.inventory.filter((card) => card.kind === 'omen').length;
        const riskAfterTrade = resolveBetrayalHauntRisk(core);
        const riskTrackAfterTrade = resolveBetrayalNumberTracks(core)
            .find((track) => track.id === 'haunt-risk');

        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'omen-book']);
        expect(currentPlayerOmenCount).toBe(0);
        expect(resolveBetrayalOmenCount(core)).toBe(riskBeforeTrade.omenCount);
        expect(riskAfterTrade).toMatchObject({
            omenCount: riskBeforeTrade.omenCount,
            requestedRollOmenCount: riskBeforeTrade.requestedRollOmenCount,
            nextRollDiceCount: riskBeforeTrade.nextRollDiceCount,
        });
        expect(riskTrackAfterTrade).toMatchObject({
            id: 'haunt-risk',
            value: riskBeforeTrade.omenCount,
            max: 9,
            targetValue: 9,
            currentLabel: `预兆 ${riskBeforeTrade.omenCount}`,
            statusLabel: '预兆已发现',
        });
    });

it('抽到预兆时作祟检定骰数和预兆状态模型一致', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        const triggerOmen = requireRuntimeOmenCard('holy-symbol');
        core.drawOrder = ['omen'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
        core.possessionOrderByKind.omen = [
            { ...triggerOmen },
        ];
        core.currentExplorer.inventory = [
            requireRuntimeOmenCard('omen-book'),
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                requireRuntimeOmenCard(index === 0 ? 'dog' : 'mask'),
            ],
        }));
        const riskBeforeDraw = resolveBetrayalHauntRisk(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(riskBeforeDraw.omenCount).toBe(3);
        expect(riskBeforeDraw.nextRollDiceCount).toBe(4);
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.dice).toHaveLength(riskBeforeDraw.nextRollDiceCount);
        expect(core.latestDiscovery?.detail).toContain('4 颗骰子');
    });

it('抽到最后一张预兆时按公共规则自动触发作祟', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        const triggerOmen = BETRAYAL_DISCOVERY_POOLS.possessions.omen.find((card) => card.id === 'dog')!;
        core.drawOrder = ['omen'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
        core.possessionOrderByKind.omen = [
            { ...triggerOmen },
        ];
        core.deckCounts.omen = 1;
        const riskBeforeDraw = resolveBetrayalHauntRisk(core);

        expect(riskBeforeDraw.nextOmenAutomatic).toBe(true);
        expect(riskBeforeDraw.omenDeckRemaining).toBe(1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.latestDiscovery?.title).toBe(triggerOmen.name);
        expect(core.latestDiscovery?.detail).toContain('预兆牌堆耗尽，自动触发作祟');
        expect(core.latestDiscovery?.detail).not.toContain('最后预兆');
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.triggeringOmenName).toBe(triggerOmen.name);
        expect(core.pendingCardResolutionQueue).toEqual([
            expect.objectContaining({
                stepKind: 'drawn-card',
                cardName: triggerOmen.name,
                total: 1,
            }),
        ]);
        expect(core.pendingCardResolutionQueue.some((step) => step.stepKind === 'haunt-roll')).toBe(false);
    });

it('作祟检定按全员预兆总数请求骰数，但最多只投 8 颗骰', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        const triggerOmen = requireRuntimeOmenCard('dagger');
        const heldOmenCards = BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => ({ ...card }));
        core.drawOrder = ['omen'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
        core.possessionOrderByKind.omen = [
            { ...triggerOmen },
        ];
        core.currentExplorer.inventory = heldOmenCards.slice(0, 3);
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, explorerIndex) => ({
            ...explorer,
            inventory: heldOmenCards.slice(3 + explorerIndex * 3, 6 + explorerIndex * 3),
        }));
        const riskBeforeDraw = resolveBetrayalHauntRisk(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1, 1, 1, 3, 3),
        );

        expect(riskBeforeDraw.omenCount).toBe(9);
        expect(riskBeforeDraw.requestedRollOmenCount).toBe(9);
        expect(riskBeforeDraw.nextRollDiceCount).toBe(8);
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.dice).toHaveLength(8);
        expect(core.recentRoll?.dice).toEqual(Array.from({ length: 8 }, () => 0));
        expect(core.latestDiscovery?.detail).toContain('8 颗骰子');
    });

it('普通预兆触发作祟时记录开局剧本卡和触发预兆来源', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['omen'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
        core.possessionOrderByKind.omen = [
            { id: 'omen-crimson-splash', name: 'A Splash of Crimson', kind: 'omen' },
        ];
        core.currentExplorer.inventory = [
            requireRuntimeOmenCard('omen-book'),
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                requireRuntimeOmenCard(index === 0 ? 'dog' : 'mask'),
            ],
        }));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'haunt-revealer',
            traitorPlayerId: '0',
            teamModel: 'one-traitor',
            reasonLabel: '作祟揭秘者',
            candidatePlayerIds: ['0'],
            excludedPlayerIds: [],
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '0',
            nextPlayerId: '1',
            reasonLabel: '叛徒左侧玩家先行动',
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntCardNumber).toBe(1);
        expect(core.scenarioRuntime.hauntScenarioCardId).toBe(DEFAULT_BETRAYAL_SCENARIO_CARD_ID);
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('木乃伊横行');
        expect(core.scenarioRuntime.hauntScenarioCardLabel).toBe('Girl');
        expect(core.scenarioRuntime.triggeringOmenId).toMatch(/^omen-crimson-splash/);
        expect(core.scenarioRuntime.triggeringOmenName).toBe('A Splash of Crimson');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.scenarioRuntime.hauntResolutionMatchedTrigger).toBe(false);
        expect(core.scenarioRuntime.hauntResolutionRepresentativeOnly).toBe(true);
    });

it('普通预兆触发作祟后仍保留翻牌确认队列，确认前不能继续行动', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['omen'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
        core.possessionOrderByKind.omen = [
            { id: 'omen-crimson-splash', name: 'A Splash of Crimson', kind: 'omen' },
        ];
        core.currentExplorer.inventory = [
            requireRuntimeOmenCard('omen-book'),
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                requireRuntimeOmenCard(index === 0 ? 'dog' : 'mask'),
            ],
        }));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-east' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => step.kind)).toEqual([
            'drawn-card',
            'haunt-roll',
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'omen',
            cardName: 'A Splash of Crimson',
            stepKind: 'drawn-card',
            requiredPlayerIds: ['0'],
            acknowledgedPlayerIds: [],
            index: 1,
            total: 1,
        });
        expect(core.pendingCardResolutionQueue[0]?.text).toContain('作祟检定');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, core.currentPlayer, {
                roomId: 'hallway',
            }),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });

        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
    });
});
