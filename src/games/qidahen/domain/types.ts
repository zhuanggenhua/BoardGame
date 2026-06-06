import type { CardPreviewRef } from '../../../core/types';
import type { Command, GameEvent, PlayerId } from '../../../engine/types';

export type QidahenFactionId = 'ming' | 'mongol' | 'jin';
export type QidahenDiplomacyMarkerSide = 'friendly' | 'vassal';
export type QidahenRetreatLossMode = 'rear-guard' | 'rout';
export type QidahenFortificationMaintenanceMode = 'auto-pay' | 'skip-all';
export type QidahenTroopKind = 'infantry' | 'cavalry' | 'artillery';
export type QidahenPlunderSource = 'attacker' | 'defender';
export type QidahenArmamentId = 'artillery-tech' | 'infantry-armor' | 'cavalry-armor';

export interface QidahenArmamentState {
    id: QidahenArmamentId;
    name: string;
    level: number;
}

export interface QidahenFactionState {
    id: QidahenFactionId;
    playerId: PlayerId;
    name: string;
    colorClass: string;
    vp: number;
    troops: number;
    grain: number;
    landTax: number;
    handLimit: number;
    handCount: number;
    drawPileCount: number;
    discardPileCount: number;
    actionDiamonds: number;
    defeatMarkers: number;
    armaments: QidahenArmamentState[];
    characters: QidahenCharacterState[];
}

export interface QidahenCharacterState {
    id: string;
    name: string;
    faction: QidahenFactionId;
    number: number | 'X';
    inPlay: boolean;
    removedFromGame: boolean;
    canHoldDefeatMarker: boolean;
    defeatMarkers: number;
}

export interface QidahenSiegeState {
    attackerFactionId: QidahenFactionId;
    attackerTroops: number;
    attackerSpecialTroops: QidahenSpecialTroopStack[];
    sourceRegionId: string;
}

export interface QidahenCityState {
    troops: number;
    population: number;
    specialTroops: QidahenSpecialTroopStack[];
}

export interface QidahenRegionSummary {
    id: string;
    name: string;
    isLogicalRegion: boolean;
    primaryRuntimeRegionId: string;
    runtimeRegionIds: string[];
    controller: QidahenFactionId | 'neutral';
    diplomacyMarkerFaction: QidahenFactionId | null;
    diplomacyMarkerSide: QidahenDiplomacyMarkerSide | null;
    x: number;
    y: number;
    troops: number;
    population: number;
    controlLabel: string;
    note: string;
    siegeState: QidahenSiegeState | null;
    cityState: QidahenCityState | null;
    specialTroops: QidahenSpecialTroopStack[];
    adjacentRegionIds: string[];
    travelCostByRegionId: Record<string, number>;
    movementCostByRegionId: Record<string, number>;
    boundaryTypeByRegionId: Record<string, string>;
}

export interface QidahenSpecialTroopStack {
    id: string;
    label: string;
    faction: QidahenFactionId;
    troopKind: QidahenTroopKind;
    count: number;
    level: number;
}

export type QidahenCasualtyPriority = 'highest-level' | 'lowest-level';

export type QidahenBattleRollPhase = 'artillery' | 'cavalry' | 'infantry' | 'melee';

export interface QidahenBattleRoll {
    troopKind: QidahenTroopKind;
    level: number;
    dieSides: number;
    raw: number;
    value: number;
}

export interface QidahenBattleRollStage {
    phase: QidahenBattleRollPhase;
    attackerRolls: QidahenBattleRoll[];
    defenderRolls: QidahenBattleRoll[];
    attackerTotal: number;
    defenderTotal: number;
    attackerDamage: number;
    defenderDamage: number;
}

export interface QidahenBattleRolls {
    cityBattle: boolean;
    stages: QidahenBattleRollStage[];
    attackerDamage: number;
    defenderDamage: number;
    summary: string;
}

export interface QidahenActionChoice {
    id: string;
    label: string;
    cost: number;
    detail: string;
}

export type QidahenBattleMode = 'field' | 'city';
export type QidahenPendingBattleTargetKind = 'region' | 'siege-attacker' | 'siege-reinforce';

export type QidahenTurnPhase =
    | 'action-window'
    | 'hand-limit-discard'
    | 'sun-yuanhua-tech-choice'
    | 'gao-di-dispatch-choice'
    | 'internal-dispatch-choice'
    | 'recruit-choice'
    | 'ma-shi-trade-choice'
    | 'khan-edict-choice'
    | 'diplomacy-choice'
    | 'drive-tiger-consent'
    | 'dispatch-targeting'
    | 'resolve-pending'
    | 'post-battle-decision'
    | 'season-resolution';

export interface QidahenWheelMoveChoice {
    id: string;
    label: string;
    steps: number;
    drawText: string;
}

export interface QidahenPendingTargetAction {
    actionId: 'raid' | 'marriage-subjugation' | 'wheel-dispatch' | 'drive-tiger';
    battleMode?: QidahenBattleMode;
    targetKind?: QidahenPendingBattleTargetKind;
    title: string;
    attackerFactionId: QidahenFactionId;
    sourceRegionId: string | null;
    sourceRegionName: string | null;
    attackerPositionRegionId?: string | null;
    targetRegionId: string;
    targetRegionName: string;
    targetRuntimeRegionId: string;
    defenderFactionId: QidahenFactionId | 'neutral';
    defenderLabel: string;
    restriction: string;
    battleWidth: number;
    boundaryUnitCap: number | null;
    sourceAvailableTroops: number;
    committedTroops: number;
    movementProfileId?: string | null;
    attackPressure: number;
    attackBoundaryType: string;
    resolutionHint: string;
    defenderPayCost: number | null;
}

export interface QidahenWheelDispatchCandidate {
    battleMode?: QidahenBattleMode;
    targetKind?: QidahenPendingBattleTargetKind;
    targetRegionId: string;
    targetRegionName: string;
    targetRuntimeRegionId: string;
    attackerPositionRegionId?: string | null;
    defenderFactionId: QidahenFactionId | 'neutral';
    defenderLabel: string;
    totalTravelCost: number;
    battleWidth: number;
    boundaryUnitCap: number | null;
    sourceAvailableTroops: number;
    committedTroops: number;
    attackPressure: number;
    attackBoundaryType: string;
    priorityTroops: number;
    resolutionHint: string;
    pathRegionIds: string[];
    pathLabel: string;
}

export interface QidahenWheelDispatchSelection {
    attackerFactionId: QidahenFactionId;
    sourceRegionId: string;
    sourceRegionName: string;
    movementProfileId: string;
    movementProfileLabel: string;
    restriction: string;
    candidates: QidahenWheelDispatchCandidate[];
}

export interface QidahenInternalDispatchCandidate {
    id: string;
    targetRegionId: string;
    targetRegionName: string;
    totalTravelCost: number;
    committedTroops: number;
    movedGenericTroops: number;
    movedSpecialTroops: QidahenSpecialTroopStack[];
    resolutionHint: string;
    pathRegionIds: string[];
    pathLabel: string;
}

export type QidahenGaoDiDispatchMode = 'troops' | 'population';

export interface QidahenGaoDiDispatchCandidate {
    id: string;
    mode: QidahenGaoDiDispatchMode;
    targetRegionId: string;
    targetRegionName: string;
    totalTravelCost: number;
    committedTroops: number;
    committedPopulation: number;
    movedGenericTroops: number;
    movedSpecialTroops: QidahenSpecialTroopStack[];
    resolutionHint: string;
    pathRegionIds: string[];
    pathLabel: string;
}

export interface QidahenGaoDiDispatchSelection {
    source: 'gao-di';
    title: string;
    summary: string;
    sourceRegionId: string;
    sourceRegionName: string;
    maxTroops: number;
    maxPopulation: number;
    candidateCardIds: string[];
    selectedCardId: string | null;
    candidates: QidahenGaoDiDispatchCandidate[];
}

export interface QidahenSunYuanhuaTechSelection {
    source: 'sun-yuanhua';
    title: string;
    summary: string;
    requiredCardCount: number;
    candidateCardIds: string[];
    selectedCardIds: string[];
}

export interface QidahenInternalDispatchSelection {
    source: 'wang-huazhen';
    title: string;
    summary: string;
    sourceRegionId: string;
    sourceRegionName: string;
    maxTroops: number;
    candidates: QidahenInternalDispatchCandidate[];
}

export interface QidahenKhanEdictChoice {
    id: 'recruit-train' | 'hire-dispatch';
    label: string;
    detail: string;
}

export interface QidahenDiplomacyChoice {
    id: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker';
    label: string;
    detail: string;
}

export interface QidahenDiplomacyResolvedStep {
    index: number;
    targetRegionId: string;
    targetRegionName: string;
    choiceId: Exclude<QidahenDiplomacyChoice['id'], 'hire-only'>;
    summary: string;
}

export interface QidahenRecruitChoice {
    id: 'level-2-troops' | 'level-4-chuanbing' | 'level-1-artillery';
    label: string;
    detail: string;
    troopDelta: number;
}

export interface QidahenMaShiTradeChoice {
    troopCount: 1 | 2 | 3;
    label: string;
    detail: string;
}

export interface QidahenMaShiTradeSelection {
    targetRegionId: string | null;
    targetRegionName: string | null;
    choices: QidahenMaShiTradeChoice[];
}

export interface QidahenDriveTigerConsentChoice {
    id: 'accept' | 'decline';
    label: string;
    detail: string;
}

export interface QidahenFortificationMaintenanceChoice {
    id: QidahenFortificationMaintenanceMode;
    label: string;
    detail: string;
}

export interface QidahenFortificationMaintenanceSelection {
    title: string;
    summary: string;
    choices: QidahenFortificationMaintenanceChoice[];
}

export interface QidahenDriveTigerConsentSelection {
    commanderFactionId: QidahenFactionId;
    targetFactionId: QidahenFactionId;
    targetFactionName: string;
    dispatchSelection: QidahenWheelDispatchSelection;
    choices: QidahenDriveTigerConsentChoice[];
}

export interface QidahenRecruitSelection {
    targetRegionId: string | null;
    targetRegionName: string | null;
    choices: QidahenRecruitChoice[];
}

export interface QidahenKhanEdictSelection {
    sourceRegionId: string | null;
    sourceRegionName: string | null;
    recruitTargetRegionId: string | null;
    recruitTargetRegionName: string | null;
    hireTargetRegionId: string | null;
    hireTargetRegionName: string | null;
    dispatchSourceRegionId: string | null;
    dispatchSourceRegionName: string | null;
    choices: QidahenKhanEdictChoice[];
}

export interface QidahenDiplomacySelection {
    source: 'wheel-hire' | 'khan-edict';
    title: string;
    sourceRegionId: string | null;
    sourceRegionName: string | null;
    hireRegionId: string | null;
    hireRegionName: string | null;
    targetRegionId: string | null;
    targetRegionName: string | null;
    candidateTargetRegionIds: string[];
    targetHint: string;
    choices: QidahenDiplomacyChoice[];
    maxTargetCount: number;
    remainingTargetCount: number;
    resolvedSteps: QidahenDiplomacyResolvedStep[];
}

export interface QidahenPostBattleChoice {
    id: string;
    mode: 'occupy' | 'besiege' | 'withdraw';
    regionId: string | null;
    plunderPopulation: number;
    plunderSource: QidahenPlunderSource | null;
    label: string;
    detail: string;
}

export interface QidahenPostBattleSelection {
    actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger';
    battleMode?: QidahenBattleMode;
    targetKind?: QidahenPendingBattleTargetKind;
    attackerFactionId: QidahenFactionId;
    sourceRegionId: string;
    sourceRegionName: string;
    attackerPositionRegionId?: string | null;
    targetRegionId: string;
    targetRegionName: string;
    targetRuntimeRegionId: string;
    committedTroops: number;
    survivingTroops: number;
    attackerLosses: number;
    movementProfileId?: string | null;
    attackerCasualtyPriority?: QidahenCasualtyPriority;
    originalController: QidahenFactionId | 'neutral';
    originalControlLabel: string;
    title: string;
    summary: string;
    choices: QidahenPostBattleChoice[];
}

export interface QidahenVictoryStatus {
    winnerFactionId: QidahenFactionId;
    winnerName: string;
    condition: 'hegemony' | 'prestige' | 'military';
    detail: string;
}

export interface QidahenYearCardSlot {
    id: string;
    label: string;
    previewRef: CardPreviewRef;
}

export interface QidahenPaymentState {
    required: number;
    selected: number;
    prompt: string;
}

export interface QidahenFortificationState {
    id: string;
    label: string;
    maintenanceCost: number;
    ruined: boolean;
    dependencyRegionId: string | null;
    dependencyLabel: string | null;
    ruleNote: string;
}

export interface QidahenSeasonSummary {
    id: string;
    title: string;
    lines: string[];
}

export interface QidahenHandCard {
    id: string;
    label: string;
    faction: QidahenFactionId;
    previewRef: CardPreviewRef;
    accent: QidahenFactionId | 'neutral';
    status: 'idle' | 'selected' | 'payable' | 'disabled';
}

export interface QidahenHandLimitDiscardSelection {
    factionId: QidahenFactionId;
    factionName: string;
    handLimit: number;
    handCount: number;
    requiredDiscardCount: number;
    candidateCardIds: string[];
    selectedCardIds: string[];
}

export interface QidahenMapToken {
    id: string;
    x: number;
    y: number;
    type: 'army' | 'population' | 'control';
    faction: QidahenFactionId | 'neutral';
    imageSrc?: string;
    size?: number;
    value?: number;
}

export interface QidahenRouteLine {
    id: string;
    tone: 'red' | 'blue';
    points: Array<{
        x: number;
        y: number;
    }>;
}

export interface QidahenLogEntry {
    id: string;
    faction: QidahenFactionId;
    text: string;
}

export interface QidahenCore {
    playerIds: PlayerId[];
    currentFactionOrder: QidahenFactionId[];
    currentPlayer: PlayerId;
    roundNumber: number;
    currentYearIndex: number;
    currentYear: string;
    turnLabel: string;
    turnPhase: QidahenTurnPhase;
    wheelActionUsed: boolean;
    factionActionUsed: boolean;
    bonusFactionActionAvailable: boolean;
    bonusFactionActionUsed: boolean;
    lastFactionActionId: string | null;
    actionWheelPosition: string;
    selectedWheelMoveId: string;
    wheelMoveChoices: QidahenWheelMoveChoice[];
    wheelMoveSummary: string;
    selectedRegionId: string;
    selectedActionId: string;
    selectedPaymentCardIds: string[];
    recruitSelection: QidahenRecruitSelection | null;
    maShiTradeSelection: QidahenMaShiTradeSelection | null;
    khanEdictSelection: QidahenKhanEdictSelection | null;
    diplomacySelection: QidahenDiplomacySelection | null;
    driveTigerConsentSelection: QidahenDriveTigerConsentSelection | null;
    fortificationMaintenanceSelection: QidahenFortificationMaintenanceSelection | null;
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    sunYuanhuaTechSelection: QidahenSunYuanhuaTechSelection | null;
    gaoDiDispatchSelection: QidahenGaoDiDispatchSelection | null;
    internalDispatchSelection: QidahenInternalDispatchSelection | null;
    wheelDispatchSelection: QidahenWheelDispatchSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
    postBattleSelection: QidahenPostBattleSelection | null;
    lastCharacterActionWindowTriggerKey: string | null;
    lastSeasonSummary: QidahenSeasonSummary | null;
    hanseongPrestigeUnlocked: boolean;
    victoryStatus: QidahenVictoryStatus | null;
    factions: Record<QidahenFactionId, QidahenFactionState>;
    regions: QidahenRegionSummary[];
    fortifications: QidahenFortificationState[];
    actionChoices: QidahenActionChoice[];
    yearCards: QidahenYearCardSlot[];
    payment: QidahenPaymentState;
    koreaDeckCount: number;
    koreaDiscardCount: number;
    koreaDiscardPreviewRef: CardPreviewRef;
    drawPileCount: number;
    discardPileCount: number;
    handCards: QidahenHandCard[];
    mapTokens: QidahenMapToken[];
    routeLines: QidahenRouteLine[];
    actionLog: QidahenLogEntry[];
}

export interface SelectRegionCommand extends Command<'SELECT_REGION'> {
    payload: {
        regionId: string;
    };
}

export interface ConfirmPreviewActionCommand extends Command<'CONFIRM_PREVIEW_ACTION'> {
    payload: {
        actionId: string;
    };
}

export interface SelectWheelMoveCommand extends Command<'SELECT_WHEEL_MOVE'> {
    payload: {
        moveId: string;
    };
}

export interface ExecuteWheelMoveCommand extends Command<'EXECUTE_WHEEL_MOVE'> {
    payload: {
        moveId: string;
    };
}

export interface SelectPaymentCardCommand extends Command<'SELECT_PAYMENT_CARD'> {
    payload: {
        cardId: string;
    };
}

export interface SelectHandLimitDiscardCardCommand extends Command<'SELECT_HAND_LIMIT_DISCARD_CARD'> {
    payload: {
        cardId: string;
    };
}

export interface SelectGaoDiDispatchCardCommand extends Command<'SELECT_GAO_DI_DISPATCH_CARD'> {
    payload: {
        cardId: string;
    };
}

export interface SelectSunYuanhuaTechCardCommand extends Command<'SELECT_SUN_YUANHUA_TECH_CARD'> {
    payload: {
        cardId: string;
    };
}

export interface ResolveHandLimitDiscardCommand extends Command<'RESOLVE_HAND_LIMIT_DISCARD'> {
    payload: Record<string, never>;
}

export interface ResolveSunYuanhuaTechCommand extends Command<'RESOLVE_SUN_YUANHUA_TECH'> {
    payload: {
        choiceId: 'confirm' | 'skip';
    };
}

export interface ResolveGaoDiDispatchCommand extends Command<'RESOLVE_GAO_DI_DISPATCH'> {
    payload: {
        choiceId: string;
    };
}

export interface ResolveInternalDispatchCommand extends Command<'RESOLVE_INTERNAL_DISPATCH'> {
    payload: {
        choiceId: string;
    };
}

export interface ExecuteSelectedActionCommand extends Command<'EXECUTE_SELECTED_ACTION'> {
    payload: Record<string, never>;
}

export interface ExecuteActionCommand extends Command<'EXECUTE_ACTION'> {
    payload: {
        actionId: string;
    };
}

export interface ResolvePendingActionCommand extends Command<'RESOLVE_PENDING_ACTION'> {
    payload: {
        committedTroops?: number;
        retreatLossMode?: QidahenRetreatLossMode;
        defenderSortieBattle?: boolean;
        defenderHoldCity?: boolean;
        defenderCavalryEvasion?: boolean;
        defenderCavalryEvasionRegionId?: string;
        attackerCavalryPlunder?: boolean;
        attackerCavalryPlunderSource?: QidahenPlunderSource;
        attackerCasualtyPriority?: QidahenCasualtyPriority;
        defenderCasualtyPriority?: QidahenCasualtyPriority;
    };
}

export interface ResolvePostBattleDecisionCommand extends Command<'RESOLVE_POST_BATTLE_DECISION'> {
    payload: {
        choiceId: string;
    };
}

export interface ResolveKhanEdictChoiceCommand extends Command<'RESOLVE_KHAN_EDICT_CHOICE'> {
    payload: {
        choiceId: QidahenKhanEdictChoice['id'];
    };
}

export interface ResolveDiplomacyChoiceCommand extends Command<'RESOLVE_DIPLOMACY_CHOICE'> {
    payload: {
        choiceId: QidahenDiplomacyChoice['id'];
    };
}

export interface ResolveMaShiTradeChoiceCommand extends Command<'RESOLVE_MA_SHI_TRADE_CHOICE'> {
    payload: {
        troopCount: QidahenMaShiTradeChoice['troopCount'];
    };
}

export interface ResolveDriveTigerConsentCommand extends Command<'RESOLVE_DRIVE_TIGER_CONSENT'> {
    payload: {
        choiceId: QidahenDriveTigerConsentChoice['id'];
    };
}

export interface ResolveRecruitChoiceCommand extends Command<'RESOLVE_RECRUIT_CHOICE'> {
    payload: {
        choiceId: QidahenRecruitChoice['id'];
    };
}

export interface ResolveFortificationMaintenanceCommand extends Command<'RESOLVE_FORTIFICATION_MAINTENANCE'> {
    payload: {
        choiceId: QidahenFortificationMaintenanceMode;
        attritionPriority?: QidahenCasualtyPriority;
    };
}

export type QidahenCommand =
    | SelectRegionCommand
    | ConfirmPreviewActionCommand
    | SelectWheelMoveCommand
    | ExecuteWheelMoveCommand
    | SelectPaymentCardCommand
    | SelectHandLimitDiscardCardCommand
    | SelectSunYuanhuaTechCardCommand
    | SelectGaoDiDispatchCardCommand
    | ResolveHandLimitDiscardCommand
    | ResolveSunYuanhuaTechCommand
    | ResolveGaoDiDispatchCommand
    | ResolveInternalDispatchCommand
    | ExecuteSelectedActionCommand
    | ExecuteActionCommand
    | ResolvePendingActionCommand
    | ResolvePostBattleDecisionCommand
    | ResolveKhanEdictChoiceCommand
    | ResolveDiplomacyChoiceCommand
    | ResolveMaShiTradeChoiceCommand
    | ResolveDriveTigerConsentCommand
    | ResolveRecruitChoiceCommand
    | ResolveFortificationMaintenanceCommand;

export interface RegionSelectedEvent extends GameEvent<'REGION_SELECTED'> {
    payload: {
        regionId: string;
        playerId: PlayerId;
    };
}

export interface PreviewActionConfirmedEvent extends GameEvent<'PREVIEW_ACTION_CONFIRMED'> {
    payload: {
        actionId: string;
        playerId: PlayerId;
    };
}

export interface WheelMoveSelectedEvent extends GameEvent<'WHEEL_MOVE_SELECTED'> {
    payload: {
        moveId: string;
        playerId: PlayerId;
    };
}

export interface WheelMoveExecutedEvent extends GameEvent<'WHEEL_MOVE_EXECUTED'> {
    payload: {
        moveId: string;
        playerId: PlayerId;
    };
}

export interface PaymentCardSelectedEvent extends GameEvent<'PAYMENT_CARD_SELECTED'> {
    payload: {
        cardId: string;
        playerId: PlayerId;
    };
}

export interface HandLimitDiscardCardSelectedEvent extends GameEvent<'HAND_LIMIT_DISCARD_CARD_SELECTED'> {
    payload: {
        cardId: string;
        playerId: PlayerId;
    };
}

export interface GaoDiDispatchCardSelectedEvent extends GameEvent<'GAO_DI_DISPATCH_CARD_SELECTED'> {
    payload: {
        cardId: string;
        playerId: PlayerId;
    };
}

export interface SunYuanhuaTechCardSelectedEvent extends GameEvent<'SUN_YUANHUA_TECH_CARD_SELECTED'> {
    payload: {
        cardId: string;
        playerId: PlayerId;
    };
}

export interface HandLimitDiscardResolvedEvent extends GameEvent<'HAND_LIMIT_DISCARD_RESOLVED'> {
    payload: {
        playerId: PlayerId;
    };
}

export interface SunYuanhuaTechResolvedEvent extends GameEvent<'SUN_YUANHUA_TECH_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: 'confirm' | 'skip';
    };
}

export interface GaoDiDispatchResolvedEvent extends GameEvent<'GAO_DI_DISPATCH_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: string;
    };
}

export interface InternalDispatchResolvedEvent extends GameEvent<'INTERNAL_DISPATCH_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: string;
    };
}

export interface SelectedActionExecutedEvent extends GameEvent<'SELECTED_ACTION_EXECUTED'> {
    payload: {
        actionId: string;
        cardIds: string[];
        playerId: PlayerId;
    };
}

export interface PendingActionResolvedEvent extends GameEvent<'PENDING_ACTION_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        committedTroops?: number;
        retreatLossMode?: QidahenRetreatLossMode;
        defenderSortieBattle?: boolean;
        defenderHoldCity?: boolean;
        defenderCavalryEvasion?: boolean;
        defenderCavalryEvasionRegionId?: string;
        attackerCavalryPlunder?: boolean;
        attackerCavalryPlunderSource?: QidahenPlunderSource;
        attackerCasualtyPriority?: QidahenCasualtyPriority;
        defenderCasualtyPriority?: QidahenCasualtyPriority;
        battleRolls?: QidahenBattleRolls | null;
    };
}

export interface PostBattleDecisionResolvedEvent extends GameEvent<'POST_BATTLE_DECISION_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: string;
    };
}

export interface KhanEdictChoiceResolvedEvent extends GameEvent<'KHAN_EDICT_CHOICE_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: QidahenKhanEdictChoice['id'];
    };
}

export interface DiplomacyChoiceResolvedEvent extends GameEvent<'DIPLOMACY_CHOICE_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: QidahenDiplomacyChoice['id'];
    };
}

export interface MaShiTradeChoiceResolvedEvent extends GameEvent<'MA_SHI_TRADE_CHOICE_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        troopCount: QidahenMaShiTradeChoice['troopCount'];
    };
}

export interface RecruitChoiceResolvedEvent extends GameEvent<'RECRUIT_CHOICE_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: QidahenRecruitChoice['id'];
    };
}

export interface DriveTigerConsentResolvedEvent extends GameEvent<'DRIVE_TIGER_CONSENT_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: QidahenDriveTigerConsentChoice['id'];
    };
}

export interface FortificationMaintenanceResolvedEvent extends GameEvent<'FORTIFICATION_MAINTENANCE_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        choiceId: QidahenFortificationMaintenanceMode;
        attritionPriority?: QidahenCasualtyPriority;
    };
}

export type QidahenEvent =
    | RegionSelectedEvent
    | PreviewActionConfirmedEvent
    | WheelMoveSelectedEvent
    | WheelMoveExecutedEvent
    | PaymentCardSelectedEvent
    | HandLimitDiscardCardSelectedEvent
    | SunYuanhuaTechCardSelectedEvent
    | GaoDiDispatchCardSelectedEvent
    | HandLimitDiscardResolvedEvent
    | SunYuanhuaTechResolvedEvent
    | GaoDiDispatchResolvedEvent
    | InternalDispatchResolvedEvent
    | SelectedActionExecutedEvent
    | PendingActionResolvedEvent
    | PostBattleDecisionResolvedEvent
    | KhanEdictChoiceResolvedEvent
    | DiplomacyChoiceResolvedEvent
    | MaShiTradeChoiceResolvedEvent
    | RecruitChoiceResolvedEvent
    | DriveTigerConsentResolvedEvent
    | FortificationMaintenanceResolvedEvent;

export interface QidahenCommandMap extends Record<string, unknown> {
    SELECT_REGION: SelectRegionCommand['payload'];
    CONFIRM_PREVIEW_ACTION: ConfirmPreviewActionCommand['payload'];
    SELECT_WHEEL_MOVE: SelectWheelMoveCommand['payload'];
    EXECUTE_WHEEL_MOVE: ExecuteWheelMoveCommand['payload'];
    SELECT_PAYMENT_CARD: SelectPaymentCardCommand['payload'];
    SELECT_HAND_LIMIT_DISCARD_CARD: SelectHandLimitDiscardCardCommand['payload'];
    SELECT_SUN_YUANHUA_TECH_CARD: SelectSunYuanhuaTechCardCommand['payload'];
    SELECT_GAO_DI_DISPATCH_CARD: SelectGaoDiDispatchCardCommand['payload'];
    RESOLVE_HAND_LIMIT_DISCARD: ResolveHandLimitDiscardCommand['payload'];
    RESOLVE_SUN_YUANHUA_TECH: ResolveSunYuanhuaTechCommand['payload'];
    RESOLVE_GAO_DI_DISPATCH: ResolveGaoDiDispatchCommand['payload'];
    RESOLVE_INTERNAL_DISPATCH: ResolveInternalDispatchCommand['payload'];
    EXECUTE_SELECTED_ACTION: ExecuteSelectedActionCommand['payload'];
    EXECUTE_ACTION: ExecuteActionCommand['payload'];
    RESOLVE_PENDING_ACTION: ResolvePendingActionCommand['payload'];
    RESOLVE_POST_BATTLE_DECISION: ResolvePostBattleDecisionCommand['payload'];
    RESOLVE_KHAN_EDICT_CHOICE: ResolveKhanEdictChoiceCommand['payload'];
    RESOLVE_DIPLOMACY_CHOICE: ResolveDiplomacyChoiceCommand['payload'];
    RESOLVE_MA_SHI_TRADE_CHOICE: ResolveMaShiTradeChoiceCommand['payload'];
    RESOLVE_DRIVE_TIGER_CONSENT: ResolveDriveTigerConsentCommand['payload'];
    RESOLVE_RECRUIT_CHOICE: ResolveRecruitChoiceCommand['payload'];
    RESOLVE_FORTIFICATION_MAINTENANCE: ResolveFortificationMaintenanceCommand['payload'];
}
