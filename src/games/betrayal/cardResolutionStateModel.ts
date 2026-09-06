import {
    isPendingCardResolutionFullyAcknowledged,
    resolvePendingCardResolutionAcknowledgedPlayerIds,
    resolvePendingCardResolutionRequiredPlayerIds,
} from './acknowledgementReadModel';
import { cloneBetrayalRoomEndTurnEffectResult } from './roomEndTurnEffectModel';
import { cloneMonsterMovementRollResult } from './monsterActionReadModel';
import { cloneUseEffect } from './possessionEffects';
import type { BetrayalDustEndTurnResult } from './dustHauntRules';
import type {
    BetrayalCore,
    BetrayalDeckKind,
    BetrayalDiscoveryResolutionStep,
    BetrayalDiscoveryResolutionStepKind,
    BetrayalDiscoverySummary,
    BetrayalInventoryCard,
    BetrayalPendingCardResolutionProcessCard,
    BetrayalPendingCardResolutionState,
    BetrayalPendingCardResolutionStepKind,
    BetrayalPendingEventChoiceState,
    BetrayalPendingEventRollResolutionState,
    BetrayalTurnEndedPayload,
} from './game';

export function cloneDiscoverySummary(discovery: BetrayalDiscoverySummary): BetrayalDiscoverySummary {
    return {
        ...discovery,
        resolutionSteps: discovery.resolutionSteps?.map((step) => ({ ...step })),
    };
}

function buildDiscoveryResolutionStepKey(step: BetrayalDiscoveryResolutionStep): string {
    return step.id;
}

export function mergePreviousDiscoveryResolutionSteps(
    previousDiscovery: BetrayalDiscoverySummary | null,
    discovery: BetrayalDiscoverySummary,
): void {
    if (
        previousDiscovery?.kind !== discovery.kind
        || previousDiscovery.title !== discovery.title
        || !previousDiscovery.resolutionSteps?.length
    ) {
        return;
    }
    const mergedSteps = [
        ...previousDiscovery.resolutionSteps,
        ...(discovery.resolutionSteps ?? []),
    ];
    const mergedStepByKey = new Map<string, BetrayalDiscoveryResolutionStep>();
    for (const step of mergedSteps) {
        mergedStepByKey.set(buildDiscoveryResolutionStepKey(step), step);
    }
    discovery.resolutionSteps = Array.from(mergedStepByKey.values(), (step) => ({ ...step }));
}

function isPendingCardResolutionStepKind(
    kind: BetrayalDiscoveryResolutionStepKind,
): kind is BetrayalPendingCardResolutionStepKind {
    return kind === 'room-effect'
        || kind === 'room-discovery-card'
        || kind === 'buried-room-discovery-card'
        || kind === 'drawn-card'
        || kind === 'haunt-roll'
        || kind === 'event-effect';
}

function isRoomDiscoverySearchResolutionStep(
    step: BetrayalDiscoveryResolutionStep,
): boolean {
    return step.kind === 'room-discovery-card' || step.kind === 'buried-room-discovery-card';
}

function collapseRoomDiscoverySearchResolutionSteps(
    steps: BetrayalDiscoveryResolutionStep[],
    cardById: Map<string, BetrayalInventoryCard>,
): Array<BetrayalDiscoveryResolutionStep & { processCards?: BetrayalPendingCardResolutionProcessCard[] }> {
    const collapsed: Array<BetrayalDiscoveryResolutionStep & { processCards?: BetrayalPendingCardResolutionProcessCard[] }> = [];
    for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]!;
        if (!isRoomDiscoverySearchResolutionStep(step)) {
            collapsed.push(step);
            continue;
        }
        const searchSteps: BetrayalDiscoveryResolutionStep[] = [];
        while (index < steps.length && isRoomDiscoverySearchResolutionStep(steps[index]!)) {
            searchSteps.push(steps[index]!);
            index += 1;
        }
        index -= 1;

        const gainedStep = [...searchSteps].reverse().find((candidate) => candidate.kind === 'room-discovery-card');
        const finalStep = gainedStep ?? searchSteps[searchSteps.length - 1]!;
        const processCards = searchSteps.map((searchStep) => {
            const card = searchStep.cardId ? cardById.get(searchStep.cardId) : undefined;
            return {
                cardId: searchStep.cardId,
                cardName: card?.name ?? searchStep.text,
                deckKind: searchStep.deckKind ?? 'item',
                outcome: searchStep.kind === 'buried-room-discovery-card' ? 'buried' as const : 'gained' as const,
                text: searchStep.text,
            };
        });
        collapsed.push({
            ...finalStep,
            id: `room-discovery-search-${searchSteps.map((searchStep) => searchStep.id).join('-')}`,
            kind: 'room-discovery-card',
            text: searchSteps.map((searchStep) => searchStep.text).join('；'),
            deckKind: finalStep.deckKind ?? 'item',
            cardId: finalStep.cardId,
            processCards,
        });
    }
    return collapsed;
}

function collapseSameScreenOmenResolutionSteps(
    steps: BetrayalDiscoveryResolutionStep[],
): BetrayalDiscoveryResolutionStep[] {
    const collapsed: BetrayalDiscoveryResolutionStep[] = [];
    for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]!;
        const nextStep = steps[index + 1];
        if (
            step.kind === 'drawn-card'
            && nextStep?.kind === 'haunt-roll'
            && step.deckKind === 'omen'
            && nextStep.deckKind === 'omen'
            && step.cardId
            && step.cardId === nextStep.cardId
        ) {
            collapsed.push({
                ...step,
                id: `${step.id}-with-${nextStep.id}`,
                text: `${step.text}；${nextStep.text}`,
            });
            index += 1;
            continue;
        }
        collapsed.push(step);
    }
    return collapsed;
}

export function withEventChoiceResolutionStep(discovery: BetrayalDiscoverySummary): BetrayalDiscoverySummary {
    if (discovery.kind !== 'event' || discovery.resolutionSteps?.length) {
        return discovery;
    }
    const discoveryText = [discovery.summary, discovery.detail].join(' ');
    if (
        discoveryText.includes('没有抽取或结算事件卡')
        || discoveryText.includes('不抽取或结算事件卡')
    ) {
        return discovery;
    }
    const detail = discovery.detail.trim();
    return {
        ...discovery,
        resolutionSteps: [{
            id: `event-effect-${discovery.title}`,
            kind: 'event-effect',
            text: `事件效果：${detail || discovery.summary}`,
            deckKind: 'event',
        }],
    };
}

export function createPendingCardResolutionQueue(options: {
    playerId: string;
    requiredPlayerIds: string[];
    roomId: string;
    timestamp: number;
    deckKind: BetrayalDeckKind | null;
    discovery: BetrayalDiscoverySummary;
    drawnCard?: BetrayalInventoryCard;
    roomDiscoveryCards?: BetrayalInventoryCard[];
    buriedRoomDiscoveryCards?: BetrayalInventoryCard[];
}): BetrayalPendingCardResolutionState[] {
    const explicitSteps = options.discovery.resolutionSteps
        ?.filter((step) => isPendingCardResolutionStepKind(step.kind));
    if (!options.drawnCard && !(explicitSteps?.length)) {
        return [];
    }
    const cards = [
        ...(options.roomDiscoveryCards ?? []),
        ...(options.buriedRoomDiscoveryCards ?? []),
        ...(options.drawnCard ? [options.drawnCard] : []),
    ];
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const steps = explicitSteps?.length
        ? explicitSteps
        : options.drawnCard
            ? [{
                id: `drawn-card-${options.drawnCard.id}`,
                kind: 'drawn-card' as const,
                text: `已加入持有区：${options.drawnCard.name}`,
                deckKind: options.deckKind,
                cardId: options.drawnCard.id,
            }]
            : [];
    const visibleAcknowledgementSteps = collapseRoomDiscoverySearchResolutionSteps(
        collapseSameScreenOmenResolutionSteps(steps),
        cardById,
    );

    return visibleAcknowledgementSteps.map((step, index) => {
        const processCards = 'processCards' in step ? step.processCards : undefined;
        const card = step.cardId ? cardById.get(step.cardId) : undefined;
        const deckKind = step.deckKind === 'event' || step.deckKind === 'item' || step.deckKind === 'omen'
            ? step.deckKind
            : step.kind === 'room-effect'
                ? undefined
                : options.deckKind;
        return {
            id: `${options.playerId}-${options.roomId}-${options.timestamp}-${step.id}`,
            playerId: options.playerId,
            requiredPlayerIds: Array.from(new Set(options.requiredPlayerIds)),
            acknowledgedPlayerIds: [],
            deckKind,
            cardId: step.cardId,
            cardName: card?.name ?? (step.kind === 'room-effect' ? step.text : deckKind === 'event' ? options.discovery.title : step.text),
            discoveryTitle: options.discovery.title,
            stepKind: step.kind,
            text: step.text,
            index: index + 1,
            total: visibleAcknowledgementSteps.length,
            processCards: processCards?.map((processCard) => ({ ...processCard })),
        };
    });
}

export function acknowledgeEventEffectCardResolution(
    core: BetrayalCore,
    sourceTitle: string,
    playerId: string,
): void {
    core.pendingCardResolutionQueue = (core.pendingCardResolutionQueue ?? [])
        .flatMap((resolution) => {
            if (
                resolution.stepKind !== 'event-effect'
                || resolution.discoveryTitle !== sourceTitle
            ) {
                return [resolution];
            }
            const requiredPlayerIds = resolvePendingCardResolutionRequiredPlayerIds(resolution);
            const acknowledgedPlayerIds = Array.from(new Set([
                ...resolvePendingCardResolutionAcknowledgedPlayerIds(resolution),
                playerId,
            ]));
            return isPendingCardResolutionFullyAcknowledged(
                core,
                { ...resolution, requiredPlayerIds, acknowledgedPlayerIds },
                acknowledgedPlayerIds,
            )
                ? []
                : [{ ...resolution, requiredPlayerIds, acknowledgedPlayerIds }];
        });
}

function cloneDustEndTurnResult(result: BetrayalDustEndTurnResult): BetrayalDustEndTurnResult {
    return {
        ...result,
        swaps: result.swaps.map((swap) => ({ ...swap })),
        damageTraits: result.damageTraits ? [...result.damageTraits] : undefined,
    };
}

export function cloneTurnEndedPayload(payload: BetrayalTurnEndedPayload): BetrayalTurnEndedPayload {
    return {
        ...payload,
        roomEndTurnEffect: payload.roomEndTurnEffect
            ? cloneBetrayalRoomEndTurnEffectResult(payload.roomEndTurnEffect)
            : payload.roomEndTurnEffect,
        monsterMovementRoll: payload.monsterMovementRoll
            ? cloneMonsterMovementRollResult(payload.monsterMovementRoll)
            : payload.monsterMovementRoll,
        dustEndTurn: payload.dustEndTurn
            ? cloneDustEndTurnResult(payload.dustEndTurn)
            : undefined,
        magicCameraEndTurnCapturedEssencePlayerIds: payload.magicCameraEndTurnCapturedEssencePlayerIds
            ? [...payload.magicCameraEndTurnCapturedEssencePlayerIds]
            : undefined,
        deferredHelpingHandsMonsterTurnStart: payload.deferredHelpingHandsMonsterTurnStart
            ? {
                ...payload.deferredHelpingHandsMonsterTurnStart,
                moveDice: [...payload.deferredHelpingHandsMonsterTurnStart.moveDice],
            }
            : undefined,
        extraTurnAfterCurrentTurn: payload.extraTurnAfterCurrentTurn
            ? { ...payload.extraTurnAfterCurrentTurn }
            : undefined,
    };
}

export function clonePendingEventChoice(
    pending: BetrayalPendingEventChoiceState,
): BetrayalPendingEventChoiceState {
    return {
        ...pending,
        effect: cloneUseEffect(pending.effect),
        deferredTurnEnd: pending.deferredTurnEnd
            ? cloneTurnEndedPayload(pending.deferredTurnEnd)
            : undefined,
    };
}

export function clonePendingEventRollResolution(
    pending: BetrayalPendingEventRollResolutionState,
): BetrayalPendingEventRollResolutionState {
    return {
        ...pending,
        requiredPlayerIds: pending.requiredPlayerIds
            ? [...pending.requiredPlayerIds]
            : undefined,
        acknowledgedPlayerIds: pending.acknowledgedPlayerIds
            ? [...pending.acknowledgedPlayerIds]
            : undefined,
        effect: cloneUseEffect(pending.effect),
        nextPendingEventChoice: pending.nextPendingEventChoice
            ? clonePendingEventChoice(pending.nextPendingEventChoice)
            : undefined,
        deathPrevention: pending.deathPrevention
            ? {
                ...pending.deathPrevention,
                dice: [...pending.deathPrevention.dice],
                damageTraits: [...pending.deathPrevention.damageTraits],
                traitsBeforeDamage: { ...pending.deathPrevention.traitsBeforeDamage },
            }
            : undefined,
    };
}
