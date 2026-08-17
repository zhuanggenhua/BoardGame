import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    applySemanticMinionEffectBatch,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantContextualExtraAction,
    getMinionPower,
    inspectDeck,
    recoverCardsFromDiscard,
    revealAndPickFromDeck,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerProtection } from '../domain/ongoingEffects';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import type {
    BaseReplacedEvent,
    CardInstance,
    CardsDrawnEvent,
    CardsDiscardedEvent,
    DeckReorderedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { matchesDefId } from '../domain/utils';

type AvengersPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type MinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
};

type DiscardPromptContext = AvengersPromptContext & {
    sourceId: 'avengers_hawkeye' | 'avengers_jarvis';
    count: number;
};

type DrawThenDiscardContext = AvengersPromptContext & {
    sourceId: 'avengers_hawkeye' | 'avengers_jarvis';
    random: RandomFn;
    drawCount: number;
    discardCount: number;
};

type MovePromptContext = AvengersPromptContext & {
    sourceId: 'avengers_repulsor_boots';
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type RepulsorBootsSourcePromptContext = AvengersPromptContext & {
    special: boolean;
    sourceBaseIndex?: number;
};

type IronManPromptContext = AvengersPromptContext & {
    ironManUid: string;
    fromBaseIndex: number;
    companionUid?: string;
};

type ThorAttachmentChoice = {
    actionUid?: string;
    actionDefId?: string;
    actionOwnerId?: PlayerId;
    actionControllerId?: PlayerId;
    sourceBaseIndex?: number;
    sourceMinionUid?: string;
};

type ThorPromptContext = AvengersPromptContext & ThorAttachmentChoice;

type HawkeyeArrowsPromptContext = AvengersPromptContext & {
    actionCards: Array<{ cardUid: string; defId: string }>;
    hawkeyeInPlay: boolean;
};

type HawkeyeArrowsRevealContext = HawkeyeArrowsPromptContext & {
    revealEvents: SmashUpEvent[];
};

type HulkSmashPromptContext = AvengersPromptContext & {
    baseIndex: number;
};

type ModularSourceChoice = {
    kind?: 'minion' | 'base';
    actionUid?: string;
    actionDefId?: string;
    actionOwnerId?: PlayerId;
    actionControllerId?: PlayerId;
    sourceBaseIndex?: number;
    sourceMinionUid?: string;
};

type ModularPromptContext = AvengersPromptContext & ModularSourceChoice;

type StrategizePromptContext = AvengersPromptContext & {
    topCards: Array<{ cardUid: string; defId: string }>;
    selectedTopUids: string[];
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

function findMinion(
    state: SmashUpCore,
    minionUid: string,
): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const minion = state.bases[baseIndex].minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function getActionControllerId(action: {
    ownerId: PlayerId;
    metadata?: Record<string, unknown>;
}): PlayerId {
    return (
        (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId
    );
}

function buildDiscardOptions(
    state: SmashUpCore,
    playerId: PlayerId,
): Array<{
    id: string;
    label: string;
    value: CardChoice;
    displayMode: 'card';
}> {
    return (state.players[playerId]?.hand ?? []).map((card, index) => ({
        id: `card-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        displayMode: 'card' as const,
    }));
}

const discardCardsPromptProgram = createPromptProgram<DiscardPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_discard_cards',
    interactionSourceIds: ['avengers_hawkeye', 'avengers_jarvis'],
    buildInteraction: (context) => {
        const options = buildDiscardOptions(context.matchState.core, context.playerId);
        const count = Math.min(context.count, options.length);
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_discard_${context.now}`,
            context.playerId,
            context.sourceId === 'avengers_hawkeye'
                ? '鹰眼：弃掉两张牌'
                : 'J.A.R.V.I.S.：弃掉一张牌',
            options,
            {
                sourceId: context.sourceId,
                targetType: 'generic',
                titleKey: context.sourceId === 'avengers_hawkeye'
                    ? 'ui.avengers_hawkeye_discard_title'
                    : 'ui.avengers_jarvis_discard_title',
                multi: { min: count, max: count },
                responseValidationMode: 'live',
                autoResolveIfSingle: count === 1,
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const allowed = new Set(
            (state.core.players[context.playerId]?.hand ?? []).map(card => card.uid),
        );
        const cardUids = choices
            .map(choice => choice?.cardUid)
            .filter((uid): uid is string => !!uid && allowed.has(uid))
            .slice(0, context.count);
        if (cardUids.length === 0) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: context.playerId, cardUids },
                timestamp,
            } as CardsDiscardedEvent],
        };
    },
});

const discardPromptAfterCommittedDrawProgram = createEffectProgram<DrawThenDiscardContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const count = Math.min(
            context.discardCount,
            context.matchState.core.players[context.playerId]?.hand.length ?? 0,
        );
        if (count === 0) return { events: [] };
        return {
            events: [],
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                now: context.now,
                sourceId: context.sourceId,
                count,
            },
            nextProgram: discardCardsPromptProgram,
        };
    },
);

const drawThenDiscardProgram = createEffectProgram<DrawThenDiscardContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            context.drawCount,
            context.random,
            context.now,
        ),
        context,
        nextProgram: discardPromptAfterCommittedDrawProgram,
    }),
);

const blackWidowPromptProgram = createPromptProgram<
    AvengersPromptContext & { baseIndex: number },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'avengers_black_widow',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const candidates = (base?.minions ?? [])
            .filter(minion => getMinionPower(context.matchState.core, minion, context.baseIndex) <= 5)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `avengers_black_widow_${context.now}`,
            context.playerId,
            '黑寡妇：你可以摧毁这里一个力量5或更少的角色',
            [
                ...buildMinionTargetOptions(candidates, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'avengers_black_widow',
                    sourceKind: 'nonAction',
                    effectType: 'destroy',
                }),
                createSkipOption(),
            ],
            {
                sourceId: 'avengers_black_widow',
                targetType: 'minion',
                titleKey: 'ui.avengers_black_widow_title',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (choice?.skip || !choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
        const live = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!live || getMinionPower(state.core, live, choice.baseIndex) > 5) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: choice.baseIndex,
                destroyerId: playerId,
                sourcePlayerId: playerId,
                sourceDefId: 'avengers_black_widow',
                sourceControllerId: playerId,
                sourceBaseIndex: choice.baseIndex,
                sourceKind: 'nonAction',
                reason: 'avengers_black_widow',
                now: timestamp,
            }),
        };
    },
});

const avengersAssemblePromptProgram = createPromptProgram<AvengersPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_assemble',
    buildInteraction: (context) => {
        const options = (context.matchState.core.players[context.playerId]?.discard ?? [])
            .filter(card => card.type === 'minion')
            .map((card, index) => ({
                id: `card-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            }));
        return createAbilityRuntimeSimpleChoice(
            `avengers_assemble_${context.now}`,
            context.playerId,
            '复仇者集结：选择至多两名弃牌堆角色洗回牌库',
            options,
            {
                sourceId: 'avengers_assemble',
                targetType: 'generic',
                titleKey: 'ui.avengers_assemble_title',
                multi: { min: 0, max: Math.min(2, options.length) },
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choices = (Array.isArray(value) ? value : []) as CardChoice[];
        const selectedUids = new Set(
            choices.map(choice => choice.cardUid).filter((uid): uid is string => !!uid),
        );
        if (selectedUids.size === 0) return { events: [] };
        const cards = (state.core.players[context.playerId]?.discard ?? [])
            .filter(card => card.type === 'minion' && selectedUids.has(card.uid))
            .slice(0, 2);
        const cardsByOwner = new Map<PlayerId, CardInstance[]>();
        for (const card of cards) {
            const ownerCards = cardsByOwner.get(card.owner) ?? [];
            ownerCards.push(card);
            cardsByOwner.set(card.owner, ownerCards);
        }
        const events: DeckReorderedEvent[] = [];
        for (const [ownerId, ownerCards] of cardsByOwner) {
            const owner = state.core.players[ownerId];
            if (!owner) continue;
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: random.shuffle([...owner.deck, ...ownerCards]).map(card => card.uid),
                    ...(ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                },
                timestamp,
            } as DeckReorderedEvent);
        }
        return { events };
    },
});

const moveMinionDestinationPromptProgram = createPromptProgram<MovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_repulsor_boots_move',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `avengers_repulsor_boots_move_${context.now}`,
        context.playerId,
        '斥力靴：选择目标基地',
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
            sourceId: 'avengers_repulsor_boots_move',
            targetType: 'base',
            titleKey: 'ui.avengers_repulsor_boots_move_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined || choice.baseIndex === context.fromBaseIndex) return { events: [] };
        const live = state.core.bases[context.fromBaseIndex]?.minions.find(
            minion => minion.uid === context.minionUid && minion.controller === playerId,
        );
        if (!live) return { events: [] };
        return {
            events: buildValidatedMoveEvents(state.core, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                moverId: playerId,
                sourcePlayerId: playerId,
                sourceDefId: context.sourceId,
                sourceKind: 'action',
                reason: context.sourceId,
                now: timestamp,
            }),
        };
    },
});

const repulsorBootsSourcePromptProgram = createPromptProgram<
    RepulsorBootsSourcePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'avengers_repulsor_boots_source',
    buildInteraction: (context) => {
        const candidates = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion =>
                    minion.controller === context.playerId
                    && (
                        !context.special
                        || (
                            baseIndex === context.sourceBaseIndex
                            && matchesDefId(minion.defId, 'avengers_iron_man')
                        )
                    ))
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
                }))
        ));
        return createAbilityRuntimeSimpleChoice(
            `avengers_repulsor_boots_source_${context.now}`,
            context.playerId,
            context.special
                ? '斥力靴：选择要移动的钢铁侠'
                : '斥力靴：选择要移动的你的角色',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'avengers_repulsor_boots',
                sourceKind: 'action',
                effectType: 'move',
                respectActionProtection: true,
            }),
            {
                sourceId: 'avengers_repulsor_boots_source',
                targetType: 'minion',
                titleKey: context.special
                    ? 'ui.avengers_repulsor_boots_source_special_title'
                    : 'ui.avengers_repulsor_boots_source_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (!choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
        const live = state.core.bases[choice.baseIndex]?.minions.find(minion =>
            minion.uid === choice.minionUid
            && minion.controller === context.playerId
            && (
                !context.special
                || (
                    choice.baseIndex === context.sourceBaseIndex
                    && matchesDefId(minion.defId, 'avengers_iron_man')
                )
            ));
        if (!live) return { events: [] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'avengers_repulsor_boots',
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: choice.baseIndex,
            },
            nextProgram: moveMinionDestinationPromptProgram,
        };
    },
});

const ironManDestinationPromptProgram = createPromptProgram<IronManPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_iron_man_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `avengers_iron_man_destination_${context.now}`,
        context.playerId,
        '钢铁侠：选择要移动到的基地',
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
            sourceId: 'avengers_iron_man_destination',
            targetType: 'base',
            titleKey: 'ui.avengers_iron_man_destination_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined || choice.baseIndex === context.fromBaseIndex) return { events: [] };
        const sourceBase = state.core.bases[context.fromBaseIndex];
        const ironMan = sourceBase?.minions.find(minion =>
            minion.uid === context.ironManUid
            && minion.controller === playerId
            && matchesDefId(minion.defId, 'avengers_iron_man'));
        if (!ironMan) return { events: [] };
        const events = buildValidatedMoveEvents(state.core, {
            minionUid: ironMan.uid,
            minionDefId: ironMan.defId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: choice.baseIndex,
            moverId: playerId,
            sourcePlayerId: playerId,
            sourceDefId: 'avengers_iron_man',
            sourceKind: 'nonAction',
            reason: 'avengers_iron_man',
            now: timestamp,
        });
        if (context.companionUid) {
            const companion = sourceBase.minions.find(minion =>
                minion.uid === context.companionUid
                && minion.controller === playerId
                && minion.uid !== ironMan.uid);
            if (companion) {
                events.push(...buildValidatedMoveEvents(state.core, {
                    minionUid: companion.uid,
                    minionDefId: companion.defId,
                    fromBaseIndex: context.fromBaseIndex,
                    toBaseIndex: choice.baseIndex,
                    moverId: playerId,
                    sourcePlayerId: playerId,
                    sourceDefId: 'avengers_iron_man',
                    sourceKind: 'nonAction',
                    reason: 'avengers_iron_man',
                    now: timestamp,
                }));
            }
        }
        return { events };
    },
});

const ironManCompanionPromptProgram = createPromptProgram<IronManPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_iron_man_companion',
    buildInteraction: (context) => {
        const candidates = (context.matchState.core.bases[context.fromBaseIndex]?.minions ?? [])
            .filter(minion => minion.controller === context.playerId && minion.uid !== context.ironManUid)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.fromBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `avengers_iron_man_companion_${context.now}`,
            context.playerId,
            '钢铁侠：你可以选择这里另一个你的角色一同移动',
            [
                createSkipOption(),
                ...buildMinionTargetOptions(candidates, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'avengers_iron_man',
                    sourceKind: 'nonAction',
                    effectType: 'move',
                }),
            ],
            {
                sourceId: 'avengers_iron_man_companion',
                targetType: 'minion',
                titleKey: 'ui.avengers_iron_man_companion_title',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        return {
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                ...(choice?.minionUid ? { companionUid: choice.minionUid } : {}),
            },
            nextProgram: ironManDestinationPromptProgram,
        };
    },
});

const thorDestinationPromptProgram = createPromptProgram<ThorPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_thor_mjolnir_destination',
    buildInteraction: (context) => {
        const candidates = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.uid !== context.sourceMinionUid)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
                })));
        return createAbilityRuntimeSimpleChoice(
            `avengers_thor_mjolnir_destination_${context.now}`,
            context.playerId,
            '索尔：选择雷神锤的新装备角色',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'avengers_thor',
                sourceKind: 'nonAction',
                semanticRole: 'reference',
                effectType: 'affect',
            }),
            {
                sourceId: 'avengers_thor_mjolnir_destination',
                targetType: 'minion',
                titleKey: 'ui.avengers_thor_mjolnir_destination_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (
            !context.actionUid
            || !context.actionDefId
            || !context.actionOwnerId
            || choice?.baseIndex === undefined
            || !choice.minionUid
        ) {
            return { events: [] };
        }
        return {
            events: buildSemanticOngoingAttachEvents(state, {
                cardUid: context.actionUid,
                defId: context.actionDefId,
                ownerId: context.actionOwnerId,
                sourcePlayerId: context.playerId,
                sourceKind: 'nonAction',
                targetBaseIndex: choice.baseIndex,
                targetMinionUid: choice.minionUid,
                now: timestamp,
            }),
        };
    },
});

const thorSourcePromptProgram = createPromptProgram<
    AvengersPromptContext & { sources: Required<ThorAttachmentChoice>[] },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'avengers_thor_mjolnir_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `avengers_thor_mjolnir_source_${context.now}`,
        context.playerId,
        '索尔：选择要移动的雷神锤',
        context.sources.map((source, index) => ({
            id: `mjolnir-${index}`,
            label: `雷神锤 @ ${getBaseDef(context.matchState.core.bases[source.sourceBaseIndex].defId)?.name ?? source.sourceBaseIndex}`,
            value: source,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'avengers_thor_mjolnir_source',
            targetType: 'generic',
            titleKey: 'ui.avengers_thor_mjolnir_source_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as ThorAttachmentChoice | undefined;
        if (!choice?.actionUid) return { events: [] };
        return {
            events: [],
            context: {
                ...context,
                ...choice,
                matchState: state,
                now: timestamp,
            },
            nextProgram: thorDestinationPromptProgram,
        };
    },
});

const hawkeyeArrowsPickPromptProgram = createPromptProgram<HawkeyeArrowsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_hawkeyes_arrows_pick',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `avengers_hawkeyes_arrows_pick_${context.now}`,
        context.playerId,
        '鹰眼箭：选择抽取一张展示的法术',
        context.actionCards.map((card, index) => ({
            id: `action-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: card,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'avengers_hawkeyes_arrows_pick',
            targetType: 'generic',
            titleKey: 'ui.avengers_hawkeyes_arrows_pick_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = value as CardChoice | undefined;
        if (!choice?.cardUid || !context.actionCards.some(card => card.cardUid === choice.cardUid)) {
            return { events: [] };
        }
        const liveDeck = state.core.players[context.playerId]?.deck ?? [];
        const selected = liveDeck.find(card => card.uid === choice.cardUid && card.type === 'action');
        if (!selected) return { events: [] };
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: context.playerId, count: 1, cardUids: [selected.uid] },
            timestamp,
        } as CardsDrawnEvent];
        const remaining = liveDeck.filter(card => card.uid !== selected.uid);
        if (remaining.length > 0) {
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: context.playerId,
                    deckUids: random.shuffle(remaining).map(card => card.uid),
                },
                timestamp,
            } as DeckReorderedEvent);
        }
        if (context.hawkeyeInPlay) {
            events.push(grantContextualExtraAction(
                { playerId: context.playerId, now: timestamp, matchState: state },
                'avengers_hawkeyes_arrows',
                { restrictToCardUid: selected.uid },
            ));
        }
        return { events };
    },
});

const hawkeyeArrowsPromptAfterRevealProgram = createEffectProgram<HawkeyeArrowsRevealContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: context.revealEvents,
        context: {
            matchState: context.matchState,
            playerId: context.playerId,
            now: context.now,
            actionCards: context.actionCards,
            hawkeyeInPlay: context.hawkeyeInPlay,
        },
        nextProgram: hawkeyeArrowsPickPromptProgram,
    }),
);

const hulkSmashReplacePromptProgram = createPromptProgram<HulkSmashPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_hulk_smash_replace',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `avengers_hulk_smash_replace_${context.now}`,
        context.playerId,
        '浩克冲击：你可以让浩克摧毁并替换这个基地',
        [
            { id: 'replace', label: '替换基地', labelKey: 'ui.avengers_hulk_smash_replace_option', value: { replace: true }, displayMode: 'button' as const },
            createSkipOption(),
        ],
        {
            sourceId: 'avengers_hulk_smash_replace',
            targetType: 'button',
            titleKey: 'ui.avengers_hulk_smash_replace_title',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as { replace?: boolean; skip?: boolean } | undefined;
        if (!choice?.replace || choice.skip) return { events: [] };
        const base = state.core.bases[context.baseIndex];
        const newBaseDefId = state.core.baseDeck[0];
        if (
            !base
            || !newBaseDefId
            || !base.minions.some(minion =>
                minion.controller === context.playerId
                && matchesDefId(minion.defId, 'avengers_hulk'))
        ) {
            return { events: [] };
        }
        const attached = [
            ...base.ongoingActions,
            ...base.minions.flatMap(minion => minion.attachedActions),
        ];
        return {
            events: [
                ...attached.map(action => buildOngoingDetachedEvent({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    reason: 'avengers_hulk_smash',
                    destination: 'discard',
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'avengers_hulk_smash',
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.baseIndex,
                    now: timestamp,
                })),
                {
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: context.baseIndex,
                        oldBaseDefId: base.defId,
                        oldBaseInstanceId: base.instanceId,
                        newBaseDefId,
                        keepCards: true,
                    },
                    timestamp,
                } as BaseReplacedEvent,
            ],
        };
    },
});

const hulkSmashArtifactsPromptProgram = createPromptProgram<HulkSmashPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_hulk_smash_artifacts',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const actions = base?.ongoingActions ?? [];
        return createAbilityRuntimeSimpleChoice(
            `avengers_hulk_smash_artifacts_${context.now}`,
            context.playerId,
            '浩克冲击：选择任意数量该基地上的基地神器',
            actions.map((action, index) => ({
                id: `artifact-${index}`,
                label: getCardDef(action.defId)?.name ?? action.defId,
                value: { cardUid: action.uid, defId: action.defId },
                displayMode: 'card' as const,
            })),
            {
                sourceId: 'avengers_hulk_smash_artifacts',
                targetType: 'generic',
                titleKey: 'ui.avengers_hulk_smash_artifacts_title',
                multi: { min: 0, max: actions.length },
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : []) as CardChoice[];
        const selected = new Set(
            choices.map(choice => choice.cardUid).filter((uid): uid is string => !!uid),
        );
        const base = state.core.bases[context.baseIndex];
        const events = (base?.ongoingActions ?? [])
            .filter(action => selected.has(action.uid))
            .map(action => buildOngoingDetachedEvent({
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                reason: 'avengers_hulk_smash_artifact',
                destination: 'discard',
                sourcePlayerId: context.playerId,
                sourceDefId: 'avengers_hulk_smash',
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                now: timestamp,
            }));
        const canReplace = Boolean(
            state.core.baseDeck[0]
            && state.core.bases[context.baseIndex]?.minions.some(minion =>
                minion.controller === context.playerId
                && matchesDefId(minion.defId, 'avengers_hulk')),
        );
        if (!canReplace) return { events };
        return {
            events,
            context: { ...context, matchState: state, now: timestamp },
            nextProgram: hulkSmashReplacePromptProgram,
        };
    },
});

function collectModularSources(state: SmashUpCore, playerId: PlayerId): ModularSourceChoice[] {
    const sources: ModularSourceChoice[] = [];
    state.bases.forEach((base, baseIndex) => {
        if (state.bases.length > 1) {
            base.ongoingActions.forEach(action => {
                const controllerId = getActionControllerId(action);
                if (controllerId !== playerId) return;
                sources.push({
                    kind: 'base',
                    actionUid: action.uid,
                    actionDefId: action.defId,
                    actionOwnerId: action.ownerId,
                    actionControllerId: controllerId,
                    sourceBaseIndex: baseIndex,
                });
            });
        }
        base.minions.forEach(minion => {
            minion.attachedActions.forEach(action => {
                const controllerId = getActionControllerId(action);
                if (controllerId !== playerId) return;
                const destinations = state.bases.flatMap((candidateBase, candidateBaseIndex) =>
                    candidateBase.minions
                        .filter(candidate => candidate.uid !== minion.uid)
                        .map(candidate => ({
                            uid: candidate.uid,
                            defId: candidate.defId,
                            baseIndex: candidateBaseIndex,
                        })));
                const hasDestination = buildMinionTargetOptions(destinations, {
                    state,
                    sourcePlayerId: playerId,
                    sourceDefId: 'avengers_modular_tech',
                    sourceKind: 'action',
                    effectType: 'affect',
                    respectActionProtection: true,
                }).length > 0;
                if (!hasDestination) return;
                sources.push({
                    kind: 'minion',
                    actionUid: action.uid,
                    actionDefId: action.defId,
                    actionOwnerId: action.ownerId,
                    actionControllerId: controllerId,
                    sourceBaseIndex: baseIndex,
                    sourceMinionUid: minion.uid,
                });
            });
        });
    });
    return sources;
}

const modularDestinationPromptProgram = createPromptProgram<ModularPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_modular_tech_destination',
    interactionSourceIds: [
        'avengers_modular_tech_destination_base',
        'avengers_modular_tech_destination_minion',
    ],
    buildInteraction: (context) => {
        if (context.kind === 'base') {
            return createAbilityRuntimeSimpleChoice(
                `avengers_modular_tech_destination_${context.now}`,
                context.playerId,
                '模块化技术：选择神器的新基地',
                buildBaseTargetOptions(
                    context.matchState.core.bases
                        .map((base, baseIndex) => ({
                            baseIndex,
                            label: getBaseDef(base.defId)?.name ?? base.defId,
                        }))
                        .filter(candidate => candidate.baseIndex !== context.sourceBaseIndex),
                    context.matchState.core,
                ),
                {
                    sourceId: 'avengers_modular_tech_destination_base',
                    targetType: 'base',
                    titleKey: 'ui.avengers_modular_tech_destination_base_title',
                    responseValidationMode: 'live',
                },
            );
        }
        const candidates = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.uid !== context.sourceMinionUid)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
                })));
        return createAbilityRuntimeSimpleChoice(
            `avengers_modular_tech_destination_${context.now}`,
            context.playerId,
            '模块化技术：选择装备的新角色',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'avengers_modular_tech',
                sourceKind: 'action',
                effectType: 'affect',
                respectActionProtection: true,
            }),
            {
                sourceId: 'avengers_modular_tech_destination_minion',
                targetType: 'minion',
                titleKey: 'ui.avengers_modular_tech_destination_minion_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        if (!context.actionUid || !context.actionDefId || !context.actionOwnerId) return { events: [] };
        const choice = value as MinionChoice & BaseChoice;
        const targetBaseIndex = choice.baseIndex;
        if (targetBaseIndex === undefined) return { events: [] };
        const attachEvents = buildSemanticOngoingAttachEvents(state, {
            cardUid: context.actionUid,
            defId: context.actionDefId,
            ownerId: context.actionOwnerId,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            targetBaseIndex,
            ...(context.kind === 'minion' && choice.minionUid
                ? { targetMinionUid: choice.minionUid }
                : {}),
            now: timestamp,
        });
        return {
            events: [
                ...attachEvents,
                grantContextualExtraAction(
                    { playerId: context.playerId, now: timestamp, matchState: state },
                    'avengers_modular_tech',
                ),
            ],
        };
    },
});

const modularSourcePromptProgram = createPromptProgram<
    AvengersPromptContext & { sources: ModularSourceChoice[] },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'avengers_modular_tech_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `avengers_modular_tech_source_${context.now}`,
        context.playerId,
        '模块化技术：选择要移动的装备或基地神器',
        context.sources.map((source, index) => ({
            id: `source-${index}`,
            ...(source.actionDefId
                ? { label: getCardDef(source.actionDefId)?.name ?? source.actionDefId }
                : { labelKey: 'ui.avengers_modular_tech_source_fallback_option' }),
            value: source,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'avengers_modular_tech_source',
            targetType: 'generic',
            titleKey: 'ui.avengers_modular_tech_source_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as ModularSourceChoice | undefined;
        if (!choice?.actionUid) return { events: [] };
        return {
            events: [],
            context: { ...context, ...choice, matchState: state, now: timestamp },
            nextProgram: modularDestinationPromptProgram,
        };
    },
});

const strategizePromptProgram = createPromptProgram<StrategizePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'avengers_strategize_order',
    buildInteraction: (context) => {
        const selected = new Set(context.selectedTopUids);
        const options = context.topCards
            .filter(card => !selected.has(card.cardUid))
            .map((card, index) => ({
                id: `card-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: card,
                displayMode: 'card' as const,
            }));
        return createAbilityRuntimeSimpleChoice(
            `avengers_strategize_order_${context.selectedTopUids.length}_${context.now}`,
            context.playerId,
            context.selectedTopUids.length === 0
                ? '战略部署：选择牌库顶第一张牌'
                : '战略部署：选择牌库顶第二张牌',
            options,
            {
                sourceId: 'avengers_strategize_order',
                targetType: 'generic',
                titleKey: context.selectedTopUids.length === 0
                    ? 'ui.avengers_strategize_order_first_title'
                    : 'ui.avengers_strategize_order_second_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as CardChoice | undefined;
        if (!choice?.cardUid || !context.topCards.some(card => card.cardUid === choice.cardUid)) {
            return { events: [] };
        }
        const selectedTopUids = [...context.selectedTopUids, choice.cardUid];
        const targetTopCount = Math.min(2, context.topCards.length);
        if (selectedTopUids.length < targetTopCount) {
            return {
                events: [],
                context: { ...context, selectedTopUids, matchState: state, now: timestamp },
                nextProgram: strategizePromptProgram,
            };
        }
        const trackedUids = new Set(context.topCards.map(card => card.cardUid));
        const liveDeck = state.core.players[context.playerId]?.deck ?? [];
        const selectedSet = new Set(selectedTopUids);
        const middle = liveDeck.filter(card => !trackedUids.has(card.uid));
        const bottom = context.topCards
            .filter(card => !selectedSet.has(card.cardUid))
            .map(card => liveDeck.find(candidate => candidate.uid === card.cardUid))
            .filter((card): card is CardInstance => !!card);
        return {
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: context.playerId,
                    deckUids: [...selectedTopUids, ...middle.map(card => card.uid), ...bottom.map(card => card.uid)],
                },
                timestamp,
            } as DeckReorderedEvent],
        };
    },
});

function ironMan(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const ironMan = base?.minions.find(minion =>
        minion.uid === ctx.cardUid
        && minion.controller === ctx.playerId
        && matchesDefId(minion.defId, 'avengers_iron_man'));
    if (!ironMan || ctx.state.bases.length <= 1) return { events: [] };
    const context: IronManPromptContext = {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ironManUid: ironMan.uid,
        fromBaseIndex: ctx.baseIndex,
    };
    const hasCompanion = base.minions.some(minion =>
        minion.controller === ctx.playerId && minion.uid !== ironMan.uid);
    return runtimeToAbilityResult(executeAbilityProgram(
        hasCompanion ? ironManCompanionPromptProgram : ironManDestinationPromptProgram,
        context,
    ));
}

function thorOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const deckCard = player.deck.find(card => matchesDefId(card.defId, 'avengers_mjolnir'));
    const discardCard = player.discard.find(card => matchesDefId(card.defId, 'avengers_mjolnir'));
    const events: SmashUpEvent[] = [];

    if (player.deck.length > 0) {
        events.push(inspectDeck(
            ctx.playerId,
            ctx.playerId,
            player.deck.length,
            'avengers_thor',
            ctx.now,
        ));
    }

    if (deckCard) {
        events.push(revealDeckTop(
            ctx.playerId,
            'all',
            [{ uid: deckCard.uid, defId: deckCard.defId }],
            1,
            'avengers_thor',
            ctx.now,
            ctx.playerId,
        ));
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [deckCard.uid] },
            timestamp: ctx.now,
        } as CardsDrawnEvent);
        const remaining = player.deck.filter(card => card.uid !== deckCard.uid);
        if (remaining.length > 0) {
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ctx.playerId,
                    deckUids: ctx.random.shuffle(remaining).map(card => card.uid),
                },
                timestamp: ctx.now,
            } as DeckReorderedEvent);
        }
        return { events };
    }

    if (discardCard) {
        events.push(recoverCardsFromDiscard(
            ctx.playerId,
            [discardCard.uid],
            'avengers_thor',
            ctx.now,
        ));
    }
    if (player.deck.length > 1) {
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ctx.playerId,
                deckUids: ctx.random.shuffle([...player.deck]).map(card => card.uid),
            },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
    }
    if (!discardCard) {
        events.push(buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now));
    }
    return { events };
}

function thorTalent(ctx: AbilityContext): AbilityResult {
    const allMinions = ctx.state.bases.flatMap(base => base.minions);
    if (allMinions.length <= 1) return { events: [] };
    const sources: Required<ThorAttachmentChoice>[] = [];
    ctx.state.bases.forEach((base, baseIndex) => {
        base.minions.forEach(minion => {
            minion.attachedActions.forEach(action => {
                if (!matchesDefId(action.defId, 'avengers_mjolnir')) return;
                sources.push({
                    actionUid: action.uid,
                    actionDefId: action.defId,
                    actionOwnerId: action.ownerId,
                    actionControllerId: getActionControllerId(action),
                    sourceBaseIndex: baseIndex,
                    sourceMinionUid: minion.uid,
                });
            });
        });
    });
    if (sources.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    if (sources.length === 1) {
        return runtimeToAbilityResult(executeAbilityProgram(thorDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            ...sources[0],
        }));
    }
    return runtimeToAbilityResult(executeAbilityProgram(thorSourcePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sources,
    }));
}

function hawkeyesArrows(ctx: AbilityContext): AbilityResult {
    const result = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: card => card.type === 'action',
        maxPick: 2,
        missTarget: 'deck_bottom',
        revealTo: 'all',
        reason: 'avengers_hawkeyes_arrows',
        now: ctx.now,
    });
    const revealEvents = result.events.filter(event => event.type !== SU_EVENTS.CARDS_DRAWN);
    if (result.picked.length === 0) {
        return {
            events: [
                ...revealEvents,
                buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now),
            ],
        };
    }
    const hawkeyeInPlay = ctx.state.bases.some(base => base.minions.some(minion =>
        minion.controller === ctx.playerId
        && matchesDefId(minion.defId, 'avengers_hawkeye')));
    return runtimeToAbilityResult(executeAbilityProgram(hawkeyeArrowsPromptAfterRevealProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        revealEvents,
        actionCards: result.picked.map(card => ({ cardUid: card.uid, defId: card.defId })),
        hawkeyeInPlay,
    }));
}

function hulkSmash(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const context: HulkSmashPromptContext = {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex,
    };
    if (base.ongoingActions.length > 0) {
        return runtimeToAbilityResult(executeAbilityProgram(hulkSmashArtifactsPromptProgram, context));
    }
    const canReplace = Boolean(
        ctx.state.baseDeck[0]
        && base.minions.some(minion =>
            minion.controller === ctx.playerId
            && matchesDefId(minion.defId, 'avengers_hulk')),
    );
    if (!canReplace) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(hulkSmashReplacePromptProgram, context));
}

function modularTech(ctx: AbilityContext): AbilityResult {
    const sources = collectModularSources(ctx.state, ctx.playerId);
    if (sources.length === 0) {
        return {
            events: [grantContextualExtraAction(ctx, 'avengers_modular_tech')],
        };
    }
    if (sources.length === 1) {
        return runtimeToAbilityResult(executeAbilityProgram(modularDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            ...sources[0],
        }));
    }
    return runtimeToAbilityResult(executeAbilityProgram(modularSourcePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sources,
    }));
}

function strategize(ctx: AbilityContext): AbilityResult {
    const topCards = (ctx.state.players[ctx.playerId]?.deck ?? [])
        .slice(0, 4)
        .map(card => ({ cardUid: card.uid, defId: card.defId }));
    if (topCards.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }
    const inspectEvent = inspectDeck(
        ctx.playerId,
        ctx.playerId,
        topCards.length,
        'avengers_strategize',
        ctx.now,
    );
    if (topCards.length === 1) return { events: [inspectEvent] };
    const prompt = executeAbilityProgram(strategizePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        topCards,
        selectedTopUids: [],
    });
    return {
        events: [inspectEvent, ...prompt.events],
        ...(prompt.matchState ? { matchState: prompt.matchState } : {}),
    };
}

function blackWidow(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(blackWidowPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
    }));
}

function captainAmerica(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'avengers_captain_america', ctx.now)),
    };
}

function hawkeye(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(drawThenDiscardProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        random: ctx.random,
        now: ctx.now,
        sourceId: 'avengers_hawkeye',
        drawCount: 3,
        discardCount: 2,
    }));
}

function hulk(ctx: AbilityContext): AbilityResult {
    return {
        events: [addTempPower(ctx.cardUid, ctx.baseIndex, 2, 'avengers_hulk', ctx.now)],
    };
}

function avengersAssemble(ctx: AbilityContext): AbilityResult {
    const hasMinion = ctx.state.players[ctx.playerId]?.discard.some(card => card.type === 'minion') ?? false;
    if (!hasMinion) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(avengersAssemblePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    }));
}

function jarvis(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(drawThenDiscardProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        random: ctx.random,
        now: ctx.now,
        sourceId: 'avengers_jarvis',
        drawCount: 1,
        discardCount: 1,
    }));
}

function repulsorBoots(ctx: AbilityContext, special: boolean): AbilityResult {
    let source = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
    if (!source && special) {
        const scoringBase = ctx.state.bases[ctx.baseIndex];
        const ironMen = (scoringBase?.minions ?? []).filter(minion =>
            minion.controller === ctx.playerId && matchesDefId(minion.defId, 'avengers_iron_man'));
        if (ironMen.length === 1) source = { minion: ironMen[0], baseIndex: ctx.baseIndex };
    }
    if (!source) {
        if (ctx.state.bases.length <= 1) return { events: [] };
        const hasCandidate = special
            ? (ctx.state.bases[ctx.baseIndex]?.minions ?? []).some(minion =>
                minion.controller === ctx.playerId
                && matchesDefId(minion.defId, 'avengers_iron_man'))
            : ctx.state.bases.some(base =>
                base.minions.some(minion => minion.controller === ctx.playerId));
        if (!hasCandidate) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
        }
        return runtimeToAbilityResult(executeAbilityProgram(repulsorBootsSourcePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            special,
            ...(special ? { sourceBaseIndex: ctx.baseIndex } : {}),
        }));
    }
    if (source.minion.controller !== ctx.playerId) return { events: [] };
    if (
        special
        && (
            source.baseIndex !== ctx.baseIndex
            || !matchesDefId(source.minion.defId, 'avengers_iron_man')
        )
    ) {
        return { events: [] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(moveMinionDestinationPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'avengers_repulsor_boots',
        minionUid: source.minion.uid,
        minionDefId: source.minion.defId,
        fromBaseIndex: source.baseIndex,
    }));
}

function tacticalAdvantage(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const target = findMinion(ctx.state, ctx.targetMinionUid);
    if (!target) return { events: [] };
    const result = applySemanticMinionEffectBatch(
        ctx.state,
        [{ minion: target.minion, baseIndex: target.baseIndex }],
        {
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'avengers_tactical_advantage',
            sourceKind: 'action',
            effectType: 'affect',
            respectActionProtection: true,
            feedbackPlayerId: ctx.playerId,
            now: ctx.now,
            buildEvents: candidate => [
                addTempPower(candidate.minion.uid, candidate.baseIndex, 3, 'avengers_tactical_advantage', ctx.now),
            ],
        },
    );
    return { events: result.events };
}

function thunderAndLightning(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const target = findMinion(ctx.state, ctx.targetMinionUid);
    if (!target || getMinionPower(ctx.state, target.minion, target.baseIndex) > 3) return { events: [] };
    return {
        events: buildValidatedDestroyEvents(ctx.state, {
            minionUid: target.minion.uid,
            minionDefId: target.minion.defId,
            fromBaseIndex: target.baseIndex,
            destroyerId: ctx.playerId,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'avengers_thunder_and_lightning',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'action',
            reason: 'avengers_thunder_and_lightning',
            now: ctx.now,
        }),
    };
}

function widowsBite(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const opponents = base.minions
        .filter(minion => minion.controller !== ctx.playerId)
        .map(minion => ({ minion, baseIndex: ctx.baseIndex }));
    const result = applySemanticMinionEffectBatch(ctx.state, opponents, {
        sourcePlayerId: ctx.playerId,
        sourceDefId: 'avengers_widows_bite',
        sourceKind: 'action',
        effectType: 'affect',
        respectActionProtection: true,
        feedbackPlayerId: ctx.playerId,
        now: ctx.now,
        buildEvents: candidate => [
            addTempPower(candidate.minion.uid, candidate.baseIndex, -1, 'avengers_widows_bite', ctx.now),
        ],
    });
    const blackWidowEvents = base.minions
        .filter(minion =>
            minion.controller === ctx.playerId
            && matchesDefId(minion.defId, 'avengers_black_widow'))
        .map(minion => addTempPower(minion.uid, ctx.baseIndex, 2, 'avengers_widows_bite', ctx.now));
    return { events: [...result.events, ...blackWidowEvents] };
}

function capShieldActionProtection(ctx: Parameters<Parameters<typeof registerProtection>[2]>[0]): boolean {
    if (ctx.sourceKind !== 'action' || ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.minions.some(host => host.attachedActions.some(action =>
        matchesDefId(action.defId, 'avengers_caps_shield')
        && getActionControllerId(action) === ctx.targetMinion.controller));
}

export function registerAvengersAbilities(): void {
    registerSimpleAbility('avengers_black_widow', 'onPlay', blackWidow);
    registerSimpleAbility('avengers_captain_america', 'talent', captainAmerica);
    registerSimpleAbility('avengers_hawkeye', 'onPlay', hawkeye);
    registerSimpleAbility('avengers_hulk', 'talent', hulk);
    registerSimpleAbility('avengers_iron_man', 'talent', ironMan);
    registerSimpleAbility('avengers_thor', 'onPlay', thorOnPlay);
    registerSimpleAbility('avengers_thor', 'talent', thorTalent);
    registerSimpleAbility('avengers_assemble', 'onPlay', avengersAssemble);
    registerSimpleAbility('avengers_hawkeyes_arrows', 'onPlay', hawkeyesArrows);
    registerSimpleAbility('avengers_hulk_smash', 'onPlay', hulkSmash);
    registerSimpleAbility('avengers_jarvis', 'talent', jarvis);
    registerSimpleAbility('avengers_modular_tech', 'onPlay', modularTech);
    registerSimpleAbility('avengers_repulsor_boots', 'onPlay', ctx => repulsorBoots(ctx, false));
    registerSimpleAbility('avengers_repulsor_boots', 'special', ctx => repulsorBoots(ctx, true));
    registerSimpleAbility('avengers_strategize', 'onPlay', strategize);
    registerSimpleAbility('avengers_tactical_advantage', 'onPlay', tacticalAdvantage);
    registerSimpleAbility('avengers_thunder_and_lightning', 'onPlay', thunderAndLightning);
    registerSimpleAbility('avengers_widows_bite', 'special', widowsBite);

    registerProtection('avengers_caps_shield', 'action', capShieldActionProtection);
}
