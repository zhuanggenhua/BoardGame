import { resolveCorpseLootTargets } from './deathStateReadModel';
import {
    isBetrayalLibraryRoom,
    isCrimsonJackHaunt,
} from './hauntScenarioReadModel';
import { hasUsedHauntSpecialActionThisTurn } from './hauntSpecialActionReadModel';
import { resolveMoveTargetRooms } from './movementReadModel';
import { canUseBetrayalPossessionThisTurn } from './possessionActionReadModel';
import { resolveNextExplorableRoomSlot } from './roomDiscoveryModel';
import {
    resolveDogTradeTargets,
    resolveTradeTargets,
} from './trade';
import type {
    BetrayalCore,
    BetrayalRecommendedAction,
} from './game';

export function resolveRecommendedAction(
    core: BetrayalCore,
    options: { preferUse?: boolean; cardId?: string } = {},
): BetrayalRecommendedAction {
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
