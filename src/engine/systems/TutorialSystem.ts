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
    TutorialState,
    TutorialStepSnapshot,
} from '../types';
import { DEFAULT_TUTORIAL_STATE } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

export const TUTORIAL_COMMANDS = {
    START: 'SYS_TUTORIAL_START',
    NEXT: 'SYS_TUTORIAL_NEXT',
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

const buildManifestFromState = (tutorial: TutorialState): TutorialManifest | null => {
    if (!tutorial.manifestId) return null;
    return {
        id: tutorial.manifestId,
        steps: tutorial.steps,
        allowManualSkip: tutorial.manifestAllowManualSkip,
        randomPolicy: tutorial.manifestRandomPolicy,
    };
};

type StepValidatorFn = (state: MatchState<unknown>, step: TutorialStepSnapshot) => boolean;

const MAX_VALIDATOR_SKIP = 50;

const advanceStep = <TCore>(
    state: MatchState<TCore>,
    timestamp: number,
    validator?: StepValidatorFn
): HookResult<TCore> => {
    const tutorial = state.sys.tutorial;
    if (!tutorial.active) return { state };

    const manifest = buildManifestFromState(tutorial);
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

    const nextTutorial = deriveStepState(manifest, nextIndex, tutorial.randomPolicy?.cursor);
    return {
        state: applyTutorialState(state, nextTutorial),
        events: [...events, createStepChangedEvent(prevIndex, nextIndex, nextTutorial.step, timestamp)],
    };
};

const shouldBlockCommand = (tutorial: TutorialState, command: Command): boolean => {
    if (!tutorial.active) return false;
    // 系统命令不拦截（SYS_ 前缀，包括 CHEAT 命令和教程命令）
    if (command.type.startsWith('SYS_')) return false;

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

export function createTutorialSystem<TCore>(): EngineSystem<TCore> {
    let activeStepValidator: StepValidatorFn | undefined;

    return {
        id: SYSTEM_IDS.TUTORIAL,
        name: '教程系统',
        priority: 9,

        setup: (): Partial<{ tutorial: TutorialState }> => {
            return {
                tutorial: { ...DEFAULT_TUTORIAL_STATE },
            };
        },

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            if (command.type === TUTORIAL_COMMANDS.START) {
                const payload = command.payload as TutorialStartPayload;
                const manifest = payload?.manifest;
                if (!manifest || !Array.isArray(manifest.steps) || manifest.steps.length === 0) {
                    return { halt: true, error: TUTORIAL_ERRORS.INVALID_MANIFEST };
                }

                console.warn('[TutorialSystem] START: 教程启动', { manifestId: manifest.id, stepsCount: manifest.steps.length, firstStepId: manifest.steps[0]?.id });

                activeStepValidator = manifest.stepValidator;
                const nextTutorial = deriveStepState(manifest, 0);
                const timestamp = resolveTimestamp(command);
                return {
                    halt: true,
                    state: applyTutorialState(state, nextTutorial),
                    events: [createStartedEvent(manifest, nextTutorial.step, timestamp)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.CLOSE) {
                activeStepValidator = undefined;
                const manifestId = state.sys.tutorial.manifestId ?? null;
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
                return {
                    halt: true,
                    state: applyTutorialState(state, clearAiActions(state.sys.tutorial)),
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
                const timestamp = resolveTimestamp(command);
                const result = advanceStep(state, timestamp, activeStepValidator);
                return { ...result, halt: true };
            }

            // 动画完成：触发等待中的步骤推进
            if (command.type === TUTORIAL_COMMANDS.ANIMATION_COMPLETE) {
                if (!state.sys.tutorial.active || !state.sys.tutorial.pendingAnimationAdvance) {
                    return { halt: true, state };
                }
                const timestamp = resolveTimestamp(command);
                const result = advanceStep(state, timestamp, activeStepValidator);
                return { ...result, halt: true };
            }

            if (shouldBlockCommand(state.sys.tutorial, command)) {
                return { halt: true, error: TUTORIAL_ERRORS.COMMAND_BLOCKED };
            }
        },

        afterEvents: ({ state, events, command }): HookResult<TCore> | void => {
            if (!state.sys.tutorial.active) {
                return;
            }

            // 诊断日志：追踪事件匹配
            const step = state.sys.tutorial.step;
            if (step?.advanceOnEvents && step.advanceOnEvents.length > 0) {
                console.warn('[TutorialSystem] afterEvents:', {
                    stepId: step.id,
                    advanceOnEvents: step.advanceOnEvents.map((m: TutorialEventMatcher) => m.type),
                    receivedEvents: events.map((e: GameEvent) => e.type),
                    eventCount: events.length,
                });
            }

            const matched = shouldAdvance(events, state.sys.tutorial.step?.advanceOnEvents);

            if (!matched) {
                // 事件未匹配：检查 stepValidator 是否判定当前步骤不可满足
                if (activeStepValidator && state.sys.tutorial.step
                    && !activeStepValidator(state, state.sys.tutorial.step)) {
                    const timestamp = resolveTimestamp(command, events);
                    return advanceStep(state, timestamp, activeStepValidator);
                }
                return;
            }

            const timestamp = resolveTimestamp(command, events);

            // 如果当前步骤需要等待动画，不立即推进，设置等待标志
            if (state.sys.tutorial.step?.waitForAnimation) {
                const pendingState: TutorialState = {
                    ...state.sys.tutorial,
                    pendingAnimationAdvance: true,
                };
                return {
                    state: applyTutorialState(state, pendingState),
                    events: [{ type: TUTORIAL_EVENTS.ANIMATION_PENDING, payload: { stepId: state.sys.tutorial.step?.id }, timestamp }],
                };
            }

            return advanceStep(state, timestamp, activeStepValidator);
        },
    };
}

export type { TutorialAiAction };
