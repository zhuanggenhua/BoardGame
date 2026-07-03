import {
    upgradeLowFidelityArmament,
} from './armamentLowFidelity';
import { syncFactionActionWindow } from './factionActionWindow';
import { getFactionIdByPlayerId } from './factionTurnAccessors';
import { buildQidahenRegionFocusState } from './regionFocusSemantics';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import {
    advanceQidahenTurnIfReady,
} from './turnAdvance';
import {
    applyQidahenVictoryStatus,
} from './victoryResolution';
import type {
    QidahenArmamentId,
    QidahenArmamentState,
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
    QidahenSeasonSummary,
} from './types';

interface QidahenArmamentUpgradeResolutionDependencies {
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    upgradeLowFidelityArmament: (
        armaments: QidahenArmamentState[],
        preferredArmamentId?: QidahenArmamentId | null,
    ) => { armaments: QidahenArmamentState[]; upgradedArmament: QidahenArmamentState | null };
}

interface QidahenSelectedArmamentUpgradeExecutionResult {
    factions: QidahenCore['factions'];
    lastSeasonSummary: QidahenSeasonSummary | null;
}

interface QidahenSunYuanhuaTechResolutionResult extends Pick<QidahenCore, 'factions' | 'handCards' | 'discardPileCount'> {
    selectedRegionId: string;
    summaryLines: string[];
    logText: string;
}

interface QidahenSunYuanhuaTechResolvedEventDependencies {
    getFactionIdByPlayerId: (
        state: QidahenCore,
        playerId: string,
    ) => QidahenFactionId;
    resolveSunYuanhuaTech: (
        state: QidahenCore,
        selection: NonNullable<QidahenCore['sunYuanhuaTechSelection']>,
        choiceId: 'confirm' | 'skip',
        dependencies?: QidahenArmamentUpgradeResolutionDependencies,
    ) => QidahenSunYuanhuaTechResolutionResult;
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
    applyVictoryStatus: (
        state: QidahenCore,
    ) => QidahenCore;
    syncFactionActionWindow: (
        state: QidahenCore,
        factionId: QidahenFactionId,
    ) => QidahenCore;
    advanceTurnIfReady: (
        state: QidahenCore,
        timestamp: number,
    ) => QidahenCore;
}

type QidahenSunYuanhuaTechResolvedEvent = Extract<
    QidahenEvent,
    { type: 'SUN_YUANHUA_TECH_RESOLVED' }
>;

export const resolveQidahenSelectedArmamentUpgradeExecution = (
    state: QidahenCore,
    factions: QidahenCore['factions'],
    currentFactionId: QidahenFactionId,
    selectedArmamentId: QidahenArmamentId | null,
    timestamp: number,
    dependencies: QidahenArmamentUpgradeResolutionDependencies = {
        buildSeasonSummary,
        upgradeLowFidelityArmament,
    },
): QidahenSelectedArmamentUpgradeExecutionResult => {
    const upgradeResult = dependencies.upgradeLowFidelityArmament(
        factions[currentFactionId].armaments,
        selectedArmamentId,
    );
    const nextFactions: QidahenCore['factions'] = {
        ...factions,
        [currentFactionId]: {
            ...factions[currentFactionId],
            armaments: upgradeResult.armaments,
        },
    };
    const upgradedArmamentLine = upgradeResult.upgradedArmament
        ? `${state.factions[currentFactionId].name}将${upgradeResult.upgradedArmament.name}升级到${upgradeResult.upgradedArmament.level}级。`
        : `${state.factions[currentFactionId].name} 当前没有可升级军备。`;

    return {
        factions: nextFactions,
        lastSeasonSummary: dependencies.buildSeasonSummary('升级军备', timestamp, [
            `${upgradedArmamentLine} 军备升级完成。`,
        ]),
    };
};

const resolveQidahenSunYuanhuaTech = (
    state: QidahenCore,
    selection: NonNullable<QidahenCore['sunYuanhuaTechSelection']>,
    choiceId: 'confirm' | 'skip',
    dependencies: QidahenArmamentUpgradeResolutionDependencies = {
        buildSeasonSummary,
        upgradeLowFidelityArmament,
    },
): QidahenSunYuanhuaTechResolutionResult => {
    if (choiceId === 'skip') {
        return {
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: state.selectedRegionId,
            summaryLines: ['孙元化本次放弃弃牌打科技。'],
            logText: '孙元化本次放弃弃牌打科技。',
        };
    }

    if (selection.selectedCardIds.length < selection.requiredCardCount) {
        return {
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: state.selectedRegionId,
            summaryLines: ['孙元化本次未完成弃牌打科技。'],
            logText: '孙元化本次未完成弃牌打科技。',
        };
    }

    const removedCardIds = new Set(selection.selectedCardIds.slice(0, selection.requiredCardCount));
    const upgradeResult = dependencies.upgradeLowFidelityArmament(
        state.factions.ming.armaments,
        selection.armamentId ?? null,
    );
    if (!upgradeResult.upgradedArmament) {
        return {
            factions: state.factions,
            handCards: state.handCards,
            discardPileCount: state.discardPileCount,
            selectedRegionId: state.selectedRegionId,
            summaryLines: ['大明当前没有可继续提升的科技。'],
            logText: '孙元化本次尝试打科技，但大明当前没有可继续提升的科技。',
        };
    }

    return {
        factions: {
            ...state.factions,
            ming: {
                ...state.factions.ming,
                handCount: Math.max(0, state.factions.ming.handCount - selection.requiredCardCount),
                discardPileCount: Math.max(0, state.factions.ming.discardPileCount ?? 0) + selection.requiredCardCount,
                armaments: upgradeResult.armaments,
            },
        },
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + selection.requiredCardCount,
        selectedRegionId: state.selectedRegionId,
        summaryLines: [
            '大明因孙元化弃 2 张手牌，打出 1 张科技。',
            `${upgradeResult.upgradedArmament.name} 升至 ${upgradeResult.upgradedArmament.level} 级。`,
        ],
        logText: `孙元化弃 2 张手牌，令大明 ${upgradeResult.upgradedArmament.name} 升至 ${upgradeResult.upgradedArmament.level} 级。`,
    };
};

export const resolveQidahenSunYuanhuaTechResolvedEvent = (
    state: QidahenCore,
    event: QidahenSunYuanhuaTechResolvedEvent,
    dependencies: QidahenSunYuanhuaTechResolvedEventDependencies = {
        getFactionIdByPlayerId,
        resolveSunYuanhuaTech: resolveQidahenSunYuanhuaTech,
        buildSeasonSummary,
        applyVictoryStatus: applyQidahenVictoryStatus,
        syncFactionActionWindow,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore => {
    if (!state.sunYuanhuaTechSelection) {
        return state;
    }
    const currentFactionId = dependencies.getFactionIdByPlayerId(state, event.payload.playerId);
    const resolution = dependencies.resolveSunYuanhuaTech(
        state,
        state.sunYuanhuaTechSelection,
        event.payload.choiceId,
    );
    const resolvedState = dependencies.applyVictoryStatus({
        ...state,
        selectedRegionId: resolution.selectedRegionId,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(resolution.selectedRegionId),
        turnPhase: 'action-window',
        recruitSelection: null,
        maShiTradeSelection: null,
        khanEdictSelection: null,
        diplomacyProgress: null,
        handLimitDiscardSelection: null,
        sunYuanhuaTechSelection: null,
        gaoDiDispatchSelection: null,
        wheelDispatchProgress: null,
        pendingTargetAction: null,
        postBattleSelection: null,
        factions: resolution.factions,
        handCards: resolution.handCards,
        discardPileCount: resolution.discardPileCount,
        lastSeasonSummary: dependencies.buildSeasonSummary(
            '孙元化弃牌科技',
            event.timestamp,
            resolution.summaryLines,
        ),
        actionLog: [
            {
                id: `log-sun-yuanhua-tech-${event.timestamp}`,
                faction: currentFactionId,
                text: resolution.logText,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return dependencies.advanceTurnIfReady(
        dependencies.syncFactionActionWindow(resolvedState, currentFactionId),
        event.timestamp,
    );
};
