import { describe, expect, it } from 'vitest';
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
    isBetrayalRoomInLineOfSight,
    resolveBetrayalPossessionSpecialActionStatus,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerTraits,
    setTestExplorerInventory,
    setTestRoomDiscoveryDeck,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    setHighCapacityGeneralDamageTracks,
    repeatTraitsForPendingDamage,
    setDiscoveredTestRoom,
    placeActiveTestExplorerInRoom,
    createDustHauntCore,
    createMagicCameraHauntCore,
    createHelpingHandsHauntCore,
    createBloodFromStoneTriggeredWithAutoPlacementCore,
    createBloodFromStoneManualPlacementGapCore,
    createBloodFromStoneMultiGapManualPlacementCore,
    placeCurrentExplorerInDustResearchRoom,
    seedDustFailedActionExchangeTokens,
    type BetrayalTraitKey,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveBloodFromStoneSetupPlacementPlan } from '../bloodFromStoneSetupReadModel';
import {
    resolveBetrayalHauntRevealProtocol,
    resolveBetrayalHauntSetupCommandPreviews,
    resolveBetrayalHauntSetupProgress,
} from '../hauntSetupModel';
import {
    resolveBetrayalMonsterActionPanel,
    resolveBloodFromStoneMonsterTurnEndPreview,
    resolveBloodFromStoneMonsterTurnStatus,
} from '../monsterActionReadModel';
import {
    resolveBetrayalHauntRisk,
    resolveBetrayalOmenCount,
} from '../hauntProgress';

describe('Betrayal first scenario runtime - dust haunt setup and research', () => {
it('一瓶微尘仍可选择跳过作祟检定并结算原事件效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('一瓶微尘');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一瓶微尘');
        expect(core.discardCounts.event).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(false);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：力量 -1；神志 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '一瓶微尘',
            stepKind: 'event-effect',
            text: '事件效果：力量 -1；神志 +1',
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
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('一瓶微尘作祟检定成功会进入灰尘剧本并分发隐藏疾病标记', () => {
        const core = createDustHauntCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'hidden-traitor',
            traitorPlayerId: null,
            teamModel: 'hidden-traitor',
            reasonLabel: '隐藏叛徒',
            candidatePlayerIds: ['0', '1', '2'],
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
        expect(core.scenarioRuntime.hauntCardNumber).toBe(3);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Dusty Vial');
        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 2, 3]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']).toHaveLength(3);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']).toHaveLength(3);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds).toEqual(['0']);
    });

it.each([
        {
            eventName: '一抹鲜红',
            expectedHauntCardNumber: 1,
            expectedTriggerLabel: 'A Splash of Crimson',
            expectedLatestLabel: '翻开作祟剧本1，你成为叛徒',
        },
        {
            eventName: '一瓶微尘',
            expectedHauntCardNumber: 3,
            expectedTriggerLabel: 'A Dusty Vial',
            expectedLatestLabel: '翻开作祟剧本3，成为作祟揭露者',
        },
        {
            eventName: '大宅饿了',
            expectedHauntCardNumber: 12,
            expectedTriggerLabel: '大宅饿了',
            expectedLatestLabel: '翻开作祟剧本12，作祟揭露者为当前探险者',
        },
        {
            eventName: '说“茄子”！',
            expectedHauntCardNumber: 33,
            expectedTriggerLabel: '说“茄子”！',
            expectedLatestLabel: '翻开作祟剧本33，魔法相机持有者成为奸徒；否则你成为奸徒',
        },
    ])('$eventName 作祟检定按全员当前持有预兆总数投骰', ({
        eventName,
        expectedHauntCardNumber,
        expectedTriggerLabel,
        expectedLatestLabel,
    }) => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.currentExplorer.inventory = [
            { id: 'omen-current', name: '当前玩家预兆', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: [
                { id: `omen-other-${index + 1}`, name: `其他玩家预兆${index + 1}`, kind: 'omen' },
            ],
        }));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        const hauntRisk = resolveBetrayalHauntRisk(core);

        expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);
        expect(core.currentExplorer.inventory.filter((card) => card.kind === 'omen')).toHaveLength(1);
        expect(resolveBetrayalOmenCount(core)).toBe(3);
        expect(hauntRisk.omenCount).toBe(3);
        expect(hauntRisk.nextRollDiceCount).toBe(4);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'eventDiceRoll',
            sourceTitle: eventName,
            rollLabel: '作祟检定',
            latestLabel: expectedLatestLabel,
        });
        expect(core.recentRoll?.dice).toEqual([2, 2, 2]);
        expect(core.recentRoll?.dice).toHaveLength(hauntRisk.omenCount);
        expect(core.recentRoll?.dice).not.toHaveLength(hauntRisk.nextRollDiceCount);
        expect(core.scenarioRuntime.hauntCardNumber).toBe(expectedHauntCardNumber);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe(expectedTriggerLabel);
        expect(core.phase).toBe('haunt');
    });

it.each([
        {
            eventName: '一抹鲜红',
            expectedHauntCardNumber: 1,
        },
        {
            eventName: '一瓶微尘',
            expectedHauntCardNumber: 3,
        },
        {
            eventName: '大宅饿了',
            expectedHauntCardNumber: 12,
        },
        {
            eventName: '说“茄子”！',
            expectedHauntCardNumber: 33,
        },
    ])('$eventName 事件型作祟检定按全员当前预兆总数投骰但最多 8 颗', ({
        eventName,
        expectedHauntCardNumber,
    }) => {
        const createTestOmens = (prefix: string) => Array.from({ length: 3 }, (_, index) => ({
            id: `${prefix}-${index + 1}`,
            name: `${prefix}预兆${index + 1}`,
            kind: 'omen' as const,
        }));
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === eventName)!];
        core.currentExplorer.inventory = createTestOmens('当前玩家');
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer, index) => ({
            ...explorer,
            inventory: createTestOmens(`其他玩家${index + 1}`),
        }));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        const hauntRisk = resolveBetrayalHauntRisk(core);

        expect(core.pendingEventChoice?.sourceTitle).toBe(eventName);
        expect(resolveBetrayalOmenCount(core)).toBe(9);
        expect(hauntRisk.omenCount).toBe(9);
        expect(hauntRisk.nextRollDiceCount).toBe(8);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 3, 3, 3),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'eventDiceRoll',
            sourceTitle: eventName,
            rollLabel: '作祟检定',
        });
        expect(core.recentRoll?.dice).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
        expect(core.recentRoll?.dice).toHaveLength(8);
        expect(core.recentRoll?.dice).not.toHaveLength(hauntRisk.omenCount);
        expect(core.scenarioRuntime.hauntCardNumber).toBe(expectedHauntCardNumber);
        expect(core.phase).toBe('haunt');
    });

it('灰尘隐藏叛徒作祟揭示不公开叛徒书，但必须保留隐藏身份和 setup 队列', () => {
        const protocol = resolveBetrayalHauntRevealProtocol(createDustHauntCore());

        expect(protocol.active).toBe(true);
        expect(protocol.hauntCardNumber).toBe(3);
        expect(protocol.hauntType).toBe('hidden-traitor');
        expect(protocol.publicSteps.map((step) => step.id)).toEqual([
            'heroes-intro',
            'heroes-setup',
        ]);
        expect(protocol.setupQueue.map((entry) => entry.id)).toEqual([
            'announce-hidden-traitor',
            'deal-secret-sickness-tokens',
            'monster-card-left-of-revealer',
            'first-player-left-of-revealer',
            'prepare-research-tokens',
        ]);
        expect(protocol.setupQueue.find((entry) => entry.id === 'deal-secret-sickness-tokens')?.status).toBe('resolved');
        expect(protocol.setupQueue.find((entry) => entry.id === 'prepare-research-tokens')?.status).toBe('manual-check');
        expect(protocol.secretBoundary).toEqual({
            heroBookVisibleTo: 'all',
            traitorBookVisibleTo: 'none',
            revealOnUse: true,
        });
    });

it('魔法相机作祟揭示队列必须列出摄影师、相机和 Essence 设置', () => {
        const protocol = resolveBetrayalHauntRevealProtocol(createMagicCameraHauntCore(null));

        expect(protocol.active).toBe(true);
        expect(protocol.hauntCardNumber).toBe(33);
        expect(protocol.hauntType).toBe('one-traitor');
        expect(protocol.setupQueue.map((entry) => entry.id)).toEqual([
            'traitor-remains-in-game',
            'place-phantom-photographers',
            'recover-magic-camera',
            'deal-hero-essence-tokens',
            'first-player-left-of-traitor',
        ]);
        expect(protocol.setupQueue.every((entry) => entry.status === 'resolved')).toBe(true);
    });

it('作祟 setup 进度读模型汇总已解决和待人工确认状态', () => {
        expect(resolveBetrayalHauntSetupProgress(createStartedFirstScenarioCore())).toMatchObject({
            active: false,
            hauntCardNumber: null,
            status: 'inactive',
            totalCount: 0,
            resolvedCount: 0,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
            representativeOnly: false,
        });

        const dustProgress = resolveBetrayalHauntSetupProgress(createDustHauntCore());
        expect(dustProgress).toMatchObject({
            active: true,
            hauntCardNumber: 3,
            status: 'manual-check-required',
            totalCount: 5,
            resolvedCount: 3,
            manualCheckCount: 2,
            manualCheckEntryIds: ['monster-card-left-of-revealer', 'prepare-research-tokens'],
            needsFormalConfirmationCommand: true,
            representativeOnly: true,
        });

        expect(resolveBetrayalHauntSetupProgress(createMagicCameraHauntCore(null))).toMatchObject({
            active: true,
            hauntCardNumber: 33,
            status: 'resolved',
            totalCount: 5,
            resolvedCount: 5,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
            representativeOnly: true,
        });
    });

it('作祟 setup 命令预览列出当前证据和待人工确认步骤', () => {
        expect(resolveBetrayalHauntSetupCommandPreviews(createStartedFirstScenarioCore())).toMatchObject({
            active: false,
            hauntCardNumber: null,
            status: 'inactive',
            previews: [],
            readyCount: 0,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
            representativeOnly: false,
        });

        const dustPreview = resolveBetrayalHauntSetupCommandPreviews(createDustHauntCore());
        expect(dustPreview).toMatchObject({
            active: true,
            hauntCardNumber: 3,
            status: 'manual-check-required',
            readyCount: 3,
            manualCheckCount: 2,
            manualCheckEntryIds: ['monster-card-left-of-revealer', 'prepare-research-tokens'],
            needsFormalConfirmationCommand: true,
            representativeOnly: true,
        });
        expect(dustPreview.previews.find((preview) => preview.entryId === 'deal-secret-sickness-tokens')).toMatchObject({
            action: 'deal-secret-tokens',
            targetPlayerIds: ['0', '1', '2'],
            alreadyApplied: true,
            canConfirmFromCurrentState: true,
            requiresManualConfirmation: false,
        });
        expect(dustPreview.previews.find((preview) => preview.entryId === 'prepare-research-tokens')).toMatchObject({
            action: 'prepare-token-pool',
            targetRoomIds: [],
            alreadyApplied: false,
            canConfirmFromCurrentState: false,
            requiresManualConfirmation: true,
            contractGaps: ['token-placement-command', 'room-selection'],
        });
    });

it('灰尘 setup 可以正式确认怪物参考卡和研究 token 池并更新队列进度', () => {
        const core = createDustHauntCore();

        const confirmed = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
            '1',
            { entryId: 'prepare-research-tokens' },
        );

        expect(confirmed.scenarioRuntime.hauntSetupQueue.find((entry) => entry.id === 'prepare-research-tokens')).toMatchObject({
            status: 'resolved',
        });
        expect(resolveBetrayalHauntSetupProgress(confirmed)).toMatchObject({
            status: 'manual-check-required',
            totalCount: 5,
            resolvedCount: 4,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
            needsFormalConfirmationCommand: true,
        });

        const confirmedPreview = resolveBetrayalHauntSetupCommandPreviews(confirmed);
        expect(confirmedPreview).toMatchObject({
            status: 'manual-check-required',
            readyCount: 4,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
        expect(confirmedPreview.previews.find((preview) => preview.entryId === 'prepare-research-tokens')).toMatchObject({
            alreadyApplied: true,
            canConfirmFromCurrentState: true,
            requiresManualConfirmation: false,
            contractGaps: ['token-placement-command', 'room-selection'],
        });
        expect(confirmed.activityLog[0]?.text).toContain('确认已准备 8 个研究 token');

        const fullyConfirmed = applyBetrayalCommand(
            confirmed,
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
            '1',
            { entryId: 'monster-card-left-of-revealer' },
        );
        expect(resolveBetrayalHauntSetupProgress(fullyConfirmed)).toMatchObject({
            status: 'resolved',
            totalCount: 5,
            resolvedCount: 5,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
            needsFormalConfirmationCommand: false,
        });
        expect(resolveBetrayalHauntSetupCommandPreviews(fullyConfirmed)).toMatchObject({
            status: 'ready',
            readyCount: 5,
            manualCheckCount: 0,
            manualCheckEntryIds: [],
        });
        expect(fullyConfirmed.activityLog[0]?.text).toContain('确认怪物参考卡已放在作祟揭秘者左侧');
    });

it('灰尘 setup 确认命令拒绝无效、非灰尘和重复确认', () => {
        expect(BetrayalDomain.validate(
            { core: createStartedFirstScenarioCore(), sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '0', {
                entryId: 'prepare-research-tokens',
            }),
        )).toMatchObject({
            valid: false,
            error: '当前还未进入 haunt 阶段。',
        });

        expect(BetrayalDomain.validate(
            { core: createDustHauntCore(), sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '1', {
                entryId: 'unknown-entry' as never,
            }),
        )).toMatchObject({
            valid: false,
            error: '当前 setup 队列没有这个条目。',
        });

        expect(BetrayalDomain.validate(
            { core: createHelpingHandsHauntCore(), sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '1', {
                entryId: 'monster-card-left-of-revealer',
            }),
        )).toMatchObject({
            valid: false,
            error: '当前只支持确认灰尘 setup 条目。',
        });

        const confirmed = applyBetrayalCommand(
            createDustHauntCore(),
            BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY,
            '1',
            { entryId: 'prepare-research-tokens' },
        );
        expect(BetrayalDomain.validate(
            { core: confirmed, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY, '1', {
                entryId: 'prepare-research-tokens',
            }),
        )).toMatchObject({
            valid: false,
            error: '该 setup 条目已经确认。',
        });
    });

it('作祟 setup 命令预览会把代表剧本已放置对象映射成可确认目标', () => {
        const helpingHandsPreview = resolveBetrayalHauntSetupCommandPreviews(createHelpingHandsHauntCore());
        expect(helpingHandsPreview).toMatchObject({
            hauntCardNumber: 12,
            status: 'manual-check-required',
            readyCount: 3,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
        expect(helpingHandsPreview.previews.find((preview) => preview.entryId === 'recover-strange-amulet')).toMatchObject({
            action: 'recover-card',
            targetPlayerIds: ['0'],
            targetCardIds: ['strange-amulet'],
            alreadyApplied: true,
        });
        expect(helpingHandsPreview.previews.find((preview) => preview.entryId === 'place-troll-hands')).toMatchObject({
            action: 'place-monster-tokens',
            targetMonsterIds: ['troll-hand-1', 'troll-hand-2'],
            targetRoomIds: ['entrance-hall', 'basement-landing'],
            canConfirmFromCurrentState: true,
        });

        const magicCameraPreview = resolveBetrayalHauntSetupCommandPreviews(createMagicCameraHauntCore(null));
        expect(magicCameraPreview).toMatchObject({
            hauntCardNumber: 33,
            status: 'ready',
            readyCount: 5,
            manualCheckCount: 0,
        });
        expect(magicCameraPreview.previews.find((preview) => preview.entryId === 'place-phantom-photographers')).toMatchObject({
            action: 'place-monster-tokens',
            targetMonsterIds: ['phantom-photographer-1', 'phantom-photographer-2', 'phantom-photographer-3'],
            canConfirmFromCurrentState: true,
        });
        expect(magicCameraPreview.previews.find((preview) => preview.entryId === 'deal-hero-essence-tokens')).toMatchObject({
            action: 'deal-secret-tokens',
            targetPlayerIds: ['1', '2'],
            alreadyApplied: true,
        });
    });

it('顽石之血触发 setup 时每名探索者脚下放 1 个石像小天使，额外石像优先放在英雄视线外', () => {
        const core = createBloodFromStoneTriggeredWithAutoPlacementCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(5);
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-revealer',
            anchorPlayerId: '0',
            nextPlayerId: '1',
        });

        const stoneCherubs = core.monsters.filter((monster) => monster.definitionId === 'blood-from-stone-stone-cherub');
        expect(stoneCherubs).toHaveLength(6);
        expect(stoneCherubs.find((monster) => monster.id === 'stone-cherub-explorer-0')?.roomId).toBe('ground-east');
        expect(stoneCherubs.find((monster) => monster.id === 'stone-cherub-explorer-1')?.roomId).toBe('entrance-hall');
        expect(stoneCherubs.find((monster) => monster.id === 'stone-cherub-explorer-2')?.roomId).toBe('entrance-hall');

        const plan = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(plan).toMatchObject({
            active: true,
            additionalStoneCherubCount: 3,
            totalRequiredStoneCherubCount: 6,
            placedStoneCherubCount: 6,
            pendingPlayerChoiceCount: 0,
            canFullyAutoPlace: true,
        });
        expect(plan.explorerPlacements.map((placement) => placement.monsterId)).toEqual([
            'stone-cherub-explorer-0',
            'stone-cherub-explorer-1',
            'stone-cherub-explorer-2',
        ]);
        expect(plan.automaticExtraPlacements).toHaveLength(3);
        const heroRoomIds = [core.currentExplorer, ...core.otherExplorers].map((explorer) => explorer.roomId);
        for (const placement of plan.automaticExtraPlacements) {
            expect(heroRoomIds.every((roomId) => !isBetrayalRoomInLineOfSight(core, roomId, placement.roomId))).toBe(true);
        }

        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            hauntCardNumber: 5,
            totalCount: 5,
            resolvedCount: 4,
            manualCheckCount: 1,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
        expect(core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId['1'])
            .toContain('stone-cherub-explorer-1');
    });

it('顽石之血会在揭秘者结束回合后自然进入石像小天使怪物回合，并在凝视收口后进入下一玩家', () => {
        let core = createBloodFromStoneTriggeredWithAutoPlacementCore();
        for (const playerId of ['0', '1', '2']) {
            setHighCapacityGeneralDamageTracks(core, playerId);
        }

        expect(core.currentPlayer).toBe('1');
        expect(resolveBloodFromStoneMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveBetrayalMonsterActionPanel(core)).toMatchObject({
            active: false,
            reason: '等待揭秘者结束回合后开始石像小天使怪物回合。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        expect(core.currentPlayer).toBe('2');
        expect(resolveBloodFromStoneMonsterTurnStatus(core).active).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('0');
        expect(resolveBloodFromStoneMonsterTurnStatus(core).active).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('0');
        expect(resolveBloodFromStoneMonsterTurnStatus(core)).toMatchObject({
            active: true,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveBetrayalMonsterActionPanel(core).active).toBe(true);
        expect(core.activityLog[0]?.text).toContain('石像小天使怪物回合开始');

        const stoneCherubIds = core.monsters
            .filter((monster) => monster.definitionId === 'blood-from-stone-stone-cherub')
            .map((monster) => monster.id);
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: stoneCherubIds,
            skippedMonsterIdsThisTurn: stoneCherubIds,
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };

        expect(resolveBloodFromStoneMonsterTurnEndPreview(core)).toMatchObject({
            active: true,
            canEnd: true,
            controllerPlayerId: '0',
            nextPlayerId: '1',
        });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1, 1, 1),
        );

        let pendingDamageSafety = 0;
        while (core.pendingDamageAllocation) {
            const playerId = core.pendingDamageAllocation.playerId;
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                playerId,
                { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
            );
            pendingDamageSafety += 1;
            expect(pendingDamageSafety).toBeLessThan(10);
        }

        expect(core.currentPlayer).toBe('1');
        expect(resolveBloodFromStoneMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
        });
        expect(resolveBetrayalMonsterActionPanel(core)).toMatchObject({
            active: false,
            reason: '等待揭秘者结束回合后开始石像小天使怪物回合。',
        });
    });

it('顽石之血额外石像视线外房间不足时必须留下玩家选房缺口', () => {
        const core = createBloodFromStoneManualPlacementGapCore();

        const plan = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(plan).toMatchObject({
            active: true,
            additionalStoneCherubCount: 3,
            totalRequiredStoneCherubCount: 6,
            placedStoneCherubCount: 5,
            pendingPlayerChoiceCount: 1,
            canFullyAutoPlace: false,
        });
        expect(plan.automaticExtraPlacements.map((placement) => placement.roomId)).toEqual([
            'upper-landing',
            'basement-landing',
        ]);
        expect(plan.playerChoiceCandidateRoomIds).toEqual(expect.arrayContaining([
            'entrance-hall',
            'hallway',
            'grand-staircase',
            'upper-landing',
            'basement-landing',
        ]));

        const progress = resolveBetrayalHauntSetupProgress(core);
        expect(progress).toMatchObject({
            hauntCardNumber: 5,
            status: 'manual-check-required',
            manualCheckEntryIds: ['place-additional-stone-cherubs', 'monster-card-left-of-revealer'],
        });

        const preview = resolveBetrayalHauntSetupCommandPreviews(core);
        const additionalPlacement = preview.previews.find((item) => item.entryId === 'place-additional-stone-cherubs');
        expect(additionalPlacement).toMatchObject({
            action: 'place-monster-tokens',
            targetMonsterIds: ['stone-cherub-extra-1', 'stone-cherub-extra-2'],
            targetRoomIds: ['upper-landing', 'basement-landing'],
            canConfirmFromCurrentState: false,
            requiresManualConfirmation: true,
            contractGaps: ['formal-command', 'ui-confirmation', 'token-placement-command', 'room-selection'],
        });
        expect(additionalPlacement?.evidence.join(' ')).toContain('还剩 1 个必须由玩家在屋内合法房间中选择放置');
    });

it('顽石之血额外石像补放必须选择刚好数量的已发现房间', () => {
        let core = createBloodFromStoneManualPlacementGapCore();

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: [] },
            ),
        )).toMatchObject({
            valid: false,
            error: '必须选择 1 个房间来补放石像小天使。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: ['upper-west'] },
            ),
        )).toMatchObject({
            valid: false,
            error: '石像小天使只能补放到屋内已发现房间。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
            '0',
            { roomIds: ['entrance-hall'] },
        );

        const placedStoneCherub = core.monsters.find((monster) => monster.id === 'stone-cherub-extra-3');
        expect(placedStoneCherub).toMatchObject({
            definitionId: 'blood-from-stone-stone-cherub',
            roomId: 'entrance-hall',
        });

        const plan = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(plan.pendingPlayerChoiceCount).toBe(0);
        expect(plan.playerChoicePlacements).toEqual([
            expect.objectContaining({
                monsterId: 'stone-cherub-extra-3',
                roomId: 'entrance-hall',
                source: 'extra-player-choice',
            }),
        ]);
        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            hauntCardNumber: 5,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
    });

it('顽石之血额外石像多缺口时允许把多个石像补放到同一已发现房间', () => {
        let core = createBloodFromStoneMultiGapManualPlacementCore();

        const planBefore = resolveBloodFromStoneSetupPlacementPlan(core);
        expect(planBefore).toMatchObject({
            active: true,
            additionalStoneCherubCount: 3,
            totalRequiredStoneCherubCount: 6,
            placedStoneCherubCount: 4,
            pendingPlayerChoiceCount: 2,
            canFullyAutoPlace: false,
        });
        expect(planBefore.automaticExtraPlacements.map((placement) => placement.roomId)).toEqual([
            'upper-landing',
        ]);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: ['entrance-hall'] },
            ),
        )).toMatchObject({
            valid: false,
            error: '必须选择 2 个房间来补放石像小天使。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
                '0',
                { roomIds: ['entrance-hall', 'entrance-hall'] },
            ),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS,
            '0',
            { roomIds: ['entrance-hall', 'entrance-hall'] },
        );

        expect(core.monsters.filter(
            (monster) =>
                monster.definitionId === 'blood-from-stone-stone-cherub' &&
                monster.roomId === 'entrance-hall' &&
                (monster.id === 'stone-cherub-extra-2' || monster.id === 'stone-cherub-extra-3'),
        )).toHaveLength(2);
        expect(resolveBloodFromStoneSetupPlacementPlan(core)).toMatchObject({
            pendingPlayerChoiceCount: 0,
            playerChoicePlacements: [
                expect.objectContaining({
                    monsterId: 'stone-cherub-extra-2',
                    roomId: 'entrance-hall',
                    source: 'extra-player-choice',
                }),
                expect.objectContaining({
                    monsterId: 'stone-cherub-extra-3',
                    roomId: 'entrance-hall',
                    source: 'extra-player-choice',
                }),
            ],
        });
        expect(resolveBetrayalHauntSetupProgress(core)).toMatchObject({
            hauntCardNumber: 5,
            manualCheckEntryIds: ['monster-card-left-of-revealer'],
        });
    });

it('灰尘剧本寻找解药成功会在当前恶兆板块放置研究标记', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        setTestExplorerTraits(core, '1', { knowledge: 3 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.scenarioRuntime.dust?.researchRoomIds).toContain('ground-north');
        expect(core.usedCardIdsThisTurn).toContain('search-for-cure');
        expect(core.recentRoll?.latestLabel).toBe('放置研究标记');
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            dice: [2, 2, 2],
            passiveBonus: 0,
        });
        expect(core.recommendedAction).toBe('endTurn');
    });

it('灰尘剧本寻找解药失败会跳过死亡玩家并与左侧存活玩家随机交换疾病标记', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        setTestExplorerTraits(core, '1', { knowledge: 3 });
        const researchRoomIdsBefore = [...core.scenarioRuntime.dust!.researchRoomIds];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.dust?.researchRoomIds).toEqual(researchRoomIdsBefore);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '交换疾病标记',
            dice: [0, 0, 0],
        });
        expect(core.activityLog[0]?.text).toContain('与左侧玩家随机交换了疾病标记');
        expect(core.usedCardIdsThisTurn).toContain('search-for-cure');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([7, 8, 9]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([1, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([12, 13, 14]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['3']?.map((token) => token.value)).toEqual([4, 10, 11]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('3');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
    });

it('灰尘剧本寻找解药失败后若所有存活者都永久感染则叛徒胜利', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        setTestExplorerTraits(core, '1', { knowledge: 3 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
        });
        expect(core.endgameResult?.winners.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '交换疾病标记',
            dice: [0, 0, 0],
        });
    });

it('灰尘剧本治愈灰尘成功会进入英雄胜利终局', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['1', '2']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
            dice: [2, 2, 2, 2, 2],
            passiveBonus: 4,
        });
    });

it('灰尘剧本治愈灰尘可选择任意属性并按多个研究标记加值', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway', 'entrance-hall'];
        setTestExplorerTraits(core, '1', {
            might: 6,
            speed: 4,
            knowledge: 2,
            sanity: 2,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
            trait: 'speed',
            rollLabel: '速度检定',
            dice: [2, 2, 2, 2],
            passiveBonus: 6,
        });
    });

it.each([
        { card: { id: 'omen-book', name: '书本', kind: 'omen' as const }, trait: 'knowledge' as const },
        { card: { id: 'skull', name: '头骨', kind: 'omen' as const }, trait: 'knowledge' as const },
        { card: { id: 'dog', name: '狗', kind: 'omen' as const }, trait: 'speed' as const },
        { card: { id: 'mask', name: '面具', kind: 'omen' as const }, trait: 'speed' as const },
        { card: { id: 'holy-symbol', name: '圣符', kind: 'omen' as const }, trait: 'sanity' as const },
        { card: { id: 'ring', name: '指环', kind: 'omen' as const }, trait: 'sanity' as const },
        { card: { id: 'idol', name: '雕像', kind: 'omen' as const }, trait: 'might' as const },
    ] as const)('灰尘治愈灰尘会计算$card.name的被动检定加值并叠加研究标记', ({ card, trait }) => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        activateTestExplorer(core, '1');
        core = placeCurrentExplorerInDustResearchRoom(core, 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway', 'entrance-hall'];
        setTestExplorerTraits(core, '1', { [trait]: 4 } as Partial<Record<BetrayalTraitKey, number>>);
        setTestExplorerInventory(core, '1', [card]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
            trait,
            dice: [2, 2, 2, 2],
            passiveBonus: 7,
        });
    });

it('灰尘寻找解药会消费书本的下一次非战斗检定替换', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        activateTestExplorer(core, '1');
        core = placeCurrentExplorerInDustResearchRoom(core, 'omen');
        setTestExplorerTraits(core, '1', {
            knowledge: 5,
            sanity: 2,
        });
        setTestExplorerInventory(core, '1', [{ id: 'omen-book', name: '书本', kind: 'omen' }]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'omen-book' });

        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '1',
            sourceCardId: 'omen-book',
            replacementTrait: 'knowledge',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'sanity' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '放置研究标记',
            trait: 'sanity',
            dice: [2, 2, 2, 2, 2],
            passiveBonus: 0,
        });
        expect(core.nextNonCombatTraitReplacement).toBeNull();
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['omen-book', 'search-for-cure']));
    });

it('灰尘寻找解药的知识检定会使用魔法相机改看更高的神志', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        activateTestExplorer(core, '1');
        core = placeCurrentExplorerInDustResearchRoom(core, 'omen');
        setTestExplorerTraits(core, '1', {
            knowledge: 1,
            sanity: 5,
        });
        setTestExplorerInventory(core, '1', [{ id: 'camera', name: '魔法相机', kind: 'item' }]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.recentRoll).toMatchObject({
            sourceTitle: '寻找解药',
            latestLabel: '放置研究标记',
            trait: 'knowledge',
            dice: [2, 2, 2, 2, 2],
            passiveBonus: 0,
        });
        expect(core.scenarioRuntime.dust?.researchRoomIds).toContain('ground-north');
    });

it('灰尘阶段继续探索事件时，手电筒和灯笼仍只给事件属性检定额外骰', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        setTestTraitTrack(core, '1', 'knowledge', [1, 2, 3, 4], 1, 1);
        setTestExplorerInventory(core, '1', [
            { id: 'flashlight', name: '手电筒', kind: 'item' },
            { id: 'lantern', name: '灯笼', kind: 'item' },
        ]);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '灰尘中的灯光',
            roll: {
                trait: 'knowledge',
                branches: [
                    { min: 10, label: '照亮灰尘，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                    { min: 0, label: '看不清灰尘，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                ],
            },
        }];
        core.deckCounts.event = core.eventOrder.length;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '灰尘中的灯光',
        });
        expect(core.latestDiscovery?.detail).toContain('知识检定 12');
        expect(core.recentRoll).toMatchObject({
            kind: 'eventTraitCheck',
            sourceTitle: '灰尘中的灯光',
            trait: 'knowledge',
            dice: [2, 2, 2, 2, 2, 2],
            passiveBonus: 0,
        });

        const flashlightUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'flashlight' }),
        );
        const lanternUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'lantern' }),
        );
        expect(flashlightUse.valid).toBe(false);
        expect(lanternUse.valid).toBe(false);
    });

it('灰尘阶段的物理和精神伤害仍会先应用盔甲与头戴耳机减伤', () => {
        let armorCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(armorCore, '1', 'ground-north');
        setDiscoveredTestRoom(armorCore, 'ground-north', {
            name: '火炉房',
            hint: '在此结束回合会受到房间伤害。',
            tags: ['伤害'],
            discoveryReward: null,
            visualId: 'furnaceRoom',
            endTurnEffect: 'physicalDamage1',
        });
        setTestExplorerInventory(armorCore, '1', [{ id: 'armor', name: '盔甲', kind: 'omen' }]);
        armorCore.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        armorCore.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = ['1'];
        setTestTraitTrack(armorCore, '1', 'might', [1], 0, 0);
        setTestTraitTrack(armorCore, '1', 'speed', [1], 0, 0);

        armorCore = applyBetrayalCommand(armorCore, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(armorCore.pendingDamageAllocation).toBeNull();
        expect(armorCore.currentPlayer).toBe('2');
        expect(armorCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(armorCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        let radioCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(radioCore, '1', 'entrance-hall');
        setScenarioTestTurnMovement(radioCore, 6);
        setTestTraitTrack(radioCore, '1', 'knowledge', [1], 0, 0);
        setTestTraitTrack(radioCore, '1', 'sanity', [1], 0, 0);
        setTestExplorerInventory(radioCore, '1', [{ id: 'radio', name: '头戴耳机', kind: 'item' }]);
        radioCore.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        radioCore.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(radioCore, 'event');
        radioCore.eventOrder = [{
            name: '灰尘噪音',
            effect: { mode: 'rolledDamage', damageKind: 'mental', dice: 1, recommendedAction: 'endTurn' },
        }];
        radioCore.deckCounts.event = radioCore.eventOrder.length;
        const targetRoomId = resolveExplorableRoomSlots(radioCore)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        radioCore = applyBetrayalCommand(
            radioCore,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: targetRoomId! },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(radioCore.latestDiscovery).toMatchObject({
            kind: 'event',
            title: '灰尘噪音',
        });
        expect(findTestExplorer(radioCore, '1').traits).toMatchObject({
            knowledge: 1,
            sanity: 1,
        });
        expect(radioCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(radioCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
    });

it('灰尘永久感染但仍存活的探索者可以用狗请求交易，狂热病患禁用另有怪物回合守卫', () => {
        let core = createDustHauntCore(['0', '1', '2']);
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'upper-landing', inventory: [] }
                : explorer
        ));
        setTestExplorerInventory(core, '1', [
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'medical-kit', name: '急救包', kind: 'item' },
        ]);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];

        const dogTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                useDog: true,
                targetPlayerId: '0',
                cardIds: ['medical-kit'],
            }),
        );
        expect(dogTrade.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
            useDog: true,
            targetPlayerId: '0',
            cardIds: ['medical-kit'],
        });
        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '1',
            targetPlayerId: '0',
            cardIds: ['medical-kit'],
            useDog: true,
            sourceCardId: 'dog',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '0', { accept: true });

        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['dog']);
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit']);
        expect(core.usedCardIdsThisTurn).toContain('dog');
        expect(core.tradeUsedThisTurnPlayerIds).toContain('1');
    });

it('灰尘阶段继续探索时圣符仍可埋葬第一张板块并继续发现下一张', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-landing');
        setScenarioTestTurnMovement(core, 6);
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
        setTestExplorerInventory(core, '1', [{ id: 'holy-symbol', name: '圣符', kind: 'omen' }]);
        const speedBeforeExplore = core.currentExplorer.traits.speed;

        const holySymbolExplore = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(holySymbolExplore.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '1',
            { roomId: 'upper-north', useHolySymbol: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.rooms.find((room) => room.id === 'upper-north')?.visualId).toBe('gymnasium');
        expect(core.latestDiscovery?.kind).toBe('none');
        expect(core.latestDiscovery?.title).toBe('体育馆');
        expect(core.currentExplorer.traits.speed).toBe(speedBeforeExplore);
        expect(core.activityLog[0]?.text).toContain('圣符埋葬倒塌房间');
        expect(core.activityLog[0]?.text).toContain('继续发现体育馆');
    });

it('灰尘阶段继续探索事件符号时雕像仍可跳过事件且不结算事件效果', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setScenarioTestTurnMovement(core, 6);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        setTestExplorerInventory(core, '1', [{ id: 'idol', name: '雕像', kind: 'omen' }]);
        const mightBefore = core.currentExplorer.traits.might;
        const targetRoomId = resolveExplorableRoomSlots(core)[0]?.id;
        expect(targetRoomId).toBeTruthy();

        const idolExplore = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: targetRoomId, useIdol: true }),
        );
        expect(idolExplore.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', { roomId: targetRoomId!, useIdol: true });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('已用雕像跳过');
        expect(core.latestDiscovery?.detail).toContain('没有抽取或结算事件卡');
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.activityLog[0]?.text).toContain('使用雕像跳过了事件：阴影扑面');
    });

it('灰尘阶段骨制钥匙仍可穿墙移动到已发现相邻板块，但不能发现新房间', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'upper-landing');
        setScenarioTestTurnMovement(core, 2);
        setTestExplorerInventory(core, '1', [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }]);
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        const normalMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'upper-west' }),
        );
        const undiscoveredMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', {
                roomId: 'upper-north',
                useSkeletonKey: true,
            }),
        );
        expect(normalMove.valid).toBe(false);
        expect(undiscoveredMove.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '1',
            { roomId: 'upper-west', useSkeletonKey: true },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(1);
        expect(core.currentExplorer.inventory).toEqual([{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }]);
        expect(core.activityLog[0]?.text).toContain('使用骨制钥匙穿过墙壁');
    });

it('灰尘阶段主动治疗类持有牌仍按回合开始限制埋葬并治疗', () => {
        let holyWaterCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(holyWaterCore, '1', 'entrance-hall');
        setTestExplorerInventory(holyWaterCore, '1', [{ id: 'holy-water', name: '奇怪的药品', kind: 'item' }]);
        setTestTraitTrack(holyWaterCore, '1', 'might', [1, 2, 3, 4, 5], 1, 3);
        setTestTraitTrack(holyWaterCore, '1', 'speed', [1, 1, 2, 3, 4], 1, 3);

        holyWaterCore = applyBetrayalCommand(holyWaterCore, BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'holy-water' });

        expect(holyWaterCore.currentExplorer.traits.might).toBe(4);
        expect(holyWaterCore.currentExplorer.traits.speed).toBe(3);
        expect(holyWaterCore.currentExplorer.inventory).toEqual([]);
        expect(holyWaterCore.usedCardIdsThisTurn).toContain('holy-water');
        expect(holyWaterCore.activityLog[0]?.text).toContain('埋葬奇怪的药品');

        let medicalKitCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(medicalKitCore, '1', 'hallway');
        setTestExplorerInventory(medicalKitCore, '1', [{ id: 'medical-kit', name: '急救包', kind: 'item' }]);
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(medicalKitCore, '1', trait, [1, 2, 3, 4], 0, 2);
        }

        medicalKitCore = applyBetrayalCommand(medicalKitCore, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId: 'medical-kit',
            targetPlayerId: '1',
        });

        expect(medicalKitCore.currentExplorer.traits).toMatchObject({
            might: 3,
            speed: 3,
            knowledge: 3,
            sanity: 3,
        });
        expect(medicalKitCore.currentExplorer.inventory).toEqual([]);
        expect(medicalKitCore.usedCardIdsThisTurn).toContain('medical-kit');
        expect(medicalKitCore.activityLog[0]?.text).toContain('埋葬急救包');

        const newlyGainedCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(newlyGainedCore, '1', 'hallway');
        setTestExplorerInventory(newlyGainedCore, '1', [{ id: 'medical-kit', name: '急救包', kind: 'item' }], false);

        const newlyGainedValidation = BetrayalDomain.validate(
            { core: newlyGainedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'medical-kit', targetPlayerId: '1' }),
        );
        expect(newlyGainedValidation.valid).toBe(false);
        if (!newlyGainedValidation.valid) {
            expect(newlyGainedValidation.error).toContain('本回合新获得的持有物不能立刻使用');
        }
    });

it('灰尘阶段主动持有牌不能把死亡探索者当治疗或面具目标', () => {
        const medicalKitCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(medicalKitCore, '1', 'hallway');
        setTestExplorerInventory(medicalKitCore, '1', [{ id: 'medical-kit', name: '急救包', kind: 'item' }]);
        medicalKitCore.otherExplorers = medicalKitCore.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        medicalKitCore.scenarioRuntime.deadExplorerPlayerIds = ['0'];

        const healDeadTarget = BetrayalDomain.validate(
            { core: medicalKitCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'medical-kit',
                targetPlayerId: '0',
            }),
        );
        expect(healDeadTarget.valid).toBe(false);
        if (!healDeadTarget.valid) {
            expect(healDeadTarget.error).toContain('急救包只能治疗自己或同板块的另一位探索者');
        }

        const maskCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(maskCore, '1', 'hallway');
        setTestExplorerInventory(maskCore, '1', [{ id: 'mask', name: '面具', kind: 'omen' }]);
        maskCore.otherExplorers = maskCore.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : { ...explorer, roomId: 'upper-landing' }
        ));
        maskCore.scenarioRuntime.deadExplorerPlayerIds = ['0'];

        const moveDeadTarget = BetrayalDomain.validate(
            { core: maskCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomIdsByTokenId: { '0': 'entrance-hall' },
            }),
        );
        expect(moveDeadTarget.valid).toBe(false);
        if (!moveDeadTarget.valid) {
            expect(moveDeadTarget.error).toContain('当前板块没有可被面具移动的其他角色或怪物');
        }
    });

it('灰尘阶段面具有多个同房目标时必须逐个指定已发现相邻方向', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'hallway');
        setTestExplorerInventory(core, '1', [{ id: 'mask', name: '面具', kind: 'omen' }]);
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0' || explorer.playerId === '2'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.monsters = [{
            id: 'feverish-patient-1',
            name: '狂热病患',
            portraitAsset: 'betrayal/monsters/feverish-patient',
            tokenAsset: 'betrayal/tokens/monsters/feverish-patient',
            roomId: 'hallway',
            might: 4,
            speed: 5,
            damage: 1,
        }];

        const missingTargetDirection = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomIdsByTokenId: {
                    '0': 'entrance-hall',
                    'feverish-patient-1': 'grand-staircase',
                },
            }),
        );
        expect(missingTargetDirection.valid).toBe(false);
        if (!missingTargetDirection.valid) {
            expect(missingTargetDirection.error).toContain('面具只能把同板块其他角色移动到已发现的相邻板块');
        }

        const extraTargetDirection = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomIdsByTokenId: {
                    '0': 'entrance-hall',
                    '2': 'grand-staircase',
                    'ghost-target': 'entrance-hall',
                    'feverish-patient-1': 'entrance-hall',
                },
            }),
        );
        expect(extraTargetDirection.valid).toBe(false);
        if (!extraTargetDirection.valid) {
            expect(extraTargetDirection.error).toContain('面具只能把同板块其他角色移动到已发现的相邻板块');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId: 'mask',
            targetRoomIdsByTokenId: {
                '0': 'entrance-hall',
                '2': 'grand-staircase',
                'feverish-patient-1': 'entrance-hall',
            },
        });

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('entrance-hall');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.roomId).toBe('grand-staircase');
        expect(core.monsters.find((monster) => monster.id === 'feverish-patient-1')?.roomId).toBe('entrance-hall');
        expect(core.currentExplorer.inventory).toEqual([{ id: 'mask', name: '面具', kind: 'omen' }]);
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');
    });

it.each([
        ['medical-kit', '急救包', 'item'],
        ['mirror', '镜子', 'item'],
        ['holy-water', '奇怪的药品', 'item'],
        ['map', '地图', 'item'],
        ['notebook', '笔记本', 'item'],
        ['manuscript', '手稿', 'item'],
        ['omen-book', '书本', 'omen'],
        ['mask', '面具', 'omen'],
        ['journal', '日记', 'item'],
    ] as const)('灰尘阶段主动持有牌「%s」沿用回合开始和已用限制', (cardId, cardName, kind) => {
        const availableCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(availableCore, '1', 'hallway');
        setTestExplorerInventory(availableCore, '1', [{ id: cardId, name: cardName, kind }]);

        expect(resolveBetrayalPossessionSpecialActionStatus(availableCore, cardId)).toMatchObject({
            active: true,
            canUse: true,
            usedThisTurn: false,
            availableAtTurnStart: true,
            receivedThisTurn: false,
            reason: null,
        });

        const newlyGainedCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(newlyGainedCore, '1', 'hallway');
        setTestExplorerInventory(newlyGainedCore, '1', [{ id: cardId, name: cardName, kind }], false);
        newlyGainedCore.turnStartInventoryCardIds = newlyGainedCore.turnStartInventoryCardIds.filter((id) => id !== cardId);

        expect(resolveBetrayalPossessionSpecialActionStatus(newlyGainedCore, cardId)).toMatchObject({
            active: true,
            canUse: false,
            availableAtTurnStart: false,
            reason: '本回合新获得的持有物不能立刻使用。',
        });

        const usedCore = createDustHauntCore();
        placeActiveTestExplorerInRoom(usedCore, '1', 'hallway');
        setTestExplorerInventory(usedCore, '1', [{ id: cardId, name: cardName, kind }]);
        usedCore.usedCardIdsThisTurn = [cardId];

        expect(resolveBetrayalPossessionSpecialActionStatus(usedCore, cardId)).toMatchObject({
            active: true,
            canUse: false,
            usedThisTurn: true,
            reason: '该持有物本回合已经使用。',
        });
    });

it.each([
        ['map', '地图'],
        ['notebook', '笔记本'],
        ['journal', '日记'],
        ['manuscript', '手稿'],
    ] as const)('灰尘阶段%s仍可埋葬并把探索者放置到已发现板块', (cardId, cardName) => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'entrance-hall');
        setTestExplorerInventory(core, '1', [{ id: cardId, name: cardName, kind: 'item' }]);

        const undiscoveredTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId,
                targetRoomId: 'upper-north',
            }),
        );
        expect(undiscoveredTarget.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId,
            targetRoomId: 'upper-landing',
        });

        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain(cardId);
        expect(core.activityLog[0]?.text).toContain(`埋葬${cardName}`);
    });

it('灰尘阶段面具仍可移动同房目标到已发现相邻板块且不能发现新房间', () => {
        let core = createDustHauntCore();
        placeActiveTestExplorerInRoom(core, '1', 'hallway');
        setTestExplorerInventory(core, '1', [{ id: 'mask', name: '面具', kind: 'omen' }]);
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : { ...explorer, roomId: 'upper-landing' }
        ));

        const undiscoveredTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'mask',
                targetRoomId: 'upper-north',
            }),
        );
        expect(undiscoveredTarget.valid).toBe(false);
        if (!undiscoveredTarget.valid) {
            expect(undiscoveredTarget.error).toContain('已发现的相邻板块');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
            cardId: 'mask',
            targetRoomId: 'entrance-hall',
        });

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('entrance-hall');
        expect(core.currentExplorer.inventory).toEqual([{ id: 'mask', name: '面具', kind: 'omen' }]);
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');
    });
});
