import { captureDiceCanvas } from '../dice-box-threejs/canvasCapture';

type FeedbackScreenshotContext = {
    gameId?: string | null;
    matchId?: string | null;
    mode?: string | null;
};

export type CachedFeedbackScreenshot = {
    dataUrl: string;
    capturedAt: number;
};

type Html2CanvasFn = typeof import('html2canvas').default;
type FeedbackScreenshotCacheSession = {
    refCount: number;
    intervalId: number;
    initialCaptureCancel: (() => void) | null;
    endgameCaptureId: number | null;
    observer: MutationObserver;
    animationObserver: MutationObserver;
    backgroundPending: boolean;
    lastEndgameOverlay: Element | null;
    visibilityHandler: () => void;
};

const CACHE_INTERVAL_MS = 20_000;
const CACHE_FRESHNESS_MS = CACHE_INTERVAL_MS;
const CACHE_CAPTURE_SCALE = 1;
const SCREENSHOT_MAX_WIDTH = 1280;
const SCREENSHOT_MAX_HEIGHT = 960;
const SCREENSHOT_JPEG_QUALITY = 0.7;
const SCREENSHOT_WORKER_TIMEOUT_MS = 5000;
const GAME_END_CAPTURE_DELAY_MS = 900;

let html2CanvasLoader: Promise<Html2CanvasFn> | null = null;
const screenshotCache = new Map<string, CachedFeedbackScreenshot>();
const capturePromises = new Map<string, Promise<string | null>>();
const latestCaptureGeneration = new Map<string, number>();
const cacheSessions = new Map<string, FeedbackScreenshotCacheSession>();
let nextCaptureGeneration = 0;

class BackgroundCaptureDeferred extends Error {}

// 战斗结果间仍属于同一演出；等待整段结束后再补采，避免下一轮投骰时抢跑。
const criticalAnimationActive = () => Boolean(document.querySelector(
    '[data-battle-roll-phase], [data-dice-physics-source][data-dice-settled="false"]',
));

const buildCacheKey = (context: FeedbackScreenshotContext): string | null => {
    const gameId = context.gameId?.trim();
    if (!gameId) return null;

    return `${gameId}:${context.matchId?.trim() || context.mode?.trim() || 'game'}`;
};

const loadHtml2Canvas = async (): Promise<Html2CanvasFn> => {
    if (!html2CanvasLoader) {
        html2CanvasLoader = import('html2canvas')
            .then((module) => module.default)
            .catch((error) => {
                html2CanvasLoader = null;
                throw error;
            });
    }

    return html2CanvasLoader;
};

const visibleViewportSize = (target: HTMLElement) => ({
    width: Math.max(1, Math.round(window.innerWidth || target.clientWidth || 1)),
    height: Math.max(1, Math.round(window.innerHeight || target.clientHeight || 1)),
});

const captureFeedbackScreenshot = async (scale: number, defer?: () => boolean): Promise<string | null> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const html2canvas = await loadHtml2Canvas();
    if (defer?.()) throw new BackgroundCaptureDeferred();
    // Game overlays such as EndgameOverlay are portaled directly to body, outside the game root.
    // Capture the viewport from body so the feedback image reflects the visible end-of-game state.
    const target = document.body;
    if (!target) return null;

    // 渲染器也在 canvas 本体写入相同属性；只对容器取快照，避免把画布当成第二个骰子。
    const diceWrappers = [...target.querySelectorAll<HTMLElement>('[data-dice-physics-source="dice-box-threejs"]:not(canvas)')];
    const diceSnapshots = diceWrappers.map(wrapper => {
        const canvas = wrapper.querySelector('canvas');
        if (!canvas) {
            if (wrapper.dataset.diceEngineReady === 'true') throw new Error('骰子渲染画布不存在');
            return { id: wrapper.dataset.testid ?? null, image: null };
        }
        const copy = captureDiceCanvas(canvas);
        if (!copy) throw new Error('骰子渲染画布未注册截图');
        return { id: wrapper.dataset.testid ?? null, image: copy.toDataURL() };
    });

    const viewport = visibleViewportSize(target);
    const canvas = await html2canvas(target, {
        backgroundColor: null,
        // foreignObjectRendering preserves the Tailwind v4 oklab styles used by the board.
        foreignObjectRendering: true,
        useCORS: true,
        logging: false,
        scale,
        width: viewport.width,
        height: viewport.height,
        windowWidth: viewport.width,
        windowHeight: viewport.height,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        onclone: async (clonedDocument) => {
            try {
            const abortIfDeferred = () => {
                if (!defer?.()) return;
                throw new BackgroundCaptureDeferred();
            };
            abortIfDeferred();
            const clonedDice = [...clonedDocument.querySelectorAll<HTMLElement>('[data-dice-physics-source="dice-box-threejs"]:not(canvas)')];
            if (clonedDice.length !== diceSnapshots.length) throw new Error(`骰子截图期间画布数量发生变化（源 ${diceSnapshots.length}，副本 ${clonedDice.length}）`);
            diceSnapshots.forEach((snapshot, index) => {
                const wrapper = clonedDice[index];
                if ((wrapper.dataset.testid ?? null) !== snapshot.id) throw new Error('骰子截图期间画布顺序发生变化');
                if (!snapshot.image) return;
                const images = wrapper.querySelectorAll('img');
                if (images.length !== 1) throw new Error('骰子截图副本不匹配');
                images[0].src = snapshot.image;
            });
            clonedDocument.querySelectorAll(
                '[data-feedback-exclude="true"], [data-testid="feedback-modal"]',
            ).forEach((element) => element.remove());

            // foreignObject output cannot read blob/external images after export. Embed visible
            // images in the clone only, so the live board and its loading state are untouched.
            await Promise.all([...clonedDocument.images].map(async (image) => {
                const rect = image.getBoundingClientRect();
                if (!rect.width || !rect.height || rect.right <= 0 || rect.bottom <= 0
                    || rect.left >= viewport.width || rect.top >= viewport.height) return;
                const src = image.currentSrc || image.src;
                if (!src || src.startsWith('data:')) return;
                const response = await fetch(src, { credentials: 'same-origin' });
                if (!response.ok) throw new Error(`截图图片读取失败：HTTP ${response.status}`);
                const blob = await response.blob();
                image.src = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(reader.error ?? new Error('截图图片编码失败'));
                    reader.readAsDataURL(blob);
                });
                image.removeAttribute('srcset');
                await image.decode();
            }));
            abortIfDeferred();
            } catch (error) {
                // html2canvas 在 onclone 抛错时不会回收 iframe。
                clonedDocument.defaultView?.frameElement?.remove();
                throw error;
            }
        },
    });

    return compressFeedbackCanvasAsync(canvas);
};

/** 将缩放和 JPEG 编码移到 worker，避免压住正在播放的游戏动画。 */
const compressFeedbackCanvasAsync = async (canvas: HTMLCanvasElement): Promise<string> => {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
        return compressFeedbackCanvas(canvas);
    }
    let bitmap: ImageBitmap | undefined;
    let worker: Worker | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        bitmap = await createImageBitmap(canvas);
        worker = new Worker(new URL('./feedbackScreenshot.worker.ts', import.meta.url), { type: 'module' });
        const result = await new Promise<string>((resolve, reject) => {
            timeoutId = setTimeout(() => reject(new Error('截图编码 worker 超时')), SCREENSHOT_WORKER_TIMEOUT_MS);
            worker!.onmessage = (event: MessageEvent<{ dataUrl?: string; error?: string }>) => {
                if (event.data.error || !event.data.dataUrl) reject(new Error(event.data.error || '截图编码未返回结果'));
                else resolve(event.data.dataUrl);
            };
            worker!.onerror = (event) => reject(new Error(event.message || '截图编码 worker 失败'));
            worker!.onmessageerror = () => reject(new Error('截图编码 worker 返回数据无法解析'));
            worker!.postMessage({ bitmap, maxWidth: SCREENSHOT_MAX_WIDTH, maxHeight: SCREENSHOT_MAX_HEIGHT, quality: SCREENSHOT_JPEG_QUALITY }, [bitmap!]);
            bitmap = undefined;
        });
        return result;
    } catch (error) {
        console.warn('[feedback-screenshot] worker encoding failed; using canvas encoding', error);
        return compressFeedbackCanvas(canvas);
    } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        bitmap?.close();
        worker?.terminate();
    }
};

const captureAndCache = (cacheKey: string, scale: number, forceFresh = false, defer?: () => boolean): Promise<string | null> => {
    const requestKey = `${cacheKey}:${scale}`;
    const currentCapture = capturePromises.get(requestKey);
    if (currentCapture && !forceFresh) return currentCapture;

    const generation = ++nextCaptureGeneration;
    const capturedAt = Date.now();
    latestCaptureGeneration.set(cacheKey, generation);
    const capturePromise = captureFeedbackScreenshot(scale, defer)
        .then((dataUrl) => {
            if (dataUrl && latestCaptureGeneration.get(cacheKey) === generation) {
                screenshotCache.set(cacheKey, { dataUrl, capturedAt });
            }
            return dataUrl;
        })
        .finally(() => {
            if (capturePromises.get(requestKey) === capturePromise) {
                capturePromises.delete(requestKey);
            }
        });
    capturePromises.set(requestKey, capturePromise);
    return capturePromise;
};

const requestIdleCapture = (callback: () => void): (() => void) => {
    const idleWindow = window as Window & {
        requestIdleCallback?: (handler: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
        const requestId = idleWindow.requestIdleCallback(callback, { timeout: 2500 });
        return () => idleWindow.cancelIdleCallback?.(requestId);
    }

    const timeoutId = window.setTimeout(callback, 800);
    return () => window.clearTimeout(timeoutId);
};

const runPendingBackgroundCapture = (cacheKey: string, session: FeedbackScreenshotCacheSession) => {
    if (cacheSessions.get(cacheKey) !== session || !session.backgroundPending || document.visibilityState === 'hidden'
        || document.querySelector('[data-testid="feedback-modal"]') || criticalAnimationActive()) return;
    session.backgroundPending = false;
    void captureAndCache(cacheKey, CACHE_CAPTURE_SCALE, false, criticalAnimationActive).catch((error) => {
        if (!(error instanceof BackgroundCaptureDeferred)) {
            console.warn('[feedback-screenshot-cache] capture failed', error);
            return;
        }
        if (cacheSessions.get(cacheKey) !== session) return;
        session.backgroundPending = true;
        // 动画可能在异步截图拒绝前已经结束，不能只依赖后续 DOM 通知。
        queueMicrotask(() => runPendingBackgroundCapture(cacheKey, session));
    });
};

const scheduleBackgroundCapture = (cacheKey: string, session: FeedbackScreenshotCacheSession) => {
    session.backgroundPending = true;
    if (criticalAnimationActive()) return;
    if (session.initialCaptureCancel) {
        session.initialCaptureCancel();
    }

    session.initialCaptureCancel = requestIdleCapture(() => {
        session.initialCaptureCancel = null;
        runPendingBackgroundCapture(cacheKey, session);
    });
};

const endgameOverlay = () => document.querySelector('[data-testid="endgame-overlay"]');

export const readCachedFeedbackScreenshot = (
    context: FeedbackScreenshotContext,
): CachedFeedbackScreenshot | null => {
    const cacheKey = buildCacheKey(context);
    if (!cacheKey) return null;
    return screenshotCache.get(cacheKey) ?? null;
};

export const captureCurrentFeedbackScreenshot = async (
    context: FeedbackScreenshotContext,
): Promise<string | null> => {
    const cacheKey = buildCacheKey(context);
    if (!cacheKey) return null;
    return captureAndCache(cacheKey, 1, true);
};

/**
 * Keeps one viewport-sized, in-memory screenshot for the active game. Captures are throttled,
 * skipped while hidden or while the feedback form is open, and refreshed after a game ends.
 */
export const startFeedbackScreenshotCache = (
    context: FeedbackScreenshotContext,
): (() => void) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;

    const cacheKey = buildCacheKey(context);
    if (!cacheKey || !document.querySelector('[data-game-page]')) return () => undefined;

    const existingSession = cacheSessions.get(cacheKey);
    if (existingSession) {
        existingSession.refCount += 1;
        return () => stopFeedbackScreenshotCache(cacheKey, existingSession);
    }

    const session = {} as FeedbackScreenshotCacheSession;
    session.refCount = 1;
    session.backgroundPending = false;
    session.initialCaptureCancel = null;
    session.endgameCaptureId = null;
    session.lastEndgameOverlay = endgameOverlay();
    session.visibilityHandler = () => {
        const cached = screenshotCache.get(cacheKey);
        if (document.visibilityState === 'visible' && session.backgroundPending) {
            runPendingBackgroundCapture(cacheKey, session);
        } else if (document.visibilityState === 'visible'
            && (!cached || Date.now() - cached.capturedAt >= CACHE_FRESHNESS_MS)) {
            scheduleBackgroundCapture(cacheKey, session);
        }
    };
    session.observer = new MutationObserver(() => {
        const currentEndgameOverlay = endgameOverlay();
        if (currentEndgameOverlay === session.lastEndgameOverlay) return;
        session.lastEndgameOverlay = currentEndgameOverlay;

        if (!currentEndgameOverlay) return;
        if (session.endgameCaptureId !== null) {
            window.clearTimeout(session.endgameCaptureId);
        }
        session.endgameCaptureId = window.setTimeout(() => {
            session.endgameCaptureId = null;
            if (document.visibilityState === 'hidden'
                || document.querySelector('[data-testid="feedback-modal"]')) return;
            void captureAndCache(cacheKey, CACHE_CAPTURE_SCALE).catch((error) => {
                console.warn('[feedback-screenshot-cache] endgame capture failed', error);
            });
        }, GAME_END_CAPTURE_DELAY_MS);
    });
    // EndgameOverlay portals directly to body. Observe only its direct children to avoid
    // reacting to the game's many nested board updates.
    session.observer.observe(document.body, { childList: true });
    session.animationObserver = new MutationObserver(() => {
        if (session.backgroundPending && !criticalAnimationActive()) runPendingBackgroundCapture(cacheKey, session);
    });
    session.animationObserver.observe(document.body, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-battle-roll-state', 'data-dice-settled'] });
    session.intervalId = window.setInterval(() => scheduleBackgroundCapture(cacheKey, session), CACHE_INTERVAL_MS);
    document.addEventListener('visibilitychange', session.visibilityHandler);
    cacheSessions.set(cacheKey, session);

    scheduleBackgroundCapture(cacheKey, session);
    if (session.lastEndgameOverlay) {
        session.endgameCaptureId = window.setTimeout(() => {
            session.endgameCaptureId = null;
            if (document.visibilityState === 'hidden') return;
            void captureAndCache(cacheKey, CACHE_CAPTURE_SCALE).catch((error) => {
                console.warn('[feedback-screenshot-cache] endgame capture failed', error);
            });
        }, GAME_END_CAPTURE_DELAY_MS);
    }

    return () => stopFeedbackScreenshotCache(cacheKey, session);
};

const stopFeedbackScreenshotCache = (cacheKey: string, session: FeedbackScreenshotCacheSession) => {
    session.refCount -= 1;
    if (session.refCount > 0) return;

    session.initialCaptureCancel?.();
    if (session.endgameCaptureId !== null) window.clearTimeout(session.endgameCaptureId);
    window.clearInterval(session.intervalId);
    document.removeEventListener('visibilitychange', session.visibilityHandler);
    session.observer.disconnect();
    session.animationObserver.disconnect();
    cacheSessions.delete(cacheKey);
    screenshotCache.delete(cacheKey);
    latestCaptureGeneration.delete(cacheKey);
};

export const compressFeedbackCanvas = (sourceCanvas: HTMLCanvasElement): string => {
    let { width, height } = sourceCanvas;
    if (width > SCREENSHOT_MAX_WIDTH || height > SCREENSHOT_MAX_HEIGHT) {
        const ratio = Math.min(SCREENSHOT_MAX_WIDTH / width, SCREENSHOT_MAX_HEIGHT / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
    }

    if (width === sourceCanvas.width && height === sourceCanvas.height) {
        return sourceCanvas.toDataURL('image/jpeg', SCREENSHOT_JPEG_QUALITY);
    }

    const compressedCanvas = document.createElement('canvas');
    compressedCanvas.width = width;
    compressedCanvas.height = height;
    const context = compressedCanvas.getContext('2d');
    if (!context) {
        return sourceCanvas.toDataURL('image/jpeg', SCREENSHOT_JPEG_QUALITY);
    }

    context.drawImage(sourceCanvas, 0, 0, width, height);
    return compressedCanvas.toDataURL('image/jpeg', SCREENSHOT_JPEG_QUALITY);
};

export const compressFeedbackImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const ratio = Math.min(
            1,
            SCREENSHOT_MAX_WIDTH / image.width,
            SCREENSHOT_MAX_HEIGHT / image.height,
        );
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
            reject(new Error('Canvas not available'));
            return;
        }

        context.drawImage(image, 0, 0, width, height);
        void compressFeedbackCanvasAsync(canvas).then(resolve, reject);
    };
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image load failed'));
    };
    image.src = objectUrl;
});
