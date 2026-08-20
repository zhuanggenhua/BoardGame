import { buildAiDecisionContext } from '../ai';
import type { MatchState } from '../types';
import type { MatchMetadata } from './storage';
import {
    buildTrainingDecisionSample,
    type TrainingCompletedMatch,
    type TrainingDataRecorder,
    type TrainingDecisionSample,
    type TrainingMatchCommitResult,
} from './trainingData';
import {
    extractTrustedSetupSeatControllers,
    resolveSeatControllerTypeForTraining,
    type GameManifestAiIndex,
} from './onlineAiSeatControllers';

export const DEFAULT_TRAINING_CAPTURE_POLICY = 'human-only' as const;

export type TrainingDataCaptureMatch = {
    matchID: string;
    gameId: string;
    metadata: Pick<MatchMetadata, 'createdAt' | 'setupData'>;
};

export type RecordTrainingDecisionSampleArgs = {
    match: TrainingDataCaptureMatch;
    playerID: string;
    commandType: string;
    payload: unknown;
    stateIdBefore: number;
    stateIdAfter: number;
    preState: unknown;
    postState: unknown;
    gameOver?: unknown;
};

export type TrainingDataCaptureWarning = (message: string, payload: Record<string, unknown>) => void;

export type TrainingDataCaptureConfig = {
    recorder?: TrainingDataRecorder;
    defaultMinCompletedMatchDurationMs: number | null;
    rulesVersion: string | null;
    gameManifests: GameManifestAiIndex;
    now?: () => number;
    logWarning?: TrainingDataCaptureWarning;
};

export class TrainingDataCapture {
    private readonly recorder?: TrainingDataRecorder;
    private readonly defaultMinCompletedMatchDurationMs: number | null;
    private readonly rulesVersion: string | null;
    private readonly gameManifests: GameManifestAiIndex;
    private readonly now: () => number;
    private readonly logWarning: TrainingDataCaptureWarning;

    constructor(config: TrainingDataCaptureConfig) {
        this.recorder = config.recorder;
        this.defaultMinCompletedMatchDurationMs = config.defaultMinCompletedMatchDurationMs;
        this.rulesVersion = config.rulesVersion;
        this.gameManifests = config.gameManifests;
        this.now = config.now ?? (() => Date.now());
        this.logWarning = config.logWarning ?? (() => undefined);
    }

    recordDecisionSample(args: RecordTrainingDecisionSampleArgs): void {
        if (!this.recorder) return;

        const matchIdentity = {
            schemaVersion: 1,
            gameId: args.match.gameId,
            matchId: args.match.matchID,
        } as const;
        const isCompleted = args.gameOver !== undefined && args.gameOver !== null;
        const manifest = this.gameManifests[args.match.gameId];
        if (manifest?.ai?.capture === false) {
            if (isCompleted) {
                this.discardPendingMatch(matchIdentity);
            }
            return;
        }

        const minDurationMs = this.resolveMinCompletedDurationMs(args.match);
        if (minDurationMs === null) {
            if (isCompleted) {
                this.discardPendingMatch(matchIdentity);
            }
            return;
        }

        const seatControllers = extractTrustedSetupSeatControllers(args.match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(seatControllers, args.playerID);
        const capturePolicy = manifest?.ai?.capturePolicy ?? DEFAULT_TRAINING_CAPTURE_POLICY;
        const shouldCaptureCommand = (
            capturePolicy !== 'human-only'
            || seatControllerType === 'human'
        );
        const sample = shouldCaptureCommand
            ? buildTrainingDecisionSample({
                rulesVersion: this.rulesVersion,
                gameId: args.match.gameId,
                matchId: args.match.matchID,
                playerId: args.playerID,
                seatControllerType,
                stateIdBefore: args.stateIdBefore,
                stateIdAfter: args.stateIdAfter,
                commandType: args.commandType,
                payload: args.payload,
                preState: args.preState,
                postState: args.postState,
                legalActions: buildAiDecisionContext({
                    gameId: args.match.gameId,
                    matchId: args.match.matchID,
                    playerId: args.playerID,
                    visibleState: args.preState as MatchState<unknown>,
                    rulesVersion: this.rulesVersion,
                    decisionBudgetMs: 250,
                    source: 'online',
                }).legalActions,
                gameOver: args.gameOver,
            })
            : undefined;

        if (!isCompleted) {
            if (sample) {
                this.stageDecisionSample(sample);
            }
            return;
        }

        const durationMs = this.resolveMatchDurationMs(args.match);
        if (durationMs === null || durationMs < minDurationMs) {
            this.discardPendingMatch(matchIdentity);
            return;
        }

        this.commitCompletedMatch({
            ...matchIdentity,
            completedAt: this.now(),
            durationMs,
            ...(sample ? { finalSample: sample } : {}),
        });
    }

    private resolveMatchDurationMs(match: TrainingDataCaptureMatch): number | null {
        const createdAt = match.metadata.createdAt;
        if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
            return null;
        }
        return this.now() - createdAt;
    }

    private resolveMinCompletedDurationMs(match: TrainingDataCaptureMatch): number | null {
        const manifestDurationMs = this.gameManifests[
            match.gameId
        ]?.ai?.trainingMinCompletedDurationMs;
        if (Number.isFinite(manifestDurationMs) && (manifestDurationMs ?? 0) > 0) {
            return manifestDurationMs!;
        }
        return this.defaultMinCompletedMatchDurationMs;
    }

    private stageDecisionSample(sample: TrainingDecisionSample): void {
        Promise.resolve(this.recorder?.stageDecisionSample(sample)).catch((error) => {
            this.logTrainingDataFailure('stage', sample, error);
        });
    }

    private commitCompletedMatch(match: TrainingCompletedMatch): void {
        Promise.resolve(this.recorder?.commitCompletedMatch(match))
            .then((result) => {
                if (!result) return;
                this.logTrainingCommitResult(match, result);
            })
            .catch((error) => {
                this.logTrainingDataFailure('commit', match, error);
            });
    }

    private discardPendingMatch(
        match: Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>,
    ): void {
        Promise.resolve(this.recorder?.discardPendingMatch(match)).catch((error) => {
            this.logTrainingDataFailure('discard', match, error);
        });
    }

    private logTrainingCommitResult(
        match: TrainingCompletedMatch,
        result: TrainingMatchCommitResult,
    ): void {
        if (result.status === 'capacity-reached') {
            this.logWarning('[GameTransport] training data game capacity reached', {
                matchID: match.matchId,
                gameId: match.gameId,
                pendingBytes: result.pendingBytes,
                gameBytes: result.gameBytes,
                maxBytes: result.maxBytes,
            });
        } else if (result.status === 'failed') {
            this.logWarning('[GameTransport] training data match commit skipped after staging failure', {
                matchID: match.matchId,
                gameId: match.gameId,
            });
        }
    }

    private logTrainingDataFailure(
        operation: 'stage' | 'commit' | 'discard',
        context: Pick<TrainingCompletedMatch, 'gameId' | 'matchId'> | TrainingDecisionSample,
        error: unknown,
    ): void {
        this.logWarning('[GameTransport] training data capture failed', {
            operation,
            matchID: context.matchId,
            gameId: context.gameId,
            ...('command' in context ? {
                commandType: context.command.type,
                playerID: context.playerId,
            } : {}),
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
