import { createBaseSystems, createGameEngine } from '../../engine';
import { registerGameAiRuntime } from '../../engine/ai';
import { registerCriticalImageResolver } from '../../core';
import type {
    Command,
    DomainCore,
    GameEvent,
    MatchState,
    PlayerId,
    RandomFn,
    ValidationResult,
} from '../../engine/types';
import { createCheatSystem } from '../../engine/systems';
import {
    BETRAYAL_ACTION_LOG_ALLOWLIST,
    BETRAYAL_UNDO_ALLOWLIST,
    formatBetrayalActionEntry,
} from './actionLog';
import { betrayalCriticalImageResolver } from './criticalImageResolver';
import { createBetrayalAiRuntime } from './ai';
import { BETRAYAL_COMMANDS } from './commands';
import { BETRAYAL_INITIAL_DECK_COUNTS } from './deckModel';
import {
    normalizeBetrayalDiceCount,
    rollBetrayalDicePips,
    rollBetrayalPip,
} from './diceRules';
import {
    canPlayerAcknowledgeRecentRoll,
    eventRollResolutionNeedsAcknowledgement,
    isPendingCardResolutionFullyAcknowledged,
    isPendingEventRollResolutionFullyAcknowledged,
    isRecentRollFullyAcknowledged,
    resolveAcknowledgeableRecentRoll,
    resolvePendingCardResolutionAcknowledgedPlayerIds,
    resolvePendingCardResolutionRequiredPlayerIds,
    resolvePendingEventRollResolutionAcknowledgedPlayerIds,
    resolvePendingEventRollResolutionRequiredPlayerIds,
    resolvePendingTurnEndRoll,
    resolveRecentRollAcknowledgedPlayerIds,
    resolveRecentRollRequiredPlayerIds,
    resolveRoomExploredCardResolutionRequiredPlayerIds,
} from './acknowledgementReadModel';
import {
    resolveBloodFromStoneSelectedExtraStoneCherubPlacements,
    resolveBloodFromStoneSetupPlacementPlan,
    type BetrayalBloodFromStoneSetupPlacement,
} from './bloodFromStoneSetupReadModel';
import {
    applyBetrayalCorpseLootedState,
    createBetrayalCorpseLootedPayload,
    resolveCorpseLootTargets,
    type BetrayalCorpseLootCommandPayload,
    type BetrayalCorpseLootedPayload,
} from './deathStateReadModel';
import { resolveBetrayalHauntRisk } from './hauntProgress';
import {
    MUMMY_GIRL_STEAL_CARD_ID,
    resolveHelpingHandsPendingAttackReward,
    resolveHelpingHandsStealableCards,
    resolveHelpingHandsTrollHandAttackOptions,
    resolveHelpingHandsTrollHandMoveCost,
    resolveHelpingHandsTrollHandMoveOptions,
    resolveMummyGirlStealCard,
    resolveMummyPendingAttackReward,
    resolveMummyStealableCards,
    type BetrayalHelpingHandsAttackRewardChoice,
    type BetrayalMummyAttackRewardChoice,
} from './hauntAttackRewardReadModel';
import {
    resolveBetrayalHauntSetupQueue,
    resolveHauntSetupQueueWithEntryStatus,
    type BetrayalHauntSetupQueueEntry,
    type BetrayalHauntSetupQueueEntryId,
} from './hauntSetupModel';
import {
    cloneHauntFirstPlayerResolution,
    cloneHauntTraitorResolution,
    resolveHauntFirstPlayerResolutionForTrigger,
    resolveHauntTraitorResolutionForTrigger,
    type BetrayalHauntFirstPlayerResolution,
    type BetrayalHauntTraitorResolution,
} from './hauntTraitorResolutionModel';
import {
    canCureTheDust,
    canSearchForCure,
    canSmashMagicCamera,
    canTakeMagicCameraPhoto,
    hasUsedHauntSpecialActionThisTurn,
    resolveBloodFromStonePeekabooSelection,
    validateHauntSpecialActionBudget,
} from './hauntSpecialActionReadModel';
import {
    findFeverishMonster,
    findHelpingHandsTrollHand,
    findMagicCameraHolderPlayerId,
    findMummyMonster,
    findPhantomPhotographer,
    findStrangeAmuletHolder,
    hasBloodFromStoneMirror,
    hasLivingHeroWithBookInRoom,
    hasOmenBook,
    HELPING_HANDS_STRANGE_AMULET_EFFECT_ID,
    isBetrayalLibraryRoom,
    isBloodFromStoneHaunt,
    isCrimsonJackHaunt,
    isDustHaunt,
    isHelpingHandsHaunt,
    isMagicCameraHaunt,
    isMummyHaunt,
    isMummyMonster,
    isMummyNameStudyRoom,
    isStrangeAmuletCard,
    isStoneCherubMonster,
    isUponReflectionHaunt,
    isBetrayalPlayerControllingMonster,
    resolveControlledRoomId,
    resolveHelpingHandsControllerPlayerId,
    resolveLivingHeroExplorers,
    shouldDeadPlayerControlFeverish,
    shouldDeadTraitorControlJackSpirit,
} from './hauntScenarioReadModel';
import {
    canPlayerControlStandardMonsterTurn,
    cloneBloodFromStoneMonsterTurnRuntimeState,
    cloneMonsterMovementRollGroupResult,
    cloneMonsterTurnRuntimeState,
    createBloodFromStoneTurnStartVisibility,
    createBetrayalMonsterMovementRollGroupResult,
    createInitialMonsterTurnRuntimeState,
    hasMummyTeleportMoveAvailable,
    resolveBetrayalMonsterMoveCost,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
    resolveBetrayalMonsterMovementRollGroupPreview,
    resolveBetrayalMonsterTurnStartResolutionPreview,
    resolveBetrayalNormalMonsterAttackTargets,
    resolveBloodFromStoneGazeDamageRolls,
    resolveBloodFromStoneMonsterTurnEndPreview,
    resolveBloodFromStoneMonsterTurnStatus,
    resolveBloodFromStoneNewLineOfSightDamageRoll,
    resolveBloodFromStoneTurnStartVisibleStoneCherubIds,
    resolveHelpingHandsMonsterTurnStatus,
    resolveMagicCameraPhantomAttackTargets,
    resolveMonsterAttackCommand,
    resolveStoneCherubMoveRemainingAfterMove,
    type BetrayalBloodFromStoneGazeDamageRoll,
    type BetrayalBloodFromStoneMonsterTurnRuntimeState,
    type BetrayalMonsterMovementRollGroupResult,
    type BetrayalMonsterTurnRuntimeState,
} from './monsterActionReadModel';
import {
    canUseBetrayalPossessionThisTurn,
    canUseBookForPendingEventRoll,
    canUseHolySymbolForDiscovery,
    canUseIdolToSkipEvent,
    canUseRabbitFootForRecentRoll,
    canUseSkeletonKeyForMove,
    resolveRabbitFootCard,
    resolveRecentRollRerollCommandDieIndices,
    resolveRecentRollRerollItemCard,
    resolveRecentRollRerollItemRule,
    resolveSkeletonKeyCardId,
    resolveTurnStartInventoryCardIds,
    clearPendingExtraTurnAfterCurrentTurn,
    isOwnDeathPreventionRerollWindow,
    validateBetrayalPossessionSpecialActionCommand,
    validateBetrayalRecentRollRerollItemCommand,
} from './possessionActionReadModel';
import { resolveBetrayalRoomSpecialActionStatus } from './roomActionReadModel';
import {
    moveMysticElevatorRoom,
    resolveMysticElevatorDestination,
    resolveMysticElevatorEffect,
    type BetrayalRoomEnterEffect,
    type BetrayalRoomEnterEffectResult,
} from './roomEnterEffectModel';
import { readBetrayalScenarioId } from './roomSetup';
import {
    canUseBetrayalTraitorPowers,
    isBetrayalDamagingRoomEndTurnEffect,
} from './traitorPowerRules';
import {
    BETRAYAL_SCENARIO_CARD_IDS,
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_EXPLORER_CATALOG,
    BETRAYAL_SCENARIO_CONFIGS,
    BETRAYAL_SHARED_PRE_HAUNT_SETUP,
    DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
    DEFAULT_BETRAYAL_SCENARIO_ID,
    getBetrayalScenarioCardCandidate,
    isBetrayalOptionalHauntRollRuntimeSupported,
    isBetrayalScenarioCardId,
    resolveBetrayalHauntRevealResolution,
    resolveImplementedScenarioIdForCard,
    type BetrayalDeckKind as ConfigDeckKind,
    type BetrayalHauntRevealResolution,
    type BetrayalRoomDoorway,
    type BetrayalRoomEdge,
    type BetrayalRoomFloor,
    type BetrayalRoomVisualId,
    type BetrayalEventSeed,
    type BetrayalInventoryKind as ConfigInventoryKind,
    type BetrayalInventorySeed,
    type BetrayalMonsterSeed,
    type BetrayalRecommendedAction as ConfigRecommendedAction,
    type BetrayalRoomDiscoverySymbol,
    type BetrayalRoomDiscoveryTemplate,
    type BetrayalRoomSeed,
    type BetrayalScenarioCardId,
    type BetrayalScenarioId,
    type BetrayalScenarioOutcome,
    type BetrayalTraitKey as ConfigTraitKey,
} from './scenarioConfig';
import {
    BETRAYAL_TRAIT_LABEL as TRAIT_LABEL,
    applyAdjacentRoomChoiceToEffect,
    applyChosenTraitToEffect,
    applyGeneralDamageTraitsToEffect,
    applyRoomTargetChoiceToEffect,
    cloneUseEffect,
    effectAllowsAdjacentRoomChoice,
    effectAllowsChosenTrait,
    effectAllowsGeneralDamageTraits,
    effectAllowsRoomTargetChoice,
    effectHasUnresolvedChosenTraitChoice,
    effectHasUnresolvedGeneralDamageChoice,
    effectHasUnresolvedTraitChoice,
    effectNeedsAdjacentRoomChoice,
    effectNeedsRoomTargetChoice,
    effectNeedsTraitChoice,
    eventEffectNeedsPendingEventChoice,
    formatEffectLabel,
    isWarningEventEffect,
    resolveInventoryEffectId,
    resolveUseEffect,
    type PossessionUseEffectProfile,
    type UseEffectProfile,
} from './possessionEffects';
import {
    applyItemChoiceToEffect,
    effectAllowsItemChoice,
} from './possessionItemChoiceModel';
import {
    resolveBetrayalPossessionUsedPayload,
    type BetrayalPossessionUseCommandPayload,
} from './possessionUseResolution';
import { applyBetrayalPossessionUsedState } from './possessionUseState';
import {
    DRAW_POOL,
    buryPossessionCardToBottom,
    cloneInventoryCard,
    clonePossessionOrderByKind,
    removePossessionCardFromDeck,
    restorePossessionCardToBottom,
    restorePossessionCardToTop,
} from './possessionDeckModel';
import {
    EVENT_POOL,
    buryEventCardToBottom,
    cloneEventTemplate,
    countDrawnCards,
    removeEventCardForUponReflectionHint,
    resolveEvent,
} from './eventDeckModel';
import {
    createBetrayalMonsterFromDefinition,
    type BetrayalMonsterDefinitionId,
} from './domain/monsterDefinitions';
import {
    resolveBetrayalMonsterDamageOutcome,
    resolveMonsterDefaultAttackTrait,
    resolveMonsterStatusKind,
    resolveMonsterTrait,
    type BetrayalMonsterDamageOutcome,
} from './monsterReadModel';
import {
    findExplorerByPlayerId,
    getAllExplorers,
    getExplorersInTurnOrder,
    resolveExplorerRoom,
    resolveTurnStartSpeed,
} from './explorerReadModel';
import {
    applyGeneralDamage,
    applyTraitLoss,
    BETRAYAL_TRAIT_KEYS,
    buildTraitTracksFromTemplate,
    buildTraitTracksFromValues,
    cloneTraitTracks,
    damageTraitsAreAssignable,
    healExplorerTraitToStart,
    moveExplorerTraitSteps,
    normalizeExplorerTraitTracks,
    resolveTraitDamageAssignableSteps,
    setExplorerTraitPosition,
    setExplorerTraitsFromValues,
} from './traitTrackModel';
import {
    cloneBetrayalRoom,
    formatRoomTargetList,
    refreshExplorableRoomSlots,
    isStraightLineVisible,
    resolveOppositeRoomEdge,
    roomTileAdjustmentSelectionsMatch,
    roomDistanceByLayout,
} from './roomMapModel';
import {
    resolveBetrayalMoveCost,
    resolveMoveTargetRooms,
} from './movementReadModel';
import {
    ROOM_DISCOVERY_DECK_POOL,
    applyRoomDrawResolutionToCore,
    canConnectDoorwaysToEntry,
    cloneBuriedRoomTileSummary,
    cloneRoomDiscoveryDeckEntry,
    cloneRoomDrawResolution,
    cloneRoomTemplate,
    groupRoomDiscoveryDeckByFloor,
    hasAvailableDiscoveryDeckCard,
    isRoomOrientationTurns,
    makeRoomDiscoveryDeckFromFloorPools,
    materializeRoomsAfterTileAdjustment,
    orientDoorwaysForPlacement,
    resolveCurrentRoomDiscoveryDeck,
    resolveExplorableRoomSlots,
    resolveNextExplorableRoomSlot,
    resolveRoomDraw,
    resolveRoomPlacementContext,
    resolveRoomPlacementOrientationOptions,
    resolveRoomTemplateDiscoveryDeckKind,
    resolveRoomTileAdjustmentOptionsForPlacement,
} from './roomDiscoveryModel';
import {
    formatAttackRangeLabel,
    isAttackTargetInWeaponRange,
    isAttackWeaponCard,
    isDynamiteCardId,
    isDynamiteTargetRoom,
    resolveAttackWeaponEffect,
    resolveDefenseExtraDiceWhenAttacked,
    resolveDynamiteInventoryCard,
    resolveFailedAttackDamage,
    resolveFailedAttackDamageForWeaponCard,
} from './attackRules';
import {
    applyBetrayalTradeAcceptedState,
    canUseDogForTrade,
    clearBetrayalPendingTradeAgreement,
    createBetrayalPendingTradeAgreement,
    createBetrayalTradeRequestedPayload,
    resolveBetrayalTradeAgreementEventPayload,
    resolveBetrayalTradeCardStatus,
    resolveDogTradeTargets,
    resolveTradeCardIds,
    resolveTradeTargets,
    type BetrayalTradeAcceptedPayload,
    type BetrayalTradeDeclinedPayload,
    type BetrayalTradePossessionCommandPayload,
    type BetrayalTradeRequestedPayload,
} from './trade';
import {
    resolveNextLivingPlayerIdInTurnOrder,
    rotateToNextLivingPlayer,
} from './turnOrderReadModel';

export { resolveUseEffect } from './possessionEffects';
export { resolveInventoryEffectId } from './possessionEffects';
export type { PossessionUseEffectProfile, UseEffectProfile } from './possessionEffects';
export {
    BETRAYAL_MONSTER_DEFINITIONS,
    createBetrayalMonsterFromDefinition,
    getBetrayalMonsterDefinition,
} from './domain/monsterDefinitions';
export type {
    BetrayalMonsterDefinition,
    BetrayalMonsterDefinitionId,
} from './domain/monsterDefinitions';

export type BetrayalTraitKey = ConfigTraitKey;
export type BetrayalInventoryKind = ConfigInventoryKind;
export type BetrayalDeckKind = ConfigDeckKind;
export type { BetrayalRoomDiscoverySymbol };
export type { BetrayalRoomEdge, BetrayalRoomVisualId, BetrayalRoomFloor };
export type BetrayalPhase = 'characterSelect' | 'preHaunt' | 'haunt' | 'endgame';
export type BetrayalRecommendedAction = ConfigRecommendedAction;
type BetrayalRoomEndTurnEffect = NonNullable<BetrayalRoomDiscoveryTemplate['endTurnEffect']>;
type BetrayalRoomDiscoveryEffect = NonNullable<BetrayalRoomDiscoveryTemplate['discoveryEffect']>;
export type BetrayalRoomMarkerToken = 'obstacle' | 'secretPassage' | 'blessing';
type BetrayalHauntAttackTarget =
    | 'traitor'
    | 'hero'
    | 'jack-spirit'
    | 'phantom-photographer'
    | 'troll-hand'
    | 'dynamite-room';

const HELPING_HANDS_STRANGE_AMULET_CARD_ID = HELPING_HANDS_STRANGE_AMULET_EFFECT_ID;
const BROOCH_CARD_ID = 'brooch';
const TOOTH_NECKLACE_CARD_ID = 'tooth-necklace';
const HELPING_HANDS_STRANGE_AMULET_CARD: BetrayalInventoryCard = {
    id: HELPING_HANDS_STRANGE_AMULET_CARD_ID,
    name: '奇异护符',
    kind: 'item',
};
const HELPING_HANDS_TROLL_HAND_TOKEN_ASSETS = [
    'betrayal/tokens/monsters/troll-right-hand',
    'betrayal/tokens/monsters/troll-left-hand',
] as const;
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

interface BetrayalDynamiteExplorerRoll {
    playerId: string;
    displayName: string;
    dice: number[];
    passiveBonus: number;
    total: number;
    passed: boolean;
    traitsBeforeDamage: BetrayalExplorerSummary['traits'];
}

interface BetrayalDynamiteMonsterRoll {
    monsterId: string;
    monsterName: string;
    dice: number[];
    total: number;
    passed: boolean;
    monsterDamageOutcome?: BetrayalMonsterDamageOutcome | null;
}

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
    room: Pick<BetrayalRoomNode, 'name' | 'hint' | 'tags' | 'discoveryReward' | 'visualId' | 'doorways' | 'backVisualId' | 'orientationTurns' | 'discoveryEffect' | 'endTurnEffect' | 'enterEffect'>;
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

export interface BetrayalTileStackSearchCriteria {
    roomName?: string;
    visualId?: BetrayalRoomVisualId;
    floor?: BetrayalRoomFloor;
}

export interface BetrayalTileStackSearchRoomSummary {
    floor: BetrayalRoomFloor;
    name: string;
    visualId: BetrayalRoomVisualId;
}

export interface BetrayalTileStackSearchDiscoveredRoomSummary {
    roomId: string;
    floor: BetrayalRoomFloor;
    name: string;
    visualId: BetrayalRoomVisualId;
}

export interface BetrayalTileStackSearchResult {
    requestedRoomName?: string;
    requestedVisualId?: BetrayalRoomVisualId;
    requestedFloor?: BetrayalRoomFloor;
    foundRoom: BetrayalTileStackSearchRoomSummary | null;
    searchedCount: number;
    remainingCount: number;
    reshuffled: boolean;
}

export interface BetrayalTileStackSearchPreview {
    requestedRoomName?: string;
    requestedVisualId?: BetrayalRoomVisualId;
    requestedFloor?: BetrayalRoomFloor;
    searchedCount: number;
    candidateRooms: BetrayalTileStackSearchRoomSummary[];
    firstCandidate: BetrayalTileStackSearchRoomSummary | null;
    discoveredRooms: BetrayalTileStackSearchDiscoveredRoomSummary[];
    targetAlreadyInHouse: boolean;
    canSearch: boolean;
    willRemoveFirstCandidate: boolean;
    willReshuffleAfterSearch: boolean;
    remainingCountAfterSearch: number;
    reason: string | null;
    ruleNotes: string[];
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
    | 'room-effect'
    | 'room-discovery-card'
    | 'buried-room-discovery-card'
    | 'drawn-card'
    | 'haunt-roll'
    | 'event-effect';

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

interface BetrayalRoomEndTurnEffectResult {
    kind: BetrayalRoomEndTurnEffect;
    playerId: string;
    roomId: string;
    roomName: string;
    destinationRoomId?: string;
    speedRoll?: number;
    speedRollDice?: number[];
    speedRollPassiveBonus?: number;
    physicalDamage?: number;
    ignoredByTraitorPower?: boolean;
}

interface BetrayalRolledDamageResult {
    damageKind: 'physical' | 'mental';
    rolls: number[];
    total: number;
    appliedAmount: number;
}

type BetrayalEventRollRecentKind = 'eventTraitCheck' | 'eventDiceRoll';

interface BetrayalSourceEventRollState {
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
    kind: BetrayalEventRollRecentKind | 'eventRolledDamage' | 'hauntRoll' | 'mysticElevator' | 'attackRoll' | 'roomEndTurnTraitCheck' | 'deathPrevention' | 'hauntActionTraitCheck' | 'monsterMoveRoll';
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
    requiresAcknowledgement?: boolean;
}

export interface BetrayalPendingEventRollStartState {
    playerId: string;
    roomId: string;
    sourceTitle: string;
    eventDescription?: string;
}

interface BetrayalEventRollReplacementResult {
    dice: number[];
    passiveBonus: number;
    total: number;
    latestLabel: string;
    effect: UseEffectProfile;
    hauntRoll?: BetrayalPendingEventRollResolutionState['hauntRoll'];
    nextPendingEventChoice?: BetrayalPendingEventChoiceState;
    deathPrevention?: BetrayalPendingEventRollResolutionState['deathPrevention'];
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

interface BetrayalHelpingHandsMonsterTurnStartedPayload {
    controllerPlayerId: string;
    moveAllowance: number;
    moveDice: number[];
    logText: string;
}

interface BetrayalTurnEndedPayload {
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

interface BetrayalExtraTurnAfterCurrentTurnState {
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
    hauntId: 'mummy-rampage' | 'crimson-jack-returns' | 'the-dust' | 'blood-from-a-stone' | 'helping-hands' | 'magic-camera' | 'upon-reflection';
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

interface BetrayalDustEndTurnResult {
    swaps: BetrayalDustSicknessSwapResult[];
    damagePlayerId?: string;
    damageAmount?: number;
    damageTraits?: BetrayalTraitKey[];
    defeatedPlayerId?: string;
    feverishPlayerId?: string;
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

export type BetrayalCommandType = typeof BETRAYAL_COMMANDS[keyof typeof BETRAYAL_COMMANDS];

export type BetrayalCommandMap = {
    [BETRAYAL_COMMANDS.SELECT_EXPLORER]: { explorerId: string };
    [BETRAYAL_COMMANDS.CONFIRM_EXPLORER]: Record<string, never>;
    [BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD]: { candidateId: BetrayalScenarioCardId };
    [BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD]: Record<string, never>;
    [BETRAYAL_COMMANDS.START_SCENARIO]: { scenarioId?: BetrayalScenarioId };
    [BETRAYAL_COMMANDS.MOVE_TO_ROOM]: { roomId: string; useSkeletonKey?: boolean };
    [BETRAYAL_COMMANDS.EXPLORE_ROOM]: {
        roomId?: string;
        orientationTurns?: 0 | 1 | 2 | 3;
        useHolySymbol?: boolean;
        useIdol?: boolean;
        ignoreEventSymbolWithTraitorPower?: boolean;
        roomTileAdjustment?: BetrayalRoomTileAdjustmentSelection;
    };
    [BETRAYAL_COMMANDS.ROLL_EVENT]: { sourceTitle?: string };
    [BETRAYAL_COMMANDS.USE_POSSESSION]: BetrayalPossessionUseCommandPayload;
    [BETRAYAL_COMMANDS.USE_RABBIT_FOOT]: { cardId?: string; dieIndex?: number };
    [BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM]: { cardId?: string; dieIndex?: number };
    [BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL]: { rollId?: string };
    [BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE]: { accept?: boolean; trait?: BetrayalTraitKey; traits?: BetrayalTraitKey[]; targetRoomId?: string; cardId?: string };
    [BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION]: { resolutionId?: string };
    [BETRAYAL_COMMANDS.USE_ROOM_EFFECT]: Record<string, never>;
    [BETRAYAL_COMMANDS.TRADE_POSSESSION]: BetrayalTradePossessionCommandPayload;
    [BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT]: { accept: boolean };
    [BETRAYAL_COMMANDS.LOOT_CORPSE]: BetrayalCorpseLootCommandPayload;
    [BETRAYAL_COMMANDS.END_TURN]: Record<string, never>;
    [BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL]: Record<string, never>;
    [BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL]: Record<string, never>;
    [BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION]: { traits?: BetrayalTraitKey[]; useBrooch?: boolean };
    [BETRAYAL_COMMANDS.HAUNT_ATTACK]: {
        target: BetrayalHauntAttackTarget;
        targetPlayerId?: string;
        targetMonsterId?: string;
        targetRoomId?: string;
        weaponCardId?: string;
    };
    [BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE]: {
        monsterId?: string;
        damageAmount?: number;
        damageTrait?: BetrayalTraitKey;
    };
    [BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START]: { monsterId?: string };
    [BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP]: { groupId?: string };
    [BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM]: { monsterId?: string; roomId?: string };
    [BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO]: { monsterId?: string; targetPlayerId?: string };
    [BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN]: Record<string, never>;
    [BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS]: { roomIds?: string[] };
    [BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE]: { trait?: BetrayalTraitKey; omenId?: string; omenName?: string };
    [BETRAYAL_COMMANDS.GIVE_MIRROR_HINT]: { eventName?: string; targetPlayerId?: string };
    [BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD]: { choice?: 'damage' | 'steal'; cardId?: string };
    [BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND]: { monsterId?: string; roomId?: string };
    [BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK]: { monsterId?: string; targetPlayerId?: string; combined?: boolean };
    [BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN]: Record<string, never>;
    [BETRAYAL_COMMANDS.LEARN_ABOUT_JACK]: Record<string, never>;
    [BETRAYAL_COMMANDS.STUDY_EXORCISM]: Record<string, never>;
    [BETRAYAL_COMMANDS.EXORCISE_JACK]: Record<string, never>;
    [BETRAYAL_COMMANDS.STUDY_MUMMY_NAME]: Record<string, never>;
    [BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT]: Record<string, never>;
    [BETRAYAL_COMMANDS.BANISH_MUMMY]: Record<string, never>;
    [BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL]: Record<string, never>;
    [BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY]: Record<string, never>;
    [BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY]: { cardId?: string };
    [BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD]: { choice?: 'damage' | 'steal'; cardId?: string };
    [BETRAYAL_COMMANDS.SEARCH_FOR_CURE]: { trait?: Extract<BetrayalTraitKey, 'knowledge' | 'sanity'> };
    [BETRAYAL_COMMANDS.CURE_THE_DUST]: { trait?: BetrayalTraitKey };
    [BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE]: { targetPlayerId?: string };
    [BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE]: { accept: boolean };
    [BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY]: { entryId?: BetrayalHauntSetupQueueEntryId };
    [BETRAYAL_COMMANDS.TAKE_PHOTO]: { targetPlayerId?: string; trait?: BetrayalTraitKey };
    [BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA]: Record<string, never>;
    [BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK]: { monsterId?: string; targetPlayerId?: string };
    [BETRAYAL_COMMANDS.PLAY_PEEKABOO]: { sameRoomMonsterId?: string; lineOfSightMonsterId?: string };
    [BETRAYAL_COMMANDS.COMPLETE_SCENARIO]: Record<string, never>;
};

export type BetrayalCommand = {
    [Type in keyof BetrayalCommandMap]: Command<Type & string, BetrayalCommandMap[Type]>
}[keyof BetrayalCommandMap];

const EVENTS = {
    EXPLORER_SELECTED: 'EXPLORER_SELECTED',
    EXPLORER_CONFIRMED: 'EXPLORER_CONFIRMED',
    SCENARIO_CARD_PROPOSED: 'SCENARIO_CARD_PROPOSED',
    SCENARIO_CARD_CONFIRMED: 'SCENARIO_CARD_CONFIRMED',
    SCENARIO_STARTED: 'SCENARIO_STARTED',
    EXPLORER_MOVED: 'EXPLORER_MOVED',
    ROOM_EXPLORED: 'ROOM_EXPLORED',
    EVENT_CHOICE_RESOLVED: 'EVENT_CHOICE_RESOLVED',
    EVENT_ROLLED: 'EVENT_ROLLED',
    TOOTH_NECKLACE_CHOICE_STARTED: 'TOOTH_NECKLACE_CHOICE_STARTED',
    TOOTH_NECKLACE_TRAIT_GAINED: 'TOOTH_NECKLACE_TRAIT_GAINED',
    CARD_RESOLUTION_ACKNOWLEDGED: 'CARD_RESOLUTION_ACKNOWLEDGED',
    POSSESSION_USED: 'POSSESSION_USED',
    RABBIT_FOOT_USED: 'RABBIT_FOOT_USED',
    EVENT_ROLL_FINALIZED: 'EVENT_ROLL_FINALIZED',
    ROOM_EFFECT_USED: 'ROOM_EFFECT_USED',
    POSSESSION_TRADE_REQUESTED: 'POSSESSION_TRADE_REQUESTED',
    POSSESSION_TRADED: 'POSSESSION_TRADED',
    POSSESSION_TRADE_DECLINED: 'POSSESSION_TRADE_DECLINED',
    CORPSE_LOOTED: 'CORPSE_LOOTED',
    TURN_ENDED: 'TURN_ENDED',
    RECENT_ROLL_ACKNOWLEDGED: 'RECENT_ROLL_ACKNOWLEDGED',
    TURN_END_ROLL_ACKNOWLEDGED: 'TURN_END_ROLL_ACKNOWLEDGED',
    DAMAGE_ALLOCATION_RESOLVED: 'DAMAGE_ALLOCATION_RESOLVED',
    HAUNT_TRIGGERED: 'HAUNT_TRIGGERED',
    HAUNT_ATTACK_RESOLVED: 'HAUNT_ATTACK_RESOLVED',
    DYNAMITE_ATTACK_RESOLVED: 'DYNAMITE_ATTACK_RESOLVED',
    MONSTER_DAMAGE_RESOLVED: 'MONSTER_DAMAGE_RESOLVED',
    MONSTER_TURN_START_RESOLVED: 'MONSTER_TURN_START_RESOLVED',
    MONSTER_MOVEMENT_GROUP_ROLLED: 'MONSTER_MOVEMENT_GROUP_ROLLED',
    MONSTER_MOVED: 'MONSTER_MOVED',
    MONSTER_ATTACK_HERO_RESOLVED: 'MONSTER_ATTACK_HERO_RESOLVED',
    BLOOD_FROM_STONE_MONSTER_TURN_ENDED: 'BLOOD_FROM_STONE_MONSTER_TURN_ENDED',
    BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED: 'BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED',
    HELPING_HANDS_ATTACK_REWARD_RESOLVED: 'HELPING_HANDS_ATTACK_REWARD_RESOLVED',
    HELPING_HANDS_MONSTER_TURN_STARTED: 'HELPING_HANDS_MONSTER_TURN_STARTED',
    HELPING_HANDS_TROLL_HAND_MOVED: 'HELPING_HANDS_TROLL_HAND_MOVED',
    HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED: 'HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED',
    HELPING_HANDS_MONSTER_TURN_ENDED: 'HELPING_HANDS_MONSTER_TURN_ENDED',
    JACK_LEARNED: 'JACK_LEARNED',
    EXORCISM_STUDIED: 'EXORCISM_STUDIED',
    JACK_EXORCISED: 'JACK_EXORCISED',
    MUMMY_NAME_STUDIED: 'MUMMY_NAME_STUDIED',
    MUMMY_BANISHMENT_LEARNED: 'MUMMY_BANISHMENT_LEARNED',
    MUMMY_BANISHED: 'MUMMY_BANISHED',
    MUMMY_GIRL_PICKED_UP: 'MUMMY_GIRL_PICKED_UP',
    MUMMY_GIRL_GIVEN: 'MUMMY_GIRL_GIVEN',
    MUMMY_OMEN_GIVEN: 'MUMMY_OMEN_GIVEN',
    MUMMY_ATTACK_REWARD_RESOLVED: 'MUMMY_ATTACK_REWARD_RESOLVED',
    DUST_SEARCH_RESOLVED: 'DUST_SEARCH_RESOLVED',
    DUST_CURE_RESOLVED: 'DUST_CURE_RESOLVED',
    SICKNESS_EXCHANGE_REQUESTED: 'SICKNESS_EXCHANGE_REQUESTED',
    SICKNESS_EXCHANGE_RESOLVED: 'SICKNESS_EXCHANGE_RESOLVED',
    HAUNT_SETUP_ENTRY_CONFIRMED: 'HAUNT_SETUP_ENTRY_CONFIRMED',
    PHOTO_TAKEN: 'PHOTO_TAKEN',
    MAGIC_CAMERA_SMASHED: 'MAGIC_CAMERA_SMASHED',
    PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED: 'PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED',
    BLOOD_FROM_STONE_PEEKABOO_RESOLVED: 'BLOOD_FROM_STONE_PEEKABOO_RESOLVED',
    UPON_REFLECTION_CURSE_BREAK_ATTEMPTED: 'UPON_REFLECTION_CURSE_BREAK_ATTEMPTED',
    UPON_REFLECTION_EVENT_HINT_GIVEN: 'UPON_REFLECTION_EVENT_HINT_GIVEN',
    SCENARIO_COMPLETED: 'SCENARIO_COMPLETED',
} as const;

type BetrayalEvent =
    | GameEvent<typeof EVENTS.EXPLORER_SELECTED, { playerId: string; explorerId: string }>
    | GameEvent<typeof EVENTS.EXPLORER_CONFIRMED, { playerId: string }>
    | GameEvent<typeof EVENTS.SCENARIO_CARD_PROPOSED, { playerId: string; candidateId: BetrayalScenarioCardId; title: string; logText: string }>
    | GameEvent<typeof EVENTS.SCENARIO_CARD_CONFIRMED, { playerId: string; candidateId: BetrayalScenarioCardId; title: string; logText: string }>
    | GameEvent<typeof EVENTS.SCENARIO_STARTED, { playerIds: string[]; scenarioId: BetrayalScenarioId }>
    | GameEvent<typeof EVENTS.EXPLORER_MOVED, {
        playerId: string;
        roomId: string;
        logText: string;
        moveCost?: number;
        consumeMove?: boolean;
        usedActionId?: string;
        controlledToken?: 'jack-spirit' | 'feverish';
        skeletonKeyCardId?: string;
        skeletonKeyRoll?: number;
        skeletonKeyBuried?: boolean;
        bloodFromStoneTurnStartVisibleStoneCherubIds?: string[];
        bloodFromStoneNewLineOfSightDamageRoll?: BetrayalBloodFromStoneGazeDamageRoll;
    }>
    | GameEvent<typeof EVENTS.ROOM_EXPLORED, {
        playerId: string;
        roomId: string;
        room: Pick<BetrayalRoomNode, 'name' | 'hint' | 'tags' | 'discoveryReward' | 'visualId' | 'doorways' | 'backVisualId' | 'orientationTurns' | 'discoveryEffect' | 'endTurnEffect' | 'enterEffect'>;
        deckKind: BetrayalDeckKind | null;
        drawnCard?: BetrayalInventoryCard;
        roomDiscoveryCards?: BetrayalInventoryCard[];
        buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
        eventEffect?: UseEffectProfile;
        eventDescription?: string;
        eventRollPending?: {
            kind?: 'trait' | 'dice';
            trait?: BetrayalTraitKey;
            dice?: number;
            label?: string;
        };
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
        eventRoll?: {
            kind?: 'trait' | 'dice';
            trait?: BetrayalTraitKey;
            total: number;
            label: string;
            eventDescription?: string;
            rollLabel?: string;
            dice?: number[];
            passiveBonus?: number;
            branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
        };
        skippedEventWithIdol?: {
            name: string;
        };
        skippedEventWithTraitorPower?: boolean;
        skippedEventWithUponReflection?: boolean;
        skippedRoomWithHolySymbol?: {
            name: string;
        };
        roomDrawResolution?: BetrayalRoomDrawResolution;
        discovery: BetrayalDiscoverySummary;
        nextPendingEventChoice?: BetrayalPendingEventChoiceState;
        logText: string;
        mummyForcedOmenSearch?: {
            role: 'hero-book' | 'traitor-wedding-omen';
            cardId: string;
            cardName: string;
            shuffledOmenDeck: BetrayalInventoryCard[];
        };
        hauntRoll?: BetrayalHauntRollResult;
        hauntTriggered?: boolean;
        hauntRevealResolution?: BetrayalHauntRevealResolution;
        roomTileAdjustment?: BetrayalRoomTileAdjustmentSelection;
    }>
    | GameEvent<typeof EVENTS.EVENT_CHOICE_RESOLVED, {
        playerId: string;
        sourceTitle: string;
        eventDescription?: string;
        accepted: boolean;
        hauntTriggered?: boolean;
        hauntTraitorPlayerId?: string | null;
        hauntCardNumber?: number;
        hauntTriggerLabel?: string;
        hauntRevealResolution?: BetrayalHauntRevealResolution;
        hauntTraitorResolution?: BetrayalHauntTraitorResolution;
        dustSetup?: BetrayalDustRuntimeState;
        magicCameraSetup?: BetrayalMagicCameraRuntimeState;
        helpingHandsSetup?: BetrayalHelpingHandsRuntimeState;
        uponReflectionSetup?: BetrayalUponReflectionRuntimeState;
        hauntRoll?: BetrayalPendingEventRollResolutionState['hauntRoll'];
        nextPendingEventChoice?: BetrayalPendingEventChoiceState;
        eventEffect?: UseEffectProfile;
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
        eventRoll?: {
            kind?: 'trait' | 'dice';
            trait?: BetrayalTraitKey;
            total: number;
            label: string;
            eventDescription?: string;
            rollLabel?: string;
            dice?: number[];
            passiveBonus?: number;
            branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
        };
        drawnEventCardNameToBury?: string;
        discovery: BetrayalDiscoverySummary;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.EVENT_ROLLED, {
        rollId: string;
        playerId: string;
        sourceTitle: string;
        eventDescription?: string;
        eventEffect?: UseEffectProfile;
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
        eventRoll: {
            kind?: 'trait' | 'dice';
            trait?: BetrayalTraitKey;
            total: number;
            label: string;
            eventDescription?: string;
            rollLabel?: string;
            dice?: number[];
            passiveBonus?: number;
            branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
        };
        nextPendingEventChoice?: BetrayalPendingEventChoiceState;
        discovery: BetrayalDiscoverySummary;
        drawnEventCardNameToBury?: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.TOOTH_NECKLACE_CHOICE_STARTED, {
        playerId: string;
        cardId: string;
        cardName: string;
        allowedTraits: BetrayalTraitKey[];
        deferredTurnEnd: BetrayalTurnEndedPayload;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.TOOTH_NECKLACE_TRAIT_GAINED, {
        playerId: string;
        cardId: string;
        cardName: string;
        accepted: boolean;
        trait?: BetrayalTraitKey;
        deferredTurnEnd: BetrayalTurnEndedPayload;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.CARD_RESOLUTION_ACKNOWLEDGED, {
        playerId: string;
        resolution: BetrayalPendingCardResolutionState;
        remainingCount: number;
        acknowledgedPlayerIds?: string[];
        remainingAcknowledgementCount?: number;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.POSSESSION_USED, {
        playerId: string;
        cardId: string;
        effect: PossessionUseEffectProfile;
        targetPlayerId?: string;
        targetRoomId?: string;
        targetRoomIdsByTokenId?: Record<string, string>;
        replacementRollTotal?: number;
        eventRollReplacement?: BetrayalEventRollReplacementResult;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.RABBIT_FOOT_USED, {
        playerId: string;
        cardId: string;
        cardName?: string;
        dieIndex: number;
        newPip: number;
        dieIndices?: number[];
        newPips?: number[];
        mentalDamageAfterReroll?: number;
        eventRerollEffect?: UseEffectProfile;
        eventRerollDeathPrevention?: BetrayalPendingEventRollResolutionState['deathPrevention'];
        eventRerollHaunt?: Omit<BetrayalPendingEventRollResolutionState, 'rollId' | 'playerId' | 'sourceTitle' | 'effect' | 'requiredPlayerIds' | 'acknowledgedPlayerIds' | 'nextPendingEventChoice' | 'deathPrevention' | 'hauntRoll'>;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.EVENT_ROLL_FINALIZED, {
        rollId: string;
        playerId: string;
        triggerPlayerId: string;
        sourceTitle: string;
        requiredPlayerIds: string[];
        acknowledgedPlayerIds: string[];
        remainingAcknowledgementCount: number;
        isFullyAcknowledged: boolean;
        effect: UseEffectProfile;
        nextPendingEventChoice?: BetrayalPendingEventChoiceState;
        deathPrevention?: BetrayalPendingEventRollResolutionState['deathPrevention'];
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
        hauntRoll?: BetrayalPendingEventRollResolutionState['hauntRoll'];
        logText: string;
    }>
    | GameEvent<typeof EVENTS.ROOM_EFFECT_USED, { playerId: string; effect: BetrayalRoomEnterEffectResult; logText: string }>
    | GameEvent<typeof EVENTS.POSSESSION_TRADE_REQUESTED, BetrayalTradeRequestedPayload>
    | GameEvent<typeof EVENTS.POSSESSION_TRADED, BetrayalTradeAcceptedPayload>
    | GameEvent<typeof EVENTS.POSSESSION_TRADE_DECLINED, BetrayalTradeDeclinedPayload>
    | GameEvent<typeof EVENTS.CORPSE_LOOTED, BetrayalCorpseLootedPayload>
    | GameEvent<typeof EVENTS.TURN_ENDED, BetrayalTurnEndedPayload>
    | GameEvent<typeof EVENTS.RECENT_ROLL_ACKNOWLEDGED, {
        playerId: string;
        rollId: string;
        sourceTitle: string;
        requiredPlayerIds: string[];
        acknowledgedPlayerIds: string[];
        remainingAcknowledgementCount: number;
        isFullyAcknowledged: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.TURN_END_ROLL_ACKNOWLEDGED, {
        previousPlayerId: string;
        nextPlayerId: string;
        logText: string;
        monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
        helpingHandsMonsterTurnControllerPlayerId?: string;
        skipBloodFromStoneMonsterTurnStart?: boolean;
    }>
    | GameEvent<typeof EVENTS.DAMAGE_ALLOCATION_RESOLVED, {
        playerId: string;
        sourceTitle: string;
        damageKind: 'physical' | 'mental' | 'general';
        amount: number;
        traits: BetrayalTraitKey[];
        nextPlayerId?: string;
        monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
        turnLogText?: string;
        helpingHandsMonsterTurnControllerPlayerId?: string;
        skipBloodFromStoneMonsterTurnStart?: boolean;
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
            releasedJackSpiritRoomId?: string;
            nextPlayerId?: string;
            monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
            turnLogText?: string;
            helpingHandsMonsterTurnControllerPlayerId?: string;
            skipBloodFromStoneMonsterTurnStart?: boolean;
            prevented: boolean;
        };
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HAUNT_TRIGGERED, {
        traitorPlayerId: string | null;
        hauntRevealerPlayerId?: string;
        nextPlayerId: string;
        hauntCardNumber?: number;
        hauntTriggerLabel: string;
        hauntRevealResolution?: BetrayalHauntRevealResolution;
        hauntTraitorResolution?: BetrayalHauntTraitorResolution;
        hauntFirstPlayerResolution?: BetrayalHauntFirstPlayerResolution;
        dustSetup?: BetrayalDustRuntimeState;
        magicCameraSetup?: BetrayalMagicCameraRuntimeState;
        helpingHandsSetup?: BetrayalHelpingHandsRuntimeState;
        uponReflectionSetup?: BetrayalUponReflectionRuntimeState;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HAUNT_ATTACK_RESOLVED, {
        attackerPlayerId: string;
        target: BetrayalHauntAttackTarget;
        defenderPlayerId?: string;
        defenderMonsterId?: string;
        defeatedPlayerId?: string;
        defeatedMonsterId?: string;
        defeatedMonsterRoomId?: string;
        releasedJackSpiritRoomId?: string;
        monsterDamageOutcome?: BetrayalMonsterDamageOutcome;
        outcome: 'wound' | 'traitor-defeated' | 'hero-defeated' | 'jack-damaged' | 'phantom-killed' | 'phantom-stunned' | 'troll-hand-resisted' | 'no-damage';
        attackerRoll?: number;
        defenderRoll?: number;
        damageToAttacker?: number;
        damageToDefender?: number;
        damageKind?: 'physical' | 'mental';
        weaponCardId?: string;
        weaponName?: string;
        weaponAttackBonus?: number;
        weaponExtraDice?: number;
        weaponSpeedCost?: number;
        weaponAttackTrait?: BetrayalTraitKey;
        attackRoll?: {
            id: string;
            dice: number[];
            passiveBonus: number;
            latestLabel: string;
            attackerTraitsBeforeDamage: BetrayalExplorerSummary['traits'];
            defenderTraitsBeforeDamage?: BetrayalExplorerSummary['traits'];
        };
        deathPrevention?: {
            playerId: string;
            cardId: string;
            rollTotal: number;
            dice: number[];
            minTotal: number;
            damageAmount: number;
            damageKind: 'physical' | 'mental';
            traitsBeforeDamage: BetrayalExplorerSummary['traits'];
            releasedJackSpiritRoomId?: string;
            prevented: boolean;
        };
        helpingHandsAttackRewardChoice?: BetrayalHelpingHandsAttackRewardChoice;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.DYNAMITE_ATTACK_RESOLVED, {
        attackerPlayerId: string;
        cardId: string;
        cardName: string;
        targetRoomId: string;
        targetRoomName: string;
        explorerRolls: BetrayalDynamiteExplorerRoll[];
        monsterRolls: BetrayalDynamiteMonsterRoll[];
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MONSTER_DAMAGE_RESOLVED, {
        playerId: string;
        monsterId: string;
        monsterName: string;
        damageAmount: number;
        damageTrait: BetrayalTraitKey;
        monsterDamageOutcome: BetrayalMonsterDamageOutcome;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MONSTER_TURN_START_RESOLVED, {
        playerId: string;
        monsterId: string;
        monsterName: string;
        previousStatus: BetrayalMonsterStatusKind;
        nextStatus: BetrayalMonsterStatusKind;
        flippedStunnedSideUp: boolean;
        skippedTurn: boolean;
        startedTurn: boolean;
        movementGroupId?: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MONSTER_MOVEMENT_GROUP_ROLLED, {
        result: BetrayalMonsterMovementRollGroupResult;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MONSTER_MOVED, {
        playerId: string;
        monsterId: string;
        monsterName: string;
        fromRoomId: string;
        toRoomId: string;
        moveCost: number;
        moveRemaining: number;
        teleportMove: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MONSTER_ATTACK_HERO_RESOLVED, {
        playerId: string;
        monsterId: string;
        monsterName: string;
        targetPlayerId: string;
        attackTrait: BetrayalTraitKey;
        damageKind: 'physical' | 'mental';
        monsterRoll: number;
        heroRoll: number;
        damageToHero?: number;
        monsterDamageOutcome?: BetrayalMonsterDamageOutcome;
        dice: number[];
        defenderTraitsBeforeDamage: BetrayalExplorerSummary['traits'];
        logText: string;
    }>
    | GameEvent<typeof EVENTS.BLOOD_FROM_STONE_MONSTER_TURN_ENDED, {
        controllerPlayerId: string;
        nextPlayerId: string;
        damageRolls: BetrayalBloodFromStoneGazeDamageRoll[];
        logText: string;
        turnLogText: string;
    }>
    | GameEvent<typeof EVENTS.BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED, {
        playerId: string;
        placements: BetrayalBloodFromStoneSetupPlacement[];
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED, {
        attackerPlayerId: string;
        defenderPlayerId: string;
        choice: 'damage' | 'steal';
        stolenCardId?: string;
        stolenCardName?: string;
        damageToDefender?: number;
        damageKind?: 'physical' | 'mental';
        defeatedPlayerId?: string;
        deathPrevention?: {
            playerId: string;
            cardId: string;
            rollTotal: number;
            dice: number[];
            minTotal: number;
            damageAmount: number;
            damageKind: 'physical' | 'mental';
            traitsBeforeDamage: BetrayalExplorerSummary['traits'];
            prevented: boolean;
        };
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED, BetrayalHelpingHandsMonsterTurnStartedPayload>
    | GameEvent<typeof EVENTS.HELPING_HANDS_TROLL_HAND_MOVED, {
        controllerPlayerId: string;
        monsterId: string;
        fromRoomId: string;
        toRoomId: string;
        moveCost: number;
        moveRemaining: number;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED, {
        controllerPlayerId: string;
        targetPlayerId: string;
        trollHandIds: string[];
        combined: boolean;
        attackDice?: number[];
        attackerRoll: number;
        defenderRoll: number;
        damageToDefender?: number;
        defenderTraitsBeforeDamage?: BetrayalExplorerSummary['traits'];
        defeatedPlayerId?: string;
        deathPrevention?: {
            playerId: string;
            cardId: string;
            rollTotal: number;
            dice: number[];
            minTotal: number;
            damageAmount: number;
            damageKind: 'physical' | 'mental';
            traitsBeforeDamage: BetrayalExplorerSummary['traits'];
            prevented: boolean;
        };
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HELPING_HANDS_MONSTER_TURN_ENDED, {
        controllerPlayerId: string;
        nextPlayerId: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.JACK_LEARNED, {
        playerId: string;
        grantedToPlayerId: string | null;
        rollTotal: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.EXORCISM_STUDIED, {
        playerId: string;
        roomId: string;
        rollTotal: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.JACK_EXORCISED, {
        playerId: string;
        roomId: string;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        regionBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_NAME_STUDIED, {
        playerId: string;
        roomId: string;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_BANISHMENT_LEARNED, {
        playerId: string;
        roomId: string;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_BANISHED, {
        playerId: string;
        roomId: string;
        heroRoll: number;
        mummyRoll: number;
        heroDice: number[];
        mummyDice: number[];
        passiveBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_GIRL_PICKED_UP, {
        playerId: string;
        roomId: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_GIRL_GIVEN, {
        playerId: string;
        monsterId: string;
        roomId: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_OMEN_GIVEN, {
        playerId: string;
        monsterId: string;
        roomId: string;
        cardId: string;
        cardName: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MUMMY_ATTACK_REWARD_RESOLVED, {
        controllerPlayerId: string;
        monsterId: string;
        monsterName: string;
        defenderPlayerId: string;
        choice: 'damage' | 'steal';
        stolenCardId?: string;
        stolenCardName?: string;
        damageToHero?: number;
        damageKind?: 'physical';
        logText: string;
    }>
    | GameEvent<typeof EVENTS.DUST_SEARCH_RESOLVED, {
        playerId: string;
        roomId: string;
        trait: Extract<BetrayalTraitKey, 'knowledge' | 'sanity'>;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        success: boolean;
        swap?: BetrayalDustSicknessSwapResult;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.DUST_CURE_RESOLVED, {
        playerId: string;
        roomId: string;
        trait: BetrayalTraitKey;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        researchBonus: number;
        success: boolean;
        swap?: BetrayalDustSicknessSwapResult;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.SICKNESS_EXCHANGE_REQUESTED, {
        requesterPlayerId: string;
        targetPlayerId: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.SICKNESS_EXCHANGE_RESOLVED, {
        requesterPlayerId: string;
        targetPlayerId: string;
        accepted: boolean;
        swap?: BetrayalDustSicknessSwapResult;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HAUNT_SETUP_ENTRY_CONFIRMED, {
        playerId: string;
        entryId: BetrayalHauntSetupQueueEntryId;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.PHOTO_TAKEN, {
        playerId: string;
        targetPlayerId: string;
        trait: BetrayalTraitKey;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.MAGIC_CAMERA_SMASHED, {
        playerId: string;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        success: boolean;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED, {
        monsterId: string;
        targetPlayerId: string;
        monsterRoll: number;
        heroRoll: number;
        damageToHero?: number;
        defeatedPlayerId?: string;
        dice: number[];
        logText: string;
    }>
    | GameEvent<typeof EVENTS.BLOOD_FROM_STONE_PEEKABOO_RESOLVED, {
        playerId: string;
        sameRoomMonsterId: string;
        lineOfSightMonsterId: string;
        rollTotal: number;
        dice: number[];
        passiveBonus: number;
        mirrorBonus: number;
        success: boolean;
        damageDice?: number[];
        damageAmount?: number;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.UPON_REFLECTION_CURSE_BREAK_ATTEMPTED, {
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
        logText: string;
    }>
    | GameEvent<typeof EVENTS.UPON_REFLECTION_EVENT_HINT_GIVEN, {
        revealerPlayerId: string;
        targetPlayerId: string;
        eventName: string;
        eventText: string;
        turnNumber: number;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.SCENARIO_COMPLETED, { result: BetrayalEndgameResult }>;

export const EXPLORER_CATALOG: BetrayalExplorerTemplate[] = BETRAYAL_EXPLORER_CATALOG.map((entry) => ({ ...entry }));

type RoomTemplate = BetrayalRoomDiscoveryTemplate;

type EventTemplate = BetrayalEventSeed;
type EventEffectSnapshot = NonNullable<BetrayalRecentRollState['eventEffectSnapshot']>;

type RolledDamageAllocationDeferral = {
    sourceTitle: string;
    timestamp: number;
    allocations: BetrayalPendingDamageAllocationState[];
};

type ApplyEventEffectOptions = {
    deferRolledDamageAllocation?: RolledDamageAllocationDeferral;
};

type MaterializeEventEffectOptions = {
    materializeRandomResults?: boolean;
};

interface BetrayalHauntRollResult {
    dice: number[];
    total: number;
    threshold: number;
    triggered: boolean;
    automatic: boolean;
}

const DRAW_ORDER: BetrayalDeckKind[] = [...BETRAYAL_DISCOVERY_POOLS.drawOrder];

const TRAIT_CHECK_PASSIVE_BONUSES: Record<string, Partial<Record<BetrayalTraitKey, number>>> = {
    'omen-book': { knowledge: 1 },
    skull: { knowledge: 1 },
    dog: { speed: 1 },
    mask: { speed: 1 },
    'holy-symbol': { sanity: 1 },
    ring: { sanity: 1 },
    idol: { might: 1 },
};

const TRAIT_CHECK_REPLACEMENTS_BY_CARD_ID: Record<string, Partial<Record<BetrayalTraitKey, BetrayalTraitKey>>> = {
    camera: { knowledge: 'sanity' },
};

const EVENT_TRAIT_CHECK_EXTRA_DICE_BY_CARD_ID: Record<string, number> = {
    flashlight: 2,
    lantern: 2,
};

const PHYSICAL_DAMAGE_REDUCTION_BY_CARD_ID: Record<string, number> = {
    armor: 1,
};

const MENTAL_DAMAGE_REDUCTION_BY_CARD_ID: Record<string, number> = {
    radio: 1,
};

const DEATH_PREVENTION_ROLL_CARDS_BY_ID: Record<string, { dice: number; minTotal: number }> = {
    skull: { dice: 3, minTotal: 4 },
};

const MUMMY_WEDDING_OMEN_CARD_IDS = new Set(['holy-symbol', 'ring']);

function makeTileStackSearchRoomSummary(
    entry: BetrayalRoomDiscoveryDeckEntry,
): BetrayalTileStackSearchRoomSummary {
    return {
        floor: entry.floor,
        name: entry.room.name,
        visualId: entry.room.visualId,
    };
}

function roomDiscoveryEntryMatchesTileStackSearch(
    entry: BetrayalRoomDiscoveryDeckEntry,
    criteria: BetrayalTileStackSearchCriteria,
): boolean {
    const requestedRoomName = criteria.roomName?.trim();
    if (requestedRoomName && entry.room.name !== requestedRoomName) {
        return false;
    }
    if (criteria.visualId && entry.room.visualId !== criteria.visualId) {
        return false;
    }
    if (criteria.floor && entry.floor !== criteria.floor) {
        return false;
    }
    return Boolean(requestedRoomName || criteria.visualId || criteria.floor);
}

function discoveredRoomMatchesTileStackSearch(
    room: BetrayalRoomNode,
    criteria: BetrayalTileStackSearchCriteria,
): boolean {
    const requestedRoomName = criteria.roomName?.trim();
    if (requestedRoomName && room.name !== requestedRoomName) {
        return false;
    }
    if (criteria.visualId && room.visualId !== criteria.visualId) {
        return false;
    }
    if (criteria.floor && room.floor !== criteria.floor) {
        return false;
    }
    return Boolean(requestedRoomName || criteria.visualId || criteria.floor);
}

export function resolveBetrayalTileStackSearchPreview(
    core: BetrayalCore,
    criteria: BetrayalTileStackSearchCriteria,
): BetrayalTileStackSearchPreview {
    const deck = resolveCurrentRoomDiscoveryDeck(core);
    const requestedRoomName = criteria.roomName?.trim() || undefined;
    const hasSpecificRoomTarget = Boolean(requestedRoomName || criteria.visualId);
    const discoveredRooms = core.rooms
        .filter((room) => room.state === 'discovered')
        .filter((room) => discoveredRoomMatchesTileStackSearch(room, criteria))
        .map((room): BetrayalTileStackSearchDiscoveredRoomSummary => ({
            roomId: room.id,
            floor: room.floor,
            name: room.name,
            visualId: room.visualId,
        }));
    const targetAlreadyInHouse = hasSpecificRoomTarget && discoveredRooms.length > 0;
    const candidateRooms = deck
        .filter((entry) => roomDiscoveryEntryMatchesTileStackSearch(entry, criteria))
        .map(makeTileStackSearchRoomSummary);
    let reason: string | null = null;
    if (!requestedRoomName && !criteria.visualId && !criteria.floor) {
        reason = '没有指定要搜索的房间或楼层。';
    } else if (targetAlreadyInHouse) {
        reason = '目标房间已经在屋内，不需要搜索房间堆。';
    } else if (candidateRooms.length === 0) {
        reason = '房间堆中没有命中的板块。';
    }
    const canSearch = reason === null;
    return {
        requestedRoomName,
        requestedVisualId: criteria.visualId,
        requestedFloor: criteria.floor,
        searchedCount: deck.length,
        candidateRooms,
        firstCandidate: candidateRooms[0] ?? null,
        discoveredRooms,
        targetAlreadyInHouse,
        canSearch,
        willRemoveFirstCandidate: canSearch,
        willReshuffleAfterSearch: canSearch,
        remainingCountAfterSearch: canSearch ? Math.max(0, deck.length - 1) : deck.length,
        reason,
        ruleNotes: [
            '作祟或 setup 要求寻找特定房间时，若该房间已在屋内则不再搜索房间堆。',
            '若从房间堆命中特定板块，应移除该板块并重洗剩余房间堆。',
            '当前读模型只表达搜索候选与重洗后果，不等于玩家可见搜索面板或逐作祟 setup 放置流程完成。',
        ],
    };
}

export function applyBetrayalTileStackSearch(
    core: BetrayalCore,
    criteria: BetrayalTileStackSearchCriteria,
    random: RandomFn,
): { core: BetrayalCore; result: BetrayalTileStackSearchResult } {
    const deck = resolveCurrentRoomDiscoveryDeck(core);
    const foundIndex = deck.findIndex((entry) => roomDiscoveryEntryMatchesTileStackSearch(entry, criteria));
    const baseResult = {
        requestedRoomName: criteria.roomName?.trim() || undefined,
        requestedVisualId: criteria.visualId,
        requestedFloor: criteria.floor,
        searchedCount: deck.length,
    };
    if (foundIndex < 0) {
        return {
            core: cloneCore(core),
            result: {
                ...baseResult,
                foundRoom: null,
                remainingCount: deck.length,
                reshuffled: false,
            },
        };
    }

    const foundEntry = deck[foundIndex]!;
    const remainingDeck = [
        ...deck.slice(0, foundIndex),
        ...deck.slice(foundIndex + 1),
    ];
    const shuffledRemainingDeck = random.shuffle(remainingDeck).map(cloneRoomDiscoveryDeckEntry);
    const nextCore = cloneCore(core);
    nextCore.roomDiscoveryDeck = shuffledRemainingDeck;
    nextCore.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(shuffledRemainingDeck);
    nextCore.latestRoomDrawResolution = null;
    return {
        core: syncCurrentExplorerProjection(nextCore),
        result: {
            ...baseResult,
            foundRoom: makeTileStackSearchRoomSummary(foundEntry),
            remainingCount: shuffledRemainingDeck.length,
            reshuffled: true,
        },
    };
}

function resolveRoomEndTurnEffect(room: BetrayalRoomNode | null | undefined): BetrayalRoomEndTurnEffect | undefined {
    return room?.state === 'discovered' ? room.endTurnEffect : undefined;
}

function cloneDiscoverySummary(discovery: BetrayalDiscoverySummary): BetrayalDiscoverySummary {
    return {
        ...discovery,
        resolutionSteps: discovery.resolutionSteps?.map((step) => ({ ...step })),
    };
}

function buildDiscoveryResolutionStepKey(step: BetrayalDiscoveryResolutionStep): string {
    return step.id;
}

function mergePreviousDiscoveryResolutionSteps(
    previousDiscovery: BetrayalDiscoverySummary | null,
    discovery: BetrayalDiscoverySummary,
): void {
    if (
        previousDiscovery?.kind !== discovery.kind
        || previousDiscovery.title !== discovery.title
        || !previousDiscovery.resolutionSteps?.length
    ) {
        return;
    }
    const mergedSteps = [
        ...previousDiscovery.resolutionSteps,
        ...(discovery.resolutionSteps ?? []),
    ];
    const mergedStepByKey = new Map<string, BetrayalDiscoveryResolutionStep>();
    for (const step of mergedSteps) {
        mergedStepByKey.set(buildDiscoveryResolutionStepKey(step), step);
    }
    discovery.resolutionSteps = Array.from(mergedStepByKey.values(), (step) => ({ ...step }));
}

function clonePendingCardResolution(
    resolution: BetrayalPendingCardResolutionState,
): BetrayalPendingCardResolutionState {
    return {
        ...resolution,
        requiredPlayerIds: resolution.requiredPlayerIds
            ? [...resolution.requiredPlayerIds]
            : undefined,
        acknowledgedPlayerIds: resolution.acknowledgedPlayerIds
            ? [...resolution.acknowledgedPlayerIds]
            : undefined,
        processCards: resolution.processCards
            ? resolution.processCards.map((card) => ({ ...card }))
            : undefined,
    };
}

function acknowledgeEventEffectCardResolution(
    core: BetrayalCore,
    sourceTitle: string,
    playerId: string,
): void {
    core.pendingCardResolutionQueue = (core.pendingCardResolutionQueue ?? [])
        .flatMap((resolution) => {
            if (
                resolution.stepKind !== 'event-effect'
                || resolution.discoveryTitle !== sourceTitle
            ) {
                return [resolution];
            }
            const requiredPlayerIds = resolvePendingCardResolutionRequiredPlayerIds(resolution);
            const acknowledgedPlayerIds = Array.from(new Set([
                ...resolvePendingCardResolutionAcknowledgedPlayerIds(resolution),
                playerId,
            ]));
            return isPendingCardResolutionFullyAcknowledged(
                core,
                { ...resolution, requiredPlayerIds, acknowledgedPlayerIds },
                acknowledgedPlayerIds,
            )
                ? []
                : [{ ...resolution, requiredPlayerIds, acknowledgedPlayerIds }];
        });
}

function isPendingCardResolutionStepKind(
    kind: BetrayalDiscoveryResolutionStepKind,
): kind is BetrayalPendingCardResolutionStepKind {
    return kind === 'room-discovery-card'
        || kind === 'room-effect'
        || kind === 'buried-room-discovery-card'
        || kind === 'drawn-card'
        || kind === 'haunt-roll'
        || kind === 'event-effect';
}

function createPendingCardResolutionQueue(options: {
    playerId: string;
    requiredPlayerIds: string[];
    roomId: string;
    timestamp: number;
    deckKind: BetrayalDeckKind | null;
    discovery: BetrayalDiscoverySummary;
    drawnCard?: BetrayalInventoryCard;
    roomDiscoveryCards?: BetrayalInventoryCard[];
    buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
}): BetrayalPendingCardResolutionState[] {
    const explicitSteps = options.discovery.resolutionSteps
        ?.filter((step) => isPendingCardResolutionStepKind(step.kind));
    if (!options.drawnCard && !(explicitSteps?.length)) {
        return [];
    }
    const cards = [
        ...(options.roomDiscoveryCards ?? []),
        ...(options.buriedRoomDiscoveryCards ?? []),
        ...(options.drawnCard ? [options.drawnCard] : []),
    ];
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const steps = explicitSteps?.length
        ? explicitSteps
        : options.drawnCard
            ? [{
            id: `drawn-card-${options.drawnCard.id}`,
            kind: 'drawn-card' as const,
            text: `已加入持有区：${options.drawnCard.name}`,
            deckKind: options.deckKind,
            cardId: options.drawnCard.id,
            }]
            : [];
    const visibleAcknowledgementSteps = collapseRoomDiscoverySearchResolutionSteps(
        collapseSameScreenOmenResolutionSteps(steps),
        cardById,
    );

    return visibleAcknowledgementSteps.map((step, index) => {
        const processCards = 'processCards' in step ? step.processCards : undefined;
        const card = step.cardId ? cardById.get(step.cardId) : undefined;
        const deckKind = step.deckKind === 'event' || step.deckKind === 'item' || step.deckKind === 'omen'
            ? step.deckKind
            : step.kind === 'room-effect'
                ? undefined
                : options.deckKind;
        return {
            id: `${options.playerId}-${options.roomId}-${options.timestamp}-${step.id}`,
            playerId: options.playerId,
            requiredPlayerIds: Array.from(new Set(options.requiredPlayerIds)),
            acknowledgedPlayerIds: [],
            deckKind,
            cardId: step.cardId,
            cardName: card?.name ?? (step.kind === 'room-effect' ? step.text : deckKind === 'event' ? options.discovery.title : step.text),
            discoveryTitle: options.discovery.title,
            stepKind: step.kind,
            text: step.text,
            index: index + 1,
            total: visibleAcknowledgementSteps.length,
            processCards: processCards?.map((processCard) => ({ ...processCard })),
        };
    });
}

function isRoomDiscoverySearchResolutionStep(
    step: BetrayalDiscoveryResolutionStep,
): boolean {
    return step.kind === 'room-discovery-card' || step.kind === 'buried-room-discovery-card';
}

function collapseRoomDiscoverySearchResolutionSteps(
    steps: BetrayalDiscoveryResolutionStep[],
    cardById: Map<string, BetrayalInventoryCard>,
): Array<BetrayalDiscoveryResolutionStep & { processCards?: BetrayalPendingCardResolutionProcessCard[] }> {
    const collapsed: Array<BetrayalDiscoveryResolutionStep & { processCards?: BetrayalPendingCardResolutionProcessCard[] }> = [];
    for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]!;
        if (!isRoomDiscoverySearchResolutionStep(step)) {
            collapsed.push(step);
            continue;
        }
        const searchSteps: BetrayalDiscoveryResolutionStep[] = [];
        while (index < steps.length && isRoomDiscoverySearchResolutionStep(steps[index]!)) {
            searchSteps.push(steps[index]!);
            index += 1;
        }
        index -= 1;

        const gainedStep = [...searchSteps].reverse().find((candidate) => candidate.kind === 'room-discovery-card');
        const finalStep = gainedStep ?? searchSteps[searchSteps.length - 1]!;
        const processCards = searchSteps.map((searchStep) => {
            const card = searchStep.cardId ? cardById.get(searchStep.cardId) : undefined;
            return {
                cardId: searchStep.cardId,
                cardName: card?.name ?? searchStep.text,
                deckKind: searchStep.deckKind ?? 'item',
                outcome: searchStep.kind === 'buried-room-discovery-card' ? 'buried' as const : 'gained' as const,
                text: searchStep.text,
            };
        });
        collapsed.push({
            ...finalStep,
            id: `room-discovery-search-${searchSteps.map((searchStep) => searchStep.id).join('-')}`,
            kind: 'room-discovery-card',
            text: searchSteps.map((searchStep) => searchStep.text).join('；'),
            deckKind: finalStep.deckKind ?? 'item',
            cardId: finalStep.cardId,
            processCards,
        });
    }
    return collapsed;
}

function collapseSameScreenOmenResolutionSteps(
    steps: BetrayalDiscoveryResolutionStep[],
): BetrayalDiscoveryResolutionStep[] {
    const collapsed: BetrayalDiscoveryResolutionStep[] = [];
    for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]!;
        const nextStep = steps[index + 1];
        if (
            step.kind === 'drawn-card'
            && nextStep?.kind === 'haunt-roll'
            && step.deckKind === 'omen'
            && nextStep.deckKind === 'omen'
            && step.cardId
            && step.cardId === nextStep.cardId
        ) {
            collapsed.push({
                ...step,
                id: `${step.id}-with-${nextStep.id}`,
                text: `${step.text}；${nextStep.text}`,
            });
            index += 1;
            continue;
        }
        collapsed.push(step);
    }
    return collapsed;
}

function withEventChoiceResolutionStep(discovery: BetrayalDiscoverySummary): BetrayalDiscoverySummary {
    if (discovery.kind !== 'event' || discovery.resolutionSteps?.length) {
        return discovery;
    }
    const discoveryText = [discovery.summary, discovery.detail].join(' ');
    if (
        discoveryText.includes('没有抽取或结算事件卡')
        || discoveryText.includes('不抽取或结算事件卡')
    ) {
        return discovery;
    }
    const detail = discovery.detail.trim();
    return {
        ...discovery,
        resolutionSteps: [{
            id: `event-effect-${discovery.title}`,
            kind: 'event-effect',
            text: `事件效果：${detail || discovery.summary}`,
            deckKind: 'event',
        }],
    };
}

function resolveChooseTraitRollPreviewEffect(
    core: BetrayalCore,
    effect: Extract<UseEffectProfile, { mode: 'chooseTraitRoll' }>,
    selectedTrait: BetrayalTraitKey,
): UseEffectProfile {
    const previewRollTotal = resolveNonCombatTraitCheckValue(core, core.currentExplorer, selectedTrait);
    const previewBranch = resolveEventBranch(effect.branches, previewRollTotal);
    return applyChosenTraitToEffect(cloneUseEffect(previewBranch.effect), selectedTrait);
}

function createShuffledDiscoveryState(random: RandomFn) {
    const roomDiscoveryDeck = random.shuffle(ROOM_DISCOVERY_DECK_POOL.map(cloneRoomDiscoveryDeckEntry));
    return {
        drawOrder: random.shuffle([...DRAW_ORDER]),
        roomDiscoveryDeck,
        roomDiscoveryOrderByFloor: groupRoomDiscoveryDeckByFloor(roomDiscoveryDeck),
        possessionOrderByKind: {
            item: random.shuffle(DRAW_POOL.item.map(cloneInventoryCard)),
            omen: random.shuffle(DRAW_POOL.omen.map(cloneInventoryCard)),
        } satisfies Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]>,
        eventOrder: random.shuffle(EVENT_POOL.map(cloneEventTemplate)),
    };
}

const DEFAULT_BETRAYAL_RANDOM: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.max(1, Math.min(max, 1)),
    range: (min) => min,
    shuffle: (array) => [...array],
};

const nowEvent = <TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    timestamp: number,
): GameEvent<TType, TPayload> => ({
    type,
    payload,
    timestamp,
});

function cloneExplorer(explorer: BetrayalExplorerSummary): BetrayalExplorerSummary {
    const cloned = {
        ...explorer,
        traits: { ...explorer.traits },
        traitTracks: explorer.traitTracks
            ? cloneTraitTracks(explorer.traitTracks)
            : buildTraitTracksFromValues(explorer.explorerId, explorer.traits),
        inventory: explorer.inventory.map(cloneInventoryCard),
    };
    normalizeExplorerTraitTracks(cloned);
    return cloned;
}

function cloneMonster(monster: BetrayalMonsterSummary): BetrayalMonsterSummary {
    return { ...monster };
}

function cloneMonsterSeed(monster: BetrayalMonsterSeed): BetrayalMonsterSummary {
    return { ...monster };
}

function cloneDustRuntimeState(dust: BetrayalDustRuntimeState): BetrayalDustRuntimeState {
    return {
        sicknessTokensByPlayerId: Object.fromEntries(
            Object.entries(dust.sicknessTokensByPlayerId).map(([playerId, tokens]) => [
                playerId,
                tokens.map((token) => ({ ...token })),
            ]),
        ),
        permanentTraitorPlayerIds: [...dust.permanentTraitorPlayerIds],
        researchRoomIds: [...dust.researchRoomIds],
        exchangedSicknessThisTurnPlayerIds: [...dust.exchangedSicknessThisTurnPlayerIds],
        feverishPlayerIds: [...dust.feverishPlayerIds],
        pendingSicknessExchange: dust.pendingSicknessExchange
            ? { ...dust.pendingSicknessExchange }
            : undefined,
    };
}

function cloneMonsterMovementRollResult(
    result: BetrayalMonsterMovementRollResult,
): BetrayalMonsterMovementRollResult {
    return {
        ...result,
        dice: [...result.dice],
    };
}

function cloneRoomEndTurnEffectResult(
    result: BetrayalRoomEndTurnEffectResult,
): BetrayalRoomEndTurnEffectResult {
    return {
        ...result,
        speedRollDice: result.speedRollDice ? [...result.speedRollDice] : undefined,
    };
}

function cloneDustEndTurnResult(result: BetrayalDustEndTurnResult): BetrayalDustEndTurnResult {
    return {
        ...result,
        swaps: result.swaps.map((swap) => ({ ...swap })),
        damageTraits: result.damageTraits ? [...result.damageTraits] : undefined,
    };
}

function cloneTurnEndedPayload(payload: BetrayalTurnEndedPayload): BetrayalTurnEndedPayload {
    return {
        ...payload,
        roomEndTurnEffect: payload.roomEndTurnEffect
            ? cloneRoomEndTurnEffectResult(payload.roomEndTurnEffect)
            : payload.roomEndTurnEffect,
        monsterMovementRoll: payload.monsterMovementRoll
            ? cloneMonsterMovementRollResult(payload.monsterMovementRoll)
            : payload.monsterMovementRoll,
        dustEndTurn: payload.dustEndTurn
            ? cloneDustEndTurnResult(payload.dustEndTurn)
            : undefined,
        magicCameraEndTurnCapturedEssencePlayerIds: payload.magicCameraEndTurnCapturedEssencePlayerIds
            ? [...payload.magicCameraEndTurnCapturedEssencePlayerIds]
            : undefined,
        deferredHelpingHandsMonsterTurnStart: payload.deferredHelpingHandsMonsterTurnStart
            ? {
                ...payload.deferredHelpingHandsMonsterTurnStart,
                moveDice: [...payload.deferredHelpingHandsMonsterTurnStart.moveDice],
            }
            : undefined,
        extraTurnAfterCurrentTurn: payload.extraTurnAfterCurrentTurn
            ? { ...payload.extraTurnAfterCurrentTurn }
            : undefined,
    };
}

function clonePendingEventChoice(
    pending: BetrayalPendingEventChoiceState,
): BetrayalPendingEventChoiceState {
    return {
        ...pending,
        effect: cloneUseEffect(pending.effect),
        deferredTurnEnd: pending.deferredTurnEnd
            ? cloneTurnEndedPayload(pending.deferredTurnEnd)
            : undefined,
    };
}

function clonePendingEventRollResolution(
    pending: BetrayalPendingEventRollResolutionState,
): BetrayalPendingEventRollResolutionState {
    return {
        ...pending,
        requiredPlayerIds: pending.requiredPlayerIds
            ? [...pending.requiredPlayerIds]
            : undefined,
        acknowledgedPlayerIds: pending.acknowledgedPlayerIds
            ? [...pending.acknowledgedPlayerIds]
            : undefined,
        effect: cloneUseEffect(pending.effect),
        nextPendingEventChoice: pending.nextPendingEventChoice
            ? clonePendingEventChoice(pending.nextPendingEventChoice)
            : undefined,
        deathPrevention: pending.deathPrevention
            ? {
                ...pending.deathPrevention,
                dice: [...pending.deathPrevention.dice],
                damageTraits: [...pending.deathPrevention.damageTraits],
                traitsBeforeDamage: { ...pending.deathPrevention.traitsBeforeDamage },
            }
            : undefined,
    };
}

function clonePendingDamageAllocation(
    pending: BetrayalPendingDamageAllocationState,
): BetrayalPendingDamageAllocationState {
    return {
        ...pending,
        allowedTraits: [...pending.allowedTraits],
        damageReplacement: pending.damageReplacement ? { ...pending.damageReplacement } : undefined,
        forcedTraitSequence: pending.forcedTraitSequence ? [...pending.forcedTraitSequence] : undefined,
        traitsBeforeDamage: { ...pending.traitsBeforeDamage },
        nextDamageAllocations: pending.nextDamageAllocations?.map(clonePendingDamageAllocation),
        monsterMovementRoll: pending.monsterMovementRoll
            ? cloneMonsterMovementRollResult(pending.monsterMovementRoll)
            : pending.monsterMovementRoll,
        skipBloodFromStoneMonsterTurnStart: pending.skipBloodFromStoneMonsterTurnStart,
    };
}

function cloneMagicCameraRuntimeState(magicCamera: BetrayalMagicCameraRuntimeState): BetrayalMagicCameraRuntimeState {
    return {
        cameraDestroyed: magicCamera.cameraDestroyed,
        cameraHolderPlayerId: magicCamera.cameraHolderPlayerId,
        heroEssencePlayerIds: [...magicCamera.heroEssencePlayerIds],
        capturedEssencePlayerIds: [...magicCamera.capturedEssencePlayerIds],
        phantomPhotographerIds: [...magicCamera.phantomPhotographerIds],
        killedPhantomPhotographerIds: [...magicCamera.killedPhantomPhotographerIds],
        stunnedPhantomPhotographerIds: [...magicCamera.stunnedPhantomPhotographerIds],
    };
}

function cloneMummyRuntimeState(mummy: BetrayalMummyRuntimeState): BetrayalMummyRuntimeState {
    return {
        ...mummy,
        mummyCarriedOmenIds: [...mummy.mummyCarriedOmenIds],
        mummyCarriedCards: mummy.mummyCarriedCards.map(cloneInventoryCard),
        pendingAttackReward: mummy.pendingAttackReward
            ? {
                ...mummy.pendingAttackReward,
                defenderTraitsBeforeDamage: { ...mummy.pendingAttackReward.defenderTraitsBeforeDamage },
                stealableCardIds: [...mummy.pendingAttackReward.stealableCardIds],
            }
            : undefined,
        requiredOmenIds: [...mummy.requiredOmenIds],
    };
}

function cloneInventorySeed(card: BetrayalInventorySeed): BetrayalInventoryCard {
    return { ...card };
}

function createExplorer(
    playerId: string,
    template: BetrayalExplorerTemplate,
    roomId: string,
    inventory: BetrayalInventorySeed[],
): BetrayalExplorerSummary {
    const explorer: BetrayalExplorerSummary = {
        playerId,
        explorerId: template.explorerId,
        displayName: template.displayName,
        portraitAsset: template.portraitAsset,
        tokenAsset: template.tokenAsset,
        roomId,
        traits: { ...template.traits },
        traitTracks: buildTraitTracksFromTemplate(template),
        inventory: inventory.map(cloneInventorySeed),
    };
    normalizeExplorerTraitTracks(explorer);
    return explorer;
}

function cloneCore(core: BetrayalCore): BetrayalCore {
    return {
        ...core,
        playerIds: [...core.playerIds],
        scenarioCandidateIds: [...core.scenarioCandidateIds],
        scenarioCardConfirmations: { ...core.scenarioCardConfirmations },
        selectedExplorerByPlayerId: { ...core.selectedExplorerByPlayerId },
        readyPlayerIds: [...core.readyPlayerIds],
        turnStartSpeed: core.turnStartSpeed ?? core.currentExplorer.traits.speed ?? core.movesRemaining,
        currentExplorer: cloneExplorer(core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorerTraits },
        currentExplorerInventory: core.currentExplorerInventory.map(cloneInventoryCard),
        otherExplorers: core.otherExplorers.map(cloneExplorer),
        monsters: core.monsters.map(cloneMonster),
        drawOrder: [...core.drawOrder],
        roomDiscoveryDeck: (core.roomDiscoveryDeck ?? makeRoomDiscoveryDeckFromFloorPools(core.roomDiscoveryOrderByFloor))
            .map(cloneRoomDiscoveryDeckEntry),
        roomDiscoveryOrderByFloor: {
            ground: core.roomDiscoveryOrderByFloor.ground.map(cloneRoomTemplate),
            upper: core.roomDiscoveryOrderByFloor.upper.map(cloneRoomTemplate),
            basement: core.roomDiscoveryOrderByFloor.basement.map(cloneRoomTemplate),
        },
        buriedRoomTiles: (core.buriedRoomTiles ?? []).map(cloneBuriedRoomTileSummary),
        possessionOrderByKind: {
            item: core.possessionOrderByKind.item.map(cloneInventoryCard),
            omen: core.possessionOrderByKind.omen.map(cloneInventoryCard),
        },
        eventOrder: core.eventOrder.map(cloneEventTemplate),
        deckCounts: { ...core.deckCounts },
        discardCounts: { ...core.discardCounts },
        rooms: core.rooms.map(cloneBetrayalRoom),
        usedCardIdsThisTurn: [...core.usedCardIdsThisTurn],
        tradeUsedThisTurnPlayerIds: [...core.tradeUsedThisTurnPlayerIds],
        turnStartInventoryCardIds: [...core.turnStartInventoryCardIds],
        receivedCardIdsThisTurnByPlayerId: Object.fromEntries(
            Object.entries(core.receivedCardIdsThisTurnByPlayerId).map(([playerId, cardIds]) => [playerId, [...cardIds]]),
        ),
        nextNonCombatTraitReplacement: core.nextNonCombatTraitReplacement
            ? { ...core.nextNonCombatTraitReplacement }
            : null,
        nextNonCombatTraitRollTotalReplacement: core.nextNonCombatTraitRollTotalReplacement
            ? { ...core.nextNonCombatTraitRollTotalReplacement }
            : null,
        pendingExtraTurnAfterCurrentTurn: core.pendingExtraTurnAfterCurrentTurn
            ? { ...core.pendingExtraTurnAfterCurrentTurn }
            : null,
        recentRoll: core.recentRoll
            ? {
                ...core.recentRoll,
                dice: [...core.recentRoll.dice],
                requiredPlayerIds: core.recentRoll.requiredPlayerIds
                    ? [...core.recentRoll.requiredPlayerIds]
                    : undefined,
                acknowledgedPlayerIds: core.recentRoll.acknowledgedPlayerIds
                    ? [...core.recentRoll.acknowledgedPlayerIds]
                    : undefined,
                branchThresholds: core.recentRoll.branchThresholds?.map((branch) => ({
                    ...branch,
                    effect: { ...branch.effect },
                })),
                eventRolledDamageResults: core.recentRoll.eventRolledDamageResults?.map(cloneRolledDamageResult),
                sourceEventRoll: core.recentRoll.sourceEventRoll
                    ? cloneSourceEventRoll(core.recentRoll.sourceEventRoll)
                    : undefined,
                eventEffectSnapshot: core.recentRoll.eventEffectSnapshot
                    ? {
                        ...core.recentRoll.eventEffectSnapshot,
                        traitsBeforeEffect: { ...core.recentRoll.eventEffectSnapshot.traitsBeforeEffect },
                        traitTracksBeforeEffect: cloneTraitTracks(core.recentRoll.eventEffectSnapshot.traitTracksBeforeEffect),
                        possessionOrderByKindBeforeEffect: clonePossessionOrderByKind(core.recentRoll.eventEffectSnapshot.possessionOrderByKindBeforeEffect),
                        deckCountsBeforeEffect: { ...core.recentRoll.eventEffectSnapshot.deckCountsBeforeEffect },
                        damageRolls: [...core.recentRoll.eventEffectSnapshot.damageRolls],
                        rolledDamageResults: (core.recentRoll.eventEffectSnapshot.rolledDamageResults ?? []).map(cloneRolledDamageResult),
                        drawnCards: core.recentRoll.eventEffectSnapshot.drawnCards.map(cloneInventoryCard),
                    }
                    : undefined,
                roomsBeforeRoll: core.recentRoll.roomsBeforeRoll?.map(cloneBetrayalRoom),
                roomEndTurn: core.recentRoll.roomEndTurn
                    ? {
                        ...core.recentRoll.roomEndTurn,
                        traitsBeforeEffect: { ...core.recentRoll.roomEndTurn.traitsBeforeEffect },
                    }
                    : undefined,
                attack: core.recentRoll.attack
                    ? {
                        ...core.recentRoll.attack,
                        attackerTraitsBeforeDamage: { ...core.recentRoll.attack.attackerTraitsBeforeDamage },
                        defenderTraitsBeforeDamage: core.recentRoll.attack.defenderTraitsBeforeDamage
                            ? { ...core.recentRoll.attack.defenderTraitsBeforeDamage }
                            : undefined,
                    }
                    : undefined,
                deathPrevention: core.recentRoll.deathPrevention
                    ? {
                        ...core.recentRoll.deathPrevention,
                        damageTraits: core.recentRoll.deathPrevention.damageTraits
                            ? [...core.recentRoll.deathPrevention.damageTraits]
                            : undefined,
                        traitsBeforeDamage: { ...core.recentRoll.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat),
                        monstersBeforeDefeat: core.recentRoll.deathPrevention.monstersBeforeDefeat.map(cloneMonster),
                    }
                    : undefined,
                consumedRabbitFootCardIds: [...core.recentRoll.consumedRabbitFootCardIds],
                lastRabbitFootRerollDieIndex: core.recentRoll.lastRabbitFootRerollDieIndex,
            }
            : null,
        pendingEventChoice: core.pendingEventChoice
            ? clonePendingEventChoice(core.pendingEventChoice)
            : null,
        pendingEventRollStart: core.pendingEventRollStart
            ? { ...core.pendingEventRollStart }
            : null,
        pendingCardResolutionQueue: (core.pendingCardResolutionQueue ?? []).map(clonePendingCardResolution),
        pendingTradeAgreement: core.pendingTradeAgreement
            ? {
                ...core.pendingTradeAgreement,
                cardIds: [...core.pendingTradeAgreement.cardIds],
                targetCardIds: [...core.pendingTradeAgreement.targetCardIds],
            }
            : null,
        pendingDamageAllocation: core.pendingDamageAllocation
            ? clonePendingDamageAllocation(core.pendingDamageAllocation)
            : null,
        pendingEventRollResolution: core.pendingEventRollResolution
            ? clonePendingEventRollResolution(core.pendingEventRollResolution)
            : null,
        recentAllTraitCheck: core.recentAllTraitCheck
            ? {
                ...core.recentAllTraitCheck,
                results: core.recentAllTraitCheck.results.map((result) => ({
                    ...result,
                    dice: [...result.dice],
                })),
            }
            : null,
        latestRoomDrawResolution: core.latestRoomDrawResolution
            ? cloneRoomDrawResolution(core.latestRoomDrawResolution)
            : null,
        latestDiscovery: core.latestDiscovery ? cloneDiscoverySummary(core.latestDiscovery) : null,
        activityLog: core.activityLog.map((entry) => ({ ...entry })),
        turnEndedByDiscovery: core.turnEndedByDiscovery,
        scenarioRuntime: cloneScenarioRuntimeStatus(core.scenarioRuntime),
        endgameResult: core.endgameResult ? {
            ...core.endgameResult,
            winners: [...core.endgameResult.winners],
            survivorsEscaped: [...core.endgameResult.survivorsEscaped],
            reward: { ...core.endgameResult.reward },
            stats: { ...core.endgameResult.stats },
        } : null,
    };
}

function syncCurrentExplorerProjection(core: BetrayalCore): BetrayalCore {
    normalizeExplorerTraitTracks(core.currentExplorer);
    core.otherExplorers.forEach(normalizeExplorerTraitTracks);
    return {
        ...core,
        currentPlayer: core.currentExplorer.playerId,
        activeRoomId: resolveControlledRoomId(core, core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorer.traits },
        currentExplorerInventory: core.currentExplorer.inventory.map(cloneInventoryCard),
    };
}

function createInitialScenarioRuntimeStatus(): BetrayalScenarioRuntimeStatus {
    return {
        hauntTriggered: false,
        hauntRevealerPlayerId: null,
        traitorPlayerId: null,
        hauntTraitorResolution: null,
        hauntFirstPlayerResolution: null,
        nextHauntPlayerId: null,
        hauntRollThreshold: 5,
        omensDiscovered: 0,
        hauntCardNumber: null,
        hauntTriggerLabel: null,
        hauntScenarioCardId: null,
        hauntScenarioCardTitle: null,
        hauntScenarioCardLabel: null,
        triggeringOmenId: null,
        triggeringOmenName: null,
        hauntResolutionMatchedTrigger: false,
        hauntResolutionRepresentativeOnly: false,
        jackSpiritReleased: false,
        jackSpiritRoomId: null,
        jackSpiritHasMovedSinceRelease: false,
        exorcismCircleRoomIds: [],
        knowledgeOfJackPlayerIds: [],
        deadExplorerPlayerIds: [],
        traitorCorpseRoomId: null,
        corpseLootedByPlayerIdsThisTurn: [],
        usedRoomEffectIdsThisTurn: [],
        hauntSetupQueue: [],
        monsterStatusesById: {},
        monsterTurn: createInitialMonsterTurnRuntimeState(),
        bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: {},
        bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [],
    };
}

function appendActivity(core: BetrayalCore, text: string, tone: BetrayalActivityEntry['tone']): BetrayalActivityEntry[] {
    return [
        { id: `${core.exploreIndex}-${core.activityLog.length}-${text}`, text, tone },
        ...core.activityLog,
    ].slice(0, 6);
}

function normalizePlayerIds(playerIds: string[]): string[] {
    return playerIds.length >= 3 ? playerIds.map(String) : ['0', '1', '2', '3'];
}

function roomSeedToNode(room: BetrayalRoomSeed): BetrayalRoomNode {
    return {
        ...room,
        connectedRoomIds: [...room.connectedRoomIds],
        orientationTurns: room.orientationTurns ?? 0,
        tags: [...room.tags],
        doorways: room.doorways.map((doorway) => ({ ...doorway })),
    };
}

function scenarioConfigById(scenarioId: BetrayalScenarioId) {
    return BETRAYAL_SCENARIO_CONFIGS[scenarioId];
}

function scenarioInventoryForExplorer(scenarioId: BetrayalScenarioId, explorerId: string): BetrayalInventorySeed[] {
    return scenarioConfigById(scenarioId).startingInventoryByExplorerId[explorerId]?.map(cloneInventorySeed) ?? [];
}

export function getBetrayalScenarioConfig(scenarioId: BetrayalScenarioId) {
    return scenarioConfigById(scenarioId);
}

function buildRepresentativeRuntimeExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    const representativeRoomIds = ['grand-staircase', 'upper-landing', 'basement-landing', 'entrance-hall', 'upper-landing', 'entrance-hall'];
    return core.playerIds.map((playerId, index) => {
        const template = EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(
            playerId,
            template,
            representativeRoomIds[index % representativeRoomIds.length]!,
            scenarioInventoryForExplorer(core.scenarioId, template.explorerId),
        );
    });
}

function makeBaseCore(
    playerIds: string[],
    phase: BetrayalPhase,
    random: RandomFn,
    scenarioId: BetrayalScenarioId = DEFAULT_BETRAYAL_SCENARIO_ID,
): BetrayalCore {
    const normalizedPlayerIds = normalizePlayerIds(playerIds);
    const rooms = createInitialRoomLayout(BETRAYAL_SHARED_PRE_HAUNT_SETUP.startingRoomLayout);
    const discoveryState = createShuffledDiscoveryState(random);
    const currentExplorer = createExplorer(
        normalizedPlayerIds[0]!,
        EXPLORER_CATALOG[0]!,
        BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
        scenarioInventoryForExplorer(scenarioId, EXPLORER_CATALOG[0]!.explorerId),
    );
    const otherExplorers = normalizedPlayerIds.slice(1).map((playerId, index) => (
        createExplorer(
            playerId,
            EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!,
            BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
            scenarioInventoryForExplorer(
                scenarioId,
                EXPLORER_CATALOG[(index + 1) % EXPLORER_CATALOG.length]!.explorerId,
            ),
        )
    ));

    return syncCurrentExplorerProjection({
        scenarioId,
        scenarioCandidateIds: [...BETRAYAL_SCENARIO_CARD_IDS],
        proposedScenarioCardId: DEFAULT_BETRAYAL_SCENARIO_CARD_ID,
        scenarioCardConfirmations: {},
        phase,
        playerIds: normalizedPlayerIds,
        selectedExplorerByPlayerId: {},
        readyPlayerIds: [],
        currentPlayer: currentExplorer.playerId,
        activePlayerId: null,
        turnStartSpeed: currentExplorer.traits.speed,
        movesRemaining: currentExplorer.traits.speed,
        recommendedAction: 'explore',
        activeRoomId: currentExplorer.roomId,
        turnEndedByDiscovery: false,
        currentExplorer,
        currentExplorerTraits: { ...currentExplorer.traits },
        currentExplorerInventory: currentExplorer.inventory.map(cloneInventoryCard),
        otherExplorers,
        monsters: [],
        drawOrder: discoveryState.drawOrder,
        roomDiscoveryDeck: discoveryState.roomDiscoveryDeck,
        roomDiscoveryOrderByFloor: discoveryState.roomDiscoveryOrderByFloor,
        buriedRoomTiles: [],
        possessionOrderByKind: discoveryState.possessionOrderByKind,
        eventOrder: discoveryState.eventOrder,
        deckCounts: { ...BETRAYAL_INITIAL_DECK_COUNTS },
        discardCounts: { omen: 0, item: 0, event: 0 },
        rooms,
        exploreIndex: 0,
        usedCardIdsThisTurn: [],
        tradeUsedThisTurnPlayerIds: [],
        turnStartInventoryCardIds: currentExplorer.inventory.map((card) => card.id),
        receivedCardIdsThisTurnByPlayerId: {},
        nextNonCombatTraitReplacement: null,
        nextNonCombatTraitRollTotalReplacement: null,
        pendingExtraTurnAfterCurrentTurn: null,
        pendingEventChoice: null,
        pendingEventRollStart: null,
        pendingCardResolutionQueue: [],
        pendingTradeAgreement: null,
        pendingDamageAllocation: null,
        pendingEventRollResolution: null,
        recentRoll: null,
        recentAllTraitCheck: null,
        latestRoomDrawResolution: null,
        latestDiscovery: null,
        latestDiscoveryOwnerPlayerId: null,
        highlightedDeckKind: null,
        activityLog: [],
        scenarioRuntime: createInitialScenarioRuntimeStatus(),
        endgameResult: null,
    });
}

export function createBetrayalCharacterSelectCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
    setupData?: unknown,
): BetrayalCore {
    return makeBaseCore(playerIds, 'characterSelect', random, readBetrayalScenarioId(setupData));
}

export function createBetrayalFoundationCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
): BetrayalCore {
    const core = makeBaseCore(playerIds, 'preHaunt', random);
    const nextCore = replaceExplorers(core, buildRepresentativeRuntimeExplorers(core), core.playerIds[0]);
    const turnStartSpeed = resolveTurnStartSpeed(nextCore);
    return {
        ...nextCore,
        turnStartSpeed,
        movesRemaining: turnStartSpeed,
        turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore),
    };
}

const MONSTER_ENCOUNTER_PREVIEW_MONSTERS: BetrayalMonsterSeed[] = [
    {
        id: 'werewolf',
        name: '狼人',
        portraitAsset: 'betrayal/monsters/werewolf',
        tokenAsset: 'betrayal/tokens/monsters/werewolf',
        roomId: 'grand-staircase',
        might: 5,
        speed: 4,
        damage: 2,
    },
    {
        id: 'spirit',
        name: '幽灵',
        portraitAsset: 'betrayal/monsters/spirit',
        tokenAsset: 'betrayal/tokens/monsters/ghost',
        roomId: 'upper-landing',
        might: 4,
        speed: 5,
        damage: 1,
    },
];

export function createBetrayalMonsterEncounterCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
): BetrayalCore {
    const core = createBetrayalFoundationCore(playerIds, random);
    return {
        ...core,
        monsters: MONSTER_ENCOUNTER_PREVIEW_MONSTERS.map(cloneMonsterSeed),
    };
}

function templateByExplorerId(explorerId: string): BetrayalExplorerTemplate | undefined {
    return EXPLORER_CATALOG.find((template) => template.explorerId === explorerId);
}

function replaceExplorers(
    core: BetrayalCore,
    explorers: BetrayalExplorerSummary[],
    nextCurrentPlayerId = core.currentPlayer,
): BetrayalCore {
    const nextCurrent = explorers.find((explorer) => explorer.playerId === nextCurrentPlayerId) ?? explorers[0] ?? core.currentExplorer;
    const nextOthers = explorers.filter((explorer) => explorer.playerId !== nextCurrent.playerId);
    return syncCurrentExplorerProjection({
        ...core,
        currentExplorer: cloneExplorer(nextCurrent),
        otherExplorers: nextOthers.map(cloneExplorer),
    });
}

function buildScenarioExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.playerIds.map((playerId, index) => {
        const selectedExplorerId = core.selectedExplorerByPlayerId[playerId];
        const template = templateByExplorerId(selectedExplorerId ?? '') ?? EXPLORER_CATALOG[index % EXPLORER_CATALOG.length]!;
        return createExplorer(
            playerId,
            template,
            BETRAYAL_SHARED_PRE_HAUNT_SETUP.explorerStartTileId,
            scenarioInventoryForExplorer(core.scenarioId, template.explorerId),
        );
    });
}

function resolveMummyGirlStartingRoomId(core: BetrayalCore, mummyRoomId: string): string | null {
    const mummyRoom = core.rooms.find((room) => room.id === mummyRoomId);
    if (!mummyRoom) {
        return null;
    }
    const discoveredRooms = core.rooms.filter((room) => room.state === 'discovered' && room.id !== mummyRoom.id);
    const sameFloorRooms = discoveredRooms
        .filter((room) => room.floor === mummyRoom.floor)
        .map((room) => ({
            room,
            distance: roomDistanceByLayout(mummyRoom, room),
        }))
        .sort((a, b) => b.distance - a.distance);
    const farEnoughRoom = sameFloorRooms.find(({ distance }) => distance >= 5);
    if (farEnoughRoom) {
        return farEnoughRoom.room.id;
    }
    if (sameFloorRooms[0]) {
        return sameFloorRooms[0].room.id;
    }
    const anyFloorRoom = discoveredRooms
        .map((room) => ({
            room,
            distance: roomDistanceByLayout(mummyRoom, room),
        }))
        .sort((a, b) => b.distance - a.distance)[0];
    return anyFloorRoom?.room.id ?? null;
}

function removeMummyGirlOmenFromExplorers(core: BetrayalCore): void {
    const isGirlOmen = (card: BetrayalInventoryCard) => (
        card.kind === 'omen'
        && (
            card.id === 'girl'
            || card.id === 'omen-girl'
            || card.name.includes('女孩')
            || card.name.toLowerCase() === 'girl'
        )
    );
    const explorers = getAllExplorers(core);
    for (const explorer of explorers) {
        explorer.inventory = explorer.inventory.filter((card) => !isGirlOmen(card));
    }
    core.currentExplorerInventory = core.currentExplorer.inventory.map(cloneInventoryCard);
}

function createMummyRuntimeState(core: BetrayalCore, traitorPlayerId: string | null): BetrayalMummyRuntimeState {
    const traitor = traitorPlayerId ? findExplorerByPlayerId(core, traitorPlayerId) : null;
    const sarcophagusRoomId = traitor?.roomId ?? core.activeRoomId;
    const girlRoomId = resolveMummyGirlStartingRoomId(core, sarcophagusRoomId);
    return {
        mummyMonsterId: 'mummy',
        sarcophagusRoomId,
        girlRoomId,
        girlHolderPlayerId: null,
        girlHeldByMummy: false,
        mummyCarriedOmenIds: [],
        mummyCarriedCards: [],
        knowledgeTokenCount: 0,
        trueNameFound: false,
        banishmentSpellLearned: false,
        bookRequired: !getAllExplorers(core).some((explorer) => hasOmenBook(explorer)),
        requiredOmenIds: ['omen-book', 'holy-symbol', 'ring'],
    };
}

function setupMummyHaunt(core: BetrayalCore, traitorPlayerId: string | null): BetrayalMummyRuntimeState {
    const mummy = createMummyRuntimeState(core, traitorPlayerId);
    removeMummyGirlOmenFromExplorers(core);
    core.monsters = [
        ...core.monsters.filter((monster) => monster.id !== mummy.mummyMonsterId && monster.definitionId !== 'mummy'),
        createBetrayalMonsterFromDefinition('mummy', mummy.mummyMonsterId, mummy.sarcophagusRoomId),
    ];
    return mummy;
}

function isOmenStillInDeck(core: BetrayalCore, effectId: string): boolean {
    return core.possessionOrderByKind.omen.some((card) => resolveInventoryEffectId(card.id) === effectId);
}

function isOmenRevealed(core: BetrayalCore, effectId: string): boolean {
    if (!isOmenStillInDeck(core, effectId)) {
        return true;
    }
    const explorerHasOmen = getAllExplorers(core).some((explorer) => (
        explorer.inventory.some((card) => card.kind === 'omen' && resolveInventoryEffectId(card.id) === effectId)
    ));
    if (explorerHasOmen) {
        return true;
    }
    const mummy = core.scenarioRuntime.mummy;
    return Boolean(
        mummy?.mummyCarriedOmenIds.some((cardId) => resolveInventoryEffectId(cardId) === effectId)
        || mummy?.mummyCarriedCards.some((card) => card.kind === 'omen' && resolveInventoryEffectId(card.id) === effectId),
    );
}

function shouldMummyForceHeroBookDraw(core: BetrayalCore, actor: BetrayalExplorerSummary): boolean {
    return isMummyHaunt(core)
        && actor.playerId !== core.scenarioRuntime.traitorPlayerId
        && !isOmenRevealed(core, 'omen-book');
}

function shouldMummyForceTraitorWeddingOmenDraw(core: BetrayalCore, actor: BetrayalExplorerSummary): boolean {
    return isMummyHaunt(core)
        && actor.playerId === core.scenarioRuntime.traitorPlayerId
        && [...MUMMY_WEDDING_OMEN_CARD_IDS].every((cardId) => !isOmenRevealed(core, cardId));
}

function resolveMummyForcedOmenDraw(
    core: BetrayalCore,
    actor: BetrayalExplorerSummary,
    fallbackDrawnCard: BetrayalInventoryCard,
    random: RandomFn,
): {
    drawnCard: BetrayalInventoryCard;
    forcedOmenSearch?: {
        role: 'hero-book' | 'traitor-wedding-omen';
        cardId: string;
        cardName: string;
        shuffledOmenDeck: BetrayalInventoryCard[];
    };
} {
    const targetEffectIds = shouldMummyForceHeroBookDraw(core, actor)
        ? ['omen-book']
        : shouldMummyForceTraitorWeddingOmenDraw(core, actor)
            ? [...MUMMY_WEDDING_OMEN_CARD_IDS]
            : [];
    if (targetEffectIds.length === 0) {
        return { drawnCard: fallbackDrawnCard };
    }
    const targetIndex = core.possessionOrderByKind.omen.findIndex((card) => (
        targetEffectIds.includes(resolveInventoryEffectId(card.id))
    ));
    const template = targetIndex >= 0 ? core.possessionOrderByKind.omen[targetIndex] : null;
    if (!template) {
        return { drawnCard: fallbackDrawnCard };
    }
    const drawnCard = createDrawnCardFromTemplate(core, template);
    const remainingDeck = core.possessionOrderByKind.omen
        .filter((_, index) => index !== targetIndex)
        .map(cloneInventoryCard);
    const role = resolveInventoryEffectId(template.id) === 'omen-book'
        ? 'hero-book'
        : 'traitor-wedding-omen';
    return {
        drawnCard,
        forcedOmenSearch: {
            role,
            cardId: drawnCard.id,
            cardName: drawnCard.name,
            shuffledOmenDeck: random.shuffle(remainingDeck).map(cloneInventoryCard),
        },
    };
}

function isMummyWeddingOmenCard(card: BetrayalInventoryCard): boolean {
    const normalizedName = card.name.trim().toLowerCase();
    return card.kind === 'omen'
        && (
            MUMMY_WEDDING_OMEN_CARD_IDS.has(resolveInventoryEffectId(card.id))
            || card.name === '圣符'
            || card.name === '指环'
            || normalizedName === 'holy symbol'
            || normalizedName === 'ring'
        );
}

function findMummyWeddingOmenCard(
    explorer: BetrayalExplorerSummary | null | undefined,
    cardId?: string,
): BetrayalInventoryCard | null {
    const cards = explorer?.inventory.filter(isMummyWeddingOmenCard) ?? [];
    if (cardId) {
        return cards.find((card) => card.id === cardId) ?? null;
    }
    return cards[0] ?? null;
}

function resolveMummyForcedDamageTraits(
    explorer: BetrayalExplorerSummary,
    amount: number,
    options: { allowSkull?: boolean } = {},
): BetrayalTraitKey[] {
    const sequence: BetrayalTraitKey[] = [];
    const speedSteps = resolveTraitDamageAssignableSteps(explorer, 'speed', options);
    const mightSteps = resolveTraitDamageAssignableSteps(explorer, 'might', options);
    const speedDamage = Math.min(amount, speedSteps);
    const mightDamage = Math.min(Math.max(0, amount - speedDamage), mightSteps);
    sequence.push(...repeatTraitForDamage('speed', speedDamage));
    sequence.push(...repeatTraitForDamage('might', mightDamage));
    return sequence;
}

function collectMummyGirlByExplorerIfPresent(
    core: BetrayalCore,
    playerId: string,
    roomId: string,
): boolean {
    const mummy = core.scenarioRuntime.mummy;
    if (
        !isMummyHaunt(core)
        || !mummy
        || mummy.girlRoomId !== roomId
        || mummy.girlHolderPlayerId
        || mummy.girlHeldByMummy
        || core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
    ) {
        return false;
    }
    mummy.girlRoomId = null;
    mummy.girlHolderPlayerId = playerId;
    mummy.girlHeldByMummy = false;
    return true;
}

function collectMummyGirlByMummyIfPresent(
    core: BetrayalCore,
    monsterId: string,
    roomId: string,
): boolean {
    const mummy = core.scenarioRuntime.mummy;
    if (
        !isMummyMonster(core, monsterId)
        || !mummy
        || mummy.girlRoomId !== roomId
        || mummy.girlHolderPlayerId
        || mummy.girlHeldByMummy
    ) {
        return false;
    }
    mummy.girlRoomId = null;
    mummy.girlHolderPlayerId = null;
    mummy.girlHeldByMummy = true;
    return true;
}

function createMummyEndgameResult(core: BetrayalCore, outcome: 'survivors' | 'traitor'): BetrayalEndgameResult {
    const livingHeroes = getAllExplorers(core)
        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId));
    const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
    const winners = outcome === 'survivors'
        ? livingHeroes.map((explorer) => explorer.playerId)
        : [traitor.playerId];
    return {
        hauntId: 'mummy-rampage',
        hauntTitle: '木乃伊横行',
        outcome,
        winners,
        traitorPlayerId: traitor.playerId,
        survivorsEscaped: outcome === 'survivors' ? [...winners] : [],
        reward: {
            stars: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function completeMummyTraitorVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    const mummy = core.scenarioRuntime.mummy;
    const mummyMonster = findMummyMonster(core);
    if (!isMummyHaunt(core) || !mummy || !mummyMonster) {
        return null;
    }
    if (!mummy.girlHeldByMummy || mummyMonster.roomId !== mummy.sarcophagusRoomId) {
        return null;
    }
    if (!mummy.mummyCarriedOmenIds.some((cardId) => MUMMY_WEDDING_OMEN_CARD_IDS.has(resolveInventoryEffectId(cardId)))) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createMummyEndgameResult(core, 'traitor'),
    }, timestamp));
}

function resolveCrimsonJackHauntTitle(): string {
    return getBetrayalScenarioCardCandidate('crimson-jack-returns').titleEn;
}

function resolveScenarioCompletedLog(core: BetrayalCore, result: BetrayalEndgameResult): string {
    if (result.hauntId === 'crimson-jack-returns') {
        return result.outcome === 'survivors'
            ? '杰克之灵被驱散，英雄完成驱魔'
            : 'Crimson Jack 击倒了所有英雄';
    }
    if (result.hauntId === 'mummy-rampage') {
        return result.outcome === 'survivors'
            ? '英雄念出木乃伊真名并完成驱逐'
            : '木乃伊完成婚礼，或所有英雄都已倒下';
    }
    if (result.hauntId === 'upon-reflection') {
        return '英雄破除镜中诅咒，作祟揭秘者回到现实';
    }
    return scenarioConfigById(core.scenarioId).logs.scenarioCompleted;
}

function createDustRuntimeState(core: BetrayalCore, random: RandomFn): BetrayalDustRuntimeState {
    const playerIds = [...core.playerIds];
    const sicknessOneCount = playerIds.length >= 6 ? 2 : 1;
    const sicknessValues = [
        ...Array.from({ length: sicknessOneCount }, () => 1),
        ...Array.from({ length: Math.max(0, playerIds.length * 3 - sicknessOneCount) }, (_, index) => index + 2),
    ];
    const shuffledValues = random.shuffle(sicknessValues);
    let cursor = 0;
    const sicknessTokensByPlayerId = Object.fromEntries(
        playerIds.map((playerId) => [
            playerId,
            Array.from({ length: 3 }, (_, tokenIndex) => ({
                id: `sickness-${playerId}-${tokenIndex + 1}`,
                value: shuffledValues[cursor++] ?? null,
            })),
        ]),
    );
    const permanentTraitorPlayerIds = playerIds.filter((playerId) => (
        sicknessTokensByPlayerId[playerId]?.some((token) => token.value === 1)
    ));
    return {
        sicknessTokensByPlayerId,
        permanentTraitorPlayerIds,
        researchRoomIds: [],
        exchangedSicknessThisTurnPlayerIds: [],
        feverishPlayerIds: [],
    };
}

function buryExplorerPossessionsToBottom(core: BetrayalCore, explorer: BetrayalExplorerSummary): void {
    if (explorer.inventory.length === 0) {
        return;
    }
    for (const card of explorer.inventory) {
        if (card.kind === 'item' || card.kind === 'omen') {
            restorePossessionCardToBottom(core, card.kind, card);
        }
    }
    explorer.inventory = [];
    if (core.currentExplorer.playerId === explorer.playerId) {
        core.currentExplorerInventory = [];
    }
}

function shouldDeferDustTraitorPossessionBurialForRabbitFoot(core: BetrayalCore, playerId: string): boolean {
    return isOwnDeathPreventionRerollWindow(core, playerId)
        && canUseRabbitFootForRecentRoll(core, playerId);
}

function shouldDeferDustTraitorVictoryForRabbitFoot(core: BetrayalCore, playerId: string): boolean {
    const card = resolveRabbitFootCard(core, undefined, playerId);
    const receivedThisTurn = core.receivedCardIdsThisTurnByPlayerId[playerId] ?? [];
    return Boolean(
        isOwnDeathPreventionRerollWindow(core, playerId)
        && card
        && core.recentRoll?.dice.length
        && !core.recentRoll.consumedRabbitFootCardIds.includes(card.id)
        && !receivedThisTurn.includes(card.id)
        && !core.usedCardIdsThisTurn.includes(card.id),
    );
}

function buryDustDeadTraitorPossessions(
    core: BetrayalCore,
    playerId: string,
    options: { deferForRabbitFoot?: boolean } = {},
): void {
    const dust = core.scenarioRuntime.dust;
    if (
        !isDustHaunt(core)
        || !dust?.permanentTraitorPlayerIds.includes(playerId)
        || !core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
    ) {
        return;
    }
    if (options.deferForRabbitFoot !== false && shouldDeferDustTraitorPossessionBurialForRabbitFoot(core, playerId)) {
        return;
    }
    const explorer = findExplorerByPlayerId(core, playerId);
    if (explorer) {
        buryExplorerPossessionsToBottom(core, explorer);
    }
}

function resolveDustSicknessSwap(
    dust: BetrayalDustRuntimeState,
    fromPlayerId: string,
    toPlayerId: string,
    random: RandomFn,
): BetrayalDustSicknessSwapResult | null {
    const fromTokens = dust.sicknessTokensByPlayerId[fromPlayerId] ?? [];
    const toTokens = dust.sicknessTokensByPlayerId[toPlayerId] ?? [];
    if (fromTokens.length === 0 || toTokens.length === 0 || fromPlayerId === toPlayerId) {
        return null;
    }
    const fromToken = fromTokens[random.range(0, fromTokens.length - 1)] ?? fromTokens[0]!;
    const toToken = toTokens[random.range(0, toTokens.length - 1)] ?? toTokens[0]!;
    return {
        fromPlayerId,
        toPlayerId,
        fromTokenId: fromToken.id,
        toTokenId: toToken.id,
    };
}

function refreshDustTraitors(dust: BetrayalDustRuntimeState): void {
    const currentHolders = Object.entries(dust.sicknessTokensByPlayerId)
        .filter(([, tokens]) => tokens.some((token) => token.value === 1))
        .map(([playerId]) => playerId);
    dust.permanentTraitorPlayerIds = Array.from(new Set([
        ...dust.permanentTraitorPlayerIds,
        ...currentHolders,
    ]));
}

function applyDustSicknessSwap(dust: BetrayalDustRuntimeState, swap: BetrayalDustSicknessSwapResult): void {
    const fromTokens = dust.sicknessTokensByPlayerId[swap.fromPlayerId] ?? [];
    const toTokens = dust.sicknessTokensByPlayerId[swap.toPlayerId] ?? [];
    const fromIndex = fromTokens.findIndex((token) => token.id === swap.fromTokenId);
    const toIndex = toTokens.findIndex((token) => token.id === swap.toTokenId);
    if (fromIndex < 0 || toIndex < 0) {
        return;
    }
    const fromToken = { ...fromTokens[fromIndex]! };
    const toToken = { ...toTokens[toIndex]! };
    const nextFromTokens = [...fromTokens];
    const nextToTokens = [...toTokens];
    nextFromTokens[fromIndex] = toToken;
    nextToTokens[toIndex] = fromToken;
    dust.sicknessTokensByPlayerId = {
        ...dust.sicknessTokensByPlayerId,
        [swap.fromPlayerId]: nextFromTokens,
        [swap.toPlayerId]: nextToTokens,
    };
    dust.exchangedSicknessThisTurnPlayerIds = Array.from(new Set([
        ...dust.exchangedSicknessThisTurnPlayerIds,
        swap.fromPlayerId,
        swap.toPlayerId,
    ]));
    refreshDustTraitors(dust);
}

function resolveSameRoomLivingExplorers(
    core: BetrayalCore,
    roomId: string,
    exceptPlayerId?: string,
): BetrayalExplorerSummary[] {
    return getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== exceptPlayerId
        && explorer.roomId === roomId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
}

function addFeverishMonsterForPlayer(core: BetrayalCore, playerId: string): void {
    if (!core.scenarioRuntime.dust || core.scenarioRuntime.dust.feverishPlayerIds.includes(playerId)) {
        return;
    }
    const explorer = findExplorerByPlayerId(core, playerId);
    core.scenarioRuntime.dust.feverishPlayerIds = [
        ...core.scenarioRuntime.dust.feverishPlayerIds,
        playerId,
    ];
    buryDustDeadTraitorPossessions(core, playerId);
    core.monsters = [
        ...core.monsters.filter((monster) => monster.id !== `feverish-${playerId}`),
        createBetrayalMonsterFromDefinition(
            'dust-feverish-patient',
            `feverish-${playerId}`,
            explorer?.roomId ?? core.activeRoomId,
        ),
    ];
}

function resolveFeverishMonsterMovementRoll(
    core: BetrayalCore,
    nextPlayerId: string,
    random: RandomFn,
): BetrayalMonsterMovementRollResult | null {
    if (!shouldDeadPlayerControlFeverish(core, nextPlayerId)) {
        return null;
    }
    const feverish = findFeverishMonster(core, nextPlayerId);
    if (!feverish) {
        return null;
    }
    const dice = rollBetrayalDicePips(random, feverish.speed);
    const total = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        monsterId: feverish.id,
        monsterName: feverish.name,
        playerId: nextPlayerId,
        speed: feverish.speed,
        dice,
        total,
        moveAllowance: Math.max(1, total),
    };
}

function createDustEndgameResult(core: BetrayalCore, outcome: BetrayalScenarioOutcome): BetrayalEndgameResult {
    const dust = core.scenarioRuntime.dust;
    const livingExplorers = getAllExplorers(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    const traitorPlayerIds = dust?.permanentTraitorPlayerIds ?? [];
    const winners = outcome === 'traitor'
        ? traitorPlayerIds.filter((playerId) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId))
        : livingExplorers
            .filter((explorer) => !traitorPlayerIds.includes(explorer.playerId))
            .map((explorer) => explorer.playerId);
    return {
        hauntId: 'the-dust',
        hauntTitle: '灰尘',
        outcome,
        winners,
        traitorPlayerId: traitorPlayerIds[0] ?? '',
        survivorsEscaped: outcome === 'survivors' ? winners : [],
        reward: {
            stars: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function areAllLivingExplorersDustTraitorsOrDead(core: BetrayalCore): boolean {
    const dust = core.scenarioRuntime.dust;
    if (!dust) {
        return false;
    }
    return getAllExplorers(core).every((explorer) => (
        core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        || dust.permanentTraitorPlayerIds.includes(explorer.playerId)
    ));
}

function completeDustTraitorVictoryIfNeeded(
    core: BetrayalCore,
    timestamp: number,
    options: { deferForRabbitFoot?: boolean } = {},
): BetrayalCore | null {
    if (!isDustHaunt(core) || !areAllLivingExplorersDustTraitorsOrDead(core)) {
        return null;
    }
    if (
        options.deferForRabbitFoot !== false
        && core.recentRoll?.kind === 'deathPrevention'
        && shouldDeferDustTraitorVictoryForRabbitFoot(core, core.recentRoll.playerId)
    ) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createDustEndgameResult(core, 'traitor'),
    }, timestamp));
}

function applyDustEventEffectDeathIfNeeded(core: BetrayalCore): void {
    if (!isDustHaunt(core) || !isExplorerDead(core.currentExplorer)) {
        return;
    }
    markDeadExplorer(core, core.currentExplorer.playerId);
    if (core.scenarioRuntime.dust?.permanentTraitorPlayerIds.includes(core.currentExplorer.playerId)) {
        addFeverishMonsterForPlayer(core, core.currentExplorer.playerId);
    }
}

function cloneHelpingHandsRuntimeState(helpingHands: BetrayalHelpingHandsRuntimeState): BetrayalHelpingHandsRuntimeState {
    return {
        strangeAmuletCardId: helpingHands.strangeAmuletCardId,
        strangeAmuletFoundDuringSetup: helpingHands.strangeAmuletFoundDuringSetup,
        trollHandIds: [...helpingHands.trollHandIds],
        monsterTurnAfterPlayerId: helpingHands.monsterTurnAfterPlayerId,
        activeMonsterTurn: helpingHands.activeMonsterTurn,
        monsterTurnControllerPlayerId: helpingHands.monsterTurnControllerPlayerId,
        trollHandMoveAllowance: helpingHands.trollHandMoveAllowance,
        trollHandMoveDice: [...helpingHands.trollHandMoveDice],
        trollHandMoveRemainingById: { ...helpingHands.trollHandMoveRemainingById },
        trollHandAttackUsedIdsThisTurn: [...helpingHands.trollHandAttackUsedIdsThisTurn],
        pendingAttackReward: helpingHands.pendingAttackReward
            ? {
                ...helpingHands.pendingAttackReward,
                defenderTraitsBeforeDamage: { ...helpingHands.pendingAttackReward.defenderTraitsBeforeDamage },
            }
            : undefined,
    };
}

function removeStrangeAmuletFromItemDeck(core: BetrayalCore): void {
    const deck = [...core.possessionOrderByKind.item];
    const index = deck.findIndex(isStrangeAmuletCard);
    if (index < 0) {
        return;
    }
    deck.splice(index, 1);
    core.possessionOrderByKind = {
        ...core.possessionOrderByKind,
        item: deck,
    };
    core.deckCounts.item = Math.max(0, core.deckCounts.item - 1);
}

function ensureStrangeAmuletForHelpingHands(
    core: BetrayalCore,
    revealerPlayerId: string,
): { cardId: string; foundDuringSetup: boolean } {
    const existingHolder = findStrangeAmuletHolder(core);
    if (existingHolder) {
        return { cardId: existingHolder.card.id, foundDuringSetup: false };
    }
    const revealer = findExplorerByPlayerId(core, revealerPlayerId);
    if (!revealer) {
        return { cardId: HELPING_HANDS_STRANGE_AMULET_CARD_ID, foundDuringSetup: false };
    }
    const card = core.possessionOrderByKind.item.find(isStrangeAmuletCard)
        ?? HELPING_HANDS_STRANGE_AMULET_CARD;
    revealer.inventory = [
        ...revealer.inventory.filter((item) => !isStrangeAmuletCard(item)),
        cloneInventoryCard(card),
    ];
    removeStrangeAmuletFromItemDeck(core);
    return { cardId: card.id, foundDuringSetup: true };
}

function createHelpingHandsTrollHands(): BetrayalMonsterSummary[] {
    return [
        { id: 'troll-hand-1', roomId: 'entrance-hall' },
        { id: 'troll-hand-2', roomId: 'basement-landing' },
    ].map((seed, index) => createBetrayalMonsterFromDefinition(
        'helping-hands-troll-hand',
        seed.id,
        seed.roomId,
        { tokenAsset: HELPING_HANDS_TROLL_HAND_TOKEN_ASSETS[index] },
    ));
}

function setupHelpingHandsHaunt(core: BetrayalCore, revealerPlayerId: string): BetrayalHelpingHandsRuntimeState {
    const amulet = ensureStrangeAmuletForHelpingHands(core, revealerPlayerId);
    const trollHands = createHelpingHandsTrollHands();
    core.monsters = [
        ...core.monsters.filter((monster) => !monster.id.startsWith('troll-hand-')),
        ...trollHands,
    ];
    return {
        strangeAmuletCardId: amulet.cardId,
        strangeAmuletFoundDuringSetup: amulet.foundDuringSetup,
        trollHandIds: trollHands.map((monster) => monster.id),
        monsterTurnAfterPlayerId: revealerPlayerId,
        activeMonsterTurn: false,
        monsterTurnControllerPlayerId: null,
        trollHandMoveAllowance: 0,
        trollHandMoveDice: [],
        trollHandMoveRemainingById: {},
        trollHandAttackUsedIdsThisTurn: [],
    };
}

function createHelpingHandsMonsterTurnStartedEvent(
    controllerPlayerId: string,
    random: RandomFn,
    timestamp: number,
): GameEvent<typeof EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED, BetrayalHelpingHandsMonsterTurnStartedPayload> {
    const moveDice = rollBetrayalDicePips(random, 3);
    const moveAllowance = Math.max(1, moveDice.reduce((sum, pip) => sum + pip, 0));
    return nowEvent(EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED, {
        controllerPlayerId,
        moveAllowance,
        moveDice,
        logText: `巨魔手怪物回合开始：速度 3 投出 ${moveDice.join('、')}，每只巨魔手本回合可移动 ${moveAllowance} 间`,
    }, timestamp);
}

function createHelpingHandsEndgameResult(core: BetrayalCore, winnerPlayerId: string): BetrayalEndgameResult {
    return {
        hauntId: 'helping-hands',
        hauntTitle: '援手',
        outcome: 'solo',
        winners: [winnerPlayerId],
        traitorPlayerId: winnerPlayerId,
        survivorsEscaped: [winnerPlayerId],
        reward: {
            stars: scenarioConfigById(core.scenarioId).completion.reward.stars,
            omens: countDrawnCards(core, 'omen'),
            logs: scenarioConfigById(core.scenarioId).completion.reward.logs,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function completeHelpingHandsSoloVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    if (!isHelpingHandsHaunt(core)) {
        return null;
    }
    const livingExplorers = getAllExplorers(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    if (livingExplorers.length !== 1) {
        return null;
    }
    const winner = livingExplorers[0]!;
    if (resolveHelpingHandsControllerPlayerId(core) !== winner.playerId) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createHelpingHandsEndgameResult(core, winner.playerId),
    }, timestamp));
}

function resolvePhantomPhotographerCount(playerCount: number): number {
    return Math.max(2, Math.min(5, playerCount));
}

function resolveMagicCameraPhantomRooms(core: BetrayalCore, count: number): BetrayalRoomNode[] {
    const discovered = core.rooms.filter((room) => room.state === 'discovered');
    const nonLanding = discovered.filter((room) => (
        !room.startingTile
        && !room.id.toLowerCase().includes('landing')
        && !room.name.includes('落脚')
        && !room.name.includes('入口')
    ));
    const candidates = nonLanding.length > 0 ? nonLanding : discovered.filter((room) => !room.startingTile);
    const fallback = candidates.length > 0 ? candidates : discovered;
    if (fallback.length === 0) {
        return [];
    }
    return Array.from({ length: count }, (_, index) => fallback[index % fallback.length]!);
}

function createMagicCameraRuntimeState(core: BetrayalCore, traitorPlayerId: string | null): BetrayalMagicCameraRuntimeState {
    const phantomCount = resolvePhantomPhotographerCount(core.playerIds.length);
    const heroEssencePlayerIds = getAllExplorers(core)
        .filter((explorer) => explorer.playerId !== traitorPlayerId)
        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
        .map((explorer) => explorer.playerId);
    return {
        cameraDestroyed: false,
        cameraHolderPlayerId: findMagicCameraHolderPlayerId(core) ?? traitorPlayerId,
        heroEssencePlayerIds,
        capturedEssencePlayerIds: [],
        phantomPhotographerIds: Array.from({ length: phantomCount }, (_, index) => `phantom-photographer-${index + 1}`),
        killedPhantomPhotographerIds: [],
        stunnedPhantomPhotographerIds: [],
    };
}

function createMagicCameraPhantomPhotographers(core: BetrayalCore, magicCamera: BetrayalMagicCameraRuntimeState): BetrayalMonsterSummary[] {
    const rooms = resolveMagicCameraPhantomRooms(core, magicCamera.phantomPhotographerIds.length);
    return magicCamera.phantomPhotographerIds.map((id, index) => createBetrayalMonsterFromDefinition(
        'magic-camera-phantom-photographer',
        id,
        rooms[index]?.id ?? core.activeRoomId,
    ));
}

function removeMagicCameraFromExplorer(explorer: BetrayalExplorerSummary): void {
    explorer.inventory = explorer.inventory.filter((card) => resolveInventoryEffectId(card.id) !== 'camera');
}

function ensureMagicCameraInTraitorInventory(core: BetrayalCore, traitorPlayerId: string | null): string | null {
    const existingHolderId = findMagicCameraHolderPlayerId(core);
    if (existingHolderId) {
        return existingHolderId;
    }
    const traitor = traitorPlayerId ? findExplorerByPlayerId(core, traitorPlayerId) : null;
    if (!traitor) {
        return null;
    }
    const cameraSeed = core.possessionOrderByKind.item.find((card) => resolveInventoryEffectId(card.id) === 'camera')
        ?? { id: 'camera', name: '魔法相机', kind: 'item' as const };
    traitor.inventory = [
        ...traitor.inventory.filter((card) => resolveInventoryEffectId(card.id) !== 'camera'),
        cloneInventoryCard(cameraSeed),
    ];
    core.possessionOrderByKind.item = core.possessionOrderByKind.item
        .filter((card) => resolveInventoryEffectId(card.id) !== 'camera');
    return traitor.playerId;
}

function setupMagicCameraHaunt(core: BetrayalCore, traitorPlayerId: string | null): BetrayalMagicCameraRuntimeState {
    const cameraHolderPlayerId = ensureMagicCameraInTraitorInventory(core, traitorPlayerId);
    const runtime = createMagicCameraRuntimeState(core, traitorPlayerId);
    runtime.cameraHolderPlayerId = cameraHolderPlayerId ?? runtime.cameraHolderPlayerId;
    const existingPhantomIds = new Set(runtime.phantomPhotographerIds);
    core.monsters = [
        ...core.monsters.filter((monster) => !monster.id.startsWith('phantom-photographer-')),
        ...createMagicCameraPhantomPhotographers(core, runtime),
    ].filter((monster, index, list) => (
        !monster.id.startsWith('phantom-photographer-')
        || existingPhantomIds.has(monster.id)
        || list.findIndex((item) => item.id === monster.id) === index
    ));
    return runtime;
}

function resolveUponReflectionMirrorBeingCount(playerCount: number): number {
    if (playerCount >= 6) {
        return 5;
    }
    if (playerCount >= 5) {
        return 4;
    }
    if (playerCount >= 4) {
        return 3;
    }
    return 2;
}

function setupUponReflectionHaunt(core: BetrayalCore): void {
    const mirrorBeingCount = resolveUponReflectionMirrorBeingCount(core.playerIds.length);
    const mirrorBeings = Array.from({ length: mirrorBeingCount }, (_, index) => (
        createBetrayalMonsterFromDefinition(
            'upon-reflection-mirror-being',
            `mirror-being-${index + 1}`,
            'entrance-hall',
        )
    ));
    core.monsters = [
        ...core.monsters.filter((monster) => (
            monster.definitionId !== 'upon-reflection-mirror-being'
            && !monster.id.startsWith('mirror-being-')
        )),
        ...mirrorBeings,
    ];
}

function shouldSkipEventSymbolForUponReflection(core: BetrayalCore): boolean {
    return isUponReflectionHaunt(core);
}

function createUponReflectionRuntimeState(
    core: BetrayalCore,
    revealerPlayerId: string,
    random: RandomFn,
): BetrayalUponReflectionRuntimeState {
    const trait = random.shuffle(BETRAYAL_TRAIT_KEYS)[0] ?? 'might';
    const omen = random.shuffle(DRAW_POOL.omen.map(cloneInventoryCard))[0]
        ?? { id: 'omen-book', name: '书本', kind: 'omen' as const };
    const shuffledRoomDeck = random.shuffle(resolveCurrentRoomDiscoveryDeck(core));
    const bottomRoomEntry = shuffledRoomDeck[shuffledRoomDeck.length - 1] ?? null;
    const matchingDiscoveredRoom = bottomRoomEntry
        ? core.rooms.find((room) => (
            room.visualId === bottomRoomEntry.room.visualId
            || room.name === bottomRoomEntry.room.name
        ))
        : null;
    const fallbackRoom = matchingDiscoveredRoom
        ?? core.rooms.find((room) => room.state === 'discovered')
        ?? core.rooms[0]
        ?? null;
    return {
        revealerPlayerId,
        secretCombination: {
            trait,
            omenId: resolveInventoryEffectId(omen.id),
            omenName: omen.name,
            roomId: matchingDiscoveredRoom?.id ?? fallbackRoom?.id ?? null,
            roomName: bottomRoomEntry?.room.name ?? fallbackRoom?.name ?? '未知房间',
            roomVisualId: bottomRoomEntry?.room.visualId ?? fallbackRoom?.visualId,
        },
        breakAttempts: [],
        hintedEvents: [],
    };
}

function resolveUponReflectionOmenSelection(
    actor: BetrayalExplorerSummary,
    payload: BetrayalCommandMap[typeof BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE],
): BetrayalInventoryCard | null {
    const requestedId = payload.omenId ? resolveInventoryEffectId(payload.omenId) : null;
    const requestedName = payload.omenName?.trim();
    const omenCards = actor.inventory.filter((card) => card.kind === 'omen');
    return omenCards.find((card) => (
        (requestedId && resolveInventoryEffectId(card.id) === requestedId)
        || (payload.omenId && card.id === payload.omenId)
        || (requestedName && card.name === requestedName)
    )) ?? null;
}

function roomMatchesUponReflectionSecret(
    room: BetrayalRoomNode | null | undefined,
    secret: BetrayalUponReflectionSecretCombination,
): boolean {
    if (!room) {
        return false;
    }
    return room.id === secret.roomId
        || room.name === secret.roomName
        || (secret.roomVisualId ? room.visualId === secret.roomVisualId : false);
}

function resolveUponReflectionHintEvent(core: BetrayalCore, eventName: string | undefined): EventTemplate | null {
    const requestedEventName = eventName?.trim();
    if (!requestedEventName) {
        return null;
    }
    const eventCard = core.eventOrder.find((candidate) => candidate.name === requestedEventName);
    return eventCard ? cloneEventTemplate(eventCard) : null;
}

function hasUsedMirrorHintThisTurn(core: BetrayalCore, revealerPlayerId: string): boolean {
    return core.usedCardIdsThisTurn.includes('give-mirror-hint')
        || Boolean(core.scenarioRuntime.uponReflection?.hintedEvents.some((hintedEvent) => (
            hintedEvent.revealerPlayerId === revealerPlayerId
            && hintedEvent.turnNumber === core.turnNumber
        )));
}

function createUponReflectionEndgameResult(core: BetrayalCore, outcome: 'survivors'): BetrayalEndgameResult {
    const winners = getAllExplorers(core)
        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
        .map((explorer) => explorer.playerId);
    return {
        hauntId: 'upon-reflection',
        hauntTitle: 'Upon Reflection',
        outcome,
        winners,
        traitorPlayerId: '',
        survivorsEscaped: [...winners],
        reward: {
            stars: scenarioConfigById(core.scenarioId).completion.reward.stars,
            omens: countDrawnCards(core, 'omen'),
            logs: scenarioConfigById(core.scenarioId).completion.reward.logs,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function resolveAttackDamageKind(attackTrait: BetrayalTraitKey): 'physical' | 'mental' {
    return attackTrait === 'sanity' || attackTrait === 'knowledge'
        ? 'mental'
        : 'physical';
}

function applyBetrayalMonsterDamageOutcome(
    core: BetrayalCore,
    outcome: BetrayalMonsterDamageOutcome,
): void {
    if (outcome.kind === 'stunned' || outcome.kind === 'killed') {
        core.scenarioRuntime.monsterStatusesById = {
            ...(core.scenarioRuntime.monsterStatusesById ?? {}),
            [outcome.monsterId]: outcome.nextStatus,
        };
    }
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (!magicCamera?.phantomPhotographerIds.includes(outcome.monsterId)) {
        return;
    }
    if (outcome.kind === 'killed') {
        magicCamera.killedPhantomPhotographerIds = Array.from(new Set([
            ...magicCamera.killedPhantomPhotographerIds,
            outcome.monsterId,
        ]));
        magicCamera.stunnedPhantomPhotographerIds = magicCamera.stunnedPhantomPhotographerIds
            .filter((id) => id !== outcome.monsterId);
        core.monsters = core.monsters.filter((monster) => monster.id !== outcome.monsterId);
        return;
    }
    if (outcome.kind === 'stunned') {
        magicCamera.stunnedPhantomPhotographerIds = Array.from(new Set([
            ...magicCamera.stunnedPhantomPhotographerIds,
            outcome.monsterId,
        ]));
    }
}

function clearBetrayalMonsterStatus(core: BetrayalCore, monsterId: string): void {
    const { [monsterId]: _cleared, ...remainingStatuses } = core.scenarioRuntime.monsterStatusesById ?? {};
    core.scenarioRuntime.monsterStatusesById = remainingStatuses;
}

function flipStunnedMonsterSideUp(core: BetrayalCore, monsterId: string): void {
    clearBetrayalMonsterStatus(core, monsterId);
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (magicCamera?.stunnedPhantomPhotographerIds.includes(monsterId)) {
        magicCamera.stunnedPhantomPhotographerIds = magicCamera.stunnedPhantomPhotographerIds
            .filter((id) => id !== monsterId);
    }
}

function setupBloodFromStoneHaunt(core: BetrayalCore): void {
    const plan = resolveBloodFromStoneSetupPlacementPlan(core);
    core.monsters = [
        ...core.monsters.filter((monster) => (
            !isStoneCherubMonster(monster)
            && !monster.id.startsWith('stone-cherub-')
        )),
        ...plan.placements.map((placement) => createBetrayalMonsterFromDefinition(
            'blood-from-stone-stone-cherub',
            placement.monsterId,
            placement.roomId,
        )),
    ];
    core.scenarioRuntime.bloodFromStone = {
        monsterTurnAfterPlayerId: core.scenarioRuntime.hauntRevealerPlayerId ?? core.currentPlayer,
        activeMonsterTurn: false,
        monsterTurnControllerPlayerId: null,
    };
}

function startBloodFromStoneMonsterTurnAfterPlayerIfNeeded(
    core: BetrayalCore,
    previousPlayerId: string,
    _timestamp: number,
): BetrayalCore {
    const status = resolveBloodFromStoneMonsterTurnStatus(core);
    if (
        status.active
        || status.monsterTurnAfterPlayerId !== previousPlayerId
        || !status.controllerPlayerId
        || status.stoneCherubIds.length === 0
    ) {
        return core;
    }
    const controllerCore = replaceExplorers(core, getAllExplorers(core), status.controllerPlayerId);
    const nextBloodFromStone: BetrayalBloodFromStoneMonsterTurnRuntimeState = {
        monsterTurnAfterPlayerId: status.monsterTurnAfterPlayerId,
        activeMonsterTurn: true,
        monsterTurnControllerPlayerId: status.controllerPlayerId,
    };
    const startedCore: BetrayalCore = {
        ...controllerCore,
        turnStartSpeed: 0,
        movesRemaining: 0,
        activePlayerId: status.controllerPlayerId,
        recentRoll: null,
        recommendedAction: 'endTurn',
        scenarioRuntime: {
            ...controllerCore.scenarioRuntime,
            bloodFromStone: nextBloodFromStone,
            monsterTurn: createInitialMonsterTurnRuntimeState(),
            bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId:
                createBloodFromStoneTurnStartVisibility(controllerCore),
            bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [],
        },
    };
    const syncedCore = syncCurrentExplorerProjection(startedCore);
    return {
        ...syncedCore,
        activePlayerId: status.controllerPlayerId,
        recommendedAction: 'endTurn',
        activityLog: appendActivity(syncedCore, '石像小天使怪物回合开始。', 'warning'),
    };
}

function removeBloodFromStoneStoneCherubs(core: BetrayalCore, monsterIds: string[]): void {
    const removedIds = new Set(monsterIds);
    core.monsters = core.monsters.filter((monster) => !removedIds.has(monster.id));
    core.scenarioRuntime.monsterStatusesById = Object.fromEntries(
        Object.entries(core.scenarioRuntime.monsterStatusesById ?? {})
            .filter(([monsterId]) => !removedIds.has(monsterId)),
    );
    const monsterTurn = core.scenarioRuntime.monsterTurn;
    core.scenarioRuntime.monsterTurn = {
        ...monsterTurn,
        resolvedStartMonsterIds: monsterTurn.resolvedStartMonsterIds.filter((monsterId) => !removedIds.has(monsterId)),
        skippedMonsterIdsThisTurn: monsterTurn.skippedMonsterIdsThisTurn.filter((monsterId) => !removedIds.has(monsterId)),
        attackedMonsterIdsThisTurn: monsterTurn.attackedMonsterIdsThisTurn.filter((monsterId) => !removedIds.has(monsterId)),
        movedMonsterIdsThisTurn: monsterTurn.movedMonsterIdsThisTurn.filter((monsterId) => !removedIds.has(monsterId)),
        moveRemainingById: Object.fromEntries(
            Object.entries(monsterTurn.moveRemainingById ?? {}).filter(([monsterId]) => !removedIds.has(monsterId)),
        ),
    };
}

function createBloodFromStoneEndgameResult(
    core: BetrayalCore,
    outcome: 'survivors' | 'haunt',
): BetrayalEndgameResult {
    const livingHeroes = resolveLivingHeroExplorers(core);
    const livingHeroPlayerIds = new Set(livingHeroes.map((explorer) => explorer.playerId));
    const winners = outcome === 'survivors'
        ? core.playerIds.filter((playerId) => livingHeroPlayerIds.has(playerId))
        : [];
    return {
        hauntId: 'blood-from-a-stone',
        hauntTitle: '顽石之血',
        outcome,
        winners,
        traitorPlayerId: '',
        survivorsEscaped: outcome === 'survivors' ? winners : [],
        reward: {
            stars: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function hasActiveBloodFromStoneStoneCherubs(core: BetrayalCore): boolean {
    return core.monsters.some((monster) => (
        isStoneCherubMonster(monster)
        && resolveMonsterStatusKind(core, monster.id) !== 'killed'
    ));
}

function areAllBloodFromStoneHeroesDead(core: BetrayalCore): boolean {
    const heroes = getAllExplorers(core)
        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId);
    return heroes.length > 0
        && heroes.every((explorer) => core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId));
}

function completeBloodFromStoneHeroVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    if (!isBloodFromStoneHaunt(core) || hasActiveBloodFromStoneStoneCherubs(core)) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createBloodFromStoneEndgameResult(core, 'survivors'),
    }, timestamp));
}

function completeBloodFromStoneHauntVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    if (!isBloodFromStoneHaunt(core) || !areAllBloodFromStoneHeroesDead(core)) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createBloodFromStoneEndgameResult(core, 'haunt'),
    }, timestamp));
}

function resolveMagicCameraEndTurn(core: BetrayalCore): string[] {
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (!isMagicCameraHaunt(core) || !magicCamera) {
        return [];
    }
    const actor = core.currentExplorer;
    if (
        actor.playerId === core.scenarioRuntime.traitorPlayerId
        || core.scenarioRuntime.deadExplorerPlayerIds.includes(actor.playerId)
        || !magicCamera.heroEssencePlayerIds.includes(actor.playerId)
    ) {
        return [];
    }
    const actorRoom = resolveExplorerRoom(core, actor);
    if (!actorRoom) {
        return [];
    }
    const visiblePhotographer = core.monsters.some((monster) => (
        magicCamera.phantomPhotographerIds.includes(monster.id)
        && !magicCamera.killedPhantomPhotographerIds.includes(monster.id)
        && isStraightLineVisible(
            core.rooms.find((room) => room.id === monster.roomId) ?? actorRoom,
            actorRoom,
            core.rooms,
        )
    ));
    return visiblePhotographer ? [actor.playerId] : [];
}

function createMagicCameraEndgameResult(core: BetrayalCore, outcome: BetrayalScenarioOutcome): BetrayalEndgameResult {
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId ?? '';
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    const winners = outcome === 'traitor'
        ? [traitorPlayerId].filter(Boolean)
        : livingHeroes.map((explorer) => explorer.playerId);
    return {
        hauntId: 'magic-camera',
        hauntTitle: '魔法相机',
        outcome,
        winners,
        traitorPlayerId,
        survivorsEscaped: outcome === 'survivors' ? winners : [],
        reward: {
            stars: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenarioConfigById(core.scenarioId).completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function completeMagicCameraHeroVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (!isMagicCameraHaunt(core) || !magicCamera || !magicCamera.cameraDestroyed) {
        return null;
    }
    const allPhotographersKilled = magicCamera.phantomPhotographerIds.every((id) => (
        magicCamera.killedPhantomPhotographerIds.includes(id)
        || !core.monsters.some((monster) => monster.id === id)
    ));
    if (!allPhotographersKilled) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createMagicCameraEndgameResult(core, 'survivors'),
    }, timestamp));
}

function completeMagicCameraTraitorVictoryIfNeeded(core: BetrayalCore, timestamp: number): BetrayalCore | null {
    if (!isMagicCameraHaunt(core)) {
        return null;
    }
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    if (livingHeroes.length > 0) {
        return null;
    }
    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
        result: createMagicCameraEndgameResult(core, 'traitor'),
    }, timestamp));
}

function resolveDustEndTurn(core: BetrayalCore, random: RandomFn): BetrayalDustEndTurnResult | undefined {
    const dust = core.scenarioRuntime.dust;
    if (!isDustHaunt(core) || !dust || core.scenarioRuntime.deadExplorerPlayerIds.includes(core.currentExplorer.playerId)) {
        return undefined;
    }
    const previewDust = cloneDustRuntimeState(dust);
    const sameRoomExplorers = resolveSameRoomLivingExplorers(core, core.currentExplorer.roomId, core.currentExplorer.playerId);
    const swaps: BetrayalDustSicknessSwapResult[] = [];
    for (const target of sameRoomExplorers) {
        const swap = resolveDustSicknessSwap(previewDust, core.currentExplorer.playerId, target.playerId, random);
        if (!swap) {
            continue;
        }
        swaps.push(swap);
        applyDustSicknessSwap(previewDust, swap);
    }
    const alreadyExchanged = dust.exchangedSicknessThisTurnPlayerIds.includes(core.currentExplorer.playerId);
    if (swaps.length > 0 || alreadyExchanged) {
        return { swaps };
    }
    const damageDice = rollBetrayalDicePips(random, 2);
    const damageAmount = damageDice.reduce((sum, pip) => sum + pip, 0);
    const damageTraits: BetrayalTraitKey[] = ['might', 'speed', 'knowledge', 'sanity'];
    return {
        swaps,
        damagePlayerId: core.currentExplorer.playerId,
        damageAmount,
        damageTraits,
    };
}

function createBookPendingEventRollReplacement(
    core: BetrayalCore,
    playerId: string,
    cardId: string | undefined,
    random: RandomFn,
    timestamp: number,
): BetrayalEventRollReplacementResult | null {
    if (!canUseBookForPendingEventRoll(core, playerId, cardId)) {
        return null;
    }
    const pending = core.pendingEventRollResolution;
    const recentRoll = core.recentRoll;
    const owner = findExplorerByPlayerId(core, playerId);
    if (
        !pending
        || !recentRoll
        || recentRoll.kind !== 'eventTraitCheck'
        || !recentRoll.trait
        || !recentRoll.branchThresholds?.length
        || !owner
    ) {
        return null;
    }
    const candidates = owner.inventory.filter((card) => (
        resolveUseEffect(card)?.mode === 'nextNonCombatTraitReplacement'
    ));
    const card = cardId
        ? candidates.find((candidate) => candidate.id === cardId)
        : candidates[0];
    const effect = card ? resolveUseEffect(card) : null;
    if (!card || effect?.mode !== 'nextNonCombatTraitReplacement') {
        return null;
    }
    const replacementCore: BetrayalCore = {
        ...core,
        nextNonCombatTraitReplacement: {
            playerId,
            sourceCardId: card.id,
            replacementTrait: effect.replacementTrait,
        },
    };
    const roll = rollEventTraitCheckWithDice(random, owner, effect.replacementTrait, replacementCore);
    const nextBranch = resolveEventBranch(recentRoll.branchThresholds, roll.total);
    const nextEffect = materializeEventEffect(
        nextBranch.effect,
        random,
        owner,
        replacementCore,
        { materializeRandomResults: false },
    );
    const nextPendingEventChoice = eventEffectNeedsPendingEventChoice(nextEffect)
        ? {
            id: `${pending.rollId}-book-${timestamp}`,
            playerId: pending.playerId,
            sourceTitle: pending.sourceTitle,
            eventDescription: recentRoll.eventDescription,
            effect: cloneUseEffect(nextEffect),
        }
        : undefined;
    const pendingHauntRoll = pending.hauntRoll;
    const hauntTriggered = pendingHauntRoll
        ? roll.total >= pendingHauntRoll.threshold
        : false;
    const hauntRevealResolution = hauntTriggered
        ? resolveHauntRevealResolutionForTrigger(
            core,
            { id: null, name: pendingHauntRoll?.successHauntTriggerLabel ?? recentRoll.sourceTitle },
            pendingHauntRoll?.successHauntId,
        )
        : undefined;
    const hauntTraitorResolution = hauntTriggered && hauntRevealResolution
        ? resolveHauntTraitorResolutionForTrigger(
            core,
            hauntRevealResolution.hauntCardNumber,
            playerId,
            {
                eventSelection: pendingHauntRoll?.successTraitorSelection,
                revealRepresentativeOnly: hauntRevealResolution.representativeOnly,
            },
        )
        : undefined;
    return {
        dice: [...roll.dice],
        passiveBonus: roll.passiveBonus,
        total: roll.total,
        latestLabel: nextBranch.label,
        effect: cloneUseEffect(nextEffect),
        hauntRoll: pending.hauntRoll ? { ...pending.hauntRoll } : undefined,
        nextPendingEventChoice,
        hauntTriggered: pendingHauntRoll ? hauntTriggered : pending.hauntTriggered,
        hauntCardNumber: hauntTriggered ? pendingHauntRoll?.successHauntId : undefined,
        hauntTriggerLabel: hauntTriggered
            ? pendingHauntRoll?.successHauntTriggerLabel ?? recentRoll.sourceTitle
            : undefined,
        hauntTraitorPlayerId: hauntTraitorResolution?.traitorPlayerId,
        hauntRevealResolution,
        hauntTraitorResolution,
        dustSetup: hauntTriggered && pendingHauntRoll?.successHauntId === 3
            ? createDustRuntimeState(core, random)
            : undefined,
        uponReflectionSetup: hauntTriggered && pendingHauntRoll?.successHauntId === 7
            ? createUponReflectionRuntimeState(core, playerId, random)
            : undefined,
    };
}

function healExplorerToTemplate(explorer: BetrayalExplorerSummary): void {
    const template = templateByExplorerId(explorer.explorerId);
    if (!template) {
        return;
    }
    for (const trait of BETRAYAL_TRAIT_KEYS) {
        healExplorerTraitToStart(explorer, trait);
    }
}

function healExplorerTraitsToTemplate(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
): void {
    const template = templateByExplorerId(explorer.explorerId);
    if (!template) {
        return;
    }
    for (const trait of traits) {
        healExplorerTraitToStart(explorer, trait);
    }
}

function resolveCrimsonJackTraitorPhysicalBonus(playerCount: number): number {
    return playerCount >= 5 ? 2 : 1;
}

function healTraitorForHaunt(explorer: BetrayalExplorerSummary, playerCount: number): void {
    healExplorerToTemplate(explorer);
    const physicalBonus = resolveCrimsonJackTraitorPhysicalBonus(playerCount);
    moveExplorerTraitSteps(explorer, 'might', physicalBonus);
    moveExplorerTraitSteps(explorer, 'speed', physicalBonus);
}

function reviveTraitorFromJackSpirit(explorer: BetrayalExplorerSummary): void {
    healExplorerToTemplate(explorer);
}

function findJackSpirit(core: BetrayalCore): BetrayalMonsterSummary | null {
    return core.monsters.find((monster) => monster.id === 'jack-spirit') ?? null;
}

function wouldExplorerDieFromPhysicalDamage(explorer: BetrayalExplorerSummary, amount: number): boolean {
    if (amount <= 0) {
        return false;
    }
    const preview = cloneExplorer(explorer);
    applyPhysicalDamage(preview, amount, { allowSkull: true });
    return isExplorerDead(preview);
}

function wouldExplorerDieFromMentalDamage(explorer: BetrayalExplorerSummary, amount: number): boolean {
    if (amount <= 0) {
        return false;
    }
    const preview = cloneExplorer(explorer);
    applyMentalDamage(preview, amount, { allowSkull: true });
    return isExplorerDead(preview);
}

function wouldExplorerDieFromAttackDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    damageKind: 'physical' | 'mental',
): boolean {
    return damageKind === 'mental'
        ? wouldExplorerDieFromMentalDamage(explorer, amount)
        : wouldExplorerDieFromPhysicalDamage(explorer, amount);
}

function resolveDeathPreventionRollCardId(explorer: BetrayalExplorerSummary): string | null {
    return explorer.inventory
        .map((card) => resolveInventoryEffectId(card.id))
        .find((cardId) => Boolean(DEATH_PREVENTION_ROLL_CARDS_BY_ID[cardId]))
        ?? null;
}

function rollDeathPrevention(random: RandomFn, explorer: BetrayalExplorerSummary): {
    playerId: string;
    prevented: boolean;
    rollTotal: number;
    dice: number[];
    minTotal: number;
    cardId: string;
} | null {
    const cardId = resolveDeathPreventionRollCardId(explorer);
    if (!cardId) {
        return null;
    }
    const config = DEATH_PREVENTION_ROLL_CARDS_BY_ID[cardId]!;
    const dice = rollBetrayalDicePips(random, config.dice);
    const rollTotal = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        playerId: explorer.playerId,
        cardId,
        dice,
        minTotal: config.minTotal,
        rollTotal,
        prevented: rollTotal >= config.minTotal,
    };
}

function setExplorerTraitsToDeathsDoor(explorer: BetrayalExplorerSummary): void {
    normalizeExplorerTraitTracks(explorer);
    for (const trait of BETRAYAL_TRAIT_KEYS) {
        setExplorerTraitPosition(explorer, trait, explorer.traitTracks[trait].criticalPosition);
    }
}

function formatDeathPreventionLog(deathPrevention: {
    cardId: string;
    rollTotal: number;
    prevented: boolean;
} | null | undefined): string {
    if (!deathPrevention) {
        return '';
    }
    const cardName = deathPrevention.cardId === 'skull' ? '头骨' : deathPrevention.cardId;
    return deathPrevention.prevented
        ? `；${cardName}投出 ${deathPrevention.rollTotal}，阻止死亡并将所有属性调至濒死`
        : `；${cardName}投出 ${deathPrevention.rollTotal}，正常死亡`;
}

function cloneUponReflectionRuntimeState(
    uponReflection: BetrayalUponReflectionRuntimeState,
): BetrayalUponReflectionRuntimeState {
    return {
        revealerPlayerId: uponReflection.revealerPlayerId,
        secretCombination: uponReflection.secretCombination
            ? { ...uponReflection.secretCombination }
            : null,
        breakAttempts: uponReflection.breakAttempts.map((attempt) => ({
            ...attempt,
            dice: [...attempt.dice],
        })),
        hintedEvents: uponReflection.hintedEvents.map((hintedEvent) => ({ ...hintedEvent })),
    };
}

function cloneScenarioRuntimeStatus(status: BetrayalScenarioRuntimeStatus): BetrayalScenarioRuntimeStatus {
    return {
        ...status,
        hauntTraitorResolution: cloneHauntTraitorResolution(status.hauntTraitorResolution),
        hauntFirstPlayerResolution: cloneHauntFirstPlayerResolution(status.hauntFirstPlayerResolution),
        exorcismCircleRoomIds: [...status.exorcismCircleRoomIds],
        knowledgeOfJackPlayerIds: [...status.knowledgeOfJackPlayerIds],
        deadExplorerPlayerIds: [...status.deadExplorerPlayerIds],
        corpseLootedByPlayerIdsThisTurn: [...status.corpseLootedByPlayerIdsThisTurn],
        usedRoomEffectIdsThisTurn: [...status.usedRoomEffectIdsThisTurn],
        hauntSetupQueue: (status.hauntSetupQueue ?? []).map((entry) => ({ ...entry })),
        monsterStatusesById: { ...(status.monsterStatusesById ?? {}) },
        monsterTurn: cloneMonsterTurnRuntimeState(status.monsterTurn),
        bloodFromStone: cloneBloodFromStoneMonsterTurnRuntimeState(status.bloodFromStone),
        bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: Object.fromEntries(
            Object.entries(status.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId ?? {}).map(([playerId, ids]) => [
                playerId,
                [...ids],
            ]),
        ),
        bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [
            ...(status.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn ?? []),
        ],
        dust: status.dust ? cloneDustRuntimeState(status.dust) : undefined,
        helpingHands: status.helpingHands ? cloneHelpingHandsRuntimeState(status.helpingHands) : undefined,
        magicCamera: status.magicCamera ? cloneMagicCameraRuntimeState(status.magicCamera) : undefined,
        mummy: status.mummy ? cloneMummyRuntimeState(status.mummy) : undefined,
        uponReflection: status.uponReflection ? cloneUponReflectionRuntimeState(status.uponReflection) : undefined,
    };
}

function maskUponReflectionRuntimeForPlayer(
    uponReflection: BetrayalUponReflectionRuntimeState,
    viewingPlayerId: PlayerId,
): BetrayalUponReflectionRuntimeState {
    return {
        ...cloneUponReflectionRuntimeState(uponReflection),
        secretCombination: uponReflection.revealerPlayerId === viewingPlayerId
            ? uponReflection.secretCombination
                ? { ...uponReflection.secretCombination }
                : null
            : null,
    };
}

function maskDustRuntimeForPlayer(
    dust: BetrayalDustRuntimeState,
    viewingPlayerId: PlayerId,
): BetrayalDustRuntimeState {
    return {
        sicknessTokensByPlayerId: Object.fromEntries(
            Object.entries(dust.sicknessTokensByPlayerId).map(([playerId, tokens]) => [
                playerId,
                tokens.map((token) => (
                    playerId === viewingPlayerId
                        ? { ...token }
                        : { ...token, value: null }
                )),
            ]),
        ),
        permanentTraitorPlayerIds: dust.permanentTraitorPlayerIds.includes(viewingPlayerId)
            ? [viewingPlayerId]
            : [],
        researchRoomIds: [...dust.researchRoomIds],
        exchangedSicknessThisTurnPlayerIds: [...dust.exchangedSicknessThisTurnPlayerIds],
        feverishPlayerIds: [...dust.feverishPlayerIds],
        pendingSicknessExchange: dust.pendingSicknessExchange
            ? { ...dust.pendingSicknessExchange }
            : undefined,
    };
}

function createBetrayalPlayerView(state: BetrayalCore, viewingPlayerId: PlayerId): BetrayalCore {
    const view = cloneCore(state);
    if (view.scenarioRuntime.dust) {
        view.scenarioRuntime.dust = maskDustRuntimeForPlayer(view.scenarioRuntime.dust, viewingPlayerId);
    }
    if (view.scenarioRuntime.uponReflection) {
        view.scenarioRuntime.uponReflection = maskUponReflectionRuntimeForPlayer(
            view.scenarioRuntime.uponReflection,
            viewingPlayerId,
        );
    }
    const deathPreventionRuntime = view.recentRoll?.deathPrevention?.scenarioRuntimeBeforeDefeat;
    if (deathPreventionRuntime?.dust) {
        deathPreventionRuntime.dust = maskDustRuntimeForPlayer(deathPreventionRuntime.dust, viewingPlayerId);
    }
    if (deathPreventionRuntime?.uponReflection) {
        deathPreventionRuntime.uponReflection = maskUponReflectionRuntimeForPlayer(
            deathPreventionRuntime.uponReflection,
            viewingPlayerId,
        );
    }
    return view;
}

function applyDeathPreventionRerollOutcome(
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    recentRoll: BetrayalRecentRollState,
    nextRoll: BetrayalRecentRollState,
    nextTotal: number,
): void {
    const deathPrevention = recentRoll.deathPrevention;
    if (!deathPrevention) {
        return;
    }
    core.scenarioRuntime = cloneScenarioRuntimeStatus(deathPrevention.scenarioRuntimeBeforeDefeat);
    core.monsters = deathPrevention.monstersBeforeDefeat.map(cloneMonster);
    resetExplorerTraits(explorer, deathPrevention.traitsBeforeDamage);
    if (deathPrevention.damageTraits?.length) {
        applyGeneralDamage(explorer, deathPrevention.damageAmount, deathPrevention.damageTraits, { allowSkull: true });
    } else {
        applyAttackDamage(explorer, deathPrevention.damageAmount, deathPrevention.damageKind);
    }
    if (nextTotal >= deathPrevention.minTotal) {
        core.scenarioRuntime.deadExplorerPlayerIds = core.scenarioRuntime.deadExplorerPlayerIds.filter((playerId) => playerId !== explorer.playerId);
        setExplorerTraitsToDeathsDoor(explorer);
        nextRoll.latestLabel = '阻止死亡';
    } else {
        core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
            ...core.scenarioRuntime.deadExplorerPlayerIds,
            explorer.playerId,
        ]));
        if (isDustHaunt(core) && core.scenarioRuntime.dust?.permanentTraitorPlayerIds.includes(explorer.playerId)) {
            addFeverishMonsterForPlayer(core, explorer.playerId);
            buryDustDeadTraitorPossessions(core, explorer.playerId, { deferForRabbitFoot: false });
        } else if (core.scenarioRuntime.traitorPlayerId === explorer.playerId) {
            core.scenarioRuntime.traitorCorpseRoomId = explorer.roomId;
            core.scenarioRuntime.jackSpiritReleased = true;
            core.scenarioRuntime.jackSpiritRoomId = deathPrevention.releasedJackSpiritRoomId
                ?? resolveJackSpiritSpawnRoomId(core, explorer.roomId);
            core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
            core.monsters = [createBetrayalMonsterFromDefinition(
                'crimson-jack-spirit',
                'jack-spirit',
                core.scenarioRuntime.jackSpiritRoomId,
            )];
        }
        nextRoll.latestLabel = '正常死亡';
    }
    nextRoll.deathPrevention = {
        ...deathPrevention,
        damageTraits: deathPrevention.damageTraits ? [...deathPrevention.damageTraits] : undefined,
        traitsBeforeDamage: { ...deathPrevention.traitsBeforeDamage },
        scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(deathPrevention.scenarioRuntimeBeforeDefeat),
        monstersBeforeDefeat: deathPrevention.monstersBeforeDefeat.map(cloneMonster),
    };
}

function ensureLibraryPresent(core: BetrayalCore): void {
    const existingLibrary = core.rooms.find((room) => room.name === '图书馆');
    if (existingLibrary) {
        return;
    }
    const upperWest = core.rooms.find((room) => room.id === 'upper-west');
    if (upperWest) {
        upperWest.name = '图书馆';
        upperWest.hint = '翻找旧案、了解 Crimson Jack 的最佳地点';
        upperWest.tags = ['知识', '调查', '图书馆'];
        upperWest.state = 'discovered';
        upperWest.discoveryReward = null;
    }
}

function rollTrait(random: RandomFn, value: number): number {
    let total = 0;
    for (let index = 0; index < normalizeBetrayalDiceCount(value); index += 1) {
        total += rollBetrayalPip(random);
    }
    return total;
}

function rollAttackWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    weaponEffect: ReturnType<typeof resolveAttackWeaponEffect>,
): { total: number; dice: number[]; passiveBonus: number } {
    const trait = weaponEffect?.attackTrait ?? 'might';
    const dice = rollBetrayalDicePips(random, explorer.traits[trait] + (weaponEffect?.extraDice ?? 0));
    const passiveBonus = weaponEffect?.bonus ?? 0;
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}

function rollAttackDefense(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    weaponEffect: ReturnType<typeof resolveAttackWeaponEffect>,
    fallbackTrait: BetrayalTraitKey = 'might',
): number {
    const trait = weaponEffect?.attackTrait ?? fallbackTrait;
    const extraDice = resolveDefenseExtraDiceWhenAttacked(explorer);
    return rollTrait(random, explorer.traits[trait] + extraDice);
}

function applyAttackDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    damageKind: 'physical' | 'mental',
): void {
    if (damageKind === 'mental') {
        applyMentalDamage(explorer, amount, { allowSkull: true });
        return;
    }
    applyPhysicalDamage(explorer, amount, { allowSkull: true });
}

function canDeferOrdinaryAttackDamageToDefender(
    core: BetrayalCore,
    target: BetrayalHauntAttackTarget,
): boolean {
    return !isMagicCameraHaunt(core)
        && !isHelpingHandsHaunt(core)
        && (target === 'traitor' || target === 'hero');
}

function isPendingDamageAllocationForAttackRoll(core: BetrayalCore): boolean {
    const pending = core.pendingDamageAllocation;
    const attack = core.recentRoll?.kind === 'attackRoll' ? core.recentRoll.attack : null;
    return Boolean(
        pending
        && attack
        && attack.defenderPlayerId
        && pending.sourceTitle === '攻击'
        && pending.playerId === attack.defenderPlayerId
        && pending.damageKind === attack.damageKind
        && pending.originalAmount === attack.previousDamageToDefender
        && canDeferOrdinaryAttackDamageToDefender(core, attack.target),
    );
}

function resetExplorerTraits(explorer: BetrayalExplorerSummary, traits: BetrayalExplorerSummary['traits']): void {
    setExplorerTraitsFromValues(explorer, traits);
}

function resolveTraitRollPassiveBonus(explorer: BetrayalExplorerSummary, trait: BetrayalTraitKey): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (TRAIT_CHECK_PASSIVE_BONUSES[cardId]?.[trait] ?? 0), 0);
}

function resolveTraitCheckValue(explorer: BetrayalExplorerSummary, trait: BetrayalTraitKey): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((bestValue, cardId) => {
        const replacementTrait = TRAIT_CHECK_REPLACEMENTS_BY_CARD_ID[cardId]?.[trait];
        return replacementTrait
            ? Math.max(bestValue, explorer.traits[replacementTrait])
            : bestValue;
    }, explorer.traits[trait]);
}

function resolveNonCombatTraitCheckValue(
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const replacement = core.nextNonCombatTraitReplacement;
    if (
        replacement
        && replacement.playerId === explorer.playerId
        && trait !== replacement.replacementTrait
    ) {
        return Math.max(resolveTraitCheckValue(explorer, trait), explorer.traits[replacement.replacementTrait]);
    }
    return resolveTraitCheckValue(explorer, trait);
}

function resolveRoomBlessingExtraDice(core: BetrayalCore | undefined, explorer: BetrayalExplorerSummary): number {
    const room = core?.rooms.find((candidate) => candidate.id === explorer.roomId);
    return room?.markerTokens?.includes('blessing') ? 1 : 0;
}

function rollTraitCheckWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    core?: BetrayalCore,
): { total: number; dice: number[]; passiveBonus: number } {
    const dice = rollBetrayalDicePips(random, resolveTraitCheckValue(explorer, trait) + resolveRoomBlessingExtraDice(core, explorer));
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}

function rollNonCombatTraitCheck(
    random: RandomFn,
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const rollTotalReplacement = core.nextNonCombatTraitRollTotalReplacement;
    if (rollTotalReplacement?.playerId === explorer.playerId) {
        return rollTotalReplacement.selectedTotal + resolveTraitRollPassiveBonus(explorer, trait);
    }
    return rollTrait(random, resolveNonCombatTraitCheckValue(core, explorer, trait) + resolveRoomBlessingExtraDice(core, explorer)) + resolveTraitRollPassiveBonus(explorer, trait);
}

function rollNonCombatTraitCheckWithDice(
    random: RandomFn,
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): { total: number; dice: number[]; passiveBonus: number } {
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
    const rollTotalReplacement = core.nextNonCombatTraitRollTotalReplacement;
    if (rollTotalReplacement?.playerId === explorer.playerId) {
        return {
            total: rollTotalReplacement.selectedTotal + passiveBonus,
            dice: [rollTotalReplacement.selectedTotal],
            passiveBonus,
        };
    }
    const dice = rollBetrayalDicePips(random, resolveNonCombatTraitCheckValue(core, explorer, trait) + resolveRoomBlessingExtraDice(core, explorer));
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}

function resolveEventTraitCheckExtraDice(explorer: BetrayalExplorerSummary): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (EVENT_TRAIT_CHECK_EXTRA_DICE_BY_CARD_ID[cardId] ?? 0), 0);
}

function rollEventTraitCheckWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    core?: BetrayalCore,
): { total: number; dice: number[]; passiveBonus: number } {
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
    const rollTotalReplacement = core?.nextNonCombatTraitRollTotalReplacement;
    if (rollTotalReplacement?.playerId === explorer.playerId) {
        return {
            total: rollTotalReplacement.selectedTotal + passiveBonus,
            dice: [rollTotalReplacement.selectedTotal],
            passiveBonus,
        };
    }
    const diceCount = (core
        ? resolveNonCombatTraitCheckValue(core, explorer, trait)
        : resolveTraitCheckValue(explorer, trait))
        + resolveEventTraitCheckExtraDice(explorer)
        + resolveRoomBlessingExtraDice(core, explorer);
    const dice = rollBetrayalDicePips(random, diceCount);
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0) + passiveBonus,
        dice,
        passiveBonus,
    };
}

function consumeNextNonCombatTraitReplacementAfterTraitRoll(
    core: BetrayalCore,
    playerId: string,
    eventRoll?: { kind?: 'trait' | 'dice'; trait?: BetrayalTraitKey },
): void {
    if (
        eventRoll
        && eventRoll.kind !== 'dice'
        && eventRoll.trait
        && core.nextNonCombatTraitReplacement?.playerId === playerId
    ) {
        core.nextNonCombatTraitReplacement = null;
    }
    if (
        eventRoll
        && eventRoll.kind !== 'dice'
        && eventRoll.trait
        && core.nextNonCombatTraitRollTotalReplacement?.playerId === playerId
    ) {
        core.nextNonCombatTraitRollTotalReplacement = null;
    }
}

function clearNextNonCombatTraitRollReplacementsForPlayer(
    core: BetrayalCore,
    playerId: string,
): void {
    if (core.nextNonCombatTraitReplacement?.playerId === playerId) {
        core.nextNonCombatTraitReplacement = null;
    }
    if (core.nextNonCombatTraitRollTotalReplacement?.playerId === playerId) {
        core.nextNonCombatTraitRollTotalReplacement = null;
    }
}

function rollEventFixedDice(random: RandomFn, diceCount: number): { total: number; dice: number[]; passiveBonus: number } {
    const dice = rollBetrayalDicePips(random, diceCount);
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0),
        dice,
        passiveBonus: 0,
    };
}

function resolveEventBranch(branches: NonNullable<EventTemplate['roll']>['branches'], rollTotal: number) {
    return [...branches]
        .sort((left, right) => right.min - left.min)
        .find((branch) => rollTotal >= branch.min)
        ?? branches[branches.length - 1]!;
}

function resolveToothNecklaceCard(explorer: BetrayalExplorerSummary): BetrayalInventoryCard | null {
    return explorer.inventory.find((card) => resolveInventoryEffectId(card.id) === TOOTH_NECKLACE_CARD_ID) ?? null;
}

function resolveDeathsDoorTraitGainChoices(explorer: BetrayalExplorerSummary): BetrayalTraitKey[] {
    return BETRAYAL_TRAIT_KEYS.filter((trait) => {
        const track = explorer.traitTracks[trait];
        return track.position === track.criticalPosition && track.position < track.maxPosition;
    });
}

function resolveRecentRollTotal(recentRoll: BetrayalRecentRollState): number {
    return recentRoll.dice.reduce((sum, pip) => sum + pip, 0) + recentRoll.passiveBonus;
}

function isEventRecentRoll(recentRoll: BetrayalRecentRollState | null | undefined): recentRoll is BetrayalRecentRollState & { kind: BetrayalEventRollRecentKind } {
    return recentRoll?.kind === 'eventTraitCheck' || recentRoll?.kind === 'eventDiceRoll';
}

function cloneRolledDamageResult(damage: BetrayalRolledDamageResult): BetrayalRolledDamageResult {
    return {
        ...damage,
        rolls: [...damage.rolls],
    };
}

function formatRolledDamageResultLabel(damageResults: BetrayalRolledDamageResult[]): string {
    const labels = damageResults.map((damage) => {
        const kindLabel = damage.damageKind === 'physical' ? '物理伤害' : '精神伤害';
        return `造成 ${damage.appliedAmount} 点${kindLabel}`;
    });
    return labels.join('；');
}

function cloneSourceEventRoll(sourceRoll: BetrayalSourceEventRollState): BetrayalSourceEventRollState {
    return {
        ...sourceRoll,
        dice: [...sourceRoll.dice],
    };
}

function cloneSourceEventRollFromRecentRoll(
    recentRoll: BetrayalRecentRollState | null | undefined,
): BetrayalSourceEventRollState | undefined {
    if (!isEventRecentRoll(recentRoll)) {
        return undefined;
    }
    return {
        id: recentRoll.id,
        kind: recentRoll.kind,
        playerId: recentRoll.playerId,
        sourceTitle: recentRoll.sourceTitle,
        eventDescription: recentRoll.eventDescription,
        trait: recentRoll.trait,
        rollLabel: recentRoll.rollLabel,
        dice: [...recentRoll.dice],
        passiveBonus: recentRoll.passiveBonus,
        total: resolveRecentRollTotal(recentRoll),
        latestLabel: recentRoll.latestLabel,
    };
}

function setEventRolledDamageRecentRollFromSnapshot(
    core: BetrayalCore,
    snapshot: EventEffectSnapshot | undefined,
    sourceTitle: string,
    timestamp: number,
    sourceEventRoll = cloneSourceEventRollFromRecentRoll(core.recentRoll),
): boolean {
    const damageResults = snapshot?.rolledDamageResults?.map(cloneRolledDamageResult) ?? [];
    const dice = damageResults.flatMap((damage) => damage.rolls);
    if (damageResults.length === 0 || dice.length === 0) {
        return false;
    }
    const playerId = sourceEventRoll?.playerId ?? core.currentExplorer.playerId;
    core.recentRoll = {
        id: `${sourceEventRoll?.id ?? `${playerId}-${sourceTitle}`}-event-rolled-damage-${timestamp}`,
        kind: 'eventRolledDamage',
        playerId,
        sourceTitle,
        eventDescription: sourceEventRoll?.eventDescription,
        rollLabel: '重新投掷的伤害骰',
        dice,
        passiveBonus: 0,
        requiredPlayerIds: [playerId],
        acknowledgedPlayerIds: [],
        latestLabel: formatRolledDamageResultLabel(damageResults),
        eventRolledDamageResults: damageResults,
        sourceEventRoll: sourceEventRoll ? cloneSourceEventRoll(sourceEventRoll) : undefined,
        consumedRabbitFootCardIds: [],
    };
    return true;
}

function resolveAttackRerollOutcome(
    nextAttackRoll: number,
    attack: NonNullable<BetrayalRecentRollState['attack']>,
): {
    outcome: 'wound' | 'jack-damaged' | 'no-damage';
    damageToAttacker?: number;
    damageToDefender?: number;
    latestLabel: string;
} {
    if (attack.target === 'jack-spirit') {
        return nextAttackRoll > attack.defenderRoll
            ? { outcome: 'jack-damaged', latestLabel: '压制杰克之灵' }
            : { outcome: 'wound', latestLabel: '未压制杰克之灵' };
    }
    const damageToDefender = Math.max(0, nextAttackRoll - attack.defenderRoll);
    const damageToAttacker = resolveFailedAttackDamageForWeaponCard(
        attack.defenderRoll,
        nextAttackRoll,
        attack.weaponCardId,
    );
    if (nextAttackRoll === attack.defenderRoll) {
        return { outcome: 'no-damage', latestLabel: '平手无伤害' };
    }
    return {
        outcome: 'wound',
        damageToAttacker: damageToAttacker || undefined,
        damageToDefender: damageToDefender || undefined,
        latestLabel: damageToDefender > 0
            ? `造成 ${damageToDefender} 点伤害`
            : `反受 ${damageToAttacker} 点伤害`,
    };
}

function createEventEffectSnapshot(core: BetrayalCore): EventEffectSnapshot {
    return {
        traitsBeforeEffect: { ...core.currentExplorer.traits },
        traitTracksBeforeEffect: cloneTraitTracks(core.currentExplorer.traitTracks),
        roomIdBeforeEffect: core.currentExplorer.roomId,
        possessionOrderByKindBeforeEffect: clonePossessionOrderByKind(core.possessionOrderByKind),
        currentExplorerInventoryBeforeEffect: core.currentExplorer.inventory.map(cloneInventoryCard),
        deckCountsBeforeEffect: { ...core.deckCounts },
        damageRolls: [],
        rolledDamageResults: [],
        drawnCards: [],
    };
}

function rollAllTraitChecks(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    passMin: number,
    random: RandomFn,
    core?: BetrayalCore,
): BetrayalAllTraitCheckResult[] {
    return traits.map((trait) => {
        const result = rollEventTraitCheckWithDice(random, explorer, trait, core);
        return {
            trait,
            total: result.total,
            dice: result.dice,
            passiveBonus: result.passiveBonus,
            passed: result.total >= passMin,
        };
    });
}

function snapshotEventEffect(core: BetrayalCore, snapshot: EventEffectSnapshot | undefined): EventEffectSnapshot {
    return snapshot ?? createEventEffectSnapshot(core);
}

function revertEventSideEffects(core: BetrayalCore, effect: UseEffectProfile): void {
    if (effect.mode === 'compound') {
        for (const childEffect of [...effect.effects].reverse()) {
            revertEventSideEffects(core, childEffect);
        }
        return;
    }
    if (effect.mode === 'placeObstacleToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room?.markerTokens) {
            room.markerTokens = room.markerTokens.filter((token) => token !== 'obstacle');
        }
    }
}

function revertEventEffect(core: BetrayalCore, effect: UseEffectProfile, snapshot?: EventEffectSnapshot): void {
    if (snapshot) {
        core.currentExplorer.traits = { ...snapshot.traitsBeforeEffect };
        core.currentExplorer.traitTracks = cloneTraitTracks(snapshot.traitTracksBeforeEffect);
        core.currentExplorer.roomId = snapshot.roomIdBeforeEffect;
        core.currentExplorer.inventory = snapshot.currentExplorerInventoryBeforeEffect.map(cloneInventoryCard);
        revertEventSideEffects(core, effect);
        for (const drawnCard of snapshot.drawnCards) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== drawnCard.id);
        }
        core.possessionOrderByKind = clonePossessionOrderByKind(snapshot.possessionOrderByKindBeforeEffect);
        core.deckCounts = { ...snapshot.deckCountsBeforeEffect };
        return;
    }
    if (effect.mode === 'none') {
        return;
    }
    if (effect.mode === 'compound') {
        for (const childEffect of [...effect.effects].reverse()) {
            revertEventEffect(core, childEffect);
        }
        return;
    }
    if (effect.mode === 'placeObstacleToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room?.markerTokens) {
            room.markerTokens = room.markerTokens.filter((token) => token !== 'obstacle');
        }
        return;
    }
    if (effect.mode === 'move') {
        core.movesRemaining = Math.max(0, core.movesRemaining - effect.amount);
        return;
    }
    if (effect.mode === 'trait') {
        moveExplorerTraitSteps(core.currentExplorer, effect.trait, -effect.amount);
        return;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            moveExplorerTraitSteps(core.currentExplorer, appliedTrait, -effect.amount);
        }
        return;
    }
    if (effect.mode === 'generalDamageChoice') {
        for (const trait of [...(effect.selectedTraits ?? effect.allowedTraits)].reverse()) {
            moveExplorerTraitSteps(core.currentExplorer, trait, 1);
        }
        return;
    }
    if (effect.mode === 'healChosenTrait') {
        return;
    }
    if (effect.mode === 'optionalEventRoll') {
        return;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return;
    }
    if (effect.mode === 'traitRoll') {
        return;
    }
    if (effect.mode === 'optionalItemEffect') {
        return;
    }
    if (effect.mode === 'rolledDamage') {
        return;
    }
    if (effect.mode === 'drawPossession') {
        if (effect.drawnCard) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== effect.drawnCard!.id);
            restorePossessionCardToTop(core, effect.kind, effect.drawnCard);
        }
        return;
    }
    if (effect.mode === 'placeExplorerInRoom') {
        return;
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        return;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        return;
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return;
    }
    for (const trait of [...effect.traits].reverse()) {
        moveExplorerTraitSteps(core.currentExplorer, trait, Math.max(0, effect.amount));
    }
}

function resolvePhysicalDamageReduction(explorer: BetrayalExplorerSummary): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (PHYSICAL_DAMAGE_REDUCTION_BY_CARD_ID[cardId] ?? 0), 0);
}

function resolveMentalDamageReduction(explorer: BetrayalExplorerSummary): number {
    const cardIds = new Set(explorer.inventory.map((card) => resolveInventoryEffectId(card.id)));
    return [...cardIds].reduce((total, cardId) => total + (MENTAL_DAMAGE_REDUCTION_BY_CARD_ID[cardId] ?? 0), 0);
}

function resolveDamageAllocationAllowedTraits(damageKind: BetrayalPendingDamageAllocationState['damageKind']): BetrayalTraitKey[] {
    if (damageKind === 'physical') {
        return ['might', 'speed'];
    }
    if (damageKind === 'mental') {
        return ['knowledge', 'sanity'];
    }
    return ['might', 'speed', 'knowledge', 'sanity'];
}

function resolveReducedDamageAmount(
    explorer: BetrayalExplorerSummary,
    damageKind: BetrayalPendingDamageAllocationState['damageKind'],
    amount: number,
): number {
    if (damageKind === 'physical') {
        return Math.max(0, amount - resolvePhysicalDamageReduction(explorer));
    }
    if (damageKind === 'mental') {
        return Math.max(0, amount - resolveMentalDamageReduction(explorer));
    }
    return Math.max(0, amount);
}

function resolveAssignableDamageAmount(
    explorer: BetrayalExplorerSummary,
    allowedTraits: BetrayalTraitKey[],
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    const assignableSteps = allowedTraits.reduce(
        (total, trait) => total + resolveTraitDamageAssignableSteps(explorer, trait, options),
        0,
    );
    return Math.min(Math.max(0, amount), assignableSteps);
}

function createPendingDamageAllocation(params: {
    id: string;
    explorer: BetrayalExplorerSummary;
    sourceTitle: string;
    damageKind: BetrayalPendingDamageAllocationState['damageKind'];
    amount: number;
    allowSkull?: boolean;
    forcedTraitSequence?: BetrayalTraitKey[];
    nextPlayerId?: string;
    nextDamageAllocations?: BetrayalPendingDamageAllocationState[];
    monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
    turnLogText?: string;
    helpingHandsMonsterTurnControllerPlayerId?: string;
    skipBloodFromStoneMonsterTurnStart?: boolean;
}): BetrayalPendingDamageAllocationState | null {
    const allowedTraits = resolveDamageAllocationAllowedTraits(params.damageKind);
    const reducedAmount = resolveReducedDamageAmount(params.explorer, params.damageKind, params.amount);
    const damageReductionAmount = Math.max(0, params.amount - reducedAmount);
    const assignableAmount = resolveAssignableDamageAmount(
        params.explorer,
        allowedTraits,
        reducedAmount,
        { allowSkull: params.allowSkull },
    );
    if (assignableAmount <= 0) {
        return null;
    }
    return {
        id: params.id,
        playerId: params.explorer.playerId,
        sourceTitle: params.sourceTitle,
        damageKind: params.damageKind,
        amount: assignableAmount,
        originalAmount: params.amount,
        damageReductionAmount,
        allowedTraits,
        damageReplacement: resolveBroochDamageReplacement(params.explorer, params.damageKind),
        forcedTraitSequence: params.forcedTraitSequence
            ? [...params.forcedTraitSequence].slice(0, assignableAmount)
            : undefined,
        allowSkull: Boolean(params.allowSkull),
        traitsBeforeDamage: { ...params.explorer.traits },
        nextPlayerId: params.nextPlayerId,
        nextDamageAllocations: params.nextDamageAllocations?.map(clonePendingDamageAllocation),
        monsterMovementRoll: params.monsterMovementRoll,
        turnLogText: params.turnLogText,
        helpingHandsMonsterTurnControllerPlayerId: params.helpingHandsMonsterTurnControllerPlayerId,
        skipBloodFromStoneMonsterTurnStart: params.skipBloodFromStoneMonsterTurnStart,
    };
}

function createRecentRollRerollMentalDamageAllocation(
    core: BetrayalCore,
    playerId: string,
    cardId: string,
    amount: number | undefined,
    timestamp: number,
): BetrayalPendingDamageAllocationState | null {
    const rule = resolveRecentRollRerollItemRule(cardId);
    const explorer = findExplorerByPlayerId(core, playerId);
    if (!rule || rule.mode !== 'blank-trait-check-dice' || !explorer || !amount || amount <= 0) {
        return null;
    }
    return createPendingDamageAllocation({
        id: `recent-reroll-mental-damage-${playerId}-${cardId}-${timestamp}`,
        explorer,
        sourceTitle: rule.label,
        damageKind: 'mental',
        amount,
        allowSkull: core.phase === 'haunt',
    });
}

function chainPendingDamageAllocations(
    allocations: BetrayalPendingDamageAllocationState[],
): BetrayalPendingDamageAllocationState | null {
    const [first, ...rest] = allocations.map(clonePendingDamageAllocation);
    if (!first) {
        return null;
    }
    return {
        ...first,
        nextDamageAllocations: rest,
    };
}

function createBloodFromStoneGazeDamageAllocationQueue(
    core: BetrayalCore,
    damageRolls: BetrayalBloodFromStoneGazeDamageRoll[],
    nextPlayerId: string,
    turnLogText: string,
): BetrayalPendingDamageAllocationState | null {
    const allocations = damageRolls
        .map((roll) => {
            const explorer = findExplorerByPlayerId(core, roll.playerId);
            if (!explorer || roll.amount <= 0) {
                return null;
            }
            return createPendingDamageAllocation({
                id: `blood-from-stone-gaze-${roll.playerId}-${roll.visibleStoneCherubIds.join('-')}`,
                explorer,
                sourceTitle: '石像小天使凝视',
                damageKind: 'general',
                amount: roll.amount,
                allowSkull: true,
            });
        })
        .filter((allocation): allocation is BetrayalPendingDamageAllocationState => Boolean(allocation));
    const lastAllocation = allocations[allocations.length - 1];
    if (lastAllocation) {
        lastAllocation.nextPlayerId = nextPlayerId;
        lastAllocation.turnLogText = turnLogText;
        lastAllocation.skipBloodFromStoneMonsterTurnStart = true;
    }
    return chainPendingDamageAllocations(allocations);
}

function createBloodFromStoneNewLineOfSightDamageAllocation(
    core: BetrayalCore,
    roll: BetrayalBloodFromStoneGazeDamageRoll,
): BetrayalPendingDamageAllocationState | null {
    const explorer = findExplorerByPlayerId(core, roll.playerId);
    if (!explorer || roll.amount <= 0) {
        return null;
    }
    return createPendingDamageAllocation({
        id: `blood-from-stone-new-line-of-sight-${roll.playerId}-${roll.visibleStoneCherubIds.join('-')}`,
        explorer,
        sourceTitle: '石像小天使新视线伤害',
        damageKind: 'general',
        amount: roll.amount,
        allowSkull: true,
    });
}

function applyPhysicalDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    const applied = applyTraitLoss(explorer, ['might', 'speed'], Math.max(0, amount - resolvePhysicalDamageReduction(explorer)), options);
    if (applied > 0) {
        applyStrangeAmuletPhysicalDamageBonus(explorer);
    }
    return applied;
}

function applyMentalDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    return applyTraitLoss(explorer, ['knowledge', 'sanity'], Math.max(0, amount - resolveMentalDamageReduction(explorer)), options);
}

function applyStrangeAmuletPhysicalDamageBonus(explorer: BetrayalExplorerSummary): void {
    const hasStrangeAmulet = explorer.inventory.some((card) => resolveInventoryEffectId(card.id) === HELPING_HANDS_STRANGE_AMULET_CARD_ID);
    if (hasStrangeAmulet) {
        moveExplorerTraitSteps(explorer, 'sanity', 1, { allowSkull: true });
    }
}

function resolveBroochDamageReplacement(
    explorer: BetrayalExplorerSummary,
    damageKind: BetrayalPendingDamageAllocationState['damageKind'],
): BetrayalPendingDamageAllocationState['damageReplacement'] {
    if (damageKind === 'general') {
        return undefined;
    }
    const card = explorer.inventory.find((inventoryCard) => resolveInventoryEffectId(inventoryCard.id) === BROOCH_CARD_ID);
    return card
        ? {
            kind: 'brooch-general-damage',
            cardId: card.id,
            cardName: card.name,
        }
        : undefined;
}

type EventDamageDeathPreview = {
    amount: number;
    kind: 'general' | 'physical' | 'mental';
    traits: BetrayalTraitKey[];
    traitsBeforeDamage: BetrayalExplorerSummary['traits'];
};

function repeatTraitForDamage(trait: BetrayalTraitKey, amount: number): BetrayalTraitKey[] {
    return Array.from({ length: Math.max(0, amount) }, () => trait);
}

function resolveDirectTraitLossFromEventEffect(
    effect: UseEffectProfile,
): Omit<EventDamageDeathPreview, 'traitsBeforeDamage'> | null {
    if (effect.mode === 'trait' && effect.amount < 0) {
        return {
            amount: Math.abs(effect.amount),
            kind: 'general',
            traits: repeatTraitForDamage(effect.trait, Math.abs(effect.amount)),
        };
    }
    if (effect.mode === 'chosenTrait' && effect.amount < 0) {
        const trait = effect.chosenTrait ?? effect.allowedTraits[0];
        return trait
            ? {
                amount: Math.abs(effect.amount),
                kind: 'general',
                traits: repeatTraitForDamage(trait, Math.abs(effect.amount)),
            }
            : null;
    }
    if (effect.mode === 'allTraitChecks' && effect.results) {
        const traits = effect.results.flatMap((result) => (
            result.passed ? [] : repeatTraitForDamage(result.trait, effect.failAmount)
        ));
        return traits.length > 0
            ? {
                amount: traits.length,
                kind: 'general',
                traits,
            }
            : null;
    }
    return null;
}

function resolveDamageFromEventEffect(effect: UseEffectProfile): Omit<EventDamageDeathPreview, 'traitsBeforeDamage'> | null {
    if (effect.mode === 'generalDamage') {
        return { amount: effect.amount, kind: 'general', traits: [...effect.traits] };
    }
    if (effect.mode === 'generalDamageChoice' && effect.selectedTraits?.length === effect.amount) {
        return { amount: effect.amount, kind: 'general', traits: [...effect.selectedTraits] };
    }
    if (effect.mode === 'rolledDamage') {
        return {
            amount: (effect.rolls ?? []).reduce((sum, pip) => sum + pip, 0),
            kind: effect.damageKind,
            traits: [],
        };
    }
    if (effect.mode === 'fixedDamage') {
        return {
            amount: effect.amount,
            kind: effect.damageKind,
            traits: [],
        };
    }
    if (effect.mode === 'optionalItemEffect') {
        return resolveDamageFromEventEffect(effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
    }
    return null;
}

function applyEventDeathPreviewNonDamageEffect(
    explorer: BetrayalExplorerSummary,
    effect: UseEffectProfile,
): void {
    if (effect.mode === 'trait') {
        moveExplorerTraitSteps(explorer, effect.trait, effect.amount, { allowSkull: true });
        return;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            moveExplorerTraitSteps(explorer, appliedTrait, effect.amount, { allowSkull: true });
        }
        return;
    }
    if (effect.mode === 'healChosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            healExplorerTraitsToTemplate(explorer, [appliedTrait]);
        }
        return;
    }
    if (effect.mode === 'allTraitChecks' && effect.results) {
        const failedTraits = effect.results.filter((result) => !result.passed).map((result) => result.trait);
        for (const trait of failedTraits) {
            applyTraitLoss(explorer, [trait], effect.failAmount, { allowSkull: true });
        }
        return;
    }
    if (effect.mode === 'optionalItemEffect') {
        applyEventDeathPreviewNonDamageEffect(explorer, effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
    }
}

function resolveEventDamageDeathPreview(
    explorer: BetrayalExplorerSummary,
    effect: UseEffectProfile,
): EventDamageDeathPreview | undefined {
    if (effect.mode === 'compound') {
        for (const childEffect of effect.effects) {
            const childPreview = resolveEventDamageDeathPreview(explorer, childEffect);
            if (childPreview) {
                return childPreview;
            }
        }
        return undefined;
    }
    if (effect.mode === 'allTraitChecks' && effect.results?.every((result) => result.passed)) {
        return resolveEventDamageDeathPreview(explorer, effect.allPassEffect);
    }
    if (effect.mode === 'optionalItemEffect') {
        return resolveEventDamageDeathPreview(explorer, effect.selectedCardId ? effect.acceptEffect : effect.declineEffect);
    }
    const damage = resolveDamageFromEventEffect(effect) ?? resolveDirectTraitLossFromEventEffect(effect);
    if (damage) {
        const traitsBeforeDamage = { ...explorer.traits };
        if (damage.kind === 'general') {
            applyGeneralDamage(explorer, damage.amount, damage.traits, { allowSkull: true });
        } else {
            applyAttackDamage(explorer, damage.amount, damage.kind);
        }
        return isExplorerDead(explorer)
            ? { ...damage, traitsBeforeDamage }
            : undefined;
    }
    applyEventDeathPreviewNonDamageEffect(explorer, effect);
    return undefined;
}

function resolveEventDamageDeathPrevention(
    core: BetrayalCore,
    effect: UseEffectProfile,
    random: RandomFn,
) {
    if (core.phase !== 'haunt') {
        return undefined;
    }
    const deathPreview = cloneExplorer(core.currentExplorer);
    const damage = resolveEventDamageDeathPreview(deathPreview, effect);
    if (!damage) {
        return undefined;
    }
    const deathPreventionRoll = rollDeathPrevention(random, core.currentExplorer);
    return deathPreventionRoll
        ? {
            ...deathPreventionRoll,
            damageAmount: damage.amount,
            damageKind: damage.kind,
            damageTraits: damage.traits,
            traitsBeforeDamage: { ...damage.traitsBeforeDamage },
        }
        : undefined;
}

function applyEventEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    random?: RandomFn,
    snapshot?: EventEffectSnapshot,
    options?: ApplyEventEffectOptions,
): EventEffectSnapshot | undefined {
    if (effect.mode === 'none') {
        return snapshot;
    }
    const nextSnapshot = snapshotEventEffect(core, snapshot);
    if (effect.mode === 'compound') {
        for (const childEffect of effect.effects) {
            applyEventEffect(core, childEffect, random, nextSnapshot, options);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeObstacleToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room) {
            room.markerTokens = Array.from(new Set([...(room.markerTokens ?? []), 'obstacle']));
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeSecretPassageToken') {
        const roomId = effect.targetRoomId ?? core.currentExplorer.roomId;
        const room = core.rooms.find((item) => item.id === roomId);
        if (room) {
            room.markerTokens = Array.from(new Set([...(room.markerTokens ?? []), 'secretPassage']));
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeBlessingToken') {
        const room = core.rooms.find((item) => item.id === core.currentExplorer.roomId);
        if (room) {
            room.markerTokens = Array.from(new Set([...(room.markerTokens ?? []), 'blessing']));
        }
        return nextSnapshot;
    }
    if (effect.mode === 'move') {
        core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + effect.amount));
        return nextSnapshot;
    }
    if (effect.mode === 'trait') {
        moveExplorerTraitSteps(core.currentExplorer, effect.trait, effect.amount, { allowSkull: core.phase === 'haunt' });
        return nextSnapshot;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            moveExplorerTraitSteps(core.currentExplorer, appliedTrait, effect.amount, { allowSkull: core.phase === 'haunt' });
        }
        return nextSnapshot;
    }
    if (effect.mode === 'healChosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            healExplorerTraitsToTemplate(core.currentExplorer, [appliedTrait]);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'generalDamageChoice') {
        applyGeneralDamage(core.currentExplorer, effect.amount, effect.selectedTraits ?? effect.allowedTraits, { allowSkull: core.phase === 'haunt' });
        return nextSnapshot;
    }
    if (effect.mode === 'fixedDamage') {
        const deferred = options?.deferRolledDamageAllocation;
        const pendingAllocation = deferred
            ? createPendingDamageAllocation({
                id: `event-fixed-damage-${core.currentExplorer.playerId}-${deferred.timestamp}-${deferred.allocations.length}`,
                explorer: core.currentExplorer,
                sourceTitle: deferred.sourceTitle,
                damageKind: effect.damageKind,
                amount: effect.amount,
                allowSkull: core.phase === 'haunt',
            })
            : null;
        if (pendingAllocation) {
            deferred!.allocations.push(pendingAllocation);
        } else if (!deferred) {
            if (effect.damageKind === 'physical') {
                applyPhysicalDamage(core.currentExplorer, effect.amount, { allowSkull: core.phase === 'haunt' });
            } else {
                applyMentalDamage(core.currentExplorer, effect.amount, { allowSkull: core.phase === 'haunt' });
            }
        }
        return nextSnapshot;
    }
    if (effect.mode === 'optionalEventRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalEffect') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalHauntRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'traitRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalItemEffect') {
        const selectedCard = effect.selectedCardId
            ? core.currentExplorer.inventory.find((card) => card.id === effect.selectedCardId)
            : null;
        if (selectedCard) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== selectedCard.id);
            if (effect.consumeAction === 'bury') {
                restorePossessionCardToBottom(core, selectedCard.kind, selectedCard);
            }
            applyEventEffect(core, effect.acceptEffect, random, nextSnapshot, options);
        } else {
            applyEventEffect(core, effect.declineEffect, random, nextSnapshot, options);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'allTraitChecks') {
        if (!effect.results && !random) {
            throw new Error('allTraitChecks requires random');
        }
        const results = effect.results ?? rollAllTraitChecks(core.currentExplorer, effect.traits, effect.passMin, random!, core);
        const failedTraits = results.filter((result) => !result.passed).map((result) => result.trait);
        for (const trait of failedTraits) {
            applyTraitLoss(core.currentExplorer, [trait], effect.failAmount, { allowSkull: core.phase === 'haunt' });
        }
        if (failedTraits.length === 0 && !effectHasUnresolvedTraitChoice(effect.allPassEffect)) {
            applyEventEffect(core, effect.allPassEffect, random, nextSnapshot, options);
        }
        core.recentAllTraitCheck = {
            sourceTitle: effect.name,
            playerId: core.currentExplorer.playerId,
            results,
        };
        return nextSnapshot;
    }
    if (effect.mode === 'rolledDamage') {
        if (!effect.rolls && !random) {
            throw new Error('rolledDamage requires random');
        }
        const damageRolls = effect.rolls ?? rollBetrayalDicePips(random!, effect.dice);
        nextSnapshot.damageRolls.push(...damageRolls);
        const amount = damageRolls.reduce((sum, pip) => sum + pip, 0);
        const deferred = options?.deferRolledDamageAllocation;
        const pendingAllocation = deferred
            ? createPendingDamageAllocation({
                id: `event-rolled-damage-${core.currentExplorer.playerId}-${deferred.timestamp}-${deferred.allocations.length}`,
                explorer: core.currentExplorer,
                sourceTitle: deferred.sourceTitle,
                damageKind: effect.damageKind,
                amount,
                allowSkull: core.phase === 'haunt',
            })
            : null;
        if (pendingAllocation) {
            deferred!.allocations.push(pendingAllocation);
        }
        const appliedAmount = deferred
            ? pendingAllocation?.amount ?? 0
            : effect.damageKind === 'physical'
                ? applyPhysicalDamage(core.currentExplorer, amount, { allowSkull: core.phase === 'haunt' })
                : applyMentalDamage(core.currentExplorer, amount, { allowSkull: core.phase === 'haunt' });
        nextSnapshot.rolledDamageResults.push({
            damageKind: effect.damageKind,
            rolls: [...damageRolls],
            total: amount,
            appliedAmount,
        });
        return nextSnapshot;
    }
    if (effect.mode === 'drawPossession') {
        const drawnCard = effect.drawnCard
            ? cloneInventoryCard(effect.drawnCard)
            : createDrawnCard(core, effect.kind);
        core.currentExplorer.inventory = [...core.currentExplorer.inventory, drawnCard];
        removePossessionCardFromDeck(core, effect.kind, drawnCard.id);
        nextSnapshot.drawnCards.push(drawnCard);
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInRoom') {
        core.currentExplorer.roomId = effect.roomId;
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        const targetRoom = core.rooms.find((room) => room.floor === effect.floor && room.startingTile);
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInNextFloorStartingRoom') {
        const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
        const targetFloor: BetrayalRoomFloor = currentRoom?.floor === 'upper'
            ? 'ground'
            : currentRoom?.floor === 'ground'
                ? 'basement'
                : effect.basementFallbackFloor;
        const targetRoom = core.rooms.find((room) => room.floor === targetFloor && room.startingTile);
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        if (currentRoom?.floor === 'basement' && effect.basementFallbackDamage) {
            const deferred = options?.deferRolledDamageAllocation;
            const pendingAllocation = deferred
                ? createPendingDamageAllocation({
                    id: `event-floor-fallback-damage-${core.currentExplorer.playerId}-${deferred.timestamp}-${deferred.allocations.length}`,
                    explorer: core.currentExplorer,
                    sourceTitle: deferred.sourceTitle,
                    damageKind: effect.basementFallbackDamage.damageKind,
                    amount: effect.basementFallbackDamage.amount,
                    allowSkull: core.phase === 'haunt',
                })
                : null;
            if (pendingAllocation) {
                deferred!.allocations.push(pendingAllocation);
            } else if (!deferred) {
                if (effect.basementFallbackDamage.damageKind === 'physical') {
                    applyPhysicalDamage(core.currentExplorer, effect.basementFallbackDamage.amount, { allowSkull: core.phase === 'haunt' });
                } else {
                    applyMentalDamage(core.currentExplorer, effect.basementFallbackDamage.amount, { allowSkull: core.phase === 'haunt' });
                }
            }
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        const targetRoom = core.rooms.find((room) => (
            room.state === 'discovered' && effect.visualIds.includes(room.visualId)
        ));
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        const targetRoom = effect.targetRoomId
            ? core.rooms.find((room) => room.id === effect.targetRoomId && room.state === 'discovered')
            : null;
        if (targetRoom && effectAllowsRoomTargetChoice(core, effect, targetRoom.id)) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        const targetRoom = effect.targetRoomId
            ? core.rooms.find((room) => room.id === effect.targetRoomId && room.state === 'discovered')
            : null;
        if (targetRoom && effectAllowsAdjacentRoomChoice(core, targetRoom.id)) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        return nextSnapshot;
    }
    applyGeneralDamage(core.currentExplorer, effect.amount, effect.traits, { allowSkull: core.phase === 'haunt' });
    return nextSnapshot;
}

function applyEventEffectWithDeferredRolledDamage(
    core: BetrayalCore,
    effect: UseEffectProfile,
    sourceTitle: string,
    timestamp: number,
): {
    eventEffectSnapshot?: EventEffectSnapshot;
    pendingRolledDamageAllocation: BetrayalPendingDamageAllocationState | null;
} {
    const rolledDamageAllocations: BetrayalPendingDamageAllocationState[] = [];
    const eventEffectSnapshot = applyEventEffect(core, effect, undefined, undefined, {
        deferRolledDamageAllocation: {
            sourceTitle,
            timestamp,
            allocations: rolledDamageAllocations,
        },
    });
    return {
        eventEffectSnapshot,
        pendingRolledDamageAllocation: chainPendingDamageAllocations(rolledDamageAllocations),
    };
}

function activatePendingRolledDamageAllocation(
    core: BetrayalCore,
    pendingRolledDamageAllocation: BetrayalPendingDamageAllocationState | null,
): boolean {
    if (!pendingRolledDamageAllocation) {
        return false;
    }
    core.pendingDamageAllocation = pendingRolledDamageAllocation;
    core.activePlayerId = pendingRolledDamageAllocation.playerId;
    return true;
}

function applyImmediateEventDeathPreventionIfNeeded(
    core: BetrayalCore,
    deathPrevention: BetrayalPendingEventRollResolutionState['deathPrevention'] | undefined,
    timestamp: number,
    scenarioRuntimeBeforeDefeat: BetrayalCore['scenarioRuntime'] | null,
    monstersBeforeDefeat: BetrayalMonsterSummary[],
): void {
    if (deathPrevention?.dice.length) {
        core.recentRoll = {
            id: `${deathPrevention.playerId}-death-prevention-${timestamp}`,
            kind: 'deathPrevention',
            playerId: deathPrevention.playerId,
            sourceTitle: deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
            dice: [...deathPrevention.dice],
            passiveBonus: 0,
            latestLabel: deathPrevention.prevented ? '阻止死亡' : '正常死亡',
            deathPrevention: {
                cardId: deathPrevention.cardId,
                minTotal: deathPrevention.minTotal,
                damageKind: deathPrevention.damageKind,
                damageAmount: deathPrevention.damageAmount,
                damageTraits: [...deathPrevention.damageTraits],
                traitsBeforeDamage: { ...deathPrevention.traitsBeforeDamage },
                scenarioRuntimeBeforeDefeat: scenarioRuntimeBeforeDefeat
                    ?? cloneScenarioRuntimeStatus(core.scenarioRuntime),
                monstersBeforeDefeat,
            },
            consumedRabbitFootCardIds: [],
        };
    }
    if (deathPrevention?.prevented) {
        const protectedExplorer = findExplorerByPlayerId(core, deathPrevention.playerId);
        if (protectedExplorer) {
            setExplorerTraitsToDeathsDoor(protectedExplorer);
        }
    } else {
        applyDustEventEffectDeathIfNeeded(core);
    }
}

function materializeEventEffect(
    effect: UseEffectProfile,
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    core?: BetrayalCore,
    options: MaterializeEventEffectOptions = {},
): UseEffectProfile {
    const materializeRandomResults = options.materializeRandomResults ?? true;
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => materializeEventEffect(childEffect, random, explorer, core, options)),
        };
    }
    if (effect.mode === 'optionalEventRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'optionalHauntRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'chooseTraitRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'traitRoll') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'optionalItemEffect') {
        return cloneUseEffect(effect);
    }
    if (effect.mode === 'allTraitChecks') {
        if (!materializeRandomResults) {
            return cloneUseEffect(effect);
        }
        const results = rollAllTraitChecks(explorer, effect.traits, effect.passMin, random, core);
        const hasFailure = results.some((result) => !result.passed);
        return {
            ...effect,
            traits: [...effect.traits],
            results,
            recommendedAction: hasFailure ? 'endTurn' : effect.allPassEffect.recommendedAction,
            allPassEffect: cloneUseEffect(effect.allPassEffect),
        };
    }
    if (effect.mode === 'generalDamage') {
        return { ...effect, traits: [...effect.traits] };
    }
    if (effect.mode === 'generalDamageChoice') {
        return {
            ...effect,
            allowedTraits: [...effect.allowedTraits],
            selectedTraits: effect.selectedTraits ? [...effect.selectedTraits] : undefined,
        };
    }
    if (effect.mode === 'chosenTrait') {
        return { ...effect, allowedTraits: [...effect.allowedTraits] };
    }
    if (effect.mode === 'healChosenTrait') {
        return { ...effect, allowedTraits: [...effect.allowedTraits] };
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        return {
            ...effect,
            visualIds: [...effect.visualIds],
            roomNames: [...effect.roomNames],
        };
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        return { ...effect };
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        return { ...effect };
    }
    if (effect.mode === 'placeExplorerInNextFloorStartingRoom') {
        const currentRoom = core?.rooms.find((room) => room.id === explorer.roomId);
        if (currentRoom?.floor === 'basement' && effect.basementFallbackDamage) {
            return {
                mode: 'compound',
                effects: [
                    {
                        ...effect,
                        basementFallbackDamage: undefined,
                    },
                    {
                        mode: 'fixedDamage',
                        amount: effect.basementFallbackDamage.amount,
                        damageKind: effect.basementFallbackDamage.damageKind,
                        recommendedAction: effect.recommendedAction,
                    },
                ],
                recommendedAction: effect.recommendedAction,
            };
        }
        return { ...effect };
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return { ...effect };
    }
    if (effect.mode === 'rolledDamage' && !effect.rolls) {
        if (!materializeRandomResults) {
            return cloneUseEffect(effect);
        }
        return { ...effect, rolls: rollBetrayalDicePips(random, effect.dice) };
    }
    return { ...effect };
}

function applyRoomDiscoveryEffect(core: BetrayalCore, effect: BetrayalRoomDiscoveryEffect | undefined): void {
    if (effect === 'gainSanity1') {
        moveExplorerTraitSteps(core.currentExplorer, 'sanity', 1);
        return;
    }
    if (effect === 'gainKnowledge1') {
        moveExplorerTraitSteps(core.currentExplorer, 'knowledge', 1);
        return;
    }
    if (effect === 'gainMight1') {
        moveExplorerTraitSteps(core.currentExplorer, 'might', 1);
        return;
    }
    if (effect === 'gainSpeed1') {
        moveExplorerTraitSteps(core.currentExplorer, 'speed', 1);
    }
}

function resolveCoreAfterRoomDiscoveryText(
    core: BetrayalCore,
    effect: BetrayalRoomDiscoveryEffect | undefined,
): BetrayalCore {
    const preview = cloneCore(core);
    applyRoomDiscoveryEffect(preview, effect);
    return syncCurrentExplorerProjection(preview);
}

function resolveRoomDiscoveryCards(core: BetrayalCore, effect: BetrayalRoomDiscoveryEffect | undefined): {
    roomDiscoveryCards?: BetrayalInventoryCard[];
    buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
} {
    if (effect !== 'drawUntilWeapon') {
        return {};
    }
    const result = createDrawnCardsUntilWeapon(core);
    return {
        roomDiscoveryCards: result.weapon ? [result.weapon] : [],
        buriedRoomDiscoveryCards: result.buriedCards,
    };
}

function createRoomDiscoveryEffectResolutionSteps(
    roomName: string,
    effect: BetrayalRoomDiscoveryEffect | undefined,
): BetrayalDiscoveryResolutionStep[] {
    const label = (() => {
        switch (effect) {
            case 'gainSanity1':
                return `${TRAIT_LABEL.sanity} +1`;
            case 'gainKnowledge1':
                return `${TRAIT_LABEL.knowledge} +1`;
            case 'gainMight1':
                return `${TRAIT_LABEL.might} +1`;
            case 'gainSpeed1':
                return `${TRAIT_LABEL.speed} +1`;
            case 'placeObstacleToken':
                return '放置障碍物标记';
            default:
                return null;
        }
    })();
    return label
        ? [{
            id: `room-effect-${effect}`,
            kind: 'room-effect',
            text: `房间效果：${roomName}，${label}`,
        }]
        : [];
}

function getRoomDiscoveryRewardNames(roomDiscoveryCards: {
    roomDiscoveryCards?: BetrayalInventoryCard[];
    buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
}): { gained: string[]; buried: string[] } {
    return {
        gained: roomDiscoveryCards.roomDiscoveryCards?.map((card) => card.name) ?? [],
        buried: roomDiscoveryCards.buriedRoomDiscoveryCards?.map((card) => card.name) ?? [],
    };
}

function createRoomDiscoveryCardResolutionSteps(
    roomName: string,
    roomDiscoveryCards: {
        roomDiscoveryCards?: BetrayalInventoryCard[];
        buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
    },
): BetrayalDiscoveryResolutionStep[] {
    const rewardNames = getRoomDiscoveryRewardNames(roomDiscoveryCards);
    return [
        ...rewardNames.buried.map((name, index) => ({
            id: `buried-room-discovery-card-${roomDiscoveryCards.buriedRoomDiscoveryCards?.[index]?.id ?? index}`,
            kind: 'buried-room-discovery-card' as const,
            text: `展示后埋葬${name}`,
            deckKind: 'item' as const,
            cardId: roomDiscoveryCards.buriedRoomDiscoveryCards?.[index]?.id,
        })),
        ...rewardNames.gained.map((name, index) => ({
            id: `room-discovery-card-${roomDiscoveryCards.roomDiscoveryCards?.[index]?.id ?? index}`,
            kind: 'room-discovery-card' as const,
            text: `${roomName}获得${name}`,
            deckKind: 'item' as const,
            cardId: roomDiscoveryCards.roomDiscoveryCards?.[index]?.id,
        })),
    ];
}

function formatRoomDiscoveryRewardDetailParts(
    roomName: string,
    roomDiscoveryCards: {
        roomDiscoveryCards?: BetrayalInventoryCard[];
        buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
    },
): string[] {
    const rewardNames = getRoomDiscoveryRewardNames(roomDiscoveryCards);
    return [
        rewardNames.buried.length > 0
            ? `展示后埋葬${rewardNames.buried.join('、')}`
            : null,
        rewardNames.gained.length > 0
            ? `${roomName}获得${rewardNames.gained.join('、')}`
            : null,
    ].filter((part): part is string => Boolean(part));
}

function resolveEndTurnRoomEffect(core: BetrayalCore, random: RandomFn): BetrayalRoomEndTurnEffectResult | null {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const effect = resolveRoomEndTurnEffect(currentRoom);
    if (!effect || !currentRoom) {
        return null;
    }
    const ignoreDamagingEffect = canUseBetrayalTraitorPowers(core, core.currentExplorer.playerId)
        && isBetrayalDamagingRoomEndTurnEffect(effect);

    if (effect === 'physicalDamage1') {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            physicalDamage: ignoreDamagingEffect ? undefined : 1,
            ignoredByTraitorPower: ignoreDamagingEffect,
        };
    }

    if (effect === 'moveToBasementLanding') {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            destinationRoomId: 'basement-landing',
        };
    }

    const speedRoll = rollTraitCheckWithDice(random, core.currentExplorer, 'speed', core);
    if (speedRoll.total >= 5) {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            speedRoll: speedRoll.total,
            speedRollDice: speedRoll.dice,
            speedRollPassiveBonus: speedRoll.passiveBonus,
        };
    }

    return {
        kind: effect,
        playerId: core.currentExplorer.playerId,
        roomId: currentRoom.id,
        roomName: currentRoom.name,
        destinationRoomId: 'basement-landing',
        speedRoll: speedRoll.total,
        speedRollDice: speedRoll.dice,
        speedRollPassiveBonus: speedRoll.passiveBonus,
        physicalDamage: ignoreDamagingEffect ? undefined : rollBetrayalPip(random),
        ignoredByTraitorPower: ignoreDamagingEffect,
    };
}

function formatEndTurnRoomEffectLog(effect: BetrayalRoomEndTurnEffectResult, explorerName: string): string {
    if (effect.kind === 'physicalDamage1') {
        if (effect.ignoredByTraitorPower) {
            return `${explorerName}在${effect.roomName}结束回合，叛徒能力忽略房间伤害`;
        }
        return `${explorerName}在${effect.roomName}结束回合，承受 1 点物理伤害`;
    }
    if (effect.kind === 'moveToBasementLanding') {
        return `${explorerName}从${effect.roomName}滑落到地下室起始点`;
    }
    if (effect.destinationRoomId) {
        if (effect.ignoredByTraitorPower) {
            return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，坠落到地下室起始点，叛徒能力忽略坠落伤害`;
        }
        return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，坠落到地下室起始点并承受 ${effect.physicalDamage ?? 0} 点物理伤害`;
    }
    return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，没有坠落`;
}

function isExplorerDead(explorer: BetrayalExplorerSummary): boolean {
    normalizeExplorerTraitTracks(explorer);
    return BETRAYAL_TRAIT_KEYS.some((trait) => {
        const track = explorer.traitTracks[trait];
        return track.position <= track.skullPosition;
    });
}

function markDeadExplorer(core: BetrayalCore, playerId: string): void {
    if (core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)) {
        return;
    }
    core.scenarioRuntime.deadExplorerPlayerIds = [
        ...core.scenarioRuntime.deadExplorerPlayerIds,
        playerId,
    ];
}

function resolveRoomRegion(room: BetrayalRoomNode | undefined): BetrayalRoomFloor | null {
    return room?.floor ?? null;
}

function countExorcismCirclesInRegion(core: BetrayalCore, roomId: string): number {
    const currentRoom = core.rooms.find((room) => room.id === roomId);
    const region = resolveRoomRegion(currentRoom);
    if (!region) {
        return 0;
    }
    return core.scenarioRuntime.exorcismCircleRoomIds.filter((circleRoomId) => {
        const circleRoom = core.rooms.find((room) => room.id === circleRoomId);
        return resolveRoomRegion(circleRoom) === region;
    }).length;
}


function createInitialRoomLayout(seeds: BetrayalRoomSeed[]): BetrayalRoomNode[] {
    const discoveredSeedIds = new Set(seeds.filter((room) => room.state === 'discovered').map((room) => room.id));
    const discoveredRooms = seeds
        .filter((room) => room.state === 'discovered')
        .map((seed) => {
            const room = roomSeedToNode(seed);
            room.connectedRoomIds = room.connectedRoomIds.filter((roomId) => discoveredSeedIds.has(roomId));
            room.doorways = room.doorways.map((doorway) => (
                doorway.connectsToRoomId && !discoveredSeedIds.has(doorway.connectsToRoomId)
                    ? {
                        edge: doorway.edge,
                        leadsToFloor: doorway.leadsToFloor,
                        note: doorway.note,
                    }
                    : { ...doorway }
            ));
            return room;
        });

    return refreshExplorableRoomSlots(discoveredRooms);
}

function resolveJackSpiritSpawnRoomId(core: BetrayalCore, corpseRoomId: string): string {
    const corpseRoom = core.rooms.find((room) => room.id === corpseRoomId);
    const discoveredRooms = core.rooms.filter((room) => room.state === 'discovered');
    const omenRooms = discoveredRooms.filter((room) => room.discoveryReward === 'omen');
    const candidateRooms = omenRooms.length > 0 ? omenRooms : discoveredRooms;

    if (!corpseRoom || candidateRooms.length === 0) {
        return corpseRoomId;
    }

    const sortedCandidates = [...candidateRooms].sort((left, right) => {
        const distanceDelta = roomDistanceByLayout(right, corpseRoom) - roomDistanceByLayout(left, corpseRoom);
        if (distanceDelta !== 0) {
            return distanceDelta;
        }
        return left.id.localeCompare(right.id);
    });

    return sortedCandidates[0]?.id ?? corpseRoomId;
}

function resolveHauntRoll(
    core: BetrayalCore,
    deckKind: BetrayalDeckKind,
    random: RandomFn,
): BetrayalHauntRollResult | null {
    if (core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered || deckKind !== 'omen') {
        return null;
    }
    const threshold = core.scenarioRuntime.hauntRollThreshold;
    const hauntRisk = resolveBetrayalHauntRisk(core, { additionalOmenCount: 1 });
    if (hauntRisk.nextOmenAutomatic) {
        return {
            dice: [],
            total: threshold,
            threshold,
            triggered: true,
            automatic: true,
        };
    }
    const dice = rollBetrayalDicePips(random, hauntRisk.nextRollDiceCount);
    const total = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        dice,
        total,
        threshold,
        triggered: total >= threshold,
        automatic: false,
    };
}

function formatHauntRollDiscoveryDetail(hauntRoll: BetrayalHauntRollResult): string {
    if (hauntRoll.automatic) {
        return '预兆牌堆耗尽，自动触发作祟';
    }
    return `抽到预兆后进行作祟检定：总点数 ${hauntRoll.total}（${hauntRoll.dice.length} 颗骰子，${hauntRoll.triggered ? '已触发' : '未触发'}）`;
}

function resolveHauntRevealResolutionForTrigger(
    core: BetrayalCore,
    triggeringCard: { id?: string | null; name?: string | null } | null | undefined,
    hauntCardNumberOverride?: number,
): BetrayalHauntRevealResolution {
    return resolveBetrayalHauntRevealResolution({
        scenarioCardId: core.proposedScenarioCardId,
        triggeringOmen: triggeringCard,
        hauntCardNumberOverride,
    });
}

function buildHauntRollThresholds(hauntRoll: BetrayalHauntRollResult): { min: number; label: string; effect: UseEffectProfile }[] {
    return [
        {
            min: hauntRoll.threshold,
            label: '作祟开始',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        },
        {
            min: 0,
            label: '未触发作祟',
            effect: { mode: 'none', recommendedAction: 'endTurn' },
        },
    ];
}

const DECK_KIND_LABEL: Record<BetrayalDeckKind, string> = {
    event: '事件',
    item: '物品',
    omen: '预兆',
};


function resolveEventSymbolSkipMethod(
    core: BetrayalCore,
    playerId: string,
): NonNullable<BetrayalPendingEventChoiceState['eventSymbolSkip']>['method'] | null {
    if (canUseBetrayalTraitorPowers(core, playerId)) {
        return 'traitorPower';
    }
    if (canUseIdolToSkipEvent(core)) {
        return 'idol';
    }
    return null;
}

function createEventSymbolSkipChoice(
    core: BetrayalCore,
    playerId: string,
    roomId: string,
    roomName: string,
    timestamp: number,
): BetrayalPendingEventChoiceState | null {
    const method = resolveEventSymbolSkipMethod(core, playerId);
    if (!method) {
        return null;
    }
    return {
        id: `${playerId}-${roomId}-event-symbol-skip-${timestamp}`,
        playerId,
        sourceTitle: `${roomName}：事件符号`,
        sourceKind: 'event-symbol-skip',
        eventSymbolSkip: {
            roomId,
            roomName,
            method,
        },
        acceptLabel: method === 'idol' ? '用雕像跳过事件' : '跳过事件',
        declineLabel: '抽取事件牌',
        effect: { mode: 'none' },
    };
}

function createDrawnCardFromTemplate(
    core: BetrayalCore,
    template: BetrayalInventoryCard,
    options: { suffix?: string | number } = {},
): BetrayalInventoryCard {
    return {
        id: `${template.id}-${options.suffix ?? core.exploreIndex}`,
        name: template.name,
        kind: template.kind,
    };
}

function createDrawnCard(
    core: BetrayalCore,
    kind: Exclude<BetrayalDeckKind, 'event'>,
    options: { additionalDrawnCount?: number } = {},
): BetrayalInventoryCard {
    const drawnCount = options.additionalDrawnCount ?? 0;
    const template = core.possessionOrderByKind[kind][drawnCount % core.possessionOrderByKind[kind].length]!;
    return createDrawnCardFromTemplate(core, template);
}

function createDrawnCardsUntilWeapon(core: BetrayalCore): { weapon: BetrayalInventoryCard | null; buriedCards: BetrayalInventoryCard[] } {
    const itemDeck = core.possessionOrderByKind.item;
    if (itemDeck.length === 0) {
        return { weapon: null, buriedCards: [] };
    }
    const revealedCards: BetrayalInventoryCard[] = [];
    for (let index = 0; index < itemDeck.length; index += 1) {
        const template = itemDeck[index]!;
        const card = {
            id: `${template.id}-armory-${core.exploreIndex}-${index}`,
            name: template.name,
            kind: template.kind,
        };
        revealedCards.push(card);
        if (isAttackWeaponCard(card)) {
            return {
                weapon: card,
                buriedCards: revealedCards.slice(0, -1),
            };
        }
    }
    return { weapon: null, buriedCards: revealedCards };
}

function resolveEventRollResolution(
    core: BetrayalCore,
    eventCard: EventTemplate,
    random: RandomFn,
): {
    eventEffect: UseEffectProfile;
    deathPrevention?: NonNullable<Extract<BetrayalEvent, { type: typeof EVENTS.EVENT_CHOICE_RESOLVED }>['payload']['deathPrevention']>;
    eventRoll: NonNullable<Extract<BetrayalEvent, { type: typeof EVENTS.EVENT_CHOICE_RESOLVED }>['payload']['eventRoll']>;
    nextPendingEventChoice?: BetrayalPendingEventChoiceState;
    resolutionText: string;
} {
    if (!eventCard.roll) {
        throw new Error(`event ${eventCard.name} has no roll to resolve`);
    }
    const eventRollKind = eventCard.roll.kind ?? 'trait';
    const eventRollResult = eventRollKind === 'dice'
        ? rollEventFixedDice(random, eventCard.roll.dice)
        : rollEventTraitCheckWithDice(random, core.currentExplorer, eventCard.roll.trait, core);
    const eventRollTotal = eventRollResult.total;
    const eventBranch = resolveEventBranch(eventCard.roll.branches, eventRollTotal);
    const eventEffect = eventBranch.effect;
    const deferEventRollEffectRandomResults = true;
    const materializedEventEffect = materializeEventEffect(
        eventEffect,
        random,
        core.currentExplorer,
        core,
        { materializeRandomResults: !deferEventRollEffectRandomResults },
    );
    const deathPrevention = deferEventRollEffectRandomResults
        ? undefined
        : resolveEventDamageDeathPrevention(core, materializedEventEffect, random);
    const eventRollLabel = eventRollKind === 'dice'
        ? eventCard.roll.label
        : `${TRAIT_LABEL[eventCard.roll.trait]}检定`;
    const resolutionText = `${eventRollLabel} ${eventRollTotal}：${eventBranch.label}；${formatEffectLabel(materializedEventEffect)}`;
    const nextPendingEventChoice = eventEffectNeedsPendingEventChoice(materializedEventEffect)
        ? {
            id: `${core.pendingEventRollStart?.playerId ?? core.currentExplorer.playerId}-${eventCard.name}-choice`,
            playerId: core.pendingEventRollStart?.playerId ?? core.currentExplorer.playerId,
            sourceTitle: eventCard.name,
            eventDescription: eventCard.description,
            sourceKind: 'event' as const,
            acceptLabel: materializedEventEffect.mode === 'optionalEventRoll'
                || materializedEventEffect.mode === 'optionalEffect'
                || materializedEventEffect.mode === 'optionalItemEffect'
                || materializedEventEffect.mode === 'optionalHauntRoll'
                ? materializedEventEffect.acceptLabel
                : undefined,
            declineLabel: materializedEventEffect.mode === 'optionalEventRoll'
                || materializedEventEffect.mode === 'optionalEffect'
                || materializedEventEffect.mode === 'optionalItemEffect'
                || materializedEventEffect.mode === 'optionalHauntRoll'
                ? materializedEventEffect.declineLabel
                : undefined,
            effect: cloneUseEffect(materializedEventEffect),
        } satisfies BetrayalPendingEventChoiceState
        : undefined;
    return {
        eventEffect: materializedEventEffect,
        deathPrevention,
        eventRoll: {
            kind: eventRollKind,
            trait: eventRollKind === 'dice' ? undefined : eventCard.roll.trait,
            total: eventRollTotal,
            label: eventBranch.label,
            eventDescription: eventCard.description,
            rollLabel: eventRollLabel,
            dice: eventRollResult.dice,
            passiveBonus: eventRollResult.passiveBonus,
            branchThresholds: eventCard.roll.branches.map((branch) => ({
                min: branch.min,
                label: branch.label,
                effect: { ...branch.effect },
            })),
        },
        nextPendingEventChoice,
        resolutionText,
    };
}

function resolveRecommendedAction(core: BetrayalCore, options: { preferUse?: boolean; cardId?: string } = {}): BetrayalRecommendedAction {
    if (core.turnEndedByDiscovery) {
        return 'endTurn';
    }
    if (core.phase === 'haunt') {
        if (hasUsedHauntSpecialActionThisTurn(core)) {
            return 'endTurn';
        }
        if (core.scenarioRuntime.jackSpiritReleased && core.scenarioRuntime.jackSpiritRoomId === core.activeRoomId) {
            return core.scenarioRuntime.exorcismCircleRoomIds.length >= 2 ? 'use' : 'move';
        }
        if (
            isCrimsonJackHaunt(core)
            && isBetrayalLibraryRoom(core.rooms.find((room) => room.id === core.activeRoomId))
            && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(core.currentExplorer.playerId)
        ) {
            return 'use';
        }
        if (core.rooms.find((room) => room.id === core.activeRoomId)?.discoveryReward === 'event') {
            return 'use';
        }
    }

    const canMove = core.movesRemaining > 0 && resolveMoveTargetRooms(core).length > 0;
    const canExplore = Boolean(resolveNextExplorableRoomSlot(core));
    const canTrade = core.currentExplorer.inventory.length > 0
        && (resolveTradeTargets(core).length > 0 || resolveDogTradeTargets(core).length > 0 || resolveCorpseLootTargets(core).length > 0);
    const cardId = options.cardId
        ?? core.currentExplorer.inventory.find((card) => canUseBetrayalPossessionThisTurn(core, card.id))?.id;
    const canUse = Boolean(cardId && canUseBetrayalPossessionThisTurn(core, cardId));

    if (options.preferUse && canUse) return 'use';
    if (canMove) return 'move';
    if (canExplore) return 'explore';
    if (canTrade) return 'trade';
    if (canUse) return 'use';
    return 'endTurn';
}

function canReviveTraitorAtMonsterTurnStart(core: BetrayalCore, nextPlayerId: string): boolean {
    return (
        nextPlayerId === core.scenarioRuntime.traitorPlayerId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(nextPlayerId)
        && core.scenarioRuntime.jackSpiritReleased
        && Boolean(core.scenarioRuntime.jackSpiritRoomId)
        && core.scenarioRuntime.jackSpiritHasMovedSinceRelease
        && Boolean(core.scenarioRuntime.traitorCorpseRoomId)
        && core.scenarioRuntime.jackSpiritRoomId === core.scenarioRuntime.traitorCorpseRoomId
        && Boolean(findExplorerByPlayerId(core, nextPlayerId))
    );
}

function resolveJackSpiritMonsterMovementRoll(
    core: BetrayalCore,
    nextPlayerId: string,
    random: RandomFn,
): BetrayalMonsterMovementRollResult | null {
    if (!shouldDeadTraitorControlJackSpirit(core, nextPlayerId)) {
        return null;
    }
    const jackSpirit = findJackSpirit(core);
    if (!jackSpirit) {
        return null;
    }
    const dice = rollBetrayalDicePips(random, jackSpirit.speed);
    const total = dice.reduce((sum, pip) => sum + pip, 0);
    return {
        monsterId: jackSpirit.id,
        monsterName: jackSpirit.name,
        playerId: nextPlayerId,
        speed: jackSpirit.speed,
        dice,
        total,
        moveAllowance: Math.max(1, total),
    };
}

function tryReviveTraitorAtMonsterTurnStart(core: BetrayalCore, nextPlayerId: string): { core: BetrayalCore; revived: boolean } {
    if (!canReviveTraitorAtMonsterTurnStart(core, nextPlayerId)) {
        return { core, revived: false };
    }
    const traitor = findExplorerByPlayerId(core, nextPlayerId)!;
    reviveTraitorFromJackSpirit(traitor);
    core.scenarioRuntime.deadExplorerPlayerIds = core.scenarioRuntime.deadExplorerPlayerIds.filter((playerId) => playerId !== nextPlayerId);
    core.scenarioRuntime.jackSpiritReleased = false;
    core.scenarioRuntime.jackSpiritRoomId = null;
    core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
    core.scenarioRuntime.traitorCorpseRoomId = null;
    core.monsters = core.monsters.filter((monster) => monster.id !== 'jack-spirit');
    return { core: syncCurrentExplorerProjection(core), revived: true };
}

function canUseStalkThePrey(core: BetrayalCore, actor: BetrayalExplorerSummary): boolean {
    if (core.scenarioRuntime.traitorPlayerId !== actor.playerId || core.scenarioRuntime.jackSpiritReleased) {
        return false;
    }
    if (core.usedCardIdsThisTurn.includes('haunt-attack') || core.usedCardIdsThisTurn.includes('stalk-the-prey')) {
        return false;
    }
    const room = core.rooms.find((item) => item.id === actor.roomId);
    if (!room) {
        return false;
    }
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    return !livingHeroes.some((hero) => {
        const heroRoom = core.rooms.find((item) => item.id === hero.roomId);
        return heroRoom ? isStraightLineVisible(room, heroRoom, core.rooms) : false;
    });
}

function resolveStalkThePreyTargets(core: BetrayalCore, actor: BetrayalExplorerSummary): BetrayalRoomNode[] {
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    return core.rooms.filter((room) => {
        if (room.id === actor.roomId || room.state !== 'discovered' || room.floor === 'basement') {
            return false;
        }
        return !livingHeroes.some((hero) => {
            const heroRoom = core.rooms.find((item) => item.id === hero.roomId);
            return heroRoom ? isStraightLineVisible(room, heroRoom, core.rooms) : false;
        });
    });
}

function isPlayersTurn(core: BetrayalCore, playerId: string): boolean {
    return core.currentPlayer === playerId;
}

function validateTurnEndRollAcknowledgement(core: BetrayalCore, command: BetrayalCommand): ValidationResult | null {
    const pendingRoll = resolvePendingTurnEndRoll(core);
    if (!pendingRoll) {
        return command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL
            ? { valid: false, error: '当前没有待确认的回合结束投骰。' }
            : null;
    }
    if (command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL) {
        return command.playerId === pendingRoll.playerId
            ? { valid: true }
            : { valid: false, error: '必须由刚刚投骰的玩家确认结果。' };
    }
    return { valid: false, error: '请先确认回合结束投骰结果。' };
}

function validateDamageAllocationResolution(core: BetrayalCore, command: BetrayalCommand): ValidationResult | null {
    const pending = core.pendingDamageAllocation;
    if (!pending) {
        return command.type === BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION
            ? { valid: false, error: '当前没有待分配的伤害。' }
            : null;
    }
    const pendingEventRolledDamageAcknowledgement = core.recentRoll?.kind === 'eventRolledDamage'
        ? resolveAcknowledgeableRecentRoll(core)
        : null;
    if (
        pendingEventRolledDamageAcknowledgement
        && !isRecentRollFullyAcknowledged(core, pendingEventRolledDamageAcknowledgement)
    ) {
        if (
            command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
            || command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION
        ) {
            return null;
        }
        return { valid: false, error: '请先确认当前伤害骰结果。' };
    }
    if (command.type !== BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION) {
        return { valid: false, error: '请先分配当前伤害。' };
    }
    if (pending.playerId !== command.playerId) {
        return { valid: false, error: '必须由受伤玩家分配伤害。' };
    }
    const useBrooch = Boolean(command.payload.useBrooch);
    if (useBrooch && !pending.damageReplacement) {
        return { valid: false, error: '当前伤害不能使用胸针替换为通用伤害。' };
    }
    if (useBrooch && pending.forcedTraitSequence) {
        return { valid: false, error: '当前强制伤害顺序不能使用胸针替换。' };
    }
    const allowedTraits = useBrooch
        ? resolveDamageAllocationAllowedTraits('general')
        : pending.allowedTraits;
    const traits = command.payload.traits ?? [];
    if (traits.length !== pending.amount) {
        return { valid: false, error: '伤害分配点数不正确。' };
    }
    if (
        pending.forcedTraitSequence
        && (
            pending.forcedTraitSequence.length !== traits.length
            || pending.forcedTraitSequence.some((trait, index) => trait !== traits[index])
        )
    ) {
        return { valid: false, error: '木乃伊伤害必须先扣速度，速度降到底后才扣力量。' };
    }
    if (!traits.every((trait) => allowedTraits.includes(trait))) {
        return { valid: false, error: '该伤害不能分配到所选属性。' };
    }
    const explorer = findExplorerByPlayerId(core, pending.playerId);
    if (!explorer) {
        return { valid: false, error: '受伤探索者不存在。' };
    }
    if (!damageTraitsAreAssignable(explorer, traits, { allowSkull: pending.allowSkull })) {
        return { valid: false, error: '不能把伤害分配到已锁定的属性。' };
    }
    return { valid: true };
}

function validateEventRollFinalization(core: BetrayalCore, command: BetrayalCommand): ValidationResult | null {
    const pending = core.pendingEventRollResolution;
    if (!pending) {
        return command.type === BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL
            ? { valid: false, error: '当前没有等待确认最终结果的事件骰。' }
            : null;
    }
    if (command.type !== BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL) {
        if (
            command.type === BETRAYAL_COMMANDS.USE_POSSESSION
            && canUseBookForPendingEventRoll(core, command.playerId, command.payload.cardId)
        ) {
            return { valid: true };
        }
        if (
            pending.requiresAcknowledgement === false
            && (command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT
                || command.type === BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM)
        ) {
            return null;
        }
        return { valid: false, error: '请先处理当前事件投掷结果。' };
    }
    if (pending.requiresAcknowledgement === false) {
        if (command.playerId !== pending.playerId) {
            return { valid: false, error: '只有触发事件的玩家可以继续处理当前投掷。' };
        }
        if (command.payload.rollId && command.payload.rollId !== pending.rollId) {
            return { valid: false, error: '当前投掷结果已经改变。' };
        }
        return { valid: true };
    }
    const requiredPlayerIds = resolvePendingEventRollResolutionRequiredPlayerIds(core, pending);
    if (!requiredPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '只有本局玩家可以确认事件骰最终结果。' };
    }
    const acknowledgedPlayerIds = resolvePendingEventRollResolutionAcknowledgedPlayerIds(pending);
    if (acknowledgedPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '你已经确认过当前事件骰最终结果。' };
    }
    if (command.payload.rollId && command.payload.rollId !== pending.rollId) {
        return { valid: false, error: '确认的投骰已不是当前事件骰。' };
    }
    return { valid: true };
}

function validateCardResolutionAcknowledgement(core: BetrayalCore, command: BetrayalCommand): ValidationResult | null {
    if (command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION) {
        return null;
    }
    const pendingResolution = (core.pendingCardResolutionQueue ?? [])[0];
    if (!pendingResolution) {
        return { valid: false, error: '当前没有待确认的翻牌结算。' };
    }
    const requiredPlayerIds = resolvePendingCardResolutionRequiredPlayerIds(pendingResolution);
    if (!requiredPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '只有本局玩家可以确认当前翻牌结算。' };
    }
    const acknowledgedPlayerIds = resolvePendingCardResolutionAcknowledgedPlayerIds(pendingResolution);
    if (acknowledgedPlayerIds.includes(command.playerId)) {
        return { valid: false, error: '你已经确认过当前翻牌结算。' };
    }
    if (command.payload.resolutionId && command.payload.resolutionId !== pendingResolution.id) {
        return { valid: false, error: '必须按当前翻牌顺序确认。' };
    }
    return { valid: true };
}

function validatePreHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    const canReuseDuringHaunt = core.phase === 'haunt' && (
        command.type === BETRAYAL_COMMANDS.EXPLORE_ROOM
        || command.type === BETRAYAL_COMMANDS.USE_ROOM_EFFECT
        || command.type === BETRAYAL_COMMANDS.USE_POSSESSION
        || command.type === BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE
    );
    if (core.phase !== 'preHaunt' && !canReuseDuringHaunt) {
        return { valid: false, error: '当前不在运行时阶段。' };
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT) {
        const pendingTrade = core.pendingTradeAgreement;
        if (!pendingTrade) {
            return { valid: false, error: '当前没有待同意的交易。' };
        }
        if (pendingTrade.targetPlayerId !== command.playerId) {
            return { valid: false, error: '必须由交易接收方回应。' };
        }
        if (typeof command.payload.accept !== 'boolean') {
            return { valid: false, error: '交易回应必须选择同意或拒绝。' };
        }
        return { valid: true };
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE) {
        const pending = core.pendingEventChoice;
        if (!pending || pending.playerId !== command.playerId) {
            return { valid: false, error: '当前没有待结算的事件选择。' };
        }
        if (pending.itemResolution === 'tooth-necklace-end-turn') {
            if (command.payload.accept === false) {
                return { valid: true };
            }
            if (!command.payload.trait || !pending.effect.allowedTraits.includes(command.payload.trait)) {
                return { valid: false, error: '牙齿项链必须选择一项当前濒死属性。' };
            }
            return { valid: true };
        }
        if (pending.effect.mode === 'optionalItemEffect') {
            const selectedEffect = command.payload.accept
                ? pending.effect.acceptEffect
                : pending.effect.declineEffect;
            if (
                command.payload.accept
                && !effectAllowsItemChoice(core, pending.effect, command.payload.cardId)
            ) {
                return { valid: false, error: '该事件必须选择一件有效持有物。' };
            }
            if (
                effectNeedsAdjacentRoomChoice(selectedEffect)
                && (!command.payload.targetRoomId || !effectAllowsAdjacentRoomChoice(core, command.payload.targetRoomId))
            ) {
                return { valid: false, error: '该事件必须选择一个已发现的相邻板块。' };
            }
            if (
                effectNeedsRoomTargetChoice(selectedEffect)
                && (!command.payload.targetRoomId || !effectAllowsRoomTargetChoice(core, selectedEffect, command.payload.targetRoomId))
            ) {
                return { valid: false, error: '该事件必须选择一个有效目标板块。' };
            }
            if (
                effectHasUnresolvedChosenTraitChoice(selectedEffect)
                && (!command.payload.trait || !effectAllowsChosenTrait(selectedEffect, command.payload.trait))
            ) {
                return { valid: false, error: '该事件必须选择一个有效属性。' };
            }
            if (
                effectHasUnresolvedGeneralDamageChoice(selectedEffect)
                && !effectAllowsGeneralDamageTraits(
                    selectedEffect,
                    command.payload.traits,
                    core.currentExplorer,
                    { allowSkull: core.phase === 'haunt' },
                )
            ) {
                return { valid: false, error: '该事件必须选择足够的受伤属性。' };
            }
            return { valid: true };
        }
        if (pending.effect.mode === 'traitRoll') {
            return { valid: true };
        }
        if (
            effectNeedsAdjacentRoomChoice(pending.effect)
            && (!command.payload.targetRoomId || !effectAllowsAdjacentRoomChoice(core, command.payload.targetRoomId))
        ) {
            return { valid: false, error: '该事件必须选择一个已发现的相邻板块。' };
        }
        if (
            effectNeedsRoomTargetChoice(pending.effect)
            && (!command.payload.targetRoomId || !effectAllowsRoomTargetChoice(core, pending.effect, command.payload.targetRoomId))
        ) {
            return { valid: false, error: '该事件必须选择一个有效目标板块。' };
        }
        if (
            effectHasUnresolvedChosenTraitChoice(pending.effect)
            && (!command.payload.trait || !effectAllowsChosenTrait(pending.effect, command.payload.trait))
        ) {
            return { valid: false, error: '该事件必须选择一个有效属性。' };
        }
        if (
            effectHasUnresolvedGeneralDamageChoice(pending.effect)
            && !effectAllowsGeneralDamageTraits(
                pending.effect,
                command.payload.traits,
                core.currentExplorer,
                { allowSkull: core.phase === 'haunt' },
            )
        ) {
            return { valid: false, error: '该事件必须选择足够的受伤属性。' };
        }
        if (pending.effect.mode === 'chooseTraitRoll') {
            if (!command.payload.trait || !pending.effect.allowedTraits.includes(command.payload.trait)) {
                return { valid: false, error: '该事件必须选择一个有效属性。' };
            }
            const previewEffect = resolveChooseTraitRollPreviewEffect(core, pending.effect, command.payload.trait);
            if (
                effectNeedsRoomTargetChoice(previewEffect)
                && (!command.payload.targetRoomId || !effectAllowsRoomTargetChoice(core, previewEffect, command.payload.targetRoomId))
            ) {
                return { valid: false, error: '该事件必须选择一个有效目标板块。' };
            }
            if (
                effectNeedsAdjacentRoomChoice(previewEffect)
                && (!command.payload.targetRoomId || !effectAllowsAdjacentRoomChoice(core, command.payload.targetRoomId))
            ) {
                return { valid: false, error: '该事件必须选择一个已发现的相邻板块。' };
            }
            if (
                effectHasUnresolvedGeneralDamageChoice(previewEffect)
                && !effectAllowsGeneralDamageTraits(
                    previewEffect,
                    command.payload.traits,
                    core.currentExplorer,
                    { allowSkull: core.phase === 'haunt' },
                )
            ) {
                return { valid: false, error: '该事件必须选择足够的受伤属性。' };
            }
            return { valid: true };
        }
        if (pending.effect.mode === 'allTraitChecks') {
            if (
                effectHasUnresolvedChosenTraitChoice(pending.effect.allPassEffect)
                && (!command.payload.trait || !effectAllowsChosenTrait(pending.effect.allPassEffect, command.payload.trait))
            ) {
                return { valid: false, error: '该事件必须选择一个有效属性。' };
            }
            if (
                effectHasUnresolvedGeneralDamageChoice(pending.effect.allPassEffect)
                && !effectAllowsGeneralDamageTraits(
                    pending.effect.allPassEffect,
                    command.payload.traits,
                    core.currentExplorer,
                    { allowSkull: core.phase === 'haunt' },
                )
            ) {
                return { valid: false, error: '该事件必须选择足够的受伤属性。' };
            }
            return { valid: true };
        }
        if (pending.effect.mode === 'optionalHauntRoll') {
            if (
                command.payload.accept
                && !isBetrayalOptionalHauntRollRuntimeSupported(pending.effect.successHauntId)
            ) {
                return { valid: false, error: `作祟剧本${pending.effect.successHauntId}尚未接入完整剧本链路。` };
            }
            if (
                !command.payload.accept
                && effectNeedsTraitChoice(pending.effect.skippedOrStartedEffect)
                && (
                    (
                        effectHasUnresolvedChosenTraitChoice(pending.effect.skippedOrStartedEffect)
                        && (!command.payload.trait || !effectAllowsChosenTrait(pending.effect.skippedOrStartedEffect, command.payload.trait))
                    )
                    || (
                        effectHasUnresolvedGeneralDamageChoice(pending.effect.skippedOrStartedEffect)
                        && !effectAllowsGeneralDamageTraits(
                            pending.effect.skippedOrStartedEffect,
                            command.payload.traits,
                            core.currentExplorer,
                            { allowSkull: core.phase === 'haunt' },
                        )
                    )
                )
            ) {
                return { valid: false, error: '该事件必须选择一个有效属性。' };
            }
            return { valid: true };
        }
        return { valid: true };
    }
    const recentRollRerollValidation = command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT
        || command.type === BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM
        ? validateBetrayalRecentRollRerollItemCommand(core, command.playerId, command.payload, {
            legacyRabbitFoot: command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
        })
        : null;
    if (recentRollRerollValidation) {
        return recentRollRerollValidation;
    }
    const pendingDamageAllocationValidation = validateDamageAllocationResolution(core, command);
    if (pendingDamageAllocationValidation) {
        return pendingDamageAllocationValidation;
    }
    const eventRollFinalization = validateEventRollFinalization(core, command);
    if (eventRollFinalization) {
        return eventRollFinalization;
    }
    const cardResolutionAcknowledgement = validateCardResolutionAcknowledgement(core, command);
    if (cardResolutionAcknowledgement) {
        return cardResolutionAcknowledgement;
    }
    if (command.type === BETRAYAL_COMMANDS.ROLL_EVENT) {
        const pending = core.pendingEventRollStart;
        if (!pending) {
            return { valid: false, error: '当前没有等待投掷的事件。' };
        }
        if (pending.playerId !== command.playerId) {
            return { valid: false, error: '只有触发事件的玩家可以投掷。' };
        }
        if (command.payload.sourceTitle && command.payload.sourceTitle !== pending.sourceTitle) {
            return { valid: false, error: '当前事件已经改变。' };
        }
        return { valid: true };
    }
    if (core.pendingEventChoice) {
        return { valid: false, error: '请先处理当前事件。' };
    }
    if ((core.pendingCardResolutionQueue ?? []).length > 0) {
        return { valid: false, error: '请先确认当前翻牌结算。' };
    }
    if (core.pendingTradeAgreement) {
        return { valid: false, error: '请先等待交易接收方回应。' };
    }
    const pendingTurnEndRollValidation = validateTurnEndRollAcknowledgement(core, command);
    if (pendingTurnEndRollValidation) {
        return pendingTurnEndRollValidation;
    }
    const pendingRecentRollAcknowledgement = command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
        ? resolveAcknowledgeableRecentRoll(core)
        : null;
    const isRecentRollAcknowledgementParticipant = Boolean(
        pendingRecentRollAcknowledgement
        && resolveRecentRollRequiredPlayerIds(core, pendingRecentRollAcknowledgement).includes(command.playerId),
    );
    if (!isPlayersTurn(core, command.playerId) && !isRecentRollAcknowledgementParticipant) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }
    if (
        core.turnEndedByDiscovery
        && command.type !== BETRAYAL_COMMANDS.END_TURN
        && command.type !== BETRAYAL_COMMANDS.USE_RABBIT_FOOT
        && command.type !== BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM
        && !(command.type === BETRAYAL_COMMANDS.USE_POSSESSION && canUseBookForPendingEventRoll(core, command.playerId, command.payload.cardId))
        && command.type !== BETRAYAL_COMMANDS.ROLL_EVENT
        && command.type !== BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL
        && command.type !== BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE
        && command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION
        && command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
    ) {
        return { valid: false, error: '探索新房间后回合已经结束。' };
    }

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const payload = command.payload;
            const targetRooms = new Set(resolveMoveTargetRooms(core).map((room) => room.id));
            if (payload.useSkeletonKey && canUseSkeletonKeyForMove(core, payload.roomId)) {
                return { valid: true };
            }
            if (core.movesRemaining < resolveBetrayalMoveCost(core) || !targetRooms.has(payload.roomId)) {
                return { valid: false, error: '目标房间不可移动。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = command.payload.roomId
                ? explorableSlots.find((room) => room.id === command.payload.roomId) ?? null
                : explorableSlots[0] ?? null;
            if (!nextSlot) {
                return { valid: false, error: '当前没有可探索房间。' };
            }
            if (command.payload.roomId && !explorableSlots.some((room) => room.id === command.payload.roomId)) {
                return { valid: false, error: '指定房间不是当前开放门位。' };
            }
            if (command.payload.useHolySymbol && !canUseHolySymbolForDiscovery(core)) {
                return { valid: false, error: '当前探索者不能使用圣符替换发现板块。' };
            }
            const placement = resolveRoomPlacementContext(core, nextSlot);
            const roomDraw = resolveRoomDraw(core, nextSlot.floor, {
                useHolySymbol: command.payload.useHolySymbol && canUseHolySymbolForDiscovery(core),
                placement,
            });
            const roomTemplate = roomDraw.roomTemplate;
            if (!roomTemplate) {
                return { valid: false, error: '当前区域没有可发现房间。' };
            }
            const deckKind = resolveRoomTemplateDiscoveryDeckKind(roomTemplate);
            const orientationOptions = resolveRoomPlacementOrientationOptions(
                core,
                roomTemplate,
                placement,
                roomDraw.selectedRoomRequiresOpenFrontier,
            );
            if (command.payload.useIdol) {
                if (!canUseIdolToSkipEvent(core)) {
                    return { valid: false, error: '当前探索者不能使用雕像跳过事件抽取。' };
                }
                if (deckKind !== 'event') {
                    return { valid: false, error: '雕像只能在发现事件符号板块时使用。' };
                }
            }
            if (command.payload.ignoreEventSymbolWithTraitorPower) {
                if (command.payload.useIdol) {
                    return { valid: false, error: '事件符号只能选择一种跳过方式。' };
                }
                if (!canUseBetrayalTraitorPowers(core, command.playerId)) {
                    return { valid: false, error: '只有作祟开始后的存活叛徒能忽略事件符号。' };
                }
                if (deckKind !== 'event') {
                    return { valid: false, error: '叛徒只能在发现事件符号板块时忽略事件符号。' };
                }
            }
            if (command.payload.orientationTurns !== undefined) {
                if (!isRoomOrientationTurns(command.payload.orientationTurns)) {
                    return { valid: false, error: '房间朝向无效。' };
                }
                if (!orientationOptions.some((option) => option.orientationTurns === command.payload.orientationTurns)) {
                    return {
                        valid: false,
                        error: canConnectDoorwaysToEntry(roomTemplate.doorways, placement.entryEdge, command.payload.orientationTurns)
                            ? '此朝向会封死当前区域。'
                            : '此朝向没有走廊连接入口。',
                        };
                }
            }
            if (roomDraw.resolution.requiresTileAdjustment) {
                const placementOrientationTurns = command.payload.orientationTurns
                    ?? orientationOptions[0]?.orientationTurns
                    ?? orientDoorwaysForPlacement(roomTemplate.doorways, placement.entryEdge).orientationTurns;
                const adjustmentOptions = resolveRoomTileAdjustmentOptionsForPlacement(
                    core,
                    roomTemplate,
                    placement,
                    placementOrientationTurns,
                );
                if (!command.payload.roomTileAdjustment) {
                    return { valid: false, error: '需要先调整该区域已有板块，保留至少一个开放走廊。' };
                }
                if (!adjustmentOptions.some((option) => roomTileAdjustmentSelectionsMatch(option, command.payload.roomTileAdjustment!))) {
                    return { valid: false, error: '该房间板块调整不能保留开放走廊。' };
                }
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            return validateBetrayalPossessionSpecialActionCommand(core, command.playerId, command.payload);
        }
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            const actionStatus = resolveBetrayalRoomSpecialActionStatus(core);
            if (!actionStatus.canUse) {
                return { valid: false, error: actionStatus.reason ?? '当前房间没有可使用的房间效果。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            if (core.pendingTradeAgreement) {
                return { valid: false, error: '已有待同意的交易。' };
            }
            if (core.tradeUsedThisTurnPlayerIds.includes(core.currentExplorer.playerId)) {
                return { valid: false, error: '本回合已经完成过交易。' };
            }
            const cardIds = resolveTradeCardIds(command.payload);
            const tradeTargets = command.payload.useDog ? resolveDogTradeTargets(core) : resolveTradeTargets(core);
            const targetPlayerId = command.payload.targetPlayerId;
            const targetCardIds = command.payload.targetCardIds ?? [];
            const target = tradeTargets.find((explorer) => explorer.playerId === targetPlayerId);
            if ((cardIds.length === 0 && targetCardIds.length === 0) || !targetPlayerId) {
                return { valid: false, error: '缺少交易对象或持有物。' };
            }
            if (command.payload.useDog && !canUseDogForTrade(core)) {
                return { valid: false, error: '当前探索者不能使用狗进行远距交易。' };
            }
            const requesterCardStatuses = cardIds.map((cardId) => resolveBetrayalTradeCardStatus(core, cardId, {
                ownerPlayerId: core.currentExplorer.playerId,
                ownerRole: 'requester',
                useDogTrade: command.payload.useDog,
            }));
            const invalidRequesterCard = requesterCardStatuses.find((status) => !status.canTrade);
            if (invalidRequesterCard) {
                return { valid: false, error: invalidRequesterCard.reason ?? '当前探索者没有这件持有物。' };
            }
            if (!target) {
                return { valid: false, error: command.payload.useDog ? '狗只能和 4 格以内的玩家交易。' : '只能和同房间队友交易。' };
            }
            const targetCardStatuses = targetCardIds.map((cardId) => resolveBetrayalTradeCardStatus(core, cardId, {
                ownerPlayerId: target.playerId,
                ownerRole: 'target',
            }));
            const invalidTargetCard = targetCardStatuses.find((status) => !status.canTrade);
            if (invalidTargetCard) {
                return { valid: false, error: invalidTargetCard.reason ?? '交易对象没有这件持有物。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.LOOT_CORPSE: {
            const corpseTargets = resolveCorpseLootTargets(core);
            const sourcePlayerId = command.payload.sourcePlayerId;
            const sourceExplorer = corpseTargets.find((explorer) => explorer.playerId === sourcePlayerId);
            const cardId = command.payload.cardId;
            if (!sourcePlayerId || !sourceExplorer || !cardId) {
                return { valid: false, error: '搜刮尸体必须先选择尸体和具体持有物。' };
            }
            if (!sourceExplorer.inventory.some((card) => card.id === cardId)) {
                return { valid: false, error: '该尸体上没有这件物品或预兆。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL: {
            const recentRoll = resolveAcknowledgeableRecentRoll(core);
            if (!recentRoll) {
                return { valid: false, error: '当前没有待确认的投骰结果。' };
            }
            const requiredPlayerIds = resolveRecentRollRequiredPlayerIds(core, recentRoll);
            if (!requiredPlayerIds.includes(command.playerId)) {
                return { valid: false, error: '只有本局玩家可以确认当前投骰结果。' };
            }
            if (!canPlayerAcknowledgeRecentRoll(core, command.playerId)) {
                return { valid: false, error: '你已经确认过当前投骰结果。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return { valid: false, error: '当前没有待确认的回合结束投骰。' };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION:
            return { valid: false, error: '当前没有待确认的翻牌结算。' };
        case BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION:
            return { valid: false, error: '当前没有待分配的伤害。' };
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE:
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START:
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP:
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM:
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO:
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN:
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS:
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT:
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD:
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND:
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK:
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN:
        case BETRAYAL_COMMANDS.TAKE_PHOTO:
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA:
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK:
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO:
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME:
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT:
        case BETRAYAL_COMMANDS.BANISH_MUMMY:
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL:
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY:
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY:
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD:
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY:
            return { valid: false, error: '当前还未进入 haunt 阶段。' };
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知运行时命令。' };
    }
}

function isBloodFromStoneMonsterTurnCommand(core: BetrayalCore, command: BetrayalCommand): boolean {
    switch (command.type) {
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START: {
            const monster = core.monsters.find((item) => item.id === command.payload.monsterId);
            return Boolean(monster && isStoneCherubMonster(monster));
        }
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP: {
            const groupId = command.payload.groupId;
            return resolveBetrayalMonsterMovementGroups(core).some((group) => (
                group.groupId === groupId
                && group.monsterIds.some((monsterId) => {
                    const monster = core.monsters.find((item) => item.id === monsterId);
                    return Boolean(monster && isStoneCherubMonster(monster));
                })
            ));
        }
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM: {
            const monster = core.monsters.find((item) => item.id === command.payload.monsterId);
            return Boolean(monster && isStoneCherubMonster(monster));
        }
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN:
            return true;
        default:
            return false;
    }
}

function validateHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase !== 'haunt') {
        return { valid: false, error: '当前不在 haunt 阶段。' };
    }
    const pendingHelpingHandsReward = resolveHelpingHandsPendingAttackReward(core);
    if (
        pendingHelpingHandsReward
        && command.type !== BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD
        && command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
    ) {
        return { valid: false, error: '请先选择造成伤害或偷取物品/预兆。' };
    }
    const pendingMummyReward = resolveMummyPendingAttackReward(core);
    if (
        pendingMummyReward
        && command.type !== BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD
        && command.type !== BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
    ) {
        return { valid: false, error: '请先选择木乃伊造成伤害或偷取物品/预兆。' };
    }
    const recentRollRerollValidation = command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT
        || command.type === BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM
        ? validateBetrayalRecentRollRerollItemCommand(core, command.playerId, command.payload, {
            legacyRabbitFoot: command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
        })
        : null;
    if (recentRollRerollValidation) {
        if (core.pendingDamageAllocation && !isPendingDamageAllocationForAttackRoll(core)) {
            return { valid: false, error: '请先分配当前伤害。' };
        }
        return recentRollRerollValidation;
    }
    const eventRollFinalization = validateEventRollFinalization(core, command);
    if (eventRollFinalization) {
        return eventRollFinalization;
    }
    const pendingDamageAllocationValidation = validateDamageAllocationResolution(core, command);
    if (pendingDamageAllocationValidation) {
        return pendingDamageAllocationValidation;
    }
    const cardResolutionAcknowledgement = validateCardResolutionAcknowledgement(core, command);
    if (cardResolutionAcknowledgement) {
        return cardResolutionAcknowledgement;
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT) {
        if (isBetrayalPlayerControllingMonster(core, command.playerId)) {
            return { valid: false, error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。' };
        }
        return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
    }
    if (command.type === BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE) {
        const pendingExchange = core.scenarioRuntime.dust?.pendingSicknessExchange;
        if (!pendingExchange) {
            return { valid: false, error: '当前没有待回应的疾病标记交换。' };
        }
        if (pendingExchange.targetPlayerId !== command.playerId) {
            return { valid: false, error: '必须由交换目标玩家回应。' };
        }
        if (typeof command.payload.accept !== 'boolean') {
            return { valid: false, error: '交换回应必须选择同意或拒绝。' };
        }
        return { valid: true };
    }
    if (core.scenarioRuntime.dust?.pendingSicknessExchange) {
        return { valid: false, error: '请先等待疾病标记交换回应。' };
    }
    const pendingTurnEndRollValidation = validateTurnEndRollAcknowledgement(core, command);
    if (pendingTurnEndRollValidation) {
        return pendingTurnEndRollValidation;
    }
    if ((core.pendingCardResolutionQueue ?? []).length > 0) {
        return { valid: false, error: '请先确认当前翻牌结算。' };
    }
    const helpingHandsMonsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);
    const isHelpingHandsMonsterCommand = command.type === BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND
        || command.type === BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK
        || command.type === BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN;
    if (helpingHandsMonsterTurnStatus.active && !isHelpingHandsMonsterCommand) {
        return { valid: false, error: '当前正在进行巨魔手怪物回合，请先完成巨魔手行动。' };
    }
    const bloodFromStoneMonsterTurnStatus = resolveBloodFromStoneMonsterTurnStatus(core);
    const isBloodFromStoneMonsterCommand = isBloodFromStoneMonsterTurnCommand(core, command);
    if (bloodFromStoneMonsterTurnStatus.active && !isBloodFromStoneMonsterCommand) {
        return { valid: false, error: '当前正在进行石像小天使怪物回合，请先完成石像小天使行动。' };
    }
    if (
        bloodFromStoneMonsterTurnStatus.active
        && isBloodFromStoneMonsterCommand
        && bloodFromStoneMonsterTurnStatus.controllerPlayerId !== command.playerId
    ) {
        return { valid: false, error: '只有当前石像小天使怪物回合控制者能执行怪物行动。' };
    }
    if (!bloodFromStoneMonsterTurnStatus.active && isBloodFromStoneMonsterCommand) {
        return { valid: false, error: '石像小天使怪物回合尚未开始。' };
    }
    const isStandardMonsterTurnCommand = (
        command.type === BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START
        || command.type === BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP
        || command.type === BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM
        || command.type === BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO
        || command.type === BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK
    ) && !isHelpingHandsMonsterCommand && !isBloodFromStoneMonsterCommand;
    const pendingRecentRollAcknowledgement = command.type === BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL
        ? resolveAcknowledgeableRecentRoll(core)
        : null;
    const isRecentRollAcknowledgementParticipant = Boolean(
        pendingRecentRollAcknowledgement
        && resolveRecentRollRequiredPlayerIds(core, pendingRecentRollAcknowledgement).includes(command.playerId),
    );
    if (
        !isPlayersTurn(core, command.playerId)
        && !(helpingHandsMonsterTurnStatus.active && isHelpingHandsMonsterCommand)
        && !(bloodFromStoneMonsterTurnStatus.active && isBloodFromStoneMonsterCommand)
        && !(isStandardMonsterTurnCommand && canPlayerControlStandardMonsterTurn(core, command.playerId))
        && !isRecentRollAcknowledgementParticipant
    ) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }

    const actor = findExplorerByPlayerId(core, command.playerId);
    if (!actor) {
        return { valid: false, error: '当前行动者不存在。' };
    }
    const actorRoomId = resolveControlledRoomId(core, actor);
    const isTraitor = core.scenarioRuntime.traitorPlayerId === command.playerId;
    const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(command.playerId);
    if (isStandardMonsterTurnCommand && !canPlayerControlStandardMonsterTurn(core, command.playerId)) {
        return { valid: false, error: '只有当前叛徒能执行普通怪物回合动作。' };
    }

    if (command.type === BETRAYAL_COMMANDS.HAUNT_ATTACK && core.usedCardIdsThisTurn.includes('haunt-attack')) {
        return { valid: false, error: '本回合已经攻击过。' };
    }

    if (
        isBetrayalPlayerControllingMonster(core, actor.playerId)
        && (
            command.type === BETRAYAL_COMMANDS.USE_POSSESSION
            || command.type === BETRAYAL_COMMANDS.TRADE_POSSESSION
            || command.type === BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT
            || command.type === BETRAYAL_COMMANDS.LOOT_CORPSE
        )
    ) {
        return { valid: false, error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。' };
    }

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM:
            if (isDead) {
                if (shouldDeadPlayerControlFeverish(core, actor.playerId)) {
                    if (core.movesRemaining <= 0) {
                        return { valid: false, error: '狂热病患本回合没有剩余移动点。' };
                    }
                    const targetRoom = core.rooms.find((room) => room.id === command.payload.roomId);
                    const currentRoom = core.rooms.find((room) => room.id === actorRoomId);
                    if (!targetRoom || targetRoom.state !== 'discovered') {
                        return { valid: false, error: '目标房间不可移动。' };
                    }
                    if (targetRoom.id === actorRoomId || roomDistanceByLayout(currentRoom, targetRoom) !== 1) {
                        return { valid: false, error: '狂热病患只能移动到相邻房间。' };
                    }
                    return { valid: true };
                }
                if (!core.scenarioRuntime.jackSpiritReleased || actor.playerId !== core.scenarioRuntime.traitorPlayerId) {
                    return { valid: false, error: '该角色已死亡，当前不能移动。' };
                }
                if (core.movesRemaining <= 0) {
                    return { valid: false, error: '杰克之灵本回合没有剩余移动点。' };
                }
                const targetRoom = core.rooms.find((room) => room.id === command.payload.roomId);
                if (!targetRoom || targetRoom.state !== 'discovered') {
                    return { valid: false, error: '目标房间不可移动。' };
                }
                const currentRoom = core.rooms.find((room) => room.id === actorRoomId);
                if (targetRoom.id === actorRoomId) {
                    return { valid: false, error: '杰克之灵必须移动到相邻房间。' };
                }
                if (roomDistanceByLayout(currentRoom, targetRoom) !== 1) {
                    return { valid: false, error: '杰克之灵只能移动到相邻房间。' };
                }
                return { valid: true };
            }
            if (isTraitor && canUseStalkThePrey(core, actor)) {
                const target = core.rooms.find((room) => room.id === command.payload.roomId);
                if (target && resolveStalkThePreyTargets(core, actor).some((room) => room.id === target.id)) {
                    return { valid: true };
                }
            }
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.EXPLORE_ROOM:
            if (isDead) {
                return { valid: false, error: '死亡探索者不能探索新房间。' };
            }
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT:
            if (isDead) {
                return { valid: false, error: '死亡探索者不能使用房间效果。' };
            }
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.USE_POSSESSION:
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.ROLL_EVENT: {
            const pending = core.pendingEventRollStart;
            if (!pending) {
                return { valid: false, error: '当前没有等待投掷的事件。' };
            }
            if (pending.playerId !== command.playerId) {
                return { valid: false, error: '只有触发事件的玩家可以投掷。' };
            }
            if (command.payload.sourceTitle && command.payload.sourceTitle !== pending.sourceTitle) {
                return { valid: false, error: '当前事件已经改变。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
        case BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM:
        case BETRAYAL_COMMANDS.TRADE_POSSESSION:
        case BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT:
        case BETRAYAL_COMMANDS.LOOT_CORPSE:
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE:
            return validatePreHauntAction(state, command);
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL: {
            const recentRoll = resolveAcknowledgeableRecentRoll(core);
            if (!recentRoll) {
                return { valid: false, error: '当前没有待确认的投骰结果。' };
            }
            const requiredPlayerIds = resolveRecentRollRequiredPlayerIds(core, recentRoll);
            if (!requiredPlayerIds.includes(command.playerId)) {
                return { valid: false, error: '只有本局玩家可以确认当前投骰结果。' };
            }
            if (!canPlayerAcknowledgeRecentRoll(core, command.playerId)) {
                return { valid: false, error: '你已经确认过当前投骰结果。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return { valid: false, error: '当前没有待确认的回合结束投骰。' };
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE: {
            const monsterId = command.payload.monsterId;
            if (!monsterId) {
                return { valid: false, error: '必须选择要结算受伤的怪物。' };
            }
            const monster = core.monsters.find((item) => item.id === monsterId);
            if (!monster) {
                return { valid: false, error: '当前宅邸中找不到该怪物。' };
            }
            const damageAmount = command.payload.damageAmount;
            if (!Number.isInteger(damageAmount) || damageAmount < 0) {
                return { valid: false, error: '怪物受伤点数必须是非负整数。' };
            }
            const damageTrait = command.payload.damageTrait;
            if (!damageTrait || !BETRAYAL_TRAIT_KEYS.includes(damageTrait)) {
                return { valid: false, error: '怪物受伤必须指定有效伤害属性。' };
            }
            const outcome = resolveBetrayalMonsterDamageOutcome(core, monsterId, {
                damageAmount,
                damageTrait,
            });
            if (!outcome) {
                return { valid: false, error: '当前无法结算该怪物受伤。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START: {
            const monsterId = command.payload.monsterId;
            if (!monsterId) {
                return { valid: false, error: '必须选择要开始回合的怪物。' };
            }
            const preview = resolveBetrayalMonsterTurnStartResolutionPreview(core, monsterId);
            return preview.canResolve
                ? { valid: true }
                : { valid: false, error: preview.reason ?? '当前怪物不能开始回合。' };
        }
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP: {
            const groupId = command.payload.groupId;
            if (!groupId) {
                return { valid: false, error: '必须选择怪物移动骰组。' };
            }
            const preview = resolveBetrayalMonsterMovementRollGroupPreview(core, groupId);
            return preview.canRoll
                ? { valid: true }
                : { valid: false, error: preview.reason ?? '当前怪物移动骰组不能掷骰。' };
        }
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM: {
            const monsterId = command.payload.monsterId;
            const roomId = command.payload.roomId;
            if (!monsterId || !roomId) {
                return { valid: false, error: '必须选择怪物和目标房间。' };
            }
            const monster = core.monsters.find((item) => item.id === monsterId);
            if (!monster) {
                return { valid: false, error: '当前宅邸中找不到该怪物。' };
            }
            const moveRemaining = core.scenarioRuntime.monsterTurn?.moveRemainingById?.[monsterId] ?? 0;
            const canMummyTeleportNow = hasMummyTeleportMoveAvailable(core, monsterId);
            if (moveRemaining <= 0 && !canMummyTeleportNow) {
                return { valid: false, error: '该怪物本回合没有剩余移动额度。' };
            }
            const moveCost = resolveBetrayalMonsterMoveCost(core, monsterId);
            if (moveRemaining < moveCost && !canMummyTeleportNow) {
                return { valid: false, error: '该怪物本回合剩余移动不足。' };
            }
            const canMoveToTarget = resolveBetrayalMonsterMoveTargetRooms(core, monsterId)
                .some((room) => room.id === roomId);
            return canMoveToTarget
                ? { valid: true }
                : { valid: false, error: '怪物只能移动到已发现且真实连接的房间。' };
        }
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN: {
            const preview = resolveBloodFromStoneMonsterTurnEndPreview(core);
            return preview.canEnd
                ? { valid: true }
                : { valid: false, error: preview.reason ?? '当前不能结束石像小天使怪物回合。' };
        }
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO: {
            const monsterId = command.payload.monsterId;
            const targetPlayerId = command.payload.targetPlayerId;
            if (!monsterId || !targetPlayerId) {
                return { valid: false, error: '必须选择怪物和攻击目标英雄。' };
            }
            if (resolveMonsterAttackCommand(core, monsterId) !== BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO) {
                return { valid: false, error: '该怪物需要使用作祟专属攻击命令。' };
            }
            const targets = resolveBetrayalNormalMonsterAttackTargets(core, monsterId);
            if (!targets?.canResolveWithExistingCommand) {
                return { valid: false, error: targets?.reason ?? '该怪物当前不能发动普通攻击。' };
            }
            if (!targets.targetPlayerIds.includes(targetPlayerId)) {
                return { valid: false, error: '普通怪物只能攻击同板块的存活英雄。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD: {
            const pending = pendingHelpingHandsReward;
            if (!pending) {
                return { valid: false, error: '当前没有待选择的援手攻击奖励。' };
            }
            if (pending.attackerPlayerId !== actor.playerId) {
                return { valid: false, error: '必须由攻击获胜者选择伤害或偷牌。' };
            }
            if (command.payload.choice === 'damage') {
                return { valid: true };
            }
            if (command.payload.choice !== 'steal') {
                return { valid: false, error: '必须选择造成伤害或偷取物品/预兆。' };
            }
            const cardId = command.payload.cardId;
            if (!cardId) {
                return { valid: false, error: '偷取时必须选择一张物品或预兆。' };
            }
            if (!resolveHelpingHandsStealableCards(core, pending.defenderPlayerId).some((card) => card.id === cardId)) {
                return { valid: false, error: '只能偷取防守者持有的物品或预兆。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD: {
            const pending = pendingMummyReward;
            if (!pending) {
                return { valid: false, error: '当前没有待选择的木乃伊攻击奖励。' };
            }
            if (pending.controllerPlayerId !== actor.playerId) {
                return { valid: false, error: '必须由木乃伊控制者选择伤害或偷取。' };
            }
            if (command.payload.choice === 'damage') {
                return { valid: true };
            }
            if (command.payload.choice !== 'steal') {
                return { valid: false, error: '必须选择造成伤害或偷取物品/预兆。' };
            }
            const cardId = command.payload.cardId;
            if (!cardId) {
                return { valid: false, error: '偷取时必须选择一张物品或预兆。' };
            }
            if (!pending.stealableCardIds.includes(cardId)) {
                return { valid: false, error: '只能偷取防守者当前可被木乃伊夺取的物品或预兆。' };
            }
            if (!resolveMummyStealableCards(core, pending.defenderPlayerId).some((card) => card.id === cardId)) {
                return { valid: false, error: '该木乃伊奖励目标已经不再可偷。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND: {
            const status = resolveHelpingHandsMonsterTurnStatus(core);
            if (!status.active || status.controllerPlayerId !== actor.playerId) {
                return { valid: false, error: '只有当前奇异护符持有人能控制巨魔手移动。' };
            }
            const monster = findHelpingHandsTrollHand(core, command.payload.monsterId);
            if (!monster) {
                return { valid: false, error: '必须选择一个巨魔手。' };
            }
            if (!command.payload.roomId || !resolveHelpingHandsTrollHandMoveOptions(core, monster.id)
                .some((room) => room.id === command.payload.roomId)) {
                return { valid: false, error: '巨魔手只能移动到已发现且真实连接的房间。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK: {
            const status = resolveHelpingHandsMonsterTurnStatus(core);
            if (!status.active || status.controllerPlayerId !== actor.playerId) {
                return { valid: false, error: '只有奇异护符持有人能控制巨魔手攻击。' };
            }
            const options = resolveHelpingHandsTrollHandAttackOptions(core);
            const option = command.payload.combined
                ? options.find((item) => item.combined)
                : options.find((item) => !item.combined && item.trollHandIds[0] === command.payload.monsterId);
            if (!option) {
                return { valid: false, error: command.payload.combined ? '两个巨魔手必须同板块且未行动才能合击。' : '必须选择一个可行动的巨魔手。' };
            }
            if (!command.payload.targetPlayerId || !option.targetPlayerIds.includes(command.payload.targetPlayerId)) {
                return { valid: false, error: '巨魔手只能攻击同板块的存活探索者。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN: {
            const status = resolveHelpingHandsMonsterTurnStatus(core);
            return status.active && status.controllerPlayerId === actor.playerId
                ? { valid: true }
                : { valid: false, error: '只有当前奇异护符持有人能结束巨魔手怪物回合。' };
        }
        case BETRAYAL_COMMANDS.TAKE_PHOTO: {
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            const trait = command.payload.trait ?? 'speed';
            if (!isMagicCameraHaunt(core) || isDead || !isTraitor) {
                return { valid: false, error: '只有魔法相机剧本中的存活叛徒能拍照。' };
            }
            if (!target || target.playerId === actor.playerId) {
                return { valid: false, error: '拍照必须选择一名英雄。' };
            }
            if (!Object.prototype.hasOwnProperty.call(actor.traits, trait)) {
                return { valid: false, error: '拍照成功后必须选择一个有效属性提升。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'take-photo', actor);
            if (actionBudget) {
                return actionBudget;
            }
            if (!canTakeMagicCameraPhoto(core, actor, target.playerId)) {
                return { valid: false, error: '目标英雄没有本质，或不在叛徒同板块/魔法相机视线内。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA:
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'smash-magic-camera', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            if (!canSmashMagicCamera(core, actor)) {
                return { valid: false, error: '必须由同板块的存活英雄砸毁叛徒持有的魔法相机。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK: {
            const monster = findPhantomPhotographer(core, command.payload.monsterId);
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!isMagicCameraHaunt(core) || !monster) {
                return { valid: false, error: '当前没有可行动的幻影摄影师。' };
            }
            if (core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds.includes(monster.id)) {
                return { valid: false, error: '该幻影摄影师已被眩晕，当前不能攻击。' };
            }
            if (!target || target.playerId === core.scenarioRuntime.traitorPlayerId) {
                return { valid: false, error: '幻影摄影师必须选择一名英雄。' };
            }
            if (!resolveMagicCameraPhantomAttackTargets(core, monster).some((explorer) => explorer.playerId === target.playerId)) {
                return { valid: false, error: '目标英雄不在幻影摄影师视线内。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO: {
            if (!isBloodFromStoneHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有第5号作祟《顽石之血》中的存活英雄能玩躲猫猫。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'play-peekaboo', actor);
            if (actionBudget) {
                return actionBudget;
            }
            const selection = resolveBloodFromStonePeekabooSelection(
                core,
                actor,
                command.payload.sameRoomMonsterId,
                command.payload.lineOfSightMonsterId,
            );
            if (!selection.option) {
                return { valid: false, error: selection.reason ?? '当前没有合法的玩躲猫猫目标组合。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT: {
            const uponReflection = core.scenarioRuntime.uponReflection;
            if (!isUponReflectionHaunt(core) || !uponReflection) {
                return { valid: false, error: '当前不是怪异的镜子作祟。' };
            }
            if (actor.playerId !== uponReflection.revealerPlayerId) {
                return { valid: false, error: '只有作祟揭秘者能给出镜中提示。' };
            }
            if (isDead) {
                return { valid: false, error: '死亡探索者不能给出镜中提示。' };
            }
            if (hasUsedMirrorHintThisTurn(core, actor.playerId)) {
                return { valid: false, error: '作祟揭秘者本回合已经给过镜中提示。' };
            }
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!target || core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)) {
                return { valid: false, error: '镜中提示必须交给一名存活玩家。' };
            }
            if (!command.payload.eventName?.trim()) {
                return { valid: false, error: '镜中提示必须选择一张事件牌。' };
            }
            if (core.deckCounts.event <= 0 || core.eventOrder.length === 0) {
                return { valid: false, error: '事件牌堆没有可用于镜中提示的事件牌。' };
            }
            if (!resolveUponReflectionHintEvent(core, command.payload.eventName)) {
                return { valid: false, error: '镜中提示只能选择当前事件牌堆中的事件牌。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE: {
            const uponReflection = core.scenarioRuntime.uponReflection;
            if (!isUponReflectionHaunt(core) || !uponReflection?.secretCombination) {
                return { valid: false, error: '当前不是怪异的镜子作祟，或秘密组合尚未记录。' };
            }
            if (actor.playerId === uponReflection.revealerPlayerId) {
                return { valid: false, error: '作祟揭秘者被困镜中，不能执行破咒。' };
            }
            if (isDead) {
                return { valid: false, error: '死亡探索者不能破咒。' };
            }
            const trait = command.payload.trait;
            if (!trait || !BETRAYAL_TRAIT_KEYS.includes(trait)) {
                return { valid: false, error: '破咒必须选择一个有效属性。' };
            }
            if (!command.payload.omenId && !command.payload.omenName?.trim()) {
                return { valid: false, error: '破咒必须报出自己持有的一张预兆。' };
            }
            const selectedOmen = resolveUponReflectionOmenSelection(actor, command.payload);
            if (!selectedOmen) {
                return { valid: false, error: '破咒只能报出当前行动者持有的预兆。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'break-mirror-curse', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS: {
            if (!isBloodFromStoneHaunt(core) || isDead) {
                return { valid: false, error: '只有第5号作祟《顽石之血》中的存活英雄能补放石像小天使。' };
            }
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            if (plan.pendingPlayerChoiceCount <= 0) {
                return { valid: false, error: '当前没有需要玩家选择房间的石像小天使。' };
            }
            const roomIds = command.payload.roomIds;
            if (!Array.isArray(roomIds) || roomIds.length !== plan.pendingPlayerChoiceCount) {
                return {
                    valid: false,
                    error: `必须选择 ${plan.pendingPlayerChoiceCount} 个房间来补放石像小天使。`,
                };
            }
            const legalRoomIds = new Set(plan.playerChoiceCandidateRoomIds);
            const invalidRoomId = roomIds.find((roomId) => !legalRoomIds.has(roomId));
            if (invalidRoomId) {
                return { valid: false, error: '石像小天使只能补放到屋内已发现房间。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY: {
            const entryId = command.payload.entryId;
            const setupQueue = resolveBetrayalHauntSetupQueue(core);
            const entry = setupQueue.find((candidate) => candidate.id === entryId);
            if (!entryId || !entry) {
                return { valid: false, error: '当前 setup 队列没有这个条目。' };
            }
            if (entry.status === 'resolved') {
                return { valid: false, error: '该 setup 条目已经确认。' };
            }
            if (
                !isDustHaunt(core)
                || (
                    entryId !== 'monster-card-left-of-revealer'
                    && entryId !== 'prepare-research-tokens'
                )
            ) {
                return { valid: false, error: '当前只支持确认灰尘 setup 条目。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
            if (command.payload.target === 'dynamite-room' || isDynamiteCardId(command.payload.weaponCardId)) {
                const dynamiteCard = resolveDynamiteInventoryCard(actor, command.payload.weaponCardId);
                if (command.payload.target !== 'dynamite-room' || !isDynamiteCardId(command.payload.weaponCardId)) {
                    return { valid: false, error: '炸药必须作为攻击使用，并选择当前或相邻板块作为目标。' };
                }
                if (isDead) {
                    return { valid: false, error: '死亡探索者不能使用炸药。' };
                }
                if (!dynamiteCard) {
                    return { valid: false, error: '当前探索者没有可用于攻击的炸药。' };
                }
                if (!core.turnStartInventoryCardIds.includes(dynamiteCard.id)) {
                    return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                }
                if (core.usedCardIdsThisTurn.includes(dynamiteCard.id)) {
                    return { valid: false, error: '这把武器本回合已经使用。' };
                }
                const targetRoomId = command.payload.targetRoomId;
                if (!targetRoomId) {
                    return { valid: false, error: '炸药攻击必须选择当前或相邻板块。' };
                }
                const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
                if (!targetRoom || targetRoom.state !== 'discovered') {
                    return { valid: false, error: '炸药只能选择已发现板块。' };
                }
                if (!isDynamiteTargetRoom(core, actorRoomId, targetRoom.id)) {
                    return { valid: false, error: '炸药只能选择你所在的板块或相邻板块。' };
                }
                return { valid: true };
            }
            if (isDustHaunt(core)) {
                const weaponEffect = command.payload.weaponCardId
                    ? resolveAttackWeaponEffect(actor, command.payload.weaponCardId)
                    : null;
                if (command.payload.weaponCardId) {
                    if (!weaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                const target = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (!target || target.playerId === actor.playerId) {
                    return { valid: false, error: '灰尘剧本必须选择另一名探索者作为攻击目标。' };
                }
                if (core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)) {
                    return { valid: false, error: '不能攻击已经死亡的探索者。' };
                }
                if (!isAttackTargetInWeaponRange(core, actorRoomId, target.roomId, weaponEffect)) {
                    return { valid: false, error: `灰尘剧本只能攻击${formatAttackRangeLabel(weaponEffect)}的探索者。` };
                }
                return { valid: true };
            }
            if (isHelpingHandsHaunt(core)) {
                if (isDead) {
                    return { valid: false, error: '死亡探索者不能在第12号作祟《援手》中攻击。' };
                }
                const weaponEffect = command.payload.weaponCardId
                    ? resolveAttackWeaponEffect(actor, command.payload.weaponCardId)
                    : null;
                if (command.payload.weaponCardId) {
                    if (!weaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                if (command.payload.target === 'troll-hand') {
                    const trollHand = findHelpingHandsTrollHand(core, command.payload.targetMonsterId);
                    if (!trollHand || trollHand.roomId !== actorRoomId) {
                        return { valid: false, error: '必须和巨魔手处于同一房间才能攻击。' };
                    }
                    return { valid: true };
                }
                if (command.payload.target !== 'hero') {
                    return { valid: false, error: '自由混战只能攻击另一名探索者。' };
                }
                const target = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (
                    !target
                    || target.playerId === actor.playerId
                    || core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)
                    || !isAttackTargetInWeaponRange(core, actorRoomId, target.roomId, weaponEffect)
                ) {
                    return {
                        valid: false,
                        error: `自由混战只能攻击${formatAttackRangeLabel(weaponEffect)}的其他存活探索者。`,
                    };
                }
                return { valid: true };
            }
            if (isMagicCameraHaunt(core)) {
                if (command.payload.weaponCardId) {
                    const weaponEffect = resolveAttackWeaponEffect(actor, command.payload.weaponCardId);
                    if (!weaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                if (command.payload.target === 'phantom-photographer') {
                    const monster = findPhantomPhotographer(core, command.payload.targetMonsterId);
                    if (isTraitor || isDead) {
                        return { valid: false, error: '只有存活英雄能攻击幻影摄影师。' };
                    }
                    if (!monster || monster.roomId !== actorRoomId) {
                        return { valid: false, error: '必须和幻影摄影师同板块才能攻击。' };
                    }
                    return { valid: true };
                }
                if (command.payload.target === 'traitor') {
                    const traitor = core.scenarioRuntime.traitorPlayerId
                        ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId)
                        : null;
                    if (isTraitor || isDead || !traitor || traitor.roomId !== actorRoomId) {
                        return { valid: false, error: '只有同板块的存活英雄能攻击叛徒。' };
                    }
                    return { valid: true };
                }
                if (command.payload.target === 'hero') {
                    const target = command.payload.targetPlayerId
                        ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                        : null;
                    if (!isTraitor || isDead || !target) {
                        return { valid: false, error: '只有存活叛徒能攻击指定英雄。' };
                    }
                    if (
                        target.playerId === actor.playerId
                        || target.playerId === core.scenarioRuntime.traitorPlayerId
                        || core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)
                        || target.roomId !== actorRoomId
                    ) {
                        return { valid: false, error: '叛徒只能攻击同板块的存活英雄。' };
                    }
                    return { valid: true };
                }
            }
            {
                const attackWeaponEffect = command.payload.weaponCardId
                    ? resolveAttackWeaponEffect(actor, command.payload.weaponCardId)
                    : null;
                if (command.payload.weaponCardId) {
                    if (!attackWeaponEffect) {
                        return { valid: false, error: '当前探索者没有可用于攻击的这把武器。' };
                    }
                    if (!core.turnStartInventoryCardIds.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '本回合新获得的武器不能立刻使用。' };
                    }
                    if (core.usedCardIdsThisTurn.includes(command.payload.weaponCardId)) {
                        return { valid: false, error: '这把武器本回合已经使用。' };
                    }
                }
                if (command.payload.target === 'traitor') {
                    const traitor = core.scenarioRuntime.traitorPlayerId
                        ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId)
                        : null;
                    if (!traitor || !isAttackTargetInWeaponRange(core, actorRoomId, traitor.roomId, attackWeaponEffect)) {
                        return {
                            valid: false,
                            error: attackWeaponEffect
                                ? `${attackWeaponEffect.card.name}只能攻击${formatAttackRangeLabel(attackWeaponEffect)}的叛徒。`
                                : '必须和叛徒处于同一房间才能攻击。',
                        };
                    }
                }
                if (command.payload.target === 'hero') {
                    const livingHeroesInAttackRange = getAllExplorers(core).filter((explorer) => (
                        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                        && isAttackTargetInWeaponRange(core, actorRoomId, explorer.roomId, attackWeaponEffect)
                    ));
                    if (livingHeroesInAttackRange.length === 0) {
                        return {
                            valid: false,
                            error: `当前${formatAttackRangeLabel(attackWeaponEffect)}没有可攻击的英雄。`,
                        };
                    }
                    if (!command.payload.targetPlayerId) {
                        return { valid: false, error: '必须选择要攻击的英雄。' };
                    }
                    if (
                        command.payload.targetPlayerId
                        && !livingHeroesInAttackRange.some((explorer) => explorer.playerId === command.payload.targetPlayerId)
                    ) {
                        return {
                            valid: false,
                            error: `指定的英雄不在当前${formatAttackRangeLabel(attackWeaponEffect)}。`,
                        };
                    }
                }
            }
            if (command.payload.target === 'traitor' && isTraitor) {
                return { valid: false, error: '叛徒不能攻击自己。' };
            }
            if (command.payload.target === 'jack-spirit' && !core.scenarioRuntime.jackSpiritReleased) {
                return { valid: false, error: '杰克之灵尚未出现。' };
            }
            if (command.payload.target === 'jack-spirit' && actor.roomId !== core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '必须和杰克之灵处于同一房间。' };
            }
            if (command.payload.target === 'hero' && !isTraitor && !isDead) {
                return { valid: false, error: '当前只有叛徒侧可主动攻击英雄。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.SEARCH_FOR_CURE: {
            const trait = command.payload.trait;
            if (!isDustHaunt(core) || isDead) {
                return { valid: false, error: '只有灰尘剧本中的存活探索者能寻找解药。' };
            }
            if (trait !== 'knowledge' && trait !== 'sanity') {
                return { valid: false, error: '寻找解药必须选择知识或神志。' };
            }
            if (!canSearchForCure(core, actor)) {
                return { valid: false, error: '必须在带有恶兆符号且没有研究标记的板块才能寻找解药。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'search-for-cure', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.CURE_THE_DUST: {
            const trait = command.payload.trait;
            if (!isDustHaunt(core) || isDead) {
                return { valid: false, error: '只有灰尘剧本中的存活探索者能尝试治愈灰尘。' };
            }
            if (!trait || !Object.prototype.hasOwnProperty.call(actor.traits, trait)) {
                return { valid: false, error: '治愈灰尘必须选择一个有效属性。' };
            }
            if (!canCureTheDust(core, actor)) {
                return { valid: false, error: '必须在可研究板块或带研究标记的板块才能治愈灰尘。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'cure-the-dust', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE: {
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!isDustHaunt(core) || isDead) {
                return { valid: false, error: '只有灰尘剧本中的存活探索者能请求交换疾病标记。' };
            }
            if (!target || target.playerId === actor.playerId) {
                return { valid: false, error: '必须选择另一名探索者交换疾病标记。' };
            }
            if (core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId) || target.roomId !== actor.roomId) {
                return { valid: false, error: '只能请求同板块的存活探索者交换疾病标记。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'sickness-exchange', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK: {
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能调查杰克。' };
            }
            if (!isBetrayalLibraryRoom(core.rooms.find((room) => room.id === actor.roomId))) {
                return { valid: false, error: '必须在图书馆才能调查杰克。' };
            }
            const livingHeroWithoutKnowledge = getAllExplorers(core).some((explorer) => (
                explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(explorer.playerId)
            ));
            if (!livingHeroWithoutKnowledge) {
                return { valid: false, error: '所有存活英雄都已经掌握杰克线索。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'learn-about-jack', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能研究驱魔法阵。' };
            }
            if (core.rooms.find((room) => room.id === actor.roomId)?.discoveryReward !== 'event') {
                return { valid: false, error: '必须在带有事件标记的房间才能研究驱魔法阵。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'study-exorcism', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            if (isTraitor || isDead) {
                return { valid: false, error: '只有存活英雄能驱魔。' };
            }
            if (!core.scenarioRuntime.jackSpiritReleased || !core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '杰克之灵尚未出现。' };
            }
            if (actor.roomId !== core.scenarioRuntime.jackSpiritRoomId) {
                return { valid: false, error: '必须与杰克之灵处于同一房间。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'exorcise-jack', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME:
            if (!isMummyHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活英雄能寻找木乃伊真名。' };
            }
            if (!isMummyNameStudyRoom(core, actor.roomId)) {
                return { valid: false, error: '必须在石棺房、书房或图书馆才能寻找木乃伊真名。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'study-mummy-name', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT:
            if (!isMummyHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活英雄能学习驱逐法术。' };
            }
            if (!core.scenarioRuntime.mummy?.trueNameFound) {
                return { valid: false, error: '必须先找到木乃伊真名。' };
            }
            if (!hasOmenBook(actor)) {
                return { valid: false, error: '必须由持有书本的英雄学习驱逐法术。' };
            }
            {
                const actionBudget = validateHauntSpecialActionBudget(core, 'learn-mummy-banishment', actor);
                if (actionBudget) {
                    return actionBudget;
                }
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.BANISH_MUMMY: {
            const mummy = findMummyMonster(core);
            if (!isMummyHaunt(core) || isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活英雄能驱逐木乃伊。' };
            }
            if (!core.scenarioRuntime.mummy?.banishmentSpellLearned || core.scenarioRuntime.mummy.knowledgeTokenCount < 2) {
                return { valid: false, error: '必须先取得两枚知识标记并学会驱逐法术。' };
            }
            if (!mummy || actor.roomId !== mummy.roomId) {
                return { valid: false, error: '行动英雄必须与木乃伊处于同一房间。' };
            }
            if (!hasLivingHeroWithBookInRoom(core, mummy.roomId)) {
                return { valid: false, error: '木乃伊所在房间必须有一名存活英雄持有书本。' };
            }
            const actionBudget = validateHauntSpecialActionBudget(core, 'banish-mummy', actor);
            if (actionBudget) {
                return actionBudget;
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL: {
            const mummy = core.scenarioRuntime.mummy;
            if (!isMummyHaunt(core) || !mummy || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活探索者能拾起女孩。' };
            }
            if (mummy.girlHeldByMummy || mummy.girlHolderPlayerId) {
                return { valid: false, error: '女孩已经被持有。' };
            }
            if (!mummy.girlRoomId || actorRoomId !== mummy.girlRoomId) {
                return { valid: false, error: '必须与女孩标记处于同一房间。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY: {
            const mummy = core.scenarioRuntime.mummy;
            const mummyMonster = findMummyMonster(core);
            if (!isMummyHaunt(core) || !mummy || !mummyMonster || !isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活叛徒能把女孩交给木乃伊。' };
            }
            if (mummy.girlHolderPlayerId !== actor.playerId) {
                return { valid: false, error: '必须由当前持有女孩的探索者交给木乃伊。' };
            }
            if (actorRoomId !== mummyMonster.roomId) {
                return { valid: false, error: '必须与木乃伊处于同一房间才能交出女孩。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY: {
            const mummy = core.scenarioRuntime.mummy;
            const mummyMonster = findMummyMonster(core);
            const card = findMummyWeddingOmenCard(actor, command.payload.cardId);
            if (!isMummyHaunt(core) || !mummy || !mummyMonster || !isTraitor || isDead) {
                return { valid: false, error: '只有木乃伊横行剧本中的存活叛徒能把圣符或指环交给木乃伊。' };
            }
            if (!card) {
                return { valid: false, error: '必须持有圣符或指环。' };
            }
            if (mummy.mummyCarriedOmenIds.includes(card.id)) {
                return { valid: false, error: '木乃伊已经携带这张预兆。' };
            }
            if (actorRoomId !== mummyMonster.roomId) {
                return { valid: false, error: '必须与木乃伊处于同一房间才能交出圣符或指环。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知 haunt 命令。' };
    }
}

function validateCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase === 'haunt') {
        return validateHauntAction(state, command);
    }
    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER: {
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            const explorerId = command.payload.explorerId;
            if (!templateByExplorerId(explorerId)) return { valid: false, error: '未知探索者。' };
            const takenByAnother = Object.entries(core.selectedExplorerByPlayerId)
                .some(([playerId, selectedExplorerId]) => playerId !== command.playerId && selectedExplorerId === explorerId);
            return takenByAnother ? { valid: false, error: '该探索者已被选择。' } : { valid: true };
        }
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            return core.selectedExplorerByPlayerId[command.playerId]
                ? { valid: true }
                : { valid: false, error: '请先选择探索者。' };
        case BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            if (!isBetrayalScenarioCardId(command.payload.candidateId)) {
                return { valid: false, error: '未知剧本卡。' };
            }
            return core.scenarioCandidateIds.includes(command.payload.candidateId)
                ? { valid: true }
                : { valid: false, error: '该剧本卡不在本局候选池。' };
        case BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            if (!core.selectedExplorerByPlayerId[command.playerId]) {
                return { valid: false, error: '请先选择探索者。' };
            }
            if (!core.scenarioCandidateIds.includes(core.proposedScenarioCardId)) {
                return { valid: false, error: '当前剧本卡不在本局候选池。' };
            }
            return { valid: true };
        case BETRAYAL_COMMANDS.START_SCENARIO:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
            {
                const missingExplorerPlayerId = core.playerIds.find(
                    (playerId) => !core.selectedExplorerByPlayerId[playerId],
                );
                if (missingExplorerPlayerId) {
                    return { valid: false, error: '每位玩家都需要先选择探索者。' };
                }
                const unconfirmedExplorerPlayerId = core.playerIds.find(
                    (playerId) => !core.readyPlayerIds.includes(playerId),
                );
                if (unconfirmedExplorerPlayerId) {
                    return { valid: false, error: '每位玩家都需要先确认探索者。' };
                }
                const missingConfirmationPlayerId = core.playerIds.find(
                    (playerId) => core.scenarioCardConfirmations[playerId] !== core.proposedScenarioCardId,
                );
                if (missingConfirmationPlayerId) {
                    return { valid: false, error: '请先确认当前剧本卡。' };
                }
                const implementedScenarioId = resolveImplementedScenarioIdForCard(core.proposedScenarioCardId);
                if (!implementedScenarioId) {
                    return { valid: false, error: '这个剧本现在不能开始。' };
                }
                if (command.payload.scenarioId && command.payload.scenarioId !== implementedScenarioId) {
                    return { valid: false, error: '开始剧本与当前剧本卡提议不一致。' };
                }
            }
            if (command.payload.scenarioId && !BETRAYAL_SCENARIO_CONFIGS[command.payload.scenarioId]) {
                return { valid: false, error: '未知剧本。' };
            }
            return Object.keys(core.selectedExplorerByPlayerId).length > 0
                ? { valid: true }
                : { valid: false, error: '至少需要一名玩家选择探索者。' };
        default:
            return validatePreHauntAction(state, command);
    }
}

function executeCommand(state: MatchState<BetrayalCore>, command: BetrayalCommand, random: RandomFn): BetrayalEvent[] {
    const core = state.core;
    const timestamp = command.timestamp ?? Date.now();

    switch (command.type) {
        case BETRAYAL_COMMANDS.SELECT_EXPLORER:
            return [nowEvent(EVENTS.EXPLORER_SELECTED, {
                playerId: command.playerId,
                explorerId: command.payload.explorerId,
            }, timestamp)];
        case BETRAYAL_COMMANDS.CONFIRM_EXPLORER:
            return [nowEvent(EVENTS.EXPLORER_CONFIRMED, { playerId: command.playerId }, timestamp)];
        case BETRAYAL_COMMANDS.PROPOSE_SCENARIO_CARD: {
            const candidate = getBetrayalScenarioCardCandidate(command.payload.candidateId);
            return [nowEvent(EVENTS.SCENARIO_CARD_PROPOSED, {
                playerId: command.playerId,
                candidateId: candidate.id,
                title: candidate.title,
                logText: `玩家 ${command.playerId} 提议剧本卡：${candidate.title}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD: {
            const candidate = getBetrayalScenarioCardCandidate(core.proposedScenarioCardId);
            return [nowEvent(EVENTS.SCENARIO_CARD_CONFIRMED, {
                playerId: command.playerId,
                candidateId: candidate.id,
                title: candidate.title,
                logText: `玩家 ${command.playerId} 确认剧本卡：${candidate.title}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.START_SCENARIO:
            return [nowEvent(EVENTS.SCENARIO_STARTED, {
                playerIds: core.playerIds,
                scenarioId: command.payload.scenarioId
                    ?? resolveImplementedScenarioIdForCard(core.proposedScenarioCardId)
                    ?? core.scenarioId,
            }, timestamp)];
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const room = core.rooms.find((item) => item.id === command.payload.roomId)!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const bloodFromStoneTurnStartVisibleStoneCherubIds = isBloodFromStoneHaunt(core)
                ? resolveBloodFromStoneTurnStartVisibleStoneCherubIds(core, actor.playerId)
                : undefined;
            const bloodFromStoneNewLineOfSightDamageRoll = resolveBloodFromStoneNewLineOfSightDamageRoll(
                core,
                actor.playerId,
                room.id,
                random,
            );
            const isTraitor = core.phase === 'haunt' && core.scenarioRuntime.traitorPlayerId === command.playerId;
            const isDeadTraitorSpiritTurn = shouldDeadTraitorControlJackSpirit(core, actor.playerId);
            const isDeadFeverishTurn = shouldDeadPlayerControlFeverish(core, actor.playerId);
            if (command.payload.useSkeletonKey && canUseSkeletonKeyForMove(core, room.id)) {
                const skeletonKeyCardId = resolveSkeletonKeyCardId(core.currentExplorer)!;
                const skeletonKeyRoll = rollBetrayalPip(random);
                const skeletonKeyBuried = skeletonKeyRoll === 0;
                return [nowEvent(EVENTS.EXPLORER_MOVED, {
                    playerId: command.playerId,
                    roomId: room.id,
                    skeletonKeyCardId,
                    skeletonKeyRoll,
                    skeletonKeyBuried,
                    bloodFromStoneTurnStartVisibleStoneCherubIds,
                    bloodFromStoneNewLineOfSightDamageRoll,
                    logText: `${core.currentExplorer.displayName}使用骨制钥匙穿过墙壁到${room.name}，投出 ${skeletonKeyRoll}${skeletonKeyBuried ? '，骨制钥匙被埋葬' : ''}`,
                }, timestamp)];
            }
            if (
                isTraitor
                && canUseStalkThePrey(core, actor)
                && resolveStalkThePreyTargets(core, actor).some((target) => target.id === room.id)
            ) {
                return [nowEvent(EVENTS.EXPLORER_MOVED, {
                    playerId: command.playerId,
                    roomId: room.id,
                    consumeMove: false,
                    usedActionId: 'stalk-the-prey',
                    bloodFromStoneTurnStartVisibleStoneCherubIds,
                    bloodFromStoneNewLineOfSightDamageRoll,
                    logText: `${actor.displayName}发动“Stalk the Prey”，潜行到了${room.name}`,
                }, timestamp)];
            }
            if (isDeadTraitorSpiritTurn) {
                return [nowEvent(EVENTS.EXPLORER_MOVED, {
                    playerId: command.playerId,
                    roomId: room.id,
                    controlledToken: 'jack-spirit',
                    bloodFromStoneTurnStartVisibleStoneCherubIds,
                    bloodFromStoneNewLineOfSightDamageRoll,
                    logText: `杰克之灵游荡到了${room.name}`,
                }, timestamp)];
            }
            if (isDeadFeverishTurn) {
                return [nowEvent(EVENTS.EXPLORER_MOVED, {
                    playerId: command.playerId,
                    roomId: room.id,
                    controlledToken: 'feverish',
                    bloodFromStoneTurnStartVisibleStoneCherubIds,
                    bloodFromStoneNewLineOfSightDamageRoll,
                    logText: `狂热病患移动到了${room.name}`,
                }, timestamp)];
            }
            return [nowEvent(EVENTS.EXPLORER_MOVED, {
                playerId: command.playerId,
                roomId: room.id,
                moveCost: resolveBetrayalMoveCost(core),
                bloodFromStoneTurnStartVisibleStoneCherubIds,
                bloodFromStoneNewLineOfSightDamageRoll,
                logText: `${core.currentExplorer.displayName}移动到${room.name}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = command.payload.roomId
                ? explorableSlots.find((room) => room.id === command.payload.roomId) ?? explorableSlots[0]!
                : explorableSlots[0]!;
            const placement = resolveRoomPlacementContext(core, nextSlot);
            const roomDraw = resolveRoomDraw(core, nextSlot.floor, {
                useHolySymbol: command.payload.useHolySymbol && canUseHolySymbolForDiscovery(core),
                placement,
            });
            const skippedRoomTemplate = roomDraw.skippedRoomTemplate;
            const roomTemplate = roomDraw.roomTemplate;
            const roomTileAdjustment = roomDraw.resolution.requiresTileAdjustment
                ? command.payload.roomTileAdjustment
                : undefined;
            if (!roomTemplate || (roomDraw.resolution.requiresTileAdjustment && !roomTileAdjustment)) {
                return [];
            }
            const deckKind = resolveRoomTemplateDiscoveryDeckKind(roomTemplate);
            const roomTextResolvedCore = resolveCoreAfterRoomDiscoveryText(core, roomTemplate.discoveryEffect);
            const roomDiscoveryCards = resolveRoomDiscoveryCards(roomTextResolvedCore, roomTemplate.discoveryEffect);
            const roomDiscoveryEffectResolutionSteps = createRoomDiscoveryEffectResolutionSteps(
                roomTemplate.name,
                roomTemplate.discoveryEffect,
            );
            const orientationOptions = resolveRoomPlacementOrientationOptions(
                core,
                roomTemplate,
                placement,
                roomDraw.selectedRoomRequiresOpenFrontier,
            );
            const selectedOrientation = orientationOptions.find((option) => option.orientationTurns === command.payload.orientationTurns)
                ?? orientationOptions[0]
                ?? orientDoorwaysForPlacement(roomTemplate.doorways, placement.entryEdge, command.payload.orientationTurns);
            const holySymbolLogPrefix = skippedRoomTemplate
                ? `${core.currentExplorer.displayName}用圣符埋葬${skippedRoomTemplate.name}，继续发现${roomTemplate.name}；`
                : '';
            const tileAdjustmentLogPrefix = roomTileAdjustment
                ? `${core.currentExplorer.displayName}先调整房间板块后继续探索；`
                : '';
            const roomDiscoveryRewardDetailParts = formatRoomDiscoveryRewardDetailParts(roomTemplate.name, roomDiscoveryCards);
            const roomDiscoveryCardResolutionSteps = createRoomDiscoveryCardResolutionSteps(roomTemplate.name, roomDiscoveryCards);

            if (deckKind === null) {
                const noSymbolDetailParts = [
                    ...roomDiscoveryRewardDetailParts,
                    '没有事件、物品或预兆发现牌',
                ];
                return [nowEvent(EVENTS.ROOM_EXPLORED, {
                    playerId: command.playerId,
                    roomId: nextSlot.id,
                    room: {
                        name: roomTemplate.name,
                        hint: roomTemplate.hint,
                        tags: roomTemplate.tags,
                        discoveryReward: null,
                        visualId: roomTemplate.visualId,
                        doorways: selectedOrientation.doorways,
                        backVisualId: nextSlot.backVisualId,
                        orientationTurns: selectedOrientation.orientationTurns,
                        discoveryEffect: roomTemplate.discoveryEffect,
                        endTurnEffect: roomTemplate.endTurnEffect,
                        enterEffect: roomTemplate.enterEffect,
                    },
                    deckKind,
                    ...roomDiscoveryCards,
                    skippedRoomWithHolySymbol: skippedRoomTemplate
                        ? { name: skippedRoomTemplate.name }
                        : undefined,
                    roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                    roomTileAdjustment,
                    discovery: {
                        kind: 'none',
                        title: roomTemplate.name,
                        summary: roomDiscoveryEffectResolutionSteps.length > 0 || roomDiscoveryCardResolutionSteps.length > 0
                            ? '房间文字已结算'
                            : '无发现符号',
                        detail: noSymbolDetailParts.join('；'),
                        tone: roomDiscoveryEffectResolutionSteps.length > 0 || roomDiscoveryCardResolutionSteps.length > 0
                            ? 'accent'
                            : 'neutral',
                        resolutionSteps: [
                            ...roomDiscoveryEffectResolutionSteps,
                            ...roomDiscoveryCardResolutionSteps,
                        ],
                    },
                    logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，房间没有发现符号`,
                    hauntTriggered: false,
                }, timestamp)];
            }

            if (!hasAvailableDiscoveryDeckCard(core, deckKind)) {
                const emptyDeckDetailParts = [
                    ...roomDiscoveryRewardDetailParts,
                    `${DECK_KIND_LABEL[deckKind]}牌堆已空，没有抽取发现牌`,
                ];
                return [nowEvent(EVENTS.ROOM_EXPLORED, {
                    playerId: command.playerId,
                    roomId: nextSlot.id,
                    room: {
                        name: roomTemplate.name,
                        hint: roomTemplate.hint,
                        tags: roomTemplate.tags,
                        discoveryReward: deckKind,
                        visualId: roomTemplate.visualId,
                        doorways: selectedOrientation.doorways,
                        backVisualId: nextSlot.backVisualId,
                        orientationTurns: selectedOrientation.orientationTurns,
                        discoveryEffect: roomTemplate.discoveryEffect,
                        endTurnEffect: roomTemplate.endTurnEffect,
                        enterEffect: roomTemplate.enterEffect,
                    },
                    deckKind,
                    ...roomDiscoveryCards,
                    skippedRoomWithHolySymbol: skippedRoomTemplate
                        ? { name: skippedRoomTemplate.name }
                        : undefined,
                    roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                    roomTileAdjustment,
                    discovery: {
                        kind: deckKind,
                        title: `${DECK_KIND_LABEL[deckKind]}符号`,
                        summary: '牌堆已空',
                        detail: emptyDeckDetailParts.join('；'),
                        tone: 'neutral',
                        resolutionSteps: [
                            ...roomDiscoveryEffectResolutionSteps,
                            ...roomDiscoveryCardResolutionSteps,
                        ],
                    },
                    logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，${DECK_KIND_LABEL[deckKind]}牌堆已空`,
                    hauntTriggered: false,
                }, timestamp)];
            }

            if (deckKind === 'event') {
                if (shouldSkipEventSymbolForUponReflection(core)) {
                    return [nowEvent(EVENTS.ROOM_EXPLORED, {
                        playerId: command.playerId,
                        roomId: nextSlot.id,
                        room: {
                            name: roomTemplate.name,
                            hint: roomTemplate.hint,
                            tags: roomTemplate.tags,
                            discoveryReward: deckKind,
                            visualId: roomTemplate.visualId,
                            doorways: selectedOrientation.doorways,
                            backVisualId: nextSlot.backVisualId,
                            orientationTurns: selectedOrientation.orientationTurns,
                            discoveryEffect: roomTemplate.discoveryEffect,
                            endTurnEffect: roomTemplate.endTurnEffect,
                            enterEffect: roomTemplate.enterEffect,
                        },
                        deckKind,
                        ...roomDiscoveryCards,
                        skippedEventWithUponReflection: true,
                        skippedRoomWithHolySymbol: skippedRoomTemplate
                            ? { name: skippedRoomTemplate.name }
                            : undefined,
                        roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                        roomTileAdjustment,
                        discovery: {
                            kind: deckKind,
                            title: '事件符号',
                            summary: '镜中沉默',
                            detail: '7 号作祟中不抽取或结算事件卡，且探索事件符号房间不会结束回合',
                            tone: 'accent',
                        },
                        logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，镜中沉默使事件符号无事发生`,
                        hauntTriggered: false,
                    }, timestamp)];
                }
                if (command.payload.ignoreEventSymbolWithTraitorPower && canUseBetrayalTraitorPowers(core, command.playerId)) {
                    return [nowEvent(EVENTS.ROOM_EXPLORED, {
                        playerId: command.playerId,
                        roomId: nextSlot.id,
                        room: {
                            name: roomTemplate.name,
                            hint: roomTemplate.hint,
                            tags: roomTemplate.tags,
                            discoveryReward: deckKind,
                            visualId: roomTemplate.visualId,
                            doorways: selectedOrientation.doorways,
                            backVisualId: nextSlot.backVisualId,
                            orientationTurns: selectedOrientation.orientationTurns,
                            discoveryEffect: roomTemplate.discoveryEffect,
                            endTurnEffect: roomTemplate.endTurnEffect,
                            enterEffect: roomTemplate.enterEffect,
                        },
                        deckKind,
                        ...roomDiscoveryCards,
                        skippedEventWithTraitorPower: true,
                        skippedRoomWithHolySymbol: skippedRoomTemplate
                            ? { name: skippedRoomTemplate.name }
                            : undefined,
                        roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                        roomTileAdjustment,
                        discovery: {
                            kind: deckKind,
                            title: '跳过事件',
                            summary: '跳过事件',
                            detail: '没有抽取或结算事件卡',
                            tone: 'accent',
                        },
                        logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，叛徒跳过了事件`,
                        hauntTriggered: false,
                    }, timestamp)];
                }
                const eventCard = resolveEvent(core);
                if (command.payload.useIdol && canUseIdolToSkipEvent(core)) {
                    return [nowEvent(EVENTS.ROOM_EXPLORED, {
                        playerId: command.playerId,
                        roomId: nextSlot.id,
                        room: {
                            name: roomTemplate.name,
                            hint: roomTemplate.hint,
                            tags: roomTemplate.tags,
                            discoveryReward: deckKind,
                            visualId: roomTemplate.visualId,
                            doorways: selectedOrientation.doorways,
                            backVisualId: nextSlot.backVisualId,
                            orientationTurns: selectedOrientation.orientationTurns,
                            discoveryEffect: roomTemplate.discoveryEffect,
                            endTurnEffect: roomTemplate.endTurnEffect,
                            enterEffect: roomTemplate.enterEffect,
                        },
                        deckKind,
                        ...roomDiscoveryCards,
                        skippedEventWithIdol: { name: eventCard.name },
                        skippedRoomWithHolySymbol: skippedRoomTemplate
                            ? { name: skippedRoomTemplate.name }
                            : undefined,
                        roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                        roomTileAdjustment,
                        discovery: {
                            kind: deckKind,
                            title: eventCard.name,
                            summary: '已用雕像跳过',
                            detail: '没有抽取或结算事件卡',
                            tone: 'accent',
                        },
                        logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，使用雕像跳过了事件：${eventCard.name}`,
                        hauntTriggered: false,
                    }, timestamp)];
                }
                const eventSymbolSkipChoice = createEventSymbolSkipChoice(
                    core,
                    command.playerId,
                    nextSlot.id,
                    roomTemplate.name,
                    timestamp,
                );
                if (eventSymbolSkipChoice) {
                    return [nowEvent(EVENTS.ROOM_EXPLORED, {
                        playerId: command.playerId,
                        roomId: nextSlot.id,
                        room: {
                            name: roomTemplate.name,
                            hint: roomTemplate.hint,
                            tags: roomTemplate.tags,
                            discoveryReward: deckKind,
                            visualId: roomTemplate.visualId,
                            doorways: selectedOrientation.doorways,
                            backVisualId: nextSlot.backVisualId,
                            orientationTurns: selectedOrientation.orientationTurns,
                            discoveryEffect: roomTemplate.discoveryEffect,
                            endTurnEffect: roomTemplate.endTurnEffect,
                            enterEffect: roomTemplate.enterEffect,
                        },
                        deckKind,
                        ...roomDiscoveryCards,
                        skippedRoomWithHolySymbol: skippedRoomTemplate
                            ? { name: skippedRoomTemplate.name }
                            : undefined,
                        roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                        roomTileAdjustment,
                        discovery: {
                            kind: deckKind,
                            title: '事件符号',
                            summary: '等待选择是否跳过事件',
                            detail: `${roomTemplate.name}带有事件符号；可选择跳过事件或继续抽取事件牌`,
                            tone: 'accent',
                            resolutionSteps: [
                                ...roomDiscoveryEffectResolutionSteps,
                                ...roomDiscoveryCardResolutionSteps,
                            ],
                        },
                        nextPendingEventChoice: eventSymbolSkipChoice,
                        logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，发现事件符号，等待选择是否跳过事件`,
                        hauntTriggered: false,
                    }, timestamp)];
                }
                if (eventCard.roll) {
                return [nowEvent(EVENTS.ROOM_EXPLORED, {
                    playerId: command.playerId,
                    roomId: nextSlot.id,
                    room: {
                        name: roomTemplate.name,
                        hint: roomTemplate.hint,
                        tags: roomTemplate.tags,
                        discoveryReward: deckKind,
                        visualId: roomTemplate.visualId,
                        doorways: selectedOrientation.doorways,
                        backVisualId: nextSlot.backVisualId,
                        orientationTurns: selectedOrientation.orientationTurns,
                        discoveryEffect: roomTemplate.discoveryEffect,
                        endTurnEffect: roomTemplate.endTurnEffect,
                        enterEffect: roomTemplate.enterEffect,
                    },
                    deckKind,
                    eventDescription: eventCard.description,
                    eventRollPending: eventCard.roll
                        ? {
                            kind: eventCard.roll.kind,
                            trait: eventCard.roll.kind === 'dice' ? undefined : eventCard.roll.trait,
                            dice: eventCard.roll.kind === 'dice' ? eventCard.roll.dice : undefined,
                            label: eventCard.roll.kind === 'dice' ? eventCard.roll.label : undefined,
                        }
                        : undefined,
                    roomDiscoveryCards: roomDiscoveryCards.roomDiscoveryCards,
                    buriedRoomDiscoveryCards: roomDiscoveryCards.buriedRoomDiscoveryCards,
                    skippedRoomWithHolySymbol: skippedRoomTemplate
                        ? { name: skippedRoomTemplate.name }
                        : undefined,
                    roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                    roomTileAdjustment,
                    discovery: {
                        kind: deckKind,
                        title: eventCard.name,
                        summary: '事件牌已公开，等待投掷',
                        detail: eventCard.description ?? '请按事件牌要求投掷。',
                        tone: 'accent',
                        resolutionSteps: [
                            ...roomDiscoveryEffectResolutionSteps,
                        ],
                    },
                    logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，公开事件：${eventCard.name}，等待投掷`,
                    hauntTriggered: false,
                }, timestamp)];
                }
                const eventRollKind = eventCard.roll?.kind ?? 'trait';
                const eventRollResult = eventCard.roll
                    ? eventRollKind === 'dice'
                        ? rollEventFixedDice(random, eventCard.roll.dice)
                        : rollEventTraitCheckWithDice(random, roomTextResolvedCore.currentExplorer, eventCard.roll.trait, roomTextResolvedCore)
                    : null;
                const eventRollTotal = eventRollResult?.total ?? null;
                const eventBranch = eventCard.roll && eventRollTotal !== null
                    ? resolveEventBranch(eventCard.roll.branches, eventRollTotal)
                    : null;
                const eventEffect = eventBranch?.effect ?? eventCard.effect;
                if (!eventEffect) {
                    throw new Error(`event ${eventCard.name} has no resolvable effect`);
                }
                const deferEventRollEffectRandomResults = Boolean(eventCard.roll && eventRollTotal !== null && eventBranch);
                const materializedEventEffect = materializeEventEffect(
                    eventEffect,
                    random,
                    roomTextResolvedCore.currentExplorer,
                    roomTextResolvedCore,
                    { materializeRandomResults: !deferEventRollEffectRandomResults },
                );
                const deathPrevention = deferEventRollEffectRandomResults
                    ? undefined
                    : resolveEventDamageDeathPrevention(roomTextResolvedCore, materializedEventEffect, random);
                const effectLabel = formatEffectLabel(materializedEventEffect);
                const eventRollLabel = eventCard.roll
                    ? eventRollKind === 'dice'
                        ? eventCard.roll.label
                        : `${TRAIT_LABEL[eventCard.roll.trait]}检定`
                    : undefined;
                const rollLabel = eventCard.roll && eventRollTotal !== null && eventBranch
                    ? `${eventRollLabel} ${eventRollTotal}：${eventBranch.label}`
                    : undefined;
                const eventEffectResolutionText = rollLabel ? `${rollLabel}；${effectLabel}` : effectLabel;
                const eventEffectResolutionSteps: BetrayalDiscoveryResolutionStep[] = eventEffectNeedsPendingEventChoice(materializedEventEffect)
                    ? []
                    : [{
                        id: `event-effect-${eventCard.name}`,
                        kind: 'event-effect',
                        text: `事件效果：${eventEffectResolutionText}`,
                        deckKind: 'event',
                    }];
                const discoveryResolutionSteps = [
                    ...roomDiscoveryEffectResolutionSteps,
                    ...eventEffectResolutionSteps,
                ];
                return [nowEvent(EVENTS.ROOM_EXPLORED, {
                    playerId: command.playerId,
                    roomId: nextSlot.id,
                    room: {
                        name: roomTemplate.name,
                        hint: roomTemplate.hint,
                        tags: roomTemplate.tags,
                        discoveryReward: deckKind,
                        visualId: roomTemplate.visualId,
                        doorways: selectedOrientation.doorways,
                        backVisualId: nextSlot.backVisualId,
                        orientationTurns: selectedOrientation.orientationTurns,
                        discoveryEffect: roomTemplate.discoveryEffect,
                        endTurnEffect: roomTemplate.endTurnEffect,
                        enterEffect: roomTemplate.enterEffect,
                    },
                    deckKind,
                    ...roomDiscoveryCards,
                    eventEffect: materializedEventEffect,
                    eventDescription: eventCard.description,
                    deathPrevention,
                    eventRoll: eventCard.roll && eventRollTotal !== null && eventBranch
                        ? {
                            kind: eventRollKind,
                            trait: eventRollKind === 'dice' ? undefined : eventCard.roll.trait,
                            total: eventRollTotal,
                            label: eventBranch.label,
                            eventDescription: eventCard.description,
                            rollLabel: eventRollLabel,
                            dice: eventRollResult?.dice,
                            passiveBonus: eventRollResult?.passiveBonus,
                            branchThresholds: eventCard.roll.branches.map((branch) => ({
                                min: branch.min,
                                label: branch.label,
                                effect: { ...branch.effect },
                            })),
                        }
                        : undefined,
                    skippedRoomWithHolySymbol: skippedRoomTemplate
                        ? { name: skippedRoomTemplate.name }
                        : undefined,
                    roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                    roomTileAdjustment,
                    discovery: {
                        kind: deckKind,
                        title: eventCard.name,
                        summary: '即时生效',
                        detail: eventEffectResolutionText,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                        resolutionSteps: discoveryResolutionSteps,
                    },
                    logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，事件：${eventCard.name}（${rollLabel ? `${rollLabel}，` : ''}${effectLabel}）`,
                    hauntTriggered: false,
                }, timestamp)];
            }
            if (core.pendingEventRollStart) {
                throw new Error('event roll must be started by ROLL_EVENT');
            }

            const roomDiscoveryItemDrawCount = (roomDiscoveryCards.roomDiscoveryCards?.length ?? 0)
                + (roomDiscoveryCards.buriedRoomDiscoveryCards?.length ?? 0);
            const fallbackDrawnCard = createDrawnCard(core, deckKind, {
                additionalDrawnCount: deckKind === 'item' ? roomDiscoveryItemDrawCount : 0,
            });
            const mummyForcedOmenDraw = deckKind === 'omen'
                ? resolveMummyForcedOmenDraw(roomTextResolvedCore, roomTextResolvedCore.currentExplorer, fallbackDrawnCard, random)
                : { drawnCard: fallbackDrawnCard };
            const drawnCard = mummyForcedOmenDraw.drawnCard;
            const regularDrawnCard = drawnCard;
            const drawnCardEffect = resolveUseEffect(drawnCard);
            const hauntRoll = resolveHauntRoll(roomTextResolvedCore, deckKind, random);
            const hauntRevealResolution = hauntRoll?.triggered
                ? resolveHauntRevealResolutionForTrigger(core, drawnCard)
                : undefined;
            const roomDiscoveryRewardNames = getRoomDiscoveryRewardNames(roomDiscoveryCards);
            const drawnCardBaseDetail = drawnCardEffect ? formatEffectLabel(drawnCardEffect) : '按卡面规则持有';
            const mummyForcedOmenDetail = mummyForcedOmenDraw.forcedOmenSearch
                ? mummyForcedOmenDraw.forcedOmenSearch.role === 'hero-book'
                    ? '木乃伊横行：英雄首次需要预兆时，从预兆堆找出书本并洗牌'
                    : '木乃伊横行：叛徒首次需要预兆时，从预兆堆找出圣符或指环并洗牌'
                : null;
            const drawnCardDetailParts = [
                ...roomDiscoveryRewardDetailParts,
                mummyForcedOmenDetail,
                drawnCardBaseDetail,
                hauntRoll ? formatHauntRollDiscoveryDetail(hauntRoll) : null,
            ].filter((part): part is string => Boolean(part));
            const drawnCardDetail = drawnCardDetailParts.join('；');
            const discoveryResolutionSteps: BetrayalDiscoveryResolutionStep[] = [
                ...roomDiscoveryEffectResolutionSteps,
                ...roomDiscoveryCardResolutionSteps,
                {
                    id: `drawn-card-${drawnCard.id}`,
                    kind: 'drawn-card' as const,
                    text: `已加入持有区：${drawnCard.name}${drawnCardBaseDetail ? `（${drawnCardBaseDetail}）` : ''}`,
                    deckKind,
                    cardId: drawnCard.id,
                },
                ...(hauntRoll
                    ? [{
                        id: `haunt-roll-${drawnCard.id}`,
                        kind: 'haunt-roll' as const,
                        text: formatHauntRollDiscoveryDetail(hauntRoll),
                        deckKind,
                        cardId: drawnCard.id,
                    }]
                    : []),
            ];
            const gainedCardNames = [...roomDiscoveryRewardNames.gained, drawnCard.name];
            return [nowEvent(EVENTS.ROOM_EXPLORED, {
                playerId: command.playerId,
                roomId: nextSlot.id,
                room: {
                    name: roomTemplate.name,
                    hint: roomTemplate.hint,
                    tags: roomTemplate.tags,
                    discoveryReward: deckKind,
                    visualId: roomTemplate.visualId,
                    doorways: selectedOrientation.doorways,
                    backVisualId: nextSlot.backVisualId,
                    orientationTurns: selectedOrientation.orientationTurns,
                    discoveryEffect: roomTemplate.discoveryEffect,
                    endTurnEffect: roomTemplate.endTurnEffect,
                    enterEffect: roomTemplate.enterEffect,
                },
                deckKind,
                ...roomDiscoveryCards,
                drawnCard: regularDrawnCard,
                skippedRoomWithHolySymbol: skippedRoomTemplate
                    ? { name: skippedRoomTemplate.name }
                    : undefined,
                roomDrawResolution: cloneRoomDrawResolution(roomDraw.resolution),
                roomTileAdjustment,
                discovery: {
                    kind: deckKind,
                    title: drawnCard.name,
                    summary: '已加入持有区',
                    detail: drawnCardDetail,
                    tone: 'accent',
                    resolutionSteps: discoveryResolutionSteps,
                },
                logText: `${holySymbolLogPrefix}${tileAdjustmentLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，拿到了${gainedCardNames.join('、')}`,
                mummyForcedOmenSearch: mummyForcedOmenDraw.forcedOmenSearch,
                hauntRoll: hauntRoll ?? undefined,
                hauntTriggered: hauntRoll?.triggered ?? false,
                hauntRevealResolution,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.ROLL_EVENT: {
            const pending = core.pendingEventRollStart;
            if (!pending) {
                return [];
            }
            const eventCard = resolveEvent(core);
            const resolution = resolveEventRollResolution(core, eventCard, random);
            const rollId = `${command.playerId}-${pending.sourceTitle}-${timestamp}`;
            return [nowEvent(EVENTS.EVENT_ROLLED, {
                rollId,
                playerId: command.playerId,
                sourceTitle: pending.sourceTitle,
                eventDescription: pending.eventDescription,
                eventEffect: cloneUseEffect(resolution.eventEffect),
                deathPrevention: resolution.deathPrevention
                    ? {
                        ...resolution.deathPrevention,
                        dice: [...resolution.deathPrevention.dice],
                        damageTraits: [...resolution.deathPrevention.damageTraits],
                        traitsBeforeDamage: { ...resolution.deathPrevention.traitsBeforeDamage },
                    }
                    : undefined,
                eventRoll: {
                    ...resolution.eventRoll,
                    branchThresholds: resolution.eventRoll.branchThresholds?.map((branch) => ({
                        ...branch,
                        effect: cloneUseEffect(branch.effect),
                    })),
                },
                nextPendingEventChoice: resolution.nextPendingEventChoice
                    ? clonePendingEventChoice(resolution.nextPendingEventChoice)
                    : undefined,
                discovery: {
                    kind: 'event',
                    title: pending.sourceTitle,
                    summary: '结果已公开',
                    detail: resolution.resolutionText,
                    tone: isWarningEventEffect(resolution.eventEffect) ? 'warning' : 'accent',
                    resolutionSteps: [{
                        id: `event-effect-${pending.sourceTitle}`,
                        kind: 'event-effect',
                        text: `事件效果：${resolution.resolutionText}`,
                        deckKind: 'event',
                    }],
                },
                drawnEventCardNameToBury: eventCard.name,
                logText: `${core.currentExplorer.displayName}投掷事件：${pending.sourceTitle}（${resolution.resolutionText}）`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION: {
            const pendingResolution = (core.pendingCardResolutionQueue ?? [])[0];
            if (!pendingResolution) {
                return [];
            }
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const requiredPlayerIds = resolvePendingCardResolutionRequiredPlayerIds(pendingResolution);
            const acknowledgedPlayerIds = Array.from(new Set([
                ...resolvePendingCardResolutionAcknowledgedPlayerIds(pendingResolution),
                command.playerId,
            ]));
            const isComplete = isPendingCardResolutionFullyAcknowledged(
                core,
                pendingResolution,
                acknowledgedPlayerIds,
            );
            return [nowEvent(EVENTS.CARD_RESOLUTION_ACKNOWLEDGED, {
                playerId: command.playerId,
                resolution: clonePendingCardResolution({
                    ...pendingResolution,
                    requiredPlayerIds,
                    acknowledgedPlayerIds,
                }),
                remainingCount: Math.max(
                    0,
                    (core.pendingCardResolutionQueue ?? []).length - (isComplete ? 1 : 0),
                ),
                acknowledgedPlayerIds,
                remainingAcknowledgementCount: Math.max(
                    0,
                    requiredPlayerIds.length - acknowledgedPlayerIds.length,
                ),
                logText: `${actor.displayName}确认${pendingResolution.cardName}（${acknowledgedPlayerIds.length}/${requiredPlayerIds.length}）：${pendingResolution.text}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL: {
            const recentRoll = resolveAcknowledgeableRecentRoll(core);
            if (!recentRoll) {
                return [];
            }
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const requiredPlayerIds = resolveRecentRollRequiredPlayerIds(core, recentRoll);
            const acknowledgedPlayerIds = Array.from(new Set([
                ...resolveRecentRollAcknowledgedPlayerIds(recentRoll),
                command.playerId,
            ]));
            const isFullyAcknowledged = isRecentRollFullyAcknowledged(
                core,
                recentRoll,
                acknowledgedPlayerIds,
            );
            return [nowEvent(EVENTS.RECENT_ROLL_ACKNOWLEDGED, {
                playerId: command.playerId,
                rollId: recentRoll.id,
                sourceTitle: recentRoll.sourceTitle,
                requiredPlayerIds,
                acknowledgedPlayerIds,
                remainingAcknowledgementCount: Math.max(0, requiredPlayerIds.length - acknowledgedPlayerIds.length),
                isFullyAcknowledged,
                logText: `${actor.displayName}确认${recentRoll.sourceTitle}投骰结果（${acknowledgedPlayerIds.length}/${requiredPlayerIds.length}）`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL: {
            const pending = core.pendingEventRollResolution!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const requiredPlayerIds = resolvePendingEventRollResolutionRequiredPlayerIds(core, pending);
            const acknowledgedPlayerIds = Array.from(new Set([
                ...resolvePendingEventRollResolutionAcknowledgedPlayerIds(pending),
                command.playerId,
            ]));
            const isFullyAcknowledged = isPendingEventRollResolutionFullyAcknowledged(
                core,
                pending,
                acknowledgedPlayerIds,
            );
            const shouldResolveFinalEffect = isFullyAcknowledged && !pending.nextPendingEventChoice;
            const finalEffect = shouldResolveFinalEffect
                ? materializeEventEffect(pending.effect, random, core.currentExplorer, core)
                : cloneUseEffect(pending.effect);
            const finalDeathPrevention = shouldResolveFinalEffect
                ? resolveEventDamageDeathPrevention(core, finalEffect, random)
                : pending.deathPrevention;
            return [nowEvent(EVENTS.EVENT_ROLL_FINALIZED, {
                rollId: pending.rollId,
                playerId: command.playerId,
                triggerPlayerId: pending.playerId,
                sourceTitle: pending.sourceTitle,
                requiredPlayerIds,
                acknowledgedPlayerIds,
                remainingAcknowledgementCount: Math.max(0, requiredPlayerIds.length - acknowledgedPlayerIds.length),
                isFullyAcknowledged,
                effect: cloneUseEffect(finalEffect),
                nextPendingEventChoice: pending.nextPendingEventChoice
                    ? clonePendingEventChoice(pending.nextPendingEventChoice)
                    : undefined,
                deathPrevention: finalDeathPrevention
                    ? {
                        ...finalDeathPrevention,
                        dice: [...finalDeathPrevention.dice],
                        damageTraits: [...finalDeathPrevention.damageTraits],
                        traitsBeforeDamage: { ...finalDeathPrevention.traitsBeforeDamage },
                    }
                    : undefined,
                hauntTriggered: pending.hauntTriggered,
                hauntCardNumber: pending.hauntCardNumber,
                hauntTriggerLabel: pending.hauntTriggerLabel,
                hauntTraitorPlayerId: pending.hauntTraitorPlayerId,
                hauntRevealResolution: pending.hauntRevealResolution
                    ? { ...pending.hauntRevealResolution }
                    : undefined,
                hauntTraitorResolution: pending.hauntTraitorResolution
                    ? cloneHauntTraitorResolution(pending.hauntTraitorResolution) ?? undefined
                    : undefined,
                dustSetup: pending.dustSetup ? cloneDustRuntimeState(pending.dustSetup) : undefined,
                magicCameraSetup: pending.magicCameraSetup
                    ? cloneMagicCameraRuntimeState(pending.magicCameraSetup)
                    : undefined,
                helpingHandsSetup: pending.helpingHandsSetup
                    ? cloneHelpingHandsRuntimeState(pending.helpingHandsSetup)
                    : undefined,
                uponReflectionSetup: pending.uponReflectionSetup
                    ? cloneUponReflectionRuntimeState(pending.uponReflectionSetup)
                    : undefined,
                hauntRoll: pending.hauntRoll ? { ...pending.hauntRoll } : undefined,
                logText: `${actor.displayName}确认${pending.sourceTitle}的最终投骰结果（${acknowledgedPlayerIds.length}/${requiredPlayerIds.length}）`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            const eventPayload = resolveBetrayalPossessionUsedPayload(core, command.playerId, command.payload, {
                createEventRollReplacement: (cardId) => createBookPendingEventRollReplacement(
                    core,
                    command.playerId,
                    cardId,
                    random,
                    timestamp,
                ),
            });
            return eventPayload ? [nowEvent(EVENTS.POSSESSION_USED, eventPayload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
        case BETRAYAL_COMMANDS.USE_ROLL_REROLL_ITEM: {
            const card = command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT
                ? resolveRabbitFootCard(core, command.payload.cardId, command.playerId)!
                : resolveRecentRollRerollItemCard(core, command.payload.cardId, command.playerId)!;
            const rule = resolveRecentRollRerollItemRule(card.id)!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const dieIndex = command.payload.dieIndex ?? 0;
            const dieIndices = core.recentRoll
                ? resolveRecentRollRerollCommandDieIndices(core.recentRoll, card.id, dieIndex)
                : [];
            const previousPips = dieIndices.map((index) => core.recentRoll?.dice[index] ?? 0);
            const newPips = dieIndices.map(() => rollBetrayalPip(random));
            const nextDice = core.recentRoll ? [...core.recentRoll.dice] : [];
            dieIndices.forEach((index, valueIndex) => {
                nextDice[index] = newPips[valueIndex] ?? nextDice[index] ?? 0;
            });
            const nextEventBranch = core.recentRoll
                && (core.recentRoll.kind === 'eventTraitCheck' || core.recentRoll.kind === 'eventDiceRoll')
                && core.recentRoll.branchThresholds
                ? resolveEventBranch(core.recentRoll.branchThresholds, nextDice.reduce((sum, pip) => sum + pip, 0) + core.recentRoll.passiveBonus)
                : null;
            const rerollTargetsPendingEventRoll = core.pendingEventRollResolution?.rollId === core.recentRoll?.id;
            const eventRerollEffect = nextEventBranch
                ? materializeEventEffect(
                    nextEventBranch.effect,
                    random,
                    core.currentExplorer,
                    core,
                    { materializeRandomResults: !rerollTargetsPendingEventRoll },
                )
                : undefined;
            const pendingHauntRoll = rerollTargetsPendingEventRoll
                ? core.pendingEventRollResolution.hauntRoll
                : undefined;
            const rerolledEventTotal = nextDice.reduce((sum, pip) => sum + pip, 0)
                + (core.recentRoll?.passiveBonus ?? 0);
            const rerollHauntTriggered = pendingHauntRoll
                ? rerolledEventTotal >= pendingHauntRoll.threshold
                : false;
            const rerollHauntRevealResolution = rerollHauntTriggered
                ? resolveHauntRevealResolutionForTrigger(
                    core,
                    { id: null, name: pendingHauntRoll?.successHauntTriggerLabel ?? core.recentRoll?.sourceTitle },
                    pendingHauntRoll?.successHauntId,
                )
                : undefined;
            const rerollHauntTraitorResolution = rerollHauntTriggered && rerollHauntRevealResolution
                ? resolveHauntTraitorResolutionForTrigger(
                    core,
                    rerollHauntRevealResolution.hauntCardNumber,
                    command.playerId,
                    {
                        eventSelection: pendingHauntRoll?.successTraitorSelection,
                        revealRepresentativeOnly: rerollHauntRevealResolution.representativeOnly,
                    },
                )
                : undefined;
            const eventRerollHaunt = pendingHauntRoll
                ? {
                    hauntTriggered: rerollHauntTriggered,
                    hauntCardNumber: rerollHauntTriggered ? pendingHauntRoll.successHauntId : undefined,
                    hauntTriggerLabel: rerollHauntTriggered
                        ? pendingHauntRoll.successHauntTriggerLabel ?? core.recentRoll?.sourceTitle
                        : undefined,
                    hauntTraitorPlayerId: rerollHauntTraitorResolution?.traitorPlayerId,
                    hauntRevealResolution: rerollHauntRevealResolution,
                    hauntTraitorResolution: rerollHauntTraitorResolution,
                    dustSetup: rerollHauntTriggered && pendingHauntRoll.successHauntId === 3
                        ? createDustRuntimeState(core, random)
                        : undefined,
                    uponReflectionSetup: rerollHauntTriggered && pendingHauntRoll.successHauntId === 7
                        ? createUponReflectionRuntimeState(core, command.playerId, random)
                        : undefined,
                }
                : undefined;
            const rerollSummary = rule.mode === 'single-die'
                ? `第 ${dieIndex + 1} 颗骰子：${previousPips[0] ?? 0} → ${newPips[0] ?? 0}`
                : `${dieIndices.length} 颗骰子：${previousPips.join('/')} → ${newPips.join('/')}`;
            const mentalDamageAfterReroll = rule.mode === 'blank-trait-check-dice'
                ? newPips.filter((pip) => pip === 0).length
                : 0;
            const mentalDamageSummary = mentalDamageAfterReroll > 0
                ? `；重投后仍有 ${mentalDamageAfterReroll} 个空白，承受 ${mentalDamageAfterReroll} 点精神伤害`
                : '';
            return [nowEvent(EVENTS.RABBIT_FOOT_USED, {
                playerId: command.playerId,
                cardId: card.id,
                cardName: rule.label,
                dieIndex: dieIndices[0] ?? dieIndex,
                newPip: newPips[0] ?? 0,
                dieIndices,
                newPips,
                mentalDamageAfterReroll: mentalDamageAfterReroll || undefined,
                eventRerollEffect,
                eventRerollDeathPrevention: eventRerollEffect && !rerollTargetsPendingEventRoll
                    ? resolveEventDamageDeathPrevention(core, eventRerollEffect, random)
                    : undefined,
                eventRerollHaunt,
                logText: `${actor.displayName}使用${rule.label}重掷${rerollSummary}${mentalDamageSummary}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE: {
            const pending = core.pendingEventChoice!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            if (pending.itemResolution === 'tooth-necklace-end-turn' && pending.deferredTurnEnd) {
                const accepted = command.payload.accept !== false;
                const trait = accepted ? command.payload.trait : undefined;
                const traitLabel = trait ? TRAIT_LABEL[trait] : '';
                return [nowEvent(EVENTS.TOOTH_NECKLACE_TRAIT_GAINED, {
                    playerId: command.playerId,
                    cardId: pending.itemCardId ?? TOOTH_NECKLACE_CARD_ID,
                    cardName: pending.sourceTitle,
                    accepted,
                    trait,
                    deferredTurnEnd: cloneTurnEndedPayload(pending.deferredTurnEnd),
                    logText: accepted && trait
                        ? `${actor.displayName}使用${pending.sourceTitle}，${traitLabel}从濒死提升 1 步`
                        : `${actor.displayName}跳过${pending.sourceTitle}的回合结束属性提升`,
                }, timestamp)];
            }
            if (pending.sourceKind === 'event-symbol-skip' && pending.eventSymbolSkip) {
                const accepted = command.payload.accept !== false;
                const sourceMethod = pending.eventSymbolSkip.method;
                if (accepted) {
                    const summary = sourceMethod === 'idol'
                        ? '已用雕像跳过'
                        : '跳过事件';
                    const logText = sourceMethod === 'idol'
                        ? `${actor.displayName}使用雕像跳过了事件`
                        : `${actor.displayName}跳过了事件`;
                    return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        accepted: true,
                        eventEffect: { mode: 'none' },
                        discovery: {
                            kind: 'event',
                            title: summary,
                            summary,
                            detail: '没有抽取或结算事件卡',
                            tone: 'accent',
                        },
                        logText,
                    }, timestamp)];
                }

                const eventCard = resolveEvent(core);
                const eventRollKind = eventCard.roll?.kind ?? 'trait';
                const eventRollResult = eventCard.roll
                    ? eventRollKind === 'dice'
                        ? rollEventFixedDice(random, eventCard.roll.dice)
                        : rollEventTraitCheckWithDice(random, core.currentExplorer, eventCard.roll.trait, core)
                    : null;
                const eventRollTotal = eventRollResult?.total ?? null;
                const eventBranch = eventCard.roll && eventRollTotal !== null
                    ? resolveEventBranch(eventCard.roll.branches, eventRollTotal)
                    : null;
                const eventEffect = eventBranch?.effect ?? eventCard.effect;
                if (!eventEffect) {
                    throw new Error(`event ${eventCard.name} has no resolvable effect`);
                }
                const deferEventRollEffectRandomResults = Boolean(eventCard.roll && eventRollTotal !== null && eventBranch);
                const materializedEventEffect = materializeEventEffect(
                    eventEffect,
                    random,
                    core.currentExplorer,
                    core,
                    { materializeRandomResults: !deferEventRollEffectRandomResults },
                );
                const needsFollowUpChoice = eventEffectNeedsPendingEventChoice(materializedEventEffect);
                const deathPrevention = needsFollowUpChoice || deferEventRollEffectRandomResults
                    ? undefined
                    : resolveEventDamageDeathPrevention(core, materializedEventEffect, random);
                const effectLabel = formatEffectLabel(materializedEventEffect);
                const eventRollLabel = eventCard.roll
                    ? eventRollKind === 'dice'
                        ? eventCard.roll.label
                        : `${TRAIT_LABEL[eventCard.roll.trait]}检定`
                    : undefined;
                const rollLabel = eventCard.roll && eventRollTotal !== null && eventBranch
                    ? `${eventRollLabel} ${eventRollTotal}：${eventBranch.label}`
                    : undefined;
                const eventEffectResolutionText = rollLabel ? `${rollLabel}；${effectLabel}` : effectLabel;
                const nextPendingEventChoice = needsFollowUpChoice
                    ? {
                        id: `${pending.id}-drawn-event-${timestamp}`,
                        playerId: command.playerId,
                        sourceTitle: eventCard.name,
                        eventDescription: eventCard.description,
                        sourceKind: 'event' as const,
                        acceptLabel: materializedEventEffect.mode === 'optionalEventRoll'
                            || materializedEventEffect.mode === 'optionalEffect'
                            || materializedEventEffect.mode === 'optionalItemEffect'
                            || materializedEventEffect.mode === 'optionalHauntRoll'
                            ? materializedEventEffect.acceptLabel
                            : undefined,
                        declineLabel: materializedEventEffect.mode === 'optionalEventRoll'
                            || materializedEventEffect.mode === 'optionalEffect'
                            || materializedEventEffect.mode === 'optionalItemEffect'
                            || materializedEventEffect.mode === 'optionalHauntRoll'
                            ? materializedEventEffect.declineLabel
                            : undefined,
                        effect: cloneUseEffect(materializedEventEffect),
                    } satisfies BetrayalPendingEventChoiceState
                    : undefined;
                const discoveryResolutionSteps: BetrayalDiscoveryResolutionStep[] = needsFollowUpChoice
                    ? []
                    : [{
                        id: `event-effect-${eventCard.name}`,
                        kind: 'event-effect',
                        text: `事件效果：${eventEffectResolutionText}`,
                        deckKind: 'event',
                    }];
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: eventCard.name,
                    eventDescription: eventCard.description,
                    accepted: false,
                    nextPendingEventChoice,
                    eventEffect: nextPendingEventChoice ? undefined : materializedEventEffect,
                    deathPrevention,
                    eventRoll: eventCard.roll && eventRollTotal !== null && eventBranch
                        ? {
                            kind: eventRollKind,
                            trait: eventRollKind === 'dice' ? undefined : eventCard.roll.trait,
                            total: eventRollTotal,
                            label: eventBranch.label,
                            eventDescription: eventCard.description,
                            rollLabel: eventRollLabel,
                            dice: eventRollResult?.dice,
                            passiveBonus: eventRollResult?.passiveBonus,
                            branchThresholds: eventCard.roll.branches.map((branch) => ({
                                min: branch.min,
                                label: branch.label,
                                effect: cloneUseEffect(branch.effect),
                            })),
                        }
                        : undefined,
                    drawnEventCardNameToBury: eventCard.name,
                    discovery: {
                        kind: 'event',
                        title: eventCard.name,
                        summary: '抽取事件牌',
                        detail: nextPendingEventChoice
                            ? `${eventEffectResolutionText}；等待选择事件效果`
                            : eventEffectResolutionText,
                        tone: isWarningEventEffect(materializedEventEffect) ? 'warning' : 'accent',
                        resolutionSteps: discoveryResolutionSteps,
                    },
                    logText: `${actor.displayName}选择抽取事件牌：${eventCard.name}（${eventEffectResolutionText}${nextPendingEventChoice ? '，等待选择事件效果' : ''}）`,
                }, timestamp)];
            }
            const resolveTraitRollEventChoice = (
                traitRollEffect: Extract<UseEffectProfile, { mode: 'traitRoll' }>,
                summary: string,
                logVerb: string,
            ) => {
                const rollResult = rollEventTraitCheckWithDice(random, core.currentExplorer, traitRollEffect.trait, core);
                const rollTotal = rollResult.total;
                const eventBranch = resolveEventBranch(traitRollEffect.branches, rollTotal);
                const branchEffect = cloneUseEffect(eventBranch.effect);
                const selectedTraitEffect = applyChosenTraitToEffect(branchEffect, command.payload.trait);
                const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
                const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
                const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
                const unresolvedSelectedEffect = effectHasUnresolvedTraitChoice(selectedEffect)
                    || effectHasUnresolvedGeneralDamageChoice(selectedEffect)
                    || effectNeedsAdjacentRoomChoice(selectedEffect)
                    || effectNeedsRoomTargetChoice(selectedEffect);
                const rollLabel = `${TRAIT_LABEL[traitRollEffect.trait]}检定`;
                const eventRoll = {
                    kind: 'trait' as const,
                    trait: traitRollEffect.trait,
                    total: rollTotal,
                    label: eventBranch.label,
                    eventDescription: pending.eventDescription,
                    rollLabel,
                    dice: rollResult.dice,
                    passiveBonus: rollResult.passiveBonus,
                    branchThresholds: traitRollEffect.branches.map((branch) => ({
                        ...branch,
                        effect: cloneUseEffect(branch.label === eventBranch.label ? selectedEffect : branch.effect),
                    })),
                };
                if (unresolvedSelectedEffect) {
                    return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        accepted: command.payload.accept ?? true,
                        nextPendingEventChoice: {
                            id: `${pending.id}-trait-roll-${timestamp}`,
                            playerId: command.playerId,
                            sourceTitle: pending.sourceTitle,
                            eventDescription: pending.eventDescription,
                            effect: cloneUseEffect(selectedEffect),
                        },
                        eventRoll,
                        discovery: {
                            kind: 'event',
                            title: pending.sourceTitle,
                            summary,
                            detail: `${rollLabel} ${rollTotal}：${eventBranch.label}`,
                            tone: 'accent',
                        },
                        logText: `${actor.displayName}${logVerb}：${pending.sourceTitle}（${rollLabel} ${rollTotal}，等待选择事件效果）`,
                    }, timestamp)];
                }
                const eventEffect = materializeEventEffect(
                    selectedEffect,
                    random,
                    core.currentExplorer,
                    core,
                    { materializeRandomResults: false },
                );
                const effectLabel = formatEffectLabel(eventEffect);
                const deathPrevention = undefined;
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: command.payload.accept ?? true,
                    eventEffect,
                    deathPrevention,
                    eventRoll,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary,
                        detail: `${rollLabel} ${rollTotal}：${eventBranch.label}；${effectLabel}`,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}${logVerb}：${pending.sourceTitle}（${rollLabel} ${rollTotal}，${effectLabel}）`,
                }, timestamp)];
            };
            if (pending.effect.mode === 'optionalHauntRoll') {
                if (
                    command.payload.accept
                    && !isBetrayalOptionalHauntRollRuntimeSupported(pending.effect.successHauntId)
                ) {
                    return [];
                }
                if (!command.payload.accept || core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered) {
                    const traitSelectedEffect = applyChosenTraitToEffect(pending.effect.skippedOrStartedEffect, command.payload.trait);
                    const selectedEffect = applyGeneralDamageTraitsToEffect(traitSelectedEffect, command.payload.traits);
                    const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer, core);
                    const effectLabel = formatEffectLabel(eventEffect);
                    const deathPrevention = resolveEventDamageDeathPrevention(core, eventEffect, random);
                    return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        accepted: false,
                        eventEffect,
                        deathPrevention,
                        discovery: {
                            kind: 'event',
                            title: pending.sourceTitle,
                            summary: pending.declineLabel ?? '跳过作祟检定',
                            detail: effectLabel,
                            tone: 'warning',
                        },
                        logText: `${actor.displayName}选择${pending.declineLabel ?? '跳过作祟检定'}：${pending.sourceTitle}（${effectLabel}）`,
                    }, timestamp)];
                }
                const hauntRisk = resolveBetrayalHauntRisk(core);
                const dice = rollBetrayalDicePips(random, hauntRisk.omenCount);
                const rollTotal = dice.reduce((sum, pip) => sum + pip, 0);
                const hauntTriggered = rollTotal >= hauntRisk.threshold;
                const dustSetup = hauntTriggered && pending.effect.successHauntId === 3
                    ? createDustRuntimeState(core, random)
                    : undefined;
                const uponReflectionSetup = hauntTriggered && pending.effect.successHauntId === 7
                    ? createUponReflectionRuntimeState(core, command.playerId, random)
                    : undefined;
                const eventEffect = hauntTriggered
                    ? { mode: 'none' as const, recommendedAction: 'endTurn' as const }
                    : materializeEventEffect(
                        pending.effect.failureEffect,
                        random,
                        core.currentExplorer,
                        core,
                        { materializeRandomResults: false },
                    );
                const effectLabel = hauntTriggered ? pending.effect.successLabel : formatEffectLabel(eventEffect);
                const deathPrevention = undefined;
                const hauntRevealResolution = hauntTriggered
                    ? resolveHauntRevealResolutionForTrigger(
                        core,
                        { id: null, name: pending.effect.successHauntTriggerLabel ?? pending.sourceTitle },
                        pending.effect.successHauntId,
                    )
                    : undefined;
                const hauntTraitorResolution = hauntTriggered && hauntRevealResolution
                    ? resolveHauntTraitorResolutionForTrigger(core, hauntRevealResolution.hauntCardNumber, command.playerId, {
                        eventSelection: pending.effect.successTraitorSelection,
                        revealRepresentativeOnly: hauntRevealResolution.representativeOnly,
                    })
                    : undefined;
                const hauntTraitorPlayerId = hauntTraitorResolution?.traitorPlayerId;
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    hauntTriggered,
                    hauntTraitorPlayerId,
                    hauntCardNumber: hauntTriggered ? pending.effect.successHauntId : undefined,
                    hauntTriggerLabel: hauntTriggered
                        ? pending.effect.successHauntTriggerLabel ?? pending.sourceTitle
                        : undefined,
                    hauntRevealResolution,
                    hauntTraitorResolution,
                    dustSetup,
                    uponReflectionSetup,
                    hauntRoll: {
                        threshold: hauntRisk.threshold,
                        successHauntId: pending.effect.successHauntId,
                        successHauntTriggerLabel: pending.effect.successHauntTriggerLabel,
                        successTraitorSelection: pending.effect.successTraitorSelection,
                    },
                    eventEffect,
                    deathPrevention,
                    eventRoll: {
                        kind: 'dice',
                        total: rollTotal,
                        label: hauntTriggered ? pending.effect.successLabel : formatEffectLabel(pending.effect.failureEffect),
                        rollLabel: '作祟检定',
                        dice,
                        passiveBonus: 0,
                        branchThresholds: [
                            {
                                min: hauntRisk.threshold,
                                label: pending.effect.successLabel,
                                effect: { mode: 'none', recommendedAction: 'endTurn' },
                            },
                            {
                                min: 0,
                                label: formatEffectLabel(pending.effect.failureEffect),
                                effect: cloneUseEffect(pending.effect.failureEffect),
                            },
                        ],
                    },
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: pending.effect.acceptLabel,
                        detail: `选择进行作祟检定：总点数 ${rollTotal}（${dice.length} 颗骰子，${effectLabel}）`,
                        tone: hauntTriggered ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}进行作祟检定：${pending.sourceTitle}（总点数 ${rollTotal}，${effectLabel}）`,
                }, timestamp)];
            }
            if (pending.effect.mode === 'chooseTraitRoll') {
                const selectedTrait = command.payload.trait!;
                const rollResult = rollEventTraitCheckWithDice(random, core.currentExplorer, selectedTrait, core);
                const rollTotal = rollResult.total;
                const eventBranch = resolveEventBranch(pending.effect.branches, rollTotal);
                const branchEffect = cloneUseEffect(eventBranch.effect);
                const selectedTraitEffect = applyChosenTraitToEffect(branchEffect, selectedTrait);
                const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
                const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
                const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
                const eventEffect = materializeEventEffect(
                    selectedEffect,
                    random,
                    core.currentExplorer,
                    core,
                    { materializeRandomResults: false },
                );
                const effectLabel = formatEffectLabel(eventEffect);
                const rollLabel = `${TRAIT_LABEL[selectedTrait]}检定`;
                const deathPrevention = undefined;
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    deathPrevention,
                    eventRoll: {
                        kind: 'trait',
                        trait: selectedTrait,
                        total: rollTotal,
                        label: eventBranch.label,
                        eventDescription: pending.eventDescription,
                        rollLabel,
                        dice: rollResult.dice,
                        passiveBonus: rollResult.passiveBonus,
                        branchThresholds: pending.effect.branches.map((branch) => {
                            const branchSnapshotEffect = branch.label === eventBranch.label
                                ? selectedEffect
                                : branch.effect;
                            return {
                                ...branch,
                                effect: cloneUseEffect(branchSnapshotEffect),
                            };
                        }),
                    },
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: pending.effect.prompt,
                        detail: `${rollLabel} ${rollTotal}：${eventBranch.label}；${effectLabel}`,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}选择${TRAIT_LABEL[selectedTrait]}：${pending.sourceTitle}（${rollLabel} ${rollTotal}，${effectLabel}）`,
                }, timestamp)];
            }
            if (pending.effect.mode === 'allTraitChecks') {
                const traitSelectedEffect = applyChosenTraitToEffect(pending.effect.allPassEffect, command.payload.trait);
                const selectedEffect = applyGeneralDamageTraitsToEffect(traitSelectedEffect, command.payload.traits);
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer, core);
                const effectLabel = formatEffectLabel(eventEffect);
                const deathPrevention = resolveEventDamageDeathPrevention(core, eventEffect, random);
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    deathPrevention,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: '每项属性均通过',
                        detail: `每项属性均通过；${effectLabel}`,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}选择${command.payload.trait ? TRAIT_LABEL[command.payload.trait] : '任意属性'}：${pending.sourceTitle}（${effectLabel}）`,
                }, timestamp)];
            }
            if (pending.effect.mode === 'traitRoll') {
                return resolveTraitRollEventChoice(
                    pending.effect,
                    `${TRAIT_LABEL[pending.effect.trait]}检定`,
                    `进行${TRAIT_LABEL[pending.effect.trait]}检定`,
                );
            }
            if (pending.effect.mode === 'optionalItemEffect') {
                if (command.payload.accept) {
                    const itemSelectedEffect = applyItemChoiceToEffect(core, pending.effect, command.payload.cardId);
                    if (itemSelectedEffect.mode !== 'optionalItemEffect') {
                        return [];
                    }
                    const selectedTraitEffect = applyChosenTraitToEffect(itemSelectedEffect.acceptEffect, command.payload.trait);
                    const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
                    const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
                    const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
                    const eventEffect = materializeEventEffect(
                        { ...itemSelectedEffect, acceptEffect: selectedEffect },
                        random,
                        core.currentExplorer,
                        core,
                    );
                    const effectLabel = formatEffectLabel(eventEffect);
                    const deathPrevention = resolveEventDamageDeathPrevention(core, eventEffect, random);
                    return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        accepted: true,
                        eventEffect,
                        deathPrevention,
                        discovery: {
                            kind: 'event',
                            title: pending.sourceTitle,
                            summary: pending.effect.acceptLabel,
                            detail: effectLabel,
                            tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                        },
                        logText: `${actor.displayName}选择${pending.effect.acceptLabel}：${pending.sourceTitle}（${effectLabel}）`,
                    }, timestamp)];
                }
                if (pending.effect.declineEffect.mode === 'traitRoll') {
                    return resolveTraitRollEventChoice(
                        pending.effect.declineEffect,
                        pending.effect.declineLabel,
                        `选择${pending.effect.declineLabel}`,
                    );
                }
                const selectedTraitEffect = applyChosenTraitToEffect(pending.effect.declineEffect, command.payload.trait);
                const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
                const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
                const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer, core);
                const effectLabel = formatEffectLabel(eventEffect);
                const deathPrevention = resolveEventDamageDeathPrevention(core, eventEffect, random);
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: false,
                    eventEffect,
                    deathPrevention,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: pending.effect.declineLabel,
                        detail: effectLabel,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}选择${pending.effect.declineLabel}：${pending.sourceTitle}（${effectLabel}）`,
                }, timestamp)];
            }
            if (
                effectHasUnresolvedTraitChoice(pending.effect)
                || effectNeedsAdjacentRoomChoice(pending.effect)
                || effectNeedsRoomTargetChoice(pending.effect)
            ) {
                const selectedTraitEffect = applyChosenTraitToEffect(pending.effect, command.payload.trait);
                const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
                const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
                const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer, core);
                const effectLabel = formatEffectLabel(eventEffect);
                const deathPrevention = resolveEventDamageDeathPrevention(core, eventEffect, random);
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    deathPrevention,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: '选择事件效果',
                        detail: effectLabel,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}选择事件效果：${pending.sourceTitle}（${effectLabel}）`,
                }, timestamp)];
            }
            if (pending.effect.mode === 'optionalEffect') {
                if (!command.payload.accept) {
                    return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        accepted: false,
                        discovery: {
                            kind: 'event',
                            title: pending.sourceTitle,
                            summary: pending.effect.declineLabel,
                            detail: '无事发生',
                            tone: 'accent',
                        },
                        logText: `${actor.displayName}选择${pending.effect.declineLabel}：${pending.sourceTitle}`,
                    }, timestamp)];
                }
                const selectedTraitEffect = applyChosenTraitToEffect(pending.effect.acceptEffect, command.payload.trait);
                const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
                const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
                const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer, core);
                const effectLabel = formatEffectLabel(eventEffect);
                const deathPrevention = resolveEventDamageDeathPrevention(core, eventEffect, random);
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    deathPrevention,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: pending.effect.acceptLabel,
                        detail: effectLabel,
                        tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}选择${pending.effect.acceptLabel}：${pending.sourceTitle}（${effectLabel}）`,
                }, timestamp)];
            }
            if (!command.payload.accept || pending.effect.mode !== 'optionalEventRoll') {
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: false,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: pending.declineLabel ?? '不执行',
                        detail: '无事发生',
                        tone: 'accent',
                    },
                    logText: `${actor.displayName}选择${pending.declineLabel ?? '不执行'}：${pending.sourceTitle}`,
                }, timestamp)];
            }

            const rollResult = rollEventFixedDice(random, pending.effect.roll.dice);
            const rollTotal = rollResult.total;
            const eventBranch = resolveEventBranch(pending.effect.roll.branches, rollTotal);
            const branchEffect = cloneUseEffect(eventBranch.effect);
            const selectedTraitEffect = applyChosenTraitToEffect(branchEffect, command.payload.trait);
            const damageSelectedEffect = applyGeneralDamageTraitsToEffect(selectedTraitEffect, command.payload.traits);
            const adjacentSelectedEffect = applyAdjacentRoomChoiceToEffect(core, damageSelectedEffect, command.payload.targetRoomId);
            const selectedEffect = applyRoomTargetChoiceToEffect(core, adjacentSelectedEffect, command.payload.targetRoomId);
            const unresolvedSelectedEffect = effectHasUnresolvedTraitChoice(selectedEffect)
                || effectNeedsAdjacentRoomChoice(selectedEffect)
                || effectNeedsRoomTargetChoice(selectedEffect);
            const eventRoll = {
                kind: 'dice' as const,
                total: rollTotal,
                label: eventBranch.label,
                eventDescription: pending.eventDescription,
                rollLabel: pending.effect.roll.label,
                dice: rollResult.dice,
                passiveBonus: rollResult.passiveBonus,
                branchThresholds: pending.effect.roll.branches.map((branch) => ({
                    ...branch,
                    effect: cloneUseEffect(branch.label === eventBranch.label ? selectedEffect : branch.effect),
                })),
            };
            if (unresolvedSelectedEffect) {
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    nextPendingEventChoice: {
                        id: `${pending.id}-rolled-${timestamp}`,
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        eventDescription: pending.eventDescription,
                        effect: cloneUseEffect(selectedEffect),
                    },
                    eventRoll,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: pending.acceptLabel,
                        detail: `${pending.effect.roll.label} ${rollTotal}：${eventBranch.label}`,
                        tone: 'accent',
                    },
                    logText: `${actor.displayName}选择${pending.acceptLabel}：${pending.sourceTitle}（${pending.effect.roll.label} ${rollTotal}，等待选择事件效果）`,
                }, timestamp)];
            }
            const eventEffect = materializeEventEffect(
                selectedEffect,
                random,
                core.currentExplorer,
                core,
                { materializeRandomResults: false },
            );
            const effectLabel = formatEffectLabel(eventEffect);
            const deathPrevention = undefined;
            return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                playerId: command.playerId,
                sourceTitle: pending.sourceTitle,
                accepted: true,
                eventEffect,
                deathPrevention,
                eventRoll,
                discovery: {
                    kind: 'event',
                    title: pending.sourceTitle,
                    summary: pending.acceptLabel,
                    detail: `${pending.effect.roll.label} ${rollTotal}：${eventBranch.label}；${effectLabel}`,
                    tone: isWarningEventEffect(eventEffect) ? 'warning' : 'accent',
                },
                logText: `${actor.displayName}选择${pending.acceptLabel}：${pending.sourceTitle}（${pending.effect.roll.label} ${rollTotal}，${effectLabel}）`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            const effect = resolveMysticElevatorEffect(core, random);
            if (!effect) {
                return [];
            }
            return [nowEvent(EVENTS.ROOM_EFFECT_USED, {
                playerId: command.playerId,
                effect,
                logText: `${core.currentExplorer.displayName}启动神秘电梯，投出 ${effect.rollTotal}，电梯移动到${effect.destinationRoomName}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            const tradeRequestPayload = createBetrayalTradeRequestedPayload(core, command.playerId, command.payload);
            return tradeRequestPayload
                ? [nowEvent(EVENTS.POSSESSION_TRADE_REQUESTED, tradeRequestPayload, timestamp)]
                : [];
        }
        case BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT: {
            const tradeAgreementEvent = resolveBetrayalTradeAgreementEventPayload(core, command.payload.accept);
            if (!tradeAgreementEvent) {
                return [];
            }
            return tradeAgreementEvent.kind === 'accepted'
                ? [nowEvent(EVENTS.POSSESSION_TRADED, tradeAgreementEvent.payload, timestamp)]
                : [nowEvent(EVENTS.POSSESSION_TRADE_DECLINED, tradeAgreementEvent.payload, timestamp)];
        }
        case BETRAYAL_COMMANDS.LOOT_CORPSE: {
            const corpseLootPayload = createBetrayalCorpseLootedPayload(core, command.playerId, command.payload);
            return corpseLootPayload ? [nowEvent(EVENTS.CORPSE_LOOTED, corpseLootPayload, timestamp)] : [];
        }
        case BETRAYAL_COMMANDS.END_TURN: {
            const roomEndTurnEffect = resolveEndTurnRoomEffect(core, random);
            const dustEndTurn = resolveDustEndTurn(core, random);
            const magicCameraEndTurnCapturedEssencePlayerIds = resolveMagicCameraEndTurn(core);
            const extraTurnAfterCurrentTurn = core.pendingExtraTurnAfterCurrentTurn?.playerId === core.currentPlayer
                ? { ...core.pendingExtraTurnAfterCurrentTurn }
                : null;
            const nextPlayerId = extraTurnAfterCurrentTurn
                ? core.currentPlayer
                : core.phase === 'haunt'
                ? rotateToNextLivingPlayer(core, core.currentPlayer)
                : (() => {
                    const explorers = getExplorersInTurnOrder(core);
                    const currentIndex = explorers.findIndex((explorer) => explorer.playerId === core.currentPlayer);
                    return (explorers[(currentIndex + 1) % explorers.length] ?? explorers[0]!).playerId;
                })();
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId) ?? core.currentExplorer;
            const previewCore = replaceExplorers(core, getExplorersInTurnOrder(core), nextExplorer.playerId);
            const monsterMovementRoll = extraTurnAfterCurrentTurn
                ? null
                : canReviveTraitorAtMonsterTurnStart(previewCore, nextPlayerId)
                ? null
                : resolveJackSpiritMonsterMovementRoll(previewCore, nextPlayerId, random)
                    ?? resolveFeverishMonsterMovementRoll(previewCore, nextPlayerId, random);
            const targets = resolveMoveTargetRooms(previewCore);
            const baseLogText = extraTurnAfterCurrentTurn
                ? `${extraTurnAfterCurrentTurn.sourceCardName}生效，${nextExplorer.displayName}再进行一轮行动`
                : targets.length > 0
                ? `轮到${nextExplorer.displayName}，可前往${formatRoomTargetList(targets)}`
                : `轮到${nextExplorer.displayName}`;
            const turnLogText = monsterMovementRoll
                ? `${baseLogText}；${monsterMovementRoll.monsterName}速度 ${monsterMovementRoll.speed} 投出 ${monsterMovementRoll.total}，本回合可移动 ${monsterMovementRoll.moveAllowance} 间`
                : baseLogText;
            const shouldDeferAdvanceUntilRollAcknowledged = Boolean(
                roomEndTurnEffect?.kind === 'speedCheckFallToBasement'
                && roomEndTurnEffect.speedRollDice?.length,
            );
            const helpingHandsMonsterTurnControllerPlayerId = (
                !extraTurnAfterCurrentTurn
                && (
                    isHelpingHandsHaunt(core)
                    && core.scenarioRuntime.helpingHands?.monsterTurnAfterPlayerId === core.currentPlayer
                    && !core.scenarioRuntime.helpingHands.activeMonsterTurn
                )
            )
                ? resolveHelpingHandsControllerPlayerId(core)
                : null;
            const pendingRoomDamageAllocationPreview = roomEndTurnEffect?.kind === 'physicalDamage1'
                && roomEndTurnEffect.physicalDamage !== undefined
                ? createPendingDamageAllocation({
                    id: `room-damage-${roomEndTurnEffect.playerId}-${timestamp}`,
                    explorer: core.currentExplorer,
                    sourceTitle: roomEndTurnEffect.roomName,
                    damageKind: 'physical',
                    amount: roomEndTurnEffect.physicalDamage ?? 0,
                    allowSkull: core.phase === 'haunt',
                    nextPlayerId,
                    monsterMovementRoll,
                    turnLogText,
                    helpingHandsMonsterTurnControllerPlayerId: helpingHandsMonsterTurnControllerPlayerId ?? undefined,
                    skipBloodFromStoneMonsterTurnStart: Boolean(extraTurnAfterCurrentTurn),
                })
                : null;
            const logText = roomEndTurnEffect
                ? shouldDeferAdvanceUntilRollAcknowledged || pendingRoomDamageAllocationPreview
                    ? formatEndTurnRoomEffectLog(roomEndTurnEffect, core.currentExplorer.displayName)
                    : `${formatEndTurnRoomEffectLog(roomEndTurnEffect, core.currentExplorer.displayName)}；${turnLogText}`
                : turnLogText;
            const dustLogText = dustEndTurn
                ? [
                    dustEndTurn.swaps.length > 0
                        ? `${core.currentExplorer.displayName}在回合结束时交换了 ${dustEndTurn.swaps.length} 次疾病标记`
                        : null,
                    dustEndTurn.damagePlayerId && dustEndTurn.damageAmount !== undefined
                        ? `${core.currentExplorer.displayName}本回合没有交换疾病标记，承受 ${dustEndTurn.damageAmount} 点通用伤害`
                        : null,
                ].filter(Boolean).join('；')
                : '';
            const magicCameraLogText = magicCameraEndTurnCapturedEssencePlayerIds.length > 0
                ? `${core.currentExplorer.displayName}在回合结束时处于幻影摄影师视线内，本质被夺走`
                : '';
            const hauntLogText = [dustLogText, magicCameraLogText].filter(Boolean).join('；');
            const helpingHandsLogText = (
                !extraTurnAfterCurrentTurn
                &&
                isHelpingHandsHaunt(core)
                && core.scenarioRuntime.helpingHands?.monsterTurnAfterPlayerId === core.currentPlayer
                && !helpingHandsMonsterTurnControllerPlayerId
            )
                ? '无人持有奇异护符，巨魔手怪物回合跳过'
                : '';
            const fullLogText = [
                hauntLogText,
                helpingHandsLogText,
                logText,
            ].filter(Boolean).join('；');
            const shouldStartHelpingHandsMonsterTurn = Boolean(
                helpingHandsMonsterTurnControllerPlayerId
                && !shouldDeferAdvanceUntilRollAcknowledged
                && !pendingRoomDamageAllocationPreview,
            );
            const deferredHelpingHandsMonsterTurnStart = shouldStartHelpingHandsMonsterTurn && helpingHandsMonsterTurnControllerPlayerId
                ? createHelpingHandsMonsterTurnStartedEvent(
                    helpingHandsMonsterTurnControllerPlayerId,
                    random,
                    timestamp,
                ).payload
                : undefined;
            const turnEndedPayload: BetrayalTurnEndedPayload = {
                previousPlayerId: core.currentPlayer,
                nextPlayerId,
                logText: fullLogText,
                roomEndTurnEffect,
                monsterMovementRoll,
                helpingHandsMonsterTurnControllerPlayerId: helpingHandsMonsterTurnControllerPlayerId ?? undefined,
                deferAdvanceUntilRollAcknowledged: shouldDeferAdvanceUntilRollAcknowledged,
                turnLogText,
                dustEndTurn,
                magicCameraEndTurnCapturedEssencePlayerIds,
                deferredHelpingHandsMonsterTurnStart,
                extraTurnAfterCurrentTurn: extraTurnAfterCurrentTurn ?? undefined,
                skipBloodFromStoneMonsterTurnStart: Boolean(extraTurnAfterCurrentTurn),
            };
            const toothNecklaceCard = resolveToothNecklaceCard(core.currentExplorer);
            const toothNecklaceTraits = toothNecklaceCard
                ? resolveDeathsDoorTraitGainChoices(core.currentExplorer)
                : [];
            if (toothNecklaceCard && toothNecklaceTraits.length > 0) {
                return [nowEvent(EVENTS.TOOTH_NECKLACE_CHOICE_STARTED, {
                    playerId: core.currentPlayer,
                    cardId: toothNecklaceCard.id,
                    cardName: toothNecklaceCard.name,
                    allowedTraits: toothNecklaceTraits,
                    deferredTurnEnd: cloneTurnEndedPayload(turnEndedPayload),
                    logText: `${core.currentExplorer.displayName}可以使用${toothNecklaceCard.name}提升一项濒死属性`,
                }, timestamp)];
            }
            return [nowEvent(EVENTS.TURN_ENDED, turnEndedPayload, timestamp)];
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL: {
            const pendingRoll = resolvePendingTurnEndRoll(core);
            const roomEndTurn = pendingRoll?.roomEndTurn;
            const deathPreventionTurnEnd = pendingRoll?.deathPrevention?.nextPlayerId
                ? pendingRoll.deathPrevention
                : null;
            const nextPlayerId = roomEndTurn?.nextPlayerId ?? deathPreventionTurnEnd?.nextPlayerId;
            if (!pendingRoll || !nextPlayerId) {
                return [];
            }
            const monsterMovementRoll = roomEndTurn?.monsterMovementRoll
                ?? deathPreventionTurnEnd?.monsterMovementRoll
                ?? null;
            const helpingHandsMonsterTurnControllerPlayerId =
                roomEndTurn?.helpingHandsMonsterTurnControllerPlayerId
                ?? deathPreventionTurnEnd?.helpingHandsMonsterTurnControllerPlayerId;
            const skipBloodFromStoneMonsterTurnStart =
                roomEndTurn?.skipBloodFromStoneMonsterTurnStart
                ?? deathPreventionTurnEnd?.skipBloodFromStoneMonsterTurnStart;
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId);
            const turnLogText = roomEndTurn?.turnLogText
                ?? deathPreventionTurnEnd?.turnLogText
                ?? (nextExplorer ? `轮到${nextExplorer.displayName}` : '进入下一位玩家回合');
            return [nowEvent(EVENTS.TURN_END_ROLL_ACKNOWLEDGED, {
                previousPlayerId: pendingRoll.playerId,
                nextPlayerId,
                monsterMovementRoll,
                helpingHandsMonsterTurnControllerPlayerId,
                skipBloodFromStoneMonsterTurnStart,
                logText: turnLogText,
            }, timestamp), ...(helpingHandsMonsterTurnControllerPlayerId
                ? [createHelpingHandsMonsterTurnStartedEvent(
                    helpingHandsMonsterTurnControllerPlayerId,
                    random,
                    timestamp,
                )]
                : [])];
        }
        case BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION: {
            const pending = core.pendingDamageAllocation;
            if (!pending) {
                return [];
            }
            const actor = findExplorerByPlayerId(core, pending.playerId) ?? core.currentExplorer;
            const traits = command.payload.traits ?? [];
            const traitText = traits.map((trait) => TRAIT_LABEL[trait]).join('、');
            const useBrooch = Boolean(command.payload.useBrooch && pending.damageReplacement);
            const resolvedDamageKind = useBrooch ? 'general' : pending.damageKind;
            const broochLog = useBrooch
                ? `使用${pending.damageReplacement!.cardName}将${pending.damageKind === 'physical' ? '物理' : '精神'}伤害替换为通用伤害，`
                : '';
            const deathPreview = cloneExplorer(actor);
            const projectedAppliedDamage = applyGeneralDamage(deathPreview, pending.amount, traits, { allowSkull: pending.allowSkull });
            const strangeAmuletBonusCard = resolvedDamageKind === 'physical' && projectedAppliedDamage > 0
                ? actor.inventory.find((card) => resolveInventoryEffectId(card.id) === HELPING_HANDS_STRANGE_AMULET_CARD_ID)
                : undefined;
            const strangeAmuletLog = strangeAmuletBonusCard ? `；${strangeAmuletBonusCard.name}使神志 +1` : '';
            const deathPreventionRoll = pending.allowSkull
                && isExplorerDead(deathPreview)
                ? rollDeathPrevention(random, actor)
                : null;
            const releasedJackSpiritRoomId = pending.sourceTitle === '攻击'
                && actor.playerId === core.scenarioRuntime.traitorPlayerId
                ? resolveJackSpiritSpawnRoomId(core, actor.roomId)
                : undefined;
            const deathPrevention = deathPreventionRoll
                ? {
                    ...deathPreventionRoll,
                    damageAmount: pending.amount,
                    damageKind: resolvedDamageKind,
                    damageTraits: [...traits],
                    traitsBeforeDamage: { ...pending.traitsBeforeDamage },
                    releasedJackSpiritRoomId,
                    nextPlayerId: pending.nextPlayerId,
                    monsterMovementRoll: pending.monsterMovementRoll ?? null,
                    turnLogText: pending.turnLogText,
                    helpingHandsMonsterTurnControllerPlayerId: pending.helpingHandsMonsterTurnControllerPlayerId,
                    skipBloodFromStoneMonsterTurnStart: pending.skipBloodFromStoneMonsterTurnStart,
                }
                : undefined;
            const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
            return [nowEvent(EVENTS.DAMAGE_ALLOCATION_RESOLVED, {
                playerId: pending.playerId,
                sourceTitle: pending.sourceTitle,
                damageKind: resolvedDamageKind,
                amount: pending.amount,
                traits,
                nextPlayerId: pending.nextPlayerId,
                monsterMovementRoll: pending.monsterMovementRoll ?? null,
                turnLogText: pending.turnLogText,
                helpingHandsMonsterTurnControllerPlayerId: pending.helpingHandsMonsterTurnControllerPlayerId,
                skipBloodFromStoneMonsterTurnStart: pending.skipBloodFromStoneMonsterTurnStart,
                deathPrevention,
                logText: `${actor.displayName}${broochLog}将${pending.sourceTitle}的 ${pending.amount} 点伤害分配到${traitText}${deathPreventionLog}${strangeAmuletLog}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.HAUNT_ATTACK: {
            const isTraitor = core.scenarioRuntime.traitorPlayerId === command.playerId;
            const attacker = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const attackerTraitsBeforeDamage = { ...attacker.traits };
            const attackerRoomId = resolveControlledRoomId(core, attacker);
            const attackingWithJackSpirit = shouldDeadTraitorControlJackSpirit(core, attacker.playerId);
            const jackSpirit = attackingWithJackSpirit ? findJackSpirit(core) : null;
            const weaponEffect = attackingWithJackSpirit
                ? null
                : resolveAttackWeaponEffect(attacker, command.payload.weaponCardId);
            const attackDamageKind = weaponEffect?.damageKind ?? 'physical';
            const attackDamageLabel = `${attackDamageKind} damage`;
            if (command.payload.target === 'dynamite-room') {
                const dynamiteCard = resolveDynamiteInventoryCard(attacker, command.payload.weaponCardId);
                const targetRoom = command.payload.targetRoomId
                    ? core.rooms.find((room) => room.id === command.payload.targetRoomId && room.state === 'discovered')
                    : null;
                if (!dynamiteCard || !targetRoom) {
                    return [];
                }
                const explorerRolls = getAllExplorers(core)
                    .filter((explorer) => (
                        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                        && resolveControlledRoomId(core, explorer) === targetRoom.id
                    ))
                    .map((explorer): BetrayalDynamiteExplorerRoll => {
                        const speedRoll = rollTraitCheckWithDice(random, explorer, 'speed', core);
                        return {
                            playerId: explorer.playerId,
                            displayName: explorer.displayName,
                            dice: speedRoll.dice,
                            passiveBonus: speedRoll.passiveBonus,
                            total: speedRoll.total,
                            passed: speedRoll.total >= 4,
                            traitsBeforeDamage: { ...explorer.traits },
                        };
                    });
                const monsterRolls = core.monsters
                    .filter((monster) => monster.roomId === targetRoom.id && resolveMonsterStatusKind(core, monster.id) === 'active')
                    .map((monster): BetrayalDynamiteMonsterRoll => {
                        const dice = rollBetrayalDicePips(random, resolveMonsterTrait(monster, 'speed'));
                        const total = dice.reduce((sum, pip) => sum + pip, 0);
                        const passed = total >= 4;
                        return {
                            monsterId: monster.id,
                            monsterName: monster.name,
                            dice,
                            total,
                            passed,
                            monsterDamageOutcome: passed
                                ? null
                                : resolveBetrayalMonsterDamageOutcome(core, monster.id, {
                                    damageAmount: 4,
                                    damageTrait: 'speed',
                                }),
                        };
                    });
                const failedExplorerNames = explorerRolls.filter((roll) => !roll.passed).map((roll) => roll.displayName);
                const failedMonsterNames = monsterRolls.filter((roll) => !roll.passed).map((roll) => roll.monsterName);
                const failedNames = [...failedExplorerNames, ...failedMonsterNames];
                const resultText = failedNames.length > 0
                    ? `${failedNames.join('、')}速度检定失败，需承受 4 点物理伤害`
                    : '所有人速度检定均为 4+，无人受伤';
                return [nowEvent(EVENTS.DYNAMITE_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    cardId: dynamiteCard.id,
                    cardName: dynamiteCard.name,
                    targetRoomId: targetRoom.id,
                    targetRoomName: targetRoom.name,
                    explorerRolls,
                    monsterRolls,
                    logText: `${attacker.displayName}使用炸药攻击${targetRoom.name}，${resultText}`,
                }, timestamp)];
            }
            if (isHelpingHandsHaunt(core)) {
                if (command.payload.target === 'troll-hand') {
                    const trollHand = findHelpingHandsTrollHand(core, command.payload.targetMonsterId);
                    if (!trollHand) {
                        return [];
                    }
                    const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                    const attackerRoll = attackRoll.total;
                    const defenderRoll = rollTrait(
                        random,
                        resolveMonsterTrait(trollHand, weaponEffect?.attackTrait ?? 'might'),
                    );
                    const damageToMonster = Math.max(0, attackerRoll - defenderRoll);
                    const monsterDamageOutcome = resolveBetrayalMonsterDamageOutcome(core, trollHand.id, {
                        damageAmount: damageToMonster,
                        damageTrait: weaponEffect?.attackTrait ?? 'might',
                    });
                    const damageToAttacker = resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                    const attackerDeathPrevention = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                        ? rollDeathPrevention(random, attacker)
                        : null;
                    const attackerDefeated = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                        && !attackerDeathPrevention?.prevented;
                    const deathPrevention = attackerDeathPrevention
                        ? {
                            ...attackerDeathPrevention,
                            damageAmount: damageToAttacker,
                            damageKind: attackDamageKind,
                            traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                        }
                        : undefined;
                    const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                    return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                        attackerPlayerId: attacker.playerId,
                        target: 'troll-hand',
                        defenderMonsterId: trollHand.id,
                        defeatedPlayerId: attackerDefeated ? attacker.playerId : undefined,
                        monsterDamageOutcome: monsterDamageOutcome ?? undefined,
                        outcome: monsterDamageOutcome?.kind === 'resisted'
                            ? 'troll-hand-resisted'
                            : attackerDefeated
                                ? 'hero-defeated'
                                : attackerRoll === defenderRoll
                                    ? 'no-damage'
                                    : 'wound',
                        attackerRoll,
                        defenderRoll,
                        damageToAttacker: damageToAttacker || undefined,
                        damageKind: attackDamageKind,
                        weaponCardId: weaponEffect?.card.id,
                        weaponName: weaponEffect?.card.name,
                        weaponAttackBonus: weaponEffect?.bonus || undefined,
                        weaponExtraDice: weaponEffect?.extraDice || undefined,
                        weaponSpeedCost: weaponEffect?.speedCost || undefined,
                        weaponAttackTrait: weaponEffect?.attackTrait,
                        attackRoll: {
                            id: `${attacker.playerId}-${trollHand.id}-helping-hands-${timestamp}`,
                            dice: attackRoll.dice,
                            passiveBonus: attackRoll.passiveBonus,
                            latestLabel: monsterDamageOutcome?.kind === 'resisted'
                                ? monsterDamageOutcome.logLabel
                                : damageToAttacker > 0
                                    ? `反受 ${damageToAttacker} 点伤害`
                                    : '平手无伤害',
                            attackerTraitsBeforeDamage,
                        },
                        deathPrevention,
                        logText: monsterDamageOutcome?.kind === 'resisted'
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}击败巨魔手，但${monsterDamageOutcome.logLabel}`
                            : attackerDefeated
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击巨魔手失败并被击倒${deathPreventionLog}`
                                : damageToAttacker > 0
                                    ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击巨魔手失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`
                                    : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击巨魔手，双方都没有受伤`,
                    }, timestamp)];
                }
                const defender = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (!defender || defender.playerId === attacker.playerId) {
                    return [];
                }
                const defenderTraitsBeforeDamage = { ...defender.traits };
                const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = attackRoll.total;
                const defenderRoll = rollAttackDefense(random, defender, weaponEffect);
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                const attackTrait = weaponEffect?.attackTrait ?? 'might';
                const canChooseSteal = attackTrait === 'might'
                    && damageToDefender > 0
                    && resolveHelpingHandsStealableCards(core, defender.playerId).length > 0;
                const defenderDeathPrevention = !canChooseSteal && wouldExplorerDieFromAttackDamage(defender, damageToDefender, attackDamageKind)
                    ? rollDeathPrevention(random, defender)
                    : null;
                const attackerDeathPrevention = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const defenderDefeated = !canChooseSteal
                    && wouldExplorerDieFromAttackDamage(defender, damageToDefender, attackDamageKind)
                    && !defenderDeathPrevention?.prevented;
                const attackerDefeated = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !attackerDeathPrevention?.prevented;
                const deathPrevention = defenderDeathPrevention
                    ? {
                        ...defenderDeathPrevention,
                        damageAmount: damageToDefender,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: defenderTraitsBeforeDamage,
                    }
                    : attackerDeathPrevention
                        ? {
                            ...attackerDeathPrevention,
                            damageAmount: damageToAttacker,
                            damageKind: attackDamageKind,
                            traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                        }
                        : undefined;
                const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                const helpingHandsAttackRewardChoice = canChooseSteal
                    ? {
                        id: `${attacker.playerId}-${defender.playerId}-helping-hands-reward-${timestamp}`,
                        attackerPlayerId: attacker.playerId,
                        defenderPlayerId: defender.playerId,
                        damageToDefender,
                        damageKind: attackDamageKind,
                        attackerRoll,
                        defenderRoll,
                        defenderTraitsBeforeDamage,
                    }
                    : undefined;
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'hero',
                    defenderPlayerId: defender.playerId,
                    defeatedPlayerId: defenderDefeated
                        ? defender.playerId
                        : attackerDefeated
                            ? attacker.playerId
                            : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : defenderDefeated || attackerDefeated
                            ? 'hero-defeated'
                            : 'wound',
                    attackerRoll,
                    defenderRoll,
                    damageToAttacker: damageToAttacker || undefined,
                    damageToDefender: canChooseSteal ? undefined : damageToDefender || undefined,
                    damageKind: attackDamageKind,
                    weaponCardId: weaponEffect?.card.id,
                    weaponName: weaponEffect?.card.name,
                    weaponAttackBonus: weaponEffect?.bonus || undefined,
                    weaponExtraDice: weaponEffect?.extraDice || undefined,
                    weaponSpeedCost: weaponEffect?.speedCost || undefined,
                    weaponAttackTrait: weaponEffect?.attackTrait,
                    attackRoll: {
                        id: `${attacker.playerId}-helping-hands-explorer-${timestamp}`,
                        dice: attackRoll.dice,
                        passiveBonus: attackRoll.passiveBonus,
                        latestLabel: attackerRoll === defenderRoll
                            ? '平手无伤害'
                            : canChooseSteal
                                ? `可偷牌或造成 ${damageToDefender} 点伤害`
                                : damageToDefender > 0
                                    ? `造成 ${damageToDefender} 点伤害`
                                    : `反受 ${damageToAttacker} 点伤害`,
                        attackerTraitsBeforeDamage,
                        defenderTraitsBeforeDamage,
                    },
                    deathPrevention,
                    helpingHandsAttackRewardChoice,
                    logText: canChooseSteal
                        ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}用力量攻击赢过${defender.displayName}，可选择造成 ${damageToDefender} 点伤害或偷取 1 张物品/预兆`
                        : attackerRoll === defenderRoll
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击${defender.displayName}，双方都没有受伤`
                            : defenderDefeated
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}击倒了${defender.displayName}${deathPreventionLog}`
                                : attackerDefeated
                                    ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失败并被${defender.displayName}击倒${deathPreventionLog}`
                                    : damageToDefender > 0
                                        ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击${defender.displayName}，造成 ${damageToDefender} 点 ${attackDamageLabel}${deathPreventionLog}`
                                        : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击${defender.displayName}失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`,
                }, timestamp)];
            }
            if (isMagicCameraHaunt(core)) {
                if (command.payload.target === 'phantom-photographer') {
                    const monster = findPhantomPhotographer(core, command.payload.targetMonsterId);
                    if (!monster) {
                        return [];
                    }
                    const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                    const attackTrait = weaponEffect?.attackTrait ?? 'might';
                    const attackerRoll = attackRoll.total;
                    const defenderRoll = rollTrait(random, resolveMonsterTrait(monster, attackTrait));
                    const damageToMonster = Math.max(0, attackerRoll - defenderRoll);
                    const monsterDamageOutcome = resolveBetrayalMonsterDamageOutcome(core, monster.id, {
                        damageAmount: damageToMonster,
                        damageTrait: attackTrait,
                    });
                    const killed = monsterDamageOutcome?.kind === 'killed';
                    const stunned = monsterDamageOutcome?.kind === 'stunned';
                    return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                        attackerPlayerId: attacker.playerId,
                        target: 'phantom-photographer',
                        defenderMonsterId: monster.id,
                        defeatedMonsterId: killed ? monster.id : undefined,
                        monsterDamageOutcome: monsterDamageOutcome ?? undefined,
                        outcome: killed
                            ? 'phantom-killed'
                            : stunned
                                ? 'phantom-stunned'
                                : 'no-damage',
                        attackerRoll,
                        defenderRoll,
                        weaponCardId: weaponEffect?.card.id,
                        weaponName: weaponEffect?.card.name,
                        weaponAttackBonus: weaponEffect?.bonus || undefined,
                        weaponExtraDice: weaponEffect?.extraDice || undefined,
                        weaponSpeedCost: weaponEffect?.speedCost || undefined,
                        weaponAttackTrait: weaponEffect?.attackTrait,
                        attackRoll: {
                            id: `${attacker.playerId}-phantom-photographer-${timestamp}`,
                            dice: attackRoll.dice,
                            passiveBonus: attackRoll.passiveBonus,
                            latestLabel: killed
                                ? (monsterDamageOutcome?.logLabel ?? '击杀幻影摄影师')
                                : stunned
                                    ? (monsterDamageOutcome?.logLabel ?? '击晕幻影摄影师')
                                    : '未伤到幻影摄影师',
                            attackerTraitsBeforeDamage,
                        },
                        logText: killed
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}用力量击杀了幻影摄影师`
                            : stunned
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}压制了幻影摄影师，使其眩晕`
                                : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击幻影摄影师，但没造成伤害`,
                    }, timestamp)];
                }
                const defender = command.payload.target === 'traitor'
                    ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? '')
                    : command.payload.targetPlayerId
                        ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                        : null;
                if (!defender) {
                    return [];
                }
                const defenderTraitsBeforeDamage = { ...defender.traits };
                const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                const essenceBonus = (
                    command.payload.target === 'hero'
                    && core.scenarioRuntime.magicCamera?.capturedEssencePlayerIds.includes(defender.playerId)
                ) ? 2 : 0;
                const attackerRoll = attackRoll.total + essenceBonus;
                const defenderRoll = rollAttackDefense(random, defender, weaponEffect);
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                const defenderDeathPrevention = wouldExplorerDieFromAttackDamage(defender, damageToDefender, attackDamageKind)
                    ? rollDeathPrevention(random, defender)
                    : null;
                const attackerDeathPrevention = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const defenderDefeated = wouldExplorerDieFromAttackDamage(defender, damageToDefender, attackDamageKind)
                    && !defenderDeathPrevention?.prevented;
                const attackerDefeated = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !attackerDeathPrevention?.prevented;
                const deathPrevention = defenderDeathPrevention
                    ? {
                        ...defenderDeathPrevention,
                        damageAmount: damageToDefender,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: defenderTraitsBeforeDamage,
                    }
                    : attackerDeathPrevention
                        ? {
                            ...attackerDeathPrevention,
                            damageAmount: damageToAttacker,
                            damageKind: attackDamageKind,
                            traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                        }
                        : undefined;
                const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: command.payload.target,
                    defenderPlayerId: defender.playerId,
                    defeatedPlayerId: defenderDefeated
                        ? defender.playerId
                        : attackerDefeated
                            ? attacker.playerId
                            : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : defenderDefeated
                            ? (command.payload.target === 'traitor' ? 'traitor-defeated' : 'hero-defeated')
                            : attackerDefeated
                                ? (isTraitor ? 'traitor-defeated' : 'hero-defeated')
                                : 'wound',
                    attackerRoll,
                    defenderRoll,
                    damageToAttacker: damageToAttacker || undefined,
                    damageToDefender: damageToDefender || undefined,
                    damageKind: attackDamageKind,
                    weaponCardId: weaponEffect?.card.id,
                    weaponName: weaponEffect?.card.name,
                    weaponAttackBonus: weaponEffect?.bonus || undefined,
                    weaponExtraDice: weaponEffect?.extraDice || undefined,
                    weaponSpeedCost: weaponEffect?.speedCost || undefined,
                    weaponAttackTrait: weaponEffect?.attackTrait,
                    attackRoll: {
                        id: `${attacker.playerId}-magic-camera-attack-${timestamp}`,
                        dice: attackRoll.dice,
                        passiveBonus: attackRoll.passiveBonus + essenceBonus,
                        latestLabel: attackerRoll === defenderRoll
                            ? '平手无伤害'
                            : damageToDefender > 0
                                ? `造成 ${damageToDefender} 点伤害`
                                : `反受 ${damageToAttacker} 点伤害`,
                        attackerTraitsBeforeDamage,
                        defenderTraitsBeforeDamage,
                    },
                    deathPrevention,
                    logText: attackerRoll === defenderRoll
                        ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}发起攻击，双方都没有受伤`
                        : defenderDefeated
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}击倒了${defender.displayName}${deathPreventionLog}`
                            : attackerDefeated
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失败并被击倒${deathPreventionLog}`
                                : damageToDefender > 0
                                    ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}造成 ${damageToDefender} 点 ${attackDamageLabel}${essenceBonus ? '（本质 +2）' : ''}${deathPreventionLog}`
                                    : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`,
                }, timestamp)];
            }
            if (isHelpingHandsHaunt(core)) {
                const defender = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (!defender) {
                    return [];
                }
                const defenderTraitsBeforeDamage = { ...defender.traits };
                const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = attackRoll.total;
                const defenderRoll = rollAttackDefense(random, defender, weaponEffect);
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                const defenderStealableCards = resolveHelpingHandsStealableCards(core, defender.playerId);
                const pendingAttackReward = damageToDefender > 0 && defenderStealableCards.length > 0
                    ? {
                        id: `helping-hands-attack-reward-${attacker.playerId}-${defender.playerId}-${timestamp}`,
                        attackerPlayerId: attacker.playerId,
                        defenderPlayerId: defender.playerId,
                        damageToDefender,
                        damageKind: attackDamageKind,
                        attackerRoll,
                        defenderRoll,
                        defenderTraitsBeforeDamage,
                    }
                    : undefined;
                const defenderDeathPrevention = !pendingAttackReward && wouldExplorerDieFromAttackDamage(defender, damageToDefender, attackDamageKind)
                    ? rollDeathPrevention(random, defender)
                    : null;
                const attackerDeathPrevention = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const defenderDefeated = !pendingAttackReward
                    && wouldExplorerDieFromAttackDamage(defender, damageToDefender, attackDamageKind)
                    && !defenderDeathPrevention?.prevented;
                const attackerDefeated = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !attackerDeathPrevention?.prevented;
                const deathPrevention = defenderDeathPrevention
                    ? {
                        ...defenderDeathPrevention,
                        damageAmount: damageToDefender,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: defenderTraitsBeforeDamage,
                    }
                    : attackerDeathPrevention
                        ? {
                            ...attackerDeathPrevention,
                            damageAmount: damageToAttacker,
                            damageKind: attackDamageKind,
                            traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                        }
                        : undefined;
                const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'hero',
                    defenderPlayerId: defender.playerId,
                    defeatedPlayerId: defenderDefeated
                        ? defender.playerId
                        : attackerDefeated
                            ? attacker.playerId
                            : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : defenderDefeated || attackerDefeated
                            ? 'hero-defeated'
                            : 'wound',
                    attackerRoll,
                    defenderRoll,
                    damageToAttacker: damageToAttacker || undefined,
                    damageToDefender: pendingAttackReward ? undefined : damageToDefender || undefined,
                    damageKind: attackDamageKind,
                    weaponCardId: weaponEffect?.card.id,
                    weaponName: weaponEffect?.card.name,
                    weaponAttackBonus: weaponEffect?.bonus || undefined,
                    weaponExtraDice: weaponEffect?.extraDice || undefined,
                    weaponSpeedCost: weaponEffect?.speedCost || undefined,
                    weaponAttackTrait: weaponEffect?.attackTrait,
                    attackRoll: {
                        id: `${attacker.playerId}-helping-hands-explorer-${timestamp}`,
                        dice: attackRoll.dice,
                        passiveBonus: attackRoll.passiveBonus,
                        latestLabel: attackerRoll === defenderRoll
                            ? '平手无伤害'
                            : damageToDefender > 0
                                ? pendingAttackReward
                                    ? '胜出，选择造成伤害或偷牌'
                                    : `造成 ${damageToDefender} 点伤害`
                                : `反受 ${damageToAttacker} 点伤害`,
                        attackerTraitsBeforeDamage,
                        defenderTraitsBeforeDamage,
                    },
                    deathPrevention,
                    helpingHandsAttackRewardChoice: pendingAttackReward,
                    logText: attackerRoll === defenderRoll
                        ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击${defender.displayName}，双方都没有受伤`
                        : pendingAttackReward
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}压制了${defender.displayName}，可以选择造成 ${damageToDefender} 点 ${attackDamageLabel}或偷取物品/预兆`
                            : defenderDefeated
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}击倒了${defender.displayName}${deathPreventionLog}`
                                : attackerDefeated
                                    ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失败并被${defender.displayName}击倒${deathPreventionLog}`
                                    : damageToDefender > 0
                                        ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击${defender.displayName}，造成 ${damageToDefender} 点 ${attackDamageLabel}${deathPreventionLog}`
                                        : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击${defender.displayName}失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`,
                }, timestamp)];
            }
            if (isDustHaunt(core)) {
                const attackingWithFeverish = shouldDeadPlayerControlFeverish(core, attacker.playerId);
                const feverish = attackingWithFeverish ? findFeverishMonster(core, attacker.playerId) : null;
                const targetExplorer = command.payload.targetPlayerId
                    ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                    : null;
                if (!targetExplorer) {
                    return [];
                }
                const defenderTraitsBeforeDamage = { ...targetExplorer.traits };
                const dustAttackRoll = feverish
                    ? {
                        dice: rollBetrayalDicePips(random, feverish.might),
                        passiveBonus: 0,
                    }
                    : rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = dustAttackRoll.dice.reduce((sum, pip) => sum + pip, 0) + dustAttackRoll.passiveBonus;
                const defenderRoll = rollAttackDefense(random, targetExplorer, weaponEffect);
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = feverish ? 0 : resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                const defenderDeathPrevention = wouldExplorerDieFromAttackDamage(targetExplorer, damageToDefender, attackDamageKind)
                    ? rollDeathPrevention(random, targetExplorer)
                    : null;
                const attackerDeathPrevention = !feverish && wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const defenderDefeated = wouldExplorerDieFromAttackDamage(targetExplorer, damageToDefender, attackDamageKind)
                    && !defenderDeathPrevention?.prevented;
                const attackerDefeated = !feverish
                    && wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !attackerDeathPrevention?.prevented;
                const deathPrevention = defenderDeathPrevention
                    ? {
                        ...defenderDeathPrevention,
                        damageAmount: damageToDefender,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: defenderTraitsBeforeDamage,
                    }
                    : attackerDeathPrevention
                        ? {
                            ...attackerDeathPrevention,
                            damageAmount: damageToAttacker,
                            damageKind: attackDamageKind,
                            traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                        }
                        : undefined;
                const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'hero',
                    defenderPlayerId: targetExplorer.playerId,
                    defeatedPlayerId: defenderDefeated
                        ? targetExplorer.playerId
                        : attackerDefeated
                            ? attacker.playerId
                            : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : defenderDefeated
                            ? 'hero-defeated'
                            : attackerDefeated
                                ? 'traitor-defeated'
                                : 'wound',
                    attackerRoll,
                    defenderRoll,
                    damageToAttacker: damageToAttacker || undefined,
                    damageToDefender: damageToDefender || undefined,
                    damageKind: attackDamageKind,
                    weaponCardId: weaponEffect?.card.id,
                    weaponName: weaponEffect?.card.name,
                    weaponAttackBonus: weaponEffect?.bonus || undefined,
                    weaponExtraDice: weaponEffect?.extraDice || undefined,
                    weaponSpeedCost: weaponEffect?.speedCost || undefined,
                    weaponAttackTrait: weaponEffect?.attackTrait,
                    attackRoll: feverish
                        ? undefined
                        : {
                            id: `${attacker.playerId}-dust-attack-${timestamp}`,
                            dice: dustAttackRoll.dice,
                            passiveBonus: dustAttackRoll.passiveBonus,
                            latestLabel: attackerRoll === defenderRoll
                                ? '平手无伤害'
                                : damageToDefender > 0
                                    ? `造成 ${damageToDefender} 点伤害`
                                    : `反受 ${damageToAttacker} 点伤害`,
                            attackerTraitsBeforeDamage,
                            defenderTraitsBeforeDamage,
                        },
                    deathPrevention,
                    logText: attackerRoll === defenderRoll
                        ? `${feverish ? '狂热病患' : attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}发起攻击，双方都没有受伤`
                        : defenderDefeated
                            ? `${feverish ? '狂热病患' : attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}击倒了${targetExplorer.displayName}${deathPreventionLog}`
                            : attackerDefeated
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失败并被击倒${deathPreventionLog}`
                                : damageToDefender > 0
                                    ? `${feverish ? '狂热病患' : attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}造成 ${damageToDefender} 点 ${attackDamageLabel}${deathPreventionLog}`
                                    : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`,
                }, timestamp)];
            }
            if (!isTraitor && command.payload.target === 'traitor') {
                const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? '') ?? core.otherExplorers[0];
                const defenderTraitsBeforeDamage = traitor ? { ...traitor.traits } : undefined;
                const heroBonus = core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(attacker.playerId) ? 2 : 0;
                const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = attackRoll.total + heroBonus;
                const defenderRoll = traitor ? rollAttackDefense(random, traitor, weaponEffect) : 0;
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                const attackerDeathPrevention = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const attackerDefeated = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !attackerDeathPrevention?.prevented;
                const deathPrevention = attackerDeathPrevention
                    ? {
                        ...attackerDeathPrevention,
                        damageAmount: damageToAttacker,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                    }
                    : undefined;
                const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'traitor',
                    defenderPlayerId: traitor?.playerId,
                    defeatedPlayerId: attackerDefeated ? attacker.playerId : undefined,
                    releasedJackSpiritRoomId: undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : attackerDefeated
                            ? 'hero-defeated'
                            : 'wound',
                    attackerRoll,
                    defenderRoll,
                    damageToAttacker: damageToAttacker || undefined,
                    damageToDefender: damageToDefender || undefined,
                    damageKind: attackDamageKind,
                    weaponCardId: weaponEffect?.card.id,
                    weaponName: weaponEffect?.card.name,
                    weaponAttackBonus: weaponEffect?.bonus || undefined,
                    weaponExtraDice: weaponEffect?.extraDice || undefined,
                    weaponSpeedCost: weaponEffect?.speedCost || undefined,
                    weaponAttackTrait: weaponEffect?.attackTrait,
                    attackRoll: {
                        id: `${attacker.playerId}-${command.payload.target}-${timestamp}`,
                        dice: attackRoll.dice,
                        passiveBonus: attackRoll.passiveBonus + heroBonus,
                        latestLabel: attackerRoll === defenderRoll
                            ? '平手无伤害'
                            : damageToDefender > 0
                                ? `造成 ${damageToDefender} 点伤害`
                                : `反受 ${damageToAttacker} 点伤害`,
                        attackerTraitsBeforeDamage,
                        defenderTraitsBeforeDamage,
                    },
                    deathPrevention,
                    logText: attackerRoll === defenderRoll
                        ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}与叛徒正面对攻，双方都没有受伤`
                        : attackerDefeated
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}在对攻中落败并被叛徒击倒${deathPreventionLog}`
                            : damageToDefender > 0
                                ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}在对攻中压制了叛徒，造成 ${damageToDefender} 点 ${attackDamageLabel}${deathPreventionLog}`
                                : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击叛徒失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`,
                }, timestamp)];
            }
            if (isTraitor && command.payload.target === 'hero') {
                const heroTargets = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && isAttackTargetInWeaponRange(core, attackerRoomId, explorer.roomId, weaponEffect)
                ));
                const targetHero = heroTargets.find((explorer) => explorer.playerId === command.payload.targetPlayerId);
                if (!targetHero) {
                    return [];
                }
                const defenderTraitsBeforeDamage = targetHero ? { ...targetHero.traits } : undefined;
                const attackRoll = jackSpirit
                    ? (() => {
                        const dice = rollBetrayalDicePips(random, jackSpirit.might);
                        return {
                            total: dice.reduce((sum, pip) => sum + pip, 0),
                            dice,
                            passiveBonus: 0,
                        };
                    })()
                    : rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = attackRoll.total;
                const defenderBonus = jackSpirit && targetHero && core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(targetHero.playerId)
                    ? 2
                    : 0;
                const defenderRoll = targetHero ? rollAttackDefense(random, targetHero, weaponEffect) + defenderBonus : 0;
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = jackSpirit ? 0 : resolveFailedAttackDamage(defenderRoll, attackerRoll, weaponEffect);
                const traitorDeathPrevention = !jackSpirit && wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const traitorDefeated = !jackSpirit
                    && wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !traitorDeathPrevention?.prevented;
                const releasedJackSpiritRoomId = resolveJackSpiritSpawnRoomId(core, attacker.roomId);
                const deathPrevention = traitorDeathPrevention
                    ? {
                        ...traitorDeathPrevention,
                        damageAmount: damageToAttacker,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: { ...attackerTraitsBeforeDamage },
                        releasedJackSpiritRoomId,
                    }
                    : undefined;
                const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
                return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    target: 'hero',
                    defenderPlayerId: targetHero?.playerId,
                    defeatedPlayerId: traitorDefeated ? attacker.playerId : undefined,
                    releasedJackSpiritRoomId: traitorDefeated ? releasedJackSpiritRoomId : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : traitorDefeated
                            ? 'traitor-defeated'
                            : 'wound',
                    attackerRoll,
                    defenderRoll,
                    damageToAttacker: damageToAttacker || undefined,
                    damageToDefender: damageToDefender || undefined,
                    damageKind: attackDamageKind,
                    weaponCardId: weaponEffect?.card.id,
                    weaponName: weaponEffect?.card.name,
                    weaponAttackBonus: weaponEffect?.bonus || undefined,
                    weaponExtraDice: weaponEffect?.extraDice || undefined,
                    weaponSpeedCost: weaponEffect?.speedCost || undefined,
                    weaponAttackTrait: weaponEffect?.attackTrait,
                    attackRoll: {
                        id: `${jackSpirit ? jackSpirit.id : attacker.playerId}-${command.payload.target}-${timestamp}`,
                        dice: attackRoll.dice,
                        passiveBonus: attackRoll.passiveBonus,
                        latestLabel: attackerRoll === defenderRoll
                            ? '平手无伤害'
                            : damageToDefender > 0
                                ? `造成 ${damageToDefender} 点伤害`
                                : `反受 ${damageToAttacker} 点伤害`,
                        attackerTraitsBeforeDamage: jackSpirit
                            ? {
                                might: jackSpirit.might,
                                speed: jackSpirit.speed ?? 3,
                                knowledge: jackSpirit.knowledge ?? 3,
                                sanity: jackSpirit.sanity ?? 3,
                            }
                            : attackerTraitsBeforeDamage,
                        defenderTraitsBeforeDamage,
                    },
                    deathPrevention,
                    logText: attackerRoll === defenderRoll
                        ? `${jackSpirit ? '杰克之灵' : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}`}扑向英雄，但双方对攻后都没有受伤`
                        : traitorDefeated
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}攻击失手，反而在对攻中被英雄击倒${deathPreventionLog}`
                            : damageToDefender > 0
                                ? `${jackSpirit ? '杰克之灵' : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}`}在对攻中压制了英雄，造成 ${damageToDefender} 点 ${attackDamageLabel}${deathPreventionLog}`
                                : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}发起攻击失败，反受 ${damageToAttacker} 点 ${attackDamageLabel}${deathPreventionLog}`,
                }, timestamp)];
            }
            const heroBonus = core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(attacker.playerId) ? 2 : 0;
            const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
            const attackerRoll = attackRoll.total + heroBonus;
            const jackSpiritDefense = rollTrait(random, 5);
            return [nowEvent(EVENTS.HAUNT_ATTACK_RESOLVED, {
                attackerPlayerId: attacker.playerId,
                target: 'jack-spirit',
                outcome: attackerRoll > jackSpiritDefense ? 'jack-damaged' : 'wound',
                attackerRoll,
                defenderRoll: jackSpiritDefense,
                weaponCardId: weaponEffect?.card.id,
                weaponName: weaponEffect?.card.name,
                weaponAttackBonus: weaponEffect?.bonus || undefined,
                weaponExtraDice: weaponEffect?.extraDice || undefined,
                weaponSpeedCost: weaponEffect?.speedCost || undefined,
                weaponAttackTrait: weaponEffect?.attackTrait,
                attackRoll: {
                    id: `${attacker.playerId}-${command.payload.target}-${timestamp}`,
                    dice: attackRoll.dice,
                    passiveBonus: attackRoll.passiveBonus + heroBonus,
                    latestLabel: attackerRoll > jackSpiritDefense ? '压制杰克之灵' : '未压制杰克之灵',
                    attackerTraitsBeforeDamage,
                },
                logText: attackerRoll > jackSpiritDefense
                    ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}压制住了杰克之灵`
                    : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}尝试攻击杰克之灵，但没能造成有效压制`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE: {
            const outcome = resolveBetrayalMonsterDamageOutcome(core, command.payload.monsterId!, {
                damageAmount: command.payload.damageAmount!,
                damageTrait: command.payload.damageTrait!,
            });
            if (!outcome) {
                return [];
            }
            return [nowEvent(EVENTS.MONSTER_DAMAGE_RESOLVED, {
                playerId: command.playerId,
                monsterId: outcome.monsterId,
                monsterName: outcome.name,
                damageAmount: outcome.damageAmount,
                damageTrait: outcome.damageTrait,
                monsterDamageOutcome: outcome,
                logText: `${outcome.name}承受 ${outcome.damageAmount} 点伤害：${outcome.logLabel}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START: {
            const monsterId = command.payload.monsterId!;
            const preview = resolveBetrayalMonsterTurnStartResolutionPreview(core, monsterId);
            if (!preview.canResolve || !preview.name || !preview.status || !preview.nextStatus) {
                return [];
            }
            const logText = preview.willFlipStunnedSideUp
                ? `${preview.name}翻回正面，并跳过本次怪物回合`
                : preview.willSkipTurn
                    ? `${preview.name}跳过本次怪物回合`
                    : `${preview.name}开始怪物回合`;
            return [nowEvent(EVENTS.MONSTER_TURN_START_RESOLVED, {
                playerId: command.playerId,
                monsterId,
                monsterName: preview.name,
                previousStatus: preview.status,
                nextStatus: preview.nextStatus,
                flippedStunnedSideUp: preview.willFlipStunnedSideUp,
                skippedTurn: preview.willSkipTurn,
                startedTurn: preview.willStartTurn,
                movementGroupId: preview.movementGroupId ?? undefined,
                logText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP: {
            const result = createBetrayalMonsterMovementRollGroupResult(
                core,
                command.payload.groupId!,
                command.playerId,
                random,
            );
            if (!result) {
                return [];
            }
            return [nowEvent(EVENTS.MONSTER_MOVEMENT_GROUP_ROLLED, {
                result,
                logText: `${result.monsterName}速度 ${result.speed} 投出 ${result.dice.join('、')}，每只本回合可移动 ${result.moveAllowance} 间`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM: {
            const monster = core.monsters.find((item) => item.id === command.payload.monsterId);
            const targetRoom = command.payload.roomId
                ? core.rooms.find((room) => room.id === command.payload.roomId)
                : null;
            if (!monster || !targetRoom) {
                return [];
            }
            const canMummyTeleportNow = hasMummyTeleportMoveAvailable(core, monster.id);
            const moveCost = canMummyTeleportNow ? 0 : resolveBetrayalMonsterMoveCost(core, monster.id);
            const moveRemainingAfterCost = Math.max(
                0,
                (core.scenarioRuntime.monsterTurn?.moveRemainingById?.[monster.id] ?? 0) - moveCost,
            );
            const moveRemaining = canMummyTeleportNow
                ? 0
                : resolveStoneCherubMoveRemainingAfterMove(
                    core,
                    monster,
                    targetRoom.id,
                    moveRemainingAfterCost,
                );
            const stoppedInHeroLineOfSight = moveRemainingAfterCost > 0 && moveRemaining === 0;
            return [nowEvent(EVENTS.MONSTER_MOVED, {
                playerId: command.playerId,
                monsterId: monster.id,
                monsterName: monster.name,
                fromRoomId: monster.roomId,
                toRoomId: targetRoom.id,
                moveCost,
                moveRemaining,
                teleportMove: canMummyTeleportNow,
                logText: canMummyTeleportNow
                    ? `${monster.name}从${core.rooms.find((room) => room.id === monster.roomId)?.name ?? monster.roomId}瞬移到${targetRoom.name}`
                    : `${monster.name}从${core.rooms.find((room) => room.id === monster.roomId)?.name ?? monster.roomId}移动到${targetRoom.name}，消耗 ${moveCost} 点移动${stoppedInHeroLineOfSight ? '；进入英雄视线后立即停止' : ''}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN: {
            const preview = resolveBloodFromStoneMonsterTurnEndPreview(core);
            if (!preview.canEnd || !preview.nextPlayerId) {
                return [];
            }
            const damageRolls = resolveBloodFromStoneGazeDamageRolls(core, random);
            const nextExplorer = findExplorerByPlayerId(core, preview.nextPlayerId);
            const turnLogText = nextExplorer ? `轮到${nextExplorer.displayName}` : '进入下一位玩家回合';
            const damageLogText = damageRolls.length > 0
                ? damageRolls.map((roll) => (
                    `${roll.explorerName}视线内有 ${roll.visibleStoneCherubIds.length} 个石像小天使，投出 ${roll.dice.join('、') || '0'}，承受 ${roll.amount} 点一般伤害`
                )).join('；')
                : '没有英雄处于石像小天使视线内';
            return [nowEvent(EVENTS.BLOOD_FROM_STONE_MONSTER_TURN_ENDED, {
                controllerPlayerId: command.playerId,
                nextPlayerId: preview.nextPlayerId,
                damageRolls,
                logText: `石像小天使怪物回合结束；${damageLogText}`,
                turnLogText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.PLACE_BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS: {
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            const existingExtraPlacementCount = plan.automaticExtraPlacements.length + plan.playerChoicePlacements.length;
            const placements = resolveBloodFromStoneSelectedExtraStoneCherubPlacements(
                core,
                command.payload.roomIds ?? [],
                existingExtraPlacementCount,
            );
            if (placements.length === 0) {
                return [];
            }
            const roomNames = placements.map((placement) => placement.roomName).join('、');
            return [nowEvent(EVENTS.BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED, {
                playerId: command.playerId,
                placements,
                logText: `补放 ${placements.length} 个石像小天使：${roomNames}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO: {
            const monster = core.monsters.find((item) => item.id === command.payload.monsterId);
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!monster || !target) {
                return [];
            }
            const attackTrait = resolveMonsterDefaultAttackTrait(monster);
            const damageKind = resolveAttackDamageKind(attackTrait);
            const monsterDice = rollBetrayalDicePips(random, resolveMonsterTrait(monster, attackTrait));
            const monsterRoll = monsterDice.reduce((sum, pip) => sum + pip, 0);
            const heroRoll = rollAttackDefense(random, target, null, attackTrait);
            const damageToHero = Math.max(0, monsterRoll - heroRoll);
            const damageToMonster = Math.max(0, heroRoll - monsterRoll);
            const monsterDamageOutcome = damageToMonster > 0
                ? resolveBetrayalMonsterDamageOutcome(core, monster.id, {
                    damageAmount: damageToMonster,
                    damageTrait: attackTrait,
                })
                : null;
            const resultText = monsterRoll === heroRoll
                ? '双方都没有受伤'
                : damageToHero > 0
                    ? `造成 ${damageToHero} 点 ${damageKind} damage`
                    : (monsterDamageOutcome?.logLabel ?? `承受 ${damageToMonster} 点伤害`);
            return [nowEvent(EVENTS.MONSTER_ATTACK_HERO_RESOLVED, {
                playerId: command.playerId,
                monsterId: monster.id,
                monsterName: monster.name,
                targetPlayerId: target.playerId,
                attackTrait,
                damageKind,
                monsterRoll,
                heroRoll,
                damageToHero: damageToHero || undefined,
                monsterDamageOutcome: monsterDamageOutcome ?? undefined,
                dice: monsterDice,
                defenderTraitsBeforeDamage: { ...target.traits },
                logText: `${monster.name}攻击${target.displayName}，${resultText}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD: {
            const pending = resolveHelpingHandsPendingAttackReward(core);
            const attacker = pending ? findExplorerByPlayerId(core, pending.attackerPlayerId) : null;
            const defender = pending ? findExplorerByPlayerId(core, pending.defenderPlayerId) : null;
            if (!pending || !attacker || !defender) {
                return [];
            }
            if (command.payload.choice === 'steal') {
                const card = defender.inventory.find((item) => item.id === command.payload.cardId);
                if (!card || (card.kind !== 'item' && card.kind !== 'omen')) {
                    return [];
                }
                return [nowEvent(EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED, {
                    attackerPlayerId: attacker.playerId,
                    defenderPlayerId: defender.playerId,
                    choice: 'steal',
                    stolenCardId: card.id,
                    stolenCardName: card.name,
                    logText: `${attacker.displayName}没有造成伤害，改为从${defender.displayName}手中偷走${card.name}`,
                }, timestamp)];
            }
            const deathPreventionRoll = wouldExplorerDieFromAttackDamage(defender, pending.damageToDefender, pending.damageKind)
                ? rollDeathPrevention(random, defender)
                : null;
            const defenderDefeated = wouldExplorerDieFromAttackDamage(defender, pending.damageToDefender, pending.damageKind)
                && !deathPreventionRoll?.prevented;
            const deathPrevention = deathPreventionRoll
                ? {
                    ...deathPreventionRoll,
                    damageAmount: pending.damageToDefender,
                    damageKind: pending.damageKind,
                    traitsBeforeDamage: { ...pending.defenderTraitsBeforeDamage },
                }
                : undefined;
            const deathPreventionLog = formatDeathPreventionLog(deathPrevention);
            return [nowEvent(EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED, {
                attackerPlayerId: attacker.playerId,
                defenderPlayerId: defender.playerId,
                choice: 'damage',
                damageToDefender: pending.damageToDefender,
                damageKind: pending.damageKind,
                defeatedPlayerId: defenderDefeated ? defender.playerId : undefined,
                deathPrevention,
                logText: `${attacker.displayName}选择造成 ${pending.damageToDefender} 点 ${pending.damageKind} damage${deathPreventionLog}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD: {
            const pending = resolveMummyPendingAttackReward(core);
            const defender = pending ? findExplorerByPlayerId(core, pending.defenderPlayerId) : null;
            if (!pending || !defender) {
                return [];
            }
            if (command.payload.choice === 'steal') {
                const cardId = command.payload.cardId;
                const stolenCard = cardId === MUMMY_GIRL_STEAL_CARD_ID
                    ? resolveMummyGirlStealCard()
                    : defender.inventory.find((item) => item.id === cardId);
                if (!stolenCard || (stolenCard.kind !== 'item' && stolenCard.kind !== 'omen')) {
                    return [];
                }
                return [nowEvent(EVENTS.MUMMY_ATTACK_REWARD_RESOLVED, {
                    controllerPlayerId: pending.controllerPlayerId,
                    monsterId: pending.monsterId,
                    monsterName: pending.monsterName,
                    defenderPlayerId: defender.playerId,
                    choice: 'steal',
                    stolenCardId: stolenCard.id,
                    stolenCardName: stolenCard.name,
                    logText: `${pending.monsterName}没有造成伤害，改为从${defender.displayName}手中夺走${stolenCard.name}`,
                }, timestamp)];
            }
            return [nowEvent(EVENTS.MUMMY_ATTACK_REWARD_RESOLVED, {
                controllerPlayerId: pending.controllerPlayerId,
                monsterId: pending.monsterId,
                monsterName: pending.monsterName,
                defenderPlayerId: defender.playerId,
                choice: 'damage',
                damageToHero: pending.damageToHero,
                damageKind: 'physical',
                logText: `${pending.monsterName}选择造成 ${pending.damageToHero} 点 physical damage`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND: {
            const monster = findHelpingHandsTrollHand(core, command.payload.monsterId);
            const targetRoom = command.payload.roomId
                ? core.rooms.find((room) => room.id === command.payload.roomId)
                : null;
            if (!monster || !targetRoom) {
                return [];
            }
            const moveCost = resolveHelpingHandsTrollHandMoveCost(core, monster.id);
            const helpingHands = core.scenarioRuntime.helpingHands;
            const moveRemaining = Math.max(
                0,
                (helpingHands?.trollHandMoveRemainingById[monster.id] ?? 0) - moveCost,
            );
            return [nowEvent(EVENTS.HELPING_HANDS_TROLL_HAND_MOVED, {
                controllerPlayerId: command.playerId,
                monsterId: monster.id,
                fromRoomId: monster.roomId,
                toRoomId: targetRoom.id,
                moveCost,
                moveRemaining,
                logText: `${monster.name}从${core.rooms.find((room) => room.id === monster.roomId)?.name ?? monster.roomId}移动到${targetRoom.name}，消耗 ${moveCost} 点移动`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK: {
            const options = resolveHelpingHandsTrollHandAttackOptions(core);
            const option = command.payload.combined
                ? options.find((item) => item.combined)
                : options.find((item) => !item.combined && item.trollHandIds[0] === command.payload.monsterId);
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            if (!option || !target) {
                return [];
            }
            const defenderTraitsBeforeDamage = { ...target.traits };
            const dice = rollBetrayalDicePips(random, option.might);
            const attackerRoll = dice.reduce((sum, pip) => sum + pip, 0);
            const defenderRoll = rollTrait(random, target.traits.might);
            const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
            return [nowEvent(EVENTS.HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED, {
                controllerPlayerId: command.playerId,
                targetPlayerId: target.playerId,
                trollHandIds: option.trollHandIds,
                combined: option.combined,
                attackDice: dice,
                attackerRoll,
                defenderRoll,
                damageToDefender: damageToDefender || undefined,
                defenderTraitsBeforeDamage,
                logText: damageToDefender > 0
                    ? `${option.label}攻击${target.displayName}，造成 ${damageToDefender} 点 physical damage`
                    : `${option.label}攻击${target.displayName}，但没有造成伤害`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            if (!helpingHands) {
                return [];
            }
            const nextPlayerId = rotateToNextLivingPlayer(
                core,
                helpingHands.monsterTurnAfterPlayerId,
            );
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId);
            return [nowEvent(EVENTS.HELPING_HANDS_MONSTER_TURN_ENDED, {
                controllerPlayerId: command.playerId,
                nextPlayerId,
                logText: `巨魔手怪物回合结束${nextExplorer ? `，轮到${nextExplorer.displayName}` : ''}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.SEARCH_FOR_CURE: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId)!;
            const trait = command.payload.trait ?? 'knowledge';
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, trait);
            const success = roll.total >= 5;
            const leftPlayerId = success ? null : resolveNextLivingPlayerIdInTurnOrder(core, actor.playerId);
            const swap = !success && leftPlayerId && core.scenarioRuntime.dust
                ? resolveDustSicknessSwap(core.scenarioRuntime.dust, actor.playerId, leftPlayerId, random) ?? undefined
                : undefined;
            return [nowEvent(EVENTS.DUST_SEARCH_RESOLVED, {
                playerId: actor.playerId,
                roomId: room.id,
                trait,
                rollTotal: roll.total,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                success,
                swap,
                logText: success
                    ? `${actor.displayName}寻找解药成功，在${room.name}放置了研究标记`
                    : `${actor.displayName}寻找解药失败${swap ? '，与左侧玩家随机交换了疾病标记' : ''}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.CURE_THE_DUST: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId)!;
            const trait = command.payload.trait ?? 'knowledge';
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, trait);
            const researchBonus = (core.scenarioRuntime.dust?.researchRoomIds.length ?? 0) * 2;
            const rollTotal = roll.total + researchBonus;
            const success = rollTotal >= 13;
            const leftPlayerId = success ? null : resolveNextLivingPlayerIdInTurnOrder(core, actor.playerId);
            const swap = !success && leftPlayerId && core.scenarioRuntime.dust
                ? resolveDustSicknessSwap(core.scenarioRuntime.dust, actor.playerId, leftPlayerId, random) ?? undefined
                : undefined;
            return [nowEvent(EVENTS.DUST_CURE_RESOLVED, {
                playerId: actor.playerId,
                roomId: room.id,
                trait,
                rollTotal,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                researchBonus,
                success,
                swap,
                logText: success
                    ? `${actor.displayName}完成治愈灰尘，英雄阵营胜利`
                    : `${actor.displayName}尝试治愈灰尘失败${swap ? '，与左侧玩家随机交换了疾病标记' : ''}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE: {
            const requester = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const target = findExplorerByPlayerId(core, command.payload.targetPlayerId ?? '');
            return [nowEvent(EVENTS.SICKNESS_EXCHANGE_REQUESTED, {
                requesterPlayerId: requester.playerId,
                targetPlayerId: target?.playerId ?? command.payload.targetPlayerId ?? '',
                logText: `${requester.displayName}请求交换疾病标记`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE: {
            const pending = core.scenarioRuntime.dust?.pendingSicknessExchange;
            if (!pending) {
                return [];
            }
            const requester = findExplorerByPlayerId(core, pending.requesterPlayerId);
            const target = findExplorerByPlayerId(core, pending.targetPlayerId);
            const accepted = command.payload.accept;
            const swap = accepted && core.scenarioRuntime.dust
                ? resolveDustSicknessSwap(
                    core.scenarioRuntime.dust,
                    pending.requesterPlayerId,
                    pending.targetPlayerId,
                    random,
                ) ?? undefined
                : undefined;
            return [nowEvent(EVENTS.SICKNESS_EXCHANGE_RESOLVED, {
                requesterPlayerId: pending.requesterPlayerId,
                targetPlayerId: pending.targetPlayerId,
                accepted,
                swap,
                logText: accepted && swap
                    ? `${target?.displayName ?? '目标玩家'}同意了${requester?.displayName ?? '请求者'}的疾病标记交换`
                    : `${target?.displayName ?? '目标玩家'}拒绝了疾病标记交换`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.CONFIRM_HAUNT_SETUP_ENTRY: {
            const entryId = command.payload.entryId!;
            return [nowEvent(EVENTS.HAUNT_SETUP_ENTRY_CONFIRMED, {
                playerId: command.playerId,
                entryId,
                logText: entryId === 'monster-card-left-of-revealer'
                    ? '确认怪物参考卡已放在作祟揭秘者左侧。'
                    : '确认已准备 8 个研究 token，后续由寻找解药行动放置到对应房间。',
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.TAKE_PHOTO: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const target = findExplorerByPlayerId(core, command.payload.targetPlayerId ?? '');
            if (!target) {
                return [];
            }
            const trait = command.payload.trait ?? 'speed';
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'speed');
            const success = roll.total >= 6;
            return [nowEvent(EVENTS.PHOTO_TAKEN, {
                playerId: actor.playerId,
                targetPlayerId: target.playerId,
                trait,
                rollTotal: roll.total,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                success,
                logText: success
                    ? `${actor.displayName}拍下${target.displayName}，夺取本质并提升${TRAIT_LABEL[trait]}`
                    : `${actor.displayName}尝试拍下${target.displayName}，但照片失焦了`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'sanity');
            const success = roll.total >= 6;
            return [nowEvent(EVENTS.MAGIC_CAMERA_SMASHED, {
                playerId: actor.playerId,
                rollTotal: roll.total,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                success,
                logText: success
                    ? `${actor.displayName}砸毁了魔法相机`
                    : `${actor.displayName}尝试砸毁魔法相机，但没能成功`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK: {
            const monster = findPhantomPhotographer(core, command.payload.monsterId);
            const target = findExplorerByPlayerId(core, command.payload.targetPlayerId ?? '');
            if (!monster || !target) {
                return [];
            }
            const dice = rollBetrayalDicePips(random, monster.sanity ?? 6);
            const monsterRoll = dice.reduce((sum, pip) => sum + pip, 0);
            const heroRoll = rollTrait(random, target.traits.sanity);
            const damageToHero = Math.max(0, monsterRoll - heroRoll);
            const defeated = wouldExplorerDieFromMentalDamage(target, damageToHero);
            return [nowEvent(EVENTS.PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED, {
                monsterId: monster.id,
                targetPlayerId: target.playerId,
                monsterRoll,
                heroRoll,
                damageToHero: damageToHero || undefined,
                defeatedPlayerId: defeated ? target.playerId : undefined,
                dice,
                logText: damageToHero > 0
                    ? `幻影摄影师用闪光攻击${target.displayName}，造成 ${damageToHero} 点精神伤害`
                    : `幻影摄影师拍向${target.displayName}，但没造成精神伤害`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.PLAY_PEEKABOO: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const selection = resolveBloodFromStonePeekabooSelection(
                core,
                actor,
                command.payload.sameRoomMonsterId,
                command.payload.lineOfSightMonsterId,
            );
            if (!selection.option) {
                return [];
            }
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'knowledge');
            const mirrorBonus = hasBloodFromStoneMirror(actor) ? 2 : 0;
            const rollTotal = roll.total + mirrorBonus;
            const success = rollTotal >= 4;
            const damageDice = success ? undefined : rollBetrayalDicePips(random, 2);
            const damageAmount = damageDice?.reduce((sum, pip) => sum + pip, 0);
            return [nowEvent(EVENTS.BLOOD_FROM_STONE_PEEKABOO_RESOLVED, {
                playerId: actor.playerId,
                sameRoomMonsterId: selection.option.sameRoomMonsterId,
                lineOfSightMonsterId: selection.option.lineOfSightMonsterId,
                rollTotal,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                mirrorBonus,
                success,
                damageDice,
                damageAmount,
                logText: success
                    ? `${actor.displayName}玩躲猫猫成功，移除了两只石像小天使`
                    : `${actor.displayName}玩躲猫猫失败，承受 ${damageAmount ?? 0} 点一般伤害`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.GIVE_MIRROR_HINT: {
            const revealer = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const target = command.payload.targetPlayerId
                ? findExplorerByPlayerId(core, command.payload.targetPlayerId)
                : null;
            const eventCard = resolveUponReflectionHintEvent(core, command.payload.eventName);
            if (!target || !eventCard) {
                return [];
            }
            return [nowEvent(EVENTS.UPON_REFLECTION_EVENT_HINT_GIVEN, {
                revealerPlayerId: revealer.playerId,
                targetPlayerId: target.playerId,
                eventName: eventCard.name,
                eventText: eventCard.text,
                turnNumber: core.turnNumber,
                logText: `作祟揭秘者用事件牌「${eventCard.name}」给${target.displayName}作镜中提示；该事件不结算并放到一边`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.BREAK_MIRROR_CURSE: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const trait = command.payload.trait!;
            const selectedOmen = resolveUponReflectionOmenSelection(actor, command.payload);
            const secret = core.scenarioRuntime.uponReflection?.secretCombination;
            if (!selectedOmen || !secret) {
                return [];
            }
            const roomId = resolveControlledRoomId(core, actor);
            const room = core.rooms.find((item) => item.id === roomId);
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, trait);
            const successRoll = roll.total >= 5;
            const omenMatches = resolveInventoryEffectId(selectedOmen.id) === secret.omenId
                || selectedOmen.name === secret.omenName;
            const combinationCorrect = Boolean(
                successRoll
                && trait === secret.trait
                && omenMatches
                && roomMatchesUponReflectionSecret(room, secret)
            );
            return [nowEvent(EVENTS.UPON_REFLECTION_CURSE_BREAK_ATTEMPTED, {
                playerId: actor.playerId,
                roomId,
                roomName: room?.name ?? '当前房间',
                trait,
                omenId: resolveInventoryEffectId(selectedOmen.id),
                omenName: selectedOmen.name,
                rollTotal: roll.total,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                successRoll,
                combinationCorrect,
                logText: combinationCorrect
                    ? `${actor.displayName}完成破咒，镜中诅咒被打破`
                    : successRoll
                        ? `${actor.displayName}尝试破咒，作祟揭秘者给出否定反馈`
                        : `${actor.displayName}尝试破咒，但没有得到镜中反馈`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK: {
            const actor = core.currentExplorer;
            const rollTotal = rollNonCombatTraitCheck(random, core, actor, 'knowledge');
            const grantedToExplorer = rollTotal >= 5
                ? getAllExplorers(core).find((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(explorer.playerId)
                )) ?? actor
                : null;
            const grantedToPlayerId = grantedToExplorer?.playerId ?? null;
            return [nowEvent(EVENTS.JACK_LEARNED, {
                playerId: command.playerId,
                grantedToPlayerId,
                rollTotal,
                success: rollTotal >= 5,
                logText: rollTotal >= 5
                    ? `${actor.displayName}在图书馆查到了 Crimson Jack 的线索，交给${grantedToExplorer?.displayName ?? actor.displayName}`
                    : `${actor.displayName}翻遍了图书馆，但还没找到足够线索`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.STUDY_EXORCISM: {
            const actor = core.currentExplorer;
            const rollTotal = rollNonCombatTraitCheck(random, core, actor, 'knowledge');
            return [nowEvent(EVENTS.EXORCISM_STUDIED, {
                playerId: command.playerId,
                roomId: actor.roomId,
                rollTotal,
                success: rollTotal >= 5,
                logText: rollTotal >= 5
                    ? `${actor.displayName}布置了一处驱魔法阵`
                    : `${actor.displayName}研究驱魔失败，精神受到了反噬`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.EXORCISE_JACK: {
            const actor = core.currentExplorer;
            const regionBonus = countExorcismCirclesInRegion(core, actor.roomId);
            const sanityRoll = rollNonCombatTraitCheckWithDice(random, core, actor, 'sanity');
            const rollTotal = sanityRoll.total + regionBonus;
            return [nowEvent(EVENTS.JACK_EXORCISED, {
                playerId: command.playerId,
                roomId: actor.roomId,
                rollTotal,
                dice: sanityRoll.dice,
                passiveBonus: sanityRoll.passiveBonus,
                regionBonus,
                success: rollTotal >= 7,
                logText: rollTotal >= 7
                    ? `${actor.displayName}成功驱散了杰克之灵`
                    : `${actor.displayName}尝试驱魔失败，杰克之灵反扑了所有英雄`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.STUDY_MUMMY_NAME: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId);
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'knowledge');
            const success = roll.total >= 6;
            return [nowEvent(EVENTS.MUMMY_NAME_STUDIED, {
                playerId: actor.playerId,
                roomId: actor.roomId,
                rollTotal: roll.total,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                success,
                logText: success
                    ? `${actor.displayName}在${room?.name ?? '当前房间'}找到了木乃伊真名，取得第 1 枚知识标记`
                    : `${actor.displayName}寻找木乃伊真名失败，暂未取得知识标记`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const roll = rollNonCombatTraitCheckWithDice(random, core, actor, 'knowledge');
            const success = roll.total >= 6;
            return [nowEvent(EVENTS.MUMMY_BANISHMENT_LEARNED, {
                playerId: actor.playerId,
                roomId: actor.roomId,
                rollTotal: roll.total,
                dice: roll.dice,
                passiveBonus: roll.passiveBonus,
                success,
                logText: success
                    ? `${actor.displayName}用书本学会驱逐木乃伊的法术，取得第 2 枚知识标记`
                    : `${actor.displayName}翻查书本失败，尚未学会驱逐法术`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.BANISH_MUMMY: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const mummy = findMummyMonster(core);
            if (!mummy) {
                return [];
            }
            const heroRoll = rollTraitCheckWithDice(random, actor, 'sanity', core);
            const mummyDice = rollBetrayalDicePips(random, resolveMonsterTrait(mummy, 'sanity'));
            const mummyRoll = mummyDice.reduce((sum, pip) => sum + pip, 0);
            const success = heroRoll.total > mummyRoll;
            return [nowEvent(EVENTS.MUMMY_BANISHED, {
                playerId: actor.playerId,
                roomId: actor.roomId,
                heroRoll: heroRoll.total,
                mummyRoll,
                heroDice: heroRoll.dice,
                mummyDice,
                passiveBonus: heroRoll.passiveBonus,
                success,
                logText: success
                    ? `${actor.displayName}以神志压过木乃伊，将木乃伊驱逐回亡者之国`
                    : `${actor.displayName}驱逐木乃伊失败，木乃伊仍在宅邸中`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const room = core.rooms.find((item) => item.id === actor.roomId);
            return [nowEvent(EVENTS.MUMMY_GIRL_PICKED_UP, {
                playerId: actor.playerId,
                roomId: actor.roomId,
                logText: `${actor.displayName}在${room?.name ?? '当前房间'}拾起了女孩`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const mummy = findMummyMonster(core);
            if (!mummy) {
                return [];
            }
            const room = core.rooms.find((item) => item.id === actor.roomId);
            return [nowEvent(EVENTS.MUMMY_GIRL_GIVEN, {
                playerId: actor.playerId,
                monsterId: mummy.id,
                roomId: actor.roomId,
                logText: `${actor.displayName}在${room?.name ?? '当前房间'}把女孩交给了木乃伊`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY: {
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const mummy = findMummyMonster(core);
            const card = findMummyWeddingOmenCard(actor, command.payload.cardId);
            if (!mummy || !card) {
                return [];
            }
            const room = core.rooms.find((item) => item.id === actor.roomId);
            return [nowEvent(EVENTS.MUMMY_OMEN_GIVEN, {
                playerId: actor.playerId,
                monsterId: mummy.id,
                roomId: actor.roomId,
                cardId: card.id,
                cardName: card.name,
                logText: `${actor.displayName}在${room?.name ?? '当前房间'}把${card.name}交给了木乃伊`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return [];
        default:
            return [];
    }
}

function reduceEvent(state: BetrayalCore, event: BetrayalEvent): BetrayalCore {
    const core = cloneCore(state);
    switch (event.type) {
        case EVENTS.EXPLORER_SELECTED:
            {
                const scenarioCardConfirmations = { ...core.scenarioCardConfirmations };
                delete scenarioCardConfirmations[event.payload.playerId];
                return {
                ...core,
                    selectedExplorerByPlayerId: {
                        ...core.selectedExplorerByPlayerId,
                        [event.payload.playerId]: event.payload.explorerId,
                    },
                    readyPlayerIds: core.readyPlayerIds.filter((playerId) => playerId !== event.payload.playerId),
                    scenarioCardConfirmations,
                };
            }
        case EVENTS.EXPLORER_CONFIRMED:
            return core.readyPlayerIds.includes(event.payload.playerId)
                ? core
                : { ...core, readyPlayerIds: [...core.readyPlayerIds, event.payload.playerId] };
        case EVENTS.SCENARIO_CARD_PROPOSED:
            return {
                ...core,
                proposedScenarioCardId: event.payload.candidateId,
                scenarioCardConfirmations: {},
                activityLog: appendActivity(core, event.payload.logText, 'neutral'),
            };
        case EVENTS.SCENARIO_CARD_CONFIRMED:
            return {
                ...core,
                scenarioCardConfirmations: {
                    ...core.scenarioCardConfirmations,
                    [event.payload.playerId]: event.payload.candidateId,
                },
                activityLog: appendActivity(core, event.payload.logText, 'accent'),
            };
        case EVENTS.SCENARIO_STARTED: {
            core.scenarioId = event.payload.scenarioId;
            const scenario = scenarioConfigById(event.payload.scenarioId);
            const explorers = buildScenarioExplorers(core);
            const firstPlayerId = explorers[0]?.playerId ?? core.currentPlayer;
            core.scenarioRuntime = createInitialScenarioRuntimeStatus();
            ensureLibraryPresent(core);
            const startedCore = replaceExplorers({
                ...core,
                phase: 'preHaunt',
                currentPlayer: firstPlayerId,
                turnStartSpeed: 0,
                movesRemaining: 0,
                recommendedAction: 'explore',
                activeRoomId: explorers[0]?.roomId ?? core.activeRoomId,
                usedCardIdsThisTurn: [],
                tradeUsedThisTurnPlayerIds: [],
                receivedCardIdsThisTurnByPlayerId: {},
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                pendingTradeAgreement: null,
                activePlayerId: null,
                activityLog: [{ id: `scenario-started-${scenario.id}`, text: scenario.logs.scenarioStarted, tone: 'accent' }],
                endgameResult: null,
            }, explorers, firstPlayerId);
            const turnStartSpeed = resolveTurnStartSpeed(startedCore, firstPlayerId);
            return {
                ...startedCore,
                turnStartSpeed,
                movesRemaining: turnStartSpeed,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(startedCore, firstPlayerId),
            };
        }
        case EVENTS.EXPLORER_MOVED: {
            if (event.payload.controlledToken === 'jack-spirit') {
                core.scenarioRuntime.jackSpiritRoomId = event.payload.roomId;
                core.scenarioRuntime.jackSpiritHasMovedSinceRelease = true;
                core.monsters = core.monsters.map((monster) => (
                    monster.id === 'jack-spirit'
                        ? { ...monster, roomId: event.payload.roomId }
                        : monster
                ));
            } else if (event.payload.controlledToken === 'feverish') {
                core.monsters = core.monsters.map((monster) => (
                    monster.id === `feverish-${event.payload.playerId}`
                        ? { ...monster, roomId: event.payload.roomId }
                        : monster
                ));
            } else {
                core.currentExplorer.roomId = event.payload.roomId;
            }
            if (event.payload.consumeMove !== false) {
                core.movesRemaining = Math.max(0, core.movesRemaining - (event.payload.moveCost ?? 1));
            }
            if (event.payload.skeletonKeyBuried && event.payload.skeletonKeyCardId) {
                core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== event.payload.skeletonKeyCardId);
            }
            if (event.payload.usedActionId) {
                core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.usedActionId];
            }
            core.highlightedDeckKind = null;
            core.latestDiscovery = null;
            core.latestDiscoveryOwnerPlayerId = null;
            core.latestRoomDrawResolution = null;
            core.pendingEventChoice = null;
            if (event.payload.bloodFromStoneTurnStartVisibleStoneCherubIds) {
                core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId = {
                    ...core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId,
                    [event.payload.playerId]: [...event.payload.bloodFromStoneTurnStartVisibleStoneCherubIds],
                };
            }
            const bloodFromStoneNewLineOfSightDamageRoll = event.payload.bloodFromStoneNewLineOfSightDamageRoll;
            const bloodFromStoneNewLineOfSightDamageLogText = bloodFromStoneNewLineOfSightDamageRoll
                ? `${event.payload.logText}；${bloodFromStoneNewLineOfSightDamageRoll.explorerName}进入石像小天使新视线，投出 ${bloodFromStoneNewLineOfSightDamageRoll.dice.join('、') || '0'}，承受 ${bloodFromStoneNewLineOfSightDamageRoll.amount} 点一般伤害`
                : event.payload.logText;
            if (bloodFromStoneNewLineOfSightDamageRoll) {
                core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn = Array.from(new Set([
                    ...core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn,
                    event.payload.playerId,
                ]));
            }
            const mummyGirlPickedUp = collectMummyGirlByExplorerIfPresent(
                core,
                event.payload.playerId,
                event.payload.roomId,
            );
            const synced = syncCurrentExplorerProjection(core);
            const mummyGirlPickupLog = mummyGirlPickedUp
                ? `；${synced.currentExplorer.displayName}拾起女孩`
                : '';
            if (bloodFromStoneNewLineOfSightDamageRoll) {
                const pendingBloodFromStoneNewLineOfSightDamageAllocation =
                    createBloodFromStoneNewLineOfSightDamageAllocation(synced, bloodFromStoneNewLineOfSightDamageRoll);
                if (pendingBloodFromStoneNewLineOfSightDamageAllocation) {
                    return {
                        ...synced,
                        pendingDamageAllocation: pendingBloodFromStoneNewLineOfSightDamageAllocation,
                        activePlayerId: pendingBloodFromStoneNewLineOfSightDamageAllocation.playerId,
                        recommendedAction: 'endTurn',
                        activityLog: appendActivity(synced, bloodFromStoneNewLineOfSightDamageLogText, 'warning'),
                    };
                }
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, `${bloodFromStoneNewLineOfSightDamageLogText}${mummyGirlPickupLog}`, 'warning'),
                };
            }
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, `${event.payload.logText}${mummyGirlPickupLog}`, 'neutral'),
            };
        }
        case EVENTS.ROOM_EXPLORED: {
            if (event.payload.roomTileAdjustment) {
                const adjustedRooms = materializeRoomsAfterTileAdjustment(core.rooms, event.payload.roomTileAdjustment);
                if (adjustedRooms) {
                    core.rooms = adjustedRooms;
                }
            }
            const targetRoom = core.rooms.find((room) => room.id === event.payload.roomId);
            if (targetRoom) {
                targetRoom.name = event.payload.room.name;
                targetRoom.hint = event.payload.room.hint;
                targetRoom.tags = [...event.payload.room.tags];
                targetRoom.state = 'discovered';
                targetRoom.discoveryReward = event.payload.room.discoveryReward;
                targetRoom.visualId = event.payload.room.visualId;
                targetRoom.doorways = event.payload.room.doorways.map((doorway) => ({ ...doorway }));
                targetRoom.backVisualId = event.payload.room.backVisualId;
                targetRoom.discoveryEffect = event.payload.room.discoveryEffect;
                targetRoom.endTurnEffect = event.payload.room.endTurnEffect;
                targetRoom.enterEffect = event.payload.room.enterEffect;
                targetRoom.entryRoomId = core.activeRoomId;
                const reverseDoorway = core.rooms
                    .find((room) => room.id === core.activeRoomId)
                    ?.doorways.find((doorway) => doorway.connectsToRoomId === targetRoom.id);
                targetRoom.entryEdge = reverseDoorway?.edge ?? targetRoom.doorways[0]?.edge ?? 'west';
                targetRoom.orientationTurns = event.payload.room.orientationTurns;
                const connectionEdge = resolveOppositeRoomEdge(targetRoom.entryEdge);
                let connectedToEntry = false;
                targetRoom.doorways = targetRoom.doorways.map((doorway) => {
                    if (doorway.connectsToRoomId === core.activeRoomId) {
                        connectedToEntry = true;
                        return doorway;
                    }
                    if (!connectedToEntry && doorway.edge === connectionEdge && !doorway.connectsToRoomId) {
                        connectedToEntry = true;
                        return {
                            ...doorway,
                            connectsToRoomId: core.activeRoomId,
                        };
                    }
                    return doorway;
                });
                if (!connectedToEntry) {
                    targetRoom.doorways = [
                        ...targetRoom.doorways,
                        {
                            edge: connectionEdge,
                            connectsToRoomId: core.activeRoomId,
                        },
                    ];
                }
                const newlyConnectedIds = targetRoom.doorways
                    .map((doorway) => doorway.connectsToRoomId)
                    .filter((roomId): roomId is string => Boolean(roomId));
                targetRoom.connectedRoomIds = Array.from(new Set([
                    ...targetRoom.connectedRoomIds,
                    ...newlyConnectedIds,
                ]));
                if (event.payload.room.discoveryEffect === 'placeObstacleToken') {
                    targetRoom.markerTokens = Array.from(new Set([...(targetRoom.markerTokens ?? []), 'obstacle']));
                }
            }
            core.currentExplorer.roomId = event.payload.roomId;
            core.rooms = refreshExplorableRoomSlots(core.rooms);
            core.movesRemaining = 0;
            core.turnEndedByDiscovery = true;
            applyRoomDrawResolutionToCore(core, event.payload.roomDrawResolution);
            core.exploreIndex += event.payload.skippedRoomWithHolySymbol ? 2 : 1;
            core.highlightedDeckKind = event.payload.deckKind;
            core.latestDiscovery = cloneDiscoverySummary(event.payload.discovery);
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;
            core.pendingEventChoice = null;
            core.pendingEventRollStart = event.payload.eventRollPending
                ? {
                    playerId: event.payload.playerId,
                    roomId: event.payload.roomId,
                    sourceTitle: event.payload.discovery.title,
                    eventDescription: event.payload.eventDescription,
                }
                : null;
            core.pendingEventRollResolution = null;
            core.pendingCardResolutionQueue = event.payload.eventRollPending || event.payload.nextPendingEventChoice
                ? []
                : createPendingCardResolutionQueue({
                    playerId: event.payload.playerId,
                    requiredPlayerIds: resolveRoomExploredCardResolutionRequiredPlayerIds(core, event),
                    roomId: event.payload.roomId,
                    timestamp: event.timestamp,
                    deckKind: event.payload.deckKind,
                    discovery: event.payload.discovery,
                    drawnCard: event.payload.drawnCard,
                    roomDiscoveryCards: event.payload.roomDiscoveryCards,
                    buriedRoomDiscoveryCards: event.payload.buriedRoomDiscoveryCards,
                });
            if (
                event.payload.deckKind === 'event'
                && !event.payload.skippedEventWithTraitorPower
                && !event.payload.skippedEventWithUponReflection
                && !event.payload.nextPendingEventChoice
                && !event.payload.eventRollPending
            ) {
                buryEventCardToBottom(core, event.payload.discovery.title);
            }
            if (event.payload.eventRoll?.dice?.length && event.payload.eventRoll.branchThresholds) {
                core.recentRoll = {
                    id: `${event.payload.playerId}-${event.payload.roomId}-${event.timestamp}`,
                    kind: event.payload.eventRoll.kind === 'dice' ? 'eventDiceRoll' : 'eventTraitCheck',
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.discovery.title,
                    eventDescription: event.payload.eventRoll.eventDescription,
                    trait: event.payload.eventRoll.trait,
                    rollLabel: event.payload.eventRoll.rollLabel,
                    dice: [...event.payload.eventRoll.dice],
                    passiveBonus: event.payload.eventRoll.passiveBonus ?? 0,
                    branchThresholds: event.payload.eventRoll.branchThresholds.map((branch) => ({
                        ...branch,
                        effect: { ...branch.effect },
                    })),
                    latestLabel: event.payload.eventRoll.label,
                    consumedRabbitFootCardIds: [],
                };
            } else if (event.payload.hauntRoll?.dice.length) {
                core.recentRoll = {
                    id: `${event.payload.playerId}-${event.payload.roomId}-haunt-${event.timestamp}`,
                    kind: 'hauntRoll',
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.discovery.title,
                    rollLabel: '作祟检定',
                    dice: [...event.payload.hauntRoll.dice],
                    passiveBonus: 0,
                    branchThresholds: buildHauntRollThresholds(event.payload.hauntRoll),
                    latestLabel: event.payload.hauntRoll.triggered ? '作祟开始' : '未触发作祟',
                    consumedRabbitFootCardIds: [],
                };
            } else {
                core.recentRoll = null;
            }
            consumeNextNonCombatTraitReplacementAfterTraitRoll(core, event.payload.playerId, event.payload.eventRoll);
            if (event.payload.deckKind === 'omen') {
                core.scenarioRuntime.omensDiscovered += 1;
            }
            applyRoomDiscoveryEffect(core, event.payload.room.discoveryEffect);
            if (event.payload.buriedRoomDiscoveryCards?.length) {
                for (const buriedCard of event.payload.buriedRoomDiscoveryCards) {
                    buryPossessionCardToBottom(core, 'item', buriedCard.id);
                }
            }
            if (event.payload.roomDiscoveryCards?.length) {
                core.currentExplorer.inventory = [
                    ...core.currentExplorer.inventory,
                    ...event.payload.roomDiscoveryCards.map(cloneInventoryCard),
                ];
                for (const drawnRoomCard of event.payload.roomDiscoveryCards) {
                    removePossessionCardFromDeck(core, 'item', drawnRoomCard.id);
                }
            }

            if (event.payload.nextPendingEventChoice) {
                core.pendingEventChoice = clonePendingEventChoice(event.payload.nextPendingEventChoice);
                core.pendingCardResolutionQueue = [];
                core.turnEndedByDiscovery = false;
                const mummyGirlPickedUp = collectMummyGirlByExplorerIfPresent(
                    core,
                    event.payload.playerId,
                    event.payload.roomId,
                );
                const synced = syncCurrentExplorerProjection(core);
                const mummyGirlPickupLog = mummyGirlPickedUp
                    ? `；${synced.currentExplorer.displayName}拾起女孩`
                    : '';
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, `${event.payload.logText}${mummyGirlPickupLog}`, event.payload.discovery.tone),
                };
            }

            if (event.payload.skippedEventWithTraitorPower || event.payload.skippedEventWithUponReflection) {
                // 跳过的是房间事件符号，没有抽事件牌，因此不移动事件牌堆。
                if (event.payload.skippedEventWithUponReflection) {
                    core.turnEndedByDiscovery = false;
                }
            } else if (event.payload.skippedEventWithIdol) {
                // 雕像仍消耗这次事件牌堆顺序，但不结算事件效果。
            } else if (
                event.payload.deckKind === 'event'
                && eventEffectNeedsPendingEventChoice(event.payload.eventEffect)
            ) {
                if (event.payload.eventEffect.mode === 'allTraitChecks') {
                    applyEventEffect(core, event.payload.eventEffect);
                    applyDustEventEffectDeathIfNeeded(core);
                }
                core.pendingEventChoice = {
                    id: `${event.payload.playerId}-${event.payload.roomId}-${event.timestamp}`,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.discovery.title,
                    eventDescription: event.payload.eventDescription,
                    acceptLabel: event.payload.eventEffect.mode === 'optionalEventRoll'
                        || event.payload.eventEffect.mode === 'optionalEffect'
                        || event.payload.eventEffect.mode === 'optionalItemEffect'
                        || event.payload.eventEffect.mode === 'optionalHauntRoll'
                        ? event.payload.eventEffect.acceptLabel
                        : undefined,
                    declineLabel: event.payload.eventEffect.mode === 'optionalEventRoll'
                        || event.payload.eventEffect.mode === 'optionalEffect'
                        || event.payload.eventEffect.mode === 'optionalItemEffect'
                        || event.payload.eventEffect.mode === 'optionalHauntRoll'
                        ? event.payload.eventEffect.declineLabel
                        : undefined,
                    effect: cloneUseEffect(event.payload.eventEffect),
                };
                core.turnEndedByDiscovery = false;
            } else if (
                event.payload.deckKind === 'event'
                && event.payload.eventRoll?.dice?.length
                && core.recentRoll
                && event.payload.eventEffect
            ) {
                const requiresAcknowledgement = eventRollResolutionNeedsAcknowledgement({
                    hauntRevealResolution: event.payload.hauntRevealResolution,
                    hauntTraitorResolution: event.payload.hauntTraitorResolution,
                    dustSetup: event.payload.dustSetup,
                    magicCameraSetup: event.payload.magicCameraSetup,
                    helpingHandsSetup: event.payload.helpingHandsSetup,
                    uponReflectionSetup: event.payload.uponReflectionSetup,
                });
                core.pendingEventRollResolution = {
                    rollId: core.recentRoll.id,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.discovery.title,
                    requiredPlayerIds: requiresAcknowledgement
                        ? [...core.playerIds]
                        : [event.payload.playerId],
                    acknowledgedPlayerIds: [],
                    effect: cloneUseEffect(event.payload.eventEffect),
                    requiresAcknowledgement,
                    deathPrevention: event.payload.deathPrevention
                        ? {
                            ...event.payload.deathPrevention,
                            dice: [...event.payload.deathPrevention.dice],
                            damageTraits: [...event.payload.deathPrevention.damageTraits],
                            traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        }
                        : undefined,
                    hauntTriggered: event.payload.hauntTriggered,
                    hauntCardNumber: event.payload.hauntCardNumber,
                    hauntTriggerLabel: event.payload.hauntTriggerLabel,
                    hauntTraitorPlayerId: event.payload.hauntTraitorPlayerId,
                    hauntRevealResolution: event.payload.hauntRevealResolution
                        ? { ...event.payload.hauntRevealResolution }
                        : undefined,
                    hauntTraitorResolution: event.payload.hauntTraitorResolution
                        ? cloneHauntTraitorResolution(event.payload.hauntTraitorResolution) ?? undefined
                        : undefined,
                    dustSetup: event.payload.dustSetup ? cloneDustRuntimeState(event.payload.dustSetup) : undefined,
                    magicCameraSetup: event.payload.magicCameraSetup
                        ? cloneMagicCameraRuntimeState(event.payload.magicCameraSetup)
                        : undefined,
                    helpingHandsSetup: event.payload.helpingHandsSetup
                        ? cloneHelpingHandsRuntimeState(event.payload.helpingHandsSetup)
                        : undefined,
                    uponReflectionSetup: event.payload.uponReflectionSetup
                        ? cloneUponReflectionRuntimeState(event.payload.uponReflectionSetup)
                        : undefined,
                    hauntRoll: event.payload.hauntRoll ? { ...event.payload.hauntRoll } : undefined,
                };
                core.turnEndedByDiscovery = true;
            } else if (!core.turnEndedByDiscovery && event.payload.deckKind === 'event' && event.payload.eventEffect) {
                const deathPreventionScenarioRuntimeBeforeDefeat = event.payload.deathPrevention
                    ? cloneScenarioRuntimeStatus(core.scenarioRuntime)
                    : null;
                const deathPreventionMonstersBeforeDefeat = event.payload.deathPrevention
                    ? core.monsters.map(cloneMonster)
                    : [];
                const sourceEventRollBeforeEffect = cloneSourceEventRollFromRecentRoll(core.recentRoll);
                const {
                    eventEffectSnapshot,
                    pendingRolledDamageAllocation,
                } = applyEventEffectWithDeferredRolledDamage(
                    core,
                    event.payload.eventEffect,
                    event.payload.discovery.title,
                    event.timestamp,
                );
                if (!activatePendingRolledDamageAllocation(core, pendingRolledDamageAllocation)) {
                    applyImmediateEventDeathPreventionIfNeeded(
                        core,
                        event.payload.deathPrevention,
                        event.timestamp,
                        deathPreventionScenarioRuntimeBeforeDefeat,
                        deathPreventionMonstersBeforeDefeat,
                    );
                }
                const replacedWithDamageRoll = (
                    pendingRolledDamageAllocation
                    || !event.payload.deathPrevention?.dice.length
                )
                    ? setEventRolledDamageRecentRollFromSnapshot(
                        core,
                        eventEffectSnapshot,
                        event.payload.discovery.title,
                        event.timestamp,
                        sourceEventRollBeforeEffect,
                    )
                    : false;
                if (!replacedWithDamageRoll && isEventRecentRoll(core.recentRoll)) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
                core.turnEndedByDiscovery = true;
            } else if (event.payload.deckKind === 'event' && event.payload.eventEffect) {
                const deathPreventionScenarioRuntimeBeforeDefeat = event.payload.deathPrevention
                    ? cloneScenarioRuntimeStatus(core.scenarioRuntime)
                    : null;
                const deathPreventionMonstersBeforeDefeat = event.payload.deathPrevention
                    ? core.monsters.map(cloneMonster)
                    : [];
                const sourceEventRollBeforeEffect = cloneSourceEventRollFromRecentRoll(core.recentRoll);
                const {
                    eventEffectSnapshot,
                    pendingRolledDamageAllocation,
                } = applyEventEffectWithDeferredRolledDamage(
                    core,
                    event.payload.eventEffect,
                    event.payload.discovery.title,
                    event.timestamp,
                );
                if (!activatePendingRolledDamageAllocation(core, pendingRolledDamageAllocation)) {
                    applyImmediateEventDeathPreventionIfNeeded(
                        core,
                        event.payload.deathPrevention,
                        event.timestamp,
                        deathPreventionScenarioRuntimeBeforeDefeat,
                        deathPreventionMonstersBeforeDefeat,
                    );
                }
                const replacedWithDamageRoll = (
                    pendingRolledDamageAllocation
                    || !event.payload.deathPrevention?.dice.length
                )
                    ? setEventRolledDamageRecentRollFromSnapshot(
                        core,
                        eventEffectSnapshot,
                        event.payload.discovery.title,
                        event.timestamp,
                        sourceEventRollBeforeEffect,
                    )
                    : false;
                if (!replacedWithDamageRoll && isEventRecentRoll(core.recentRoll)) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
                core.turnEndedByDiscovery = true;
            } else if (
                event.payload.drawnCard
                && (event.payload.deckKind === 'item' || event.payload.deckKind === 'omen')
            ) {
                core.currentExplorer.inventory = [...core.currentExplorer.inventory, cloneInventoryCard(event.payload.drawnCard)];
                removePossessionCardFromDeck(core, event.payload.deckKind, event.payload.drawnCard.id);
                if (event.payload.mummyForcedOmenSearch) {
                    core.possessionOrderByKind = {
                        ...core.possessionOrderByKind,
                        omen: event.payload.mummyForcedOmenSearch.shuffledOmenDeck.map(cloneInventoryCard),
                    };
                    core.scenarioRuntime = {
                        ...core.scenarioRuntime,
                        mummyForcedOmenSearch: {
                            ...event.payload.mummyForcedOmenSearch,
                            shuffledOmenDeck: event.payload.mummyForcedOmenSearch.shuffledOmenDeck.map(cloneInventoryCard),
                        },
                    };
                }
            }

            const mummyGirlPickedUp = collectMummyGirlByExplorerIfPresent(
                core,
                event.payload.playerId,
                event.payload.roomId,
            );
            const synced = syncCurrentExplorerProjection(core);
            const mummyGirlPickupLog = mummyGirlPickedUp
                ? `；${synced.currentExplorer.displayName}拾起女孩`
                : '';
            const pendingDamageAllocationAfterEventDraw = core.pendingDamageAllocation;
            let nextCore = {
                ...synced,
                recommendedAction: pendingDamageAllocationAfterEventDraw ? 'endTurn' : resolveRecommendedAction(synced),
                activePlayerId: pendingDamageAllocationAfterEventDraw?.playerId ?? synced.activePlayerId,
                activityLog: appendActivity(synced, `${event.payload.logText}${mummyGirlPickupLog}`, event.payload.discovery.tone),
            };
            const dustCompletedAfterEventDraw = pendingDamageAllocationAfterEventDraw
                ? null
                : completeDustTraitorVictoryIfNeeded(nextCore, event.timestamp);
            if (dustCompletedAfterEventDraw) {
                return dustCompletedAfterEventDraw;
            }
            if (event.payload.hauntTriggered) {
                const hauntRevealerPlayerId = event.payload.playerId;
                const hauntRevealResolution = event.payload.hauntRevealResolution
                    ?? resolveHauntRevealResolutionForTrigger(core, event.payload.drawnCard);
                const hauntTraitorResolution = resolveHauntTraitorResolutionForTrigger(
                    core,
                    hauntRevealResolution.hauntCardNumber,
                    hauntRevealerPlayerId,
                    { revealRepresentativeOnly: hauntRevealResolution.representativeOnly },
                );
                const hauntTraitorPlayerId = hauntTraitorResolution.traitorPlayerId;
                const hauntFirstPlayerResolution = resolveHauntFirstPlayerResolutionForTrigger(
                    core,
                    hauntRevealResolution.hauntCardNumber,
                    hauntRevealerPlayerId,
                    hauntTraitorResolution,
                    { revealRepresentativeOnly: hauntRevealResolution.representativeOnly },
                );
                const nextPlayerId = hauntFirstPlayerResolution.nextPlayerId;
                const uponReflectionSetup = hauntRevealResolution.hauntCardNumber === 7
                    ? createUponReflectionRuntimeState(core, hauntRevealerPlayerId, DEFAULT_BETRAYAL_RANDOM)
                    : undefined;
                nextCore = reduceEvent(nextCore, nowEvent(EVENTS.HAUNT_TRIGGERED, {
                    traitorPlayerId: hauntTraitorPlayerId,
                    hauntRevealerPlayerId,
                    nextPlayerId,
                    hauntCardNumber: hauntRevealResolution.hauntCardNumber,
                    hauntTriggerLabel: hauntRevealResolution.triggeringOmenName,
                    hauntRevealResolution,
                    hauntTraitorResolution,
                    hauntFirstPlayerResolution,
                    uponReflectionSetup,
                    logText: hauntRevealResolution.hauntCardNumber === 1
                        ? scenarioConfigById(core.scenarioId).logs.hauntTriggered
                        : `作祟触发：剧本${hauntRevealResolution.hauntCardNumber}（${hauntRevealResolution.triggeringOmenName}）`,
                }, event.timestamp));
            }
            return nextCore;
        }
        case EVENTS.EVENT_CHOICE_RESOLVED: {
            const previousRecentRoll = core.recentRoll;
            const previousDiscovery = core.latestDiscovery;
            const deferNextPendingEventChoiceBehindRoll = Boolean(
                event.payload.eventRoll?.dice?.length
                && event.payload.nextPendingEventChoice,
            );
            const eventChoiceDiscovery = event.payload.nextPendingEventChoice
                ? event.payload.discovery
                : withEventChoiceResolutionStep(event.payload.discovery);
            core.pendingEventChoice = event.payload.nextPendingEventChoice && !deferNextPendingEventChoiceBehindRoll
                ? clonePendingEventChoice(event.payload.nextPendingEventChoice)
                : null;
            const nextDiscovery = cloneDiscoverySummary(eventChoiceDiscovery);
            mergePreviousDiscoveryResolutionSteps(previousDiscovery, nextDiscovery);
            core.latestDiscovery = nextDiscovery;
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;
            if (event.payload.drawnEventCardNameToBury) {
                buryEventCardToBottom(core, event.payload.drawnEventCardNameToBury);
            }
            const carriedRecentRoll = !event.payload.eventRoll?.dice?.length
                && previousRecentRoll
                && previousRecentRoll.sourceTitle === event.payload.sourceTitle
                && (previousRecentRoll.kind === 'eventDiceRoll' || previousRecentRoll.kind === 'eventTraitCheck')
                ? {
                    ...previousRecentRoll,
                    dice: [...previousRecentRoll.dice],
                    branchThresholds: previousRecentRoll.branchThresholds?.map((branch) => ({
                        ...branch,
                        effect: cloneUseEffect(
                            event.payload.eventEffect && branch.label === previousRecentRoll.latestLabel
                                ? event.payload.eventEffect
                                : branch.effect,
                        ),
                    })),
                    consumedRabbitFootCardIds: [...previousRecentRoll.consumedRabbitFootCardIds],
                }
                : null;
            core.recentRoll = event.payload.eventRoll?.dice?.length && event.payload.eventRoll.branchThresholds
                ? {
                    id: `${event.payload.playerId}-${event.payload.sourceTitle}-${event.timestamp}`,
                    kind: event.payload.eventRoll.kind === 'dice' ? 'eventDiceRoll' : 'eventTraitCheck',
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.sourceTitle,
                    eventDescription: event.payload.eventRoll.eventDescription,
                    trait: event.payload.eventRoll.trait,
                    rollLabel: event.payload.eventRoll.rollLabel,
                    dice: [...event.payload.eventRoll.dice],
                    passiveBonus: event.payload.eventRoll.passiveBonus ?? 0,
                    branchThresholds: event.payload.eventRoll.branchThresholds.map((branch) => ({
                        ...branch,
                        effect: cloneUseEffect(branch.effect),
                    })),
                    latestLabel: event.payload.eventRoll.label,
                    consumedRabbitFootCardIds: [],
                }
                : carriedRecentRoll;
            consumeNextNonCombatTraitReplacementAfterTraitRoll(core, event.payload.playerId, event.payload.eventRoll);
            if (
                event.payload.eventRoll?.dice?.length
                && core.recentRoll
                && (event.payload.eventEffect || event.payload.nextPendingEventChoice)
            ) {
                const pendingEffect = event.payload.eventEffect
                    ?? event.payload.nextPendingEventChoice!.effect;
                const nextPendingEventChoice = event.payload.nextPendingEventChoice
                    ? clonePendingEventChoice(event.payload.nextPendingEventChoice)
                    : undefined;
                const requiresAcknowledgement = eventRollResolutionNeedsAcknowledgement({
                    nextPendingEventChoice,
                    hauntRevealResolution: event.payload.hauntRevealResolution,
                    hauntTraitorResolution: event.payload.hauntTraitorResolution,
                    dustSetup: event.payload.dustSetup,
                    magicCameraSetup: event.payload.magicCameraSetup,
                    helpingHandsSetup: event.payload.helpingHandsSetup,
                    uponReflectionSetup: event.payload.uponReflectionSetup,
                });
                core.pendingEventRollResolution = {
                    rollId: core.recentRoll.id,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.sourceTitle,
                    requiredPlayerIds: requiresAcknowledgement
                        ? [...core.playerIds]
                        : [event.payload.playerId],
                    acknowledgedPlayerIds: [],
                    effect: cloneUseEffect(pendingEffect),
                    requiresAcknowledgement,
                    nextPendingEventChoice,
                    deathPrevention: event.payload.deathPrevention
                        ? {
                            ...event.payload.deathPrevention,
                            dice: [...event.payload.deathPrevention.dice],
                            damageTraits: [...event.payload.deathPrevention.damageTraits],
                            traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        }
                        : undefined,
                    hauntTriggered: event.payload.hauntTriggered,
                    hauntCardNumber: event.payload.hauntCardNumber,
                    hauntTriggerLabel: event.payload.hauntTriggerLabel,
                    hauntTraitorPlayerId: event.payload.hauntTraitorPlayerId,
                    hauntRevealResolution: event.payload.hauntRevealResolution
                        ? { ...event.payload.hauntRevealResolution }
                        : undefined,
                    hauntTraitorResolution: event.payload.hauntTraitorResolution
                        ? cloneHauntTraitorResolution(event.payload.hauntTraitorResolution) ?? undefined
                        : undefined,
                    dustSetup: event.payload.dustSetup ? cloneDustRuntimeState(event.payload.dustSetup) : undefined,
                    magicCameraSetup: event.payload.magicCameraSetup
                        ? cloneMagicCameraRuntimeState(event.payload.magicCameraSetup)
                        : undefined,
                    helpingHandsSetup: event.payload.helpingHandsSetup
                        ? cloneHelpingHandsRuntimeState(event.payload.helpingHandsSetup)
                        : undefined,
                    uponReflectionSetup: event.payload.uponReflectionSetup
                        ? cloneUponReflectionRuntimeState(event.payload.uponReflectionSetup)
                        : undefined,
                    hauntRoll: event.payload.hauntRoll ? { ...event.payload.hauntRoll } : undefined,
                };
                core.turnEndedByDiscovery = true;
                core.pendingCardResolutionQueue = event.payload.nextPendingEventChoice
                    ? []
                    : createPendingCardResolutionQueue({
                        playerId: event.payload.playerId,
                        requiredPlayerIds: core.playerIds,
                        roomId: core.currentExplorer.roomId,
                        timestamp: event.timestamp,
                        deckKind: 'event',
                        discovery: eventChoiceDiscovery,
                    });
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, event.payload.logText, eventChoiceDiscovery.tone),
                };
            }
            if (event.payload.eventEffect) {
                const deathPreventionScenarioRuntimeBeforeDefeat = event.payload.deathPrevention
                    ? cloneScenarioRuntimeStatus(core.scenarioRuntime)
                    : null;
                const deathPreventionMonstersBeforeDefeat = event.payload.deathPrevention
                    ? core.monsters.map(cloneMonster)
                    : [];
                const sourceEventRollBeforeEffect = cloneSourceEventRollFromRecentRoll(core.recentRoll);
                const {
                    eventEffectSnapshot,
                    pendingRolledDamageAllocation,
                } = applyEventEffectWithDeferredRolledDamage(
                    core,
                    event.payload.eventEffect,
                    event.payload.sourceTitle,
                    event.timestamp,
                );
                if (!activatePendingRolledDamageAllocation(core, pendingRolledDamageAllocation)) {
                    applyImmediateEventDeathPreventionIfNeeded(
                        core,
                        event.payload.deathPrevention,
                        event.timestamp,
                        deathPreventionScenarioRuntimeBeforeDefeat,
                        deathPreventionMonstersBeforeDefeat,
                    );
                }
                const replacedWithDamageRoll = (
                    pendingRolledDamageAllocation
                    || !event.payload.deathPrevention?.dice.length
                )
                    ? setEventRolledDamageRecentRollFromSnapshot(
                        core,
                        eventEffectSnapshot,
                        event.payload.sourceTitle,
                        event.timestamp,
                        sourceEventRollBeforeEffect,
                    )
                    : false;
                if (!replacedWithDamageRoll && isEventRecentRoll(core.recentRoll)) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
            }
            core.turnEndedByDiscovery = !event.payload.nextPendingEventChoice;
            core.pendingCardResolutionQueue = event.payload.nextPendingEventChoice
                ? []
                : createPendingCardResolutionQueue({
                    playerId: event.payload.playerId,
                    requiredPlayerIds: core.playerIds,
                    roomId: core.currentExplorer.roomId,
                    timestamp: event.timestamp,
                    deckKind: 'event',
                    discovery: eventChoiceDiscovery,
                });
            const synced = syncCurrentExplorerProjection(core);
            const pendingDamageAllocationAfterEventChoice = core.pendingDamageAllocation;
            let nextCore = {
                ...synced,
                recommendedAction: pendingDamageAllocationAfterEventChoice ? 'endTurn' : resolveRecommendedAction(synced),
                activePlayerId: pendingDamageAllocationAfterEventChoice?.playerId ?? synced.activePlayerId,
                activityLog: appendActivity(synced, event.payload.logText, eventChoiceDiscovery.tone),
            };
            const dustCompletedAfterEventChoice = pendingDamageAllocationAfterEventChoice
                ? null
                : completeDustTraitorVictoryIfNeeded(nextCore, event.timestamp);
            if (dustCompletedAfterEventChoice) {
                return dustCompletedAfterEventChoice;
            }
            if (event.payload.hauntTriggered) {
                const scenario = scenarioConfigById(core.scenarioId);
                const hauntRevealerPlayerId = event.payload.playerId;
                const hauntRevealResolution = event.payload.hauntRevealResolution
                    ?? resolveHauntRevealResolutionForTrigger(
                        core,
                        { id: null, name: event.payload.hauntTriggerLabel ?? event.payload.sourceTitle },
                        event.payload.hauntCardNumber,
                    );
                const hauntCardNumber = event.payload.hauntCardNumber ?? hauntRevealResolution.hauntCardNumber;
                const hauntTraitorResolution = event.payload.hauntTraitorResolution
                    ?? resolveHauntTraitorResolutionForTrigger(core, hauntCardNumber, hauntRevealerPlayerId, {
                        explicitTraitorPlayerId: event.payload.hauntTraitorPlayerId,
                        revealRepresentativeOnly: hauntRevealResolution.representativeOnly,
                    });
                const hauntTraitorPlayerId = hauntTraitorResolution.traitorPlayerId;
                const hauntFirstPlayerResolution = resolveHauntFirstPlayerResolutionForTrigger(
                    core,
                    hauntCardNumber,
                    hauntRevealerPlayerId,
                    hauntTraitorResolution,
                    { revealRepresentativeOnly: hauntRevealResolution.representativeOnly },
                );
                const nextPlayerId = hauntFirstPlayerResolution.nextPlayerId;
                nextCore = reduceEvent(nextCore, nowEvent(EVENTS.HAUNT_TRIGGERED, {
                    traitorPlayerId: hauntTraitorPlayerId,
                    hauntRevealerPlayerId,
                    nextPlayerId,
                    hauntCardNumber,
                    hauntTriggerLabel: event.payload.hauntTriggerLabel ?? hauntRevealResolution.triggeringOmenName,
                    hauntRevealResolution,
                    hauntTraitorResolution,
                    hauntFirstPlayerResolution,
                    dustSetup: event.payload.dustSetup,
                    magicCameraSetup: event.payload.magicCameraSetup,
                    helpingHandsSetup: event.payload.helpingHandsSetup,
                    uponReflectionSetup: event.payload.uponReflectionSetup,
                    logText: hauntCardNumber !== 1
                        ? `作祟触发：剧本${hauntCardNumber}（${event.payload.hauntTriggerLabel ?? event.payload.sourceTitle}）`
                        : scenario.logs.hauntTriggered,
                }, event.timestamp));
            }
            return nextCore;
        }
        case EVENTS.CARD_RESOLUTION_ACKNOWLEDGED: {
            const acknowledgedPlayerIds = event.payload.acknowledgedPlayerIds
                ?? event.payload.resolution.acknowledgedPlayerIds
                ?? [];
            const acknowledgedResolution = {
                ...event.payload.resolution,
                acknowledgedPlayerIds: [...acknowledgedPlayerIds],
            };
            const isComplete = isPendingCardResolutionFullyAcknowledged(
                core,
                acknowledgedResolution,
                acknowledgedPlayerIds,
            );
            core.pendingCardResolutionQueue = (core.pendingCardResolutionQueue ?? [])
                .flatMap((resolution) => {
                    if (resolution.id !== event.payload.resolution.id) {
                        return [resolution];
                    }
                    return isComplete ? [] : [acknowledgedResolution];
                });
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: synced.activityLog,
            };
        }
        case EVENTS.RABBIT_FOOT_USED: {
            const recentRoll = core.recentRoll;
            if (!recentRoll) {
                return core;
            }
            const dice = [...recentRoll.dice];
            const dieIndices = event.payload.dieIndices ?? [event.payload.dieIndex];
            const newPips = event.payload.newPips ?? [event.payload.newPip];
            dieIndices.forEach((dieIndex, valueIndex) => {
                if (dieIndex >= 0 && dieIndex < dice.length) {
                    dice[dieIndex] = newPips[valueIndex] ?? dice[dieIndex] ?? 0;
                }
            });
            const nextRoll: BetrayalRecentRollState = {
                ...recentRoll,
                dice,
                consumedRabbitFootCardIds: [...recentRoll.consumedRabbitFootCardIds, event.payload.cardId],
                lastRabbitFootRerollDieIndex: dieIndices.length === 1 ? dieIndices[0] : undefined,
            };
            const nextTotal = resolveRecentRollTotal(nextRoll);
            const finalizeRecentRollReroll = (
                tone: BetrayalDiscoverySummary['tone'] = 'accent',
            ): BetrayalCore => {
                const rerollDamageAllocation = core.pendingDamageAllocation
                    ?? createRecentRollRerollMentalDamageAllocation(
                        core,
                        event.payload.playerId,
                        event.payload.cardId,
                        event.payload.mentalDamageAfterReroll,
                        event.timestamp,
                    );
                if (rerollDamageAllocation) {
                    core.pendingDamageAllocation = rerollDamageAllocation;
                    core.activePlayerId = rerollDamageAllocation.playerId;
                }
                const synced = syncCurrentExplorerProjection(core);
                if (rerollDamageAllocation) {
                    return {
                        ...synced,
                        pendingDamageAllocation: rerollDamageAllocation,
                        activePlayerId: rerollDamageAllocation.playerId,
                        recommendedAction: 'endTurn',
                        activityLog: appendActivity(synced, event.payload.logText, 'warning'),
                    };
                }
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, event.payload.logText, tone),
                };
            };

            if (recentRoll.kind === 'eventTraitCheck' || recentRoll.kind === 'eventDiceRoll') {
                if (recentRoll.kind === 'eventTraitCheck' && !recentRoll.trait) {
                    return core;
                }
                if (!recentRoll.branchThresholds) {
                    core.recentRoll = nextRoll;
                    if (core.pendingEventRollResolution?.rollId === recentRoll.id) {
                        core.pendingEventRollResolution = null;
                    }
                    core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                    return finalizeRecentRollReroll();
                }
                const nextBranch = resolveEventBranch(recentRoll.branchThresholds, nextTotal);
                const nextEffect = event.payload.eventRerollEffect ?? nextBranch.effect;
                if (core.pendingEventRollResolution?.rollId === recentRoll.id) {
                    const pendingEventRoll = core.pendingEventRollResolution;
                    const nextPendingEventChoice = eventEffectNeedsPendingEventChoice(nextEffect)
                        ? {
                            id: `${pendingEventRoll.rollId}-reroll-${event.timestamp}`,
                            playerId: pendingEventRoll.playerId,
                            sourceTitle: pendingEventRoll.sourceTitle,
                            effect: cloneUseEffect(nextEffect),
                        }
                        : undefined;
                    const requiresAcknowledgement = eventRollResolutionNeedsAcknowledgement({
                        nextPendingEventChoice,
                        hauntRevealResolution: event.payload.eventRerollHaunt?.hauntRevealResolution,
                        hauntTraitorResolution: event.payload.eventRerollHaunt?.hauntTraitorResolution,
                        dustSetup: event.payload.eventRerollHaunt?.dustSetup,
                        magicCameraSetup: event.payload.eventRerollHaunt?.magicCameraSetup,
                        helpingHandsSetup: event.payload.eventRerollHaunt?.helpingHandsSetup,
                        uponReflectionSetup: event.payload.eventRerollHaunt?.uponReflectionSetup,
                    });
                    nextRoll.latestLabel = nextBranch.label;
                    core.recentRoll = nextRoll;
                    core.pendingEventRollResolution = {
                        ...pendingEventRoll,
                        requiredPlayerIds: requiresAcknowledgement
                            ? [...core.playerIds]
                            : [pendingEventRoll.playerId],
                        acknowledgedPlayerIds: [],
                        effect: cloneUseEffect(nextEffect),
                        nextPendingEventChoice,
                        requiresAcknowledgement,
                        deathPrevention: event.payload.eventRerollDeathPrevention
                            ? {
                                ...event.payload.eventRerollDeathPrevention,
                                dice: [...event.payload.eventRerollDeathPrevention.dice],
                                damageTraits: [...event.payload.eventRerollDeathPrevention.damageTraits],
                                traitsBeforeDamage: { ...event.payload.eventRerollDeathPrevention.traitsBeforeDamage },
                            }
                            : undefined,
                        ...(event.payload.eventRerollHaunt
                            ? {
                                hauntTriggered: event.payload.eventRerollHaunt.hauntTriggered,
                                hauntCardNumber: event.payload.eventRerollHaunt.hauntCardNumber,
                                hauntTriggerLabel: event.payload.eventRerollHaunt.hauntTriggerLabel,
                                hauntTraitorPlayerId: event.payload.eventRerollHaunt.hauntTraitorPlayerId,
                                hauntRevealResolution: event.payload.eventRerollHaunt.hauntRevealResolution
                                    ? { ...event.payload.eventRerollHaunt.hauntRevealResolution }
                                    : undefined,
                                hauntTraitorResolution: event.payload.eventRerollHaunt.hauntTraitorResolution
                                    ? cloneHauntTraitorResolution(event.payload.eventRerollHaunt.hauntTraitorResolution) ?? undefined
                                    : undefined,
                                dustSetup: event.payload.eventRerollHaunt.dustSetup
                                    ? cloneDustRuntimeState(event.payload.eventRerollHaunt.dustSetup)
                                    : undefined,
                                magicCameraSetup: event.payload.eventRerollHaunt.magicCameraSetup
                                    ? cloneMagicCameraRuntimeState(event.payload.eventRerollHaunt.magicCameraSetup)
                                    : undefined,
                                helpingHandsSetup: event.payload.eventRerollHaunt.helpingHandsSetup
                                    ? cloneHelpingHandsRuntimeState(event.payload.eventRerollHaunt.helpingHandsSetup)
                                    : undefined,
                                uponReflectionSetup: event.payload.eventRerollHaunt.uponReflectionSetup
                                    ? cloneUponReflectionRuntimeState(event.payload.eventRerollHaunt.uponReflectionSetup)
                                    : undefined,
                            }
                            : {}),
                    };
                    core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                    if (core.latestDiscovery && core.latestDiscovery.title === nextRoll.sourceTitle) {
                        const rerollLabel = recentRoll.rollLabel
                            ?? (recentRoll.kind === 'eventTraitCheck' && recentRoll.trait
                                ? `${TRAIT_LABEL[recentRoll.trait]}检定`
                                : '投骰');
                        core.latestDiscovery = {
                            ...core.latestDiscovery,
                            detail: `${rerollLabel} ${nextTotal}：${nextBranch.label}；${formatEffectLabel(nextEffect)}`,
                            tone: isWarningEventEffect(nextEffect) ? 'warning' : 'accent',
                        };
                    }
                    return finalizeRecentRollReroll();
                }
                if (core.pendingEventChoice?.sourceTitle === recentRoll.sourceTitle && !recentRoll.eventEffectSnapshot) {
                    nextRoll.latestLabel = nextBranch.label;
                    nextRoll.eventEffectSnapshot = undefined;
                    core.recentRoll = nextRoll;
                    core.pendingEventChoice = {
                        ...core.pendingEventChoice,
                        effect: cloneUseEffect(nextEffect),
                    };
                    core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                    if (core.latestDiscovery && core.latestDiscovery.title === nextRoll.sourceTitle) {
                        const effectLabel = formatEffectLabel(nextEffect);
                        const rerollLabel = recentRoll.rollLabel
                            ?? (recentRoll.kind === 'eventTraitCheck' && recentRoll.trait
                                ? `${TRAIT_LABEL[recentRoll.trait]}检定`
                                : '投骰');
                        core.latestDiscovery = {
                            ...core.latestDiscovery,
                            detail: `${rerollLabel} ${nextTotal}：${nextBranch.label}；${effectLabel}`,
                            tone: isWarningEventEffect(nextEffect) ? 'warning' : 'accent',
                        };
                    }
                    return finalizeRecentRollReroll();
                }
                const previousEffect = recentRoll.branchThresholds.find((branch) => branch.label === recentRoll.latestLabel)?.effect;
                if (previousEffect) {
                    revertEventEffect(core, previousEffect, recentRoll.eventEffectSnapshot);
                }
                const nextSnapshot = applyEventEffect(core, nextEffect);
                nextRoll.latestLabel = nextBranch.label;
                nextRoll.eventEffectSnapshot = nextSnapshot;
                core.recentRoll = nextRoll;
                core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                if (core.latestDiscovery && core.latestDiscovery.title === nextRoll.sourceTitle) {
                    const effectLabel = formatEffectLabel(nextEffect);
                    const rerollLabel = recentRoll.rollLabel
                        ?? (recentRoll.kind === 'eventTraitCheck' && recentRoll.trait
                            ? `${TRAIT_LABEL[recentRoll.trait]}检定`
                            : '投骰');
                    core.latestDiscovery = {
                        ...core.latestDiscovery,
                        detail: `${rerollLabel} ${nextTotal}：${nextBranch.label}；${effectLabel}`,
                        tone: isWarningEventEffect(nextBranch.effect) ? 'warning' : 'accent',
                    };
                }
            } else if (recentRoll.kind === 'mysticElevator') {
                const roomsBeforeRoll = recentRoll.roomsBeforeRoll?.map(cloneBetrayalRoom);
                const roomId = recentRoll.roomId ?? core.currentExplorer.roomId;
                const roomBeforeRoll = roomsBeforeRoll?.find((room) => room.id === roomId);
                const destination = roomsBeforeRoll
                    ? resolveMysticElevatorDestination({ ...core, rooms: roomsBeforeRoll }, nextTotal)
                    : null;
                if (!roomsBeforeRoll || !roomBeforeRoll || !destination) {
                    return core;
                }
                const nextEffect: BetrayalRoomEnterEffectResult = {
                    kind: 'mysticElevator',
                    playerId: recentRoll.playerId,
                    roomId,
                    roomName: roomBeforeRoll.name,
                    rollTotal: nextTotal,
                    dice,
                    destinationRoomId: destination.id,
                    destinationRoomName: destination.name,
                    destinationFloor: destination.floor,
                };
                core.rooms = moveMysticElevatorRoom(roomsBeforeRoll, nextEffect);
                core.currentExplorer.roomId = roomId;
                nextRoll.latestLabel = `移动到${destination.name}`;
                nextRoll.roomsBeforeRoll = roomsBeforeRoll;
                core.recentRoll = nextRoll;
                core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                core.latestDiscovery = null;
                core.latestDiscoveryOwnerPlayerId = null;
                core.latestRoomDrawResolution = null;
            } else if (recentRoll.kind === 'attackRoll') {
                const attack = recentRoll.attack;
                if (!attack) {
                    return core;
                }
                if (core.pendingDamageAllocation && !isPendingDamageAllocationForAttackRoll(core)) {
                    return core;
                }
                const attacker = findExplorerByPlayerId(core, recentRoll.playerId);
                const defender = attack.defenderPlayerId
                    ? findExplorerByPlayerId(core, attack.defenderPlayerId)
                    : null;
                if (!attacker) {
                    return core;
                }
                resetExplorerTraits(attacker, attack.attackerTraitsBeforeDamage);
                if (defender && attack.defenderTraitsBeforeDamage) {
                    resetExplorerTraits(defender, attack.defenderTraitsBeforeDamage);
                }
                const rerollOutcome = resolveAttackRerollOutcome(nextTotal, attack);
                let pendingAttackDamageAllocation: BetrayalPendingDamageAllocationState | null = null;
                if (rerollOutcome.damageToAttacker) {
                    applyAttackDamage(attacker, rerollOutcome.damageToAttacker, attack.damageKind);
                }
                if (defender && rerollOutcome.damageToDefender) {
                    if (canDeferOrdinaryAttackDamageToDefender(core, attack.target)) {
                        pendingAttackDamageAllocation = createPendingDamageAllocation({
                            id: `haunt-attack-reroll-damage-${defender.playerId}-${event.timestamp}`,
                            explorer: defender,
                            sourceTitle: '攻击',
                            damageKind: attack.damageKind,
                            amount: rerollOutcome.damageToDefender,
                            allowSkull: true,
                        });
                    }
                    if (!pendingAttackDamageAllocation) {
                        applyAttackDamage(defender, rerollOutcome.damageToDefender, attack.damageKind);
                    }
                }
                nextRoll.latestLabel = rerollOutcome.latestLabel;
                nextRoll.attack = {
                    ...attack,
                    previousDamageToAttacker: rerollOutcome.damageToAttacker ?? 0,
                    previousDamageToDefender: rerollOutcome.damageToDefender ?? 0,
                    attackerTraitsBeforeDamage: { ...attack.attackerTraitsBeforeDamage },
                    defenderTraitsBeforeDamage: attack.defenderTraitsBeforeDamage
                        ? { ...attack.defenderTraitsBeforeDamage }
                        : undefined,
                };
                core.recentRoll = nextRoll;
                core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                core.pendingDamageAllocation = pendingAttackDamageAllocation;
                core.activePlayerId = pendingAttackDamageAllocation?.playerId ?? null;
                if (pendingAttackDamageAllocation) {
                    const synced = syncCurrentExplorerProjection(core);
                    return {
                        ...synced,
                        pendingDamageAllocation: pendingAttackDamageAllocation,
                        activePlayerId: pendingAttackDamageAllocation.playerId,
                        recommendedAction: 'endTurn',
                        activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                    };
                }
            } else if (recentRoll.kind === 'roomEndTurnTraitCheck') {
                const roomEndTurn = recentRoll.roomEndTurn;
                const explorer = findExplorerByPlayerId(core, recentRoll.playerId);
                if (!roomEndTurn || !explorer) {
                    return core;
                }
                explorer.roomId = roomEndTurn.originalRoomId;
                resetExplorerTraits(explorer, roomEndTurn.traitsBeforeEffect);
                if (nextTotal >= 5) {
                    nextRoll.latestLabel = '没有坠落';
                    nextRoll.roomEndTurn = {
                        ...roomEndTurn,
                        previousPhysicalDamage: 0,
                        previousDestinationRoomId: undefined,
                        traitsBeforeEffect: { ...roomEndTurn.traitsBeforeEffect },
                    };
                } else {
                    explorer.roomId = 'basement-landing';
                    nextRoll.latestLabel = '坠落到地下室起始点';
                    nextRoll.roomEndTurn = {
                        ...roomEndTurn,
                        previousPhysicalDamage: roomEndTurn.previousPhysicalDamage,
                        previousDestinationRoomId: 'basement-landing',
                        traitsBeforeEffect: { ...roomEndTurn.traitsBeforeEffect },
                    };
                }
                core.recentRoll = nextRoll;
                core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
            } else if (recentRoll.kind === 'deathPrevention') {
                const explorer = findExplorerByPlayerId(core, recentRoll.playerId);
                if (!recentRoll.deathPrevention || !explorer) {
                    return core;
                }
                applyDeathPreventionRerollOutcome(core, explorer, recentRoll, nextRoll, nextTotal);
                core.recentRoll = nextRoll;
                core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
                const dustCompleted = completeDustTraitorVictoryIfNeeded(core, event.timestamp);
                if (dustCompleted) {
                    return dustCompleted;
                }
            }
            return finalizeRecentRollReroll();
        }
        case EVENTS.EVENT_ROLLED: {
            core.pendingEventRollStart = null;
            if (event.payload.drawnEventCardNameToBury) {
                buryEventCardToBottom(core, event.payload.drawnEventCardNameToBury);
            }
            const eventRoll = event.payload.eventRoll;
            core.recentRoll = {
                id: event.payload.rollId,
                kind: eventRoll.kind === 'dice' ? 'eventDiceRoll' : 'eventTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: event.payload.sourceTitle,
                eventDescription: event.payload.eventDescription,
                trait: eventRoll.trait,
                rollLabel: eventRoll.rollLabel,
                dice: [...(eventRoll.dice ?? [])],
                passiveBonus: eventRoll.passiveBonus ?? 0,
                branchThresholds: (eventRoll.branchThresholds ?? []).map((branch) => ({
                    ...branch,
                    effect: cloneUseEffect(branch.effect),
                })),
                latestLabel: eventRoll.label,
                consumedRabbitFootCardIds: [],
            };
            consumeNextNonCombatTraitReplacementAfterTraitRoll(
                core,
                event.payload.playerId,
                eventRoll,
            );
            const previousDiscovery = core.latestDiscovery;
            const eventDiscovery = cloneDiscoverySummary(event.payload.discovery);
            mergePreviousDiscoveryResolutionSteps(previousDiscovery, eventDiscovery);
            core.latestDiscovery = eventDiscovery;
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;
            const eventCardResolutionQueue = !event.payload.nextPendingEventChoice
                && (eventDiscovery.resolutionSteps?.length ?? 0) > 1
                ? createPendingCardResolutionQueue({
                    playerId: event.payload.playerId,
                    requiredPlayerIds: core.playerIds,
                    roomId: core.currentExplorer.roomId,
                    timestamp: event.timestamp,
                    deckKind: 'event',
                    discovery: eventDiscovery,
                })
                : [];
            if (event.payload.eventEffect && eventCardResolutionQueue.length > 0) {
                const deathPreventionScenarioRuntimeBeforeDefeat = event.payload.deathPrevention
                    ? cloneScenarioRuntimeStatus(core.scenarioRuntime)
                    : null;
                const deathPreventionMonstersBeforeDefeat = event.payload.deathPrevention
                    ? core.monsters.map(cloneMonster)
                    : [];
                const sourceEventRollBeforeEffect = cloneSourceEventRollFromRecentRoll(core.recentRoll);
                const {
                    eventEffectSnapshot,
                    pendingRolledDamageAllocation,
                } = applyEventEffectWithDeferredRolledDamage(
                    core,
                    event.payload.eventEffect,
                    event.payload.sourceTitle,
                    event.timestamp,
                );
                if (!activatePendingRolledDamageAllocation(core, pendingRolledDamageAllocation)) {
                    applyImmediateEventDeathPreventionIfNeeded(
                        core,
                        event.payload.deathPrevention,
                        event.timestamp,
                        deathPreventionScenarioRuntimeBeforeDefeat,
                        deathPreventionMonstersBeforeDefeat,
                    );
                }
                const replacedWithDamageRoll = (
                    pendingRolledDamageAllocation
                    || !event.payload.deathPrevention?.dice.length
                )
                    ? setEventRolledDamageRecentRollFromSnapshot(
                        core,
                        eventEffectSnapshot,
                        event.payload.sourceTitle,
                        event.timestamp,
                        sourceEventRollBeforeEffect,
                    )
                    : false;
                if (!replacedWithDamageRoll && isEventRecentRoll(core.recentRoll)) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
                core.pendingEventRollResolution = null;
                core.pendingCardResolutionQueue = eventCardResolutionQueue;
                core.turnEndedByDiscovery = true;
                const pendingDamageAllocationAfterEventRoll = core.pendingDamageAllocation;
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: pendingDamageAllocationAfterEventRoll ? 'endTurn' : resolveRecommendedAction(synced),
                    activePlayerId: pendingDamageAllocationAfterEventRoll?.playerId ?? synced.activePlayerId,
                    activityLog: appendActivity(synced, event.payload.logText, event.payload.discovery.tone),
                };
            }
            if (event.payload.eventEffect || event.payload.nextPendingEventChoice) {
                const nextPendingEventChoice = event.payload.nextPendingEventChoice
                    ? clonePendingEventChoice(event.payload.nextPendingEventChoice)
                    : undefined;
                const requiresAcknowledgement = eventRollResolutionNeedsAcknowledgement({
                    nextPendingEventChoice,
                });
                core.pendingEventRollResolution = {
                    rollId: event.payload.rollId,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.sourceTitle,
                    requiredPlayerIds: requiresAcknowledgement
                        ? [...core.playerIds]
                        : [event.payload.playerId],
                    acknowledgedPlayerIds: [],
                    effect: cloneUseEffect(event.payload.eventEffect ?? event.payload.nextPendingEventChoice!.effect),
                    nextPendingEventChoice,
                    deathPrevention: event.payload.deathPrevention
                        ? {
                            ...event.payload.deathPrevention,
                            dice: [...event.payload.deathPrevention.dice],
                            damageTraits: [...event.payload.deathPrevention.damageTraits],
                            traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        }
                        : undefined,
                    requiresAcknowledgement,
                };
            } else {
                core.pendingEventRollResolution = null;
            }
            core.turnEndedByDiscovery = true;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, event.payload.discovery.tone),
            };
        }
        case EVENTS.EVENT_ROLL_FINALIZED: {
            if (core.pendingEventRollResolution?.rollId !== event.payload.rollId) {
                return core;
            }
            if (!event.payload.isFullyAcknowledged) {
                core.pendingEventRollResolution = {
                    ...core.pendingEventRollResolution,
                    requiredPlayerIds: [...event.payload.requiredPlayerIds],
                    acknowledgedPlayerIds: [...event.payload.acknowledgedPlayerIds],
                };
                acknowledgeEventEffectCardResolution(
                    core,
                    event.payload.sourceTitle,
                    event.payload.playerId,
                );
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            if (event.payload.nextPendingEventChoice) {
                core.pendingEventChoice = clonePendingEventChoice(event.payload.nextPendingEventChoice);
                core.pendingEventRollResolution = null;
                core.pendingCardResolutionQueue = [];
                core.turnEndedByDiscovery = false;
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            const deathPreventionScenarioRuntimeBeforeDefeat = event.payload.deathPrevention
                ? cloneScenarioRuntimeStatus(core.scenarioRuntime)
                : null;
            const deathPreventionMonstersBeforeDefeat = event.payload.deathPrevention
                ? core.monsters.map(cloneMonster)
                : [];
            const rolledDamageAllocations: BetrayalPendingDamageAllocationState[] = [];
            const sourceEventRollBeforeEffect = cloneSourceEventRollFromRecentRoll(core.recentRoll);
            const eventEffectSnapshot = applyEventEffect(core, event.payload.effect, undefined, undefined, {
                deferRolledDamageAllocation: {
                    sourceTitle: event.payload.sourceTitle,
                    timestamp: event.timestamp,
                    allocations: rolledDamageAllocations,
                },
            });
            const pendingRolledDamageAllocation = chainPendingDamageAllocations(rolledDamageAllocations);
            if (pendingRolledDamageAllocation) {
                core.pendingDamageAllocation = pendingRolledDamageAllocation;
                core.activePlayerId = pendingRolledDamageAllocation.playerId;
            }
            if (!pendingRolledDamageAllocation && event.payload.deathPrevention?.dice.length) {
                core.recentRoll = {
                    id: `${event.payload.deathPrevention.playerId}-death-prevention-${event.timestamp}`,
                    kind: 'deathPrevention',
                    playerId: event.payload.deathPrevention.playerId,
                    sourceTitle: event.payload.deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
                    dice: [...event.payload.deathPrevention.dice],
                    passiveBonus: 0,
                    latestLabel: event.payload.deathPrevention.prevented ? '阻止死亡' : '正常死亡',
                    deathPrevention: {
                        cardId: event.payload.deathPrevention.cardId,
                        minTotal: event.payload.deathPrevention.minTotal,
                        damageKind: event.payload.deathPrevention.damageKind,
                        damageAmount: event.payload.deathPrevention.damageAmount,
                        damageTraits: [...event.payload.deathPrevention.damageTraits],
                        traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: deathPreventionScenarioRuntimeBeforeDefeat
                            ?? cloneScenarioRuntimeStatus(core.scenarioRuntime),
                        monstersBeforeDefeat: deathPreventionMonstersBeforeDefeat,
                    },
                    consumedRabbitFootCardIds: [],
                };
            }
            if (!pendingRolledDamageAllocation && event.payload.deathPrevention?.prevented) {
                const explorer = findExplorerByPlayerId(core, event.payload.deathPrevention.playerId);
                if (explorer) {
                    setExplorerTraitsToDeathsDoor(explorer);
                }
            } else if (!pendingRolledDamageAllocation) {
                applyDustEventEffectDeathIfNeeded(core);
            }
            const replacedWithDamageRoll = (
                pendingRolledDamageAllocation
                || !event.payload.deathPrevention?.dice.length
            )
                ? setEventRolledDamageRecentRollFromSnapshot(
                    core,
                    eventEffectSnapshot,
                    event.payload.sourceTitle,
                    event.timestamp,
                    sourceEventRollBeforeEffect,
                )
                : false;
            if (!replacedWithDamageRoll && isEventRecentRoll(core.recentRoll)) {
                core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
            }
            core.pendingEventRollResolution = null;
            acknowledgeEventEffectCardResolution(
                core,
                event.payload.sourceTitle,
                event.payload.playerId,
            );
            const eventTriggerPlayerId = event.payload.triggerPlayerId || event.payload.playerId;
            const synced = syncCurrentExplorerProjection(core);
            let nextCore = {
                ...synced,
                recommendedAction: pendingRolledDamageAllocation ? 'endTurn' : resolveRecommendedAction(synced),
                activePlayerId: pendingRolledDamageAllocation?.playerId ?? synced.activePlayerId,
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
            if (event.payload.hauntTriggered) {
                const scenario = scenarioConfigById(core.scenarioId);
                const hauntRevealerPlayerId = eventTriggerPlayerId;
                const hauntRevealResolution = event.payload.hauntRevealResolution
                    ?? resolveHauntRevealResolutionForTrigger(
                        core,
                        { id: null, name: event.payload.hauntTriggerLabel ?? event.payload.sourceTitle },
                        event.payload.hauntCardNumber,
                    );
                const hauntCardNumber = event.payload.hauntCardNumber ?? hauntRevealResolution.hauntCardNumber;
                const hauntTraitorResolution = event.payload.hauntTraitorResolution
                    ?? resolveHauntTraitorResolutionForTrigger(core, hauntCardNumber, hauntRevealerPlayerId, {
                        explicitTraitorPlayerId: event.payload.hauntTraitorPlayerId,
                        revealRepresentativeOnly: hauntRevealResolution.representativeOnly,
                    });
                const hauntFirstPlayerResolution = resolveHauntFirstPlayerResolutionForTrigger(
                    core,
                    hauntCardNumber,
                    hauntRevealerPlayerId,
                    hauntTraitorResolution,
                    { revealRepresentativeOnly: hauntRevealResolution.representativeOnly },
                );
                nextCore = reduceEvent(nextCore, nowEvent(EVENTS.HAUNT_TRIGGERED, {
                    traitorPlayerId: hauntTraitorResolution.traitorPlayerId,
                    hauntRevealerPlayerId,
                    nextPlayerId: hauntFirstPlayerResolution.nextPlayerId,
                    hauntCardNumber,
                    hauntTriggerLabel: event.payload.hauntTriggerLabel ?? hauntRevealResolution.triggeringOmenName,
                    hauntRevealResolution,
                    hauntTraitorResolution,
                    hauntFirstPlayerResolution,
                    dustSetup: event.payload.dustSetup,
                    magicCameraSetup: event.payload.magicCameraSetup,
                    helpingHandsSetup: event.payload.helpingHandsSetup,
                    uponReflectionSetup: event.payload.uponReflectionSetup,
                    logText: hauntCardNumber !== 1
                        ? `作祟触发：剧本${hauntCardNumber}（${event.payload.hauntTriggerLabel ?? event.payload.sourceTitle}）`
                        : scenario.logs.hauntTriggered,
                }, event.timestamp));
            }
            return nextCore;
        }
        case EVENTS.POSSESSION_USED: {
            if (event.payload.eventRollReplacement) {
                const replacement = event.payload.eventRollReplacement;
                const pending = core.pendingEventRollResolution;
                const recentRoll = core.recentRoll;
                const owner = findExplorerByPlayerId(core, event.payload.playerId);
                if (!pending || !recentRoll || !owner || pending.rollId !== recentRoll.id) {
                    return core;
                }
                applyTraitLoss(owner, ['sanity'], event.payload.effect.sanityCost);
                core.recentRoll = {
                    ...recentRoll,
                    trait: event.payload.effect.replacementTrait,
                    rollLabel: `${TRAIT_LABEL[event.payload.effect.replacementTrait]}检定`,
                    dice: [...replacement.dice],
                    passiveBonus: replacement.passiveBonus,
                    latestLabel: replacement.latestLabel,
                };
                const nextPendingEventChoice = replacement.nextPendingEventChoice
                    ? clonePendingEventChoice(replacement.nextPendingEventChoice)
                    : undefined;
                const requiresAcknowledgement = eventRollResolutionNeedsAcknowledgement({
                    nextPendingEventChoice,
                    hauntRevealResolution: replacement.hauntRevealResolution,
                    hauntTraitorResolution: replacement.hauntTraitorResolution,
                    dustSetup: replacement.dustSetup,
                    magicCameraSetup: replacement.magicCameraSetup,
                    helpingHandsSetup: replacement.helpingHandsSetup,
                    uponReflectionSetup: replacement.uponReflectionSetup,
                });
                core.pendingEventRollResolution = {
                    ...pending,
                    requiredPlayerIds: requiresAcknowledgement
                        ? [...core.playerIds]
                        : [pending.playerId],
                    acknowledgedPlayerIds: [],
                    hauntRoll: replacement.hauntRoll ? { ...replacement.hauntRoll } : undefined,
                    effect: cloneUseEffect(replacement.effect),
                    nextPendingEventChoice,
                    deathPrevention: replacement.deathPrevention
                        ? {
                            ...replacement.deathPrevention,
                            dice: [...replacement.deathPrevention.dice],
                            damageTraits: [...replacement.deathPrevention.damageTraits],
                            traitsBeforeDamage: { ...replacement.deathPrevention.traitsBeforeDamage },
                        }
                        : undefined,
                    hauntTriggered: replacement.hauntTriggered,
                    hauntCardNumber: replacement.hauntCardNumber,
                    hauntTriggerLabel: replacement.hauntTriggerLabel,
                    hauntTraitorPlayerId: replacement.hauntTraitorPlayerId,
                    hauntRevealResolution: replacement.hauntRevealResolution
                        ? { ...replacement.hauntRevealResolution }
                        : undefined,
                    hauntTraitorResolution: replacement.hauntTraitorResolution
                        ? cloneHauntTraitorResolution(replacement.hauntTraitorResolution) ?? undefined
                        : undefined,
                    dustSetup: replacement.dustSetup
                        ? cloneDustRuntimeState(replacement.dustSetup)
                        : undefined,
                    magicCameraSetup: replacement.magicCameraSetup
                        ? cloneMagicCameraRuntimeState(replacement.magicCameraSetup)
                        : undefined,
                    helpingHandsSetup: replacement.helpingHandsSetup
                        ? cloneHelpingHandsRuntimeState(replacement.helpingHandsSetup)
                        : undefined,
                    uponReflectionSetup: replacement.uponReflectionSetup
                        ? cloneUponReflectionRuntimeState(replacement.uponReflectionSetup)
                        : undefined,
                    requiresAcknowledgement,
                };
                core.usedCardIdsThisTurn = Array.from(new Set([
                    ...core.usedCardIdsThisTurn,
                    event.payload.cardId,
                ]));
                core.nextNonCombatTraitReplacement = null;
                if (core.latestDiscovery && core.latestDiscovery.title === recentRoll.sourceTitle) {
                    const total = resolveRecentRollTotal(core.recentRoll);
                    const rollLabel = core.recentRoll.rollLabel ?? '投骰';
                    core.latestDiscovery = {
                        ...core.latestDiscovery,
                        detail: `${rollLabel} ${total}：${replacement.latestLabel}；${formatEffectLabel(replacement.effect)}`,
                        tone: isWarningEventEffect(replacement.effect) ? 'warning' : 'accent',
                    };
                }
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: resolveRecommendedAction(synced),
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            applyBetrayalPossessionUsedState(core, event.payload);
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.ROOM_EFFECT_USED: {
            if (event.payload.effect.kind !== 'mysticElevator') {
                return core;
            }
            const roomsBeforeRoll = core.rooms.map(cloneBetrayalRoom);
            core.rooms = moveMysticElevatorRoom(core.rooms, event.payload.effect);
            core.currentExplorer.roomId = event.payload.effect.roomId;
            core.scenarioRuntime.usedRoomEffectIdsThisTurn = Array.from(new Set([
                ...core.scenarioRuntime.usedRoomEffectIdsThisTurn,
                event.payload.effect.kind,
            ]));
            core.recentRoll = {
                id: `${event.payload.playerId}-${event.payload.effect.kind}-${event.timestamp}`,
                kind: 'mysticElevator',
                playerId: event.payload.playerId,
                sourceTitle: event.payload.effect.roomName,
                dice: [...event.payload.effect.dice],
                passiveBonus: 0,
                latestLabel: `移动到${event.payload.effect.destinationRoomName}`,
                roomId: event.payload.effect.roomId,
                roomsBeforeRoll,
                consumedRabbitFootCardIds: [],
            };
            core.latestDiscovery = null;
            core.latestDiscoveryOwnerPlayerId = null;
            core.latestRoomDrawResolution = null;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_TRADED: {
            const tradeResult = applyBetrayalTradeAcceptedState(core, event.payload);
            if (!tradeResult) {
                return core;
            }
            const synced = syncCurrentExplorerProjection(core);
            const tradeUsedThisTurnPlayerIds = Array.from(new Set([
                ...core.tradeUsedThisTurnPlayerIds,
                tradeResult.requesterPlayerId,
            ]));
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                tradeUsedThisTurnPlayerIds,
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.POSSESSION_TRADE_REQUESTED: {
            core.pendingTradeAgreement = createBetrayalPendingTradeAgreement(event.payload, event.timestamp);
            core.activePlayerId = event.payload.targetPlayerId;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_TRADE_DECLINED: {
            clearBetrayalPendingTradeAgreement(core);
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.CORPSE_LOOTED: {
            if (!applyBetrayalCorpseLootedState(core, event.payload)) {
                return core;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.DUST_SEARCH_RESOLVED: {
            const dust = core.scenarioRuntime.dust;
            if (!dust) {
                return core;
            }
            if (event.payload.success) {
                dust.researchRoomIds = Array.from(new Set([
                    ...dust.researchRoomIds,
                    event.payload.roomId,
                ]));
            } else if (event.payload.swap) {
                applyDustSicknessSwap(dust, event.payload.swap);
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'search-for-cure'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-dust-search-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '寻找解药',
                trait: event.payload.trait,
                rollLabel: `${TRAIT_LABEL[event.payload.trait]}检定`,
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.success ? '放置研究标记' : '交换疾病标记',
                consumedRabbitFootCardIds: [],
            };
            const completed = completeDustTraitorVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.DUST_CURE_RESOLVED: {
            const dust = core.scenarioRuntime.dust;
            if (!dust) {
                return core;
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'cure-the-dust'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-dust-cure-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '治愈灰尘',
                trait: event.payload.trait,
                rollLabel: `${TRAIT_LABEL[event.payload.trait]}检定`,
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus + event.payload.researchBonus,
                latestLabel: event.payload.success ? '治愈成功' : '治愈失败',
                consumedRabbitFootCardIds: [],
            };
            if (event.payload.success) {
                return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                    result: createDustEndgameResult(core, 'survivors'),
                }, event.timestamp));
            }
            if (event.payload.swap) {
                applyDustSicknessSwap(dust, event.payload.swap);
            }
            const completed = completeDustTraitorVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.SICKNESS_EXCHANGE_REQUESTED: {
            const dust = core.scenarioRuntime.dust;
            if (!dust) {
                return core;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                scenarioRuntime: {
                    ...synced.scenarioRuntime,
                    dust: {
                        ...cloneDustRuntimeState(dust),
                        pendingSicknessExchange: {
                            id: `sickness-${event.payload.requesterPlayerId}-${event.payload.targetPlayerId}-${event.timestamp}`,
                            requesterPlayerId: event.payload.requesterPlayerId,
                            targetPlayerId: event.payload.targetPlayerId,
                        },
                    },
                },
                activePlayerId: event.payload.targetPlayerId,
                recommendedAction: 'trade',
                recentRoll: null,
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.SICKNESS_EXCHANGE_RESOLVED: {
            const dust = core.scenarioRuntime.dust;
            if (!dust) {
                return core;
            }
            if (event.payload.accepted && event.payload.swap) {
                applyDustSicknessSwap(dust, event.payload.swap);
            }
            dust.pendingSicknessExchange = undefined;
            core.activePlayerId = null;
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'sickness-exchange',
            ]));
            const completed = completeDustTraitorVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, event.payload.accepted ? 'accent' : 'neutral'),
            };
        }
        case EVENTS.HAUNT_SETUP_ENTRY_CONFIRMED: {
            core.scenarioRuntime.hauntSetupQueue = resolveHauntSetupQueueWithEntryStatus(
                core,
                event.payload.entryId,
                'resolved',
            );
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.PHOTO_TAKEN: {
            const magicCamera = core.scenarioRuntime.magicCamera;
            const actor = findExplorerByPlayerId(core, event.payload.playerId);
            if (!magicCamera || !actor) {
                return core;
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'take-photo'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-take-photo-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '拍照',
                trait: 'speed',
                rollLabel: '速度检定',
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.success ? '夺取本质' : '拍照失败',
                consumedRabbitFootCardIds: [],
            };
            if (event.payload.success) {
                magicCamera.heroEssencePlayerIds = magicCamera.heroEssencePlayerIds
                    .filter((playerId) => playerId !== event.payload.targetPlayerId);
                magicCamera.capturedEssencePlayerIds = Array.from(new Set([
                    ...magicCamera.capturedEssencePlayerIds,
                    event.payload.targetPlayerId,
                ]));
                moveExplorerTraitSteps(actor, event.payload.trait, 1);
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.MAGIC_CAMERA_SMASHED: {
            const magicCamera = core.scenarioRuntime.magicCamera;
            if (!magicCamera) {
                return core;
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'smash-magic-camera'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-smash-magic-camera-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '砸毁魔法相机',
                trait: 'sanity',
                rollLabel: '神志检定',
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.success ? '相机摧毁' : '摧毁失败',
                consumedRabbitFootCardIds: [],
            };
            if (event.payload.success) {
                magicCamera.cameraDestroyed = true;
                magicCamera.cameraHolderPlayerId = null;
                getAllExplorers(core).forEach(removeMagicCameraFromExplorer);
            }
            const completed = completeMagicCameraHeroVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.PHANTOM_PHOTOGRAPHER_ATTACK_RESOLVED: {
            const magicCamera = core.scenarioRuntime.magicCamera;
            const target = findExplorerByPlayerId(core, event.payload.targetPlayerId);
            if (!magicCamera || !target) {
                return core;
            }
            if (event.payload.damageToHero) {
                applyMentalDamage(target, event.payload.damageToHero, { allowSkull: true });
            }
            if (event.payload.defeatedPlayerId) {
                markDeadExplorer(core, event.payload.defeatedPlayerId);
            }
            core.recentRoll = {
                id: `${event.payload.monsterId}-phantom-attack-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.targetPlayerId,
                sourceTitle: '幻影摄影师攻击',
                trait: 'sanity',
                rollLabel: '神志攻击',
                dice: [...event.payload.dice],
                passiveBonus: 0,
                latestLabel: event.payload.damageToHero ? `精神伤害 ${event.payload.damageToHero}` : '未造成伤害',
                consumedRabbitFootCardIds: [],
            };
            const completed = completeMagicCameraTraitorVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: 'move',
                activityLog: appendActivity(synced, event.payload.logText, event.payload.damageToHero ? 'warning' : 'neutral'),
            };
        }
        case EVENTS.BLOOD_FROM_STONE_PEEKABOO_RESOLVED: {
            const actor = findExplorerByPlayerId(core, event.payload.playerId);
            if (!actor || !isBloodFromStoneHaunt(core)) {
                return core;
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'play-peekaboo'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-play-peekaboo-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '玩躲猫猫',
                trait: 'knowledge',
                rollLabel: '知识检定',
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus + event.payload.mirrorBonus,
                latestLabel: event.payload.success ? '移除石像小天使' : '一般伤害',
                consumedRabbitFootCardIds: [],
            };
            if (event.payload.success) {
                removeBloodFromStoneStoneCherubs(core, [
                    event.payload.sameRoomMonsterId,
                    event.payload.lineOfSightMonsterId,
                ]);
                const completed = completeBloodFromStoneHeroVictoryIfNeeded(core, event.timestamp);
                if (completed) {
                    return completed;
                }
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            const pendingPeekabooDamageAllocation = createPendingDamageAllocation({
                id: `blood-from-stone-peekaboo-${event.payload.playerId}-${event.timestamp}`,
                explorer: actor,
                sourceTitle: '玩躲猫猫',
                damageKind: 'general',
                amount: event.payload.damageAmount ?? 0,
                allowSkull: true,
            });
            const synced = syncCurrentExplorerProjection(core);
            if (pendingPeekabooDamageAllocation) {
                return {
                    ...synced,
                    pendingDamageAllocation: pendingPeekabooDamageAllocation,
                    activePlayerId: pendingPeekabooDamageAllocation.playerId,
                    recommendedAction: 'damage',
                    activityLog: appendActivity(synced, event.payload.logText, 'warning'),
                };
            }
            return {
                ...synced,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.TOOTH_NECKLACE_CHOICE_STARTED: {
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                pendingEventChoice: {
                    id: `tooth-necklace-${event.payload.playerId}-${event.timestamp}`,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.cardName,
                    acceptLabel: '获得属性',
                    declineLabel: '跳过',
                    sourceKind: 'item',
                    itemResolution: 'tooth-necklace-end-turn',
                    itemCardId: event.payload.cardId,
                    deferredTurnEnd: cloneTurnEndedPayload(event.payload.deferredTurnEnd),
                    effect: {
                        mode: 'chosenTrait',
                        amount: 1,
                        allowedTraits: [...event.payload.allowedTraits],
                        recommendedAction: 'endTurn',
                    },
                },
                activePlayerId: event.payload.playerId,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.TOOTH_NECKLACE_TRAIT_GAINED: {
            const actor = findExplorerByPlayerId(core, event.payload.playerId);
            if (actor && event.payload.accepted && event.payload.trait) {
                moveExplorerTraitSteps(actor, event.payload.trait, 1);
            }
            core.pendingEventChoice = null;
            const synced = syncCurrentExplorerProjection(core);
            const loggedCore: BetrayalCore = {
                ...synced,
                pendingEventChoice: null,
                activePlayerId: null,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(
                    synced,
                    event.payload.logText,
                    event.payload.accepted ? 'accent' : 'neutral',
                ),
            };
            return reduceEvent(
                loggedCore,
                nowEvent(EVENTS.TURN_ENDED, cloneTurnEndedPayload(event.payload.deferredTurnEnd), event.timestamp),
            );
        }
        case EVENTS.TURN_ENDED: {
            let roomEffectCore = core;
            let pendingRoomDamageAllocation: BetrayalPendingDamageAllocationState | null = null;
            let pendingDustEndTurnDamageAllocation: BetrayalPendingDamageAllocationState | null = null;
            const roomEndTurnTraitsBeforeEffect = { ...roomEffectCore.currentExplorer.traits };
            const roomEndTurnOriginalRoomId = roomEffectCore.currentExplorer.roomId;
            const shouldDeferRoomEndTurnDamage = Boolean(
                event.payload.deferAdvanceUntilRollAcknowledged
                && event.payload.roomEndTurnEffect?.kind === 'speedCheckFallToBasement',
            );
            if (event.payload.roomEndTurnEffect?.playerId === roomEffectCore.currentExplorer.playerId) {
                if (event.payload.roomEndTurnEffect.destinationRoomId) {
                    roomEffectCore.currentExplorer.roomId = event.payload.roomEndTurnEffect.destinationRoomId;
                }
                if (event.payload.roomEndTurnEffect.physicalDamage) {
                    if (event.payload.roomEndTurnEffect.kind === 'physicalDamage1') {
                        pendingRoomDamageAllocation = createPendingDamageAllocation({
                            id: `room-damage-${event.payload.roomEndTurnEffect.playerId}-${event.timestamp}`,
                            explorer: roomEffectCore.currentExplorer,
                            sourceTitle: event.payload.roomEndTurnEffect.roomName,
                            damageKind: 'physical',
                            amount: event.payload.roomEndTurnEffect.physicalDamage,
                            allowSkull: roomEffectCore.phase === 'haunt',
                            nextPlayerId: event.payload.nextPlayerId,
                            monsterMovementRoll: event.payload.monsterMovementRoll ?? null,
                            turnLogText: event.payload.turnLogText,
                            helpingHandsMonsterTurnControllerPlayerId: event.payload.helpingHandsMonsterTurnControllerPlayerId,
                            skipBloodFromStoneMonsterTurnStart: event.payload.skipBloodFromStoneMonsterTurnStart,
                        });
                    } else if (!shouldDeferRoomEndTurnDamage) {
                        applyPhysicalDamage(roomEffectCore.currentExplorer, event.payload.roomEndTurnEffect.physicalDamage);
                    }
                }
                roomEffectCore = syncCurrentExplorerProjection(roomEffectCore);
            }
            if (event.payload.dustEndTurn && roomEffectCore.scenarioRuntime.dust) {
                for (const swap of event.payload.dustEndTurn.swaps) {
                    applyDustSicknessSwap(roomEffectCore.scenarioRuntime.dust, swap);
                }
                const damageTarget = event.payload.dustEndTurn.damagePlayerId
                    ? findExplorerByPlayerId(roomEffectCore, event.payload.dustEndTurn.damagePlayerId)
                    : null;
                if (damageTarget && event.payload.dustEndTurn.damageAmount !== undefined) {
                    pendingDustEndTurnDamageAllocation = createPendingDamageAllocation({
                        id: `dust-end-turn-${event.payload.dustEndTurn.damagePlayerId}-${event.timestamp}`,
                        explorer: damageTarget,
                        sourceTitle: '灰尘冲动',
                        damageKind: 'general',
                        amount: event.payload.dustEndTurn.damageAmount,
                        allowSkull: true,
                        nextPlayerId: event.payload.nextPlayerId,
                        monsterMovementRoll: event.payload.monsterMovementRoll ?? null,
                        turnLogText: event.payload.turnLogText,
                        helpingHandsMonsterTurnControllerPlayerId: event.payload.helpingHandsMonsterTurnControllerPlayerId,
                        skipBloodFromStoneMonsterTurnStart: event.payload.skipBloodFromStoneMonsterTurnStart,
                    });
                }
                roomEffectCore = syncCurrentExplorerProjection(roomEffectCore);
                const completed = completeDustTraitorVictoryIfNeeded(roomEffectCore, event.timestamp);
                if (completed) {
                    return completed;
                }
            }
            if (
                event.payload.magicCameraEndTurnCapturedEssencePlayerIds?.length
                && roomEffectCore.scenarioRuntime.magicCamera
            ) {
                const magicCamera = roomEffectCore.scenarioRuntime.magicCamera;
                for (const playerId of event.payload.magicCameraEndTurnCapturedEssencePlayerIds) {
                    magicCamera.heroEssencePlayerIds = magicCamera.heroEssencePlayerIds
                        .filter((heroPlayerId) => heroPlayerId !== playerId);
                    magicCamera.capturedEssencePlayerIds = Array.from(new Set([
                        ...magicCamera.capturedEssencePlayerIds,
                        playerId,
                    ]));
                }
                roomEffectCore = syncCurrentExplorerProjection(roomEffectCore);
            }
            if (pendingRoomDamageAllocation) {
                const synced = syncCurrentExplorerProjection(roomEffectCore);
                return {
                    ...synced,
                    recommendedAction: 'endTurn',
                    turnEndedByDiscovery: false,
                    latestDiscovery: null,
                    latestDiscoveryOwnerPlayerId: null,
                    highlightedDeckKind: null,
                    pendingEventChoice: null,
                    pendingTradeAgreement: null,
                    pendingDamageAllocation: pendingRoomDamageAllocation,
                    activePlayerId: pendingRoomDamageAllocation.playerId,
                    recentRoll: null,
                    activityLog: appendActivity(synced, event.payload.logText, 'warning'),
                };
            }
            if (pendingDustEndTurnDamageAllocation) {
                const synced = syncCurrentExplorerProjection(roomEffectCore);
                return {
                    ...synced,
                    recommendedAction: 'damage',
                    turnEndedByDiscovery: false,
                    latestDiscovery: null,
                    latestDiscoveryOwnerPlayerId: null,
                    highlightedDeckKind: null,
                    pendingEventChoice: null,
                    pendingTradeAgreement: null,
                    pendingDamageAllocation: pendingDustEndTurnDamageAllocation,
                    activePlayerId: pendingDustEndTurnDamageAllocation.playerId,
                    recentRoll: null,
                    activityLog: appendActivity(synced, event.payload.logText, 'warning'),
                };
            }
            if (
                event.payload.deferAdvanceUntilRollAcknowledged
                && event.payload.roomEndTurnEffect?.kind === 'speedCheckFallToBasement'
                && event.payload.roomEndTurnEffect.speedRollDice
            ) {
                const recentRoll: BetrayalRecentRollState = {
                    id: `room-end-turn-${event.payload.roomEndTurnEffect.playerId}-${event.timestamp}`,
                    kind: 'roomEndTurnTraitCheck',
                    playerId: event.payload.roomEndTurnEffect.playerId,
                    sourceTitle: event.payload.roomEndTurnEffect.roomName,
                    trait: 'speed',
                    dice: [...event.payload.roomEndTurnEffect.speedRollDice],
                    passiveBonus: event.payload.roomEndTurnEffect.speedRollPassiveBonus ?? 0,
                    latestLabel: event.payload.roomEndTurnEffect.destinationRoomId
                        ? '坠落到地下室起始点'
                        : '没有坠落',
                    roomId: event.payload.roomEndTurnEffect.roomId,
                    roomEndTurn: {
                        kind: event.payload.roomEndTurnEffect.kind,
                        roomName: event.payload.roomEndTurnEffect.roomName,
                        roomId: event.payload.roomEndTurnEffect.roomId,
                        originalRoomId: roomEndTurnOriginalRoomId,
                        traitsBeforeEffect: roomEndTurnTraitsBeforeEffect,
                        previousPhysicalDamage: event.payload.roomEndTurnEffect.physicalDamage ?? 0,
                        previousDestinationRoomId: event.payload.roomEndTurnEffect.destinationRoomId,
                        nextPlayerId: event.payload.nextPlayerId,
                        monsterMovementRoll: event.payload.monsterMovementRoll ?? null,
                        turnLogText: event.payload.turnLogText,
                        helpingHandsMonsterTurnControllerPlayerId: event.payload.helpingHandsMonsterTurnControllerPlayerId,
                        skipBloodFromStoneMonsterTurnStart: event.payload.skipBloodFromStoneMonsterTurnStart,
                    },
                    consumedRabbitFootCardIds: [],
                };
                const synced = syncCurrentExplorerProjection(roomEffectCore);
                return {
                    ...synced,
                    recommendedAction: 'endTurn',
                    turnEndedByDiscovery: false,
                    latestDiscovery: null,
                    latestDiscoveryOwnerPlayerId: null,
                    highlightedDeckKind: null,
                    pendingTradeAgreement: null,
                    activePlayerId: null,
                    recentRoll,
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            const explorers = getAllExplorers(roomEffectCore);
            const next = replaceExplorers(roomEffectCore, explorers, event.payload.nextPlayerId);
            const revived = tryReviveTraitorAtMonsterTurnStart(next, event.payload.nextPlayerId);
            const nextCore = revived.core;
            const monsterMovementRoll = !revived.revived
                && (
                    shouldDeadTraitorControlJackSpirit(nextCore, event.payload.nextPlayerId)
                    || shouldDeadPlayerControlFeverish(nextCore, event.payload.nextPlayerId)
                )
                ? event.payload.monsterMovementRoll ?? null
                : null;
            const nextTurnStartSpeed = monsterMovementRoll?.speed ?? resolveTurnStartSpeed(nextCore, event.payload.nextPlayerId);
            const nextMovesRemaining = monsterMovementRoll?.moveAllowance ?? nextTurnStartSpeed;
            const recentRoll = event.payload.roomEndTurnEffect?.kind === 'speedCheckFallToBasement'
                && event.payload.roomEndTurnEffect.speedRollDice
                ? {
                    id: `room-end-turn-${event.payload.roomEndTurnEffect.playerId}-${event.timestamp}`,
                    kind: 'roomEndTurnTraitCheck' as const,
                    playerId: event.payload.roomEndTurnEffect.playerId,
                    sourceTitle: event.payload.roomEndTurnEffect.roomName,
                    trait: 'speed' as const,
                    dice: [...event.payload.roomEndTurnEffect.speedRollDice],
                    passiveBonus: event.payload.roomEndTurnEffect.speedRollPassiveBonus ?? 0,
                    latestLabel: event.payload.roomEndTurnEffect.destinationRoomId
                        ? '坠落到地下室起始点'
                        : '没有坠落',
                    roomId: event.payload.roomEndTurnEffect.roomId,
                    roomEndTurn: {
                        kind: event.payload.roomEndTurnEffect.kind,
                        roomName: event.payload.roomEndTurnEffect.roomName,
                        roomId: event.payload.roomEndTurnEffect.roomId,
                        originalRoomId: roomEndTurnOriginalRoomId,
                        traitsBeforeEffect: roomEndTurnTraitsBeforeEffect,
                        previousPhysicalDamage: event.payload.roomEndTurnEffect.physicalDamage ?? 0,
                        previousDestinationRoomId: event.payload.roomEndTurnEffect.destinationRoomId,
                        helpingHandsMonsterTurnControllerPlayerId: event.payload.helpingHandsMonsterTurnControllerPlayerId,
                        skipBloodFromStoneMonsterTurnStart: event.payload.skipBloodFromStoneMonsterTurnStart,
                    },
                    consumedRabbitFootCardIds: [],
                }
                : monsterMovementRoll
                    ? {
                        id: `monster-move-${monsterMovementRoll.monsterId}-${event.timestamp}`,
                        kind: 'monsterMoveRoll' as const,
                        playerId: monsterMovementRoll.playerId,
                        sourceTitle: `${monsterMovementRoll.monsterName}移动`,
                        trait: 'speed' as const,
                        rollLabel: `速度 ${monsterMovementRoll.speed}`,
                        dice: [...monsterMovementRoll.dice],
                        passiveBonus: 0,
                        latestLabel: `可移动 ${monsterMovementRoll.moveAllowance} 间`,
                        consumedRabbitFootCardIds: [],
                    }
                    : null;
                const resetScenarioRuntime = {
                    ...nextCore.scenarioRuntime,
                    corpseLootedByPlayerIdsThisTurn: [],
                    usedRoomEffectIdsThisTurn: [],
                    monsterTurn: createInitialMonsterTurnRuntimeState(),
                    bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: createBloodFromStoneTurnStartVisibility(nextCore),
                    bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [],
                    dust: nextCore.scenarioRuntime.dust
                        ? {
                            ...cloneDustRuntimeState(nextCore.scenarioRuntime.dust),
                            exchangedSicknessThisTurnPlayerIds: [],
                        }
                        : undefined,
                    helpingHands: nextCore.scenarioRuntime.helpingHands
                        ? {
                            ...cloneHelpingHandsRuntimeState(nextCore.scenarioRuntime.helpingHands),
                            trollHandAttackUsedIdsThisTurn: [],
                        }
                        : undefined,
                    magicCamera: nextCore.scenarioRuntime.magicCamera
                        ? cloneMagicCameraRuntimeState(nextCore.scenarioRuntime.magicCamera)
                        : undefined,
                };
            const advancedCore: BetrayalCore = {
                ...nextCore,
                turnStartSpeed: nextTurnStartSpeed,
                movesRemaining: nextMovesRemaining,
                recommendedAction: resolveRecommendedAction({
                    ...nextCore,
                    movesRemaining: nextMovesRemaining,
                    recentRoll,
                    turnEndedByDiscovery: false,
                }),
                usedCardIdsThisTurn: [],
                tradeUsedThisTurnPlayerIds: [],
                receivedCardIdsThisTurnByPlayerId: {
                    ...nextCore.receivedCardIdsThisTurnByPlayerId,
                    [event.payload.previousPlayerId]: [],
                },
                nextNonCombatTraitReplacement: null,
                nextNonCombatTraitRollTotalReplacement: null,
                pendingExtraTurnAfterCurrentTurn: clearPendingExtraTurnAfterCurrentTurn(nextCore, event.payload.previousPlayerId),
                turnEndedByDiscovery: false,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore, event.payload.nextPlayerId),
                scenarioRuntime: resetScenarioRuntime,
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                pendingTradeAgreement: null,
                activePlayerId: null,
                recentRoll,
                activityLog: revived.revived
                    ? appendActivity(
                        {
                            ...nextCore,
                            scenarioRuntime: resetScenarioRuntime,
                            activityLog: appendActivity(nextCore, event.payload.logText, 'accent'),
                        },
                        '杰克之灵回到了尸体所在房间，叛徒恢复肉身并重新回到宅邸中。',
                        'warning',
                    )
                    : appendActivity(nextCore, event.payload.logText, 'accent'),
            };
            const withBloodFromStone = event.payload.skipBloodFromStoneMonsterTurnStart
                ? advancedCore
                : startBloodFromStoneMonsterTurnAfterPlayerIfNeeded(
                    advancedCore,
                    event.payload.previousPlayerId,
                    event.timestamp,
                );
            return event.payload.deferredHelpingHandsMonsterTurnStart
                ? reduceEvent(withBloodFromStone, nowEvent(
                    EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED,
                    {
                        ...event.payload.deferredHelpingHandsMonsterTurnStart,
                        moveDice: [...event.payload.deferredHelpingHandsMonsterTurnStart.moveDice],
                    },
                    event.timestamp,
                ))
                : withBloodFromStone;
        }
        case EVENTS.DAMAGE_ALLOCATION_RESOLVED: {
            const pending = core.pendingDamageAllocation;
            const target = findExplorerByPlayerId(core, event.payload.playerId);
            if (!pending || !target) {
                return core;
            }
            const deathPreventionScenarioRuntimeBeforeDefeat = cloneScenarioRuntimeStatus(core.scenarioRuntime);
            const deathPreventionMonstersBeforeDefeat = core.monsters.map(cloneMonster);
            const appliedDamage = applyGeneralDamage(target, event.payload.amount, event.payload.traits, { allowSkull: pending.allowSkull });
            if (event.payload.damageKind === 'physical' && appliedDamage > 0) {
                applyStrangeAmuletPhysicalDamageBonus(target);
            }
            const targetReachedDeath = pending.allowSkull && isExplorerDead(target);
            if (targetReachedDeath && event.payload.deathPrevention?.prevented) {
                setExplorerTraitsToDeathsDoor(target);
            }
            if (event.payload.deathPrevention?.dice.length) {
                core.recentRoll = {
                    id: `${event.payload.deathPrevention.playerId}-death-prevention-${event.timestamp}`,
                    kind: 'deathPrevention',
                    playerId: event.payload.deathPrevention.playerId,
                    sourceTitle: event.payload.deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
                    dice: [...event.payload.deathPrevention.dice],
                    passiveBonus: 0,
                    latestLabel: event.payload.deathPrevention.prevented ? '阻止死亡' : '正常死亡',
                    deathPrevention: {
                        cardId: event.payload.deathPrevention.cardId,
                        minTotal: event.payload.deathPrevention.minTotal,
                        damageKind: event.payload.deathPrevention.damageKind,
                        damageAmount: event.payload.deathPrevention.damageAmount,
                        damageTraits: [...event.payload.deathPrevention.damageTraits],
                        traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: deathPreventionScenarioRuntimeBeforeDefeat,
                        monstersBeforeDefeat: deathPreventionMonstersBeforeDefeat,
                        releasedJackSpiritRoomId: event.payload.deathPrevention.releasedJackSpiritRoomId,
                        nextPlayerId: event.payload.deathPrevention.nextPlayerId,
                        monsterMovementRoll: event.payload.deathPrevention.monsterMovementRoll ?? null,
                        turnLogText: event.payload.deathPrevention.turnLogText,
                        helpingHandsMonsterTurnControllerPlayerId: event.payload.deathPrevention.helpingHandsMonsterTurnControllerPlayerId,
                        skipBloodFromStoneMonsterTurnStart: event.payload.deathPrevention.skipBloodFromStoneMonsterTurnStart,
                    },
                    consumedRabbitFootCardIds: [],
                };
            }
            const targetDefeated = targetReachedDeath && !event.payload.deathPrevention?.prevented;
            if (targetDefeated) {
                markDeadExplorer(core, target.playerId);
                if (pending.sourceTitle === '攻击' && target.playerId === core.scenarioRuntime.traitorPlayerId) {
                    core.scenarioRuntime.traitorCorpseRoomId = target.roomId;
                    core.scenarioRuntime.jackSpiritReleased = true;
                    core.scenarioRuntime.jackSpiritRoomId = resolveJackSpiritSpawnRoomId(core, target.roomId);
                    core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
                    core.monsters = [createBetrayalMonsterFromDefinition(
                        'crimson-jack-spirit',
                        'jack-spirit',
                        core.scenarioRuntime.jackSpiritRoomId,
                    )];
                }
            }
            const nextQueuedDamageAllocation = pending.nextDamageAllocations?.[0]
                ? {
                    ...clonePendingDamageAllocation(pending.nextDamageAllocations[0]),
                    nextDamageAllocations: pending.nextDamageAllocations.slice(1).map(clonePendingDamageAllocation),
                }
                : null;
            if (nextQueuedDamageAllocation) {
                const nextQueuedTarget = findExplorerByPlayerId(core, nextQueuedDamageAllocation.playerId);
                if (nextQueuedTarget) {
                    nextQueuedDamageAllocation.traitsBeforeDamage = { ...nextQueuedTarget.traits };
                }
            }
            core.pendingDamageAllocation = null;
            if (targetDefeated) {
                const bloodFromStoneCompleted = completeBloodFromStoneHauntVictoryIfNeeded(core, event.timestamp);
                if (bloodFromStoneCompleted) {
                    return bloodFromStoneCompleted;
                }
                if (isDustHaunt(core)) {
                    if (core.scenarioRuntime.dust?.permanentTraitorPlayerIds.includes(target.playerId)) {
                        addFeverishMonsterForPlayer(core, target.playerId);
                    }
                    const dustCompleted = shouldDeferDustTraitorVictoryForRabbitFoot(core, target.playerId)
                        ? null
                        : completeDustTraitorVictoryIfNeeded(core, event.timestamp);
                    if (dustCompleted) {
                        return dustCompleted;
                    }
                }
            }
            if (
                targetDefeated
                && (pending.sourceTitle === '攻击' || pending.sourceTitle === '木乃伊攻击')
                && target.playerId !== core.scenarioRuntime.traitorPlayerId
            ) {
                const livingHeroes = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ));
                if (livingHeroes.length === 0) {
                    const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
                    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                        result: isMummyHaunt(core)
                            ? createMummyEndgameResult(core, 'traitor')
                            : {
                                hauntId: 'crimson-jack-returns',
                                hauntTitle: resolveCrimsonJackHauntTitle(),
                                outcome: 'traitor',
                                winners: [traitor.playerId],
                                traitorPlayerId: traitor.playerId,
                                survivorsEscaped: [],
                                reward: { stars: 0, omens: countDrawnCards(core, 'omen'), logs: 0 },
                                stats: {
                                    roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                                    omensDrawn: countDrawnCards(core, 'omen'),
                                    itemsDrawn: countDrawnCards(core, 'item'),
                                    eventsDrawn: countDrawnCards(core, 'event'),
                                },
                            },
                    }, event.timestamp));
                }
            }
            if (targetDefeated && pending.sourceTitle === '巨魔手攻击') {
                const completed = completeHelpingHandsSoloVictoryIfNeeded(core, event.timestamp);
                if (completed) {
                    return completed;
                }
            }
            const synced = syncCurrentExplorerProjection(core);
            if (nextQueuedDamageAllocation) {
                return {
                    ...synced,
                    pendingDamageAllocation: nextQueuedDamageAllocation,
                    activePlayerId: nextQueuedDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(synced, event.payload.logText, 'warning'),
                };
            }
            if (event.payload.nextPlayerId && event.payload.deathPrevention?.dice.length) {
                return {
                    ...synced,
                    recommendedAction: 'endTurn',
                    activePlayerId: null,
                    activityLog: appendActivity(synced, event.payload.logText, 'warning'),
                };
            }
            if (event.payload.nextPlayerId) {
                return reduceEvent(synced, nowEvent(EVENTS.TURN_END_ROLL_ACKNOWLEDGED, {
                    previousPlayerId: event.payload.playerId,
                    nextPlayerId: event.payload.nextPlayerId,
                    monsterMovementRoll: event.payload.monsterMovementRoll ?? null,
                    helpingHandsMonsterTurnControllerPlayerId: event.payload.helpingHandsMonsterTurnControllerPlayerId,
                    skipBloodFromStoneMonsterTurnStart: event.payload.skipBloodFromStoneMonsterTurnStart,
                    logText: [event.payload.logText, event.payload.turnLogText].filter(Boolean).join('；'),
                }, event.timestamp));
            }
            return {
                ...synced,
                recommendedAction: pending.sourceTitle === '巨魔手攻击'
                    && core.scenarioRuntime.helpingHands?.activeMonsterTurn
                    ? 'endTurn'
                    : resolveRecommendedAction(synced),
                activePlayerId: null,
                activityLog: appendActivity(synced, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.RECENT_ROLL_ACKNOWLEDGED: {
            if (core.recentRoll?.id !== event.payload.rollId) {
                return core;
            }
            core.recentRoll = event.payload.isFullyAcknowledged
                ? null
                : {
                    ...core.recentRoll,
                    requiredPlayerIds: [...event.payload.requiredPlayerIds],
                    acknowledgedPlayerIds: [...event.payload.acknowledgedPlayerIds],
                };
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.TURN_END_ROLL_ACKNOWLEDGED: {
            const pendingDeathPreventionRecentRoll = core.recentRoll?.kind === 'deathPrevention'
                ? core.recentRoll
                : null;
            const pendingRoomEndTurnRecentRoll = core.recentRoll?.kind === 'roomEndTurnTraitCheck'
                ? core.recentRoll
                : null;
            const pendingRoomEndTurnRoll = pendingRoomEndTurnRecentRoll?.roomEndTurn ?? null;
            const pendingRoomEndTurnExplorer = pendingRoomEndTurnRecentRoll
                ? findExplorerByPlayerId(core, pendingRoomEndTurnRecentRoll.playerId)
                : null;
            const pendingRoomEndTurnDamageAllocation = (
                pendingRoomEndTurnRoll?.kind === 'speedCheckFallToBasement'
                && pendingRoomEndTurnRoll.previousDestinationRoomId
                && pendingRoomEndTurnRoll.previousPhysicalDamage > 0
                && pendingRoomEndTurnExplorer
            )
                ? createPendingDamageAllocation({
                    id: `room-fall-damage-${pendingRoomEndTurnRecentRoll.playerId}-${event.timestamp}`,
                    explorer: pendingRoomEndTurnExplorer,
                    sourceTitle: pendingRoomEndTurnRoll.roomName,
                    damageKind: 'physical',
                    amount: pendingRoomEndTurnRoll.previousPhysicalDamage,
                    allowSkull: core.phase === 'haunt',
                    nextPlayerId: event.payload.nextPlayerId,
                    monsterMovementRoll: event.payload.monsterMovementRoll ?? null,
                    turnLogText: event.payload.logText,
                    helpingHandsMonsterTurnControllerPlayerId: event.payload.helpingHandsMonsterTurnControllerPlayerId,
                    skipBloodFromStoneMonsterTurnStart: event.payload.skipBloodFromStoneMonsterTurnStart,
                })
                : null;
            if (pendingRoomEndTurnDamageAllocation) {
                const synced = syncCurrentExplorerProjection(core);
                return {
                    ...synced,
                    recommendedAction: 'endTurn',
                    turnEndedByDiscovery: false,
                    latestDiscovery: null,
                    latestDiscoveryOwnerPlayerId: null,
                    highlightedDeckKind: null,
                    pendingEventChoice: null,
                    pendingTradeAgreement: null,
                    pendingDamageAllocation: pendingRoomEndTurnDamageAllocation,
                    activePlayerId: pendingRoomEndTurnDamageAllocation.playerId,
                    recentRoll: null,
                };
            }
            if (pendingDeathPreventionRecentRoll) {
                buryDustDeadTraitorPossessions(core, pendingDeathPreventionRecentRoll.playerId, { deferForRabbitFoot: false });
                const dustCompleted = completeDustTraitorVictoryIfNeeded(core, event.timestamp, { deferForRabbitFoot: false });
                if (dustCompleted) {
                    return dustCompleted;
                }
            }
            const explorers = getAllExplorers(core);
            const next = replaceExplorers(core, explorers, event.payload.nextPlayerId);
            const revived = tryReviveTraitorAtMonsterTurnStart(next, event.payload.nextPlayerId);
            const nextCore = revived.core;
            const monsterMovementRoll = !revived.revived
                && (
                    shouldDeadTraitorControlJackSpirit(nextCore, event.payload.nextPlayerId)
                    || shouldDeadPlayerControlFeverish(nextCore, event.payload.nextPlayerId)
                )
                ? event.payload.monsterMovementRoll ?? null
                : null;
            const nextTurnStartSpeed = monsterMovementRoll?.speed ?? resolveTurnStartSpeed(nextCore, event.payload.nextPlayerId);
            const nextMovesRemaining = monsterMovementRoll?.moveAllowance ?? nextTurnStartSpeed;
            const resetScenarioRuntime = {
                ...nextCore.scenarioRuntime,
                corpseLootedByPlayerIdsThisTurn: [],
                usedRoomEffectIdsThisTurn: [],
                monsterTurn: createInitialMonsterTurnRuntimeState(),
                bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId: createBloodFromStoneTurnStartVisibility(nextCore),
                bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn: [],
                dust: nextCore.scenarioRuntime.dust
                    ? {
                        ...cloneDustRuntimeState(nextCore.scenarioRuntime.dust),
                        exchangedSicknessThisTurnPlayerIds: [],
                    }
                    : undefined,
                helpingHands: nextCore.scenarioRuntime.helpingHands
                    ? {
                        ...cloneHelpingHandsRuntimeState(nextCore.scenarioRuntime.helpingHands),
                        trollHandAttackUsedIdsThisTurn: [],
                    }
                    : undefined,
                magicCamera: nextCore.scenarioRuntime.magicCamera
                    ? cloneMagicCameraRuntimeState(nextCore.scenarioRuntime.magicCamera)
                    : undefined,
            };
            const recentMonsterMoveRoll = monsterMovementRoll
                ? {
                    id: `monster-move-${monsterMovementRoll.monsterId}-${event.timestamp}`,
                    kind: 'monsterMoveRoll' as const,
                    playerId: monsterMovementRoll.playerId,
                    sourceTitle: `${monsterMovementRoll.monsterName}移动`,
                    trait: 'speed' as const,
                    rollLabel: `速度 ${monsterMovementRoll.speed}`,
                    dice: [...monsterMovementRoll.dice],
                    passiveBonus: 0,
                    latestLabel: `可移动 ${monsterMovementRoll.moveAllowance} 间`,
                    consumedRabbitFootCardIds: [],
                }
                : null;
            const activityCore = {
                ...nextCore,
                scenarioRuntime: resetScenarioRuntime,
            };
            const advancedCore: BetrayalCore = {
                ...nextCore,
                turnStartSpeed: nextTurnStartSpeed,
                movesRemaining: nextMovesRemaining,
                recommendedAction: resolveRecommendedAction({ ...nextCore, movesRemaining: nextMovesRemaining, recentRoll: null }),
                usedCardIdsThisTurn: [],
                tradeUsedThisTurnPlayerIds: [],
                receivedCardIdsThisTurnByPlayerId: {
                    ...nextCore.receivedCardIdsThisTurnByPlayerId,
                    [event.payload.previousPlayerId]: [],
                },
                nextNonCombatTraitReplacement: null,
                nextNonCombatTraitRollTotalReplacement: null,
                pendingExtraTurnAfterCurrentTurn: clearPendingExtraTurnAfterCurrentTurn(nextCore, event.payload.previousPlayerId),
                turnEndedByDiscovery: false,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore, event.payload.nextPlayerId),
                scenarioRuntime: resetScenarioRuntime,
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                pendingTradeAgreement: null,
                activePlayerId: null,
                recentRoll: recentMonsterMoveRoll,
                activityLog: revived.revived
                    ? appendActivity(
                        {
                            ...activityCore,
                            activityLog: appendActivity(activityCore, event.payload.logText, 'accent'),
                        },
                        '杰克之灵回到了尸体所在房间，叛徒恢复肉身并重新回到宅邸中。',
                        'warning',
                    )
                    : appendActivity(activityCore, event.payload.logText, 'accent'),
            };
            return event.payload.skipBloodFromStoneMonsterTurnStart
                ? advancedCore
                : startBloodFromStoneMonsterTurnAfterPlayerIfNeeded(
                    advancedCore,
                    event.payload.previousPlayerId,
                    event.timestamp,
                );
        }
        case EVENTS.HAUNT_TRIGGERED: {
            const hauntCardNumber = event.payload.hauntCardNumber ?? event.payload.hauntRevealResolution?.hauntCardNumber ?? null;
            const hauntRevealerPlayerId = event.payload.hauntRevealerPlayerId
                ?? event.payload.traitorPlayerId
                ?? event.payload.nextPlayerId;
            const hauntTraitorResolution = event.payload.hauntTraitorResolution
                ?? resolveHauntTraitorResolutionForTrigger(core, hauntCardNumber, hauntRevealerPlayerId, {
                    explicitTraitorPlayerId: event.payload.traitorPlayerId,
                    revealRepresentativeOnly: event.payload.hauntRevealResolution?.representativeOnly,
                });
            const traitorPlayerId = hauntTraitorResolution.traitorPlayerId;
            const resolvedHauntFirstPlayerResolution = event.payload.hauntFirstPlayerResolution
                ?? resolveHauntFirstPlayerResolutionForTrigger(core, hauntCardNumber, hauntRevealerPlayerId, hauntTraitorResolution, {
                    revealRepresentativeOnly: event.payload.hauntRevealResolution?.representativeOnly,
                });
            const hauntFirstPlayerResolution = {
                ...resolvedHauntFirstPlayerResolution,
                nextPlayerId: event.payload.nextPlayerId,
            };
            const nextPlayerId = hauntFirstPlayerResolution.nextPlayerId;
            core.phase = 'haunt';
            core.scenarioRuntime.hauntTriggered = true;
            core.scenarioRuntime.hauntRevealerPlayerId = hauntRevealerPlayerId;
            core.scenarioRuntime.traitorPlayerId = traitorPlayerId;
            core.scenarioRuntime.hauntTraitorResolution = cloneHauntTraitorResolution(hauntTraitorResolution);
            core.scenarioRuntime.hauntFirstPlayerResolution = cloneHauntFirstPlayerResolution(hauntFirstPlayerResolution);
            core.scenarioRuntime.nextHauntPlayerId = nextPlayerId;
            core.scenarioRuntime.hauntCardNumber = hauntCardNumber;
            core.scenarioRuntime.hauntTriggerLabel = event.payload.hauntTriggerLabel;
            core.scenarioRuntime.hauntScenarioCardId = event.payload.hauntRevealResolution?.scenarioCardId ?? null;
            core.scenarioRuntime.hauntScenarioCardTitle = event.payload.hauntRevealResolution?.scenarioCardTitle ?? null;
            core.scenarioRuntime.hauntScenarioCardLabel = event.payload.hauntRevealResolution?.scenarioCardLabel ?? null;
            core.scenarioRuntime.triggeringOmenId = event.payload.hauntRevealResolution?.triggeringOmenId ?? null;
            core.scenarioRuntime.triggeringOmenName = event.payload.hauntRevealResolution?.triggeringOmenName ?? event.payload.hauntTriggerLabel;
            core.scenarioRuntime.hauntResolutionMatchedTrigger = event.payload.hauntRevealResolution?.triggerMatchesScenarioCard ?? false;
            core.scenarioRuntime.hauntResolutionRepresentativeOnly = event.payload.hauntRevealResolution?.representativeOnly ?? true;
            core.scenarioRuntime.dust = hauntCardNumber === 3
                ? cloneDustRuntimeState(event.payload.dustSetup ?? createDustRuntimeState(core, DEFAULT_BETRAYAL_RANDOM))
                : undefined;
            core.scenarioRuntime.magicCamera = undefined;
            core.scenarioRuntime.helpingHands = undefined;
            core.scenarioRuntime.bloodFromStone = undefined;
            core.scenarioRuntime.mummy = undefined;
            core.scenarioRuntime.uponReflection = hauntCardNumber === 7
                ? cloneUponReflectionRuntimeState(
                    event.payload.uponReflectionSetup
                        ?? createUponReflectionRuntimeState(core, hauntRevealerPlayerId, DEFAULT_BETRAYAL_RANDOM),
                )
                : undefined;
            if (hauntCardNumber === 1 && core.scenarioRuntime.hauntScenarioCardId === 'mummy-rampage') {
                core.scenarioRuntime.mummy = cloneMummyRuntimeState(setupMummyHaunt(core, traitorPlayerId));
            }
            if (hauntCardNumber === 12) {
                core.scenarioRuntime.helpingHands = cloneHelpingHandsRuntimeState(
                    event.payload.helpingHandsSetup
                        ?? setupHelpingHandsHaunt(core, hauntRevealerPlayerId),
                );
            }
            if (hauntCardNumber === 33) {
                core.scenarioRuntime.magicCamera = cloneMagicCameraRuntimeState(
                    event.payload.magicCameraSetup
                        ?? setupMagicCameraHaunt(core, traitorPlayerId),
                );
            }
            if (hauntCardNumber === 5) {
                setupBloodFromStoneHaunt(core);
            }
            if (hauntCardNumber === 7) {
                setupUponReflectionHaunt(core);
            }
            core.scenarioRuntime.hauntSetupQueue = resolveBetrayalHauntSetupQueue(core);
            if (hauntCardNumber === 7) {
                core.scenarioRuntime.hauntSetupQueue = resolveHauntSetupQueueWithEntryStatus(
                    core,
                    'deal-secret-mirror-combination',
                    'resolved',
                );
            }
            core.scenarioRuntime.monsterTurn = createInitialMonsterTurnRuntimeState();
            core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId =
                createBloodFromStoneTurnStartVisibility(core);
            core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn = [];
            core.turnStartSpeed = 0;
            core.movesRemaining = 0;
            core.usedCardIdsThisTurn = [];
            core.tradeUsedThisTurnPlayerIds = [];
            core.receivedCardIdsThisTurnByPlayerId = {
                ...core.receivedCardIdsThisTurnByPlayerId,
                ...(traitorPlayerId ? { [traitorPlayerId]: [] } : {}),
            };
            core.nextNonCombatTraitReplacement = null;
            core.nextNonCombatTraitRollTotalReplacement = null;
            core.turnEndedByDiscovery = false;
            const traitor = traitorPlayerId
                ? findExplorerByPlayerId(core, traitorPlayerId)
                : null;
            if (
                traitor
                && (hauntCardNumber ?? 1) === 1
                && core.scenarioRuntime.hauntScenarioCardId !== 'mummy-rampage'
            ) {
                healTraitorForHaunt(traitor, core.playerIds.length);
            }
            const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
            const nextTurnStartSpeed = resolveTurnStartSpeed(nextCore, nextPlayerId);
            return {
                ...nextCore,
                currentPlayer: nextPlayerId,
                turnStartSpeed: nextTurnStartSpeed,
                movesRemaining: nextTurnStartSpeed,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore, nextPlayerId),
                recommendedAction: 'move',
                pendingTradeAgreement: null,
                pendingCardResolutionQueue: core.pendingCardResolutionQueue.map(clonePendingCardResolution),
                activePlayerId: null,
                activityLog: appendActivity(nextCore, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.MONSTER_DAMAGE_RESOLVED: {
            applyBetrayalMonsterDamageOutcome(core, event.payload.monsterDamageOutcome);
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recentRoll: null,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(
                    syncedCore,
                    event.payload.logText,
                    event.payload.monsterDamageOutcome.kind === 'none' ? 'warning' : 'accent',
                ),
            };
        }
        case EVENTS.MONSTER_TURN_START_RESOLVED: {
            const monsterTurn = cloneMonsterTurnRuntimeState(core.scenarioRuntime.monsterTurn);
            monsterTurn.resolvedStartMonsterIds = Array.from(new Set([
                ...monsterTurn.resolvedStartMonsterIds,
                event.payload.monsterId,
            ]));
            if (event.payload.skippedTurn) {
                monsterTurn.skippedMonsterIdsThisTurn = Array.from(new Set([
                    ...monsterTurn.skippedMonsterIdsThisTurn,
                    event.payload.monsterId,
                ]));
                monsterTurn.moveRemainingById = Object.fromEntries(
                    Object.entries(monsterTurn.moveRemainingById)
                        .filter(([monsterId]) => monsterId !== event.payload.monsterId),
                );
            }
            if (event.payload.flippedStunnedSideUp) {
                flipStunnedMonsterSideUp(core, event.payload.monsterId);
            }
            core.scenarioRuntime.monsterTurn = monsterTurn;
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recentRoll: null,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(
                    syncedCore,
                    event.payload.logText,
                    event.payload.skippedTurn ? 'warning' : 'accent',
                ),
            };
        }
        case EVENTS.MONSTER_MOVEMENT_GROUP_ROLLED: {
            const monsterTurn = cloneMonsterTurnRuntimeState(core.scenarioRuntime.monsterTurn);
            const result = cloneMonsterMovementRollGroupResult(event.payload.result);
            monsterTurn.movementRollsByGroupId = {
                ...monsterTurn.movementRollsByGroupId,
                [result.groupId]: result,
            };
            monsterTurn.moveRemainingById = {
                ...monsterTurn.moveRemainingById,
                ...Object.fromEntries(
                    result.monsterIds.map((monsterId) => [monsterId, result.moveAllowance]),
                ),
            };
            core.scenarioRuntime.monsterTurn = monsterTurn;
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recentRoll: {
                    id: `monster-move-group-${result.groupId}-${event.timestamp}`,
                    kind: 'monsterMoveRoll' as const,
                    playerId: result.playerId,
                    sourceTitle: `${result.monsterName}移动`,
                    trait: 'speed',
                    rollLabel: `速度 ${result.speed}`,
                    dice: [...result.dice],
                    passiveBonus: 0,
                    latestLabel: `每只可移动 ${result.moveAllowance} 间`,
                    consumedRabbitFootCardIds: [],
                },
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.MONSTER_MOVED: {
            const monsterTurn = cloneMonsterTurnRuntimeState(core.scenarioRuntime.monsterTurn);
            core.monsters = core.monsters.map((monster) => (
                monster.id === event.payload.monsterId
                    ? { ...monster, roomId: event.payload.toRoomId }
                    : monster
            ));
            if (event.payload.monsterId === 'jack-spirit') {
                core.scenarioRuntime.jackSpiritRoomId = event.payload.toRoomId;
                core.scenarioRuntime.jackSpiritHasMovedSinceRelease = true;
            }
            if (event.payload.teleportMove) {
                monsterTurn.movedMonsterIdsThisTurn = Array.from(new Set([
                    ...monsterTurn.movedMonsterIdsThisTurn,
                    event.payload.monsterId,
                ]));
            }
            monsterTurn.moveRemainingById = {
                ...monsterTurn.moveRemainingById,
                [event.payload.monsterId]: event.payload.moveRemaining,
            };
            core.scenarioRuntime.monsterTurn = monsterTurn;
            const mummyGirlPickedUp = collectMummyGirlByMummyIfPresent(
                core,
                event.payload.monsterId,
                event.payload.toRoomId,
            );
            const mummyGirlPickupLog = mummyGirlPickedUp ? '；木乃伊拾起女孩' : '';
            const syncedCore = syncCurrentExplorerProjection(core);
            const movedCore = {
                ...syncedCore,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, `${event.payload.logText}${mummyGirlPickupLog}`, 'accent'),
            };
            return completeMummyTraitorVictoryIfNeeded(movedCore, event.timestamp) ?? movedCore;
        }
        case EVENTS.MONSTER_ATTACK_HERO_RESOLVED: {
            const monsterTurn = cloneMonsterTurnRuntimeState(core.scenarioRuntime.monsterTurn);
            monsterTurn.attackedMonsterIdsThisTurn = Array.from(new Set([
                ...monsterTurn.attackedMonsterIdsThisTurn,
                event.payload.monsterId,
            ]));
            core.scenarioRuntime.monsterTurn = monsterTurn;
            const defender = findExplorerByPlayerId(core, event.payload.targetPlayerId);
            if (event.payload.monsterDamageOutcome) {
                applyBetrayalMonsterDamageOutcome(core, event.payload.monsterDamageOutcome);
            }
            const mummyStealableCards = defender && event.payload.damageToHero && event.payload.damageToHero >= 2
                ? resolveMummyStealableCards(core, defender.playerId)
                : [];
            const pendingMummyAttackReward = defender
                && isMummyMonster(core, event.payload.monsterId)
                && event.payload.damageToHero
                && event.payload.damageToHero >= 2
                && mummyStealableCards.length > 0
                && core.scenarioRuntime.mummy
                ? {
                    id: `mummy-attack-reward-${event.payload.monsterId}-${defender.playerId}-${event.timestamp}`,
                    controllerPlayerId: event.payload.playerId,
                    monsterId: event.payload.monsterId,
                    monsterName: event.payload.monsterName,
                    defenderPlayerId: defender.playerId,
                    damageToHero: event.payload.damageToHero,
                    defenderTraitsBeforeDamage: { ...event.payload.defenderTraitsBeforeDamage },
                    stealableCardIds: mummyStealableCards.map((card) => card.id),
                }
                : undefined;
            if (pendingMummyAttackReward && core.scenarioRuntime.mummy) {
                core.scenarioRuntime.mummy.pendingAttackReward = pendingMummyAttackReward;
            }
            const damageKind = event.payload.damageKind ?? 'physical';
            const pendingMonsterAttackDamageAllocation = defender && event.payload.damageToHero && !pendingMummyAttackReward
                ? createPendingDamageAllocation({
                    id: `monster-attack-damage-${defender.playerId}-${event.timestamp}`,
                    explorer: defender,
                    sourceTitle: '攻击',
                    damageKind,
                    amount: event.payload.damageToHero,
                    allowSkull: true,
                    forcedTraitSequence: isMummyMonster(core, event.payload.monsterId)
                        ? resolveMummyForcedDamageTraits(defender, event.payload.damageToHero, { allowSkull: true })
                        : undefined,
                })
                : null;
            const monsterTraits = core.monsters.find((monster) => monster.id === event.payload.monsterId);
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                pendingDamageAllocation: pendingMonsterAttackDamageAllocation,
                activePlayerId: pendingMonsterAttackDamageAllocation?.playerId
                    ?? pendingMummyAttackReward?.controllerPlayerId
                    ?? null,
                recentRoll: {
                    id: `${event.payload.monsterId}-normal-attack-${event.timestamp}`,
                    kind: 'attackRoll' as const,
                    playerId: event.payload.playerId,
                    sourceTitle: `${event.payload.monsterName}攻击`,
                    dice: [...event.payload.dice],
                    passiveBonus: 0,
                    latestLabel: event.payload.monsterRoll === event.payload.heroRoll
                        ? '平手无伤害'
                        : event.payload.damageToHero
                            ? pendingMummyAttackReward
                                ? `可造成 ${event.payload.damageToHero} 点伤害或偷取`
                                : `造成 ${event.payload.damageToHero} 点伤害`
                            : (event.payload.monsterDamageOutcome?.logLabel ?? '怪物受伤'),
                    attack: {
                        target: 'hero',
                        defenderPlayerId: event.payload.targetPlayerId,
                        damageKind,
                        previousDamageToAttacker: event.payload.monsterDamageOutcome?.damageAmount ?? 0,
                        previousDamageToDefender: event.payload.damageToHero ?? 0,
                        defenderRoll: event.payload.heroRoll,
                        defenderDefenseExtraDice: defender
                            ? resolveDefenseExtraDiceWhenAttacked(defender)
                            : 0,
                        attackerTraitsBeforeDamage: {
                            might: monsterTraits?.might ?? 0,
                            speed: monsterTraits?.speed ?? 0,
                            knowledge: monsterTraits?.knowledge ?? 0,
                            sanity: monsterTraits?.sanity ?? 0,
                        },
                        defenderTraitsBeforeDamage: { ...event.payload.defenderTraitsBeforeDamage },
                        weaponAttackTrait: event.payload.attackTrait,
                    },
                    consumedRabbitFootCardIds: [],
                },
                recommendedAction: pendingMonsterAttackDamageAllocation || pendingMummyAttackReward
                    ? 'endTurn'
                    : resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(
                    syncedCore,
                    event.payload.logText,
                    event.payload.damageToHero ? 'warning' : 'accent',
                ),
            };
        }
        case EVENTS.BLOOD_FROM_STONE_MONSTER_TURN_ENDED: {
            if (core.scenarioRuntime.bloodFromStone) {
                core.scenarioRuntime.bloodFromStone = {
                    ...core.scenarioRuntime.bloodFromStone,
                    activeMonsterTurn: false,
                    monsterTurnControllerPlayerId: null,
                };
            }
            core.scenarioRuntime.monsterTurn = createInitialMonsterTurnRuntimeState();
            const pendingGazeDamageAllocation = createBloodFromStoneGazeDamageAllocationQueue(
                core,
                event.payload.damageRolls,
                event.payload.nextPlayerId,
                event.payload.turnLogText,
            );
            const syncedCore = syncCurrentExplorerProjection(core);
            if (pendingGazeDamageAllocation) {
                return {
                    ...syncedCore,
                    pendingDamageAllocation: pendingGazeDamageAllocation,
                    activePlayerId: pendingGazeDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    recentRoll: null,
                    activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
                };
            }
            return reduceEvent(syncedCore, nowEvent(EVENTS.TURN_END_ROLL_ACKNOWLEDGED, {
                previousPlayerId: event.payload.controllerPlayerId,
                nextPlayerId: event.payload.nextPlayerId,
                monsterMovementRoll: null,
                skipBloodFromStoneMonsterTurnStart: true,
                logText: [event.payload.logText, event.payload.turnLogText].filter(Boolean).join('；'),
            }, event.timestamp));
        }
        case EVENTS.BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED: {
            core.monsters = [
                ...core.monsters,
                ...event.payload.placements.map((placement) => createBetrayalMonsterFromDefinition(
                    'blood-from-stone-stone-cherub',
                    placement.monsterId,
                    placement.roomId,
                )),
            ];
            const plan = resolveBloodFromStoneSetupPlacementPlan(core);
            core.scenarioRuntime.hauntSetupQueue = resolveHauntSetupQueueWithEntryStatus(
                core,
                'place-additional-stone-cherubs',
                plan.pendingPlayerChoiceCount > 0 ? 'manual-check' : 'resolved',
            );
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.DYNAMITE_ATTACK_RESOLVED: {
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'haunt-attack',
                event.payload.cardId,
            ]));
            const attacker = findExplorerByPlayerId(core, event.payload.attackerPlayerId);
            if (attacker) {
                attacker.inventory = attacker.inventory.filter((card) => card.id !== event.payload.cardId);
            }
            buryPossessionCardToBottom(core, 'item', event.payload.cardId);
            for (const monsterRoll of event.payload.monsterRolls) {
                if (monsterRoll.monsterDamageOutcome) {
                    applyBetrayalMonsterDamageOutcome(core, monsterRoll.monsterDamageOutcome);
                }
            }
            const damageAllocations = event.payload.explorerRolls
                .filter((roll) => !roll.passed)
                .map((roll) => {
                    const explorer = findExplorerByPlayerId(core, roll.playerId);
                    return explorer
                        ? createPendingDamageAllocation({
                            id: `dynamite-damage-${roll.playerId}-${event.timestamp}`,
                            explorer,
                            sourceTitle: event.payload.cardName,
                            damageKind: 'physical',
                            amount: 4,
                            allowSkull: true,
                        })
                        : null;
                })
                .filter((allocation): allocation is BetrayalPendingDamageAllocationState => Boolean(allocation));
            const pendingDynamiteDamageAllocation = chainPendingDamageAllocations(damageAllocations);
            const syncedCore = syncCurrentExplorerProjection(core);
            if (pendingDynamiteDamageAllocation) {
                return {
                    ...syncedCore,
                    pendingDamageAllocation: pendingDynamiteDamageAllocation,
                    activePlayerId: pendingDynamiteDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
                };
            }
            return {
                ...syncedCore,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(
                    syncedCore,
                    event.payload.logText,
                    event.payload.monsterRolls.some((roll) => !roll.passed) ? 'warning' : 'accent',
                ),
            };
        }
        case EVENTS.HAUNT_ATTACK_RESOLVED: {
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'haunt-attack',
                ...(event.payload.weaponCardId ? [event.payload.weaponCardId] : []),
            ]));
            const attacker = findExplorerByPlayerId(core, event.payload.attackerPlayerId);
            const defender = event.payload.defenderPlayerId
                ? findExplorerByPlayerId(core, event.payload.defenderPlayerId)
                : null;
            const canDeferOrdinaryDefenderAttackDamage = canDeferOrdinaryAttackDamageToDefender(
                core,
                event.payload.target,
            );
            let pendingAttackDamageAllocation: BetrayalPendingDamageAllocationState | null = null;
            if (attacker && event.payload.damageToAttacker) {
                applyAttackDamage(attacker, event.payload.damageToAttacker, event.payload.damageKind ?? 'physical');
            }
            if (attacker && event.payload.weaponSpeedCost) {
                applyTraitLoss(attacker, ['speed'], event.payload.weaponSpeedCost);
            }
            if (defender && event.payload.damageToDefender) {
                if (canDeferOrdinaryDefenderAttackDamage) {
                    pendingAttackDamageAllocation = createPendingDamageAllocation({
                        id: `haunt-attack-damage-${defender.playerId}-${event.timestamp}`,
                        explorer: defender,
                        sourceTitle: '攻击',
                        damageKind: event.payload.damageKind ?? 'physical',
                        amount: event.payload.damageToDefender,
                        allowSkull: true,
                    });
                }
                if (!pendingAttackDamageAllocation) {
                    applyAttackDamage(defender, event.payload.damageToDefender, event.payload.damageKind ?? 'physical');
                }
            }
            if (event.payload.deathPrevention?.prevented) {
                const protectedExplorer = findExplorerByPlayerId(core, event.payload.deathPrevention.playerId);
                if (protectedExplorer) {
                    setExplorerTraitsToDeathsDoor(protectedExplorer);
                }
            }
            if (
                event.payload.attackRoll
                && event.payload.attackRoll.dice.length > 0
            ) {
                core.recentRoll = {
                    id: event.payload.attackRoll.id,
                    kind: 'attackRoll',
                    playerId: event.payload.attackerPlayerId,
                    sourceTitle: '攻击投骰',
                    dice: [...event.payload.attackRoll.dice],
                    passiveBonus: event.payload.attackRoll.passiveBonus,
                    latestLabel: event.payload.attackRoll.latestLabel,
                    attack: {
                        target: event.payload.target,
                        defenderPlayerId: event.payload.defenderPlayerId,
                        damageKind: event.payload.damageKind ?? 'physical',
                        previousDamageToAttacker: event.payload.damageToAttacker ?? 0,
                        previousDamageToDefender: event.payload.damageToDefender ?? 0,
                        defenderRoll: event.payload.defenderRoll ?? 0,
                        defenderDefenseExtraDice: defender
                            ? resolveDefenseExtraDiceWhenAttacked(defender)
                            : 0,
                        attackerTraitsBeforeDamage: { ...event.payload.attackRoll.attackerTraitsBeforeDamage },
                        defenderTraitsBeforeDamage: event.payload.attackRoll.defenderTraitsBeforeDamage
                            ? { ...event.payload.attackRoll.defenderTraitsBeforeDamage }
                            : undefined,
                        weaponCardId: event.payload.weaponCardId,
                        weaponName: event.payload.weaponName,
                        weaponAttackBonus: event.payload.weaponAttackBonus,
                        weaponExtraDice: event.payload.weaponExtraDice,
                        weaponSpeedCost: event.payload.weaponSpeedCost,
                        weaponAttackTrait: event.payload.weaponAttackTrait,
                    },
                    consumedRabbitFootCardIds: [],
                };
            }
            if (event.payload.deathPrevention?.dice.length) {
                core.recentRoll = {
                    id: `${event.payload.deathPrevention.playerId}-death-prevention-${event.timestamp}`,
                    kind: 'deathPrevention',
                    playerId: event.payload.deathPrevention.playerId,
                    sourceTitle: event.payload.deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
                    dice: [...event.payload.deathPrevention.dice],
                    passiveBonus: 0,
                    latestLabel: event.payload.deathPrevention.prevented ? '阻止死亡' : '正常死亡',
                    deathPrevention: {
                        cardId: event.payload.deathPrevention.cardId,
                        minTotal: event.payload.deathPrevention.minTotal,
                        damageKind: event.payload.deathPrevention.damageKind,
                        damageAmount: event.payload.deathPrevention.damageAmount,
                        traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(core.scenarioRuntime),
                        monstersBeforeDefeat: core.monsters.map(cloneMonster),
                        releasedJackSpiritRoomId: event.payload.deathPrevention.releasedJackSpiritRoomId,
                    },
                    consumedRabbitFootCardIds: [],
                };
            }
            if (pendingAttackDamageAllocation) {
                const syncedCore = syncCurrentExplorerProjection(core);
                return {
                    ...syncedCore,
                    pendingDamageAllocation: pendingAttackDamageAllocation,
                    activePlayerId: pendingAttackDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
                };
            }
            if (isMagicCameraHaunt(core)) {
                const magicCamera = core.scenarioRuntime.magicCamera;
                if (magicCamera && event.payload.monsterDamageOutcome) {
                    applyBetrayalMonsterDamageOutcome(core, event.payload.monsterDamageOutcome);
                } else if (magicCamera && event.payload.defeatedMonsterId) {
                    magicCamera.killedPhantomPhotographerIds = Array.from(new Set([
                        ...magicCamera.killedPhantomPhotographerIds,
                        event.payload.defeatedMonsterId,
                    ]));
                    magicCamera.stunnedPhantomPhotographerIds = magicCamera.stunnedPhantomPhotographerIds
                        .filter((id) => id !== event.payload.defeatedMonsterId);
                    core.monsters = core.monsters.filter((monster) => monster.id !== event.payload.defeatedMonsterId);
                } else if (magicCamera && event.payload.outcome === 'phantom-stunned' && event.payload.defenderMonsterId) {
                    magicCamera.stunnedPhantomPhotographerIds = Array.from(new Set([
                        ...magicCamera.stunnedPhantomPhotographerIds,
                        event.payload.defenderMonsterId,
                    ]));
                }
                if (event.payload.defeatedPlayerId) {
                    markDeadExplorer(core, event.payload.defeatedPlayerId);
                }
                const heroCompleted = completeMagicCameraHeroVictoryIfNeeded(core, event.timestamp);
                if (heroCompleted) {
                    return heroCompleted;
                }
                const traitorCompleted = completeMagicCameraTraitorVictoryIfNeeded(core, event.timestamp);
                if (traitorCompleted) {
                    return traitorCompleted;
                }
                const nextPlayerId = rotateToNextLivingPlayer(core, core.currentPlayer);
                const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
                return {
                    ...nextCore,
                    currentPlayer: nextPlayerId,
                    recommendedAction: 'move',
                    activityLog: appendActivity(nextCore, event.payload.logText, event.payload.outcome === 'no-damage' ? 'neutral' : 'accent'),
                };
            }
            if (isDustHaunt(core)) {
                if (event.payload.defeatedPlayerId) {
                    markDeadExplorer(core, event.payload.defeatedPlayerId);
                    if (core.scenarioRuntime.dust?.permanentTraitorPlayerIds.includes(event.payload.defeatedPlayerId)) {
                        addFeverishMonsterForPlayer(core, event.payload.defeatedPlayerId);
                    }
                }
                const completed = completeDustTraitorVictoryIfNeeded(core, event.timestamp);
                if (completed) {
                    return completed;
                }
                const nextPlayerId = rotateToNextLivingPlayer(core, core.currentPlayer);
                const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
                return {
                    ...nextCore,
                    currentPlayer: nextPlayerId,
                    recommendedAction: 'move',
                    activityLog: appendActivity(nextCore, event.payload.logText, event.payload.defeatedPlayerId ? 'warning' : 'accent'),
                };
            }
            if (isHelpingHandsHaunt(core)) {
                const helpingHands = core.scenarioRuntime.helpingHands;
                if (helpingHands && event.payload.helpingHandsAttackRewardChoice) {
                    helpingHands.pendingAttackReward = {
                        ...event.payload.helpingHandsAttackRewardChoice,
                        defenderTraitsBeforeDamage: { ...event.payload.helpingHandsAttackRewardChoice.defenderTraitsBeforeDamage },
                    };
                }
                if (event.payload.defeatedPlayerId) {
                    markDeadExplorer(core, event.payload.defeatedPlayerId);
                }
                const completed = completeHelpingHandsSoloVictoryIfNeeded(core, event.timestamp);
                if (completed) {
                    return completed;
                }
                const tone = event.payload.defeatedPlayerId
                    ? 'warning'
                    : event.payload.outcome === 'no-damage'
                        ? 'neutral'
                        : 'accent';
                if (
                    event.payload.attackerPlayerId === core.currentPlayer
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(event.payload.attackerPlayerId)
                ) {
                    const syncedCore = syncCurrentExplorerProjection(core);
                    return {
                        ...syncedCore,
                        recommendedAction: resolveRecommendedAction(syncedCore),
                        activityLog: appendActivity(syncedCore, event.payload.logText, tone),
                    };
                }
                const nextPlayerId = rotateToNextLivingPlayer(core, core.currentPlayer);
                const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
                return {
                    ...nextCore,
                    currentPlayer: nextPlayerId,
                    recommendedAction: 'move',
                    activityLog: appendActivity(nextCore, event.payload.logText, tone),
                };
            }
            if (
                event.payload.outcome === 'traitor-defeated'
                && event.payload.defeatedPlayerId
                && !isMummyHaunt(core)
            ) {
                core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
                    ...core.scenarioRuntime.deadExplorerPlayerIds,
                    event.payload.defeatedPlayerId,
                ]));
                const traitor = findExplorerByPlayerId(core, event.payload.defeatedPlayerId);
                core.scenarioRuntime.traitorCorpseRoomId = traitor?.roomId ?? core.activeRoomId;
                core.scenarioRuntime.jackSpiritReleased = true;
                core.scenarioRuntime.jackSpiritRoomId = event.payload.releasedJackSpiritRoomId
                    ?? resolveJackSpiritSpawnRoomId(core, core.scenarioRuntime.traitorCorpseRoomId ?? core.activeRoomId);
                core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
                core.monsters = [createBetrayalMonsterFromDefinition(
                    'crimson-jack-spirit',
                    'jack-spirit',
                    core.scenarioRuntime.jackSpiritRoomId,
                )];
            }
            if (event.payload.outcome === 'hero-defeated' && event.payload.defeatedPlayerId) {
                core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
                    ...core.scenarioRuntime.deadExplorerPlayerIds,
                    event.payload.defeatedPlayerId,
                ]));
                const livingHeroes = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ));
                if (livingHeroes.length === 0) {
                    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                        result: isMummyHaunt(core)
                            ? createMummyEndgameResult(core, 'traitor')
                            : {
                                hauntId: 'crimson-jack-returns',
                                hauntTitle: resolveCrimsonJackHauntTitle(),
                                outcome: 'traitor',
                                winners: [findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer)?.playerId ?? core.currentExplorer.playerId],
                                traitorPlayerId: findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer)?.playerId ?? core.currentExplorer.playerId,
                                survivorsEscaped: [],
                                reward: { stars: 0, omens: countDrawnCards(core, 'omen'), logs: 0 },
                                stats: {
                                    roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                                    omensDrawn: countDrawnCards(core, 'omen'),
                                    itemsDrawn: countDrawnCards(core, 'item'),
                                    eventsDrawn: countDrawnCards(core, 'event'),
                                },
                            },
                    }, event.timestamp));
                }
            }
            if (
                event.payload.attackerPlayerId === core.currentPlayer
                && !core.scenarioRuntime.deadExplorerPlayerIds.includes(event.payload.attackerPlayerId)
            ) {
                const syncedCore = syncCurrentExplorerProjection(core);
                return {
                    ...syncedCore,
                    recommendedAction: resolveRecommendedAction(syncedCore),
                    activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.outcome === 'hero-defeated' ? 'warning' : 'accent'),
                };
            }
            const nextPlayerId = rotateToNextLivingPlayer(core, core.currentPlayer);
            const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
            return {
                ...nextCore,
                currentPlayer: nextPlayerId,
                recommendedAction: 'move',
                activityLog: appendActivity(nextCore, event.payload.logText, event.payload.outcome === 'hero-defeated' ? 'warning' : 'accent'),
            };
        }
        case EVENTS.HELPING_HANDS_ATTACK_REWARD_RESOLVED: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            if (!helpingHands) {
                return core;
            }
            const attacker = findExplorerByPlayerId(core, event.payload.attackerPlayerId);
            const defender = findExplorerByPlayerId(core, event.payload.defenderPlayerId);
            helpingHands.pendingAttackReward = undefined;
            if (event.payload.choice === 'steal' && attacker && defender && event.payload.stolenCardId) {
                const stolenCard = defender.inventory.find((card) => card.id === event.payload.stolenCardId);
                if (stolenCard) {
                    defender.inventory = defender.inventory.filter((card) => card.id !== stolenCard.id);
                    attacker.inventory = [...attacker.inventory, cloneInventoryCard(stolenCard)];
                    core.receivedCardIdsThisTurnByPlayerId = {
                        ...core.receivedCardIdsThisTurnByPlayerId,
                        [attacker.playerId]: Array.from(new Set([
                            ...(core.receivedCardIdsThisTurnByPlayerId[attacker.playerId] ?? []),
                            stolenCard.id,
                        ])),
                    };
                }
            }
            let pendingHelpingHandsDamageAllocation: BetrayalPendingDamageAllocationState | null = null;
            if (defender && event.payload.damageToDefender && event.payload.damageKind) {
                if (!event.payload.defeatedPlayerId && !event.payload.deathPrevention) {
                    pendingHelpingHandsDamageAllocation = createPendingDamageAllocation({
                        id: `helping-hands-attack-damage-${event.payload.defenderPlayerId}-${event.timestamp}`,
                        explorer: defender,
                        sourceTitle: '援手攻击',
                        damageKind: event.payload.damageKind,
                        amount: event.payload.damageToDefender,
                        allowSkull: true,
                    });
                }
                if (!pendingHelpingHandsDamageAllocation) {
                    applyAttackDamage(defender, event.payload.damageToDefender, event.payload.damageKind);
                }
            }
            if (event.payload.deathPrevention?.prevented) {
                const protectedExplorer = findExplorerByPlayerId(core, event.payload.deathPrevention.playerId);
                if (protectedExplorer) {
                    setExplorerTraitsToDeathsDoor(protectedExplorer);
                }
            }
            if (event.payload.deathPrevention?.dice.length) {
                core.recentRoll = {
                    id: `${event.payload.deathPrevention.playerId}-death-prevention-${event.timestamp}`,
                    kind: 'deathPrevention',
                    playerId: event.payload.deathPrevention.playerId,
                    sourceTitle: event.payload.deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
                    dice: [...event.payload.deathPrevention.dice],
                    passiveBonus: 0,
                    latestLabel: event.payload.deathPrevention.prevented ? '阻止死亡' : '正常死亡',
                    deathPrevention: {
                        cardId: event.payload.deathPrevention.cardId,
                        minTotal: event.payload.deathPrevention.minTotal,
                        damageKind: event.payload.deathPrevention.damageKind,
                        damageAmount: event.payload.deathPrevention.damageAmount,
                        traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(core.scenarioRuntime),
                        monstersBeforeDefeat: core.monsters.map(cloneMonster),
                        releasedJackSpiritRoomId: event.payload.deathPrevention.releasedJackSpiritRoomId,
                    },
                    consumedRabbitFootCardIds: [],
                };
            }
            if (event.payload.defeatedPlayerId) {
                markDeadExplorer(core, event.payload.defeatedPlayerId);
            }
            if (pendingHelpingHandsDamageAllocation) {
                const syncedCore = syncCurrentExplorerProjection(core);
                return {
                    ...syncedCore,
                    pendingDamageAllocation: pendingHelpingHandsDamageAllocation,
                    activePlayerId: pendingHelpingHandsDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
                };
            }
            const completed = completeHelpingHandsSoloVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.defeatedPlayerId ? 'warning' : 'accent'),
            };
        }
        case EVENTS.MUMMY_ATTACK_REWARD_RESOLVED: {
            const mummy = core.scenarioRuntime.mummy;
            if (!mummy) {
                return core;
            }
            const defender = findExplorerByPlayerId(core, event.payload.defenderPlayerId);
            mummy.pendingAttackReward = undefined;
            if (event.payload.choice === 'steal' && defender && event.payload.stolenCardId) {
                if (
                    event.payload.stolenCardId === MUMMY_GIRL_STEAL_CARD_ID
                    && mummy.girlHolderPlayerId === defender.playerId
                ) {
                    mummy.girlRoomId = null;
                    mummy.girlHolderPlayerId = null;
                    mummy.girlHeldByMummy = true;
                } else {
                    const stolenCard = defender.inventory.find((card) => card.id === event.payload.stolenCardId);
                    if (stolenCard) {
                        defender.inventory = defender.inventory.filter((card) => card.id !== stolenCard.id);
                        mummy.mummyCarriedCards = [
                            ...mummy.mummyCarriedCards.filter((card) => card.id !== stolenCard.id),
                            cloneInventoryCard(stolenCard),
                        ];
                        if (stolenCard.kind === 'omen') {
                            mummy.mummyCarriedOmenIds = Array.from(new Set([
                                ...mummy.mummyCarriedOmenIds,
                                stolenCard.id,
                            ]));
                        }
                    }
                }
            }
            const pendingMummyDamageAllocation = defender && event.payload.choice === 'damage' && event.payload.damageToHero
                ? createPendingDamageAllocation({
                    id: `mummy-attack-damage-${event.payload.defenderPlayerId}-${event.timestamp}`,
                    explorer: defender,
                    sourceTitle: '木乃伊攻击',
                    damageKind: 'physical',
                    amount: event.payload.damageToHero,
                    allowSkull: true,
                    forcedTraitSequence: resolveMummyForcedDamageTraits(
                        defender,
                        event.payload.damageToHero,
                        { allowSkull: true },
                    ),
                })
                : null;
            const syncedCore = syncCurrentExplorerProjection(core);
            if (pendingMummyDamageAllocation) {
                return {
                    ...syncedCore,
                    pendingDamageAllocation: pendingMummyDamageAllocation,
                    activePlayerId: pendingMummyDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
                };
            }
            const loggedCore = {
                ...syncedCore,
                activePlayerId: null,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(
                    syncedCore,
                    event.payload.logText,
                    event.payload.choice === 'damage' ? 'warning' : 'accent',
                ),
            };
            return completeMummyTraitorVictoryIfNeeded(loggedCore, event.timestamp) ?? loggedCore;
        }
        case EVENTS.HELPING_HANDS_MONSTER_TURN_STARTED: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            const controller = findExplorerByPlayerId(core, event.payload.controllerPlayerId);
            if (!helpingHands || !controller) {
                return core;
            }
            const nextCore = replaceExplorers(
                core,
                getAllExplorers(core),
                event.payload.controllerPlayerId,
            );
            const nextHelpingHands = nextCore.scenarioRuntime.helpingHands;
            if (!nextHelpingHands) {
                return nextCore;
            }
            nextHelpingHands.activeMonsterTurn = true;
            nextHelpingHands.monsterTurnControllerPlayerId = event.payload.controllerPlayerId;
            nextHelpingHands.trollHandMoveAllowance = event.payload.moveAllowance;
            nextHelpingHands.trollHandMoveDice = [...event.payload.moveDice];
            nextHelpingHands.trollHandMoveRemainingById = Object.fromEntries(
                nextHelpingHands.trollHandIds
                    .filter((id) => nextCore.monsters.some((monster) => monster.id === id))
                    .map((id) => [id, event.payload.moveAllowance]),
            );
            nextHelpingHands.trollHandAttackUsedIdsThisTurn = [];
            const syncedCore = syncCurrentExplorerProjection(nextCore);
            return {
                ...syncedCore,
                activePlayerId: event.payload.controllerPlayerId,
                recommendedAction: 'endTurn',
                recentRoll: {
                    id: `helping-hands-monster-move-${event.timestamp}`,
                    kind: 'monsterMoveRoll',
                    playerId: event.payload.controllerPlayerId,
                    sourceTitle: '巨魔手移动',
                    trait: 'speed',
                    rollLabel: '速度 3',
                    dice: [...event.payload.moveDice],
                    passiveBonus: 0,
                    latestLabel: `每只巨魔手可移动 ${event.payload.moveAllowance} 间`,
                    consumedRabbitFootCardIds: [],
                },
                activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.HELPING_HANDS_TROLL_HAND_MOVED: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            const monster = findHelpingHandsTrollHand(core, event.payload.monsterId);
            if (!helpingHands || !monster) {
                return core;
            }
            monster.roomId = event.payload.toRoomId;
            helpingHands.trollHandMoveRemainingById = {
                ...helpingHands.trollHandMoveRemainingById,
                [monster.id]: event.payload.moveRemaining,
            };
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            if (!helpingHands) {
                return core;
            }
            const target = findExplorerByPlayerId(core, event.payload.targetPlayerId);
            helpingHands.trollHandAttackUsedIdsThisTurn = Array.from(new Set([
                ...helpingHands.trollHandAttackUsedIdsThisTurn,
                ...event.payload.trollHandIds,
            ]));
            const pendingTrollHandDamageAllocation = target && event.payload.damageToDefender
                ? createPendingDamageAllocation({
                    id: `helping-hands-troll-hand-damage-${event.payload.targetPlayerId}-${event.timestamp}`,
                    explorer: target,
                    sourceTitle: '巨魔手攻击',
                    damageKind: 'physical',
                    amount: event.payload.damageToDefender,
                    allowSkull: true,
                })
                : null;
            if (pendingTrollHandDamageAllocation) {
                const syncedCore = syncCurrentExplorerProjection(core);
                return {
                    ...syncedCore,
                    pendingDamageAllocation: pendingTrollHandDamageAllocation,
                    activePlayerId: pendingTrollHandDamageAllocation.playerId,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
                };
            }
            if (event.payload.deathPrevention?.prevented) {
                const protectedExplorer = findExplorerByPlayerId(core, event.payload.deathPrevention.playerId);
                if (protectedExplorer) {
                    setExplorerTraitsToDeathsDoor(protectedExplorer);
                }
            }
            if (event.payload.deathPrevention?.dice.length) {
                core.recentRoll = {
                    id: `${event.payload.deathPrevention.playerId}-death-prevention-${event.timestamp}`,
                    kind: 'deathPrevention',
                    playerId: event.payload.deathPrevention.playerId,
                    sourceTitle: event.payload.deathPrevention.cardId === 'skull' ? '头骨死亡保护' : '死亡保护',
                    dice: [...event.payload.deathPrevention.dice],
                    passiveBonus: 0,
                    latestLabel: event.payload.deathPrevention.prevented ? '阻止死亡' : '正常死亡',
                    deathPrevention: {
                        cardId: event.payload.deathPrevention.cardId,
                        minTotal: event.payload.deathPrevention.minTotal,
                        damageKind: event.payload.deathPrevention.damageKind,
                        damageAmount: event.payload.deathPrevention.damageAmount,
                        traitsBeforeDamage: { ...event.payload.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(core.scenarioRuntime),
                        monstersBeforeDefeat: core.monsters.map(cloneMonster),
                        releasedJackSpiritRoomId: event.payload.deathPrevention.releasedJackSpiritRoomId,
                    },
                    consumedRabbitFootCardIds: [],
                };
            }
            if (event.payload.defeatedPlayerId) {
                markDeadExplorer(core, event.payload.defeatedPlayerId);
            }
            const completed = completeHelpingHandsSoloVictoryIfNeeded(core, event.timestamp);
            if (completed) {
                return completed;
            }
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: helpingHands.activeMonsterTurn
                    ? 'endTurn'
                    : resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.defeatedPlayerId ? 'warning' : 'accent'),
            };
        }
        case EVENTS.HELPING_HANDS_MONSTER_TURN_ENDED: {
            const helpingHands = core.scenarioRuntime.helpingHands;
            if (!helpingHands) {
                return core;
            }
            helpingHands.activeMonsterTurn = false;
            helpingHands.monsterTurnControllerPlayerId = null;
            helpingHands.trollHandMoveAllowance = 0;
            helpingHands.trollHandMoveDice = [];
            helpingHands.trollHandMoveRemainingById = {};
            helpingHands.trollHandAttackUsedIdsThisTurn = [];
            const nextCore = replaceExplorers(
                core,
                getAllExplorers(core),
                event.payload.nextPlayerId,
            );
            const syncedCore = syncCurrentExplorerProjection(nextCore);
            return {
                ...syncedCore,
                currentPlayer: event.payload.nextPlayerId,
                activePlayerId: null,
                recommendedAction: resolveRecommendedAction(syncedCore),
                recentRoll: null,
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.JACK_LEARNED: {
            if (event.payload.success && event.payload.grantedToPlayerId) {
                core.scenarioRuntime.knowledgeOfJackPlayerIds = Array.from(new Set([
                    ...core.scenarioRuntime.knowledgeOfJackPlayerIds,
                    event.payload.grantedToPlayerId,
                ]));
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'learn-about-jack'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.EXORCISM_STUDIED: {
            if (event.payload.success) {
                core.scenarioRuntime.exorcismCircleRoomIds = [
                    ...core.scenarioRuntime.exorcismCircleRoomIds,
                    event.payload.roomId,
                ].slice(-2);
            } else {
                applyMentalDamage(core.currentExplorer, 2, { allowSkull: true });
                if (isExplorerDead(core.currentExplorer)) {
                    markDeadExplorer(core, core.currentExplorer.playerId);
                }
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'study-exorcism'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: core.scenarioRuntime.jackSpiritReleased ? 'move' : 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.JACK_EXORCISED:
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'exorcise-jack'];
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-exorcise-jack-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '驱魔',
                trait: 'sanity',
                rollLabel: '神志检定',
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus + event.payload.regionBonus,
                latestLabel: event.payload.success ? '驱魔成功' : '驱魔失败',
                consumedRabbitFootCardIds: [],
            };
            if (!event.payload.success) {
                getAllExplorers(core)
                    .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
                    .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
                    .forEach((explorer) => {
                        applyPhysicalDamage(explorer, 1, { allowSkull: true });
                        if (isExplorerDead(explorer)) {
                            markDeadExplorer(core, explorer.playerId);
                        }
                    });
                const livingHeroes = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ));
                if (livingHeroes.length === 0) {
                    const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
                    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                        result: {
                            hauntId: 'crimson-jack-returns',
                            hauntTitle: resolveCrimsonJackHauntTitle(),
                            outcome: 'traitor',
                            winners: [traitor.playerId],
                            traitorPlayerId: traitor.playerId,
                            survivorsEscaped: [],
                            reward: { stars: 0, omens: countDrawnCards(core, 'omen'), logs: 0 },
                            stats: {
                                roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                                omensDrawn: countDrawnCards(core, 'omen'),
                                itemsDrawn: countDrawnCards(core, 'item'),
                                eventsDrawn: countDrawnCards(core, 'event'),
                            },
                        },
                    }, event.timestamp));
                }
                const failedCore = syncCurrentExplorerProjection(core);
                return {
                    ...failedCore,
                    recommendedAction: 'endTurn',
                    activityLog: appendActivity(failedCore, event.payload.logText, 'warning'),
                };
            }
            return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                result: {
                    hauntId: 'crimson-jack-returns',
                    hauntTitle: resolveCrimsonJackHauntTitle(),
                    outcome: 'survivors',
                    winners: getAllExplorers(core)
                        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
                        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
                        .map((explorer) => explorer.playerId),
                    traitorPlayerId: core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer,
                    survivorsEscaped: getAllExplorers(core)
                        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
                        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
                        .map((explorer) => explorer.playerId),
                    reward: {
                        stars: scenarioConfigById(core.scenarioId).completion.reward.stars,
                        omens: Math.max(scenarioConfigById(core.scenarioId).completion.reward.minimumOmens, countDrawnCards(core, 'omen')),
                        logs: scenarioConfigById(core.scenarioId).completion.reward.logs,
                    },
                    stats: {
                        roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
                        omensDrawn: countDrawnCards(core, 'omen'),
                        itemsDrawn: countDrawnCards(core, 'item'),
                        eventsDrawn: countDrawnCards(core, 'event'),
                    },
                },
            }, event.timestamp));
        case EVENTS.MUMMY_NAME_STUDIED: {
            const mummy = core.scenarioRuntime.mummy;
            if (!mummy) {
                return core;
            }
            if (event.payload.success) {
                mummy.knowledgeTokenCount = Math.max(mummy.knowledgeTokenCount, 1);
                mummy.trueNameFound = true;
            }
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'study-mummy-name',
            ]));
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-study-mummy-name-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '寻找木乃伊真名',
                trait: 'knowledge',
                rollLabel: '知识检定',
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.success ? '取得第 1 枚知识标记' : '未取得知识标记',
                consumedRabbitFootCardIds: [],
            };
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.MUMMY_BANISHMENT_LEARNED: {
            const mummy = core.scenarioRuntime.mummy;
            if (!mummy) {
                return core;
            }
            if (event.payload.success) {
                mummy.knowledgeTokenCount = Math.max(mummy.knowledgeTokenCount, 2);
                mummy.banishmentSpellLearned = true;
            }
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'learn-mummy-banishment',
            ]));
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            core.recentRoll = {
                id: `${event.payload.playerId}-learn-mummy-banishment-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '学习驱逐法术',
                trait: 'knowledge',
                rollLabel: '知识检定',
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.success ? '取得第 2 枚知识标记' : '未学会驱逐法术',
                consumedRabbitFootCardIds: [],
            };
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.MUMMY_BANISHED: {
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'banish-mummy',
            ]));
            core.recentRoll = {
                id: `${event.payload.playerId}-banish-mummy-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '驱逐木乃伊',
                trait: 'sanity',
                rollLabel: '神志对抗',
                dice: [...event.payload.heroDice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.success
                    ? `驱逐成功：英雄 ${event.payload.heroRoll} / 木乃伊 ${event.payload.mummyRoll}`
                    : `驱逐失败：英雄 ${event.payload.heroRoll} / 木乃伊 ${event.payload.mummyRoll}`,
                consumedRabbitFootCardIds: [],
            };
            if (event.payload.success) {
                return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                    result: createMummyEndgameResult(core, 'survivors'),
                }, event.timestamp));
            }
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, 'warning'),
            };
        }
        case EVENTS.MUMMY_GIRL_PICKED_UP: {
            const mummy = core.scenarioRuntime.mummy;
            if (!mummy) {
                return core;
            }
            mummy.girlRoomId = null;
            mummy.girlHolderPlayerId = event.payload.playerId;
            mummy.girlHeldByMummy = false;
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.MUMMY_GIRL_GIVEN: {
            const mummy = core.scenarioRuntime.mummy;
            if (!mummy) {
                return core;
            }
            mummy.girlRoomId = null;
            mummy.girlHolderPlayerId = null;
            mummy.girlHeldByMummy = true;
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.MUMMY_OMEN_GIVEN: {
            const mummy = core.scenarioRuntime.mummy;
            const actor = findExplorerByPlayerId(core, event.payload.playerId);
            if (!mummy || !actor) {
                return core;
            }
            actor.inventory = actor.inventory.filter((card) => card.id !== event.payload.cardId);
            mummy.mummyCarriedOmenIds = Array.from(new Set([
                ...mummy.mummyCarriedOmenIds,
                event.payload.cardId,
            ]));
            const syncedCore = syncCurrentExplorerProjection(core);
            const loggedCore = {
                ...syncedCore,
                recommendedAction: resolveRecommendedAction(syncedCore),
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
            return completeMummyTraitorVictoryIfNeeded(loggedCore, event.timestamp) ?? loggedCore;
        }
        case EVENTS.UPON_REFLECTION_EVENT_HINT_GIVEN: {
            const uponReflection = core.scenarioRuntime.uponReflection;
            if (!uponReflection) {
                return core;
            }
            removeEventCardForUponReflectionHint(core, event.payload.eventName);
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'give-mirror-hint',
            ]));
            core.pendingEventChoice = null;
            core.recentRoll = null;
            uponReflection.hintedEvents = [
                ...uponReflection.hintedEvents,
                {
                    revealerPlayerId: event.payload.revealerPlayerId,
                    targetPlayerId: event.payload.targetPlayerId,
                    eventName: event.payload.eventName,
                    eventText: event.payload.eventText,
                    turnNumber: event.payload.turnNumber,
                },
            ];
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.UPON_REFLECTION_CURSE_BREAK_ATTEMPTED: {
            const uponReflection = core.scenarioRuntime.uponReflection;
            if (!uponReflection) {
                return core;
            }
            core.usedCardIdsThisTurn = Array.from(new Set([
                ...core.usedCardIdsThisTurn,
                'break-mirror-curse',
            ]));
            clearNextNonCombatTraitRollReplacementsForPlayer(core, event.payload.playerId);
            uponReflection.breakAttempts = [
                ...uponReflection.breakAttempts,
                {
                    playerId: event.payload.playerId,
                    roomId: event.payload.roomId,
                    roomName: event.payload.roomName,
                    trait: event.payload.trait,
                    omenId: event.payload.omenId,
                    omenName: event.payload.omenName,
                    rollTotal: event.payload.rollTotal,
                    dice: [...event.payload.dice],
                    passiveBonus: event.payload.passiveBonus,
                    successRoll: event.payload.successRoll,
                    combinationCorrect: event.payload.combinationCorrect,
                },
            ];
            core.recentRoll = {
                id: `${event.payload.playerId}-break-mirror-curse-${event.timestamp}`,
                kind: 'hauntActionTraitCheck',
                playerId: event.payload.playerId,
                sourceTitle: '破咒',
                trait: event.payload.trait,
                rollLabel: `${TRAIT_LABEL[event.payload.trait]}检定`,
                dice: [...event.payload.dice],
                passiveBonus: event.payload.passiveBonus,
                latestLabel: event.payload.combinationCorrect
                    ? '破咒成功'
                    : event.payload.successRoll
                        ? '组合不正确'
                        : '无反馈',
                consumedRabbitFootCardIds: [],
            };
            const syncedCore = syncCurrentExplorerProjection(core);
            const loggedCore = {
                ...syncedCore,
                recommendedAction: 'endTurn' as const,
                activityLog: appendActivity(
                    syncedCore,
                    event.payload.logText,
                    event.payload.combinationCorrect ? 'accent' : 'warning',
                ),
            };
            if (event.payload.combinationCorrect) {
                return reduceEvent(loggedCore, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                    result: createUponReflectionEndgameResult(loggedCore, 'survivors'),
                }, event.timestamp));
            }
            return loggedCore;
        }
        case EVENTS.SCENARIO_COMPLETED:
            return {
                ...core,
                phase: 'endgame',
                recommendedAction: 'endTurn',
                pendingEventRollResolution: null,
                pendingCardResolutionQueue: [],
                endgameResult: {
                    ...event.payload.result,
                    winners: [...event.payload.result.winners],
                    survivorsEscaped: [...event.payload.result.survivorsEscaped],
                    reward: { ...event.payload.result.reward },
                    stats: { ...event.payload.result.stats },
                },
                activityLog: appendActivity(core, resolveScenarioCompletedLog(core, event.payload.result), 'accent'),
            };
        default:
            return core;
    }
}

export const BetrayalDomain: DomainCore<BetrayalCore, BetrayalCommand, BetrayalEvent> = {
    gameId: 'betrayal',
    setup: (playerIds: PlayerId[], random: RandomFn, setupData?: unknown) => createBetrayalCharacterSelectCore(playerIds, random, setupData),
    validate: validateCommand,
    execute: executeCommand,
    reduce: reduceEvent,
    playerView: createBetrayalPlayerView,
    isGameOver: (state) => {
        if (state.phase !== 'endgame' || !state.endgameResult) {
            return undefined;
        }
        return {
            winners: state.endgameResult.winners,
            scores: Object.fromEntries(state.playerIds.map((playerId) => [
                playerId,
                state.endgameResult?.winners.includes(playerId) ? 1 : 0,
            ])),
        };
    },
};

const resolveBetrayalPendingCardResolutionRecovery = (args: {
    state: MatchState<unknown>;
    phase: string;
}) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'pendingCardResolutionQueue'>> | undefined;
    const pendingResolution = core?.pendingCardResolutionQueue?.[0];
    if (!pendingResolution) {
        return null;
    }

    const requiredPlayerIds = pendingResolution.requiredPlayerIds?.length
        ? pendingResolution.requiredPlayerIds
        : [pendingResolution.playerId];
    const acknowledgedPlayerIds = new Set(pendingResolution.acknowledgedPlayerIds ?? []);
    const playerId = requiredPlayerIds.find((candidate) => !acknowledgedPlayerIds.has(candidate));
    if (!playerId) {
        return null;
    }

    const resolutionId = pendingResolution.id;
    return {
        playerId,
        fingerprintHint: `card-resolution:${playerId}:${args.phase}:${resolutionId}:${requiredPlayerIds.join(',')}:${[...acknowledgedPlayerIds].join(',')}`,
        attemptSuffix: `card-resolution:${playerId}:${resolutionId}`,
        command: {
            type: BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
            payload: { resolutionId },
        },
    };
};

const resolveBetrayalPendingEventRollResolutionRecovery = (args: {
    state: MatchState<unknown>;
    phase: string;
}) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'pendingEventRollResolution' | 'playerIds'>> | undefined;
    const pendingResolution = core?.pendingEventRollResolution;
    if (!pendingResolution) {
        return null;
    }
    if (pendingResolution.requiresAcknowledgement === false) {
        return null;
    }

    const requiredPlayerIds = resolvePendingEventRollResolutionRequiredPlayerIds(
        { playerIds: core?.playerIds ?? [] },
        pendingResolution,
    );
    const acknowledgedPlayerIds = new Set(resolvePendingEventRollResolutionAcknowledgedPlayerIds(pendingResolution));
    const playerId = requiredPlayerIds.find((candidate) => !acknowledgedPlayerIds.has(candidate));
    if (!playerId) {
        return null;
    }

    return {
        playerId,
        fingerprintHint: `event-roll-resolution:${playerId}:${args.phase}:${pendingResolution.rollId}:${requiredPlayerIds.join(',')}:${[...acknowledgedPlayerIds].join(',')}`,
        attemptSuffix: `event-roll-resolution:${playerId}:${pendingResolution.rollId}`,
        command: {
            type: BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
            payload: { rollId: pendingResolution.rollId },
        },
    };
};

const resolveBetrayalPendingEventRollStartRecovery = (args: {
    state: MatchState<unknown>;
    phase: string;
}) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'pendingEventRollStart'>> | undefined;
    const pending = core?.pendingEventRollStart;
    if (!pending) {
        return null;
    }

    return {
        playerId: pending.playerId,
        fingerprintHint: `event-roll-start:${pending.playerId}:${args.phase}:${pending.roomId}:${pending.sourceTitle}`,
        attemptSuffix: `event-roll-start:${pending.playerId}:${pending.sourceTitle}`,
        command: {
            type: BETRAYAL_COMMANDS.ROLL_EVENT,
            payload: { sourceTitle: pending.sourceTitle },
        },
    };
};

const resolveBetrayalSeatLegalOnlyRecovery = (args: {
    state: MatchState<unknown>;
    phase: string;
}) => (
    resolveBetrayalPendingEventRollStartRecovery(args)
    ?? resolveBetrayalPendingEventRollResolutionRecovery(args)
    ?? resolveBetrayalPendingCardResolutionRecovery(args)
);

const shouldSuppressBetrayalActiveTurnRecovery = (args: {
    state: MatchState<unknown>;
}) => {
    const core = args.state.core as Partial<Pick<BetrayalCore, 'pendingCardResolutionQueue' | 'pendingEventRollResolution' | 'pendingEventRollStart'>> | undefined;
    return Boolean(
        core?.pendingCardResolutionQueue?.length
        || core?.pendingEventRollStart
        || core?.pendingEventRollResolution,
    );
};

const systems = [
    ...createBaseSystems<BetrayalCore>({
        actionLog: {
            commandAllowlist: BETRAYAL_ACTION_LOG_ALLOWLIST,
            formatEntry: formatBetrayalActionEntry,
        },
        undo: {
            snapshotCommandAllowlist: BETRAYAL_UNDO_ALLOWLIST,
        },
    }),
    createCheatSystem<BetrayalCore>(),
];

const baseEngineConfig = createGameEngine<BetrayalCore, BetrayalCommand, BetrayalEvent>({
    domain: BetrayalDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 6,
    commandTypes: Object.values(BETRAYAL_COMMANDS),
});

export const engineConfig = {
    ...baseEngineConfig,
    onlineAiRecovery: {
        publicPregameLegalActionPhases: ['characterSelect'],
        resolveSeatLegalOnlyRecovery: resolveBetrayalSeatLegalOnlyRecovery,
        shouldSuppressActiveTurnCandidate: shouldSuppressBetrayalActiveTurnRecovery,
    },
};

export const betrayalAiRuntime = createBetrayalAiRuntime({
    validate: (state, command) => BetrayalDomain.validate(
        state as MatchState<BetrayalCore>,
        command as BetrayalCommand,
    ),
});

registerCriticalImageResolver('betrayal', betrayalCriticalImageResolver);
registerGameAiRuntime(betrayalAiRuntime);

export default engineConfig;
export { BETRAYAL_COMMANDS } from './commands';
export { BETRAYAL_AUDIO_CONFIG as audioConfig } from './audio.config';
