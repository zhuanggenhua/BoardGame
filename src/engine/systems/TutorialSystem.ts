/**
 * 教程系统（TutorialSystem）
 */

import type {
    Command,
    GameEvent,
    MatchState,
    TutorialAiAction,
    TutorialEventMatcher,
    TutorialManifest,
    TutorialRandomPolicy,
    TutorialCheckpoint,
    TutorialState,
    TutorialStepSnapshot,
} from '../types';
import { DEFAULT_TUTORIAL_STATE } from '../types';
import {
    getTutorialHiddenAutomationContractErrors,
    isHiddenTutorialAutomationStep,
} from '../tutorialStepAutomation';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';
import { cloneSnapshotState } from './UndoSystem';

export const TUTORIAL_COMMANDS = {
    START: 'SYS_TUTORIAL_START',
    BIND_MANIFEST: 'SYS_TUTORIAL_BIND_MANIFEST',
    NEXT: 'SYS_TUTORIAL_NEXT',
    PREVIOUS: 'SYS_TUTORIAL_PREVIOUS',
    CLOSE: 'SYS_TUTORIAL_CLOSE',
    AI_CONSUMED: 'SYS_TUTORIAL_AI_CONSUMED',
    ANIMATION_COMPLETE: 'SYS_TUTORIAL_ANIMATION_COMPLETE',
} as const;

export const TUTORIAL_EVENTS = {
    STARTED: 'SYS_TUTORIAL_STARTED',
    STEP_CHANGED: 'SYS_TUTORIAL_STEP_CHANGED',
    CLOSED: 'SYS_TUTORIAL_CLOSED',
    AI_CONSUMED: 'SYS_TUTORIAL_AI_CONSUMED',
    ANIMATION_PENDING: 'SYS_TUTORIAL_ANIMATION_PENDING',
} as const;

export const TUTORIAL_ERRORS = {
    INVALID_MANIFEST: 'tutorial_manifest_invalid',
    COMMAND_BLOCKED: 'tutorial_command_blocked',
    STEP_LOCKED: 'tutorial_step_locked',
} as const;

export interface TutorialStartPayload {
    manifest: TutorialManifest;
}

export interface TutorialBindManifestPayload {
    manifest: TutorialManifest;
}

export interface TutorialNextPayload {
    reason?: 'manual' | 'auto';
}

export interface TutorialAiConsumedPayload {
    stepId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const normalizeRandomPolicy = (policy?: TutorialRandomPolicy): TutorialRandomPolicy | undefined => {
    if (!policy) return undefined;
    if (policy.mode !== 'sequence') return policy;
    return {
        ...policy,
        cursor: policy.cursor ?? 0,
    };
};

const deriveManualSkip = (step: TutorialStepSnapshot, manifest?: TutorialManifest): boolean => {
    if (typeof step.allowManualSkip === 'boolean') return step.allowManualSkip;
    if (typeof manifest?.allowManualSkip === 'boolean') return manifest.allowManualSkip;
    return !step.requireAction;
};

const deriveRandomPolicy = (step: TutorialStepSnapshot, manifest?: TutorialManifest): TutorialRandomPolicy | undefined =>
    normalizeRandomPolicy(step.randomPolicy ?? manifest?.randomPolicy);

const deriveStepState = (manifest: TutorialManifest, stepIndex: number, currentCursor?: number): TutorialState => {
    const step = manifest.steps[stepIndex];
    if (!step) return { ...DEFAULT_TUTORIAL_STATE };

    const policy = deriveRandomPolicy(step, manifest);
    // sequence 模式下保留跨步骤的 cursor 位置
    const randomPolicy = policy?.mode === 'sequence' && currentCursor !== undefined
        ? { ...policy, cursor: currentCursor }
        : policy;

    return {
        active: true,
        manifestId: manifest.id ?? null,
        manifestRevision: manifest.revision,
        stepIndex,
        steps: manifest.steps,
        step,
        manifestAllowManualSkip: manifest.allowManualSkip,
        manifestRandomPolicy: manifest.randomPolicy,
        randomPolicy,
        aiActions: step.aiActions ? [...step.aiActions] : undefined,
        allowManualSkip: deriveManualSkip(step, manifest),
        pendingAnimationAdvance: false,
    };
};

const applyTutorialState = <TCore>(state: MatchState<TCore>, tutorial: TutorialState): MatchState<TCore> => ({
    ...state,
    sys: {
        ...state.sys,
        tutorial,
    },
});

const snapshotTutorialState = <TCore>(state: MatchState<TCore>): MatchState<TCore> => {
    const tutorial = state.sys.tutorial;
    return cloneSnapshotState({
        ...state,
        sys: {
            ...state.sys,
            // 教程节点恢复的是对局本身；普通撤回历史由当前运行态单独保留，
            // 不能把它嵌进每个教程节点形成指数级递归。
            undo: {
                ...state.sys.undo,
                snapshots: [],
                snapshotCursors: [],
                pendingRequest: undefined,
            },
            tutorial: {
                ...tutorial,
                checkpoints: undefined,
            },
        },
    });
};

const appendTutorialCheckpoint = <TCore>(
    state: MatchState<TCore>,
    randomCursor?: number,
): MatchState<TCore> => {
    const tutorial = state.sys.tutorial;
    if (!tutorial.active || !tutorial.step) return state;

    const checkpoints = (tutorial.checkpoints ?? [])
        .filter((checkpoint) => checkpoint.stepIndex < tutorial.stepIndex);
    const checkpoint: TutorialCheckpoint = {
        stepIndex: tutorial.stepIndex,
        stepId: tutorial.step.id,
        state: snapshotTutorialState(state),
        ...(typeof randomCursor === 'number' ? { randomCursor } : {}),
    };

    return applyTutorialState(state, {
        ...tutorial,
        checkpoints: [...checkpoints, checkpoint],
    });
};

const restoreTutorialCheckpoint = <TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> | undefined => {
    const tutorial = state.sys.tutorial;
    const checkpoints = tutorial.checkpoints ?? [];
    const currentPosition = checkpoints.findIndex((checkpoint) => checkpoint.stepIndex === tutorial.stepIndex);
    if (currentPosition < 0) return undefined;
    const previousCheckpoints = checkpoints.slice(0, currentPosition);
    const checkpoint = previousCheckpoints[previousCheckpoints.length - 1];
    if (!checkpoint) return undefined;

    const restored = cloneSnapshotState(checkpoint.state) as MatchState<TCore>;
    const restoredUndo = {
        ...state.sys.undo,
        pendingRequest: undefined,
        rollbackRevision: (state.sys.undo.rollbackRevision ?? 0) + 1,
        restoredRandomCursor: typeof checkpoint.randomCursor === 'number'
            ? checkpoint.randomCursor
            : undefined,
    };
    return {
        ...restored,
        sys: {
            ...restored.sys,
            undo: restoredUndo,
            tutorial: {
                ...restored.sys.tutorial,
                checkpoints: previousCheckpoints,
            },
        },
    };
};

const bindManifestToExistingTutorialState = <TCore>(
    state: MatchState<TCore>,
    manifest: TutorialManifest,
): MatchState<TCore> => {
    const tutorial = state.sys.tutorial;
    if (!tutorial.active || tutorial.manifestId !== manifest.id) {
        return state;
    }
    if (
        Number.isInteger(manifest.revision)
        && Number.isInteger(tutorial.manifestRevision)
        && tutorial.manifestRevision !== manifest.revision
    ) {
        return state;
    }

    const stepIndex = Number.isInteger(tutorial.stepIndex) ? tutorial.stepIndex : 0;
    const manifestStep = manifest.steps[stepIndex];
    if (!manifestStep) {
        return state;
    }

    const reboundTutorial = deriveStepState(manifest, stepIndex, tutorial.randomPolicy?.cursor);
    const shouldPreserveConsumedAiActions = Boolean(
        tutorial.step?.id === manifestStep.id
        && !tutorial.step?.aiActions
        && !tutorial.aiActions
        && manifestStep.aiActions?.length,
    );
    const reboundStep = shouldPreserveConsumedAiActions && reboundTutorial.step
        ? { ...reboundTutorial.step, aiActions: undefined }
        : reboundTutorial.step;

    return applyTutorialState(state, {
        ...reboundTutorial,
        step: reboundStep,
        aiActions: shouldPreserveConsumedAiActions ? undefined : reboundTutorial.aiActions,
        pendingAnimationAdvance: tutorial.pendingAnimationAdvance,
        skippedStepIds: tutorial.skippedStepIds,
        checkpoints: tutorial.checkpoints,
    });
};

const resolveTimestamp = (command?: Command, events?: GameEvent[]): number => {
    if (command && typeof command.timestamp === 'number') return command.timestamp;
    const eventTimestamp = events?.find((event) => typeof event.timestamp === 'number')?.timestamp;
    if (typeof eventTimestamp === 'number') return eventTimestamp;
    return 0;
};

const createStepChangedEvent = (
    fromIndex: number,
    toIndex: number,
    step: TutorialStepSnapshot | null,
    timestamp: number,
    skipped?: boolean
): GameEvent => ({
    type: TUTORIAL_EVENTS.STEP_CHANGED,
    payload: {
        from: fromIndex,
        to: toIndex,
        stepId: step?.id ?? null,
        ...(skipped ? { skipped: true } : undefined),
    },
    timestamp,
});

const createStartedEvent = (manifest: TutorialManifest, step: TutorialStepSnapshot | null, timestamp: number): GameEvent => ({
    type: TUTORIAL_EVENTS.STARTED,
    payload: {
        manifestId: manifest.id,
        stepId: step?.id ?? null,
        stepIndex: step ? 0 : -1,
    },
    timestamp,
});

const createClosedEvent = (manifestId: string | null, timestamp: number): GameEvent => ({
    type: TUTORIAL_EVENTS.CLOSED,
    payload: {
        manifestId,
    },
    timestamp,
});

const createAiConsumedEvent = (stepId: string | undefined, timestamp: number): GameEvent => ({
    type: TUTORIAL_EVENTS.AI_CONSUMED,
    payload: {
        stepId: stepId ?? null,
    },
    timestamp,
});

const isEventMatch = (event: GameEvent, matcher: TutorialEventMatcher): boolean => {
    if (event.type !== matcher.type) return false;
    if (!matcher.match) return true;
    const payload = event.payload;
    if (!isRecord(payload)) return false;

    const recordPayload = payload as Record<string, unknown>;
    return Object.entries(matcher.match).every(([key, value]) => recordPayload[key] === value);
};

const shouldAdvance = (events: GameEvent[], advanceOnEvents?: TutorialEventMatcher[]): boolean => {
    if (!advanceOnEvents || advanceOnEvents.length === 0) return false;
    return advanceOnEvents.some((matcher) => events.some((event) => isEventMatch(event, matcher)));
};

const isAuthoredTutorialAiAction = (tutorial: TutorialState | undefined, command: Command): boolean => {
    if (!tutorial?.active || command.skipValidation !== true) return false;
    const aiActions = tutorial.step?.aiActions ?? tutorial.aiActions ?? [];
    return aiActions.some((action) => (
        action.commandType === command.type
        && (!action.playerId || action.playerId === command.playerId)
    ));
};

const buildManifestFromState = (
    tutorial: TutorialState,
    fallbackManifest?: TutorialManifest,
): TutorialManifest | null => {
    if (!tutorial.manifestId) return null;
    if ((!tutorial.steps || tutorial.steps.length === 0)
        && fallbackManifest?.id === tutorial.manifestId
        && fallbackManifest.steps.length > 0) {
        return fallbackManifest;
    }
    return {
        id: tutorial.manifestId,
        revision: tutorial.manifestRevision,
        steps: tutorial.steps,
        allowManualSkip: tutorial.manifestAllowManualSkip,
        randomPolicy: tutorial.manifestRandomPolicy,
    };
};

type StepValidatorFn = (state: MatchState<unknown>, step: TutorialStepSnapshot) => boolean;

const MAX_VALIDATOR_SKIP = 50;

type TutorialStepTransitionDirection = 'next' | 'previous';

const transitionTutorialStep = <TCore>(
    state: MatchState<TCore>,
    direction: TutorialStepTransitionDirection,
    timestamp: number,
    validator?: StepValidatorFn,
    fallbackManifest?: TutorialManifest,
    randomCursor?: number,
): HookResult<TCore> => {
    const tutorial = state.sys.tutorial;
    if (!tutorial.active) return { state };

    if (direction === 'previous') {
        const restoredState = restoreTutorialCheckpoint(state);
        if (restoredState) {
            return {
                state: restoredState,
                events: [createStepChangedEvent(
                    state.sys.tutorial.stepIndex,
                    restoredState.sys.tutorial.stepIndex,
                    restoredState.sys.tutorial.step,
                    timestamp,
                )],
            };
        }

        // 状态注入 / 旧存档可能没有教程 checkpoint；保留旧的 manifest 回退，
        // 让上一步仍按玩家可见步骤工作，而不是静默变成 no-op。
        const manifest = buildManifestFromState(tutorial, fallbackManifest);
        if (!manifest) return { state };
        let previousIndex = tutorial.stepIndex - 1;
        while (previousIndex >= 0) {
            const previousStep = manifest.steps[previousIndex];
            if (
                previousStep
                && !isHiddenTutorialAutomationStep(previousStep)
                && (!validator || validator(state, previousStep))
            ) {
                const previousTutorial = {
                    ...deriveStepState(manifest, previousIndex, tutorial.randomPolicy?.cursor),
                    checkpoints: tutorial.checkpoints,
                };
                return {
                    state: applyTutorialState(state, previousTutorial),
                    events: [createStepChangedEvent(
                        tutorial.stepIndex,
                        previousIndex,
                        previousTutorial.step,
                        timestamp,
                    )],
                };
            }
            previousIndex--;
        }
        return { state };
    }

    const manifest = buildManifestFromState(tutorial, fallbackManifest);
    if (!manifest) {
        return { state: applyTutorialState(state, { ...DEFAULT_TUTORIAL_STATE }) };
    }

    let nextIndex = tutorial.stepIndex + 1;
    const events: GameEvent[] = [];
    let prevIndex = tutorial.stepIndex;
    let skipped = 0;

    // 循环跳过 validator 返回 false 的步骤
    while (manifest.steps[nextIndex] && validator && skipped < MAX_VALIDATOR_SKIP) {
        if (validator(state, manifest.steps[nextIndex])) {
            break; // 步骤有效
        }
        events.push(createStepChangedEvent(prevIndex, nextIndex, manifest.steps[nextIndex], timestamp, true));
        prevIndex = nextIndex;
        nextIndex++;
        skipped++;
    }

    if (!manifest.steps[nextIndex]) {
        return {
            state: applyTutorialState(state, { ...DEFAULT_TUTORIAL_STATE }),
            events: [...events, createClosedEvent(tutorial.manifestId, timestamp)],
        };
    }

    const skippedStepIds = events
        .map((event) => isRecord(event.payload) && typeof event.payload.stepId === 'string' ? event.payload.stepId : null)
        .filter((stepId): stepId is string => Boolean(stepId));
    const nextTutorial = {
        ...deriveStepState(manifest, nextIndex, tutorial.randomPolicy?.cursor),
        checkpoints: tutorial.checkpoints,
        ...(skippedStepIds.length > 0 ? { skippedStepIds } : {}),
    };
    const nextState = appendTutorialCheckpoint(
        applyTutorialState(state, nextTutorial),
        randomCursor,
    );
    return {
        state: nextState,
        events: [...events, createStepChangedEvent(prevIndex, nextIndex, nextTutorial.step, timestamp)],
    };
};

const isValidTutorialManifest = (manifest: TutorialManifest | undefined): manifest is TutorialManifest =>
    Boolean(
        manifest
        && Array.isArray(manifest.steps)
        && manifest.steps.length > 0
        && getTutorialHiddenAutomationContractErrors(manifest).length === 0,
    );

const shouldBlockCommand = (tutorial: TutorialState | undefined, command: Command): boolean => {
    if (!tutorial?.active) return false;
    // 系统命令不拦截（SYS_ 前缀，包括 CHEAT 命令和教程命令）
    if (command.type?.startsWith('SYS_')) return false;
    // manifest 明确声明的教程 AI 动作属于系统推进，不是玩家手动输入。
    if (isAuthoredTutorialAiAction(tutorial, command)) return false;

    // 白名单模式：只允许列出的命令
    if (tutorial.step?.allowedCommands) {
        return !tutorial.step.allowedCommands.includes(command.type);
    }
    // infoStep 模式：阻止所有非系统命令
    if (tutorial.step?.infoStep) {
        return true;
    }
    return false;
};

const clearAiActions = (tutorial: TutorialState): TutorialState => ({
    ...tutorial,
    aiActions: undefined,
    // 同时清除 step 上的 aiActions，避免 TutorialOverlay 和 AI effect
    // 通过 tutorial.step.aiActions 读到旧值而永远返回 null
    step: tutorial.step ? { ...tutorial.step, aiActions: undefined } : tutorial.step,
});

const hasPendingAiActions = (tutorial: TutorialState): boolean =>
    Boolean(tutorial.step?.aiActions?.length || tutorial.aiActions?.length);

const shouldAdvanceInvalidCurrentStep = <TCore>(
    state: MatchState<TCore>,
    validator?: StepValidatorFn,
): boolean => {
    const tutorial = state.sys.tutorial;
    return Boolean(
        validator
        && tutorial.active
        && tutorial.step
        && !tutorial.pendingAnimationAdvance
        && !validator(state, tutorial.step),
    );
};

const shouldAutoAdvanceAfterAiConsumed = (
    tutorial: TutorialState,
    payload?: TutorialAiConsumedPayload,
): boolean => {
    const step = tutorial.step;
    if (!tutorial.active || !step) return false;
    if (payload?.stepId && payload.stepId !== step.id) return false;
    if (step.autoAdvanceAfterAi === false) return false;
    if (!step.aiActions?.length && !tutorial.aiActions?.length) return false;
    if (!isHiddenTutorialAutomationStep(step)) return false;
    return !step.advanceOnEvents || step.advanceOnEvents.length === 0;
};

export function createTutorialSystem<TCore>(): EngineSystem<TCore> {
    let activeStepValidator: StepValidatorFn | undefined;
    const activeManifestById = new Map<string, TutorialManifest>();
    const resolveActiveManifest = (tutorial: TutorialState): TutorialManifest | undefined =>
        tutorial.manifestId ? activeManifestById.get(tutorial.manifestId) : undefined;

    return {
        id: SYSTEM_IDS.TUTORIAL,
        name: '教程系统',
        // 教程步骤推进必须在 FlowSystem 完成真实阶段/发牌副作用之后执行。
        // 否则 HOST_STARTED 会先生成教程步骤事件，阻止同轮自动进入 main1。
        priority: 70,

        setup: (): Partial<{ tutorial: TutorialState }> => {
            return {
                tutorial: { ...DEFAULT_TUTORIAL_STATE },
            };
        },

        beforeCommand: ({ state, command, random }): HookResult<TCore> | void => {
            // 防御性检查：确保 tutorial 存在
            if (!state.sys?.tutorial) {
                return;
            }

            if (command.type === TUTORIAL_COMMANDS.START) {
                const payload = command.payload as TutorialStartPayload;
                const manifest = payload?.manifest;
                if (!isValidTutorialManifest(manifest)) {
                    return { halt: true, error: TUTORIAL_ERRORS.INVALID_MANIFEST };
                }

                console.warn('[TutorialSystem] START: 教程启动', { manifestId: manifest.id, stepsCount: manifest.steps.length, firstStepId: manifest.steps[0]?.id });

                activeManifestById.set(manifest.id, manifest);
                activeStepValidator = manifest.stepValidator;
                const nextTutorial = deriveStepState(manifest, 0);
                const timestamp = resolveTimestamp(command);
                const nextState = appendTutorialCheckpoint(
                    applyTutorialState(state, nextTutorial),
                    random.getCursor?.(),
                );
                return {
                    halt: true,
                    state: nextState,
                    events: [createStartedEvent(manifest, nextTutorial.step, timestamp)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.BIND_MANIFEST) {
                const payload = command.payload as TutorialBindManifestPayload | undefined;
                const manifest = payload?.manifest;
                if (!isValidTutorialManifest(manifest)) {
                    return { halt: true, error: TUTORIAL_ERRORS.INVALID_MANIFEST };
                }

                activeManifestById.set(manifest.id, manifest);
                activeStepValidator = manifest.stepValidator;
                const reboundState = bindManifestToExistingTutorialState(state, manifest);
                const reboundWithCheckpoint = reboundState.sys.tutorial.checkpoints?.length
                    ? reboundState
                    : appendTutorialCheckpoint(reboundState, random.getCursor?.());
                if (shouldAdvanceInvalidCurrentStep(reboundWithCheckpoint, activeStepValidator)) {
                    const timestamp = resolveTimestamp(command);
                    const result = transitionTutorialStep(
                        reboundWithCheckpoint,
                        'next',
                        timestamp,
                        activeStepValidator,
                        manifest,
                        random.getCursor?.(),
                    );
                    return { ...result, halt: true };
                }
                return {
                    halt: true,
                    state: reboundWithCheckpoint,
                };
            }

            if (command.type === TUTORIAL_COMMANDS.CLOSE) {
                activeStepValidator = undefined;
                const manifestId = state.sys.tutorial.manifestId ?? null;
                if (manifestId) {
                    activeManifestById.delete(manifestId);
                }
                const timestamp = resolveTimestamp(command);
                return {
                    halt: true,
                    state: applyTutorialState(state, { ...DEFAULT_TUTORIAL_STATE }),
                    events: [createClosedEvent(manifestId, timestamp)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.AI_CONSUMED) {
                const payload = command.payload as TutorialAiConsumedPayload | undefined;
                const timestamp = resolveTimestamp(command);
                const shouldAdvanceAfterConsume = shouldAutoAdvanceAfterAiConsumed(
                    state.sys.tutorial,
                    payload,
                );
                const consumedState = applyTutorialState(state, clearAiActions(state.sys.tutorial));
                if (shouldAdvanceAfterConsume) {
                    const result = transitionTutorialStep(
                        consumedState,
                        'next',
                        timestamp,
                        activeStepValidator,
                        resolveActiveManifest(state.sys.tutorial),
                        random.getCursor?.(),
                    );
                    return {
                        ...result,
                        halt: true,
                        events: [
                            createAiConsumedEvent(payload?.stepId, timestamp),
                            ...(result.events ?? []),
                        ],
                    };
                }
                return {
                    halt: true,
                    state: consumedState,
                    events: [createAiConsumedEvent(payload?.stepId, timestamp)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.NEXT) {
                if (!state.sys.tutorial.active) {
                    return { halt: true, state };
                }
                if (!state.sys.tutorial.allowManualSkip) {
                    return { halt: true, error: TUTORIAL_ERRORS.STEP_LOCKED };
                }
                if (hasPendingAiActions(state.sys.tutorial)) {
                    return { halt: true, error: TUTORIAL_ERRORS.STEP_LOCKED };
                }
                const timestamp = resolveTimestamp(command);
                const result = transitionTutorialStep(
                    state,
                    'next',
                    timestamp,
                    activeStepValidator,
                    resolveActiveManifest(state.sys.tutorial),
                    random.getCursor?.(),
                );
                return { ...result, halt: true };
            }

            if (command.type === TUTORIAL_COMMANDS.PREVIOUS) {
                if (!state.sys.tutorial.active) {
                    return { halt: true, state };
                }
                if (hasPendingAiActions(state.sys.tutorial)) {
                    return { halt: true, error: TUTORIAL_ERRORS.STEP_LOCKED };
                }
                const timestamp = resolveTimestamp(command);
                const result = transitionTutorialStep(
                    state,
                    'previous',
                    timestamp,
                    activeStepValidator,
                    resolveActiveManifest(state.sys.tutorial),
                    random.getCursor?.(),
                );
                return { ...result, halt: true };
            }

            // 动画完成：触发等待中的步骤推进
            if (command.type === TUTORIAL_COMMANDS.ANIMATION_COMPLETE) {
                if (!state.sys.tutorial.active || !state.sys.tutorial.pendingAnimationAdvance) {
                    return { halt: true, state };
                }
                const timestamp = resolveTimestamp(command);
                const result = transitionTutorialStep(
                    state,
                    'next',
                    timestamp,
                    activeStepValidator,
                    resolveActiveManifest(state.sys.tutorial),
                    random.getCursor?.(),
                );
                return { ...result, halt: true };
            }

            let commandState = state;
            let staleStepEvents: GameEvent[] | undefined;
            if (shouldAdvanceInvalidCurrentStep(commandState, activeStepValidator)) {
                const timestamp = resolveTimestamp(command);
                const result = transitionTutorialStep(
                    commandState,
                    'next',
                    timestamp,
                    activeStepValidator,
                    resolveActiveManifest(commandState.sys.tutorial),
                    random.getCursor?.(),
                );
                if (result.state) {
                    commandState = result.state;
                }
                staleStepEvents = result.events;
            }

            if (shouldBlockCommand(commandState.sys.tutorial, command)) {
                return {
                    ...(commandState !== state ? { state: commandState } : {}),
                    ...(staleStepEvents && staleStepEvents.length > 0 ? { events: staleStepEvents } : {}),
                    halt: true,
                    error: TUTORIAL_ERRORS.COMMAND_BLOCKED,
                };
            }

            if (commandState !== state || (staleStepEvents && staleStepEvents.length > 0)) {
                return {
                    state: commandState,
                    ...(staleStepEvents && staleStepEvents.length > 0 ? { events: staleStepEvents } : {}),
                };
            }
        },

        afterEvents: ({ state, events, command, random }): HookResult<TCore> | void => {
            const tutorial = state.sys?.tutorial;
            if (!tutorial?.active) {
                return;
            }

            // 诊断日志：追踪事件匹配
            const step = tutorial.step;
            if (step?.advanceOnEvents && step.advanceOnEvents.length > 0) {
                console.warn('[TutorialSystem] afterEvents:', {
                    stepId: step.id,
                    advanceOnEvents: step.advanceOnEvents.map((m: TutorialEventMatcher) => m.type),
                    receivedEvents: events.map((e: GameEvent) => e.type),
                    eventCount: events.length,
                });
            }

            const matched = shouldAdvance(events, tutorial.step?.advanceOnEvents);

            if (!matched) {
                // 事件未匹配：检查 stepValidator 是否判定当前步骤不可满足
                if (shouldAdvanceInvalidCurrentStep(state, activeStepValidator)) {
                    const timestamp = resolveTimestamp(command, events);
                    return transitionTutorialStep(
                        state,
                        'next',
                        timestamp,
                        activeStepValidator,
                        resolveActiveManifest(tutorial),
                        random.getCursor?.(),
                    );
                }
                return;
            }

            const timestamp = resolveTimestamp(command, events);

            // 如果当前步骤需要等待动画，不立即推进，设置等待标志
            if (tutorial.step?.waitForAnimation) {
                const pendingState: TutorialState = {
                    ...tutorial,
                    pendingAnimationAdvance: true,
                };
                return {
                    state: applyTutorialState(state, pendingState),
                    events: [{ type: TUTORIAL_EVENTS.ANIMATION_PENDING, payload: { stepId: tutorial.step?.id }, timestamp }],
                };
            }

            return transitionTutorialStep(
                state,
                'next',
                timestamp,
                activeStepValidator,
                resolveActiveManifest(tutorial),
                random.getCursor?.(),
            );
        },
    };
}

export type { TutorialAiAction };
