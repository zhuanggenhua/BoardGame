import type { MatchState, PlayerId } from '../../../engine/types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import {
    createEffectProgram,
    createPromptProgram,
    type AbilityProgram,
    type AbilityRuntimeEffectResult,
    type AbilityRuntimePromptResolveArgs,
} from './abilityRuntime';
import {
    addPowerCounter,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    moveMinion,
} from './abilityHelpers';
import { drawCards as drawCardsFromDeck } from './utils';
import {
    SU_EVENTS,
    type CardsDiscardedEvent,
    type CardsDrawnEvent,
    type DeckReshuffledEvent,
    type MinionReturnedEvent,
    type SmashUpCore,
    type SmashUpEvent,
    type SmashUpReactionResourceFootprint,
    type SmashUpReactionResourceRef,
    type VpAwardedEvent,
} from './types';

type ValueOrResolver<TContext, TValue> = TValue | ((context: TContext) => TValue);

export interface SmashUpEffectPrimitive<TContext> {
    readonly kind: string;
    execute(context: TContext): AbilityRuntimeEffectResult<TContext, SmashUpCore, SmashUpEvent> | SmashUpEvent[];
    footprint(context: TContext): SmashUpReactionResourceFootprint;
}

export type SmashUpEffectDslProgram<TContext> = AbilityProgram<TContext, SmashUpCore, SmashUpEvent>;

function resolveValue<TContext, TValue>(value: ValueOrResolver<TContext, TValue>, context: TContext): TValue {
    return typeof value === 'function'
        ? (value as (context: TContext) => TValue)(context)
        : value;
}

export function emptyFootprint(): SmashUpReactionResourceFootprint {
    return { reads: [], writes: [] };
}

export function createFootprint(params: {
    reads?: SmashUpReactionResourceRef[];
    writes?: SmashUpReactionResourceRef[];
    opensInteraction?: boolean;
}): SmashUpReactionResourceFootprint {
    return {
        reads: dedupeResources(params.reads ?? []),
        writes: dedupeResources(params.writes ?? []),
        ...(params.opensInteraction ? { opensInteraction: true } : {}),
    };
}

export function mergeEffectFootprints(
    footprints: Array<SmashUpReactionResourceFootprint | undefined>,
): SmashUpReactionResourceFootprint {
    return createFootprint({
        reads: footprints.flatMap(footprint => footprint?.reads ?? []),
        writes: footprints.flatMap(footprint => footprint?.writes ?? []),
        opensInteraction: footprints.some(footprint => footprint?.opensInteraction),
    });
}

function resourceKey(ref: SmashUpReactionResourceRef): string {
    switch (ref.kind) {
        case 'minion':
        case 'cardInstance':
        case 'sourceInstance':
        case 'titan':
            return `${ref.kind}:${ref.uid}`;
        case 'base':
            return `base:${ref.index}`;
        case 'playerHand':
        case 'playerDeck':
        case 'playerDiscard':
        case 'playerRemoved':
        case 'playerPlayLimit':
        case 'playerVp':
        case 'playerControl':
            return `${ref.kind}:${ref.playerId}`;
        case 'turnFlag':
            return `turnFlag:${ref.playerId ?? 'global'}:${ref.key}`;
        case 'scoring':
        case 'targetAvailability':
            return `${ref.kind}:${ref.baseIndex ?? 'global'}`;
        case 'baseDeck':
        case 'madnessDeck':
            return ref.kind;
        case 'global':
            return `global:${ref.key}`;
        default: {
            const exhaustive: never = ref;
            return JSON.stringify(exhaustive);
        }
    }
}

function dedupeResources(refs: SmashUpReactionResourceRef[]): SmashUpReactionResourceRef[] {
    const map = new Map<string, SmashUpReactionResourceRef>();
    for (const ref of refs) {
        if (ref.kind === 'base' && ref.index < 0) continue;
        map.set(resourceKey(ref), ref);
    }
    return [...map.values()];
}

export function defineEffectPrimitive<TContext>(
    kind: string,
    execute: SmashUpEffectPrimitive<TContext>['execute'],
    footprint: SmashUpEffectPrimitive<TContext>['footprint'],
): SmashUpEffectPrimitive<TContext> {
    return { kind, execute, footprint };
}

export function sequencePrimitives<TContext>(
    ...primitives: SmashUpEffectPrimitive<TContext>[]
): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'sequence',
        (context) => {
            let events: SmashUpEvent[] = [];
            let nextContext = context;
            let matchState: AbilityRuntimeEffectResult<TContext, SmashUpCore, SmashUpEvent>['matchState'];
            for (const primitive of primitives) {
                const result = primitive.execute(nextContext);
                const normalized = Array.isArray(result) ? { events: result } : result;
                events = [...events, ...normalized.events];
                nextContext = normalized.context ?? nextContext;
                matchState = normalized.matchState ?? matchState;
                if (normalized.suspended) {
                    return {
                        events,
                        context: nextContext,
                        matchState,
                        suspended: true,
                        continuationId: normalized.continuationId,
                        nextProgram: normalized.nextProgram,
                    };
                }
                if (normalized.nextProgram) {
                    return {
                        events,
                        context: nextContext,
                        matchState,
                        nextProgram: normalized.nextProgram,
                    };
                }
            }
            return { events, context: nextContext, matchState };
        },
        (context) => mergeEffectFootprints(primitives.map(primitive => primitive.footprint(context))),
    );
}

export function branchPrimitive<TContext>(params: {
    when: (context: TContext) => boolean;
    then: SmashUpEffectPrimitive<TContext>;
    otherwise?: SmashUpEffectPrimitive<TContext>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'branch',
        (context) => (params.when(context) ? params.then : params.otherwise)?.execute(context) ?? [],
        (context) => (params.when(context) ? params.then : params.otherwise)?.footprint(context) ?? emptyFootprint(),
    );
}

export function optionalPrimitive<TContext>(params: {
    when: (context: TContext) => boolean;
    effect: SmashUpEffectPrimitive<TContext>;
}): SmashUpEffectPrimitive<TContext> {
    return branchPrimitive({
        when: params.when,
        then: params.effect,
    });
}

export function createEffectDslProgram<TContext>(
    primitive: SmashUpEffectPrimitive<TContext>,
): SmashUpEffectDslProgram<TContext> {
    return createEffectProgram<TContext, SmashUpCore, SmashUpEvent>(
        (context) => primitive.execute(context),
        { deriveFootprint: (context) => primitive.footprint(context) },
    );
}

export function createPromptDslProgram<TContext>(params: {
    sourceId: string;
    interactionSourceIds?: string[];
    footprint: (context: TContext) => SmashUpReactionResourceFootprint;
    buildInteraction: (context: TContext) => InteractionDescriptor;
    onResolve: (
        args: AbilityRuntimePromptResolveArgs<TContext, SmashUpCore, SmashUpEvent>,
    ) => AbilityRuntimeEffectResult<TContext, SmashUpCore, SmashUpEvent>;
}): SmashUpEffectDslProgram<TContext> {
    return createPromptProgram<TContext, SmashUpCore, SmashUpEvent>({
        sourceId: params.sourceId,
        interactionSourceIds: params.interactionSourceIds,
        deriveFootprint: params.footprint,
        buildInteraction: params.buildInteraction,
        onResolve: params.onResolve,
    });
}

export function addPowerCounterPrimitive<TContext>(params: {
    minionUid: ValueOrResolver<TContext, string | undefined>;
    baseIndex: ValueOrResolver<TContext, number | undefined>;
    amount: ValueOrResolver<TContext, number>;
    reason: ValueOrResolver<TContext, string>;
    now: ValueOrResolver<TContext, number>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'addPowerCounter',
        (context) => {
            const minionUid = resolveValue(params.minionUid, context);
            const baseIndex = resolveValue(params.baseIndex, context);
            if (!minionUid || baseIndex === undefined) return { events: [] };
            return {
                events: [addPowerCounter(
                    minionUid,
                    baseIndex,
                    resolveValue(params.amount, context),
                    resolveValue(params.reason, context),
                    resolveValue(params.now, context),
                )],
            };
        },
        (context) => {
            const minionUid = resolveValue(params.minionUid, context);
            const baseIndex = resolveValue(params.baseIndex, context);
            return createFootprint({
                reads: [
                    ...(minionUid ? [{ kind: 'minion' as const, uid: minionUid }] : []),
                    ...(baseIndex === undefined ? [] : [{ kind: 'base' as const, index: baseIndex }]),
                ],
                writes: [
                    ...(minionUid ? [{ kind: 'minion' as const, uid: minionUid }] : []),
                    ...(baseIndex === undefined ? [] : [{ kind: 'base' as const, index: baseIndex }]),
                ],
            });
        },
    );
}

export function moveMinionPrimitive<TContext>(params: {
    minionUid: ValueOrResolver<TContext, string | undefined>;
    minionDefId: ValueOrResolver<TContext, string | undefined>;
    fromBaseIndex: ValueOrResolver<TContext, number | undefined>;
    toBaseIndex: ValueOrResolver<TContext, number | undefined>;
    reason: ValueOrResolver<TContext, string>;
    now: ValueOrResolver<TContext, number>;
    toBaseDefId?: ValueOrResolver<TContext, string | undefined>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'moveMinion',
        (context) => {
            const minionUid = resolveValue(params.minionUid, context);
            const minionDefId = resolveValue(params.minionDefId, context);
            const fromBaseIndex = resolveValue(params.fromBaseIndex, context);
            const toBaseIndex = resolveValue(params.toBaseIndex, context);
            if (!minionUid || !minionDefId || fromBaseIndex === undefined || toBaseIndex === undefined) {
                return { events: [] };
            }
            return {
                events: [moveMinion(
                    minionUid,
                    minionDefId,
                    fromBaseIndex,
                    toBaseIndex,
                    resolveValue(params.reason, context),
                    resolveValue(params.now, context),
                    params.toBaseDefId ? resolveValue(params.toBaseDefId, context) : undefined,
                )],
            };
        },
        (context) => {
            const minionUid = resolveValue(params.minionUid, context);
            const fromBaseIndex = resolveValue(params.fromBaseIndex, context);
            const toBaseIndex = resolveValue(params.toBaseIndex, context);
            return createFootprint({
                reads: [
                    ...(minionUid ? [{ kind: 'minion' as const, uid: minionUid }] : []),
                    ...(fromBaseIndex === undefined ? [] : [{ kind: 'base' as const, index: fromBaseIndex }]),
                    ...(toBaseIndex === undefined ? [] : [{ kind: 'base' as const, index: toBaseIndex }]),
                ],
                writes: [
                    ...(minionUid ? [{ kind: 'minion' as const, uid: minionUid }] : []),
                    ...(fromBaseIndex === undefined ? [] : [{ kind: 'base' as const, index: fromBaseIndex }]),
                    ...(toBaseIndex === undefined ? [] : [{ kind: 'base' as const, index: toBaseIndex }]),
                    { kind: 'targetAvailability' },
                ],
            });
        },
    );
}

export function returnMinionToHandPrimitive<TContext>(params: {
    minionUid: ValueOrResolver<TContext, string | undefined>;
    minionDefId: ValueOrResolver<TContext, string | undefined>;
    fromBaseIndex: ValueOrResolver<TContext, number | undefined>;
    toPlayerId: ValueOrResolver<TContext, PlayerId | undefined>;
    reason: ValueOrResolver<TContext, string>;
    now: ValueOrResolver<TContext, number>;
    sourcePlayerId?: ValueOrResolver<TContext, PlayerId | undefined>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'returnMinionToHand',
        (context) => {
            const minionUid = resolveValue(params.minionUid, context);
            const minionDefId = resolveValue(params.minionDefId, context);
            const fromBaseIndex = resolveValue(params.fromBaseIndex, context);
            const toPlayerId = resolveValue(params.toPlayerId, context);
            if (!minionUid || !minionDefId || fromBaseIndex === undefined || !toPlayerId) return { events: [] };
            const event: MinionReturnedEvent = {
                type: SU_EVENTS.MINION_RETURNED,
                payload: {
                    minionUid,
                    minionDefId,
                    fromBaseIndex,
                    toPlayerId,
                    reason: resolveValue(params.reason, context),
                    ...(params.sourcePlayerId ? { sourcePlayerId: resolveValue(params.sourcePlayerId, context) } : {}),
                },
                timestamp: resolveValue(params.now, context),
            };
            return { events: [event] };
        },
        (context) => {
            const minionUid = resolveValue(params.minionUid, context);
            const fromBaseIndex = resolveValue(params.fromBaseIndex, context);
            const toPlayerId = resolveValue(params.toPlayerId, context);
            return createFootprint({
                reads: [
                    ...(minionUid ? [{ kind: 'minion' as const, uid: minionUid }] : []),
                    ...(fromBaseIndex === undefined ? [] : [{ kind: 'base' as const, index: fromBaseIndex }]),
                ],
                writes: [
                    ...(minionUid ? [{ kind: 'minion' as const, uid: minionUid }] : []),
                    ...(fromBaseIndex === undefined ? [] : [{ kind: 'base' as const, index: fromBaseIndex }]),
                    ...(toPlayerId ? [{ kind: 'playerHand' as const, playerId: toPlayerId }] : []),
                ],
            });
        },
    );
}

export function drawCardsPrimitive<TContext>(params: {
    playerId: ValueOrResolver<TContext, PlayerId>;
    count: ValueOrResolver<TContext, number>;
    now: ValueOrResolver<TContext, number>;
    random: (context: TContext) => Parameters<typeof drawCardsFromDeck>[2];
    core: (context: TContext) => SmashUpCore;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'drawCards',
        (context) => {
            const playerId = resolveValue(params.playerId, context);
            const player = params.core(context).players[playerId];
            if (!player) return { events: [] };
            const draw = drawCardsFromDeck(player, resolveValue(params.count, context), params.random(context));
            if (draw.drawnUids.length === 0) return { events: [] };
            const events: SmashUpEvent[] = [];
            if (draw.reshuffledDeckUids && draw.reshuffledDeckUids.length > 0) {
                events.push({
                    type: SU_EVENTS.DECK_RESHUFFLED,
                    payload: {
                        playerId,
                        deckUids: draw.reshuffledDeckUids,
                    },
                    timestamp: resolveValue(params.now, context),
                } as DeckReshuffledEvent);
            }
            const event: CardsDrawnEvent = {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId,
                    count: draw.drawnUids.length,
                    cardUids: draw.drawnUids,
                },
                timestamp: resolveValue(params.now, context),
            };
            events.push(event);
            return { events };
        },
        (context) => {
            const playerId = resolveValue(params.playerId, context);
            return createFootprint({
                reads: [{ kind: 'playerDeck', playerId }, { kind: 'playerDiscard', playerId }],
                writes: [
                    { kind: 'playerHand', playerId },
                    { kind: 'playerDeck', playerId },
                    { kind: 'playerDiscard', playerId },
                ],
            });
        },
    );
}

export function discardRandomCardsPrimitive<TContext>(params: {
    playerIds: ValueOrResolver<TContext, PlayerId[]>;
    count: ValueOrResolver<TContext, number>;
    now: ValueOrResolver<TContext, number>;
    random: (context: TContext) => Parameters<typeof drawCardsFromDeck>[2];
    core: (context: TContext) => SmashUpCore;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'discardRandomCards',
        (context) => {
            const core = params.core(context);
            const random = params.random(context);
            const count = Math.max(0, resolveValue(params.count, context));
            const events: CardsDiscardedEvent[] = [];
            for (const playerId of resolveValue(params.playerIds, context)) {
                const player = core.players[playerId];
                if (!player || player.hand.length === 0 || count === 0) continue;
                const remaining = [...player.hand];
                const discarded: string[] = [];
                for (let index = 0; index < count && remaining.length > 0; index += 1) {
                    const discardIndex = Math.floor(random.random() * remaining.length);
                    const [card] = remaining.splice(discardIndex, 1);
                    if (card) discarded.push(card.uid);
                }
                if (discarded.length === 0) continue;
                events.push({
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId, cardUids: discarded },
                    timestamp: resolveValue(params.now, context),
                });
            }
            return { events };
        },
        (context) => createFootprint({
            reads: resolveValue(params.playerIds, context).map(playerId => ({ kind: 'playerHand' as const, playerId })),
            writes: resolveValue(params.playerIds, context).flatMap(playerId => [
                { kind: 'playerHand' as const, playerId },
                { kind: 'playerDiscard' as const, playerId },
            ]),
        }),
    );
}

export function awardVpPrimitive<TContext>(params: {
    playerId: ValueOrResolver<TContext, PlayerId>;
    amount: ValueOrResolver<TContext, number>;
    reason: ValueOrResolver<TContext, string>;
    now: ValueOrResolver<TContext, number>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'awardVp',
        (context) => {
            const event: VpAwardedEvent = {
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: resolveValue(params.playerId, context),
                    amount: resolveValue(params.amount, context),
                    reason: resolveValue(params.reason, context),
                },
                timestamp: resolveValue(params.now, context),
            };
            return { events: [event] };
        },
        (context) => createFootprint({
            reads: [{ kind: 'playerVp', playerId: resolveValue(params.playerId, context) }],
            writes: [{ kind: 'playerVp', playerId: resolveValue(params.playerId, context) }],
        }),
    );
}

export function grantExtraMinionPrimitive<TContext>(params: {
    playerId: ValueOrResolver<TContext, PlayerId>;
    reason: ValueOrResolver<TContext, string>;
    now: ValueOrResolver<TContext, number>;
    matchState?: ValueOrResolver<TContext, Pick<MatchState<SmashUpCore>, 'sys'> | undefined>;
    restrictToBase?: ValueOrResolver<TContext, number | undefined>;
    options?: ValueOrResolver<TContext, { sameNameOnly?: boolean; sameNameDefId?: string; powerMax?: number } | undefined>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'grantExtraMinion',
        (context) => {
            const playerId = resolveValue(params.playerId, context);
            return {
                events: [grantContextualExtraMinion(
                    {
                        playerId,
                        now: resolveValue(params.now, context),
                        ...(params.matchState ? { matchState: resolveValue(params.matchState, context) } : {}),
                    },
                    resolveValue(params.reason, context),
                    params.restrictToBase ? resolveValue(params.restrictToBase, context) : undefined,
                    params.options ? resolveValue(params.options, context) : undefined,
                )],
            };
        },
        (context) => createFootprint({
            reads: [{ kind: 'playerPlayLimit', playerId: resolveValue(params.playerId, context) }],
            writes: [{ kind: 'playerPlayLimit', playerId: resolveValue(params.playerId, context) }],
        }),
    );
}

export function grantExtraActionPrimitive<TContext>(params: {
    playerId: ValueOrResolver<TContext, PlayerId>;
    reason: ValueOrResolver<TContext, string>;
    now: ValueOrResolver<TContext, number>;
    matchState?: ValueOrResolver<TContext, Pick<MatchState<SmashUpCore>, 'sys'> | undefined>;
}): SmashUpEffectPrimitive<TContext> {
    return defineEffectPrimitive(
        'grantExtraAction',
        (context) => {
            const playerId = resolveValue(params.playerId, context);
            return {
                events: [grantContextualExtraAction(
                    {
                        playerId,
                        now: resolveValue(params.now, context),
                        ...(params.matchState ? { matchState: resolveValue(params.matchState, context) } : {}),
                    },
                    resolveValue(params.reason, context),
                )],
            };
        },
        (context) => createFootprint({
            reads: [{ kind: 'playerPlayLimit', playerId: resolveValue(params.playerId, context) }],
            writes: [{ kind: 'playerPlayLimit', playerId: resolveValue(params.playerId, context) }],
        }),
    );
}
