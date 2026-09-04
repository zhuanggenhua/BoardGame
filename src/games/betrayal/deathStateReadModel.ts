import { isBetrayalHauntRuntimeStarted } from './entityRelationModel';
import { getAllExplorers } from './explorerReadModel';
import { cloneInventoryCard } from './possessionDeckModel';
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
