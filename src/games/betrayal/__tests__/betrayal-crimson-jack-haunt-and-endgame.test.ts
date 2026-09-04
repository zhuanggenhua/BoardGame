import { describe, expect, it } from 'vitest';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCrimsonJackHauntCore,
    createFirstScenarioHauntCore,
    createFirstScenarioReadyToExorciseCore,
    createFirstScenarioReadyToTraitorVictoryCore,
    createStartedFirstScenarioCore,
    playMummyScenarioToSurvivorVictory,
    playMummyScenarioToTraitorVictory,
    playFirstScenarioToSurvivorVictory,
    playFirstScenarioToTraitorVictory,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    setTestExplorerRoom,
    setTestExplorerTraits,
    setTestRoomDiscoveryDeck,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    traitTrackPosition,
    traitTrackPositionTotal,
    physicalTraitTotal,
    acknowledgeAnyPendingCardResolutions,
    setDiscoveredTestRoom,
    placeActiveTestExplorerInRoom,
    createOpenFrontierHauntTestCore,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveBetrayalEndgameReadModel } from '../endgameReadModel';
import { resolveBetrayalTraitorPowerStatus } from '../traitorPowerReadModel';

describe('Betrayal first scenario runtime - crimson jack haunt and endgame', () => {
it('首剧本起跑位就是真实运行时，不再保留手工结算口', () => {
        const core = createStartedFirstScenarioCore();

        expect(core.phase).toBe('preHaunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.rooms.some((room) => room.id === 'upper-west' && room.name === '图书馆')).toBe(true);
    });

it('叛徒能力可忽略火炉房这类伤害性房间效果', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'ground-north');
        setDiscoveredTestRoom(core, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        const traitorTraitsBefore = { ...findTestExplorer(core, '2').traits };

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            isTraitor: true,
            currentRoomName: '火炉房',
            currentTrigger: 'damaging-room-effect',
            canIgnoreDamagingTileEffects: true,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(findTestExplorer(core, '2').traits).toEqual(traitorTraitsBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.activityLog[0]?.text).toContain('叛徒能力忽略房间伤害');
    });

it('叛徒在倒塌房间仍会坠落，但不承受坠落伤害', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '倒塌房间',
            hint: '速度检定失败会坠落到地下室起始点。',
            tags: ['上层', '伤害'],
            discoveryReward: null,
            visualId: 'collapsedRoom',
            endTurnEffect: 'speedCheckFallToBasement',
        });
        const traitorPhysicalBefore = physicalTraitTotal(core, '2');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(findTestExplorer(core, '2').roomId).toBe('basement-landing');
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.roomEndTurn?.previousPhysicalDamage).toBe(0);
        expect(core.recentRoll?.latestLabel).toContain('坠落');
        expect(core.activityLog[0]?.text).toContain('叛徒能力忽略坠落伤害');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '2', {});

        expect(core.pendingDamageAllocation).toBeNull();
        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
    });

it('叛徒仍必须结算洗衣滑槽这类非伤害性强制房间效果', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'basement-east');
        setDiscoveredTestRoom(core, 'basement-east', {
            name: '洗衣滑槽',
            hint: '结束回合时滑落到地下室起始点。',
            tags: ['地下室', '滑槽'],
            discoveryReward: null,
            visualId: 'laundryChute',
            endTurnEffect: 'moveToBasementLanding',
        });
        const traitorPhysicalBefore = physicalTraitTotal(core, '2');

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            currentRoomName: '洗衣滑槽',
            currentTrigger: 'mandatory-room-effect',
            mustResolveMandatoryTileEffects: true,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(findTestExplorer(core, '2').roomId).toBe('basement-landing');
        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
        expect(core.activityLog[0]?.text).toContain('洗衣滑槽');
    });

it('叛徒仍必须结算神秘电梯，作祟后可继续使用既有房间效果命令', () => {
        let core = createFirstScenarioHauntCore();
        placeActiveTestExplorerInRoom(core, '2', 'upper-north');
        setDiscoveredTestRoom(core, 'upper-north', {
            name: '神秘电梯',
            hint: '投骰后移动电梯板块。',
            tags: ['电梯', '强制房间效果'],
            discoveryReward: null,
            visualId: 'mysticElevator',
            endTurnEffect: undefined,
            enterEffect: 'mysticElevator',
        });

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            currentRoomName: '神秘电梯',
            currentTrigger: 'mandatory-room-effect',
            mustResolveMandatoryTileEffects: true,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, '2', {}),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toContain('mysticElevator');
        expect(core.recentRoll?.kind).toBe('mysticElevator');
        expect(core.activityLog[0]?.text).toContain('神秘电梯');
    });

it('叛徒作祟后探索事件符号房间时可选择忽略事件，且不抽取事件牌', () => {
        let core = createOpenFrontierHauntTestCore('2');
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
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        expect(resolveBetrayalTraitorPowerStatus(core, '2')).toMatchObject({
            active: true,
            canIgnoreEventSymbols: true,
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', { roomId: targetRoomId! });

        expect(core.rooms.find((room) => room.id === targetRoomId)?.state).toBe('discovered');
        expect(core.currentExplorer.roomId).toBe(targetRoomId);
        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '事件符号',
            summary: '等待选择是否跳过事件',
        });
        expect(core.latestDiscovery?.detail).toContain('可选择跳过事件或继续抽取事件牌');
        expect(core.pendingEventChoice).toMatchObject({
            playerId: '2',
            sourceKind: 'event-symbol-skip',
            acceptLabel: '跳过事件',
            declineLabel: '抽取事件牌',
            eventSymbolSkip: { method: 'traitorPower' },
        });
        expect(core.discardCounts.event).toBe(discardCountBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(eventOrderBefore);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '2', { accept: true });

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '跳过事件',
            summary: '跳过事件',
            detail: '没有抽取或结算事件卡',
        });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.resolutionSteps ?? []).toEqual([]);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.discardCounts.event).toBe(discardCountBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(eventOrderBefore);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.recentRoll?.kind).not.toBe('hauntRoll');
        expect(core.activityLog[0]?.text).toContain('跳过了事件');

        const currentPlayerBeforeEndTurn = core.currentPlayer;
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, currentPlayerBeforeEndTurn, {}),
        )).toMatchObject({ valid: true });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, currentPlayerBeforeEndTurn, {});
        expect(core.currentPlayer).not.toBe(currentPlayerBeforeEndTurn);
        expect(core.turnEndedByDiscovery).toBe(false);
    });

it('叛徒作祟后探索事件符号房间时若不忽略事件，则正常抽取并结算事件牌', () => {
        let core = createOpenFrontierHauntTestCore('2');
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        const eventCard: BetrayalCore['eventOrder'][number] = {
            name: '阴影扑面',
            text: '阴影扑向你。失去 1 点力量。',
            effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
        };
        const nextEventCard: BetrayalCore['eventOrder'][number] = {
            name: '远处低语',
            text: '远处传来低语。没有效果。',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        };
        core.eventOrder = [eventCard, nextEventCard];
        core.deckCounts.event = core.eventOrder.length;
        const mightPositionBefore = traitTrackPosition(core, '2', 'might');
        const discardCountBefore = core.discardCounts.event;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', { roomId: targetRoomId! });

        expect(core.rooms.find((room) => room.id === targetRoomId)?.state).toBe('discovered');
        expect(core.currentExplorer.roomId).toBe(targetRoomId);
        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '事件符号',
            summary: '等待选择是否跳过事件',
        });
        expect(core.pendingEventChoice).toMatchObject({
            playerId: '2',
            sourceKind: 'event-symbol-skip',
            acceptLabel: '跳过事件',
            declineLabel: '抽取事件牌',
            eventSymbolSkip: { method: 'traitorPower' },
        });
        expect(traitTrackPosition(core, '2', 'might')).toBe(mightPositionBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(['阴影扑面', '远处低语']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '2', { accept: false });

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '阴影扑面',
            summary: '抽取事件牌',
        });
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(traitTrackPosition(core, '2', 'might')).toBe(mightPositionBefore - 1);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.discardCounts.event).toBe(discardCountBefore);
        expect(core.eventOrder.map((event) => event.name)).toEqual(['远处低语', '阴影扑面']);
        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.recentRoll?.kind).not.toBe('hauntRoll');
        expect(core.activityLog[0]?.text).toContain('选择抽取事件牌：阴影扑面');
    });

it('叛徒开局按人数获得 {1/1/2/2} 点力量和速度加成', () => {
        const cases = [
            { playerIds: ['0', '1', '2'], expectedBonus: 1 },
            { playerIds: ['0', '1', '2', '3'], expectedBonus: 1 },
            { playerIds: ['0', '1', '2', '3', '4'], expectedBonus: 2 },
            { playerIds: ['0', '1', '2', '3', '4', '5'], expectedBonus: 2 },
        ];

        for (const { playerIds, expectedBonus } of cases) {
            const hauntCore = createCrimsonJackHauntCore(playerIds);
            const traitorPlayerId = hauntCore.scenarioRuntime.traitorPlayerId!;
            const traitorAfterHaunt = hauntCore.currentExplorer.playerId === traitorPlayerId
                ? hauntCore.currentExplorer
                : hauntCore.otherExplorers.find((explorer) => explorer.playerId === traitorPlayerId)!;

            expect(traitorAfterHaunt.traitTracks.might.position).toBe(
                Math.min(traitorAfterHaunt.traitTracks.might.startPosition + expectedBonus, traitorAfterHaunt.traitTracks.might.maxPosition),
            );
            expect(traitorAfterHaunt.traitTracks.speed.position).toBe(
                Math.min(traitorAfterHaunt.traitTracks.speed.startPosition + expectedBonus, traitorAfterHaunt.traitTracks.speed.maxPosition),
            );
        }
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

it('终局读模型在作祟未完成时保持非激活，不提前展示胜利文本', () => {
        const core = createFirstScenarioHauntCore();
        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: false,
            phase: 'haunt',
            hauntId: null,
            outcome: null,
            winnerPlayerIds: [],
            ifYouWinTextId: null,
            ifYouWinTextStatus: 'inactive',
            ifYouWinTextAvailable: false,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'inactive',
            tiePolicyStatus: 'inactive',
            representativeOnly: false,
        });
    });

it('首剧本英雄终局读模型只暴露胜方和胜利文本合同 id，不冒充原文已接入', () => {
        const core = playFirstScenarioToSurvivorVictory();
        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            phase: 'endgame',
            hauntId: 'crimson-jack-returns',
            hauntTitle: 'Crimson Jack Returns',
            outcome: 'survivors',
            winningSideLabel: '英雄',
            winnerPlayerIds: ['0', '1'],
            traitorPlayerId: '2',
            ifYouWinTextId: 'crimson-jack-returns.survivors.if-you-win',
            ifYouWinTextStatus: 'representative-only',
            ifYouWinTextAvailable: false,
            needsIfYouWinTextSource: true,
            simultaneousCompletionPolicyStatus: 'missing-contract',
            tiePolicyStatus: 'missing-contract',
            representativeOnly: true,
        });
        expect(endgame.winnerNames).toHaveLength(2);
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '终局结果已记录胜方和获胜玩家。',
            '当前只证明代表作祟终局读模型，不代表 50 个作祟终局全部完成。',
        ]));
    });

it('木乃伊英雄终局读模型标记 If You Win 正文可用', () => {
        const core = playMummyScenarioToSurvivorVictory();
        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            phase: 'endgame',
            hauntId: 'mummy-rampage',
            hauntTitle: '木乃伊横行',
            outcome: 'survivors',
            winningSideLabel: '英雄',
            ifYouWinTextId: 'mummy-rampage.survivors.if-you-win',
            ifYouWinTextStatus: 'available',
            ifYouWinTextAvailable: true,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'missing-contract',
            tiePolicyStatus: 'missing-contract',
            representativeOnly: true,
        });
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '木乃伊 If You Win 胜利文本已接入。',
            '当前只证明代表作祟终局读模型，不代表 50 个作祟终局全部完成。',
        ]));
    });

it('木乃伊叛徒终局读模型同样标记 If You Win 正文可用', () => {
        const core = playMummyScenarioToTraitorVictory();
        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            phase: 'endgame',
            hauntId: 'mummy-rampage',
            hauntTitle: '木乃伊横行',
            outcome: 'traitor',
            winningSideLabel: '叛徒',
            traitorPlayerId: '2',
            ifYouWinTextId: 'mummy-rampage.traitor.if-you-win',
            ifYouWinTextStatus: 'available',
            ifYouWinTextAvailable: true,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'missing-contract',
            tiePolicyStatus: 'missing-contract',
            representativeOnly: true,
        });
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '木乃伊 If You Win 胜利文本已接入。',
        ]));
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
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(livingHeroesInRoom.map((explorer) => explorer.playerId)).toEqual(['1']);
    });

it('恶兆不会在掷骰不足 5 时提前触发 haunt', () => {
        let core = createStartedFirstScenarioCore();
        const lowHauntRoll = createBetrayalScriptedRandom(1, 1, 1, 1, 1);
        setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, lowHauntRoll);
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', {}, 100, lowHauntRoll);

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.scenarioRuntime.omensDiscovered).toBe(2);
        expect(core.latestDiscovery?.kind).toBe('omen');
    });

it('图书馆、驱魔法阵和驱魔失败都按真实投骰与伤害结算', () => {
        let core = createCrimsonJackHauntCore();
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

        setDiscoveredTestRoom(core, 'ground-north', {
            name: '厨房',
            hint: '测试用事件标记房间',
            tags: ['一层', '事件'],
            discoveryReward: 'event',
            visualId: 'kitchen',
        });
        setTestExplorerRoom(core, '0', 'ground-north');
        const mentalPositionsBeforeStudy = traitTrackPositionTotal(core, '0', ['sanity', 'knowledge']);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(traitTrackPositionTotal(core, '0', ['sanity', 'knowledge'])).toBe(mentalPositionsBeforeStudy - 2);

        core.scenarioRuntime.exorcismCircleRoomIds = ['ground-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = 'ground-north';
        const teammateBefore = core.otherExplorers.find((explorer) => explorer.playerId === '1');
        const actorBefore = { ...core.currentExplorer.traits };
        core.scenarioRuntime.exorcismCircleRoomIds = [];
        const exorciseWithoutCirclesValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}),
        );
        expect(exorciseWithoutCirclesValidation.valid).toBe(true);

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

it('最终驱魔失败只让每名存活英雄各承受 1 点身体伤害且不会误终局', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        setTestExplorerTraits(core, actorId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        const actorPhysicalBefore = physicalTraitTotal(core, actorId);
        const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);
        const traitorPhysicalBefore = physicalTraitTotal(core, traitorId);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('驱魔失败');
        expect(physicalTraitTotal(core, actorId)).toBe(actorPhysicalBefore - 1);
        expect(physicalTraitTotal(core, teammateId)).toBe(teammatePhysicalBefore - 1);
        expect(physicalTraitTotal(core, traitorId)).toBe(traitorPhysicalBefore);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(actorId);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(teammateId);
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
    });

it('最终驱魔失败只会让被 1 点身体伤害打到死亡边界的英雄死亡', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;

        setTestExplorerTraits(core, actorId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestTraitTrack(core, actorId, 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, actorId, 'speed', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, teammateId, 'might', [1, 2, 3, 4, 5], 0, 3);
        setTestTraitTrack(core, teammateId, 'speed', [1, 2, 3, 4, 5], 3, 3);
        const actorPhysicalBefore = physicalTraitTotal(core, actorId);
        const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(physicalTraitTotal(core, actorId)).toBe(actorPhysicalBefore - 1);
        expect(physicalTraitTotal(core, teammateId)).toBe(teammatePhysicalBefore - 1);
        expect(findTestExplorer(core, teammateId).traitTracks.might.position).toBe(
            findTestExplorer(core, teammateId).traitTracks.might.skullPosition,
        );
        expect(findTestExplorer(core, teammateId).traits.might).toBe(0);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(actorId);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(teammateId);
    });

it('最终驱魔失败导致全部英雄到死亡边界时才进入叛徒终局', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        setTestExplorerTraits(core, actorId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestTraitTrack(core, actorId, 'might', [1, 2, 3, 4, 5], 0, 3);
        setTestTraitTrack(core, actorId, 'speed', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, teammateId, 'might', [1, 2, 3, 4, 5], 0, 3);
        setTestTraitTrack(core, teammateId, 'speed', [1, 2, 3, 4, 5], 3, 3);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners).toEqual([traitorId]);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining([actorId, teammateId]));
    });

it('圣符和指环会让驱魔神志检定结果 +1', () => {
        const sanityBonusOmens = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' as const },
            { id: 'ring', name: '指环', kind: 'omen' as const },
        ];

        for (const omen of sanityBonusOmens) {
            let core = createCrimsonJackHauntCore();
            core.currentExplorer = {
                ...core.currentExplorer,
                roomId: 'upper-north',
                traits: {
                    ...core.currentExplorer.traits,
                    sanity: 4,
                },
                inventory: [omen],
            };
            core.activeRoomId = 'upper-north';
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [...core.currentExplorer.inventory];
            core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
            core.scenarioRuntime.jackSpiritReleased = true;
            core.scenarioRuntime.jackSpiritRoomId = 'upper-north';

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.EXORCISE_JACK,
                '0',
                {},
                100,
                createBetrayalScriptedRandom(2, 2, 2, 2),
            );

            expect(core.activityLog[0]?.text).toContain('杰克之灵被驱散');
            expect(core.endgameResult?.outcome).toBe('survivors');
        }
    });

it('圣符发现板块时可埋葬第一张板块并继续发现下一张，且不结算第一张效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '滑落阶梯',
                text: '脚下阶梯突然松动。失去 1 点速度。',
                effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        const collapsedRoom = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!;
        const gymnasium = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gymnasium')!;
        setTestRoomDiscoveryDeck(core, [
            { floor: 'upper', room: collapsedRoom },
            { floor: 'upper', room: gymnasium },
        ]);
        core.currentExplorer.inventory = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-symbol'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const speedBeforeExplore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'upper-north', useHolySymbol: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        expect(discoveredRoom?.visualId).toBe('gymnasium');
        expect(discoveredRoom?.discoveryReward).toBeNull();
        expect(discoveredRoom?.endTurnEffect).toBeUndefined();
        expect(discoveredRoom?.enterEffect).toBeUndefined();
        expect(core.latestDiscovery?.kind).toBe('none');
        expect(core.latestDiscovery?.title).toBe('体育馆');
        expect(core.latestDiscovery?.detail).toContain('没有事件、物品或预兆发现牌');
        expect(core.currentExplorer.traits.speed).toBe(speedBeforeExplore);
        expect(core.activityLog[0]?.text).toContain('圣符埋葬倒塌房间');
        expect(core.activityLog[0]?.text).toContain('继续发现体育馆');
    });

it('没有圣符或本回合刚获得圣符时，不能声明埋葬发现板块', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });

        const withoutHolySymbol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(withoutHolySymbol.valid).toBe(false);
        if (!withoutHolySymbol.valid) {
            expect(withoutHolySymbol.error).toContain('不能使用圣符');
        }

        core.currentExplorer.inventory = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [];

        const newlyGainedHolySymbol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(newlyGainedHolySymbol.valid).toBe(false);
        if (!newlyGainedHolySymbol.valid) {
            expect(newlyGainedHolySymbol.error).toContain('不能使用圣符');
        }
    });
});
