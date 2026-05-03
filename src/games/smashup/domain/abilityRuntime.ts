import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    createSimpleChoice,
    queueInteraction,
    type InteractionDescriptor,
    type PromptOption,
    type SimpleChoiceConfig,
} from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, SmashUpEvent } from './types';

export interface AbilityRuntimeResult<TState, TEvent> {
    events: TEvent[];
    matchState?: MatchState<TState>;
    suspended?: boolean;
    continuationId?: string;
}

export interface AbilityRuntimeEffectResult<TContext, TState, TEvent>
    extends AbilityRuntimeResult<TState, TEvent> {
    context?: TContext;
    nextProgram?: AbilityProgram<TContext, TState, TEvent>;
}

export type AbilityRuntimeEffect<TContext, TState, TEvent> = (
    context: TContext,
) => AbilityRuntimeEffectResult<TContext, TState, TEvent> | TEvent[];

export type AbilityProgram<TContext, TState, TEvent> =
    | {
        kind: 'effect';
        effect: AbilityRuntimeEffect<TContext, TState, TEvent>;
    }
    | {
        kind: 'prompt';
        sourceId: string;
        buildInteraction: (context: TContext) => InteractionDescriptor;
        queueInteraction: (
            context: TContext,
            interaction: InteractionDescriptor,
        ) => MatchState<TState>;
        onResolve: (
            args: AbilityRuntimePromptResolveArgs<TContext, TState, TEvent>,
        ) => AbilityRuntimePromptResumeResult<TContext, TState, TEvent>;
    }
    | {
        kind: 'sequence';
        steps: AbilityProgram<TContext, TState, TEvent>[];
    }
    | {
        kind: 'branch';
        when: (context: TContext) => boolean;
        then: AbilityProgram<TContext, TState, TEvent>;
        else?: AbilityProgram<TContext, TState, TEvent>;
    }
    | {
        kind: 'stop';
    };

export interface AbilityRuntimeExecutor<TContext, TState, TEvent> {
    kind: 'program';
    program: AbilityProgram<TContext, TState, TEvent>;
}

export interface AbilityRuntimePromptMarker {
    owner: 'smashup-ability-runtime';
    sourceId: string;
    continuationId?: string;
    continuation?: AbilityRuntimePromptContinuationData;
}

export interface AbilityRuntimePromptResolveArgs<TContext, TState, TEvent> {
    context: TContext;
    state: MatchState<TState>;
    playerId: PlayerId;
    value: unknown;
    interactionData: Record<string, unknown> | undefined;
    random: RandomFn;
    timestamp: number;
}

export interface AbilityRuntimePromptResumeResult<TContext, TState, TEvent>
    extends AbilityRuntimeResult<TState, TEvent> {
    context?: TContext;
    nextProgram?: AbilityProgram<TContext, TState, TEvent>;
}

export interface AbilityRuntimePromptContinuationData {
    context?: unknown;
    contextHasMatchState?: boolean;
    nextProgramId?: string;
}

export type AbilityRuntimePromptResult = {
    state: MatchState<SmashUpCore>;
    events: SmashUpEvent[];
} | undefined;

export type AbilityRuntimePromptHandler = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) => AbilityRuntimePromptResult;

const promptRegistry = new Map<string, AbilityRuntimePromptHandler>();
let promptContinuationCounter = 0;

const abilityProgramRegistry = new Map<string, AbilityProgram<any, any, any>>();
const abilityProgramIds = new WeakMap<object, string>();

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function hashStableString(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function getProgramCreationSite(): string {
    const stack = new Error().stack ?? '';
    const stackLines = stack.split('\n').slice(1);
    for (const line of stackLines) {
        if (!line.includes('abilityRuntime.ts')) {
            return line.trim();
        }
    }
    return stackLines[0]?.trim() ?? 'unknown-callsite';
}

function registerAbilityProgramNode<TContext, TState, TEvent>(
    program: AbilityProgram<TContext, TState, TEvent>,
    stableKey: string,
): AbilityProgram<TContext, TState, TEvent> {
    const cachedId = abilityProgramIds.get(program as object);
    if (cachedId) {
        return program;
    }

    abilityProgramIds.set(program as object, stableKey);
    if (!abilityProgramRegistry.has(stableKey)) {
        abilityProgramRegistry.set(stableKey, program as AbilityProgram<any, any, any>);
    }
    return program;
}

function getAbilityProgramId<TContext, TState, TEvent>(
    program: AbilityProgram<TContext, TState, TEvent>,
): string {
    const stableId = abilityProgramIds.get(program as object);
    if (!stableId) {
        throw new Error('SmashUp ability runtime program 未注册');
    }
    return stableId;
}

function requireAbilityProgramById<TContext, TState, TEvent>(
    stableId: string,
): AbilityProgram<TContext, TState, TEvent> {
    const program = abilityProgramRegistry.get(stableId);
    if (!program) {
        throw new Error(`SmashUp ability runtime program 丢失: ${stableId}`);
    }
    return program as AbilityProgram<TContext, TState, TEvent>;
}

function sanitizeRuntimeValue(value: unknown): unknown {
    if (
        value === undefined
        || typeof value === 'function'
        || typeof value === 'symbol'
    ) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeRuntimeValue(item))
            .filter((item) => item !== undefined);
    }
    const record = asPlainRecord(value);
    if (!record) {
        return value;
    }

    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
        const sanitizedEntry = sanitizeRuntimeValue(entry);
        if (sanitizedEntry !== undefined) {
            next[key] = sanitizedEntry;
        }
    }
    return next;
}

function serializeAbilityRuntimeContext(
    context: unknown,
): AbilityRuntimePromptContinuationData {
    const record = asPlainRecord(context);
    if (!record) {
        return {
            context: sanitizeRuntimeValue(context),
        };
    }

    const { matchState: _matchState, ...rest } = record;
    const serializedContext = sanitizeRuntimeValue(rest);
    return {
        ...(serializedContext !== undefined ? { context: serializedContext } : {}),
        ...(Object.prototype.hasOwnProperty.call(record, 'matchState') ? { contextHasMatchState: true } : {}),
    };
}

function rehydrateAbilityRuntimeContext<TState>(
    state: MatchState<TState>,
    continuation: AbilityRuntimePromptContinuationData | undefined,
): unknown {
    if (!continuation) {
        return undefined;
    }

    const baseContext = continuation.context;
    if (!continuation.contextHasMatchState) {
        return baseContext;
    }

    const record = asPlainRecord(baseContext);
    if (!record) {
        return { matchState: state };
    }
    return {
        ...record,
        matchState: state,
    };
}

function getAbilityRuntimePromptMarker(
    interactionData: Record<string, unknown> | undefined,
): AbilityRuntimePromptMarker | undefined {
    const marker = interactionData?.runtimePrompt as AbilityRuntimePromptMarker | undefined;
    if (marker?.owner !== 'smashup-ability-runtime' || typeof marker.sourceId !== 'string') {
        return undefined;
    }
    return marker;
}

function updateInteractionForContinuation<TState>(
    state: MatchState<TState>,
    continuationId: string,
    updateMarker: (marker: AbilityRuntimePromptMarker) => AbilityRuntimePromptMarker,
): MatchState<TState> {
    const current = state.sys.interaction?.current;
    const queue = state.sys.interaction?.queue ?? [];

    let changed = false;
    const nextCurrent = current && getAbilityRuntimePromptMarker(current.data as Record<string, unknown> | undefined)?.continuationId === continuationId
        ? (() => {
            changed = true;
            return {
                ...current,
                data: {
                    ...(asPlainRecord(current.data) ?? {}),
                    runtimePrompt: updateMarker(getAbilityRuntimePromptMarker(current.data as Record<string, unknown> | undefined)!),
                },
            };
        })()
        : current;

    const nextQueue = queue.map((interaction) => {
        const marker = getAbilityRuntimePromptMarker(interaction.data as Record<string, unknown> | undefined);
        if (!marker || marker.continuationId !== continuationId) {
            return interaction;
        }
        changed = true;
        return {
            ...interaction,
            data: {
                ...(asPlainRecord(interaction.data) ?? {}),
                runtimePrompt: updateMarker(marker),
            },
        };
    });

    if (!changed) {
        return state;
    }

    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                current: nextCurrent,
                queue: nextQueue,
            },
        },
    };
}

export function createEffectProgram<TContext, TState, TEvent>(
    effect: AbilityRuntimeEffect<TContext, TState, TEvent>,
): AbilityProgram<TContext, TState, TEvent> {
    return registerAbilityProgramNode({
        kind: 'effect',
        effect,
    }, `effect:${hashStableString(`${getProgramCreationSite()}::${effect.toString()}`)}`);
}

export function createSequenceProgram<TContext, TState, TEvent>(
    ...steps: AbilityProgram<TContext, TState, TEvent>[]
): AbilityProgram<TContext, TState, TEvent> {
    return registerAbilityProgramNode({
        kind: 'sequence',
        steps,
    }, `sequence:${steps.map((step) => getAbilityProgramId(step)).join('|')}`);
}

export function createBranchProgram<TContext, TState, TEvent>(params: {
    when: (context: TContext) => boolean;
    then: AbilityProgram<TContext, TState, TEvent>;
    else?: AbilityProgram<TContext, TState, TEvent>;
}): AbilityProgram<TContext, TState, TEvent> {
    return registerAbilityProgramNode({
        kind: 'branch',
        when: params.when,
        then: params.then,
        ...(params.else ? { else: params.else } : {}),
    }, `branch:${hashStableString(params.when.toString())}:${getAbilityProgramId(params.then)}:${params.else ? getAbilityProgramId(params.else) : 'stop'}`);
}

export function createStopProgram<TContext, TState, TEvent>(): AbilityProgram<TContext, TState, TEvent> {
    return registerAbilityProgramNode({
        kind: 'stop',
    }, 'stop');
}

export function createPromptProgram<TContext, TState, TEvent>(params: {
    sourceId: string;
    buildInteraction: (context: TContext) => InteractionDescriptor;
    queueInteraction?: (
        context: TContext,
        interaction: InteractionDescriptor,
    ) => MatchState<TState>;
    onResolve: (
        args: AbilityRuntimePromptResolveArgs<TContext, TState, TEvent>,
    ) => AbilityRuntimePromptResumeResult<TContext, TState, TEvent>;
}): AbilityProgram<TContext, TState, TEvent> {
    const promptProgram: AbilityProgram<TContext, TState, TEvent> = {
        kind: 'prompt',
        sourceId: params.sourceId,
        buildInteraction: params.buildInteraction,
        queueInteraction: params.queueInteraction ?? ((context, interaction) => {
            const candidate = context as { matchState?: MatchState<TState> };
            if (!candidate.matchState) {
                throw new Error(`SmashUp ability runtime prompt 缺少 matchState: ${params.sourceId}`);
            }
            return queueInteraction(candidate.matchState, interaction);
        }),
        onResolve: params.onResolve,
    };

    registerAbilityRuntimePrompt(params.sourceId, (state, playerId, value, interactionData, random, timestamp) => {
        const marker = getAbilityRuntimePromptMarker(interactionData);
        const continuationId = marker?.continuationId;
        if (!continuationId) {
            throw new Error(`SmashUp runtime prompt 缺少 continuationId: ${params.sourceId}`);
        }
        const continuation = marker.continuation;
        const resumeResult = promptProgram.onResolve({
            context: rehydrateAbilityRuntimeContext(state, continuation) as TContext,
            state,
            playerId,
            value,
            interactionData,
            random,
            timestamp,
        });
        const nextContext = resumeResult.context ?? rehydrateAbilityRuntimeContext(state, continuation) as TContext;
        const nextProgram = resumeResult.nextProgram
            ?? (continuation?.nextProgramId
                ? requireAbilityProgramById<TContext, TState, TEvent>(continuation.nextProgramId)
                : undefined);
        let result: AbilityRuntimeResult<TState, TEvent> = {
            events: resumeResult.events,
            matchState: resumeResult.matchState ?? state,
        };
        if (nextProgram) {
            result = mergeRuntimeResults(
                result,
                executeAbilityProgram(nextProgram, nextContext),
            );
        }
        return {
            state: (result.matchState ?? state) as MatchState<SmashUpCore>,
            events: result.events as SmashUpEvent[],
        };
    });

    return registerAbilityProgramNode(promptProgram, `prompt:${params.sourceId}`);
}

export function createAbilityRuntimeExecutor<TContext, TState, TEvent>(
    program: AbilityProgram<TContext, TState, TEvent>,
): AbilityRuntimeExecutor<TContext, TState, TEvent> {
    return {
        kind: 'program',
        program,
    };
}

export function registerAbilityRuntimePrompt(
    sourceId: string,
    handler: AbilityRuntimePromptHandler,
): void {
    promptRegistry.set(sourceId, handler);
}

export function getAbilityRuntimePromptHandler(
    sourceId: string,
): AbilityRuntimePromptHandler | undefined {
    return promptRegistry.get(sourceId);
}

export function getRegisteredAbilityRuntimePromptIds(): Set<string> {
    return new Set(promptRegistry.keys());
}

export function isAbilityRuntimeOwnedInteractionData(
    interactionData: Record<string, unknown> | undefined,
): boolean {
    return !!getAbilityRuntimePromptMarker(interactionData);
}

export function resolveAbilityRuntimePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
): AbilityRuntimePromptResult {
    if (!isAbilityRuntimeOwnedInteractionData(interactionData)) {
        return undefined;
    }
    const marker = interactionData!.runtimePrompt as AbilityRuntimePromptMarker;
    const handler = getAbilityRuntimePromptHandler(marker.sourceId);
    if (!handler) {
        throw new Error(`SmashUp runtime prompt 缺少处理器: ${marker.sourceId}`);
    }
    return handler(state, playerId, value, interactionData, random, timestamp);
}

export function createAbilityRuntimeSimpleChoice<T>(
    id: string,
    playerId: PlayerId,
    title: string,
    options: PromptOption<T>[],
    config: SimpleChoiceConfig & { sourceId: string; continuationId?: string },
): InteractionDescriptor {
    const interaction = createSimpleChoice(id, playerId, title, options, config);
    return {
        ...interaction,
        data: {
            ...interaction.data,
            runtimePrompt: {
                owner: 'smashup-ability-runtime',
                sourceId: config.sourceId,
                ...(config.continuationId ? { continuationId: config.continuationId } : {}),
            } satisfies AbilityRuntimePromptMarker,
        },
    };
}

function normalizeRuntimeResult<TState, TEvent>(
    result: AbilityRuntimeResult<TState, TEvent> | TEvent[],
): AbilityRuntimeResult<TState, TEvent> {
    if (Array.isArray(result)) {
        return { events: result };
    }
    return result;
}

function mergeRuntimeResults<TState, TEvent>(
    left: AbilityRuntimeResult<TState, TEvent>,
    right: AbilityRuntimeResult<TState, TEvent>,
): AbilityRuntimeResult<TState, TEvent> {
    return {
        events: [...left.events, ...right.events],
        matchState: right.matchState ?? left.matchState,
        ...(right.suspended
            ? { suspended: true, continuationId: right.continuationId }
            : left.suspended
                ? { suspended: true, continuationId: left.continuationId }
                : {}),
    };
}

function createAbilityRuntimePromptContinuationId(sourceId: string): string {
    const continuationId = `smashup-runtime:${sourceId}:${promptContinuationCounter++}`;
    return continuationId;
}

function ensureRuntimePromptSourceId(
    interaction: InteractionDescriptor,
    sourceId: string,
    continuation: AbilityRuntimePromptContinuationData,
): InteractionDescriptor {
    const data = (interaction.data ?? {}) as Record<string, unknown>;
    const currentSourceId = typeof data.sourceId === 'string' ? data.sourceId : undefined;
    const existingMarker = getAbilityRuntimePromptMarker(data);
    return {
        ...interaction,
        data: {
            ...data,
            sourceId: currentSourceId ?? sourceId,
            runtimePrompt: {
                owner: 'smashup-ability-runtime',
                sourceId,
                continuationId: existingMarker?.continuationId ?? createAbilityRuntimePromptContinuationId(sourceId),
                continuation,
            } satisfies AbilityRuntimePromptMarker,
        },
    };
}

export function executeAbilityProgram<TContext, TState, TEvent>(
    program: AbilityProgram<TContext, TState, TEvent>,
    context: TContext,
): AbilityRuntimeResult<TState, TEvent> {
    switch (program.kind) {
        case 'effect': {
            const result = program.effect(context);
            const normalized = normalizeRuntimeResult(result) as AbilityRuntimeEffectResult<TContext, TState, TEvent>;
            if (!normalized.nextProgram) {
                return normalized;
            }
            const nextContext = normalized.context ?? context;
            return mergeRuntimeResults(
                {
                    events: normalized.events,
                    matchState: normalized.matchState,
                    ...(normalized.suspended
                        ? { suspended: true as const, continuationId: normalized.continuationId }
                        : {}),
                },
                executeAbilityProgram(normalized.nextProgram, nextContext),
            );
        }
        case 'prompt': {
            const continuation = serializeAbilityRuntimeContext(context);
            const interaction = ensureRuntimePromptSourceId(
                program.buildInteraction(context),
                program.sourceId,
                continuation,
            );
            const marker = getAbilityRuntimePromptMarker((interaction.data ?? {}) as Record<string, unknown>);
            return {
                events: [],
                matchState: program.queueInteraction(context, interaction),
                suspended: true,
                continuationId: marker?.continuationId,
            };
        }
        case 'sequence': {
            let result: AbilityRuntimeResult<TState, TEvent> = { events: [] };
            for (let index = 0; index < program.steps.length; index += 1) {
                const step = program.steps[index];
                const stepResult = executeAbilityProgram(step, context);
                result = mergeRuntimeResults(result, stepResult);
                if (stepResult.suspended) {
                    const remainingSteps = program.steps.slice(index + 1);
                    if (remainingSteps.length > 0 && stepResult.continuationId && stepResult.matchState) {
                        const remainingProgram = remainingSteps.length === 1
                            ? remainingSteps[0]
                            : createSequenceProgram(...remainingSteps);
                        result = {
                            ...result,
                            matchState: updateInteractionForContinuation(
                                stepResult.matchState,
                                stepResult.continuationId,
                                (marker) => ({
                                    ...marker,
                                    continuation: {
                                        ...(marker.continuation ?? {}),
                                        nextProgramId: getAbilityProgramId(remainingProgram),
                                    },
                                }),
                            ),
                        };
                    }
                    return result;
                }
            }
            return result;
        }
        case 'branch':
            return executeAbilityProgram(program.when(context) ? program.then : (program.else ?? createStopProgram()), context);
        case 'stop':
            return { events: [] };
        default: {
            const exhaustiveCheck: never = program;
            throw new Error(`未知的 ability program 节点: ${String(exhaustiveCheck)}`);
        }
    }
}

export function executeAbilityRuntimeExecutor<TContext, TState, TEvent>(
    executor: AbilityRuntimeExecutor<TContext, TState, TEvent>,
    context: TContext,
): AbilityRuntimeResult<TState, TEvent> {
    if (executor.kind !== 'program') {
        throw new Error(`未知的 ability runtime executor: ${String((executor as { kind?: string }).kind)}`);
    }
    return executeAbilityProgram(executor.program, context);
}
