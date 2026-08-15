import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import {
    addTempPower,
    addPermanentPower,
    buildActionMinionTargetOptions,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildValidatedReturnEvents,
    buildAbilityFeedback,
    canControllerPlayTitan,
    createSkipOption,
    findMinionOnBases,
    getAvailableSpiritOfTheForestOrTitan,
    getTitanByController,
    markSpiritOfTheForestOrUsed,
    playTitan,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent, buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { registerProtection, registerRestriction } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext } from '../domain/ongoingEffects';
import {
    queueBranchingChoice,
    type BranchExecutor,
    type BranchingChoiceOption,
    type BranchingChoiceUpgrade,
} from '../domain/branchingChoice';
import {
    createEffectDslProgram,
    createFootprint,
    discardRandomCardsPrimitive,
    drawCardsPrimitive,
    grantExtraActionPrimitive,
    grantExtraMinionPrimitive,
    sequencePrimitives,
} from '../domain/effectDsl';
import { SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    OngoingAttachedEvent,
    SmashUpReactionResourceFootprint,
    SmashUpReactionResourceRef,
} from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    choice?: 'return_minion' | 'target_other';
};

type ButtonChoice = {
    choice?:
        | 'extra_minion'
        | 'extra_action'
        | 'draw_card'
        | 'draw_two'
        | 'draw_one_and_action'
        | 'discard_others'
        | 'destroy_actions'
        | 'play_spirit'
        | 'self_bonus'
        | 'plus'
        | 'minus';
    skip?: boolean;
};

type AttachedActionSnapshot = {
    metadata?: Record<string, unknown>;
    talentUsed?: boolean;
};

type AttachedActionState = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
    minionUid: string;
    snapshot?: AttachedActionSnapshot;
};

type FairiesEnchantmentContinuation = {
    baseIndex: number;
    attachedCardUid?: string;
    selectedBranchIds?: Array<'plus' | 'minus'>;
    allowBoth?: boolean;
};

type FairiesPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type FairiesBranchEffectContext = FairiesPromptContext & {
    random: RandomFn;
};

type FairiesMinionTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type FairiesTransferPromptContext = FairiesPromptContext & {
    attachedCardUid: string;
    targets: FairiesMinionTarget[];
};

type FairiesTitaniaReturnPromptContext = FairiesPromptContext;
type FairiesTitaniaPodReturnPromptContext = FairiesPromptContext;

type FairiesGlymmerPromptContext = FairiesPromptContext & {
    sourceCardUid: string;
    sourceBaseIndex: number;
};

type FairiesTinxPromptContext = FairiesPromptContext & {
    targetBaseIndex: number;
    targetMinionUid: string;
    options: Array<{ cardUid: string; defId: string; label: string }>;
};

type FairiesPlayfulTricksDestroyPromptContext = FairiesPromptContext & {
    options: Array<{ cardUid: string; defId: string; ownerId: PlayerId; label: string }>;
};

type FairiesPlayfulTricksSpiritBasePromptContext = FairiesPromptContext & {
    titanUid: string;
};

function findAttachedActionState(
    state: SmashUpCore,
    cardUid: string,
): AttachedActionState | undefined {
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            const attached = minion.attachedActions.find(action => action.uid === cardUid) as
                | (typeof minion.attachedActions[number] & { metadata?: Record<string, unknown> })
                | undefined;
            if (!attached) continue;
            return {
                cardUid: attached.uid,
                defId: attached.defId,
                ownerId: attached.ownerId,
                baseIndex,
                minionUid: minion.uid,
                snapshot: {
                    ...(attached.metadata ? { metadata: attached.metadata } : {}),
                    ...(attached.talentUsed !== undefined ? { talentUsed: attached.talentUsed } : {}),
                },
            };
        }
    }
    return undefined;
}

function buildTransferAttachedActionEvents(
    state: SmashUpCore,
    attached: AttachedActionState,
    sourcePlayerId: PlayerId,
    targetBaseIndex: number,
    targetMinionUid: string,
    reason: string,
    timestamp: number,
): SmashUpEvent[] {
    return [
        buildOngoingDetachedEvent({
            cardUid: attached.cardUid,
            defId: attached.defId,
            ownerId: attached.ownerId,
            reason,
            now: timestamp,
        }),
        ...buildSemanticOngoingAttachEvents(state, {
            cardUid: attached.cardUid,
            defId: attached.defId,
            ownerId: attached.ownerId,
            ...(attached.ownerId !== sourcePlayerId ? { sourcePlayerId } : {}),
            targetBaseIndex,
            targetMinionUid,
            ...(attached.snapshot?.metadata ? { metadata: attached.snapshot.metadata } : {}),
            ...(attached.snapshot?.talentUsed !== undefined ? { talentUsed: attached.snapshot.talentUsed } : {}),
            now: timestamp,
        }),
    ];
}

function buildOtherMinionTargets(
    state: SmashUpCore,
    excluded: { baseIndex: number; minionUid: string },
): FairiesMinionTarget[] {
    const candidates: FairiesMinionTarget[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        const base = state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (baseIndex === excluded.baseIndex && minion.uid === excluded.minionUid) continue;
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }
    return candidates;
}

function buildGlymmerTargetOptions(state: SmashUpCore, sourceCardUid: string, sourcePlayerId: PlayerId) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        const base = state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (minion.uid === sourceCardUid) continue;
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }

    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId,
        effectType: 'affect',
    }).map(option => ({
        ...option,
        value: {
            choice: 'target_other' as const,
            ...option.value,
        },
        displayMode: 'card' as const,
    }));
}

function buildTitaniaReturnOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (minion: MinionOnBase) => boolean = () => true,
) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        const base = state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (!predicate(minion)) continue;
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        effectType: 'affect',
    });
}

function buildFairiesEnchantmentPromptOptions(
    selectedBranchIds: Array<'plus' | 'minus'>,
    includeSkip: boolean,
) {
    const options = (['plus', 'minus'] as const)
        .filter(branchId => !selectedBranchIds.includes(branchId))
        .map(branchId => ({
            id: branchId,
            label: branchId === 'plus' ? '所有随从 +1 力量' : '所有随从 -1 力量',
            labelKey: branchId === 'plus'
                ? 'ui.fairies_enchantment_plus_option'
                : 'ui.fairies_enchantment_minus_option',
            value: { branchId },
            displayMode: 'button' as const,
        }));
    return includeSkip ? [...options, createSkipOption()] : options;
}

function buildPlayfulTricksActionOptions(state: SmashUpCore) {
    const options = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        const base = state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const ongoing of base.ongoingActions) {
            const actionName = getCardDef(ongoing.defId)?.name ?? ongoing.defId;
            options.push({
                id: `base-${ongoing.uid}`,
                label: `${actionName} @ ${baseName}`,
                value: { cardUid: ongoing.uid, defId: ongoing.defId, ownerId: ongoing.ownerId },
                _source: 'field' as const,
                displayMode: 'card' as const,
            });
        }
        for (const minion of base.minions) {
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            for (const attached of minion.attachedActions) {
                const actionName = getCardDef(attached.defId)?.name ?? attached.defId;
                options.push({
                    id: `minion-${attached.uid}`,
                    label: `${actionName} @ ${minionName} @ ${baseName}`,
                    value: { cardUid: attached.uid, defId: attached.defId, ownerId: attached.ownerId },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                });
            }
        }
    }
    return options;
}

function getControlledSetAsideSpiritOfTheForest(state: SmashUpCore, playerId: PlayerId) {
    return (state.titans ?? []).find((titan) =>
        titan.defId === 'fairies_spirit_of_the_forest'
        && titan.controllerId === playerId
        && titan.location.zone === 'setaside',
    );
}

function getSpiritOptionalBothUpgrade(
    state: SmashUpCore,
    playerId: PlayerId,
    now: number,
): BranchingChoiceUpgrade | undefined {
    const spirit = getAvailableSpiritOfTheForestOrTitan(state, playerId);
    if (!spirit) return undefined;
    return {
        mode: 'optional-both',
        consumeEvents: [markSpiritOfTheForestOrUsed(spirit.uid, state.turnNumber, now)],
    };
}

function createButtonBranchOption(
    id: string,
    label: string,
    branchId: string,
    footprint?: SmashUpReactionResourceFootprint,
): BranchingChoiceOption {
    return {
        id,
        label,
        branchId,
        displayMode: 'button',
        ...(footprint ? { footprint } : {}),
    };
}

const fairiesTitaniaExtraMinionPrimitive = grantExtraMinionPrimitive<FairiesPromptContext>({
    playerId: (context) => context.playerId,
    reason: 'fairies_titania',
    now: (context) => context.now,
    matchState: (context) => context.matchState,
});

const fairiesTitaniaExtraMinionProgram = createEffectDslProgram(fairiesTitaniaExtraMinionPrimitive);

const fairiesPuckExtraActionPrimitive = grantExtraActionPrimitive<FairiesBranchEffectContext>({
    playerId: (context) => context.playerId,
    reason: 'fairies_puck',
    now: (context) => context.now,
    matchState: (context) => context.matchState,
});

const fairiesPuckDrawCardPrimitive = drawCardsPrimitive<FairiesBranchEffectContext>({
    playerId: (context) => context.playerId,
    count: 1,
    now: (context) => context.now,
    random: (context) => context.random,
    core: (context) => context.matchState.core,
});

const fairiesPuckExtraActionProgram = createEffectDslProgram(fairiesPuckExtraActionPrimitive);
const fairiesPuckDrawCardProgram = createEffectDslProgram(fairiesPuckDrawCardPrimitive);

const fairiesMagicAcornsDiscardOthersPrimitive = discardRandomCardsPrimitive<FairiesBranchEffectContext>({
    playerIds: (context) => Object.keys(context.matchState.core.players).filter(playerId => playerId !== context.playerId),
    count: 1,
    now: (context) => context.now,
    random: (context) => context.random,
    core: (context) => context.matchState.core,
});

const fairiesMagicAcornsDrawOneAndActionPrimitive = sequencePrimitives(
    drawCardsPrimitive<FairiesBranchEffectContext>({
        playerId: (context) => context.playerId,
        count: 1,
        now: (context) => context.now,
        random: (context) => context.random,
        core: (context) => context.matchState.core,
    }),
    grantExtraActionPrimitive<FairiesBranchEffectContext>({
        playerId: (context) => context.playerId,
        reason: 'fairies_magic_acorns',
        now: (context) => context.now,
        matchState: (context) => context.matchState,
    }),
);

const fairiesMagicAcornsDiscardOthersProgram = createEffectDslProgram(fairiesMagicAcornsDiscardOthersPrimitive);
const fairiesMagicAcornsDrawOneAndActionProgram = createEffectDslProgram(fairiesMagicAcornsDrawOneAndActionPrimitive);

const fairiesFairyBalletDrawTwoPrimitive = drawCardsPrimitive<FairiesBranchEffectContext>({
    playerId: (context) => context.playerId,
    count: 2,
    now: (context) => context.now,
    random: (context) => context.random,
    core: (context) => context.matchState.core,
});

const fairiesFairyBalletDrawOneAndActionPrimitive = sequencePrimitives(
    drawCardsPrimitive<FairiesBranchEffectContext>({
        playerId: (context) => context.playerId,
        count: 1,
        now: (context) => context.now,
        random: (context) => context.random,
        core: (context) => context.matchState.core,
    }),
    grantExtraActionPrimitive<FairiesBranchEffectContext>({
        playerId: (context) => context.playerId,
        reason: 'fairies_fairy_ballet',
        now: (context) => context.now,
        matchState: (context) => context.matchState,
    }),
);

const fairiesFairyBalletDrawTwoProgram = createEffectDslProgram(fairiesFairyBalletDrawTwoPrimitive);
const fairiesFairyBalletDrawOneAndActionProgram = createEffectDslProgram(fairiesFairyBalletDrawOneAndActionPrimitive);

function createFairiesBranchEffectContext(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    random: RandomFn,
    timestamp: number,
): FairiesBranchEffectContext {
    return { matchState: state, playerId, random, now: timestamp };
}

function createTitaniaReturnBranchFootprint(
    state: SmashUpCore,
    playerId: PlayerId,
    predicate: (minion: MinionOnBase) => boolean = () => true,
) {
    const options = buildTitaniaReturnOptions(state, playerId, predicate);
    const reads: SmashUpReactionResourceRef[] = [];
    const writes: SmashUpReactionResourceRef[] = [{ kind: 'targetAvailability' }];

    for (const option of options) {
        const { minionUid, baseIndex } = option.value;
        if (!minionUid || baseIndex === undefined) continue;
        reads.push({ kind: 'minion', uid: minionUid }, { kind: 'base', index: baseIndex });
        writes.push({ kind: 'minion', uid: minionUid }, { kind: 'base', index: baseIndex });

        const owner = state.bases[baseIndex]?.minions.find(minion => minion.uid === minionUid)?.owner;
        if (owner) writes.push({ kind: 'playerHand', playerId: owner });
    }

    return createFootprint({ reads, writes, opensInteraction: true });
}

function runtimeResultToAbilityResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
): AbilityResult {
    return {
        events: result.events,
        matchState: result.matchState ?? fallbackState,
    };
}

function runtimeResultToBranchResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
) {
    return {
        state: result.matchState ?? fallbackState,
        events: result.events,
    };
}

function createTransferSelfAbilityProgram(
    sourceId: 'fairies_ladybug' | 'fairies_leaf_armor',
    title: string,
    titleKey: string,
    reason: 'fairies_ladybug' | 'fairies_leaf_armor',
) {
    const promptProgram = createPromptProgram<FairiesTransferPromptContext, SmashUpCore, SmashUpEvent>({
        sourceId,
        buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
            `${sourceId}_${context.now}`,
            context.playerId,
            title,
            buildActionMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId,
                titleKey,
                targetType: 'minion',
                autoResolveIfSingle: false,
            },
        ),
        onResolve: ({ context, state, value, timestamp }) => {
            const selected = value as MinionChoice;
            if (!selected.minionUid || selected.baseIndex === undefined) {
                return { events: [] };
            }
            const liveAttached = findAttachedActionState(state.core, context.attachedCardUid);
            if (!liveAttached) return { events: [] };
            if (selected.baseIndex === liveAttached.baseIndex && selected.minionUid === liveAttached.minionUid) {
                return { events: [] };
            }
            return {
                events: buildTransferAttachedActionEvents(
                    state.core,
                    liveAttached,
                    context.playerId,
                    selected.baseIndex,
                    selected.minionUid,
                    reason,
                    timestamp,
                ),
            };
        },
    });

    return createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
        const attached = findAttachedActionState(ctx.state, ctx.cardUid);
        if (!attached) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }

        const targets = buildOtherMinionTargets(ctx.state, {
            baseIndex: attached.baseIndex,
            minionUid: attached.minionUid,
        });
        if (targets.length === 0) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }

        return {
            events: [],
            context: {
                matchState: ctx.matchState,
                playerId: ctx.playerId,
                now: ctx.now,
                attachedCardUid: ctx.cardUid,
                targets,
            } satisfies FairiesTransferPromptContext,
            nextProgram: promptProgram,
        };
    });
}

const fairiesTitaniaReturnPromptProgram = createPromptProgram<FairiesTitaniaReturnPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_titania_return_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_titania_return_minion_${context.now}`,
        context.playerId,
        'Titania：选择一个要移回其拥有者手牌的随从',
        buildTitaniaReturnOptions(context.matchState.core, context.playerId),
        {
            sourceId: 'fairies_titania_return_minion',
            titleKey: 'ui.fairies_titania_return_title',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const isStillValidTarget = buildTitaniaReturnOptions(state.core, playerId).some(
            option => option.value.minionUid === selected.minionUid && option.value.baseIndex === selected.baseIndex,
        );
        if (!isStillValidTarget) return { events: [] };
        return {
            events: buildValidatedReturnEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                reason: 'fairies_titania',
                now: timestamp,
                sourcePlayerId: playerId,
            }),
        };
    },
});

const fairiesTitaniaPodReturnPromptProgram = createPromptProgram<FairiesTitaniaPodReturnPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_titania_pod_return_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_titania_pod_return_minion_${context.now}`,
        context.playerId,
        'Titania：选择一个对手随从移回其拥有者手牌',
        buildTitaniaReturnOptions(
            context.matchState.core,
            context.playerId,
            minion => minion.controller !== context.playerId,
        ),
        {
            sourceId: 'fairies_titania_pod_return_minion',
            titleKey: 'ui.fairies_titania_pod_return_title',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const isStillValidTarget = buildTitaniaReturnOptions(
            state.core,
            playerId,
            minion => minion.controller !== playerId,
        ).some(
            option => option.value.minionUid === selected.minionUid && option.value.baseIndex === selected.baseIndex,
        );
        if (!isStillValidTarget) return { events: [] };
        return {
            events: buildValidatedReturnEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                reason: 'fairies_titania_pod',
                now: timestamp,
                sourcePlayerId: playerId,
            }),
        };
    },
});

const fairiesGlymmerTargetPromptProgram = createPromptProgram<FairiesGlymmerPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_glymmer_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_glymmer_target_${context.now}`,
        context.playerId,
        'Glymmer：选择另一个随从直到你的下回合开始时 -4 力量',
        buildGlymmerTargetOptions(context.matchState.core, context.sourceCardUid, context.playerId),
        {
            sourceId: 'fairies_glymmer_target',
            titleKey: 'ui.fairies_glymmer_target_title',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        const isStillValidTarget = buildGlymmerTargetOptions(state.core, context.sourceCardUid, playerId).some(
            option => option.value.minionUid === selected.minionUid && option.value.baseIndex === selected.baseIndex,
        );
        if (!isStillValidTarget) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: [addPermanentPower(target.uid, selected.baseIndex, -4, 'fairies_glymmer', timestamp, {
                expiresOnTurnNumber: state.core.turnNumber + state.core.turnOrder.length,
            })],
        };
    },
});

const fairiesGlymmerPromptProgram = createPromptProgram<FairiesGlymmerPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_glymmer',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_glymmer_${context.now}`,
        context.playerId,
        'Glymmer：选择另一个随从直到你的下回合开始时 -4 力量，或让本随从直到你的下回合开始时 +1 力量',
        [
            {
                id: 'self',
                label: '本随从直到你的下回合开始时 +1 力量',
                labelKey: 'ui.fairies_glymmer_self_bonus_option',
                value: { choice: 'self_bonus' },
                displayMode: 'button' as const,
            },
            ...(buildGlymmerTargetOptions(context.matchState.core, context.sourceCardUid, context.playerId).length > 0
                ? [{
                    id: 'target-other',
                    label: '选择另一个随从直到你的下回合开始时 -4 力量',
                    labelKey: 'ui.fairies_glymmer_target_other_option',
                    value: { choice: 'target_other' },
                    displayMode: 'button' as const,
                }]
                : []),
        ],
        {
            sourceId: 'fairies_glymmer',
            titleKey: 'ui.fairies_glymmer_title',
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp, playerId }) => {
        const selected = value as ButtonChoice;
        const glymmer = state.core.bases[context.sourceBaseIndex]?.minions.find(
            minion => minion.uid === context.sourceCardUid,
        );
        if (!glymmer) return { events: [] };

        if (selected.choice === 'self_bonus') {
            return {
                events: [addPermanentPower(glymmer.uid, context.sourceBaseIndex, 1, 'fairies_glymmer', timestamp, {
                    expiresOnTurnNumber: state.core.turnNumber + state.core.turnOrder.length,
                })],
            };
        }

        if (selected.choice !== 'target_other') return { events: [] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                sourceCardUid: context.sourceCardUid,
                sourceBaseIndex: context.sourceBaseIndex,
            } satisfies FairiesGlymmerPromptContext,
            nextProgram: fairiesGlymmerTargetPromptProgram,
        };
    },
});

const fairiesTinxPromptProgram = createPromptProgram<FairiesTinxPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_tinx',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_tinx_${context.now}`,
        context.playerId,
        'Tinx：你可以将另一个随从上的一张行动卡移到这张牌上',
        [
            createSkipOption(),
            ...context.options.map((option, index) => ({
                id: `attached-${index}`,
                label: option.label,
                value: { cardUid: option.cardUid, defId: option.defId },
                _source: 'field' as const,
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'fairies_tinx',
            titleKey: 'ui.fairies_tinx_title',
            targetType: 'ongoing',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { skip?: boolean; cardUid?: string };
        if (selected.skip || !selected.cardUid) return { events: [] };
        const attached = findAttachedActionState(state.core, selected.cardUid);
        if (!attached || (attached.baseIndex === context.targetBaseIndex && attached.minionUid === context.targetMinionUid)) {
            return { events: [] };
        }
        return {
            events: buildTransferAttachedActionEvents(
                state.core,
                attached,
                context.playerId,
                context.targetBaseIndex,
                context.targetMinionUid,
                'fairies_tinx',
                timestamp,
            ),
        };
    },
});

const fairiesEnchantmentPromptProgram = createPromptProgram<FairiesEnchantmentContinuation & FairiesPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_enchantment',
    buildInteraction: (context) => {
        const selectedBranchIds = context.selectedBranchIds ?? [];
        const includeSkip = selectedBranchIds.length > 0;
        return createAbilityRuntimeSimpleChoice(
            `fairies_enchantment_${context.now}`,
            context.playerId,
            includeSkip
                ? '结果：你可以继续执行剩余效果，或跳过'
                : '结果：选择让此基地所有随从 +1 力量，或所有随从 -1 力量',
            buildFairiesEnchantmentPromptOptions(selectedBranchIds, includeSkip),
            {
                sourceId: 'fairies_enchantment',
                targetType: 'button',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        if (context.baseIndex === undefined) return { events: [] };
        const selectedValue = value as { branchId?: string; skip?: boolean };
        const previousBranchIds = context.selectedBranchIds ?? [];
        const attached = state.core.bases[context.baseIndex]?.ongoingActions.find(action =>
            action.uid === context.attachedCardUid
            && (action.defId === 'fairies_enchantment' || action.defId === 'fairies_enchantment_pod'),
        );
        if (!attached) return { events: [] };
        const sourcePlayerId = (attached.metadata?.sourcePlayerId as PlayerId | undefined)
            ?? (attached.metadata?.sourceControllerId as PlayerId | undefined);

        if (
            (selectedValue.branchId === 'plus' || selectedValue.branchId === 'minus')
            && context.allowBoth
            && previousBranchIds.length === 0
        ) {
            const immediateMode = selectedValue.branchId;
            const immediateEvents = [{
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: attached.uid,
                    defId: attached.defId,
                    ownerId: attached.ownerId,
                    ...(sourcePlayerId && sourcePlayerId !== attached.ownerId ? { sourcePlayerId } : {}),
                    targetType: 'base',
                    targetBaseIndex: context.baseIndex,
                    metadata: { fairiesEnchantmentMode: immediateMode },
                    talentUsed: attached.talentUsed,
                },
                timestamp,
            } as OngoingAttachedEvent];
            return {
                events: immediateEvents,
                context: {
                    ...context,
                    matchState: state,
                    playerId,
                    now: timestamp,
                    selectedBranchIds: [selectedValue.branchId],
                },
                nextProgram: fairiesEnchantmentPromptProgram,
            };
        }

        const branchIds = selectedValue.branchId === 'plus' || selectedValue.branchId === 'minus'
            ? [...previousBranchIds, selectedValue.branchId]
            : previousBranchIds;
        if (branchIds.length === 0) return { events: [] };
        const spirit = branchIds.length > 1 ? getAvailableSpiritOfTheForestOrTitan(state.core, playerId) : undefined;
        const fairiesEnchantmentMode = branchIds.includes('plus') && branchIds.includes('minus')
            ? 'both'
            : branchIds[0];
        if (fairiesEnchantmentMode !== 'plus' && fairiesEnchantmentMode !== 'minus' && fairiesEnchantmentMode !== 'both') {
            return { events: [] };
        }

        return {
            events: [
                {
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: {
                        cardUid: attached.uid,
                        defId: attached.defId,
                        ownerId: attached.ownerId,
                        ...(sourcePlayerId && sourcePlayerId !== attached.ownerId ? { sourcePlayerId } : {}),
                        targetType: 'base',
                        targetBaseIndex: context.baseIndex,
                        metadata: { fairiesEnchantmentMode },
                        talentUsed: attached.talentUsed,
                    },
                    timestamp,
                } as OngoingAttachedEvent,
                ...(spirit ? [markSpiritOfTheForestOrUsed(spirit.uid, state.core.turnNumber, timestamp)] : []),
            ],
        };
    },
});

const fairiesPlayfulTricksDestroyPromptProgram = createPromptProgram<FairiesPlayfulTricksDestroyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_playful_tricks_destroy',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_playful_tricks_destroy_${context.now}`,
        context.playerId,
        '有趣的把戏：选择至多两张打在基地或随从上的行动卡并摧毁它们',
        context.options.map((option, index) => ({
            id: `destroy-${index}`,
            label: option.label,
            value: { cardUid: option.cardUid, defId: option.defId, ownerId: option.ownerId },
            _source: 'field' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'fairies_playful_tricks_destroy',
            titleKey: 'ui.fairies_playful_tricks_destroy_title',
            targetType: 'ongoing',
            multi: { min: 0, max: Math.min(2, context.options.length) },
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, value, timestamp }) => {
        const rawSelections = Array.isArray(value)
            ? value as Array<{ cardUid?: string; defId?: string; ownerId?: string }>
            : [];
        const unique = new Map<string, { cardUid: string; defId: string; ownerId: string }>();
        for (const selection of rawSelections) {
            if (!selection.cardUid || !selection.defId || !selection.ownerId) continue;
            unique.set(selection.cardUid, {
                cardUid: selection.cardUid,
                defId: selection.defId,
                ownerId: selection.ownerId,
            });
        }

        return {
            events: Array.from(unique.values()).flatMap(selection => buildValidatedOngoingDetachEvents(state, {
                cardUid: selection.cardUid,
                defId: selection.defId,
                ownerId: selection.ownerId,
                reason: 'fairies_playful_tricks',
                now: timestamp,
            })),
        };
    },
});

const fairiesPlayfulTricksSpiritBasePromptProgram = createPromptProgram<FairiesPlayfulTricksSpiritBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'fairies_playful_tricks_spirit_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `fairies_playful_tricks_spirit_base_${context.now}`,
        context.playerId,
        '有趣的把戏：选择一个基地来打出丛林之灵',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            })),
            context.matchState.core,
        ),
        {
            sourceId: 'fairies_playful_tricks_spirit_base',
            titleKey: 'ui.fairies_playful_tricks_spirit_base_title',
            targetType: 'base',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as { baseIndex?: number; baseDefId?: string };
        if (selected.baseIndex === undefined || getTitanByController(state.core, playerId)) {
            return { events: [] };
        }
        const titan = state.core.titans?.find((candidate) =>
            candidate.uid === context.titanUid
            && candidate.controllerId === playerId
            && candidate.location.zone === 'setaside',
        );
        if (!titan || !canControllerPlayTitan(state.core, playerId, titan.uid)) return { events: [] };
        return {
            events: [
                playTitan(
                    titan,
                    playerId,
                    selected.baseIndex,
                    'fairies_playful_tricks_spirit',
                    timestamp,
                    selected.baseDefId,
                ),
            ],
        };
    },
});

export function registerFairiesAbilities(): void {
    registerSimpleAbility('fairies_titania', 'onPlay', fairiesTitania);
    registerSimpleAbility('fairies_titania_pod', 'onPlay', fairiesTitaniaPod);
    registerAbilityProgram('fairies_glymmer', 'talent', { program: fairiesGlymmerProgram });
    registerAbilityProgram('fairies_glymmer_pod', 'talent', { program: fairiesGlymmerProgram });
    registerSimpleAbility('fairies_puck', 'onPlay', fairiesPuck);
    registerAbilityProgram('fairies_tinx', 'onPlay', { program: fairiesTinxProgram });
    registerAbilityProgram('fairies_ladybug', 'talent', { program: fairiesLadybugProgram });
    registerAbilityProgram('fairies_leaf_armor', 'talent', { program: fairiesLeafArmorProgram });
    registerAbilityProgram('fairies_leaf_armor_pod', 'talent', { program: fairiesLeafArmorPodProgram });
    registerSimpleAbility('fairies_magic_acorns', 'onPlay', fairiesMagicAcorns);
    registerSimpleAbility('fairies_playful_tricks', 'onPlay', fairiesPlayfulTricks);
    registerAbilityProgram('fairies_enchantment', 'onPlay', { program: fairiesEnchantmentProgram });
    registerSimpleAbility('fairies_fairy_ballet', 'onPlay', fairiesFairyBallet);

    registerProtection('fairies_ladybug', 'destroy', fairiesLadybugProtectionChecker);
    registerRestriction('fairies_magic_ward', 'play_action', fairiesMagicWardRestrictionChecker);
}

function fairiesTitania(ctx: AbilityContext): AbilityResult {
    const promptContext: FairiesPromptContext = {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    };
    const options: BranchingChoiceOption[] = [
        createButtonBranchOption(
            'extra-minion',
            '额外打出一个随从',
            'extra_minion',
            fairiesTitaniaExtraMinionPrimitive.footprint(promptContext),
        ),
        createButtonBranchOption(
            'return-minion',
            '将一个随从移回其拥有者手牌',
            'return_minion',
            createTitaniaReturnBranchFootprint(ctx.state, ctx.playerId),
        ),
    ];

    return {
        events: [],
        matchState: queueBranchingChoice({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'fairies_titania',
            title: 'Titania：将一个随从移回其拥有者手牌，或额外打出一个随从',
            executeBranch: runFairiesTitaniaBranch,
            targetType: 'generic',
            upgrade: getSpiritOptionalBothUpgrade(ctx.state, ctx.playerId, ctx.now),
            options,
        }),
    };
}

function fairiesTitaniaPod(ctx: AbilityContext): AbilityResult {
    const promptContext: FairiesPromptContext = {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    };
    const options: BranchingChoiceOption[] = [
        createButtonBranchOption(
            'extra-minion',
            '额外打出一个随从',
            'extra_minion',
            fairiesTitaniaExtraMinionPrimitive.footprint(promptContext),
        ),
        createButtonBranchOption(
            'return-minion',
            '将一个对手随从移回其拥有者手牌',
            'return_minion_pod',
            createTitaniaReturnBranchFootprint(
                ctx.state,
                ctx.playerId,
                minion => minion.controller !== ctx.playerId,
            ),
        ),
    ];

    return {
        events: [],
        matchState: queueBranchingChoice({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'fairies_titania_pod',
            title: 'Titania：将一个对手随从移回其拥有者手牌，或额外打出一个随从',
            executeBranch: runFairiesTitaniaBranch,
            targetType: 'generic',
            upgrade: getSpiritOptionalBothUpgrade(ctx.state, ctx.playerId, ctx.now),
            options,
        }),
    };
}

const fairiesGlymmerProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const current = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!current) return { events: [] };
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: current.baseIndex,
        } satisfies FairiesGlymmerPromptContext,
        nextProgram: fairiesGlymmerPromptProgram,
    };
});

function fairiesPuck(ctx: AbilityContext): AbilityResult {
    const branchContext = createFairiesBranchEffectContext(ctx.matchState, ctx.playerId, ctx.random, ctx.now);
    return {
        events: [],
        matchState: queueBranchingChoice({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'fairies_puck',
            title: 'Puck：额外打出一张行动卡，或抽一张牌',
            executeBranch: runFairiesPuckBranch,
            targetType: 'button',
            upgrade: getSpiritOptionalBothUpgrade(ctx.state, ctx.playerId, ctx.now),
            options: [
                createButtonBranchOption(
                    'extra-action',
                    '额外打出一张行动卡',
                    'extra_action',
                    fairiesPuckExtraActionPrimitive.footprint(branchContext),
                ),
                createButtonBranchOption(
                    'draw-card',
                    '抽一张牌',
                    'draw_card',
                    fairiesPuckDrawCardPrimitive.footprint(branchContext),
                ),
            ],
        }),
    };
}

const fairiesTinxProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const current = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!current) return { events: [] };

    const options: FairiesTinxPromptContext['options'] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex++) {
        const base = ctx.state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (minion.uid === ctx.cardUid) continue;
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            for (const attached of minion.attachedActions) {
                const actionName = getCardDef(attached.defId)?.name ?? attached.defId;
                options.push({
                    cardUid: attached.uid,
                    defId: attached.defId,
                    label: `${actionName} @ ${minionName} @ ${baseName}`,
                });
            }
        }
    }

    if (options.length === 0) return { events: [] };
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            targetBaseIndex: current.baseIndex,
            targetMinionUid: ctx.cardUid,
            options,
        } satisfies FairiesTinxPromptContext,
        nextProgram: fairiesTinxPromptProgram,
    };
});

const fairiesLadybugProgram = createTransferSelfAbilityProgram(
    'fairies_ladybug',
    'Ladybug：选择另一个随从来转移这张牌',
    'ui.fairies_ladybug_title',
    'fairies_ladybug',
);

const fairiesLeafArmorProgram = createTransferSelfAbilityProgram(
    'fairies_leaf_armor',
    '叶之甲：选择另一个随从来转移这张牌',
    'ui.fairies_leaf_armor_title',
    'fairies_leaf_armor',
);

const fairiesLeafArmorPodProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const attached = findAttachedActionState(ctx.state, ctx.cardUid);
    if (!attached) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [addTempPower(attached.minionUid, attached.baseIndex, 2, 'fairies_leaf_armor_pod', ctx.now)],
    };
});

function fairiesMagicAcorns(ctx: AbilityContext): AbilityResult {
    const branchContext = createFairiesBranchEffectContext(ctx.matchState, ctx.playerId, ctx.random, ctx.now);
    return {
        events: [],
        matchState: queueBranchingChoice({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'fairies_magic_acorns',
            title: '魔法橡子：选择让每位其他玩家随机弃一张牌，或抽一张牌并额外打出一张行动卡',
            executeBranch: runFairiesMagicAcornsBranch,
            targetType: 'button',
            upgrade: getSpiritOptionalBothUpgrade(ctx.state, ctx.playerId, ctx.now),
            options: [
                createButtonBranchOption(
                    'discard-others',
                    '每位其他玩家随机弃一张牌',
                    'discard_others',
                    fairiesMagicAcornsDiscardOthersPrimitive.footprint(branchContext),
                ),
                createButtonBranchOption(
                    'draw-and-action',
                    '抽一张牌并额外打出一张行动卡',
                    'draw_one_and_action',
                    fairiesMagicAcornsDrawOneAndActionPrimitive.footprint(branchContext),
                ),
            ],
        }),
    };
}

function fairiesPlayfulTricks(ctx: AbilityContext): AbilityResult {
    const actionOptions = buildPlayfulTricksActionOptions(ctx.state);
    const setAsideSpirit = getControlledSetAsideSpiritOfTheForest(ctx.state, ctx.playerId);
    const canPlaySpirit = !!setAsideSpirit && !getTitanByController(ctx.state, ctx.playerId);

    if (!canPlaySpirit) {
        if (actionOptions.length === 0) return { events: [] };
        return runtimeResultToAbilityResult(executeAbilityProgram(
            fairiesPlayfulTricksDestroyPromptProgram,
            {
                matchState: ctx.matchState,
                playerId: ctx.playerId,
                now: ctx.now,
                options: actionOptions.map(option => ({
                    cardUid: option.value.cardUid,
                    defId: option.value.defId,
                    ownerId: option.value.ownerId,
                    label: option.label,
                })),
            } satisfies FairiesPlayfulTricksDestroyPromptContext,
        ), ctx.matchState);
    }

    return {
        events: [],
        matchState: queueBranchingChoice({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'fairies_playful_tricks',
            title: '有趣的把戏：选择消灭至多两张行动卡，或打出丛林之灵',
            executeBranch: runFairiesPlayfulTricksBranch,
            targetType: 'button',
            planContext: {
                titanUid: setAsideSpirit?.uid,
            },
            options: [
                ...(actionOptions.length > 0 ? [createButtonBranchOption('destroy-actions', '消灭至多两张行动卡', 'destroy_actions')] : []),
                createButtonBranchOption('play-spirit', '打出丛林之灵', 'play_spirit'),
            ],
        }),
    };
}

const fairiesEnchantmentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const upgrade = getSpiritOptionalBothUpgrade(ctx.state, ctx.playerId, ctx.now);
    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            baseIndex: ctx.baseIndex,
            attachedCardUid: ctx.cardUid,
            allowBoth: !!upgrade,
        } satisfies FairiesEnchantmentContinuation & FairiesPromptContext,
        nextProgram: fairiesEnchantmentPromptProgram,
    };
});

function fairiesFairyBallet(ctx: AbilityContext): AbilityResult {
    const branchContext = createFairiesBranchEffectContext(ctx.matchState, ctx.playerId, ctx.random, ctx.now);
    return {
        events: [],
        matchState: queueBranchingChoice({
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'fairies_fairy_ballet',
            title: '精灵芭蕾：抽两张牌，或抽一张牌并额外打出一张行动卡',
            executeBranch: runFairiesFairyBalletBranch,
            targetType: 'button',
            upgrade: getSpiritOptionalBothUpgrade(ctx.state, ctx.playerId, ctx.now),
            options: [
                createButtonBranchOption(
                    'draw-two',
                    '抽两张牌',
                    'draw_two',
                    fairiesFairyBalletDrawTwoPrimitive.footprint(branchContext),
                ),
                createButtonBranchOption(
                    'draw-one-action',
                    '抽一张牌并额外打出一张行动卡',
                    'draw_one_and_action',
                    fairiesFairyBalletDrawOneAndActionPrimitive.footprint(branchContext),
                ),
            ],
        }),
    };
}

function fairiesLadybugProtectionChecker(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.attachedActions.some(action => action.defId === 'fairies_ladybug' || action.defId === 'fairies_ladybug_pod');
}

function fairiesMagicWardRestrictionChecker(ctx: RestrictionCheckContext): boolean {
    return ctx.state.bases[ctx.baseIndex]?.ongoingActions.some(action =>
        (action.defId === 'fairies_magic_ward' || action.defId === 'fairies_magic_ward_pod')
        && ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) !== ctx.playerId,
    ) ?? false;
}

const runFairiesTitaniaBranch: BranchExecutor = ({ state, playerId, selection, timestamp }) => {
    const branchId = selection.branchId;
    if (branchId === 'extra_minion') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesTitaniaExtraMinionProgram,
            { matchState: state, playerId, now: timestamp } satisfies FairiesPromptContext,
        ), state);
    }
    if (branchId === 'return_minion') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesTitaniaReturnPromptProgram,
            { matchState: state, playerId, now: timestamp } satisfies FairiesTitaniaReturnPromptContext,
        ), state);
    }
    if (branchId === 'return_minion_pod') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesTitaniaPodReturnPromptProgram,
            { matchState: state, playerId, now: timestamp } satisfies FairiesTitaniaPodReturnPromptContext,
        ), state);
    }
    return { state, events: [] };
};

const runFairiesPuckBranch: BranchExecutor = ({ state, playerId, selection, random, timestamp }) => {
    const branchId = selection.branchId;
    if (branchId === 'extra_action') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesPuckExtraActionProgram,
            createFairiesBranchEffectContext(state, playerId, random, timestamp),
        ), state);
    }
    if (branchId === 'draw_card') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesPuckDrawCardProgram,
            createFairiesBranchEffectContext(state, playerId, random, timestamp),
        ), state);
    }
    return { state, events: [] };
};

const runFairiesMagicAcornsBranch: BranchExecutor = ({ state, playerId, selection, random, timestamp }) => {
    const branchId = selection.branchId;
    if (branchId === 'discard_others') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesMagicAcornsDiscardOthersProgram,
            createFairiesBranchEffectContext(state, playerId, random, timestamp),
        ), state);
    }
    if (branchId === 'draw_one_and_action') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesMagicAcornsDrawOneAndActionProgram,
            createFairiesBranchEffectContext(state, playerId, random, timestamp),
        ), state);
    }
    return { state, events: [] };
};

const runFairiesPlayfulTricksBranch: BranchExecutor = ({ state, playerId, selection, planContext, timestamp }) => {
    const branchId = selection.branchId;
    if (branchId === 'destroy_actions') {
        const actionOptions = buildPlayfulTricksActionOptions(state.core);
        if (actionOptions.length === 0) return { state, events: [] };
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesPlayfulTricksDestroyPromptProgram,
            {
                matchState: state,
                playerId,
                now: timestamp,
                options: actionOptions.map(option => ({
                    cardUid: option.value.cardUid,
                    defId: option.value.defId,
                    ownerId: option.value.ownerId,
                    label: option.label,
                })),
            } satisfies FairiesPlayfulTricksDestroyPromptContext,
        ), state);
    }

    if (branchId === 'play_spirit') {
        const titanUid = typeof planContext?.titanUid === 'string' ? planContext.titanUid : undefined;
        if (!titanUid) return { state, events: [] };
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesPlayfulTricksSpiritBasePromptProgram,
            {
                matchState: state,
                playerId,
                now: timestamp,
                titanUid,
            } satisfies FairiesPlayfulTricksSpiritBasePromptContext,
        ), state);
    }

    return { state, events: [] };
};

const runFairiesFairyBalletBranch: BranchExecutor = ({ state, playerId, selection, random, timestamp }) => {
    const branchId = selection.branchId;
    if (branchId === 'draw_two') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesFairyBalletDrawTwoProgram,
            createFairiesBranchEffectContext(state, playerId, random, timestamp),
        ), state);
    }
    if (branchId === 'draw_one_and_action') {
        return runtimeResultToBranchResult(executeAbilityProgram(
            fairiesFairyBalletDrawOneAndActionProgram,
            createFairiesBranchEffectContext(state, playerId, random, timestamp),
        ), state);
    }
    return { state, events: [] };
};
