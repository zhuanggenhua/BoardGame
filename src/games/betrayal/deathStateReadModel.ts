import { isBetrayalHauntRuntimeStarted } from './entityRelationModel';
import { isExplorerDead } from './damageResolutionModel';
import {
    findExplorerByPlayerId,
    getAllExplorers,
} from './explorerReadModel';
import { createBetrayalMonsterFromDefinition } from './domain/monsterDefinitions';
import {
    isDustHaunt,
    resolveJackSpiritSpawnRoomId,
} from './hauntScenarioReadModel';
import {
    canUseRabbitFootForRecentRoll,
    isOwnDeathPreventionRerollWindow,
    resolveRabbitFootCard,
} from './possessionActionReadModel';
import {
    cloneInventoryCard,
    restorePossessionCardToBottom,
} from './possessionDeckModel';
import { BETRAYAL_EXPLORER_CATALOG } from './scenarioConfig';
import {
    BETRAYAL_TRAIT_KEYS,
    healExplorerTraitToStart,
} from './traitTrackModel';
import type {
    BetrayalCore,
    BetrayalCorpseSummary,
    BetrayalDeathStateSummary,
    BetrayalExplorerSummary,
} from './game';

export interface BetrayalCorpseLootCommandPayload {
    sourcePlayerId?: string;
    cardId?: string;
}

export interface BetrayalCorpseLootedPayload {
    playerId: string;
    sourcePlayerId: string;
    cardId: string;
    logText: string;
}

function healExplorerToCatalogStart(explorer: BetrayalExplorerSummary): void {
    if (!BETRAYAL_EXPLORER_CATALOG.some((template) => template.explorerId === explorer.explorerId)) {
        return;
    }
    for (const trait of BETRAYAL_TRAIT_KEYS) {
        healExplorerTraitToStart(explorer, trait);
    }
}

export function markDeadExplorer(core: BetrayalCore, playerId: string): void {
    if (core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)) {
        return;
    }
    core.scenarioRuntime.deadExplorerPlayerIds = [
        ...core.scenarioRuntime.deadExplorerPlayerIds,
        playerId,
    ];
}

export function releaseJackSpiritForDeadTraitor(
    core: BetrayalCore,
    playerId: string,
    fallbackCorpseRoomId: string,
    releasedJackSpiritRoomId?: string,
): string {
    markDeadExplorer(core, playerId);
    const traitor = findExplorerByPlayerId(core, playerId);
    const corpseRoomId = traitor?.roomId ?? fallbackCorpseRoomId;
    core.scenarioRuntime.traitorCorpseRoomId = corpseRoomId;
    core.scenarioRuntime.jackSpiritReleased = true;
    core.scenarioRuntime.jackSpiritRoomId = releasedJackSpiritRoomId
        ?? resolveJackSpiritSpawnRoomId(core, corpseRoomId);
    core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
    core.monsters = [createBetrayalMonsterFromDefinition(
        'crimson-jack-spirit',
        'jack-spirit',
        core.scenarioRuntime.jackSpiritRoomId,
    )];
    return core.scenarioRuntime.jackSpiritRoomId;
}

export function canReviveTraitorFromJackSpiritAtMonsterTurnStart(
    core: BetrayalCore,
    nextPlayerId: string,
): boolean {
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

export function applyBetrayalJackSpiritRevivalAtMonsterTurnStart(
    core: BetrayalCore,
    nextPlayerId: string,
): boolean {
    if (!canReviveTraitorFromJackSpiritAtMonsterTurnStart(core, nextPlayerId)) {
        return false;
    }
    const traitor = findExplorerByPlayerId(core, nextPlayerId);
    if (!traitor) {
        return false;
    }
    healExplorerToCatalogStart(traitor);
    core.scenarioRuntime.deadExplorerPlayerIds = core.scenarioRuntime.deadExplorerPlayerIds
        .filter((playerId) => playerId !== nextPlayerId);
    core.scenarioRuntime.jackSpiritReleased = false;
    core.scenarioRuntime.jackSpiritRoomId = null;
    core.scenarioRuntime.jackSpiritHasMovedSinceRelease = false;
    core.scenarioRuntime.traitorCorpseRoomId = null;
    core.monsters = core.monsters.filter((monster) => monster.id !== 'jack-spirit');
    return true;
}

export function buryExplorerPossessionsToBottom(
    core: BetrayalCore,
    explorer: BetrayalExplorerSummary,
): void {
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

function shouldDeferDustTraitorPossessionBurialForRabbitFoot(
    core: BetrayalCore,
    playerId: string,
): boolean {
    return isOwnDeathPreventionRerollWindow(core, playerId)
        && canUseRabbitFootForRecentRoll(core, playerId);
}

export function shouldDeferDustTraitorVictoryForRabbitFoot(
    core: BetrayalCore,
    playerId: string,
): boolean {
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

export function buryDustDeadTraitorPossessions(
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

export function addFeverishMonsterForPlayer(core: BetrayalCore, playerId: string): void {
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

export function applyDustEventEffectDeathIfNeeded(core: BetrayalCore): void {
    if (!isDustHaunt(core) || !isExplorerDead(core.currentExplorer)) {
        return;
    }
    markDeadExplorer(core, core.currentExplorer.playerId);
    if (core.scenarioRuntime.dust?.permanentTraitorPlayerIds.includes(core.currentExplorer.playerId)) {
        addFeverishMonsterForPlayer(core, core.currentExplorer.playerId);
    }
}

export function resolveCorpseLootTargets(core: BetrayalCore): BetrayalExplorerSummary[] {
    return core.otherExplorers.filter((explorer) => (
        explorer.roomId === core.activeRoomId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        && explorer.inventory.length > 0
        && !core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn.includes(explorer.playerId)
    ));
}

export function createBetrayalCorpseLootedPayload(
    core: BetrayalCore,
    playerId: string,
    payload: BetrayalCorpseLootCommandPayload,
): BetrayalCorpseLootedPayload | null {
    const corpseTargets = resolveCorpseLootTargets(core);
    const source = corpseTargets.find((item) => item.playerId === payload.sourcePlayerId);
    const card = source?.inventory.find((item) => item.id === payload.cardId);
    if (!source || !card) {
        return null;
    }
    return {
        playerId,
        sourcePlayerId: source.playerId,
        cardId: card.id,
        logText: `${core.currentExplorer.displayName}从${source.displayName}的尸体上拿走了${card.name}`,
    };
}

export function applyBetrayalCorpseLootedState(
    core: BetrayalCore,
    payload: BetrayalCorpseLootedPayload,
): boolean {
    const source = core.otherExplorers.find((explorer) => explorer.playerId === payload.sourcePlayerId);
    const card = source?.inventory.find((item) => item.id === payload.cardId);
    if (!source || !card) {
        return false;
    }
    source.inventory = source.inventory.filter((item) => item.id !== card.id);
    core.currentExplorer.inventory = [...core.currentExplorer.inventory, cloneInventoryCard(card)];
    core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn = Array.from(new Set([
        ...core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn,
        source.playerId,
    ]));
    return true;
}

export function resolveBetrayalDeathStateSummary(core: BetrayalCore): BetrayalDeathStateSummary {
    const deadPlayerIds = new Set(core.scenarioRuntime.deadExplorerPlayerIds);
    const lootedThisTurnPlayerIds = new Set(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn);
    const currentExplorerCanLoot = !deadPlayerIds.has(core.currentExplorer.playerId);
    const corpses = getAllExplorers(core)
        .filter((explorer) => deadPlayerIds.has(explorer.playerId))
        .map((explorer): BetrayalCorpseSummary => {
            const room = core.rooms.find((candidate) => candidate.id === explorer.roomId);
            const lootedThisTurn = lootedThisTurnPlayerIds.has(explorer.playerId);
            const sameRoomAsCurrentExplorer = explorer.roomId === core.activeRoomId;
            const canBeLootedByCurrentExplorer = currentExplorerCanLoot
                && explorer.playerId !== core.currentExplorer.playerId
                && sameRoomAsCurrentExplorer
                && explorer.inventory.length > 0
                && !lootedThisTurn;
            return {
                playerId: explorer.playerId,
                explorerId: explorer.explorerId,
                displayName: explorer.displayName,
                roomId: explorer.roomId,
                roomName: room?.name ?? null,
                shouldLayTokenFlat: true,
                inventory: explorer.inventory.map(cloneInventoryCard),
                itemCount: explorer.inventory.filter((card) => card.kind === 'item').length,
                omenCount: explorer.inventory.filter((card) => card.kind === 'omen').length,
                lootedThisTurn,
                canBeLootedByCurrentExplorer,
                lootableCardIds: canBeLootedByCurrentExplorer
                    ? explorer.inventory.map((card) => card.id)
                    : [],
                ruleNotes: [
                    '死亡探索者保留在死亡房间作为尸体。',
                    '尸体上的物品和预兆保留在尸体旁边，存活同房间探索者每回合可拿一张。',
                ],
            };
        });
    return {
        hauntDeathRulesActive: isBetrayalHauntRuntimeStarted(core),
        livingExplorerPlayerIds: getAllExplorers(core)
            .filter((explorer) => !deadPlayerIds.has(explorer.playerId))
            .map((explorer) => explorer.playerId),
        deadExplorerPlayerIds: [...core.scenarioRuntime.deadExplorerPlayerIds],
        corpseLootedThisTurnPlayerIds: [...core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn],
        corpses,
        ruleNotes: [
            '作祟开始后探索者才会死亡；作祟前只能降到临界。',
            '死亡后立牌应倒在所在房间，持有物保留并可被同房间存活探索者搜刮。',
            '作祟专属死亡用途、变怪物或特殊胜负仍以对应作祟说明覆盖。',
        ],
    };
}
