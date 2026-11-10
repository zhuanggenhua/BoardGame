import { deliverFeedbackWithRetry } from './feedbackDelivery';
import type { FeedbackReplayCaptureRequest, FeedbackReplayCaptureResult, FeedbackReplayTriggerReference } from '../../engine/transport/feedbackReplayCaptureTypes';
type Capture = (request: FeedbackReplayCaptureRequest) => Promise<FeedbackReplayCaptureResult>;
const captures = new Map<string, Capture>();
const key = (matchId: string, playerId: string) => `${matchId}\u0000${playerId}`;

/** 在线对局连接负责采集；反馈入口只持有不可读取权威状态的请求能力。 */
export function registerFeedbackReplayCapture(matchId: string, playerId: string, capture: Capture): () => void {
    const id = key(matchId, playerId);
    captures.set(id, capture);
    return () => { if (captures.get(id) === capture) captures.delete(id); };
}

export async function prepareFeedbackReplayCapture(
    matchId: string,
    playerId: string,
    trigger?: FeedbackReplayTriggerReference,
): Promise<{ captureId: string; triggerCaptured: boolean } | undefined> {
    const capture = captures.get(key(matchId, playerId));
    if (!capture) return undefined;
    try {
        const result = await capture({ phase: 'prepare', trigger });
        return result.accepted && result.captureId
            ? { captureId: result.captureId, triggerCaptured: result.triggerCaptured === true }
            : undefined;
    } catch {
        return undefined;
    }
}

export async function requestFeedbackReplayCapture(matchId: string, playerId: string, feedbackId: string, captureId: string): Promise<boolean> {
    const capture = captures.get(key(matchId, playerId));
    if (!capture) return false;
    try {
        await deliverFeedbackWithRetry(async () => {
            if (!(await capture({ phase: 'attach', feedbackId, captureId })).accepted) throw new Error('feedback_capture_not_accepted');
        });
        return true;
    } catch {
        return false;
    }
}
