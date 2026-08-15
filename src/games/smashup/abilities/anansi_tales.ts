import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildPlayerTargetOptions,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantExtraAction,
    inspectDeck,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { createPendingActionResolution, resolvePendingActionExecution } from '../domain/actionCounter';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerActiveBaseAbility, registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { createCardObjectRef, createCardObjectRefFromInstance, createCardTransferEvent } from '../domain/objectProvenance';
import { getEffectiveBreakpoint, registerCustomBreakpointModifiers } from '../domain/ongoingModifiers';
import {
    actionLikeNeedsPlayBase,
    actionLikeNeedsPlayMinion,
    isCardActionLike,
    isCardMinionLike,
} from '../domain/utils';
import type {
    ActionCardDef,
    ActionDefBlockedThisTurnEvent,
    ActionPlayedEvent,
    BaseMetadataUpdatedEvent,
    CardInstance,
    DeckReorderedEvent,
    MinionCardDef,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type AnansiPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type GiftCardChoice = {
    cardUid?: string;
    defId?: string;
    targetPlayerId?: PlayerId;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

type MinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    skip?: boolean;
};

type GiftCardsContext = AnansiPromptContext & {
    sourceId: string;
    title: string;
    minCards: number;
    maxCards: number;
    drawPerTransferred?: number;
    grantExtraActionAfter?: boolean;
    onePerOtherPlayer?: boolean;
    excludeCardUid?: string;
};

type GiftCardsAfterTransferContext = GiftCardsContext & {
    transferCount: number;
    random: RandomFn;
};

type GiftSelfContext = AnansiPromptContext & {
    sourceId: string;
    cardUid: string;
    defId: string;
    fromPlayerId?: PlayerId;
    drawCardsAfterTransfer?: number;
    baseMetadataAfterTransfer?: {
        baseIndex: number;
        metadataUpdate: Record<string, unknown>;
        reason: string;
    };
};

type GiftSelfAfterTransferContext = GiftSelfContext & {
    random: RandomFn;
};

type DrawThenGiftSelfContext = GiftSelfContext & {
    drawCount: number;
    random: RandomFn;
};

type PotOfWisdomContext = AnansiPromptContext & {
    otherCount: number;
    random: RandomFn;
};

type CounterPromptContext = AnansiPromptContext & {
    sourceId: string;
    counterCount: number;
    ownMinionsOnly?: boolean;
    giftSelf?: { cardUid: string; defId: string };
};

type MoveSourceContext = AnansiPromptContext & {
    sourceId: 'anansi_tales_feather_gifts';
    giftSelf: { cardUid: string; defId: string };
};

type MoveDestinationContext = MoveSourceContext & {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type DeckActionSearchContext = AnansiPromptContext & {
    sourceId: 'anansi_tales_the_perfect_gift' | 'anansi_tales_anansi_the_spider';
};

type PendingActionContinuationContext = AnansiPromptContext & {
    random: RandomFn;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    targetBaseIndex?: number;
    postGiftSelf?: {
        sourceId: string;
        cardUid: string;
        defId: string;
        fromPlayerId?: PlayerId;
    };
    lockActionDefAfter?: boolean;
};

type PendingActionAfterEventsContext = PendingActionContinuationContext & {
    leadingEvents: SmashUpEvent[];
};

type CollectingStoriesChoice = {
    cardUid?: string;
    defId?: string;
    fromPlayerId?: PlayerId;
    skip?: boolean;
};

type CollectingStoriesBaseContext = AnansiPromptContext & {
    cardUid: string;
    defId: string;
    fromPlayerId: PlayerId;
};

type DiscardActionRecycleContext = AnansiPromptContext & {
    sourceId: 'anansi_tales_ear_of_corn';
    giftSelf: { cardUid: string; defId: string };
};

type HornetBaseContext = AnansiPromptContext & {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
};

function runtimeToAbilityResult(result: {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
}): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function getTurnOrderPlayers(state: SmashUpCore): PlayerId[] {
    const ordered = (state.turnOrder?.length ? state.turnOrder : Object.keys(state.players)) as PlayerId[];
    return ordered.filter(playerId => Boolean(state.players[playerId]));
}

function getOtherPlayers(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    return getTurnOrderPlayers(state).filter(candidate => candidate !== playerId);
}

function getPlayerLabel(state: SmashUpCore, playerId: PlayerId): string {
    return state.players[playerId]?.name ?? `玩家 ${playerId}`;
}

function getCardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function getBaseLabel(state: SmashUpCore, baseIndex: number): string {
    const defId = state.bases[baseIndex]?.defId;
    return getBaseDef(defId ?? '')?.name ?? defId ?? `基地 ${baseIndex + 1}`;
}

function buildGiftCardOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    excludeCardUid?: string,
): PromptOption<GiftCardChoice>[] {
    const targets = getOtherPlayers(state, playerId);
    const hand = state.players[playerId]?.hand ?? [];
    const options: PromptOption<GiftCardChoice>[] = [];
    for (const [cardIndex, card] of hand.entries()) {
        if (card.uid === excludeCardUid) continue;
        for (const targetPlayerId of targets) {
            options.push({
                id: `gift-${cardIndex}-${targetPlayerId}`,
                label: `${getCardLabel(card.defId)} → ${getPlayerLabel(state, targetPlayerId)}`,
                value: { cardUid: card.uid, defId: card.defId, targetPlayerId },
                displayMode: 'card',
                displayCard: { defId: card.defId, cardUid: card.uid },
            });
        }
    }
    return options;
}

function buildTransferFromCard(
    card: CardInstance,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    return createCardTransferEvent({
        card: createCardObjectRefFromInstance(card, { sourceControllerId: fromPlayerId }),
        fromPlayerId,
        toPlayerId,
        reason,
        timestamp,
    });
}

function findCardInKnownZones(
    state: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    defId: string,
): { card: CardInstance; zonePlayerId: PlayerId } {
    const candidatePlayers = [
        playerId,
        ...getTurnOrderPlayers(state).filter(candidate => candidate !== playerId),
    ];
    for (const zonePlayerId of candidatePlayers) {
        const player = state.players[zonePlayerId];
        if (!player) continue;
        const card = [...player.hand, ...player.deck, ...player.discard].find(candidate =>
            candidate.uid === cardUid && candidate.defId === defId);
        if (card) return { card, zonePlayerId };
    }
    return {
        card: {
            uid: cardUid,
            defId,
            type: getCardDef(defId)?.type ?? 'action',
            owner: playerId,
            provenance: createCardObjectRef({
                uid: cardUid,
                defId,
                type: getCardDef(defId)?.type ?? 'action',
                ownerId: playerId,
                sourceControllerId: playerId,
            }).provenance,
        },
        zonePlayerId: playerId,
    };
}

function buildGiftSelfEvent(
    state: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    targetPlayerId: PlayerId,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    const { card, zonePlayerId } = findCardInKnownZones(state, playerId, cardUid, defId);
    return buildTransferFromCard(card, zonePlayerId, targetPlayerId, reason, timestamp);
}

function buildExtraActionEvent(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    return grantExtraAction(playerId, reason, timestamp, {
        playTiming: matchState.sys.phase === 'playCards' ? 'banked' : 'immediate',
    });
}

function isStandardActionDef(def: ReturnType<typeof getCardDef>): def is ActionCardDef {
    return def?.type === 'action' && def.subtype === 'standard';
}

function buildActionDefBlockedEvent(
    playerId: PlayerId,
    defId: string,
    reason: string,
    timestamp: number,
): ActionDefBlockedThisTurnEvent {
    return {
        type: SU_EVENTS.ACTION_DEF_BLOCKED_THIS_TURN,
        payload: { playerId, defId, reason },
        timestamp,
    };
}

function buildBaseMetadataUpdatedEvent(
    state: SmashUpCore,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): BaseMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: {
            baseIndex,
            baseInstanceId: state.bases[baseIndex]?.instanceId,
            metadataUpdate,
            reason,
        },
        timestamp,
    };
}

function buildExtraActionPlayEventsFromHand(
    playerId: PlayerId,
    fromPlayerId: PlayerId,
    card: CardInstance,
    reason: string,
    timestamp: number,
    targetBaseIndex?: number,
): SmashUpEvent[] {
    return [
        buildTransferFromCard(card, fromPlayerId, playerId, reason, timestamp),
        buildActionPlayedEvent({
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            timestamp,
            isExtraAction: true,
            ...(targetBaseIndex !== undefined ? { targetBaseIndex } : {}),
            sourceCommandType: reason,
        }),
    ];
}

function buildExtraMinionPlayEventsFromHand(
    state: SmashUpCore,
    playerId: PlayerId,
    fromPlayerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    timestamp: number,
): SmashUpEvent[] {
    const def = getCardDef(card.defId) as MinionCardDef | undefined;
    return [
        buildTransferFromCard(card, fromPlayerId, playerId, reason, timestamp),
        {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                baseIndex,
                baseDefId: state.bases[baseIndex]?.defId,
                power: def?.power ?? 0,
                consumesNormalLimit: false,
            },
            timestamp,
        } as MinionPlayedEvent,
    ];
}

function appendActionOnPlayResolution(params: {
    state: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
    playerId: PlayerId;
    card: CardInstance;
    random: Parameters<typeof resolvePendingActionExecution>[2];
    timestamp: number;
    targetBaseIndex?: number;
    postGiftSelf?: PendingActionContinuationContext['postGiftSelf'];
    lockActionDefAfter?: boolean;
}): {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
} {
    return executeAbilityProgram(pendingActionAfterEventsProgram, {
        matchState: params.state,
        playerId: params.playerId,
        now: params.timestamp,
        random: params.random,
        cardUid: params.card.uid,
        defId: params.card.defId,
        ownerId: params.card.owner,
        ...(params.targetBaseIndex !== undefined ? { targetBaseIndex: params.targetBaseIndex } : {}),
        ...(params.postGiftSelf ? { postGiftSelf: params.postGiftSelf } : {}),
        ...(params.lockActionDefAfter ? { lockActionDefAfter: true } : {}),
        leadingEvents: params.events,
    });
}

const pendingActionResolutionProgram = createEffectProgram<PendingActionContinuationContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const resolution = resolvePendingActionExecution(
            context.matchState,
            createPendingActionResolution({
                playerId: context.playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                ownerId: context.ownerId,
                ...(context.targetBaseIndex !== undefined ? { targetBaseIndex: context.targetBaseIndex } : {}),
                now: context.now,
            }),
            context.random,
            context.now,
        );
        const events = [
            ...resolution.events,
            ...(context.lockActionDefAfter
                ? [buildActionDefBlockedEvent(context.playerId, context.defId, 'anansi_tales_anansi_the_spider', context.now)]
                : []),
        ];
        if (!context.postGiftSelf) {
            return { events, matchState: resolution.state };
        }
        return {
            events,
            matchState: resolution.state,
            context: {
                matchState: resolution.state,
                playerId: context.playerId,
                now: context.now,
                ...context.postGiftSelf,
            } satisfies GiftSelfContext,
            nextProgram: giftSelfPromptProgram,
        };
    },
);

const pendingActionAfterEventsProgram = createEffectProgram<PendingActionAfterEventsContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const { leadingEvents: _leadingEvents, ...nextContext } = context;
        return {
            events: context.leadingEvents,
            context: nextContext,
            nextProgram: pendingActionResolutionProgram,
        };
    },
);

const giftCardsAfterTransferProgram = createEffectProgram<GiftCardsAfterTransferContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const events: SmashUpEvent[] = [];
        const drawCount = context.transferCount * (context.drawPerTransferred ?? 0);
        if (drawCount > 0) {
            events.push(...buildStandardDrawEvents(
                context.matchState.core,
                context.playerId,
                drawCount,
                context.random,
                context.now,
            ));
        }
        if (context.grantExtraActionAfter) {
            events.push(buildExtraActionEvent(context.matchState, context.playerId, context.sourceId, context.now));
        }
        return { events };
    },
);

const giftSelfAfterTransferProgram = createEffectProgram<GiftSelfAfterTransferContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const events: SmashUpEvent[] = [];
        if ((context.drawCardsAfterTransfer ?? 0) > 0) {
            events.push(...buildStandardDrawEvents(
                context.matchState.core,
                context.playerId,
                context.drawCardsAfterTransfer!,
                context.random,
                context.now,
            ));
        }
        if (context.baseMetadataAfterTransfer) {
            events.push(buildBaseMetadataUpdatedEvent(
                context.matchState.core,
                context.baseMetadataAfterTransfer.baseIndex,
                context.baseMetadataAfterTransfer.metadataUpdate,
                context.baseMetadataAfterTransfer.reason,
                context.now,
            ));
        }
        return { events };
    },
);

const giftCardsPromptProgram = createPromptProgram<GiftCardsContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_gift_cards',
    interactionSourceIds: [
        'anansi_tales_akye_the_turtle',
        'anansi_tales_trading_stories',
        'anansi_tales_pot_of_wisdom',
    ],
    buildInteraction: (context) => {
        const options = buildGiftCardOptions(context.matchState.core, context.playerId, context.excludeCardUid);
        const cappedMax = Math.min(context.maxCards, options.length);
        const minCards = Math.min(context.minCards, cappedMax);
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.title,
            context.minCards === 0
                ? [...options, createSkipOption()]
                : options,
            {
                sourceId: context.sourceId,
                targetType: 'hand',
                multi: context.maxCards > 1 ? { min: minCards, max: cappedMax } : undefined,
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        const rawChoices = (Array.isArray(value) ? value : [value]) as GiftCardChoice[];
        if (rawChoices.some(choice => choice?.skip)) {
            return { events: [] };
        }
        const usedCards = new Set<string>();
        const usedTargets = new Set<PlayerId>();
        const events: SmashUpEvent[] = [];
        for (const choice of rawChoices) {
            if (!choice?.cardUid || !choice.targetPlayerId) continue;
            if (usedCards.has(choice.cardUid)) continue;
            if (context.onePerOtherPlayer && usedTargets.has(choice.targetPlayerId)) continue;
            const card = state.core.players[context.playerId]?.hand.find(candidate => candidate.uid === choice.cardUid);
            if (!card) continue;
            if (!state.core.players[choice.targetPlayerId] || choice.targetPlayerId === context.playerId) continue;
            events.push(buildTransferFromCard(card, context.playerId, choice.targetPlayerId, context.sourceId, timestamp));
            usedCards.add(choice.cardUid);
            usedTargets.add(choice.targetPlayerId);
            if (events.length >= context.maxCards) break;
        }
        if (events.length < context.minCards) {
            return { events: [] };
        }
        return {
            events,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                transferCount: events.length,
                random: args.random,
            } satisfies GiftCardsAfterTransferContext,
            nextProgram: giftCardsAfterTransferProgram,
        };
    },
});

const giftSelfPromptProgram = createPromptProgram<GiftSelfContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_gift_self',
    interactionSourceIds: [
        'anansi_tales_let_it_be_full_and_eat',
        'anansi_tales_feather_gifts',
        'anansi_tales_pot_of_beans',
        'anansi_tales_ear_of_corn',
        'anansi_tales_the_perfect_gift_gift',
        'anansi_tales_anansi_the_spider_gift',
        'base_anansis_web',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.cardUid}_${context.now}`,
        context.playerId,
        `${getCardLabel(context.defId)}：选择要给牌的玩家`,
        buildPlayerTargetOptions(
            getOtherPlayers(context.matchState.core, context.playerId).map(targetPlayerId => ({
                label: getPlayerLabel(context.matchState.core, targetPlayerId),
                targetPlayerId,
            })),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectIntent: 'resource',
            },
        ),
        {
            sourceId: context.sourceId,
            targetType: 'player',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        const choice = value as { targetPlayerId?: PlayerId } | undefined;
        if (!choice?.targetPlayerId || choice.targetPlayerId === context.playerId) return { events: [] };
        const transferEvent = buildGiftSelfEvent(
            state.core,
            context.fromPlayerId ?? context.playerId,
            context.cardUid,
            context.defId,
            choice.targetPlayerId,
            context.sourceId,
            timestamp,
        );
        const events: SmashUpEvent[] = [transferEvent];
        return {
            events,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                random: args.random,
            } satisfies GiftSelfAfterTransferContext,
            nextProgram: giftSelfAfterTransferProgram,
        };
    },
});

const counterPromptProgram = createPromptProgram<CounterPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_counter_allocation',
    interactionSourceIds: [
        'anansi_tales_pot_of_beans',
        'anansi_tales_onini_the_python_counter',
    ],
    buildInteraction: (context) => {
        const candidates = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion => !context.ownMinionsOnly || minion.controller === context.playerId)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardLabel(minion.defId)} @ ${getBaseLabel(context.matchState.core, baseIndex)}`,
                }))
        ));
        const options = buildMinionTargetOptions(candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceId,
            sourceKind: 'nonAction',
            effectType: 'buff',
            semanticRole: 'reference',
        });
        const max = Math.min(context.counterCount, options.length);
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            context.counterCount === 1
                ? `选择一个${context.ownMinionsOnly ? '你的' : ''}随从放置 +1 力量指示物`
                : `选择至多 ${context.counterCount} 个随从分配 +1 力量指示物`,
            options,
            {
                sourceId: context.sourceId,
                targetType: 'minion',
                multi: context.counterCount > 1 ? { min: Math.min(1, max), max } : undefined,
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const valid = choices.filter(choice =>
            choice?.minionUid
            && choice.baseIndex !== undefined
            && state.core.bases[choice.baseIndex]?.minions.some(minion => minion.uid === choice.minionUid));
        const events: SmashUpEvent[] = [];
        if (valid.length === 1) {
            events.push(addPowerCounter(valid[0].minionUid!, valid[0].baseIndex!, context.counterCount, context.sourceId, timestamp));
        } else {
            for (const choice of valid.slice(0, context.counterCount)) {
                events.push(addPowerCounter(choice.minionUid!, choice.baseIndex!, 1, context.sourceId, timestamp));
            }
        }
        if (context.giftSelf) {
            return {
                events,
                context: {
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                    sourceId: context.sourceId,
                    ...context.giftSelf,
                } satisfies GiftSelfContext,
                nextProgram: giftSelfPromptProgram,
            };
        }
        return { events };
    },
});

const featherGiftDestinationPromptProgram = createPromptProgram<MoveDestinationContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_feather_gifts_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `anansi_tales_feather_gifts_destination_${context.now}`,
        context.playerId,
        '羽毛礼物：选择移动到的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                }))
                .filter(candidate => candidate.baseIndex !== context.fromBaseIndex),
            context.matchState.core,
        ),
        {
            sourceId: 'anansi_tales_feather_gifts_destination',
            targetType: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.anansi_tales_feather_gifts_destination_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        const events: SmashUpEvent[] = [];
        if (choice?.baseIndex !== undefined && choice.baseIndex !== context.fromBaseIndex) {
            events.push(...buildValidatedMoveEvents(state.core, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                sourcePlayerId: context.playerId,
                sourceControllerId: context.playerId,
                sourceDefId: context.sourceId,
                sourceKind: 'action',
                reason: context.sourceId,
                now: timestamp,
            }));
        }
        return {
            events,
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                ...context.giftSelf,
            } satisfies GiftSelfContext,
            nextProgram: giftSelfPromptProgram,
        };
    },
});

const featherGiftSourcePromptProgram = createPromptProgram<MoveSourceContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_feather_gifts',
    buildInteraction: (context) => {
        const candidates = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion => minion.controller === context.playerId)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardLabel(minion.defId)} @ ${getBaseLabel(context.matchState.core, baseIndex)}`,
                }))
        ));
        return createAbilityRuntimeSimpleChoice(
            `anansi_tales_feather_gifts_${context.now}`,
            context.playerId,
            '羽毛礼物：选择你的一个随从移动到另一个基地',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceId,
                sourceKind: 'action',
                effectType: 'move',
                semanticRole: 'reference',
            }),
            {
                sourceId: context.sourceId,
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.anansi_tales_feather_gifts_title',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (!choice?.minionUid || choice.baseIndex === undefined) {
            return {
                events: [],
                context: {
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                    sourceId: context.sourceId,
                    ...context.giftSelf,
                } satisfies GiftSelfContext,
                nextProgram: giftSelfPromptProgram,
            };
        }
        const live = state.core.bases[choice.baseIndex]?.minions.find(minion =>
            minion.uid === choice.minionUid && minion.controller === context.playerId);
        if (!live || state.core.bases.length <= 1) {
            return {
                events: [],
                context: {
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                    sourceId: context.sourceId,
                    ...context.giftSelf,
                } satisfies GiftSelfContext,
                nextProgram: giftSelfPromptProgram,
            };
        }
        return {
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: choice.baseIndex,
            } satisfies MoveDestinationContext,
            nextProgram: featherGiftDestinationPromptProgram,
        };
    },
});

const deckActionSearchPromptProgram = createPromptProgram<DeckActionSearchContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_deck_action_search',
    interactionSourceIds: [
        'anansi_tales_the_perfect_gift',
        'anansi_tales_anansi_the_spider',
    ],
    buildInteraction: (context) => {
        const actions = (context.matchState.core.players[context.playerId]?.deck ?? [])
            .filter(card => {
                return isStandardActionDef(getCardDef(card.defId));
            });
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.now}`,
            context.playerId,
            `${context.sourceId === 'anansi_tales_anansi_the_spider' ? '蜘蛛阿南西' : '完美的礼物'}：选择牌库中的标准行动`,
            actions.map((card, index) => ({
                id: `action-${index}`,
                label: getCardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
                displayCard: { defId: card.defId, cardUid: card.uid },
            })),
            {
                sourceId: context.sourceId,
                targetType: 'hand',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as GiftCardChoice | undefined;
        const card = choice?.cardUid
            ? state.core.players[context.playerId]?.deck.find(candidate => candidate.uid === choice.cardUid)
            : undefined;
        if (!card) return { events: [] };
        const actionPlayed = buildActionPlayedEvent({
            playerId: context.playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            timestamp,
            isExtraAction: true,
            sourceCommandType: context.sourceId,
        }) as ActionPlayedEvent;
        const playEvents: SmashUpEvent[] = [
            inspectDeck(context.playerId, context.playerId, state.core.players[context.playerId]?.deck.length ?? 0, context.sourceId, timestamp),
            createCardTransferEvent({
                card: createCardObjectRefFromInstance(card, { sourceControllerId: context.playerId }),
                fromPlayerId: context.playerId,
                toPlayerId: context.playerId,
                reason: context.sourceId,
                timestamp,
            }),
            actionPlayed,
        ];
        const resolvedAction = appendActionOnPlayResolution({
            state,
            events: playEvents,
            playerId: context.playerId,
            card,
            random,
            timestamp,
            postGiftSelf: {
                sourceId: `${context.sourceId}_gift`,
                cardUid: card.uid,
                defId: card.defId,
                fromPlayerId: context.playerId,
            },
            lockActionDefAfter: context.sourceId === 'anansi_tales_anansi_the_spider',
        });
        return { events: resolvedAction.events, matchState: resolvedAction.matchState };
    },
});

const collectingStoriesPromptProgram = createPromptProgram<AnansiPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_collecting_stories',
    buildInteraction: (context) => {
        const options: PromptOption<CollectingStoriesChoice>[] = getOtherPlayers(context.matchState.core, context.playerId)
            .flatMap(fromPlayerId => (
                (context.matchState.core.players[fromPlayerId]?.hand ?? [])
                    .filter(card => card.owner === context.playerId)
                    .map((card, index) => ({
                        id: `collect-${fromPlayerId}-${index}`,
                        label: `${getCardLabel(card.defId)} ← ${getPlayerLabel(context.matchState.core, fromPlayerId)}`,
                        value: { cardUid: card.uid, defId: card.defId, fromPlayerId },
                        displayMode: 'card' as const,
                        displayCard: { defId: card.defId, cardUid: card.uid },
                    }))
            ));
        return createAbilityRuntimeSimpleChoice(
            `anansi_tales_collecting_stories_${context.now}`,
            context.playerId,
            '收集故事：选择另一名玩家手中你拥有的一张牌额外打出',
            [...options, createSkipOption()],
            {
                sourceId: 'anansi_tales_collecting_stories',
                targetType: 'hand',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.anansi_tales_collecting_stories_title',
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as CollectingStoriesChoice | undefined;
        if (choice?.skip || !choice?.cardUid || !choice.defId || !choice.fromPlayerId) {
            return { events: [] };
        }
        const card = state.core.players[choice.fromPlayerId]?.hand.find(candidate =>
            candidate.uid === choice.cardUid && candidate.owner === context.playerId);
        if (!card) return { events: [] };
        const def = getCardDef(card.defId);
        if (isCardMinionLike(card) || def?.type === 'fusion') {
            return {
                events: [],
                context: {
                    matchState: state,
                    playerId: context.playerId,
                    now: timestamp,
                    cardUid: card.uid,
                    defId: card.defId,
                    fromPlayerId: choice.fromPlayerId,
                } satisfies CollectingStoriesBaseContext,
                nextProgram: collectingStoriesBasePromptProgram,
            };
        }
        if (isCardActionLike(card) && isStandardActionDef(def)) {
            if (actionLikeNeedsPlayBase(def) && !actionLikeNeedsPlayMinion(def)) {
                return {
                    events: [],
                    context: {
                        matchState: state,
                        playerId: context.playerId,
                        now: timestamp,
                        cardUid: card.uid,
                        defId: card.defId,
                        fromPlayerId: choice.fromPlayerId,
                    } satisfies CollectingStoriesBaseContext,
                    nextProgram: collectingStoriesBasePromptProgram,
                };
            }
            const events = buildExtraActionPlayEventsFromHand(
                context.playerId,
                choice.fromPlayerId,
                card,
                'anansi_tales_collecting_stories',
                timestamp,
            );
            const resolved = appendActionOnPlayResolution({
                state,
                events,
                playerId: context.playerId,
                card,
                random,
                timestamp,
            });
            return { events: resolved.events, matchState: resolved.matchState };
        }
        return { events: [] };
    },
});

const collectingStoriesBasePromptProgram = createPromptProgram<CollectingStoriesBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_collecting_stories_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `anansi_tales_collecting_stories_base_${context.cardUid}_${context.now}`,
        context.playerId,
        '收集故事：选择额外打出到的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            })),
            context.matchState.core,
        ),
        {
            sourceId: 'anansi_tales_collecting_stories_base',
            targetType: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.anansi_tales_collecting_stories_base_title',
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined) return { events: [] };
        const card = state.core.players[context.fromPlayerId]?.hand.find(candidate =>
            candidate.uid === context.cardUid && candidate.owner === context.playerId);
        if (!card) return { events: [] };
        const def = getCardDef(card.defId);
        if (isCardMinionLike(card) || def?.type === 'fusion') {
            return {
                events: buildExtraMinionPlayEventsFromHand(
                    state.core,
                    context.playerId,
                    context.fromPlayerId,
                    card,
                    choice.baseIndex,
                    'anansi_tales_collecting_stories',
                    timestamp,
                ),
            };
        }
        if (isCardActionLike(card) && isStandardActionDef(def)) {
            const events = buildExtraActionPlayEventsFromHand(
                context.playerId,
                context.fromPlayerId,
                card,
                'anansi_tales_collecting_stories',
                timestamp,
                choice.baseIndex,
            );
            const resolved = appendActionOnPlayResolution({
                state,
                events,
                playerId: context.playerId,
                card,
                random,
                timestamp,
                targetBaseIndex: choice.baseIndex,
            });
            return { events: resolved.events, matchState: resolved.matchState };
        }
        return { events: [] };
    },
});

const discardActionRecyclePromptProgram = createPromptProgram<DiscardActionRecycleContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_ear_of_corn',
    buildInteraction: (context) => {
        const actions = (context.matchState.core.players[context.playerId]?.discard ?? [])
            .filter(card => card.type === 'action');
        return createAbilityRuntimeSimpleChoice(
            `anansi_tales_ear_of_corn_${context.now}`,
            context.playerId,
            '玉米穗：选择至多三张弃牌堆行动洗回牌库',
            actions.map((card, index) => ({
                id: `discard-action-${index}`,
                label: getCardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
                displayCard: { defId: card.defId, cardUid: card.uid },
            })),
            {
                sourceId: context.sourceId,
                targetType: 'hand',
                multi: { min: 0, max: Math.min(3, actions.length) },
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.anansi_tales_ear_of_corn_title',
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as GiftCardChoice[];
        const selectedUids = new Set(choices.map(choice => choice.cardUid).filter((uid): uid is string => !!uid));
        const player = state.core.players[context.playerId];
        const selected = (player?.discard ?? [])
            .filter(card => card.type === 'action' && selectedUids.has(card.uid))
            .slice(0, 3);
        const events: SmashUpEvent[] = [];
        if (player && selected.length > 0) {
            const remainingDeck = player.deck.filter(card => !selected.some(entry => entry.uid === card.uid));
            const deckUids = random.shuffle([...remainingDeck, ...selected]).map(card => card.uid);
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId: context.playerId, deckUids },
                timestamp,
            } as DeckReorderedEvent);
        }
        events.push(buildExtraActionEvent(state, context.playerId, context.sourceId, timestamp));
        return {
            events,
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                ...context.giftSelf,
            } satisfies GiftSelfContext,
            nextProgram: giftSelfPromptProgram,
        };
    },
});

const hornetBasePromptProgram = createPromptProgram<HornetBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'anansi_tales_mboro_hornet',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `anansi_tales_mboro_hornet_${context.cardUid}_${context.now}`,
        context.playerId,
        '马布罗大黄蜂：选择打出到的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            })),
            context.matchState.core,
        ),
        {
            sourceId: 'anansi_tales_mboro_hornet',
            targetType: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.anansi_tales_mboro_hornet_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined) return { events: [] };
        const live = state.core.players[context.playerId]?.hand.find(card =>
            card.uid === context.cardUid && card.defId === context.defId);
        if (!live) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: context.playerId,
                    cardUid: live.uid,
                    defId: live.defId,
                    ownerId: context.ownerId,
                    baseIndex: choice.baseIndex,
                    baseDefId: state.core.bases[choice.baseIndex]?.defId,
                    power: 2,
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent],
        };
    },
});

const giftSelfAfterCommittedDrawProgram = createEffectProgram<GiftSelfContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: [],
        context,
        nextProgram: giftSelfPromptProgram,
    }),
);

const drawThenGiftSelfProgram = createEffectProgram<DrawThenGiftSelfContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            context.drawCount,
            context.random,
            context.now,
        ),
        context: {
            matchState: context.matchState,
            playerId: context.playerId,
            now: context.now,
            sourceId: context.sourceId,
            cardUid: context.cardUid,
            defId: context.defId,
            ...(context.fromPlayerId ? { fromPlayerId: context.fromPlayerId } : {}),
            ...(context.drawCardsAfterTransfer !== undefined ? { drawCardsAfterTransfer: context.drawCardsAfterTransfer } : {}),
            ...(context.baseMetadataAfterTransfer ? { baseMetadataAfterTransfer: context.baseMetadataAfterTransfer } : {}),
        } satisfies GiftSelfContext,
        nextProgram: giftSelfAfterCommittedDrawProgram,
    }),
);

const potOfWisdomAfterCommittedDrawProgram = createEffectProgram<PotOfWisdomContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const handCount = context.matchState.core.players[context.playerId]?.hand.length ?? 0;
        if (handCount === 0 || context.otherCount === 0) {
            return {
                events: [buildExtraActionEvent(
                    context.matchState,
                    context.playerId,
                    'anansi_tales_pot_of_wisdom',
                    context.now,
                )],
            };
        }
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: context.now,
                sourceId: 'anansi_tales_pot_of_wisdom',
                title: '智慧之锅：给每名其他玩家一张手牌，然后额外打出一个行动',
                minCards: Math.min(context.otherCount, handCount),
                maxCards: context.otherCount,
                onePerOtherPlayer: true,
                grantExtraActionAfter: true,
            } satisfies GiftCardsContext,
            nextProgram: giftCardsPromptProgram,
        };
    },
);

const potOfWisdomProgram = createEffectProgram<PotOfWisdomContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            context.otherCount,
            context.random,
            context.now,
        ),
        context,
        nextProgram: potOfWisdomAfterCommittedDrawProgram,
    }),
);

function akyeTheTurtle(ctx: AbilityContext): AbilityResult {
    const hasGift = (ctx.state.players[ctx.playerId]?.hand ?? []).some(card => card.uid !== ctx.cardUid);
    if (!hasGift || getOtherPlayers(ctx.state, ctx.playerId).length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(giftCardsPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'anansi_tales_akye_the_turtle',
        title: '阿克耶海龟：可以将一张手牌给另一名玩家来抽两张',
        minCards: 0,
        maxCards: 1,
        drawPerTransferred: 2,
        excludeCardUid: ctx.cardUid,
    }));
}

function tradingStories(ctx: AbilityContext): AbilityResult {
    if ((ctx.state.players[ctx.playerId]?.hand.length ?? 0) === 0 || getOtherPlayers(ctx.state, ctx.playerId).length === 0) {
        return { events: [] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(giftCardsPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'anansi_tales_trading_stories',
        title: '交易故事：可以将至多三张手牌给其他玩家，每给一张抽一张',
        minCards: 0,
        maxCards: 3,
        drawPerTransferred: 1,
    }));
}

function letItBeFullAndEat(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(drawThenGiftSelfProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'anansi_tales_let_it_be_full_and_eat',
        cardUid: ctx.cardUid,
        defId: ctx.defId,
        drawCount: 2,
        random: ctx.random,
    }));
}

function potOfBeans(ctx: AbilityContext): AbilityResult {
    const hasMinion = ctx.state.bases.some(base => base.minions.length > 0);
    if (!hasMinion) {
        return runtimeToAbilityResult(executeAbilityProgram(giftSelfPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'anansi_tales_pot_of_beans',
            cardUid: ctx.cardUid,
            defId: ctx.defId,
        }));
    }
    return runtimeToAbilityResult(executeAbilityProgram(counterPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'anansi_tales_pot_of_beans',
        counterCount: 2,
        giftSelf: { cardUid: ctx.cardUid, defId: ctx.defId },
    }));
}

function featherGifts(ctx: AbilityContext): AbilityResult {
    if (ctx.state.bases.length <= 1 || !ctx.state.bases.some(base => base.minions.some(minion => minion.controller === ctx.playerId))) {
        return runtimeToAbilityResult(executeAbilityProgram(giftSelfPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'anansi_tales_feather_gifts',
            cardUid: ctx.cardUid,
            defId: ctx.defId,
        }));
    }
    return runtimeToAbilityResult(executeAbilityProgram(featherGiftSourcePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'anansi_tales_feather_gifts',
        giftSelf: { cardUid: ctx.cardUid, defId: ctx.defId },
    }));
}

function potOfWisdom(ctx: AbilityContext): AbilityResult {
    const otherCount = getOtherPlayers(ctx.state, ctx.playerId).length;
    return runtimeToAbilityResult(executeAbilityProgram(potOfWisdomProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        otherCount,
        random: ctx.random,
    }));
}

function earOfCorn(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(discardActionRecyclePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'anansi_tales_ear_of_corn',
        giftSelf: { cardUid: ctx.cardUid, defId: ctx.defId },
    }));
}

function deckActionGift(ctx: AbilityContext, sourceId: DeckActionSearchContext['sourceId']): AbilityResult {
    const hasAction = (ctx.state.players[ctx.playerId]?.deck ?? []).some(card => {
        const def = getCardDef(card.defId) as ActionCardDef | undefined;
        return def?.type === 'action' && def.subtype === 'standard';
    });
    if (!hasAction || getOtherPlayers(ctx.state, ctx.playerId).length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(deckActionSearchPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
    }));
}

function collectingStories(ctx: AbilityContext): AbilityResult {
    const options = getOtherPlayers(ctx.state, ctx.playerId).flatMap(targetPlayerId => (
        (ctx.state.players[targetPlayerId]?.hand ?? [])
            .filter(card => card.owner === ctx.playerId)
            .map(card => ({ targetPlayerId, card }))
    ));
    if (options.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(collectingStoriesPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    }));
}

function oseboTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.transferredFromPlayerId !== ctx.sourceControllerId) return [];
    if (!ctx.transferredToPlayerId || ctx.transferredToPlayerId === ctx.sourceControllerId) return [];
    return [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'anansi_tales_osebo_the_leopard', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'anansi_tales_osebo_the_leopard',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function borrowedCardCondition(ctx: TriggerContext): boolean {
    if (!ctx.sourceControllerId) return false;
    if (ctx.playerId === ctx.sourceControllerId) return false;
    if (ctx.timing === 'onActionPlayed') {
        return !!ctx.triggerCardOwnerId && ctx.triggerCardOwnerId !== ctx.playerId;
    }
    if (ctx.timing === 'onMinionPlayed') {
        const playedFrom = ctx.triggerMinion?.metadata?.playedFrom;
        if (playedFrom === 'discard' || playedFrom === 'buried') return false;
        return !!ctx.triggerMinion && ctx.triggerMinion.owner !== ctx.playerId;
    }
    if (ctx.timing === 'onCardsDiscarded') {
        if (ctx.discardedFromZone !== 'hand' && ctx.discardedFromZone !== 'deck') return false;
        return (ctx.discardedCards ?? []).some(card => card.ownerId !== ctx.playerId);
    }
    return false;
}

function oniniTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceControllerId) return { events: [] };
    const candidates = ctx.state.bases.flatMap(base => base.minions)
        .filter(minion => minion.controller === ctx.sourceControllerId);
    if (candidates.length === 0) return { events: [] };
    return executeAbilityProgram(counterPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        sourceId: 'anansi_tales_onini_the_python_counter',
        counterCount: 1,
        ownMinionsOnly: true,
    });
}

function hornetTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId) return { events: [] };
    return executeAbilityProgram(hornetBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        cardUid: ctx.sourceCardUid,
        defId: 'anansi_tales_mboro_hornet',
        ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
    });
}

function anansisWebOnActionPlayed(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState || !ctx.triggerCardUid || !ctx.triggerCardDefId || !ctx.triggerCardOwnerId) return { events: [] };
    if (ctx.actionTargetBaseIndex !== ctx.baseIndex) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base?.minions.some(minion => minion.controller === ctx.playerId)) return { events: [] };
    if (base.metadata?.anansisWebUsedTurn === ctx.state.turnNumber) return { events: [] };
    if (!isStandardActionDef(getCardDef(ctx.triggerCardDefId))) return { events: [] };
    const ownerDiscard = ctx.state.players[ctx.triggerCardOwnerId]?.discard ?? [];
    if (!ownerDiscard.some(card => card.uid === ctx.triggerCardUid)) return { events: [] };
    const gift = executeAbilityProgram(giftSelfPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_anansis_web',
        cardUid: ctx.triggerCardUid,
        defId: ctx.triggerCardDefId,
        fromPlayerId: ctx.triggerCardOwnerId,
        drawCardsAfterTransfer: 2,
        baseMetadataAfterTransfer: {
            baseIndex: ctx.baseIndex,
            metadataUpdate: { anansisWebUsedTurn: ctx.state.turnNumber },
            reason: 'base_anansis_web',
        },
    });
    return {
        events: gift.events,
        ...(gift.matchState ? { matchState: gift.matchState } : {}),
    };
}

function storytellersHut(ctx: BaseAbilityContext): AbilityResult {
    const currentCounters = Number(ctx.state.bases[ctx.baseIndex]?.metadata?.storytellersHutCounters ?? 0);
    return {
        events: [
            grantExtraAction(ctx.playerId, 'base_storytellers_hut', ctx.now, {
                playTiming: ctx.matchState?.sys.phase === 'playCards' ? 'banked' : 'immediate',
            }),
            buildBaseMetadataUpdatedEvent(
                ctx.state,
                ctx.baseIndex,
                { storytellersHutCounters: currentCounters + 1 },
                'base_storytellers_hut',
                ctx.now,
            ),
        ],
    };
}

export function registerAnansiTalesAbilities(): void {
    registerCustomBreakpointModifiers([{
        sourceDefId: 'base_storytellers_hut',
        runtimeIdentity: 'synthetic',
        compute: (ctx) => ctx.base.defId === 'base_storytellers_hut'
            ? -2 * Number(ctx.base.metadata?.storytellersHutCounters ?? 0)
            : 0,
    }]);

    registerSimpleAbility('anansi_tales_anansi_the_spider', 'talent', ctx => deckActionGift(ctx, 'anansi_tales_anansi_the_spider'));
    registerSimpleAbility('anansi_tales_akye_the_turtle', 'onPlay', akyeTheTurtle);
    registerSimpleAbility('anansi_tales_the_perfect_gift', 'onPlay', ctx => deckActionGift(ctx, 'anansi_tales_the_perfect_gift'));
    registerSimpleAbility('anansi_tales_pot_of_beans', 'onPlay', potOfBeans);
    registerSimpleAbility('anansi_tales_collecting_stories', 'onPlay', collectingStories);
    registerSimpleAbility('anansi_tales_ear_of_corn', 'onPlay', earOfCorn);
    registerSimpleAbility('anansi_tales_pot_of_wisdom', 'onPlay', potOfWisdom);
    registerSimpleAbility('anansi_tales_trading_stories', 'onPlay', tradingStories);
    registerSimpleAbility('anansi_tales_let_it_be_full_and_eat', 'onPlay', letItBeFullAndEat);
    registerSimpleAbility('anansi_tales_feather_gifts', 'onPlay', featherGifts);

    registerTrigger('anansi_tales_osebo_the_leopard', 'onCardTransferred', oseboTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    for (const timing of ['onActionPlayed', 'onMinionPlayed', 'onCardsDiscarded'] as const) {
        registerTrigger('anansi_tales_onini_the_python', timing, oniniTrigger, {
            perInstance: true,
            optional: true,
            playerContext: 'sourceController',
            baseScoped: false,
            canTrigger: borrowedCardCondition,
        });
        registerTrigger('anansi_tales_mboro_hornet', timing, hornetTrigger, {
            global: true,
            globalZones: ['hand'],
            optional: true,
            playerContext: 'sourceController',
            baseScoped: false,
            canTrigger: borrowedCardCondition,
        });
    }

    registerBaseAbility('base_anansis_web', 'onActionPlayed', anansisWebOnActionPlayed, {
        mandatory: false,
        canTrigger: ctx => {
            const base = ctx.state.bases[ctx.baseIndex];
            return ctx.actionTargetBaseIndex === ctx.baseIndex
                && isStandardActionDef(getCardDef(ctx.triggerCardDefId ?? ''))
                && base?.minions.some(minion => minion.controller === ctx.playerId) === true
                && base.metadata?.anansisWebUsedTurn !== ctx.state.turnNumber;
        },
    });
    registerActiveBaseAbility('base_storytellers_hut', storytellersHut, {
        oncePerTurn: true,
        canUse: ctx => getEffectiveBreakpoint(ctx.state, ctx.baseIndex) > 0,
    });
}
