import type { MatchMetadata } from './storage';
import type { TrainingDataCapture } from './trainingDataCapture';
import logger from '../../../server/logger.js';

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
    onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void | Promise<void>;
    runGameOverEffect?: (effect: () => Promise<void>) => Promise<void>;
    isMatchActive?: () => boolean;
};

export async function runAuthoritativeCommandSuccessEffects<FeedbackPayload = unknown>(
    args: RunAuthoritativeCommandSuccessEffectsArgs<FeedbackPayload>,
): Promise<void> {
    const { match } = args;
    try {
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
            postState: args.buildPostTrainingState(),
            gameOver: args.gameOver,
        });
    } catch (error) {
        logger.error('[GameTransport] committed training effect failed', { matchID: match.matchID, error });
    }

    if (args.unsatisfiableInteractionFeedback) {
        try {
            await args.reportOnlineAiRecoveryFeedback(args.unsatisfiableInteractionFeedback);
        } catch (error) {
            logger.error('[GameTransport] committed feedback effect failed', { matchID: match.matchID, error });
        }
    }

    if (args.suppressBroadcast !== true) {
        try {
            args.broadcastState();
        } catch (error) {
            logger.error('[GameTransport] committed broadcast failed', { matchID: match.matchID, error });
        }
    }

    if (args.gameOver && !match.metadata.gameover) {
        let metadataPersisted = false;
        const deliver = async () => {
            if (args.isMatchActive?.() === false) return;
            if (!metadataPersisted) {
                const previousGameOver = match.metadata.gameover;
                match.metadata.gameover = args.gameOver;
                try {
                    await args.persistMetadata();
                    metadataPersisted = true;
                } catch (error) {
                    match.metadata.gameover = previousGameOver;
                    throw error;
                }
            }
            if (args.isMatchActive?.() === false) return;
            args.clearOnlineAiCircuitBreaker();
            await args.onGameOver?.(match.matchID, match.gameId, args.gameOver);
        };
        if (args.runGameOverEffect) await args.runGameOverEffect(deliver);
        else await deliver();
    }
}
