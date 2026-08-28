import type { BetrayalMonsterDefinitionId } from './domain/monsterDefinitions';

export type BetrayalTraitKey = 'might' | 'speed' | 'knowledge' | 'sanity';
export type BetrayalInventoryKind = 'item' | 'omen';
export type BetrayalDeckKind = 'event' | 'item' | 'omen';
export type BetrayalRoomDiscoverySymbol = BetrayalDeckKind | 'none';
export type BetrayalRecommendedAction = 'move' | 'explore' | 'trade' | 'use' | 'endTurn';
export type BetrayalScenarioId = 'first-scenario';
export type BetrayalScenarioCardId =
    | 'mummy-rampage'
    | 'crimson-jack-returns'
    | 'friends-forever'
    | 'free-the-realtor'
    | 'blood-from-a-stone'
    | 'inheritance'
    | 'upon-reflection';
export type BetrayalScenarioCardImplementationStatus = 'implemented' | 'runtime-supported' | 'contract-pending';
export type BetrayalScenarioOutcome = 'survivors' | 'traitor' | 'solo' | 'haunt';
export type BetrayalTraitorSelectionPolicy = 'last-explorer' | 'current-explorer';
export type BetrayalSurvivorSelectionPolicy = 'all-non-traitor' | 'current-explorer-only';
export type BetrayalRoomFloor = 'ground' | 'upper' | 'basement';
export type BetrayalRoomEdge = 'north' | 'east' | 'south' | 'west';
export type BetrayalRoomVisualId =
    | 'startTriple'
    | 'startHallway'
    | 'upperLanding'
    | 'basementLanding'
    | 'conservatory'
    | 'observatory'
    | 'tower'
    | 'statuaryCorridor'
    | 'bedroom'
    | 'study'
    | 'gallery'
    | 'entranceHall'
    | 'diningRoom'
    | 'foyer'
    | 'ballroom'
    | 'chapel'
    | 'larder'
    | 'kitchen'
    | 'laboratory'
    | 'laundryChute'
    | 'vault'
    | 'chasm'
    | 'graveyard'
    | 'panicRoom'
    | 'undergroundCavern'
    | 'ritualRoom'
    | 'undergroundLake'
    | 'catacombs'
    | 'secretStaircase'
    | 'furnaceRoom'
    | 'winterBedroom'
    | 'guestQuarters'
    | 'bloodyRoom'
    | 'library'
    | 'collapsedRoom'
    | 'junkRoom'
    | 'specimenRoom'
    | 'charredRoom'
    | 'salon'
    | 'primaryBedroom'
    | 'organRoom'
    | 'soundproofedRoom'
    | 'nursery'
    | 'operatingTheatre'
    | 'crawlspace'
    | 'gameRoom'
    | 'gymnasium'
    | 'armory'
    | 'crampedPassageway'
    | 'mysticElevator'
    | 'backUpper'
    | 'backGround'
    | 'backBasement';

export interface BetrayalRoomDoorway {
    edge: BetrayalRoomEdge;
    connectsToRoomId?: string;
    leadsToFloor?: BetrayalRoomFloor;
    note?: string;
}

export interface BetrayalInventorySeed {
    id: string;
    name: string;
    kind: BetrayalInventoryKind;
}

export interface BetrayalExplorerTraitTrackSeed {
    values: number[];
    startPosition: number;
}

export interface BetrayalExplorerCatalogEntry {
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

export interface BetrayalRoomSeed {
    id: string;
    name: string;
    floor: BetrayalRoomFloor;
    x: number;
    y: number;
    connectedRoomIds: string[];
    entryRoomId?: string;
    entryEdge?: BetrayalRoomEdge;
    orientationTurns?: 0 | 1 | 2 | 3;
    state: 'discovered' | 'unexplored';
    startingTile?: boolean;
    hint: string;
    tags: string[];
    discoveryReward: BetrayalDeckKind | null;
    visualId: BetrayalRoomVisualId;
    doorways: BetrayalRoomDoorway[];
    backVisualId: Extract<BetrayalRoomVisualId, 'backUpper' | 'backGround' | 'backBasement'>;
}

export interface BetrayalRoomDiscoveryTemplate {
    name: string;
    hint: string;
    tags: string[];
    visualId: Exclude<BetrayalRoomVisualId, 'startTriple' | 'startHallway' | 'upperLanding' | 'basementLanding' | 'entranceHall' | 'foyer' | 'backUpper' | 'backGround' | 'backBasement'>;
    discoverySymbol?: BetrayalRoomDiscoverySymbol;
    doorways: BetrayalRoomEdge[];
    discoveryEffect?: 'gainSanity1' | 'gainKnowledge1' | 'gainMight1' | 'gainSpeed1' | 'drawUntilWeapon' | 'placeObstacleToken';
    endTurnEffect?: 'physicalDamage1' | 'speedCheckFallToBasement' | 'moveToBasementLanding';
    enterEffect?: 'mysticElevator';
}

export const BETRAYAL_ROOM_DISCOVERY_SYMBOL_BY_VISUAL_ID = {
    observatory: 'omen',
    tower: 'event',
    statuaryCorridor: 'event',
    gallery: 'event',
    ballroom: 'omen',
    kitchen: 'event',
    laboratory: 'event',
    conservatory: 'omen',
    graveyard: 'omen',
    chapel: 'event',
    larder: 'none',
    diningRoom: 'event',
    laundryChute: 'none',
    vault: 'item',
    chasm: 'event',
    panicRoom: 'omen',
    undergroundCavern: 'event',
    ritualRoom: 'omen',
    undergroundLake: 'event',
    catacombs: 'omen',
    secretStaircase: 'none',
    furnaceRoom: 'event',
    winterBedroom: 'omen',
    guestQuarters: 'event',
    bloodyRoom: 'item',
    library: 'omen',
    study: 'omen',
    collapsedRoom: 'none',
    junkRoom: 'item',
    specimenRoom: 'omen',
    charredRoom: 'omen',
    salon: 'event',
    bedroom: 'omen',
    primaryBedroom: 'omen',
    organRoom: 'event',
    soundproofedRoom: 'omen',
    nursery: 'omen',
    operatingTheatre: 'item',
    crawlspace: 'event',
    gameRoom: 'item',
    gymnasium: 'none',
    armory: 'none',
    crampedPassageway: 'event',
    mysticElevator: 'none',
} as const satisfies Partial<Record<BetrayalRoomVisualId, BetrayalRoomDiscoverySymbol>>;

export function resolveBetrayalRoomDiscoverySymbol(
    room: Pick<BetrayalRoomDiscoveryTemplate, 'visualId' | 'discoverySymbol'>,
): BetrayalRoomDiscoverySymbol {
    const symbol = room.discoverySymbol ?? BETRAYAL_ROOM_DISCOVERY_SYMBOL_BY_VISUAL_ID[room.visualId];
    if (!symbol) {
        throw new Error(`Betrayal room discovery symbol missing for visualId ${room.visualId}`);
    }
    return symbol;
}

export type BetrayalUseEffectSeed =
    | {
        mode: 'none';
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'move';
        amount: number;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'trait';
        amount: number;
        trait: BetrayalTraitKey;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'chosenTrait';
        amount: number;
        allowedTraits: BetrayalTraitKey[];
        chosenTrait?: BetrayalTraitKey;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'healChosenTrait';
        allowedTraits: BetrayalTraitKey[];
        chosenTrait?: BetrayalTraitKey;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'generalDamage';
        amount: number;
        traits: BetrayalTraitKey[];
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'generalDamageChoice';
        amount: number;
        allowedTraits: BetrayalTraitKey[];
        selectedTraits?: BetrayalTraitKey[];
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'fixedDamage';
        amount: number;
        damageKind: 'physical' | 'mental';
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'rolledDamage';
        dice: number;
        rolls?: number[];
        damageKind: 'physical' | 'mental';
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'traitRoll';
        trait: BetrayalTraitKey;
        branches: BetrayalEventResultBranch[];
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'drawPossession';
        kind: BetrayalInventoryKind;
        drawnCard?: BetrayalInventorySeed;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeExplorerInRoom';
        roomId: string;
        roomName: string;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeExplorerInDiscoveredRoomByVisualId';
        visualIds: BetrayalRoomVisualId[];
        roomNames: string[];
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeExplorerInDiscoveredRoomByFloor';
        targetRoomScope:
            | 'anyDiscovered'
            | 'groundDiscovered'
            | 'basementDiscovered'
            | 'groundOrBasementDiscovered'
            | 'sameFloorDiscovered'
            | 'differentFloorDiscovered';
        requiredIfDiscoveredVisualIds?: BetrayalRoomVisualId[];
        targetRoomId?: string;
        targetRoomName?: string;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeExplorerInNextFloorStartingRoom';
        basementFallbackFloor: Extract<BetrayalRoomFloor, 'upper' | 'ground'>;
        basementFallbackDamage?: {
            amount: number;
            damageKind: 'physical' | 'mental';
        };
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeExplorerInFloorStartingRoom';
        floor: BetrayalRoomFloor;
        roomName: string;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeExplorerInAdjacentRoom';
        targetRoomId?: string;
        targetRoomName?: string;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeObstacleToken';
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeBlessingToken';
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'placeSecretPassageToken';
        targetRoomScope?: 'anyOtherDiscovered' | 'groundDiscovered' | 'basementDiscovered';
        targetRoomId?: string;
        targetRoomName?: string;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'compound';
        effects: BetrayalUseEffectSeed[];
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'optionalEffect';
        acceptLabel: string;
        declineLabel: string;
        acceptEffect: BetrayalUseEffectSeed;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'optionalItemEffect';
        acceptLabel: string;
        declineLabel: string;
        itemFilter: 'item' | 'nonWeaponItem';
        consumeAction: 'discard' | 'bury';
        selectedCardId?: string;
        selectedCardName?: string;
        acceptEffect: BetrayalUseEffectSeed;
        declineEffect: BetrayalUseEffectSeed;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'optionalEventRoll';
        acceptLabel: string;
        declineLabel: string;
        roll: {
            kind: 'dice';
            dice: number;
            label: string;
            branches: BetrayalEventResultBranch[];
        };
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'optionalHauntRoll';
        acceptLabel: string;
        declineLabel: string;
        successHauntId: number;
        successHauntTriggerLabel?: string;
        successTraitorSelection?: 'current-explorer' | 'magic-camera-owner';
        successLabel: string;
        failureEffect: BetrayalUseEffectSeed;
        skippedOrStartedEffect: BetrayalUseEffectSeed;
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'chooseTraitRoll';
        prompt: string;
        allowedTraits: BetrayalTraitKey[];
        branches: BetrayalEventResultBranch[];
        recommendedAction: BetrayalRecommendedAction;
    }
    | {
        mode: 'allTraitChecks';
        name: string;
        traits: BetrayalTraitKey[];
        passMin: number;
        failAmount: number;
        results?: {
            trait: BetrayalTraitKey;
            total: number;
            dice: number[];
            passiveBonus: number;
            passed: boolean;
        }[];
        allPassEffect: BetrayalUseEffectSeed;
        recommendedAction: BetrayalRecommendedAction;
    };

export interface BetrayalEventResultBranch {
    min: number;
    effect: BetrayalUseEffectSeed;
    label: string;
}

export interface BetrayalEventSeed {
    name: string;
    effect?: BetrayalUseEffectSeed;
    roll?: (
        | {
            kind?: 'trait';
            trait: BetrayalTraitKey;
            branches: BetrayalEventResultBranch[];
        }
        | {
            kind: 'dice';
            dice: number;
            label: string;
            branches: BetrayalEventResultBranch[];
        }
    );
}

// 当前可进入正式运行链的作祟号；这不是“50 个作祟完整完成”的口径。
export const BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS = [1, 3, 5, 12, 33] as const;
export const BETRAYAL_IMPLEMENTED_HAUNT_CARD_NUMBERS = BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS;
const BETRAYAL_OPTIONAL_HAUNT_ROLL_RUNTIME_CARD_NUMBERS = [
    ...BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS,
    7,
] as const;

export function isBetrayalHauntRuntimeSupported(hauntCardNumber: number): boolean {
    return BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS.includes(
        hauntCardNumber as typeof BETRAYAL_RUNTIME_SUPPORTED_HAUNT_CARD_NUMBERS[number],
    );
}

export function isImplementedBetrayalHauntCardNumber(hauntCardNumber: number): boolean {
    return isBetrayalHauntRuntimeSupported(hauntCardNumber);
}

export function isBetrayalOptionalHauntRollRuntimeSupported(hauntCardNumber: number): boolean {
    return BETRAYAL_OPTIONAL_HAUNT_ROLL_RUNTIME_CARD_NUMBERS.includes(
        hauntCardNumber as typeof BETRAYAL_OPTIONAL_HAUNT_ROLL_RUNTIME_CARD_NUMBERS[number],
    );
}

export function isBetrayalEventRuntimeSupported(event: BetrayalEventSeed): boolean {
    // 事件牌本身可以进入运行牌堆；未实现的作祟入口在 RESOLVE_EVENT_CHOICE
    // 和 Board 层禁用“接受作祟检定”，不再把整张事件牌排除出运行牌堆。
    return Boolean(event.name);
}

export interface BetrayalMonsterSeed {
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

export interface BetrayalScenarioRuntimePreview {
    monsters: BetrayalMonsterSeed[];
}

export interface BetrayalScenarioCompletionConfig {
    minExploreCount: number;
    outcome: BetrayalScenarioOutcome;
    traitorSelection: BetrayalTraitorSelectionPolicy;
    survivorSelection: BetrayalSurvivorSelectionPolicy;
    reward: {
        stars: number;
        logs: number;
        minimumOmens: number;
    };
}

export interface BetrayalScenarioConfig {
    id: BetrayalScenarioId;
    title: string;
    scenarioCardLabel: string;
    hauntId: BetrayalScenarioCardId;
    hauntTitle: string;
    hauntTriggerLabel: string;
    presentation: {
        runtimeObjective: string;
        hauntObjective: string;
    };
    startingInventoryByExplorerId: Record<string, BetrayalInventorySeed[]>;
    logs: {
        scenarioStarted: string;
        hauntTriggered: string;
        scenarioCompleted: string;
    };
    runtimePreview?: BetrayalScenarioRuntimePreview;
    completion: BetrayalScenarioCompletionConfig;
}

export interface BetrayalScenarioCardCandidate {
    id: BetrayalScenarioCardId;
    title: string;
    titleEn: string;
    scenarioCardLabel: string;
    triggerOmenLabel: string;
    hauntNumber: number;
    summary: string;
    summaryEn: string;
    implementationStatus: BetrayalScenarioCardImplementationStatus;
    implementedScenarioId?: BetrayalScenarioId;
    sourcePath: string;
}

export interface BetrayalHauntRevealResolution {
    scenarioCardId: BetrayalScenarioCardId;
    scenarioCardTitle: string;
    scenarioCardLabel: string;
    expectedTriggerOmenLabel: string;
    triggeringOmenId: string | null;
    triggeringOmenName: string;
    hauntCardNumber: number;
    implementationStatus: BetrayalScenarioCardImplementationStatus;
    implementedScenarioId?: BetrayalScenarioId;
    triggerMatchesScenarioCard: boolean;
    representativeOnly: boolean;
}

export const BETRAYAL_SCENARIO_CARD_CANDIDATES: readonly BetrayalScenarioCardCandidate[] = [
    {
        id: 'mummy-rampage',
        title: '木乃伊横行',
        titleEn: 'Mummy Rampage',
        scenarioCardLabel: 'Girl',
        triggerOmenLabel: '女孩',
        hauntNumber: 1,
        summary: '一名探索者倒向木乃伊。英雄必须找出真名、学会驱逐法术，并在木乃伊完成婚礼前驱逐它。',
        summaryEn: 'One explorer turns toward the mummy. Heroes must learn the true name, learn the banishment spell, and banish the mummy before the wedding is completed.',
        implementationStatus: 'implemented',
        implementedScenarioId: 'first-scenario',
        sourcePath: 'docs/games/betrayal/haunts/01-mummy-rampage.md',
    },
    {
        id: 'crimson-jack-returns',
        title: '赤红杰克归来',
        titleEn: 'Crimson Jack Returns',
        scenarioCardLabel: 'NONE',
        triggerOmenLabel: 'A Splash of Crimson',
        hauntNumber: 1,
        summary: '赤红杰克的传说重新回到山屋。一名同伴暗中背叛，英雄需要调查杰克并完成驱魔。',
        summaryEn: 'Crimson Jack returns to the house. One companion secretly betrays the group while the heroes investigate Jack and prepare an exorcism.',
        implementationStatus: 'contract-pending',
        sourcePath: 'docs/games/betrayal/haunts/01-stacked-like-cordwood-2.md',
    },
    {
        id: 'friends-forever',
        title: '永远的朋友',
        titleEn: 'Friends Forever',
        scenarioCardLabel: 'Cursed!',
        triggerOmenLabel: 'Ring',
        hauntNumber: 2,
        summary: '诅咒把友情拖进时间循环。队伍需要分清谁还可信，并打破指环带来的恶意。',
        summaryEn: 'A curse drags friendship into a time loop. The group must decide who can still be trusted and break the Ring’s malice.',
        implementationStatus: 'contract-pending',
        sourcePath: 'docs/games/betrayal/haunts/02-friends-forever.md',
    },
    {
        id: 'free-the-realtor',
        title: '释放房产经纪人',
        titleEn: 'Free the Realtor',
        scenarioCardLabel: 'For Sale',
        triggerOmenLabel: 'Dog',
        hauntNumber: 4,
        summary: '恶魔房产经纪人盯上了这座宅邸。英雄要净化房间，在交易完成前把它赶走。',
        summaryEn: 'A demonic realtor has claimed the house. Heroes must cleanse rooms and drive it out before the deal is sealed.',
        implementationStatus: 'contract-pending',
        sourcePath: 'docs/games/betrayal/haunts/04-free-the-realtor.md',
    },
    {
        id: 'blood-from-a-stone',
        title: '顽石之血',
        titleEn: 'Blood From a Stone',
        scenarioCardLabel: 'Paranormal Investigators',
        triggerOmenLabel: 'Mask',
        hauntNumber: 5,
        summary: '宅邸里的石像小天使开始移动。英雄要利用房间和视线，让石像彼此对望并全部消失。',
        summaryEn: 'Stone Cherubs begin moving through the house. Heroes must use rooms and line of sight to make the statues face each other and vanish.',
        implementationStatus: 'runtime-supported',
        implementedScenarioId: 'first-scenario',
        sourcePath: 'docs/games/betrayal/haunts/05-blood-from-a-stone.md',
    },
    {
        id: 'inheritance',
        title: '继承',
        titleEn: 'Inheritance',
        scenarioCardLabel: 'A Mysterious Invitation',
        triggerOmenLabel: 'Dagger',
        hauntNumber: 6,
        summary: '遗产背后藏着杀机。探索者要追查证据，同时提防真正的继承人露出獠牙。',
        summaryEn: 'An inheritance hides a murder plot. Explorers must uncover evidence while the true heir waits for the right moment.',
        implementationStatus: 'contract-pending',
        sourcePath: 'docs/games/betrayal/haunts/06-inheritance.md',
    },
    {
        id: 'upon-reflection',
        title: '镜中回望',
        titleEn: 'Upon Reflection',
        scenarioCardLabel: 'NONE',
        triggerOmenLabel: '怪异的镜子',
        hauntNumber: 7,
        summary: '怪异的镜子让宅邸变得不可靠。英雄需要寻找正确组合，破解镜中的诅咒。',
        summaryEn: 'The Eerie Mirror makes the house untrustworthy. Heroes must find the right combination and break the mirror curse.',
        implementationStatus: 'contract-pending',
        sourcePath: 'docs/games/betrayal/haunts/07-upon-reflection.md',
    },
] as const;

export const BETRAYAL_SCENARIO_CARD_IDS = BETRAYAL_SCENARIO_CARD_CANDIDATES
    .map((candidate) => candidate.id);

export const DEFAULT_BETRAYAL_SCENARIO_CARD_ID: BetrayalScenarioCardId = 'mummy-rampage';

const BETRAYAL_SCENARIO_CARD_BY_ID = new Map<BetrayalScenarioCardId, BetrayalScenarioCardCandidate>(
    BETRAYAL_SCENARIO_CARD_CANDIDATES.map((candidate) => [candidate.id, candidate]),
);

export function isBetrayalScenarioCardId(value: unknown): value is BetrayalScenarioCardId {
    return typeof value === 'string' && BETRAYAL_SCENARIO_CARD_BY_ID.has(value as BetrayalScenarioCardId);
}

export function getBetrayalScenarioCardCandidate(
    candidateId: BetrayalScenarioCardId,
): BetrayalScenarioCardCandidate {
    return BETRAYAL_SCENARIO_CARD_BY_ID.get(candidateId)
        ?? BETRAYAL_SCENARIO_CARD_BY_ID.get(DEFAULT_BETRAYAL_SCENARIO_CARD_ID)!;
}

export function resolveImplementedScenarioIdForCard(
    candidateId: BetrayalScenarioCardId,
): BetrayalScenarioId | undefined {
    return getBetrayalScenarioCardCandidate(candidateId).implementedScenarioId;
}

function normalizeHauntLookupLabel(label: string): string {
    return label.trim().toLocaleLowerCase();
}

function resolveScenarioCardCandidateForHauntOverride(
    fallbackCandidate: BetrayalScenarioCardCandidate,
    triggeringLabel: string,
    hauntCardNumberOverride?: number,
): BetrayalScenarioCardCandidate {
    if (hauntCardNumberOverride === undefined || fallbackCandidate.hauntNumber === hauntCardNumberOverride) {
        return fallbackCandidate;
    }
    const overrideCandidates = BETRAYAL_SCENARIO_CARD_CANDIDATES
        .filter((candidate) => candidate.hauntNumber === hauntCardNumberOverride);
    const triggerMatch = overrideCandidates.find((candidate) => (
        normalizeHauntLookupLabel(candidate.triggerOmenLabel) === normalizeHauntLookupLabel(triggeringLabel)
    ));
    if (triggerMatch) {
        return triggerMatch;
    }
    return overrideCandidates.length === 1 ? overrideCandidates[0]! : fallbackCandidate;
}

export function resolveBetrayalHauntRevealResolution({
    scenarioCardId,
    triggeringOmen,
    hauntCardNumberOverride,
}: {
    scenarioCardId?: BetrayalScenarioCardId | null;
    triggeringOmen?: { id?: string | null; name?: string | null } | null;
    hauntCardNumberOverride?: number;
}): BetrayalHauntRevealResolution {
    const candidate = scenarioCardId && isBetrayalScenarioCardId(scenarioCardId)
        ? getBetrayalScenarioCardCandidate(scenarioCardId)
        : getBetrayalScenarioCardCandidate(DEFAULT_BETRAYAL_SCENARIO_CARD_ID);
    const triggeringOmenName = triggeringOmen?.name?.trim() || candidate.triggerOmenLabel;
    const resolvedCandidate = resolveScenarioCardCandidateForHauntOverride(
        candidate,
        triggeringOmenName,
        hauntCardNumberOverride,
    );
    const hauntCardNumber = hauntCardNumberOverride ?? resolvedCandidate.hauntNumber;
    const triggerMatchesScenarioCard = normalizeHauntLookupLabel(triggeringOmenName)
        === normalizeHauntLookupLabel(resolvedCandidate.triggerOmenLabel)
        && hauntCardNumber === resolvedCandidate.hauntNumber;

    return {
        scenarioCardId: resolvedCandidate.id,
        scenarioCardTitle: resolvedCandidate.title,
        scenarioCardLabel: resolvedCandidate.scenarioCardLabel,
        expectedTriggerOmenLabel: resolvedCandidate.triggerOmenLabel,
        triggeringOmenId: triggeringOmen?.id ?? null,
        triggeringOmenName,
        hauntCardNumber,
        implementationStatus: resolvedCandidate.implementationStatus,
        implementedScenarioId: resolvedCandidate.implementedScenarioId,
        triggerMatchesScenarioCard,
        representativeOnly: resolvedCandidate.implementationStatus !== 'implemented' || !triggerMatchesScenarioCard,
    };
}

const BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME = '无特殊能力';
const BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT = '基础版角色背景不改变规则；开局按角色卡属性轨放置夹子。';

export const BETRAYAL_EXPLORER_CATALOG: BetrayalExplorerCatalogEntry[] = [
    {
        explorerId: 'isa-valencia',
        displayName: '伊莎·瓦伦西亚',
        portraitAsset: 'betrayal/explorers/xia',
        tokenAsset: 'betrayal/tokens/explorers/isa-valencia',
        color: '#d0a23e',
        traits: { might: 3, speed: 5, knowledge: 4, sanity: 4 },
        traitTracks: {
            might: { values: [2, 3, 3, 4, 4, 5, 6, 7], startPosition: 1 },
            speed: { values: [4, 4, 5, 5, 6, 7, 8, 8], startPosition: 2 },
            knowledge: { values: [2, 3, 3, 4, 4, 5, 6, 6], startPosition: 3 },
            sanity: { values: [2, 3, 4, 5, 6, 7, 7, 8], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'anita-hernandez',
        displayName: '安妮塔·赫南德兹',
        portraitAsset: 'betrayal/explorers/anita-hernandez',
        tokenAsset: 'betrayal/tokens/explorers/anita-hernandez',
        color: '#d9b23f',
        traits: { might: 4, speed: 4, knowledge: 5, sanity: 3 },
        traitTracks: {
            might: { values: [2, 2, 3, 4, 5, 6, 7], startPosition: 3 },
            speed: { values: [2, 3, 4, 4, 5, 6, 7, 8], startPosition: 2 },
            knowledge: { values: [4, 4, 5, 5, 7, 8, 8], startPosition: 2 },
            sanity: { values: [2, 2, 3, 4, 5, 5, 6, 6], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'father-warren-leung',
        displayName: '神父 梁沃伦',
        portraitAsset: 'betrayal/explorers/father-warren-leung',
        tokenAsset: 'betrayal/tokens/explorers/father-warren-leung',
        color: '#c8d0d2',
        traits: { might: 3, speed: 4, knowledge: 4, sanity: 5 },
        traitTracks: {
            might: { values: [2, 2, 3, 3, 4, 5, 6, 6], startPosition: 2 },
            speed: { values: [2, 3, 4, 4, 5, 5, 6, 6], startPosition: 2 },
            knowledge: { values: [3, 3, 4, 5, 5, 6, 7, 8], startPosition: 2 },
            sanity: { values: [3, 3, 5, 5, 6, 6, 8, 8], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'dan-nguyen-md',
        displayName: '阮单 医学博士',
        portraitAsset: 'betrayal/explorers/dan-nguyen-md',
        tokenAsset: 'betrayal/tokens/explorers/dan-nguyen-md',
        color: '#d8dce0',
        traits: { might: 4, speed: 3, knowledge: 5, sanity: 4 },
        traitTracks: {
            might: { values: [3, 3, 4, 4, 5, 5, 6, 7], startPosition: 2 },
            speed: { values: [2, 3, 3, 4, 4, 5, 6, 7], startPosition: 1 },
            knowledge: { values: [3, 3, 4, 5, 5, 6, 7, 8], startPosition: 3 },
            sanity: { values: [2, 3, 4, 4, 5, 5, 6, 8], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'michelle-monroe',
        displayName: '米歇尔·梦露',
        portraitAsset: 'betrayal/explorers/michelle-monroe',
        tokenAsset: 'betrayal/tokens/explorers/michelle-monroe',
        color: '#b45ca3',
        traits: { might: 5, speed: 4, knowledge: 4, sanity: 3 },
        traitTracks: {
            might: { values: [2, 3, 4, 5, 5, 6, 7, 8], startPosition: 3 },
            speed: { values: [2, 3, 4, 4, 5, 6, 7, 8], startPosition: 2 },
            knowledge: { values: [2, 3, 3, 4, 5, 6, 7, 8], startPosition: 3 },
            sanity: { values: [2, 2, 3, 4, 4, 5, 6, 6], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'beat-box-bowen',
        displayName: '布里塔妮 “B-BOX” 鲍温',
        portraitAsset: 'betrayal/explorers/beat-box-bowen',
        tokenAsset: 'betrayal/tokens/explorers/beat-box-bowen',
        color: '#b23f8a',
        traits: { might: 5, speed: 3, knowledge: 4, sanity: 4 },
        traitTracks: {
            might: { values: [3, 3, 5, 5, 6, 7, 7, 8], startPosition: 2 },
            speed: { values: [2, 3, 3, 4, 4, 5, 6, 6], startPosition: 1 },
            knowledge: { values: [3, 3, 4, 5, 5, 6, 6, 7], startPosition: 2 },
            sanity: { values: [3, 3, 4, 5, 5, 6, 6, 7], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'josef-hooper',
        displayName: '约瑟夫 “铁子” 霍珀',
        portraitAsset: 'betrayal/explorers/josef-hooper',
        tokenAsset: 'betrayal/tokens/explorers/josef-hooper',
        color: '#c85045',
        traits: { might: 5, speed: 4, knowledge: 3, sanity: 4 },
        traitTracks: {
            might: { values: [4, 4, 5, 5, 6, 7, 8, 8], startPosition: 2 },
            speed: { values: [2, 3, 4, 4, 5, 6, 7, 8], startPosition: 2 },
            knowledge: { values: [2, 2, 3, 3, 5, 5, 6, 6], startPosition: 2 },
            sanity: { values: [2, 2, 3, 4, 5, 5, 6, 6], startPosition: 3 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'oliver-swift',
        displayName: '奥利弗·斯威夫特',
        portraitAsset: 'betrayal/explorers/oliver-swift',
        tokenAsset: 'betrayal/tokens/explorers/oliver-swift',
        color: '#d0603f',
        traits: { might: 4, speed: 5, knowledge: 4, sanity: 3 },
        traitTracks: {
            might: { values: [3, 3, 4, 5, 5, 6, 7], startPosition: 2 },
            speed: { values: [3, 4, 5, 5, 6, 7, 7, 8], startPosition: 2 },
            knowledge: { values: [3, 3, 4, 5, 6, 6, 7], startPosition: 2 },
            sanity: { values: [2, 3, 3, 4, 5, 5, 6, 7], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'stephanie-richter',
        displayName: '斯蒂芬妮·里克特',
        portraitAsset: 'betrayal/explorers/stephanie-richter',
        tokenAsset: 'betrayal/tokens/explorers/stephanie-richter',
        color: '#3699d3',
        traits: { might: 4, speed: 3, knowledge: 4, sanity: 5 },
        traitTracks: {
            might: { values: [2, 3, 4, 5, 5, 6, 6], startPosition: 2 },
            speed: { values: [2, 3, 3, 4, 5, 5, 6, 7], startPosition: 1 },
            knowledge: { values: [2, 3, 3, 4, 4, 5, 6, 6], startPosition: 3 },
            sanity: { values: [4, 4, 5, 5, 6, 7, 8, 8], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'persephone-puleri',
        displayName: '珀尔塞福涅·普拉里',
        portraitAsset: 'betrayal/explorers/persephone-puleri',
        tokenAsset: 'betrayal/tokens/explorers/persephone-puleri',
        color: '#478bbf',
        traits: { might: 4, speed: 4, knowledge: 3, sanity: 5 },
        traitTracks: {
            might: { values: [3, 3, 4, 5, 5, 6, 6, 7], startPosition: 2 },
            speed: { values: [3, 3, 4, 5, 5, 6, 7, 8], startPosition: 2 },
            knowledge: { values: [2, 3, 3, 4, 5, 6, 6, 7], startPosition: 1 },
            sanity: { values: [3, 3, 4, 5, 6, 7, 8, 8], startPosition: 3 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'sammy-angler',
        displayName: '塞米·昂勒尔',
        portraitAsset: 'betrayal/explorers/sammy-angler',
        tokenAsset: 'betrayal/tokens/explorers/sammy-angler',
        color: '#719d4a',
        traits: { might: 4, speed: 5, knowledge: 3, sanity: 4 },
        traitTracks: {
            might: { values: [3, 3, 4, 4, 5, 6, 8], startPosition: 2 },
            speed: { values: [2, 3, 4, 5, 5, 6, 7, 8], startPosition: 3 },
            knowledge: { values: [2, 2, 3, 3, 4, 6, 7, 8], startPosition: 2 },
            sanity: { values: [2, 3, 3, 4, 5, 6, 6, 7], startPosition: 3 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
    {
        explorerId: 'jaden-jones',
        displayName: '杰登·琼斯',
        portraitAsset: 'betrayal/explorers/jade-jones',
        tokenAsset: 'betrayal/tokens/explorers/jaden-jones',
        color: '#8cc63f',
        traits: { might: 3, speed: 4, knowledge: 5, sanity: 4 },
        traitTracks: {
            might: { values: [2, 3, 3, 4, 4, 5, 6, 7], startPosition: 1 },
            speed: { values: [3, 4, 4, 5, 5, 6, 7, 8], startPosition: 1 },
            knowledge: { values: [3, 3, 4, 5, 5, 6, 6, 7], startPosition: 3 },
            sanity: { values: [3, 3, 4, 5, 5, 6, 7, 8], startPosition: 2 },
        },
        abilityName: BETRAYAL_NO_EXPLORER_RULE_ABILITY_NAME,
        abilityText: BETRAYAL_NO_EXPLORER_RULE_ABILITY_TEXT,
    },
];

export const BETRAYAL_SHARED_PRE_HAUNT_SETUP = {
    explorerStartTileId: 'entrance-hall',
    initialDeckCounts: {
        omen: 9,
        item: 22,
        event: 43,
    } satisfies Record<BetrayalDeckKind, number>,
    startingRoomLayout: [
        {
            id: 'upper-landing',
            name: '上层起始点',
            floor: 'upper',
            x: 2,
            y: 1,
            connectedRoomIds: ['grand-staircase', 'upper-west', 'upper-north'],
            state: 'discovered',
            startingTile: true,
            hint: '上层起始连接位',
            tags: ['起始', '上层'],
            discoveryReward: null,
            visualId: 'upperLanding',
            backVisualId: 'backUpper',
            doorways: [
                { edge: 'north', connectsToRoomId: 'upper-north' },
                { edge: 'west', connectsToRoomId: 'upper-west' },
                { edge: 'east', connectsToRoomId: 'grand-staircase', leadsToFloor: 'ground', note: '通向 Ground Floor Staircase' },
            ],
        },
        {
            id: 'upper-west',
            name: '未探索',
            floor: 'upper',
            x: 1,
            y: 1,
            connectedRoomIds: ['upper-landing'],
            state: 'unexplored',
            hint: '等待翻出上层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backUpper',
            backVisualId: 'backUpper',
            doorways: [
                { edge: 'east', connectsToRoomId: 'upper-landing' },
            ],
        },
        {
            id: 'upper-north',
            name: '未探索',
            floor: 'upper',
            x: 2,
            y: 0,
            connectedRoomIds: ['upper-landing'],
            state: 'unexplored',
            hint: '等待翻出上层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backUpper',
            backVisualId: 'backUpper',
            doorways: [
                { edge: 'south', connectsToRoomId: 'upper-landing' },
            ],
        },
        {
            id: 'grand-staircase',
            name: '大阶梯',
            floor: 'ground',
            x: 2,
            y: 2,
            connectedRoomIds: ['upper-landing', 'hallway', 'basement-landing'],
            state: 'discovered',
            startingTile: true,
            hint: '宅邸中央的楼梯间',
            tags: ['起始', '连接'],
            discoveryReward: null,
            visualId: 'startTriple',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'north', connectsToRoomId: 'upper-landing', leadsToFloor: 'upper', note: '通向 Upper Landing' },
                { edge: 'east', connectsToRoomId: 'hallway' },
                { edge: 'south', connectsToRoomId: 'basement-landing', leadsToFloor: 'basement', note: '通向 Basement Landing' },
            ],
        },
        {
            id: 'hallway',
            name: '门厅',
            floor: 'ground',
            x: 3,
            y: 2,
            connectedRoomIds: ['grand-staircase', 'entrance-hall', 'ground-north', 'ground-south'],
            state: 'discovered',
            startingTile: true,
            hint: '连接前厅与楼梯的长廊',
            tags: ['起始', '走廊'],
            discoveryReward: null,
            visualId: 'startHallway',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'west', connectsToRoomId: 'grand-staircase' },
                { edge: 'east', connectsToRoomId: 'entrance-hall' },
                { edge: 'north', connectsToRoomId: 'ground-north' },
                { edge: 'south', connectsToRoomId: 'ground-south' },
            ],
        },
        {
            id: 'entrance-hall',
            name: '入口大厅',
            floor: 'ground',
            x: 4,
            y: 2,
            connectedRoomIds: ['hallway', 'ground-east'],
            state: 'discovered',
            startingTile: true,
            hint: '进入宅邸后的起始入口',
            tags: ['起始', '入口'],
            discoveryReward: null,
            visualId: 'startTriple',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'west', connectsToRoomId: 'hallway' },
                { edge: 'east', connectsToRoomId: 'ground-east' },
            ],
        },
        {
            id: 'ground-north',
            name: '未探索',
            floor: 'ground',
            x: 3,
            y: 1,
            connectedRoomIds: ['hallway'],
            state: 'unexplored',
            hint: '等待翻出一层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backGround',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'south', connectsToRoomId: 'hallway' },
            ],
        },
        {
            id: 'ground-south',
            name: '未探索',
            floor: 'ground',
            x: 3,
            y: 3,
            connectedRoomIds: ['hallway'],
            state: 'unexplored',
            hint: '等待翻出一层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backGround',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'north', connectsToRoomId: 'hallway' },
            ],
        },
        {
            id: 'ground-east',
            name: '未探索',
            floor: 'ground',
            x: 5,
            y: 2,
            connectedRoomIds: ['entrance-hall'],
            state: 'unexplored',
            hint: '等待翻出一层房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backGround',
            backVisualId: 'backGround',
            doorways: [
                { edge: 'west', connectsToRoomId: 'entrance-hall' },
            ],
        },
        {
            id: 'basement-landing',
            name: '地下室起始点',
            floor: 'basement',
            x: 2,
            y: 3,
            connectedRoomIds: ['grand-staircase', 'basement-east', 'basement-south'],
            state: 'discovered',
            startingTile: true,
            hint: '地下入口，通向更深处',
            tags: ['起始', '地下'],
            discoveryReward: null,
            visualId: 'basementLanding',
            backVisualId: 'backBasement',
            doorways: [
                { edge: 'north', connectsToRoomId: 'grand-staircase', leadsToFloor: 'ground', note: '与 Ground Floor Staircase 特殊相邻' },
                { edge: 'east', connectsToRoomId: 'basement-east' },
                { edge: 'south', connectsToRoomId: 'basement-south' },
            ],
        },
        {
            id: 'basement-east',
            name: '未探索',
            floor: 'basement',
            x: 3,
            y: 3,
            connectedRoomIds: ['basement-landing'],
            state: 'unexplored',
            hint: '等待翻出地下房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backBasement',
            backVisualId: 'backBasement',
            doorways: [
                { edge: 'west', connectsToRoomId: 'basement-landing' },
            ],
        },
        {
            id: 'basement-south',
            name: '未探索',
            floor: 'basement',
            x: 2,
            y: 4,
            connectedRoomIds: ['basement-landing'],
            state: 'unexplored',
            hint: '等待翻出地下房间',
            tags: ['待翻出'],
            discoveryReward: null,
            visualId: 'backBasement',
            backVisualId: 'backBasement',
            doorways: [
                { edge: 'north', connectsToRoomId: 'basement-landing' },
            ],
        },
    ] satisfies BetrayalRoomSeed[],
};

export const BETRAYAL_DISCOVERY_POOLS = {
    drawOrder: ['event', 'item', 'omen'] as BetrayalDeckKind[],
    possessions: {
        item: [
            { id: 'camera', name: '魔法相机', kind: 'item' },
            { id: 'scary-doll', name: '恐怖玩偶', kind: 'item' },
            { id: 'medical-kit', name: '急救包', kind: 'item' },
            { id: 'mirror', name: '镜子', kind: 'item' },
            { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            { id: 'lucky-coin', name: '幸运硬币', kind: 'item' },
            { id: 'leather-jacket', name: '皮夹克', kind: 'item' },
            { id: 'tooth-necklace', name: '牙齿项链', kind: 'item' },
            { id: 'flashlight', name: '手电筒', kind: 'item' },
            { id: 'radio', name: '头戴耳机', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'strange-amulet', name: '奇异护符', kind: 'item' },
            { id: 'brooch', name: '胸针', kind: 'item' },
            { id: 'gun', name: '枪', kind: 'item' },
            { id: 'crossbow', name: '十字弓', kind: 'item' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' },
            { id: 'mysterious-stopwatch', name: '神秘秒表', kind: 'item' },
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
            { id: 'chainsaw', name: '电锯', kind: 'item' },
            { id: 'dynamite', name: '炸药', kind: 'item' },
            { id: 'angel-feather', name: '天使之羽', kind: 'item' },
        ],
        omen: [
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
            { id: 'armor', name: '盔甲', kind: 'omen' },
            { id: 'idol', name: '雕像', kind: 'omen' },
            { id: 'ring', name: '指环', kind: 'omen' },
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ],
    } satisfies Record<Exclude<BetrayalDeckKind, 'event'>, BetrayalInventorySeed[]>,
    roomDiscoveryByFloor: {
        ground: [
            {
                name: '观测台',
                hint: '一层观测房间，中央器械让视线与路线都更紧张',
                tags: ['一层', '观察'],
                visualId: 'observatory',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '温室',
                hint: '玻璃与藤蔓围住的一层房间，适合制造视线遮挡',
                tags: ['一层', '植物'],
                visualId: 'conservatory',
                discoverySymbol: 'omen',
                doorways: ['north', 'south'],
            },
            {
                name: '墓园',
                hint: '通向地下洞窟的室外墓地，适合承接追逐与怪物线',
                tags: ['一层', '室外'],
                visualId: 'graveyard',
                discoverySymbol: 'omen',
                doorways: ['north', 'east'],
            },
            {
                name: '舞厅',
                hint: '宽敞的一层房间，适合会合与周旋',
                tags: ['会合', '开阔'],
                visualId: 'ballroom',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '厨房',
                hint: '食物和器具堆在一层，是事件与物品都可能发生的房间',
                tags: ['一层', '物资'],
                visualId: 'kitchen',
                discoverySymbol: 'event',
                doorways: ['north', 'south'],
            },
            {
                name: '餐厅',
                hint: '长桌和阴影形成一层交汇点',
                tags: ['一层', '会合'],
                visualId: 'diningRoom',
                discoverySymbol: 'event',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '礼拜堂',
                hint: '冷清肃穆，像在等待一件不该发生的事',
                tags: ['神秘', '静压'],
                visualId: 'chapel',
                discoverySymbol: 'event',
                doorways: ['north', 'south', 'west'],
                discoveryEffect: 'gainSanity1',
            },
            {
                name: '实验室',
                hint: '仪器和试剂暗示这里会触发危险事件',
                tags: ['一层', '危险'],
                visualId: 'laboratory',
                discoverySymbol: 'event',
                doorways: ['north', 'east'],
            },
            {
                name: '金库',
                hint: '一层封闭房间，适合放置剧本物件和高价值目标',
                tags: ['一层', '目标'],
                visualId: 'vault',
                discoverySymbol: 'item',
                doorways: ['north'],
            },
            {
                name: '火炉房',
                hint: '炙热房间会改变移动与伤害判断',
                tags: ['一层', '危险'],
                visualId: 'furnaceRoom',
                discoverySymbol: 'event',
                doorways: ['east', 'south', 'west'],
                endTurnEffect: 'physicalDamage1',
            },
            {
                name: '客房',
                hint: '卧室类房间，后续剧本可作为特定目标房间',
                tags: ['一层', '上层', '卧室'],
                visualId: 'guestQuarters',
                discoverySymbol: 'event',
                doorways: ['north', 'east'],
            },
            {
                name: '血腥房间',
                hint: '血迹房间适合承接死亡、搜查和剧本标记',
                tags: ['一层', '上层', '危险'],
                visualId: 'bloodyRoom',
                discoverySymbol: 'item',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '标本室',
                hint: '标本和柜架让这里适合触发异常事件',
                tags: ['一层', '事件'],
                visualId: 'specimenRoom',
                discoverySymbol: 'omen',
                doorways: ['east', 'south', 'west'],
            },
            {
                name: '沙龙',
                hint: '桌椅和壁炉形成可会合的房间',
                tags: ['一层', '会合'],
                visualId: 'salon',
                discoverySymbol: 'event',
                doorways: ['north', 'east'],
            },
            {
                name: '主卧',
                hint: '卧室类核心房间，适合后续剧本定位',
                tags: ['一层', '上层', '卧室'],
                visualId: 'primaryBedroom',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '育婴室',
                hint: '狭窄房间，适合触发事件和剧本特殊物件',
                tags: ['一层', '上层', '事件'],
                visualId: 'nursery',
                discoverySymbol: 'omen',
                doorways: ['north', 'east'],
            },
            {
                name: '手术室',
                hint: '危险的治疗房间，适合承接身体伤害事件',
                tags: ['一层', '地下', '危险'],
                visualId: 'operatingTheatre',
                discoverySymbol: 'item',
                doorways: ['north', 'east'],
            },
            {
                name: '器械库',
                hint: '武器与道具集中，适合物品奖励',
                tags: ['一层', '物品'],
                visualId: 'armory',
                discoverySymbol: 'none',
                doorways: ['north', 'east', 'south'],
                discoveryEffect: 'drawUntilWeapon',
            },
        ],
        upper: [
            {
                name: '塔楼',
                hint: '上层塔楼，边缘路线和高度感会影响移动判断',
                tags: ['上层', '高处'],
                visualId: 'tower',
                discoverySymbol: 'event',
                doorways: ['north', 'south'],
            },
            {
                name: '雕像走廊',
                hint: '上层走廊，适合连接多个房间',
                tags: ['上层', '走廊'],
                visualId: 'statuaryCorridor',
                discoverySymbol: 'event',
                doorways: ['north', 'south'],
            },
            {
                name: '书房',
                hint: '书桌和卷宗让这里成为调查线索的房间',
                tags: ['知识', '调查'],
                visualId: 'study',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south', 'west'],
                discoveryEffect: 'gainKnowledge1',
            },
            {
                name: '长廊',
                hint: '细长上层通道，容易观察别处动静',
                tags: ['视野', '走位'],
                visualId: 'gallery',
                discoverySymbol: 'event',
                doorways: ['north', 'south'],
            },
            {
                name: '图书馆',
                hint: '成排旧书和破纸页，是找知识的地方',
                tags: ['知识', '调查'],
                visualId: 'library',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south', 'west'],
                discoveryEffect: 'gainKnowledge1',
            },
            {
                name: '冬季卧室',
                hint: '卧室类上层房间，后续剧本可作为目标地点',
                tags: ['上层', '卧室'],
                visualId: 'winterBedroom',
                discoverySymbol: 'omen',
                doorways: ['north', 'east'],
            },
            {
                name: '倒塌房间',
                hint: '结构破损会影响离开与坠落判断',
                tags: ['上层', '危险'],
                visualId: 'collapsedRoom',
                discoverySymbol: 'none',
                doorways: ['north', 'east'],
                endTurnEffect: 'speedCheckFallToBasement',
            },
            {
                name: '烧焦房间',
                hint: '火焰痕迹明确，适合承接火焰类剧本规则',
                tags: ['上层', '危险'],
                visualId: 'charredRoom',
                discoverySymbol: 'omen',
                doorways: ['north', 'east'],
            },
            {
                name: '管风琴室',
                hint: '上层仪式感房间，适合声音与精神事件',
                tags: ['上层', '精神'],
                visualId: 'organRoom',
                discoverySymbol: 'event',
                doorways: ['east', 'south', 'west'],
            },
            {
                name: '隔音室',
                hint: '封闭空间，适合特殊事件和阻隔效果',
                tags: ['上层', '封闭'],
                visualId: 'soundproofedRoom',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south'],
            },
            {
                name: '游戏室',
                hint: '娱乐桌面房间，适合物品和事件交汇',
                tags: ['上层', '事件'],
                visualId: 'gameRoom',
                discoverySymbol: 'item',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '体育馆',
                hint: '开阔空间，适合速度与力量检定',
                tags: ['上层', '力量'],
                visualId: 'gymnasium',
                discoverySymbol: 'none',
                doorways: ['north', 'east', 'south', 'west'],
                discoveryEffect: 'gainSpeed1',
            },
            {
                name: '狭窄通道',
                hint: '通道型房间，主要承担路线连接',
                tags: ['上层', '通道'],
                visualId: 'crampedPassageway',
                discoverySymbol: 'event',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '神秘电梯',
                hint: '可连接任意楼层的特殊移动房间',
                tags: ['上层', '地下', '特殊移动'],
                visualId: 'mysticElevator',
                discoverySymbol: 'none',
                doorways: ['north'],
                enterEffect: 'mysticElevator',
            },
        ],
        basement: [
            {
                name: '洗衣滑槽',
                hint: '通向地下室起始点的特殊竖向连接',
                tags: ['上层', '地下', '特殊移动'],
                visualId: 'laundryChute',
                discoverySymbol: 'none',
                doorways: ['north'],
                endTurnEffect: 'moveToBasementLanding',
            },
            {
                name: '裂隙',
                hint: '地下危险地形，后续剧本可能要求丢弃或搬运物体',
                tags: ['地下', '危险'],
                visualId: 'chasm',
                discoverySymbol: 'event',
                doorways: ['north', 'south'],
            },
            {
                name: '储物间',
                hint: '堆满旧箱和杂物，翻找起来最像物品点',
                tags: ['物资', '翻找'],
                visualId: 'larder',
                discoverySymbol: 'none',
                doorways: ['north', 'west'],
                discoveryEffect: 'gainMight1',
            },
            {
                name: '地下湖',
                hint: '黑水切开地下空间，移动时必须考虑绕行',
                tags: ['地下', '水域'],
                visualId: 'undergroundLake',
                discoverySymbol: 'event',
                doorways: ['north', 'east'],
            },
            {
                name: '地下洞窟',
                hint: '粗糙岩壁和阴影让这里更像怪物出没处',
                tags: ['地下', '危险'],
                visualId: 'undergroundCavern',
                discoverySymbol: 'event',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '仪式室',
                hint: '看得出有人在这里做过不该做的准备',
                tags: ['仪式', '危险'],
                visualId: 'ritualRoom',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'west'],
            },
            {
                name: '地下墓穴',
                hint: '狭长墓道适合让追逐和围堵成立',
                tags: ['地下', '墓穴'],
                visualId: 'catacombs',
                discoverySymbol: 'omen',
                doorways: ['north', 'east', 'south', 'west'],
            },
            {
                name: '密道楼梯',
                hint: '地下到一层的特殊连接房间',
                tags: ['地下', '特殊移动'],
                visualId: 'secretStaircase',
                discoverySymbol: 'none',
                doorways: ['north'],
            },
            {
                name: '杂物间',
                hint: '地下杂物房，适合放置障碍或物件',
                tags: ['地下', '物品'],
                visualId: 'junkRoom',
                discoverySymbol: 'item',
                doorways: ['north', 'east', 'south'],
                discoveryEffect: 'placeObstacleToken',
            },
            {
                name: '爬行空间',
                hint: '狭窄地下通路，适合限制移动',
                tags: ['地下', '通道'],
                visualId: 'crawlspace',
                discoverySymbol: 'event',
                doorways: ['north', 'east', 'west'],
            },
        ],
    } satisfies Record<BetrayalRoomSeed['floor'], BetrayalRoomDiscoveryTemplate[]>,
    events: [
        {
            name: '标本剥制',
            roll: {
                trait: 'might',
                branches: [
                    {
                        min: 5,
                        label: '获得 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点物理伤害；放置障碍物',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'fixedDamage', amount: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                                { mode: 'placeObstacleToken', recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                ],
            },
        },
        {
            name: '说“茄子”！',
            effect: {
                mode: 'optionalHauntRoll',
                acceptLabel: '进行作祟检定',
                declineLabel: '跳过作祟检定',
                successHauntId: 33,
                successHauntTriggerLabel: '说“茄子”！',
                successTraitorSelection: 'magic-camera-owner',
                successLabel: '翻开作祟剧本33，魔法相机持有者成为奸徒；否则你成为奸徒',
                failureEffect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                skippedOrStartedEffect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                recommendedAction: 'use',
            },
        },
        {
            name: '外星几何',
            roll: {
                trait: 'knowledge',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '失去 1 点速度',
                        effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '小丑房间',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '无事发生',
                        effect: { mode: 'none', recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 2 点精神伤害',
                        effect: { mode: 'fixedDamage', amount: 2, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '咬一口！',
            roll: {
                trait: 'might',
                branches: [
                    {
                        min: 4,
                        label: '无事发生',
                        effect: { mode: 'none', recommendedAction: 'explore' },
                    },
                    {
                        min: 2,
                        label: '受到 1 点物理伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                    {
                        min: 0,
                        label: '受到 3 点物理伤害',
                        effect: { mode: 'fixedDamage', amount: 3, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '吊死鬼',
            effect: {
                mode: 'allTraitChecks',
                name: '吊死鬼',
                traits: ['might', 'speed', 'knowledge', 'sanity'],
                passMin: 2,
                failAmount: 1,
                allPassEffect: {
                    mode: 'chosenTrait',
                    amount: 1,
                    allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                    recommendedAction: 'explore',
                },
                recommendedAction: 'use',
            },
        },
        {
            name: '电话铃声',
            roll: {
                kind: 'dice',
                dice: 2,
                label: '投 2 颗骰子',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 3,
                        label: '获得 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 1,
                        label: '受到一颗骰子的精神伤害',
                        effect: { mode: 'rolledDamage', dice: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                    {
                        min: 0,
                        label: '受到两颗骰子的物理伤害',
                        effect: { mode: 'rolledDamage', dice: 2, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '小机器人',
            roll: {
                trait: 'knowledge',
                branches: [
                    {
                        min: 5,
                        label: '抽取一张物品卡',
                        effect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到一颗骰子的物理伤害',
                        effect: { mode: 'rolledDamage', dice: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '嘎吱的木门',
            roll: {
                trait: 'knowledge',
                branches: [
                    {
                        min: 5,
                        label: '放置到上层起始板块',
                        effect: {
                            mode: 'placeExplorerInFloorStartingRoom',
                            floor: 'upper',
                            roomName: '上层起始点',
                            recommendedAction: 'explore',
                        },
                    },
                    {
                        min: 3,
                        label: '放置到地面层起始板块',
                        effect: {
                            mode: 'placeExplorerInFloorStartingRoom',
                            floor: 'ground',
                            roomName: '地面层起始点',
                            recommendedAction: 'explore',
                        },
                    },
                    {
                        min: 0,
                        label: '放置到地下室起始板块',
                        effect: {
                            mode: 'placeExplorerInFloorStartingRoom',
                            floor: 'basement',
                            roomName: '地下室起始点',
                            recommendedAction: 'endTurn',
                        },
                    },
                ],
            },
        },
        {
            name: '脑状食品',
            roll: {
                trait: 'might',
                branches: [
                    {
                        min: 5,
                        label: '获得 1 点力量或速度',
                        effect: {
                            mode: 'chosenTrait',
                            amount: 1,
                            allowedTraits: ['might', 'speed'],
                            recommendedAction: 'explore',
                        },
                    },
                    {
                        min: 1,
                        label: '获得 1 点速度并失去 1 点神志',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                                { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                    {
                        min: 0,
                        label: '受到 2 点通用伤害',
                        effect: {
                            mode: 'generalDamageChoice',
                            amount: 2,
                            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                            recommendedAction: 'endTurn',
                        },
                    },
                ],
            },
        },
        {
            name: '片刻希望',
            effect: { mode: 'placeBlessingToken', recommendedAction: 'explore' },
        },
        {
            name: '上古旧宅',
            effect: {
                mode: 'chooseTraitRoll',
                prompt: '选择速度或力量进行检定',
                allowedTraits: ['speed', 'might'],
                recommendedAction: 'use',
                branches: [
                    {
                        min: 5,
                        label: '放置到任意板块',
                        effect: {
                            mode: 'placeExplorerInDiscoveredRoomByFloor',
                            targetRoomScope: 'anyDiscovered',
                            recommendedAction: 'explore',
                        },
                    },
                    {
                        min: 3,
                        label: '放置到任意地面层板块，并受到 1 点通用伤害',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                {
                                    mode: 'placeExplorerInDiscoveredRoomByFloor',
                                    targetRoomScope: 'groundDiscovered',
                                    recommendedAction: 'endTurn',
                                },
                                {
                                    mode: 'generalDamageChoice',
                                    amount: 1,
                                    allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                                    recommendedAction: 'endTurn',
                                },
                            ],
                        },
                    },
                    {
                        min: 0,
                        label: '放置到任意地下室板块，并受到 1 点精神伤害',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                {
                                    mode: 'placeExplorerInDiscoveredRoomByFloor',
                                    targetRoomScope: 'basementDiscovered',
                                    recommendedAction: 'endTurn',
                                },
                                { mode: 'fixedDamage', amount: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                ],
            },
        },
        {
            name: '肉质苔癣',
            effect: {
                mode: 'optionalEventRoll',
                acceptLabel: '大口吸入芳香',
                declineLabel: '不吸入芳香',
                recommendedAction: 'use',
                roll: {
                    kind: 'dice',
                    dice: 2,
                    label: '投 2 颗骰子',
                    branches: [
                        {
                            min: 3,
                            label: '获得 1 点任意属性',
                            effect: {
                                mode: 'chosenTrait',
                                amount: 1,
                                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                                recommendedAction: 'explore',
                            },
                        },
                        {
                            min: 0,
                            label: '受到一颗骰子的精神伤害',
                            effect: { mode: 'rolledDamage', dice: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                        },
                    ],
                },
            },
        },
        {
            name: '夜幕众星',
            effect: {
                mode: 'chooseTraitRoll',
                prompt: '选择一项属性进行检定',
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                recommendedAction: 'use',
                branches: [
                    {
                        min: 5,
                        label: '获得 1 点所选属性',
                        effect: {
                            mode: 'chosenTrait',
                            amount: 1,
                            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                            recommendedAction: 'explore',
                        },
                    },
                    {
                        min: 4,
                        label: '失去 1 点所选属性',
                        effect: {
                            mode: 'chosenTrait',
                            amount: -1,
                            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                            recommendedAction: 'endTurn',
                        },
                    },
                    {
                        min: 0,
                        label: '治疗所选属性',
                        effect: {
                            mode: 'healChosenTrait',
                            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                            recommendedAction: 'explore',
                        },
                    },
                ],
            },
        },
        {
            name: '一抹鲜红',
            effect: {
                mode: 'optionalHauntRoll',
                acceptLabel: '进行作祟检定',
                declineLabel: '跳过作祟检定',
                successHauntId: 1,
                successHauntTriggerLabel: 'A Splash of Crimson',
                successLabel: '翻开作祟剧本1，你成为叛徒',
                failureEffect: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                skippedOrStartedEffect: { mode: 'rolledDamage', dice: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                recommendedAction: 'use',
            },
        },
        {
            name: '一瓶微尘',
            effect: {
                mode: 'optionalHauntRoll',
                acceptLabel: '进行作祟检定',
                declineLabel: '跳过作祟检定',
                successHauntId: 3,
                successHauntTriggerLabel: 'A Dusty Vial',
                successLabel: '翻开作祟剧本3，成为作祟揭露者',
                failureEffect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                skippedOrStartedEffect: {
                    mode: 'compound',
                    effects: [
                        { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                        { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    ],
                    recommendedAction: 'endTurn',
                },
                recommendedAction: 'use',
            },
        },
        {
            name: '大宅饿了',
            effect: {
                mode: 'optionalHauntRoll',
                acceptLabel: '进行作祟检定',
                declineLabel: '跳过作祟检定',
                successHauntId: 12,
                successLabel: '翻开作祟剧本12，作祟揭露者为当前探险者',
                failureEffect: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
                skippedOrStartedEffect: {
                    mode: 'chosenTrait',
                    amount: 1,
                    allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                    recommendedAction: 'explore',
                },
                recommendedAction: 'use',
            },
        },
        {
            name: '一条秘密通道',
            roll: {
                trait: 'knowledge',
                branches: [
                    {
                        min: 5,
                        label: '在任意另一板块放置另一个秘密通道标志物，获得 1 点知识',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'explore',
                            effects: [
                                { mode: 'placeSecretPassageToken', recommendedAction: 'explore' },
                                {
                                    mode: 'placeSecretPassageToken',
                                    targetRoomScope: 'anyOtherDiscovered',
                                    recommendedAction: 'explore',
                                },
                                { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                            ],
                        },
                    },
                    {
                        min: 3,
                        label: '在任意地面层板块放置另一个秘密通道标志物',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'placeSecretPassageToken', recommendedAction: 'endTurn' },
                                {
                                    mode: 'placeSecretPassageToken',
                                    targetRoomScope: 'groundDiscovered',
                                    recommendedAction: 'endTurn',
                                },
                            ],
                        },
                    },
                    {
                        min: 0,
                        label: '在任意地下室板块放置另一个秘密通道标志物，失去 1 点神志',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'placeSecretPassageToken', recommendedAction: 'endTurn' },
                                {
                                    mode: 'placeSecretPassageToken',
                                    targetRoomScope: 'basementDiscovered',
                                    recommendedAction: 'endTurn',
                                },
                                { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                ],
            },
        },
        {
            name: '最深的壁橱',
            roll: {
                trait: 'speed',
                branches: [
                    {
                        min: 4,
                        label: '抽取一张物品卡',
                        effect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                    },
                    {
                        min: 1,
                        label: '受到 1 点精神伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                    {
                        min: 0,
                        label: '受到一颗骰子的物理伤害，并放置到地下室起始点',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'rolledDamage', dice: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                                {
                                    mode: 'placeExplorerInRoom',
                                    roomId: 'basement-landing',
                                    roomName: '地下室起始点',
                                    recommendedAction: 'endTurn',
                                },
                            ],
                        },
                    },
                ],
            },
        },
        {
            name: '磁带播放器',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点精神伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '在你背后！',
            roll: {
                trait: 'speed',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点物理伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '蜘蛛！',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点神志或速度，并放置到相邻板块',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'explore',
                            effects: [
                                {
                                    mode: 'chosenTrait',
                                    amount: 1,
                                    allowedTraits: ['sanity', 'speed'],
                                    recommendedAction: 'explore',
                                },
                                {
                                    mode: 'placeExplorerInAdjacentRoom',
                                    recommendedAction: 'explore',
                                },
                            ],
                        },
                    },
                    {
                        min: 2,
                        label: '获得 1 点速度并失去 1 点神志',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                                { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                    {
                        min: 0,
                        label: '失去 1 点速度',
                        effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '一种怪异的感觉',
            roll: {
                kind: 'dice',
                dice: 2,
                label: '投 2 颗骰子',
                branches: [
                    {
                        min: 4,
                        label: '无事发生',
                        effect: { mode: 'none', recommendedAction: 'explore' },
                    },
                    {
                        min: 3,
                        label: '失去 1 点速度',
                        effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
                    },
                    {
                        min: 2,
                        label: '失去 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                    },
                    {
                        min: 1,
                        label: '失去 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' },
                    },
                    {
                        min: 0,
                        label: '失去 1 点力量',
                        effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '游魂',
            effect: {
                mode: 'optionalItemEffect',
                acceptLabel: '埋葬一件物品并获得 1 点任意属性',
                declineLabel: '不埋葬物品',
                itemFilter: 'item',
                consumeAction: 'bury',
                acceptEffect: {
                    mode: 'chosenTrait',
                    amount: 1,
                    allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                    recommendedAction: 'explore',
                },
                declineEffect: {
                    mode: 'traitRoll',
                    trait: 'sanity',
                    recommendedAction: 'use',
                    branches: [
                        {
                            min: 4,
                            label: '抽取一张物品卡',
                            effect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                        },
                        {
                            min: 0,
                            label: '受到 1 点通用伤害',
                            effect: {
                                mode: 'generalDamageChoice',
                                amount: 1,
                                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                                recommendedAction: 'endTurn',
                            },
                        },
                    ],
                },
                recommendedAction: 'use',
            },
        },
        {
            name: '葬礼',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 2,
                        label: '失去 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                    },
                    {
                        min: 0,
                        label: '失去 1 点神志及 1 点力量；若墓园或地下墓穴已发现，将探险者放置在上述板块之一',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                                { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                                {
                                    mode: 'placeExplorerInDiscoveredRoomByVisualId',
                                    visualIds: ['graveyard', 'catacombs'],
                                    roomNames: ['墓园', '地下墓穴'],
                                    recommendedAction: 'endTurn',
                                },
                            ],
                        },
                    },
                ],
            },
        },
        {
            name: '不可能的房间',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '抽取一张物品卡',
                        effect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到一颗骰子的精神伤害',
                        effect: { mode: 'rolledDamage', dice: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '地狱蝙蝠',
            roll: {
                trait: 'speed',
                branches: [
                    {
                        min: 4,
                        label: '放置到相邻板块',
                        effect: { mode: 'placeExplorerInAdjacentRoom', recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点物理伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '断手',
            effect: {
                mode: 'optionalEffect',
                acceptLabel: '承受伤害并抽取物品',
                declineLabel: '不触碰断手',
                recommendedAction: 'use',
                acceptEffect: {
                    mode: 'compound',
                    recommendedAction: 'endTurn',
                    effects: [
                        { mode: 'fixedDamage', amount: 2, damageKind: 'physical', recommendedAction: 'endTurn' },
                        { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                    ],
                },
            },
        },
        {
            name: '怪异的镜子',
            effect: {
                mode: 'optionalHauntRoll',
                acceptLabel: '进行作祟检定',
                declineLabel: '抽取一张物品卡',
                successHauntId: 7,
                successHauntTriggerLabel: '怪异的镜子',
                successLabel: '翻开作祟剧本7；该作祟没有奸徒',
                failureEffect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                skippedOrStartedEffect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                recommendedAction: 'use',
            },
        },
        {
            name: '花团锦簇',
            effect: {
                mode: 'compound',
                recommendedAction: 'endTurn',
                effects: [
                    {
                        mode: 'generalDamageChoice',
                        amount: 1,
                        allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                        recommendedAction: 'endTurn',
                    },
                    {
                        mode: 'placeExplorerInDiscoveredRoomByFloor',
                        targetRoomScope: 'groundOrBasementDiscovered',
                        requiredIfDiscoveredVisualIds: ['conservatory'],
                        recommendedAction: 'endTurn',
                    },
                ],
            },
        },
        {
            name: '晦暗暴风夜',
            roll: {
                trait: 'knowledge',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点精神伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '技术难点',
            effect: {
                mode: 'placeExplorerInNextFloorStartingRoom',
                basementFallbackFloor: 'upper',
                basementFallbackDamage: { amount: 1, damageKind: 'mental' },
                recommendedAction: 'endTurn',
            },
        },
        {
            name: '佳馔满桌',
            effect: {
                mode: 'chooseTraitRoll',
                prompt: '选择知识或神志进行检定',
                allowedTraits: ['knowledge', 'sanity'],
                recommendedAction: 'use',
                branches: [
                    {
                        min: 5,
                        label: '获得 1 点速度',
                        effect: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点通用伤害',
                        effect: {
                            mode: 'generalDamageChoice',
                            amount: 1,
                            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                            recommendedAction: 'endTurn',
                        },
                    },
                ],
            },
        },
        {
            name: '禁忌知识',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 2,
                        label: '获得 1 点知识并失去 1 点神志',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                                { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                    {
                        min: 0,
                        label: '受到两颗骰子的精神伤害',
                        effect: { mode: 'rolledDamage', dice: 2, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '可怜的尤里克',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到 1 点精神伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '轮到约拿了',
            effect: {
                mode: 'optionalItemEffect',
                acceptLabel: '弃置非武器物品并获得 1 点神志',
                declineLabel: '不弃置物品',
                itemFilter: 'nonWeaponItem',
                consumeAction: 'discard',
                acceptEffect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                declineEffect: { mode: 'rolledDamage', dice: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                recommendedAction: 'use',
            },
        },
        {
            name: '秘密升降机',
            effect: {
                mode: 'placeExplorerInDiscoveredRoomByFloor',
                targetRoomScope: 'differentFloorDiscovered',
                recommendedAction: 'explore',
            },
        },
        {
            name: '神秘液体',
            effect: {
                mode: 'optionalEventRoll',
                acceptLabel: '喝下神秘液体',
                declineLabel: '不喝',
                recommendedAction: 'use',
                roll: {
                    kind: 'dice',
                    dice: 3,
                    label: '投 3 颗骰子',
                    branches: [
                        {
                            min: 6,
                            label: '每项属性 +1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'explore',
                                effects: [
                                    { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
                                    { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                                    { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                                    { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                                ],
                            },
                        },
                        {
                            min: 5,
                            label: '力量与速度 +1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'explore',
                                effects: [
                                    { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' },
                                    { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                                ],
                            },
                        },
                        {
                            min: 4,
                            label: '知识与神志 +1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'explore',
                                effects: [
                                    { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                                    { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                                ],
                            },
                        },
                        {
                            min: 3,
                            label: '知识 +1，力量 -1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'endTurn',
                                effects: [
                                    { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                                    { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                                ],
                            },
                        },
                        {
                            min: 2,
                            label: '知识与神志 -1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'endTurn',
                                effects: [
                                    { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' },
                                    { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                                ],
                            },
                        },
                        {
                            min: 1,
                            label: '力量与速度 -1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'endTurn',
                                effects: [
                                    { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                                    { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
                                ],
                            },
                        },
                        {
                            min: 0,
                            label: '每项属性 -1',
                            effect: {
                                mode: 'compound',
                                recommendedAction: 'endTurn',
                                effects: [
                                    { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                                    { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
                                    { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' },
                                    { mode: 'trait', trait: 'sanity', amount: -1, recommendedAction: 'endTurn' },
                                ],
                            },
                        },
                    ],
                },
            },
        },
        {
            name: '无线电广播',
            roll: {
                kind: 'dice',
                dice: 2,
                label: '投 2 颗骰子',
                branches: [
                    {
                        min: 3,
                        label: '获得 1 点知识',
                        effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到一颗骰子的精神伤害',
                        effect: { mode: 'rolledDamage', dice: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '摇曳灯光',
            effect: {
                mode: 'chooseTraitRoll',
                prompt: '选择速度或力量进行检定',
                allowedTraits: ['speed', 'might'],
                recommendedAction: 'use',
                branches: [
                    {
                        min: 5,
                        label: '获得 1 点速度',
                        effect: { mode: 'trait', trait: 'speed', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '受到一颗骰子的物理伤害',
                        effect: { mode: 'rolledDamage', dice: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '一罐器官',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '抽取一张物品卡',
                        effect: { mode: 'drawPossession', kind: 'item', recommendedAction: 'explore' },
                    },
                    {
                        min: 0,
                        label: '失去 1 点力量',
                        effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '一声呼救',
            roll: {
                trait: 'knowledge',
                branches: [
                    {
                        min: 4,
                        label: '放置在所在区域的任意板块',
                        effect: {
                            mode: 'placeExplorerInDiscoveredRoomByFloor',
                            targetRoomScope: 'sameFloorDiscovered',
                            recommendedAction: 'explore',
                        },
                    },
                    {
                        min: 0,
                        label: '受到 1 点精神伤害',
                        effect: { mode: 'fixedDamage', amount: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                    },
                ],
            },
        },
        {
            name: '着火的人',
            roll: {
                trait: 'sanity',
                branches: [
                    {
                        min: 4,
                        label: '获得 1 点神志',
                        effect: { mode: 'trait', trait: 'sanity', amount: 1, recommendedAction: 'explore' },
                    },
                    {
                        min: 2,
                        label: '放置到入口大厅',
                        effect: {
                            mode: 'placeExplorerInRoom',
                            roomId: 'entrance-hall',
                            roomName: '入口大厅',
                            recommendedAction: 'endTurn',
                        },
                    },
                    {
                        min: 0,
                        label: '受到一颗骰子的物理伤害和一颗骰子的精神伤害',
                        effect: {
                            mode: 'compound',
                            recommendedAction: 'endTurn',
                            effects: [
                                { mode: 'rolledDamage', dice: 1, damageKind: 'physical', recommendedAction: 'endTurn' },
                                { mode: 'rolledDamage', dice: 1, damageKind: 'mental', recommendedAction: 'endTurn' },
                            ],
                        },
                    },
                ],
            },
        },
    ] satisfies BetrayalEventSeed[],
};

export const BETRAYAL_SCENARIO_CONFIGS: Record<BetrayalScenarioId, BetrayalScenarioConfig> = {
    'first-scenario': {
        id: 'first-scenario',
        title: '首剧本：木乃伊横行',
        scenarioCardLabel: 'Girl',
        hauntId: 'mummy-rampage',
        hauntTitle: '木乃伊横行',
        hauntTriggerLabel: '女孩',
        presentation: {
            runtimeObjective: '恶兆前探索',
            hauntObjective: '找出真名、学习驱逐法术并驱逐木乃伊',
        },
        startingInventoryByExplorerId: {},
        logs: {
            scenarioStarted: '首剧本开始：恶兆前探索',
            hauntTriggered: '首剧本触发：木乃伊横行',
            scenarioCompleted: '首剧本完成：木乃伊被驱逐',
        },
        runtimePreview: {
            monsters: [
                {
                    id: 'mummy',
                    definitionId: 'mummy',
                    name: '木乃伊',
                    portraitAsset: 'betrayal/monsters/mummy',
                    tokenAsset: 'betrayal/tokens/monsters/mummy.svg',
                    roomId: 'upper-landing',
                    might: 8,
                    speed: 3,
                    sanity: 5,
                    damage: 1,
                },
            ],
        },
        completion: {
            minExploreCount: 999,
            outcome: 'survivors',
            traitorSelection: 'current-explorer',
            survivorSelection: 'all-non-traitor',
            reward: {
                stars: 4,
                logs: 1,
                minimumOmens: 1,
            },
        },
    },
};

export const DEFAULT_BETRAYAL_SCENARIO_ID: BetrayalScenarioId = 'first-scenario';
