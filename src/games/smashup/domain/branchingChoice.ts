import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    createSimpleChoice,
    type PromptOption,
    type SimpleChoiceTargetType,
} from '../../../engine/systems/InteractionSystem';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
    getResolutionFrameById,
    getResolutionFrames,
    pushResolutionFrame,
    updateResolutionFrame,
    upsertResolutionFrame,
} from '../../../engine/systems/resolutionStack';
import { createEffectProgram, createPromptProgram, executeAbilityProgram } from './abilityRuntime';
import type { SmashUpCore, SmashUpEvent, SmashUpReactionResourceFootprint, SmashUpReactionResourceRef } from './types';

type PromptDisplayMode = 'card' | 'button';

export interface BranchingChoiceOption {
    id: string;
    branchId: string;
    label: string;
    labelKey?: string;
    labelParams?: Record<string, string | number>;
    value?: Record<string, unknown>;
    displayMode?: PromptDisplayMode;
    disabled?: boolean;
    disabledReason?: string;
    disabledReasonKey?: string;
    disabledReasonParams?: Record<string, string | number>;
    _ai?: PromptOption['_ai'];
    /**
     * 该分支实际可能读写的具体资源。
     *
     * 这不是另一套读写抽象桶：分支选项应优先由 Effect DSL primitive
     * 的 footprint 生成，用于让 OR/optional prompt 在运行时产物里保留真实
     * minion/base/playerHand/playerPlayLimit 等资源引用。
     */
    footprint?: SmashUpReactionResourceFootprint;
}

export interface BranchingChoiceUpgrade {
    mode: 'optional-both';
    consumeEvents?: SmashUpEvent[];
}

export interface QueueBranchingChoiceArgs {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: string;
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    options: BranchingChoiceOption[];
    executeBranch: BranchExecutor;
    targetType?: SimpleChoiceTargetType;
    planContext?: Record<string, unknown>;
    upgrade?: BranchingChoiceUpgrade;
}

interface PendingBranchPlan {
    playerId: PlayerId;
    sourceId: string;
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    targetType: SimpleChoiceTargetType;
    planContext?: Record<string, unknown>;
    remainingOptions: BranchingChoiceOption[];
    upgrade?: BranchingChoiceUpgrade;
}

interface BranchingChoiceFrameMeta {
    pendingPlan?: PendingBranchPlan;
}

interface BranchingChoicePromptContext {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: string;
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    options: BranchingChoiceOption[];
    targetType: SimpleChoiceTargetType;
    executeBranch: BranchExecutor;
    planContext?: Record<string, unknown>;
    upgrade?: BranchingChoiceUpgrade;
    followUpChoice?: boolean;
}

interface BranchingChoiceFollowUpAfterEventsContext {
    matchState?: MatchState<SmashUpCore>;
    playerId: PlayerId;
    timestamp: number;
    pendingPlan: PendingBranchPlan;
    branchingFrameId?: string;
}

interface EmitBranchingChoiceEventsThenFollowUpContext extends BranchingChoiceFollowUpAfterEventsContext {
    events: SmashUpEvent[];
}

const BRANCHING_CHOICE_FRAME_META_KEY = '_branchingChoiceFrameMeta';
const BRANCHING_CHOICE_FRAME_KIND = 'smashup:branching-choice';
const BRANCHING_CHOICE_RUNTIME_SOURCE = 'smashup_branching_choice';
const branchExecutorRegistry = new Map<string, BranchExecutor>();

export interface BranchExecutionResult {
    state: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
}

export type BranchExecutor = (args: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    selection: Record<string, unknown>;
    planContext: Record<string, unknown> | undefined;
    random: RandomFn;
    timestamp: number;
}) => BranchExecutionResult | undefined;

function registerBranchExecutor(sourceId: string, executeBranch: BranchExecutor): void {
    const existing = branchExecutorRegistry.get(sourceId);
    if (existing && existing !== executeBranch) {
        throw new Error(`SmashUp branching choice executor 重复注册且实现不一致: ${sourceId}`);
    }
    branchExecutorRegistry.set(sourceId, executeBranch);
}

function requireBranchExecutor(sourceId: string): BranchExecutor {
    const executeBranch = branchExecutorRegistry.get(sourceId);
    if (!executeBranch) {
        throw new Error(`SmashUp branching choice executor 缺失: ${sourceId}`);
    }
    return executeBranch;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
}

function normalizeBranchingOptions(value: unknown): BranchingChoiceOption[] {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
        const option = asRecord(entry);
        if (!option || typeof option.id !== 'string' || typeof option.label !== 'string') {
            return undefined;
        }
        const optionValue = asRecord(option.value);
        const branchId = typeof optionValue?.branchId === 'string'
            ? optionValue.branchId
            : typeof option.branchId === 'string'
                ? option.branchId
                : undefined;
        if (!branchId) return undefined;

        return {
            id: option.id,
            branchId,
            label: option.label,
            ...(typeof option.labelKey === 'string' ? { labelKey: option.labelKey } : {}),
            ...(option.labelParams && typeof option.labelParams === 'object' ? { labelParams: option.labelParams as Record<string, string | number> } : {}),
            ...(optionValue ? { value: optionValue } : {}),
            ...(option.displayMode === 'card' || option.displayMode === 'button' ? { displayMode: option.displayMode } : {}),
            ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
            ...(typeof option.disabledReason === 'string' ? { disabledReason: option.disabledReason } : {}),
            ...(typeof option.disabledReasonKey === 'string' ? { disabledReasonKey: option.disabledReasonKey } : {}),
            ...(option.disabledReasonParams && typeof option.disabledReasonParams === 'object'
                ? { disabledReasonParams: option.disabledReasonParams as Record<string, string | number> }
                : {}),
            ...(option._ai ? { _ai: option._ai as PromptOption['_ai'] } : {}),
            ...(isReactionResourceFootprint(option.footprint) ? { footprint: option.footprint } : {}),
        } satisfies BranchingChoiceOption;
    }).filter((entry): entry is BranchingChoiceOption => !!entry);
}

function isReactionResourceRef(value: unknown): value is SmashUpReactionResourceRef {
    return !!value && typeof value === 'object' && typeof (value as { kind?: unknown }).kind === 'string';
}

function isReactionResourceFootprint(value: unknown): value is SmashUpReactionResourceFootprint {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { reads?: unknown; writes?: unknown };
    return Array.isArray(candidate.reads)
        && Array.isArray(candidate.writes)
        && candidate.reads.every(isReactionResourceRef)
        && candidate.writes.every(isReactionResourceRef);
}

function hasPendingInteraction(state: MatchState<SmashUpCore>): boolean {
    return !!state.sys.interaction?.current || (state.sys.interaction?.queue?.length ?? 0) > 0;
}

function getBranchingChoiceFrameMeta(
    state: MatchState<SmashUpCore>,
    frameId?: string,
): BranchingChoiceFrameMeta | undefined {
    const frame = getResolutionFrameById(state, frameId);
    const meta = frame?.metadata ? asRecord(frame.metadata[BRANCHING_CHOICE_FRAME_META_KEY]) : undefined;
    if (!meta) return undefined;

    const pendingPlanRaw = asRecord(meta.pendingPlan);
    return {
        pendingPlan: pendingPlanRaw
            ? {
                playerId: typeof pendingPlanRaw.playerId === 'string' ? pendingPlanRaw.playerId : '0',
                sourceId: typeof pendingPlanRaw.sourceId === 'string' ? pendingPlanRaw.sourceId : '',
                title: typeof pendingPlanRaw.title === 'string' ? pendingPlanRaw.title : '',
                ...(typeof pendingPlanRaw.titleKey === 'string' ? { titleKey: pendingPlanRaw.titleKey } : {}),
                ...(pendingPlanRaw.titleParams && typeof pendingPlanRaw.titleParams === 'object'
                    ? { titleParams: pendingPlanRaw.titleParams as Record<string, string | number> }
                    : {}),
                targetType:
                    pendingPlanRaw.targetType === 'button'
                    || pendingPlanRaw.targetType === 'generic'
                    || pendingPlanRaw.targetType === 'card'
                    || pendingPlanRaw.targetType === 'base'
                    || pendingPlanRaw.targetType === 'minion'
                        ? pendingPlanRaw.targetType
                        : 'button',
                planContext: asRecord(pendingPlanRaw.planContext),
                remainingOptions: normalizeBranchingOptions(pendingPlanRaw.remainingOptions),
                upgrade: asRecord(pendingPlanRaw.upgrade) as BranchingChoiceUpgrade | undefined,
            }
            : undefined,
    };
}

function setBranchingChoiceFrameMeta(
    state: MatchState<SmashUpCore>,
    frameId: string,
    meta: BranchingChoiceFrameMeta | undefined,
): MatchState<SmashUpCore> {
    return updateResolutionFrame(state, frameId, (frame) => ({
        ...frame,
        metadata: {
            ...(frame.metadata ?? {}),
            [BRANCHING_CHOICE_FRAME_META_KEY]: meta,
        },
    }));
}

function getBranchingChoiceFrameId(state: MatchState<SmashUpCore>): string | undefined {
    const interactionFrameId = state.sys.interaction?.current?.resolutionFrameId;
    if (interactionFrameId && getBranchingChoiceFrameMeta(state, interactionFrameId)) {
        return interactionFrameId;
    }

    const activeFrameId = getActiveResolutionFrame(state)?.id;
    if (activeFrameId && getBranchingChoiceFrameMeta(state, activeFrameId)) {
        return activeFrameId;
    }

    return undefined;
}

function ensureBranchingChoiceFrame(
    state: MatchState<SmashUpCore>,
    pendingPlan: PendingBranchPlan,
    timestamp: number,
): { state: MatchState<SmashUpCore>; frameId: string } {
    const existingFrameId = getBranchingChoiceFrameId(state);
    if (existingFrameId) {
        return {
            state: setBranchingChoiceFrameMeta(state, existingFrameId, { pendingPlan }),
            frameId: existingFrameId,
        };
    }

    const activeFrame = getActiveResolutionFrame(state);
    const frameId = `${BRANCHING_CHOICE_FRAME_KIND}:${pendingPlan.sourceId}:${timestamp}`;
    const nextState = pushResolutionFrame(state, {
        id: frameId,
        kind: `${BRANCHING_CHOICE_FRAME_KIND}:${pendingPlan.sourceId}`,
        ownerGame: 'smashup',
        ownerSystem: 'smashup-branching-choice',
        ownerToken: frameId,
        ordering: 'nested-body',
        status: 'running',
        step: 'awaiting-branch-completion',
        phase: state.sys.phase,
        phaseGate: 'block-advance-when-blocked',
        metadata: {
            [BRANCHING_CHOICE_FRAME_META_KEY]: {
                pendingPlan,
            } satisfies BranchingChoiceFrameMeta,
        },
    }, {
        parentFrameId: activeFrame?.id,
    });

    return { state: nextState, frameId };
}

function buildPromptOptions(options: BranchingChoiceOption[]): PromptOption[] {
    return options.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.labelKey ? { labelKey: option.labelKey } : {}),
        ...(option.labelParams ? { labelParams: option.labelParams } : {}),
        value: {
            branchId: option.branchId,
            ...(option.value ?? {}),
        },
        ...(option.displayMode ? { displayMode: option.displayMode } : {}),
        ...(option.disabled !== undefined ? { disabled: option.disabled } : {}),
        ...(option.disabledReason ? { disabledReason: option.disabledReason } : {}),
        ...(option.disabledReasonKey ? { disabledReasonKey: option.disabledReasonKey } : {}),
        ...(option.disabledReasonParams ? { disabledReasonParams: option.disabledReasonParams } : {}),
        ...(option._ai ? { _ai: option._ai } : {}),
        ...(option.footprint ? { _resourceFootprint: option.footprint } : {}),
    }));
}

function isSkipSelection(selection: Record<string, unknown> | undefined): boolean {
    return selection?.skip === true || selection?.branchId === 'skip';
}

function createSkipBranchOption(): BranchingChoiceOption {
    return {
        id: 'skip',
        branchId: 'skip',
        label: '跳过',
        labelKey: 'ui.skip',
        value: { skip: true },
        displayMode: 'button',
    };
}

const queueBranchingChoiceFollowUpAfterEventsProgram = createEffectProgram<
    BranchingChoiceFollowUpAfterEventsContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('branching choice continuation 缺少正式 matchState');
    }

    let state = context.matchState;
    if (context.branchingFrameId) {
        state = setBranchingChoiceFrameMeta(state, context.branchingFrameId, undefined);
    }

    const queuedState = queueFollowUpBranchChoice(
        state,
        context.playerId,
        context.timestamp,
        context.pendingPlan,
    );
    if (queuedState === state && context.branchingFrameId) {
        return {
            events: [],
            matchState: completeResolutionFrame(state, context.branchingFrameId),
        };
    }
    return {
        events: [],
        matchState: queuedState,
    };
});

const emitBranchingChoiceEventsThenFollowUpProgram = createEffectProgram<
    EmitBranchingChoiceEventsThenFollowUpContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: context.events,
    context: {
        matchState: context.matchState,
        playerId: context.playerId,
        timestamp: context.timestamp,
        pendingPlan: context.pendingPlan,
        branchingFrameId: context.branchingFrameId,
    } satisfies BranchingChoiceFollowUpAfterEventsContext,
    nextProgram: queueBranchingChoiceFollowUpAfterEventsProgram,
}));

function executeSelectedBranch(args: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    selection: Record<string, unknown>;
    planContext: Record<string, unknown> | undefined;
    pendingPlan?: PendingBranchPlan;
    prefixEvents?: SmashUpEvent[];
    random: RandomFn;
    timestamp: number;
    executeBranch: BranchExecutor;
    preserveFrameUntilSettled?: boolean;
    branchingFrameId?: string;
}): BranchExecutionResult {
    const allEvents: SmashUpEvent[] = [...(args.prefixEvents ?? [])];
    const result = args.executeBranch({
        state: args.state,
        playerId: args.playerId,
        selection: args.selection,
        planContext: args.planContext,
        random: args.random,
        timestamp: args.timestamp,
    }) ?? { state: args.state, events: [] };

    allEvents.push(...result.events);

    if (args.pendingPlan) {
        if (hasPendingInteraction(result.state)) {
            return {
                state: result.state,
                events: allEvents,
            };
        }

        const continuation = executeAbilityProgram(emitBranchingChoiceEventsThenFollowUpProgram, {
            matchState: result.state,
            events: allEvents,
            playerId: args.playerId,
            timestamp: args.timestamp,
            pendingPlan: args.pendingPlan,
            branchingFrameId: args.branchingFrameId,
        });
        return {
            state: continuation.matchState ?? result.state,
            events: continuation.events as SmashUpEvent[],
        };
    }

    if (args.preserveFrameUntilSettled && args.branchingFrameId && !hasPendingInteraction(result.state)) {
        return {
            state: result.state,
            events: allEvents,
        };
    }

    return {
        state: result.state,
        events: allEvents,
    };
}

function resolveBranchingChoiceSelection(args: {
    context: BranchingChoicePromptContext;
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    value: unknown;
    random: RandomFn;
    timestamp: number;
}): BranchExecutionResult {
    const selection = asRecord(args.value);
    if (!selection || isSkipSelection(selection)) {
        return { state: args.state, events: [] };
    }

    const promptOptions = args.context.options.filter((option) => !isSkipSelection(option.value));
    const remainingOptions = args.context.upgrade?.mode === 'optional-both'
        ? promptOptions.filter((option) => option.branchId !== selection.branchId)
        : [];
    const pendingPlan = remainingOptions.length > 0
        ? {
            playerId: args.playerId,
            sourceId: args.context.sourceId,
            title: args.context.title,
            titleKey: args.context.titleKey,
            titleParams: args.context.titleParams,
            targetType: args.context.targetType,
            planContext: args.context.planContext,
            remainingOptions,
            upgrade: args.context.upgrade,
        } satisfies PendingBranchPlan
        : undefined;

    const prefixEvents = args.context.followUpChoice ? (args.context.upgrade?.consumeEvents ?? []) : [];
    let state = args.state;
    let branchingFrameId: string | undefined;
    if (pendingPlan && !args.context.followUpChoice) {
        const frame = ensureBranchingChoiceFrame(state, pendingPlan, args.timestamp);
        state = frame.state;
        branchingFrameId = frame.frameId;
    } else if (args.context.followUpChoice) {
        branchingFrameId = getBranchingChoiceFrameId(state);
    }

    return executeSelectedBranch({
        state,
        playerId: args.playerId,
        selection,
        planContext: args.context.planContext,
        pendingPlan,
        prefixEvents,
        random: args.random,
        timestamp: args.timestamp,
        executeBranch: requireBranchExecutor(args.context.sourceId),
        preserveFrameUntilSettled: args.context.followUpChoice,
        branchingFrameId,
    });
}

const branchingChoicePromptProgram = createPromptProgram<BranchingChoicePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: BRANCHING_CHOICE_RUNTIME_SOURCE,
    buildInteraction: (context) => createSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildPromptOptions(context.options),
        {
            sourceId: context.sourceId,
            targetType: context.targetType,
            autoResolveIfSingle: false,
            ...(context.titleKey ? { titleKey: context.titleKey } : {}),
            ...(context.titleParams ? { titleParams: context.titleParams } : {}),
        },
    ),
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        const result = resolveBranchingChoiceSelection({
            context,
            state,
            playerId,
            value,
            random,
            timestamp,
        });
        return {
            events: result.events,
            matchState: result.state,
        };
    },
});

function queueBranchPrompt(args: {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: string;
    title: string;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
    options: BranchingChoiceOption[];
    executeBranch: BranchExecutor;
    targetType: SimpleChoiceTargetType;
    planContext?: Record<string, unknown>;
    upgrade?: BranchingChoiceUpgrade;
    followUpChoice?: boolean;
}): MatchState<SmashUpCore> {
    registerBranchExecutor(args.sourceId, args.executeBranch);
    const result = executeAbilityProgram(branchingChoicePromptProgram, {
        matchState: args.matchState,
        playerId: args.playerId,
        now: args.now,
        sourceId: args.sourceId,
        title: args.title,
        titleKey: args.titleKey,
        titleParams: args.titleParams,
        options: args.options,
        executeBranch: args.executeBranch,
        targetType: args.targetType,
        planContext: args.planContext,
        upgrade: args.upgrade,
        followUpChoice: args.followUpChoice,
    } satisfies BranchingChoicePromptContext);
    return result.matchState ?? args.matchState;
}

function queueFollowUpBranchChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    plan: PendingBranchPlan,
): MatchState<SmashUpCore> {
    const remainingOptions = plan.remainingOptions.filter((option) => !isSkipSelection(option.value));
    if (remainingOptions.length === 0) return state;

    return queueBranchPrompt({
        matchState: state,
        playerId,
        now,
        sourceId: plan.sourceId,
        title: plan.title,
        titleKey: plan.titleKey,
        titleParams: plan.titleParams,
        options: [...remainingOptions, createSkipBranchOption()],
        executeBranch: requireBranchExecutor(plan.sourceId),
        targetType: plan.targetType,
        planContext: plan.planContext,
        upgrade: plan.upgrade,
        followUpChoice: true,
    });
}

function frameOwnsInteraction(state: MatchState<SmashUpCore>, frameId: string): boolean {
    const current = state.sys.interaction?.current;
    if (current?.resolutionFrameId === frameId) return true;
    return (state.sys.interaction?.queue ?? []).some((interaction) => interaction.resolutionFrameId === frameId);
}

function frameHasLiveChild(state: MatchState<SmashUpCore>, frameId: string): boolean {
    return getResolutionFrames(state).some((frame) =>
        frame.parentFrameId === frameId && frame.status !== 'completed',
    );
}

export function queueBranchingChoice(args: QueueBranchingChoiceArgs): MatchState<SmashUpCore> {
    return queueBranchPrompt({
        matchState: args.matchState,
        playerId: args.playerId,
        now: args.now,
        sourceId: args.sourceId,
        title: args.title,
        titleKey: args.titleKey,
        titleParams: args.titleParams,
        options: args.options,
        executeBranch: args.executeBranch,
        targetType: args.targetType ?? 'button',
        planContext: args.planContext,
        upgrade: args.upgrade,
    });
}

export function resumePendingBranchingChoiceFrames(
    state: MatchState<SmashUpCore>,
    timestamp: number,
): MatchState<SmashUpCore> {
    const candidateFrames = getResolutionFrames(state)
        .filter((frame) => frame.kind.startsWith(BRANCHING_CHOICE_FRAME_KIND))
        .slice()
        .reverse();

    let nextState = state;

    for (const frame of candidateFrames) {
        const liveFrame = getResolutionFrameById(nextState, frame.id);
        if (!liveFrame) continue;
        if (liveFrame.status !== 'running' || liveFrame.blockedBy) continue;
        if (frameHasLiveChild(nextState, liveFrame.id)) continue;
        if (frameOwnsInteraction(nextState, liveFrame.id)) continue;

        const meta = getBranchingChoiceFrameMeta(nextState, liveFrame.id);
        if (meta?.pendingPlan) {
            nextState = upsertResolutionFrame(nextState, liveFrame, { setActive: true });
            const queuedState = queueFollowUpBranchChoice(
                nextState,
                meta.pendingPlan.playerId,
                timestamp,
                meta.pendingPlan,
            );
            if (queuedState === nextState) {
                nextState = completeResolutionFrame(nextState, liveFrame.id);
                continue;
            }
            nextState = setBranchingChoiceFrameMeta(queuedState, liveFrame.id, undefined);
            return nextState;
        }

        nextState = completeResolutionFrame(nextState, liveFrame.id);
        return nextState;
    }

    return nextState;
}
