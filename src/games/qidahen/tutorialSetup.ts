import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import { applyQidahenPregameChoiceDefaults } from './roomSetup';
import { qidahenAtlas05OrdinaryHandPreview } from './ui/cardAtlas';
import {
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES,
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID,
    type QidahenAtlas05OrdinaryHandCardIdentity,
} from './domain/ordinaryHandCardIdentities';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenHandCard,
    QidahenPendingTargetAction,
    QidahenScenarioId,
    QidahenSpecialTroopStack,
} from './domain/types';
import { getFactionIdByPlayerId } from './domain/factionTurnAccessors';

type QidahenTutorialSetupData = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    setupData: Record<string, unknown>;
};

type QidahenTutorialCoreTransform = (core: QidahenCore) => QidahenCore;

export type QidahenTutorialEntryKind =
    | 'natural-opening'
    | 'action-window-exercise'
    | 'dispatch-exercise'
    | 'resolution-exercise'
    | 'season-resolution-exercise';

export type QidahenTutorialFirstDecision =
    | 'check-hand-limit'
    | 'choose-wheel-move'
    | 'choose-hand-action'
    | 'choose-dispatch-target'
    | 'resolve-pending-battle'
    | 'resolve-season';

export type QidahenTutorialRuleAtom =
    | 'setup-complete'
    | 'hand-limit'
    | 'wheel-action'
    | 'hand-action'
    | 'action-order-choice'
    | 'payment'
    | 'target-choice'
    | 'battle-resolution'
    | 'post-battle-resolution'
    | 'season-resolution'
    | 'special-map-rule';

export type QidahenTutorialSetupContract = {
    entryKind: QidahenTutorialEntryKind;
    startingPoint: 'formal-opening' | 'representative-state';
    formalEntryPhase: QidahenCore['turnPhase'];
    currentActorFaction: QidahenFactionId;
    precedingAtoms: readonly QidahenTutorialRuleAtom[];
    firstRealDecision: QidahenTutorialFirstDecision;
    injectedDifferences: readonly string[];
    scope: 'mainline' | 'supplement';
    continuationOf?: string;
};

type QidahenTutorialPreset = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    contract?: QidahenTutorialSetupContract;
    coreTransform?: QidahenTutorialCoreTransform;
};

const NATURAL_OPENING_CONTRACT: QidahenTutorialSetupContract = {
    entryKind: 'natural-opening',
    startingPoint: 'formal-opening',
    formalEntryPhase: 'action-window',
    currentActorFaction: 'ming',
    precedingAtoms: ['setup-complete'],
    firstRealDecision: 'choose-wheel-move',
    injectedDifferences: ['固定免费前进 1 格作为可重复的教学示例，不改变正式规则顺序。'],
    scope: 'mainline',
};

const actionWindowContract = ({
    currentActorFaction,
    firstRealDecision = 'choose-hand-action',
    precedingAtoms,
    injectedDifferences = [],
}: {
    currentActorFaction: QidahenFactionId;
    firstRealDecision?: QidahenTutorialFirstDecision;
    precedingAtoms: readonly QidahenTutorialRuleAtom[];
    injectedDifferences?: readonly string[];
}): QidahenTutorialSetupContract => ({
    entryKind: 'action-window-exercise',
    startingPoint: 'representative-state',
    formalEntryPhase: 'action-window',
    currentActorFaction,
    precedingAtoms,
    firstRealDecision,
    injectedDifferences,
    scope: 'supplement',
});

const dispatchContract = (
    injectedDifferences: readonly string[] = [],
): QidahenTutorialSetupContract => ({
    entryKind: 'dispatch-exercise',
    startingPoint: 'representative-state',
    formalEntryPhase: 'dispatch-targeting',
    currentActorFaction: 'ming',
    precedingAtoms: ['setup-complete', 'hand-limit', 'wheel-action', 'hand-action', 'payment'],
    firstRealDecision: 'choose-dispatch-target',
    injectedDifferences,
    scope: 'supplement',
});

const resolutionContract = (
    injectedDifferences: readonly string[] = [],
    continuationOf?: string,
): QidahenTutorialSetupContract => ({
    entryKind: 'resolution-exercise',
    startingPoint: 'representative-state',
    formalEntryPhase: 'resolve-pending',
    currentActorFaction: 'ming',
    precedingAtoms: ['setup-complete', 'hand-limit', 'wheel-action', 'hand-action', 'payment', 'target-choice'],
    firstRealDecision: 'resolve-pending-battle',
    injectedDifferences,
    scope: continuationOf ? 'mainline' : 'supplement',
    continuationOf,
});

const seasonResolutionContract = (
    injectedDifferences: readonly string[] = [],
): QidahenTutorialSetupContract => ({
    entryKind: 'season-resolution-exercise',
    startingPoint: 'representative-state',
    formalEntryPhase: 'season-resolution',
    currentActorFaction: 'ming',
    precedingAtoms: ['setup-complete', 'hand-limit', 'wheel-action', 'hand-action', 'season-resolution'],
    firstRealDecision: 'resolve-season',
    injectedDifferences,
    scope: 'supplement',
});

const withContract = (
    preset: QidahenTutorialPreset,
    contract: QidahenTutorialSetupContract,
): QidahenTutorialPreset => ({ ...preset, contract });

const resetTutorialTransientState = (core: QidahenCore): QidahenCore => ({
    ...core,
    selectedActionId: '',
    confirmedActionId: null,
    selectedPaymentCardIds: [],
    lastSeasonSummary: null,
    pendingTargetAction: null,
    postBattleSelection: null,
    wheelDispatchProgress: null,
    recruitSelection: null,
    maShiTradeSelection: null,
    khanEdictSelection: null,
    diplomacyProgress: null,
    handLimitDiscardSelection: null,
    sunYuanhuaTechSelection: null,
    gaoDiDispatchSelection: null,
});

const createFormalOpeningCore = (initialCore: QidahenCore): QidahenCore => {
    const core = resetTutorialTransientState(cloneCore(initialCore));
    core.currentPlayer = '0';
    core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
    core.turnPhase = 'action-window';
    core.wheelActionUsed = false;
    core.factionActionUsed = false;
    core.selectedWheelMoveId = 'move-1-free';
    core.selectedRegionId = 'city-region-24';
    return core;
};

const validateTutorialSetupContract = (
    contract: QidahenTutorialSetupContract,
    core: QidahenCore,
): void => {
    const errors: string[] = [];
    if (core.turnPhase !== contract.formalEntryPhase) {
        errors.push(`阶段 ${core.turnPhase} != ${contract.formalEntryPhase}`);
    }
    const currentActorFaction = getFactionIdByPlayerId(core, core.currentPlayer);
    if (currentActorFaction !== contract.currentActorFaction) {
        errors.push(`当前行动人 ${currentActorFaction} != ${contract.currentActorFaction}`);
    }
    switch (contract.firstRealDecision) {
        case 'choose-wheel-move':
            if (core.wheelActionUsed) errors.push('首个真实决策是轮盘时，轮盘不得已用');
            break;
        case 'choose-hand-action':
            if (core.factionActionUsed) errors.push('首个真实决策是手牌行动时，势力行动不得已用');
            break;
        case 'choose-dispatch-target':
            if (core.turnPhase !== 'dispatch-targeting') errors.push('首个真实决策是调度目标时，阶段必须是 dispatch-targeting');
            break;
        case 'resolve-pending-battle':
            if (core.pendingTargetAction == null) errors.push('首个真实决策是待结算战斗时，必须存在待结算动作');
            break;
        case 'resolve-season':
            if (core.turnPhase !== 'season-resolution') errors.push('首个真实决策是季节结算时，阶段必须是 season-resolution');
            break;
        case 'check-hand-limit':
            if (core.handLimitDiscardSelection == null && core.factions[contract.currentActorFaction].handCount > core.factions[contract.currentActorFaction].handLimit) {
                errors.push('首个真实决策是手牌上限检查时，超过上限却没有弃牌选择');
            }
            break;
        default:
            break;
    }
    if (contract.entryKind === 'natural-opening') {
        if (core.wheelActionUsed || core.factionActionUsed) errors.push('自然开局不得预消耗行动');
        if (core.pendingTargetAction != null) errors.push('自然开局不得预置待结算战斗');
        if (core.handLimitDiscardSelection != null) errors.push('自然开局不得预置手牌上限弃牌');
    }
    if (contract.entryKind === 'resolution-exercise' && core.pendingTargetAction == null) {
        errors.push('结算专题必须存在待结算动作');
    }
    if (contract.entryKind === 'season-resolution-exercise' && core.turnPhase !== 'season-resolution') {
        errors.push('新年/年中专题必须从季节结算阶段进入');
    }
    if (errors.length > 0) {
        throw new Error(`Invalid Qidahen tutorial setup contract: ${errors.join('；')}`);
    }
};

const cloneCore = (core: QidahenCore): QidahenCore => {
    const nativeStructuredClone = globalThis.structuredClone as undefined | (<T>(value: T) => T);
    return nativeStructuredClone
        ? nativeStructuredClone(core)
        : JSON.parse(JSON.stringify(core)) as QidahenCore;
};
const ATLAS05_RULES_SUMMARY_BY_DEF_ID: Readonly<Record<string, string>> = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID;

const getAtlas05TutorialHandCardIdentity = (
    cardDefId: string,
): QidahenAtlas05OrdinaryHandCardIdentity => {
    const identity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES.find((card) => card.cardDefId === cardDefId);
    if (!identity) {
        throw new Error(`Missing atlas05 tutorial hand card identity: ${cardDefId}`);
    }
    return identity;
};

const applyAtlas05TutorialHandCardIdentity = (
    card: QidahenHandCard,
    cardDefId: string,
): QidahenHandCard => {
    const identity = getAtlas05TutorialHandCardIdentity(cardDefId);
    return {
        ...card,
        label: identity.displayName,
        previewRef: qidahenAtlas05OrdinaryHandPreview(identity.atlasIndex),
        cardKind: identity.cardKind,
        armamentId: identity.armamentId,
        cardDefId: identity.cardDefId,
        rulesSummary: ATLAS05_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId] ?? null,
        previewKind: 'unknown',
        previewIdentityId: identity.cardDefId,
    };
};

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

const createSiegeDefenderChoicePendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'field',
    title: '山海关 守城宣告',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-24',
    sourceRegionName: '辽西',
    targetRegionId: 'city-region-25',
    targetRegionName: '山海关',
    targetRuntimeRegionId: 'city-region-25',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '教程样本 · 城市被攻击前先宣告守城',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 4,
    committedTroops: 4,
    attackPressure: 3,
    attackBoundaryType: 'plain',
    resolutionHint: '山海关被攻击，守方先决定出城野战或守城避战。',
    defenderPayCost: null,
});

const createDefaultSelections = (scenarioId: QidahenScenarioId): GameSetupSelections => applyQidahenPregameChoiceDefaults({
    scenario: scenarioId,
});

const createBasicTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        return createFormalOpeningCore(initialCore);
    },
});

const createAttackAndBattleTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        const [mingTacticCardId] = core.handCards
            .filter((card) => card.faction === 'ming')
            .slice(0, 1)
            .map((card) => card.id);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 势力行动';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = true;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.confirmedActionId = null;
        core.selectedPaymentCardIds = [];
        core.payment = { required: 1, selected: 0, prompt: '需弃 1 / 已选 0' };
        core.pendingTargetAction = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        if (mingTacticCardId) {
            core.handCards = core.handCards.map((card) => (
                card.id === mingTacticCardId
                    ? applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1618-cavalry-charge')
                    : card
            ));
        }
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
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    siegeState: null,
                    specialTroops: [],
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
        core.wheelDispatchProgress = null;
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
        core.pendingTargetAction = createSiegeDefenderChoicePendingAction();
        core.wheelDispatchProgress = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    population: 6,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-siege-cavalry-lv2', '大明攻城骑兵', 'ming', 'cavalry', 1, 2),
                        createTroop('ming-siege-infantry-lv2', '大明攻城步兵', 'ming', 'infantry', 3, 2),
                    ],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 4,
                    siegeState: null,
                    specialTroops: [
                        createTroop('jin-city-cavalry-lv2', '后金守城骑兵', 'jin', 'cavalry', 1, 2),
                        createTroop('jin-city-infantry-lv1', '后金守城步兵', 'jin', 'infantry', 1, 1),
                    ],
                    cityState: null,
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

const createCavalryPlunderTutorialPendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'field',
    title: '骑兵劫掠待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-16',
    sourceRegionName: '克什克腾部',
    targetRegionId: 'city-region-14',
    targetRegionName: '察哈尔部',
    targetRuntimeRegionId: 'city-region-14',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '教程样本 · 骑兵劫掠',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 2,
    committedTroops: 2,
    attackPressure: 2,
    attackBoundaryType: 'plain',
    resolutionHint: '骑兵可以不参与常规攻击，改为承受炮骑反击后劫掠人口并撤回。',
    defenderPayCost: null,
});

const createCavalryEvasionTutorialPendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'field',
    title: '骑兵避战待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-16',
    sourceRegionName: '克什克腾部',
    targetRegionId: 'city-region-14',
    targetRegionName: '察哈尔部',
    targetRuntimeRegionId: 'city-region-14',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '教程样本 · 骑兵避战',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 4,
    committedTroops: 4,
    attackPressure: 3,
    attackBoundaryType: 'plain',
    resolutionHint: '守方骑兵可以在野战里撤往相邻友方区，不视为战败。',
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

const createCavalryEvasionTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 骑兵避战';
        core.turnPhase = 'resolve-pending';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-attack';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.pendingTargetAction = createCavalryEvasionTutorialPendingAction();
        core.wheelDispatchProgress = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
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
                    troops: 2,
                    population: 0,
                    siegeState: null,
                    specialTroops: [
                        createTroop('jin-evasion-cavalry-lv2', '后金骑兵', 'jin', 'cavalry', 2, 2),
                    ],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        return core;
    },
});

const createCavalryPlunderTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 骑兵劫掠';
        core.turnPhase = 'resolve-pending';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-attack';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.pendingTargetAction = createCavalryPlunderTutorialPendingAction();
        core.wheelDispatchProgress = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 2,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-plunder-cavalry-lv2', '大明骑兵', 'ming', 'cavalry', 2, 2),
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 3,
                    siegeState: null,
                    specialTroops: [
                        createTroop('jin-plunder-infantry-lv1', '后金步兵', 'jin', 'infantry', 1, 1),
                    ],
                };
            }
            return region;
        });
        return core;
    },
});

const createNeutralInvasionTutorialPendingAction = (): QidahenPendingTargetAction => ({
    actionId: 'wheel-dispatch',
    battleMode: 'field',
    title: '土默特部 中立入侵待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-24',
    sourceRegionName: '宁远',
    targetRegionId: 'city-region-20',
    targetRegionName: '土默特部',
    targetRuntimeRegionId: 'city-region-20',
    defenderFactionId: 'neutral',
    defenderLabel: '中立',
    restriction: '教程样本 · 调度进攻中立区',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 1,
    committedTroops: 1,
    attackPressure: 1,
    attackBoundaryType: 'plain',
    resolutionHint: '土默特部无人驻守但有人口，结算时会临时生成中立守军。',
    defenderPayCost: null,
});

const createNeutralInvasionTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 中立入侵';
        core.turnPhase = 'resolve-pending';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-attack';
        core.selectedWheelMoveId = 'move-3-all-opponents';
        core.selectedRegionId = 'city-region-24';
        core.selectedActionId = 'wheel-dispatch';
        core.pendingTargetAction = createNeutralInvasionTutorialPendingAction();
        core.wheelDispatchProgress = null;
        core.postBattleSelection = null;
        core.lastSeasonSummary = null;
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 2,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-neutral-invasion-cavalry-lv1', '大明骑兵', 'ming', 'cavalry', 1, 1),
                    ],
                };
            }
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 3,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        return core;
    },
});

const createWaterDispatchTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 水路调度';
        core.turnPhase = 'dispatch-targeting';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-3-all-opponents';
        core.selectedRegionId = 'song-jin';
        core.selectedActionId = 'wheel-dispatch';
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
                    troops: 3,
                    population: 1,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-water-dispatch-cavalry-lv1', '大明骑兵', 'ming', 'cavalry', 3, 1),
                    ],
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 2,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-25',
                    },
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-32') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 1,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    siegeState: null,
                };
            }
            return region;
        });
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
        core.factionActionUsed = false;
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

const createWheelReclaimTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 轮盘推进';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        // This standalone wheel tutorial must keep Ming as the visible actor after resolution.
        // The hand action is not part of this tutorial's demonstrated path.
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-new-year';
        core.selectedWheelMoveId = 'move-1-free';
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
                    specialTroops: [],
                };
            }
            return region;
        });
        return core;
    },
});

const createWheelMilitaryFarmTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 轮盘推进';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-reclaim';
        core.selectedWheelMoveId = 'move-1-free';
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
                    population: 7,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        return core;
    },
});

const createWheelRecruitTrainTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 轮盘推进';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-military-farm';
        core.selectedWheelMoveId = 'move-1-free';
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
        core.factions.ming.armaments = core.factions.ming.armaments.map((armament) => (
            armament.id === 'artillery-tech'
                ? { ...armament, level: 2 }
                : armament
        ));
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 7,
                    siegeState: null,
                    specialTroops: [
                        createTroop('ming-wheel-artillery-lv1', '大明火炮', 'ming', 'artillery', 1, 1),
                    ],
                };
            }
            return region;
        });
        return core;
    },
});

const createArmamentUpgradeTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        const mingCardIds = core.handCards
            .filter((card) => card.faction === 'ming')
            .slice(0, 3)
            .map((card) => card.id);

        core.currentPlayer = '0';
        core.turnLabel = '第 1 轮 · 大明 · 行动窗口';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-attack';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-24';
        core.selectedActionId = 'upgrade-armament';
        core.confirmedActionId = null;
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
        core.payment = { required: 0, selected: 0, prompt: '需弃 0 / 已选 0' };
        core.handCards = core.handCards.map((card) => {
            if (card.id === mingCardIds[0]) {
                return applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1626-artillery-tech');
            }
            if (card.id === mingCardIds[1]) {
                return applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1624-silver');
            }
            if (card.id === mingCardIds[2]) {
                return applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1630-ginseng-and-sable');
            }
            return card;
        });
        return core;
    },
});

const createEventActionTutorialSetup = (): QidahenTutorialPreset => ({
    numPlayers: 3,
    setupSelections: createDefaultSelections('post-sarhu-1619'),
    coreTransform: (initialCore) => {
        const core = cloneCore(initialCore);
        const mongolCardIds = core.handCards
            .filter((card) => card.faction === 'mongol')
            .slice(0, 3)
            .map((card) => card.id);

        core.currentPlayer = '1';
        core.turnLabel = '第 1 轮 · 蒙古 · 行动窗口';
        core.turnPhase = 'action-window';
        core.wheelActionUsed = false;
        core.factionActionUsed = false;
        core.actionWheelPosition = 'wheel-hire';
        core.selectedWheelMoveId = 'move-1-free';
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'khan-edict';
        core.confirmedActionId = null;
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
        core.payment = { required: 0, selected: 0, prompt: '需弃 0 / 已选 0' };
        core.actionChoices = [
            { id: 'upgrade-armament', label: '升级军备', cost: 2, detail: '弃 1 张手牌，选择一项已开发军备进行升级。' },
            { id: 'raid', label: '突袭作战', cost: 1, detail: '弃 1 张手牌，执行进攻行动（不能执行调度）。' },
            { id: 'ma-shi-trade', label: '马市贸易', cost: 1, detail: '弃 1 张手牌，大明选择建立 1-3 个部队，蒙古抽 2 倍张数的手牌。' },
            { id: 'khan-edict', label: '大汗令箭', cost: 1, detail: '弃 1 张手牌，执行征兵训练或外交雇佣，不需再支付花费。' },
        ];
        core.handCards = core.handCards.map((card) => {
            if (card.id === mongolCardIds[0]) {
                return applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1643-silver');
            }
            if (card.id === mongolCardIds[1]) {
                return applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1632-pincer-advance');
            }
            if (card.id === mongolCardIds[2]) {
                return applyAtlas05TutorialHandCardIdentity(card, 'qidahen-atlas05-1637-mongol-drought-alt');
            }
            return card;
        });
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 2,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        core.factions.mongol.troops = 2;
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
        core.selectedRegionId = 'city-region-25';
        core.regionFocusState = {
            defaultFocusRegionId: 'city-region-25',
            lockedSourceRegionId: null,
            currentTargetRegionId: null,
            displayAnchorRegionId: 'city-region-25',
        };
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
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金附庸',
                    troops: 0,
                    population: 2,
                    siegeState: null,
                    diplomacyMarkerFaction: 'jin',
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
        core.confirmedActionId = 'khan-edict';
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
        core.turnLabel = '第 1 轮 · 大明 · 新年结算';
        core.turnPhase = 'season-resolution';
        core.wheelActionUsed = true;
        core.factionActionUsed = true;
        core.actionWheelPosition = 'wheel-new-year';
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
        core.guihuaPrestigeMarkerController = 'ming';
        core.hanseongPrestigeUnlocked = true;
        core.factions.ming.handCount = 8;
        core.factions.ming.characters = core.factions.ming.characters.map((character) => ({
            ...character,
            inPlay: false,
        }));
        core.regions = updateRegions(core, (region) => {
            if (region.isLogicalRegion) return region;
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        createTroop('ming-korea-front-infantry-lv2', '大明步兵', 'ming', 'infantry', 2, 2),
                    ],
                };
            }
            if (region.id === 'city-region-18') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                };
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                };
            }
            return region;
        });
        return core;
    },
});

const TUTORIAL_PRESETS: Record<string, QidahenTutorialPreset> = {
    'qidahen-basic': withContract(createBasicTutorialSetup(), NATURAL_OPENING_CONTRACT),
    'basic-opening': withContract(createBasicTutorialSetup(), NATURAL_OPENING_CONTRACT),
    'attack-and-battle': withContract(createAttackAndBattleTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-hand-action',
        precedingAtoms: ['setup-complete', 'hand-limit', 'wheel-action'],
        injectedDifferences: ['预置轮盘已完成、部队与战术牌已就位，只演示突袭进入野战。'],
    })),
    'retreat-and-rout': withContract(createRetreatAndRoutTutorialSetup(), resolutionContract([
        '预置野战失败后的待结算窗口，只演示撤退代价。',
    ], 'attack-and-battle')),
    'cavalry-evasion': withContract(createCavalryEvasionTutorialSetup(), resolutionContract([
        '预置守方骑兵已进入野战待结算窗口，只演示避战分支。',
    ])),
    'cavalry-plunder': withContract(createCavalryPlunderTutorialSetup(), resolutionContract([
        '预置骑兵劫掠可用的战斗窗口，只演示劫掠分支。',
    ])),
    'neutral-invasion': withContract(createNeutralInvasionTutorialSetup(), resolutionContract([
        '预置进入中立区后的临时守军待结算窗口。',
    ])),
    'water-dispatch': withContract(createWaterDispatchTutorialSetup(), dispatchContract([
        '预置海路调度已支付并进入目标选择，只演示水路边界。',
    ])),
    'wheel-shared-cost': withContract(createWheelSharedCostTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        injectedDifferences: ['预置势力行动已完成，只演示轮盘移动造成的共同抽牌与调度入口。'],
    })),
    'wheel-reclaim': withContract(createWheelReclaimTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        injectedDifferences: ['预置轮盘位于新年入口，只演示开垦结果。'],
    })),
    'wheel-military-farm': withContract(createWheelMilitaryFarmTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        injectedDifferences: ['预置轮盘位于开垦入口，只演示军屯结果。'],
    })),
    'wheel-recruit-train': withContract(createWheelRecruitTrainTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit'],
        injectedDifferences: ['预置轮盘位于军屯入口，保留大明为当前行动人，只演示征兵与训练的真实地图结果。'],
    })),
    'armament-upgrade': withContract(createArmamentUpgradeTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-hand-action',
        precedingAtoms: ['setup-complete', 'hand-limit'],
        injectedDifferences: ['预置军备牌已进入手牌，只演示升级军备的费用与结果。'],
    })),
    'event-action': withContract(createEventActionTutorialSetup(), actionWindowContract({
        currentActorFaction: 'mongol',
        firstRealDecision: 'choose-hand-action',
        precedingAtoms: ['setup-complete', 'hand-limit'],
        injectedDifferences: ['预置蒙古手牌行动窗口和事件牌，只演示事件行动。'],
    })),
    'diplomacy-and-hire': withContract(createDiplomacyTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        injectedDifferences: ['预置可外交的邻接区域，只演示外交标记和雇佣军入口。'],
    })),
    'siege-and-occupation': withContract(createSiegeTutorialSetup(), resolutionContract([
        '预置山海关守城宣告后的城战待结算窗口。',
    ])),
    'year-and-characters': withContract(createYearAndCharactersTutorialSetup(), actionWindowContract({
        currentActorFaction: 'mongol',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        injectedDifferences: ['预置蒙古行动窗口、战败标记和人物刷新数据，只演示跨年收口。'],
    })),
    'korea-and-special-map-rules': withContract(createKoreaSpecialMapTutorialSetup(), seasonResolutionContract([
        '预置朝鲜牌堆、归化城威望和山海关前线，只演示新年结算特例。',
    ])),
    'field-battle': withContract(createAttackAndBattleTutorialSetup(), actionWindowContract({
        currentActorFaction: 'ming',
        firstRealDecision: 'choose-hand-action',
        precedingAtoms: ['setup-complete', 'hand-limit', 'wheel-action'],
        injectedDifferences: ['与进攻与野战章节共享同一代表态入口。'],
    })),
    'season-flow': withContract(createYearAndCharactersTutorialSetup(), actionWindowContract({
        currentActorFaction: 'mongol',
        firstRealDecision: 'choose-wheel-move',
        precedingAtoms: ['setup-complete', 'hand-limit', 'hand-action'],
        injectedDifferences: ['与跨年与人物章节共享同一代表态入口。'],
    })),
};

export function buildQidahenTutorialSetupData(tutorialId?: string): QidahenTutorialSetupData | null {
    if (!tutorialId) {
        return null;
    }
    const preset = TUTORIAL_PRESETS[tutorialId];
    if (!preset) {
        return null;
    }
    if (!preset.contract) {
        throw new Error(`Missing Qidahen tutorial setup contract: ${tutorialId}`);
    }

    const setupData: Record<string, unknown> = {
        setupSelections: preset.setupSelections,
        qidahenTutorialContract: preset.contract,
        ...preset.setupSelections,
    };

    if (preset.coreTransform) {
        setupData.qidahenTutorialCoreTransform = ((core: QidahenCore) => {
            const transformedCore = preset.coreTransform?.(core) ?? core;
            validateTutorialSetupContract(preset.contract!, transformedCore);
            return {
                ...transformedCore,
                explicitRegionId: null,
            };
        }) satisfies QidahenTutorialCoreTransform;
    }

    return {
        numPlayers: preset.numPlayers,
        setupSelections: preset.setupSelections,
        setupData,
    };
}

export const QIDAHEN_TUTORIAL_SETUP_CONTRACTS: Readonly<Record<string, QidahenTutorialSetupContract>> = Object.freeze(
    Object.fromEntries(
        Object.entries(TUTORIAL_PRESETS).map(([tutorialId, preset]) => [tutorialId, preset.contract!]),
    ),
);
