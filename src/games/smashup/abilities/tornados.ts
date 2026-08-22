import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    getMinionPower,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerExtended, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import type { BaseAbilityUsedEvent, BaseReplacedEvent, OngoingAttachedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    SHAYU_TRIGGER_CONTRACT,
    type BaseChoice,
    type ButtonChoice,
    type CardChoice,
    type MinionChoice,
    type MinionTarget,
    type PromptContext,
    collectBaseTargets,
    collectMinionTargets,
    runtimeToAbilityResult,
} from './shayu_common';

type MoveMinionToBaseContext = PromptContext & {
    sourceId: string;
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    destinationBases: Array<{ baseIndex: number; label: string }>;
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};

type ChooseMinionForMoveContext = PromptContext & {
    sourceId: string;
    title: string;
    candidates: MinionTarget[];
    fixedDestinationBaseIndex?: number;
    anchorBaseIndex?: number;
    optional?: boolean;
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};

type TradeWindsFirstContext = PromptContext & {
    candidates: MinionTarget[];
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};
type TradeWindsSecondContext = PromptContext & {
    first: MinionTarget;
    candidates: MinionTarget[];
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};
type RippedOffContext = PromptContext & { actions: Array<{ cardUid: string; defId: string; ownerId: string; targetType: 'base' | 'minion'; baseIndex: number; minionUid?: string; minionDefId?: string; label: string }> };
type RippedOffTargetContext = PromptContext & { cardUid: string; defId: string; ownerId: string; targetType: 'base' | 'minion'; fromBaseIndex: number; fromMinionUid?: string };
type WhirlwindsContext = PromptContext & {
    candidates: MinionTarget[];
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};
type WhirlwindsTargetContext = PromptContext & {
    current: MinionTarget;
    remaining: MinionTarget[];
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};
type DustDevilContext = PromptContext & {
    sourceCardUid: string;
    sourceDefId: string;
    sourceBaseIndex: number;
    scoringBaseIndex: number;
    sourcePlayerId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
};
type TornadoAlleyContext = PromptContext & {
    baseIndex: number;
    candidates: MinionTarget[];
    sourcePlayerId: string;
    sourceDefId: string;
    sourceKind: 'action' | 'nonAction';
    sourceControllerId?: string;
    sourceBaseIndex?: number;
};

function moveEvents(
    state: SmashUpCore | { core: SmashUpCore },
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    toBaseIndex: number,
    reason: string,
    now: number,
    source: {
        sourcePlayerId: string;
        sourceDefId: string;
        sourceKind: 'action' | 'nonAction';
        sourceControllerId?: string;
        sourceBaseIndex?: number;
    },
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid,
        minionDefId,
        fromBaseIndex,
        toBaseIndex,
        reason,
        now,
        sourcePlayerId: source.sourcePlayerId,
        sourceDefId: source.sourceDefId,
        sourceKind: source.sourceKind,
        sourceControllerId: source.sourceControllerId,
        sourceBaseIndex: source.sourceBaseIndex,
    });
}

function baseName(state: SmashUpCore, baseIndex: number): string {
    return getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
}

const moveToBasePromptProgram = createPromptProgram<MoveMinionToBaseContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_move_to_base',
    interactionSourceIds: [
        'tornados_cyclone', 'tornados_carried_away_dest', 'tornados_picked_up_dest',
        'tornados_gone_with_the_wind_dest', 'tornados_monster_tornado_dest', 'tornados_twister_dest',
        'tornados_over_the_rainbow_dest',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '选择移动目标基地',
        buildBaseTargetOptions(context.destinationBases, context.matchState.core),
        {
            sourceId: context.sourceId,
            titleKey: 'ui.tornados_move_destination_title',
            targetType: 'base',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice;
        if (choice.baseIndex === undefined) return { events: [] };
        return {
            events: moveEvents(
                state,
                context.minionUid,
                context.minionDefId,
                context.fromBaseIndex,
                choice.baseIndex,
                context.sourceId,
                timestamp,
                {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                },
            ),
        };
    },
});

const chooseMinionForMovePromptProgram = createPromptProgram<ChooseMinionForMoveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_choose_minion_move',
    interactionSourceIds: ['tornados_monster_tornado', 'tornados_twister', 'tornados_carried_away', 'tornados_picked_up', 'tornados_over_the_rainbow', 'tornados_gone_with_the_wind'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        [
            ...(context.optional ? [createSkipOption()] : []),
            ...buildMinionTargetOptions(context.candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.sourcePlayerId,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                effectType: 'move',
            }),
        ],
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        if ((choice as { skip?: boolean }).skip) return { events: [] };
        if (!choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        if (context.fixedDestinationBaseIndex !== undefined) {
            return {
                events: moveEvents(
                    state,
                    choice.minionUid,
                    choice.defId,
                    choice.baseIndex,
                    context.fixedDestinationBaseIndex,
                    context.sourceId,
                    timestamp,
                    {
                        sourcePlayerId: context.sourcePlayerId,
                        sourceDefId: context.sourceDefId,
                        sourceKind: context.sourceKind,
                        sourceControllerId: context.sourceControllerId,
                        sourceBaseIndex: context.sourceBaseIndex,
                    },
                ),
            };
        }
        if (context.anchorBaseIndex !== undefined && choice.baseIndex !== context.anchorBaseIndex) {
            return {
                events: moveEvents(
                    state,
                    choice.minionUid,
                    choice.defId,
                    choice.baseIndex,
                    context.anchorBaseIndex,
                    context.sourceId,
                    timestamp,
                    {
                        sourcePlayerId: context.sourcePlayerId,
                        sourceDefId: context.sourceDefId,
                        sourceKind: context.sourceKind,
                        sourceControllerId: context.sourceControllerId,
                        sourceBaseIndex: context.sourceBaseIndex,
                    },
                ),
            };
        }
        const destinations = collectBaseTargets(state.core, baseIndex => baseIndex !== choice.baseIndex);
        if (destinations.length === 0) return { events: [] };
        return executeAbilityProgram(moveToBasePromptProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            sourceId: `${context.sourceId}_dest`,
            minionUid: choice.minionUid,
            minionDefId: choice.defId,
            fromBaseIndex: choice.baseIndex,
            destinationBases: destinations,
            sourcePlayerId: context.sourcePlayerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            sourceControllerId: context.sourceControllerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
    },
});

function runChooseMove(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    candidates: MinionTarget[],
    options?: {
        fixedDestinationBaseIndex?: number;
        anchorBaseIndex?: number;
        optional?: boolean;
        sourceDefId?: string;
        sourceKind?: 'action' | 'nonAction';
        sourcePlayerId?: string;
        sourceControllerId?: string;
        sourceBaseIndex?: number;
    },
): AbilityResult {
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(chooseMinionForMovePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId,
        title,
        candidates,
        ...(options?.fixedDestinationBaseIndex !== undefined ? { fixedDestinationBaseIndex: options.fixedDestinationBaseIndex } : {}),
        ...(options?.anchorBaseIndex !== undefined ? { anchorBaseIndex: options.anchorBaseIndex } : {}),
        ...(options?.optional ? { optional: options.optional } : {}),
        sourcePlayerId: options?.sourcePlayerId ?? ctx.playerId,
        sourceDefId: options?.sourceDefId ?? ctx.defId,
        sourceKind: options?.sourceKind ?? 'action',
        sourceControllerId: options?.sourceControllerId ?? options?.sourcePlayerId ?? ctx.playerId,
        sourceBaseIndex: options?.sourceBaseIndex ?? ctx.baseIndex,
    }));
}

function tornadosCyclone(ctx: AbilityContext): AbilityResult {
    const destinations = collectBaseTargets(ctx.state, baseIndex => baseIndex !== ctx.baseIndex);
    if (destinations.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(moveToBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'tornados_cyclone',
        minionUid: ctx.cardUid,
        minionDefId: ctx.defId,
        fromBaseIndex: ctx.baseIndex,
        destinationBases: destinations,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    }));
}

function tornadoPushPull(ctx: AbilityContext, sourceId: string, powerMax: number): AbilityResult {
    const currentBase = ctx.baseIndex;
    const candidates = collectMinionTargets(ctx.state, (minion, baseIndex) => {
        if (getMinionPower(ctx.state, minion, baseIndex) > powerMax) return false;
        if (baseIndex === currentBase) return ctx.state.bases.length > 1;
        return true;
    });
    return runChooseMove(ctx, sourceId, `${getCardDef(ctx.defId)?.name ?? sourceId}：你可以选择力量≤${powerMax}的随从进行移动`, candidates, {
        anchorBaseIndex: currentBase,
        optional: true,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourcePlayerId: ctx.playerId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function tornadosMonsterTornado(ctx: AbilityContext): AbilityResult {
    return tornadoPushPull(ctx, 'tornados_monster_tornado', 4);
}

function tornadosTwister(ctx: AbilityContext): AbilityResult {
    return tornadoPushPull(ctx, 'tornados_twister', 3);
}

function tornadosCarriedAway(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) {
        const candidates = collectMinionTargets(ctx.state, () => true);
        return runChooseMove(ctx, 'tornados_carried_away', '卷走：选择一个随从移动到另一个基地', candidates, {
            sourceDefId: ctx.defId,
            sourceKind: 'action',
            sourcePlayerId: ctx.playerId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        });
    }
    const located = collectMinionTargets(ctx.state, minion => minion.uid === ctx.targetMinionUid)[0];
    if (!located) return { events: [] };
    const destinations = collectBaseTargets(ctx.state, baseIndex => baseIndex !== located.baseIndex);
    if (destinations.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(moveToBasePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'tornados_carried_away_dest',
        minionUid: located.uid,
        minionDefId: located.defId,
        fromBaseIndex: located.baseIndex,
        destinationBases: destinations,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    }));
}

function tornadosPickedUp(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const candidates = collectMinionTargets(ctx.state, (_minion, index) => index === baseIndex);
    return runChooseMove(ctx, 'tornados_picked_up', '卷起：选择该基地上一个随从移走', candidates, {
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourcePlayerId: ctx.playerId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function tornadosOverTheRainbow(ctx: AbilityContext): AbilityResult {
    const scoringBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const candidates = collectMinionTargets(ctx.state, (minion, index) => minion.controller === ctx.playerId && index !== scoringBaseIndex);
    return runChooseMove(ctx, 'tornados_over_the_rainbow', '飞越彩虹：选择你的一个随从移入计分基地', candidates, {
        fixedDestinationBaseIndex: scoringBaseIndex,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourcePlayerId: ctx.playerId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function tornadosGoneWithTheWind(ctx: AbilityContext): AbilityResult {
    const scoringBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const candidates = collectMinionTargets(ctx.state, (minion, index) => minion.controller === ctx.playerId && index === scoringBaseIndex);
    return runChooseMove(ctx, 'tornados_gone_with_the_wind', '随风而逝：选择你的一个随从移到其他基地而非弃牌', candidates, {
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourcePlayerId: ctx.playerId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    });
}

function tornadosWhirlwinds(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionTargets(ctx.state, (minion) => minion.controller === ctx.playerId);
    if (candidates.length === 0 || ctx.state.bases.length < 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(whirlwindsPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    }));
}

const whirlwindsPromptProgram = createPromptProgram<WhirlwindsContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_whirlwinds',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `tornados_whirlwinds_${context.now}`,
        context.playerId,
        '旋风群：选择任意数量你的随从移动至其他基地',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.sourcePlayerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            effectType: 'move',
        }),
        {
            sourceId: 'tornados_whirlwinds',
            titleKey: 'ui.tornados_whirlwinds_title',
            targetType: 'minion',
            multi: { min: 0, max: context.candidates.length },
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selections = (Array.isArray(value) ? value : []) as MinionChoice[];
        const selectedKeys = new Set(selections
            .filter(selection => selection.minionUid && selection.baseIndex !== undefined)
            .map(selection => `${selection.minionUid}@${selection.baseIndex}`));
        const selected = context.candidates.filter(target => selectedKeys.has(`${target.uid}@${target.baseIndex}`));
        if (selected.length === 0) return { events: [] };
        const [current, ...remaining] = selected;
        return {
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                current,
                remaining,
                sourcePlayerId: context.sourcePlayerId,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                sourceControllerId: context.sourceControllerId,
                sourceBaseIndex: context.sourceBaseIndex,
            },
            nextProgram: whirlwindsTargetPromptProgram,
        };
    },
});

const whirlwindsTargetPromptProgram = createPromptProgram<WhirlwindsTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_whirlwinds_dest',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `tornados_whirlwinds_dest_${context.current.uid}_${context.now}`,
        context.playerId,
        `旋风群：选择 ${context.current.label} 的目标基地`,
        buildBaseTargetOptions(
            collectBaseTargets(context.matchState.core, baseIndex => baseIndex !== context.current.baseIndex),
            context.matchState.core,
        ),
        { sourceId: 'tornados_whirlwinds_dest', targetType: 'base' },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice;
        const events = choice.baseIndex === undefined
            ? []
            : moveEvents(
                state,
                context.current.uid,
                context.current.defId,
                context.current.baseIndex,
                choice.baseIndex,
                'tornados_whirlwinds',
                timestamp,
                {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                },
            );
        if (context.remaining.length === 0) return { events };
        const [current, ...remaining] = context.remaining;
        return {
            events,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                current,
                remaining,
            },
            nextProgram: whirlwindsTargetPromptProgram,
        };
    },
});

const tradeWindsFirstPromptProgram = createPromptProgram<TradeWindsFirstContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_trade_winds_first',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `tornados_trade_winds_first_${context.now}`,
        context.playerId,
        '信风：选择第一个力量≤3的随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.sourcePlayerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            effectType: 'move',
        }),
        {
            sourceId: 'tornados_trade_winds_first',
            titleKey: 'ui.tornados_trade_winds_first_title',
            targetType: 'minion',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        const first = context.candidates.find(candidate => candidate.uid === choice.minionUid && candidate.baseIndex === choice.baseIndex);
        if (!first) return { events: [] };
        const candidates = collectMinionTargets(state.core, (minion, baseIndex) => minion.uid !== first.uid && baseIndex !== first.baseIndex && getMinionPower(state.core, minion, baseIndex) <= 3);
        if (candidates.length === 0) return { events: [] };
        return executeAbilityProgram(tradeWindsSecondPromptProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            first,
            candidates,
            sourcePlayerId: context.sourcePlayerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            sourceControllerId: context.sourceControllerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
    },
});

const tradeWindsSecondPromptProgram = createPromptProgram<TradeWindsSecondContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_trade_winds_second',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `tornados_trade_winds_second_${context.now}`,
        context.playerId,
        '信风：选择第二个力量≤3的随从并交换基地',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.sourcePlayerId,
            sourceDefId: context.sourceDefId,
            sourceKind: context.sourceKind,
            effectType: 'move',
        }),
        {
            sourceId: 'tornados_trade_winds_second',
            titleKey: 'ui.tornados_trade_winds_second_title',
            targetType: 'minion',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice;
        const second = context.candidates.find(candidate => candidate.uid === choice.minionUid && candidate.baseIndex === choice.baseIndex);
        if (!second) return { events: [] };
        return { events: [
            ...moveEvents(state, context.first.uid, context.first.defId, context.first.baseIndex, second.baseIndex, 'tornados_trade_winds', timestamp, {
                sourcePlayerId: context.sourcePlayerId,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                sourceControllerId: context.sourceControllerId,
                sourceBaseIndex: context.sourceBaseIndex,
            }),
            ...moveEvents(state, second.uid, second.defId, second.baseIndex, context.first.baseIndex, 'tornados_trade_winds', timestamp, {
                sourcePlayerId: context.sourcePlayerId,
                sourceDefId: context.sourceDefId,
                sourceKind: context.sourceKind,
                sourceControllerId: context.sourceControllerId,
                sourceBaseIndex: context.sourceBaseIndex,
            }),
        ] };
    },
});

function tornadosTradeWinds(ctx: AbilityContext): AbilityResult {
    const candidates = collectMinionTargets(ctx.state, (minion, baseIndex) => getMinionPower(ctx.state, minion, baseIndex) <= 3);
    if (candidates.length < 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(tradeWindsFirstPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        candidates,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        sourceKind: 'action',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    }));
}

function collectTransferableActions(state: SmashUpCore): RippedOffContext['actions'] {
    const actions: RippedOffContext['actions'] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const action of base.ongoingActions) {
            actions.push({ cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, targetType: 'base', baseIndex, label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${baseName(state, baseIndex)}` });
        }
        for (const minion of base.minions) {
            for (const action of minion.attachedActions) {
                actions.push({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    targetType: 'minion',
                    baseIndex,
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${getCardDef(minion.defId)?.name ?? minion.defId}`,
                });
            }
        }
    }
    return actions;
}

const rippedOffActionPromptProgram = createPromptProgram<RippedOffContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_ripped_off',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `tornados_ripped_off_${context.now}`,
        context.playerId,
        '扯走：选择要转移的持续行动卡',
        context.actions.map((action, index) => ({ id: `action-${index}`, label: action.label, value: action, displayMode: 'card' as const })),
        {
            sourceId: 'tornados_ripped_off',
            titleKey: 'ui.tornados_ripped_off_title',
            targetType: 'ongoing',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as CardChoice & { targetType?: 'base' | 'minion'; baseIndex?: number; minionUid?: string };
        if (!choice.cardUid || !choice.defId || !choice.ownerId || !choice.targetType || choice.baseIndex === undefined) return { events: [] };
        return executeAbilityProgram(rippedOffTargetPromptProgram, {
            matchState: state,
            playerId,
            now: timestamp,
            cardUid: choice.cardUid,
            defId: choice.defId,
            ownerId: choice.ownerId,
            targetType: choice.targetType,
            fromBaseIndex: choice.baseIndex,
            ...(choice.minionUid ? { fromMinionUid: choice.minionUid } : {}),
        });
    },
});

const rippedOffTargetPromptProgram = createPromptProgram<RippedOffTargetContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_ripped_off_target',
    interactionSourceIds: [
        'tornados_ripped_off_target_base',
        'tornados_ripped_off_target_minion',
    ],
    buildInteraction: (context) => {
        if (context.targetType === 'base') {
            return createAbilityRuntimeSimpleChoice(
                `tornados_ripped_off_target_base_${context.now}`,
                context.playerId,
                '扯走：选择新的基地',
                buildBaseTargetOptions(collectBaseTargets(context.matchState.core, baseIndex => baseIndex !== context.fromBaseIndex), context.matchState.core),
                {
                    sourceId: 'tornados_ripped_off_target_base',
                    titleKey: 'ui.tornados_ripped_off_target_base_title',
                    targetType: 'base',
                },
            );
        }
        const targets = collectMinionTargets(context.matchState.core, (minion) => minion.uid !== context.fromMinionUid);
        return createAbilityRuntimeSimpleChoice(
            `tornados_ripped_off_target_minion_${context.now}`,
            context.playerId,
            '扯走：选择新的随从',
            buildMinionTargetOptions(targets, { state: context.matchState.core, sourcePlayerId: context.playerId, sourceKind: 'action', effectType: 'affect' }),
            {
                sourceId: 'tornados_ripped_off_target_minion',
                titleKey: 'ui.tornados_ripped_off_target_minion_title',
                targetType: 'minion',
            },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const sourceAction = context.targetType === 'base'
            ? context.matchState.core.bases[context.fromBaseIndex]?.ongoingActions.find(action => action.uid === context.cardUid)
            : context.matchState.core.bases[context.fromBaseIndex]?.minions
                .find(minion => minion.uid === context.fromMinionUid)
                ?.attachedActions
                .find(action => action.uid === context.cardUid);
        const events: SmashUpEvent[] = buildValidatedOngoingDetachEvents(context.matchState.core, {
            cardUid: context.cardUid,
            defId: context.defId,
            ownerId: context.ownerId,
            reason: 'tornados_ripped_off',
            now: timestamp,
            expectedLocation: context.targetType,
        });
        if (context.targetType === 'base') {
            const choice = value as BaseChoice;
            if (choice.baseIndex === undefined) return { events: [] };
            events.push({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: context.cardUid,
                    defId: context.defId,
                    ownerId: context.ownerId,
                    ...(context.ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                    targetType: 'base',
                    targetBaseIndex: choice.baseIndex,
                    ...(sourceAction?.metadata ? { metadata: sourceAction.metadata } : {}),
                    ...(sourceAction?.talentUsed !== undefined ? { talentUsed: sourceAction.talentUsed } : {}),
                },
                timestamp,
            } as OngoingAttachedEvent);
            return { events };
        }
        const choice = value as MinionChoice;
        if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        events.push(...buildSemanticOngoingAttachEvents(context.matchState, {
            cardUid: context.cardUid,
            defId: context.defId,
            ownerId: context.ownerId,
            ...(context.ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
            targetBaseIndex: choice.baseIndex,
            targetMinionUid: choice.minionUid,
            ...(sourceAction?.metadata ? { metadata: sourceAction.metadata } : {}),
            ...(sourceAction?.talentUsed !== undefined ? { talentUsed: sourceAction.talentUsed } : {}),
            now: timestamp,
        }));
        return { events };
    },
});

function tornadosRippedOff(ctx: AbilityContext): AbilityResult {
    const actions = collectTransferableActions(ctx.state);
    if (actions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return runtimeToAbilityResult(executeAbilityProgram(rippedOffActionPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        actions,
    }));
}

function tornadosNotInKansas(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const oldBase = ctx.state.bases[baseIndex];
    const newBaseDefId = ctx.state.baseDeck?.[0];
    if (!oldBase || !newBaseDefId) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.base_deck_empty', ctx.now)] };
    const events: SmashUpEvent[] = [];
    for (const action of oldBase.ongoingActions) {
        events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: action.uid,
            reason: 'tornados_not_in_kansas',
            now: ctx.now,
            expectedLocation: 'base',
        }));
    }
    for (const minion of oldBase.minions) {
        for (const action of minion.attachedActions) {
            events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: action.uid,
                reason: 'tornados_not_in_kansas',
                now: ctx.now,
                expectedLocation: 'minion',
            }));
        }
    }
    events.push({ type: SU_EVENTS.BASE_REPLACED, payload: { baseIndex, oldBaseDefId: oldBase.defId, newBaseDefId, keepCards: true }, timestamp: ctx.now } as BaseReplacedEvent);
    return { events };
}

function tornadosDustDevilBeforeScoring(ctx: TriggerContext) {
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceBaseIndex === scoringBaseIndex || !ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(dustDevilPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId ?? ctx.playerId,
        now: ctx.now,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: ctx.triggerMinionDefId ?? 'tornados_dust_devil',
        sourceBaseIndex: ctx.sourceBaseIndex,
        scoringBaseIndex,
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceKind: 'nonAction',
        sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
    }));
}

const dustDevilPromptProgram = createPromptProgram<DustDevilContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'tornados_dust_devil',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `tornados_dust_devil_${context.now}`,
        context.playerId,
        '尘卷风：是否移动到即将计分的基地？',
        [
            createSkipOption(),
            {
                id: 'move',
                label: '移动到计分基地',
                labelKey: 'ui.tornados_dust_devil_move_option',
                value: { choice: 'move' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'tornados_dust_devil',
            titleKey: 'ui.tornados_dust_devil_title',
            targetType: 'button',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as ButtonChoice<'move'>;
        if (choice.skip || choice.choice !== 'move') return { events: [] };
        return {
            events: moveEvents(
                state,
                context.sourceCardUid,
                context.sourceDefId,
                context.sourceBaseIndex,
                context.scoringBaseIndex,
                'tornados_dust_devil',
                timestamp,
                {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                },
            ),
        };
    },
});

function baseTrailerPark(ctx: BaseAbilityContext) {
    if (!ctx.minionUid) return { events: [] };
    return { events: [addPowerCounter(ctx.minionUid, ctx.baseIndex, 1, 'base_trailer_park', ctx.now)] };
}

function baseTornadoAlley(ctx: BaseAbilityContext) {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || !ctx.minionUid || !ctx.matchState) return { events: [] };
    if (ctx.reason === 'base_tornado_alley') return { events: [] };
    const alreadyUsed = (ctx.state.usedBaseAbilitiesThisTurn ?? [])
        .some(entry => entry.baseIndex === ctx.baseIndex && entry.baseDefId === 'base_tornado_alley');
    if (alreadyUsed) return { events: [] };
    const candidates = collectMinionTargets(ctx.state, (minion, baseIndex) => {
        if (baseIndex === ctx.baseIndex) return false;
        return minion.uid !== ctx.minionUid;
    });
    if (candidates.length === 0) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(tornadoAlleyPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseIndex: ctx.baseIndex,
        candidates,
        sourcePlayerId: ctx.playerId,
        sourceDefId: 'base_tornado_alley',
        sourceKind: 'nonAction',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    }));
}

const tornadoAlleyPromptProgram = createPromptProgram<TornadoAlleyContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_tornado_alley',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `base_tornado_alley_${context.now}`,
        context.playerId,
        '龙卷风走廊：你可以把另一个随从移动到这里',
        [
            createSkipOption(),
            ...buildMinionTargetOptions(context.candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceKind: 'nonAction',
                effectType: 'move',
            }),
        ],
        {
            sourceId: 'base_tornado_alley',
            titleKey: 'ui.tornados_tornado_alley_title',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice;
        if (choice.skip || !choice.minionUid || choice.baseIndex === undefined || !choice.defId) return { events: [] };
        return {
            events: [
                {
                    type: SU_EVENTS.BASE_ABILITY_USED,
                    payload: { playerId, baseIndex: context.baseIndex, baseDefId: 'base_tornado_alley' },
                    timestamp,
                } as BaseAbilityUsedEvent,
                ...moveEvents(state, choice.minionUid, choice.defId, choice.baseIndex, context.baseIndex, 'base_tornado_alley', timestamp, {
                    sourcePlayerId: context.sourcePlayerId,
                    sourceDefId: context.sourceDefId,
                    sourceKind: context.sourceKind,
                    sourceControllerId: context.sourceControllerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                }),
            ],
        };
    },
});

export function registerTornadosAbilities(): void {
    registerAbilityProgram('tornados_monster_tornado', 'talent', { program: createEffectProgram(tornadosMonsterTornado) });
    registerAbilityProgram('tornados_cyclone', 'talent', { program: createEffectProgram(tornadosCyclone) });
    registerAbilityProgram('tornados_twister', 'onPlay', { program: createEffectProgram(tornadosTwister) });
    registerSimpleAbility('tornados_trade_winds', 'onPlay', tornadosTradeWinds);
    registerSimpleAbility('tornados_carried_away', 'onPlay', tornadosCarriedAway);
    registerSimpleAbility('tornados_whirlwinds', 'onPlay', tornadosWhirlwinds);
    registerSimpleAbility('tornados_gone_with_the_wind', 'special', tornadosGoneWithTheWind);
    registerSimpleAbility('tornados_ripped_off', 'onPlay', tornadosRippedOff);
    registerSimpleAbility('tornados_picked_up', 'special', tornadosPickedUp);
    registerSimpleAbility('tornados_not_in_kansas', 'onPlay', tornadosNotInKansas);
    registerSimpleAbility('tornados_over_the_rainbow', 'special', tornadosOverTheRainbow);
    registerTrigger('tornados_dust_devil', 'beforeScoring', tornadosDustDevilBeforeScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerExtended('base_trailer_park', 'onMinionMoved', baseTrailerPark, { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerExtended('base_tornado_alley', 'onMinionMoved', baseTornadoAlley, { effectContract: SHAYU_TRIGGER_CONTRACT });
}
