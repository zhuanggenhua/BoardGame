import React from 'react';

type FlipMode = 'overview' | 'detail' | 'flippingToDetail' | 'flippingToOverview';

type PageRect = {
    left: string;
    top: string;
    width: string;
    height: string;
};

type StageSize = {
    width: number;
    height: number;
};

type PeelCorner = 'bl' | 'br';

type ParsedRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

const DEFAULT_DURATION_MS = 380;
const COMPLETION_PROGRESS_THRESHOLD = 0.86;
const COMPLETION_FALLBACK_EXTRA_MS = 80;
const TURN_OVERLAY_READY_MAX_FRAMES = 12;
const TURN_OVERLAY_RECT_TOLERANCE_PX = 8;
const TURNJS_OVERVIEW_PAGE = 2;
const TURNJS_DETAIL_PAGE = 4;
const JQUERY_SCRIPT_PATH = '/vendor/jquery/jquery-1.12.0.min.js';
const TURNJS_SCRIPT_PATH = '/vendor/turnjs/turn.min.js';

type RenderStage = (options?: { includeTestId?: boolean }) => React.ReactNode;
type FlippingShellContent = 'source' | 'target';

type TurnJsInstance = {
    turn: (...args: unknown[]) => unknown;
    bind: (eventName: string, handler: (...args: unknown[]) => void) => TurnJsInstance;
    off: (eventName?: string) => TurnJsInstance;
};

type JQueryLikeFactory = (target: Element | string) => TurnJsInstance;

type JQueryGlobalFactory = JQueryLikeFactory & {
    fn?: {
        turn?: unknown;
        animatef?: JQueryAnimatef;
        __homeV2LinearTurnPatch?: boolean;
    };
};

let turnJsLoader: Promise<JQueryLikeFactory> | null = null;

type JQueryAnimationOptions = {
    turning?: boolean;
    easing?: (x: number, elapsed: number, start: number, delta: number, duration: number) => number;
};

type JQueryAnimatef = (this: unknown, options?: JQueryAnimationOptions | false) => unknown;

type HomeV2FlipHoldWindow = Window & {
    __BG_HOME_V2_E2E_HOLD_PROGRESS__?: number;
};

function loadExternalScript(
    src: string,
    marker: string,
    errorMessage: string,
) {
    return new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(`script[data-home-v2-runtime="${marker}"]`);
        if (existingScript?.dataset.loaded === 'true') {
            resolve();
            return;
        }
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error(errorMessage)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.homeV2Runtime = marker;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(errorMessage)), { once: true });
        document.head.appendChild(script);
    });
}

function readE2EHoldProgress() {
    if (typeof window === 'undefined') {
        return null;
    }
    const holdTarget = (window as HomeV2FlipHoldWindow).__BG_HOME_V2_E2E_HOLD_PROGRESS__;
    if (!Number.isFinite(holdTarget)) {
        return null;
    }
    const clamped = Math.min(0.98, Math.max(0.05, Number(holdTarget)));
    return clamped;
}

async function loadTurnJsRuntime(): Promise<JQueryLikeFactory> {
    if (!turnJsLoader) {
        turnJsLoader = (async () => {
            const globalWindow = window as typeof window & {
                $?: JQueryGlobalFactory;
                jQuery?: JQueryGlobalFactory;
            };

            if (typeof globalWindow.jQuery !== 'function') {
                await loadExternalScript(JQUERY_SCRIPT_PATH, 'jquery-1-12-0', 'HomeV2 jQuery 1.12.0 脚本加载失败');
            }

            if (typeof globalWindow.jQuery?.fn?.turn !== 'function') {
                await loadExternalScript(TURNJS_SCRIPT_PATH, 'turnjs-4-1-0', 'turn.js 官方脚本加载失败');
            }

            const $ = globalWindow.jQuery ?? globalWindow.$;
            if (typeof $ !== 'function' || typeof $.fn?.turn !== 'function') {
                throw new Error('turn.js 插件未正确挂载到 jQuery 实例');
            }

            if (typeof $.fn.animatef === 'function' && !$.fn.__homeV2LinearTurnPatch) {
                const originalAnimatef = $.fn.animatef;
                $.fn.animatef = function linearHomeV2Turn(options) {
                    if (options && typeof options === 'object' && options.turning && typeof options.easing !== 'function') {
                        return originalAnimatef.call(this, {
                            ...options,
                            easing: (_x, elapsed, start, delta, duration) => start + delta * Math.min(1, elapsed / duration),
                        });
                    }
                    return originalAnimatef.call(this, options);
                };
                $.fn.__homeV2LinearTurnPatch = true;
            }

            globalWindow.$ = $;
            globalWindow.jQuery = $;

            return $;
        })();
    }

    return turnJsLoader;
}

function parsePercent(raw: string) {
    return Number.parseFloat(raw.replace('%', '')) / 100;
}

function parseRect(rect: PageRect): ParsedRect {
    return {
        left: parsePercent(rect.left),
        top: parsePercent(rect.top),
        width: parsePercent(rect.width),
        height: parsePercent(rect.height),
    };
}

function createRectStyleFromParsedRect(rect: ParsedRect): React.CSSProperties {
    return {
        position: 'absolute',
        left: `${rect.left * 100}%`,
        top: `${rect.top * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
    };
}

function getUnionRect(leftRect: PageRect, rightRect: PageRect): ParsedRect {
    const left = parseRect(leftRect);
    const right = parseRect(rightRect);
    const unionLeft = Math.min(left.left, right.left);
    const unionTop = Math.min(left.top, right.top);
    const unionRight = Math.max(left.left + left.width, right.left + right.width);
    const unionBottom = Math.max(left.top + left.height, right.top + right.height);

    return {
        left: unionLeft,
        top: unionTop,
        width: unionRight - unionLeft,
        height: unionBottom - unionTop,
    };
}

function StageCanvas({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            {children}
        </div>
    );
}

function StageFrame({
    stageSize,
    children,
}: {
    stageSize: StageSize;
    children: React.ReactNode;
}) {
    return (
        <div
            className="relative shrink-0"
            style={{
                width: stageSize.width,
                height: stageSize.height,
            }}
        >
            {children}
        </div>
    );
}

function TurnJsPageSlice({
    stage,
    unionRect,
    side,
}: {
    stage: React.ReactNode;
    unionRect: ParsedRect;
    side: 'left' | 'right';
}) {
    const pageWidth = unionRect.width / 2;
    const pageLeft = side === 'left' ? unionRect.left : unionRect.left + pageWidth;

    return (
        <div className="relative h-full w-full overflow-hidden bg-transparent">
            <div
                className="absolute"
                style={{
                    left: `${-(pageLeft / pageWidth) * 100}%`,
                    top: `${-(unionRect.top / unionRect.height) * 100}%`,
                    width: `${100 / pageWidth}%`,
                    height: `${100 / unionRect.height}%`,
                    pointerEvents: 'none',
                }}
            >
                {stage}
            </div>
        </div>
    );
}

function sanitizeOverlayDom(root: HTMLElement) {
    const duplicatedAttributes = ['data-testid', 'data-game-id', 'data-scene-slot', 'data-scene-node'];
    root.querySelectorAll<HTMLElement>('*').forEach((element) => {
        duplicatedAttributes.forEach((attributeName) => {
            if (element.hasAttribute(attributeName)) {
                element.removeAttribute(attributeName);
            }
        });
        element.setAttribute('aria-hidden', 'true');
    });
}

function toRoundedRect(rect: DOMRect) {
    return {
        left: Math.round(rect.left * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        bottom: Math.round(rect.bottom * 10) / 10,
    };
}

export interface FoldLinePageFlipStageProps {
    mode: FlipMode;
    renderOverviewStage: RenderStage;
    renderDetailStage: RenderStage;
    renderOverviewFlipStage?: RenderStage;
    renderDetailFlipStage?: RenderStage;
    overviewStageSize: StageSize;
    detailStageSize: StageSize;
    leftPageRect: PageRect;
    rightPageRect: PageRect;
    durationMs?: number;
    enableDetailPreview?: boolean;
    flippingShellContent?: FlippingShellContent;
    testId?: string;
    onFlipToDetailComplete?: () => void;
    onFlipToOverviewComplete?: () => void;
}

export function FoldLinePageFlipStage({
    mode,
    renderOverviewStage,
    renderDetailStage,
    renderOverviewFlipStage,
    renderDetailFlipStage,
    overviewStageSize,
    detailStageSize,
    leftPageRect,
    rightPageRect,
    durationMs = DEFAULT_DURATION_MS,
    enableDetailPreview = true,
    flippingShellContent = 'target',
    testId,
    onFlipToDetailComplete,
    onFlipToOverviewComplete,
}: FoldLinePageFlipStageProps) {
    const flipbookRef = React.useRef<HTMLDivElement | null>(null);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const visibleStageCaptureRef = React.useRef<HTMLDivElement | null>(null);
    const cancelProgressLoopRef = React.useRef<(() => void) | null>(null);
    const animationStartedAtRef = React.useRef<number | null>(null);
    const completionTimerRef = React.useRef<number | null>(null);
    const completionHoldPollRef = React.useRef<number | null>(null);
    const completeOnceRef = React.useRef(false);
    const isAnimatingRef = React.useRef(false);
    const mainEffectRunCountRef = React.useRef(0);
    const progressLoopStartCountRef = React.useRef(0);
    const progressTickCountRef = React.useRef(0);
    const rawProgressRef = React.useRef(0);
    const [turnReady, setTurnReady] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [turnOverlayVisible, setTurnOverlayVisible] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [rawProgress, setRawProgress] = React.useState(0);
    const [turnError, setTurnError] = React.useState<string | null>(null);
    const [overviewStageReady, setOverviewStageReady] = React.useState(false);

    React.useEffect(() => {
        isAnimatingRef.current = isAnimating;
    }, [isAnimating]);

    React.useEffect(() => {
        rawProgressRef.current = rawProgress;
    }, [rawProgress]);

    React.useEffect(() => () => {
        cancelProgressLoopRef.current?.();
        cancelProgressLoopRef.current = null;
        if (completionTimerRef.current !== null) {
            window.clearTimeout(completionTimerRef.current);
            completionTimerRef.current = null;
        }
        if (completionHoldPollRef.current !== null) {
            window.clearTimeout(completionHoldPollRef.current);
            completionHoldPollRef.current = null;
        }
    }, []);

    const currentEntryPage = mode === 'detail' ? TURNJS_DETAIL_PAGE : TURNJS_OVERVIEW_PAGE;
    const targetEntryPage = mode === 'detail' || mode === 'flippingToOverview'
        ? TURNJS_OVERVIEW_PAGE
        : TURNJS_DETAIL_PAGE;
    const turningToDetail = targetEntryPage === TURNJS_DETAIL_PAGE;
    const flippingToDetail = mode === 'flippingToDetail';
    const isFlipping = mode === 'flippingToDetail' || mode === 'flippingToOverview';
    const sourceEntryPage = flippingToDetail ? TURNJS_OVERVIEW_PAGE : TURNJS_DETAIL_PAGE;
    const initialEntryPage = isFlipping ? sourceEntryPage : currentEntryPage;

    const finishFlip = React.useCallback(() => {
        if (completeOnceRef.current) {
            return;
        }
        completeOnceRef.current = true;
        cancelProgressLoopRef.current?.();
        cancelProgressLoopRef.current = null;
        setTurnReady(false);
        setIsAnimating(false);
        setTurnOverlayVisible(false);
        setProgress(1);
        setRawProgress(1);
        if (turningToDetail) {
            onFlipToDetailComplete?.();
        } else {
            onFlipToOverviewComplete?.();
        }
    }, [onFlipToDetailComplete, onFlipToOverviewComplete, turningToDetail]);

    const requestFinishFlip = React.useCallback(() => {
        if (completeOnceRef.current) {
            return;
        }
        if (completionHoldPollRef.current !== null) {
            window.clearTimeout(completionHoldPollRef.current);
            completionHoldPollRef.current = null;
        }

        const tryFinishWhenReleased = () => {
            if (readE2EHoldProgress() !== null) {
                completionHoldPollRef.current = window.setTimeout(tryFinishWhenReleased, 16);
                return;
            }
            completionHoldPollRef.current = null;
            finishFlip();
        };

        tryFinishWhenReleased();
    }, [finishFlip]);

    const overviewStageForTurn = (renderOverviewFlipStage ?? renderOverviewStage)({ includeTestId: false });
    const detailStageForTurn = (renderDetailFlipStage ?? renderDetailStage)({ includeTestId: false });
    const sourceVisibleStage = turningToDetail
        ? renderOverviewStage({ includeTestId: false })
        : renderDetailStage({ includeTestId: false });
    const targetVisibleStage = turningToDetail ? detailStageForTurn : overviewStageForTurn;
    const flippingShellStage = flippingShellContent === 'source' ? sourceVisibleStage : targetVisibleStage;
    const shouldHoldSourceStage = isFlipping && (!isAnimating || !turnOverlayVisible);
    const detailPreviewOpacity = enableDetailPreview && turningToDetail && isFlipping
        ? Math.min(0.92, Math.max(0, (progress - 0.12) / 0.32) * 0.92)
        : 0;
    const activeStageSize = mode === 'detail' || mode === 'flippingToDetail'
        ? detailStageSize
        : overviewStageSize;
    const unionRect = getUnionRect(leftPageRect, rightPageRect);
    const unionWidth = activeStageSize.width * unionRect.width;
    const unionHeight = activeStageSize.height * unionRect.height;
    const baseStage = mode === 'overview'
        ? renderOverviewStage({ includeTestId: true })
        : mode === 'detail'
            ? renderDetailStage({ includeTestId: true })
            : isFlipping
                ? (
                    <div className="relative h-full w-full">
                        {shouldHoldSourceStage ? (
                            <div
                                className="pointer-events-none absolute inset-0 z-[30]"
                                aria-hidden="true"
                            >
                                {sourceVisibleStage}
                            </div>
                        ) : null}
                        {turningToDetail ? (
                            <div
                                className="pointer-events-none absolute inset-0 z-[11]"
                                aria-hidden="true"
                                style={{ opacity: shouldHoldSourceStage ? 0 : detailPreviewOpacity }}
                            >
                                {renderDetailStage({ includeTestId: false })}
                            </div>
                        ) : null}
                        <div
                            className="pointer-events-none absolute inset-0"
                            aria-hidden="true"
                            style={{ visibility: shouldHoldSourceStage ? 'hidden' : 'visible' }}
                        >
                            {flippingShellStage}
                        </div>
                        <div
                            className="absolute overflow-visible"
                            style={{
                                ...createRectStyleFromParsedRect(unionRect),
                                visibility: shouldHoldSourceStage ? 'hidden' : 'visible',
                            }}
                            aria-hidden="true"
                        >
                            <div
                                ref={flipbookRef}
                                key={`turnjs-visible-${mode}-${Math.round(unionWidth)}x${Math.round(unionHeight)}`}
                                data-home-v2-turn-book="true"
                                className="relative h-full w-full"
                                style={{
                                    width: unionWidth,
                                    height: unionHeight,
                                }}
                            >
                                <div className="h-full w-full bg-transparent" />
                                <div className="h-full w-full bg-transparent">
                                    <TurnJsPageSlice
                                        stage={overviewStageForTurn}
                                        unionRect={unionRect}
                                        side="left"
                                    />
                                </div>
                                <div className="h-full w-full bg-transparent">
                                    <TurnJsPageSlice
                                        stage={overviewStageForTurn}
                                        unionRect={unionRect}
                                        side="right"
                                    />
                                </div>
                                <div className="h-full w-full bg-transparent">
                                    <TurnJsPageSlice
                                        stage={detailStageForTurn}
                                        unionRect={unionRect}
                                        side="left"
                                    />
                                </div>
                                <div className="h-full w-full bg-transparent">
                                    <TurnJsPageSlice
                                        stage={detailStageForTurn}
                                        unionRect={unionRect}
                                        side="right"
                                    />
                                </div>
                                <div className="h-full w-full bg-transparent" />
                            </div>
                        </div>
                    </div>
                )
                : renderOverviewStage({ includeTestId: true });
    const idlePeelCorner: PeelCorner = mode === 'detail' ? 'bl' : 'br';
    // Home V2 的 overview 源页可能依赖异步缩略图，需要等首帧落地；同步书页（例如山屋剧本）
    // 会直接从 flipping 状态挂载，没有先经历 overview 稳态，因此不能被同一等待条件永久拦住。
    const sourceStageCanStartImmediately = renderOverviewFlipStage === undefined && renderDetailFlipStage === undefined;
    const activeSourceReady = !flippingToDetail || overviewStageReady || sourceStageCanStartImmediately;

    React.useEffect(() => {
        if (mode !== 'overview') {
            return undefined;
        }

        let cancelled = false;
        setOverviewStageReady(false);
        const frameId = window.requestAnimationFrame(() => {
            if (cancelled) {
                return;
            }
            setOverviewStageReady(true);
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frameId);
        };
    }, [mode]);

    React.useEffect(() => {
        if (!isFlipping || !isAnimating) {
            return undefined;
        }

        cancelProgressLoopRef.current?.();
        progressLoopStartCountRef.current += 1;
        if (rootRef.current) {
            rootRef.current.dataset.turnProgressLoopStarts = String(progressLoopStartCountRef.current);
        }

        const tick = () => {
            const startedAt = animationStartedAtRef.current ?? performance.now();
            if (animationStartedAtRef.current === null) {
                animationStartedAtRef.current = startedAt;
            }
            const nextRaw = Math.min(0.999, (performance.now() - startedAt) / durationMs);
            const holdTarget = readE2EHoldProgress();
            progressTickCountRef.current += 1;
            if (rootRef.current) {
                rootRef.current.dataset.turnProgressTicks = String(progressTickCountRef.current);
                rootRef.current.dataset.turnProgressLastRaw = nextRaw.toFixed(3);
            }

            if (holdTarget !== null && nextRaw >= holdTarget) {
                setRawProgress(holdTarget);
                setProgress(holdTarget);
                cancelProgressLoopRef.current?.();
                cancelProgressLoopRef.current = null;
                return;
            }

            setRawProgress(nextRaw);
            setProgress(nextRaw);

            if (nextRaw >= 0.999) {
                cancelProgressLoopRef.current?.();
                cancelProgressLoopRef.current = null;
            }
        };

        const timerId = window.setInterval(tick, 16);
        tick();
        cancelProgressLoopRef.current = () => window.clearInterval(timerId);

        return () => {
            window.clearInterval(timerId);
            if (cancelProgressLoopRef.current) {
                cancelProgressLoopRef.current = null;
            }
        };
    }, [durationMs, isAnimating, isFlipping]);

    React.useEffect(() => {
        if (!isFlipping || !isAnimating || rawProgress < COMPLETION_PROGRESS_THRESHOLD) {
            return;
        }
        if (readE2EHoldProgress() !== null) {
            return;
        }
        requestFinishFlip();
    }, [isAnimating, isFlipping, rawProgress, requestFinishFlip]);

    React.useEffect(() => {
        if (!isFlipping || !isAnimating) {
            return undefined;
        }

        if (completionTimerRef.current !== null) {
            window.clearTimeout(completionTimerRef.current);
        }
        if (completionHoldPollRef.current !== null) {
            window.clearTimeout(completionHoldPollRef.current);
            completionHoldPollRef.current = null;
        }

        completionTimerRef.current = window.setTimeout(() => {
            completionTimerRef.current = null;
            requestFinishFlip();
        }, durationMs + COMPLETION_FALLBACK_EXTRA_MS);

        return () => {
            if (completionTimerRef.current !== null) {
                window.clearTimeout(completionTimerRef.current);
                completionTimerRef.current = null;
            }
            if (completionHoldPollRef.current !== null) {
                window.clearTimeout(completionHoldPollRef.current);
                completionHoldPollRef.current = null;
            }
        };
    }, [durationMs, isAnimating, isFlipping, requestFinishFlip]);

    React.useEffect(() => {
        const node = flipbookRef.current;
        if (!node) {
            return undefined;
        }

        sanitizeOverlayDom(node);

        let disposed = false;
        let instance: TurnJsInstance | null = null;
        let cleanupInstance: (() => void) | null = null;
        mainEffectRunCountRef.current += 1;
        if (rootRef.current) {
            rootRef.current.dataset.turnMainEffectRuns = String(mainEffectRunCountRef.current);
            rootRef.current.dataset.turnOverlayGeometryReady = 'false';
            rootRef.current.dataset.turnOverlayReadyFrames = '';
            rootRef.current.dataset.turnOverlayMotionPage = '';
            rootRef.current.dataset.turnOverlayMotionDisplay = '';
            rootRef.current.dataset.turnOverlayFlipbookRect = '';
            rootRef.current.dataset.turnOverlayExpectedRect = '';
            rootRef.current.dataset.turnOverlayMotionRect = '';
        }
        completeOnceRef.current = false;
        const shouldResetAnimationState = !isFlipping || animationStartedAtRef.current === null;
        setTurnReady(false);
        setTurnError(null);
        setIsAnimating(false);
        setTurnOverlayVisible(false);
        if (shouldResetAnimationState) {
            setProgress(isFlipping ? 0 : 1);
            setRawProgress(isFlipping ? 0 : 1);
            animationStartedAtRef.current = null;
        }
        cancelProgressLoopRef.current?.();
        cancelProgressLoopRef.current = null;

        void loadTurnJsRuntime()
            .then(($) => {
                if (disposed) {
                    return;
                }

                instance = $(node);
                const writeTurnSnapshot = () => {
                    if (!rootRef.current || !instance) {
                        return;
                    }
                    try {
                        rootRef.current.dataset.turnPluginPage = String(instance.turn('page') ?? '');
                        rootRef.current.dataset.turnPluginView = JSON.stringify(instance.turn('view') ?? []);
                        rootRef.current.dataset.turnPluginAnimating = String(Boolean(instance.turn('animating')));
                    } catch {
                        rootRef.current.dataset.turnPluginPage = '';
                        rootRef.current.dataset.turnPluginView = '[]';
                        rootRef.current.dataset.turnPluginAnimating = '';
                    }
                };
                const motionPage = turningToDetail ? TURNJS_OVERVIEW_PAGE + 1 : TURNJS_DETAIL_PAGE;
                const writeTurnOverlayGeometrySnapshot = () => {
                    const root = rootRef.current;
                    if (!root) {
                        return false;
                    }

                    const flipbookRect = node.getBoundingClientRect();
                    const motionWrapper = node.querySelector<HTMLElement>(`.page-wrapper[page="${motionPage}"]`);
                    const motionRect = motionWrapper?.getBoundingClientRect() ?? null;
                    const expectedLeft = turningToDetail
                        ? flipbookRect.left + (flipbookRect.width / 2)
                        : flipbookRect.left;
                    const expectedRect = {
                        left: expectedLeft,
                        top: flipbookRect.top,
                        width: flipbookRect.width / 2,
                        height: flipbookRect.height,
                    };
                    const motionDisplay = motionWrapper ? window.getComputedStyle(motionWrapper).display : '';
                    const geometryReady = Boolean(
                        motionWrapper
                        && motionDisplay !== 'none'
                        && flipbookRect.width > 0
                        && flipbookRect.height > 0
                        && motionRect
                        && Math.abs(motionRect.left - expectedRect.left) <= TURN_OVERLAY_RECT_TOLERANCE_PX
                        && Math.abs(motionRect.top - expectedRect.top) <= TURN_OVERLAY_RECT_TOLERANCE_PX
                        && Math.abs(motionRect.width - expectedRect.width) <= TURN_OVERLAY_RECT_TOLERANCE_PX
                        && Math.abs(motionRect.height - expectedRect.height) <= TURN_OVERLAY_RECT_TOLERANCE_PX
                    );

                    root.dataset.turnOverlayGeometryReady = geometryReady ? 'true' : 'false';
                    root.dataset.turnOverlayMotionPage = String(motionPage);
                    root.dataset.turnOverlayMotionDisplay = motionDisplay;
                    root.dataset.turnOverlayFlipbookRect = JSON.stringify(toRoundedRect(flipbookRect));
                    root.dataset.turnOverlayExpectedRect = JSON.stringify({
                        left: Math.round(expectedRect.left * 10) / 10,
                        top: Math.round(expectedRect.top * 10) / 10,
                        width: Math.round(expectedRect.width * 10) / 10,
                        height: Math.round(expectedRect.height * 10) / 10,
                    });
                    root.dataset.turnOverlayMotionRect = motionRect ? JSON.stringify(toRoundedRect(motionRect)) : '';

                    return geometryReady;
                };
                const handleTurnEvent = () => {
                    writeTurnSnapshot();
                    if (!isFlipping || completeOnceRef.current || !isAnimatingRef.current || rawProgressRef.current < 0.84) {
                        return;
                    }
                    window.requestAnimationFrame(() => {
                        if (disposed) {
                            return;
                        }
                        requestFinishFlip();
                    });
                };

                instance.turn({
                    width: unionWidth,
                    height: unionHeight,
                    display: 'double',
                    page: initialEntryPage,
                    duration: durationMs,
                    gradients: true,
                    elevation: 48,
                    acceleration: true,
                    autoCenter: false,
                    turnCorners: 'bl,br',
                    when: {
                        start: writeTurnSnapshot,
                        turning: writeTurnSnapshot,
                        turned: handleTurnEvent,
                        end: handleTurnEvent,
                    },
                });
                writeTurnSnapshot();

                cleanupInstance = () => {
                    try {
                        instance?.turn('peel', false);
                        instance?.off();
                        instance?.turn('stop');
                        instance?.turn('destroy');
                    } catch {
                        // ignore cleanup failures from already-destroyed instances
                    }
                };

                setTurnReady(true);
                window.requestAnimationFrame(async () => {
                    if (disposed || !instance) {
                        return;
                    }

                    if (isFlipping) {
                        if (!activeSourceReady) {
                            return;
                        }
                        window.requestAnimationFrame(() => {
                            if (disposed || !instance) {
                                return;
                            }
                            instance.turn('peel', false);
                            instance.turn(turningToDetail ? 'next' : 'previous');
                            writeTurnSnapshot();
                            const revealOverlayWhenGeometryReady = (frameCount: number) => {
                                if (disposed || !instance) {
                                    return;
                                }

                                try {
                                    instance.turn('resize');
                                    instance.turn('update');
                                } catch {
                                    // turn.js may be between internal setup frames.
                                }

                                const geometryReady = writeTurnOverlayGeometrySnapshot();
                                if (geometryReady || frameCount >= TURN_OVERLAY_READY_MAX_FRAMES) {
                                    if (rootRef.current) {
                                        rootRef.current.dataset.turnOverlayReadyFrames = String(frameCount);
                                    }
                                    animationStartedAtRef.current = performance.now();
                                    setProgress(0);
                                    setRawProgress(0);
                                    setTurnOverlayVisible(true);
                                    setIsAnimating(true);
                                    writeTurnSnapshot();
                                    return;
                                }

                                window.requestAnimationFrame(() => revealOverlayWhenGeometryReady(frameCount + 1));
                            };

                            window.requestAnimationFrame(() => revealOverlayWhenGeometryReady(1));
                        });
                        return;
                    }

                    instance.turn('page', currentEntryPage);
                    instance.turn('peel', idlePeelCorner, false);
                    writeTurnSnapshot();
                });
            })
            .catch((error) => {
                console.error('[HomeV2] turn.js 初始化失败', error);
                setTurnError(error instanceof Error ? error.message : String(error));
            });

        return () => {
            disposed = true;
            cancelProgressLoopRef.current?.();
            cancelProgressLoopRef.current = null;
            cleanupInstance?.();
        };
    }, [
        currentEntryPage,
        durationMs,
        finishFlip,
        idlePeelCorner,
        initialEntryPage,
        isFlipping,
        activeSourceReady,
        flippingToDetail,
        targetEntryPage,
        turningToDetail,
        unionHeight,
        unionWidth,
        requestFinishFlip,
    ]);

    return (
        <div
            ref={rootRef}
            className="relative h-full w-full"
            data-testid={testId ?? 'home-v2-fold-line-flip'}
            data-flip-mode={mode}
            data-flip-progress={progress.toFixed(3)}
            data-flip-progress-raw={rawProgress.toFixed(3)}
            data-turn-ready={turnReady ? 'true' : 'false'}
            data-turn-animating={isAnimating ? 'true' : 'false'}
            data-turn-error={turnError ?? ''}
            data-turn-source-snapshot-ready={activeSourceReady ? 'true' : 'false'}
            data-turn-source-hold-visible={shouldHoldSourceStage ? 'true' : 'false'}
            data-turn-overlay-visible={turnOverlayVisible ? 'true' : 'false'}
        >
            <StageCanvas>
                <StageFrame stageSize={activeStageSize}>
                    <div ref={visibleStageCaptureRef} className="relative h-full w-full">
                        {baseStage}
                    </div>
                </StageFrame>
            </StageCanvas>

        </div>
    );
}

export default FoldLinePageFlipStage;
