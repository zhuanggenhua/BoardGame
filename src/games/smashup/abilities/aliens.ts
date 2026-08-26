/**
 * 大杀四方 - 外星人派系能力
 *
 * 主题：干扰对手，将随从送回手牌，控制基地
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import type { MatchState, PlayerId } from '../../../engine/types';
import type {
    MinionReturnedEvent, VpAwardedEvent, SmashUpEvent,
    MinionCardDef, OngoingDetachedEvent, BaseReplacedEvent,
    CardToDeckBottomEvent,
    SmashUpCore,
    MinionPlayedEvent,
    CardsDiscardedEvent,
    CardOrTitanChoiceValue,
} from '../domain/types';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    buildActionMinionTargetOptions, buildBaseTargetOptions, buildMinionTargetOptions, buildPlayerTargetOptions, getMinionPower,
    grantContextualExtraMinion, grantExtraMinion, shuffleBaseDeck,
    applySemanticMinionEffectBatch, buildAbilityFeedback, buildFieldSourceActionOptions, buildFieldSourceActionPromptConfig, buildValidatedMoveEvents, buildValidatedReturnEvents,
    canControllerPlayTitan, getSetAsideTitansPlayableAs, playTitan,
} from '../domain/abilityHelpers';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createBranchProgram,
    createEffectProgram,
    executeAbilityProgram,
    createPromptProgram,
    createStopProgram,
} from '../domain/abilityRuntime';
import { registerTrigger, registerBaseAbilitySuppression } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getPlayerLabel } from '../domain/utils';

type AlienMinionTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type AlienInvasionPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    hasNoValidTargets?: boolean;
    selectedTarget?: {
        minionUid: string;
        defId: string;
        fromBaseIndex: number;
    };
};

type AlienTerraformPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    baseDeckEmpty?: boolean;
    hasAnyBase?: boolean;
    selectedBaseIndex?: number;
    oldBaseDefId?: string;
    newBaseDefId?: string;
};

type AlienMinionPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceBaseIndex?: number;
    sourceDefId?: string;
    hasNoValidTargets?: boolean;
    selectedTarget?: {
        minionUid: string;
        defId: string;
        baseIndex: number;
    };
};

type AlienBasePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    hasNoValidTargets?: boolean;
};

type AlienProbePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    hasNoOpponents?: boolean;
    cannotPrompt?: boolean;
    targetPlayerId?: PlayerId;
};

type AlienScoutReturnPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    scout: {
        uid: string;
        defId: string;
        owner: PlayerId;
        controller: PlayerId;
        baseIndex: number;
        baseDefId: string;
    };
};

type AlienMinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
};

type AlienBaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    newBaseDefId?: string;
};

let alienRuntimePromptCounter = 0;

function createAlienInvasionProgramContext(ctx: AbilityContext): AlienInvasionPromptContext {
    const targets = collectAlienMinionTargets(ctx.state);
    const options = buildActionMinionTargetOptions(
        targets,
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectType: 'move',
        }
    );
    const selectedOption = ctx.targetMinionUid
        ? options.find(option => {
            const value = option.value as { minionUid?: string; baseIndex?: number } | undefined;
            return value?.minionUid === ctx.targetMinionUid && value?.baseIndex === ctx.baseIndex;
        })
        : undefined;
    const selectedTarget = selectedOption
        ? targets.find(target => target.uid === ctx.targetMinionUid && target.baseIndex === ctx.baseIndex)
        : undefined;
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        hasNoValidTargets: ctx.state.bases.length <= 1 || options.length === 0,
        selectedTarget: selectedTarget
            ? {
                minionUid: selectedTarget.uid,
                defId: selectedTarget.defId,
                fromBaseIndex: selectedTarget.baseIndex,
            }
            : undefined,
    };
}

function createAlienTerraformProgramContext(ctx: AbilityContext): AlienTerraformPromptContext {
    const targetedBase = ctx.state.bases[ctx.baseIndex];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        baseDeckEmpty: ctx.state.baseDeck.length === 0,
        hasAnyBase: ctx.state.bases.length > 0,
        selectedBaseIndex: targetedBase ? ctx.baseIndex : undefined,
        oldBaseDefId: targetedBase?.defId,
    };
}

function createAlienMinionPromptContext(
    ctx: AbilityContext,
    targets: AlienMinionTarget[],
    buildOptions: (targets: AlienMinionTarget[]) => Array<{ value: { minionUid?: string; baseIndex?: number } }>,
): AlienMinionPromptContext {
    const options = buildOptions(targets);
    const selectedOption = ctx.targetMinionUid
        ? options.find(option => {
            const value = option.value;
            return value?.minionUid === ctx.targetMinionUid && value?.baseIndex === ctx.baseIndex;
        })
        : undefined;
    const selectedTarget = selectedOption
        ? targets.find(target => target.uid === ctx.targetMinionUid && target.baseIndex === ctx.baseIndex)
        : undefined;
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceBaseIndex: ctx.baseIndex,
        sourceDefId: ctx.defId,
        hasNoValidTargets: options.length === 0,
        selectedTarget: selectedTarget
            ? {
                minionUid: selectedTarget.uid,
                defId: selectedTarget.defId,
                baseIndex: selectedTarget.baseIndex,
            }
            : undefined,
    };
}

function createAlienDisintegratorProgramContext(ctx: AbilityContext): AlienMinionPromptContext {
    const targets = collectAlienMinionTargets(ctx.state).filter(target => {
        const base = ctx.state.bases[target.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === target.uid);
        return minion ? getMinionPower(ctx.state, minion, target.baseIndex) <= 3 : false;
    });
    return createAlienMinionPromptContext(
        ctx,
        targets,
        (candidates) => buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId }),
    );
}

function createAlienBeamUpProgramContext(ctx: AbilityContext): AlienMinionPromptContext {
    const targets = collectAlienMinionTargets(ctx.state);
    return createAlienMinionPromptContext(
        ctx,
        targets,
        (candidates) => buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId }),
    );
}

function createAlienAbductionProgramContext(ctx: AbilityContext): AlienMinionPromptContext {
    const targets = collectAlienMinionTargets(ctx.state);
    return createAlienMinionPromptContext(
        ctx,
        targets,
        (candidates) => buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId }),
    );
}

function createAlienCropCirclesProgramContext(ctx: AbilityContext): AlienBasePromptContext {
    const hasNoValidTargets = !ctx.state.bases.some(base => base.minions.length > 0);
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        hasNoValidTargets,
    };
}

function createAlienProbeProgramContext(ctx: AbilityContext): AlienProbePromptContext {
    const opponents = Object.keys(ctx.state.players).filter(pid => pid !== ctx.playerId);
    const options = buildPlayerTargetOptions(
        opponents.map((pid, index) => ({
            id: `player-${index}`,
            label: getPlayerLabel(pid),
            targetPlayerId: pid,
        })),
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectIntent: 'inspect',
        },
    );
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        hasNoOpponents: options.length === 0,
        cannotPrompt: !ctx.matchState,
    };
}

function createAlienSupremeOverlordProgramContext(ctx: AbilityContext): AlienMinionPromptContext {
    return createAlienMinionPromptContext(
        ctx,
        collectAlienMinionTargets(ctx.state),
        (candidates) => buildMinionTargetOptions(
            candidates,
            {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                effectType: 'affect',
            },
        ),
    );
}

function createAlienCollectorProgramContext(ctx: AbilityContext): AlienMinionPromptContext {
    const targets = collectAlienMinionTargets(ctx.state).filter(target => {
        const base = ctx.state.bases[target.baseIndex];
        const minion = base?.minions.find(candidate => candidate.uid === target.uid);
        if (!minion) return false;
        const isPod = ctx.defId === 'alien_collector_pod';
        if (!isPod && (minion.defId === 'alien_collector' || minion.defId === 'alien_collector_pod')) {
            return false;
        }
        return getMinionPower(ctx.state, minion, target.baseIndex) <= 3;
    });
    return createAlienMinionPromptContext(
        ctx,
        targets,
        (candidates) => buildMinionTargetOptions(
            candidates,
            {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                effectType: 'affect',
            },
        ),
    );
}

function collectAlienMinionTargets(core: SmashUpCore): AlienMinionTarget[] {
    const targets: AlienMinionTarget[] = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        const base = core.bases[baseIndex];
        const baseDef = getBaseDef(base.defId);
        for (const minion of base.minions) {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            targets.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${def?.name ?? minion.defId} (力量 ${getMinionPower(core, minion, baseIndex)}) @ ${baseDef?.name ?? `基地 ${baseIndex + 1}`}`,
            });
        }
    }
    return targets;
}

function buildAlienOtherBaseChoices(core: SmashUpCore, fromBaseIndex: number): Array<{ baseIndex: number; label: string }> {
    return core.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
}

function buildAlienTerraformPlayOptions(core: SmashUpCore, playerId: PlayerId): Array<{
    id: string;
    label: string;
    value: CardOrTitanChoiceValue;
    displayMode: 'button' | 'card';
}> {
    const player = core.players[playerId];
    if (!player) return [];

    const minionOptions = player.hand
        .filter(card => card.type === 'minion')
        .map((card, index) => {
            const def = getCardDef(card.defId) as MinionCardDef | undefined;
            const power = def?.power ?? 0;
            return {
                id: `hand-minion-${index}`,
                label: `${def?.name ?? card.defId} (力量 ${power})`,
                value: { cardUid: card.uid, defId: card.defId } satisfies CardOrTitanChoiceValue,
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });

    const titanOptions = getSetAsideTitansPlayableAs(core, playerId, 'minion').map((titan, index) => {
        const def = getCardDef(titan.defId);
        return {
            id: `setaside-titan-${index}`,
            label: def?.name ?? titan.defId,
            value: { titanUid: titan.uid, defId: titan.defId, playKind: 'minion' } satisfies CardOrTitanChoiceValue,
            _source: 'hand' as const,
            displayMode: 'card' as const,
        };
    });

    if (minionOptions.length === 0 && titanOptions.length === 0) {
        return [];
    }

    return [
        {
            id: 'skip',
            label: '跳过额外随从',
            labelKey: 'ui.alien_terraform_play_minion_skip_option',
            value: { skip: true, defId: '__skip__' },
            displayMode: 'button' as const,
        },
        ...minionOptions,
        ...titanOptions,
    ];
}

function buildAlienTerraformReplacementEvents(
    core: SmashUpCore,
    baseIndex: number,
    oldBaseDefId: string,
    newBaseDefId: string,
    random: AbilityContext['random'] | TriggerContext['random'],
    timestamp: number,
): SmashUpEvent[] {
    const base = core.bases[baseIndex];
    if (!base) return [];

    const events: SmashUpEvent[] = [];
    for (const action of base.ongoingActions) {
        events.push(...buildValidatedOngoingDetachEvents(core, {
            cardUid: action.uid,
            reason: 'alien_terraform',
            now: timestamp,
            expectedLocation: 'base',
        }));
    }

    events.push({
        type: SU_EVENTS.BASE_REPLACED,
        payload: {
            baseIndex,
            oldBaseDefId,
            newBaseDefId,
            keepCards: true,
        },
        timestamp,
    } as BaseReplacedEvent);

    const remainingDeck = core.baseDeck.filter(id => id !== newBaseDefId);
    const deckWithOld = [...remainingDeck, oldBaseDefId];
    const shuffled = [...deckWithOld];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    events.push(shuffleBaseDeck(shuffled, 'alien_terraform', timestamp));

    return events;
}

function buildAlienProbeHandOptions(
    hand: SmashUpCore['players'][PlayerId]['hand'],
    targetPlayerId: PlayerId,
) {
    return hand.map(card => {
        const isMinion = card.type === 'minion';
        const def = getCardDef(card.defId);
        return {
            id: card.uid,
            label: def?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId, targetPlayerId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
            disabled: !isMinion,
        };
    });
}

function buildAlienCollectorTargets(
    core: SmashUpCore,
    baseIndex: number,
    sourceDefId: string,
): AlienMinionTarget[] {
    const base = core.bases[baseIndex];
    if (!base) return [];
    const isPod = sourceDefId === 'alien_collector_pod';
    return base.minions
        .filter(minion => {
            if (!isPod && (minion.defId === 'alien_collector' || minion.defId === 'alien_collector_pod')) {
                return false;
            }
            return getMinionPower(core, minion, baseIndex) <= 3;
        })
        .map(minion => {
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            return {
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${def?.name ?? minion.defId} (力量 ${getMinionPower(core, minion, baseIndex)})`,
            };
        });
}

function buildAlienMinionReturnEvent(
    core: SmashUpCore,
    target: AlienMinionChoice | AlienMinionPromptContext['selectedTarget'] | undefined,
    reason: string,
    sourcePlayerId: PlayerId,
    timestamp: number,
): MinionReturnedEvent | undefined {
    const baseIndex = target?.baseIndex;
    const minionUid = target?.minionUid;
    if (baseIndex === undefined || !minionUid) {
        return undefined;
    }
    return buildValidatedReturnEvents(core, {
        minionUid,
        minionDefId: target?.defId ?? '',
        fromBaseIndex: baseIndex,
        reason,
        sourcePlayerId: sourcePlayerId,
        now: timestamp,
    })[0];
}

function canTriggerAlienScoutAfterScoring(ctx: TriggerContext): boolean {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceCardUid) return false;
    const scout = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    return !!scout && (scout.defId === 'alien_scout' || scout.defId === 'alien_scout_pod');
}

/** 注册外星人派系所有能力 */
export function registerAlienAbilities(): void {
    // --- 随从 ---
    registerAbilityProgram('alien_supreme_overlord', 'onPlay', {
        program: alienSupremeOverlordProgram,
        createContext: createAlienSupremeOverlordProgramContext,
    });
    registerAbilityProgram('alien_collector', 'onPlay', {
        program: alienCollectorProgram,
        createContext: createAlienCollectorProgramContext,
    });
    registerSimpleAbility('alien_invader', 'onPlay', alienInvader);
    // afterScoring：按每个侦察兵实例单独触发（perInstance），否则在同一基地多个侦察兵时
    // 若处理函数再“扫描全基地侦察兵”会导致重复创建交互/重复回手。
    registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoringPerInstance, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerAlienScoutAfterScoring,
    });
    // POD 版本会通过 registerPodOngoingAliases() 自动映射，无需手动注册
    // --- 行动卡 ---
    registerAbilityProgram('alien_invasion', 'onPlay', {
        program: alienInvasionProgram,
        createContext: createAlienInvasionProgramContext,
    });
    registerAbilityProgram('alien_disintegrator', 'onPlay', {
        program: alienDisintegratorProgram,
        createContext: createAlienDisintegratorProgramContext,
    });
    registerAbilityProgram('alien_beam_up', 'onPlay', {
        program: alienBeamUpProgram,
        createContext: createAlienBeamUpProgramContext,
    });
    registerAbilityProgram('alien_crop_circles', 'onPlay', {
        program: alienCropCirclesProgram,
        createContext: createAlienCropCirclesProgramContext,
    });
    registerAbilityProgram('alien_probe', 'onPlay', {
        program: alienProbeProgram,
        createContext: createAlienProbeProgramContext,
    });
    registerAbilityProgram('alien_terraform', 'onPlay', {
        program: alienTerraformProgram,
        createContext: createAlienTerraformProgramContext,
    });
    registerAbilityProgram('alien_abduction', 'onPlay', {
        program: alienAbductionProgram,
        createContext: createAlienAbductionProgramContext,
    });
    // 糟糕的信号：所有玩家无视此基地能力（ongoing 行动卡附着到基地）
    registerBaseAbilitySuppression('alien_jammed_signal', (state, baseIndex) => {
        return state.bases[baseIndex].ongoingActions.some((a: any) => a.defId === 'alien_jammed_signal');
    });
    registerBaseAbilitySuppression('alien_jammed_signal_pod', (state, baseIndex) => {
        return state.bases[baseIndex].ongoingActions.some((a: any) => a.defId === 'alien_jammed_signal_pod');
    });
}

// ============================================================================
// 随从能力
// ============================================================================

const alienSupremeOverlordPromptProgram = createPromptProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_supreme_overlord',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_supreme_overlord_${alienRuntimePromptCounter++}`,
        context.playerId,
        '你可以将一个随从返回到其拥有者的手上',
        [
            { id: 'skip', label: '跳过（不返回随从）', labelKey: 'ui.alien_supreme_overlord_skip_option', value: { skip: true }, displayMode: 'button' as const },
            ...buildMinionTargetOptions(
                collectAlienMinionTargets(context.matchState.core),
                {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'affect',
                },
            ),
        ],
        {
            sourceId: 'alien_supreme_overlord',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_supreme_overlord_title',
        },
    ),
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as (AlienMinionChoice & { skip?: boolean }) | undefined;
        if (selected?.skip) {
            return { matchState: state, events: [] };
        }
        const returnEvent = buildAlienMinionReturnEvent(
            state.core,
            selected,
            'alien_supreme_overlord',
            playerId,
            timestamp,
        );
        return {
            matchState: state,
            events: returnEvent ? [returnEvent] : [],
        };
    },
});

const alienSupremeOverlordProgram = createBranchProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => !!context.selectedTarget,
        then: createEffectProgram((context) => {
            const returnEvent = buildAlienMinionReturnEvent(
                context.matchState.core,
                context.selectedTarget,
                'alien_supreme_overlord',
                context.playerId,
                context.now,
            );
            return {
                events: returnEvent ? [returnEvent] : [],
            };
        }),
        else: alienSupremeOverlordPromptProgram,
    }),
});

const alienCollectorPromptProgram = createPromptProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_collector',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_collector_${alienRuntimePromptCounter++}`,
        context.playerId,
        '你可以将这个基地的一个力量≤3的随从返回其拥有者的手上',
        [
            { id: 'skip', label: '跳过（不收回随从）', labelKey: 'ui.alien_collector_skip_option', value: { skip: true }, displayMode: 'button' as const },
            ...buildMinionTargetOptions(
                buildAlienCollectorTargets(
                    context.matchState.core,
                    context.sourceBaseIndex ?? -1,
                    context.sourceDefId ?? 'alien_collector',
                ),
                {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'affect',
                },
            ),
        ],
        {
            sourceId: 'alien_collector',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_collector_title',
        },
    ),
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as (AlienMinionChoice & { skip?: boolean }) | undefined;
        if (selected?.skip) {
            return { matchState: state, events: [] };
        }
        const returnEvent = buildAlienMinionReturnEvent(
            state.core,
            selected,
            'alien_collector',
            playerId,
            timestamp,
        );
        return {
            matchState: state,
            events: returnEvent ? [returnEvent] : [],
        };
    },
});

const alienCollectorProgram = createBranchProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => !!context.selectedTarget,
        then: createEffectProgram((context) => {
            const returnEvent = buildAlienMinionReturnEvent(
                context.matchState.core,
                context.selectedTarget,
                'alien_collector',
                context.playerId,
                context.now,
            );
            return {
                events: returnEvent ? [returnEvent] : [],
            };
        }),
        else: alienCollectorPromptProgram,
    }),
});

function alienInvader(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.VP_AWARDED,
            payload: { playerId: ctx.playerId, amount: 1, reason: 'alien_invader' },
            timestamp: ctx.now,
        } as VpAwardedEvent]
    };
}

const alienScoutReturnPromptProgram = createPromptProgram<
    AlienScoutReturnPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_scout_return',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_scout_return_${context.scout.uid}_${context.now}`,
        context.playerId,
        '侦察兵：基地记分后，是否将此侦察兵返回手牌？',
        [
            ...buildFieldSourceActionOptions({
                type: 'minion',
                uid: context.scout.uid,
                defId: context.scout.defId,
                baseIndex: context.scout.baseIndex,
                label: '返回手牌',
                labelKey: 'ui.alien_scout_return_option',
            }, { returnIt: true }),
            {
                id: 'no',
                label: '留在基地',
                labelKey: 'ui.alien_scout_stay_option',
                value: { returnIt: false },
                displayMode: 'button' as const,
            },
        ],
        buildFieldSourceActionPromptConfig({
            sourceId: 'alien_scout_return',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_scout_return_title',
        }),
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as { returnIt?: boolean } | undefined;
        if (!selected?.returnIt) {
            return { matchState: state, events: [] };
        }

        const scout = context.scout;
        const base = state.core.bases[scout.baseIndex];
        const stillThere = !!base?.minions?.some(minion => minion.uid === scout.uid);
        if (!stillThere) {
            return { matchState: state, events: [] };
        }

        return {
            matchState: state,
            events: buildValidatedReturnEvents(state.core, {
                minionUid: scout.uid,
                minionDefId: scout.defId,
                fromBaseIndex: scout.baseIndex,
                toPlayerId: scout.owner,
                reason: 'alien_scout',
                sourcePlayerId: scout.controller,
                now: timestamp,
            }),
        };
    },
});

function alienScoutAfterScoringPerInstance(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (ctx.baseIndex === undefined) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return [];

    const scout = ctx.sourceCardUid
        ? base.minions.find(m => m.uid === ctx.sourceCardUid)
        : base.minions.find(m => m.defId === 'alien_scout' || m.defId === 'alien_scout_pod');
    if (!scout || (scout.defId !== 'alien_scout' && scout.defId !== 'alien_scout_pod')) {
        return [];
    }

    if (!ctx.matchState) return [];

    const result = executeAbilityProgram(alienScoutReturnPromptProgram, {
        matchState: ctx.matchState,
        playerId: scout.controller,
        now: ctx.now,
        scout: {
            uid: scout.uid,
            defId: scout.defId,
            owner: scout.owner,
            controller: scout.controller,
            baseIndex: ctx.baseIndex,
            baseDefId: base.defId,
        },
    });

    return {
        events: result.events,
        matchState: result.matchState,
    };
}

// ============================================================================
// 行动卡能力
// ============================================================================

const alienInvasionDestinationPromptProgram = createPromptProgram<
    AlienInvasionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_invasion_choose_base',
    buildInteraction: (context) => {
        const selectedTarget = context.selectedTarget;
        if (!selectedTarget) {
            throw new Error('Alien invasion runtime 缺少 selectedTarget');
        }
        return createAbilityRuntimeSimpleChoice(
            `alien_invasion_base_${alienRuntimePromptCounter++}`,
            context.playerId,
            '选择要移动到的基地',
            buildBaseTargetOptions(
                buildAlienOtherBaseChoices(context.matchState.core, selectedTarget.fromBaseIndex),
                context.matchState.core,
            ),
            {
                sourceId: 'alien_invasion_choose_base',
                targetType: 'base',
                autoResolveIfSingle: false,
                titleKey: 'ui.alien_invasion_choose_base_title',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as AlienBaseChoice | undefined;
        const selectedTarget = context.selectedTarget;
        if (selected?.baseIndex === undefined || !selectedTarget) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selectedTarget.minionUid,
                minionDefId: selectedTarget.defId,
                fromBaseIndex: selectedTarget.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                sourcePlayerId: context.playerId,
                sourceDefId: 'alien_invasion',
                sourceControllerId: context.playerId,
                sourceBaseIndex: selectedTarget.fromBaseIndex,
                reason: 'alien_invasion',
                now: timestamp,
            }),
        };
    },
});

const alienInvasionPromptProgram = createPromptProgram<
    AlienInvasionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_invasion_choose_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_invasion_${alienRuntimePromptCounter++}`,
        context.playerId,
        '选择要移动的随从',
        buildActionMinionTargetOptions(
            collectAlienMinionTargets(context.matchState.core),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'move',
            },
        ),
        {
            sourceId: 'alien_invasion_choose_minion',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_invasion_choose_minion_title',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as AlienMinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                selectedTarget: {
                    minionUid: selected.minionUid,
                    defId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                },
            },
            nextProgram: alienInvasionDestinationPromptProgram,
        };
    },
});

const alienTerraformPlayMinionPromptProgram = createPromptProgram<
    AlienTerraformPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_terraform_play_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_terraform_play_minion_${alienRuntimePromptCounter++}`,
        context.playerId,
        '适居化：你可以在新基地上额外打出一个随从',
        buildAlienTerraformPlayOptions(context.matchState.core, context.playerId),
        {
            sourceId: 'alien_terraform_play_minion',
            targetType: 'hand',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_terraform_play_minion_title',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as CardOrTitanChoiceValue;
        if (selected.skip) {
            return { matchState: state, events: [] };
        }
        if (context.selectedBaseIndex === undefined || !context.newBaseDefId) {
            return { matchState: state, events: [] };
        }

        if (selected.titanUid) {
            const selectedTitan = state.core.titans?.find((titan) =>
                titan.uid === selected.titanUid
                && titan.defId === selected.defId
                && titan.controllerId === playerId
                && titan.location.zone === 'setaside',
            );
            if (!selectedTitan || !canControllerPlayTitan(state.core, playerId, selectedTitan.uid)) {
                return { matchState: state, events: [] };
            }
            return {
                matchState: state,
                events: [
                    playTitan(
                        selectedTitan,
                        playerId,
                        context.selectedBaseIndex,
                        'alien_terraform',
                        timestamp,
                        context.newBaseDefId,
                    ),
                ],
            };
        }

        const player = state.core.players[playerId];
        const selectedCard = player.hand.find(card =>
            card.uid === selected.cardUid
            && card.defId === selected.defId
            && card.type === 'minion',
        );
        if (!selectedCard) {
            return { matchState: state, events: [] };
        }

        const def = getCardDef(selectedCard.defId) as MinionCardDef | undefined;
        return {
            matchState: state,
            events: [
                grantExtraMinion(playerId, 'alien_terraform', timestamp),
                {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: selectedCard.uid,
                        defId: selectedCard.defId,
                        ownerId: selectedCard.owner,
                        baseIndex: context.selectedBaseIndex,
                        baseDefId: context.newBaseDefId,
                        power: def?.power ?? 0,
                        reason: 'alien_terraform',
                    },
                    timestamp,
                } as MinionPlayedEvent,
            ],
        };
    },
});

const alienTerraformReplacementPromptProgram = createPromptProgram<
    AlienTerraformPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_terraform_choose_replacement',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_terraform_choose_replacement_${alienRuntimePromptCounter++}`,
        context.playerId,
        '地形改造：从基地牌库中选择一张基地进行替换',
        context.matchState.core.baseDeck.map((baseDefId, index) => {
            const baseDef = getBaseDef(baseDefId);
            return {
                id: `replacement-${index}`,
                label: baseDef?.name ?? baseDefId,
                value: { newBaseDefId: baseDefId, baseDefId },
                displayMode: 'card' as const,
            };
        }),
        {
            sourceId: 'alien_terraform_choose_replacement',
            targetType: 'generic',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_terraform_choose_replacement_title',
        },
    ),
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const selected = value as AlienBaseChoice | undefined;
        if (context.selectedBaseIndex === undefined || !selected?.newBaseDefId) {
            return { matchState: state, events: [] };
        }

        const base = state.core.bases[context.selectedBaseIndex];
        if (!base) {
            return { matchState: state, events: [] };
        }

        const events = buildAlienTerraformReplacementEvents(
            state.core,
            context.selectedBaseIndex,
            base.defId,
            selected.newBaseDefId,
            random,
            timestamp,
        );
        const playOptions = buildAlienTerraformPlayOptions(state.core, playerId);
        if (playOptions.length === 0) {
            return {
                matchState: state,
                events,
            };
        }

        return {
            matchState: state,
            events,
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                selectedBaseIndex: context.selectedBaseIndex,
                oldBaseDefId: base.defId,
                newBaseDefId: selected.newBaseDefId,
            },
            nextProgram: alienTerraformPlayMinionPromptProgram,
        };
    },
});

const alienTerraformPromptProgram = createPromptProgram<
    AlienTerraformPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_terraform',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_terraform_${alienRuntimePromptCounter++}`,
        context.playerId,
        '选择要替换的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            })),
            context.matchState.core,
        ),
        {
            sourceId: 'alien_terraform',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_terraform_title',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as AlienBaseChoice | undefined;
        if (selected?.baseIndex === undefined) {
            return { matchState: state, events: [] };
        }
        const targetBase = state.core.bases[selected.baseIndex];
        if (!targetBase) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                selectedBaseIndex: selected.baseIndex,
                oldBaseDefId: targetBase.defId,
            },
            nextProgram: alienTerraformReplacementPromptProgram,
        };
    },
});

const alienInvasionProgram = createBranchProgram<
    AlienInvasionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => !!context.selectedTarget,
        then: alienInvasionDestinationPromptProgram,
        else: alienInvasionPromptProgram,
    }),
});

const alienTerraformProgram = createBranchProgram<
    AlienTerraformPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.baseDeckEmpty,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.base_deck_empty', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => context.selectedBaseIndex !== undefined,
        then: alienTerraformReplacementPromptProgram,
        else: createBranchProgram({
            when: (context) => !context.hasAnyBase,
            then: createStopProgram(),
            else: alienTerraformPromptProgram,
        }),
    }),
});

const alienDisintegratorPromptProgram = createPromptProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_disintegrator',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_disintegrator_${alienRuntimePromptCounter++}`,
        context.playerId,
        'ui.alien_disintegrator_title',
        buildMinionTargetOptions(
            collectAlienMinionTargets(context.matchState.core).filter(target => {
                const base = context.matchState.core.bases[target.baseIndex];
                const minion = base?.minions.find(candidate => candidate.uid === target.uid);
                return minion ? getMinionPower(context.matchState.core, minion, target.baseIndex) <= 3 : false;
            }),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'alien_disintegrator',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_disintegrator_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as AlienMinionChoice | undefined;
        const baseIndex = selected?.baseIndex;
        const minionUid = selected?.minionUid;
        if (baseIndex === undefined || !minionUid) {
            return { matchState: state, events: [] };
        }
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(minion => minion.uid === minionUid);
        if (!target) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: target.uid,
                    defId: target.defId,
                    ownerId: target.owner,
                    ...(target.owner !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                    reason: 'alien_disintegrator',
                },
                timestamp,
            } as CardToDeckBottomEvent],
        };
    },
});

const alienDisintegratorProgram = createBranchProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => !!context.selectedTarget,
        then: createEffectProgram((context) => {
            const target = context.selectedTarget;
            if (!target) return { events: [] };
            const base = context.matchState.core.bases[target.baseIndex];
            const minion = base?.minions.find(candidate => candidate.uid === target.minionUid);
            if (!minion) return { events: [] };
            return {
                events: [{
                    type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                    payload: {
                        cardUid: minion.uid,
                        defId: minion.defId,
                        ownerId: minion.owner,
                        ...(minion.owner !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                        reason: 'alien_disintegrator',
                    },
                    timestamp: context.now,
                } as CardToDeckBottomEvent],
            };
        }),
        else: alienDisintegratorPromptProgram,
    }),
});

const alienBeamUpPromptProgram = createPromptProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_beam_up',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_beam_up_${alienRuntimePromptCounter++}`,
        context.playerId,
        '选择要返回手牌的随从',
        buildMinionTargetOptions(
            collectAlienMinionTargets(context.matchState.core),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'alien_beam_up',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_beam_up_title',
        },
    ),
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as AlienMinionChoice | undefined;
        const baseIndex = selected?.baseIndex;
        const minionUid = selected?.minionUid;
        if (baseIndex === undefined || !minionUid) {
            return { matchState: state, events: [] };
        }
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(minion => minion.uid === minionUid);
        if (!target) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedReturnEvents(state.core, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: baseIndex,
                toPlayerId: target.owner,
                reason: 'alien_beam_up',
                sourcePlayerId: playerId,
                now: timestamp,
            }),
        };
    },
});

const alienBeamUpProgram = createBranchProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: createBranchProgram({
        when: (context) => !!context.selectedTarget,
        then: createEffectProgram((context) => {
            const target = context.selectedTarget;
            if (!target) return { events: [] };
            const base = context.matchState.core.bases[target.baseIndex];
            const minion = base?.minions.find(candidate => candidate.uid === target.minionUid);
            if (!minion) return { events: [] };
            return {
                events: buildValidatedReturnEvents(context.matchState.core, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: target.baseIndex,
                    toPlayerId: minion.owner,
                    reason: 'alien_beam_up',
                    sourcePlayerId: context.playerId,
                    now: context.now,
                }),
            };
        }),
        else: alienBeamUpPromptProgram,
    }),
});

const alienCropCirclesPromptProgram = createPromptProgram<
    AlienBasePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_crop_circles',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_crop_circles_${alienRuntimePromptCounter++}`,
        context.playerId,
        '选择一个基地，将随从返回手牌',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: `${getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`} (${base.minions.length} 个随从)`,
                }))
                .filter(candidate => context.matchState.core.bases[candidate.baseIndex]?.minions.length > 0),
            context.matchState.core,
        ),
        {
            sourceId: 'alien_crop_circles',
            targetType: 'base',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_crop_circles_title',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as AlienBaseChoice | undefined;
        const baseIndex = selected?.baseIndex;
        if (baseIndex === undefined) {
            return { matchState: state, events: [] };
        }
        const base = state.core.bases[baseIndex];
        if (!base) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildCropCirclesReturnEvents(state.core, baseIndex, base.minions.map(minion => minion.uid), timestamp, playerId),
        };
    },
});

const alienCropCirclesProgram = createBranchProgram<
    AlienBasePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)],
    })),
    else: alienCropCirclesPromptProgram,
});

const alienProbeDiscardPromptProgram = createPromptProgram<
    AlienProbePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_probe',
    buildInteraction: (context) => {
        if (!context.targetPlayerId) {
            throw new Error('Alien probe runtime 缺少 targetPlayerId');
        }
        const targetPlayer = context.matchState.core.players[context.targetPlayerId];
        const interaction = createAbilityRuntimeSimpleChoice(
            `alien_probe_${alienRuntimePromptCounter++}`,
            context.playerId,
            '选择对手手牌中的一张随从，让其弃掉',
            targetPlayer ? buildAlienProbeHandOptions(targetPlayer.hand, context.targetPlayerId) : [],
            {
                sourceId: 'alien_probe',
                targetType: 'generic',
                autoResolveIfSingle: false,
                titleKey: 'ui.alien_probe_discard_title',
            },
        );
        (interaction.data as { optionsGenerator?: (state: MatchState<SmashUpCore>) => unknown[] }).optionsGenerator = (state) => {
            const nextTargetPlayer = state.core.players[context.targetPlayerId!];
            return nextTargetPlayer ? buildAlienProbeHandOptions(nextTargetPlayer.hand, context.targetPlayerId!) : [];
        };
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const targetPlayerId = context.targetPlayerId;
        if (!targetPlayerId) {
            return { matchState: state, events: [] };
        }
        const targetPlayer = state.core.players[targetPlayerId];
        const selected = value as { cardUid?: string } | undefined;
        const cardUid = selected?.cardUid;
        if (!targetPlayer || !cardUid) {
            return { matchState: state, events: [] };
        }
        const card = targetPlayer.hand.find(entry => entry.uid === cardUid && entry.type === 'minion');
        if (!card) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: targetPlayerId,
                    cardUids: [card.uid],
                },
                timestamp,
            } as CardsDiscardedEvent],
        };
    },
});

const alienProbeChooseTargetPromptProgram = createPromptProgram<
    AlienProbePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_probe_choose_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_probe_choose_target_${alienRuntimePromptCounter++}`,
        context.playerId,
        '选择要查看手牌的玩家',
        buildPlayerTargetOptions(
            Object.keys(context.matchState.core.players)
                .filter(pid => pid !== context.playerId)
                .map((pid, index) => ({
                    id: `player-${index}`,
                    label: getPlayerLabel(pid),
                    targetPlayerId: pid,
                })),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectIntent: 'inspect',
            },
        ),
        {
            sourceId: 'alien_probe_choose_target',
            targetType: 'player',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_probe_choose_target_title',
        },
    ),
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as { targetPlayerId?: PlayerId } | undefined;
        const targetPlayerId = selected?.targetPlayerId;
        if (!targetPlayerId) {
            return { matchState: state, events: [] };
        }
        const targetPlayer = state.core.players[targetPlayerId];
        const minionCards = targetPlayer?.hand.filter(card => card.type === 'minion') ?? [];
        if (minionCards.length === 0) {
            return {
                matchState: state,
                events: [buildAbilityFeedback(playerId, 'feedback.no_minions_in_hand', timestamp)],
            };
        }
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                targetPlayerId,
            },
            nextProgram: alienProbeDiscardPromptProgram,
        };
    },
});

const alienProbeProgram = createBranchProgram<
    AlienProbePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoOpponents || !!context.cannotPrompt,
    then: createStopProgram(),
    else: createBranchProgram({
        when: (context) => !!context.targetPlayerId,
        then: createBranchProgram({
            when: (context) => {
                const targetPlayerId = context.targetPlayerId;
                if (!targetPlayerId) return false;
                const targetPlayer = context.matchState.core.players[targetPlayerId];
                return (targetPlayer?.hand.filter(card => card.type === 'minion').length ?? 0) === 0;
            },
            then: createEffectProgram((context) => ({
                events: [buildAbilityFeedback(context.playerId, 'feedback.no_minions_in_hand', context.now)],
            })),
            else: alienProbeDiscardPromptProgram,
        }),
        else: alienProbeChooseTargetPromptProgram,
    }),
});

const alienAbductionPromptProgram = createPromptProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'alien_abduction',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `alien_abduction_${alienRuntimePromptCounter++}`,
        context.playerId,
        '选择要返回手牌的随从',
        buildMinionTargetOptions(
            collectAlienMinionTargets(context.matchState.core),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'alien_abduction',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.alien_abduction_title',
        },
    ),
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as AlienMinionChoice | undefined;
        const baseIndex = selected?.baseIndex;
        const minionUid = selected?.minionUid;
        if (baseIndex === undefined || !minionUid) {
            return { matchState: state, events: [] };
        }
        const base = state.core.bases[baseIndex];
        const target = base?.minions.find(minion => minion.uid === minionUid);
        if (!target) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [
                ...buildValidatedReturnEvents(state.core, {
                    minionUid: target.uid,
                    minionDefId: target.defId,
                    fromBaseIndex: baseIndex,
                    toPlayerId: target.owner,
                    reason: 'alien_abduction',
                    sourcePlayerId: playerId,
                    now: timestamp,
                }),
                grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'alien_abduction'),
            ],
        };
    },
});

const alienAbductionProgram = createBranchProgram<
    AlienMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    when: (context) => !!context.hasNoValidTargets,
    then: createEffectProgram((context) => ({
        events: [grantContextualExtraMinion({ playerId: context.playerId, now: context.now, matchState: context.matchState }, 'alien_abduction')],
    })),
    else: createBranchProgram({
        when: (context) => !!context.selectedTarget,
        then: createEffectProgram((context) => {
            const target = context.selectedTarget;
            if (!target) return { events: [] };
            const base = context.matchState.core.bases[target.baseIndex];
            const minion = base?.minions.find(candidate => candidate.uid === target.minionUid);
            if (!minion) return { events: [] };
            return {
                events: [
                    ...buildValidatedReturnEvents(context.matchState.core, {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex: target.baseIndex,
                        toPlayerId: minion.owner,
                        reason: 'alien_abduction',
                        sourcePlayerId: context.playerId,
                        now: context.now,
                    }),
                    grantContextualExtraMinion({ playerId: context.playerId, now: context.now, matchState: context.matchState }, 'alien_abduction'),
                ],
            };
        }),
        else: alienAbductionPromptProgram,
    }),
});

function buildCropCirclesReturnEvents(
    core: SmashUpCore,
    baseIndex: number,
    selectedMinionUids: string[],
    timestamp: number,
    sourcePlayerId?: string,
): SmashUpEvent[] {
    if (selectedMinionUids.length === 0) return [];
    const base = core.bases[baseIndex];
    if (!base) return [];
    const selectedSet = new Set(selectedMinionUids);
    const selectedTargets = base.minions
        .filter(minion => selectedSet.has(minion.uid))
        .map(minion => ({ minion, baseIndex }));
    if (!sourcePlayerId) {
        return selectedTargets.flatMap(({ minion }) => buildValidatedReturnEvents(core, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
            toPlayerId: minion.owner,
            sourcePlayerId: sourcePlayerId,
            reason: 'alien_crop_circles',
            now: timestamp,
        }) as MinionReturnedEvent[]);
    }
    return applySemanticMinionEffectBatch(
        core,
        selectedTargets,
        {
            sourcePlayerId,
            sourceKind: 'action',
            effectType: 'return',
            respectActionProtection: true,
            mode: 'apply',
            feedbackPlayerId: sourcePlayerId,
            now: timestamp,
            buildEvents: ({ minion }) => buildValidatedReturnEvents(core, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: baseIndex,
                toPlayerId: minion.owner,
                sourcePlayerId: sourcePlayerId,
                reason: 'alien_crop_circles',
                now: timestamp,
            }) as MinionReturnedEvent[],
        },
    ).events;
}

