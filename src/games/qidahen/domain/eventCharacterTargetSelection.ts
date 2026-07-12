import { buildDriveTigerDispatchSelectionFromRegionSemantics } from './dispatchSelectionBuilders';
import { buildPaymentState } from './factionActionWindow';
import {
    buildQidahenRegionFocusState,
    getQidahenLockedRegionSelectionSemantics,
} from './regionFocusSemantics';
import { buildGrantPardonSelectionFromRegionSemantics } from './selectionBuilders';
import {
} from './seasonResolution';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenCore,
    QidahenEventCharacterTargetSelection,
    QidahenEventOpponentHandChoiceSelection,
    QidahenFactionId,
    QidahenHandCard,
} from './types';

const COUNTER_SPY_PLOT_CARD_DEF_ID = 'qidahen-atlas05-1600-counter-spy-plot';
const MONGOL_NOBLES_CONGRESS_CARD_DEF_ID = 'qidahen-atlas05-1623-mongol-nobles-congress';
const GINSENG_AND_SABLE_CARD_DEF_ID = 'qidahen-atlas05-1630-ginseng-and-sable';
const TRIBUTE_EDICT_CARD_DEF_ID = 'qidahen-atlas05-1633-tribute-edict';
const COUNTER_SPY_PLOT_EXCLUDED_CHARACTER_IDS = new Set([
    'jin-nurhaci',
    'mongol-lindan-hutuktu',
    'jin-abakai',
]);

export function buildQidahenCounterSpyPlotSelection(
    state: QidahenCore,
    ownerFactionId: QidahenFactionId,
    eventCard: QidahenHandCard,
    paymentCardIds: readonly string[],
): QidahenEventCharacterTargetSelection | null {
    const choices = (Object.keys(state.factions) as QidahenFactionId[])
        .filter((factionId) => factionId !== ownerFactionId)
        .flatMap((factionId) => {
            const faction = state.factions[factionId];
            return faction.characters
                .filter((character) => (
                    character.inPlay
                    && !character.removedFromGame
                    && !COUNTER_SPY_PLOT_EXCLUDED_CHARACTER_IDS.has(character.id)
                ))
                .map((character) => ({
                    id: `${factionId}:${character.id}`,
                    characterId: character.id,
                    characterName: character.name,
                    factionId,
                    factionName: faction.name,
                    detail: `移除${faction.name}在场人物「${character.name}」。`,
                }));
        });

    if (choices.length === 0 || eventCard.cardDefId !== COUNTER_SPY_PLOT_CARD_DEF_ID) {
        return null;
    }

    return {
        source: 'counter-spy-plot',
        title: '反间计',
        summary: '弃 2 张手牌，指定并移除一张合法的对手在场人物牌。',
        eventCardId: eventCard.id,
        eventCardDefId: COUNTER_SPY_PLOT_CARD_DEF_ID,
        eventCardLabel: eventCard.label,
        ownerFactionId,
        ownerFactionName: state.factions[ownerFactionId].name,
        paymentCardIds: [...paymentCardIds],
        choices,
    };
}

export function buildQidahenTributeEdictOpponentSelection(
    state: QidahenCore,
    ownerFactionId: QidahenFactionId,
    eventCard: QidahenHandCard,
    paymentCardIds: readonly string[],
): QidahenEventOpponentHandChoiceSelection | null {
    if (eventCard.cardDefId !== TRIBUTE_EDICT_CARD_DEF_ID) {
        return null;
    }

    const choices = (Object.keys(state.factions) as QidahenFactionId[])
        .filter((factionId) => factionId !== ownerFactionId)
        .map((factionId) => ({
            id: factionId,
            cardId: factionId,
            cardLabel: state.factions[factionId].name,
            cardDefId: null,
            detail: `指定${state.factions[factionId].name}，由该对手选择执行赐印招安或驱虎吞狼。`,
        }));

    if (choices.length === 0) {
        return null;
    }

    return {
        source: 'tribute-edict-opponent',
        title: '封贡敕书',
        summary: '指定 1 个对手，随后由该对手选择执行赐印招安或驱虎吞狼。',
        eventCardId: eventCard.id,
        eventCardDefId: TRIBUTE_EDICT_CARD_DEF_ID,
        eventCardLabel: eventCard.label,
        ownerFactionId,
        ownerFactionName: state.factions[ownerFactionId].name,
        paymentCardIds: [...paymentCardIds],
        choices,
    };
}

function buildQidahenTributeEdictActionSelection(
    state: QidahenCore,
    selection: QidahenEventOpponentHandChoiceSelection,
    targetFactionId: QidahenFactionId,
): QidahenEventOpponentHandChoiceSelection | null {
    const targetFaction = state.factions[targetFactionId];
    if (!targetFaction) {
        return null;
    }

    return {
        ...selection,
        source: 'tribute-edict-action',
        summary: `${targetFaction.name}选择本次封贡敕书要求执行的行动。`,
        targetFactionId,
        targetFactionName: targetFaction.name,
        choices: [
            {
                id: 'grant-pardon',
                cardId: 'grant-pardon',
                cardLabel: '赐印招安',
                cardDefId: null,
                detail: `${targetFaction.name}选择执行赐印招安；随后进入目标部队和接收区选择。`,
            },
            {
                id: 'drive-tiger',
                cardId: 'drive-tiger',
                cardLabel: '驱虎吞狼',
                cardDefId: null,
                detail: `${targetFaction.name}选择执行驱虎吞狼；随后进入既有同意与调度进攻链。`,
            },
        ],
    };
}

export function buildQidahenGinsengAndSableOpponentSelection(
    state: QidahenCore,
    ownerFactionId: QidahenFactionId,
    eventCard: QidahenHandCard,
    paymentCardIds: readonly string[],
): QidahenEventOpponentHandChoiceSelection | null {
    if (eventCard.cardDefId !== GINSENG_AND_SABLE_CARD_DEF_ID || ownerFactionId !== 'jin') {
        return null;
    }

    const choices = (Object.keys(state.factions) as QidahenFactionId[])
        .filter((factionId) => factionId !== ownerFactionId)
        .filter((factionId) => state.handCards.some((card) => card.faction === factionId))
        .map((factionId) => ({
            id: factionId,
            cardId: factionId,
            cardLabel: state.factions[factionId].name,
            cardDefId: null,
            detail: `指定${state.factions[factionId].name}，由该对手选择给出 1 张手牌。`,
        }));

    if (choices.length === 0) {
        return null;
    }

    return {
        source: 'ginseng-and-sable-opponent',
        title: '人参貂皮',
        summary: '指定 1 个有手牌的对手，随后由该对手选择给出哪张手牌。',
        eventCardId: eventCard.id,
        eventCardDefId: GINSENG_AND_SABLE_CARD_DEF_ID,
        eventCardLabel: eventCard.label,
        ownerFactionId,
        ownerFactionName: state.factions[ownerFactionId].name,
        paymentCardIds: [...paymentCardIds],
        choices,
    };
}

function buildQidahenGinsengAndSableCardSelection(
    state: QidahenCore,
    selection: QidahenEventOpponentHandChoiceSelection,
    targetFactionId: QidahenFactionId,
): QidahenEventOpponentHandChoiceSelection | null {
    const targetFaction = state.factions[targetFactionId];
    if (!targetFaction) {
        return null;
    }

    const choices = state.handCards
        .filter((card) => card.faction === targetFactionId)
        .map((card) => ({
            id: card.id,
            cardId: card.id,
            cardLabel: card.label,
            cardDefId: card.cardDefId ?? null,
            detail: `${targetFaction.name}给出手牌「${card.label}」。`,
        }));

    if (choices.length === 0) {
        return null;
    }

    return {
        ...selection,
        source: 'ginseng-and-sable-card',
        summary: `${targetFaction.name}选择给后金的 1 张手牌。`,
        targetFactionId,
        targetFactionName: targetFaction.name,
        choices,
    };
}

export function buildQidahenMongolNoblesCongressEffectSelection(
    state: QidahenCore,
    ownerFactionId: QidahenFactionId,
    eventCard: QidahenHandCard,
    paymentCardIds: readonly string[],
): QidahenEventOpponentHandChoiceSelection | null {
    if (eventCard.cardDefId !== MONGOL_NOBLES_CONGRESS_CARD_DEF_ID || ownerFactionId !== 'mongol') {
        return null;
    }

    const playableCharacters = state.factions.mongol.characters
        .filter((character) => !character.inPlay && !character.removedFromGame);
    const returnableCharacters = (Object.keys(state.factions) as QidahenFactionId[])
        .filter((factionId) => factionId !== 'mongol')
        .flatMap((factionId) => state.factions[factionId].characters.filter((character) => (
            character.faction === 'mongol'
            && character.inPlay
            && !character.removedFromGame
        )));

    const choices = [
        playableCharacters.length > 0
            ? {
                id: 'play-character',
                cardId: 'play-character',
                cardLabel: '打出蒙古人物',
                cardDefId: null,
                detail: '从蒙古人物牌堆选择 1 张未登场的蒙古人物并打出。',
            }
            : null,
        returnableCharacters.length > 0
            ? {
                id: 'return-character',
                cardId: 'return-character',
                cardLabel: '回收蒙古人物',
                cardDefId: null,
                detail: '选择 1 张已登场在大明或后金侧的蒙古人物，拿回蒙古人物牌堆。',
            }
            : null,
    ].filter((choice): choice is NonNullable<typeof choice> => choice != null);

    if (choices.length === 0) {
        return null;
    }

    return {
        source: 'mongol-nobles-congress-effect',
        title: '王公大会',
        summary: '选择打出 1 张蒙古人物，或回收 1 张已登场在大明/后金侧的蒙古人物。',
        eventCardId: eventCard.id,
        eventCardDefId: MONGOL_NOBLES_CONGRESS_CARD_DEF_ID,
        eventCardLabel: eventCard.label,
        ownerFactionId,
        ownerFactionName: state.factions[ownerFactionId].name,
        paymentCardIds: [...paymentCardIds],
        choices,
    };
}

function buildQidahenMongolNoblesCongressCharacterSelection(
    state: QidahenCore,
    selection: QidahenEventOpponentHandChoiceSelection,
    effectChoiceId: string,
): QidahenEventOpponentHandChoiceSelection | null {
    if (effectChoiceId === 'play-character') {
        const choices = state.factions.mongol.characters
            .filter((character) => !character.inPlay && !character.removedFromGame)
            .map((character) => ({
                id: character.id,
                cardId: character.id,
                cardLabel: character.name,
                cardDefId: character.id,
                detail: `打出蒙古人物「${character.name}」。`,
            }));

        if (choices.length === 0) {
            return null;
        }

        return {
            ...selection,
            source: 'mongol-nobles-congress-play-character',
            summary: '选择 1 张蒙古人物牌堆中的人物并打出。',
            choices,
        };
    }

    if (effectChoiceId === 'return-character') {
        const choices = (Object.keys(state.factions) as QidahenFactionId[])
            .filter((factionId) => factionId !== 'mongol')
            .flatMap((factionId) => {
                const faction = state.factions[factionId];
                return faction.characters
                    .filter((character) => (
                        character.faction === 'mongol'
                        && character.inPlay
                        && !character.removedFromGame
                    ))
                    .map((character) => ({
                        id: `${factionId}:${character.id}`,
                        cardId: character.id,
                        cardLabel: `${character.name}（${faction.name}）`,
                        cardDefId: character.id,
                        detail: `将${faction.name}在场蒙古人物「${character.name}」拿回蒙古人物牌堆。`,
                    }));
            });

        if (choices.length === 0) {
            return null;
        }

        return {
            ...selection,
            source: 'mongol-nobles-congress-return-character',
            summary: '选择 1 张已登场在大明或后金侧的蒙古人物并拿回蒙古人物牌堆。',
            choices,
        };
    }

    return null;
}

function finalizeQidahenMongolNoblesCongress(
    state: QidahenCore,
    selection: QidahenEventOpponentHandChoiceSelection,
    timestamp: number,
    nextFactions: QidahenCore['factions'],
    summaryLine: string,
    logDetail: string,
): QidahenCore {
    const removedPaymentCardIds = new Set(selection.paymentCardIds);
    const discardedCardCount = Math.max(0, selection.paymentCardIds.length);
    const nextState = updateQidahenTurnLabel({
        ...state,
        turnPhase: 'action-window',
        eventCharacterTargetSelection: null,
        eventOpponentHandChoiceSelection: null,
        selectedPaymentCardIds: [],
        selectedHandActionCardId: null,
        payment: buildPaymentState('play-event-card', 0),
        handCards: state.handCards.filter((card) => !removedPaymentCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + discardedCardCount,
        factions: {
            ...nextFactions,
            [selection.ownerFactionId]: {
                ...nextFactions[selection.ownerFactionId],
                handCount: Math.max(0, nextFactions[selection.ownerFactionId].handCount - selection.paymentCardIds.length),
                discardPileCount: Math.max(0, nextFactions[selection.ownerFactionId].discardPileCount ?? 0) + discardedCardCount,
            },
        },
        factionActionUsed: true,
        lastFactionActionId: 'play-event-card',
        confirmedActionId: 'play-event-card',
        activeEventCards: state.activeEventCards,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '王公大会',
            lines: [
                summaryLine,
                '王公大会使用后进入蒙古弃牌堆。',
            ],
        },
        actionLog: [
            {
                id: `log-${timestamp}`,
                faction: selection.ownerFactionId,
                text: `${selection.ownerFactionName} 执行事件「王公大会」，${logDetail}，事件牌进入蒙古弃牌堆。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });

    return advanceQidahenTurnIfReady(nextState, timestamp);
}

export function resolveQidahenEventCharacterTargetChoice(
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    selection: QidahenEventCharacterTargetSelection | null = state.eventCharacterTargetSelection,
): QidahenCore {
    if (!selection) {
        return state;
    }
    const choice = selection.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) {
        return state;
    }

    if (selection.source !== 'counter-spy-plot') {
        return state;
    }

    const removedPaymentCardIds = new Set(selection.paymentCardIds);
    const discardedCardCount = Math.max(0, selection.paymentCardIds.length - 1);
    const nextFactions = {
        ...state.factions,
        [selection.ownerFactionId]: {
            ...state.factions[selection.ownerFactionId],
            handCount: Math.max(0, state.factions[selection.ownerFactionId].handCount - selection.paymentCardIds.length),
            discardPileCount: Math.max(0, state.factions[selection.ownerFactionId].discardPileCount ?? 0) + discardedCardCount,
        },
        [choice.factionId]: {
            ...state.factions[choice.factionId],
            characters: state.factions[choice.factionId].characters.map((character) => (
                character.id === choice.characterId
                    ? {
                        ...character,
                        inPlay: false,
                        removedFromGame: true,
                    }
                    : character
            )),
        },
    };
    const nextState = updateQidahenTurnLabel({
        ...state,
        turnPhase: 'action-window',
        eventCharacterTargetSelection: null,
        selectedPaymentCardIds: [],
        selectedHandActionCardId: null,
        payment: buildPaymentState('play-event-card', 0),
        handCards: state.handCards.filter((card) => !removedPaymentCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + discardedCardCount,
        factions: nextFactions,
        factionActionUsed: true,
        lastFactionActionId: 'play-event-card',
        confirmedActionId: 'play-event-card',
        activeEventCards: state.activeEventCards,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '反间计',
            lines: [
                `移除${choice.factionName}在场人物「${choice.characterName}」。`,
                '反间计使用后移出游戏；此牌未进入弃牌堆。',
                discardedCardCount > 0
                    ? `额外弃 ${discardedCardCount} 张手牌作为费用。`
                    : '没有额外弃牌费用。',
            ],
        },
        actionLog: [
            {
                id: `log-${timestamp}`,
                faction: selection.ownerFactionId,
                text: `${selection.ownerFactionName} 执行事件「反间计」，移除${choice.factionName}人物「${choice.characterName}」，事件牌移出游戏。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });

    return advanceQidahenTurnIfReady(nextState, timestamp);
}

export function resolveQidahenEventOpponentHandChoice(
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
    selection: QidahenEventOpponentHandChoiceSelection | null = state.eventOpponentHandChoiceSelection,
): QidahenCore {
    if (!selection) {
        return state;
    }

    if (selection.source === 'tribute-edict-opponent') {
        const nextSelection = buildQidahenTributeEdictActionSelection(
            state,
            selection,
            choiceId as QidahenFactionId,
        );
        if (!nextSelection) {
            return state;
        }
        return updateQidahenTurnLabel({
            ...state,
            turnPhase: 'event-opponent-hand-choice',
            eventOpponentHandChoiceSelection: nextSelection,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '封贡敕书',
                lines: [
                    `${nextSelection.targetFactionName}被指定为封贡敕书目标。`,
                    `等待${nextSelection.targetFactionName}选择执行赐印招安或驱虎吞狼。`,
                ],
            },
        });
    }

    if (selection.source === 'tribute-edict-action') {
        const choice = selection.choices.find((candidate) => candidate.id === choiceId);
        if (!choice || !selection.targetFactionId || !selection.targetFactionName) {
            return state;
        }
        const removedPaymentCardIds = new Set(selection.paymentCardIds);
        const discardedCardCount = Math.max(0, selection.paymentCardIds.length - 1);
        const nextFactions = {
            ...state.factions,
            [selection.ownerFactionId]: {
                ...state.factions[selection.ownerFactionId],
                handCount: Math.max(0, state.factions[selection.ownerFactionId].handCount - selection.paymentCardIds.length),
                discardPileCount: Math.max(0, state.factions[selection.ownerFactionId].discardPileCount ?? 0) + discardedCardCount,
            },
            [selection.targetFactionId]: {
                ...state.factions[selection.targetFactionId],
                discardPileCount: Math.max(0, state.factions[selection.targetFactionId].discardPileCount ?? 0) + 1,
            },
        };
        const nextState = updateQidahenTurnLabel({
            ...state,
            turnPhase: 'action-window',
            eventCharacterTargetSelection: null,
            eventOpponentHandChoiceSelection: null,
            selectedPaymentCardIds: [],
            selectedHandActionCardId: null,
            payment: buildPaymentState('play-event-card', 0),
            handCards: state.handCards.filter((card) => !removedPaymentCardIds.has(card.id)),
            discardPileCount: state.discardPileCount + removedPaymentCardIds.size,
            factions: nextFactions,
            factionActionUsed: true,
            lastFactionActionId: 'play-event-card',
            confirmedActionId: 'play-event-card',
            activeEventCards: state.activeEventCards,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '封贡敕书',
                lines: [
                    `${selection.targetFactionName}选择执行${choice.cardLabel}。`,
                    `封贡敕书使用后进入${selection.targetFactionName}弃牌堆。`,
                    discardedCardCount > 0
                        ? `额外弃 ${discardedCardCount} 张手牌作为费用。`
                        : '没有额外弃牌费用。',
                    choice.id === 'grant-pardon'
                        ? '随后进入赐印招安的目标部队和接收区选择。'
                        : '随后进入驱虎吞狼的同意与调度进攻流程。',
                ],
            },
            actionLog: [
                {
                    id: `log-${timestamp}`,
                    faction: selection.ownerFactionId,
                    text: `${selection.ownerFactionName} 执行事件「封贡敕书」，指定${selection.targetFactionName}选择${choice.cardLabel}，事件牌进入${selection.targetFactionName}弃牌堆。`,
                },
                ...state.actionLog,
            ].slice(0, 6),
        });

        if (choice.id === 'grant-pardon') {
            const executorFactionId = selection.targetFactionId;
            const grantPardonSelection = buildGrantPardonSelectionFromRegionSemantics(
                nextState,
                getQidahenLockedRegionSelectionSemantics(nextState),
                executorFactionId,
            );
            if (!grantPardonSelection) {
                return advanceQidahenTurnIfReady(updateQidahenTurnLabel({
                    ...nextState,
                    lastSeasonSummary: {
                        id: `summary-${timestamp}`,
                        title: '封贡敕书',
                        lines: [
                            `${selection.targetFactionName}选择执行赐印招安。`,
                            `封贡敕书使用后进入${selection.targetFactionName}弃牌堆。`,
                            discardedCardCount > 0
                                ? `额外弃 ${discardedCardCount} 张手牌作为费用。`
                                : '没有额外弃牌费用。',
                            `赐印招安：当前没有与${selection.targetFactionName}控制区相邻的可招安敌军。`,
                        ],
                    },
                }), timestamp);
            }
            const tributeEdictGrantPardonSelection = {
                ...grantPardonSelection,
                executionSource: 'tribute-edict' as const,
                executorFactionId,
            };

            const displayAnchorRegionId = tributeEdictGrantPardonSelection.displayAnchorRegionId
                ?? tributeEdictGrantPardonSelection.sourceRegionId
                ?? nextState.selectedRegionId;
            return updateQidahenTurnLabel({
                ...nextState,
                currentPlayer: state.factions[executorFactionId].playerId,
                turnPhase: 'grant-pardon-choice',
                selectedActionId: 'grant-pardon',
                confirmedActionId: 'grant-pardon',
                selectedPaymentCardIds: [],
                payment: buildPaymentState('grant-pardon', 0, 0),
                grantPardonSelection: tributeEdictGrantPardonSelection,
                selectedRegionId: displayAnchorRegionId,
                regionFocusState: buildQidahenRegionFocusState(displayAnchorRegionId, {
                    lockedSourceRegionId: tributeEdictGrantPardonSelection.sourceRegionId ?? displayAnchorRegionId,
                    displayAnchorRegionId,
                }),
                lastFactionActionId: 'grant-pardon',
                lastSeasonSummary: {
                    id: `summary-${timestamp}`,
                    title: '封贡敕书',
                    lines: [
                        `${selection.targetFactionName}选择执行赐印招安。`,
                        `封贡敕书使用后进入${selection.targetFactionName}弃牌堆。`,
                        discardedCardCount > 0
                            ? `额外弃 ${discardedCardCount} 张手牌作为费用。`
                            : '没有额外弃牌费用。',
                        `等待${selection.targetFactionName}选择赐印招安的目标部队和接收区。`,
                    ],
                },
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: selection.ownerFactionId,
                        text: `${selection.ownerFactionName} 执行事件「封贡敕书」，指定${selection.targetFactionName}执行赐印招安，事件牌进入${selection.targetFactionName}弃牌堆。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            });
        }

        if (choice.id === 'drive-tiger') {
            const commanderFactionId = selection.targetFactionId;
            const dispatchSelection = buildDriveTigerDispatchSelectionFromRegionSemantics(
                nextState,
                commanderFactionId,
                getQidahenLockedRegionSelectionSemantics(nextState),
            );
            if (!dispatchSelection) {
                return advanceQidahenTurnIfReady(updateQidahenTurnLabel({
                    ...nextState,
                    lastSeasonSummary: {
                        id: `summary-${timestamp}`,
                        title: '封贡敕书',
                        lines: [
                            `${selection.targetFactionName}选择执行驱虎吞狼。`,
                            `封贡敕书使用后进入${selection.targetFactionName}弃牌堆。`,
                            discardedCardCount > 0
                                ? `额外弃 ${discardedCardCount} 张手牌作为费用。`
                                : '没有额外弃牌费用。',
                            `驱虎吞狼：当前没有可由${selection.targetFactionName}指挥的对手调度进攻来源。`,
                        ],
                    },
                }), timestamp);
            }

            return updateQidahenTurnLabel({
                ...nextState,
                currentPlayer: state.factions[commanderFactionId].playerId,
                turnPhase: 'drive-tiger-consent',
                selectedActionId: 'drive-tiger',
                confirmedActionId: 'drive-tiger',
                wheelDispatchProgress: dispatchSelection,
                lastFactionActionId: 'drive-tiger',
                lastSeasonSummary: {
                    id: `summary-${timestamp}`,
                    title: '封贡敕书',
                    lines: [
                        `${selection.targetFactionName}选择执行驱虎吞狼。`,
                        `封贡敕书使用后进入${selection.targetFactionName}弃牌堆。`,
                        discardedCardCount > 0
                            ? `额外弃 ${discardedCardCount} 张手牌作为费用。`
                            : '没有额外弃牌费用。',
                        `等待${state.factions[dispatchSelection.attackerFactionId].name}决定是否接受${selection.targetFactionName}指挥。`,
                    ],
                },
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: selection.ownerFactionId,
                        text: `${selection.ownerFactionName} 执行事件「封贡敕书」，指定${selection.targetFactionName}执行驱虎吞狼，事件牌进入${selection.targetFactionName}弃牌堆。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            });
        }

        return advanceQidahenTurnIfReady(nextState, timestamp);
    }

    if (selection.source === 'mongol-nobles-congress-effect') {
        const nextSelection = buildQidahenMongolNoblesCongressCharacterSelection(
            state,
            selection,
            choiceId,
        );
        if (!nextSelection) {
            return updateQidahenTurnLabel({
                ...state,
                lastSeasonSummary: {
                    id: `summary-${timestamp}`,
                    title: '王公大会',
                    lines: [
                        '当前没有可执行的蒙古人物选择。',
                        '本次未消耗手牌，也未结算事件效果。',
                    ],
                },
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: selection.ownerFactionId,
                        text: `${selection.ownerFactionName} 尝试执行事件「王公大会」，但没有可执行的蒙古人物选择。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            });
        }
        return updateQidahenTurnLabel({
            ...state,
            turnPhase: 'event-opponent-hand-choice',
            eventOpponentHandChoiceSelection: nextSelection,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '王公大会',
                lines: [
                    nextSelection.summary,
                ],
            },
        });
    }

    if (selection.source === 'mongol-nobles-congress-play-character') {
        const choice = selection.choices.find((candidate) => candidate.id === choiceId);
        if (!choice) {
            return state;
        }
        const selectedCharacter = state.factions.mongol.characters.find((character) => character.id === choice.cardId);
        if (!selectedCharacter || selectedCharacter.inPlay || selectedCharacter.removedFromGame) {
            return state;
        }

        const nextFactions = {
            ...state.factions,
            mongol: {
                ...state.factions.mongol,
                characters: state.factions.mongol.characters.map((character) => (
                    character.id === selectedCharacter.id
                        ? {
                            ...character,
                            inPlay: true,
                            removedFromGame: false,
                            defeatMarkers: 0,
                        }
                        : character
                )),
            },
        };

        return finalizeQidahenMongolNoblesCongress(
            state,
            selection,
            timestamp,
            nextFactions,
            `打出蒙古人物「${selectedCharacter.name}」。`,
            `打出蒙古人物「${selectedCharacter.name}」`,
        );
    }

    if (selection.source === 'mongol-nobles-congress-return-character') {
        const choice = selection.choices.find((candidate) => candidate.id === choiceId);
        if (!choice) {
            return state;
        }
        const sourceFactionId = choice.id.split(':')[0] as QidahenFactionId;
        if (sourceFactionId === 'mongol' || !state.factions[sourceFactionId]) {
            return state;
        }
        const selectedCharacter = state.factions[sourceFactionId].characters.find((character) => character.id === choice.cardId);
        if (!selectedCharacter || selectedCharacter.faction !== 'mongol' || !selectedCharacter.inPlay || selectedCharacter.removedFromGame) {
            return state;
        }
        const returnedCharacter = {
            ...selectedCharacter,
            faction: 'mongol' as const,
            inPlay: false,
            removedFromGame: false,
            defeatMarkers: 0,
        };
        const nextFactions = {
            ...state.factions,
            [sourceFactionId]: {
                ...state.factions[sourceFactionId],
                characters: state.factions[sourceFactionId].characters.filter((character) => character.id !== selectedCharacter.id),
            },
            mongol: {
                ...state.factions.mongol,
                characters: [
                    ...state.factions.mongol.characters.filter((character) => character.id !== selectedCharacter.id),
                    returnedCharacter,
                ],
            },
        };

        return finalizeQidahenMongolNoblesCongress(
            state,
            selection,
            timestamp,
            nextFactions,
            `将${state.factions[sourceFactionId].name}在场蒙古人物「${selectedCharacter.name}」拿回蒙古人物牌堆。`,
            `将${state.factions[sourceFactionId].name}在场蒙古人物「${selectedCharacter.name}」拿回蒙古人物牌堆`,
        );
    }

    if (!selection.source.startsWith('ginseng-and-sable')) {
        return state;
    }

    if (selection.source === 'ginseng-and-sable-opponent') {
        const nextSelection = buildQidahenGinsengAndSableCardSelection(
            state,
            selection,
            choiceId as QidahenFactionId,
        );
        if (!nextSelection) {
            return updateQidahenTurnLabel({
                ...state,
                lastSeasonSummary: {
                    id: `summary-${timestamp}`,
                    title: '人参貂皮',
                    lines: [
                        '指定的对手当前没有可给出的手牌。',
                        '本次未消耗手牌，也未结算事件效果。',
                    ],
                },
                actionLog: [
                    {
                        id: `log-${timestamp}`,
                        faction: selection.ownerFactionId,
                        text: `${selection.ownerFactionName} 尝试执行事件「人参貂皮」，但指定对手没有可给出的手牌。`,
                    },
                    ...state.actionLog,
                ].slice(0, 6),
            });
        }
        return updateQidahenTurnLabel({
            ...state,
            turnPhase: 'event-opponent-hand-choice',
            eventOpponentHandChoiceSelection: nextSelection,
            lastSeasonSummary: {
                id: `summary-${timestamp}`,
                title: '人参貂皮',
                lines: [
                    `${nextSelection.targetFactionName}被指定为人参貂皮目标。`,
                    `等待${nextSelection.targetFactionName}选择给出 1 张手牌。`,
                ],
            },
        });
    }

    const choice = selection.choices.find((candidate) => candidate.id === choiceId);
    if (!choice || !selection.targetFactionId || !selection.targetFactionName) {
        return state;
    }
    const transferredCard = state.handCards.find((card) => card.id === choice.cardId);
    if (!transferredCard || transferredCard.faction !== selection.targetFactionId) {
        return state;
    }

    const removedPaymentCardIds = new Set(selection.paymentCardIds);
    const removedCardIds = new Set([...selection.paymentCardIds, transferredCard.id]);
    const receivedCard = {
        ...transferredCard,
        faction: selection.ownerFactionId,
        accent: selection.ownerFactionId,
        status: 'payable' as const,
    };
    const nextFactions = {
        ...state.factions,
        [selection.ownerFactionId]: {
            ...state.factions[selection.ownerFactionId],
            handCount: Math.max(0, state.factions[selection.ownerFactionId].handCount - selection.paymentCardIds.length) + 1,
        },
        [selection.targetFactionId]: {
            ...state.factions[selection.targetFactionId],
            handCount: Math.max(0, state.factions[selection.targetFactionId].handCount - 1),
            discardPileCount: Math.max(0, state.factions[selection.targetFactionId].discardPileCount ?? 0) + 1,
        },
    };

    const nextState = updateQidahenTurnLabel({
        ...state,
        turnPhase: 'action-window',
        eventCharacterTargetSelection: null,
        eventOpponentHandChoiceSelection: null,
        selectedPaymentCardIds: [],
        selectedHandActionCardId: null,
        payment: buildPaymentState('play-event-card', 0),
        handCards: [
            ...state.handCards.filter((card) => !removedCardIds.has(card.id)),
            receivedCard,
        ],
        discardPileCount: state.discardPileCount + removedPaymentCardIds.size,
        factions: nextFactions,
        factionActionUsed: true,
        lastFactionActionId: 'play-event-card',
        confirmedActionId: 'play-event-card',
        activeEventCards: state.activeEventCards,
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '人参貂皮',
            lines: [
                `${selection.ownerFactionName}获得${selection.targetFactionName}给出的手牌「${transferredCard.label}」。`,
                `人参貂皮使用后进入${selection.targetFactionName}弃牌堆。`,
            ],
        },
        actionLog: [
            {
                id: `log-${timestamp}`,
                faction: selection.ownerFactionId,
                text: `${selection.ownerFactionName} 执行事件「人参貂皮」，获得${selection.targetFactionName}手牌「${transferredCard.label}」，事件牌进入${selection.targetFactionName}弃牌堆。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });

    return advanceQidahenTurnIfReady(nextState, timestamp);
}
