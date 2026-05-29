import type { PlayerId } from '../../../engine/types';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    getMinionPower,
    addTempPower,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerBaseAbility, registerExtended, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import type { SmashUpCore, SmashUpEvent } from '../domain/types';
import {
    SHAYU_TRIGGER_CONTRACT,
    type BaseChoice,
    type MinionChoice,
    type MinionTarget,
    type PromptContext,
    collectBaseTargets,
    collectMinionTargets,
    runtimeToAbilityResult,
    runtimeToTriggerResult,
} from './shayu_common';

type SharksDestroyContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
    optional?: boolean;
    destroyerId?: PlayerId;
};

type SharksBaseThenDestroyContext = PromptContext & {
    sourceId: string;
    sourceMinionUid: string;
    sourceMinionDefId: string;
    sourceBaseIndex: number;
    destinationBases: Array<{ baseIndex: number; label: string }>;
    destroyPowerMax: number;
};

type SharksDestroyAfterMoveContext = PromptContext & {
    sourceId: string;
    movedMinionUid: string;
    movedMinionDefId: string;
    destinationBaseIndex: number;
    destroyPowerMax: number;
};

type SharksAirJawsContext = PromptContext & {
    candidates: MinionTarget[];
};

type SharksLaserContext = PromptContext & {
    sourceMinionUid: string;
    sourceMinionDefId: string;
    sourceBaseIndex: number;
    sourcePower: number;
    targets: MinionTarget[];
};

type SharksDangerousWatersContext = PromptContext & {
    baseIndex: number;
    targets: MinionTarget[];
};

type SharksMultiDestroyContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
    destroyerId?: PlayerId;
};

function destroyTarget(state: SmashUpCore | { core: SmashUpCore }, target: { minionUid: string; defId: string; baseIndex: number }, destroyerId: PlayerId | undefined, reason: string, now: number): SmashUpEvent[] {
    return buildValidatedDestroyEvents(state, {
        minionUid: target.minionUid,
        minionDefId: target.defId,
        fromBaseIndex: target.baseIndex,
        destroyerId,
        reason,
        now,
        sourceKind: 'action',
    });
}

function collectPowerTargets(state: SmashUpCore, powerMax: number, baseIndex?: number, excludeUid?: string): MinionTarget[] {
    return collectMinionTargets(state, (minion, index) => {
        if (baseIndex !== undefined && index !== baseIndex) return false;
        if (excludeUid && minion.uid === excludeUid) return false;
        return getMinionPower(state, minion, index) <= powerMax;
    });
}

const sharksDestroyPromptProgram = createPromptProgram<SharksDestroyContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_destroy_prompt',
    interactionSourceIds: [
        'sharks_megalodon',
        'sharks_megalodon_before_scoring',
        'sharks_torn_apart',
        'sharks_feeding_frenzy',
        'sharks_freakin_laser_beam',
        'sharks_great_white_destroy',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'action',
                effectType: 'destroy',
            }),
        ],
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: !context.optional },
    ),
    onResolve: ({ context, state, playerId, value, timestamp, random }) => {
        const choice = value as MinionChoice;
        if (choice.skip) return { events: [] };
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        const events = destroyTarget(state, {
            minionUid: choice.minionUid,
            defId: choice.defId,
            baseIndex: choice.baseIndex,
        }, context.destroyerId ?? playerId, context.sourceId, timestamp);
        if (context.sourceId === 'sharks_torn_apart') {
            events.push(...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp));
        }
        return { events };
    },
});

function runDestroyPrompt(ctx: AbilityContext, params: Omit<SharksDestroyContext, keyof PromptContext>): AbilityResult {
    if (params.targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeToAbilityResult(executeAbilityProgram(sharksDestroyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        ...params,
    }));
}

function sharksMegalodon(ctx: AbilityContext): AbilityResult {
    return runDestroyPrompt(ctx, {
        sourceId: 'sharks_megalodon',
        title: '巨齿鲨：你可以消灭这里一个力量≤4的随从',
        targets: collectPowerTargets(ctx.state, 4, ctx.baseIndex, ctx.cardUid),
        optional: true,
    });
}

function sharksTornApart(ctx: AbilityContext): AbilityResult {
    return runDestroyPrompt(ctx, {
        sourceId: 'sharks_torn_apart',
        title: '撕裂：消灭一个力量≤3的随从并抽一张牌',
        targets: collectPowerTargets(ctx.state, 3),
    });
}

function sharksFeedingFrenzy(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const targets = collectPowerTargets(ctx.state, 2, baseIndex);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(sharksMultiDestroyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'sharks_feeding_frenzy',
        title: '疯狂进食：选择任意数量的力量≤2随从消灭',
        targets,
        destroyerId: ctx.playerId,
    }));
}

const sharksMultiDestroyPromptProgram = createPromptProgram<SharksMultiDestroyContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_multi_destroy_prompt',
    interactionSourceIds: ['sharks_feeding_frenzy'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'destroy',
        }),
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            multi: { min: 0, max: context.targets.length },
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selections = (Array.isArray(value) ? value : []) as MinionChoice[];
        const selectedKeys = new Set(selections
            .filter(selection => selection.minionUid && selection.baseIndex !== undefined)
            .map(selection => `${selection.minionUid}@${selection.baseIndex}`));
        if (selectedKeys.size === 0) return { events: [] };
        return {
            events: context.targets
                .filter(target => selectedKeys.has(`${target.uid}@${target.baseIndex}`))
                .flatMap(target => destroyTarget(state, {
                    minionUid: target.uid,
                    defId: target.defId,
                    baseIndex: target.baseIndex,
                }, context.destroyerId ?? playerId, context.sourceId, timestamp)),
        };
    },
});

const sharksMoveThenDestroyBasePromptProgram = createPromptProgram<SharksBaseThenDestroyContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_move_then_destroy_base',
    interactionSourceIds: ['sharks_great_white', 'sharks_air_jaws_destination'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '选择要移动到的基地',
        buildBaseTargetOptions(context.destinationBases, context.matchState.core),
        { sourceId: context.sourceId, targetType: 'base' },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        const moveEvents = buildValidatedMoveEvents(state, {
            minionUid: context.sourceMinionUid,
            minionDefId: context.sourceMinionDefId,
            fromBaseIndex: context.sourceBaseIndex,
            toBaseIndex: choice.baseIndex,
            toBaseDefId: choice.baseDefId,
            reason: context.sourceId,
            now: timestamp,
        });
        const targets = collectPowerTargets(state.core, context.destroyPowerMax, choice.baseIndex, context.sourceMinionUid);
        if (targets.length === 0) return { events: moveEvents };
        if (targets.length === 1) {
            return {
                events: [
                    ...moveEvents,
                    ...destroyTarget(state, {
                        minionUid: targets[0].uid,
                        defId: targets[0].defId,
                        baseIndex: targets[0].baseIndex,
                    }, playerId, `${context.sourceId}_destroy`, timestamp),
                ],
            };
        }
        return {
            events: moveEvents,
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                sourceId: `${context.sourceId}_destroy`,
                movedMinionUid: context.sourceMinionUid,
                movedMinionDefId: context.sourceMinionDefId,
                destinationBaseIndex: choice.baseIndex,
                destroyPowerMax: context.destroyPowerMax,
            } satisfies SharksDestroyAfterMoveContext,
            nextProgram: sharksDestroyAfterMovePromptProgram,
        };
    },
});

const sharksDestroyAfterMovePromptProgram = createPromptProgram<SharksDestroyAfterMoveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_destroy_after_move',
    interactionSourceIds: ['sharks_great_white_destroy', 'sharks_air_jaws_destroy'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        `选择移动后基地上力量≤${context.destroyPowerMax}的随从`,
        buildMinionTargetOptions(
            collectPowerTargets(context.matchState.core, context.destroyPowerMax, context.destinationBaseIndex, context.movedMinionUid),
            { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'destroy' },
        ),
        { sourceId: context.sourceId, targetType: 'minion' },
    ),
    onResolve: ({ state, playerId, value, timestamp, context }) => {
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        return { events: destroyTarget(state, {
            minionUid: choice.minionUid,
            defId: choice.defId,
            baseIndex: choice.baseIndex,
        }, playerId, context.sourceId, timestamp) };
    },
});

function sharksGreatWhite(ctx: AbilityContext): AbilityResult {
    const current = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!current) return { events: [] };
    const destinationBases = collectBaseTargets(ctx.state, baseIndex => baseIndex !== ctx.baseIndex);
    if (destinationBases.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(sharksMoveThenDestroyBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'sharks_great_white',
        sourceMinionUid: current.uid,
        sourceMinionDefId: current.defId,
        sourceBaseIndex: ctx.baseIndex,
        destinationBases,
        destroyPowerMax: 2,
    }));
}

const sharksAirJawsMinionPromptProgram = createPromptProgram<SharksAirJawsContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_air_jaws',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sharks_air_jaws_${context.now}`,
        context.playerId,
        '飞鲨：选择你的一个随从移动到另一个基地',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'move',
        }),
        { sourceId: 'sharks_air_jaws', targetType: 'minion' },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        const destinationBases = collectBaseTargets(state.core, baseIndex => baseIndex !== choice.baseIndex);
        if (destinationBases.length === 0) return { events: [] };
        return executeAbilityProgram(sharksMoveThenDestroyBasePromptProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            sourceId: 'sharks_air_jaws_destination',
            sourceMinionUid: choice.minionUid,
            sourceMinionDefId: choice.defId,
            sourceBaseIndex: choice.baseIndex,
            destinationBases,
            destroyPowerMax: 3,
        });
    },
});

function sharksAirJaws(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionTargets(ctx.state, (minion, baseIndex) => minion.controller === ctx.playerId && ctx.state.bases.some((_base, otherBaseIndex) => otherBaseIndex !== baseIndex));
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (ctx.targetMinionUid) {
        const selected = candidates.find(candidate => candidate.uid === ctx.targetMinionUid && candidate.baseIndex === ctx.baseIndex);
        if (!selected) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        const destinationBases = collectBaseTargets(ctx.state, baseIndex => baseIndex !== selected.baseIndex);
        if (destinationBases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        return runtimeToAbilityResult(executeAbilityProgram(sharksMoveThenDestroyBasePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId: 'sharks_air_jaws_destination',
            sourceMinionUid: selected.uid,
            sourceMinionDefId: selected.defId,
            sourceBaseIndex: selected.baseIndex,
            destinationBases,
            destroyPowerMax: 3,
        }));
    }
    return runtimeToAbilityResult(executeAbilityProgram(sharksAirJawsMinionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
    }));
}

const sharksLaserPromptProgram = createPromptProgram<SharksLaserContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_freakin_laser_beam',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sharks_freakin_laser_beam_${context.now}`,
        context.playerId,
        `激光束：选择同基地力量≤${context.sourcePower}的随从`,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'destroy',
        }),
        { sourceId: 'sharks_freakin_laser_beam', targetType: 'minion' },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        return { events: destroyTarget(state, {
            minionUid: choice.minionUid,
            defId: choice.defId,
            baseIndex: choice.baseIndex,
        }, playerId, 'sharks_freakin_laser_beam', timestamp) };
    },
});

function sharksFreakinLaserBeam(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const located = collectMinionTargets(ctx.state, minion => minion.uid === ctx.targetMinionUid && minion.controller === ctx.playerId)[0];
    if (!located) return { events: [] };
    const sourceMinion = ctx.state.bases[located.baseIndex]?.minions.find(minion => minion.uid === located.uid);
    if (!sourceMinion) return { events: [] };
    const sourcePower = getMinionPower(ctx.state, sourceMinion, located.baseIndex);
    const targets = collectPowerTargets(ctx.state, sourcePower, located.baseIndex, located.uid);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(sharksLaserPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceMinionUid: located.uid,
        sourceMinionDefId: located.defId,
        sourceBaseIndex: located.baseIndex,
        sourcePower,
        targets,
    }));
}

const sharksDangerousWatersPromptProgram = createPromptProgram<SharksDangerousWatersContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_dangerous_waters',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `sharks_dangerous_waters_${context.now}`,
        context.playerId,
        '危险水域：选择这里一个随从，直到回合结束 -2 力量',
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'buff',
        }),
        { sourceId: 'sharks_dangerous_waters', targetType: 'minion' },
    ),
    onResolve: ({ value, timestamp }) => {
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        return { events: [addTempPower(choice.minionUid, choice.baseIndex, -2, 'sharks_dangerous_waters', timestamp)] };
    },
});

function sharksDangerousWaters(ctx: AbilityContext): AbilityResult {
    const targets = collectMinionTargets(ctx.state, (_minion, baseIndex) => baseIndex === ctx.baseIndex);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(sharksDangerousWatersPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        targets,
    }));
}

function sharksDestroyedCounterTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return [];
    if (ctx.sourceCardUid) {
        const sourceHammerhead = base.minions.find(minion =>
            minion.uid === ctx.sourceCardUid && minion.defId === 'sharks_hammerhead');
        if (sourceHammerhead) {
            return [addPowerCounter(sourceHammerhead.uid, ctx.baseIndex, 1, 'sharks_hammerhead', ctx.now)];
        }

        const chumHost = base.minions.find(minion =>
            minion.attachedActions.some(attached =>
                attached.uid === ctx.sourceCardUid && attached.defId === 'sharks_chum'));
        if (chumHost) {
            return [addPowerCounter(chumHost.uid, ctx.baseIndex, 1, 'sharks_chum', ctx.now)];
        }
    }

    const events: SmashUpEvent[] = [];
    for (const minion of base.minions) {
        if (minion.defId === 'sharks_hammerhead') {
            events.push(addPowerCounter(minion.uid, ctx.baseIndex, 1, 'sharks_hammerhead', ctx.now));
        }
        for (const attached of minion.attachedActions) {
            if (attached.defId === 'sharks_chum') {
                events.push(addPowerCounter(minion.uid, ctx.baseIndex, 1, 'sharks_chum', ctx.now));
            }
        }
    }
    return events;
}

function sharksBloodInTheWaterTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return [];
    if (ctx.sourceCardUid) {
        const source = base.ongoingActions.find(action =>
            action.uid === ctx.sourceCardUid && action.defId === 'sharks_blood_in_the_water');
        const sourceControllerId = source
            ? (((source.metadata?.sourceControllerId as PlayerId | undefined) ?? source.ownerId) as PlayerId)
            : undefined;
        return source
            ? [grantExtraMinion(sourceControllerId ?? source.ownerId, 'sharks_blood_in_the_water', ctx.now, ctx.baseIndex, {
                powerMax: 3,
                playTiming: 'immediate',
            })]
            : [];
    }
    return base.ongoingActions
        .filter(action => action.defId === 'sharks_blood_in_the_water')
        .map(action => grantExtraMinion(
            ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) as PlayerId,
            'sharks_blood_in_the_water',
            ctx.now,
            ctx.baseIndex,
            {
            powerMax: 3,
            playTiming: 'immediate',
        }));
}

function sharksWeekOfSharksTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const controllerWithWeek = new Set<PlayerId>();
    const events: SmashUpEvent[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        const base = ctx.state.bases[baseIndex];
        for (const action of base.ongoingActions) {
            if (action.defId !== 'sharks_week_of_sharks') continue;
            const controllerId = action.metadata?.sourceControllerId ?? action.ownerId;
            if (controllerId !== ctx.playerId) continue;
            if (controllerWithWeek.has(controllerId)) continue;
            const hasMinionHere = base.minions.some(minion => minion.controller === controllerId);
            if (!hasMinionHere) continue;
            events.push(...buildStandardDrawEvents(ctx.state, controllerId, 1, ctx.random, ctx.now));
            controllerWithWeek.add(controllerId);
        }
    }
    return events;
}

function sharksMakoTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || ctx.destroyerId === undefined) return [];
    const player = ctx.state.players[ctx.destroyerId];
    if (!player?.hand.some(card => card.defId === 'sharks_mako')) return [];
    return [grantExtraMinion(ctx.destroyerId, 'sharks_mako', ctx.now, ctx.baseIndex, {
        sameNameDefId: 'sharks_mako',
        playTiming: 'immediate',
    })];
}

function sharksMegalodonBeforeScoring(ctx: TriggerContext) {
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined || !ctx.matchState) return { events: [] };
    const source = ctx.sourceCardUid
        ? ctx.state.bases[baseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid)
        : undefined;
    const playerId = source?.controller ?? ctx.sourceControllerId ?? ctx.playerId;
    const targets = collectPowerTargets(ctx.state, 3, baseIndex, ctx.sourceCardUid);
    if (targets.length === 0) return { events: [] };
    return runtimeToTriggerResult(executeAbilityProgram(sharksDestroyPromptProgram, {
        matchState: ctx.matchState,
        playerId,
        now: ctx.now,
        sourceId: 'sharks_megalodon_before_scoring',
        title: '巨齿鲨：基地计分前，你可以消灭这里一个力量≤3的随从',
        targets,
        optional: true,
        destroyerId: playerId,
    }), ctx.matchState);
}

function baseSharkReef(ctx: BaseAbilityContext) {
    const destroyerId = ctx.destroyerId;
    if (!destroyerId || !ctx.matchState) return { events: [] };
    const targets = collectMinionTargets(ctx.state, minion => minion.controller === destroyerId);
    if (targets.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(sharksCounterPromptProgram, {
        matchState: ctx.matchState,
        playerId: destroyerId,
        now: ctx.now,
        sourceId: 'base_shark_reef',
        title: '鲨鱼领地：你可以在你的一个随从上放置 +1 指示物',
        targets,
    }));
}

function baseTheDeep(ctx: BaseAbilityContext) {
    if (ctx.minionPower === undefined || ctx.minionPower < 4 || !ctx.matchState) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = collectMinionTargets(ctx.state, (minion, baseIndex) => {
        if (baseIndex !== ctx.baseIndex || minion.uid === ctx.minionUid) return false;
        return getMinionPower(ctx.state, minion, baseIndex) < ctx.minionPower!;
    });
    if (targets.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(sharksDestroyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'base_the_deep',
        title: '海渊：你可以消灭这里一个力量更低的随从',
        targets,
        optional: true,
        destroyerId: ctx.playerId,
    }));
}

type SharksCounterPromptContext = PromptContext & {
    sourceId: string;
    title: string;
    targets: MinionTarget[];
};

const sharksCounterPromptProgram = createPromptProgram<SharksCounterPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'sharks_counter_prompt',
    interactionSourceIds: ['base_shark_reef'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            createSkipOption(),
            ...buildMinionTargetOptions(context.targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'action',
                effectType: 'buff',
            }),
        ],
        { sourceId: context.sourceId, targetType: 'minion', autoResolveIfSingle: false },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (choice.skip || !choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        return { events: [addPowerCounter(choice.minionUid, choice.baseIndex, 1, context.sourceId, timestamp)] };
    },
});

export function registerSharksAbilities(): void {
    const sourceIsDestroyer = (ctx: TriggerContext) =>
        ctx.destroyerId !== undefined && ctx.sourceControllerId === ctx.destroyerId;

    registerAbilityProgram('sharks_megalodon', 'onPlay', { program: createEffectProgram(sharksMegalodon) });
    registerAbilityProgram('sharks_great_white', 'talent', { program: createEffectProgram(sharksGreatWhite) });
    registerSimpleAbility('sharks_torn_apart', 'onPlay', sharksTornApart);
    registerSimpleAbility('sharks_feeding_frenzy', 'onPlay', sharksFeedingFrenzy);
    registerAbilityProgram('sharks_air_jaws', 'onPlay', { program: createEffectProgram(sharksAirJaws) });
    registerAbilityProgram('sharks_freakin_laser_beam', 'onPlay', { program: createEffectProgram(sharksFreakinLaserBeam) });
    registerAbilityProgram('sharks_dangerous_waters', 'talent', { program: createEffectProgram(sharksDangerousWaters) });
    registerTrigger('sharks_hammerhead', 'onMinionDestroyed', sharksDestroyedCounterTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('sharks_chum', 'onMinionDestroyed', sharksDestroyedCounterTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('sharks_blood_in_the_water', 'onMinionDestroyed', sharksBloodInTheWaterTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('sharks_week_of_sharks', 'onTurnEnd', sharksWeekOfSharksTrigger, {
        playerContext: 'sourceController',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('sharks_mako', 'onMinionDestroyed', sharksMakoTrigger, {
        global: true,
        globalZones: ['hand'],
        playerContext: 'sourceController',
        canTrigger: sourceIsDestroyer,
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('sharks_megalodon', 'beforeScoring', sharksMegalodonBeforeScoring, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerExtended('base_shark_reef', 'onMinionDestroyed', baseSharkReef, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerBaseAbility('base_the_deep', 'onMinionPlayed', baseTheDeep, { effectContract: SHAYU_TRIGGER_CONTRACT });
}
