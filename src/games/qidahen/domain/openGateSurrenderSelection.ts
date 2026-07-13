import { syncQidahenCorePieceCollections } from './coreDerivedState';
import { buildPaymentState } from './factionActionWindow';
import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
} from './troopCompat';
import { getQidahenTroopKindLabel } from './troopStacks';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenHandCard,
    QidahenOpenGateSurrenderEffectChoice,
    QidahenOpenGateSurrenderSelection,
    QidahenPiece,
} from './types';

export const QIDAHEN_OPEN_GATE_SURRENDER_CARD_DEF_ID = 'qidahen-atlas05-1621-power-struggle-coup' as const;

export interface QidahenOpenGateSurrenderTroopChoice {
    id: string;
    regionId: string;
    regionName: string;
    location: QidahenPiece['location'];
    pieceId: string | null;
    label: string;
}

const getInPlayJinCharacters = (state: QidahenCore) => (
    state.factions.jin.characters.filter((character) => character.inPlay && !character.removedFromGame)
);

const getLocationLabel = (location: QidahenPiece['location']): string => {
    if (location === 'city') {
        return '城内';
    }
    if (location === 'siege-attacker') {
        return '围城';
    }
    return '野外';
};

export const buildQidahenOpenGateSurrenderTroopChoices = (
    state: QidahenCore,
): QidahenOpenGateSurrenderTroopChoice[] => {
    const choices: QidahenOpenGateSurrenderTroopChoice[] = [];
    for (const region of state.regions.filter((candidate) => !candidate.isLogicalRegion)) {
        const regionPieces = state.pieces.filter((piece) => piece.regionId === region.id);
        for (const piece of regionPieces.filter((candidate) => candidate.faction === 'jin')) {
            choices.push({
                id: `piece:${piece.id}`,
                regionId: region.id,
                regionName: region.name,
                location: piece.location,
                pieceId: piece.id,
                label: `${region.name}·${getLocationLabel(piece.location)}·${piece.label}（${getQidahenTroopKindLabel(piece.troopKind)}${piece.level}级）`,
            });
        }

        const appendGenericChoices = (
            location: QidahenPiece['location'],
            totalTroops: number,
            controlledByJin: boolean,
        ) => {
            if (!controlledByJin) {
                return;
            }
            const representedPieces = regionPieces.filter((piece) => piece.location === location).length;
            const genericTroops = Math.max(0, totalTroops - representedPieces);
            for (let index = 0; index < genericTroops; index += 1) {
                choices.push({
                    id: `generic:${location}:${region.id}:${index + 1}`,
                    regionId: region.id,
                    regionName: region.name,
                    location,
                    pieceId: null,
                    label: `${region.name}·${getLocationLabel(location)}·后金普通部队 ${index + 1}`,
                });
            }
        };

        appendGenericChoices('field', region.troops, region.controller === 'jin');
        appendGenericChoices('city', region.cityState?.troops ?? 0, region.controller === 'jin');
        appendGenericChoices(
            'siege-attacker',
            region.siegeState?.attackerTroops ?? 0,
            region.siegeState?.attackerFactionId === 'jin',
        );
    }
    return choices.sort((left, right) => (
        left.regionName.localeCompare(right.regionName, 'zh-CN')
        || left.location.localeCompare(right.location, 'en')
        || left.label.localeCompare(right.label, 'zh-CN')
    ));
};

export const buildQidahenOpenGateSurrenderSelection = (
    state: QidahenCore,
    ownerFactionId: QidahenFactionId,
    eventCard: QidahenHandCard,
    paymentCardIds: readonly string[],
): QidahenOpenGateSurrenderSelection | null => {
    if (
        eventCard.cardDefId !== QIDAHEN_OPEN_GATE_SURRENDER_CARD_DEF_ID
        || (ownerFactionId !== 'jin' && ownerFactionId !== 'ming')
    ) {
        return null;
    }
    return {
        phase: 'choose-effects',
        eventCardId: eventCard.id,
        eventCardDefId: QIDAHEN_OPEN_GATE_SURRENDER_CARD_DEF_ID,
        eventCardLabel: eventCard.label,
        ownerFactionId,
        ownerFactionName: state.factions[ownerFactionId].name,
        paymentCardIds: [...paymentCardIds],
        effectChoice: null,
        executeJinEffect: false,
        executeMingEffect: false,
        discardedJinCharacterIds: [],
        requiredJinTroopLoss: 0,
        rawRequiredJinTroopLoss: 0,
        summaryLines: [],
    };
};

const finalizeQidahenOpenGateSurrender = (
    state: QidahenCore,
    selection: QidahenOpenGateSurrenderSelection,
    timestamp: number,
): QidahenCore => {
    const removedCardIds = new Set(selection.paymentCardIds);
    const extraDiscardCount = Math.max(0, selection.paymentCardIds.length - 1);
    const nextState = updateQidahenTurnLabel({
        ...state,
        turnPhase: 'action-window',
        openGateSurrenderSelection: null,
        eventCharacterTargetSelection: null,
        eventOpponentHandChoiceSelection: null,
        selectedPaymentCardIds: [],
        selectedHandActionCardId: null,
        payment: buildPaymentState('play-event-card', 0),
        handCards: state.handCards.filter((card) => !removedCardIds.has(card.id)),
        discardPileCount: state.discardPileCount + extraDiscardCount,
        factions: {
            ...state.factions,
            [selection.ownerFactionId]: {
                ...state.factions[selection.ownerFactionId],
                handCount: Math.max(
                    0,
                    state.factions[selection.ownerFactionId].handCount - selection.paymentCardIds.length,
                ),
                discardPileCount: Math.max(
                    0,
                    state.factions[selection.ownerFactionId].discardPileCount ?? 0,
                ) + extraDiscardCount,
            },
        },
        factionActionUsed: true,
        lastFactionActionId: 'play-event-card',
        confirmedActionId: 'play-event-card',
        lastSeasonSummary: {
            id: `summary-${timestamp}`,
            title: '开门迎降',
            lines: [
                ...selection.summaryLines,
                '开门迎降使用后移出游戏；此牌未进入弃牌堆。',
                extraDiscardCount > 0
                    ? `额外弃 ${extraDiscardCount} 张手牌作为费用。`
                    : '没有额外弃牌费用。',
            ],
        },
        actionLog: [
            {
                id: `log-${timestamp}`,
                faction: selection.ownerFactionId,
                text: `${selection.ownerFactionName} 执行事件「开门迎降」：${selection.summaryLines.join('；')}。事件牌移出游戏。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return advanceQidahenTurnIfReady(nextState, timestamp);
};

const advanceAfterJinCharacters = (
    state: QidahenCore,
    selection: QidahenOpenGateSurrenderSelection,
    timestamp: number,
): QidahenCore => {
    const remainingCharacters = getInPlayJinCharacters(state).length;
    const rawRequiredLoss = remainingCharacters * 2;
    const availableTroops = buildQidahenOpenGateSurrenderTroopChoices(state).length;
    const requiredLoss = Math.min(rawRequiredLoss, availableTroops);
    const summaryLines = [
        ...selection.summaryLines,
        `后金弃掉 ${selection.discardedJinCharacterIds.length} 张在场人物，剩余 ${remainingCharacters} 张在场人物。`,
        rawRequiredLoss === requiredLoss
            ? `后金必须弃掉 ${requiredLoss} 个部队。`
            : `后金应弃掉 ${rawRequiredLoss} 个部队，但场上只有 ${availableTroops} 个，因此弃尽全部可用部队。`,
    ];
    const nextSelection = {
        ...selection,
        rawRequiredJinTroopLoss: rawRequiredLoss,
        requiredJinTroopLoss: requiredLoss,
        summaryLines,
    };
    if (requiredLoss > 0) {
        return {
            ...state,
            turnPhase: 'open-gate-surrender',
            openGateSurrenderSelection: {
                ...nextSelection,
                phase: 'jin-troops',
            },
        };
    }
    if (selection.executeMingEffect) {
        return {
            ...state,
            turnPhase: 'open-gate-surrender',
            openGateSurrenderSelection: {
                ...nextSelection,
                phase: 'ming-faction',
            },
        };
    }
    return finalizeQidahenOpenGateSurrender(state, nextSelection, timestamp);
};

const removeSelectedJinTroops = (
    state: QidahenCore,
    selectedChoices: QidahenOpenGateSurrenderTroopChoice[],
): QidahenCore => {
    const selectedPieceIds = new Set(
        selectedChoices.flatMap((choice) => choice.pieceId ? [choice.pieceId] : []),
    );
    const selectedCountsByLocation = new Map<string, number>();
    for (const choice of selectedChoices) {
        const key = `${choice.regionId}:${choice.location}`;
        selectedCountsByLocation.set(key, (selectedCountsByLocation.get(key) ?? 0) + 1);
    }
    const regions = state.regions.map((region) => {
        const fieldLoss = selectedCountsByLocation.get(`${region.id}:field`) ?? 0;
        const cityLoss = selectedCountsByLocation.get(`${region.id}:city`) ?? 0;
        const siegeLoss = selectedCountsByLocation.get(`${region.id}:siege-attacker`) ?? 0;
        const filterStacks = (stacks: typeof region.specialTroops) => (
            collapseCompatPiecesToSpecialTroopStacks(
                expandSpecialTroopStacksToCompatPieces(stacks)
                    .filter((piece) => !selectedPieceIds.has(piece.id)),
            )
        );
        return {
            ...region,
            troops: Math.max(0, region.troops - fieldLoss),
            specialTroops: filterStacks(region.specialTroops),
            cityState: region.cityState
                ? {
                    ...region.cityState,
                    troops: Math.max(0, region.cityState.troops - cityLoss),
                    specialTroops: filterStacks(region.cityState.specialTroops),
                }
                : null,
            siegeState: region.siegeState
                ? {
                    ...region.siegeState,
                    attackerTroops: Math.max(0, region.siegeState.attackerTroops - siegeLoss),
                    attackerSpecialTroops: filterStacks(region.siegeState.attackerSpecialTroops),
                }
                : null,
        };
    });
    return syncQidahenCorePieceCollections({
        ...state,
        regions,
    });
};

export const resolveQidahenOpenGateSurrenderInteraction = (
    state: QidahenCore,
    optionIds: readonly string[],
    timestamp: number,
    selection: QidahenOpenGateSurrenderSelection | null = state.openGateSurrenderSelection,
): QidahenCore => {
    if (!selection) {
        return state;
    }

    if (selection.phase === 'choose-effects') {
        const effectChoice = optionIds[0] as QidahenOpenGateSurrenderEffectChoice | undefined;
        if (!effectChoice || !['jin-effect', 'ming-effect', 'both'].includes(effectChoice)) {
            return state;
        }
        const executeJinEffect = effectChoice !== 'ming-effect';
        const executeMingEffect = effectChoice !== 'jin-effect';
        const nextSelection: QidahenOpenGateSurrenderSelection = {
            ...selection,
            effectChoice,
            executeJinEffect,
            executeMingEffect,
            phase: executeJinEffect ? 'jin-characters' : 'ming-faction',
            summaryLines: [
                effectChoice === 'both'
                    ? '选择依次执行第一项和第二项效果。'
                    : effectChoice === 'jin-effect'
                        ? '选择只执行第一项效果。'
                        : '选择只执行第二项效果。',
            ],
        };
        if (executeJinEffect && getInPlayJinCharacters(state).length === 0) {
            return advanceAfterJinCharacters(state, nextSelection, timestamp);
        }
        return {
            ...state,
            turnPhase: 'open-gate-surrender',
            openGateSurrenderSelection: nextSelection,
        };
    }

    if (selection.phase === 'jin-characters') {
        const validCharacterIds = new Set(getInPlayJinCharacters(state).map((character) => character.id));
        if (optionIds.some((id) => !validCharacterIds.has(id))) {
            return state;
        }
        const selectedIds = new Set(optionIds);
        const nextState = {
            ...state,
            factions: {
                ...state.factions,
                jin: {
                    ...state.factions.jin,
                    characters: state.factions.jin.characters.map((character) => (
                        selectedIds.has(character.id)
                            ? { ...character, inPlay: false, removedFromGame: false }
                            : character
                    )),
                },
            },
        };
        return advanceAfterJinCharacters(
            nextState,
            {
                ...selection,
                discardedJinCharacterIds: [...selectedIds],
            },
            timestamp,
        );
    }

    if (selection.phase === 'jin-troops') {
        const choices = buildQidahenOpenGateSurrenderTroopChoices(state);
        const choiceById = new Map(choices.map((choice) => [choice.id, choice]));
        const uniqueIds = [...new Set(optionIds)];
        if (
            uniqueIds.length !== selection.requiredJinTroopLoss
            || uniqueIds.some((id) => !choiceById.has(id))
        ) {
            return state;
        }
        const selectedChoices = uniqueIds
            .map((id) => choiceById.get(id))
            .filter((choice): choice is QidahenOpenGateSurrenderTroopChoice => choice != null);
        const nextState = removeSelectedJinTroops(state, selectedChoices);
        const nextSelection = {
            ...selection,
            summaryLines: [
                ...selection.summaryLines,
                `后金弃掉 ${selectedChoices.length} 个部队：${selectedChoices.map((choice) => choice.label).join('、')}。`,
            ],
        };
        if (selection.executeMingEffect) {
            return {
                ...nextState,
                turnPhase: 'open-gate-surrender',
                openGateSurrenderSelection: {
                    ...nextSelection,
                    phase: 'ming-faction',
                },
            };
        }
        return finalizeQidahenOpenGateSurrender(nextState, nextSelection, timestamp);
    }

    if (selection.phase === 'ming-faction') {
        const targetFactionId = optionIds[0] as QidahenFactionId | undefined;
        if (!targetFactionId || !['ming', 'mongol', 'jin'].includes(targetFactionId)) {
            return state;
        }
        const targetFaction = state.factions[targetFactionId];
        const discardedCount = targetFaction.characters.filter((character) => (
            character.inPlay && !character.removedFromGame
        )).length;
        const nextState = {
            ...state,
            factions: {
                ...state.factions,
                [targetFactionId]: {
                    ...targetFaction,
                    characters: targetFaction.characters.map((character) => (
                        character.inPlay && !character.removedFromGame
                            ? { ...character, inPlay: false, removedFromGame: false }
                            : character
                    )),
                },
            },
        };
        return finalizeQidahenOpenGateSurrender(
            nextState,
            {
                ...selection,
                summaryLines: [
                    ...selection.summaryLines,
                    `大明选择${targetFaction.name}，弃掉该派系全部 ${discardedCount} 张在场人物。`,
                ],
            },
            timestamp,
        );
    }

    return state;
};
