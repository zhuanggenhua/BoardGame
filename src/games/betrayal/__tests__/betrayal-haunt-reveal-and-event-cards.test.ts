import { describe, expect, it } from 'vitest';
import {
    acknowledgePendingCardResolutions,
    acknowledgePendingEventRollResolution,
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    finalizePendingEventRollForTest,
    setTestRoomDiscoveryDeck,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    traitTrackPosition,
    repeatTraitsForPendingDamage,
    expectPendingDamageForTest,
    resolvePendingDamageForTest,
    acknowledgeSingleEventEffectResolution,
    acknowledgeAnyPendingCardResolutions,
    createHelpingHandsHauntCore,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveHelpingHandsControllerPlayerId } from '../hauntScenarioReadModel';
import {
    resolveBetrayalTraitorVolunteerInteraction,
    resolveBetrayalTraitorVolunteerResolutionPreview,
} from '../hauntTraitorResolutionModel';
import { resolveHelpingHandsMonsterTurnStatus } from '../monsterActionReadModel';

describe('Betrayal first scenario runtime - haunt reveal and early event cards', () => {
it('大宅饿了作祟检定成功会进入剧本12官方开局切片', () => {
        const core = createHelpingHandsHauntCore();
        const helpingHands = core.scenarioRuntime.helpingHands;
        const trollHands = core.monsters.filter((monster) => helpingHands?.trollHandIds.includes(monster.id));
        const monsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'free-for-all',
            traitorPlayerId: null,
            teamModel: 'free-for-all',
            reasonLabel: '自由混战',
            candidatePlayerIds: [],
            excludedPlayerIds: [],
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-revealer',
            anchorPlayerId: '0',
            nextPlayerId: '1',
            reasonLabel: '作祟揭秘者左侧玩家先行动',
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntCardNumber).toBe(12);
        expect(core.currentPlayer).toBe('1');
        expect(helpingHands).toMatchObject({
            strangeAmuletCardId: 'strange-amulet',
            strangeAmuletFoundDuringSetup: true,
            trollHandIds: ['troll-hand-1', 'troll-hand-2'],
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('0');
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(core.possessionOrderByKind.item.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(core.deckCounts.item).toBe(BETRAYAL_DISCOVERY_POOLS.possessions.item.length - 1);
        expect(trollHands).toHaveLength(2);
        expect(trollHands.map((monster) => [monster.roomId, monster.might, monster.speed, monster.sanity, monster.knowledge])).toEqual([
            ['entrance-hall', 5, 3, 4, 4],
            ['basement-landing', 5, 3, 4, 4],
        ]);
        expect(core.scenarioRuntime.hauntSetupQueue.map((entry) => entry.id)).toEqual([
            'recover-strange-amulet',
            'monster-card-left-of-revealer',
            'place-troll-hands',
            'first-player-left-of-revealer',
        ]);
        expect(monsterTurnStatus).toMatchObject({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
            trollHandIds: ['troll-hand-1', 'troll-hand-2'],
            reason: '等待揭秘者结束回合后开始巨魔手怪物回合。',
        });
    });

it('一名公开叛徒作祟会给出自愿替代叛徒候选和触发牌转移口径', () => {
        const core = createFirstScenarioHauntCore();
        const interaction = resolveBetrayalTraitorVolunteerInteraction(core);

        expect(interaction).toMatchObject({
            active: true,
            designatedTraitorPlayerId: core.scenarioRuntime.traitorPlayerId,
            volunteerCandidatePlayerIds: ['0', '1'],
            triggerCardId: core.scenarioRuntime.triggeringOmenId,
            requiresPositionSwap: true,
            requiresTriggerCardTransfer: true,
            reason: null,
        });
        expect(interaction.triggerCardHolderPlayerId).toBe(core.scenarioRuntime.traitorPlayerId);
    });

it('自由混战作祟不会错误进入自愿替代叛徒流程', () => {
        const core = createHelpingHandsHauntCore();

        expect(resolveBetrayalTraitorVolunteerInteraction(core)).toMatchObject({
            active: false,
            designatedTraitorPlayerId: null,
            volunteerCandidatePlayerIds: [],
            requiresPositionSwap: false,
            requiresTriggerCardTransfer: false,
            reason: '只有一名公开叛徒的作祟才使用自愿替代叛徒流程。',
        });
    });

it('自愿者替代叛徒预览会列出角色变化、换位、触发牌转移和重算缺口', () => {
        const core = createFirstScenarioHauntCore();
        const designatedTraitorPlayerId = core.scenarioRuntime.traitorPlayerId!;
        const volunteerPlayerId = '0';
        const designatedTraitorRoomId = findTestExplorer(core, designatedTraitorPlayerId).roomId;
        const volunteerRoomId = findTestExplorer(core, volunteerPlayerId).roomId;
        const preview = resolveBetrayalTraitorVolunteerResolutionPreview(core, {
            decision: 'volunteer-replaces',
            volunteerPlayerId,
        });

        expect(preview).toMatchObject({
            active: true,
            canResolve: true,
            status: 'ready',
            decision: 'volunteer-replaces',
            designatedTraitorPlayerId,
            volunteerPlayerId,
            resultingTraitorPlayerId: volunteerPlayerId,
            roleChanges: [
                { playerId: designatedTraitorPlayerId, fromSide: 'traitor', toSide: 'hero' },
                { playerId: volunteerPlayerId, fromSide: 'hero', toSide: 'traitor' },
            ],
            positionSwap: {
                required: true,
                designatedTraitorPlayerId,
                volunteerPlayerId,
                fromRoomByPlayerId: {
                    [designatedTraitorPlayerId]: designatedTraitorRoomId,
                    [volunteerPlayerId]: volunteerRoomId,
                },
                toRoomByPlayerId: {
                    [designatedTraitorPlayerId]: volunteerRoomId,
                    [volunteerPlayerId]: designatedTraitorRoomId,
                },
            },
            triggerCardTransfer: {
                required: true,
                cardId: core.scenarioRuntime.triggeringOmenId,
                fromPlayerId: designatedTraitorPlayerId,
                toPlayerId: volunteerPlayerId,
                holderAlreadyCorrect: false,
            },
            requiresTraitorBoostReconciliation: true,
            requiresFirstPlayerReconciliation: true,
            requiresHauntSetupReconciliation: true,
            contractGaps: [
                'formal-command',
                'reveal-ui',
                'traitor-boost-reconciliation',
                'first-player-reconciliation',
                'haunt-setup-reconciliation',
            ],
            previewOnly: true,
            reason: null,
        });
    });

it('无人自愿替代叛徒预览会保留指定叛徒且不换位不转移触发牌', () => {
        const core = createFirstScenarioHauntCore();
        const designatedTraitorPlayerId = core.scenarioRuntime.traitorPlayerId!;
        const preview = resolveBetrayalTraitorVolunteerResolutionPreview(core, {
            decision: 'no-volunteer',
        });

        expect(preview).toMatchObject({
            active: true,
            canResolve: true,
            status: 'ready',
            decision: 'no-volunteer',
            designatedTraitorPlayerId,
            volunteerPlayerId: null,
            resultingTraitorPlayerId: designatedTraitorPlayerId,
            roleChanges: [],
            positionSwap: { required: false },
            triggerCardTransfer: {
                required: false,
                cardId: core.scenarioRuntime.triggeringOmenId,
                fromPlayerId: designatedTraitorPlayerId,
                toPlayerId: null,
            },
            requiresTraitorBoostReconciliation: false,
            requiresFirstPlayerReconciliation: false,
            requiresHauntSetupReconciliation: false,
            contractGaps: ['formal-command', 'reveal-ui'],
            previewOnly: true,
            reason: null,
        });
    });

it('自愿替代叛徒预览会阻止非法志愿者和非适用作祟', () => {
        const core = createFirstScenarioHauntCore();
        const designatedTraitorPlayerId = core.scenarioRuntime.traitorPlayerId!;

        expect(resolveBetrayalTraitorVolunteerResolutionPreview(core, {
            decision: 'volunteer-replaces',
            volunteerPlayerId: designatedTraitorPlayerId,
        })).toMatchObject({
            active: true,
            canResolve: false,
            status: 'invalid-volunteer',
            reason: '该玩家不在可自愿替代叛徒列表。',
        });

        expect(resolveBetrayalTraitorVolunteerResolutionPreview(createHelpingHandsHauntCore(), {
            decision: 'volunteer-replaces',
            volunteerPlayerId: '0',
        })).toMatchObject({
            active: false,
            canResolve: false,
            status: 'not-applicable',
            reason: '只有一名公开叛徒的作祟才使用自愿替代叛徒流程。',
        });
    });

it('事件牌结算后应回到牌堆底部，事件牌堆数量不减少', () => {
        const firstEvent = { name: '第一张测试事件', text: '第一张事件。', effect: { mode: 'none' as const, recommendedAction: 'endTurn' as const } };
        const secondEvent = { name: '第二张测试事件', text: '第二张事件。', effect: { mode: 'none' as const, recommendedAction: 'endTurn' as const } };
        let core = createStartedFirstScenarioCore(['0', '1']);
        core.drawOrder = ['event'];
        setTestRoomDiscoveryDeck(core, [
            { floor: 'ground', room: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'kitchen')! },
            { floor: 'ground', room: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')! },
        ]);
        core.eventOrder = [firstEvent, secondEvent];
        core.deckCounts.event = core.eventOrder.length;
        const eventDeckBefore = core.deckCounts.event;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('第一张测试事件');
        expect(core.eventOrder.map((event) => event.name)).toEqual(['第二张测试事件', '第一张测试事件']);
        expect(core.deckCounts.event).toBe(eventDeckBefore);
        expect(core.discardCounts.event).toBe(0);
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: 'ground-east' });

        expect(core.latestDiscovery?.title).toBe('第二张测试事件');
        expect(core.eventOrder.map((event) => event.name)).toEqual(['第一张测试事件', '第二张测试事件']);
        expect(core.deckCounts.event).toBe(eventDeckBefore);
        expect(core.discardCounts.event).toBe(0);
    });

it('剧本3玩家视图只允许本人看到自己的疾病标记数字', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.scenarioRuntime.dust = {
            sicknessTokensByPlayerId: {
                '0': [
                    { id: 'sickness-0-a', value: 1 },
                    { id: 'sickness-0-b', value: 4 },
                    { id: 'sickness-0-c', value: 8 },
                ],
                '1': [
                    { id: 'sickness-1-a', value: 2 },
                    { id: 'sickness-1-b', value: 3 },
                    { id: 'sickness-1-c', value: 5 },
                ],
                '2': [
                    { id: 'sickness-2-a', value: 6 },
                    { id: 'sickness-2-b', value: 7 },
                    { id: 'sickness-2-c', value: 9 },
                ],
            },
            permanentTraitorPlayerIds: ['0'],
            researchRoomIds: [],
            exchangedSicknessThisTurnPlayerIds: [],
            feverishPlayerIds: [],
        };

        const viewForPlayer0 = BetrayalDomain.playerView?.(core, '0') as BetrayalCore;
        const viewForPlayer1 = BetrayalDomain.playerView?.(core, '1') as BetrayalCore;

        expect(viewForPlayer0.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 4, 8]);
        expect(viewForPlayer0.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(core.scenarioRuntime.dust.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
    });

it('剧本3死亡保护回看也只允许本人看到自己的疾病标记数字', () => {
        const core = createStartedFirstScenarioCore(['0', '1']);
        core.scenarioRuntime.dust = {
            sicknessTokensByPlayerId: {
                '0': [
                    { id: 'sickness-0-a', value: 1 },
                    { id: 'sickness-0-b', value: 4 },
                    { id: 'sickness-0-c', value: 8 },
                ],
                '1': [
                    { id: 'sickness-1-a', value: 2 },
                    { id: 'sickness-1-b', value: 3 },
                    { id: 'sickness-1-c', value: 5 },
                ],
            },
            permanentTraitorPlayerIds: ['0'],
            researchRoomIds: [],
            exchangedSicknessThisTurnPlayerIds: [],
            feverishPlayerIds: [],
        };
        core.recentRoll = {
            id: 'death-prevention-dust-privacy',
            kind: 'deathPrevention',
            playerId: '1',
            sourceTitle: '头骨死亡保护',
            dice: [2, 1],
            passiveBonus: 0,
            latestLabel: '阻止死亡',
            deathPrevention: {
                cardId: 'skull',
                minTotal: 5,
                damageKind: 'physical',
                damageAmount: 1,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
                scenarioRuntimeBeforeDefeat: {
                    ...core.scenarioRuntime,
                    dust: {
                        sicknessTokensByPlayerId: {
                            '0': [
                                { id: 'before-sickness-0-a', value: 1 },
                                { id: 'before-sickness-0-b', value: 4 },
                                { id: 'before-sickness-0-c', value: 8 },
                            ],
                            '1': [
                                { id: 'before-sickness-1-a', value: 2 },
                                { id: 'before-sickness-1-b', value: 3 },
                                { id: 'before-sickness-1-c', value: 5 },
                            ],
                        },
                        permanentTraitorPlayerIds: ['0'],
                        researchRoomIds: [],
                        exchangedSicknessThisTurnPlayerIds: [],
                        feverishPlayerIds: [],
                    },
                },
                monstersBeforeDefeat: core.monsters.map((monster) => ({ ...monster })),
            },
            consumedRabbitFootCardIds: [],
        };

        const viewForPlayer1 = BetrayalDomain.playerView?.(core, '1') as BetrayalCore;
        const deathPreventionDust = viewForPlayer1.recentRoll?.deathPrevention?.scenarioRuntimeBeforeDefeat.dust;

        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
        expect(viewForPlayer1.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(viewForPlayer1.scenarioRuntime.dust?.permanentTraitorPlayerIds).toEqual([]);
        expect(deathPreventionDust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([2, 3, 5]);
        expect(deathPreventionDust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([null, null, null]);
        expect(deathPreventionDust?.permanentTraitorPlayerIds).toEqual([]);
        expect(core.recentRoll.deathPrevention?.scenarioRuntimeBeforeDefeat.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 4, 8]);
    });

it('标本剥制按官方锁定文本执行力量检定成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer.traits.might = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('标本剥制');
        expect(core.latestDiscovery?.detail).toContain('力量检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('obstacle');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('标本剥制');
        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expectPendingDamageForTest(core, {
            sourceTitle: '标本剥制',
            damageKind: 'physical',
            originalAmount: 1,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(4);
        core = resolvePendingDamageForTest(core, ['might']);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('obstacle');
    });

it('外星几何按官方锁定文本执行知识检定成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.detail).toContain('知识检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点速度');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
    });

it('普通事件投掷先保留结果展示，无新选择时也需要全员确认', () => {
        let core = createStartedFirstScenarioCore(['0', '1']);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
            false,
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：知识检定 6：获得 1 点知识；知识 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.pendingEventRollResolution).toMatchObject({
            rollId: core.recentRoll?.id,
            sourceTitle: '外星几何',
            requiredPlayerIds: core.playerIds,
            acknowledgedPlayerIds: [],
            requiresAcknowledgement: true,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先处理当前事件投掷结果。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, '1', {
                rollId: core.pendingEventRollResolution!.rollId,
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, '1', {
            rollId: core.pendingEventRollResolution!.rollId,
        }, 100, BETRAYAL_FIXED_RANDOM, false);

        expect(core.pendingEventRollResolution).toMatchObject({
            acknowledgedPlayerIds: ['1'],
        });
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, '0', {
            rollId: core.pendingEventRollResolution!.rollId,
        }, 101, BETRAYAL_FIXED_RANDOM, false);

        expect(core.pendingEventRollResolution).toMatchObject({
            acknowledgedPlayerIds: ['1', '0'],
        });
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        core = acknowledgePendingEventRollResolution(core, 102, BETRAYAL_FIXED_RANDOM);

        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.pendingEventRollResolution).toBeNull();
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, '1', { rollId: core.recentRoll?.id }),
        ).valid).toBe(false);
    });

it('小丑房间支持无事发生分支与精神伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 8');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.latestDiscovery?.tone).toBe('accent');
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 2 点精神伤害');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expectPendingDamageForTest(core, {
            sourceTitle: '小丑房间',
            damageKind: 'mental',
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(core.currentExplorer.traits.knowledge + core.currentExplorer.traits.sanity).toBe(8);
        core = resolvePendingDamageForTest(core, ['knowledge', 'sanity']);
        expect(core.currentExplorer.traits.knowledge + core.currentExplorer.traits.sanity).toBe(6);
        expect(core.pendingDamageAllocation).toBeNull();
    });

it('书本使用后会让事件非战斗检定用知识骰数并消费状态', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 5,
                sanity: 2,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['omen-book'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        expect(core.currentExplorer.traits.sanity).toBe(1);
        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'omen-book',
            replacementTrait: 'knowledge',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 10');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.recentRoll?.dice).toHaveLength(5);
        expect(core.currentExplorer.traits.sanity).toBe(1);
        expect(core.nextNonCombatTraitReplacement).toBeNull();
    });

it('属性检定最多使用 8 颗山屋骰，且单颗骰面只会是 0/1/2', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '测试高属性检定',
            roll: {
                trait: 'knowledge',
                branches: [
                    { min: 0, label: '记录骰池', effect: { mode: 'none', recommendedAction: 'endTurn' } },
                ],
            },
        }];
        core.currentExplorer.traits.knowledge = 12;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 2, 3, 1, 2, 3, 1, 2, 3, 3),
        );

        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.dice).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
        expect(core.recentRoll?.passiveBonus).toBe(0);
        expect(core.recentRoll?.dice.every((pip) => pip >= 0 && pip <= 2)).toBe(true);
        expect(core.latestDiscovery?.detail).toContain('知识检定 7');
    });

it('一种怪异的感觉按固定 2 骰执行成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('一种怪异的感觉');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.latestDiscovery?.tone).toBe('accent');
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('一种怪异的感觉');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点神志');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
    });

it('葬礼按官方锁定文本执行神志检定和已发现墓地放置', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('葬礼');
        expect(core.latestDiscovery?.detail).toContain('神志检定 4');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.roomId).toBe('ground-north');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 2');
        expect(core.latestDiscovery?.detail).toContain('神志 -1');
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.roomId).toBe('ground-north');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.rooms = core.rooms.map((room) => (
            room.id === 'ground-east'
                ? {
                    ...room,
                    name: '墓园',
                    state: 'discovered',
                    floor: 'ground',
                    visualId: 'graveyard',
                    connectedRoomIds: [...room.connectedRoomIds],
                    doorways: room.doorways.map((doorway) => ({ ...doorway })),
                }
                : room
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.roomId).toBe('ground-east');
    });

it('电话铃声按固定 2 骰执行增益、骰数精神伤害和骰数物理伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'knowledge', [2, 3, 4, 5, 6], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [2, 3, 4, 5, 6], 2, 2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('电话铃声');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.sanity).toBe(5);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'knowledge', [2, 3, 4, 5, 6], 2, 2);
        setTestTraitTrack(core, '0', 'sanity', [2, 3, 4, 5, 6], 2, 2);
        const knowledgePositionBeforeMentalDamage = traitTrackPosition(core, '0', 'knowledge');
        const sanityPositionBeforeMentalDamage = traitTrackPosition(core, '0', 'sanity');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '电话铃声',
            damageKind: 'mental',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeMentalDamage);
        expect(core.currentExplorer.traitTracks.sanity.position).toBe(sanityPositionBeforeMentalDamage);
        core = resolvePendingDamageForTest(core, ['knowledge', 'sanity']);
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeMentalDamage - 1);
        expect(core.currentExplorer.traitTracks.sanity.position).toBe(sanityPositionBeforeMentalDamage - 1);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(3);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'might', [1, 2, 3, 4, 5], 3, 3);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3, 4, 5], 3, 3);
        const mightPositionBeforePhysicalDamage = traitTrackPosition(core, '0', 'might');
        const speedPositionBeforePhysicalDamage = traitTrackPosition(core, '0', 'speed');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 3, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('重新投掷 2 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '电话铃声',
            damageKind: 'physical',
            amount: 4,
            originalAmount: 4,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforePhysicalDamage);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforePhysicalDamage);
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['might', 'speed']));
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforePhysicalDamage - 3);
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforePhysicalDamage - 1);
        expect(core.currentExplorer.traits.might).toBe(1);
        expect(core.currentExplorer.traits.speed).toBe(3);
    });

it('小机器人按官方锁定文本执行抽物品和骰数物理伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const inventoryBefore = core.currentExplorer.inventory.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小机器人');
        expect(core.latestDiscovery?.detail).toContain('知识检定 8');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(inventoryBefore + 1);
        expect(core.currentExplorerInventory).toHaveLength(inventoryBefore + 1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'might', [2, 3, 4, 5, 6], 2, 2);
        const mightPositionBeforeRobotDamage = traitTrackPosition(core, '0', 'might');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 1, 1, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小机器人');
        expect(core.latestDiscovery?.detail).toContain('知识检定 2');
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '小机器人',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeRobotDamage);
        core = resolvePendingDamageForTest(core, ['might', 'might']);
        expect(core.currentExplorer.traitTracks.might.position).toBe(mightPositionBeforeRobotDamage - 2);
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(4);
    });

it('肉质苔癣按官方锁定文本支持选择不吸入或吸入后投骰结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('肉质苔癣');
        expect(core.latestDiscovery?.detail).toContain('可选择大口吸入芳香');
        expect(core.pendingEventChoice?.sourceTitle).toBe('肉质苔癣');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);

        const acceptWithoutTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }),
        );
        expect(acceptWithoutTrait.valid).toBe(true);

        const mightBeforeSkip = core.currentExplorer.traits.might;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.summary).toBe('不吸入芳香');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.currentExplorer.traits.might).toBe(mightBeforeSkip);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3),
            false,
        );
        core = acknowledgePendingEventRollResolution(core, 101, BETRAYAL_FIXED_RANDOM);

        expect(core.latestDiscovery?.summary).toBe('大口吸入芳香');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点任意属性');
        expect(core.latestDiscovery?.detail).not.toContain('知识 +1');
        expect(core.pendingEventChoice).toMatchObject({
            sourceTitle: '肉质苔癣',
            effect: { mode: 'chosenTrait' },
        });
        expect(core.pendingEventRollResolution).toBeNull();
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);
        const knowledgePositionBeforeMossReward = traitTrackPosition(core, '0', 'knowledge');

        expect(core.pendingEventChoice?.sourceTitle).toBe('肉质苔癣');
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：知识 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '肉质苔癣',
            stepKind: 'event-effect',
            text: '事件效果：知识 +1',
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
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBeforeMossReward + 1);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'knowledge', [2, 3, 4, 5, 6], 2, 2);
        const knowledgePositionBeforeMossDamage = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '肉质苔癣',
            damageKind: 'mental',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['knowledge', 'sanity'],
        });
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeMossDamage);
        core = resolvePendingDamageForTest(core, ['knowledge', 'knowledge']);
        expect(core.currentExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBeforeMossDamage - 2);
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('兔脚重掷肉质苔癣成功分支时保留待选属性而不提前结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, might: 4, knowledge: 4 },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3),
            false,
        );

        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.pendingEventRollResolution?.nextPendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.pendingEventRollResolution?.effect.mode).toBe('chosenTrait');
        expect(core.recentRoll?.latestLabel).toContain('获得 1 点任意属性');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
            false,
        );

        expect(core.recentRoll?.dice).toEqual([2, 2]);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.pendingEventRollResolution?.nextPendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.pendingEventRollResolution?.effect.mode).toBe('chosenTrait');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.latestDiscovery?.detail).toContain('获得 1 点任意属性');
        expect(core.latestDiscovery?.detail).not.toContain('知识 +1');
        const knowledgePositionBeforeRabbitMossReward = traitTrackPosition(core, '0', 'knowledge');

        core = finalizePendingEventRollForTest(core);

        expect(core.pendingEventRollResolution).toBeNull();
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBeforeRabbitMossReward + 1);
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
    });

it('夜幕众星按官方锁定文本支持选择属性检定、所选属性增减和治疗', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('夜幕众星');
        expect(core.latestDiscovery?.detail).toContain('选择一项属性进行检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('夜幕众星');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);
        const knowledgePositionBeforeStarsReward = traitTrackPosition(core, '0', 'knowledge');

        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {}),
        );
        expect(missingTrait.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.summary).toBe('选择一项属性进行检定');
        expect(core.latestDiscovery?.detail).toContain('知识检定 8');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点所选属性');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBeforeStarsReward + 1);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.trait).toBe('knowledge');
        core = acknowledgeSingleEventEffectResolution(core, '夜幕众星', '知识 +1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 4');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点所选属性');
        expect(core.latestDiscovery?.detail).toContain('速度 -1');
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '夜幕众星', '速度 -1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        const sanityTemplateValue = core.currentExplorer.traits.sanity;
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 4, sanityTemplateValue, sanityTemplateValue + 1], 1, 3);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'sanity' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('治疗所选属性');
        expect(core.latestDiscovery?.detail).toContain('治疗神志');
        expect(core.currentExplorer.traits.sanity).toBe(sanityTemplateValue);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '夜幕众星', '治疗神志');
    });

it('一抹鲜红按官方锁定文本支持可选作祟检定、速度奖励和跳过伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        setTestTraitTrack(core, '0', 'speed', [1, 3, 4, 4, 5], 2, 2);
        const speedPositionBeforeScarletReward = traitTrackPosition(core, '0', 'speed');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('一抹鲜红');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一抹鲜红');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('选择进行作祟检定：总点数 0');
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        expect(core.currentExplorer.traitTracks.speed.position).toBe(speedPositionBeforeScarletReward + 1);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '一抹鲜红', '速度 +1');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        const mightBeforeSkip = core.currentExplorer.traits.might;
        const speedBeforeSkip = core.currentExplorer.traits.speed;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('重新投掷 1 颗骰子');
        expectPendingDamageForTest(core, {
            sourceTitle: '一抹鲜红',
            damageKind: 'physical',
            amount: 1,
            originalAmount: 1,
            allowedTraits: ['might', 'speed'],
        });
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBe(mightBeforeSkip + speedBeforeSkip);
        core = resolvePendingDamageForTest(core, repeatTraitsForPendingDamage(core, ['might', 'speed']));
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBe(mightBeforeSkip + speedBeforeSkip - 1);
        expect(core.turnEndedByDiscovery).toBe(true);
        core = acknowledgeSingleEventEffectResolution(core, '一抹鲜红', '物理伤害');
    });

it('一抹鲜红作祟检定成功会复用正式 haunt 触发链路', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        const extraOmens = [
            { id: 'omen-book', name: '书本', kind: 'omen' as const },
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            ...extraOmens,
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === core.currentExplorer.playerId
                ? { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
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
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.latestDiscovery?.detail).toContain('选择进行作祟检定：总点数 6');
        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('木乃伊横行');
        expect(core.scenarioRuntime.hauntResolutionMatchedTrigger).toBe(false);
        expect(core.scenarioRuntime.hauntResolutionRepresentativeOnly).toBe(true);
        expect(core.scenarioRuntime.mummy).toBeTruthy();
        expect(core.activityLog[0]?.text).toContain('木乃伊横行');
    });
});
