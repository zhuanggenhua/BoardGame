import type { RandomFn } from '../../engine/types';
import { createBetrayalMonsterFromDefinition } from './domain/monsterDefinitions';
import { findExplorerByPlayerId, getAllExplorers } from './explorerReadModel';
import { resolveBloodFromStoneSetupPlacementPlan } from './bloodFromStoneSetupReadModel';
import {
    findMagicCameraHolderPlayerId,
    findStrangeAmuletHolder,
    hasOmenBook,
    HELPING_HANDS_STRANGE_AMULET_EFFECT_ID,
    isStrangeAmuletCard,
    isStoneCherubMonster,
} from './hauntScenarioReadModel';
import { DRAW_POOL, cloneInventoryCard } from './possessionDeckModel';
import { resolveInventoryEffectId } from './possessionEffects';
import { resolveCurrentRoomDiscoveryDeck } from './roomDiscoveryModel';
import { roomDistanceByLayout } from './roomMapModel';
import { BETRAYAL_TRAIT_KEYS } from './traitTrackModel';
import type {
    BetrayalCore,
    BetrayalDustRuntimeState,
    BetrayalExplorerSummary,
    BetrayalHelpingHandsRuntimeState,
    BetrayalInventoryCard,
    BetrayalMagicCameraRuntimeState,
    BetrayalMonsterSummary,
    BetrayalMummyRuntimeState,
    BetrayalRoomNode,
    BetrayalUponReflectionRuntimeState,
} from './game';

const HELPING_HANDS_STRANGE_AMULET_CARD: BetrayalInventoryCard = {
    id: HELPING_HANDS_STRANGE_AMULET_EFFECT_ID,
    name: '奇异护符',
    kind: 'item',
};

const HELPING_HANDS_TROLL_HAND_TOKEN_ASSETS = [
    'betrayal/tokens/monsters/troll-right-hand',
    'betrayal/tokens/monsters/troll-left-hand',
] as const;

export function cloneDustRuntimeState(dust: BetrayalDustRuntimeState): BetrayalDustRuntimeState {
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

export function cloneMagicCameraRuntimeState(
    magicCamera: BetrayalMagicCameraRuntimeState,
): BetrayalMagicCameraRuntimeState {
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

export function cloneMummyRuntimeState(mummy: BetrayalMummyRuntimeState): BetrayalMummyRuntimeState {
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

export function cloneHelpingHandsRuntimeState(
    helpingHands: BetrayalHelpingHandsRuntimeState,
): BetrayalHelpingHandsRuntimeState {
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

export function cloneUponReflectionRuntimeState(
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

export function createDustRuntimeState(core: BetrayalCore, random: RandomFn): BetrayalDustRuntimeState {
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

export function setupMummyHaunt(core: BetrayalCore, traitorPlayerId: string | null): BetrayalMummyRuntimeState {
    const mummy = createMummyRuntimeState(core, traitorPlayerId);
    removeMummyGirlOmenFromExplorers(core);
    core.monsters = [
        ...core.monsters.filter((monster) => monster.id !== mummy.mummyMonsterId && monster.definitionId !== 'mummy'),
        createBetrayalMonsterFromDefinition('mummy', mummy.mummyMonsterId, mummy.sarcophagusRoomId),
    ];
    return mummy;
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
        return { cardId: HELPING_HANDS_STRANGE_AMULET_EFFECT_ID, foundDuringSetup: false };
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

export function setupHelpingHandsHaunt(
    core: BetrayalCore,
    revealerPlayerId: string,
): BetrayalHelpingHandsRuntimeState {
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

function createMagicCameraRuntimeState(
    core: BetrayalCore,
    traitorPlayerId: string | null,
): BetrayalMagicCameraRuntimeState {
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

function createMagicCameraPhantomPhotographers(
    core: BetrayalCore,
    magicCamera: BetrayalMagicCameraRuntimeState,
): BetrayalMonsterSummary[] {
    const rooms = resolveMagicCameraPhantomRooms(core, magicCamera.phantomPhotographerIds.length);
    return magicCamera.phantomPhotographerIds.map((id, index) => createBetrayalMonsterFromDefinition(
        'magic-camera-phantom-photographer',
        id,
        rooms[index]?.id ?? core.activeRoomId,
    ));
}

export function removeMagicCameraFromExplorer(explorer: BetrayalExplorerSummary): void {
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

export function setupMagicCameraHaunt(
    core: BetrayalCore,
    traitorPlayerId: string | null,
): BetrayalMagicCameraRuntimeState {
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

export function setupUponReflectionHaunt(core: BetrayalCore): void {
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

export function createUponReflectionRuntimeState(
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

export function setupBloodFromStoneHaunt(core: BetrayalCore): void {
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
