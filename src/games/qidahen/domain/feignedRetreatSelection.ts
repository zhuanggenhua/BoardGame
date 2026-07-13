import { canUseAttackerCavalryPlunder } from './pendingTargetChoiceOptions';
import type {
    PendingActionResolvedEvent,
    QidahenCore,
    QidahenFeignedRetreatSelection,
    QidahenPendingTargetAction,
} from './types';

export const QIDAHEN_FEIGNED_RETREAT_CARD_DEF_ID = 'qidahen-atlas05-1660-feigned-retreat-lure-enemy' as const;

export const buildQidahenFeignedRetreatSelection = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    payload: PendingActionResolvedEvent['payload'],
): QidahenFeignedRetreatSelection | null => {
    if (
        payload.attackerCavalryPlunder !== true
        || payload.feignedRetreatResponseResolved === true
        || pendingTargetAction.defenderFactionId === 'neutral'
        || !canUseAttackerCavalryPlunder(state, pendingTargetAction)
    ) {
        return null;
    }
    const card = state.handCards.find((candidate) => (
        candidate.cardDefId === QIDAHEN_FEIGNED_RETREAT_CARD_DEF_ID
        && candidate.faction === pendingTargetAction.defenderFactionId
        && candidate.cardKind === 'tactic'
        && candidate.status !== 'disabled'
    ));
    if (!card) {
        return null;
    }
    return {
        cardId: card.id,
        cardDefId: QIDAHEN_FEIGNED_RETREAT_CARD_DEF_ID,
        factionId: pendingTargetAction.defenderFactionId,
        attackerFactionId: pendingTargetAction.attackerFactionId,
        targetRuntimeRegionId: pendingTargetAction.targetRuntimeRegionId,
        targetRegionName: pendingTargetAction.targetRegionName,
        pendingTargetAction: {
            ...pendingTargetAction,
        },
        cavalryPlunderPayload: {
            ...payload,
            pendingTargetAction: {
                ...pendingTargetAction,
            },
            battleRolls: null,
        },
    };
};

export const isQidahenFeignedRetreatCardPlayable = (
    state: QidahenCore,
    card: Pick<QidahenCore['handCards'][number], 'id' | 'cardDefId' | 'faction' | 'cardKind' | 'status'>,
): boolean => {
    const selection = state.feignedRetreatSelection;
    return Boolean(
        selection
        && card.id === selection.cardId
        && card.cardDefId === QIDAHEN_FEIGNED_RETREAT_CARD_DEF_ID
        && card.faction === selection.factionId
        && card.cardKind === 'tactic'
        && card.status !== 'disabled',
    );
};

export const playQidahenFeignedRetreat = (
    state: QidahenCore,
    cardId: string,
    timestamp: number,
): QidahenCore => {
    const selection = state.feignedRetreatSelection;
    const card = state.handCards.find((candidate) => candidate.id === cardId);
    if (!selection || !card || !isQidahenFeignedRetreatCardPlayable(state, card)) {
        return state;
    }
    return {
        ...state,
        feignedRetreatSelection: null,
        handCards: state.handCards.filter((candidate) => candidate.id !== cardId),
        discardPileCount: state.discardPileCount + 1,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '诈败诱敌',
            lines: [
                `${state.factions[selection.factionId].name} 打出战术牌「${card.label}」。`,
                '取消本次骑兵劫掠，原宣告骑兵立即投入正常战斗并按正常规则撤退。',
            ],
        },
        actionLog: [
            ...state.actionLog,
            {
                id: `log-${timestamp}`,
                text: `${state.factions[selection.factionId].name} 打出「${card.label}」，取消骑兵劫掠并迫使敌方骑兵投入战斗。`,
                timestamp,
            },
        ],
    };
};
