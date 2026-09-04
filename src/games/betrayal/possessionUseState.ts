import {
    findExplorerByPlayerId,
} from './explorerReadModel';
import type {
    BetrayalCore,
    BetrayalTraitKey,
} from './game';
import type { BetrayalPossessionUsedPayload } from './possessionUseResolution';
import {
    applyTraitLoss,
    healExplorerTraitToStart,
    moveExplorerTraitSteps,
} from './traitTrackModel';

function healExplorerTraitsToStart(
    explorer: BetrayalCore['currentExplorer'],
    traits: BetrayalTraitKey[],
): void {
    for (const trait of traits) {
        healExplorerTraitToStart(explorer, trait);
    }
}

export function applyBetrayalPossessionUsedState(
    core: BetrayalCore,
    payload: BetrayalPossessionUsedPayload,
): void {
    if (payload.effect.mode === 'move') {
        core.movesRemaining = Math.min(5, Math.max(0, core.movesRemaining + payload.effect.amount));
    } else if (payload.effect.mode === 'nextNonCombatTraitReplacement') {
        const owner = findExplorerByPlayerId(core, payload.playerId) ?? core.currentExplorer;
        applyTraitLoss(owner, ['sanity'], payload.effect.sanityCost);
        core.nextNonCombatTraitReplacement = {
            playerId: payload.playerId,
            sourceCardId: payload.cardId,
            replacementTrait: payload.effect.replacementTrait,
        };
    } else if (payload.effect.mode === 'nextNonCombatTraitRollTotalReplacement') {
        const usedCard = core.currentExplorer.inventory.find((item) => item.id === payload.cardId);
        if (payload.effect.consumeOnUse) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== payload.cardId);
        }
        core.nextNonCombatTraitRollTotalReplacement = {
            playerId: payload.playerId,
            sourceCardId: payload.cardId,
            sourceCardName: usedCard?.name ?? '天使之羽',
            selectedTotal: payload.replacementRollTotal ?? payload.effect.minTotal,
        };
    } else if (payload.effect.mode === 'healTraits') {
        const target = payload.targetPlayerId && payload.targetPlayerId !== core.currentExplorer.playerId
            ? core.otherExplorers.find((explorer) => explorer.playerId === payload.targetPlayerId)
            : core.currentExplorer;
        if (target) {
            healExplorerTraitsToStart(target, payload.effect.traits);
        }
        if (payload.effect.consumeOnUse) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== payload.cardId);
        }
    } else if (payload.effect.mode === 'placeExplorer') {
        const targetRoom = core.rooms.find((room) => room.id === payload.targetRoomId && room.state === 'discovered');
        if (targetRoom) {
            core.currentExplorer.roomId = targetRoom.id;
        }
        if (payload.effect.consumeOnUse) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== payload.cardId);
        }
    } else if (payload.effect.mode === 'extraTurnAfterTurnEnd') {
        const usedCard = core.currentExplorer.inventory.find((item) => item.id === payload.cardId);
        if (payload.effect.consumeOnUse) {
            core.currentExplorer.inventory = core.currentExplorer.inventory.filter((item) => item.id !== payload.cardId);
        }
        core.pendingExtraTurnAfterCurrentTurn = {
            playerId: payload.playerId,
            sourceCardId: payload.cardId,
            sourceCardName: usedCard?.name ?? '神秘秒表',
        };
    } else if (payload.effect.mode === 'moveOthersInRoom') {
        const targetRoomIdsByTokenId = payload.targetRoomIdsByTokenId ?? {};
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            const targetRoomId = targetRoomIdsByTokenId[explorer.playerId] ?? payload.targetRoomId;
            const targetRoom = core.rooms.find((room) => room.id === targetRoomId && room.state === 'discovered');
            return explorer.roomId === core.currentExplorer.roomId
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && targetRoom
                ? { ...explorer, roomId: targetRoom.id }
                : explorer;
        });
        core.monsters = core.monsters.map((monster) => {
            const targetRoomId = targetRoomIdsByTokenId[monster.id] ?? payload.targetRoomId;
            const targetRoom = core.rooms.find((room) => room.id === targetRoomId && room.state === 'discovered');
            return monster.roomId === core.currentExplorer.roomId && targetRoom
                ? { ...monster, roomId: targetRoom.id }
                : monster;
        });
    } else {
        moveExplorerTraitSteps(
            core.currentExplorer,
            payload.effect.trait!,
            payload.effect.amount,
        );
    }
    core.usedCardIdsThisTurn = [...core.usedCardIdsThisTurn, payload.cardId];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;
    core.latestRoomDrawResolution = null;
}
