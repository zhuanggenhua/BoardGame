import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    createSimpleChoice,
    queueInteraction,
    type PromptOption,
    type SimpleChoiceTargetType,
} from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent } from './types';
import { reduce } from './reduce';

type PromptDisplayMode = 'card' | 'button';

export interface BranchingChoiceOption {
    id: string;
    branchId: string;
    label: string;
    value?: Record<string, unknown>;
    displayMode?: PromptDisplayMode;
    disabled?: boolean;
    disabledReason?: string;
    _ai?: PromptOption['_ai'];
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
    options: BranchingChoiceOption[];
    targetType?: SimpleChoiceTargetType;
    continuationContext?: Record<string, unknown>;
    upgrade?: BranchingChoiceUpgrade;
}

interface BranchingChoiceMeta {
    sourceId: string;
    title: string;
    targetType: SimpleChoiceTargetType;
    planContext?: Record<string, unknown>;
    upgrade?: BranchingChoiceUpgrade;
    followUpChoice?: boolean;
}

interface PendingBranchPlan {
    sourceId: string;
    title: string;
    targetType: SimpleChoiceTargetType;
    planContext?: Record<string, unknown>;
    remainingOptions: BranchingChoiceOption[];
    upgrade?: BranchingChoiceUpgrade;
}

const BRANCHING_CHOICE_META_KEY = '_branchingChoiceMeta';
const BRANCHING_CHOICE_PLAN_KEY = '_branchingChoicePlan';

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

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
}

function getContinuationContext(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    return asRecord(data?.continuationContext);
}

function getBranchingChoiceMeta(data: Record<string, unknown> | undefined): BranchingChoiceMeta | undefined {
    const continuationContext = getContinuationContext(data);
    const meta = continuationContext ? asRecord(continuationContext[BRANCHING_CHOICE_META_KEY]) : undefined;
    if (!meta) return undefined;

    const targetType = meta.targetType;
    if (
        targetType !== 'button'
        && targetType !== 'generic'
        && targetType !== 'card'
        && targetType !== 'base'
        && targetType !== 'minion'
    ) {
        return undefined;
    }

    return {
        sourceId: typeof meta.sourceId === 'string' ? meta.sourceId : '',
        title: typeof meta.title === 'string' ? meta.title : '',
        targetType,
        planContext: asRecord(meta.planContext),
        upgrade: asRecord(meta.upgrade) as BranchingChoiceUpgrade | undefined,
        followUpChoice: meta.followUpChoice === true,
    };
}

function normalizeBranchingOptions(value: unknown): BranchingChoiceOption[] {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
        const option = asRecord(entry);
        if (!option || typeof option.id !== 'string' || typeof option.label !== 'string' || typeof option.value !== 'object' || !option.value) {
            return undefined;
        }
        const optionValue = asRecord(option.value);
        if (!optionValue || typeof optionValue.branchId !== 'string') return undefined;

        return {
            id: option.id,
            branchId: optionValue.branchId,
            label: option.label,
            value: optionValue,
            ...(option.displayMode === 'card' || option.displayMode === 'button' ? { displayMode: option.displayMode } : {}),
            ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
            ...(typeof option.disabledReason === 'string' ? { disabledReason: option.disabledReason } : {}),
            ...(option._ai ? { _ai: option._ai as PromptOption['_ai'] } : {}),
        } satisfies BranchingChoiceOption;
    }).filter((entry): entry is BranchingChoiceOption => !!entry);
}

function getPromptOptions(data: Record<string, unknown> | undefined): BranchingChoiceOption[] {
    return normalizeBranchingOptions(data?.options);
}

function getPendingBranchPlan(data: Record<string, unknown> | undefined): PendingBranchPlan | undefined {
    const continuationContext = getContinuationContext(data);
    const raw = continuationContext ? asRecord(continuationContext[BRANCHING_CHOICE_PLAN_KEY]) : undefined;
    if (!raw) return undefined;

    const targetType = raw.targetType;
    if (
        targetType !== 'button'
        && targetType !== 'generic'
        && targetType !== 'card'
        && targetType !== 'base'
        && targetType !== 'minion'
    ) {
        return undefined;
    }

    return {
        sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : '',
        title: typeof raw.title === 'string' ? raw.title : '',
        targetType,
        planContext: asRecord(raw.planContext),
        remainingOptions: normalizeBranchingOptions(raw.remainingOptions),
        upgrade: asRecord(raw.upgrade) as BranchingChoiceUpgrade | undefined,
    };
}

function hasPendingInteraction(state: MatchState<SmashUpCore>): boolean {
    return !!state.sys.interaction?.current || (state.sys.interaction?.queue?.length ?? 0) > 0;
}

function attachPendingBranchPlan(
    state: MatchState<SmashUpCore>,
    plan: PendingBranchPlan,
): MatchState<SmashUpCore> {
    const interactionState = state.sys.interaction;
    if (!interactionState) return state;

    const patchInteraction = (interaction: typeof interactionState.current) => {
        if (!interaction || !interaction.data || typeof interaction.data !== 'object') return interaction;
        const data = interaction.data as Record<string, unknown>;
        const continuationContext = asRecord(data.continuationContext) ?? {};
        return {
            ...interaction,
            data: {
                ...data,
                continuationContext: {
                    ...continuationContext,
                    [BRANCHING_CHOICE_PLAN_KEY]: plan,
                },
            },
        };
    };

    if (interactionState.current) {
        return {
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...interactionState,
                    current: patchInteraction(interactionState.current),
                },
            },
        };
    }

    if ((interactionState.queue?.length ?? 0) > 0) {
        const [first, ...rest] = interactionState.queue;
        return {
            ...state,
            sys: {
                ...state.sys,
                interaction: {
                    ...interactionState,
                    queue: [patchInteraction(first), ...rest],
                },
            },
        };
    }

    return state;
}

function applyEventsToState(
    state: MatchState<SmashUpCore>,
    events: SmashUpEvent[],
): MatchState<SmashUpCore> {
    if (events.length === 0) return state;
    return {
        ...state,
        core: events.reduce((core, event) => reduce(core, event), state.core),
    };
}

function stripAppliedCore(
    baseState: MatchState<SmashUpCore>,
    derivedState: MatchState<SmashUpCore>,
): MatchState<SmashUpCore> {
    return {
        ...derivedState,
        core: baseState.core,
    };
}

function buildPromptOptions(options: BranchingChoiceOption[]): PromptOption[] {
    return options.map((option) => ({
        id: option.id,
        label: option.label,
        value: {
            branchId: option.branchId,
            ...(option.value ?? {}),
        },
        ...(option.displayMode ? { displayMode: option.displayMode } : {}),
        ...(option.disabled !== undefined ? { disabled: option.disabled } : {}),
        ...(option.disabledReason ? { disabledReason: option.disabledReason } : {}),
        ...(option._ai ? { _ai: option._ai } : {}),
    }));
}

function queueBranchPrompt(args: {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: string;
    title: string;
    options: BranchingChoiceOption[];
    targetType: SimpleChoiceTargetType;
    continuationContext?: Record<string, unknown>;
    upgrade?: BranchingChoiceUpgrade;
    followUpChoice?: boolean;
}): MatchState<SmashUpCore> {
    const interaction = createSimpleChoice(
        `${args.sourceId}_${args.now}`,
        args.playerId,
        args.title,
        buildPromptOptions(args.options),
        {
            sourceId: args.sourceId,
            targetType: args.targetType,
            autoResolveIfSingle: false,
        },
    );

    return queueInteraction(args.matchState, {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: {
                ...(args.continuationContext ?? {}),
                [BRANCHING_CHOICE_META_KEY]: {
                    sourceId: args.sourceId,
                    title: args.title,
                    targetType: args.targetType,
                    planContext: args.continuationContext ?? {},
                    ...(args.upgrade ? { upgrade: args.upgrade } : {}),
                    ...(args.followUpChoice ? { followUpChoice: true } : {}),
                } satisfies BranchingChoiceMeta,
            },
        },
    });
}

function isSkipSelection(selection: Record<string, unknown> | undefined): boolean {
    return selection?.skip === true || selection?.branchId === 'skip';
}

function createSkipBranchOption(): BranchingChoiceOption {
    return {
        id: 'skip',
        branchId: 'skip',
        label: '跳过',
        value: { skip: true },
        displayMode: 'button',
    };
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
        options: [...remainingOptions, createSkipBranchOption()],
        targetType: plan.targetType,
        continuationContext: plan.planContext,
        upgrade: plan.upgrade,
        followUpChoice: true,
    });
}

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
}): BranchExecutionResult {
    const allEvents: SmashUpEvent[] = [...(args.prefixEvents ?? [])];
    const executionState = applyEventsToState(args.state, args.prefixEvents ?? []);
    const result = args.executeBranch({
        state: executionState,
        playerId: args.playerId,
        selection: args.selection,
        planContext: args.planContext,
        random: args.random,
        timestamp: args.timestamp,
    }) ?? { state: executionState, events: [] };

    allEvents.push(...result.events);

    if (args.pendingPlan) {
        if (hasPendingInteraction(result.state)) {
            return {
                state: attachPendingBranchPlan(stripAppliedCore(args.state, result.state), args.pendingPlan),
                events: allEvents,
            };
        }

        const advancedState = applyEventsToState(result.state, result.events);
        return {
            state: stripAppliedCore(
                args.state,
                queueFollowUpBranchChoice(advancedState, args.playerId, args.timestamp, args.pendingPlan),
            ),
            events: allEvents,
        };
    }

    return {
        state: stripAppliedCore(args.state, result.state),
        events: allEvents,
    };
}

export function queueBranchingChoice(args: QueueBranchingChoiceArgs): MatchState<SmashUpCore> {
    return queueBranchPrompt({
        matchState: args.matchState,
        playerId: args.playerId,
        now: args.now,
        sourceId: args.sourceId,
        title: args.title,
        options: args.options,
        targetType: args.targetType ?? 'button',
        continuationContext: args.continuationContext,
        upgrade: args.upgrade,
    });
}

export function resolveBranchingChoiceSelection(args: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    value: unknown;
    interactionData: Record<string, unknown> | undefined;
    random: RandomFn;
    timestamp: number;
    executeBranch: BranchExecutor;
}): BranchExecutionResult | undefined {
    const meta = getBranchingChoiceMeta(args.interactionData);
    const selection = asRecord(args.value);
    if (!meta || !selection) return undefined;

    if (isSkipSelection(selection)) {
        return { state: args.state, events: [] };
    }

    const promptOptions = getPromptOptions(args.interactionData).filter((option) => !isSkipSelection(option.value));
    const remainingOptions = meta.upgrade?.mode === 'optional-both'
        ? promptOptions.filter((option) => option.branchId !== selection.branchId)
        : [];
    const pendingPlan = remainingOptions.length > 0
        ? {
            sourceId: meta.sourceId,
            title: meta.title,
            targetType: meta.targetType,
            planContext: meta.planContext,
            remainingOptions,
            upgrade: meta.upgrade,
        } satisfies PendingBranchPlan
        : undefined;

    const prefixEvents = meta.followUpChoice ? (meta.upgrade?.consumeEvents ?? []) : [];
    return executeSelectedBranch({
        state: args.state,
        playerId: args.playerId,
        selection,
        planContext: meta.planContext,
        pendingPlan,
        prefixEvents,
        random: args.random,
        timestamp: args.timestamp,
        executeBranch: args.executeBranch,
    });
}

export function resumeBranchingChoicePlan(args: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    interactionData: Record<string, unknown> | undefined;
    random: RandomFn;
    timestamp: number;
    executeBranch: BranchExecutor;
    prefixEvents?: SmashUpEvent[];
}): BranchExecutionResult | undefined {
    const plan = getPendingBranchPlan(args.interactionData);
    if (!plan) return undefined;

    const events = [...(args.prefixEvents ?? [])];
    const advancedState = applyEventsToState(args.state, events);
    return {
        state: stripAppliedCore(
            args.state,
            queueFollowUpBranchChoice(advancedState, args.playerId, args.timestamp, plan),
        ),
        events,
    };
}

export function hasBranchingChoiceSelection(value: unknown): boolean {
    const selection = asRecord(value);
    return typeof selection?.branchId === 'string';
}

export function getSelectedBranchIds(value: unknown): string[] {
    const selection = asRecord(value);
    return typeof selection?.branchId === 'string' ? [selection.branchId] : [];
}
