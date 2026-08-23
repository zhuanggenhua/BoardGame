import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPermanentPower,
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
    modifyBreakpoint,
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
import {
    getActionControllerId,
    getEffectiveBreakpoint,
    getPlayerEffectivePowerOnBase,
    registerBreakpointModifiers,
    registerCustomPowerModifiers,
    registerOngoingPowerModifiers,
} from '../domain/ongoingModifiers';
import {
    registerBaseAbilitySuppression,
    registerProtection,
    registerRestriction,
    registerTrigger,
    type RestrictionCheckContext,
    type TriggerContext,
} from '../domain/ongoingEffects';
import type {
    CardInstance,
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
    DeckReorderedEvent,
    MinionOnBase,
    OngoingAttachedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
    VpAwardedEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type VillainPromptMode =
    | 'destroyOwnMinion'
    | 'destroyAnyMinion'
    | 'buffOwnMinion'
    | 'moveOwnMinion'
    | 'moveDestination'
    | 'moveBaseModifier'
    | 'baseModifierDestination'
    | 'mysterioChoice'
    | 'supremeIntelligenceBuff'
    | 'deckOwnMinions'
    | 'vultureDiscardBaseModifier'
    | 'hydraHourOfDestinySearch'
    | 'hydraReactivateAgents'
    | 'hydraSecretReserves'
    | 'kreePrepareToEngage'
    | 'kreeProvenMethods';

type VillainPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    mode: VillainPromptMode;
    sourceDefId: string;
    sourceCardUid?: string;
    sourceBaseIndex?: number;
    targetBaseIndex?: number;
    minPower?: number;
    powerMax?: number;
    amount?: number;
    selectedMinionUid?: string;
    selectedMinionDefId?: string;
    selectedFromBaseIndex?: number;
    selectedOngoingUid?: string;
    selectedOngoingDefId?: string;
    selectedOngoingOwnerId?: PlayerId;
    selectedOngoingBaseIndex?: number;
    revealedCardUids?: string[];
};

type VillainDrawContinuationContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    random: RandomFn;
    drawCount: number;
};

type VillainPromptAfterEventsContext = VillainPromptContext & {
    leadingEvents: SmashUpEvent[];
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

type OngoingChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    baseIndex?: number;
    skip?: boolean;
};

type MysterioChoice = {
    mode?: 'extraBaseModifier' | 'draw';
    skip?: boolean;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    skip?: boolean;
};

function cardChoiceOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: card.uid + '-' + index,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
        displayMode: 'card' as const,
        displayCard: { defId: card.defId, cardUid: card.uid },
    }));
}

function uniqueCardChoices(value: unknown, maxCount: number): CardChoice[] {
    const raw = (Array.isArray(value) ? value : [value]) as CardChoice[];
    const seen = new Set<string>();
    const choices: CardChoice[] = [];
    for (const choice of raw) {
        if (choice?.skip || !choice?.cardUid || seen.has(choice.cardUid)) continue;
        seen.add(choice.cardUid);
        choices.push(choice);
        if (choices.length >= maxCount) break;
    }
    return choices;
}

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
    minionUid: string | undefined,
): { minion: MinionOnBase; baseIndex: number } | undefined {
    if (!minionUid) return undefined;
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const minion = state.bases[baseIndex].minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function printedPower(defId: string): number {
    const card = getCardDef(defId);
    return card?.type === 'minion' ? (card.power ?? 0) : 0;
}

function nextPlayerTurnStartExpiration(state: SmashUpCore, playerId: PlayerId): number {
    const turnOrder = state.turnOrder ?? [];
    const currentIndex = Number.isInteger(state.currentPlayerIndex)
        ? state.currentPlayerIndex
        : turnOrder.indexOf((state as { currentPlayer?: PlayerId }).currentPlayer ?? '');
    const playerIndex = turnOrder.indexOf(playerId);
    if (turnOrder.length === 0 || currentIndex < 0 || playerIndex < 0) {
        return state.turnNumber + 1;
    }
    return state.turnNumber + (playerIndex > currentIndex ? 0 : 1);
}

function ownMinionOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    options: {
        includeBaseIndex?: number;
        excludeBaseIndex?: number;
        excludeUid?: string;
        minPower?: number;
        powerMax?: number;
        defId?: string;
        effectType?: 'destroy' | 'move' | 'affect' | 'buff';
        sourceDefId?: string;
        sourceKind?: 'action' | 'nonAction';
    } = {},
) {
    const candidates = state.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => minion.controller === playerId)
            .filter(() => options.includeBaseIndex === undefined || baseIndex === options.includeBaseIndex)
            .filter(() => options.excludeBaseIndex === undefined || baseIndex !== options.excludeBaseIndex)
            .filter(minion => options.excludeUid === undefined || minion.uid !== options.excludeUid)
            .filter(minion => options.defId === undefined || minion.defId === options.defId)
            .filter(minion => options.minPower === undefined || getMinionPower(state, minion, baseIndex) >= options.minPower)
            .filter(minion => options.powerMax === undefined || printedPower(minion.defId) <= options.powerMax)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }))
    ));
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceDefId: options.sourceDefId,
        sourceKind: options.sourceKind,
        effectType: options.effectType,
    });
}

function destroyOwnMinionTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    context: {
        sourceDefId: string;
        sourceCardUid?: string;
        minPower?: number;
        powerMax?: number;
    },
) {
    const sourceKind = context.sourceDefId.startsWith('masters_of_evil_')
        || context.sourceDefId.startsWith('hydra_hail_')
        || context.sourceDefId.startsWith('hydra_two_')
        ? 'action'
        : 'nonAction';

    return ownMinionOptions(state, playerId, {
        minPower: context.minPower,
        powerMax: context.powerMax,
        defId: context.sourceDefId === 'masters_of_evil_absorbing_man'
            ? 'masters_of_evil_absorbing_man'
            : undefined,
        excludeUid: context.sourceDefId === 'masters_of_evil_absorbing_man'
            ? context.sourceCardUid
            : undefined,
        sourceDefId: context.sourceDefId,
        sourceKind,
        effectType: 'destroy',
    });
}

function anyMinionOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    options: {
        minPower?: number;
        powerMax?: number;
        opponentOnly?: boolean;
        lessThanPlayerPowerAtBase?: boolean;
        sourceDefId?: string;
    } = {},
) {
    const candidates = state.bases.flatMap((base, baseIndex) => {
        const playerPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId);
        return base.minions
            .filter(minion => !options.opponentOnly || minion.controller !== playerId)
            .filter(minion => options.minPower === undefined || getMinionPower(state, minion, baseIndex) >= options.minPower)
            .filter(minion => options.powerMax === undefined || getMinionPower(state, minion, baseIndex) <= options.powerMax)
            .filter(minion => !options.lessThanPlayerPowerAtBase || getMinionPower(state, minion, baseIndex) < playerPower)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
    });
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceDefId: options.sourceDefId,
        sourceKind: 'action',
        effectType: 'destroy',
        respectActionProtection: true,
    });
}

function isAnyMinionDestroyTargetLegal(
    state: SmashUpCore,
    playerId: PlayerId,
    selected: { minion: MinionOnBase; baseIndex: number },
    sourceDefId: string,
    options: { powerMax?: number } = {},
): boolean {
    if (options.powerMax !== undefined && getMinionPower(state, selected.minion, selected.baseIndex) > options.powerMax) {
        return false;
    }
    if (sourceDefId === 'masters_of_evil_sonic_shockwave') {
        if (selected.minion.controller === playerId) return false;
        const base = state.bases[selected.baseIndex];
        if (!base) return false;
        const playerPower = getPlayerEffectivePowerOnBase(state, base, selected.baseIndex, playerId);
        if (getMinionPower(state, selected.minion, selected.baseIndex) >= playerPower) return false;
    }
    return true;
}

function awardVp(playerId: PlayerId, amount: number, reason: string, now: number): VpAwardedEvent {
    return {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId, amount, reason },
        timestamp: now,
    };
}

function cardToDeckBottom(
    card: { uid: string; defId: string; ownerId: PlayerId },
    sourcePlayerId: PlayerId,
    sourceDefId: string,
    now: number,
): CardToDeckBottomEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.ownerId,
            sourcePlayerId,
            sourceDefId,
            sourceControllerId: sourcePlayerId,
            reason: sourceDefId,
        },
        timestamp: now,
    };
}

function cardToDeckTop(
    card: { uid: string; defId: string; ownerId: PlayerId },
    sourcePlayerId: PlayerId,
    sourceDefId: string,
    now: number,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.ownerId,
            sourcePlayerId,
            sourceDefId,
            sourceControllerId: sourcePlayerId,
            reason: sourceDefId,
        },
        timestamp: now,
    };
}

function deckReordered(playerId: PlayerId, deckUids: string[], now: number): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids },
        timestamp: now,
    };
}

function moveBaseModifierEvents(
    state: SmashUpCore,
    params: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        fromBaseIndex: number;
        toBaseIndex: number;
        sourcePlayerId: PlayerId;
        sourceDefId: string;
        now: number;
    },
): SmashUpEvent[] {
    if (params.fromBaseIndex === params.toBaseIndex) return [];
    const ongoing = state.bases[params.fromBaseIndex]?.ongoingActions.find(action => action.uid === params.cardUid);
    if (!ongoing) return [];
    return [
        {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: params.cardUid,
                defId: params.defId,
                ownerId: params.ownerId,
                reason: params.sourceDefId,
                destination: 'discard',
                sourcePlayerId: params.sourcePlayerId,
                sourceDefId: params.sourceDefId,
                sourceControllerId: params.sourcePlayerId,
                sourceBaseIndex: params.fromBaseIndex,
            },
            timestamp: params.now,
        } as OngoingDetachedEvent,
        {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: params.cardUid,
                defId: params.defId,
                ownerId: params.ownerId,
                targetType: 'base',
                targetBaseIndex: params.toBaseIndex,
                sourcePlayerId: params.sourcePlayerId,
                removeFromDiscard: true,
                ...(ongoing.metadata ? { metadata: ongoing.metadata } : {}),
                ...(ongoing.talentUsed !== undefined ? { talentUsed: ongoing.talentUsed } : {}),
            },
            timestamp: params.now,
        } as OngoingAttachedEvent,
    ];
}

function destroyMinionEvents(
    state: SmashUpCore,
    params: {
        minion: MinionOnBase;
        baseIndex: number;
        playerId: PlayerId;
        sourceDefId: string;
        sourceCardUid?: string;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
        now: number;
    },
): SmashUpEvent[] {
    return buildValidatedDestroyEvents(state, {
        minionUid: params.minion.uid,
        minionDefId: params.minion.defId,
        fromBaseIndex: params.baseIndex,
        destroyerId: params.playerId,
        reason: params.sourceDefId,
        now: params.now,
        sourcePlayerId: params.playerId,
        sourceCardUid: params.sourceCardUid,
        sourceDefId: params.sourceDefId,
        sourceControllerId: params.playerId,
        sourceBaseIndex: params.sourceBaseIndex ?? params.baseIndex,
        sourceKind: params.sourceKind,
    });
}

function extraLowPowerMinions(
    ctx: { playerId: PlayerId; now: number; matchState?: MatchState<SmashUpCore> },
    reason: string,
    baseIndex: number,
): SmashUpEvent[] {
    return [
        grantContextualExtraMinion(ctx, reason, baseIndex, { powerMax: 2 }),
        grantContextualExtraMinion(ctx, reason, baseIndex, { powerMax: 2 }),
    ];
}

const villainDrawAfterCommittedProgram = createEffectProgram<VillainDrawContinuationContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            context.drawCount,
            context.random,
            context.now,
        ),
    }),
);

function runDestroyFollowup(
    context: VillainPromptContext,
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    choice: MinionChoice | undefined,
    random: RandomFn,
    timestamp: number,
): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore>; context?: unknown; nextProgram?: unknown } {
    if (!choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
    const live = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
    if (!live) return { events: [] };
    const sourceKind = context.sourceDefId.includes('_hail_')
        || context.sourceDefId.includes('_two_more_')
        || context.sourceDefId.includes('_acceptable_')
        || context.sourceDefId.includes('_gain_the_upper_hand')
        || context.sourceDefId.includes('_sonic_')
        ? 'action'
        : 'nonAction';
    const powerBeforeDestroy = getMinionPower(state.core, live, choice.baseIndex);
    const destroyEvents = destroyMinionEvents(state.core, {
        minion: live,
        baseIndex: choice.baseIndex,
        playerId,
        sourceDefId: context.sourceDefId,
        sourceCardUid: context.sourceCardUid,
        sourceBaseIndex: context.sourceBaseIndex,
        sourceKind,
        now: timestamp,
    });

    switch (context.sourceDefId) {
        case 'hydra_red_skull':
            return {
                events: destroyEvents,
                context: { matchState: state, playerId, now: timestamp, random, drawCount: 1 },
                nextProgram: villainDrawAfterCommittedProgram,
            };
        case 'hydra_madame_hydra':
            return {
                events: [
                    ...destroyEvents,
                    ...(context.sourceCardUid && context.sourceBaseIndex !== undefined
                        ? [addTempPower(context.sourceCardUid, context.sourceBaseIndex, 2, context.sourceDefId, timestamp, {
                            sourcePlayerId: playerId,
                            sourceCardUid: context.sourceCardUid,
                            sourceDefId: context.sourceDefId,
                            sourceControllerId: playerId,
                            sourceBaseIndex: context.sourceBaseIndex,
                        })]
                        : []),
                ],
            };
        case 'hydra_hail_hydra':
            return {
                events: destroyEvents,
                context: { matchState: state, playerId, now: timestamp, random, drawCount: powerBeforeDestroy },
                nextProgram: villainDrawAfterCommittedProgram,
            };
        case 'hydra_two_more_shall_take_its_place':
            return {
                events: [
                    ...destroyEvents,
                    ...extraLowPowerMinions({ playerId, now: timestamp, matchState: state }, context.sourceDefId, choice.baseIndex),
                ],
            };
        case 'hydra_baron_strucker': {
            return {
                events: destroyEvents,
                context: {
                    ...context,
                    matchState: state,
                    now: timestamp,
                    mode: 'moveOwnMinion',
                    targetBaseIndex: context.sourceBaseIndex,
                },
                nextProgram: villainPromptProgram,
            };
        }
        case 'masters_of_evil_acceptable_losses':
            return { events: [...destroyEvents, awardVp(playerId, 1, context.sourceDefId, timestamp)] };
        case 'masters_of_evil_absorbing_man': {
            const source = findMinion(state.core, context.sourceCardUid);
            if (!source || live.uid === source.minion.uid || live.defId !== 'masters_of_evil_absorbing_man') {
                return { events: [] };
            }
            return {
                events: [
                    ...destroyMinionEvents(state.core, {
                        minion: source.minion,
                        baseIndex: source.baseIndex,
                        playerId,
                        sourceDefId: context.sourceDefId,
                        sourceCardUid: context.sourceCardUid,
                        sourceBaseIndex: context.sourceBaseIndex,
                        sourceKind: 'nonAction',
                        now: timestamp,
                    }),
                    ...destroyEvents,
                    awardVp(playerId, 1, context.sourceDefId, timestamp),
                ],
            };
        }
        case 'masters_of_evil_gain_the_upper_hand':
            return { events: destroyEvents };
        case 'masters_of_evil_sonic_shockwave':
            return {
                events: [
                    ...destroyEvents,
                    ...(powerBeforeDestroy >= 5 ? [awardVp(playerId, 1, context.sourceDefId, timestamp)] : []),
                ],
            };
        default:
            return { events: destroyEvents };
    }
}

const villainPromptProgram = createPromptProgram<VillainPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'marvel_villains_runtime_prompt',
    buildInteraction: (context) => {
        const state = context.matchState.core;
        if (context.mode === 'destroyOwnMinion') {
            const options = destroyOwnMinionTargetOptions(state, context.playerId, context);
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_destroy_own_${context.sourceDefId}_${context.now}`,
                context.playerId,
                '选择要消灭的己方角色',
                options,
                {
                    sourceId: 'marvel_villains_destroy_own_prompt',
                    titleKey: 'ui.marvel_villains_destroy_own_title',
                    targetType: 'minion',
                    responseValidationMode: 'live',
                },
            );
        }

        if (context.mode === 'destroyAnyMinion') {
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_destroy_any_${context.sourceDefId}_${context.now}`,
                context.playerId,
                '选择要消灭的角色',
                anyMinionOptions(state, context.playerId, {
                    powerMax: context.powerMax,
                    opponentOnly: context.sourceDefId === 'masters_of_evil_sonic_shockwave',
                    lessThanPlayerPowerAtBase: context.sourceDefId === 'masters_of_evil_sonic_shockwave',
                    sourceDefId: context.sourceDefId,
                }),
                {
                    sourceId: 'marvel_villains_destroy_any_prompt',
                    titleKey: 'ui.marvel_villains_destroy_any_title',
                    targetType: 'minion',
                    responseValidationMode: 'live',
                },
            );
        }

        if (context.mode === 'buffOwnMinion' || context.mode === 'supremeIntelligenceBuff') {
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_buff_${context.sourceDefId}_${context.now}`,
                context.playerId,
                '选择获得力量修正的己方角色',
                [
                    ...ownMinionOptions(state, context.playerId, {
                        includeBaseIndex: context.targetBaseIndex,
                        excludeUid: context.mode === 'supremeIntelligenceBuff' ? context.sourceCardUid : undefined,
                        sourceDefId: context.sourceDefId,
                        sourceKind: 'nonAction',
                        effectType: 'buff',
                    }),
                    ...(context.mode === 'supremeIntelligenceBuff' ? [createSkipOption()] : []),
                ],
                {
                    sourceId: 'marvel_villains_buff_prompt',
                    titleKey: 'ui.marvel_villains_buff_title',
                    targetType: 'minion',
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'moveOwnMinion') {
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_move_own_${context.sourceDefId}_${context.now}`,
                context.playerId,
                '选择要移动的己方角色',
                [
                    ...ownMinionOptions(state, context.playerId, {
                        excludeBaseIndex: context.targetBaseIndex,
                        sourceDefId: context.sourceDefId,
                        sourceKind: 'nonAction',
                        effectType: 'move',
                    }),
                    createSkipOption(),
                ],
                {
                    sourceId: 'marvel_villains_move_own_prompt',
                    titleKey: 'ui.marvel_villains_move_own_title',
                    targetType: 'minion',
                    multi: context.sourceDefId === 'hydra_baron_strucker'
                        ? { min: 0, max: 2 }
                        : undefined,
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'moveDestination' || context.mode === 'baseModifierDestination') {
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_destination_${context.sourceDefId}_${context.now}`,
                context.playerId,
                '选择目标基地',
                buildBaseTargetOptions(
                    state.bases
                        .map((base, baseIndex) => ({
                            baseIndex,
                            label: getBaseDef(base.defId)?.name ?? base.defId,
                        }))
                        .filter(candidate => candidate.baseIndex !== (
                            context.mode === 'moveDestination'
                                ? context.selectedFromBaseIndex
                                : context.selectedOngoingBaseIndex
                        )),
                    state,
                ),
                {
                    sourceId: 'marvel_villains_base_destination_prompt',
                    titleKey: 'ui.marvel_villains_destination_title',
                    targetType: 'base',
                    responseValidationMode: 'live',
                },
            );
        }

        if (context.mode === 'moveBaseModifier') {
            const options = state.bases.flatMap((base, baseIndex) => base.ongoingActions.map((ongoing, index) => ({
                id: `ongoing-${baseIndex}-${index}`,
                label: getCardDef(ongoing.defId)?.name ?? ongoing.defId,
                value: {
                    cardUid: ongoing.uid,
                    defId: ongoing.defId,
                    ownerId: ongoing.ownerId,
                    baseIndex,
                },
                _source: 'ongoing' as const,
                displayMode: 'card' as const,
                displayCard: { defId: ongoing.defId, cardUid: ongoing.uid },
            })));
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_move_modifier_${context.sourceDefId}_${context.now}`,
                context.playerId,
                '选择要移动的基地神器',
                options,
                {
                    sourceId: 'marvel_villains_move_modifier_prompt',
                    titleKey: 'ui.marvel_villains_move_modifier_title',
                    targetType: 'ongoing',
                    responseValidationMode: 'live',
                },
            );
        }

        if (context.mode === 'mysterioChoice') {
            return createAbilityRuntimeSimpleChoice(
                `marvel_villains_mysterio_${context.now}`,
                context.playerId,
                '神秘客：选择效果',
                [
                    { id: 'extra-base-modifier', label: '额外打出一个基地神器', labelKey: 'ui.marvel_villains_mysterio_extra_base_modifier_option', value: { mode: 'extraBaseModifier' as const } },
                    { id: 'draw', label: '抽一张牌', labelKey: 'ui.marvel_villains_mysterio_draw_option', value: { mode: 'draw' as const } },
                ],
                {
                    sourceId: 'marvel_villains_mysterio_choice_prompt',
                    titleKey: 'ui.marvel_villains_mysterio_choice_title',
                    targetType: 'none',
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'hydraHourOfDestinySearch') {
            const cards = (state.players[context.playerId]?.deck ?? [])
                .filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2);
            return createAbilityRuntimeSimpleChoice(
                'hydra_hour_of_destiny_' + context.now,
                context.playerId,
                '命运时刻：选择至多两名力量≤2的角色',
                cardChoiceOptions(cards),
                {
                    sourceId: 'hydra_hour_of_destiny_search',
                    targetType: 'generic',
                    titleKey: 'ui.hydra_hour_of_destiny_title',
                    multi: { min: 0, max: Math.min(2, cards.length) },
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'hydraReactivateAgents' || context.mode === 'hydraSecretReserves') {
            const cards = (state.players[context.playerId]?.discard ?? [])
                .filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2);
            return createAbilityRuntimeSimpleChoice(
                context.mode + '_' + context.now,
                context.playerId,
                context.mode === 'hydraReactivateAgents'
                    ? '重新激活特工：选择至多两名力量≤2的角色'
                    : '秘密储备：选择任意数量力量≤2的角色洗回牌库',
                cardChoiceOptions(cards),
                {
                    sourceId: context.mode === 'hydraReactivateAgents'
                        ? 'hydra_reactivate_agents'
                        : 'hydra_secret_reserves',
                    targetType: 'discard',
                    titleKey: context.mode === 'hydraReactivateAgents'
                        ? 'ui.hydra_reactivate_agents_title'
                        : 'ui.hydra_secret_reserves_title',
                    multi: {
                        min: 0,
                        max: context.mode === 'hydraReactivateAgents' ? Math.min(2, cards.length) : cards.length,
                    },
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'kreePrepareToEngage') {
            const revealed = (context.revealedCardUids ?? [])
                .map(uid => state.players[context.playerId]?.deck.find(card => card.uid === uid))
                .filter((card): card is CardInstance => !!card)
                .filter(card => getCardDef(card.defId)?.type === 'action');
            return createAbilityRuntimeSimpleChoice(
                'kree_prepare_to_engage_' + context.now,
                context.playerId,
                '准备接战：选择至多两张已展示行动加入手牌',
                cardChoiceOptions(revealed),
                {
                    sourceId: 'kree_prepare_to_engage',
                    targetType: 'generic',
                    titleKey: 'ui.kree_prepare_to_engage_title',
                    multi: { min: 0, max: Math.min(2, revealed.length) },
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'kreeProvenMethods') {
            const cards = (state.players[context.playerId]?.discard ?? [])
                .filter(card => getCardDef(card.defId)?.type === 'action');
            return createAbilityRuntimeSimpleChoice(
                'kree_proven_methods_' + context.now,
                context.playerId,
                '验证方法：选择至多两张行动按选择顺序置于牌库顶',
                cardChoiceOptions(cards),
                {
                    sourceId: 'kree_proven_methods',
                    targetType: 'discard',
                    titleKey: 'ui.kree_proven_methods_title',
                    multi: { min: 0, max: Math.min(2, cards.length) },
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        if (context.mode === 'vultureDiscardBaseModifier') {
            const options = state.players[context.playerId]?.discard
                .filter(card => {
                    const def = getCardDef(card.defId);
                    return def?.type === 'action' && def.subtype === 'ongoing' && def.ongoingTarget === 'base';
                })
                .map(card => ({
                    id: card.uid,
                    label: getCardDef(card.defId)?.name ?? card.defId,
                    value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
                    displayMode: 'card' as const,
                    displayCard: { defId: card.defId, cardUid: card.uid },
                })) ?? [];
            return createAbilityRuntimeSimpleChoice(
                `sinister_six_vulture_${context.now}`,
                context.playerId,
                '秃鹫：选择弃牌堆中的基地修正',
                [createSkipOption(), ...options],
                {
                    sourceId: 'sinister_six_vulture',
                    titleKey: 'ui.sinister_six_vulture_title',
                    targetType: 'discard',
                    autoRefresh: 'discard',
                    responseValidationMode: 'live',
                    autoResolveIfSingle: false,
                },
            );
        }

        return createAbilityRuntimeSimpleChoice(
            `marvel_villains_deck_own_${context.sourceDefId}_${context.now}`,
            context.playerId,
            '选择至多两个己方角色洗回牌库',
            [
                ...ownMinionOptions(state, context.playerId, {
                    includeBaseIndex: context.sourceBaseIndex,
                    sourceDefId: context.sourceDefId,
                    sourceKind: 'nonAction',
                    effectType: 'affect',
                }),
                createSkipOption(),
            ],
            {
                sourceId: 'marvel_villains_deck_own_minions_prompt',
                titleKey: 'ui.marvel_villains_deck_own_minions_title',
                targetType: 'minion',
                multi: { min: 0, max: 2 },
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: (args) => {
        const { context, state, playerId, value, timestamp } = args;
        if (context.mode === 'destroyOwnMinion' || context.mode === 'destroyAnyMinion') {
            return runDestroyFollowup(context, state, playerId, value as MinionChoice | undefined, args.random, timestamp);
        }

        if (context.mode === 'buffOwnMinion' || context.mode === 'supremeIntelligenceBuff') {
            const choice = value as MinionChoice | undefined;
            if (choice?.skip || !choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
            const live = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
            if (!live || live.controller !== playerId) return { events: [] };
            return {
                events: [addTempPower(live.uid, choice.baseIndex, context.amount ?? 1, context.sourceDefId, timestamp, {
                    sourcePlayerId: playerId,
                    sourceCardUid: context.sourceCardUid,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: playerId,
                    sourceBaseIndex: context.sourceBaseIndex ?? choice.baseIndex,
                })],
            };
        }

        if (context.mode === 'moveOwnMinion') {
            const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
            const events: SmashUpEvent[] = [];
            const targetBaseIndex = context.targetBaseIndex;
            if (targetBaseIndex === undefined) return { events: [] };
            for (const choice of choices.slice(0, context.sourceDefId === 'hydra_baron_strucker' ? 2 : 1)) {
                if (choice?.skip || !choice?.minionUid || choice.baseIndex === undefined) continue;
                const live = state.core.bases[choice.baseIndex]?.minions.find(
                    minion => minion.uid === choice.minionUid && minion.controller === playerId,
                );
                if (!live || choice.baseIndex === targetBaseIndex) continue;
                events.push(...buildValidatedMoveEvents(state.core, {
                    minionUid: live.uid,
                    minionDefId: live.defId,
                    fromBaseIndex: choice.baseIndex,
                    toBaseIndex: targetBaseIndex,
                    reason: context.sourceDefId,
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: playerId,
                    sourceBaseIndex: context.sourceBaseIndex ?? targetBaseIndex,
                    sourceKind: 'nonAction',
                }));
            }
            return { events };
        }

        if (context.mode === 'moveDestination') {
            const choice = value as BaseChoice | undefined;
            if (choice?.baseIndex === undefined || context.selectedFromBaseIndex === undefined || !context.selectedMinionUid || !context.selectedMinionDefId) {
                return { events: [] };
            }
            const live = state.core.bases[context.selectedFromBaseIndex]?.minions.find(
                minion => minion.uid === context.selectedMinionUid && minion.controller === playerId,
            );
            if (!live || context.selectedFromBaseIndex === choice.baseIndex) return { events: [] };
            const moveEvents = buildValidatedMoveEvents(state.core, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: context.selectedFromBaseIndex,
                toBaseIndex: choice.baseIndex,
                reason: context.sourceDefId,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: context.sourceBaseIndex ?? context.selectedFromBaseIndex,
                sourceKind: 'action',
            });
            const destinationOwnCount = state.core.bases[choice.baseIndex]?.minions
                .filter(minion => minion.controller === playerId).length ?? 0;
            const gainsVp = context.sourceDefId === 'masters_of_evil_convergence'
                && destinationOwnCount + 1 >= 4;
            return { events: [...moveEvents, ...(gainsVp ? [awardVp(playerId, 1, context.sourceDefId, timestamp)] : [])] };
        }

        if (context.mode === 'moveBaseModifier') {
            const choice = value as OngoingChoice | undefined;
            if (!choice?.cardUid || !choice.defId || !choice.ownerId || choice.baseIndex === undefined) return { events: [] };
            return {
                events: [],
                matchState: executeAbilityProgram(villainPromptProgram, {
                    ...context,
                    matchState: state,
                    mode: 'baseModifierDestination',
                    selectedOngoingUid: choice.cardUid,
                    selectedOngoingDefId: choice.defId,
                    selectedOngoingOwnerId: choice.ownerId,
                    selectedOngoingBaseIndex: choice.baseIndex,
                }).matchState,
            };
        }

        if (context.mode === 'baseModifierDestination') {
            const choice = value as BaseChoice | undefined;
            if (choice?.baseIndex === undefined || !context.selectedOngoingUid || !context.selectedOngoingDefId || !context.selectedOngoingOwnerId || context.selectedOngoingBaseIndex === undefined) {
                return { events: [] };
            }
            return {
                events: moveBaseModifierEvents(state.core, {
                    cardUid: context.selectedOngoingUid,
                    defId: context.selectedOngoingDefId,
                    ownerId: context.selectedOngoingOwnerId,
                    fromBaseIndex: context.selectedOngoingBaseIndex,
                    toBaseIndex: choice.baseIndex,
                    sourcePlayerId: playerId,
                    sourceDefId: context.sourceDefId,
                    now: timestamp,
                }),
            };
        }

        if (context.mode === 'mysterioChoice') {
            const choice = value as MysterioChoice | undefined;
            if (choice?.mode === 'draw') {
                return { events: buildStandardDrawEventsFromRuntimeContext(args, playerId, 1) };
            }
            if (choice?.mode === 'extraBaseModifier' && context.sourceBaseIndex !== undefined) {
                return {
                    events: [grantContextualExtraAction(
                        { playerId, now: timestamp, matchState: state },
                        context.sourceDefId,
                        {
                            playTiming: 'immediate',
                            restrictToBase: context.sourceBaseIndex,
                            restrictToBaseModifier: true,
                        },
                    )],
                };
            }
            return { events: [] };
        }

        if (context.mode === 'hydraHourOfDestinySearch') {
            const choices = uniqueCardChoices(value, 2);
            if (choices.length === 0) return { events: [] };
            const selected = choices
                .map(choice => state.core.players[playerId]?.deck.find(card => card.uid === choice.cardUid))
                .filter((card): card is CardInstance => !!card)
                .filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2)
                .slice(0, 2);
            if (selected.length === 0) return { events: [] };
            const player = state.core.players[playerId];
            const restDeck = player.deck.filter(card => !selected.some(hit => hit.uid === card.uid));
            return {
                events: [
                    deckReordered(playerId, [...selected, ...restDeck].map(card => card.uid), timestamp),
                    {
                        type: SU_EVENTS.CARDS_DRAWN,
                        payload: { playerId, count: selected.length, cardUids: selected.map(card => card.uid) },
                        timestamp,
                    } as SmashUpEvent,
                ],
            };
        }

        if (context.mode === 'hydraReactivateAgents') {
            const choices = uniqueCardChoices(value, 2);
            const selected = choices
                .map(choice => state.core.players[playerId]?.discard.find(card => card.uid === choice.cardUid))
                .filter((card): card is CardInstance => !!card)
                .filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2)
                .slice(0, 2);
            return selected.length > 0
                ? { events: [recoverCardsFromDiscard(playerId, selected.map(card => card.uid), context.sourceDefId, timestamp)] }
                : { events: [] };
        }

        if (context.mode === 'hydraSecretReserves') {
            const choices = uniqueCardChoices(value, Number.MAX_SAFE_INTEGER);
            const player = state.core.players[playerId];
            const selected = choices
                .map(choice => player?.discard.find(card => card.uid === choice.cardUid))
                .filter((card): card is CardInstance => !!card)
                .filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2);
            if (!player || selected.length === 0) return { events: [] };
            const nextDeck = args.random.shuffle([...player.deck, ...selected]);
            return { events: [deckReordered(playerId, nextDeck.map(card => card.uid), timestamp)] };
        }

        if (context.mode === 'kreePrepareToEngage') {
            const revealedSet = new Set(context.revealedCardUids ?? []);
            const choices = uniqueCardChoices(value, 2);
            const selected = choices
                .map(choice => state.core.players[playerId]?.deck.find(card => card.uid === choice.cardUid))
                .filter((card): card is CardInstance => !!card)
                .filter(card => revealedSet.has(card.uid))
                .filter(card => getCardDef(card.defId)?.type === 'action')
                .slice(0, 2);
            const player = state.core.players[playerId];
            if (!player) return { events: [] };
            const revealed = (context.revealedCardUids ?? [])
                .map(uid => player.deck.find(card => card.uid === uid))
                .filter((card): card is CardInstance => !!card);
            const selectedIds = new Set(selected.map(card => card.uid));
            const remainingRevealed = revealed.filter(card => !selectedIds.has(card.uid));
            const restDeck = player.deck.filter(card => !revealed.some(hit => hit.uid === card.uid));
            const events: SmashUpEvent[] = [
                deckReordered(playerId, [...selected, ...args.random.shuffle([...remainingRevealed, ...restDeck])].map(card => card.uid), timestamp),
            ];
            if (selected.length > 0) {
                events.push({
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: selected.length, cardUids: selected.map(card => card.uid) },
                    timestamp,
                } as SmashUpEvent);
            }
            return { events };
        }

        if (context.mode === 'kreeProvenMethods') {
            const choices = uniqueCardChoices(value, 2);
            const player = state.core.players[playerId];
            const selected = choices
                .map(choice => player?.discard.find(card => card.uid === choice.cardUid))
                .filter((card): card is CardInstance => !!card)
                .filter(card => getCardDef(card.defId)?.type === 'action')
                .slice(0, 2);
            return player && selected.length > 0
                ? { events: [deckReordered(playerId, [...selected, ...player.deck].map(card => card.uid), timestamp)] }
                : { events: [] };
        }

        if (context.mode === 'vultureDiscardBaseModifier') {
            const choice = value as OngoingChoice | undefined;
            if (choice?.skip || !choice?.cardUid || !choice.defId || !choice.ownerId) return { events: [] };
            const selected = state.core.players[playerId]?.discard.find(card => card.uid === choice.cardUid);
            if (!selected) return { events: [] };
            const def = getCardDef(selected.defId);
            if (def?.type !== 'action' || def.subtype !== 'ongoing' || def.ongoingTarget !== 'base') return { events: [] };
            return {
                events: [cardToDeckTop({ uid: selected.uid, defId: selected.defId, ownerId: selected.owner }, playerId, context.sourceDefId, timestamp)],
            };
        }

        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const events = choices
            .filter(choice => !choice?.skip && choice?.minionUid && choice.baseIndex === context.sourceBaseIndex)
            .slice(0, 2)
            .flatMap(choice => {
                const live = state.core.bases[choice.baseIndex!]?.minions.find(
                    minion => minion.uid === choice.minionUid && minion.controller === playerId,
                );
                return live
                    ? [cardToDeckBottom({ uid: live.uid, defId: live.defId, ownerId: live.owner }, playerId, context.sourceDefId, timestamp)]
                    : [];
            });
        return { events };
    },
});

const villainPromptAfterEventsProgram = createEffectProgram<VillainPromptAfterEventsContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const { leadingEvents: _leadingEvents, ...promptContext } = context;
        return {
            events: context.leadingEvents,
            context: promptContext,
            nextProgram: villainPromptProgram,
        };
    },
);

function prompt(context: VillainPromptContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(villainPromptProgram, context));
}

function destroyOwnMinionAbility(
    ctx: AbilityContext,
    options: { minPower?: number; powerMax?: number } = {},
): AbilityResult {
    const targetOptions = destroyOwnMinionTargetOptions(ctx.state, ctx.playerId, {
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        ...options,
    });
    const selected = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
    if (
        selected
        && selected.minion.controller === ctx.playerId
        && targetOptions.some(option => option.value?.minionUid === selected.minion.uid)
    ) {
        return runDestroyFollowup({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'destroyOwnMinion',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            ...options,
        }, ctx.matchState, ctx.playerId, {
            minionUid: selected.minion.uid,
            minionDefId: selected.minion.defId,
            baseIndex: selected.baseIndex,
        }, ctx.random, ctx.now);
    }
    if (targetOptions.length === 0) {
        return { events: [] };
    }
    return prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'destroyOwnMinion',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
        ...options,
    });
}

function destroyAnyMinionAbility(ctx: AbilityContext, options: { powerMax?: number } = {}): AbilityResult {
    const selected = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
    if (selected && isAnyMinionDestroyTargetLegal(ctx.state, ctx.playerId, selected, ctx.defId, options)) {
        return runDestroyFollowup({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'destroyAnyMinion',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            ...options,
        }, ctx.matchState, ctx.playerId, {
            minionUid: selected.minion.uid,
            minionDefId: selected.minion.defId,
            baseIndex: selected.baseIndex,
        }, ctx.random, ctx.now);
    }
    if (selected) return { events: [] };
    return prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'destroyAnyMinion',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
        ...options,
    });
}

function hydraHourOfDestiny(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        return prompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'hydraHourOfDestinySearch',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
        });
    }
    const result = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2,
        maxPick: 2,
        revealTo: 'all',
        reason: ctx.defId,
        now: ctx.now,
    });
    return { events: result.events };
}

function hydraReactivateAgents(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        return prompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'hydraReactivateAgents',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
        });
    }
    const selected = ctx.state.players[ctx.playerId]?.discard
        .filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2)
        .slice(0, 2) ?? [];
    return selected.length > 0
        ? { events: [recoverCardsFromDiscard(ctx.playerId, selected.map(card => card.uid), ctx.defId, ctx.now)] }
        : { events: [] };
}

function hydraSecretReserves(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    if (ctx.matchState) {
        return prompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'hydraSecretReserves',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
        });
    }
    const selected = player.discard.filter(card => getCardDef(card.defId)?.type === 'minion' && printedPower(card.defId) <= 2);
    if (selected.length === 0) return { events: [] };
    const nextDeck = ctx.random.shuffle([...player.deck, ...selected]);
    return { events: [deckReordered(ctx.playerId, nextDeck.map(card => card.uid), ctx.now)] };
}

function kreePrepareToEngage(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const revealed = player.deck.slice(0, 5);
    if (revealed.length === 0) return { events: [] };
    const revealEvents: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, revealed.length, ctx.defId, ctx.now),
        revealDeckTop(ctx.playerId, ctx.playerId, revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, ctx.defId, ctx.now, ctx.playerId),
    ];
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(villainPromptAfterEventsProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'kreePrepareToEngage',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            revealedCardUids: revealed.map(card => card.uid),
            leadingEvents: revealEvents,
        }));
    }
    return { events: revealEvents };
}

function kreeProvenMethods(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    if (ctx.matchState) {
        return prompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'kreeProvenMethods',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
        });
    }
    return { events: [] };
}

function buffTargetOrPrompt(ctx: AbilityContext, amount: number, drawCount = 0, extraAction = false): AbilityResult {
    const selected = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
    if (selected && selected.minion.controller === ctx.playerId) {
        return {
            events: [
                addTempPower(selected.minion.uid, selected.baseIndex, amount, ctx.defId, ctx.now, {
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                }),
                ...buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now),
                ...(extraAction ? [grantContextualExtraAction(ctx, ctx.defId)] : []),
            ],
        };
    }
    const result = prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'buffOwnMinion',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
        amount,
    });
    return {
        events: [
            ...result.events,
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, drawCount, ctx.random, ctx.now),
            ...(extraAction ? [grantContextualExtraAction(ctx, ctx.defId)] : []),
        ],
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function mastersConvergence(ctx: AbilityContext): AbilityResult {
    const selected = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
    if (selected && selected.minion.controller === ctx.playerId) {
        return prompt({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            mode: 'moveDestination',
            sourceDefId: ctx.defId,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            selectedMinionUid: selected.minion.uid,
            selectedMinionDefId: selected.minion.defId,
            selectedFromBaseIndex: selected.baseIndex,
        });
    }
    return prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'moveOwnMinion',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function sinisterVulture(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const candidates = player.discard.filter(card => {
        const def = getCardDef(card.defId);
        return def?.type === 'action' && def.subtype === 'ongoing' && def.ongoingTarget === 'base';
    });
    if (candidates.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'vultureDiscardBaseModifier',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function sinisterMoveTheGoods(ctx: AbilityContext): AbilityResult {
    return prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'moveBaseModifier',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function breakpointAtOrBelow(state: SmashUpCore, baseIndex: number, max: number): boolean {
    return getEffectiveBreakpoint(state, baseIndex) <= max;
}

function redSkullDestroyedTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    if (!ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function supremeIntelligenceTrigger(ctx: TriggerContext) {
    if (ctx.playerId !== ctx.sourceControllerId || !ctx.sourceControllerId) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return executeAbilityProgram(villainPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        mode: 'supremeIntelligenceBuff',
        sourceDefId: 'kree_supreme_intelligence',
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.sourceBaseIndex,
        amount: 1,
    });
}

function mastersBaronZemoAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    return [
        awardVp(ctx.sourceControllerId, 1, 'masters_of_evil_baron_zemo', ctx.now),
        cardToDeckBottom({
            uid: ctx.sourceCardUid,
            defId: 'masters_of_evil_baron_zemo',
            ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        }, ctx.sourceControllerId, 'masters_of_evil_baron_zemo', ctx.now),
    ];
}

function mastersPortentAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    const power = getPlayerEffectivePowerOnBase(ctx.state, ctx.state.bases[ctx.sourceBaseIndex], ctx.sourceBaseIndex, ctx.sourceControllerId);
    return power > 0 ? [awardVp(ctx.sourceControllerId, 1, 'masters_of_evil_a_portent_of_doom', ctx.now)] : [];
}

function mastersWorldDominationAfterScoring(ctx: TriggerContext) {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return { events: [] };
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return { events: [] };
    return executeAbilityProgram(villainPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        mode: 'baseModifierDestination',
        sourceDefId: 'masters_of_evil_world_domination',
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.sourceBaseIndex,
        selectedOngoingUid: ctx.sourceCardUid,
        selectedOngoingDefId: 'masters_of_evil_world_domination',
        selectedOngoingOwnerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        selectedOngoingBaseIndex: ctx.sourceBaseIndex,
    });
}

function sinisterDoctorOctopusStartTurn(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || ctx.playerId !== ctx.sourceControllerId) return [];
    return [modifyBreakpoint(ctx.sourceBaseIndex, -4, 'sinister_six_doctor_octopus', ctx.now)];
}

function sinisterCoverExitsAfterScoring(ctx: TriggerContext) {
    if (!ctx.matchState || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return { events: [] };
    if (ctx.baseIndex !== ctx.sourceBaseIndex || !breakpointAtOrBelow(ctx.state, ctx.sourceBaseIndex, 19)) return { events: [] };
    return executeAbilityProgram(villainPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        mode: 'deckOwnMinions',
        sourceDefId: 'sinister_six_cover_the_exits',
        sourceCardUid: ctx.sourceCardUid,
        sourceBaseIndex: ctx.sourceBaseIndex,
    });
}

function sinisterIncitePanicRestriction(ctx: RestrictionCheckContext): boolean {
    const activationWindow = ctx.extra?.activationWindow;
    if (activationWindow !== 'meFirst' && activationWindow !== 'afterScoring') return false;
    if (!breakpointAtOrBelow(ctx.state, ctx.baseIndex, 19)) return false;
    return ctx.state.bases[ctx.baseIndex]?.ongoingActions.some(action =>
        action.defId === 'sinister_six_incite_panic'
        && getActionControllerId(action) !== ctx.playerId
    ) ?? false;
}

export function registerMarvelVillainsAbilities(): void {
    registerSimpleAbility('hydra_red_skull', 'talent', ctx => destroyOwnMinionAbility(ctx));
    registerSimpleAbility('hydra_baron_strucker', 'talent', ctx => destroyOwnMinionAbility(ctx));
    registerSimpleAbility('hydra_madame_hydra', 'talent', ctx => destroyOwnMinionAbility(ctx));
    registerSimpleAbility('hydra_hydra_agent', 'onDestroy', ctx => ({ events: extraLowPowerMinions(ctx, 'hydra_hydra_agent', ctx.baseIndex) }));
    registerSimpleAbility('hydra_hail_hydra', 'onPlay', ctx => destroyOwnMinionAbility(ctx));
    registerSimpleAbility('hydra_hour_of_destiny', 'onPlay', hydraHourOfDestiny);
    registerSimpleAbility('hydra_reactivate_agents', 'onPlay', hydraReactivateAgents);
    registerSimpleAbility('hydra_secret_reserves', 'onPlay', hydraSecretReserves);
    registerSimpleAbility('hydra_two_more_shall_take_its_place', 'onPlay', ctx => destroyOwnMinionAbility(ctx));
    registerTrigger('hydra_red_skull', 'onMinionDestroyed', redSkullDestroyedTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerSimpleAbility('kree_minn_erva', 'onPlay', ctx => ({ events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) }));
    registerSimpleAbility('kree_ronan_the_accuser', 'onPlay', ctx => ({ events: [grantContextualExtraAction(ctx, 'kree_ronan_the_accuser')] }));
    registerSimpleAbility('kree_battle_rage', 'onPlay', ctx => buffTargetOrPrompt(ctx, 2, 1));
    registerSimpleAbility('kree_call_for_backup', 'onPlay', ctx => ({ events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) }));
    registerSimpleAbility('kree_it_begins', 'onPlay', ctx => buffTargetOrPrompt(ctx, 1, 1, true));
    registerSimpleAbility('kree_prepare_to_engage', 'onPlay', kreePrepareToEngage);
    registerSimpleAbility('kree_proven_methods', 'onPlay', kreeProvenMethods);
    registerSimpleAbility('kree_relentless_attack', 'talent', ctx => ({ events: [grantContextualExtraAction(ctx, 'kree_relentless_attack')] }));
    registerSimpleAbility('kree_speed_up', 'onPlay', ctx => ({
        events: [
            grantContextualExtraAction(ctx, 'kree_speed_up'),
            grantContextualExtraAction(ctx, 'kree_speed_up'),
        ],
    }));
    registerTrigger('kree_supreme_intelligence', 'onActionPlayed', supremeIntelligenceTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });

    registerSimpleAbility('masters_of_evil_ulysses_klaw', 'onPlay', ctx => ({
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, Math.floor((ctx.state.players[ctx.playerId]?.vp ?? 0) / 4), ctx.random, ctx.now),
    }));
    registerSimpleAbility('masters_of_evil_absorbing_man', 'talent', ctx => destroyOwnMinionAbility(ctx));
    registerSimpleAbility('masters_of_evil_acceptable_losses', 'onPlay', ctx => destroyOwnMinionAbility(ctx, { minPower: 4 }));
    registerSimpleAbility('masters_of_evil_convergence', 'onPlay', mastersConvergence);
    registerSimpleAbility('masters_of_evil_gain_the_upper_hand', 'onPlay', ctx => destroyAnyMinionAbility(ctx, { powerMax: 3 }));
    registerSimpleAbility('masters_of_evil_sonic_shockwave', 'onPlay', ctx => destroyAnyMinionAbility(ctx));
    registerSimpleAbility('masters_of_evil_world_domination', 'talent', ctx => buffTargetOrPrompt(ctx, 2));
    registerTrigger('masters_of_evil_baron_zemo', 'afterScoring', mastersBaronZemoAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('masters_of_evil_a_portent_of_doom', 'afterScoring', mastersPortentAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('masters_of_evil_world_domination', 'afterScoring', mastersWorldDominationAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerSimpleAbility('sinister_six_mysterio', 'talent', ctx => prompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        mode: 'mysterioChoice',
        sourceDefId: ctx.defId,
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    }));
    registerSimpleAbility('sinister_six_green_goblin', 'talent', ctx => ({ events: [modifyBreakpoint(ctx.baseIndex, -3, ctx.defId, ctx.now)] }));
    registerSimpleAbility('sinister_six_vulture', 'onPlay', sinisterVulture);
    registerSimpleAbility('sinister_six_ambush', 'onPlay', ctx => ({ events: [modifyBreakpoint(ctx.targetBaseIndex ?? ctx.baseIndex, -4, ctx.defId, ctx.now)] }));
    registerSimpleAbility('sinister_six_move_the_goods', 'onPlay', sinisterMoveTheGoods);
    registerSimpleAbility('sinister_six_move_the_goods', 'special', sinisterMoveTheGoods);
    registerSimpleAbility('sinister_six_my_master_plan', 'talent', ctx => ({
        events: breakpointAtOrBelow(ctx.state, ctx.baseIndex, 19)
            ? buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now)
            : [],
    }));
    registerSimpleAbility('sinister_six_pressure_from_all_sides', 'talent', ctx => ({
        events: [modifyBreakpoint(ctx.baseIndex, -(ctx.state.bases[ctx.baseIndex]?.minions.length ?? 0), ctx.defId, ctx.now)],
    }));
    registerSimpleAbility('sinister_six_reroute_the_power', 'talent', ctx => {
        if (!breakpointAtOrBelow(ctx.state, ctx.baseIndex, 19)) return { events: [] };
        const selected = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
        if (selected && selected.baseIndex === ctx.baseIndex && selected.minion.controller === ctx.playerId) {
            return {
                events: [addPermanentPower(selected.minion.uid, ctx.baseIndex, 3, ctx.defId, ctx.now, {
                    expiresOnTurnNumber: nextPlayerTurnStartExpiration(ctx.state, ctx.playerId),
                    expiresOnPlayerId: ctx.playerId,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                })],
            };
        }
        return buffTargetOrPrompt(ctx, 3);
    });
    registerTrigger('sinister_six_doctor_octopus', 'onTurnStart', sinisterDoctorOctopusStartTurn, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('sinister_six_cover_the_exits', 'afterScoring', sinisterCoverExitsAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerOngoingPowerModifiers([
        { defId: 'kree_righteous_fury', location: 'minion', target: 'self', delta: 3 },
        { defId: 'masters_of_evil_ball_and_chain', location: 'minion', target: 'self', delta: 2 },
        { defId: 'sinister_six_cover_the_exits', location: 'base', target: 'ownerMinions', delta: 1 },
        { defId: 'sinister_six_incite_panic', location: 'base', target: 'opponentMinions', delta: -1 },
    ]);

    registerCustomPowerModifiers([
        {
            sourceDefId: 'hydra_arnim_zola',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'hydra_arnim_zola')) return 0;
                return ctx.base.minions.filter(minion =>
                    minion.uid !== ctx.minion.uid
                    && minion.controller === ctx.minion.controller
                    && printedPower(minion.defId) <= 2
                ).length;
            },
        },
        {
            sourceDefId: 'hydra_fanatical_devotion',
            runtimeIdentity: 'actionFamily',
            compute: (ctx, helpers) => (
                helpers.countBaseOngoingsMatchingRuntimeDefId(ctx, 'hydra_fanatical_devotion', {
                    relationToTargetController: 'same',
                }) > 0
                && (ctx.state.turnDestroyedMinions ?? []).some(record =>
                    record.baseIndex === ctx.baseIndex
                    && (record.controller ?? record.owner) === ctx.minion.controller
                )
                    ? 2
                    : 0
            ),
        },
        {
            sourceDefId: 'kree_kree_sentry',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'kree_kree_sentry')) return 0;
                const player = ctx.state.players[ctx.minion.controller];
                const actionCardCount = player?.actionCardsPlayedThisTurn ?? 0;
                return actionCardCount >= 2 ? 2 : 0;
            },
        },
        {
            sourceDefId: 'masters_of_evil_black_mamba',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'masters_of_evil_black_mamba')) return 0;
                return Math.floor((ctx.state.players[ctx.minion.controller]?.vp ?? 0) / 4);
            },
        },
        {
            sourceDefId: 'sinister_six_sandman',
            compute: (ctx, helpers) => {
                if (!helpers.matchesRuntimeDefId(ctx.minion.defId, 'sinister_six_sandman')) return 0;
                return breakpointAtOrBelow(ctx.state, ctx.baseIndex, 19) ? 2 : 0;
            },
        },
    ]);

    registerBreakpointModifiers([
        {
            sourceDefId: 'sinister_six_electro',
            variantPolicy: 'baseOnly',
            modifier: ctx => -2 * ctx.base.minions.filter(minion => minion.defId === 'sinister_six_electro').length,
        },
    ]);

    registerProtection('masters_of_evil_ball_and_chain', 'destroy', ctx => (
        ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.targetMinion.attachedActions.some(action => action.defId === 'masters_of_evil_ball_and_chain')
    ));
    registerProtection('masters_of_evil_indestructible_form', 'destroy', ctx => (
        ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.state.bases[ctx.targetBaseIndex]?.ongoingActions.some(action =>
            action.defId === 'masters_of_evil_indestructible_form'
            && getActionControllerId(action) === ctx.targetMinion.controller
        ) === true
    ));
    registerRestriction('sinister_six_incite_panic', 'play_action', sinisterIncitePanicRestriction);

    const witnessChecker = (state: SmashUpCore, baseIndex: number) => (
        state.bases[baseIndex]?.ongoingActions.some(action => action.defId === 'sinister_six_witness_our_superiority') ?? false
    );
    registerBaseAbilitySuppression('sinister_six_witness_our_superiority', witnessChecker);
}
