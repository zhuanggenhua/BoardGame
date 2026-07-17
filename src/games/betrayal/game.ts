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
import { readBetrayalScenarioId } from './roomSetup';
import {
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_EXPLORER_CATALOG,
    BETRAYAL_SCENARIO_CONFIGS,
    BETRAYAL_SHARED_PRE_HAUNT_SETUP,
    DEFAULT_BETRAYAL_SCENARIO_ID,
    type BetrayalDeckKind as ConfigDeckKind,
    type BetrayalRoomDoorway,
    type BetrayalRoomEdge,
    type BetrayalRoomFloor,
    type BetrayalRoomVisualId,
    type BetrayalEventSeed,
    type BetrayalInventoryKind as ConfigInventoryKind,
    type BetrayalInventorySeed,
    type BetrayalMonsterSeed,
    type BetrayalRecommendedAction as ConfigRecommendedAction,
    type BetrayalRoomDiscoveryTemplate,
    type BetrayalRoomSeed,
    type BetrayalScenarioId,
    type BetrayalScenarioOutcome,
    type BetrayalTraitKey as ConfigTraitKey,
    type BetrayalTraitorSelectionPolicy,
    type BetrayalSurvivorSelectionPolicy,
} from './scenarioConfig';
import {
    POSSESSION_USE_EFFECTS as USE_EFFECTS,
    resolveInventoryEffectId,
    resolveUseEffect,
    type PossessionUseEffectProfile,
    type UseEffectProfile,
} from './possessionEffects';

export { resolveUseEffect } from './possessionEffects';
export type { PossessionUseEffectProfile, UseEffectProfile } from './possessionEffects';

export type BetrayalTraitKey = ConfigTraitKey;
export type BetrayalInventoryKind = ConfigInventoryKind;
export type BetrayalDeckKind = ConfigDeckKind;
export type { BetrayalRoomEdge, BetrayalRoomVisualId, BetrayalRoomFloor };
export type BetrayalPhase = 'characterSelect' | 'preHaunt' | 'haunt' | 'endgame';
export type BetrayalRecommendedAction = ConfigRecommendedAction;
type BetrayalRoomEndTurnEffect = NonNullable<BetrayalRoomDiscoveryTemplate['endTurnEffect']>;
type BetrayalRoomEnterEffect = 'mysticElevator';
type BetrayalRoomDiscoveryEffect = NonNullable<BetrayalRoomDiscoveryTemplate['discoveryEffect']>;
export type BetrayalRoomMarkerToken = 'obstacle' | 'secretPassage';

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
    abilityName: string;
    abilityText: string;
}

export interface BetrayalExplorerSummary {
    playerId: string;
    explorerId: string;
    displayName: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    traits: Record<BetrayalTraitKey, number>;
    inventory: BetrayalInventoryCard[];
}

export interface BetrayalMonsterSummary {
    id: string;
    name: string;
    portraitAsset: string;
    tokenAsset?: string;
    roomId: string;
    might: number;
    speed: number;
    damage: number;
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

export interface BetrayalDiscoverySummary {
    kind: BetrayalDeckKind;
    title: string;
    summary: string;
    detail: string;
    tone: 'neutral' | 'accent' | 'warning';
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
}

interface BetrayalRoomEnterEffectResult {
    kind: BetrayalRoomEnterEffect;
    playerId: string;
    roomId: string;
    roomName: string;
    rollTotal: number;
    dice: number[];
    destinationRoomId: string;
    destinationRoomName: string;
    destinationFloor: BetrayalRoomFloor;
}

export interface BetrayalRecentRollState {
    id: string;
    kind: 'eventTraitCheck' | 'eventDiceRoll' | 'hauntRoll' | 'mysticElevator' | 'attackRoll' | 'roomEndTurnTraitCheck' | 'deathPrevention' | 'hauntActionTraitCheck' | 'monsterMoveRoll';
    playerId: string;
    sourceTitle: string;
    trait?: BetrayalTraitKey;
    rollLabel?: string;
    dice: number[];
    passiveBonus: number;
    branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
    latestLabel: string;
    eventEffectSnapshot?: {
        traitsBeforeEffect: BetrayalExplorerSummary['traits'];
        roomIdBeforeEffect: string;
        damageRolls: number[];
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
    };
    attack?: {
        target: 'traitor' | 'hero' | 'jack-spirit';
        defenderPlayerId?: string;
        damageKind: 'physical' | 'mental';
        previousDamageToAttacker: number;
        previousDamageToDefender: number;
        defenderRoll: number;
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
        damageKind: 'physical' | 'mental';
        damageAmount: number;
        traitsBeforeDamage: BetrayalExplorerSummary['traits'];
        scenarioRuntimeBeforeDefeat: BetrayalScenarioRuntimeStatus;
        monstersBeforeDefeat: BetrayalMonsterSummary[];
        releasedJackSpiritRoomId?: string;
    };
    consumedRabbitFootCardIds: string[];
    lastRabbitFootRerollDieIndex?: number;
}

interface BetrayalMonsterMovementRollResult {
    monsterId: string;
    monsterName: string;
    playerId: string;
    speed: number;
    dice: number[];
    total: number;
    moveAllowance: number;
}

export interface BetrayalPendingEventChoiceState {
    id: string;
    playerId: string;
    sourceTitle: string;
    acceptLabel?: string;
    declineLabel?: string;
    effect: UseEffectProfile;
}

export interface BetrayalAllTraitCheckResult {
    trait: BetrayalTraitKey;
    total: number;
    dice: number[];
    passiveBonus: number;
    passed: boolean;
}

export interface BetrayalEndgameResult {
    hauntId: 'crimson-jack-returns';
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

export interface BetrayalScenarioRuntimeStatus {
    hauntTriggered: boolean;
    hauntRevealerPlayerId: string | null;
    traitorPlayerId: string | null;
    nextHauntPlayerId: string | null;
    hauntRollThreshold: number;
    omensDiscovered: number;
    hauntCardNumber: number | null;
    hauntTriggerLabel: string | null;
    jackSpiritReleased: boolean;
    jackSpiritRoomId: string | null;
    jackSpiritHasMovedSinceRelease: boolean;
    exorcismCircleRoomIds: string[];
    knowledgeOfJackPlayerIds: string[];
    deadExplorerPlayerIds: string[];
    traitorCorpseRoomId: string | null;
    corpseLootedByPlayerIdsThisTurn: string[];
    usedRoomEffectIdsThisTurn: string[];
}

export interface BetrayalCore {
    scenarioId: BetrayalScenarioId;
    phase: BetrayalPhase;
    playerIds: string[];
    selectedExplorerByPlayerId: Record<string, string>;
    readyPlayerIds: string[];
    currentPlayer: string;
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
    roomDiscoveryOrderByFloor: Record<BetrayalRoomFloor, RoomTemplate[]>;
    possessionOrderByKind: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]>;
    eventOrder: EventTemplate[];
    deckCounts: Record<BetrayalDeckKind, number>;
    discardCounts: Record<BetrayalDeckKind, number>;
    rooms: BetrayalRoomNode[];
    exploreIndex: number;
    usedCardIdsThisTurn: string[];
    turnStartInventoryCardIds: string[];
    receivedCardIdsThisTurnByPlayerId: Record<string, string[]>;
    nextNonCombatTraitReplacement: {
        playerId: string;
        sourceCardId: string;
        replacementTrait: BetrayalTraitKey;
    } | null;
    pendingEventChoice: BetrayalPendingEventChoiceState | null;
    recentRoll: BetrayalRecentRollState | null;
    recentAllTraitCheck: {
        sourceTitle: string;
        playerId: string;
        results: BetrayalAllTraitCheckResult[];
    } | null;
    latestDiscovery: BetrayalDiscoverySummary | null;
    latestDiscoveryOwnerPlayerId: string | null;
    highlightedDeckKind: BetrayalDeckKind | null;
    activityLog: BetrayalActivityEntry[];
    scenarioRuntime: BetrayalScenarioRuntimeStatus;
    endgameResult: BetrayalEndgameResult | null;
}

export type BetrayalCommandType = typeof BETRAYAL_COMMANDS[keyof typeof BETRAYAL_COMMANDS];

export const BETRAYAL_INITIAL_DECK_COUNTS: Record<BetrayalDeckKind, number> = {
    ...BETRAYAL_SHARED_PRE_HAUNT_SETUP.initialDeckCounts,
};

export type BetrayalCommandMap = {
    [BETRAYAL_COMMANDS.SELECT_EXPLORER]: { explorerId: string };
    [BETRAYAL_COMMANDS.CONFIRM_EXPLORER]: Record<string, never>;
    [BETRAYAL_COMMANDS.START_SCENARIO]: { scenarioId?: BetrayalScenarioId };
    [BETRAYAL_COMMANDS.MOVE_TO_ROOM]: { roomId: string; useSkeletonKey?: boolean };
    [BETRAYAL_COMMANDS.EXPLORE_ROOM]: { roomId?: string; useHolySymbol?: boolean; useIdol?: boolean };
    [BETRAYAL_COMMANDS.USE_POSSESSION]: {
        cardId?: string;
        targetPlayerId?: string;
        targetRoomId?: string;
        targetRoomIdsByTokenId?: Record<string, string>;
    };
    [BETRAYAL_COMMANDS.USE_RABBIT_FOOT]: { cardId?: string; dieIndex?: number };
    [BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE]: { accept?: boolean; trait?: BetrayalTraitKey; traits?: BetrayalTraitKey[]; targetRoomId?: string };
    [BETRAYAL_COMMANDS.USE_ROOM_EFFECT]: Record<string, never>;
    [BETRAYAL_COMMANDS.TRADE_POSSESSION]: { cardId?: string; cardIds?: string[]; targetPlayerId?: string; useDog?: boolean };
    [BETRAYAL_COMMANDS.LOOT_CORPSE]: { sourcePlayerId?: string; cardId?: string };
    [BETRAYAL_COMMANDS.END_TURN]: Record<string, never>;
    [BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL]: Record<string, never>;
    [BETRAYAL_COMMANDS.HAUNT_ATTACK]: {
        target: 'traitor' | 'hero' | 'jack-spirit';
        targetPlayerId?: string;
        weaponCardId?: string;
    };
    [BETRAYAL_COMMANDS.LEARN_ABOUT_JACK]: Record<string, never>;
    [BETRAYAL_COMMANDS.STUDY_EXORCISM]: Record<string, never>;
    [BETRAYAL_COMMANDS.EXORCISE_JACK]: Record<string, never>;
    [BETRAYAL_COMMANDS.COMPLETE_SCENARIO]: Record<string, never>;
};

export type BetrayalCommand = {
    [Type in keyof BetrayalCommandMap]: Command<Type & string, BetrayalCommandMap[Type]>
}[keyof BetrayalCommandMap];

const EVENTS = {
    EXPLORER_SELECTED: 'EXPLORER_SELECTED',
    EXPLORER_CONFIRMED: 'EXPLORER_CONFIRMED',
    SCENARIO_STARTED: 'SCENARIO_STARTED',
    EXPLORER_MOVED: 'EXPLORER_MOVED',
    ROOM_EXPLORED: 'ROOM_EXPLORED',
    EVENT_CHOICE_RESOLVED: 'EVENT_CHOICE_RESOLVED',
    POSSESSION_USED: 'POSSESSION_USED',
    RABBIT_FOOT_USED: 'RABBIT_FOOT_USED',
    ROOM_EFFECT_USED: 'ROOM_EFFECT_USED',
    POSSESSION_TRADED: 'POSSESSION_TRADED',
    CORPSE_LOOTED: 'CORPSE_LOOTED',
    TURN_ENDED: 'TURN_ENDED',
    TURN_END_ROLL_ACKNOWLEDGED: 'TURN_END_ROLL_ACKNOWLEDGED',
    HAUNT_TRIGGERED: 'HAUNT_TRIGGERED',
    HAUNT_ATTACK_RESOLVED: 'HAUNT_ATTACK_RESOLVED',
    JACK_LEARNED: 'JACK_LEARNED',
    EXORCISM_STUDIED: 'EXORCISM_STUDIED',
    JACK_EXORCISED: 'JACK_EXORCISED',
    SCENARIO_COMPLETED: 'SCENARIO_COMPLETED',
} as const;

type BetrayalEvent =
    | GameEvent<typeof EVENTS.EXPLORER_SELECTED, { playerId: string; explorerId: string }>
    | GameEvent<typeof EVENTS.EXPLORER_CONFIRMED, { playerId: string }>
    | GameEvent<typeof EVENTS.SCENARIO_STARTED, { playerIds: string[]; scenarioId: BetrayalScenarioId }>
    | GameEvent<typeof EVENTS.EXPLORER_MOVED, {
        playerId: string;
        roomId: string;
        logText: string;
        moveCost?: number;
        consumeMove?: boolean;
        usedActionId?: string;
        controlledToken?: 'jack-spirit';
        skeletonKeyCardId?: string;
        skeletonKeyRoll?: number;
        skeletonKeyBuried?: boolean;
    }>
    | GameEvent<typeof EVENTS.ROOM_EXPLORED, {
        playerId: string;
        roomId: string;
        room: Pick<BetrayalRoomNode, 'name' | 'hint' | 'tags' | 'discoveryReward' | 'visualId' | 'doorways' | 'backVisualId' | 'discoveryEffect' | 'endTurnEffect' | 'enterEffect'>;
        deckKind: BetrayalDeckKind;
        drawnCard?: BetrayalInventoryCard;
        roomDiscoveryCards?: BetrayalInventoryCard[];
        buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
        eventEffect?: UseEffectProfile;
        eventRoll?: {
            kind?: 'trait' | 'dice';
            trait?: BetrayalTraitKey;
            total: number;
            label: string;
            rollLabel?: string;
            dice?: number[];
            passiveBonus?: number;
            branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
        };
        skippedEventWithIdol?: {
            name: string;
        };
        skippedRoomWithHolySymbol?: {
            name: string;
        };
        discovery: BetrayalDiscoverySummary;
        logText: string;
        hauntRoll?: BetrayalHauntRollResult;
        hauntTriggered?: boolean;
    }>
    | GameEvent<typeof EVENTS.EVENT_CHOICE_RESOLVED, {
        playerId: string;
        sourceTitle: string;
        accepted: boolean;
        hauntTriggered?: boolean;
        hauntTraitorPlayerId?: string;
        hauntCardNumber?: number;
        hauntTriggerLabel?: string;
        nextPendingEventChoice?: BetrayalPendingEventChoiceState;
        eventEffect?: UseEffectProfile;
        eventRoll?: {
            kind?: 'trait' | 'dice';
            trait?: BetrayalTraitKey;
            total: number;
            label: string;
            rollLabel?: string;
            dice?: number[];
            passiveBonus?: number;
            branchThresholds?: { min: number; label: string; effect: UseEffectProfile }[];
        };
        discovery: BetrayalDiscoverySummary;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.POSSESSION_USED, {
        playerId: string;
        cardId: string;
        effect: PossessionUseEffectProfile;
        targetPlayerId?: string;
        targetRoomId?: string;
        targetRoomIdsByTokenId?: Record<string, string>;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.RABBIT_FOOT_USED, {
        playerId: string;
        cardId: string;
        dieIndex: number;
        newPip: number;
        eventRerollEffect?: UseEffectProfile;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.ROOM_EFFECT_USED, { playerId: string; effect: BetrayalRoomEnterEffectResult; logText: string }>
    | GameEvent<typeof EVENTS.POSSESSION_TRADED, { playerId: string; targetPlayerId: string; cardId: string; cardIds?: string[]; sourceCardId?: string; logText: string }>
    | GameEvent<typeof EVENTS.CORPSE_LOOTED, { playerId: string; sourcePlayerId: string; cardId: string; logText: string }>
    | GameEvent<typeof EVENTS.TURN_ENDED, {
        previousPlayerId: string;
        nextPlayerId: string;
        logText: string;
        roomEndTurnEffect?: BetrayalRoomEndTurnEffectResult | null;
        monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
        deferAdvanceUntilRollAcknowledged?: boolean;
        turnLogText?: string;
    }>
    | GameEvent<typeof EVENTS.TURN_END_ROLL_ACKNOWLEDGED, {
        previousPlayerId: string;
        nextPlayerId: string;
        logText: string;
        monsterMovementRoll?: BetrayalMonsterMovementRollResult | null;
    }>
    | GameEvent<typeof EVENTS.HAUNT_TRIGGERED, {
        traitorPlayerId: string;
        hauntRevealerPlayerId?: string;
        nextPlayerId: string;
        hauntCardNumber?: number;
        hauntTriggerLabel: string;
        logText: string;
    }>
    | GameEvent<typeof EVENTS.HAUNT_ATTACK_RESOLVED, {
        attackerPlayerId: string;
        target: 'traitor' | 'hero' | 'jack-spirit';
        defenderPlayerId?: string;
        defeatedPlayerId?: string;
        releasedJackSpiritRoomId?: string;
        outcome: 'wound' | 'traitor-defeated' | 'hero-defeated' | 'jack-damaged' | 'no-damage';
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
    | GameEvent<typeof EVENTS.SCENARIO_COMPLETED, { result: BetrayalEndgameResult }>;

export const EXPLORER_CATALOG: BetrayalExplorerTemplate[] = BETRAYAL_EXPLORER_CATALOG.map((entry) => ({ ...entry }));

type RoomTemplate = BetrayalRoomDiscoveryTemplate;

type EventTemplate = BetrayalEventSeed;
type EventEffectSnapshot = NonNullable<BetrayalRecentRollState['eventEffectSnapshot']>;

interface BetrayalHauntRollResult {
    dice: number[];
    total: number;
    threshold: number;
    triggered: boolean;
    automatic: boolean;
}

const DRAW_ORDER: BetrayalDeckKind[] = [...BETRAYAL_DISCOVERY_POOLS.drawOrder];

const DRAW_POOL: Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventoryCard[]> = {
    item: BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => ({ ...card })),
    omen: BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => ({ ...card })),
};

const ROOM_DISCOVERY_POOL: Record<BetrayalRoomNode['floor'], RoomTemplate[]> = {
    ground: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.map((room) => ({ ...room, tags: [...room.tags] })),
    upper: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.map((room) => ({ ...room, tags: [...room.tags] })),
    basement: BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.map((room) => ({ ...room, tags: [...room.tags] })),
};

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

const ATTACK_ROLL_BONUS_WEAPONS_BY_CARD_ID: Record<string, number> = {
    'hunting-knife': 1,
};

const ATTACK_EXTRA_DICE_WEAPONS_BY_CARD_ID: Record<string, number> = {
    dagger: 2,
};

const ATTACK_SPEED_COST_WEAPONS_BY_CARD_ID: Record<string, number> = {
    dagger: 1,
};

const ATTACK_TRAIT_WEAPONS_BY_CARD_ID: Partial<Record<string, BetrayalTraitKey>> = {
    ring: 'sanity',
};

const ATTACK_DAMAGE_KIND_WEAPONS_BY_CARD_ID: Record<string, 'physical' | 'mental'> = {
    ring: 'mental',
};

const ATTACK_WEAPON_CARD_IDS = new Set([
    ...Object.keys(ATTACK_ROLL_BONUS_WEAPONS_BY_CARD_ID),
    ...Object.keys(ATTACK_EXTRA_DICE_WEAPONS_BY_CARD_ID),
    ...Object.keys(ATTACK_SPEED_COST_WEAPONS_BY_CARD_ID),
    ...Object.keys(ATTACK_TRAIT_WEAPONS_BY_CARD_ID),
    ...Object.keys(ATTACK_DAMAGE_KIND_WEAPONS_BY_CARD_ID),
]);

const EVENT_POOL: EventTemplate[] = BETRAYAL_DISCOVERY_POOLS.events.map((event) => ({
    ...event,
    effect: event.effect ? { ...event.effect } : undefined,
    roll: event.roll
        ? {
            ...event.roll,
            branches: event.roll.branches.map((branch) => ({
                ...branch,
                effect: { ...branch.effect },
            })),
        }
        : undefined,
}));

function cloneRoomTemplate(template: RoomTemplate): RoomTemplate {
    return {
        ...template,
        tags: [...template.tags],
        doorways: [...template.doorways],
    };
}

function resolveRoomEndTurnEffect(room: BetrayalRoomNode | null | undefined): BetrayalRoomEndTurnEffect | undefined {
    return room?.state === 'discovered' ? room.endTurnEffect : undefined;
}

function cloneEventTemplate(event: EventTemplate): EventTemplate {
    return {
        ...event,
        effect: event.effect ? cloneUseEffect(event.effect) : undefined,
        roll: event.roll
            ? {
                ...event.roll,
                branches: event.roll.branches.map((branch) => ({
                    ...branch,
                    effect: cloneUseEffect(branch.effect),
                })),
            }
            : undefined,
    };
}

function cloneUseEffect(effect: UseEffectProfile): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map(cloneUseEffect),
        };
    }
    if (effect.mode === 'optionalEventRoll') {
        return {
            ...effect,
            roll: {
                ...effect.roll,
                branches: effect.roll.branches.map((branch) => ({
                    ...branch,
                    effect: cloneUseEffect(branch.effect),
                })),
            },
        };
    }
    if (effect.mode === 'optionalHauntRoll') {
        return {
            ...effect,
            failureEffect: cloneUseEffect(effect.failureEffect),
            skippedOrStartedEffect: cloneUseEffect(effect.skippedOrStartedEffect),
        };
    }
    if (effect.mode === 'chooseTraitRoll') {
        return {
            ...effect,
            allowedTraits: [...effect.allowedTraits],
            branches: effect.branches.map((branch) => ({
                ...branch,
                effect: cloneUseEffect(branch.effect),
            })),
        };
    }
    if (effect.mode === 'allTraitChecks') {
        return {
            ...effect,
            traits: [...effect.traits],
            results: effect.results?.map((result) => ({
                ...result,
                dice: [...result.dice],
            })),
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
    if (effect.mode === 'rolledDamage') {
        return { ...effect, rolls: effect.rolls ? [...effect.rolls] : undefined };
    }
    if (effect.mode === 'drawPossession') {
        return {
            ...effect,
            drawnCard: effect.drawnCard ? { ...effect.drawnCard } : undefined,
        };
    }
    return { ...effect };
}

function effectNeedsTraitChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectNeedsTraitChoice);
    }
    return effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait' || effect.mode === 'generalDamageChoice';
}

function effectHasUnresolvedTraitChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectHasUnresolvedTraitChoice);
    }
    if (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait') {
        return !effect.chosenTrait;
    }
    if (effect.mode === 'generalDamageChoice') {
        return !effect.selectedTraits || effect.selectedTraits.length !== effect.amount;
    }
    return false;
}

function effectHasUnresolvedChosenTraitChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectHasUnresolvedChosenTraitChoice);
    }
    if (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait') {
        return !effect.chosenTrait;
    }
    return false;
}

function effectHasUnresolvedGeneralDamageChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectHasUnresolvedGeneralDamageChoice);
    }
    if (effect.mode === 'generalDamageChoice') {
        return !effect.selectedTraits || effect.selectedTraits.length !== effect.amount;
    }
    return false;
}

function effectNeedsAdjacentRoomChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectNeedsAdjacentRoomChoice);
    }
    return effect.mode === 'placeExplorerInAdjacentRoom' && !effect.targetRoomId;
}

function effectNeedsRoomTargetChoice(effect: UseEffectProfile): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some(effectNeedsRoomTargetChoice);
    }
    return (
        (
            effect.mode === 'placeSecretPassageToken'
            || effect.mode === 'placeExplorerInDiscoveredRoomByFloor'
        )
        && Boolean(effect.targetRoomScope)
        && !effect.targetRoomId
    );
}

function effectAllowsRoomTargetChoice(core: BetrayalCore, effect: UseEffectProfile, targetRoomId: string): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsRoomTargetChoice(core, childEffect, targetRoomId));
    }
    if (
        (
            effect.mode !== 'placeSecretPassageToken'
            && effect.mode !== 'placeExplorerInDiscoveredRoomByFloor'
        )
        || !effect.targetRoomScope
    ) {
        return false;
    }
    const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
    if (!targetRoom || targetRoom.state !== 'discovered') {
        return false;
    }
    if (effect.mode === 'placeSecretPassageToken' && targetRoom.markerTokens?.includes('secretPassage')) {
        return false;
    }
    if (effect.targetRoomScope === 'anyDiscovered') {
        return true;
    }
    if (effect.targetRoomScope === 'anyOtherDiscovered') {
        return targetRoom.id !== core.currentExplorer.roomId;
    }
    if (effect.targetRoomScope === 'groundDiscovered') {
        return targetRoom.floor === 'ground';
    }
    return targetRoom.floor === 'basement';
}

function effectAllowsAdjacentRoomChoice(core: BetrayalCore, targetRoomId: string): boolean {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
    if (!currentRoom || !targetRoom || targetRoom.state !== 'discovered') {
        return false;
    }
    return resolveConnectedRoomIds(core.rooms, currentRoom.id).has(targetRoom.id);
}

function effectAllowsChosenTrait(effect: UseEffectProfile, trait: BetrayalTraitKey): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsChosenTrait(childEffect, trait));
    }
    if (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait') {
        return effect.allowedTraits.includes(trait);
    }
    return false;
}

function effectAllowsGeneralDamageTraits(
    effect: UseEffectProfile,
    traits: BetrayalTraitKey[] | undefined,
): boolean {
    if (effect.mode === 'compound') {
        return effect.effects.some((childEffect) => effectAllowsGeneralDamageTraits(childEffect, traits));
    }
    if (effect.mode !== 'generalDamageChoice') {
        return false;
    }
    if (!traits || traits.length !== effect.amount) {
        return false;
    }
    return traits.every((trait) => effect.allowedTraits.includes(trait));
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

function applyAdjacentRoomChoiceToEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    targetRoomId?: string,
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyAdjacentRoomChoiceToEffect(core, childEffect, targetRoomId)),
        };
    }
    if (
        effect.mode === 'placeExplorerInAdjacentRoom'
        && targetRoomId
        && effectAllowsAdjacentRoomChoice(core, targetRoomId)
    ) {
        const targetRoom = core.rooms.find((room) => room.id === targetRoomId)!;
        return { ...effect, targetRoomId, targetRoomName: targetRoom.name };
    }
    return effect;
}

function applyRoomTargetChoiceToEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    targetRoomId?: string,
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyRoomTargetChoiceToEffect(core, childEffect, targetRoomId)),
        };
    }
    if (
        (
            effect.mode === 'placeSecretPassageToken'
            || effect.mode === 'placeExplorerInDiscoveredRoomByFloor'
        )
        && targetRoomId
        && effectAllowsRoomTargetChoice(core, effect, targetRoomId)
    ) {
        const targetRoom = core.rooms.find((room) => room.id === targetRoomId)!;
        return { ...effect, targetRoomId, targetRoomName: targetRoom.name };
    }
    return effect;
}

function applyChosenTraitToEffect(effect: UseEffectProfile, trait?: BetrayalTraitKey): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyChosenTraitToEffect(childEffect, trait)),
        };
    }
    if (
        trait
        && (effect.mode === 'chosenTrait' || effect.mode === 'healChosenTrait')
        && effect.allowedTraits.includes(trait)
    ) {
        return { ...effect, chosenTrait: trait };
    }
    return effect;
}

function applyGeneralDamageTraitsToEffect(
    effect: UseEffectProfile,
    traits?: BetrayalTraitKey[],
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => applyGeneralDamageTraitsToEffect(childEffect, traits)),
        };
    }
    if (
        effect.mode === 'generalDamageChoice'
        && traits
        && traits.length === effect.amount
        && traits.every((trait) => effect.allowedTraits.includes(trait))
    ) {
        return { ...effect, selectedTraits: [...traits] };
    }
    return effect;
}

function createShuffledDiscoveryState(random: RandomFn) {
    return {
        drawOrder: random.shuffle([...DRAW_ORDER]),
        roomDiscoveryOrderByFloor: {
            ground: random.shuffle(ROOM_DISCOVERY_POOL.ground.map(cloneRoomTemplate)),
            upper: random.shuffle(ROOM_DISCOVERY_POOL.upper.map(cloneRoomTemplate)),
            basement: random.shuffle(ROOM_DISCOVERY_POOL.basement.map(cloneRoomTemplate)),
        } satisfies Record<BetrayalRoomFloor, RoomTemplate[]>,
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

const TRAIT_LABEL: Record<BetrayalTraitKey, string> = {
    might: '力量',
    speed: '速度',
    knowledge: '知识',
    sanity: '神志',
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

function cloneInventoryCard(card: BetrayalInventoryCard): BetrayalInventoryCard {
    return { ...card };
}

function countDrawnCards(core: BetrayalCore, kind: BetrayalDeckKind): number {
    return Math.max(0, BETRAYAL_INITIAL_DECK_COUNTS[kind] - core.deckCounts[kind]);
}

function cloneRoom(room: BetrayalRoomNode): BetrayalRoomNode {
    return {
        ...room,
        connectedRoomIds: [...room.connectedRoomIds],
        tags: [...room.tags],
        doorways: room.doorways.map((doorway) => ({ ...doorway })),
        markerTokens: room.markerTokens ? [...room.markerTokens] : undefined,
    };
}

function cloneExplorer(explorer: BetrayalExplorerSummary): BetrayalExplorerSummary {
    return {
        ...explorer,
        traits: { ...explorer.traits },
        inventory: explorer.inventory.map(cloneInventoryCard),
    };
}

function cloneMonster(monster: BetrayalMonsterSummary): BetrayalMonsterSummary {
    return { ...monster };
}

function cloneMonsterSeed(monster: BetrayalMonsterSeed): BetrayalMonsterSummary {
    return { ...monster };
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
    return {
        playerId,
        explorerId: template.explorerId,
        displayName: template.displayName,
        portraitAsset: template.portraitAsset,
        tokenAsset: template.tokenAsset,
        roomId,
        traits: { ...template.traits },
        inventory: inventory.map(cloneInventorySeed),
    };
}

function cloneCore(core: BetrayalCore): BetrayalCore {
    return {
        ...core,
        playerIds: [...core.playerIds],
        selectedExplorerByPlayerId: { ...core.selectedExplorerByPlayerId },
        readyPlayerIds: [...core.readyPlayerIds],
        currentExplorer: cloneExplorer(core.currentExplorer),
        currentExplorerTraits: { ...core.currentExplorerTraits },
        currentExplorerInventory: core.currentExplorerInventory.map(cloneInventoryCard),
        otherExplorers: core.otherExplorers.map(cloneExplorer),
        monsters: core.monsters.map(cloneMonster),
        drawOrder: [...core.drawOrder],
        roomDiscoveryOrderByFloor: {
            ground: core.roomDiscoveryOrderByFloor.ground.map(cloneRoomTemplate),
            upper: core.roomDiscoveryOrderByFloor.upper.map(cloneRoomTemplate),
            basement: core.roomDiscoveryOrderByFloor.basement.map(cloneRoomTemplate),
        },
        possessionOrderByKind: {
            item: core.possessionOrderByKind.item.map(cloneInventoryCard),
            omen: core.possessionOrderByKind.omen.map(cloneInventoryCard),
        },
        eventOrder: core.eventOrder.map(cloneEventTemplate),
        deckCounts: { ...core.deckCounts },
        discardCounts: { ...core.discardCounts },
        rooms: core.rooms.map(cloneRoom),
        usedCardIdsThisTurn: [...core.usedCardIdsThisTurn],
        turnStartInventoryCardIds: [...core.turnStartInventoryCardIds],
        receivedCardIdsThisTurnByPlayerId: Object.fromEntries(
            Object.entries(core.receivedCardIdsThisTurnByPlayerId).map(([playerId, cardIds]) => [playerId, [...cardIds]]),
        ),
        nextNonCombatTraitReplacement: core.nextNonCombatTraitReplacement
            ? { ...core.nextNonCombatTraitReplacement }
            : null,
        recentRoll: core.recentRoll
            ? {
                ...core.recentRoll,
                dice: [...core.recentRoll.dice],
                branchThresholds: core.recentRoll.branchThresholds?.map((branch) => ({
                    ...branch,
                    effect: { ...branch.effect },
                })),
                roomsBeforeRoll: core.recentRoll.roomsBeforeRoll?.map(cloneRoom),
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
                        traitsBeforeDamage: { ...core.recentRoll.deathPrevention.traitsBeforeDamage },
                        scenarioRuntimeBeforeDefeat: {
                            ...core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat,
                            exorcismCircleRoomIds: [...core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat.exorcismCircleRoomIds],
                            knowledgeOfJackPlayerIds: [...core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat.knowledgeOfJackPlayerIds],
                            deadExplorerPlayerIds: [...core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat.deadExplorerPlayerIds],
                            corpseLootedByPlayerIdsThisTurn: [...core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat.corpseLootedByPlayerIdsThisTurn],
                            usedRoomEffectIdsThisTurn: [...core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat.usedRoomEffectIdsThisTurn],
                        },
                        monstersBeforeDefeat: core.recentRoll.deathPrevention.monstersBeforeDefeat.map(cloneMonster),
                    }
                    : undefined,
                consumedRabbitFootCardIds: [...core.recentRoll.consumedRabbitFootCardIds],
                lastRabbitFootRerollDieIndex: core.recentRoll.lastRabbitFootRerollDieIndex,
            }
            : null,
        pendingEventChoice: core.pendingEventChoice
            ? {
                ...core.pendingEventChoice,
                effect: cloneUseEffect(core.pendingEventChoice.effect),
            }
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
        latestDiscovery: core.latestDiscovery ? { ...core.latestDiscovery } : null,
        activityLog: core.activityLog.map((entry) => ({ ...entry })),
        turnEndedByDiscovery: core.turnEndedByDiscovery,
        scenarioRuntime: {
            ...core.scenarioRuntime,
            exorcismCircleRoomIds: [...core.scenarioRuntime.exorcismCircleRoomIds],
            knowledgeOfJackPlayerIds: [...core.scenarioRuntime.knowledgeOfJackPlayerIds],
            deadExplorerPlayerIds: [...core.scenarioRuntime.deadExplorerPlayerIds],
            corpseLootedByPlayerIdsThisTurn: [...core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn],
            usedRoomEffectIdsThisTurn: [...core.scenarioRuntime.usedRoomEffectIdsThisTurn],
        },
        endgameResult: core.endgameResult ? {
            ...core.endgameResult,
            winners: [...core.endgameResult.winners],
            survivorsEscaped: [...core.endgameResult.survivorsEscaped],
            reward: { ...core.endgameResult.reward },
            stats: { ...core.endgameResult.stats },
        } : null,
    };
}

function resolveControlledRoomId(core: BetrayalCore, explorer: BetrayalExplorerSummary): string {
    if (shouldDeadTraitorControlJackSpirit(core, explorer.playerId) && core.scenarioRuntime.jackSpiritRoomId) {
        return core.scenarioRuntime.jackSpiritRoomId;
    }
    return explorer.roomId;
}

function syncCurrentExplorerProjection(core: BetrayalCore): BetrayalCore {
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
        nextHauntPlayerId: null,
        hauntRollThreshold: 5,
        omensDiscovered: 0,
        hauntCardNumber: null,
        hauntTriggerLabel: null,
        jackSpiritReleased: false,
        jackSpiritRoomId: null,
        jackSpiritHasMovedSinceRelease: false,
        exorcismCircleRoomIds: [],
        knowledgeOfJackPlayerIds: [],
        deadExplorerPlayerIds: [],
        traitorCorpseRoomId: null,
        corpseLootedByPlayerIdsThisTurn: [],
        usedRoomEffectIdsThisTurn: [],
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
        phase,
        playerIds: normalizedPlayerIds,
        selectedExplorerByPlayerId: {},
        readyPlayerIds: [],
        currentPlayer: currentExplorer.playerId,
        movesRemaining: 3,
        recommendedAction: 'explore',
        activeRoomId: currentExplorer.roomId,
        turnEndedByDiscovery: false,
        currentExplorer,
        currentExplorerTraits: { ...currentExplorer.traits },
        currentExplorerInventory: currentExplorer.inventory.map(cloneInventoryCard),
        otherExplorers,
        monsters: [],
        drawOrder: discoveryState.drawOrder,
        roomDiscoveryOrderByFloor: discoveryState.roomDiscoveryOrderByFloor,
        possessionOrderByKind: discoveryState.possessionOrderByKind,
        eventOrder: discoveryState.eventOrder,
        deckCounts: { ...BETRAYAL_INITIAL_DECK_COUNTS },
        discardCounts: { omen: 0, item: 0, event: 0 },
        rooms,
        exploreIndex: 0,
        usedCardIdsThisTurn: [],
        turnStartInventoryCardIds: currentExplorer.inventory.map((card) => card.id),
        receivedCardIdsThisTurnByPlayerId: {},
        nextNonCombatTraitReplacement: null,
        pendingEventChoice: null,
        recentRoll: null,
        recentAllTraitCheck: null,
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
    return {
        ...nextCore,
        turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore),
    };
}

export function createBetrayalMonsterEncounterCore(
    playerIds: string[] = ['0', '1', '2', '3'],
    random: RandomFn = DEFAULT_BETRAYAL_RANDOM,
): BetrayalCore {
    const core = createBetrayalFoundationCore(playerIds, random);
    const previewMonsters = scenarioConfigById(core.scenarioId).runtimePreview?.monsters ?? [];
    return {
        ...core,
        monsters: previewMonsters.map(cloneMonsterSeed),
    };
}

function templateByExplorerId(explorerId: string): BetrayalExplorerTemplate | undefined {
    return EXPLORER_CATALOG.find((template) => template.explorerId === explorerId);
}

function getAllExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return [core.currentExplorer, ...core.otherExplorers];
}

function getExplorersInTurnOrder(core: BetrayalCore): BetrayalExplorerSummary[] {
    const explorerByPlayerId = new Map(getAllExplorers(core).map((explorer) => [explorer.playerId, explorer]));
    return core.playerIds
        .map((playerId) => explorerByPlayerId.get(playerId))
        .filter((explorer): explorer is BetrayalExplorerSummary => Boolean(explorer));
}

function resolveScenarioTraitor(
    explorers: BetrayalExplorerSummary[],
    fallback: BetrayalExplorerSummary,
    policy: BetrayalTraitorSelectionPolicy,
): BetrayalExplorerSummary {
    switch (policy) {
        case 'current-explorer':
            return explorers.find((explorer) => explorer.playerId === fallback.playerId) ?? fallback;
        case 'last-explorer':
        default:
            return explorers[explorers.length - 1] ?? fallback;
    }
}

function resolveScenarioSurvivors(
    explorers: BetrayalExplorerSummary[],
    traitor: BetrayalExplorerSummary,
    policy: BetrayalSurvivorSelectionPolicy,
): BetrayalExplorerSummary[] {
    switch (policy) {
        case 'current-explorer-only':
            return explorers.filter((explorer) => explorer.playerId === explorers[0]?.playerId);
        case 'all-non-traitor':
        default:
            return explorers.filter((explorer) => explorer.playerId !== traitor.playerId);
    }
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

function findExplorerByPlayerId(core: BetrayalCore, playerId: string): BetrayalExplorerSummary | null {
    return getAllExplorers(core).find((explorer) => explorer.playerId === playerId) ?? null;
}

function resolveTurnStartInventoryCardIds(core: BetrayalCore, playerId = core.currentExplorer.playerId): string[] {
    return findExplorerByPlayerId(core, playerId)?.inventory.map((card) => card.id) ?? [];
}

function canUsePossessionThisTurn(core: BetrayalCore, cardId: string): boolean {
    return (
        Object.prototype.hasOwnProperty.call(USE_EFFECTS, resolveInventoryEffectId(cardId))
        && core.turnStartInventoryCardIds.includes(cardId)
        && !(core.receivedCardIdsThisTurnByPlayerId[core.currentExplorer.playerId] ?? []).includes(cardId)
        && !core.usedCardIdsThisTurn.includes(cardId)
    );
}

function healExplorerToTemplate(explorer: BetrayalExplorerSummary): void {
    const template = templateByExplorerId(explorer.explorerId);
    if (!template) {
        return;
    }
    explorer.traits = { ...template.traits };
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
        explorer.traits[trait] = Math.max(explorer.traits[trait], template.traits[trait]);
    }
}

function resolveCrimsonJackTraitorPhysicalBonus(playerCount: number): number {
    return playerCount >= 5 ? 2 : 1;
}

function healTraitorForHaunt(explorer: BetrayalExplorerSummary, playerCount: number): void {
    healExplorerToTemplate(explorer);
    const physicalBonus = resolveCrimsonJackTraitorPhysicalBonus(playerCount);
    explorer.traits.might += physicalBonus;
    explorer.traits.speed += physicalBonus;
}

function reviveTraitorFromJackSpirit(explorer: BetrayalExplorerSummary): void {
    healExplorerToTemplate(explorer);
}

function resolveMagicCameraOwnerPlayerId(core: BetrayalCore): string | null {
    return getAllExplorers(core)
        .find((explorer) => explorer.inventory.some((card) => resolveInventoryEffectId(card.id) === 'camera'))
        ?.playerId ?? null;
}

function shouldDeadTraitorControlJackSpirit(core: BetrayalCore, playerId: string): boolean {
    return (
        core.scenarioRuntime.traitorPlayerId === playerId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
        && core.scenarioRuntime.jackSpiritReleased
        && Boolean(core.scenarioRuntime.jackSpiritRoomId)
    );
}

function findJackSpirit(core: BetrayalCore): BetrayalMonsterSummary | null {
    return core.monsters.find((monster) => monster.id === 'jack-spirit') ?? null;
}

function wouldExplorerDieFromPhysicalDamage(explorer: BetrayalExplorerSummary, amount: number): boolean {
    if (amount <= 0) {
        return false;
    }
    const preview = cloneExplorer(explorer);
    applyPhysicalDamage(preview, amount);
    return isExplorerDead(preview);
}

function wouldExplorerDieFromMentalDamage(explorer: BetrayalExplorerSummary, amount: number): boolean {
    if (amount <= 0) {
        return false;
    }
    const preview = cloneExplorer(explorer);
    applyMentalDamage(preview, amount);
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
    const dice = rollDicePips(random, config.dice);
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
    explorer.traits = {
        might: 1,
        speed: 1,
        knowledge: 1,
        sanity: 1,
    };
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

function cloneScenarioRuntimeStatus(status: BetrayalScenarioRuntimeStatus): BetrayalScenarioRuntimeStatus {
    return {
        ...status,
        exorcismCircleRoomIds: [...status.exorcismCircleRoomIds],
        knowledgeOfJackPlayerIds: [...status.knowledgeOfJackPlayerIds],
        deadExplorerPlayerIds: [...status.deadExplorerPlayerIds],
        corpseLootedByPlayerIdsThisTurn: [...status.corpseLootedByPlayerIdsThisTurn],
        usedRoomEffectIdsThisTurn: [...status.usedRoomEffectIdsThisTurn],
    };
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
    applyAttackDamage(explorer, deathPrevention.damageAmount, deathPrevention.damageKind);
    if (nextTotal >= deathPrevention.minTotal) {
        core.scenarioRuntime.deadExplorerPlayerIds = core.scenarioRuntime.deadExplorerPlayerIds.filter((playerId) => playerId !== explorer.playerId);
        setExplorerTraitsToDeathsDoor(explorer);
        nextRoll.latestLabel = '阻止死亡';
    } else {
        core.scenarioRuntime.deadExplorerPlayerIds = Array.from(new Set([
            ...core.scenarioRuntime.deadExplorerPlayerIds,
            explorer.playerId,
        ]));
        if (core.scenarioRuntime.traitorPlayerId === explorer.playerId) {
            core.scenarioRuntime.traitorCorpseRoomId = explorer.roomId;
            core.scenarioRuntime.jackSpiritReleased = true;
            core.scenarioRuntime.jackSpiritRoomId = deathPrevention.releasedJackSpiritRoomId
                ?? resolveJackSpiritSpawnRoomId(core, explorer.roomId);
            core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
            core.monsters = [{
                id: 'jack-spirit',
                name: '杰克之灵',
                portraitAsset: 'betrayal/monsters/spirit',
                tokenAsset: 'betrayal/tokens/monsters/ghost',
                roomId: core.scenarioRuntime.jackSpiritRoomId,
                might: 5,
                speed: 3,
                damage: 1,
            }];
        }
        nextRoll.latestLabel = '正常死亡';
    }
    nextRoll.deathPrevention = {
        ...deathPrevention,
        traitsBeforeDamage: { ...deathPrevention.traitsBeforeDamage },
        scenarioRuntimeBeforeDefeat: cloneScenarioRuntimeStatus(deathPrevention.scenarioRuntimeBeforeDefeat),
        monstersBeforeDefeat: deathPrevention.monstersBeforeDefeat.map(cloneMonster),
    };
}

function rotateToNextLivingPlayer(core: BetrayalCore, currentPlayerId: string): string {
    const turnEligibleExplorers = getExplorersInTurnOrder(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        || shouldDeadTraitorControlJackSpirit(core, explorer.playerId)
    ));
    if (turnEligibleExplorers.length === 0) {
        return currentPlayerId;
    }
    const currentIndex = turnEligibleExplorers.findIndex((explorer) => explorer.playerId === currentPlayerId);
    const nextExplorer = turnEligibleExplorers[(currentIndex + 1 + turnEligibleExplorers.length) % turnEligibleExplorers.length]
        ?? turnEligibleExplorers[0]!;
    return nextExplorer.playerId;
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

export function isBetrayalLibraryRoom(room: BetrayalRoomNode | undefined): boolean {
    return room?.name === '图书馆' || room?.visualId === 'library';
}

function resolveHauntRollTotal(core: BetrayalCore): number {
    return Math.max(0, getAllExplorers(core).reduce((total, explorer) => (
        total + explorer.inventory.filter((item) => item.kind === 'omen').length
    ), 0));
}

function rollTrait(random: RandomFn, value: number): number {
    let total = 0;
    for (let index = 0; index < Math.max(0, value); index += 1) {
        total += rollBetrayalPip(random);
    }
    return total;
}

function rollDicePips(random: RandomFn, count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, () => rollBetrayalPip(random));
}

function resolveAttackWeaponEffect(
    explorer: BetrayalExplorerSummary,
    weaponCardId: string | undefined,
): {
    card: BetrayalInventoryCard;
    bonus: number;
    extraDice: number;
    speedCost: number;
    attackTrait: BetrayalTraitKey;
    damageKind: 'physical' | 'mental';
} | null {
    if (!weaponCardId) {
        return null;
    }
    const card = explorer.inventory.find((item) => item.id === weaponCardId);
    if (!card) {
        return null;
    }
    const effectId = resolveInventoryEffectId(card.id);
    const bonus = ATTACK_ROLL_BONUS_WEAPONS_BY_CARD_ID[effectId] ?? 0;
    const extraDice = ATTACK_EXTRA_DICE_WEAPONS_BY_CARD_ID[effectId] ?? 0;
    const speedCost = ATTACK_SPEED_COST_WEAPONS_BY_CARD_ID[effectId] ?? 0;
    const attackTrait = ATTACK_TRAIT_WEAPONS_BY_CARD_ID[effectId] ?? 'might';
    const damageKind = ATTACK_DAMAGE_KIND_WEAPONS_BY_CARD_ID[effectId] ?? 'physical';
    return bonus > 0 || extraDice > 0 || speedCost > 0 || attackTrait !== 'might' || damageKind !== 'physical'
        ? { card, bonus, extraDice, speedCost, attackTrait, damageKind }
        : null;
}

export function resolveAttackWeaponCards(core: BetrayalCore): BetrayalInventoryCard[] {
    return core.currentExplorer.inventory.filter((card) => (
        Boolean(resolveAttackWeaponEffect(core.currentExplorer, card.id))
        && core.turnStartInventoryCardIds.includes(card.id)
        && !core.usedCardIdsThisTurn.includes(card.id)
    ));
}

function rollAttack(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    weaponEffect: ReturnType<typeof resolveAttackWeaponEffect>,
): number {
    return rollAttackWithDice(random, explorer, weaponEffect).total;
}

function rollAttackWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    weaponEffect: ReturnType<typeof resolveAttackWeaponEffect>,
): { total: number; dice: number[]; passiveBonus: number } {
    const trait = weaponEffect?.attackTrait ?? 'might';
    const dice = rollDicePips(random, explorer.traits[trait] + (weaponEffect?.extraDice ?? 0));
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
): number {
    const trait = weaponEffect?.attackTrait ?? 'might';
    return rollTrait(random, explorer.traits[trait]);
}

function applyAttackDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    damageKind: 'physical' | 'mental',
): void {
    if (damageKind === 'mental') {
        applyMentalDamage(explorer, amount);
        return;
    }
    applyPhysicalDamage(explorer, amount);
}

function resetExplorerTraits(explorer: BetrayalExplorerSummary, traits: BetrayalExplorerSummary['traits']): void {
    explorer.traits = { ...traits };
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

function rollTraitCheck(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    return rollTrait(random, resolveTraitCheckValue(explorer, trait)) + resolveTraitRollPassiveBonus(explorer, trait);
}

function rollTraitCheckWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): { total: number; dice: number[]; passiveBonus: number } {
    const dice = rollDicePips(random, resolveTraitCheckValue(explorer, trait));
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
    return rollTrait(random, resolveNonCombatTraitCheckValue(core, explorer, trait)) + resolveTraitRollPassiveBonus(explorer, trait);
}

function rollNonCombatTraitCheckWithDice(
    random: RandomFn,
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): { total: number; dice: number[]; passiveBonus: number } {
    const dice = rollDicePips(random, resolveNonCombatTraitCheckValue(core, explorer, trait));
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
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

function rollEventTraitCheck(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    core?: BetrayalCore,
): number {
    return rollEventTraitCheckWithDice(random, explorer, trait, core).total;
}

function rollEventTraitCheckWithDice(
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    core?: BetrayalCore,
): { total: number; dice: number[]; passiveBonus: number } {
    const diceCount = (core
        ? resolveNonCombatTraitCheckValue(core, explorer, trait)
        : resolveTraitCheckValue(explorer, trait)) + resolveEventTraitCheckExtraDice(explorer);
    const dice = rollDicePips(random, diceCount);
    const passiveBonus = resolveTraitRollPassiveBonus(explorer, trait);
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
}

function rollEventFixedDice(random: RandomFn, diceCount: number): { total: number; dice: number[]; passiveBonus: number } {
    const dice = rollDicePips(random, diceCount);
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

function resolveRabbitFootCard(core: BetrayalCore, cardId?: string, playerId = core.currentExplorer.playerId): BetrayalInventoryCard | null {
    const owner = findExplorerByPlayerId(core, playerId);
    const cards = owner?.inventory.filter((card) => resolveInventoryEffectId(card.id) === 'rope') ?? [];
    if (cardId) {
        return cards.find((card) => card.id === cardId) ?? null;
    }
    return cards[0] ?? null;
}

export function canUseRabbitFootForRecentRoll(core: BetrayalCore, playerId: string, cardId?: string): boolean {
    const card = resolveRabbitFootCard(core, cardId, playerId);
    const receivedThisTurn = core.receivedCardIdsThisTurnByPlayerId[playerId] ?? [];
    const existedAtRollWindowStart = core.recentRoll?.kind === 'roomEndTurnTraitCheck'
        || core.recentRoll?.kind === 'deathPrevention'
        ? !receivedThisTurn.includes(card?.id ?? '')
        : core.turnStartInventoryCardIds.includes(card?.id ?? '');
    return Boolean(
        card
        && core.recentRoll
        && core.recentRoll.kind !== 'monsterMoveRoll'
        && core.recentRoll.kind !== 'hauntRoll'
        && core.recentRoll.playerId === playerId
        && !core.recentRoll.consumedRabbitFootCardIds.includes(card.id)
        && existedAtRollWindowStart
        && !receivedThisTurn.includes(card.id)
        && !core.usedCardIdsThisTurn.includes(card.id)
        && core.recentRoll.dice.length > 0,
    );
}

function resolveRecentRollTotal(recentRoll: BetrayalRecentRollState): number {
    return recentRoll.dice.reduce((sum, pip) => sum + pip, 0) + recentRoll.passiveBonus;
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
    const damageToAttacker = Math.max(0, attack.defenderRoll - nextAttackRoll);
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
        roomIdBeforeEffect: core.currentExplorer.roomId,
        damageRolls: [],
        drawnCards: [],
    };
}

function rollAllTraitChecks(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    passMin: number,
    random: RandomFn,
): BetrayalAllTraitCheckResult[] {
    return traits.map((trait) => {
        const result = rollEventTraitCheckWithDice(random, explorer, trait);
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
        core.currentExplorer.roomId = snapshot.roomIdBeforeEffect;
        revertEventSideEffects(core, effect);
        for (const drawnCard of snapshot.drawnCards) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== drawnCard.id);
            core.deckCounts[drawnCard.kind] += 1;
        }
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
        core.currentExplorer.traits[effect.trait] -= effect.amount;
        return;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            core.currentExplorer.traits[appliedTrait] -= effect.amount;
        }
        return;
    }
    if (effect.mode === 'generalDamageChoice') {
        for (const trait of [...(effect.selectedTraits ?? effect.allowedTraits)].reverse()) {
            core.currentExplorer.traits[trait] += 1;
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
    if (effect.mode === 'rolledDamage') {
        return;
    }
    if (effect.mode === 'drawPossession') {
        if (effect.drawnCard) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((card) => card.id !== effect.drawnCard!.id);
            core.deckCounts[effect.kind] += 1;
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
        core.currentExplorer.traits[trait] += Math.max(0, effect.amount);
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

function applyTraitLoss(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    amount: number,
): void {
    let remaining = Math.max(0, amount);
    for (let index = 0; index < traits.length && remaining > 0; index += 1) {
        const trait = traits[index]!;
        const current = explorer.traits[trait];
        const reducible = Math.max(0, current - 1);
        if (reducible <= 0) {
            continue;
        }
        const delta = Math.min(reducible, remaining);
        explorer.traits[trait] -= delta;
        remaining -= delta;
    }
}

function applyPhysicalDamage(explorer: BetrayalExplorerSummary, amount: number): void {
    applyTraitLoss(explorer, ['might', 'speed'], Math.max(0, amount - resolvePhysicalDamageReduction(explorer)));
}

function applyMentalDamage(explorer: BetrayalExplorerSummary, amount: number): void {
    applyTraitLoss(explorer, ['knowledge', 'sanity'], Math.max(0, amount - resolveMentalDamageReduction(explorer)));
}

function applyGeneralDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    selectedTraits: BetrayalTraitKey[],
): void {
    let remaining = Math.max(0, amount);
    for (const trait of selectedTraits) {
        if (remaining <= 0) {
            break;
        }
        applyTraitLoss(explorer, [trait], 1);
        remaining -= 1;
    }
}

function applyEventEffect(
    core: BetrayalCore,
    effect: UseEffectProfile,
    random?: RandomFn,
    snapshot?: EventEffectSnapshot,
): EventEffectSnapshot | undefined {
    if (effect.mode === 'none') {
        return snapshot;
    }
    const nextSnapshot = snapshotEventEffect(core, snapshot);
    if (effect.mode === 'compound') {
        for (const childEffect of effect.effects) {
            applyEventEffect(core, childEffect, random, nextSnapshot);
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
    if (effect.mode === 'move') {
        core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + effect.amount));
        return nextSnapshot;
    }
    if (effect.mode === 'trait') {
        core.currentExplorer.traits[effect.trait] += effect.amount;
        return nextSnapshot;
    }
    if (effect.mode === 'chosenTrait') {
        const appliedTrait = effect.chosenTrait ?? effect.allowedTraits[0];
        if (appliedTrait) {
            core.currentExplorer.traits[appliedTrait] += effect.amount;
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
        applyGeneralDamage(core.currentExplorer, effect.amount, effect.selectedTraits ?? effect.allowedTraits);
        return nextSnapshot;
    }
    if (effect.mode === 'optionalEventRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'optionalHauntRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return nextSnapshot;
    }
    if (effect.mode === 'allTraitChecks') {
        if (!effect.results && !random) {
            throw new Error('allTraitChecks requires random');
        }
        const results = effect.results ?? rollAllTraitChecks(core.currentExplorer, effect.traits, effect.passMin, random!);
        const failedTraits = results.filter((result) => !result.passed).map((result) => result.trait);
        for (const trait of failedTraits) {
            applyTraitLoss(core.currentExplorer, [trait], effect.failAmount);
        }
        if (failedTraits.length === 0 && !effectHasUnresolvedTraitChoice(effect.allPassEffect)) {
            applyEventEffect(core, effect.allPassEffect, random, nextSnapshot);
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
        const damageRolls = effect.rolls ?? rollDicePips(random!, effect.dice);
        nextSnapshot.damageRolls.push(...damageRolls);
        const amount = damageRolls.reduce((sum, pip) => sum + pip, 0);
        if (effect.damageKind === 'physical') {
            applyPhysicalDamage(core.currentExplorer, amount);
        } else {
            applyMentalDamage(core.currentExplorer, amount);
        }
        return nextSnapshot;
    }
    if (effect.mode === 'drawPossession') {
        const drawnCard = effect.drawnCard
            ? cloneInventoryCard(effect.drawnCard)
            : createDrawnCard(core, effect.kind);
        core.currentExplorer.inventory = [...core.currentExplorer.inventory, drawnCard];
        core.deckCounts[effect.kind] = Math.max(0, core.deckCounts[effect.kind] - 1);
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
    applyGeneralDamage(core.currentExplorer, effect.amount, effect.traits);
    return nextSnapshot;
}

function materializeEventEffect(
    effect: UseEffectProfile,
    random: RandomFn,
    explorer: BetrayalExplorerSummary,
): UseEffectProfile {
    if (effect.mode === 'compound') {
        return {
            ...effect,
            effects: effect.effects.map((childEffect) => materializeEventEffect(childEffect, random, explorer)),
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
    if (effect.mode === 'allTraitChecks') {
        const results = rollAllTraitChecks(explorer, effect.traits, effect.passMin, random);
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
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return { ...effect };
    }
    if (effect.mode === 'rolledDamage' && !effect.rolls) {
        return { ...effect, rolls: rollDicePips(random, effect.dice) };
    }
    return { ...effect };
}

function isAttackWeaponCard(card: BetrayalInventoryCard): boolean {
    return ATTACK_WEAPON_CARD_IDS.has(resolveInventoryEffectId(card.id));
}

function applyRoomDiscoveryEffect(core: BetrayalCore, effect: BetrayalRoomDiscoveryEffect | undefined): void {
    if (effect === 'gainSanity1') {
        core.currentExplorer.traits.sanity += 1;
        return;
    }
    if (effect === 'gainKnowledge1') {
        core.currentExplorer.traits.knowledge += 1;
        return;
    }
    if (effect === 'gainMight1') {
        core.currentExplorer.traits.might += 1;
        return;
    }
    if (effect === 'gainSpeed1') {
        core.currentExplorer.traits.speed += 1;
    }
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

function resolveEndTurnRoomEffect(core: BetrayalCore, random: RandomFn): BetrayalRoomEndTurnEffectResult | null {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const effect = resolveRoomEndTurnEffect(currentRoom);
    if (!effect || !currentRoom) {
        return null;
    }

    if (effect === 'physicalDamage1') {
        return {
            kind: effect,
            playerId: core.currentExplorer.playerId,
            roomId: currentRoom.id,
            roomName: currentRoom.name,
            physicalDamage: 1,
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

    const speedRoll = rollTraitCheckWithDice(random, core.currentExplorer, 'speed');
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
        physicalDamage: rollBetrayalPip(random),
    };
}

function formatEndTurnRoomEffectLog(effect: BetrayalRoomEndTurnEffectResult, explorerName: string): string {
    if (effect.kind === 'physicalDamage1') {
        return `${explorerName}在${effect.roomName}结束回合，承受 1 点物理伤害`;
    }
    if (effect.kind === 'moveToBasementLanding') {
        return `${explorerName}从${effect.roomName}滑落到地下室起始点`;
    }
    if (effect.destinationRoomId) {
        return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，坠落到地下室起始点并承受 ${effect.physicalDamage ?? 0} 点物理伤害`;
    }
    return `${explorerName}在${effect.roomName}速度检定 ${effect.speedRoll}，没有坠落`;
}

function isExplorerDead(explorer: BetrayalExplorerSummary): boolean {
    return (
        explorer.traits.might <= 1
        || explorer.traits.speed <= 1
        || explorer.traits.knowledge <= 1
        || explorer.traits.sanity <= 1
    );
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

const FIXED_LINK_ROOM_IDS_BY_VISUAL_ID: Partial<Record<BetrayalRoomVisualId, string>> = {
    secretStaircase: 'hallway',
};

const FIXED_LINK_TARGET_VISUAL_IDS_BY_VISUAL_ID: Partial<Record<BetrayalRoomVisualId, BetrayalRoomVisualId>> = {
    graveyard: 'undergroundCavern',
    undergroundCavern: 'graveyard',
    gallery: 'ballroom',
};

function resolveFixedLinkTargetRoomId(rooms: BetrayalRoomNode[], room: BetrayalRoomNode): string | null {
    const fixedTargetRoomId = FIXED_LINK_ROOM_IDS_BY_VISUAL_ID[room.visualId];
    if (fixedTargetRoomId) {
        return fixedTargetRoomId;
    }
    const fixedTargetVisualId = FIXED_LINK_TARGET_VISUAL_IDS_BY_VISUAL_ID[room.visualId];
    if (!fixedTargetVisualId) {
        return null;
    }
    return rooms.find((item) => item.state === 'discovered' && item.visualId === fixedTargetVisualId)?.id ?? null;
}

function resolveConnectedRoomIds(rooms: BetrayalRoomNode[], roomId: string): Set<string> {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) {
        return new Set();
    }
    const connectedIds = new Set(
        room.doorways
            .map((doorway) => doorway.connectsToRoomId)
            .filter((targetRoomId): targetRoomId is string => Boolean(targetRoomId)),
    );
    if (room.state === 'discovered') {
        const fixedTargetRoomId = resolveFixedLinkTargetRoomId(rooms, room);
        if (fixedTargetRoomId) {
            connectedIds.add(fixedTargetRoomId);
        }
        if (room.markerTokens?.includes('secretPassage')) {
            for (const secretPassageRoom of rooms) {
                if (
                    secretPassageRoom.id !== room.id
                    && secretPassageRoom.state === 'discovered'
                    && secretPassageRoom.markerTokens?.includes('secretPassage')
                ) {
                    connectedIds.add(secretPassageRoom.id);
                }
            }
        }
    }
    for (const sourceRoom of rooms) {
        if (sourceRoom.state !== 'discovered') {
            continue;
        }
        const fixedTargetRoomId = resolveFixedLinkTargetRoomId(rooms, sourceRoom);
        if (fixedTargetRoomId === room.id) {
            connectedIds.add(sourceRoom.id);
        }
    }
    return connectedIds;
}

function oppositeEdge(edge: BetrayalRoomEdge): BetrayalRoomEdge {
    switch (edge) {
        case 'north':
            return 'south';
        case 'east':
            return 'west';
        case 'south':
            return 'north';
        case 'west':
        default:
            return 'east';
    }
}

function rotateEdge(edge: BetrayalRoomEdge, turns: 0 | 1 | 2 | 3): BetrayalRoomEdge {
    const edges: BetrayalRoomEdge[] = ['north', 'east', 'south', 'west'];
    const index = edges.indexOf(edge);
    return edges[(index + turns + edges.length) % edges.length]!;
}

function resolveDoorwayConnectionEdge(fromRoom: BetrayalRoomNode, targetRoomId: string): BetrayalRoomEdge | null {
    return fromRoom.doorways.find((doorway) => doorway.connectsToRoomId === targetRoomId)?.edge ?? null;
}

function orientDoorwaysToEntry(
    templateDoorways: BetrayalRoomEdge[],
    entryEdge: BetrayalRoomEdge,
): { doorways: BetrayalRoomDoorway[]; orientationTurns: 0 | 1 | 2 | 3 } {
    const requiredEdge = oppositeEdge(entryEdge);
    const baseEdge = templateDoorways[0] ?? requiredEdge;
    const edges: BetrayalRoomEdge[] = ['north', 'east', 'south', 'west'];
    const turns = ((edges.indexOf(requiredEdge) - edges.indexOf(baseEdge) + edges.length) % edges.length) as 0 | 1 | 2 | 3;
    return {
        doorways: templateDoorways.map((edge) => ({ edge: rotateEdge(edge, turns) })),
        orientationTurns: turns,
    };
}

const ROOM_EDGE_VECTOR: Record<BetrayalRoomEdge, { x: number; y: number }> = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
};

const STARTING_FRONTIER_SLOT_IDS: Record<string, Partial<Record<BetrayalRoomEdge, string>>> = {
    'upper-landing': {
        north: 'upper-north',
        west: 'upper-west',
    },
    hallway: {
        north: 'ground-north',
        south: 'ground-south',
    },
    'entrance-hall': {
        east: 'ground-east',
    },
    'basement-landing': {
        east: 'basement-east',
        south: 'basement-south',
    },
};

function resolveBackVisualId(floor: BetrayalRoomFloor): Extract<BetrayalRoomVisualId, 'backUpper' | 'backGround' | 'backBasement'> {
    if (floor === 'upper') {
        return 'backUpper';
    }
    if (floor === 'basement') {
        return 'backBasement';
    }
    return 'backGround';
}

function createFrontierSlotId(fromRoom: BetrayalRoomNode, edge: BetrayalRoomEdge): string {
    return STARTING_FRONTIER_SLOT_IDS[fromRoom.id]?.[edge] ?? `frontier-${fromRoom.id}-${edge}`;
}

function refreshExplorableRoomSlots(rooms: BetrayalRoomNode[]): BetrayalRoomNode[] {
    const discoveredRooms = rooms
        .filter((room) => room.state === 'discovered')
        .map(cloneRoom);
    const discoveredIds = new Set(discoveredRooms.map((room) => room.id));

    for (const room of discoveredRooms) {
        room.connectedRoomIds = room.connectedRoomIds.filter((roomId) => discoveredIds.has(roomId));
        room.doorways = room.doorways.map((doorway) => (
            doorway.connectsToRoomId && !discoveredIds.has(doorway.connectsToRoomId)
                ? {
                    edge: doorway.edge,
                    leadsToFloor: doorway.leadsToFloor,
                    note: doorway.note,
                }
                : { ...doorway }
        ));
    }

    const occupiedPositions = new Set(discoveredRooms.map((room) => `${room.floor}:${room.x}:${room.y}`));
    const frontierSlots: BetrayalRoomNode[] = [];

    for (const room of discoveredRooms) {
        for (const doorway of room.doorways) {
            if (doorway.connectsToRoomId || doorway.leadsToFloor) {
                continue;
            }
            const vector = ROOM_EDGE_VECTOR[doorway.edge];
            const x = room.x + vector.x;
            const y = room.y + vector.y;
            const positionKey = `${room.floor}:${x}:${y}`;
            if (occupiedPositions.has(positionKey)) {
                const neighbor = discoveredRooms.find((item) => item.floor === room.floor && item.x === x && item.y === y);
                const neighborDoorway = neighbor?.doorways.find((item) => item.edge === oppositeEdge(doorway.edge));
                if (neighbor && neighborDoorway) {
                    doorway.connectsToRoomId = neighbor.id;
                    neighborDoorway.connectsToRoomId = room.id;
                    room.connectedRoomIds = Array.from(new Set([...room.connectedRoomIds, neighbor.id]));
                    neighbor.connectedRoomIds = Array.from(new Set([...neighbor.connectedRoomIds, room.id]));
                }
                continue;
            }

            const existingSlot = frontierSlots.find((slot) => slot.floor === room.floor && slot.x === x && slot.y === y);
            if (existingSlot) {
                doorway.connectsToRoomId = existingSlot.id;
                room.connectedRoomIds = Array.from(new Set([...room.connectedRoomIds, existingSlot.id]));
                if (!existingSlot.doorways.some((slotDoorway) => slotDoorway.connectsToRoomId === room.id)) {
                    existingSlot.doorways = [
                        ...existingSlot.doorways,
                        { edge: oppositeEdge(doorway.edge), connectsToRoomId: room.id },
                    ];
                    existingSlot.connectedRoomIds = Array.from(new Set([...existingSlot.connectedRoomIds, room.id]));
                }
                continue;
            }

            const backVisualId = resolveBackVisualId(room.floor);
            const slot: BetrayalRoomNode = {
                id: createFrontierSlotId(room, doorway.edge),
                name: '未探索',
                floor: room.floor,
                x,
                y,
                connectedRoomIds: [room.id],
                entryRoomId: room.id,
                entryEdge: doorway.edge,
                orientationTurns: 0,
                state: 'unexplored',
                hint: `等待从${room.name}翻出房间`,
                tags: ['待翻出'],
                discoveryReward: null,
                visualId: backVisualId,
                doorways: [
                    { edge: oppositeEdge(doorway.edge), connectsToRoomId: room.id },
                ],
                backVisualId,
            };
            doorway.connectsToRoomId = slot.id;
            room.connectedRoomIds = Array.from(new Set([...room.connectedRoomIds, slot.id]));
            frontierSlots.push(slot);
            occupiedPositions.add(positionKey);
        }
    }

    return [...discoveredRooms, ...frontierSlots];
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

function roomDistanceByLayout(a: BetrayalRoomNode, b: BetrayalRoomNode): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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

function isStraightLineVisible(a: BetrayalRoomNode, b: BetrayalRoomNode, rooms: BetrayalRoomNode[]): boolean {
    if (a.floor !== b.floor) {
        return false;
    }
    if (a.x !== b.x && a.y !== b.y) {
        return false;
    }
    const candidates = rooms.filter((room) => room.floor === a.floor && room.state === 'discovered');
    if (a.x === b.x) {
        const [start, end] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
        for (let y = start; y <= end; y += 1) {
            if (!candidates.some((room) => room.x === a.x && room.y === y)) {
                return false;
            }
        }
        return true;
    }
    const [start, end] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
    for (let x = start; x <= end; x += 1) {
        if (!candidates.some((room) => room.x === x && room.y === a.y)) {
            return false;
        }
    }
    return true;
}

function rollBetrayalPip(random: RandomFn): number {
    return Math.max(0, Math.min(2, random.d(3) - 1));
}

function rollMysticElevatorWithDice(random: RandomFn): { total: number; dice: number[] } {
    const dice = [rollBetrayalPip(random), rollBetrayalPip(random)];
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0),
        dice,
    };
}

function rollMysticElevator(random: RandomFn): number {
    return rollMysticElevatorWithDice(random).total;
}

function resolveMysticElevatorAllowedFloors(rollTotal: number): BetrayalRoomFloor[] {
    if (rollTotal >= 4) {
        return ['upper', 'ground', 'basement'];
    }
    if (rollTotal === 3) {
        return ['upper'];
    }
    if (rollTotal === 2) {
        return ['ground'];
    }
    return ['basement'];
}

export function canUseMysticElevator(core: BetrayalCore): boolean {
    const currentRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    return (
        core.phase === 'preHaunt'
        && currentRoom?.state === 'discovered'
        && currentRoom.enterEffect === 'mysticElevator'
        && !core.turnEndedByDiscovery
        && !core.scenarioRuntime.usedRoomEffectIdsThisTurn.includes('mysticElevator')
    );
}

function resolveMysticElevatorDestination(core: BetrayalCore, rollTotal: number): BetrayalRoomNode | null {
    const allowedFloors = new Set(resolveMysticElevatorAllowedFloors(rollTotal));
    return core.rooms
        .filter((room) => room.state === 'unexplored' && allowedFloors.has(room.floor))
        .sort((left, right) => {
            const floorDelta = resolveMysticElevatorAllowedFloors(rollTotal).indexOf(left.floor)
                - resolveMysticElevatorAllowedFloors(rollTotal).indexOf(right.floor);
            if (floorDelta !== 0) {
                return floorDelta;
            }
            return left.id.localeCompare(right.id);
        })[0] ?? null;
}

function resolveMysticElevatorEffect(core: BetrayalCore, random: RandomFn): BetrayalRoomEnterEffectResult | null {
    const currentRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!currentRoom || currentRoom.enterEffect !== 'mysticElevator') {
        return null;
    }
    const roll = rollMysticElevatorWithDice(random);
    const destination = resolveMysticElevatorDestination(core, roll.total);
    if (!destination) {
        return null;
    }
    return {
        kind: 'mysticElevator',
        playerId: core.currentExplorer.playerId,
        roomId: currentRoom.id,
        roomName: currentRoom.name,
        rollTotal: roll.total,
        dice: roll.dice,
        destinationRoomId: destination.id,
        destinationRoomName: destination.name,
        destinationFloor: destination.floor,
    };
}

function detachMysticElevator(rooms: BetrayalRoomNode[], elevatorRoomId: string): BetrayalRoomNode[] {
    return rooms.map((room) => {
        const nextRoom = cloneRoom(room);
        if (nextRoom.id === elevatorRoomId) {
            return nextRoom;
        }
        nextRoom.connectedRoomIds = nextRoom.connectedRoomIds.filter((roomId) => roomId !== elevatorRoomId);
        nextRoom.doorways = nextRoom.doorways.map((doorway) => (
            doorway.connectsToRoomId === elevatorRoomId
                ? {
                    edge: doorway.edge,
                    leadsToFloor: doorway.leadsToFloor,
                    note: doorway.note,
                }
                : doorway
        ));
        return nextRoom;
    });
}

function moveMysticElevatorRoom(
    rooms: BetrayalRoomNode[],
    effect: BetrayalRoomEnterEffectResult,
): BetrayalRoomNode[] {
    const destinationSlot = rooms.find((room) => room.id === effect.destinationRoomId);
    const elevator = rooms.find((room) => room.id === effect.roomId);
    if (!destinationSlot || !elevator) {
        return rooms;
    }
    const entryRoomId = destinationSlot.connectedRoomIds[0] ?? destinationSlot.doorways[0]?.connectsToRoomId;
    const entryRoom = entryRoomId ? rooms.find((room) => room.id === entryRoomId) : null;
    const entryEdge = entryRoom
        ? resolveDoorwayConnectionEdge(entryRoom, destinationSlot.id) ?? destinationSlot.entryEdge ?? destinationSlot.doorways[0]?.edge ?? 'west'
        : destinationSlot.entryEdge ?? destinationSlot.doorways[0]?.edge ?? 'west';
    const baseEdges = Array.from(new Set(elevator.doorways.map((doorway) => doorway.edge)));
    const oriented = orientDoorwaysToEntry(baseEdges, entryEdge);
    const detachedRooms = detachMysticElevator(rooms, elevator.id)
        .filter((room) => room.id !== destinationSlot.id);

    return refreshExplorableRoomSlots(detachedRooms.map((room) => {
        if (room.id !== elevator.id) {
            return room;
        }
        return {
            ...room,
            floor: destinationSlot.floor,
            x: destinationSlot.x,
            y: destinationSlot.y,
            entryRoomId,
            entryEdge,
            orientationTurns: oriented.orientationTurns,
            doorways: [
                ...oriented.doorways,
                ...(entryRoomId
                    ? [{
                        edge: oppositeEdge(entryEdge),
                        connectsToRoomId: entryRoomId,
                    }]
                    : []),
            ],
            connectedRoomIds: entryRoomId ? [entryRoomId] : [],
        };
    }));
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
    if (core.deckCounts.omen <= 1) {
        return {
            dice: [],
            total: threshold,
            threshold,
            triggered: true,
            automatic: true,
        };
    }
    const dice = rollDicePips(random, resolveHauntRollTotal(core) + 1);
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
        return '最后一张预兆自动触发作祟';
    }
    return `作祟检定 ${hauntRoll.total}（${hauntRoll.dice.length} 颗骰子，${hauntRoll.triggered ? '作祟开始' : `未达到 ${hauntRoll.threshold}+`}）`;
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

export function resolveMoveTargetRooms(core: BetrayalCore): BetrayalRoomNode[] {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    if (shouldDeadTraitorControlJackSpirit(core, core.currentExplorer.playerId)) {
        return core.rooms.filter((room) => (
            room.state === 'discovered'
            && room.id !== activeRoom.id
            && roomDistanceByLayout(room, activeRoom) === 1
        ));
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.filter((room) => room.state === 'discovered' && connectedIds.has(room.id));
}

function resolveMoveCostFromRoom(room: BetrayalRoomNode | undefined): number {
    return room?.markerTokens?.includes('obstacle') ? 2 : 1;
}

function resolveMoveCost(core: BetrayalCore): number {
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    return resolveMoveCostFromRoom(activeRoom);
}

export function resolveNextExplorableRoomSlot(core: BetrayalCore): BetrayalRoomNode | null {
    if (core.phase !== 'preHaunt') {
        return null;
    }
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return null;
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.find((room) => room.state === 'unexplored' && connectedIds.has(room.id)) ?? null;
}

export function resolveExplorableRoomSlots(core: BetrayalCore): BetrayalRoomNode[] {
    if (core.phase !== 'preHaunt') {
        return [];
    }
    const activeRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!activeRoom) {
        return [];
    }
    const connectedIds = resolveConnectedRoomIds(core.rooms, activeRoom.id);
    return core.rooms.filter((room) => room.state === 'unexplored' && connectedIds.has(room.id));
}

export function resolveTradeTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => (
        explorer.roomId === core.activeRoomId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
}

export function canUseDogForTrade(core: BetrayalCore): boolean {
    const dog = core.currentExplorer.inventory.find((card) => resolveInventoryEffectId(card.id) === 'dog');
    return Boolean(
        dog
        && core.turnStartInventoryCardIds.some((cardId) => resolveInventoryEffectId(cardId) === 'dog')
        && !core.usedCardIdsThisTurn.includes(dog.id),
    );
}

function resolveDogTradeSourceCardId(core: BetrayalCore): string | null {
    return core.currentExplorer.inventory.find((card) => resolveInventoryEffectId(card.id) === 'dog')?.id ?? null;
}

export function resolveDogTradeTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    if (!canUseDogForTrade(core)) {
        return [];
    }
    const sourceRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    if (!sourceRoom) {
        return [];
    }
    return core.otherExplorers.filter((explorer) => {
        if (core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)) {
            return false;
        }
        const targetRoom = core.rooms.find((room) => room.id === explorer.roomId);
        return Boolean(targetRoom && roomDistanceByLayout(sourceRoom, targetRoom) <= 4);
    });
}

function resolveTradeCardIds(core: BetrayalCore, payload: BetrayalCommandMap[typeof BETRAYAL_COMMANDS.TRADE_POSSESSION]): string[] {
    const cardIds = payload.cardIds?.length ? payload.cardIds : [payload.cardId].filter(Boolean);
    return Array.from(new Set(cardIds)) as string[];
}

export function resolveCorpseLootTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => (
        explorer.roomId === core.activeRoomId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        && explorer.inventory.length > 0
        && !core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn.includes(explorer.playerId)
    ));
}

function formatRoomTargetList(rooms: BetrayalRoomNode[]): string {
    return Array.from(new Set(rooms.map((room) => room.name))).join(' / ');
}

function resolveNextDeckKind(core: BetrayalCore): BetrayalDeckKind | null {
    for (let index = 0; index < core.drawOrder.length; index += 1) {
        const kind = core.drawOrder[(core.exploreIndex + index) % core.drawOrder.length]!;
        if (core.deckCounts[kind] > 0) {
            return kind;
        }
    }
    return null;
}

function resolveRoomTemplate(core: BetrayalCore, floor: BetrayalRoomNode['floor']): RoomTemplate {
    const pool = core.roomDiscoveryOrderByFloor[floor];
    const discoveredCount = core.rooms.filter((room) => room.floor === floor && room.state === 'discovered' && !room.startingTile).length;
    return cloneRoomTemplate(pool[discoveredCount % pool.length]!);
}

function resolveRoomTemplateAtOffset(core: BetrayalCore, floor: BetrayalRoomNode['floor'], offset: number): RoomTemplate {
    const pool = core.roomDiscoveryOrderByFloor[floor];
    const discoveredCount = core.rooms.filter((room) => room.floor === floor && room.state === 'discovered' && !room.startingTile).length;
    return cloneRoomTemplate(pool[(discoveredCount + offset) % pool.length]!);
}

export function canUseHolySymbolForDiscovery(core: BetrayalCore): boolean {
    return core.phase === 'preHaunt'
        && core.currentExplorer.inventory.some((card) => resolveInventoryEffectId(card.id) === 'holy-symbol')
        && core.turnStartInventoryCardIds.some((cardId) => resolveInventoryEffectId(cardId) === 'holy-symbol');
}

export function canUseIdolToSkipEvent(core: BetrayalCore): boolean {
    return core.phase === 'preHaunt'
        && core.currentExplorer.inventory.some((card) => resolveInventoryEffectId(card.id) === 'idol')
        && core.turnStartInventoryCardIds.some((cardId) => resolveInventoryEffectId(cardId) === 'idol');
}

function resolveSkeletonKeyCardId(explorer: BetrayalExplorerSummary): string | null {
    return explorer.inventory.find((card) => resolveInventoryEffectId(card.id) === 'lockpick-tool')?.id ?? null;
}

export function canUseSkeletonKeyForMove(core: BetrayalCore, targetRoomId: string): boolean {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
    return Boolean(
        resolveSkeletonKeyCardId(core.currentExplorer)
        && core.movesRemaining > 0
        && currentRoom
        && targetRoom
        && targetRoom.state === 'discovered'
        && currentRoom.floor === targetRoom.floor
        && roomDistanceByLayout(currentRoom, targetRoom) === 1
        && !resolveConnectedRoomIds(core.rooms, currentRoom.id).has(targetRoom.id),
    );
}

function createDrawnCard(core: BetrayalCore, kind: Exclude<BetrayalDeckKind, 'event'>): BetrayalInventoryCard {
    const drawnCount = countDrawnCards(core, kind);
    const template = core.possessionOrderByKind[kind][drawnCount % core.possessionOrderByKind[kind].length]!;
    return {
        id: `${template.id}-${core.exploreIndex}`,
        name: template.name,
        kind: template.kind,
    };
}

function createDrawnCardsUntilWeapon(core: BetrayalCore): { weapon: BetrayalInventoryCard | null; buriedCards: BetrayalInventoryCard[] } {
    const itemDeck = core.possessionOrderByKind.item;
    if (itemDeck.length === 0) {
        return { weapon: null, buriedCards: [] };
    }
    const drawnCount = countDrawnCards(core, 'item');
    const revealedCards: BetrayalInventoryCard[] = [];
    for (let index = 0; index < itemDeck.length; index += 1) {
        const template = itemDeck[(drawnCount + index) % itemDeck.length]!;
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

function resolveEvent(core: BetrayalCore): EventTemplate {
    const drawnCount = countDrawnCards(core, 'event');
    return cloneEventTemplate(core.eventOrder[drawnCount % core.eventOrder.length]!);
}

function formatEffectLabel(effect: PossessionUseEffectProfile): string {
    if (effect.mode === 'none') {
        return '无事发生';
    }
    if (effect.mode === 'move') {
        return `移动 ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
    }
    if (effect.mode === 'nextNonCombatTraitReplacement') {
        return `下一次非战斗检定可用${TRAIT_LABEL[effect.replacementTrait]}替换`;
    }
    if (effect.mode === 'healTraits') {
        return `治疗${effect.traits.map((trait) => TRAIT_LABEL[trait]).join('和')}`;
    }
    if (effect.mode === 'placeExplorer') {
        return '放置到任一已发现板块';
    }
    if (effect.mode === 'moveOthersInRoom') {
        return '移动同板块其他探险者和怪物到相邻板块';
    }
    if (effect.mode === 'generalDamage') {
        return `通用伤害 ${effect.amount}`;
    }
    if (effect.mode === 'generalDamageChoice') {
        const selected = effect.selectedTraits?.map((trait) => TRAIT_LABEL[trait]).join('、');
        return selected
            ? `通用伤害 ${effect.amount}（${selected}）`
            : `通用伤害 ${effect.amount}`;
    }
    if (effect.mode === 'placeObstacleToken') {
        return '放置障碍物';
    }
    if (effect.mode === 'placeSecretPassageToken') {
        return `在${effect.targetRoomName ?? '当前板块'}放置秘密通道标志物`;
    }
    if (effect.mode === 'rolledDamage') {
        return `受到 ${effect.dice} 颗骰子的${effect.damageKind === 'physical' ? '物理' : '精神'}伤害`;
    }
    if (effect.mode === 'drawPossession') {
        return `抽取一张${effect.kind === 'item' ? '物品' : '预兆'}卡`;
    }
    if (effect.mode === 'chosenTrait') {
        const trait = effect.chosenTrait ?? effect.allowedTraits[0];
        return `${trait ? TRAIT_LABEL[trait] : '任意属性'} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
    }
    if (effect.mode === 'healChosenTrait') {
        const trait = effect.chosenTrait ?? effect.allowedTraits[0];
        return `治疗${trait ? TRAIT_LABEL[trait] : '任意属性'}`;
    }
    if (effect.mode === 'placeExplorerInRoom') {
        return `放置到${effect.roomName}`;
    }
    if (effect.mode === 'placeExplorerInFloorStartingRoom') {
        return `放置到${effect.roomName}`;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByVisualId') {
        return `放置到${effect.roomNames.join('或')}`;
    }
    if (effect.mode === 'placeExplorerInDiscoveredRoomByFloor') {
        return `放置到${effect.targetRoomName ?? '目标板块'}`;
    }
    if (effect.mode === 'placeExplorerInAdjacentRoom') {
        return `放置到${effect.targetRoomName ?? '相邻板块'}`;
    }
    if (effect.mode === 'optionalEventRoll') {
        return `可选择${effect.acceptLabel}`;
    }
    if (effect.mode === 'optionalHauntRoll') {
        return `可选择${effect.acceptLabel}`;
    }
    if (effect.mode === 'chooseTraitRoll') {
        return effect.prompt;
    }
    if (effect.mode === 'allTraitChecks') {
        return '每项属性各检定一次';
    }
    if (effect.mode === 'compound') {
        return effect.effects.map(formatEffectLabel).join('；');
    }
    return `${TRAIT_LABEL[effect.trait!]} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
}

function resolveRecommendedAction(core: BetrayalCore, options: { preferUse?: boolean; cardId?: string } = {}): BetrayalRecommendedAction {
    if (core.phase === 'haunt') {
        if (core.scenarioRuntime.jackSpiritReleased && core.scenarioRuntime.jackSpiritRoomId === core.activeRoomId) {
            return core.scenarioRuntime.exorcismCircleRoomIds.length >= 2 ? 'use' : 'move';
        }
        if (
            isBetrayalLibraryRoom(core.rooms.find((room) => room.id === core.activeRoomId))
            && !core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(core.currentExplorer.playerId)
        ) {
            return 'use';
        }
        if (core.rooms.find((room) => room.id === core.activeRoomId)?.discoveryReward === 'event') {
            return 'use';
        }
    }

    const canMove = core.movesRemaining > 0 && resolveMoveTargetRooms(core).length > 0;
    const canExplore = Boolean(resolveNextExplorableRoomSlot(core) && resolveNextDeckKind(core));
    const canTrade = core.currentExplorer.inventory.length > 0
        && (resolveTradeTargets(core).length > 0 || resolveDogTradeTargets(core).length > 0 || resolveCorpseLootTargets(core).length > 0);
    const cardId = options.cardId
        ?? core.currentExplorer.inventory.find((card) => canUsePossessionThisTurn(core, card.id))?.id;
    const canUse = Boolean(cardId && canUsePossessionThisTurn(core, cardId));

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
    const dice = rollDicePips(random, jackSpirit.speed);
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

function resolvePendingTurnEndRoll(core: BetrayalCore): BetrayalRecentRollState | null {
    const recentRoll = core.recentRoll;
    if (
        recentRoll?.kind !== 'roomEndTurnTraitCheck'
        || recentRoll.playerId !== core.currentPlayer
        || !recentRoll.roomEndTurn?.nextPlayerId
    ) {
        return null;
    }
    return recentRoll;
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

function validatePreHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase !== 'preHaunt') {
        return { valid: false, error: '当前不在运行时阶段。' };
    }
        if (command.type === BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE) {
            const pending = core.pendingEventChoice;
            if (!pending || pending.playerId !== command.playerId) {
                return { valid: false, error: '当前没有待结算的事件选择。' };
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
                && !effectAllowsGeneralDamageTraits(pending.effect, command.payload.traits)
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
                    && !effectAllowsGeneralDamageTraits(previewEffect, command.payload.traits)
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
                && !effectAllowsGeneralDamageTraits(pending.effect.allPassEffect, command.payload.traits)
            ) {
                return { valid: false, error: '该事件必须选择足够的受伤属性。' };
            }
            return { valid: true };
        }
        if (pending.effect.mode === 'optionalHauntRoll') {
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
                        && !effectAllowsGeneralDamageTraits(pending.effect.skippedOrStartedEffect, command.payload.traits)
                    )
                )
            ) {
                return { valid: false, error: '该事件必须选择一个有效属性。' };
            }
            return { valid: true };
        }
        return { valid: true };
    }
    if (command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT) {
        const card = resolveRabbitFootCard(core, command.payload.cardId, command.playerId);
        if (!card) {
            return { valid: false, error: '当前探索者没有兔脚。' };
        }
        if (!canUseRabbitFootForRecentRoll(core, command.playerId, card.id)) {
            return { valid: false, error: '当前没有可被兔脚重掷的最近投骰。' };
        }
        const dieIndex = command.payload.dieIndex ?? 0;
        if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= (core.recentRoll?.dice.length ?? 0)) {
            return { valid: false, error: '兔脚必须选择刚刚投过的一颗骰子。' };
        }
        return { valid: true };
    }
    const pendingTurnEndRollValidation = validateTurnEndRollAcknowledgement(core, command);
    if (pendingTurnEndRollValidation) {
        return pendingTurnEndRollValidation;
    }
    if (!isPlayersTurn(core, command.playerId)) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }
    if (
        core.turnEndedByDiscovery
        && command.type !== BETRAYAL_COMMANDS.END_TURN
        && command.type !== BETRAYAL_COMMANDS.USE_RABBIT_FOOT
        && command.type !== BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE
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
            if (core.movesRemaining < resolveMoveCost(core) || !targetRooms.has(payload.roomId)) {
                return { valid: false, error: '目标房间不可移动。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = explorableSlots[0] ?? null;
            if (!nextSlot || !resolveNextDeckKind(core)) {
                return { valid: false, error: '当前没有可探索房间。' };
            }
            if (command.payload.roomId && !explorableSlots.some((room) => room.id === command.payload.roomId)) {
                return { valid: false, error: '指定房间不是当前开放门位。' };
            }
            if (command.payload.useHolySymbol && !canUseHolySymbolForDiscovery(core)) {
                return { valid: false, error: '当前探索者不能使用圣符替换发现板块。' };
            }
            if (command.payload.useIdol) {
                if (!canUseIdolToSkipEvent(core)) {
                    return { valid: false, error: '当前探索者不能使用雕像跳过事件抽取。' };
                }
                if (resolveNextDeckKind(core) !== 'event') {
                    return { valid: false, error: '雕像只能在发现事件符号板块时使用。' };
                }
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            const cardId = command.payload.cardId;
            if (!cardId || !core.currentExplorer.inventory.some((card) => card.id === cardId)) {
                return { valid: false, error: '当前没有可使用持有物。' };
            }
            if (!Object.prototype.hasOwnProperty.call(USE_EFFECTS, resolveInventoryEffectId(cardId))) {
                return { valid: false, error: '该持有物没有主动使用效果。' };
            }
            const effect = USE_EFFECTS[resolveInventoryEffectId(cardId)]!;
            if (effect.mode === 'healTraits' && effect.target === 'selfOrSameRoomExplorer' && command.payload.targetPlayerId) {
                const canTargetSelf = command.payload.targetPlayerId === core.currentExplorer.playerId;
                const sameRoomTarget = core.otherExplorers.some((explorer) => (
                    explorer.playerId === command.payload.targetPlayerId
                    && explorer.roomId === core.currentExplorer.roomId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ));
                if (!canTargetSelf && !sameRoomTarget) {
                    return { valid: false, error: '急救包只能治疗自己或同板块的另一位探索者。' };
                }
            }
            if (effect.mode === 'placeExplorer') {
                const targetRoomId = command.payload.targetRoomId;
                if (!targetRoomId || !core.rooms.some((room) => room.id === targetRoomId && room.state === 'discovered')) {
                    const card = core.currentExplorer.inventory.find((item) => item.id === cardId);
                    const cardName = card?.name ?? '该持有物';
                    return { valid: false, error: `${cardName}只能把探索者放置到已发现板块。` };
                }
            }
            if (effect.mode === 'moveOthersInRoom') {
                const targetRoomId = command.payload.targetRoomId;
                const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
                const targetRoomIdsByTokenId = command.payload.targetRoomIdsByTokenId ?? {};
                const targetTokenIds = [
                    ...core.otherExplorers
                        .filter((explorer) => (
                            explorer.roomId === core.currentExplorer.roomId
                            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                        ))
                        .map((explorer) => explorer.playerId),
                    ...core.monsters
                        .filter((monster) => monster.roomId === core.currentExplorer.roomId)
                        .map((monster) => monster.id),
                ];
                const hasOtherTargets = targetTokenIds.length > 0;
                const requestedRoomIds = targetTokenIds.map((tokenId) => targetRoomIdsByTokenId[tokenId] ?? targetRoomId);
                const hasTargetForEveryToken = requestedRoomIds.every(Boolean);
                const connectedRoomIds = currentRoom ? resolveConnectedRoomIds(core.rooms, currentRoom.id) : new Set<string>();
                const allTargetsValid = requestedRoomIds.every((roomId) => (
                    Boolean(roomId)
                    && core.rooms.some((room) => (
                        room.id === roomId
                        && room.state === 'discovered'
                        && connectedRoomIds.has(room.id)
                    ))
                ));
                const hasSameRoomExplorerTarget = core.otherExplorers.some((explorer) => (
                    explorer.roomId === core.currentExplorer.roomId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && Object.prototype.hasOwnProperty.call(targetRoomIdsByTokenId, explorer.playerId)
                ));
                const hasSameRoomMonsterTarget = core.monsters.some((monster) => (
                    monster.roomId === core.currentExplorer.roomId
                    && Object.prototype.hasOwnProperty.call(targetRoomIdsByTokenId, monster.id)
                ));
                const hasOnlySameRoomTokenKeys = Object.keys(targetRoomIdsByTokenId).every((tokenId) => (
                    targetTokenIds.includes(tokenId)
                ));
                if (!hasOtherTargets) {
                    return { valid: false, error: '当前板块没有可被面具移动的其他角色或怪物。' };
                }
                if (
                    !currentRoom
                    || !hasTargetForEveryToken
                    || !allTargetsValid
                    || !hasOnlySameRoomTokenKeys
                    || (
                        Object.keys(targetRoomIdsByTokenId).length > 0
                        && !hasSameRoomExplorerTarget
                        && !hasSameRoomMonsterTarget
                    )
                ) {
                    return { valid: false, error: '面具只能把同板块其他角色移动到已发现的相邻板块。' };
                }
            }
            if (core.usedCardIdsThisTurn.includes(cardId)) {
                return { valid: false, error: '该持有物本回合已经使用。' };
            }
            if (
                !core.turnStartInventoryCardIds.includes(cardId)
                || (core.receivedCardIdsThisTurnByPlayerId[core.currentExplorer.playerId] ?? []).includes(cardId)
            ) {
                return { valid: false, error: '本回合新获得的持有物不能立刻使用。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.USE_ROOM_EFFECT: {
            if (!canUseMysticElevator(core)) {
                return { valid: false, error: '当前房间没有可使用的房间效果。' };
            }
            return { valid: true };
        }
        case BETRAYAL_COMMANDS.TRADE_POSSESSION: {
            const cardIds = resolveTradeCardIds(core, command.payload);
            const tradeTargets = command.payload.useDog ? resolveDogTradeTargets(core) : resolveTradeTargets(core);
            const targetPlayerId = command.payload.targetPlayerId;
            if (cardIds.length === 0 || !targetPlayerId) {
                return { valid: false, error: '缺少交易对象或持有物。' };
            }
            if (command.payload.useDog && !canUseDogForTrade(core)) {
                return { valid: false, error: '当前探索者不能使用狗进行远距交易。' };
            }
            if (!cardIds.every((cardId) => core.currentExplorer.inventory.some((card) => card.id === cardId))) {
                return { valid: false, error: '当前探索者没有这件持有物。' };
            }
            if (command.payload.useDog && cardIds.some((cardId) => resolveInventoryEffectId(cardId) === 'dog')) {
                return { valid: false, error: '本回合已经使用过的持有物不能交易。' };
            }
            if (cardIds.some((cardId) => core.usedCardIdsThisTurn.includes(cardId))) {
                return { valid: false, error: '本回合已经使用过的持有物不能交易。' };
            }
            if (!tradeTargets.some((explorer) => explorer.playerId === targetPlayerId)) {
                return { valid: false, error: command.payload.useDog ? '狗只能和 4 格以内的玩家交易。' : '只能和同房间队友交易。' };
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
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return { valid: false, error: '当前没有待确认的回合结束投骰。' };
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
        case BETRAYAL_COMMANDS.LEARN_ABOUT_JACK:
        case BETRAYAL_COMMANDS.STUDY_EXORCISM:
        case BETRAYAL_COMMANDS.EXORCISE_JACK:
            return { valid: false, error: '当前还未进入 haunt 阶段。' };
        case BETRAYAL_COMMANDS.COMPLETE_SCENARIO:
            return { valid: false, error: '真实首剧本不能通过手工结算完成。' };
        default:
            return { valid: false, error: '未知运行时命令。' };
    }
}

function validateHauntAction(state: MatchState<BetrayalCore>, command: BetrayalCommand): ValidationResult {
    const core = state.core;
    if (core.phase !== 'haunt') {
        return { valid: false, error: '当前不在 haunt 阶段。' };
    }
    if (command.type === BETRAYAL_COMMANDS.USE_RABBIT_FOOT) {
        const card = resolveRabbitFootCard(core, command.payload.cardId, command.playerId);
        if (!card) {
            return { valid: false, error: '当前探索者没有兔脚。' };
        }
        if (!canUseRabbitFootForRecentRoll(core, command.playerId, card.id)) {
            return { valid: false, error: '当前没有可被兔脚重掷的最近投骰。' };
        }
        const dieIndex = command.payload.dieIndex ?? 0;
        if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= (core.recentRoll?.dice.length ?? 0)) {
            return { valid: false, error: '兔脚必须选择刚刚投过的一颗骰子。' };
        }
        return { valid: true };
    }
    const pendingTurnEndRollValidation = validateTurnEndRollAcknowledgement(core, command);
    if (pendingTurnEndRollValidation) {
        return pendingTurnEndRollValidation;
    }
    if (!isPlayersTurn(core, command.playerId)) {
        return { valid: false, error: '还没有轮到该玩家。' };
    }

    const actor = findExplorerByPlayerId(core, command.playerId);
    if (!actor) {
        return { valid: false, error: '当前行动者不存在。' };
    }
    const actorRoomId = resolveControlledRoomId(core, actor);
    const isTraitor = core.scenarioRuntime.traitorPlayerId === command.playerId;
    const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(command.playerId);

    switch (command.type) {
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM:
            if (isDead) {
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
            return { valid: false, error: 'haunt 阶段不能继续探索新房间。' };
        case BETRAYAL_COMMANDS.USE_POSSESSION:
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT:
        case BETRAYAL_COMMANDS.TRADE_POSSESSION:
        case BETRAYAL_COMMANDS.LOOT_CORPSE:
            return validatePreHauntAction({ ...state, core: { ...core, phase: 'preHaunt' } }, command);
        case BETRAYAL_COMMANDS.END_TURN:
            return { valid: true };
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL:
            return { valid: false, error: '当前没有待确认的回合结束投骰。' };
        case BETRAYAL_COMMANDS.HAUNT_ATTACK:
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
            if (command.payload.target === 'traitor') {
                const traitor = core.scenarioRuntime.traitorPlayerId
                    ? findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId)
                    : null;
                if (!traitor || traitor.roomId !== actorRoomId) {
                    return { valid: false, error: '必须和叛徒处于同一房间才能攻击。' };
                }
            }
            if (command.payload.target === 'hero') {
                const livingHeroesInRoom = getAllExplorers(core).filter((explorer) => (
                    explorer.playerId !== core.scenarioRuntime.traitorPlayerId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && explorer.roomId === actorRoomId
                ));
                if (livingHeroesInRoom.length === 0) {
                    return { valid: false, error: '当前房间没有可攻击的英雄。' };
                }
                if (!command.payload.targetPlayerId) {
                    return { valid: false, error: '必须选择要攻击的英雄。' };
                }
                if (
                    command.payload.targetPlayerId
                    && !livingHeroesInRoom.some((explorer) => explorer.playerId === command.payload.targetPlayerId)
                ) {
                    return { valid: false, error: '指定的英雄不在当前房间。' };
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
            if (core.usedCardIdsThisTurn.includes('learn-about-jack')) {
                return { valid: false, error: '本回合已经调查过杰克。' };
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
            if (core.usedCardIdsThisTurn.includes('study-exorcism')) {
                return { valid: false, error: '本回合已经研究过驱魔法阵。' };
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
            if (core.usedCardIdsThisTurn.includes('exorcise-jack')) {
                return { valid: false, error: '本回合已经尝试过驱魔。' };
            }
            return { valid: true };
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
        case BETRAYAL_COMMANDS.START_SCENARIO:
            if (core.phase !== 'characterSelect') return { valid: false, error: '当前不在角色选择阶段。' };
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
        case BETRAYAL_COMMANDS.START_SCENARIO:
            return [nowEvent(EVENTS.SCENARIO_STARTED, {
                playerIds: core.playerIds,
                scenarioId: command.payload.scenarioId ?? core.scenarioId,
            }, timestamp)];
        case BETRAYAL_COMMANDS.MOVE_TO_ROOM: {
            const room = core.rooms.find((item) => item.id === command.payload.roomId)!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const isTraitor = core.phase === 'haunt' && core.scenarioRuntime.traitorPlayerId === command.playerId;
            const isDeadTraitorSpiritTurn = shouldDeadTraitorControlJackSpirit(core, actor.playerId);
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
                    logText: `${actor.displayName}发动“Stalk the Prey”，潜行到了${room.name}`,
                }, timestamp)];
            }
            if (isDeadTraitorSpiritTurn) {
                return [nowEvent(EVENTS.EXPLORER_MOVED, {
                    playerId: command.playerId,
                    roomId: room.id,
                    controlledToken: 'jack-spirit',
                    logText: `杰克之灵游荡到了${room.name}`,
                }, timestamp)];
            }
            return [nowEvent(EVENTS.EXPLORER_MOVED, {
                playerId: command.playerId,
                roomId: room.id,
                moveCost: resolveMoveCost(core),
                logText: `${core.currentExplorer.displayName}移动到${room.name}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.EXPLORE_ROOM: {
            const explorableSlots = resolveExplorableRoomSlots(core);
            const nextSlot = command.payload.roomId
                ? explorableSlots.find((room) => room.id === command.payload.roomId) ?? explorableSlots[0]!
                : explorableSlots[0]!;
            const deckKind = resolveNextDeckKind(core)!;
            const skippedRoomTemplate = command.payload.useHolySymbol && canUseHolySymbolForDiscovery(core)
                ? resolveRoomTemplate(core, nextSlot.floor)
                : null;
            const roomTemplate = skippedRoomTemplate
                ? resolveRoomTemplateAtOffset(core, nextSlot.floor, 1)
                : resolveRoomTemplate(core, nextSlot.floor);
            const roomDiscoveryCards = resolveRoomDiscoveryCards(core, roomTemplate.discoveryEffect);
            const entryRoom = core.rooms.find((room) => room.id === core.activeRoomId);
            const entryEdge = entryRoom ? resolveDoorwayConnectionEdge(entryRoom, nextSlot.id) : null;
            const orientedRoom = orientDoorwaysToEntry(roomTemplate.doorways, entryEdge ?? nextSlot.doorways[0]?.edge ?? 'west');
            const holySymbolLogPrefix = skippedRoomTemplate
                ? `${core.currentExplorer.displayName}用圣符埋葬${skippedRoomTemplate.name}，继续发现${roomTemplate.name}；`
                : '';

            if (deckKind === 'event') {
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
                            doorways: orientedRoom.doorways,
                            backVisualId: nextSlot.backVisualId,
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
                        discovery: {
                            kind: deckKind,
                            title: eventCard.name,
                            summary: '已用雕像跳过',
                            detail: '没有抽取或结算事件卡',
                            tone: 'accent',
                        },
                        logText: `${holySymbolLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，使用雕像跳过了事件：${eventCard.name}`,
                        hauntTriggered: false,
                    }, timestamp)];
                }
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
                const materializedEventEffect = materializeEventEffect(eventEffect, random, core.currentExplorer);
                const effectLabel = formatEffectLabel(materializedEventEffect);
                const eventRollLabel = eventCard.roll
                    ? eventRollKind === 'dice'
                        ? eventCard.roll.label
                        : `${TRAIT_LABEL[eventCard.roll.trait]}检定`
                    : undefined;
                const rollLabel = eventCard.roll && eventRollTotal !== null && eventBranch
                    ? `${eventRollLabel} ${eventRollTotal}：${eventBranch.label}`
                    : undefined;
                return [nowEvent(EVENTS.ROOM_EXPLORED, {
                    playerId: command.playerId,
                    roomId: nextSlot.id,
                    room: {
                        name: roomTemplate.name,
                        hint: roomTemplate.hint,
                        tags: roomTemplate.tags,
                        discoveryReward: deckKind,
                        visualId: roomTemplate.visualId,
                        doorways: orientedRoom.doorways,
                        backVisualId: nextSlot.backVisualId,
                        discoveryEffect: roomTemplate.discoveryEffect,
                        endTurnEffect: roomTemplate.endTurnEffect,
                        enterEffect: roomTemplate.enterEffect,
                    },
                    deckKind,
                    ...roomDiscoveryCards,
                    eventEffect: materializedEventEffect,
                    eventRoll: eventCard.roll && eventRollTotal !== null && eventBranch
                        ? {
                            kind: eventRollKind,
                            trait: eventRollKind === 'dice' ? undefined : eventCard.roll.trait,
                            total: eventRollTotal,
                            label: eventBranch.label,
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
                    discovery: {
                        kind: deckKind,
                        title: eventCard.name,
                        summary: '即时生效',
                        detail: rollLabel ? `${rollLabel}；${effectLabel}` : effectLabel,
                        tone: eventEffect.mode === 'generalDamage'
                            || (eventEffect.mode !== 'none' && eventEffect.amount < 0)
                            ? 'warning'
                            : 'accent',
                    },
                    logText: `${holySymbolLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，事件：${eventCard.name}（${rollLabel ? `${rollLabel}，` : ''}${effectLabel}）`,
                    hauntTriggered: false,
                }, timestamp)];
            }

            const roomDiscoveryDrawnCard = roomDiscoveryCards.roomDiscoveryCards?.[0];
            const drawnCard = roomDiscoveryDrawnCard ?? createDrawnCard(core, deckKind);
            const regularDrawnCard = roomDiscoveryDrawnCard ? undefined : drawnCard;
            const drawnCardEffect = resolveUseEffect(drawnCard);
            const hauntRoll = resolveHauntRoll(core, deckKind, random);
            const drawnCardBaseDetail = drawnCardEffect ? formatEffectLabel(drawnCardEffect) : '按卡面规则持有';
            const drawnCardDetail = hauntRoll
                ? `${drawnCardBaseDetail}；${formatHauntRollDiscoveryDetail(hauntRoll)}`
                : drawnCardBaseDetail;
            return [nowEvent(EVENTS.ROOM_EXPLORED, {
                playerId: command.playerId,
                roomId: nextSlot.id,
                room: {
                    name: roomTemplate.name,
                    hint: roomTemplate.hint,
                    tags: roomTemplate.tags,
                    discoveryReward: deckKind,
                    visualId: roomTemplate.visualId,
                    doorways: orientedRoom.doorways,
                    backVisualId: nextSlot.backVisualId,
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
                discovery: {
                    kind: deckKind,
                    title: drawnCard.name,
                    summary: '已加入持有区',
                    detail: drawnCardDetail,
                    tone: 'accent',
                },
                logText: `${holySymbolLogPrefix}${core.currentExplorer.displayName}探索到${roomTemplate.name}，拿到了${drawnCard.name}`,
                hauntRoll: hauntRoll ?? undefined,
                hauntTriggered: hauntRoll?.triggered ?? false,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.USE_POSSESSION: {
            const card = core.currentExplorer.inventory.find((item) => item.id === command.payload.cardId);
            if (!card) {
                return [];
            }
            const effect = resolveUseEffect(card);
            if (!effect) {
                throw new Error(`possession ${card.id} has no active use effect`);
            }
            const targetExplorer = effect.mode === 'healTraits' && effect.target === 'selfOrSameRoomExplorer'
                ? (
                    command.payload.targetPlayerId === core.currentExplorer.playerId
                        ? core.currentExplorer
                        : core.otherExplorers.find((explorer) => explorer.playerId === command.payload.targetPlayerId)
                )
                : core.currentExplorer;
            const logText = effect.mode === 'move'
                ? `${core.currentExplorer.displayName}用${card.name}稳住路线，额外获得 ${effect.amount} 点移动`
                : effect.mode === 'nextNonCombatTraitReplacement'
                    ? `${core.currentExplorer.displayName}使用${card.name}，失去 ${effect.sanityCost} 点神志；本回合下一次非战斗检定可用${TRAIT_LABEL[effect.replacementTrait]}替换`
                    : effect.mode === 'healTraits'
                        ? `${core.currentExplorer.displayName}埋葬${card.name}，治疗${targetExplorer?.displayName ?? core.currentExplorer.displayName}的${effect.traits.map((trait) => TRAIT_LABEL[trait]).join('和')}`
                        : effect.mode === 'placeExplorer'
                            ? `${core.currentExplorer.displayName}埋葬${card.name}，放置到${core.rooms.find((room) => room.id === command.payload.targetRoomId)?.name ?? '目标板块'}`
                            : effect.mode === 'moveOthersInRoom'
                                ? `${core.currentExplorer.displayName}使用${card.name}，将同板块其他角色移动到${core.rooms.find((room) => room.id === command.payload.targetRoomId)?.name ?? '相邻板块'}`
                                : `${core.currentExplorer.displayName}用${card.name}调整状态，${TRAIT_LABEL[effect.trait!]} ${effect.amount > 0 ? '+' : ''}${effect.amount}`;
            return [nowEvent(EVENTS.POSSESSION_USED, {
                playerId: command.playerId,
                cardId: card.id,
                effect,
                targetPlayerId: targetExplorer?.playerId,
                targetRoomId: command.payload.targetRoomId,
                targetRoomIdsByTokenId: command.payload.targetRoomIdsByTokenId,
                logText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.USE_RABBIT_FOOT: {
            const card = resolveRabbitFootCard(core, command.payload.cardId, command.playerId)!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            const dieIndex = command.payload.dieIndex ?? 0;
            const previousPip = core.recentRoll?.dice[dieIndex] ?? 0;
            const newPip = rollBetrayalPip(random);
            const nextDice = core.recentRoll ? [...core.recentRoll.dice] : [];
            if (core.recentRoll) {
                nextDice[dieIndex] = newPip;
            }
            const nextEventBranch = core.recentRoll
                && (core.recentRoll.kind === 'eventTraitCheck' || core.recentRoll.kind === 'eventDiceRoll')
                && core.recentRoll.branchThresholds
                ? resolveEventBranch(core.recentRoll.branchThresholds, nextDice.reduce((sum, pip) => sum + pip, 0) + core.recentRoll.passiveBonus)
                : null;
            return [nowEvent(EVENTS.RABBIT_FOOT_USED, {
                playerId: command.playerId,
                cardId: card.id,
                dieIndex,
                newPip,
                eventRerollEffect: nextEventBranch ? materializeEventEffect(nextEventBranch.effect, random, core.currentExplorer) : undefined,
                logText: `${actor.displayName}使用兔脚重掷第 ${dieIndex + 1} 颗骰子：${previousPip} → ${newPip}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE: {
            const pending = core.pendingEventChoice!;
            const actor = findExplorerByPlayerId(core, command.playerId) ?? core.currentExplorer;
            if (pending.effect.mode === 'optionalHauntRoll') {
                if (!command.payload.accept || core.phase !== 'preHaunt' || core.scenarioRuntime.hauntTriggered) {
                    const traitSelectedEffect = applyChosenTraitToEffect(pending.effect.skippedOrStartedEffect, command.payload.trait);
                    const selectedEffect = applyGeneralDamageTraitsToEffect(traitSelectedEffect, command.payload.traits);
                    const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer);
                    const effectLabel = formatEffectLabel(eventEffect);
                    return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                        playerId: command.playerId,
                        sourceTitle: pending.sourceTitle,
                        accepted: false,
                        eventEffect,
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
                const dice = rollDicePips(random, resolveHauntRollTotal(core));
                const rollTotal = dice.reduce((sum, pip) => sum + pip, 0);
                const hauntTriggered = rollTotal >= core.scenarioRuntime.hauntRollThreshold;
                const hauntTraitorPlayerId = hauntTriggered
                    ? pending.effect.successTraitorSelection === 'magic-camera-owner'
                        ? resolveMagicCameraOwnerPlayerId(core) ?? command.playerId
                        : command.playerId
                    : undefined;
                const eventEffect = hauntTriggered
                    ? { mode: 'none' as const, recommendedAction: 'endTurn' as const }
                    : materializeEventEffect(pending.effect.failureEffect, random, core.currentExplorer);
                const effectLabel = hauntTriggered ? pending.effect.successLabel : formatEffectLabel(eventEffect);
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
                    eventEffect,
                    eventRoll: {
                        kind: 'dice',
                        total: rollTotal,
                        label: hauntTriggered ? pending.effect.successLabel : formatEffectLabel(pending.effect.failureEffect),
                        rollLabel: '作祟检定',
                        dice,
                        passiveBonus: 0,
                        branchThresholds: [
                            {
                                min: core.scenarioRuntime.hauntRollThreshold,
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
                        detail: `作祟检定 ${rollTotal}：${effectLabel}`,
                        tone: hauntTriggered ? 'warning' : 'accent',
                    },
                    logText: `${actor.displayName}进行作祟检定：${pending.sourceTitle}（作祟检定 ${rollTotal}，${effectLabel}）`,
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
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer);
                const effectLabel = formatEffectLabel(eventEffect);
                const rollLabel = `${TRAIT_LABEL[selectedTrait]}检定`;
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    eventRoll: {
                        kind: 'trait',
                        trait: selectedTrait,
                        total: rollTotal,
                        label: eventBranch.label,
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
                        tone: eventEffect.mode === 'generalDamage'
                            || eventEffect.mode === 'rolledDamage'
                            || (eventEffect.mode === 'trait' && eventEffect.amount < 0)
                            || (eventEffect.mode === 'chosenTrait' && eventEffect.amount < 0)
                            ? 'warning'
                            : 'accent',
                    },
                    logText: `${actor.displayName}选择${TRAIT_LABEL[selectedTrait]}：${pending.sourceTitle}（${rollLabel} ${rollTotal}，${effectLabel}）`,
                }, timestamp)];
            }
            if (pending.effect.mode === 'allTraitChecks') {
                const traitSelectedEffect = applyChosenTraitToEffect(pending.effect.allPassEffect, command.payload.trait);
                const selectedEffect = applyGeneralDamageTraitsToEffect(traitSelectedEffect, command.payload.traits);
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer);
                const effectLabel = formatEffectLabel(eventEffect);
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: '每项属性均通过',
                        detail: `每项属性均通过；${effectLabel}`,
                        tone: 'accent',
                    },
                    logText: `${actor.displayName}选择${command.payload.trait ? TRAIT_LABEL[command.payload.trait] : '任意属性'}：${pending.sourceTitle}（${effectLabel}）`,
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
                const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer);
                const effectLabel = formatEffectLabel(eventEffect);
                return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                    playerId: command.playerId,
                    sourceTitle: pending.sourceTitle,
                    accepted: true,
                    eventEffect,
                    discovery: {
                        kind: 'event',
                        title: pending.sourceTitle,
                        summary: '选择事件效果',
                        detail: effectLabel,
                        tone: eventEffect.mode === 'generalDamage'
                            || eventEffect.mode === 'rolledDamage'
                            || (eventEffect.mode === 'trait' && eventEffect.amount < 0)
                            ? 'warning'
                            : 'accent',
                    },
                    logText: `${actor.displayName}选择事件效果：${pending.sourceTitle}（${effectLabel}）`,
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
            const eventEffect = materializeEventEffect(selectedEffect, random, core.currentExplorer);
            const effectLabel = formatEffectLabel(eventEffect);
            return [nowEvent(EVENTS.EVENT_CHOICE_RESOLVED, {
                playerId: command.playerId,
                sourceTitle: pending.sourceTitle,
                accepted: true,
                eventEffect,
                eventRoll,
                discovery: {
                    kind: 'event',
                    title: pending.sourceTitle,
                    summary: pending.acceptLabel,
                    detail: `${pending.effect.roll.label} ${rollTotal}：${eventBranch.label}；${effectLabel}`,
                    tone: eventEffect.mode === 'generalDamage'
                        || eventEffect.mode === 'rolledDamage'
                        || (eventEffect.mode === 'trait' && eventEffect.amount < 0)
                        ? 'warning'
                        : 'accent',
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
            const cardIds = resolveTradeCardIds(core, command.payload);
            const cards = cardIds
                .map((cardId) => core.currentExplorer.inventory.find((item) => item.id === cardId))
                .filter((card): card is BetrayalInventoryCard => Boolean(card));
            const tradeTargets = command.payload.useDog ? resolveDogTradeTargets(core) : resolveTradeTargets(core);
            const target = tradeTargets.find((item) => item.playerId === command.payload.targetPlayerId)!;
            const dogSourceCardId = command.payload.useDog ? resolveDogTradeSourceCardId(core) ?? undefined : undefined;
            return [nowEvent(EVENTS.POSSESSION_TRADED, {
                playerId: command.playerId,
                targetPlayerId: target.playerId,
                cardId: cards[0]!.id,
                cardIds: cards.map((card) => card.id),
                sourceCardId: dogSourceCardId,
                logText: command.payload.useDog
                    ? `${core.currentExplorer.displayName}使用狗与${target.displayName}交易了${cards.map((card) => card.name).join('、')}`
                    : `${core.currentExplorer.displayName}把${cards.map((card) => card.name).join('、')}交给了${target.displayName}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.LOOT_CORPSE: {
            const corpseTargets = resolveCorpseLootTargets(core);
            const source = corpseTargets.find((item) => item.playerId === command.payload.sourcePlayerId)!;
            const card = source.inventory.find((item) => item.id === command.payload.cardId)!;
            return [nowEvent(EVENTS.CORPSE_LOOTED, {
                playerId: command.playerId,
                sourcePlayerId: source.playerId,
                cardId: card.id,
                logText: `${core.currentExplorer.displayName}从${source.displayName}的尸体上拿走了${card.name}`,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.END_TURN: {
            const roomEndTurnEffect = resolveEndTurnRoomEffect(core, random);
            const nextPlayerId = core.phase === 'haunt'
                ? rotateToNextLivingPlayer(core, core.currentPlayer)
                : (() => {
                    const explorers = getExplorersInTurnOrder(core);
                    const currentIndex = explorers.findIndex((explorer) => explorer.playerId === core.currentPlayer);
                    return (explorers[(currentIndex + 1) % explorers.length] ?? explorers[0]!).playerId;
                })();
            const nextExplorer = findExplorerByPlayerId(core, nextPlayerId) ?? core.currentExplorer;
            const previewCore = replaceExplorers(core, getExplorersInTurnOrder(core), nextExplorer.playerId);
            const monsterMovementRoll = canReviveTraitorAtMonsterTurnStart(previewCore, nextPlayerId)
                ? null
                : resolveJackSpiritMonsterMovementRoll(previewCore, nextPlayerId, random);
            const targets = resolveMoveTargetRooms(previewCore);
            const baseLogText = targets.length > 0
                ? `轮到${nextExplorer.displayName}，可前往${formatRoomTargetList(targets)}`
                : `轮到${nextExplorer.displayName}`;
            const turnLogText = monsterMovementRoll
                ? `${baseLogText}；${monsterMovementRoll.monsterName}速度 ${monsterMovementRoll.speed} 投出 ${monsterMovementRoll.total}，本回合可移动 ${monsterMovementRoll.moveAllowance} 间`
                : baseLogText;
            const shouldDeferAdvanceUntilRollAcknowledged = Boolean(
                roomEndTurnEffect?.kind === 'speedCheckFallToBasement'
                && roomEndTurnEffect.speedRollDice?.length,
            );
            const logText = roomEndTurnEffect
                ? shouldDeferAdvanceUntilRollAcknowledged
                    ? formatEndTurnRoomEffectLog(roomEndTurnEffect, core.currentExplorer.displayName)
                    : `${formatEndTurnRoomEffectLog(roomEndTurnEffect, core.currentExplorer.displayName)}；${turnLogText}`
                : turnLogText;
            return [nowEvent(EVENTS.TURN_ENDED, {
                previousPlayerId: core.currentPlayer,
                nextPlayerId,
                logText,
                roomEndTurnEffect,
                monsterMovementRoll,
                deferAdvanceUntilRollAcknowledged: shouldDeferAdvanceUntilRollAcknowledged,
                turnLogText,
            }, timestamp)];
        }
        case BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL: {
            const pendingRoll = resolvePendingTurnEndRoll(core);
            const roomEndTurn = pendingRoll?.roomEndTurn;
            if (!pendingRoll || !roomEndTurn?.nextPlayerId) {
                return [];
            }
            const nextExplorer = findExplorerByPlayerId(core, roomEndTurn.nextPlayerId);
            return [nowEvent(EVENTS.TURN_END_ROLL_ACKNOWLEDGED, {
                previousPlayerId: pendingRoll.playerId,
                nextPlayerId: roomEndTurn.nextPlayerId,
                monsterMovementRoll: roomEndTurn.monsterMovementRoll ?? null,
                logText: roomEndTurn.turnLogText
                    ?? (nextExplorer ? `轮到${nextExplorer.displayName}` : '进入下一位玩家回合'),
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
            if (!isTraitor && command.payload.target === 'traitor') {
                const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? '') ?? core.otherExplorers[0];
                const defenderTraitsBeforeDamage = traitor ? { ...traitor.traits } : undefined;
                const heroBonus = core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(attacker.playerId) ? 2 : 0;
                const attackRoll = rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = attackRoll.total + heroBonus;
                const defenderRoll = traitor ? rollAttackDefense(random, traitor, weaponEffect) : 0;
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = Math.max(0, defenderRoll - attackerRoll);
                const traitorDeathPrevention = traitor && wouldExplorerDieFromAttackDamage(traitor, damageToDefender, attackDamageKind)
                    ? rollDeathPrevention(random, traitor)
                    : null;
                const attackerDeathPrevention = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const traitorDefeated = Boolean(traitor)
                    && wouldExplorerDieFromAttackDamage(traitor, damageToDefender, attackDamageKind)
                    && !traitorDeathPrevention?.prevented;
                const attackerDefeated = wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !attackerDeathPrevention?.prevented;
                const releasedJackSpiritRoomId = resolveJackSpiritSpawnRoomId(core, attacker.roomId);
                const deathPrevention = traitorDeathPrevention
                    ? {
                        ...traitorDeathPrevention,
                        damageAmount: damageToDefender,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: defenderTraitsBeforeDamage ?? { ...traitor.traits },
                        releasedJackSpiritRoomId,
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
                    target: 'traitor',
                    defenderPlayerId: traitor?.playerId,
                    defeatedPlayerId: traitorDefeated
                        ? traitor?.playerId
                        : attackerDefeated
                            ? attacker.playerId
                            : undefined,
                    releasedJackSpiritRoomId: traitorDefeated ? releasedJackSpiritRoomId : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : traitorDefeated
                            ? 'traitor-defeated'
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
                        : traitorDefeated
                            ? `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}在对攻中击倒了叛徒，杰克之灵被释放到远处房间${deathPreventionLog}`
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
                    && explorer.roomId === attackerRoomId
                ));
                const targetHero = heroTargets.find((explorer) => explorer.playerId === command.payload.targetPlayerId);
                if (!targetHero) {
                    return [];
                }
                const defenderTraitsBeforeDamage = targetHero ? { ...targetHero.traits } : undefined;
                const attackRoll = jackSpirit
                    ? {
                        total: rollTrait(random, jackSpirit.might),
                        dice: [],
                        passiveBonus: 0,
                    }
                    : rollAttackWithDice(random, attacker, weaponEffect);
                const attackerRoll = attackRoll.total;
                const defenderBonus = jackSpirit && targetHero && core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(targetHero.playerId)
                    ? 2
                    : 0;
                const defenderRoll = targetHero ? rollAttackDefense(random, targetHero, weaponEffect) + defenderBonus : 0;
                const damageToDefender = Math.max(0, attackerRoll - defenderRoll);
                const damageToAttacker = jackSpirit ? 0 : Math.max(0, defenderRoll - attackerRoll);
                const heroDeathPrevention = targetHero && wouldExplorerDieFromAttackDamage(targetHero, damageToDefender, attackDamageKind)
                    ? rollDeathPrevention(random, targetHero)
                    : null;
                const traitorDeathPrevention = !jackSpirit && wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    ? rollDeathPrevention(random, attacker)
                    : null;
                const heroDefeated = Boolean(targetHero)
                    && wouldExplorerDieFromAttackDamage(targetHero, damageToDefender, attackDamageKind)
                    && !heroDeathPrevention?.prevented;
                const traitorDefeated = !jackSpirit
                    && wouldExplorerDieFromAttackDamage(attacker, damageToAttacker, attackDamageKind)
                    && !traitorDeathPrevention?.prevented;
                const releasedJackSpiritRoomId = resolveJackSpiritSpawnRoomId(core, attacker.roomId);
                const deathPrevention = heroDeathPrevention
                    ? {
                        ...heroDeathPrevention,
                        damageAmount: damageToDefender,
                        damageKind: attackDamageKind,
                        traitsBeforeDamage: defenderTraitsBeforeDamage ?? { ...targetHero!.traits },
                    }
                    : traitorDeathPrevention
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
                    defeatedPlayerId: heroDefeated
                        ? targetHero?.playerId
                        : traitorDefeated
                            ? attacker.playerId
                            : undefined,
                    releasedJackSpiritRoomId: traitorDefeated ? releasedJackSpiritRoomId : undefined,
                    outcome: attackerRoll === defenderRoll
                        ? 'no-damage'
                        : heroDefeated
                            ? 'hero-defeated'
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
                    attackRoll: jackSpirit
                        ? undefined
                        : {
                            id: `${attacker.playerId}-${command.payload.target}-${timestamp}`,
                            dice: attackRoll.dice,
                            passiveBonus: attackRoll.passiveBonus,
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
                        ? `${jackSpirit ? '杰克之灵' : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}`}扑向英雄，但双方对攻后都没有受伤`
                        : heroDefeated
                            ? `${jackSpirit ? '杰克之灵' : `${attacker.displayName}${weaponEffect ? `使用${weaponEffect.card.name}` : ''}`}在对攻中击倒了一名英雄${deathPreventionLog}`
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
            return {
                ...core,
                selectedExplorerByPlayerId: {
                    ...core.selectedExplorerByPlayerId,
                    [event.payload.playerId]: event.payload.explorerId,
                },
                readyPlayerIds: core.readyPlayerIds.filter((playerId) => playerId !== event.payload.playerId),
            };
        case EVENTS.EXPLORER_CONFIRMED:
            return core.readyPlayerIds.includes(event.payload.playerId)
                ? core
                : { ...core, readyPlayerIds: [...core.readyPlayerIds, event.payload.playerId] };
        case EVENTS.SCENARIO_STARTED: {
            core.scenarioId = event.payload.scenarioId;
            const scenario = scenarioConfigById(event.payload.scenarioId);
            const explorers = buildScenarioExplorers(core);
            core.scenarioRuntime = createInitialScenarioRuntimeStatus();
            ensureLibraryPresent(core);
            return replaceExplorers({
                ...core,
                phase: 'preHaunt',
                movesRemaining: 3,
                recommendedAction: 'explore',
                activeRoomId: explorers[0]?.roomId ?? core.activeRoomId,
                usedCardIdsThisTurn: [],
                receivedCardIdsThisTurnByPlayerId: {},
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(
                    replaceExplorers(core, explorers, explorers[0]?.playerId),
                    explorers[0]?.playerId,
                ),
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                activityLog: [{ id: `scenario-started-${scenario.id}`, text: scenario.logs.scenarioStarted, tone: 'accent' }],
                endgameResult: null,
            }, explorers, explorers[0]?.playerId);
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
            core.pendingEventChoice = null;
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.ROOM_EXPLORED: {
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
                targetRoom.orientationTurns = orientDoorwaysToEntry(
                    event.payload.room.doorways.map((doorway) => doorway.edge),
                    targetRoom.entryEdge,
                ).orientationTurns;
                if (!targetRoom.doorways.some((doorway) => doorway.connectsToRoomId === core.activeRoomId)) {
                    targetRoom.doorways = [
                        ...targetRoom.doorways,
                        {
                            edge: oppositeEdge(targetRoom.entryEdge),
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
            core.deckCounts[event.payload.deckKind] = Math.max(0, core.deckCounts[event.payload.deckKind] - 1);
            core.exploreIndex += event.payload.skippedRoomWithHolySymbol ? 2 : 1;
            core.highlightedDeckKind = event.payload.deckKind;
            core.latestDiscovery = { ...event.payload.discovery };
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;
            core.pendingEventChoice = null;
            if (event.payload.eventRoll?.dice?.length && event.payload.eventRoll.branchThresholds) {
                core.recentRoll = {
                    id: `${event.payload.playerId}-${event.payload.roomId}-${event.timestamp}`,
                    kind: event.payload.eventRoll.kind === 'dice' ? 'eventDiceRoll' : 'eventTraitCheck',
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.discovery.title,
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
            if (event.payload.roomDiscoveryCards?.length) {
                core.currentExplorer.inventory = [
                    ...core.currentExplorer.inventory,
                    ...event.payload.roomDiscoveryCards.map(cloneInventoryCard),
                ];
                core.deckCounts.item = Math.max(0, core.deckCounts.item - event.payload.roomDiscoveryCards.length);
            }
            if (event.payload.buriedRoomDiscoveryCards?.length) {
                core.discardCounts.item += event.payload.buriedRoomDiscoveryCards.length;
                core.deckCounts.item = Math.max(0, core.deckCounts.item - event.payload.buriedRoomDiscoveryCards.length);
            }

            if (event.payload.skippedEventWithIdol) {
                // 雕像仍消耗这次事件牌堆顺序，但不抽取、不弃置、不结算事件效果。
            } else if (event.payload.deckKind === 'event' && (
                event.payload.eventEffect?.mode === 'optionalEventRoll'
                || event.payload.eventEffect?.mode === 'optionalHauntRoll'
                || event.payload.eventEffect?.mode === 'chooseTraitRoll'
                || Boolean(
                    event.payload.eventEffect
                    && (
                        effectHasUnresolvedTraitChoice(event.payload.eventEffect)
                        || effectNeedsAdjacentRoomChoice(event.payload.eventEffect)
                        || effectNeedsRoomTargetChoice(event.payload.eventEffect)
                    )
                )
                || (
                    event.payload.eventEffect?.mode === 'allTraitChecks'
                    && Boolean(event.payload.eventEffect.results?.every((result) => result.passed))
                    && effectHasUnresolvedTraitChoice(event.payload.eventEffect.allPassEffect)
                )
            )) {
                core.discardCounts.event += 1;
                if (event.payload.eventEffect.mode === 'allTraitChecks') {
                    applyEventEffect(core, event.payload.eventEffect);
                }
                core.pendingEventChoice = {
                    id: `${event.payload.playerId}-${event.payload.roomId}-${event.timestamp}`,
                    playerId: event.payload.playerId,
                    sourceTitle: event.payload.discovery.title,
                    acceptLabel: event.payload.eventEffect.mode === 'optionalEventRoll'
                        || event.payload.eventEffect.mode === 'optionalHauntRoll'
                        ? event.payload.eventEffect.acceptLabel
                        : undefined,
                    declineLabel: event.payload.eventEffect.mode === 'optionalEventRoll'
                        || event.payload.eventEffect.mode === 'optionalHauntRoll'
                        ? event.payload.eventEffect.declineLabel
                        : undefined,
                    effect: cloneUseEffect(event.payload.eventEffect),
                };
                core.turnEndedByDiscovery = false;
            } else if (!core.turnEndedByDiscovery && event.payload.deckKind === 'event' && event.payload.eventEffect) {
                core.discardCounts.event += 1;
                const eventEffectSnapshot = applyEventEffect(core, event.payload.eventEffect);
                if (core.recentRoll) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
                core.turnEndedByDiscovery = event.payload.eventEffect.recommendedAction === 'endTurn';
            } else if (event.payload.deckKind === 'event' && event.payload.eventEffect) {
                core.discardCounts.event += 1;
                const eventEffectSnapshot = applyEventEffect(core, event.payload.eventEffect);
                if (core.recentRoll) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
                core.turnEndedByDiscovery = event.payload.eventEffect.recommendedAction === 'endTurn';
            } else if (event.payload.drawnCard) {
                core.currentExplorer.inventory = [...core.currentExplorer.inventory, cloneInventoryCard(event.payload.drawnCard)];
            }

            const synced = syncCurrentExplorerProjection(core);
            let nextCore = {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, event.payload.discovery.tone),
            };
            if (event.payload.hauntTriggered) {
                const scenario = scenarioConfigById(core.scenarioId);
                const hauntRevealerPlayerId = event.payload.playerId;
                const nextPlayerId = rotateToNextLivingPlayer(core, hauntRevealerPlayerId);
                nextCore = reduceEvent(nextCore, nowEvent(EVENTS.HAUNT_TRIGGERED, {
                    traitorPlayerId: hauntRevealerPlayerId,
                    nextPlayerId,
                    hauntCardNumber: 1,
                    hauntTriggerLabel: scenario.hauntTriggerLabel,
                    logText: scenario.logs.hauntTriggered,
                }, event.timestamp));
            }
            return nextCore;
        }
        case EVENTS.EVENT_CHOICE_RESOLVED: {
            const previousRecentRoll = core.recentRoll;
            core.pendingEventChoice = event.payload.nextPendingEventChoice
                ? {
                    ...event.payload.nextPendingEventChoice,
                    effect: cloneUseEffect(event.payload.nextPendingEventChoice.effect),
                }
                : null;
            core.latestDiscovery = { ...event.payload.discovery };
            core.latestDiscoveryOwnerPlayerId = event.payload.playerId;
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
            if (event.payload.eventEffect) {
                const eventEffectSnapshot = applyEventEffect(core, event.payload.eventEffect);
                if (core.recentRoll) {
                    core.recentRoll.eventEffectSnapshot = eventEffectSnapshot;
                }
            }
            core.turnEndedByDiscovery = event.payload.eventEffect?.recommendedAction === 'endTurn';
            const synced = syncCurrentExplorerProjection(core);
            let nextCore = {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, event.payload.discovery.tone),
            };
            if (event.payload.hauntTriggered) {
                const scenario = scenarioConfigById(core.scenarioId);
                const hauntRevealerPlayerId = event.payload.playerId;
                const hauntTraitorPlayerId = event.payload.hauntTraitorPlayerId ?? hauntRevealerPlayerId;
                const nextPlayerId = rotateToNextLivingPlayer(core, hauntRevealerPlayerId);
                nextCore = reduceEvent(nextCore, nowEvent(EVENTS.HAUNT_TRIGGERED, {
                    traitorPlayerId: hauntTraitorPlayerId,
                    hauntRevealerPlayerId,
                    nextPlayerId,
                    hauntCardNumber: event.payload.hauntCardNumber,
                    hauntTriggerLabel: event.payload.hauntTriggerLabel ?? scenario.hauntTriggerLabel,
                    logText: event.payload.hauntCardNumber && event.payload.hauntCardNumber !== 1
                        ? `作祟触发：剧本${event.payload.hauntCardNumber}（${event.payload.hauntTriggerLabel ?? event.payload.sourceTitle}）`
                        : scenario.logs.hauntTriggered,
                }, event.timestamp));
            }
            return nextCore;
        }
        case EVENTS.RABBIT_FOOT_USED: {
            const recentRoll = core.recentRoll;
            if (!recentRoll) {
                return core;
            }
            const dice = [...recentRoll.dice];
            dice[event.payload.dieIndex] = event.payload.newPip;
            const nextRoll: BetrayalRecentRollState = {
                ...recentRoll,
                dice,
                consumedRabbitFootCardIds: [...recentRoll.consumedRabbitFootCardIds, event.payload.cardId],
                lastRabbitFootRerollDieIndex: event.payload.dieIndex,
            };
            const nextTotal = resolveRecentRollTotal(nextRoll);

            if (recentRoll.kind === 'eventTraitCheck' || recentRoll.kind === 'eventDiceRoll') {
                if (!recentRoll.branchThresholds || (recentRoll.kind === 'eventTraitCheck' && !recentRoll.trait)) {
                    return core;
                }
                const nextBranch = resolveEventBranch(recentRoll.branchThresholds, nextTotal);
                const nextEffect = event.payload.eventRerollEffect ?? nextBranch.effect;
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
                            tone: 'accent',
                        };
                    }
                    const synced = syncCurrentExplorerProjection(core);
                    return {
                        ...synced,
                        recommendedAction: resolveRecommendedAction(synced),
                        activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                    };
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
                        tone: nextBranch.effect.mode === 'generalDamage'
                            || (nextBranch.effect.mode !== 'none' && nextBranch.effect.amount < 0)
                            ? 'warning'
                            : 'accent',
                    };
                }
            } else if (recentRoll.kind === 'mysticElevator') {
                const roomsBeforeRoll = recentRoll.roomsBeforeRoll?.map(cloneRoom);
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
            } else if (recentRoll.kind === 'attackRoll') {
                const attack = recentRoll.attack;
                if (!attack) {
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
                if (rerollOutcome.damageToAttacker) {
                    applyAttackDamage(attacker, rerollOutcome.damageToAttacker, attack.damageKind);
                }
                if (defender && rerollOutcome.damageToDefender) {
                    applyAttackDamage(defender, rerollOutcome.damageToDefender, attack.damageKind);
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
                    applyPhysicalDamage(explorer, roomEndTurn.previousPhysicalDamage);
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
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_USED: {
            if (event.payload.effect.mode === 'move') {
                core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + event.payload.effect.amount));
            } else if (event.payload.effect.mode === 'nextNonCombatTraitReplacement') {
                applyTraitLoss(core.currentExplorer, ['sanity'], event.payload.effect.sanityCost);
                core.nextNonCombatTraitReplacement = {
                    playerId: event.payload.playerId,
                    sourceCardId: event.payload.cardId,
                    replacementTrait: event.payload.effect.replacementTrait,
                };
            } else if (event.payload.effect.mode === 'healTraits') {
                const target = event.payload.targetPlayerId && event.payload.targetPlayerId !== core.currentExplorer.playerId
                    ? core.otherExplorers.find((explorer) => explorer.playerId === event.payload.targetPlayerId)
                    : core.currentExplorer;
                if (target) {
                    healExplorerTraitsToTemplate(target, event.payload.effect.traits);
                }
                if (event.payload.effect.consumeOnUse) {
                    core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== event.payload.cardId);
                }
            } else if (event.payload.effect.mode === 'placeExplorer') {
                const targetRoom = core.rooms.find((room) => room.id === event.payload.targetRoomId && room.state === 'discovered');
                if (targetRoom) {
                    core.currentExplorer.roomId = targetRoom.id;
                }
                if (event.payload.effect.consumeOnUse) {
                    core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== event.payload.cardId);
                }
            } else if (event.payload.effect.mode === 'moveOthersInRoom') {
                const targetRoomIdsByTokenId = event.payload.targetRoomIdsByTokenId ?? {};
                core.otherExplorers = core.otherExplorers.map((explorer) => {
                    const targetRoomId = targetRoomIdsByTokenId[explorer.playerId] ?? event.payload.targetRoomId;
                    const targetRoom = core.rooms.find((room) => room.id === targetRoomId && room.state === 'discovered');
                    return explorer.roomId === core.currentExplorer.roomId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    && targetRoom
                        ? { ...explorer, roomId: targetRoom.id }
                        : explorer;
                });
                core.monsters = core.monsters.map((monster) => {
                    const targetRoomId = targetRoomIdsByTokenId[monster.id] ?? event.payload.targetRoomId;
                    const targetRoom = core.rooms.find((room) => room.id === targetRoomId && room.state === 'discovered');
                    return monster.roomId === core.currentExplorer.roomId && targetRoom
                        ? { ...monster, roomId: targetRoom.id }
                        : monster;
                });
            } else {
                core.currentExplorer.traits[event.payload.effect.trait!] += event.payload.effect.amount;
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, event.payload.cardId];
            core.latestDiscovery = null;
            core.latestDiscoveryOwnerPlayerId = null;
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
            const roomsBeforeRoll = core.rooms.map(cloneRoom);
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
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.POSSESSION_TRADED: {
            const cardIds = event.payload.cardIds ?? [event.payload.cardId];
            const cards = cardIds
                .map((cardId) => core.currentExplorer.inventory.find((item) => item.id === cardId))
                .filter((card): card is BetrayalInventoryCard => Boolean(card));
            const target = core.otherExplorers.find((explorer) => explorer.playerId === event.payload.targetPlayerId);
            if (cards.length === 0 || !target) {
                return core;
            }
            const transferredIds = new Set(cards.map((card) => card.id));
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => !transferredIds.has(item.id));
            target.inventory = [...target.inventory, ...cards.map(cloneInventoryCard)];
            core.receivedCardIdsThisTurnByPlayerId = {
                ...core.receivedCardIdsThisTurnByPlayerId,
                [target.playerId]: Array.from(new Set([
                    ...(core.receivedCardIdsThisTurnByPlayerId[target.playerId] ?? []),
                    ...cards.map((card) => card.id),
                ])),
            };
            if (event.payload.sourceCardId) {
                core.usedCardIdsThisTurn = Array.from(new Set([
                    ...core.usedCardIdsThisTurn,
                    event.payload.sourceCardId,
                ]));
            }
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.CORPSE_LOOTED: {
            const source = core.otherExplorers.find((explorer) => explorer.playerId === event.payload.sourcePlayerId);
            const card = source?.inventory.find((item) => item.id === event.payload.cardId);
            if (!source || !card) {
                return core;
            }
            source.inventory = source.inventory.filter((item) => item.id !== card.id);
            core.currentExplorer.inventory = [...core.currentExplorer.inventory, cloneInventoryCard(card)];
            core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn = Array.from(new Set([
                ...core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn,
                source.playerId,
            ]));
            const synced = syncCurrentExplorerProjection(core);
            return {
                ...synced,
                recommendedAction: resolveRecommendedAction(synced),
                activityLog: appendActivity(synced, event.payload.logText, 'neutral'),
            };
        }
        case EVENTS.TURN_ENDED: {
            let roomEffectCore = core;
            const roomEndTurnTraitsBeforeEffect = { ...roomEffectCore.currentExplorer.traits };
            const roomEndTurnOriginalRoomId = roomEffectCore.currentExplorer.roomId;
            if (event.payload.roomEndTurnEffect?.playerId === roomEffectCore.currentExplorer.playerId) {
                if (event.payload.roomEndTurnEffect.destinationRoomId) {
                    roomEffectCore.currentExplorer.roomId = event.payload.roomEndTurnEffect.destinationRoomId;
                }
                if (event.payload.roomEndTurnEffect.physicalDamage) {
                    applyPhysicalDamage(roomEffectCore.currentExplorer, event.payload.roomEndTurnEffect.physicalDamage);
                }
                roomEffectCore = syncCurrentExplorerProjection(roomEffectCore);
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
                    recentRoll,
                    activityLog: appendActivity(synced, event.payload.logText, 'accent'),
                };
            }
            const explorers = getAllExplorers(roomEffectCore);
            const next = replaceExplorers(roomEffectCore, explorers, event.payload.nextPlayerId);
            const revived = tryReviveTraitorAtMonsterTurnStart(next, event.payload.nextPlayerId);
            const nextCore = revived.core;
            const monsterMovementRoll = !revived.revived
                && shouldDeadTraitorControlJackSpirit(nextCore, event.payload.nextPlayerId)
                ? event.payload.monsterMovementRoll ?? null
                : null;
            const nextMovesRemaining = monsterMovementRoll?.moveAllowance ?? 4;
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
                    : nextCore.recentRoll;
            return {
                ...nextCore,
                movesRemaining: nextMovesRemaining,
                recommendedAction: resolveRecommendedAction({ ...nextCore, movesRemaining: nextMovesRemaining, recentRoll }),
                usedCardIdsThisTurn: [],
                receivedCardIdsThisTurnByPlayerId: {
                    ...nextCore.receivedCardIdsThisTurnByPlayerId,
                    [event.payload.previousPlayerId]: [],
                },
                nextNonCombatTraitReplacement: null,
                turnEndedByDiscovery: false,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore, event.payload.nextPlayerId),
                scenarioRuntime: {
                    ...nextCore.scenarioRuntime,
                    corpseLootedByPlayerIdsThisTurn: [],
                    usedRoomEffectIdsThisTurn: [],
                },
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                recentRoll,
                activityLog: revived.revived
                    ? appendActivity(
                        {
                            ...nextCore,
                            scenarioRuntime: {
                                ...nextCore.scenarioRuntime,
                                corpseLootedByPlayerIdsThisTurn: [],
                                usedRoomEffectIdsThisTurn: [],
                            },
                            activityLog: appendActivity(nextCore, event.payload.logText, 'accent'),
                        },
                        '杰克之灵回到了尸体所在房间，叛徒恢复肉身并重新回到宅邸中。',
                        'warning',
                    )
                    : appendActivity(nextCore, event.payload.logText, 'accent'),
            };
        }
        case EVENTS.TURN_END_ROLL_ACKNOWLEDGED: {
            const explorers = getAllExplorers(core);
            const next = replaceExplorers(core, explorers, event.payload.nextPlayerId);
            const revived = tryReviveTraitorAtMonsterTurnStart(next, event.payload.nextPlayerId);
            const nextCore = revived.core;
            const monsterMovementRoll = !revived.revived
                && shouldDeadTraitorControlJackSpirit(nextCore, event.payload.nextPlayerId)
                ? event.payload.monsterMovementRoll ?? null
                : null;
            const nextMovesRemaining = monsterMovementRoll?.moveAllowance ?? 4;
            const resetScenarioRuntime = {
                ...nextCore.scenarioRuntime,
                corpseLootedByPlayerIdsThisTurn: [],
                usedRoomEffectIdsThisTurn: [],
            };
            const activityCore = {
                ...nextCore,
                scenarioRuntime: resetScenarioRuntime,
            };
            return {
                ...nextCore,
                movesRemaining: nextMovesRemaining,
                recommendedAction: resolveRecommendedAction({ ...nextCore, movesRemaining: nextMovesRemaining, recentRoll: null }),
                usedCardIdsThisTurn: [],
                receivedCardIdsThisTurnByPlayerId: {
                    ...nextCore.receivedCardIdsThisTurnByPlayerId,
                    [event.payload.previousPlayerId]: [],
                },
                nextNonCombatTraitReplacement: null,
                turnEndedByDiscovery: false,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore, event.payload.nextPlayerId),
                scenarioRuntime: resetScenarioRuntime,
                latestDiscovery: null,
                latestDiscoveryOwnerPlayerId: null,
                highlightedDeckKind: null,
                recentRoll: null,
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
        }
        case EVENTS.HAUNT_TRIGGERED: {
            core.phase = 'haunt';
            core.scenarioRuntime.hauntTriggered = true;
            core.scenarioRuntime.hauntRevealerPlayerId = event.payload.hauntRevealerPlayerId ?? event.payload.traitorPlayerId;
            core.scenarioRuntime.traitorPlayerId = event.payload.traitorPlayerId;
            core.scenarioRuntime.nextHauntPlayerId = event.payload.nextPlayerId;
            core.scenarioRuntime.hauntCardNumber = event.payload.hauntCardNumber ?? null;
            core.scenarioRuntime.hauntTriggerLabel = event.payload.hauntTriggerLabel;
            core.movesRemaining = 4;
            core.usedCardIdsThisTurn = [];
            core.receivedCardIdsThisTurnByPlayerId = {
                ...core.receivedCardIdsThisTurnByPlayerId,
                [event.payload.traitorPlayerId]: [],
            };
            core.nextNonCombatTraitReplacement = null;
            core.turnEndedByDiscovery = false;
            const traitor = findExplorerByPlayerId(core, event.payload.traitorPlayerId);
            if (traitor) {
                healTraitorForHaunt(traitor, core.playerIds.length);
            }
            const nextCore = replaceExplorers(core, getAllExplorers(core), event.payload.nextPlayerId);
            return {
                ...nextCore,
                currentPlayer: event.payload.nextPlayerId,
                turnStartInventoryCardIds: resolveTurnStartInventoryCardIds(nextCore, event.payload.nextPlayerId),
                recommendedAction: 'move',
                activityLog: appendActivity(nextCore, event.payload.logText, 'warning'),
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
            if (attacker && event.payload.damageToAttacker) {
                applyAttackDamage(attacker, event.payload.damageToAttacker, event.payload.damageKind ?? 'physical');
            }
            if (attacker && event.payload.weaponSpeedCost) {
                applyTraitLoss(attacker, ['speed'], event.payload.weaponSpeedCost);
            }
            if (defender && event.payload.damageToDefender) {
                applyAttackDamage(defender, event.payload.damageToDefender, event.payload.damageKind ?? 'physical');
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
                && event.payload.outcome !== 'traitor-defeated'
                && event.payload.outcome !== 'hero-defeated'
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
            if (event.payload.outcome === 'traitor-defeated' && event.payload.defeatedPlayerId) {
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
                core.monsters = [{
                    id: 'jack-spirit',
                    name: '杰克之灵',
                    portraitAsset: 'betrayal/monsters/spirit',
                    tokenAsset: 'betrayal/tokens/monsters/ghost',
                    roomId: core.scenarioRuntime.jackSpiritRoomId,
                    might: 5,
                    speed: 3,
                    damage: 1,
                }];
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
                    const traitor = findExplorerByPlayerId(core, core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer) ?? core.currentExplorer;
                    return reduceEvent(core, nowEvent(EVENTS.SCENARIO_COMPLETED, {
                        result: {
                            hauntId: 'crimson-jack-returns',
                            hauntTitle: scenarioConfigById(core.scenarioId).hauntTitle,
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
            const nextPlayerId = rotateToNextLivingPlayer(core, core.currentPlayer);
            const nextCore = replaceExplorers(core, getAllExplorers(core), nextPlayerId);
            return {
                ...nextCore,
                currentPlayer: nextPlayerId,
                recommendedAction: 'move',
                activityLog: appendActivity(nextCore, event.payload.logText, event.payload.outcome === 'hero-defeated' ? 'warning' : 'accent'),
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
            core.nextNonCombatTraitReplacement = core.nextNonCombatTraitReplacement?.playerId === event.payload.playerId
                ? null
                : core.nextNonCombatTraitReplacement;
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
                applyMentalDamage(core.currentExplorer, 2);
                if (isExplorerDead(core.currentExplorer)) {
                    markDeadExplorer(core, core.currentExplorer.playerId);
                }
            }
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'study-exorcism'];
            core.nextNonCombatTraitReplacement = core.nextNonCombatTraitReplacement?.playerId === event.payload.playerId
                ? null
                : core.nextNonCombatTraitReplacement;
            const syncedCore = syncCurrentExplorerProjection(core);
            return {
                ...syncedCore,
                recommendedAction: core.scenarioRuntime.jackSpiritReleased ? 'move' : 'endTurn',
                activityLog: appendActivity(syncedCore, event.payload.logText, event.payload.success ? 'accent' : 'warning'),
            };
        }
        case EVENTS.JACK_EXORCISED:
            core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, 'exorcise-jack'];
            core.nextNonCombatTraitReplacement = core.nextNonCombatTraitReplacement?.playerId === event.payload.playerId
                ? null
                : core.nextNonCombatTraitReplacement;
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
                        applyPhysicalDamage(explorer, 1);
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
                            hauntTitle: scenarioConfigById(core.scenarioId).hauntTitle,
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
                    hauntTitle: scenarioConfigById(core.scenarioId).hauntTitle,
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
        case EVENTS.SCENARIO_COMPLETED:
            return {
                ...core,
                phase: 'endgame',
                recommendedAction: 'endTurn',
                endgameResult: {
                    ...event.payload.result,
                    winners: [...event.payload.result.winners],
                    survivorsEscaped: [...event.payload.result.survivorsEscaped],
                    reward: { ...event.payload.result.reward },
                    stats: { ...event.payload.result.stats },
                },
                activityLog: appendActivity(core, scenarioConfigById(core.scenarioId).logs.scenarioCompleted, 'accent'),
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
    playerView: (state) => state,
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

export const engineConfig = createGameEngine<BetrayalCore, BetrayalCommand, BetrayalEvent>({
    domain: BetrayalDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 6,
    commandTypes: Object.values(BETRAYAL_COMMANDS),
});

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
