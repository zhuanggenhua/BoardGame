import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    queueMinionPlayEffect,
    recoverCardsFromDiscard,
    removePowerCounter,
    revealAndPickFromDeck,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerExtended as registerExtendedBase } from '../domain/baseAbilities';
import { getBaseDef, getCardDef, getMinionDef } from '../data/cards';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import {
    registerBaseVpModifier,
    registerInterceptor,
    registerProtection,
    registerRestriction,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import {
    registerCustomBasePowerModifiers,
    registerCustomPowerModifiers,
} from '../domain/ongoingModifiers';
import type {
    CardInstance,
    CardsDiscardedEvent,
    DeckReorderedEvent,
    MinionMetadataUpdatedEvent,
    MinionOnBase,
    MinionPlayedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { matchesDefId } from '../domain/utils';

const DISNEY_PROMPT_SOURCE = 'disney_four_factions_prompt';
const MICROBOT_SWARM = 'big_hero_6_microbot_swarm';
const MUFASA = 'lion_king_mufasa';
const HAKUNA_MATATA = 'lion_king_hakuna_matata';
const TIMON_AND_PUMBAA = 'lion_king_timon_and_pumbaa';

const DETERMINISTIC_RANDOM: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

type MinionChoice = {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
};

type BaseChoice = {
    baseIndex: number;
};

type CardChoice = {
    cardUid: string;
    defId: string;
    ownerId?: PlayerId;
};

type ModeChoice = {
    mode: string;
};

type DisneyPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: string;
    title: string;
    kind:
        | 'addCounters'
        | 'addTempPower'
        | 'destroyMinion'
        | 'returnMinion'
        | 'moveMinionDestination'
        | 'moveCountersSource'
        | 'moveCountersTarget'
        | 'baseDrawCounters'
        | 'baseDrawOwnMinions'
        | 'discardThenDestroyLowPower'
        | 'mode'
        | 'destroyOngoing'
        | 'protectMinionAffect'
        | 'playDeckMinion'
        | 'shanYuDestroy';
    minions?: Array<MinionChoice & { label: string; counters?: number }>;
    bases?: Array<BaseChoice & { label: string }>;
    cards?: Array<CardChoice & { label: string }>;
    modes?: Array<ModeChoice & { label: string }>;
    amount?: number;
    maxChoices?: number;
    optional?: boolean;
    targetBaseIndex?: number;
    targetMinion?: MinionChoice;
    destinationBaseIndex?: number;
    sourceMinion?: MinionChoice & { counters?: number };
    reason: string;
};

function abilityFromRuntime(result: { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> }): AbilityResult {
    return result.matchState ? { events: result.events, matchState: result.matchState } : { events: result.events };
}

function runPrompt(context: DisneyPromptContext): AbilityResult {
    return abilityFromRuntime(executeAbilityProgram(disneyPromptProgram, context));
}

function promptOptionsForMinions(
    state: SmashUpCore,
    playerId: PlayerId,
    minions: Array<MinionChoice & { label: string }>,
): PromptOption<MinionChoice>[] {
    return buildMinionTargetOptions(
        minions.map(target => ({
            uid: target.minionUid,
            defId: target.minionDefId,
            baseIndex: target.baseIndex,
            label: target.label,
        })),
        { state, sourcePlayerId: playerId },
    ) as PromptOption<MinionChoice>[];
}

function makeSkipOption<T extends object = Record<string, never>>(): PromptOption<T & { skip: true }> {
    return {
        id: 'skip',
        label: '跳过',
        labelKey: 'ui.common.skip',
        value: { skip: true } as T & { skip: true },
        displayMode: 'button',
    };
}

function currentBaseName(state: SmashUpCore, baseIndex: number): string {
    const def = getBaseDef(state.bases[baseIndex]?.defId);
    return def?.name ?? `基地 ${baseIndex + 1}`;
}

function minionLabel(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): string {
    const def = getCardDef(minion.defId);
    return `${def?.name ?? minion.defId} @ ${currentBaseName(state, baseIndex)}（力量 ${getMinionPower(state, minion, baseIndex)}）`;
}

function collectMinions(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): Array<MinionChoice & { label: string; counters: number }> {
    const result: Array<MinionChoice & { label: string; counters: number }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (!predicate(minion, baseIndex)) return;
            result.push({
                minionUid: minion.uid,
                minionDefId: minion.defId,
                baseIndex,
                label: minionLabel(state, minion, baseIndex),
                counters: minion.powerCounters ?? 0,
            });
        });
    });
    return result;
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): Array<MinionChoice & { label: string; counters: number }> {
    return collectMinions(state, minion => minion.controller === playerId);
}

function collectOtherBases(state: SmashUpCore, baseIndex: number): Array<BaseChoice & { label: string }> {
    return state.bases
        .map((base, index) => ({ baseIndex: index, label: getBaseDef(base.defId)?.name ?? `基地 ${index + 1}` }))
        .filter(base => base.baseIndex !== baseIndex);
}

function getLiveMinion(state: SmashUpCore, choice: MinionChoice | undefined): { minion: MinionOnBase; baseIndex: number } | undefined {
    if (!choice) return undefined;
    const minion = state.bases[choice.baseIndex]?.minions.find(candidate => candidate.uid === choice.minionUid);
    return minion ? { minion, baseIndex: choice.baseIndex } : undefined;
}

function hasMufasaInDiscard(state: SmashUpCore, playerId: PlayerId): boolean {
    return state.players[playerId]?.discard.some(card => matchesDefId(card.defId, MUFASA)) ?? false;
}

function hasDefInPlay(state: SmashUpCore, defId: string): boolean {
    return state.bases.some(base => base.minions.some(minion => matchesDefId(minion.defId, defId)));
}

function getActionController(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function buildMinionMetadataEvent(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp: now,
    };
}

function buildDiscardCardEvent(playerId: PlayerId, cardUid: string, reason: string, now: number): CardsDiscardedEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids: [cardUid], reason },
        timestamp: now,
    };
}

function playDeckMinionEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const base = state.bases[baseIndex];
    const player = state.players[playerId];
    const power = getMinionDef(card.defId)?.power;
    if (!base || !player || power === undefined) return [];
    const deckUids = [card.uid, ...player.deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)];
    return [
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids },
            timestamp: now,
        } as DeckReorderedEvent,
        {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                baseIndex,
                baseDefId: base.defId,
                power,
                fromDeck: true,
                consumesNormalLimit: false,
                discardPlaySourceId: reason,
            },
            timestamp: now,
        } as MinionPlayedEvent,
    ];
}

function detachOngoingEvent(
    action: { uid: string; defId: string; ownerId: PlayerId; metadata?: Record<string, unknown> },
    reason: string,
    now: number,
): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({
        cardUid: action.uid,
        defId: action.defId,
        ownerId: action.ownerId,
        reason,
        sourcePlayerId: getActionController(action),
        sourceCardUid: action.uid,
        sourceDefId: reason,
        sourceControllerId: getActionController(action),
        now,
    });
}

function collectOngoingCardsAtBase(state: SmashUpCore, baseIndex: number): Array<CardChoice & { label: string }> {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return [
        ...base.ongoingActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            label: getCardDef(action.defId)?.name ?? action.defId,
        })),
        ...base.minions.flatMap(minion => minion.attachedActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${getCardDef(minion.defId)?.name ?? minion.defId}`,
        }))),
    ];
}

function resolvePromptChoice(
    context: DisneyPromptContext,
    state: MatchState<SmashUpCore>,
    rawValue: unknown,
    random: RandomFn,
    timestamp: number,
): { events: SmashUpEvent[]; context?: DisneyPromptContext; nextProgram?: typeof disneyPromptProgram } {
    const value = rawValue as (MinionChoice | BaseChoice | CardChoice | ModeChoice | { skip?: true }) | Array<MinionChoice>;
    if (!value || (typeof value === 'object' && !Array.isArray(value) && 'skip' in value && value.skip)) {
        return { events: [] };
    }

    switch (context.kind) {
        case 'addCounters': {
            const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
            return {
                events: choices.flatMap(choice => {
                    const live = getLiveMinion(state.core, choice);
                    if (!live) return [];
                    return [addPowerCounter(live.minion.uid, live.baseIndex, context.amount ?? 1, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.targetBaseIndex,
                    })];
                }),
            };
        }
        case 'addTempPower': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: [addTempPower(live.minion.uid, live.baseIndex, context.amount ?? 1, context.reason, timestamp, {
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.targetBaseIndex,
                })],
            };
        }
        case 'destroyMinion':
        case 'shanYuDestroy': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: buildValidatedDestroyEvents(state, {
                    minionUid: live.minion.uid,
                    minionDefId: live.minion.defId,
                    fromBaseIndex: live.baseIndex,
                    destroyerId: context.playerId,
                    reason: context.reason,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.targetBaseIndex ?? live.baseIndex,
                    sourceKind: 'action',
                }),
            };
        }
        case 'returnMinion': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: buildValidatedReturnEvents(state, {
                    minionUid: live.minion.uid,
                    minionDefId: live.minion.defId,
                    fromBaseIndex: live.baseIndex,
                    reason: context.reason,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: live.baseIndex,
                    sourceKind: 'action',
                }),
            };
        }
        case 'moveMinionDestination': {
            const baseChoice = value as BaseChoice;
            const target = context.targetMinion;
            const live = getLiveMinion(state.core, target);
            if (!live) return { events: [] };
            return {
                events: buildValidatedMoveEvents(state, {
                    minionUid: live.minion.uid,
                    minionDefId: live.minion.defId,
                    fromBaseIndex: live.baseIndex,
                    toBaseIndex: baseChoice.baseIndex,
                    reason: context.reason,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: live.baseIndex,
                    sourceKind: 'action',
                }),
            };
        }
        case 'moveCountersSource': {
            const source = value as MinionChoice;
            const live = getLiveMinion(state.core, source);
            const counters = live?.minion.powerCounters ?? 0;
            if (!live || counters <= 0) return { events: [] };
            const targets = collectOwnMinions(state.core, context.playerId)
                .filter(target => target.minionUid !== live.minion.uid);
            if (targets.length === 0) return { events: [] };
            return {
                events: [],
                context: {
                    ...context,
                    kind: 'moveCountersTarget',
                    title: '选择接收力量标记的角色',
                    sourceMinion: { ...source, counters },
                    minions: targets,
                },
                nextProgram: disneyPromptProgram,
            };
        }
        case 'moveCountersTarget': {
            const target = value as MinionChoice;
            const source = getLiveMinion(state.core, context.sourceMinion);
            const liveTarget = getLiveMinion(state.core, target);
            const amount = Math.max(0, context.sourceMinion?.counters ?? source?.minion.powerCounters ?? 0);
            if (!source || !liveTarget || amount <= 0) return { events: [] };
            return {
                events: [
                    removePowerCounter(source.minion.uid, source.baseIndex, amount, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                    }),
                    addPowerCounter(liveTarget.minion.uid, liveTarget.baseIndex, amount, context.reason, timestamp, {
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                    }),
                ],
            };
        }
        case 'baseDrawCounters': {
            const baseIndex = (value as BaseChoice).baseIndex;
            const count = state.core.bases[baseIndex]?.minions.filter(
                minion => minion.controller === context.playerId && (minion.powerCounters ?? 0) > 0,
            ).length ?? 0;
            return { events: buildStandardDrawEvents(state, context.playerId, count, random, timestamp) };
        }
        case 'baseDrawOwnMinions': {
            const baseIndex = (value as BaseChoice).baseIndex;
            const count = state.core.bases[baseIndex]?.minions.filter(minion => minion.controller === context.playerId).length ?? 0;
            return { events: buildStandardDrawEvents(state, context.playerId, count, random, timestamp) };
        }
        case 'discardThenDestroyLowPower': {
            const cardChoice = value as CardChoice;
            const baseIndex = context.targetBaseIndex;
            if (baseIndex === undefined) return { events: [] };
            const base = state.core.bases[baseIndex];
            if (!base) return { events: [] };
            const destroyEvents = base.minions
                .filter(minion => getMinionPower(state.core, minion, baseIndex) <= 3)
                .flatMap(minion => buildValidatedDestroyEvents(state, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: baseIndex,
                    destroyerId: context.playerId,
                    reason: context.reason,
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: context.reason,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: baseIndex,
                    sourceKind: 'action',
                }));
            return { events: [buildDiscardCardEvent(context.playerId, cardChoice.cardUid, context.reason, timestamp), ...destroyEvents] };
        }
        case 'destroyOngoing': {
            const card = value as CardChoice;
            const events: SmashUpEvent[] = [];
            for (const base of state.core.bases) {
                const action = base.ongoingActions.find(candidate => candidate.uid === card.cardUid);
                if (action) events.push(detachOngoingEvent(action, context.reason, timestamp));
                for (const minion of base.minions) {
                    const attached = minion.attachedActions.find(candidate => candidate.uid === card.cardUid);
                    if (attached) events.push(detachOngoingEvent(attached, context.reason, timestamp));
                }
            }
            return { events };
        }
        case 'protectMinionAffect': {
            const choice = value as MinionChoice;
            const live = getLiveMinion(state.core, choice);
            if (!live) return { events: [] };
            return {
                events: [buildMinionMetadataEvent(live.minion.uid, live.baseIndex, {
                    tempProtectAffectUntilTurnNumber: state.core.turnNumber,
                    tempProtectSourcePlayerId: context.playerId,
                }, context.reason, timestamp)],
            };
        }
        case 'playDeckMinion': {
            const card = value as CardChoice;
            const found = state.core.players[context.playerId]?.deck.find(candidate => candidate.uid === card.cardUid);
            const baseIndex = context.targetBaseIndex ?? 0;
            return { events: found ? playDeckMinionEvents(state.core, context.playerId, found, baseIndex, context.reason, timestamp) : [] };
        }
        case 'mode':
            return resolveMode(context, state, value as ModeChoice, random, timestamp);
        default:
            return { events: [] };
    }
}

const disneyPromptProgram = createPromptProgram<DisneyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: DISNEY_PROMPT_SOURCE,
    buildInteraction: (context) => {
        const state = context.matchState.core;
        const options = (() => {
            if (context.kind.startsWith('base')) {
                return buildBaseTargetOptions(context.bases ?? [], state);
            }
            if (context.kind === 'discardThenDestroyLowPower' || context.kind === 'playDeckMinion') {
                return (context.cards ?? []).map((card, index) => ({
                    id: `card-${index}`,
                    label: card.label,
                    value: { cardUid: card.cardUid, defId: card.defId, ownerId: card.ownerId },
                    displayMode: 'card' as const,
                }));
            }
            if (context.kind === 'mode') {
                return (context.modes ?? []).map(mode => ({
                    id: mode.mode,
                    label: mode.label,
                    value: { mode: mode.mode },
                    displayMode: 'button' as const,
                }));
            }
            if (context.kind === 'moveMinionDestination') {
                return buildBaseTargetOptions(context.bases ?? [], state);
            }
            if (context.kind === 'destroyOngoing') {
                return (context.cards ?? []).map((card, index) => ({
                    id: `ongoing-${index}`,
                    label: card.label,
                    value: { cardUid: card.cardUid, defId: card.defId, ownerId: card.ownerId },
                    displayMode: 'card' as const,
                }));
            }
            return promptOptionsForMinions(state, context.playerId, context.minions ?? []);
        })();
        const finalOptions = context.optional ? [...options, makeSkipOption()] : options;
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_${context.kind}_${context.now}`,
            context.playerId,
            context.title,
            finalOptions as PromptOption<unknown>[],
            {
                sourceId: DISNEY_PROMPT_SOURCE,
                targetType: context.kind.startsWith('base') || context.kind === 'moveMinionDestination' ? 'base'
                    : context.kind === 'mode' ? 'button'
                        : context.kind === 'discardThenDestroyLowPower' ? 'hand'
                            : context.kind === 'playDeckMinion' ? 'generic'
                                : context.kind === 'destroyOngoing' ? 'ongoing'
                                    : 'minion',
                responseValidationMode: 'live',
                ...(context.maxChoices !== undefined ? { multi: { min: context.optional ? 0 : 1, max: context.maxChoices } } : {}),
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => resolvePromptChoice(
        context,
        state,
        value,
        random,
        timestamp,
    ),
});

function resolveMode(
    context: DisneyPromptContext,
    state: MatchState<SmashUpCore>,
    value: ModeChoice,
    random: RandomFn,
    timestamp: number,
): { events: SmashUpEvent[]; context?: DisneyPromptContext; nextProgram?: typeof disneyPromptProgram } {
    switch (value.mode) {
        case 'add_counter_here': {
            const baseIndex = context.targetBaseIndex ?? 0;
            const targets = collectOwnMinions(state.core, context.playerId).filter(target => target.baseIndex === baseIndex);
            return {
                events: [],
                context: { ...context, kind: 'addCounters', title: '选择放置 +1 力量标记的角色', minions: targets, amount: 1 },
                nextProgram: disneyPromptProgram,
            };
        }
        case 'move_counters':
            return {
                events: [],
                context: {
                    ...context,
                    kind: 'moveCountersSource',
                    title: '选择移出力量标记的角色',
                    minions: collectOwnMinions(state.core, context.playerId).filter(target => (target.counters ?? 0) > 0),
                },
                nextProgram: disneyPromptProgram,
            };
        case 'extra_action':
            return { events: [grantContextualExtraAction({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason)] };
        case 'destroy_upgrade': {
            const baseIndex = context.targetBaseIndex ?? 0;
            const cards = collectOngoingCardsAtBase(state.core, baseIndex);
            if (cards.length === 0) return { events: [] };
            return {
                events: [],
                context: {
                    ...context,
                    kind: 'destroyOngoing',
                    title: '选择要摧毁的行动或装备',
                    cards,
                    targetBaseIndex: baseIndex,
                },
                nextProgram: disneyPromptProgram,
            };
        }
        case 'draw_card':
            return { events: buildStandardDrawEvents(state, context.playerId, 1, random, timestamp) };
        case 'draw_two':
            return { events: buildStandardDrawEvents(state, context.playerId, 2, random, timestamp) };
        case 'extra_minion_power_2':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, context.targetBaseIndex, { powerMax: 2 })] };
        case 'extra_minion_power_3':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, context.targetBaseIndex, { powerMax: 3 })] };
        case 'extra_minion_power_4':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, context.targetBaseIndex, { powerMax: 4 })] };
        case 'play_microbot':
            return { events: [grantContextualExtraMinion({ playerId: context.playerId, now: timestamp, matchState: state }, context.reason, undefined, { sameNameOnly: true, sameNameDefId: MICROBOT_SWARM })] };
        case 'move_microbots': {
            const source = context.targetBaseIndex ?? 0;
            const destination = state.core.bases.findIndex((_base, index) => index !== source);
            if (destination < 0) return { events: [] };
            const base = state.core.bases[source];
            const batchId = `${context.reason}_${timestamp}`;
            return {
                events: base.minions
                    .filter(minion => minion.controller === context.playerId && matchesDefId(minion.defId, MICROBOT_SWARM))
                    .flatMap(minion => buildValidatedMoveEvents(state, {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: source,
                        toBaseIndex: destination,
                        reason: context.reason,
                        now: timestamp,
                        sourcePlayerId: context.playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: source,
                        sourceKind: 'action',
                        batchId,
                    })),
            };
        }
        default:
            return { events: [] };
    }
}

function promptMinion(
    ctx: AbilityContext,
    params: Omit<DisneyPromptContext, 'matchState' | 'playerId' | 'now' | 'kind'> & { kind: DisneyPromptContext['kind'] },
): AbilityResult {
    const candidates = params.minions ?? [];
    if (candidates.length === 0 && params.kind !== 'mode') return { events: [] };
    return runPrompt({ matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now, ...params });
}

function addCountersToTargets(
    targets: Array<MinionChoice & { label: string }>,
    ctx: AbilityContext,
    amount: number,
    reason: string,
    title = '选择放置 +1 力量标记的角色',
    maxChoices?: number,
): AbilityResult {
    return promptMinion(ctx, {
        sourceId: reason,
        title,
        kind: 'addCounters',
        minions: targets,
        amount,
        maxChoices,
        reason,
    });
}

function addCounterToOwnMinion(ctx: AbilityContext, amount: number, reason: string): AbilityResult {
    return addCountersToTargets(collectOwnMinions(ctx.state, ctx.playerId), ctx, amount, reason);
}

function recoverFirstDiscard(
    ctx: AbilityContext,
    predicate: (card: CardInstance) => boolean,
    reason: string,
): SmashUpEvent[] {
    const card = ctx.state.players[ctx.playerId]?.discard.find(predicate);
    return card ? [recoverCardsFromDiscard(ctx.playerId, [card.uid], reason, ctx.now)] : [];
}

function recoverDiscardByPower(ctx: AbilityContext, maxPower: number, reason: string): AbilityResult {
    return { events: recoverFirstDiscard(ctx, card => (getMinionDef(card.defId)?.power ?? Number.POSITIVE_INFINITY) <= maxPower, reason) };
}

function searchDeckByDef(ctx: AbilityContext, defId: string, maxPick: number, reason: string): SmashUpEvent[] {
    return revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: card => matchesDefId(card.defId, defId),
        maxPick,
        revealTo: 'all',
        reason,
        now: ctx.now,
    }).events;
}

function searchDeckByPower(ctx: AbilityContext, maxPower: number, reason: string): SmashUpEvent[] {
    return revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: card => (getMinionDef(card.defId)?.power ?? Number.POSITIVE_INFINITY) <= maxPower,
        maxPick: 1,
        revealTo: 'all',
        reason,
        now: ctx.now,
    }).events;
}

function microbotSwarmOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: recoverFirstDiscard(ctx, card => matchesDefId(card.defId, MICROBOT_SWARM), 'big_hero_6_microbot_swarm') };
}

function microbotSwarmTalent(ctx: AbilityContext): AbilityResult {
    return { events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'big_hero_6_microbot_swarm', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    })] };
}

function fredTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    if (!self || (self.powerCounters ?? 0) <= 0) return { events };
    const targets = collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid);
    const prompt = promptMinion(ctx, {
        sourceId: 'big_hero_6_fred_frederickson_iv',
        title: '弗雷德IV世：选择获得 -2 力量的角色',
        kind: 'addTempPower',
        minions: targets,
        amount: -2,
        optional: true,
        reason: 'big_hero_6_fred_frederickson_iv',
    });
    return prompt.matchState ? { events, matchState: prompt.matchState } : { events: [...events, ...prompt.events] };
}

function goGoTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    const bases = collectOtherBases(ctx.state, ctx.baseIndex);
    if (!self || bases.length === 0) return { events: [] };
    return promptMinion(ctx, {
        sourceId: 'big_hero_6_go_go_tomago',
        title: '神行御姐：选择移动到的基地',
        kind: 'moveMinionDestination',
        bases,
        targetMinion: { minionUid: self.uid, minionDefId: self.defId, baseIndex: ctx.baseIndex },
        reason: 'big_hero_6_go_go_tomago',
    });
}

function hiroTalent(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'big_hero_6_hiro_hamada',
        title: '小宏：选择效果',
        kind: 'mode',
        targetBaseIndex: ctx.baseIndex,
        modes: [
            { mode: 'add_counter_here', label: '在这里的一个角色上放置 +1 力量标记' },
            { mode: 'move_counters', label: '移动你的力量标记' },
        ],
        reason: 'big_hero_6_hiro_hamada',
    });
}

function honeyLemonTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (self && (self.powerCounters ?? 0) > 0) {
        const canDestroyUpgrade = collectOngoingCardsAtBase(ctx.state, ctx.baseIndex).length > 0;
        return runPrompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'big_hero_6_honey_lemon',
            title: '哈妮柠檬：选择效果',
            kind: 'mode',
            targetBaseIndex: ctx.baseIndex,
            modes: [
                { mode: 'extra_action', label: '打出一个额外行动' },
                ...(canDestroyUpgrade ? [{ mode: 'destroy_upgrade', label: '摧毁这里的行动/装备' }] : []),
            ],
            reason: 'big_hero_6_honey_lemon',
        });
    }
    return destroyOngoingHere(ctx, 'big_hero_6_honey_lemon');
}

function destroyOngoingHere(ctx: AbilityContext, reason: string): AbilityResult {
    const cards = collectOngoingCardsAtBase(ctx.state, ctx.baseIndex);
    if (cards.length === 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: reason,
        title: '选择要摧毁的行动或装备',
        kind: 'destroyOngoing',
        cards,
        reason,
    });
}

function wasabiTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    const counters = self?.powerCounters ?? 0;
    const amount = counters > 0 ? Math.min(5, counters) : 1;
    return { events: [addTempPower(ctx.cardUid, ctx.baseIndex, amount, 'big_hero_6_wasabi', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    })] };
}

function controlMaskOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: searchDeckByDef(ctx, MICROBOT_SWARM, 1, 'big_hero_6_control_mask') };
}

function controlMaskTalent(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'big_hero_6_control_mask',
        title: '控制面具：选择效果',
        kind: 'mode',
        targetBaseIndex: ctx.baseIndex,
        modes: [
            { mode: 'play_microbot', label: '额外打出一张微型机器群' },
            { mode: 'move_microbots', label: '移动这里的微型机器群到另一个基地' },
        ],
        reason: 'big_hero_6_control_mask',
    });
}

function controlTheSwarm(ctx: AbilityContext): AbilityResult {
    const targets = collectOwnMinions(ctx.state, ctx.playerId).filter(target => (target.counters ?? 0) === 0);
    if (targets.length > 0) {
        return { events: targets.map(target => addPowerCounter(target.minionUid, target.baseIndex, 1, 'big_hero_6_control_the_swarm', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
        })) };
    }
    return hiroTalent({ ...ctx, defId: 'big_hero_6_control_the_swarm' });
}

function microbotMakerOnPlay(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const targets = collectOwnMinions(ctx.state, ctx.playerId).filter(target => target.baseIndex === baseIndex);
    return { events: targets.map(target => addPowerCounter(target.minionUid, target.baseIndex, 1, 'big_hero_6_microbot_maker', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: baseIndex,
    })) };
}

function microbotMakerTalent(ctx: AbilityContext): AbilityResult {
    const targets = collectOwnMinions(ctx.state, ctx.playerId).filter(target => target.baseIndex === ctx.baseIndex);
    return addCountersToTargets(targets, ctx, 1, 'big_hero_6_microbot_maker');
}

function newStudent(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            queueMinionPlayEffect(ctx.playerId, 'addPowerCounter', 1, ctx.now, 'big_hero_6_new_student'),
            grantContextualExtraMinion(ctx, 'big_hero_6_new_student', undefined, { powerMax: 3 }),
        ],
    };
}

function teamEffort(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'big_hero_6_team_effort',
        title: '团队的努力：选择基地',
        kind: 'baseDrawCounters',
        bases: ctx.state.bases.map((_base, baseIndex) => ({ baseIndex, label: currentBaseName(ctx.state, baseIndex) })),
        reason: 'big_hero_6_team_effort',
    });
}

function upgrades(ctx: AbilityContext): AbilityResult {
    const counters = addCounterToOwnMinion(ctx, 2, 'big_hero_6_upgrades');
    return { events: [grantContextualExtraAction(ctx, 'big_hero_6_upgrades'), ...counters.events], matchState: counters.matchState };
}

function versionTwo(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller === ctx.playerId && (minion.powerCounters ?? 0) > 0)
            .map(minion => addTempPower(minion.uid, baseIndex, 2, 'big_hero_6_version_2_0', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
            })),
    };
}

function baymaxAfterScoring(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || (self.powerCounters ?? 0) <= 0) return { events: [] };
    const target = ctx.state.bases[ctx.baseIndex]?.minions.find(
        minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid,
    );
    const destination = ctx.state.bases.findIndex((_base, index) => index !== ctx.baseIndex);
    if (!target || destination < 0) return { events: [] };
    return {
        events: buildValidatedMoveEvents(ctx.matchState, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: ctx.baseIndex,
            toBaseIndex: destination,
            reason: 'big_hero_6_baymax',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'nonAction',
        }),
    };
}

function yokaiAfterScoring(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const receiver = collectOwnMinions(ctx.state, ctx.playerId).find(target => target.baseIndex !== ctx.baseIndex)
        ?? collectOwnMinions(ctx.state, ctx.playerId).find(target => target.baseIndex === ctx.baseIndex);
    if (!receiver) return { events: [] };
    const events: SmashUpEvent[] = [];
    for (const minion of base.minions) {
        if (minion.controller !== ctx.playerId || (minion.powerCounters ?? 0) <= 0 || minion.uid === receiver.minionUid) continue;
        events.push(removePowerCounter(minion.uid, ctx.baseIndex, 1, 'big_hero_6_yokai', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
        events.push(addPowerCounter(receiver.minionUid, receiver.baseIndex, 1, 'big_hero_6_yokai', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
    }
    return { events };
}

function snowgie(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'frozen_snowgie',
        title: '迷你雪人：选择这里一个角色',
        kind: 'addTempPower',
        minions: collectMinions(ctx.state, (_minion, baseIndex) => baseIndex === ctx.baseIndex),
        amount: 1,
        reason: 'frozen_snowgie',
    });
}

function olaf(ctx: AbilityContext): AbilityResult {
    const target = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.controller === ctx.playerId);
    const destination = ctx.state.bases.findIndex((_base, index) => index !== ctx.baseIndex);
    if (!target || destination < 0) return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
    return {
        events: [
            ...buildValidatedMoveEvents(ctx.matchState, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex: destination,
                reason: 'frozen_olaf',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'nonAction',
            }),
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function sven(ctx: AbilityContext): AbilityResult {
    return recoverDiscardByPower(ctx, 4, 'frozen_sven');
}

function elsaTalent(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    return {
        events: base.minions
            .filter(minion => minion.controller !== ctx.playerId)
            .map(minion => addTempPower(minion.uid, baseIndex, -1, 'frozen_elsa', ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            })),
    };
}

function actOfTrueLove(ctx: AbilityContext): AbilityResult {
    const protect = promptMinion(ctx, {
        sourceId: 'frozen_act_of_true_love',
        title: '真爱的行为：选择你的一个角色',
        kind: 'protectMinionAffect',
        minions: collectOwnMinions(ctx.state, ctx.playerId),
        reason: 'frozen_act_of_true_love',
    });
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now), matchState: protect.matchState };
}

function bigSummerBlowout(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'frozen_big_summer_blowout',
        title: '夏天大盛宴：选择基地',
        kind: 'baseDrawOwnMinions',
        bases: ctx.state.bases.map((_base, baseIndex) => ({ baseIndex, label: currentBaseName(ctx.state, baseIndex) })),
        reason: 'frozen_big_summer_blowout',
    });
}

function buildSnowman(ctx: AbilityContext): AbilityResult {
    const discardSnowgies = ctx.state.players[ctx.playerId]?.discard
        .filter(card => matchesDefId(card.defId, 'frozen_snowgie'))
        .slice(0, 2) ?? [];
    const deckNeed = 2 - discardSnowgies.length;
    return {
        events: [
            ...(discardSnowgies.length > 0 ? [recoverCardsFromDiscard(ctx.playerId, discardSnowgies.map(card => card.uid), 'frozen_do_you_want_to_build_a_snowman', ctx.now)] : []),
            ...(deckNeed > 0 ? revealAndPickFromDeck({
                state: ctx.state,
                random: ctx.random,
                playerId: ctx.playerId,
                predicate: card => matchesDefId(card.defId, 'frozen_snowgie'),
                maxPick: deckNeed,
                revealTo: 'all',
                reason: 'frozen_do_you_want_to_build_a_snowman',
                now: ctx.now,
            }).events : []),
        ],
    };
}

function hans(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return promptMinion(ctx, {
        sourceId: 'frozen_hans_westergaard',
        title: '汉斯：选择力量 3 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, index) => index === baseIndex && getMinionPower(ctx.state, minion, index) <= 3),
        targetBaseIndex: baseIndex,
        reason: 'frozen_hans_westergaard',
    });
}

function letItGo(ctx: AbilityContext): AbilityResult {
    const target = collectOwnMinions(ctx.state, ctx.playerId)[0];
    const events = [
        ...(target ? buildValidatedReturnEvents(ctx.matchState, {
            minionUid: target.minionUid,
            minionDefId: target.minionDefId,
            fromBaseIndex: target.baseIndex,
            reason: 'frozen_let_it_go',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: target.baseIndex,
            sourceKind: 'action',
        }) : []),
        grantContextualExtraAction(ctx, 'frozen_let_it_go'),
    ];
    return { events };
}

function reindeers(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'frozen_reindeers_are_better_than_people',
        title: '驯鹿的心地比人好：选择你的一个角色',
        kind: 'addTempPower',
        minions: collectOwnMinions(ctx.state, ctx.playerId),
        amount: hasDefInPlay(ctx.state, 'frozen_sven') ? 4 : 2,
        reason: 'frozen_reindeers_are_better_than_people',
    });
}

function rafiki(ctx: AbilityContext): AbilityResult {
    return recoverDiscardByPower(ctx, 2, 'lion_king_rafiki');
}

function timonAndPumbaa(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const foundIndex = player.deck.findIndex(card => matchesDefId(card.defId, HAKUNA_MATATA));
    if (foundIndex < 0) return { events: [] };
    const discarded = player.deck.slice(0, foundIndex);
    const found = player.deck[foundIndex];
    return {
        events: [
            ...(discarded.length > 0 ? [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: ctx.playerId, cardUids: discarded.map(card => card.uid), reason: 'lion_king_timon_and_pumbaa' },
                timestamp: ctx.now,
            } as CardsDiscardedEvent] : []),
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId: ctx.playerId, deckUids: [found.uid, ...player.deck.slice(foundIndex + 1).map(card => card.uid)] },
                timestamp: ctx.now,
            } as DeckReorderedEvent,
            ...buildStandardDrawEvents({ ...ctx.state, players: { ...ctx.state.players, [ctx.playerId]: { ...player, deck: [found, ...player.deck.slice(foundIndex + 1)] } } }, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function zazu(ctx: AbilityContext): AbilityResult {
    if (hasMufasaInDiscard(ctx.state, ctx.playerId)) {
        return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
    }
    return promptMinion(ctx, {
        sourceId: 'lion_king_zazu',
        title: '沙祖：选择这里另一个角色',
        kind: 'addTempPower',
        minions: collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid),
        amount: 2,
        reason: 'lion_king_zazu',
    });
}

function nala(ctx: AbilityContext): AbilityResult {
    if (!hasMufasaInDiscard(ctx.state, ctx.playerId)) return { events: [] };
    return { events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'lion_king_nala', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    })] };
}

function simba(ctx: AbilityContext): AbilityResult {
    if (!hasMufasaInDiscard(ctx.state, ctx.playerId)) return { events: [] };
    return { events: [
        ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'lion_king_simba', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }),
    ] };
}

function hakunaMatata(ctx: AbilityContext): AbilityResult {
    const timon = ctx.state.players[ctx.playerId]?.discard.find(card => matchesDefId(card.defId, TIMON_AND_PUMBAA));
    return { events: [
        ...buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now),
        ...(timon ? [recoverCardsFromDiscard(ctx.playerId, [timon.uid], 'lion_king_hakuna_matata', ctx.now)] : []),
    ] };
}

function justCantWait(ctx: AbilityContext): AbilityResult {
    return addCounterToOwnMinion(ctx, hasMufasaInDiscard(ctx.state, ctx.playerId) ? 4 : 2, 'lion_king_just_cant_wait_to_be_king');
}

function scar(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        (minion.controller !== ctx.playerId && getMinionPower(ctx.state, minion, baseIndex) <= 5)
        || minion.controller === ctx.playerId,
    );
    return promptMinion(ctx, {
        sourceId: 'lion_king_scar',
        title: '刀疤：选择要摧毁的角色',
        kind: 'destroyMinion',
        minions: targets,
        reason: 'lion_king_scar',
    });
}

function theHyenas(ctx: AbilityContext): AbilityResult {
    const prompt = promptMinion(ctx, {
        sourceId: 'lion_king_the_hyenas',
        title: '鬣狗：选择力量 3 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3),
        reason: 'lion_king_the_hyenas',
    });
    const bonus = hasMufasaInDiscard(ctx.state, ctx.playerId)
        ? [...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now), grantContextualExtraAction(ctx, 'lion_king_the_hyenas')]
        : [];
    return { events: [...bonus, ...prompt.events], matchState: prompt.matchState };
}

function wildebeestStampede(ctx: AbilityContext): AbilityResult {
    const own = collectOwnMinions(ctx.state, ctx.playerId)[0];
    const deckMinions = ctx.state.players[ctx.playerId]?.deck
        .filter(card => getMinionDef(card.defId))
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: getCardDef(card.defId)?.name ?? card.defId })) ?? [];
    if (!own || deckMinions.length === 0) return { events: [] };
    const destroyEvents = buildValidatedDestroyEvents(ctx.matchState, {
        minionUid: own.minionUid,
        minionDefId: own.minionDefId,
        fromBaseIndex: own.baseIndex,
        destroyerId: ctx.playerId,
        reason: 'lion_king_wildebeest_stampede',
        now: ctx.now,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: own.baseIndex,
        sourceKind: 'action',
    });
    const prompt = runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'lion_king_wildebeest_stampede',
        title: '牛羚踩踏：选择从牌库额外打出的角色',
        kind: 'playDeckMinion',
        cards: deckMinions,
        targetBaseIndex: own.baseIndex,
        reason: 'lion_king_wildebeest_stampede',
    });
    return { events: destroyEvents, matchState: prompt.matchState };
}

function criKee(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base?.minions.some(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)) return { events: [] };
    return { events: [grantContextualExtraMinion(ctx, 'mulan_cri_kee', undefined, { powerMax: 3 })] };
}

function mushu(ctx: AbilityContext): AbilityResult {
    return addCountersToTargets(
        collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && minion.uid !== ctx.cardUid),
        ctx,
        1,
        'mulan_mushu',
        '木须：选择这里另一个角色',
        undefined,
    );
}

function ling(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraMinion(ctx, 'mulan_ling', ctx.baseIndex, { powerMax: 2 })] };
}

function yao(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'mulan_yao',
        title: '尧：选择这里力量 2 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, baseIndex) => baseIndex === ctx.baseIndex && getMinionPower(ctx.state, minion, baseIndex) <= 2),
        optional: true,
        reason: 'mulan_yao',
    });
}

function liShang(ctx: AbilityContext): AbilityResult {
    return addCountersToTargets(
        collectOwnMinions(ctx.state, ctx.playerId).filter(target => target.baseIndex === ctx.baseIndex && target.minionUid !== ctx.cardUid),
        ctx,
        1,
        'mulan_li_shang',
    );
}

function mulan(ctx: AbilityContext): AbilityResult {
    if ((ctx.state.powerCountersPlacedOnMinionsThisTurn ?? 0) <= 0) return { events: [] };
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mulan_mulan',
        title: '木兰：选择效果',
        kind: 'mode',
        modes: [
            { mode: 'extra_action', label: '打出一个额外行动' },
            { mode: 'draw_card', label: '抽 1 张牌' },
        ],
        reason: 'mulan_mulan',
    });
}

function avalanche(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const cards = player?.hand
        .filter(card => card.uid !== ctx.cardUid)
        .map(card => ({ cardUid: card.uid, defId: card.defId, ownerId: card.owner, label: getCardDef(card.defId)?.name ?? card.defId })) ?? [];
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mulan_avalanche',
        title: '雪崩：选择弃掉的手牌',
        kind: 'discardThenDestroyLowPower',
        cards,
        targetBaseIndex: baseIndex,
        reason: 'mulan_avalanche',
    });
}

function beAMan(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    return addCountersToTargets(
        collectMinions(ctx.state, (_minion, index) => index === baseIndex),
        ctx,
        1,
        'mulan_be_a_man',
        '成为一个男人：选择至多两个角色',
        2,
    );
}

function callUpNewRecruits(ctx: AbilityContext): AbilityResult {
    return runPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'mulan_call_up_new_recruits',
        title: '招收新兵：选择效果',
        kind: 'mode',
        modes: [
            { mode: 'extra_minion_power_4', label: '额外打出力量 4 或更低的角色' },
            { mode: 'draw_two', label: '抽 2 张牌' },
        ],
        reason: 'mulan_call_up_new_recruits',
    });
}

function dragonCannon(ctx: AbilityContext): AbilityResult {
    return promptMinion(ctx, {
        sourceId: 'mulan_dragon_cannon',
        title: '飞龙巨炮：选择力量 3 或更低的角色',
        kind: 'destroyMinion',
        minions: collectMinions(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3),
        reason: 'mulan_dragon_cannon',
    });
}

function groupTraining(ctx: AbilityContext): AbilityResult {
    return { events: collectOwnMinions(ctx.state, ctx.playerId).map(target => addPowerCounter(target.minionUid, target.baseIndex, 1, 'mulan_group_training', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
    })) };
}

function prepareToFight(ctx: AbilityContext): AbilityResult {
    const counters = addCounterToOwnMinion(ctx, 2, 'mulan_prepare_to_fight');
    return { events: [...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now), ...counters.events], matchState: counters.matchState };
}

function shanYu(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const ownMax = Math.max(0, ...ctx.state.bases[baseIndex]?.minions
        .filter(minion => minion.controller === ctx.playerId)
        .map(minion => getMinionPower(ctx.state, minion, baseIndex)) ?? []);
    return promptMinion(ctx, {
        sourceId: 'mulan_shan_yu',
        title: '单于：选择计分前摧毁的角色',
        kind: 'shanYuDestroy',
        minions: collectMinions(ctx.state, (minion, index) => index === baseIndex && getMinionPower(ctx.state, minion, index) <= ownMax),
        targetBaseIndex: baseIndex,
        reason: 'mulan_shan_yu',
    });
}

function drawOnPowerCounterHere(ctx: TriggerContext, onceKey: string): SmashUpEvent[] {
    if (
        ctx.affectType !== 'power_change'
        || ctx.counterChangeKind !== 'added'
        || (ctx.counterDelta ?? 0) <= 0
        || ctx.baseIndex === undefined
        || !ctx.triggerMinion
    ) return [];
    if (ctx.triggerMinion.controller !== ctx.playerId) return [];
    const already = Number(ctx.triggerMinion.metadata?.[onceKey] ?? -1) === ctx.state.turnNumber;
    if (already) return [];
    return [
        ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        buildMinionMetadataEvent(ctx.triggerMinion.uid, ctx.baseIndex, { [onceKey]: ctx.state.turnNumber }, onceKey, ctx.now),
    ];
}

function bigHeroProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.minions.some(minion =>
        matchesDefId(minion.defId, 'big_hero_6_baymax')
        && minion.controller === ctx.targetMinion.controller
        && minion.uid !== ctx.targetMinion.uid,
    ) ?? false;
}

function annaProtection(ctx: ProtectionCheckContext): boolean {
    if (!matchesDefId(ctx.targetMinion.defId, 'frozen_anna')) return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.minions.some(minion =>
        minion.controller === ctx.targetMinion.controller && matchesDefId(minion.defId, 'frozen_kristoff'),
    ) ?? false;
}

function chienPoProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.minions.some(minion =>
        minion.controller === ctx.targetMinion.controller && matchesDefId(minion.defId, 'mulan_chien_po'),
    ) ?? false;
}

function forbiddenCityProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    if ((ctx.targetMinion.powerCounters ?? 0) <= 0) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.defId === 'base_forbidden_city';
}

function frozenPortMoveRestriction(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.state.bases[ctx.targetBaseIndex]?.ongoingActions.some(action => action.defId === 'frozen_frozen_port') ?? false;
}

function lockTheGatesRestriction(ctx: RestrictionCheckContext): boolean {
    const basePower = ctx.extra?.basePower as number | undefined;
    if (ctx.restrictionType !== 'play_minion') return false;
    if (basePower === undefined || basePower > 3) return false;
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    return base.ongoingActions.some(action =>
        action.defId === 'frozen_lock_the_gates'
        && getActionController(action) !== ctx.playerId,
    );
}

function frozenPortInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | null | undefined {
    if (event.type !== SU_EVENTS.MINION_MOVED) return undefined;
    const payload = event.payload as { fromBaseIndex: number; toBaseIndex: number; sourcePlayerId?: PlayerId; minionUid: string };
    const moving = state.bases[payload.fromBaseIndex]?.minions.find(minion => minion.uid === payload.minionUid);
    const actor = payload.sourcePlayerId;
    if (!actor || !moving || actor === moving.controller) return undefined;
    const frozenSource = state.bases[payload.fromBaseIndex]?.ongoingActions.some(action => action.defId === 'frozen_frozen_port') ?? false;
    const frozenDestination = state.bases[payload.toBaseIndex]?.ongoingActions.some(action => action.defId === 'frozen_frozen_port') ?? false;
    return frozenSource || frozenDestination ? null : undefined;
}

export function registerDisneyFourFactionsAbilities(): void {
    registerSimpleAbility('big_hero_6_microbot_swarm', 'onPlay', microbotSwarmOnPlay);
    registerSimpleAbility('big_hero_6_microbot_swarm', 'talent', microbotSwarmTalent);
    registerSimpleAbility('big_hero_6_baymax', 'special', baymaxAfterScoring);
    registerSimpleAbility('big_hero_6_fred_frederickson_iv', 'talent', fredTalent);
    registerSimpleAbility('big_hero_6_go_go_tomago', 'talent', goGoTalent);
    registerSimpleAbility('big_hero_6_hiro_hamada', 'talent', hiroTalent);
    registerSimpleAbility('big_hero_6_honey_lemon', 'talent', honeyLemonTalent);
    registerSimpleAbility('big_hero_6_wasabi', 'talent', wasabiTalent);
    registerSimpleAbility('big_hero_6_control_mask', 'onPlay', controlMaskOnPlay);
    registerSimpleAbility('big_hero_6_control_mask', 'talent', controlMaskTalent);
    registerSimpleAbility('big_hero_6_control_the_swarm', 'onPlay', controlTheSwarm);
    registerSimpleAbility('big_hero_6_microbot_maker', 'onPlay', microbotMakerOnPlay);
    registerSimpleAbility('big_hero_6_microbot_maker', 'talent', microbotMakerTalent);
    registerSimpleAbility('big_hero_6_new_student', 'onPlay', newStudent);
    registerSimpleAbility('big_hero_6_team_effort', 'onPlay', teamEffort);
    registerSimpleAbility('big_hero_6_upgrades', 'onPlay', upgrades);
    registerSimpleAbility('big_hero_6_version_2_0', 'onPlay', versionTwo);
    registerSimpleAbility('big_hero_6_yokai', 'special', yokaiAfterScoring);

    registerSimpleAbility('frozen_snowgie', 'onPlay', snowgie);
    registerSimpleAbility('frozen_olaf', 'onPlay', olaf);
    registerSimpleAbility('frozen_sven', 'onPlay', sven);
    registerSimpleAbility('frozen_elsa', 'talent', elsaTalent);
    registerSimpleAbility('frozen_act_of_true_love', 'onPlay', actOfTrueLove);
    registerSimpleAbility('frozen_big_summer_blowout', 'onPlay', bigSummerBlowout);
    registerSimpleAbility('frozen_do_you_want_to_build_a_snowman', 'onPlay', buildSnowman);
    registerSimpleAbility('frozen_hans_westergaard', 'onPlay', hans);
    registerSimpleAbility('frozen_let_it_go', 'onPlay', letItGo);
    registerSimpleAbility('frozen_reindeers_are_better_than_people', 'onPlay', reindeers);

    registerSimpleAbility('lion_king_rafiki', 'onPlay', rafiki);
    registerSimpleAbility('lion_king_timon_and_pumbaa', 'onPlay', timonAndPumbaa);
    registerSimpleAbility('lion_king_zazu', 'onPlay', zazu);
    registerSimpleAbility('lion_king_nala', 'onPlay', nala);
    registerSimpleAbility('lion_king_simba', 'onPlay', simba);
    registerSimpleAbility('lion_king_hakuna_matata', 'onPlay', hakunaMatata);
    registerSimpleAbility('lion_king_just_cant_wait_to_be_king', 'onPlay', justCantWait);
    registerSimpleAbility('lion_king_scar', 'onPlay', scar);
    registerSimpleAbility('lion_king_the_hyenas', 'onPlay', theHyenas);
    registerSimpleAbility('lion_king_wildebeest_stampede', 'onPlay', wildebeestStampede);
    registerSimpleAbility('lion_king_lion_cub', 'special', ctx => ({ events: searchDeckByPower(ctx, 4, 'lion_king_lion_cub') }));
    registerSimpleAbility('lion_king_mufasa', 'special', ctx => addCounterToOwnMinion(ctx, 2, 'lion_king_mufasa'));
    registerSimpleAbility('lion_king_hyenas_den', 'special', (ctx) => {
        if (!hasMufasaInDiscard(ctx.state, ctx.playerId)) return { events: [] };
        const target = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.controller === ctx.playerId);
        const destination = ctx.state.bases.findIndex((_base, index) => index !== ctx.baseIndex);
        if (!target || destination < 0) return { events: [] };
        return { events: buildValidatedMoveEvents(ctx.matchState, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: ctx.baseIndex,
            toBaseIndex: destination,
            reason: 'lion_king_hyenas_den',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'action',
        }) };
    });

    registerSimpleAbility('mulan_cri_kee', 'onPlay', criKee);
    registerSimpleAbility('mulan_mushu', 'onPlay', mushu);
    registerSimpleAbility('mulan_ling', 'onPlay', ling);
    registerSimpleAbility('mulan_yao', 'onPlay', yao);
    registerSimpleAbility('mulan_li_shang', 'onPlay', liShang);
    registerSimpleAbility('mulan_mulan', 'onPlay', mulan);
    registerSimpleAbility('mulan_avalanche', 'onPlay', avalanche);
    registerSimpleAbility('mulan_be_a_man', 'onPlay', beAMan);
    registerSimpleAbility('mulan_call_up_new_recruits', 'onPlay', callUpNewRecruits);
    registerSimpleAbility('mulan_dragon_cannon', 'onPlay', dragonCannon);
    registerSimpleAbility('mulan_group_training', 'onPlay', groupTraining);
    registerSimpleAbility('mulan_prepare_to_fight', 'onPlay', prepareToFight);
    registerSimpleAbility('mulan_shan_yu', 'special', shanYu);

    registerProtection('big_hero_6_baymax', 'affect', bigHeroProtection);
    registerProtection('frozen_anna', 'affect', annaProtection);
    registerProtection('mulan_chien_po', 'affect', chienPoProtection);
    registerProtection('base_forbidden_city', 'affect', forbiddenCityProtection);
    registerProtection('frozen_frozen_port', 'move', frozenPortMoveRestriction);
    registerRestriction('frozen_lock_the_gates', 'play_minion', lockTheGatesRestriction);
    registerInterceptor('frozen_frozen_port', frozenPortInterceptor);

    registerTrigger('lion_king_circle_of_life', 'onMinionDiscardedFromBase', (ctx) => {
        if (ctx.sourceCardUid === undefined) return [];
        return [grantContextualExtraMinion({ playerId: ctx.sourceControllerId ?? ctx.playerId, now: ctx.now, matchState: ctx.matchState }, 'lion_king_circle_of_life', undefined, { powerMax: 3 })];
    }, { optional: true, playerContext: 'sourceController' });

    for (const defId of ['mulan_chien_po', 'mulan_ling', 'mulan_yao']) {
        registerTrigger(defId, 'onMinionAffected', ctx => drawOnPowerCounterHere(ctx, `${defId}_counter_draw_turn`), {
            optional: false,
            perInstance: true,
            sourceScope: 'triggerBase',
            playerContext: 'sourceController',
            canTrigger: ctx => ctx.affectType === 'power_change' && ctx.counterChangeKind === 'added',
        });
    }

    registerExtendedBase('base_sfit_robotics_lab', 'onMinionAffected', (ctx) => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? DETERMINISTIC_RANDOM, ctx.now),
    }));
    registerExtendedBase('base_training_camp', 'onMinionAffected', (ctx) => {
        if (ctx.reason === 'base_training_camp_used') return { events: [] };
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const usedKey = `base_training_camp_${ctx.playerId}_turn`;
        if (base.metadata?.[usedKey] === ctx.state.turnNumber) return { events: [] };
        return {
            events: [
                ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random ?? DETERMINISTIC_RANDOM, ctx.now),
                {
                    type: SU_EVENTS.BASE_METADATA_UPDATED,
                    payload: { baseIndex: ctx.baseIndex, metadataUpdate: { [usedKey]: ctx.state.turnNumber }, reason: 'base_training_camp_used' },
                    timestamp: ctx.now,
                } as SmashUpEvent,
            ],
        };
    }, {
        canTrigger: ctx => ctx.reason !== 'base_training_camp_used',
    });

    registerBaseVpModifier('base_arendelle', (state, baseIndex, playerId) => {
        const base = state.bases[baseIndex];
        if (!base) return 0;
        const counts = new Map<PlayerId, number>();
        for (const minion of base.minions) counts.set(minion.controller, (counts.get(minion.controller) ?? 0) + 1);
        const max = Math.max(0, ...counts.values());
        return max > 0 && counts.get(playerId) === max ? 1 : 0;
    });

    registerCustomPowerModifiers([
        {
            sourceDefId: 'frozen_marshmallow',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                const hasEnemyMarshmallow = ctx.base.minions.some(minion =>
                    helpers.matchesRuntimeDefId(minion.defId, 'frozen_marshmallow')
                    && minion.controller !== ctx.minion.controller,
                );
                return hasEnemyMarshmallow ? -1 : 0;
            },
        },
        {
            sourceDefId: 'frozen_kristoff',
            variantPolicy: 'baseOnly',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'frozen_kristoff')) return 0;
                return ctx.base.minions.some(minion => minion.controller === ctx.minion.controller && helpers.matchesRuntimeDefId(minion.defId, 'frozen_anna')) ? 2 : 0;
            },
        },
        {
            sourceDefId: 'big_hero_6_yokai',
            runtimeIdentity: 'actionFamily',
            compute: (ctx) => ctx.base.ongoingActions.some(action => action.defId === 'big_hero_6_yokai') && (ctx.minion.powerCounters ?? 0) <= 0 ? -1 : 0,
        },
        {
            sourceDefId: 'mulan_family_sword',
            runtimeIdentity: 'actionFamily',
            compute: (ctx) => ctx.minion.attachedActions.some(action => action.defId === 'mulan_family_sword') ? 3 : 0,
        },
        {
            sourceDefId: 'base_krei_tech',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => ctx.base.defId === 'base_krei_tech' && (ctx.minion.powerCounters ?? 0) > 0 ? 1 : 0,
        },
        {
            sourceDefId: 'base_ice_palace',
            runtimeIdentity: 'synthetic',
            compute: (ctx) => {
                if (ctx.base.defId !== 'base_ice_palace') return 0;
                const owner = ctx.base.minions.find(minion => minion.controller !== ctx.minion.controller)?.controller;
                return owner ? -1 : 0;
            },
        },
    ]);

    registerCustomBasePowerModifiers([
        {
            defId: 'lion_king_he_lives_in_you',
            variantPolicy: 'baseOnly',
            compute: (ctx) => ctx.ongoing && getActionController(ctx.ongoing) === ctx.playerId
                ? (hasMufasaInDiscard(ctx.state, ctx.playerId) ? 2 : 1)
                : 0,
        },
        {
            defId: 'lion_king_hyenas_den',
            variantPolicy: 'baseOnly',
            compute: (ctx) => ctx.ongoing && getActionController(ctx.ongoing) === ctx.playerId && hasMufasaInDiscard(ctx.state, ctx.playerId) ? 2 : 0,
        },
        {
            defId: 'base_pride_rock',
            variantPolicy: 'baseOnly',
            compute: (ctx) => ctx.base.defId === 'base_pride_rock' && hasMufasaInDiscard(ctx.state, ctx.playerId) ? 2 : 0,
        },
    ]);
}
