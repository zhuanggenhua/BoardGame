import { getArmamentLevel } from './armamentStateAccessors';
import { buildSeasonSummary } from './seasonSummaryBuilder';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import { getCurrentFactionId } from './factionTurnAccessors';
import { buildRegularTroopStack, clampTroopLevel } from './troopStacks';
import { addSpecialTroopStackToRegion, getSpecialTroopCount } from './troopCompat';
import {
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
    upgradeCompatPieceToLevel,
} from './troopCompat';
import { materializeNonSiegedCityActionSourceRegion } from './actionSourceRegionState';
import { getEffectiveHomelandController } from './regionRuleSemantics';
import { buildQidahenRegionFocusState } from './regionFocusSemantics';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { syncQidahenCorePieceCollections } from './coreDerivedState';
import { updateQidahenTurnLabel } from './turnLabelState';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenSpecialTroopStack,
    QidahenWheelRecruitTrainChoice,
} from './types';

export const QIDAHEN_WHEEL_RECRUIT_TRAIN_BASE_ACTION_LIMIT = 4;
const QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST = 1;

type QidahenWheelRecruitTrainProgress = NonNullable<QidahenCore['wheelRecruitTrainProgress']>;
type QidahenTroopLocation = 'field' | 'city' | 'generic-field' | 'generic-city';

interface QidahenTrainablePiece {
    id: string;
    regionId: string;
    regionName: string;
    sourceStackId?: string;
    level: number;
    targetLevel: number;
    troopKind: QidahenCore['pieces'][number]['troopKind'];
    troopClass: QidahenCore['pieces'][number]['troopClass'];
    label: string;
    location: QidahenTroopLocation;
}

const getGenericPieceIds = (
    regionId: string,
    location: 'field' | 'city',
    genericCount: number,
    trainedPieceIds: ReadonlySet<string>,
): string[] => {
    const prefix = `generic:${location}:${regionId}:`;
    const trainedCount = [...trainedPieceIds].filter((pieceId) => pieceId.startsWith(prefix)).length;
    return Array.from({ length: Math.max(0, genericCount + trainedCount) }, (_, index) => `${prefix}${index + 1}`)
        .filter((pieceId) => !trainedPieceIds.has(pieceId))
        .slice(0, genericCount);
};

const getTroopTrainingCap = (
    state: QidahenCore,
    currentFactionId: QidahenFactionId,
    piece: Pick<QidahenTrainablePiece, 'troopKind' | 'troopClass' | 'label' | 'sourceStackId'> & {
        faction?: QidahenFactionId;
        originalFaction?: QidahenFactionId;
    },
): number => {
    if (piece.troopKind === 'artillery') {
        return Math.max(0, Math.min(4, Math.floor(getArmamentLevel(state, currentFactionId, 'artillery-tech'))));
    }

    const originalFaction = piece.originalFaction ?? piece.faction ?? currentFactionId;
    if (piece.troopClass === 'auxiliary') {
        const activeFactionCount = Object.values(state.factions).filter((faction) => (
            !faction.playerId.startsWith('qidahen-neutral-')
        )).length;
        if (
            activeFactionCount === 2
            && currentFactionId === 'jin'
            && originalFaction === 'mongol'
            && piece.troopKind === 'cavalry'
        ) {
            return 4;
        }
        return 3;
    }

    if (
        originalFaction === 'ming'
        && (piece.label.includes('川兵') || piece.sourceStackId?.includes('chuanbing'))
    ) {
        return 4;
    }
    if (
        (originalFaction === 'mongol' && piece.troopKind === 'cavalry')
        || (originalFaction === 'jin' && piece.troopKind === 'infantry')
    ) {
        return 4;
    }
    return 3;
};

const getTrainablePieces = (
    state: QidahenCore,
    factionId: QidahenFactionId,
): QidahenTrainablePiece[] => {
    const trainedPieceIds = new Set(state.trainedTroopPieceIdsThisTurn ?? []);
    const pieces: QidahenTrainablePiece[] = [];

    for (const region of state.regions) {
        if (region.isLogicalRegion || region.siegeState) {
            continue;
        }

        const addStackCandidates = (
            stacks: readonly QidahenSpecialTroopStack[],
            location: 'field' | 'city',
        ) => {
            for (const piece of expandSpecialTroopStacksToCompatPieces(stacks)) {
                if (piece.faction !== factionId) {
                    continue;
                }
                const maxLevel = getTroopTrainingCap(state, factionId, piece);
                const targetLevel = Math.min(maxLevel, clampTroopLevel(piece.level + 1));
                if (targetLevel <= piece.level || trainedPieceIds.has(piece.id)) {
                    continue;
                }
                pieces.push({
                    id: piece.id,
                    regionId: region.id,
                    regionName: region.name,
                    sourceStackId: piece.sourceStackId,
                    level: piece.level,
                    targetLevel,
                    troopKind: piece.troopKind,
                    troopClass: piece.troopClass,
                    label: piece.label,
                    location,
                });
            }
        };

        addStackCandidates(region.specialTroops ?? [], 'field');
        if (region.cityState) {
            addStackCandidates(region.cityState.specialTroops ?? [], 'city');
        }

        if (region.controller === factionId) {
            const genericFieldCount = Math.max(0, region.troops - getSpecialTroopCount({ specialTroops: region.specialTroops ?? [] }));
            getGenericPieceIds(region.id, 'field', genericFieldCount, trainedPieceIds).forEach((id) => {
                const troopKind = factionId === 'mongol' ? 'cavalry' : 'infantry';
                const targetLevel = Math.min(3, getTroopTrainingCap(state, factionId, {
                    faction: factionId,
                    originalFaction: factionId,
                    troopClass: 'regular',
                    troopKind,
                    label: `${state.factions[factionId].name}正规军`,
                }));
                if (targetLevel <= 2) return;
                pieces.push({
                    id,
                    regionId: region.id,
                    regionName: region.name,
                    level: 2,
                    targetLevel,
                    troopKind,
                    troopClass: 'regular',
                    label: `${state.factions[factionId].name}正规军`,
                    location: 'generic-field',
                });
            });

            const genericCityCount = region.cityState
                ? Math.max(0, region.cityState.troops - getSpecialTroopCount({ specialTroops: region.cityState.specialTroops ?? [] }))
                : 0;
            getGenericPieceIds(region.id, 'city', genericCityCount, trainedPieceIds).forEach((id) => {
                const troopKind = factionId === 'mongol' ? 'cavalry' : 'infantry';
                const targetLevel = Math.min(3, getTroopTrainingCap(state, factionId, {
                    faction: factionId,
                    originalFaction: factionId,
                    troopClass: 'regular',
                    troopKind,
                    label: `${state.factions[factionId].name}正规军`,
                }));
                if (targetLevel <= 2) return;
                pieces.push({
                    id,
                    regionId: region.id,
                    regionName: region.name,
                    level: 2,
                    targetLevel,
                    troopKind,
                    troopClass: 'regular',
                    label: `${state.factions[factionId].name}正规军`,
                    location: 'generic-city',
                });
            });
        }
    }

    return pieces;
};

const getRecruitableRegions = (
    state: QidahenCore,
    factionId: QidahenFactionId,
) => state.regions.filter((region) => (
    !region.isLogicalRegion
    && !region.siegeState
    && region.controller === factionId
    && region.diplomacyMarkerFaction == null
    && getEffectiveHomelandController(state, region.id) === factionId
));

export const isQidahenWheelRecruitTrainPaymentPending = (
    state: Pick<QidahenCore, 'wheelRecruitTrainProgress'>,
): boolean => state.wheelRecruitTrainProgress?.phase === 'payment';

export const getQidahenWheelRecruitTrainChoices = (
    state: QidahenCore,
): QidahenWheelRecruitTrainChoice[] => {
    const progress = state.wheelRecruitTrainProgress;
    if (!progress) {
        return [];
    }

    const factionId = getCurrentFactionId(state);
    const trainablePieces = getTrainablePieces(state, factionId);
    if (progress.phase === 'choose-action') {
        const choices: QidahenWheelRecruitTrainChoice[] = [];
        if (progress.actionsCompleted < QIDAHEN_WHEEL_RECRUIT_TRAIN_BASE_ACTION_LIMIT) {
            if (!progress.trainingOnly && getRecruitableRegions(state, factionId).length > 0) {
                choices.push({ id: 'action:recruit', kind: 'action' });
            }
            if (trainablePieces.length > 0) {
                choices.push({ id: 'action:train', kind: 'action' });
            }
        }
        if (
            trainablePieces.length > 0
            && state.handCards.some((card) => (
                card.faction === factionId
                && card.status !== 'disabled'
            ))
        ) {
            choices.push({ id: 'extra-training', kind: 'extra-training' });
        }
        choices.push({ id: 'finish', kind: 'finish' });
        return choices;
    }

    if (progress.phase === 'choose-recruit-target') {
        return getRecruitableRegions(state, factionId).map((region) => ({
            id: `recruit:${region.id}`,
            kind: 'recruit-target',
            regionId: region.id,
            regionName: region.name,
        }));
    }

    if (progress.phase === 'choose-training-target' || progress.phase === 'extra-training-target') {
        return trainablePieces.map((piece) => ({
            id: `train:${piece.id}`,
            kind: 'training-target',
            regionId: piece.regionId,
            regionName: piece.regionName,
            pieceId: piece.id,
            sourceStackId: piece.sourceStackId,
            level: piece.level,
            targetLevel: piece.targetLevel,
            troopKind: piece.troopKind,
            troopClass: piece.troopClass,
            location: piece.location,
        }));
    }

    return [];
};

const buildPaymentState = (selected = 0) => ({
    required: QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST,
    selected: Math.min(QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST, selected),
    prompt: `需弃 ${QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST} 张 · 已选 ${Math.min(QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST, selected)} 张`,
});

const buildCompletedPaymentState = (purpose: 'initial' | 'extra') => ({
    required: 0,
    selected: 0,
    prompt: purpose === 'initial' ? '征兵训练弃牌已完成' : '额外训练弃牌已完成',
});

export const beginQidahenWheelRecruitTrain = (
    state: QidahenCore,
    source: QidahenWheelRecruitTrainProgress['source'],
    timestamp: number,
    initialCardAlreadyPaid = false,
): QidahenCore => {
    const factionId = getCurrentFactionId(state);
    const payableCardCount = state.handCards.filter((card) => (
        card.faction === factionId && card.status !== 'disabled'
    )).length;
    if (!initialCardAlreadyPaid && payableCardCount < QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST) {
        const faction = state.factions[factionId];
        return updateQidahenTurnLabel({
            ...state,
            lastSeasonSummary: buildSeasonSummary('轮盘征兵/训练', timestamp, [
                `${faction.name} 手牌不足，未执行征兵或训练。`,
            ]),
            actionLog: [
                {
                    id: `log-wheel-recruit-train-unpaid-${timestamp}`,
                    faction: factionId,
                    text: `${faction.name} 手牌不足，无法执行征兵训练。`,
                },
                ...state.actionLog,
            ].slice(0, 6),
        });
    }

    const progress: QidahenWheelRecruitTrainProgress = {
        source,
        phase: initialCardAlreadyPaid ? 'choose-action' : 'payment',
        paymentPurpose: initialCardAlreadyPaid ? null : 'initial',
        actionsCompleted: 0,
        extraTrainingsCompleted: 0,
        trainingOnly: state.actionWheelPosition === 'wheel-midyear'
            || state.actionWheelPosition === 'wheel-new-year',
        summaryLines: [],
    };

    return updateQidahenTurnLabel({
        ...state,
        wheelRecruitTrainProgress: progress,
        selectedPaymentCardIds: [],
        payment: initialCardAlreadyPaid ? buildCompletedPaymentState('initial') : buildPaymentState(),
        lastSeasonSummary: null,
    });
};

export const getQidahenWheelRecruitTrainPaymentState = (
    selectedCardCount: number,
) => buildPaymentState(selectedCardCount);

const discardSelectedCard = (
    state: QidahenCore,
    cardId: string,
    timestamp: number,
): QidahenCore => {
    const factionId = getCurrentFactionId(state);
    const card = state.handCards.find((candidate) => (
        candidate.id === cardId
        && candidate.faction === factionId
        && candidate.status !== 'disabled'
    ));
    if (!card) {
        return state;
    }
    const faction = state.factions[factionId];
    return {
        ...state,
        factions: {
            ...state.factions,
            [factionId]: {
                ...faction,
                handCount: Math.max(0, faction.handCount - 1),
                discardPileCount: Math.max(0, faction.discardPileCount ?? 0) + 1,
            },
        },
        handCards: state.handCards.filter((candidate) => candidate.id !== cardId),
        actionLog: [
            {
                id: `log-wheel-recruit-train-payment-${timestamp}`,
                faction: factionId,
                text: `${faction.name} 弃 1 张手牌${state.wheelRecruitTrainProgress?.paymentPurpose === 'extra' ? '，增加 1 次额外训练' : '，开始征兵训练'}。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    };
};

export const resolveQidahenWheelRecruitTrainPayment = (
    state: QidahenCore,
    cardIds: readonly string[],
    timestamp: number,
): QidahenCore => {
    const progress = state.wheelRecruitTrainProgress;
    if (
        !progress
        || progress.phase !== 'payment'
        || !progress.paymentPurpose
        || cardIds.length !== QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST
        || state.selectedPaymentCardIds.length !== QIDAHEN_WHEEL_RECRUIT_TRAIN_CARD_COST
        || cardIds.some((cardId) => !state.selectedPaymentCardIds.includes(cardId))
    ) {
        return state;
    }

    let nextState = discardSelectedCard(state, cardIds[0]!, timestamp);
    if (nextState === state) {
        return state;
    }
    const paymentPurpose = progress.paymentPurpose;
    nextState = {
        ...nextState,
        selectedPaymentCardIds: [],
        payment: buildCompletedPaymentState(paymentPurpose),
        wheelRecruitTrainProgress: {
            ...progress,
            phase: paymentPurpose === 'initial' ? 'choose-action' : 'extra-training-target',
            paymentPurpose: null,
        },
    };
    return updateQidahenTurnLabel(nextState);
};

const updateTroopStackWithTraining = (
    stacks: QidahenSpecialTroopStack[],
    pieceId: string,
    targetLevel: number,
): QidahenSpecialTroopStack[] => collapseCompatPiecesToSpecialTroopStacks(
    expandSpecialTroopStacksToCompatPieces(stacks).map((piece) => (
        piece.id === pieceId ? upgradeCompatPieceToLevel(piece, targetLevel) : piece
    )),
);

const trainGenericTroop = (
    region: QidahenCore['regions'][number],
    pieceId: string,
    location: 'generic-field' | 'generic-city',
    factionId: QidahenFactionId,
    targetLevel: number,
): QidahenCore['regions'][number] => {
    const stack = {
        ...buildRegularTroopStack(factionId, `wheel-training-${region.id}-${pieceId}`, 1, targetLevel),
        pieceIds: [pieceId],
    };
    if (location === 'generic-city' && region.cityState) {
        return {
            ...region,
            cityState: {
                ...region.cityState,
                specialTroops: addSpecialTroopStackToRegion(
                    { ...region, specialTroops: region.cityState.specialTroops },
                    stack,
                ).specialTroops,
            },
        };
    }
    return addSpecialTroopStackToRegion(region, stack);
};

const trainSpecialTroop = (
    region: QidahenCore['regions'][number],
    pieceId: string,
    location: 'field' | 'city',
    targetLevel: number,
): QidahenCore['regions'][number] => {
    if (location === 'city' && region.cityState) {
        return {
            ...region,
            cityState: {
                ...region.cityState,
                specialTroops: updateTroopStackWithTraining(region.cityState.specialTroops, pieceId, targetLevel),
            },
        };
    }
    return {
        ...region,
        specialTroops: updateTroopStackWithTraining(region.specialTroops, pieceId, targetLevel),
    };
};

const finishQidahenWheelRecruitTrain = (
    state: QidahenCore,
    timestamp: number,
): QidahenCore => {
    const progress = state.wheelRecruitTrainProgress;
    if (!progress) {
        return state;
    }
    const factionId = getCurrentFactionId(state);
    const lines = progress.summaryLines.length > 0
        ? progress.summaryLines
        : ['本次没有执行征兵或训练行动。'];
    const summaryTitle = progress.source === 'khan-edict' ? '大汗令箭 · 征兵训练' : '轮盘征兵/训练';
    const nextState = updateQidahenTurnLabel({
        ...state,
        wheelRecruitTrainProgress: null,
        selectedPaymentCardIds: [],
        payment: {
            required: 0,
            selected: 0,
            prompt: '征兵训练已完成',
        },
        lastSeasonSummary: buildSeasonSummary(summaryTitle, timestamp, lines),
        actionLog: [
            {
                id: `log-wheel-recruit-train-finish-${timestamp}`,
                faction: factionId,
                text: `${state.factions[factionId].name} 完成${summaryTitle}。`,
            },
            ...state.actionLog,
        ].slice(0, 6),
    });
    return advanceQidahenTurnIfReady(nextState, timestamp);
};

const resolveRecruitTarget = (
    state: QidahenCore,
    choice: QidahenWheelRecruitTrainChoice,
    timestamp: number,
): QidahenCore => {
    const progress = state.wheelRecruitTrainProgress;
    if (!progress || !choice.regionId) {
        return state;
    }
    const factionId = getCurrentFactionId(state);
    const targetRegion = state.regions.find((region) => region.id === choice.regionId && !region.isLogicalRegion);
    if (!targetRegion) {
        return state;
    }
    const actionTargetRegion = materializeNonSiegedCityActionSourceRegion(targetRegion);
    const regionWithNewTroop = addSpecialTroopStackToRegion({
        ...actionTargetRegion,
        troops: actionTargetRegion.troops + 1,
        note: `${actionTargetRegion.name} 执行征兵行动后建立 1 个等级 2 正规军。`,
    }, buildRegularTroopStack(factionId, `wheel-recruit-${timestamp}`, 1));
    const nextRegions = refreshRuntimeRegionRules(
        state.regions
            .filter((region) => !region.isLogicalRegion)
            .map((region) => region.id === targetRegion.id ? regionWithNewTroop : region),
        state.fortifications,
    );
    const line = `${state.factions[factionId].name} 在 ${targetRegion.name} 征兵，建立 1 个等级 2 正规军部队。`;
    return updateQidahenTurnLabel(syncQidahenCorePieceCollections({
        ...state,
        selectedRegionId: targetRegion.id,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(targetRegion.id),
        regions: nextRegions,
        factions: {
            ...state.factions,
            [factionId]: {
                ...state.factions[factionId],
                troops: state.factions[factionId].troops + 1,
            },
        },
        wheelRecruitTrainProgress: {
            ...progress,
            phase: 'choose-action',
            actionsCompleted: progress.actionsCompleted + 1,
            summaryLines: [...progress.summaryLines, line],
        },
        actionLog: [
            {
                id: `log-wheel-recruit-${timestamp}`,
                faction: factionId,
                text: line,
            },
            ...state.actionLog,
        ].slice(0, 6),
    }));
};

const resolveTrainingTarget = (
    state: QidahenCore,
    choice: QidahenWheelRecruitTrainChoice,
    timestamp: number,
    isExtraTraining: boolean,
): QidahenCore => {
    const progress = state.wheelRecruitTrainProgress;
    if (!progress || !choice.regionId || !choice.pieceId || choice.targetLevel == null) {
        return state;
    }
    const factionId = getCurrentFactionId(state);
    const region = state.regions.find((candidate) => candidate.id === choice.regionId && !candidate.isLogicalRegion);
    if (!region || region.siegeState) {
        return state;
    }
    const pieceId = choice.pieceId;
    const isGeneric = pieceId.startsWith(`generic:field:${region.id}:`)
        || pieceId.startsWith(`generic:city:${region.id}:`);
    const trainedPieceId = pieceId;
    const nextRegion = isGeneric
        ? trainGenericTroop(
            region,
            trainedPieceId,
            choice.location === 'generic-city' ? 'generic-city' : 'generic-field',
            factionId,
            choice.targetLevel,
        )
        : trainSpecialTroop(region, pieceId, choice.location === 'city' ? 'city' : 'field', choice.targetLevel);
    const nextRegions = refreshRuntimeRegionRules(
        state.regions
            .filter((candidate) => !candidate.isLogicalRegion)
            .map((candidate) => candidate.id === region.id ? nextRegion : candidate),
        state.fortifications,
    );
    const line = `${state.factions[factionId].name} 在 ${region.name} 将${choice.troopKind === 'artillery' ? '炮兵' : choice.troopKind === 'cavalry' ? '骑兵' : '步兵'}从 ${choice.level} 级训练至 ${choice.targetLevel} 级。`;
    const trackedPieceIds = new Set(state.trainedTroopPieceIdsThisTurn ?? []);
    trackedPieceIds.add(trainedPieceId);
    return updateQidahenTurnLabel(syncQidahenCorePieceCollections({
        ...state,
        selectedRegionId: region.id,
        explicitRegionId: null,
        regionFocusState: buildQidahenRegionFocusState(region.id),
        regions: nextRegions,
        trainedTroopPieceIdsThisTurn: [...trackedPieceIds],
        wheelRecruitTrainProgress: {
            ...progress,
            phase: 'choose-action',
            actionsCompleted: isExtraTraining ? progress.actionsCompleted : progress.actionsCompleted + 1,
            extraTrainingsCompleted: isExtraTraining ? progress.extraTrainingsCompleted + 1 : progress.extraTrainingsCompleted,
            summaryLines: [...progress.summaryLines, line],
        },
        actionLog: [
            {
                id: `log-wheel-train-${timestamp}`,
                faction: factionId,
                text: line,
            },
            ...state.actionLog,
        ].slice(0, 6),
    }));
};

export const resolveQidahenWheelRecruitTrainChoice = (
    state: QidahenCore,
    choiceId: string,
    timestamp: number,
): QidahenCore => {
    const progress = state.wheelRecruitTrainProgress;
    if (!progress || progress.phase === 'payment') {
        return state;
    }
    const choice = getQidahenWheelRecruitTrainChoices(state).find((candidate) => candidate.id === choiceId);
    if (!choice) {
        return state;
    }

    if (choice.kind === 'finish') {
        return finishQidahenWheelRecruitTrain(state, timestamp);
    }
    if (choice.id === 'action:recruit') {
        return updateQidahenTurnLabel({
            ...state,
            wheelRecruitTrainProgress: { ...progress, phase: 'choose-recruit-target' },
        });
    }
    if (choice.id === 'action:train') {
        return updateQidahenTurnLabel({
            ...state,
            wheelRecruitTrainProgress: { ...progress, phase: 'choose-training-target' },
        });
    }
    if (choice.kind === 'extra-training') {
        return updateQidahenTurnLabel({
            ...state,
            selectedPaymentCardIds: [],
            payment: buildPaymentState(),
            wheelRecruitTrainProgress: {
                ...progress,
                phase: 'payment',
                paymentPurpose: 'extra',
            },
        });
    }
    if (choice.kind === 'recruit-target') {
        return resolveRecruitTarget(state, choice, timestamp);
    }
    if (choice.kind === 'training-target') {
        return resolveTrainingTarget(
            state,
            choice,
            timestamp,
            progress.phase === 'extra-training-target',
        );
    }
    return state;
};
