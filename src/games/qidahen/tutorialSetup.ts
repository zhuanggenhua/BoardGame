import type { GameSetupSelections } from '../setupOptions';
import { applyQidahenPregameChoiceDefaults } from './roomSetup';
import { buildWheelDispatchSelectionFromWheel } from './domain/dispatchSelectionBuilders';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenScenarioId,
    QidahenSpecialTroopStack,
} from './domain/types';

type QidahenTutorialSetupData = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    setupData: Record<string, unknown>;
};

type QidahenTutorialCoreTransform = (core: QidahenCore) => QidahenCore;

type QidahenTutorialPreset = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    coreTransform?: QidahenTutorialCoreTransform;
};

const cloneCore = (core: QidahenCore): QidahenCore => structuredClone(core);

const updateRegions = (
    core: QidahenCore,
    updater: (region: QidahenCore['regions'][number]) => QidahenCore['regions'][number],
): QidahenCore['regions'] => core.regions.map((region) => updater(region));

const createTroop = (
    id: string,
    label: string,
    faction: QidahenFactionId,
    troopKind: 'infantry' | 'cavalry' | 'artillery',
    count: number,
    level: number,
): QidahenSpecialTroopStack => ({
    id,
    label,
    faction,
    troopKind,
    count,
    level,
});

const createFieldBattlePendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'field',
    title: '调度进攻待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-16',
    sourceRegionName: '克什克腾部',
    targetRegionId: 'city-region-14',
    targetRegionName: '察哈尔部',
    targetRuntimeRegionId: 'city-region-14',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '教程样本',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 5,
    committedTroops: 5,
    attackPressure: 3,
    attackBoundaryType: 'plain',
    resolutionHint: '先决定承伤顺序，再结算这场野战。',
    defenderPayCost: null,
});
void createFieldBattlePendingAction;

const createSiegePendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'city',
    title: '山海关 城战待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-24',
    sourceRegionName: '辽西',
    targetRegionId: 'city-region-25',
    targetRegionName: '山海关',
    targetRuntimeRegionId: 'city-region-25',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '教程样本 · 守城避战后直接攻城',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 4,
    committedTroops: 4,
    attackPressure: 3,
    attackBoundaryType: 'plain',
    resolutionHint: '山海关守军已退入城中，先结算这次城战，再决定是占领还是围城。',
    defenderPayCost: null,
});

const createDefaultSelections = (scenarioId: QidahenScenarioId): GameSetupSelections => applyQidahenPregameChoiceDefaults({
    scenario: scenarioId,
});

const createBasicTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        const mingCardIds = core.handCards
            .filter((card) => card.faction === 'ming')
            .slice(0, 4)
            .map((card) => card.id);

        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
        core.handCards = core.handCards.map((card) => {
            if (card.id === mingCardIds[0]) {
                return {
                    ...card,
                    label: '大明事件牌',
                    cardKind: 'event' as const,
                    cardDefId: 'tutorial-ming-event',
                };
            }
            if (card.id === mingCardIds[1]) {
                return {
                    ...card,
                    label: '火炮技术',
                    cardKind: 'armament' as const,
                    armamentId: 'artillery-tech',
                    cardDefId: 'tutorial-ming-artillery-tech',
                };
            }
            if (card.id === mingCardIds[2]) {
                return {
                    ...card,
                    label: '大明战术牌',
                    cardKind: 'tactic' as const,
                    cardDefId: 'tutorial-ming-tactic',
                };
            }
            if (card.id === mingCardIds[3]) {
                return {
                    ...card,
                    label: '银两牌',
                    cardKind: 'silver' as const,
                    cardDefId: 'tutorial-ming-silver',
                };
            }
            return card;
        });
        return core;
    },
});

const createAttackAndBattleTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 进攻调度';
        core.turnPhase = 'dispatch-targeting';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-16';
        core.selectedActionId = '';
        core.pendingTargetAction = null;
        core.driveTigerConsentSelection = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
            ...character,
            inPlay: false,
        }));
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 2,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-elite-cavalry-lv4', '大明精锐骑兵', 'ming', 'cavalry', 2, 4),
                        createTroop('ming-line-infantry-lv3', '大明步兵', 'ming', 'infantry', 3, 3),
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    siegeState: null,
                    specialTroops: [
                        createTroop('jin-infantry-lv1', '后金步兵', 'jin', 'infantry', 1, 1),
                    ],
                };
            }
            return region;
        });
        core.wheelDispatchProgress = buildWheelDispatchSelectionFromWheel(
            core,
            'ming',
            core.actionWheelPosition,
            core.selectedRegionId,
        );
        return core;
    },
});

const createSiegeTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 城战待结算';
        core.turnPhase = 'resolve-pending';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.pendingTargetAction = createSiegePendingAction();
        core.wheelDispatchSelection = null;
        core.driveTigerConsentSelection = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 6,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    siegeState: null,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });
        return core;
    },
});

const createRetreatAndRoutTutorialPendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'field',
    title: '突袭作战待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-16',
    sourceRegionName: '克什克腾部',
    targetRegionId: 'city-region-14',
    targetRegionName: '察哈尔部',
    targetRuntimeRegionId: 'city-region-14',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '教程样本 · 战败撤退',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 5,
    committedTroops: 5,
    attackPressure: 1,
    attackBoundaryType: 'plain',
    resolutionHint: '这次不会打穿守军。先看断后和溃退这两个撤退选项，再比较它们留下的代价。',
    defenderPayCost: null,
});

const createRetreatAndRoutTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 野战待结算';
        core.turnPhase = 'resolve-pending';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-attack';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.pendingTargetAction = createRetreatAndRoutTutorialPendingAction();
        core.wheelDispatchProgress = null;
        core.driveTigerConsentSelection = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 2,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        core.factions.ming.defeatMarkers = 0;
        core.factions.jin.defeatMarkers = 0;
        return core;
    },
});

const createWheelSharedCostTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 轮盘推进';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-military-farm';
        core.selectedWheelMoveId = 'move-3-all-opponents';
        core.selectedRegionId = 'city-region-24';
        core.selectedActionId = '';
        core.selectedPaymentCardIds = [];
        core.recruitSelection = null;
        core.maShiTradeSelection = null;
        core.khanEdictSelection = null;
        core.diplomacyProgress = null;
        core.handLimitDiscardSelection = null;
        core.sunYuanhuaTechSelection = null;
        core.gaoDiDispatchSelection = null;
        core.wheelDispatchProgress = null;
        core.pendingTargetAction = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 6,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-wheel-cavalry-lv1', '大明骑兵', 'ming', 'cavalry', 2, 1),
                    ],
                };
            }
            return region;
        });
        return core;
    },
});

const createDiplomacyTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 轮盘推进';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'song-jin';
        core.selectedActionId = '';
        core.selectedPaymentCardIds = [];
        core.recruitSelection = null;
        core.maShiTradeSelection = null;
        core.khanEdictSelection = null;
        core.diplomacyProgress = null;
        core.handLimitDiscardSelection = null;
        core.sunYuanhuaTechSelection = null;
        core.gaoDiDispatchSelection = null;
        core.wheelDispatchProgress = null;
        core.pendingTargetAction = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 2,
                    siegeState: null,
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'vassal',
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 2,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        return core;
    },
});

const createYearAndCharactersTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '1';
        core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-2-one-opponent';
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'khan-edict';
        core.selectedPaymentCardIds = [];
        core.recruitSelection = null;
        core.maShiTradeSelection = null;
        core.khanEdictSelection = null;
        core.diplomacyProgress = null;
        core.handLimitDiscardSelection = null;
        core.sunYuanhuaTechSelection = null;
        core.gaoDiDispatchSelection = null;
        core.wheelDispatchProgress = null;
        core.pendingTargetAction = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.factions.ming.defeatMarkers = 1;
        core.factions.mongol.defeatMarkers = 1;
        core.factions.jin.defeatMarkers = 1;
        core.factions.ming.characters = core.factions.ming.characters.map((character) => ({
            ...character,
            inPlay: character.id === 'ming-mao-wenlong',
        }));
        core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
        core.actionChoices = [
            { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
            { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
            { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
            { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
        ];
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-25') {
                return { ...region, controller: 'mongol', controlLabel: '蒙古', troops: 2 };
            }
            if (region.id === 'city-region-24') {
                return { ...region, controller: 'ming', controlLabel: '大明', troops: 1 };
            }
            return region;
        });
        return core;
    },
});

const createKoreaSpecialMapTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('shanhaiguan-1622'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 朝鲜与地图特例';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-attack';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = '';
        core.selectedPaymentCardIds = [];
        core.recruitSelection = null;
        core.maShiTradeSelection = null;
        core.khanEdictSelection = null;
        core.diplomacyProgress = null;
        core.handLimitDiscardSelection = null;
        core.sunYuanhuaTechSelection = null;
        core.gaoDiDispatchSelection = null;
        core.wheelDispatchProgress = null;
        core.pendingTargetAction = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.koreaDeckCount = 9;
        core.koreaDiscardCount = 3;
        core.factions.ming.prestige = 1;
        core.hanseongPrestigeUnlocked = true;
        return core;
    },
});

const TUTORIAL_PRESETS: Record<string, QidahenTutorialPreset> = {
    'qidahen-basic': createBasicTutorialSetup(),
    'basic-opening': createBasicTutorialSetup(),
    'attack-and-battle': createAttackAndBattleTutorialSetup(),
    'retreat-and-rout': createRetreatAndRoutTutorialSetup(),
    'wheel-shared-cost': createWheelSharedCostTutorialSetup(),
    'diplomacy-and-hire': createDiplomacyTutorialSetup(),
    'siege-and-occupation': createSiegeTutorialSetup(),
    'year-and-characters': createYearAndCharactersTutorialSetup(),
    'korea-and-special-map-rules': createKoreaSpecialMapTutorialSetup(),
    'field-battle': createAttackAndBattleTutorialSetup(),
    'season-flow': createYearAndCharactersTutorialSetup(),
};

export function buildQidahenTutorialSetupData(tutorialId?: string): QidahenTutorialSetupData | null {
    if (!tutorialId) {
        return null;
    }
    const preset = TUTORIAL_PRESETS[tutorialId];
    if (!preset) {
        return null;
    }

    const setupData: Record<string, unknown> = {
        setupSelections: preset.setupSelections,
        ...preset.setupSelections,
    };

    if (preset.coreTransform) {
        setupData.qidahenTutorialCoreTransform = preset.coreTransform;
    }

    return {
        numPlayers: preset.numPlayers,
        setupSelections: preset.setupSelections,
        setupData,
    };
}
