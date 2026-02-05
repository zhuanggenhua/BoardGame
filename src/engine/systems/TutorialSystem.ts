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
} as const;

export const TUTORIAL_EVENTS = {
    STARTED: 'SYS_TUTORIAL_STARTED',
    STEP_CHANGED: 'SYS_TUTORIAL_STEP_CHANGED',
    CLOSED: 'SYS_TUTORIAL_CLOSED',
    AI_CONSUMED: 'SYS_TUTORIAL_AI_CONSUMED',
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

const now = () => Date.now();

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

const deriveStepState = (manifest: TutorialManifest, stepIndex: number): TutorialState => {
    const step = manifest.steps[stepIndex];
    if (!step) return { ...DEFAULT_TUTORIAL_STATE };

    return {
        active: true,
        manifestId: manifest.id ?? null,
        stepIndex,
        steps: manifest.steps,
        step,
        manifestAllowManualSkip: manifest.allowManualSkip,
        manifestRandomPolicy: manifest.randomPolicy,
        allowedCommands: step.allowedCommands,
        blockedCommands: step.blockedCommands,
        advanceOnEvents: step.advanceOnEvents,
        randomPolicy: deriveRandomPolicy(step, manifest),
        aiActions: step.aiActions ? [...step.aiActions] : undefined,
        allowManualSkip: deriveManualSkip(step, manifest),
    };
};

const applyTutorialState = <TCore>(state: MatchState<TCore>, tutorial: TutorialState): MatchState<TCore> => ({
    ...state,
    sys: {
        ...state.sys,
        tutorial,
    },
});

const createStepChangedEvent = (
    fromIndex: number,
    toIndex: number,
    step: TutorialStepSnapshot | null
): GameEvent => ({
    type: TUTORIAL_EVENTS.STEP_CHANGED,
    payload: {
        from: fromIndex,
        to: toIndex,
        stepId: step?.id ?? null,
    },
    timestamp: now(),
});

const createStartedEvent = (manifest: TutorialManifest, step: TutorialStepSnapshot | null): GameEvent => ({
    type: TUTORIAL_EVENTS.STARTED,
    payload: {
        manifestId: manifest.id,
        stepId: step?.id ?? null,
        stepIndex: step ? 0 : -1,
    },
    timestamp: now(),
});

const createClosedEvent = (manifestId: string | null): GameEvent => ({
    type: TUTORIAL_EVENTS.CLOSED,
    payload: {
        manifestId,
    },
    timestamp: now(),
});

const createAiConsumedEvent = (stepId?: string): GameEvent => ({
    type: TUTORIAL_EVENTS.AI_CONSUMED,
    payload: {
        stepId: stepId ?? null,
    },
    timestamp: now(),
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

const advanceStep = <TCore>(state: MatchState<TCore>): HookResult<TCore> => {
    const tutorial = state.sys.tutorial;
    if (!tutorial.active) return { state };

    const manifest = buildManifestFromState(tutorial);
    if (!manifest) {
        return { state: applyTutorialState(state, { ...DEFAULT_TUTORIAL_STATE }) };
    }

    const nextIndex = tutorial.stepIndex + 1;
    if (!manifest.steps[nextIndex]) {
        return {
            state: applyTutorialState(state, { ...DEFAULT_TUTORIAL_STATE }),
            events: [createClosedEvent(tutorial.manifestId)],
        };
    }

    const nextTutorial = deriveStepState(manifest, nextIndex);
    return {
        state: applyTutorialState(state, nextTutorial),
        events: [createStepChangedEvent(tutorial.stepIndex, nextIndex, nextTutorial.step)],
    };
};

const shouldBlockCommand = (tutorial: TutorialState, command: Command): boolean => {
    if (!tutorial.active) return false;
    if (command.type.startsWith('SYS_')) return false;

    if (tutorial.allowedCommands && tutorial.allowedCommands.length > 0) {
        return !tutorial.allowedCommands.includes(command.type);
    }
    if (tutorial.blockedCommands && tutorial.blockedCommands.length > 0) {
        return tutorial.blockedCommands.includes(command.type);
    }
    return false;
};

const clearAiActions = (tutorial: TutorialState): TutorialState => ({
    ...tutorial,
    aiActions: undefined,
});

export function createTutorialSystem<TCore>(): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.TUTORIAL,
        name: '教程系统',
        priority: 9,

        setup: (): Partial<{ tutorial: TutorialState }> => ({
            tutorial: { ...DEFAULT_TUTORIAL_STATE },
        }),

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            if (command.type === TUTORIAL_COMMANDS.START) {
                const payload = command.payload as TutorialStartPayload;
                const manifest = payload?.manifest;
                if (!manifest || !Array.isArray(manifest.steps) || manifest.steps.length === 0) {
                    return { halt: true, error: TUTORIAL_ERRORS.INVALID_MANIFEST };
                }

                const nextTutorial = deriveStepState(manifest, 0);
                return {
                    halt: true,
                    state: applyTutorialState(state, nextTutorial),
                    events: [createStartedEvent(manifest, nextTutorial.step)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.CLOSE) {
                const manifestId = state.sys.tutorial.manifestId ?? null;
                return {
                    halt: true,
                    state: applyTutorialState(state, { ...DEFAULT_TUTORIAL_STATE }),
                    events: [createClosedEvent(manifestId)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.AI_CONSUMED) {
                const payload = command.payload as TutorialAiConsumedPayload | undefined;
                return {
                    halt: true,
                    state: applyTutorialState(state, clearAiActions(state.sys.tutorial)),
                    events: [createAiConsumedEvent(payload?.stepId)],
                };
            }

            if (command.type === TUTORIAL_COMMANDS.NEXT) {
                if (!state.sys.tutorial.active) {
                    return { halt: true, state };
                }
                if (!state.sys.tutorial.allowManualSkip) {
                    return { halt: true, error: TUTORIAL_ERRORS.STEP_LOCKED };
                }
                const result = advanceStep(state);
                return { ...result, halt: true };
            }

            if (shouldBlockCommand(state.sys.tutorial, command)) {
                return { halt: true, error: TUTORIAL_ERRORS.COMMAND_BLOCKED };
            }
        },

        afterEvents: ({ state, events }): HookResult<TCore> | void => {
            if (!state.sys.tutorial.active) return;
            if (!shouldAdvance(events, state.sys.tutorial.advanceOnEvents)) return;
            return advanceStep(state);
        },
    };
}

export type { TutorialAiAction };
