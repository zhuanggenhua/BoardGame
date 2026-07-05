import {
    resolveSelectedArmamentIdFromCards,
} from './armamentLowFidelity';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { updateQidahenTurnLabel } from './turnLabelState';
import { getActionChoiceById } from './factionActionWindow';
import { getQidahenPaymentResourceLabel } from './factionActionWindow';
import { getFactionIdByPlayerId } from './factionTurnAccessors';
import { getMarriageSubjugationBlockedReason } from './pendingTargetActionBuilder';
import {
    buildQidahenCounterSpyPlotSelection,
    buildQidahenGinsengAndSableOpponentSelection,
    buildQidahenMongolNoblesCongressEffectSelection,
    buildQidahenPowerStruggleCoupCharacterJudgementSelection,
    buildQidahenTributeEdictOpponentSelection,
} from './eventCharacterTargetSelection';
import type {
    QidahenArmamentId,
    QidahenCore,
    QidahenSeasonSummary,
} from './types';

interface QidahenSelectedActionPreparationDependencies {
    updateTurnLabel: (
        state: QidahenCore,
    ) => QidahenCore;
    resolveSelectedArmamentIdFromCards: (
        handCards: QidahenCore['handCards'],
        cardIds: readonly string[],
    ) => QidahenArmamentId | null;
    buildSeasonSummary: (
        title: string,
        timestamp: number,
        lines: string[],
    ) => QidahenSeasonSummary;
}

interface QidahenSelectedActionPreparedState {
    actionLabel: string;
    currentFactionId: ReturnType<typeof getFactionIdByPlayerId>;
    discardedCardCount: number;
    nextFactions: QidahenCore['factions'];
    paidHandCards: QidahenCore['handCards'];
    selectedEventActionCardDefId: string | null;
    selectedEventActionCardLabel: string | null;
    selectedEventActionCardRemovedFromGame: boolean;
    selectedEventActionCardPersistent: boolean;
    selectedEventActionRulesSummary: string | null;
    selectedHandActionCardLabel: string | null;
    selectedHandActionCardDefId: string | null;
    selectedPaymentResourceLabels: string[];
    selectedArmamentId: QidahenArmamentId | null;
    spentCardCount: number;
}

type QidahenSelectedActionPreparationResult =
    | {
        kind: 'blocked';
        state: QidahenCore;
    }
    | ({
        kind: 'prepared';
    } & QidahenSelectedActionPreparedState);

export function prepareQidahenSelectedAction(
    state: QidahenCore,
    playerId: string,
    actionId: string,
    cardIds: readonly string[],
    timestamp: number,
    dependencies: QidahenSelectedActionPreparationDependencies = {
        updateTurnLabel: updateQidahenTurnLabel,
        resolveSelectedArmamentIdFromCards,
        buildSeasonSummary,
    },
): QidahenSelectedActionPreparationResult {
    const currentFactionId = getFactionIdByPlayerId(state, playerId);
    const currentFactionCardIds = new Set(
        state.handCards
            .filter((card) => card.faction === currentFactionId)
            .map((card) => card.id),
    );
    const spentCardIds = cardIds.filter((cardId) => currentFactionCardIds.has(cardId));
    const selectedCardIds = new Set(spentCardIds);
    const spentCardCount = spentCardIds.length;
    const selectedArmamentId = dependencies.resolveSelectedArmamentIdFromCards(state.handCards, spentCardIds);
    const selectedEventActionCard = actionId === 'play-event-card'
        ? state.handCards.find((card) => (
            spentCardIds.includes(card.id)
            && card.cardKind === 'event'
            && card.cardDefId != null
        )) ?? null
        : null;
    const selectedEventActionCardRemovedFromGame = Boolean(
        selectedEventActionCard?.rulesSummary?.includes('使用后移出游戏')
        || selectedEventActionCard?.rulesSummary?.includes('持续事件'),
    );
    const selectedEventActionCardPersistent = Boolean(selectedEventActionCard?.rulesSummary?.includes('持续事件'));
    const selectedEventIsGinsengAndSable = selectedEventActionCard?.cardDefId === 'qidahen-atlas05-1630-ginseng-and-sable';
    const selectedEventIsTributeEdict = selectedEventActionCard?.cardDefId === 'qidahen-atlas05-1633-tribute-edict';
    const selectedEventRequiresOpponentDiscardOwner = Boolean(
        selectedEventActionCard?.rulesSummary?.includes('放入该对手弃牌堆')
        && !(selectedEventIsGinsengAndSable && currentFactionId !== 'jin')
        && !selectedEventIsTributeEdict
    );
    const selectedEventIsMongolNoblesCongress = selectedEventActionCard?.cardDefId === 'qidahen-atlas05-1623-mongol-nobles-congress';
    const selectedEventIsPowerStruggleCoup = selectedEventActionCard?.cardDefId === 'qidahen-atlas05-1621-power-struggle-coup';
    const selectedEventRequiresUnimplementedTargetChoice = Boolean(
        (
            selectedEventActionCard?.rulesSummary?.includes('指定并移除一张对手场上的人物牌')
            && selectedEventActionCard.cardDefId !== 'qidahen-atlas05-1600-counter-spy-plot'
        )
        || (
            selectedEventActionCard?.rulesSummary?.includes('执行两项效果之一')
            && !(selectedEventIsMongolNoblesCongress && currentFactionId !== 'mongol')
            && !selectedEventIsPowerStruggleCoup
        ),
    );
    const selectedEventIsNortheastArmy = selectedEventActionCard?.cardDefId === 'qidahen-atlas05-1631-northeast-army';
    const selectedEventIsNortheastArmyBlockedByNewYear = Boolean(
        selectedEventIsNortheastArmy
        && state.actionWheelPosition === 'wheel-new-year'
    );
    const selectedEventRequiresUnimplementedTimingOrBoardTarget = Boolean(
        selectedEventActionCard?.rulesSummary?.includes('只能在遭到攻击时自手牌打出')
        || (
            selectedEventActionCard?.rulesSummary?.includes('放置甲喇标记')
            && !selectedEventIsNortheastArmy
        ),
    );
    const discardedCardCount = Math.max(0, spentCardCount - (selectedEventActionCardRemovedFromGame ? 1 : 0));
    const selectedArmamentActionCard = actionId === 'upgrade-armament'
        ? state.handCards.find((card) => (
            spentCardIds.includes(card.id)
            && card.cardKind === 'armament'
            && card.armamentId === selectedArmamentId
        )) ?? null
        : null;
    const selectedHandActionCardLabel = selectedArmamentActionCard?.label ?? null;
    const selectedHandActionCardDefId = selectedArmamentActionCard?.cardDefId ?? null;
    const selectedPaymentResourceLabels = state.handCards
        .filter((card) => spentCardIds.includes(card.id))
        .map((card) => getQidahenPaymentResourceLabel(card))
        .filter((label): label is string => label != null);
    const actionLabel = getActionChoiceById(actionId)?.label ?? actionId;
    const marriageSubjugationBlockedReason = actionId === 'marriage-subjugation'
        ? getMarriageSubjugationBlockedReason(
            state,
            state.regions.find((region) => region.id === state.selectedRegionId),
        )
        : null;

    if (marriageSubjugationBlockedReason) {
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                lastSeasonSummary: dependencies.buildSeasonSummary('联姻诱降', timestamp, [
                    marriageSubjugationBlockedReason,
                ]),
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: currentFactionId,
                        text: `${state.factions[currentFactionId].name} 尝试执行 ${actionLabel}，但 ${marriageSubjugationBlockedReason}`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            }),
        };
    }

    if (selectedEventIsGinsengAndSable && currentFactionId === 'jin' && selectedEventActionCard) {
        const selection = buildQidahenGinsengAndSableOpponentSelection(
            state,
            currentFactionId,
            selectedEventActionCard,
            spentCardIds,
        );
        if (!selection) {
            return {
                kind: 'blocked',
                state: dependencies.updateTurnLabel({
                    ...state,
                    lastSeasonSummary: dependencies.buildSeasonSummary('人参貂皮', timestamp, [
                        '人参貂皮需要指定一个有手牌的对手；当前没有合法目标。',
                        '本次未消耗手牌，也未结算事件效果。',
                    ]),
                    actionLog: [
                        {
                            id: `log-${timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 尝试执行事件「人参貂皮」，但当前没有有手牌的对手可指定。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                }),
            };
        }
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                turnPhase: 'event-opponent-hand-choice',
                eventOpponentHandChoiceSelection: selection,
                lastSeasonSummary: dependencies.buildSeasonSummary('人参貂皮', timestamp, [
                    '指定一个有手牌的对手；随后由该对手选择给出哪张手牌。',
                    '结算后人参貂皮进入该对手弃牌堆。',
                ]),
            }),
        };
    }

    if (selectedEventIsTributeEdict && selectedEventActionCard) {
        const selection = buildQidahenTributeEdictOpponentSelection(
            state,
            currentFactionId,
            selectedEventActionCard,
            spentCardIds,
        );
        if (!selection) {
            return {
                kind: 'blocked',
                state: dependencies.updateTurnLabel({
                    ...state,
                    lastSeasonSummary: dependencies.buildSeasonSummary('封贡敕书', timestamp, [
                        '封贡敕书需要指定一个对手执行赐印招安或驱虎吞狼；当前没有合法对手。',
                        '本次未消耗手牌，也未结算事件效果。',
                    ]),
                    actionLog: [
                        {
                            id: `log-${timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 尝试执行事件「封贡敕书」，但当前没有可指定的对手。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                }),
            };
        }
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                turnPhase: 'event-opponent-hand-choice',
                eventOpponentHandChoiceSelection: selection,
                lastSeasonSummary: dependencies.buildSeasonSummary('封贡敕书', timestamp, [
                    '指定一个对手；随后由该对手选择执行赐印招安或驱虎吞狼。',
                    '选择后封贡敕书进入该对手弃牌堆；具体行动效果仍需后续承接。',
                ]),
            }),
        };
    }

    if (selectedEventIsMongolNoblesCongress && currentFactionId === 'mongol' && selectedEventActionCard) {
        const selection = buildQidahenMongolNoblesCongressEffectSelection(
            state,
            currentFactionId,
            selectedEventActionCard,
            spentCardIds,
        );
        if (!selection) {
            return {
                kind: 'blocked',
                state: dependencies.updateTurnLabel({
                    ...state,
                    lastSeasonSummary: dependencies.buildSeasonSummary('王公大会', timestamp, [
                        '王公大会需要可打出的蒙古人物，或已登场在大明/后金侧的蒙古人物；当前没有合法选择。',
                        '本次未消耗手牌，也未结算事件效果。',
                    ]),
                    actionLog: [
                        {
                            id: `log-${timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 尝试执行事件「王公大会」，但当前没有可执行的蒙古人物选择。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                }),
            };
        }
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                turnPhase: 'event-opponent-hand-choice',
                eventOpponentHandChoiceSelection: selection,
                lastSeasonSummary: dependencies.buildSeasonSummary('王公大会', timestamp, [
                    '选择打出 1 张蒙古人物，或回收 1 张已登场在大明/后金侧的蒙古人物。',
                ]),
            }),
        };
    }

    if (selectedEventRequiresOpponentDiscardOwner && selectedEventActionCard) {
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                lastSeasonSummary: dependencies.buildSeasonSummary('执行事件', timestamp, [
                    `${selectedEventActionCard.label} 需要指定对手，并结算进入该对手弃牌堆；当前事件执行入口尚未实现这条跨势力归属链。`,
                    '本次未消耗手牌，也未结算事件效果。',
                ]),
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: currentFactionId,
                        text: `${state.factions[currentFactionId].name} 尝试执行事件「${selectedEventActionCard.label}」，但需要对手选择和对手弃牌堆归属链，当前尚未结算。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            }),
        };
    }

    if (selectedEventActionCard?.cardDefId === 'qidahen-atlas05-1600-counter-spy-plot') {
        const selection = buildQidahenCounterSpyPlotSelection(
            state,
            currentFactionId,
            selectedEventActionCard,
            spentCardIds,
        );
        if (!selection) {
            return {
                kind: 'blocked',
                state: dependencies.updateTurnLabel({
                    ...state,
                    lastSeasonSummary: dependencies.buildSeasonSummary('执行事件', timestamp, [
                        '反间计需要一个可被指定的对手在场人物；当前没有合法目标。',
                        '本次未消耗手牌，也未结算事件效果。',
                    ]),
                    actionLog: [
                        {
                            id: `log-${timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 尝试执行事件「反间计」，但当前没有可指定的对手在场人物。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                }),
            };
        }
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                turnPhase: 'event-character-target',
                eventCharacterTargetSelection: selection,
                lastSeasonSummary: dependencies.buildSeasonSummary('反间计', timestamp, [
                    '选择一张合法的对手在场人物牌并移出游戏。',
                    '不能对努尔哈赤、林丹汗、阿巴凯使用。',
                ]),
            }),
        };
    }

    if (selectedEventIsPowerStruggleCoup && selectedEventActionCard) {
        const selection = buildQidahenPowerStruggleCoupCharacterJudgementSelection(
            state,
            currentFactionId,
            selectedEventActionCard,
            spentCardIds,
        );
        if (!selection) {
            return {
                kind: 'blocked',
                state: dependencies.updateTurnLabel({
                    ...state,
                    lastSeasonSummary: dependencies.buildSeasonSummary('开门迎降', timestamp, [
                        '开门迎降的人物判定窄口需要一个可按既有人物判定表结算的敌方在场人物；当前没有合法目标。',
                        '第二项效果文本仍未锁定，本次未消耗手牌，也未结算事件效果。',
                    ]),
                    actionLog: [
                        {
                            id: `log-${timestamp}`,
                            faction: currentFactionId,
                            text: `${state.factions[currentFactionId].name} 尝试执行事件「开门迎降」，但当前没有可判定的敌方在场人物。`,
                        },
                        ...state.actionLog,
                    ].slice(0, 6),
                }),
            };
        }
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                turnPhase: 'event-character-target',
                eventCharacterTargetSelection: selection,
                lastSeasonSummary: dependencies.buildSeasonSummary('开门迎降', timestamp, [
                    '选择一张敌方在场人物，按既有人物额外判定表执行一次掷骰判定。',
                    '第二项效果文本仍未锁定，本次只承接人物判定窄口。',
                ]),
            }),
        };
    }

    if (selectedEventIsNortheastArmyBlockedByNewYear && selectedEventActionCard) {
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                lastSeasonSummary: dependencies.buildSeasonSummary('执行事件', timestamp, [
                    '东北大军不能在轮盘行动标记走到新年时使用。',
                    '本次未消耗手牌，也未结算事件效果。',
                ]),
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: currentFactionId,
                        text: `${state.factions[currentFactionId].name} 尝试执行事件「东北大军」，但轮盘行动标记在新年位置，当前不能使用。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            }),
        };
    }

    if (selectedEventRequiresUnimplementedTargetChoice && selectedEventActionCard) {
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                lastSeasonSummary: dependencies.buildSeasonSummary('执行事件', timestamp, [
                    `${selectedEventActionCard.label} 需要目标选择或二择一效果选择；当前事件执行入口尚未实现这条承接链。`,
                    '本次未消耗手牌，也未结算事件效果。',
                ]),
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: currentFactionId,
                        text: `${state.factions[currentFactionId].name} 尝试执行事件「${selectedEventActionCard.label}」，但需要目标选择或二择一效果选择，当前尚未结算。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            }),
        };
    }

    if (selectedEventRequiresUnimplementedTimingOrBoardTarget && selectedEventActionCard) {
        return {
            kind: 'blocked',
            state: dependencies.updateTurnLabel({
                ...state,
                lastSeasonSummary: dependencies.buildSeasonSummary('执行事件', timestamp, [
                    `${selectedEventActionCard.label} 需要特定打出时机或地图目标选择；当前事件执行入口尚未实现这条承接链。`,
                    '本次未消耗手牌，也未结算事件效果。',
                ]),
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: currentFactionId,
                        text: `${state.factions[currentFactionId].name} 尝试执行事件「${selectedEventActionCard.label}」，但需要特定时机或地图目标选择，当前尚未结算。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            }),
        };
    }

    return {
        kind: 'prepared',
        actionLabel,
        currentFactionId,
        discardedCardCount,
        nextFactions: {
            ...state.factions,
            [currentFactionId]: {
                ...state.factions[currentFactionId],
                handCount: Math.max(0, state.factions[currentFactionId].handCount - spentCardCount),
                discardPileCount: Math.max(0, state.factions[currentFactionId].discardPileCount ?? 0) + discardedCardCount,
            },
        },
        paidHandCards: state.handCards.filter((card) => !selectedCardIds.has(card.id)),
        selectedEventActionCardDefId: selectedEventActionCard?.cardDefId ?? null,
        selectedEventActionCardLabel: selectedEventActionCard?.label ?? null,
        selectedEventActionCardRemovedFromGame,
        selectedEventActionCardPersistent,
        selectedEventActionRulesSummary: selectedEventActionCard?.rulesSummary ?? null,
        selectedHandActionCardLabel,
        selectedHandActionCardDefId,
        selectedPaymentResourceLabels,
        selectedArmamentId,
        spentCardCount,
    };
}
