import { cancelWarmPreload, preloadWarmImages } from './AssetLoader';

export interface WarmPreloadSchedulerOptions {
    /** 每批最多预加载多少张图片（避免长任务影响交互流畅）。 */
    batchSize?: number;
    /** 每批之间的调度间隔（ms）。默认用 requestIdleCallback 或 200ms。 */
    idleTimeoutMs?: number;
}

export interface WarmPreloadScheduler {
    /**
     * 追加一批 warm 图片预加载任务。
     * 调度器内部会对同一轮 pending 做去重。
     */
    enqueue(paths: string[], locale?: string, gameId?: string, options?: WarmPreloadSchedulerOptions): void;
    /** 暂停后台 warm 预加载（不会影响关键图片门禁）。 */
    pause(): void;
    /** 恢复后台 warm 预加载（若有 pending 会继续）。 */
    resume(): void;
    /** 取消当前 warm 队列（并清空调度器 pending）。 */
    cancel(): void;
}

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_IDLE_TIMEOUT_MS = 3000;

/**
 * 创建 warm 图片预加载调度器。
 *
 * 设计目标：
 * - 首屏速度优先：warm 永远在关键门禁之后执行
 * - 交互流畅度优先：分批调度，避免一次性队列过长
 * - WebView 友好：支持 visibilitychange 暂停（由上层决定何时调用 pause/resume）
 */
export function createWarmPreloadScheduler(): WarmPreloadScheduler {
    let paused = false;
    let scheduled = false;

    let pendingPaths = new Set<string>();
    let pendingLocale: string | undefined;
    let pendingGameId: string | undefined;
    let lastOptions: WarmPreloadSchedulerOptions | undefined;

    const schedule = () => {
        if (scheduled) return;
        scheduled = true;

        const run = () => {
            scheduled = false;
            if (paused) return;
            if (pendingPaths.size === 0) return;

            const batchSize = lastOptions?.batchSize ?? DEFAULT_BATCH_SIZE;
            const batch: string[] = [];
            for (const p of pendingPaths) {
                batch.push(p);
                pendingPaths.delete(p);
                if (batch.length >= batchSize) break;
            }

            preloadWarmImages(batch, pendingLocale, pendingGameId);

            if (pendingPaths.size > 0) {
                schedule();
            }
        };

        const timeout = lastOptions?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => run(), { timeout });
        } else {
            setTimeout(run, 200);
        }
    };

    return {
        enqueue(paths, locale, gameId, options) {
            if (paths.length === 0) return;
            pendingLocale = locale;
            pendingGameId = gameId;
            lastOptions = options;
            for (const p of paths) {
                if (p) pendingPaths.add(p);
            }
            if (!paused) schedule();
        },
        pause() {
            paused = true;
        },
        resume() {
            if (!paused) return;
            paused = false;
            if (pendingPaths.size > 0) schedule();
        },
        cancel() {
            cancelWarmPreload();
            pendingPaths = new Set();
            pendingLocale = undefined;
            pendingGameId = undefined;
            lastOptions = undefined;
        },
    };
}

