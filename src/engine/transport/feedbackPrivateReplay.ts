import { gzipSync } from 'node:zlib';
import { loadavg } from 'node:os';
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

export type PrivateFeedbackReplayTrigger = {
    source: 'authoritative-command-failure' | 'authoritative-command' | 'online-ai-watchdog' | 'player-command-feedback';
    commandType?: string;
    playerId?: string;
    payload?: unknown;
    requestId?: string;
    stateIdBefore?: number;
    stateIdAfter?: number;
    randomCursorBefore?: number;
    randomCursorAfter?: number;
    stateAfter?: MatchState<unknown>;
    reason?: string;
    progressMarker?: string;
};

/** 仅供服务端诊断；压缩后的内容必须保存在管理员权限字段中。 */
export function capturePrivateFeedbackReplay(
    match: PrivateReplayMatch,
    trigger?: PrivateFeedbackReplayTrigger,
): { data?: string; error?: string } {
    try {
        const memory = process.memoryUsage();
        const cpu = process.cpuUsage();
        const archive = JSON.stringify({
            schemaVersion: 1,
            matchId: match.matchID,
            gameId: match.gameId,
            stateId: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor?.(),
            // 私密现场保存采集时游戏服务进程指标；累计 CPU 不是瞬时 CPU 使用率。
            serverMetrics: {
                capturedAt: new Date().toISOString(),
                processUptimeSeconds: process.uptime(),
                processCpuUserMicros: cpu.user,
                processCpuSystemMicros: cpu.system,
                processRssBytes: memory.rss,
                processHeapUsedBytes: memory.heapUsed,
                systemLoadAverage: loadavg(),
            },
            state: match.state,
            ...(trigger ? { trigger } : {}),
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
    privateReplayTriggerCaptured: boolean;
}): Promise<void> {
    const endpoint = args.endpoint.replace(/\/system$/, `/${args.feedbackId}/private-replay`);
    if (endpoint === args.endpoint) throw new Error('invalid_internal_feedback_endpoint');
    const body = JSON.stringify({
        matchId: args.matchId,
        playerId: args.playerId,
        privateReplay: args.privateReplay,
        privateReplayTriggerCaptured: args.privateReplayTriggerCaptured,
    });
    await deliverFeedbackWithRetry(async () => {
        const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Feedback-Token': args.token }, body,
        });
        if (!response.ok) throw new FeedbackDeliveryHttpError(response.status);
    });
}

/** 权威快照已准备但附件失败时，把失败状态写回同一条反馈，避免永久显示为等待中。 */
export async function reportPrivateFeedbackReplayAttachmentFailure(args: {
    endpoint: string;
    token: string;
    feedbackId: string;
    matchId: string;
    playerId: string;
}): Promise<void> {
    const endpoint = args.endpoint.replace(/\/system$/, `/${args.feedbackId}/private-replay`);
    if (endpoint === args.endpoint) throw new Error('invalid_internal_feedback_endpoint');
    const body = JSON.stringify({
        matchId: args.matchId,
        playerId: args.playerId,
        captureError: 'private_replay_attachment_failed',
    });
    await deliverFeedbackWithRetry(async () => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Feedback-Token': args.token },
            body,
        });
        if (!response.ok) throw new FeedbackDeliveryHttpError(response.status);
    });
}
