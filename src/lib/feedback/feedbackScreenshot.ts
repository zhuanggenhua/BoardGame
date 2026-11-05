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
    lastEndgameOverlay: Element | null;
    visibilityHandler: () => void;
};

const CACHE_INTERVAL_MS = 20_000;
const CACHE_FRESHNESS_MS = CACHE_INTERVAL_MS;
const CACHE_CAPTURE_SCALE = 1;
const SCREENSHOT_MAX_WIDTH = 1280;
const SCREENSHOT_MAX_HEIGHT = 960;
const SCREENSHOT_JPEG_QUALITY = 0.7;
const GAME_END_CAPTURE_DELAY_MS = 900;

let html2CanvasLoader: Promise<Html2CanvasFn> | null = null;
const screenshotCache = new Map<string, CachedFeedbackScreenshot>();
const capturePromises = new Map<string, Promise<string | null>>();
const latestCaptureGeneration = new Map<string, number>();
const cacheSessions = new Map<string, FeedbackScreenshotCacheSession>();
let nextCaptureGeneration = 0;

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

const captureFeedbackScreenshot = async (scale: number): Promise<string | null> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const html2canvas = await loadHtml2Canvas();
    // Game overlays such as EndgameOverlay are portaled directly to body, outside the game root.
    // Capture the viewport from body so the feedback image reflects the visible end-of-game state.
    const target = document.body;
    if (!target) return null;

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
        },
    });

    return compressFeedbackCanvas(canvas);
};

const captureAndCache = (cacheKey: string, scale: number, forceFresh = false): Promise<string | null> => {
    const requestKey = `${cacheKey}:${scale}`;
    const currentCapture = capturePromises.get(requestKey);
    if (currentCapture && !forceFresh) return currentCapture;

    const generation = ++nextCaptureGeneration;
    const capturedAt = Date.now();
    latestCaptureGeneration.set(cacheKey, generation);
    const capturePromise = captureFeedbackScreenshot(scale)
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

const scheduleBackgroundCapture = (cacheKey: string, session: FeedbackScreenshotCacheSession) => {
    if (session.initialCaptureCancel) {
        session.initialCaptureCancel();
    }

    session.initialCaptureCancel = requestIdleCapture(() => {
        session.initialCaptureCancel = null;
        if (document.visibilityState === 'hidden'
            || document.querySelector('[data-testid="feedback-modal"]')) return;
        void captureAndCache(cacheKey, CACHE_CAPTURE_SCALE).catch((error) => {
            console.warn('[feedback-screenshot-cache] capture failed', error);
        });
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
    session.initialCaptureCancel = null;
    session.endgameCaptureId = null;
    session.lastEndgameOverlay = endgameOverlay();
    session.visibilityHandler = () => {
        const cached = screenshotCache.get(cacheKey);
        if (document.visibilityState === 'visible'
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
        resolve(compressFeedbackCanvas(canvas));
    };
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image load failed'));
    };
    image.src = objectUrl;
});
