import type { RandomFn } from '../../../engine/types';
import {
    createQidahenStructuredBattleRolls,
} from './battleRollMath';
import { syncFactionActionWindow } from './factionActionWindow';
import {
    getCurrentFactionId,
    getFactionIdByPlayerId,
} from './factionTurnAccessors';
import {
    getQidahenInteractionSelectionStateForCore,
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
} from './interactionSelectionAccessors';
import { normalizePendingTargetInteractionPayload } from './pendingTargetChoicePayload';
import {
    applyRequestedCommittedTroops,
} from './pendingBattleCommittedTroops';
import {
    applyPendingActionResolutionToBattleFlowState,
    applyPostBattleDecisionResolutionToBattleFlowState,
} from './pendingBattleStateTransition';
import {
    resolvePendingTargetActionByActionType,
} from './pendingTargetResolution';
import {
    type QidahenPostBattleDecisionResolution,
    resolvePostBattleDecision as resolveQidahenPostBattleDecisionByChoice,
} from './postBattleDecisionResolution';
import {
    advanceQidahenTurnIfReady,
} from './turnAdvance';
import {
    advanceQidahenDefeatInDetailResolution,
} from './defeatInDetail';
import { buildQidahenFeignedRetreatSelection } from './feignedRetreatSelection';
import { getDefenderCavalryEvasion, takePreferredCityGarrison } from './pendingBattleCombatSupport';
import { subtractSpecialTroopStacks, mergeSpecialTroopStackGroupsAsPieces } from './troopCompat';
import { getQidahenEffectivePopulation } from './populationRules';
import { updateQidahenForceCommitmentsForCityBattle } from './battleForceCommitments';
import type {
    QidahenBattleRolls,
    QidahenCasualtyPriority,
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenPlunderSource,
    QidahenPostBattleSelection,
    QidahenRetreatLossMode,
} from './types';
import {
    applyQidahenVictoryStatus,
} from './victoryResolution';

type PendingActionResolvedPayload = Extract<QidahenEvent, { type: 'PENDING_ACTION_RESOLVED' }>['payload'];

type QidahenPendingBattleFlowResolution = Pick<
    QidahenCore,
    'regions' | 'factions' | 'drawPileCount' | 'discardPileCount' | 'handCards'
> & {
    logText: string;
    selectedRegionId: string;
    postBattleSelection: QidahenPostBattleSelection | null;
    pendingTargetAction: QidahenPendingTargetAction | null;
};

interface QidahenPendingBattleFlowStateTransitionDependencies {
    getFactionIdByPlayerId: (
        state: QidahenCore,
        playerId: string,
    ) => QidahenFactionId;
    getCurrentFactionId: (
        state: QidahenCore,
    ) => QidahenFactionId;
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

interface QidahenPendingBattleFlowDependencies extends QidahenPendingBattleFlowStateTransitionDependencies {
    applyRequestedCommittedTroops: (
        state: QidahenCore,
        pendingTargetAction: QidahenPendingTargetAction,
        requestedCommittedTroops?: number,
    ) => QidahenPendingTargetAction;
    createStructuredBattleRolls: (
        state: QidahenCore,
        pendingTargetAction: QidahenPendingTargetAction,
        random: RandomFn,
        options: {
            defenderSortieBattle: boolean;
            defenderHoldCity: boolean;
            defenderCavalryEvasion: boolean;
            attackerCavalryPlunder: boolean;
        },
    ) => QidahenBattleRolls | null;
    resolvePendingTargetAction: (
        state: QidahenCore,
        pendingTargetAction: QidahenPendingTargetAction,
        retreatLossMode?: QidahenRetreatLossMode,
        defenderSortieBattle?: boolean,
        defenderHoldCity?: boolean,
        defenderCavalryEvasion?: boolean,
        attackerCavalryPlunder?: boolean,
        attackerCavalryPlunderSource?: QidahenPlunderSource,
        defenderCavalryEvasionPreferredRegionId?: string,
        attackerCasualtyPriority?: QidahenCasualtyPriority,
        defenderCasualtyPriority?: QidahenCasualtyPriority,
        battleRolls?: QidahenBattleRolls | null,
    ) => QidahenPendingBattleFlowResolution;
    resolvePostBattleDecision: (
        state: QidahenCore,
        selection: QidahenPostBattleSelection,
        choiceId: string,
    ) => QidahenPostBattleDecisionResolution;
}

export const resolveQidahenPendingActionFromPayload = (
    state: QidahenCore,
    payload: PendingActionResolvedPayload,
    timestamp: number,
    dependencies: QidahenPendingBattleFlowDependencies = {
        applyRequestedCommittedTroops,
        createStructuredBattleRolls: createQidahenStructuredBattleRolls,
        resolvePendingTargetAction: resolvePendingTargetActionByActionType,
        resolvePostBattleDecision: resolveQidahenPostBattleDecisionByChoice,
        getFactionIdByPlayerId,
        getCurrentFactionId,
        applyVictoryStatus: applyQidahenVictoryStatus,
        syncFactionActionWindow,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore => {
    const currentPendingTargetAction = getQidahenInteractionSelectionStateForCore(
        payload.pendingTargetAction,
        state,
        getQidahenPendingTargetActionForCore,
    );
    if (!currentPendingTargetAction) {
        return state;
    }
    const pendingTargetAction = currentPendingTargetAction.resolvedBattleRolls ? currentPendingTargetAction : dependencies.applyRequestedCommittedTroops(
        state,
        currentPendingTargetAction,
        payload.committedTroops,
    );
    if (pendingTargetAction.battleStep === 'defender-declaration') {
        let declaredState = state;
        const target = state.regions.find((region) => region.id === pendingTargetAction.targetRuntimeRegionId && !region.isLogicalRegion);
        let battleMode = pendingTargetAction.battleMode;
        let holdCity = payload.defenderHoldCity;
        let declarationLog = '';
        if (target && payload.defenderCavalryEvasion) {
            const evasion = getDefenderCavalryEvasion(state, target, pendingTargetAction, payload.defenderCavalryEvasionRegionId);
            if (evasion) {
                declarationLog = `守方骑兵避战 ${evasion.troops}，撤至 ${evasion.retreatRegion.name}。`;
                declaredState = { ...state, regions: state.regions.map((region) => region.id === target.id
                    ? { ...region, troops: region.troops - evasion.troops, specialTroops: subtractSpecialTroopStacks(region.specialTroops, evasion.specialTroops) }
                    : region.id === evasion.retreatRegion.id
                        ? { ...region, troops: region.troops + evasion.troops, specialTroops: mergeSpecialTroopStackGroupsAsPieces(region.specialTroops, evasion.specialTroops) }
                        : region) };
            }
        }
        if (target && payload.defenderHoldCity) {
            const defense = takePreferredCityGarrison(target, 2);
            const shelteredPopulation = Math.min(2, getQidahenEffectivePopulation(target));
            declaredState = { ...state, regions: state.regions.map((region) => region.id !== target.id ? region : {
                ...region, troops: defense.fieldTroops, specialTroops: defense.fieldSpecialTroops,
                population: Math.max(0, region.population - shelteredPopulation),
                cityState: { troops: defense.shelteredTroops, specialTroops: defense.shelteredSpecialTroops, population: shelteredPopulation },
            }) };
            battleMode = defense.fieldTroops > 0 ? 'field' : 'city';
            holdCity = defense.fieldTroops > 0;
        } else if (payload.defenderSortieBattle) {
            battleMode = 'field';
        }
        const declaredPending: QidahenPendingTargetAction = {
            ...(battleMode === 'city' ? updateQidahenForceCommitmentsForCityBattle(pendingTargetAction) : pendingTargetAction),
            battleStep: 'tactics', battleMode,
            ...(payload.defenderHoldCity && battleMode === 'city' ? { title: `${pendingTargetAction.targetRegionName} 城战待结算` } : {}),
            defenderDeclaration: { defenderSortieBattle: payload.defenderSortieBattle, defenderHoldCity: holdCity },
        };
        const remainingTarget = declaredState.regions.find((region) => region.id === pendingTargetAction.targetRuntimeRegionId);
        if (payload.defenderCavalryEvasion && remainingTarget?.troops === 0) {
            const resolved = resolveQidahenPendingActionFromPayload(declaredState, {
                playerId: state.factions[pendingTargetAction.attackerFactionId].playerId,
                pendingTargetAction: declaredPending,
            }, timestamp, dependencies);
            return { ...resolved, lastSeasonSummary: resolved.lastSeasonSummary
                ? { ...resolved.lastSeasonSummary, lines: [declarationLog, ...resolved.lastSeasonSummary.lines] } : null };
        }
        return {
            ...declaredState, pendingTargetAction: declaredPending,
        };
    }
    payload = { ...payload, ...pendingTargetAction.defenderDeclaration };
    if (pendingTargetAction.battleStep === 'tactics' && !pendingTargetAction.resolvedBattleRolls && payload.battleRolls) {
        const attackerWins = payload.battleRolls.attackerMorale.survivingCombatTroops > payload.battleRolls.defenderMorale.survivingCombatTroops;
        const loserSurvivors = attackerWins
            ? payload.battleRolls.defenderMorale.survivingCombatTroops : payload.battleRolls.attackerMorale.survivingCombatTroops;
        const loserFaction = attackerWins ? pendingTargetAction.defenderFactionId : pendingTargetAction.attackerFactionId;
        if (loserSurvivors > 0 && loserFaction !== 'neutral' && !payload.battleRolls.cityBattle) {
            return {
                ...state,
                pendingTargetAction: {
                    ...pendingTargetAction, battleStep: 'retreat',
                    resolvedBattleRolls: payload.battleRolls, retreatFactionId: loserFaction,
                },
            };
        }
    }

    const feignedRetreatSelection = buildQidahenFeignedRetreatSelection(
        state,
        pendingTargetAction,
        payload,
    );
    if (feignedRetreatSelection) {
        const defenderFactionLabel = pendingTargetAction.defenderFactionId === 'neutral'
            ? '中立守军'
            : state.factions[pendingTargetAction.defenderFactionId].name;
        return {
            ...state,
            pendingTargetAction,
            feignedRetreatSelection,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '诈败诱敌',
                lines: [
                    `${state.factions[pendingTargetAction.attackerFactionId].name} 宣告骑兵劫掠。`,
                    `${defenderFactionLabel} 可直接点击真实手牌「诈败诱敌」，或选择不使用。`,
                ],
            },
        };
    }
    const resolution = dependencies.resolvePendingTargetAction(
        state,
        pendingTargetAction,
        payload.retreatLossMode ?? 'rear-guard',
        payload.defenderSortieBattle === true,
        payload.defenderHoldCity === true,
        payload.defenderCavalryEvasion === true,
        payload.attackerCavalryPlunder === true,
        payload.attackerCavalryPlunderSource ?? 'attacker',
        payload.defenderCavalryEvasionRegionId,
        payload.attackerCasualtyPriority ?? 'highest-level',
        payload.defenderCasualtyPriority ?? 'highest-level',
        payload.battleRolls,
    );
    const orderedResolution = advanceQidahenDefeatInDetailResolution(
        state,
        pendingTargetAction,
        resolution,
    );
    return applyPendingActionResolutionToBattleFlowState(
        state,
        state.factions[pendingTargetAction.attackerFactionId].playerId,
        pendingTargetAction,
        orderedResolution,
        timestamp,
        dependencies,
    );
};

export const resolveQidahenPendingTargetInteractionChoice = (
    state: QidahenCore,
    choiceId: string,
    value: unknown,
    timestamp: number,
    random: RandomFn,
    interactionPendingTargetAction: QidahenPendingTargetAction | null | undefined,
    dependencies: QidahenPendingBattleFlowDependencies = {
        applyRequestedCommittedTroops,
        createStructuredBattleRolls: createQidahenStructuredBattleRolls,
        resolvePendingTargetAction: resolvePendingTargetActionByActionType,
        resolvePostBattleDecision: resolveQidahenPostBattleDecisionByChoice,
        getFactionIdByPlayerId,
        getCurrentFactionId,
        applyVictoryStatus: applyQidahenVictoryStatus,
        syncFactionActionWindow,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore => {
    const requestedPayload = normalizePendingTargetInteractionPayload(value);
    const currentPendingTargetAction = getQidahenInteractionSelectionStateForCore(
        interactionPendingTargetAction,
        state,
        getQidahenPendingTargetActionForCore,
    );
    const pendingTargetAction = currentPendingTargetAction?.resolvedBattleRolls
        ? currentPendingTargetAction
        : currentPendingTargetAction
        ? dependencies.applyRequestedCommittedTroops(
            state,
            currentPendingTargetAction,
            requestedPayload.committedTroops,
        )
        : null;

    const payload = { ...requestedPayload, ...pendingTargetAction?.defenderDeclaration };
    const battleRolls = pendingTargetAction?.resolvedBattleRolls ?? (pendingTargetAction && pendingTargetAction.battleStep !== 'defender-declaration'
        ? dependencies.createStructuredBattleRolls(state, pendingTargetAction, random, {
            defenderSortieBattle: payload.defenderSortieBattle === true,
            defenderHoldCity: payload.defenderHoldCity === true,
            defenderCavalryEvasion: payload.defenderCavalryEvasion === true,
            attackerCavalryPlunder: payload.attackerCavalryPlunder === true,
        }) : null);

    return resolveQidahenPendingActionFromPayload(state, {
        playerId: state.currentPlayer,
        pendingTargetAction,
        committedTroops: pendingTargetAction?.resolvedBattleRolls ? undefined : payload.committedTroops,
        retreatLossMode: payload.retreatLossMode,
        defenderSortieBattle: payload.defenderSortieBattle,
        defenderHoldCity: payload.defenderHoldCity,
        defenderCavalryEvasion: payload.defenderCavalryEvasion,
        defenderCavalryEvasionRegionId: payload.defenderCavalryEvasionRegionId,
        attackerCavalryPlunder: payload.attackerCavalryPlunder,
        attackerCavalryPlunderSource: payload.attackerCavalryPlunderSource,
        attackerCasualtyPriority: payload.attackerCasualtyPriority,
        defenderCasualtyPriority: payload.defenderCasualtyPriority,
        battleRolls,
    }, timestamp, dependencies);
};

export const resolveQidahenPostBattleInteractionChoice = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    interactionSelection: QidahenPostBattleSelection | null | undefined,
    dependencies: QidahenPendingBattleFlowDependencies = {
        applyRequestedCommittedTroops,
        createStructuredBattleRolls: createQidahenStructuredBattleRolls,
        resolvePendingTargetAction: resolvePendingTargetActionByActionType,
        resolvePostBattleDecision: resolveQidahenPostBattleDecisionByChoice,
        getFactionIdByPlayerId,
        getCurrentFactionId,
        applyVictoryStatus: applyQidahenVictoryStatus,
        syncFactionActionWindow,
        advanceTurnIfReady: advanceQidahenTurnIfReady,
    },
): QidahenCore => {
    const selection = getQidahenInteractionSelectionStateForCore(
        interactionSelection,
        state,
        getQidahenPostBattleSelectionForCore,
    );
    if (!selection) {
        return state;
    }
    const resolution = dependencies.resolvePostBattleDecision(state, selection, choiceId);
    return applyPostBattleDecisionResolutionToBattleFlowState(
        state,
        selection,
        resolution,
        timestamp,
        dependencies,
    );
};
