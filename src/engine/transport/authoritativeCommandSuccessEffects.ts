import type { MatchMetadata } from './storage';
import type { TrainingDataCapture } from './trainingDataCapture';

export type AuthoritativeCommandSuccessEffectsMatch = {
    matchID: string;
    gameId: string;
    metadata: MatchMetadata;
};

export type RunAuthoritativeCommandSuccessEffectsArgs<FeedbackPayload = unknown> = {
    match: AuthoritativeCommandSuccessEffectsMatch;
    playerID: string;
    commandType: string;
    payload: unknown;
    stateIdBefore: number;
    stateIdAfter: number;
    preTrainingState: unknown;
    buildPostTrainingState: () => unknown;
    gameOver: unknown;
    unsatisfiableInteractionFeedback?: FeedbackPayload | null;
    suppressBroadcast?: boolean;
    trainingDataCapture: Pick<TrainingDataCapture, 'recordDecisionSample'>;
    reportOnlineAiRecoveryFeedback: (payload: FeedbackPayload) => Promise<void>;
    broadcastState: () => void;
    clearOnlineAiCircuitBreaker: () => void;
    persistMetadata: () => Promise<void>;
    onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void;
};

export async function runAuthoritativeCommandSuccessEffects<FeedbackPayload = unknown>(
    args: RunAuthoritativeCommandSuccessEffectsArgs<FeedbackPayload>,
): Promise<void> {
    const { match } = args;
    const postTrainingState = args.buildPostTrainingState();

    args.trainingDataCapture.recordDecisionSample({
        match: {
            matchID: match.matchID,
            gameId: match.gameId,
            metadata: match.metadata,
        },
        playerID: args.playerID,
        commandType: args.commandType,
        payload: args.payload,
        stateIdBefore: args.stateIdBefore,
        stateIdAfter: args.stateIdAfter,
        preState: args.preTrainingState,
        postState: postTrainingState,
        gameOver: args.gameOver,
    });

    if (args.unsatisfiableInteractionFeedback) {
        await args.reportOnlineAiRecoveryFeedback(args.unsatisfiableInteractionFeedback);
    }

    if (args.suppressBroadcast !== true) {
        args.broadcastState();
    }

    if (args.gameOver && !match.metadata.gameover) {
        match.metadata.gameover = args.gameOver;
        args.clearOnlineAiCircuitBreaker();
        await args.persistMetadata();
        args.onGameOver?.(match.matchID, match.gameId, args.gameOver);
    }
}
