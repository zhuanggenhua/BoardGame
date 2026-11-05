/** 单次故障的诊断内容固定后重试传输，避免临时网络错误丢失首次现场。 */
export async function deliverFeedbackWithRetry(deliver: () => Promise<void>): Promise<void> {
    const retryDelays = [200, 800];
    for (let attempt = 0; ; attempt += 1) {
        try {
            await deliver();
            return;
        } catch (error) {
            const status = error instanceof FeedbackDeliveryHttpError ? error.status : undefined;
            if (attempt >= retryDelays.length || (status !== undefined && status < 500 && status !== 429)) throw error;
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
    }
}

export class FeedbackDeliveryHttpError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`feedback_http_${status}`);
        this.status = status;
    }
}
