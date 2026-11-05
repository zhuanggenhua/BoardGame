import { getQidahenWheelDestination } from './wheelRules';
import { addFactionHandCards, appendDrawnHandCards, drawFromFactionPile } from './handCardState';
import { getCurrentFactionId } from './factionTurnAccessors';
import { buildQidahenWheelMoveSummary, getQidahenWheelMoveById } from './wheelMoves';
import type { QidahenCore, QidahenFactionId } from './types';

interface QidahenWheelMoveExecutionDependencies {
    drawFromFactionPile: typeof drawFromFactionPile;
    addFactionHandCards: typeof addFactionHandCards;
}

/** 这里只提交移动与对手抽牌；落点行动和季节事务由共享结算帧接管。 */
export const resolveQidahenWheelMoveExecuted = (
    state: QidahenCore,
    moveId: string,
    timestamp: number,
    opponentFactionId?: QidahenFactionId,
    dependencies: QidahenWheelMoveExecutionDependencies = { drawFromFactionPile, addFactionHandCards },
): QidahenCore => {
    const move = getQidahenWheelMoveById(moveId);
    if (!move) return state;

    const destination = getQidahenWheelDestination(state.actionWheelPosition, move.steps);
    const nextWheelPosition = destination.id;
    const currentFactionId = getCurrentFactionId(state);
    const opponentFactionIds = (Object.keys(state.factions) as QidahenFactionId[])
        .filter((factionId) => (
            factionId !== currentFactionId
            && !state.factions[factionId].playerId.startsWith('qidahen-neutral-')
        ));
    if (move.id === 'move-2-one-opponent' && (!opponentFactionId || !opponentFactionIds.includes(opponentFactionId))) {
        return state;
    }
    let wheelDrawFactions = state.factions;
    let wheelDrawHandCards = state.handCards;
    const drawFactionIds = move.id === 'move-2-one-opponent'
        ? [opponentFactionId!]
        : move.id === 'move-3-all-opponents'
            ? opponentFactionIds
            : [];
    for (const drawFactionId of drawFactionIds) {
        const draw = dependencies.drawFromFactionPile(wheelDrawFactions, drawFactionId, 2);
        wheelDrawFactions = dependencies.addFactionHandCards(draw.factions, drawFactionId, draw.drawnCards);
        wheelDrawHandCards = appendDrawnHandCards(wheelDrawHandCards, draw.cards, drawFactionId);
    }

    const nextState: QidahenCore = {
        ...state,
        selectedWheelMoveId: move.id,
        wheelActionUsed: false,
        actionWheelPosition: nextWheelPosition,
        wheelMoveSummary: buildQidahenWheelMoveSummary(
            move.id,
            opponentFactionId,
            opponentFactionId ? state.factions[opponentFactionId].name : undefined,
        ),
        lastSeasonSummary: null,
        diplomacyProgress: null,
        wheelDispatchProgress: null,
        postBattleSelection: null,
        factions: wheelDrawFactions,
        handCards: wheelDrawHandCards,
        drawPileCount: wheelDrawFactions.ming.drawPileCount,
        discardPileCount: wheelDrawFactions.ming.discardPileCount,
    };
    return nextState;
};
