import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import type { AiLegalAction, AiSeatController } from '../ai/types';

export type TrainingInteractionOptionSnapshot = NonNullable<ReturnType<typeof extractAiInteractionSnapshot>>['options'][number];
export type TrainingInteractionSnapshot = NonNullable<ReturnType<typeof extractAiInteractionSnapshot>>;
export type TrainingResponseWindowSnapshot = NonNullable<ReturnType<typeof extractAiResponseWindowSnapshot>>;

export interface TrainingDecisionSample {
    schemaVersion: number;
    source: 'online';
    capturedAt: number;
    rulesVersion: string | null;
    gameId: string;
    matchId: string;
    playerId: string;
    seatControllerType: AiSeatController['type'];
    stateIdBefore: number;
    stateIdAfter: number;
    command: {
        type: string;
        payload: unknown;
    };
    preState: unknown;
    postState: unknown;
    interactionBefore: TrainingInteractionSnapshot | null;
    interactionAfter: TrainingInteractionSnapshot | null;
    responseWindowBefore: TrainingResponseWindowSnapshot | null;
    responseWindowAfter: TrainingResponseWindowSnapshot | null;
    legalActions: AiLegalAction[];
    gameOver?: unknown;
}

export interface TrainingCompletedMatch {
    schemaVersion: number;
    gameId: string;
    matchId: string;
    completedAt: number;
    durationMs: number;
    finalSample?: TrainingDecisionSample;
}

export type TrainingMatchCommitResult =
    | {
        status: 'committed';
        committedBytes: number;
        gameBytes: number;
        maxBytes: number;
    }
    | {
        status: 'capacity-reached';
        pendingBytes: number;
        gameBytes: number;
        maxBytes: number;
    }
    | {
        status: 'already-committed' | 'empty' | 'failed';
        committedBytes: number;
        gameBytes: number;
        maxBytes: number;
    };

export interface TrainingDataRecorder {
    stageDecisionSample(sample: TrainingDecisionSample): void | Promise<void>;
    commitCompletedMatch(match: TrainingCompletedMatch): TrainingMatchCommitResult | Promise<TrainingMatchCommitResult>;
    discardPendingMatch(match: Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>): void | Promise<void>;
}

interface BuildTrainingDecisionSampleArgs {
    rulesVersion: string | null;
    gameId: string;
    matchId: string;
    playerId: string;
    seatControllerType: AiSeatController['type'];
    stateIdBefore: number;
    stateIdAfter: number;
    commandType: string;
    payload: unknown;
    preState: unknown;
    postState: unknown;
    legalActions?: AiLegalAction[];
    gameOver?: unknown;
    capturedAt?: number;
}

const toJsonSafe = <T>(value: T): T => {
    if (value === undefined) return value;
    return JSON.parse(JSON.stringify(value)) as T;
};

export function buildTrainingDecisionSample(args: BuildTrainingDecisionSampleArgs): TrainingDecisionSample {
    const safePreState = toJsonSafe(args.preState);
    const safePostState = toJsonSafe(args.postState);

    return {
        schemaVersion: 1,
        source: 'online',
        capturedAt: args.capturedAt ?? Date.now(),
        rulesVersion: args.rulesVersion,
        gameId: args.gameId,
        matchId: args.matchId,
        playerId: args.playerId,
        seatControllerType: args.seatControllerType,
        stateIdBefore: args.stateIdBefore,
        stateIdAfter: args.stateIdAfter,
        command: {
            type: args.commandType,
            payload: toJsonSafe(args.payload),
        },
        preState: safePreState,
        postState: safePostState,
        interactionBefore: extractAiInteractionSnapshot(safePreState),
        interactionAfter: extractAiInteractionSnapshot(safePostState),
        responseWindowBefore: extractAiResponseWindowSnapshot(safePreState),
        responseWindowAfter: extractAiResponseWindowSnapshot(safePostState),
        legalActions: toJsonSafe(args.legalActions ?? []),
        ...(args.gameOver !== undefined ? { gameOver: toJsonSafe(args.gameOver) } : {}),
    };
}
