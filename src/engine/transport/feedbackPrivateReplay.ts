import { gzipSync } from 'node:zlib';
import type { MatchState } from '../types';
import { deliverFeedbackWithRetry, FeedbackDeliveryHttpError } from '../../lib/feedback/feedbackDelivery';

type PrivateReplayMatch = {
    matchID: string;
    gameId: string;
    stateID: number;
    state: MatchState<unknown>;
    randomSeed?: string;
    getRandomCursor?: () => number;
};

/** 仅供服务端诊断；压缩后的内容必须保存在管理员权限字段中。 */
export function capturePrivateFeedbackReplay(match: PrivateReplayMatch): { data?: string; error?: string } {
    try {
        const archive = JSON.stringify({
            schemaVersion: 1,
            matchId: match.matchID,
            gameId: match.gameId,
            stateId: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor?.(),
            state: match.state,
        });
        const data = gzipSync(archive).toString('base64');
        if (data.length > 1_000_000) return { error: 'private_replay_capture_failed:compressed_size_exceeds_limit' };
        const missing = [
            ...(typeof match.randomSeed === 'string' ? [] : ['randomSeed']),
            ...(typeof match.getRandomCursor === 'function' ? [] : ['randomCursor']),
        ];
        return missing.length ? { data, error: `private_replay_missing:${missing.join(',')}` } : { data };
    } catch (error) {
        return { error: `private_replay_capture_failed:${error instanceof Error ? error.message : String(error)}` };
    }
}

export async function attachPrivateFeedbackReplay(args: {
    endpoint: string;
    token: string;
    feedbackId: string;
    matchId: string;
    playerId: string;
    privateReplay: string;
}): Promise<void> {
    const endpoint = args.endpoint.replace(/\/system$/, `/${args.feedbackId}/private-replay`);
    if (endpoint === args.endpoint) throw new Error('invalid_internal_feedback_endpoint');
    const body = JSON.stringify({ matchId: args.matchId, playerId: args.playerId, privateReplay: args.privateReplay });
    await deliverFeedbackWithRetry(async () => {
        const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Feedback-Token': args.token }, body,
        });
        if (!response.ok) throw new FeedbackDeliveryHttpError(response.status);
    });
}
