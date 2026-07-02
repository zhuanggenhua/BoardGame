import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCorpseLootReadyCore,
    createFirstScenarioHauntCore,
    createJackSpiritReviveReadyCore,
    createJackSpiritPostReviveAttackReadyCore,
    createFirstScenarioReadyToTraitorVictoryCore,
    createStartedFirstScenarioCore,
    playFirstScenarioToSurvivorVictory,
    playFirstScenarioToTraitorVictory,
} from '../testing/firstScenarioTestUtils';
import { BETRAYAL_COMMANDS, BetrayalDomain } from '../game';
import { BETRAYAL_DISCOVERY_POOLS, BETRAYAL_SCENARIO_CONFIGS } from '../scenarioConfig';
import { resolvePossessionAtlasVisual } from '../possessionAtlas';
import { BETRAYAL_ROOM_TILE_VISUALS } from '../roomAtlas';

describe('Betrayal first scenario runtime', () => {
    it('正式局内探索会消费 setup 生成的当前局发现池顺序，而不是固定索引序列', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });

        expect(core.drawOrder).toEqual(['omen', 'item', 'event']);
        const expectedFirstUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[0]!;
        const expectedNextUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[1]!;
        expect(core.roomDiscoveryOrderByFloor.upper[0]?.name).toBe(expectedFirstUpperRoom.name);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe(expectedNextUpperRoom.name);
        expect(core.currentExplorer.inventory.at(-1)?.name).toBe('匕首');
    });

    it('正式发现池只使用已确认正面素材和可渲染房间图集，不再回落到最小代表池', () => {
        const itemIds = BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => card.id);
        const omenIds = BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => card.id);
        const roomVisualIds = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor)
            .flat()
            .map((room) => room.visualId);

        const allDiscoveryRooms = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).flat();

        expect(itemIds).toHaveLength(11);
        expect(omenIds).toEqual([
            'omen-book',
            'dog',
            'mask',
            'skull',
            'holy-symbol',
            'armor',
            'idol',
            'ring',
            'dagger',
        ]);
        expect(new Set([...itemIds, ...omenIds]).size).toBe(itemIds.length + omenIds.length);
        expect(allDiscoveryRooms).toHaveLength(43);
        expect(allDiscoveryRooms.every((room) => room.doorways.length > 0)).toBe(true);

        for (const card of [
            ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
            ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
            ...Object.values(BETRAYAL_SCENARIO_CONFIGS['first-scenario'].startingInventoryByExplorerId).flat(),
        ]) {
            expect(resolvePossessionAtlasVisual(card)).not.toBeNull();
        }
        for (const visualId of roomVisualIds) {
            expect(Object.prototype.hasOwnProperty.call(BETRAYAL_ROOM_TILE_VISUALS, visualId)).toBe(true);
        }
    });

    it('能在第三次恶兆且 haunt roll 达标后进入真实 haunt', () => {
        const core = createFirstScenarioHauntCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('2');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.currentPlayer).toBe('0');
        expect(core.activityLog[0]?.text).toContain('Crimson Jack Returns');
    });

    it('本回合新获得的物品或预兆不能立刻使用，直到下一次回合开始才可用', () => {
        const fixedItemDrawRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], fixedItemDrawRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        const newCardId = core.currentExplorer.inventory.at(-1)?.id;
        expect(newCardId).toBeTruthy();
        expect(core.latestDiscovery?.summary).toBe('已加入持有区');
        expect(core.turnStartInventoryCardIds).not.toContain(newCardId);

        const immediateUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(immediateUseValidation.valid).toBe(false);
        if (!immediateUseValidation.valid) {
            expect(immediateUseValidation.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(core.currentPlayer).toBe('0');
        expect(core.turnStartInventoryCardIds).toContain(newCardId);
        const nextTurnUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(nextTurnUseValidation.valid).toBe(true);
    });

    it('首剧本起跑位就是真实运行时，不再保留手工结算口', () => {
        const core = createStartedFirstScenarioCore();

        expect(core.phase).toBe('preHaunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.rooms.some((room) => room.id === 'upper-west' && room.name === '图书馆')).toBe(true);
    });

    it('英雄线可击倒叛徒、释放杰克之灵并完成驱魔结算', () => {
        const core = playFirstScenarioToSurvivorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toHaveLength(2);
        expect(core.endgameResult?.hauntTitle).toBe('Crimson Jack Returns');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['0', '1']);
    });

    it('叛徒线可以通过击倒全部英雄进入终局', () => {
        const core = playFirstScenarioToTraitorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.traitorPlayerId).toBe('2');
        expect(core.endgameResult?.winners).toEqual(['2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
    });

    it('叛徒收尾前一手前置态应停在真实 haunt 运行时，而不是直接进入终局', () => {
        const core = createFirstScenarioReadyToTraitorVictoryCore();
        const livingHeroesInRoom = core.otherExplorers.filter((explorer) => (
            explorer.playerId !== '2'
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && explorer.roomId === core.activeRoomId
        ));

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe('ground-north');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(livingHeroesInRoom.map((explorer) => explorer.playerId)).toEqual(['0']);
    });

    it('恶兆不会在掷骰不足 5 时提前触发 haunt', () => {
        let core = createStartedFirstScenarioCore();
        const lowHauntRoll = createBetrayalScriptedRandom(1, 1, 1, 1, 1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, lowHauntRoll);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', {}, 100, lowHauntRoll);

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.scenarioRuntime.omensDiscovered).toBe(0);
        expect(core.latestDiscovery?.kind).toBe('item');
    });

    it('图书馆、驱魔法阵和驱魔失败都按真实投骰与伤害结算', () => {
        let core = createFirstScenarioHauntCore();
        const hauntActionRandom = createBetrayalScriptedRandom(
            1, 1, 1, 1, // 图书馆失败
            1, 1, 1, 1, // 驱魔法阵失败
            1, 1, 1, 1, 1, 1, // 驱魔失败
        );

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.knowledgeOfJackPlayerIds).toEqual([]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
        const sanityBeforeStudy = core.currentExplorer.traits.sanity;
        const knowledgeBeforeStudy = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(core.currentExplorer.traits.sanity + core.currentExplorer.traits.knowledge).toBe(
            sanityBeforeStudy + knowledgeBeforeStudy - 2,
        );

        core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = 'upper-north';
        const teammateBefore = core.otherExplorers.find((explorer) => explorer.playerId === '1');
        const actorBefore = { ...core.currentExplorer.traits };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}, 100, hauntActionRandom);
        const teammateAfter = core.otherExplorers.find((explorer) => explorer.playerId === '1');

        expect(core.phase).toBe('haunt');
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBeLessThan(
            actorBefore.might + actorBefore.speed,
        );
        expect((teammateAfter?.traits.might ?? 0) + (teammateAfter?.traits.speed ?? 0)).toBeLessThan(
            (teammateBefore?.traits.might ?? 0) + (teammateBefore?.traits.speed ?? 0),
        );
    });

    it('最后一张恶兆会自动触发 haunt', () => {
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

    it('翻开未知房间时会把新房间门位旋转到当前开放门位，不再靠黄色连接补丁伪造门', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });

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

        const moveAfterDiscovery = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'frontier-upper-north-west' }),
        );
        expect(moveAfterDiscovery.valid).toBe(false);
        if (!moveAfterDiscovery.valid) {
            expect(moveAfterDiscovery.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.turnEndedByDiscovery).toBe(false);
    });

    it('Stalk the Prey 只能在未攻击且本回合未用过时发动一次，并且不消耗普通移动', () => {
        let core = createFirstScenarioHauntCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.roomId).toBe('basement-east');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-west' });
        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(4);
        expect(core.usedCardIdsThisTurn).toContain('stalk-the-prey');

        const secondStalkValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'entrance-hall' }),
        );
        expect(secondStalkValidation.valid).toBe(false);

        let afterAttackCore = createFirstScenarioHauntCore();
        afterAttackCore.currentPlayer = '2';
        const traitor = afterAttackCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const hero = afterAttackCore.currentExplorer;
        afterAttackCore.currentExplorer = { ...traitor, roomId: 'hallway' };
        afterAttackCore.otherExplorers = [
            { ...hero, roomId: 'hallway' },
            ...afterAttackCore.otherExplorers.filter((explorer) => explorer.playerId !== '2'),
        ];
        afterAttackCore.activeRoomId = 'hallway';
        afterAttackCore.currentExplorerTraits = { ...afterAttackCore.currentExplorer.traits };
        afterAttackCore.currentExplorerInventory = [...afterAttackCore.currentExplorer.inventory];
        afterAttackCore = applyBetrayalCommand(
            afterAttackCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const afterAttackValidation = BetrayalDomain.validate(
            { core: afterAttackCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'entrance-hall' }),
        );
        expect(afterAttackValidation.valid).toBe(false);
    });

    it('叛徒死亡后轮到其回合时，应改为操控杰克之灵按相邻房间移动', () => {
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

        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.currentPlayer).toBe('1');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);

        const moveTargets = ['hallway', 'basement-landing', 'basement-east'].map((roomId) => (
            BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId }),
            ).valid
        ));
        expect(moveTargets).toEqual([true, true, false]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });

        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-landing');
    });

    it('英雄攻击叛徒时应按对攻差值造成 physical damage，平手无伤害，Knowledge of Jack 只在此时加成', () => {
        let tieCore = createFirstScenarioHauntCore();
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        const traitorBeforeTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const heroBeforeTie = { ...tieCore.currentExplorer.traits };
        tieCore = applyBetrayalCommand(
            tieCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfterTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(tieCore.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(tieCore.currentExplorer.traits).toEqual(heroBeforeTie);
        expect(traitorAfterTie.traits).toEqual(traitorBeforeTie.traits);

        let bonusCore = createFirstScenarioHauntCore();
        bonusCore.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        bonusCore = applyBetrayalCommand(
            bonusCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(bonusCore.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(bonusCore.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
    });

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
        const hero = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        const updatedHero = core.currentExplorer.playerId === '0'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(updatedHero.traits.might + updatedHero.traits.speed).toBeLessThan(hero.traits.might + hero.traits.speed);
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
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.END_TURN, '1', {});
        const noBonusHeroBefore = withoutBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        const noBonusHeroAfter = withoutBonus.currentExplorer.playerId === '0'
            ? withoutBonus.currentExplorer
            : withoutBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;

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
        withBonus.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.END_TURN, '1', {});
        const bonusHeroBefore = withBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        const bonusHeroAfter = withBonus.currentExplorer.playerId === '0'
            ? withBonus.currentExplorer
            : withBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        const noBonusLoss = (noBonusHeroBefore.traits.might + noBonusHeroBefore.traits.speed)
            - (noBonusHeroAfter.traits.might + noBonusHeroAfter.traits.speed);
        const bonusLoss = (bonusHeroBefore.traits.might + bonusHeroBefore.traits.speed)
            - (bonusHeroAfter.traits.might + bonusHeroAfter.traits.speed);

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
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-east' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');

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
    });

    it('同房间尸体上的 Item/Omen 应可每回合搜刮 1 件，且同一尸体同回合不能连续搜刮', () => {
        let core = createCorpseLootReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0' });

        const lootedByTeammate = core.currentExplorer.playerId === '1'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        const corpseAfterLoot = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        expect(lootedByTeammate.inventory.length).toBeGreaterThan(1);
        expect(corpseAfterLoot.inventory).toHaveLength(1);
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('0');

        const secondLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0' }),
        );
        expect(secondLootValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('1');

        const nextTurnLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0' }),
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
});
