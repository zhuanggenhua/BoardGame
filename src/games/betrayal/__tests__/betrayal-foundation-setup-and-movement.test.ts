import { describe, expect, it } from 'vitest';
import { resolveMoveTargetRooms } from '../movementReadModel';
import {
    resolveBetrayalRoomDrawResolution,
    resolveExplorableRoomSlots,
    resolveRoomPlacementPreview,
    resolveRoomTileAdjustmentOptions,
} from '../roomDiscoveryModel';
import {
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioReadyToStudyExorcismCore,
    createStartedFirstScenarioCore,
    setScenarioTestTurnMovement,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    EXPLORER_CATALOG,
    isBetrayalRoomInLineOfSight,
    resolveBetrayalLineOfSightRoomIds,
    resolveBetrayalTileStackSearchPreview,
    applyBetrayalTileStackSearch,
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_SCENARIO_CARD_IDS,
    BETRAYAL_SCENARIO_CONFIGS,
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
    resolvePossessionAtlasVisual,
    BETRAYAL_ROOM_TILE_VISUALS,
    findTestExplorer,
    startFirstScenarioFromCharacterSelect,
    setTestExplorerInventory,
    setTestRoomDiscoveryDeck,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    acknowledgeAnyPendingCardResolutions,
    createOpenFrontierHauntTestCore,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';
import { BETRAYAL_INITIAL_DECK_COUNTS } from '../deckModel';
import {
    resolveBetrayalHauntRisk,
    resolveBetrayalOmenCount,
} from '../hauntProgress';

describe('Betrayal first scenario runtime - foundation, setup, movement, and discovery', () => {
it('基础版探索者 catalog 覆盖 12 名角色、正式起始值、卡面属性轨和无特殊能力', () => {
        const expectedTraitsByExplorerId = {
            'isa-valencia': { might: 3, speed: 5, knowledge: 4, sanity: 4 },
            'anita-hernandez': { might: 4, speed: 4, knowledge: 5, sanity: 3 },
            'father-warren-leung': { might: 3, speed: 4, knowledge: 4, sanity: 5 },
            'dan-nguyen-md': { might: 4, speed: 3, knowledge: 5, sanity: 4 },
            'michelle-monroe': { might: 5, speed: 4, knowledge: 4, sanity: 3 },
            'beat-box-bowen': { might: 5, speed: 3, knowledge: 4, sanity: 4 },
            'josef-hooper': { might: 5, speed: 4, knowledge: 3, sanity: 4 },
            'oliver-swift': { might: 4, speed: 5, knowledge: 4, sanity: 3 },
            'stephanie-richter': { might: 4, speed: 3, knowledge: 4, sanity: 5 },
            'persephone-puleri': { might: 4, speed: 4, knowledge: 3, sanity: 5 },
            'sammy-angler': { might: 4, speed: 5, knowledge: 3, sanity: 4 },
            'jaden-jones': { might: 3, speed: 4, knowledge: 5, sanity: 4 },
        } as const;
        const catalogByExplorerId = new Map(EXPLORER_CATALOG.map((explorer) => [explorer.explorerId, explorer]));

        expect(EXPLORER_CATALOG.map((explorer) => explorer.explorerId)).toEqual(Object.keys(expectedTraitsByExplorerId));
        expect(catalogByExplorerId.has('rebecca-allen')).toBe(false);
        expect(catalogByExplorerId.has('darryl-highla')).toBe(false);
        expect(catalogByExplorerId.has('lia-valencia')).toBe(false);
        expect(catalogByExplorerId.has('sam-yin')).toBe(false);

        for (const [explorerId, expectedTraits] of Object.entries(expectedTraitsByExplorerId)) {
            const explorer = catalogByExplorerId.get(explorerId);
            expect(explorer).toBeDefined();
            expect(explorer!.traits).toEqual(expectedTraits);
            expect(explorer!.abilityName).toBe('无特殊能力');
            expect(explorer!.abilityText).toContain('基础版角色背景不改变规则');
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as const) {
                const track = explorer!.traitTracks[trait];
                expect(track.values.length).toBeGreaterThanOrEqual(7);
                expect(track.values[track.startPosition]).toBe(expectedTraits[trait]);
            }
        }

        for (const explorerId of Object.keys(expectedTraitsByExplorerId)) {
            expect(catalogByExplorerId.get(explorerId)!.tokenAsset).toBe(`betrayal/tokens/explorers/${explorerId}`);
        }
        expect(catalogByExplorerId.get('josef-hooper')!.traitTracks.might.values.slice(2, 4)).toEqual([5, 5]);
    });

it('设置阶段必须从七张剧本卡候选中提议并确认，默认首剧本是木乃伊横行', () => {
        let core = BetrayalDomain.setup(['0', '1', '2'], BETRAYAL_FIXED_RANDOM);
        expect(core.scenarioCandidateIds).toEqual([...BETRAYAL_SCENARIO_CARD_IDS]);
        expect(core.scenarioCandidateIds).toHaveLength(7);
        expect(core.scenarioCandidateIds).toContain('upon-reflection');
        expect(core.proposedScenarioCardId).toBe(DEFAULT_BETRAYAL_SCENARIO_CARD_ID);
        expect(DEFAULT_BETRAYAL_SCENARIO_CARD_ID).toBe('mummy-rampage');
        expect(core.scenarioCardConfirmations).toEqual({});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '1', { explorerId: 'anita-hernandez' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '1', {});

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '每位玩家都需要先选择探索者。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '2', { explorerId: 'father-warren-leung' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '2', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD, '0', {
            candidateId: 'friends-forever',
        });
        expect(core.proposedScenarioCardId).toBe('friends-forever');
        expect(core.scenarioCardConfirmations).toEqual({});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        expect(core.scenarioCardConfirmations).toEqual({ '0': 'friends-forever' });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '1', {});
        expect(core.scenarioCardConfirmations).toEqual({
            '0': 'friends-forever',
            '1': 'friends-forever',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '2', {});
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '这个剧本现在不能开始。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD, '0', {
            candidateId: 'blood-from-a-stone',
        });
        expect(core.proposedScenarioCardId).toBe('blood-from-a-stone');
        expect(core.scenarioCardConfirmations).toEqual({});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '2', {});
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD, '0', {
            candidateId: DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
        });
        expect(core.scenarioCardConfirmations).toEqual({});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '1', {});
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.START_SCENARIO, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前剧本卡。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '2', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', {});

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioId).toBe('first-scenario');
    });

it('正常开局不预发物品或预兆，第一次预兆作祟检定只按新抽预兆计数', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        const explorers = [core.currentExplorer, ...core.otherExplorers];

        expect(explorers.every((explorer) => explorer.inventory.length === 0)).toBe(true);
        expect(resolveBetrayalOmenCount(core)).toBe(0);
        expect(resolveBetrayalHauntRisk(core, { additionalOmenCount: 1 })).toMatchObject({
            omenCount: 0,
            requestedRollOmenCount: 1,
            nextRollDiceCount: 1,
            threshold: 5,
            hauntStarted: false,
        });
    });

it('正式开始剧本后只从共享开局和所选角色配置装配探索者', () => {
        let core = BetrayalDomain.setup(['0', '1', '2'], BETRAYAL_FIXED_RANDOM);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'oliver-swift' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '1', { explorerId: 'father-warren-leung' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '2', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '2', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD, '2', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', {});

        const explorers = [core.currentExplorer, ...core.otherExplorers];
        expect(core.phase).toBe('preHaunt');
        expect(core.currentExplorer.explorerId).toBe('oliver-swift');
        expect(findTestExplorer(core, '1').explorerId).toBe('father-warren-leung');
        expect(findTestExplorer(core, '2').explorerId).toBe('jaden-jones');
        expect(explorers.map((explorer) => explorer.roomId)).toEqual(['entrance-hall', 'entrance-hall', 'entrance-hall']);
        expect(explorers.map((explorer) => explorer.inventory)).toEqual([[], [], []]);
        expect(core.turnStartInventoryCardIds).toEqual([]);
        expect(core.deckCounts).toMatchObject(BETRAYAL_INITIAL_DECK_COUNTS);
        expect(resolveBetrayalOmenCount(core)).toBe(0);
    });

it('回合开始按速度锁定移动力，回合中速度变化不刷新本回合移动力', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 2);
        setTestTraitTrack(core, '1', 'speed', [1, 2, 3, 4, 5], 4);
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        setScenarioTestTurnMovement(core, core.currentExplorer.traits.speed);

        expect(core.turnStartSpeed).toBe(3);
        expect(core.movesRemaining).toBe(3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' });

        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnStartSpeed).toBe(3);
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.turnStartSpeed).toBe(5);
        expect(core.movesRemaining).toBe(5);
    });

it('普通移动只允许门位直连，几何相邻但无连接门位不能移动', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('grand-staircase');

        core.rooms = core.rooms.map((room) => {
            if (room.id === 'hallway') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'grand-staircase'),
                };
            }
            if (room.id === 'grand-staircase') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'hallway'),
                };
            }
            return room;
        });

        expect(resolveMoveTargetRooms(core).map((room) => room.id)).not.toContain('grand-staircase');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' }),
        )).toMatchObject({
            valid: false,
            error: '目标房间不可移动。',
        });
    });

it('基础视线只覆盖同楼层同一直线的连续已发现房间', () => {
        const core = createStartedFirstScenarioCore();

        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'hallway')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'entrance-hall')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'entrance-hall', 'grand-staircase')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'upper-landing')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'basement-landing')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'upper-landing', 'upper-west')).toBe(true);
        expect(isBetrayalRoomInLineOfSight(core, 'entrance-hall', 'ground-east')).toBe(false);

        const visibleFromStaircase = resolveBetrayalLineOfSightRoomIds(core, 'grand-staircase');
        expect(visibleFromStaircase).toEqual(expect.arrayContaining([
            'grand-staircase',
            'hallway',
            'entrance-hall',
        ]));
        expect(visibleFromStaircase).not.toContain('upper-landing');
        expect(visibleFromStaircase).not.toContain('basement-landing');

        const interruptedLineCore: BetrayalCore = {
            ...core,
            rooms: core.rooms.map((room) => (
                room.id === 'hallway'
                    ? { ...room, state: 'unexplored' as const }
                    : room
            )),
        };
        expect(isBetrayalRoomInLineOfSight(interruptedLineCore, 'grand-staircase', 'entrance-hall')).toBe(false);
        expect(resolveBetrayalLineOfSightRoomIds(interruptedLineCore, 'grand-staircase')).not.toContain('entrance-hall');
    });

it('属性提升移动属性轨夹子，重复数值位置提升但当前值不一定变化', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'speed', [1, 3, 3, 4, 5], 1);
        const speedBefore = core.currentExplorer.traits.speed;
        const positionBefore = core.currentExplorer.traitTracks.speed.position;
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '测试速度奖励',
            text: '获得 1 点速度。',
            effect: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
        }];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.currentExplorer.traitTracks.speed.position).toBe(positionBefore + 1);
        expect(core.currentExplorer.traits.speed).toBe(speedBefore);
    });

it('伤害按属性轨步数扣减，重复数值时扣一步但当前值可能不变', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'might', [1, 3, 3, 4, 5], 2);
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        const mightBefore = core.currentExplorer.traits.might;
        const positionBefore = core.currentExplorer.traitTracks.might.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            playerId: '0',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['might'] });

        const damagedExplorer = findTestExplorer(core, '0');
        expect(damagedExplorer.traitTracks.might.position).toBe(positionBefore - 1);
        expect(damagedExplorer.traits.might).toBe(mightBefore);
    });

it('治疗只把低于绿色起点的属性拉回起点，不会降低已高于起点的属性', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            ],
        };
        setTestTraitTrack(core, '0', 'might', [1, 3, 3, 4, 5, 5], 5);
        setTestTraitTrack(core, '0', 'speed', [1, 3, 3, 4, 5], 1);
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-water'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' });

        expect(core.currentExplorer.traitTracks.might.position).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(5);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
    });

it('作祟前伤害停在临界不死亡，作祟后伤害可推到骷髅并死亡', () => {
        let preHauntCore = createStartedFirstScenarioCore();
        setTestTraitTrack(preHauntCore, '0', 'might', [1, 2, 3, 4], 1);
        preHauntCore.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];

        preHauntCore = applyBetrayalCommand(preHauntCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        preHauntCore = applyBetrayalCommand(preHauntCore, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        preHauntCore = acknowledgeAnyPendingCardResolutions(preHauntCore);
        preHauntCore = applyBetrayalCommand(preHauntCore, BETRAYAL_COMMANDS.END_TURN, '0', {});
        preHauntCore = applyBetrayalCommand(
            preHauntCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: ['might'] },
        );

        const preHauntExplorer = findTestExplorer(preHauntCore, '0');
        expect(preHauntExplorer.traitTracks.might.position).toBe(0);
        expect(preHauntCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');

        let hauntCore = createFirstScenarioReadyToStudyExorcismCore();
        setTestTraitTrack(hauntCore, '0', 'knowledge', [1, 2, 3, 4], 0);
        setTestTraitTrack(hauntCore, '0', 'sanity', [1, 2, 3, 4], 0);

        hauntCore = applyBetrayalCommand(
            hauntCore,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(0, 0, 0, 0),
        );

        const deadExplorer = findTestExplorer(hauntCore, '0');
        expect(deadExplorer.traitTracks.knowledge.position).toBe(-1);
        expect(hauntCore.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
    });

it('正式局内探索会消费 setup 生成的当前局发现池顺序，而不是固定索引序列', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = startFirstScenarioFromCharacterSelect(core);

        expect(core.drawOrder).toEqual(['omen', 'item', 'event']);
        const expectedFirstUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[0]!;
        const expectedPlacedUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[1]!;
        expect(core.roomDiscoveryOrderByFloor.upper[0]?.name).toBe(expectedFirstUpperRoom.name);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        expect(expectedFirstUpperRoom.name).toBe('神秘电梯');
        expect(expectedFirstUpperRoom.discoverySymbol).toBe('none');
        expect(core.latestDiscovery?.kind).toBe(expectedPlacedUpperRoom.discoverySymbol);
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe(expectedPlacedUpperRoom.name);
        expect(core.latestRoomDrawResolution?.selectedRoom?.name).toBe(expectedPlacedUpperRoom.name);
        expect(core.latestRoomDrawResolution?.buriedRoomTiles).toEqual(expect.arrayContaining([
            expect.objectContaining({
                floor: 'upper',
                name: expectedFirstUpperRoom.name,
                reason: 'sealedRegion',
            }),
        ]));
        expect(core.pendingCardResolutionQueue).toEqual([]);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: true,
        });
    });

it('正式发现池只使用已确认正面素材和可渲染房间图集，不再回落到最小代表池', () => {
        const itemIds = BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => card.id);
        const omenIds = BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => card.id);
        const roomVisualIds = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor)
            .flat()
            .map((room) => room.visualId);

        const allDiscoveryRooms = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).flat();

        expect(itemIds).toHaveLength(22);
        expect(itemIds).toContain('strange-amulet');
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
        expect(allDiscoveryRooms).toHaveLength(42);
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

it('搜索特定房间板块会移除目标并重洗剩余房间堆', () => {
        const core = createStartedFirstScenarioCore();
        const targetEntry = core.roomDiscoveryDeck.find((entry) => entry.room.visualId === 'library')!;
        const remainingVisualIds = core.roomDiscoveryDeck
            .filter((entry) => entry.room.visualId !== targetEntry.room.visualId)
            .map((entry) => entry.room.visualId)
            .reverse();

        const result = applyBetrayalTileStackSearch(core, {
            roomName: targetEntry.room.name,
            visualId: targetEntry.room.visualId,
            floor: targetEntry.floor,
        }, {
            random: () => 0.42,
            d: (max) => Math.max(1, Math.min(max, 1)),
            range: (min) => min,
            shuffle: (array) => [...array].reverse(),
        });

        expect(result.result).toMatchObject({
            foundRoom: {
                floor: targetEntry.floor,
                name: targetEntry.room.name,
                visualId: targetEntry.room.visualId,
            },
            searchedCount: core.roomDiscoveryDeck.length,
            remainingCount: core.roomDiscoveryDeck.length - 1,
            reshuffled: true,
        });
        expect(result.core.roomDiscoveryDeck.map((entry) => entry.room.visualId)).toEqual(remainingVisualIds);
        expect(result.core.roomDiscoveryDeck.some((entry) => entry.room.visualId === targetEntry.room.visualId)).toBe(false);
        expect(result.core.roomDiscoveryOrderByFloor.ground.map((room) => room.visualId)).toEqual(
            result.core.roomDiscoveryDeck
                .filter((entry) => entry.floor === 'ground')
                .map((entry) => entry.room.visualId),
        );
    });

it('房间堆搜索预览会标出命中候选和重洗后果', () => {
        const core = createStartedFirstScenarioCore();
        const targetEntry = core.roomDiscoveryDeck.find((entry) => entry.room.visualId === 'library')!;

        const preview = resolveBetrayalTileStackSearchPreview(core, {
            roomName: targetEntry.room.name,
            visualId: targetEntry.room.visualId,
            floor: targetEntry.floor,
        });

        expect(preview).toMatchObject({
            requestedRoomName: targetEntry.room.name,
            requestedVisualId: targetEntry.room.visualId,
            requestedFloor: targetEntry.floor,
            searchedCount: core.roomDiscoveryDeck.length,
            firstCandidate: {
                floor: targetEntry.floor,
                name: targetEntry.room.name,
                visualId: targetEntry.room.visualId,
            },
            discoveredRooms: [],
            targetAlreadyInHouse: false,
            canSearch: true,
            willRemoveFirstCandidate: true,
            willReshuffleAfterSearch: true,
            remainingCountAfterSearch: core.roomDiscoveryDeck.length - 1,
            reason: null,
        });
        expect(preview.candidateRooms).toEqual([{
            floor: targetEntry.floor,
            name: targetEntry.room.name,
            visualId: targetEntry.room.visualId,
        }]);
        expect(preview.ruleNotes).toEqual(expect.arrayContaining([
            '若从房间堆命中特定板块，应移除该板块并重洗剩余房间堆。',
            '当前读模型只表达搜索候选与重洗后果，不等于玩家可见搜索面板或逐作祟 setup 放置流程完成。',
        ]));
    });

it('房间堆搜索预览会在目标已在屋内时阻止重复搜索', () => {
        const core = createStartedFirstScenarioCore();

        const preview = resolveBetrayalTileStackSearchPreview(core, {
            roomName: '门厅',
            visualId: 'startHallway',
            floor: 'ground',
        });

        expect(preview).toMatchObject({
            requestedRoomName: '门厅',
            requestedVisualId: 'startHallway',
            requestedFloor: 'ground',
            candidateRooms: [],
            firstCandidate: null,
            discoveredRooms: [{
                roomId: 'hallway',
                floor: 'ground',
                name: '门厅',
                visualId: 'startHallway',
            }],
            targetAlreadyInHouse: true,
            canSearch: false,
            willRemoveFirstCandidate: false,
            willReshuffleAfterSearch: false,
            remainingCountAfterSearch: core.roomDiscoveryDeck.length,
            reason: '目标房间已经在屋内，不需要搜索房间堆。',
        });
    });

it('搜索不存在的房间板块不会重洗或移除房间堆', () => {
        const core = createStartedFirstScenarioCore();
        const visualIdsBeforeSearch = core.roomDiscoveryDeck.map((entry) => entry.room.visualId);

        const result = applyBetrayalTileStackSearch(core, { roomName: '不存在的房间' }, {
            random: () => 0.42,
            d: (max) => Math.max(1, Math.min(max, 1)),
            range: (min) => min,
            shuffle: (array) => [...array].reverse(),
        });

        expect(result.result).toMatchObject({
            requestedRoomName: '不存在的房间',
            foundRoom: null,
            searchedCount: core.roomDiscoveryDeck.length,
            remainingCount: core.roomDiscoveryDeck.length,
            reshuffled: false,
        });
        expect(result.core.roomDiscoveryDeck.map((entry) => entry.room.visualId)).toEqual(visualIdsBeforeSearch);
    });

it('区域房间池耗尽时探索会被拒绝，且不消耗移动或结束回合', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core.roomDiscoveryOrderByFloor.ground = [];
        core.movesRemaining = 2;
        core.turnEndedByDiscovery = false;

        expect(resolveRoomPlacementPreview(core, { roomId: 'ground-north' })).toBeNull();

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' }),
        );

        expect(validation).toMatchObject({
            valid: false,
            error: '当前区域没有可发现房间。',
        });
        expect(core.movesRemaining).toBe(2);
        expect(core.turnEndedByDiscovery).toBe(false);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.state).toBe('unexplored');
    });

it('探索新房间会使用玩家选择的合法朝向', () => {
        let core = createStartedFirstScenarioCore();
        const baseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'conservatory')!;
        const rotatingRoom = {
            ...baseRoom,
            name: '测试可旋转房',
            hint: '测试用：同一入口存在多个合法朝向',
            tags: ['测试'],
            discoverySymbol: 'none' as const,
            doorways: ['south' as const, 'east' as const],
        };
        core.roomDiscoveryDeck = [
            { floor: 'ground', room: rotatingRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [rotatingRoom],
            upper: [],
            basement: [],
        };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview).not.toBeNull();
        const chosenOrientation = preview!.orientationOptions.find(
            (option) => option.orientationTurns !== preview!.defaultOrientationTurns,
        );
        expect(chosenOrientation).toBeDefined();

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '0',
                { roomId: 'ground-north', orientationTurns: chosenOrientation!.orientationTurns },
            ),
        );
        expect(validation).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {
            roomId: 'ground-north',
            orientationTurns: chosenOrientation!.orientationTurns,
        });

        const placedRoom = core.rooms.find((room) => room.id === 'ground-north');
        expect(placedRoom?.name).toBe('测试可旋转房');
        expect(placedRoom?.orientationTurns).toBe(chosenOrientation!.orientationTurns);
        expect(placedRoom?.doorways.map((doorway) => doorway.edge).sort()).toEqual(
            chosenOrientation!.doorways.map((doorway) => doorway.edge).sort(),
        );
        expect(core.latestDiscovery?.kind).toBe('none');
    });

it('区域不匹配的房间会先掩埋到底部，并继续翻找当前区域房间', () => {
        let core = createStartedFirstScenarioCore();
        const upperRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'tower')!;
        const basementRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'larder')!;
        const groundRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!;
        core.roomDiscoveryDeck = [
            { floor: 'upper', room: upperRoom },
            { floor: 'basement', room: basementRoom },
            { floor: 'ground', room: groundRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [groundRoom],
            upper: [upperRoom],
            basement: [basementRoom],
        };
        core.drawOrder = ['item'];
        core.movesRemaining = 2;
        core.turnEndedByDiscovery = false;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        const drawResolution = resolveBetrayalRoomDrawResolution(core, 'ground');
        expect(drawResolution).toMatchObject({
            requestedFloor: 'ground',
            selectedRoom: { name: '火炉房', visualId: 'furnaceRoom' },
            exhausted: false,
            usedUnifiedDeck: true,
        });
        expect(drawResolution.buriedRoomTiles.map((room) => `${room.floor}:${room.name}:${room.reason}`)).toEqual([
            'upper:塔楼:areaMismatch',
            'basement:储物间:areaMismatch',
        ]);
        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview?.room.name).toBe('火炉房');
        expect(preview?.buriedRoomNames).toEqual(['塔楼', '储物间']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');
        expect(core.latestRoomDrawResolution?.buriedRoomTiles.map((room) => room.name)).toEqual(['塔楼', '储物间']);
        expect(core.buriedRoomTiles.map((room) => `${room.floor}:${room.name}`)).toEqual([
            'upper:塔楼',
            'basement:储物间',
        ]);
        expect(core.roomDiscoveryDeck.map((entry) => `${entry.floor}:${entry.room.name}`)).toEqual([
            'upper:塔楼',
            'basement:储物间',
        ]);
        expect(core.roomDiscoveryOrderByFloor.ground).toEqual([]);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('探索抽牌读取房间符号，图书馆按预兆而不是运行时抽牌顺序抽牌', () => {
        let core = createStartedFirstScenarioCore();
        const library = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'library')!;
        const testOmen = { id: 'omen-book', name: '书本', kind: 'omen' as const };
        const testEvent = {
            name: '不应抽到的测试事件',
            text: '如果抽到这张牌，说明探索仍在读运行时抽牌顺序。',
            effect: { mode: 'none' as const, recommendedAction: 'endTurn' as const },
        };
        setTestRoomDiscoveryDeck(core, [{ floor: 'upper', room: library }]);
        core.drawOrder = ['event'];
        core.eventOrder = [testEvent];
        core.deckCounts.event = core.eventOrder.length;
        core.possessionOrderByKind.omen = [testOmen];
        core.deckCounts.omen = core.possessionOrderByKind.omen.length;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });

        const preview = resolveRoomPlacementPreview(core, { roomId: 'upper-north' });
        expect(preview?.room.name).toBe('图书馆');
        expect(preview?.deckKind).toBe('omen');

        setTestExplorerInventory(core, '0', [{ id: 'idol', name: '雕像', kind: 'omen' }]);
        const idolValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useIdol: true }),
        );
        expect(idolValidation.valid).toBe(false);
        if (!idolValidation.valid) {
            expect(idolValidation.error).toContain('雕像只能在发现事件符号板块时使用');
        }

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'upper-north' },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.rooms.find((room) => room.id === 'upper-north')?.discoveryReward).toBe('omen');
        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.latestDiscovery?.title).toBe('书本');
        expect(core.eventOrder[0]?.name).toBe('不应抽到的测试事件');
    });

it('器械库无发现符号，只按房间文字抽到武器且不额外抽物品牌', () => {
        let core = createStartedFirstScenarioCore();
        const armory = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!;
        setTestRoomDiscoveryDeck(core, [{ floor: 'ground', room: armory }]);
        core.drawOrder = ['item'];
        core.possessionOrderByKind.item = [
            { id: 'camera', name: '魔法相机', kind: 'item' },
            { id: 'gun', name: '枪', kind: 'item' },
            { id: 'medical-kit', name: '急救包', kind: 'item' },
        ];
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        core.currentExplorer.inventory = [];
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.discoveryReward).toBeNull();
        expect(core.latestDiscovery?.kind).toBe('none');
        expect(core.latestDiscovery?.title).toBe('器械库');
        expect(core.latestDiscovery?.detail).toContain('器械库获得枪');
        expect(core.latestDiscovery?.detail).toContain('展示后埋葬魔法相机');
        expect(core.latestDiscovery?.detail).toContain('没有事件、物品或预兆发现牌');
        expect(core.currentExplorer.inventory.map((card) => card.name)).toEqual(['枪']);
        expect(core.currentExplorer.inventory.map((card) => card.name)).not.toContain('急救包');
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
    });

it('叛徒忽略事件符号读取房间符号，不受运行时抽牌顺序影响', () => {
        let core = createOpenFrontierHauntTestCore('2');
        const kitchen = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'kitchen')!;
        const eventCard = {
            name: '叛徒不应结算事件',
            text: '如果结算这张牌，说明没有跳过事件符号。',
            effect: { mode: 'trait' as const, trait: 'might' as const, amount: -1, recommendedAction: 'endTurn' as const },
        };
        const targetRoomId = resolveExplorableRoomSlots(core).find((room) => room.floor === 'ground')?.id;
        expect(targetRoomId).toBeTruthy();
        setTestRoomDiscoveryDeck(core, [{ floor: 'ground', room: kitchen }]);
        core.drawOrder = ['item'];
        core.eventOrder = [eventCard];
        core.deckCounts.event = core.eventOrder.length;
        const mightBefore = core.currentExplorer.traits.might;

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '2',
                { roomId: targetRoomId!, ignoreEventSymbolWithTraitorPower: true },
            ),
        );
        expect(validation.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '2',
            { roomId: targetRoomId!, ignoreEventSymbolWithTraitorPower: true },
        );

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('跳过事件');
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.activityLog[0]?.text).toContain('叛徒跳过了事件');
    });

it('会封死同区域可探索走廊的房间会被掩埋并继续重抽', () => {
        let core = createStartedFirstScenarioCore();
        const sealedBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!;
        const openBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!;
        const sealedRoom = {
            ...sealedBaseRoom,
            name: '测试死路房',
            hint: '测试用：只有入口走廊，会封死当前区域',
            tags: ['测试'],
            doorways: ['south' as const],
        };
        const openRoom = {
            ...openBaseRoom,
            name: '测试开放房',
            hint: '测试用：连接入口后仍保留一个开放走廊',
            tags: ['测试'],
            doorways: ['south' as const, 'east' as const],
        };
        core.roomDiscoveryDeck = [
            { floor: 'ground', room: sealedRoom },
            { floor: 'ground', room: openRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [sealedRoom, openRoom],
            upper: [],
            basement: [],
        };
        core.drawOrder = ['item'];
        core.turnEndedByDiscovery = false;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core.movesRemaining = 2;
        core.rooms = core.rooms
            .filter((room) => room.id !== 'ground-south' && room.id !== 'ground-east')
            .map((room) => {
                if (room.id === 'hallway') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-south'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-south'),
                    };
                }
                if (room.id === 'entrance-hall') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-east'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-east'),
                    };
                }
                return room;
            });

        expect(resolveExplorableRoomSlots(core).map((room) => room.id)).toEqual(['ground-north']);

        const drawResolution = resolveBetrayalRoomDrawResolution(core, 'ground', { roomId: 'ground-north' });
        expect(drawResolution).toMatchObject({
            requestedFloor: 'ground',
            selectedRoom: { name: '测试开放房', visualId: 'furnaceRoom' },
            exhausted: false,
            usedUnifiedDeck: true,
        });
        expect(drawResolution.buriedRoomTiles.map((room) => `${room.name}:${room.reason}`)).toEqual([
            '测试死路房:sealedRegion',
        ]);

        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview?.room.name).toBe('测试开放房');
        expect(preview?.buriedRoomNames).toEqual(['测试死路房']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('测试开放房');
        expect(core.latestRoomDrawResolution?.buriedRoomTiles.map((room) => `${room.name}:${room.reason}`)).toEqual([
            '测试死路房:sealedRegion',
        ]);
        expect(core.buriedRoomTiles.map((room) => `${room.name}:${room.reason}`)).toEqual([
            '测试死路房:sealedRegion',
        ]);
        expect(core.roomDiscoveryDeck.map((entry) => `${entry.floor}:${entry.room.name}`)).toEqual([
            'ground:测试死路房',
        ]);
        expect(resolveExplorableRoomSlots(core).some((room) => room.floor === 'ground')).toBe(true);
    });

it('最后一张同区域房间会封死区域时要求先调整已有板块', () => {
        let core = createStartedFirstScenarioCore();
        const sealedBaseRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'vault')!;
        const sealedRoom = {
            ...sealedBaseRoom,
            name: '测试最后死路房',
            hint: '测试用：最后一张同区域房间仍会封死当前区域',
            tags: ['测试'],
            doorways: ['south' as const],
        };
        core.roomDiscoveryDeck = [
            { floor: 'ground', room: sealedRoom },
        ];
        core.roomDiscoveryOrderByFloor = {
            ground: [sealedRoom],
            upper: [],
            basement: [],
        };
        core.drawOrder = ['item'];
        core.movesRemaining = 2;
        core.turnEndedByDiscovery = false;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core.rooms = core.rooms
            .filter((room) => room.id !== 'ground-south' && room.id !== 'ground-east')
            .map((room) => {
                if (room.id === 'hallway') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-south'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-south'),
                    };
                }
                if (room.id === 'entrance-hall') {
                    return {
                        ...room,
                        connectedRoomIds: room.connectedRoomIds.filter((roomId) => roomId !== 'ground-east'),
                        doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'ground-east'),
                    };
                }
                return room;
            });

        expect(resolveExplorableRoomSlots(core).map((room) => room.id)).toEqual(['ground-north']);

        const drawResolution = resolveBetrayalRoomDrawResolution(core, 'ground', { roomId: 'ground-north' });
        expect(drawResolution).toMatchObject({
            requestedFloor: 'ground',
            selectedRoom: { name: '测试最后死路房', visualId: 'vault' },
            exhausted: false,
            requiresTileAdjustment: true,
            usedUnifiedDeck: true,
        });
        expect(drawResolution.buriedRoomTiles).toEqual([]);

        const preview = resolveRoomPlacementPreview(core, { roomId: 'ground-north' });
        expect(preview?.room.name).toBe('测试最后死路房');
        expect(preview?.requiresTileAdjustment).toBe(true);
        expect(preview?.orientationOptions.length).toBeGreaterThan(0);
        expect(preview?.tileAdjustmentOptions.length).toBeGreaterThan(0);

        const movesBeforeRejectedExplore = core.movesRemaining;
        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '0',
                { roomId: 'ground-north', orientationTurns: preview?.defaultOrientationTurns },
            ),
        );

        expect(validation).toMatchObject({
            valid: false,
            error: '需要先调整该区域已有板块，保留至少一个开放走廊。',
        });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.state).toBe('unexplored');
        expect(core.movesRemaining).toBe(movesBeforeRejectedExplore);
        expect(core.turnEndedByDiscovery).toBe(false);

        const adjustmentOptions = resolveRoomTileAdjustmentOptions(core, {
            roomId: 'ground-north',
            orientationTurns: preview?.defaultOrientationTurns,
        });
        const adjustment = adjustmentOptions.find((option) => option.roomName === '入口大厅')
            ?? adjustmentOptions[0]!;
        expect(adjustment.openDoorwayCount).toBeGreaterThan(0);

        const validAdjustedExplore = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.EXPLORE_ROOM,
                '0',
                {
                    roomId: 'ground-north',
                    orientationTurns: preview?.defaultOrientationTurns,
                    roomTileAdjustment: adjustment,
                },
            ),
        );
        expect(validAdjustedExplore).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {
            roomId: 'ground-north',
            orientationTurns: preview?.defaultOrientationTurns,
            roomTileAdjustment: adjustment,
        });

        const placedRoom = core.rooms.find((room) => room.id === 'ground-north');
        const adjustedRoom = core.rooms.find((room) => room.id === adjustment.roomId);
        expect(placedRoom?.name).toBe('测试最后死路房');
        expect(adjustedRoom?.x).toBe(adjustment.x);
        expect(adjustedRoom?.y).toBe(adjustment.y);
        expect(core.rooms.some((room) => room.floor === 'ground' && room.state === 'unexplored')).toBe(true);
        expect(core.latestRoomDrawResolution?.requiresTileAdjustment).toBe(true);
        expect(core.turnEndedByDiscovery).toBe(true);
        expect(core.activityLog[0]?.text).toContain('先调整房间板块');
    });
});
