import { getQidahenPlayableFactions } from '../roomSetup';
import type { QidahenCore, QidahenFactionId, QidahenScenarioId } from './types';

export const getScenarioPlayableFactionIds = (
    scenarioId: QidahenScenarioId,
): QidahenFactionId[] => (
    [...getQidahenPlayableFactions(scenarioId)]
);

export const filterFactionOrderForScenario = (
    scenarioId: QidahenScenarioId,
    order: readonly QidahenFactionId[],
): QidahenFactionId[] => {
    const playableFactionIds = new Set(getScenarioPlayableFactionIds(scenarioId));
    return order.filter((factionId, index) => (
        playableFactionIds.has(factionId)
        && order.indexOf(factionId) === index
    ));
};

export const getActiveFactionTurnOrder = (
    state: QidahenCore,
    openingFactionOrder: readonly QidahenFactionId[],
): QidahenFactionId[] => {
    const chronologyOrder = state.currentFactionOrder;
    const hasValidChronologyOrder = (
        Array.isArray(chronologyOrder)
        && chronologyOrder.length === openingFactionOrder.length
        && chronologyOrder.every((factionId) => openingFactionOrder.includes(factionId))
        && new Set(chronologyOrder).size === openingFactionOrder.length
    );
    // 当前开局基线仍保留既有剧本 opening；跨过首次新年后再切到纪年卡顺位。
    return hasValidChronologyOrder && state.currentYearIndex > 0
        ? [...chronologyOrder]
        : [...openingFactionOrder];
};
