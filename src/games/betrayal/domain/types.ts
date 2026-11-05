import type { BetrayalExplorerTraitTrackSeed } from '../scenarioConfig';
import type { BetrayalTraitKey as ConfigTraitKey, BetrayalInventoryKind as ConfigInventoryKind, BetrayalDeckKind as ConfigDeckKind, BetrayalRecommendedAction as ConfigRecommendedAction, BetrayalRoomFloor, BetrayalRoomEdge, BetrayalRoomVisualId, BetrayalRoomDoorway, BetrayalRoomDiscoveryTemplate, BetrayalRoomDiscoverySymbol, BetrayalHauntRevealResolution, BetrayalScenarioOutcome, BetrayalScenarioCardId, BetrayalScenarioId, BetrayalEventSeed } from '../scenarioConfig';
import type { BetrayalMonsterDefinitionId } from './monsterDefinitions';
import type { BetrayalRoomEndTurnEffect, BetrayalRoomEndTurnEffectResult } from '../roomEndTurnEffectModel';
import type { BetrayalRoomEnterEffect } from '../roomEnterEffectModel';
import type { UseEffectProfile } from '../possessionEffects';
import type { BetrayalHauntTraitorResolution, BetrayalHauntFirstPlayerResolution } from '../hauntTraitorResolutionModel';
import type { BetrayalDustEndTurnResult } from '../dustHauntRules';
import type { BetrayalMummyAttackRewardChoice, BetrayalHelpingHandsAttackRewardChoice } from '../hauntAttackRewardReadModel';
import type { BetrayalHauntSetupQueueEntry } from '../hauntSetupModel';
import type { BetrayalMonsterTurnRuntimeState, BetrayalBloodFromStoneMonsterTurnRuntimeState } from '../monsterActionReadModel';
import type { AiSeatController } from '../../../engine/ai/types';

export type BetrayalTraitKey = ConfigTraitKey;

export type BetrayalInventoryKind = ConfigInventoryKind;

export type BetrayalDeckKind = ConfigDeckKind;

export type BetrayalPhase = 'characterSelect' | 'preHaunt' | 'haunt' | 'endgame';

export type BetrayalRecommendedAction = ConfigRecommendedAction;

export type BetrayalRoomMarkerToken = 'obstacle' | 'secretPassage' | 'blessing';

export type BetrayalHauntAttackTarget =
    'traitor' | 'hero' | 'jack-spirit' | 'phantom-photographer' | 'troll-hand' | 'dynamite-room';

export interface BetrayalInventoryCard {
    id: string;
    name: string;
    kind: BetrayalInventoryKind;
}

export interface BetrayalExplorerTemplate {
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    tokenAsset?: string;
    color: string;
    traits: Record<BetrayalTraitKey, number>;
    traitTracks: Record<BetrayalTraitKey, BetrayalExplorerTraitTrackSeed>;
    abilityName: string;
    abilityText: string;
}

export interface BetrayalTraitTrackState {
    trackId: string;
    values: number[];
    position: number;
    startPosition: number;
    criticalPosition: number;
    skullPosition: number;
    maxPosition: number;
}

export type BetrayalTraitTrackMap = Record<BetrayalTraitKey, BetrayalTraitTrackState>;

export interface BetrayalExplorerSummary {
    playerId: string;
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    traits: Record<BetrayalTraitKey, number>;
    traitTracks: BetrayalTraitTrackMap;
    inventory: BetrayalInventoryCard[];
}

export interface BetrayalMonsterSummary {
    id: string;
    definitionId?: BetrayalMonsterDefinitionId;
    name: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    might: number;
    speed: number;
    sanity?: number;
    knowledge?: number;
    damage: number;
}

export type BetrayalMonsterStatusKind = 'active' | 'stunned' | 'killed';

export interface BetrayalMonsterTraitReadModel {
    might: number;
    speed: number;
    sanity: number | null;
    knowledge: number | null;
    usesTraitTrack: false;
}

export interface BetrayalMonsterStatusSummary {
    monsterId: string;
    name: string;
    roomId: string | null;
    traits: BetrayalMonsterTraitReadModel;
    damage: number;
    status: BetrayalMonsterStatusKind;
    canBeStunned: boolean;
    stunned: boolean;
    killed: boolean;
    removedFromHouse: boolean;
    slowsHeroMovement: boolean;
    canAttack: boolean;
    canBeAttacked: boolean;
    canHoldPossessions: boolean;
    canExploreNewRooms: boolean;
    defaultAttackTrait: BetrayalTraitKey;
    ruleNotes: string[];
}

export interface BetrayalCorpseSummary {
    playerId: string;
    explorerId: string;
    displayName: string;
    roomId: string;
    roomName: string | null;
    shouldLayTokenFlat: true;
    inventory: BetrayalInventoryCard[];
    itemCount: number;
    omenCount: number;
    lootedThisTurn: boolean;
    canBeLootedByCurrentExplorer: boolean;
    lootableCardIds: string[];
    ruleNotes: string[];
}

export interface BetrayalDeathStateSummary {
    hauntDeathRulesActive: boolean;
    livingExplorerPlayerIds: string[];
    deadExplorerPlayerIds: string[];
    corpseLootedThisTurnPlayerIds: string[];
    corpses: BetrayalCorpseSummary[];
    ruleNotes: string[];
}

export interface BetrayalRoomNode {
    id: string;
    name: string;
    floor: BetrayalRoomFloor;
    x: number;
    y: number;
    connectedRoomIds: string[];
    entryRoomId?: string;
    entryEdge?: BetrayalRoomEdge;
    orientationTurns: 0 | 1 | 2 | 3;
    state: 'discovered' | 'unexplored';
    startingTile?: boolean;
    hint: string;
    tags: string[];
    discoveryReward: BetrayalDeckKind | null;
    visualId: BetrayalRoomVisualId;
    doorways: BetrayalRoomDoorway[];
    backVisualId: Extract<BetrayalRoomVisualId, 'backUpper' | 'backGround' | 'backBasement'>;
    discoveryEffect?: RoomTemplate['discoveryEffect'];
    endTurnEffect?: BetrayalRoomEndTurnEffect;
    enterEffect?: BetrayalRoomEnterEffect;
    markerTokens?: BetrayalRoomMarkerToken[];
}

export interface BetrayalRoomPlacementPreview {
    slotId: string;
    floor: BetrayalRoomFloor;
    entryRoomId: string | null;
    entryEdge: BetrayalRoomEdge;
    deckKind: BetrayalDeckKind | null;
    skippedRoomName?: string;
    buriedRoomNames?: string[];
    room: Pick<
        BetrayalRoomNode,
        | 'name'
        | 'hint'
        | 'tags'
        | 'discoveryReward'
        | 'visualId'
        | 'doorways'
        | 'backVisualId'
        | 'orientationTurns'
        | 'discoveryEffect'
        | 'endTurnEffect'
        | 'enterEffect'
    >;
    orientationOptions: {
        orientationTurns: 0 | 1 | 2 | 3;
        doorways: BetrayalRoomDoorway[];
    }[];
    defaultOrientationTurns: 0 | 1 | 2 | 3;
    requiresTileAdjustment: boolean;
    tileAdjustmentOptions: BetrayalRoomTileAdjustmentOption[];
}

export interface BetrayalRoomDiscoveryDeckEntry {
    floor: BetrayalRoomFloor;
    room: BetrayalRoomDiscoveryTemplate;
}

export interface BetrayalBuriedRoomTileSummary {
    floor: BetrayalRoomFloor;
    name: string;
    visualId: BetrayalRoomDiscoveryTemplate['visualId'];
    reason: 'areaMismatch' | 'holySymbol' | 'sealedRegion';
}

export interface BetrayalRoomDrawResolution {
    requestedFloor: BetrayalRoomFloor;
    selectedRoom: {
        floor: BetrayalRoomFloor;
        name: string;
        visualId: BetrayalRoomDiscoveryTemplate['visualId'];
    } | null;
    buriedRoomTiles: BetrayalBuriedRoomTileSummary[];
    exhausted: boolean;
    requiresTileAdjustment: boolean;
    usedUnifiedDeck: boolean;
}

export interface BetrayalRoomTileAdjustmentSelection {
    roomId: string;
    x: number;
    y: number;
    entryRoomId: string;
    entryEdge: BetrayalRoomEdge;
    orientationTurns: 0 | 1 | 2 | 3;
}

export interface BetrayalRoomTileAdjustmentOption extends BetrayalRoomTileAdjustmentSelection {
    roomName: string;
    fromX: number;
    fromY: number;
    entryRoomName: string;
    openDoorwayCount: number;
}

export interface BetrayalDiscoverySummary {
    kind: BetrayalRoomDiscoverySymbol;
    title: string;
    summary: string;
    detail: string;
    tone: 'neutral' | 'accent' | 'warning';
    resolutionSteps?: BetrayalDiscoveryResolutionStep[];
}

export type BetrayalDiscoveryResolutionStepKind =
    'room-effect' | 'room-discovery-card' | 'buried-room-discovery-card' | 'drawn-card' | 'haunt-roll' | 'event-effect';

export interface BetrayalDiscoveryResolutionStep {
    id: string;
    kind: BetrayalDiscoveryResolutionStepKind;
    text: string;
    deckKind?: BetrayalDeckKind;
    cardId?: string;
}

export interface BetrayalActivityEntry {
    id: string;
    text: string;
    tone: BetrayalDiscoverySummary['tone'];
}

export interface BetrayalRolledDamageResult {
    damageKind: 'physical' | 'mental';
    rolls: number[];
    total: number;
    appliedAmount: number;
}

export type BetrayalEventRollRecentKind = 'eventTraitCheck' | 'eventDiceRoll';

export interface BetrayalSourceEventRollState {
    id: string;
    kind: BetrayalEventRollRecentKind;
    playerId: string;
    sourceTitle: string;
    eventDescription?: string;
    trait?: BetrayalTraitKey;
    rollLabel?: string;
    dice: number[];
    passiveBonus: number;
    total: number;
    latestLabel: string;
}

export interface BetrayalRecentRollState {
    id: string;
    kind:
        | BetrayalEventRollRecentKind
        | 'eventRolledDamage'
        | 'hauntRoll'
        | 'mysticElevator'
        | 'attackRoll'
        | 'roomEndTurnTraitCheck'
        | 'deathPrevention'
        | 'hauntActionTraitCheck'
        | 'monsterMoveRoll';
    playerId: string;
    sourceTitle: string;
    eventDescription?: string;
    trait?: BetrayalTraitKey;
    rollLabel?: string;
    dice: number[];
    passiveBonus: number;
    requiredPlayerIds?: string[];
    acknowledgedPlayerIds?: string[];
    branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
    latestLabel: string;
    eventRolledDamageResults?: BetrayalRolledDamageResult[];
    sourceEventRoll?: BetrayalSourceEventRollState;
    eventEffectSnapshot?: {
        traitsBeforeEffect: BetrayalExplorerSummary['traits'];
        traitTracksBeforeEffect: BetrayalTraitTrackMap;
        roomIdBeforeEffect: string;
        possessionOrderByKindBeforeEffect: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]>;
        currentExplorerInventoryBeforeEffect: BetrayalInventoryCard[];
        deckCountsBeforeEffect: Record<BetrayalDeckKind, number>;
        damageRolls: number[];
        rolledDamageResults: BetrayalRolledDamageResult[];
        drawnCards: BetrayalInventoryCard[];
    };
    roomId?: string;
    roomsBeforeRoll?: BetrayalRoomNode[];
    roomEndTurn?: {
        kind: BetrayalRoomEndTurnEffect;
        roomName: string;
        roomId: string;
        originalRoomId: string;
        traitsBeforeEffect: BetrayalExplorerSummary['traits'];
        previousPhysicalDamage: number;
        previousDestinationRoomId?: string;
        nextPlayerId?: string;
        monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
        turnLogText?: string;
        helpingHandsMonsterTurnControllerPlayerId?: string;
        skipBloodFromStoneMonsterTurnStart?: boolean;
    };
    attack?: {
        target: BetrayalHauntAttackTarget;
        defenderPlayerId?: string;
        damageKind: 'physical' | 'mental';
        previousDamageToAttacker: number;
        previousDamageToDefender: number;
        defenderRoll: number;
        defenderDefenseExtraDice?: number;
        attackerTraitsBeforeDamage: BetrayalExplorerSummary['traits'];
        defenderTraitsBeforeDamage?: BetrayalExplorerSummary['traits'];
        weaponCardId?: string;
        weaponName?: string;
        weaponAttackBonus?: number;
        weaponExtraDice?: number;
        weaponSpeedCost?: number;
        weaponAttackTrait?: BetrayalTraitKey;
    };
    deathPrevention?: {
        cardId: string;
        minTotal: number;
        damageKind: 'physical' | 'mental' | 'general';
        damageAmount: number;
        damageTraits?: BetrayalTraitKey[];
        traitsBeforeDamage: BetrayalExplorerSummary['traits'];
        scenarioRuntimeBeforeDefeat: BetrayalScenarioRuntimeStatus;
        monstersBeforeDefeat: BetrayalMonsterSummary[];
        releasedJackSpiritRoomId?: string;
        nextPlayerId?: string;
        monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
        turnLogText?: string;
        helpingHandsMonsterTurnControllerPlayerId?: string;
        skipBloodFromStoneMonsterTurnStart?: boolean;
    };
    consumedRabbitFootCardIds: string[];
    lastRabbitFootRerollDieIndex?: number;
    lastRabbitFootRerollPreviousDice?: number[];
}

export interface BetrayalPendingEventRollResolutionState {
    rollId: string;
    playerId: string;
    sourceTitle: string;
    effect: UseEffectProfile;
    requiredPlayerIds?: string[];
    acknowledgedPlayerIds?: string[];
    nextPendingEventChoice?: BetrayalPendingEventChoiceState;
    deathPrevention?: {
        playerId: string;
        cardId: string;
        rollTotal: number;
        dice: number[];
        minTotal: number;
        damageAmount: number;
        damageKind: 'physical' | 'mental' | 'general';
        damageTraits: BetrayalTraitKey[];
        traitsBeforeDamage: BetrayalExplorerSummary['traits'];
        prevented: boolean;
    };
    hauntTriggered?: boolean;
    hauntCardNumber?: number;
    hauntTriggerLabel?: string;
    hauntTraitorPlayerId?: string | null;
    hauntRevealResolution?: BetrayalHauntRevealResolution;
    hauntTraitorResolution?: BetrayalHauntTraitorResolution;
    dustSetup?: BetrayalDustRuntimeState;
    magicCameraSetup?: BetrayalMagicCameraRuntimeState;
    helpingHandsSetup?: BetrayalHelpingHandsRuntimeState;
    uponReflectionSetup?: BetrayalUponReflectionRuntimeState;
    hauntRoll?: {
        threshold: number;
        successHauntId: number;
        successHauntTriggerLabel?: string;
        successTraitorSelection?: 'current-explorer' | 'magic-camera-owner';
    };
    /** 多项独立检定停稳后，必须由触发玩家明确承接到下一规则阶段。 */
    requiresPlayerAdvance?: boolean;
    requiresAcknowledgement?: boolean;
}

export interface BetrayalPendingEventRollStartState {
    playerId: string;
    roomId: string;
    sourceTitle: string;
    eventDescription?: string;
}

export interface BetrayalMonsterMovementRollResult {
    monsterId: string;
    monsterName: string;
    playerId: string;
    speed: number;
    dice: number[];
    total: number;
    moveAllowance: number;
}

export interface BetrayalHelpingHandsMonsterTurnStartedPayload {
    controllerPlayerId: string;
    moveAllowance: number;
    moveDice: number[];
    logText: string;
}

export interface BetrayalTurnEndedPayload {
    previousPlayerId: string;
    nextPlayerId: string;
    logText: string;
    roomEndTurnEffect?: BetrayalRoomEndTurnEffectResult | null;
    monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
    helpingHandsMonsterTurnControllerPlayerId?: string;
    deferAdvanceUntilRollAcknowledged?: boolean;
    turnLogText?: string;
    dustEndTurn?: BetrayalDustEndTurnResult;
    magicCameraEndTurnCapturedEssencePlayerIds?: string[];
    deferredHelpingHandsMonsterTurnStart?: BetrayalHelpingHandsMonsterTurnStartedPayload;
    extraTurnAfterCurrentTurn?: BetrayalExtraTurnAfterCurrentTurnState;
    skipBloodFromStoneMonsterTurnStart?: boolean;
}

export interface BetrayalExtraTurnAfterCurrentTurnState {
    playerId: string;
    sourceCardId: string;
    sourceCardName: string;
}

export interface BetrayalPendingEventChoiceState {
    id: string;
    playerId: string;
    sourceTitle: string;
    eventDescription?: string;
    acceptLabel?: string;
    declineLabel?: string;
    effect: UseEffectProfile;
    sourceKind?: 'event' | 'item' | 'event-symbol-skip';
    eventSymbolSkip?: {
        roomId: string;
        roomName: string;
        method: 'idol' | 'traitorPower';
    };
    itemResolution?: 'tooth-necklace-end-turn';
    itemCardId?: string;
    deferredTurnEnd?: BetrayalTurnEndedPayload;
    allTraitCheckProgress?: {
        results: BetrayalAllTraitCheckResult[];
    };
}

export type BetrayalPendingCardResolutionStepKind = Extract<
    BetrayalDiscoveryResolutionStepKind,
    'room-effect' | 'room-discovery-card' | 'buried-room-discovery-card' | 'drawn-card' | 'haunt-roll' | 'event-effect'
>;

export interface BetrayalPendingCardResolutionProcessCard {
    cardId?: string;
    cardName: string;
    deckKind: BetrayalDeckKind;
    outcome: 'buried' | 'gained';
    text: string;
}

export interface BetrayalPendingCardResolutionState {
    id: string;
    playerId: string;
    requiredPlayerIds?: string[];
    acknowledgedPlayerIds?: string[];
    deckKind?: BetrayalDeckKind;
    cardId?: string;
    cardName: string;
    discoveryTitle: string;
    stepKind: BetrayalPendingCardResolutionStepKind;
    text: string;
    index: number;
    total: number;
    processCards?: BetrayalPendingCardResolutionProcessCard[];
}

export interface BetrayalPendingTradeAgreementState {
    id: string;
    playerId: string;
    targetPlayerId: string;
    cardIds: string[];
    targetCardIds: string[];
    useDog?: boolean;
    sourceCardId?: string;
}

export interface BetrayalPendingDamageAllocationState {
    id: string;
    playerId: string;
    sourceTitle: string;
    damageKind: 'physical' | 'mental' | 'general';
    amount: number;
    originalAmount: number;
    damageReductionAmount?: number;
    allowedTraits: BetrayalTraitKey[];
    damageReplacement?: {
        kind: 'brooch-general-damage';
        cardId: string;
        cardName: string;
    };
    forcedTraitSequence?: BetrayalTraitKey[];
    allowSkull: boolean;
    traitsBeforeDamage: BetrayalExplorerSummary['traits'];
    nextPlayerId?: string;
    nextDamageAllocations?: BetrayalPendingDamageAllocationState[];
    monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
    turnLogText?: string;
    helpingHandsMonsterTurnControllerPlayerId?: string;
    skipBloodFromStoneMonsterTurnStart?: boolean;
}

export interface BetrayalAllTraitCheckResult {
    trait: BetrayalTraitKey;
    total: number;
    dice: number[];
    passiveBonus: number;
    passed: boolean;
}

export interface BetrayalEndgameResult {
    hauntId:
        | 'mummy-rampage'
        | 'crimson-jack-returns'
        | 'the-dust'
        | 'blood-from-a-stone'
        | 'helping-hands'
        | 'magic-camera'
        | 'upon-reflection';
    hauntTitle: string;
    outcome: BetrayalScenarioOutcome;
    winners: string[];
    traitorPlayerId: string;
    survivorsEscaped: string[];
    reward: {
        stars: number;
        omens: number;
        logs: number;
    };
    stats: {
        roomsExplored: number;
        omensDrawn: number;
        itemsDrawn: number;
        eventsDrawn: number;
    };
}

export interface BetrayalDustSicknessToken {
    id: string;
    value: number | null;
}

export interface BetrayalDustRuntimeState {
    sicknessTokensByPlayerId: Record<string, BetrayalDustSicknessToken[]>;
    permanentTraitorPlayerIds: string[];
    researchRoomIds: string[];
    exchangedSicknessThisTurnPlayerIds: string[];
    feverishPlayerIds: string[];
    pendingSicknessExchange?: {
        id: string;
        requesterPlayerId: string;
        targetPlayerId: string;
    };
}

export interface BetrayalMagicCameraRuntimeState {
    cameraDestroyed: boolean;
    cameraHolderPlayerId: string | null;
    heroEssencePlayerIds: string[];
    capturedEssencePlayerIds: string[];
    phantomPhotographerIds: string[];
    killedPhantomPhotographerIds: string[];
    stunnedPhantomPhotographerIds: string[];
}

export interface BetrayalMummyRuntimeState {
    mummyMonsterId: string;
    sarcophagusRoomId: string;
    girlRoomId: string | null;
    girlHolderPlayerId: string | null;
    girlHeldByMummy: boolean;
    mummyCarriedOmenIds: string[];
    mummyCarriedCards: BetrayalInventoryCard[];
    pendingAttackReward?: BetrayalMummyAttackRewardChoice;
    knowledgeTokenCount: number;
    trueNameFound: boolean;
    banishmentSpellLearned: boolean;
    bookRequired: boolean;
    requiredOmenIds: string[];
}

export interface BetrayalHelpingHandsRuntimeState {
    strangeAmuletCardId: string;
    strangeAmuletFoundDuringSetup: boolean;
    trollHandIds: string[];
    monsterTurnAfterPlayerId: string;
    activeMonsterTurn: boolean;
    monsterTurnControllerPlayerId: string | null;
    trollHandMoveAllowance: number;
    trollHandMoveDice: number[];
    trollHandMoveRemainingById: Record<string, number>;
    trollHandAttackUsedIdsThisTurn: string[];
    pendingAttackReward?: BetrayalHelpingHandsAttackRewardChoice;
}

export interface BetrayalDustSicknessSwapResult {
    fromPlayerId: string;
    toPlayerId: string;
    fromTokenId: string;
    toTokenId: string;
}

export interface BetrayalUponReflectionSecretCombination {
    trait: BetrayalTraitKey;
    omenId: string;
    omenName: string;
    roomId: string | null;
    roomName: string;
    roomVisualId?: BetrayalRoomVisualId;
}

export interface BetrayalUponReflectionBreakAttempt {
    playerId: string;
    roomId: string;
    roomName: string;
    trait: BetrayalTraitKey;
    omenId: string;
    omenName: string;
    rollTotal: number;
    dice: number[];
    passiveBonus: number;
    successRoll: boolean;
    combinationCorrect: boolean;
}

export interface BetrayalUponReflectionHintedEvent {
    revealerPlayerId: string;
    targetPlayerId: string;
    eventName: string;
    eventText: string;
    turnNumber: number;
}

export interface BetrayalUponReflectionRuntimeState {
    revealerPlayerId: string;
    secretCombination: BetrayalUponReflectionSecretCombination | null;
    breakAttempts: BetrayalUponReflectionBreakAttempt[];
    hintedEvents: BetrayalUponReflectionHintedEvent[];
}

export interface BetrayalScenarioRuntimeStatus {
    hauntTriggered: boolean;
    hauntRevealerPlayerId: string | null;
    traitorPlayerId: string | null;
    hauntTraitorResolution: BetrayalHauntTraitorResolution | null;
    hauntFirstPlayerResolution: BetrayalHauntFirstPlayerResolution | null;
    nextHauntPlayerId: string | null;
    hauntRollThreshold: number;
    omensDiscovered: number;
    hauntCardNumber: number | null;
    hauntTriggerLabel: string | null;
    hauntScenarioCardId: BetrayalScenarioCardId | null;
    hauntScenarioCardTitle: string | null;
    hauntScenarioCardLabel: string | null;
    triggeringOmenId: string | null;
    triggeringOmenName: string | null;
    hauntResolutionMatchedTrigger: boolean;
    hauntResolutionRepresentativeOnly: boolean;
    jackSpiritReleased: boolean;
    jackSpiritRoomId: string | null;
    jackSpiritHasMovedSinceRelease: boolean;
    exorcismCircleRoomIds: string[];
    knowledgeOfJackPlayerIds: string[];
    deadExplorerPlayerIds: string[];
    traitorCorpseRoomId: string | null;
    corpseLootedByPlayerIdsThisTurn: string[];
    usedRoomEffectIdsThisTurn: string[];
    hauntSetupQueue: BetrayalHauntSetupQueueEntry[];
    monsterStatusesById: Record<string, BetrayalMonsterStatusKind>;
    monsterTurn: BetrayalMonsterTurnRuntimeState;
    bloodFromStone?: BetrayalBloodFromStoneMonsterTurnRuntimeState;
    bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: Record<string, string[]>;
    bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: string[];
    dust?: BetrayalDustRuntimeState;
    helpingHands?: BetrayalHelpingHandsRuntimeState;
    magicCamera?: BetrayalMagicCameraRuntimeState;
    mummy?: BetrayalMummyRuntimeState;
    uponReflection?: BetrayalUponReflectionRuntimeState;
}

export interface BetrayalCore {
    scenarioId: BetrayalScenarioId;
    scenarioCandidateIds: BetrayalScenarioCardId[];
    proposedScenarioCardId: BetrayalScenarioCardId;
    scenarioCardConfirmations: Record<string, BetrayalScenarioCardId>;
    phase: BetrayalPhase;
    playerIds: string[];
    seatControllers?: Record<string, AiSeatController>;
    selectedExplorerByPlayerId: Record<string, string>;
    readyPlayerIds: string[];
    currentPlayer: string;
    activePlayerId: string | null;
    turnStartSpeed: number;
    movesRemaining: number;
    recommendedAction: BetrayalRecommendedAction;
    activeRoomId: string;
    turnEndedByDiscovery: boolean;
    currentExplorer: BetrayalExplorerSummary;
    currentExplorerTraits: Record<BetrayalTraitKey, number>;
    currentExplorerInventory: BetrayalInventoryCard[];
    otherExplorers: BetrayalExplorerSummary[];
    monsters: BetrayalMonsterSummary[];
    drawOrder: BetrayalDeckKind[];
    roomDiscoveryDeck: BetrayalRoomDiscoveryDeckEntry[];
    roomDiscoveryOrderByFloor: Record<BetrayalRoomFloor, RoomTemplate[]>;
    buriedRoomTiles: BetrayalBuriedRoomTileSummary[];
    possessionOrderByKind: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]>;
    eventOrder: EventTemplate[];
    deckCounts: Record<BetrayalDeckKind, number>;
    discardCounts: Record<BetrayalDeckKind, number>;
    rooms: BetrayalRoomNode[];
    exploreIndex: number;
    usedCardIdsThisTurn: string[];
    tradeUsedThisTurnPlayerIds: string[];
    turnStartInventoryCardIds: string[];
    receivedCardIdsThisTurnByPlayerId: Record<string, string[]>;
    nextNonCombatTraitReplacement: {
        playerId: string;
        sourceCardId: string;
        replacementTrait: BetrayalTraitKey;
    } | null;
    nextNonCombatTraitRollTotalReplacement: {
        playerId: string;
        sourceCardId: string;
        sourceCardName: string;
        selectedTotal: number;
    } | null;
    pendingExtraTurnAfterCurrentTurn: BetrayalExtraTurnAfterCurrentTurnState | null;
    pendingEventChoice: BetrayalPendingEventChoiceState | null;
    pendingEventRollStart?: BetrayalPendingEventRollStartState | null;
    pendingCardResolutionQueue: BetrayalPendingCardResolutionState[];
    pendingTradeAgreement: BetrayalPendingTradeAgreementState | null;
    pendingDamageAllocation: BetrayalPendingDamageAllocationState | null;
    pendingEventRollResolution?: BetrayalPendingEventRollResolutionState | null;
    recentRoll: BetrayalRecentRollState | null;
    recentAllTraitCheck: {
        sourceTitle: string;
        playerId: string;
        results: BetrayalAllTraitCheckResult[];
    } | null;
    latestRoomDrawResolution: BetrayalRoomDrawResolution | null;
    latestDiscovery: BetrayalDiscoverySummary | null;
    latestDiscoveryOwnerPlayerId: string | null;
    highlightedDeckKind: BetrayalDeckKind | null;
    activityLog: BetrayalActivityEntry[];
    scenarioRuntime: BetrayalScenarioRuntimeStatus;
    endgameResult: BetrayalEndgameResult | null;
}

export type RoomTemplate = BetrayalRoomDiscoveryTemplate;

export type EventTemplate = BetrayalEventSeed;
