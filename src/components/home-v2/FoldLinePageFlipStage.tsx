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

const DEFAULT_DURATION_MS = 760;
const TURNJS_OVERVIEW_PAGE = 2;
const TURNJS_DETAIL_PAGE = 4;
const JQUERY_SCRIPT_PATH = '/vendor/jquery/jquery-1.12.0.min.js';
const TURNJS_SCRIPT_PATH = '/vendor/turnjs/turn.min.js';

type RenderStage = (options?: { includeTestId?: boolean }) => React.ReactNode;

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

function SteadyFoldDecoration({
    rect,
    corner,
}: {
    rect: PageRect;
    corner: PeelCorner;
}) {
    const clipPath = corner === 'br'
        ? 'polygon(100% 0, 0 100%, 100% 100%)'
        : 'polygon(0 0, 0 100%, 100% 100%)';
    const containerStyle = createRectStyleFromParsedRect(parseRect(rect));

    return (
        <div
            className="pointer-events-none absolute"
            style={containerStyle}
            aria-hidden="true"
        >
            <div
                className="absolute bottom-[1.4%] h-[11.5%] w-[12.5%]"
                style={corner === 'br' ? { right: '1.2%' } : { left: '1.2%' }}
            >
                <div
                    className="absolute inset-0 opacity-80"
                    style={{
                        clipPath,
                        background: corner === 'br'
                            ? 'linear-gradient(135deg, rgba(255,252,240,0.98) 0%, rgba(230,208,174,0.96) 56%, rgba(138,103,67,0.95) 100%)'
                            : 'linear-gradient(225deg, rgba(255,252,240,0.98) 0%, rgba(230,208,174,0.96) 56%, rgba(138,103,67,0.95) 100%)',
                        boxShadow: corner === 'br'
                            ? '-8px -8px 18px rgba(80,56,34,0.18)'
                            : '8px -8px 18px rgba(80,56,34,0.18)',
                    }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        clipPath,
                        background: corner === 'br'
                            ? 'linear-gradient(180deg, rgba(120,90,55,0) 0%, rgba(120,90,55,0.14) 100%)'
                            : 'linear-gradient(180deg, rgba(120,90,55,0) 0%, rgba(120,90,55,0.14) 100%)',
                    }}
                />
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
    const mainEffectRunCountRef = React.useRef(0);
    const progressLoopStartCountRef = React.useRef(0);
    const progressTickCountRef = React.useRef(0);
    const [turnReady, setTurnReady] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [rawProgress, setRawProgress] = React.useState(0);
    const [turnError, setTurnError] = React.useState<string | null>(null);
    const [overviewStageReady, setOverviewStageReady] = React.useState(false);

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
        setProgress(1);
        setRawProgress(1);
        if (turningToDetail) {
            onFlipToDetailComplete?.();
        } else {
            onFlipToOverviewComplete?.();
        }
    }, [onFlipToDetailComplete, onFlipToOverviewComplete, turningToDetail]);

    const overviewStageForTurn = (renderOverviewFlipStage ?? renderOverviewStage)({ includeTestId: false });
    const detailStageForTurn = (renderDetailFlipStage ?? renderDetailStage)({ includeTestId: false });
    const flippingShellStage = turningToDetail ? detailStageForTurn : overviewStageForTurn;
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
                        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                            {flippingShellStage}
                        </div>
                        <div
                            className="absolute overflow-visible"
                            style={createRectStyleFromParsedRect(unionRect)}
                            aria-hidden="true"
                        >
                            <div
                                ref={flipbookRef}
                                key={`turnjs-visible-${mode}-${Math.round(unionWidth)}x${Math.round(unionHeight)}`}
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
    const activeSourceReady = !flippingToDetail || overviewStageReady;

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

        const tryFinishWhenReleased = () => {
            if (readE2EHoldProgress() !== null) {
                completionHoldPollRef.current = window.setTimeout(tryFinishWhenReleased, 16);
                return;
            }
            completionHoldPollRef.current = null;
            finishFlip();
        };

        completionTimerRef.current = window.setTimeout(() => {
            completionTimerRef.current = null;
            tryFinishWhenReleased();
        }, durationMs + 220);

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
    }, [durationMs, finishFlip, isAnimating, isFlipping]);

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
        }
        completeOnceRef.current = false;
        const shouldResetAnimationState = !isFlipping || animationStartedAtRef.current === null;
        setTurnReady(false);
        setTurnError(null);
        setIsAnimating(false);
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
                        turned: writeTurnSnapshot,
                        end: writeTurnSnapshot,
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
                            animationStartedAtRef.current = performance.now();
                            setIsAnimating(true);
                            setProgress(0);
                            setRawProgress(0);
                            instance.turn('peel', false);
                            instance.turn(turningToDetail ? 'next' : 'previous');
                            writeTurnSnapshot();
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
        >
            <StageCanvas>
                <StageFrame stageSize={activeStageSize}>
                    <div ref={visibleStageCaptureRef} className="relative h-full w-full">
                        {baseStage}
                    </div>
                </StageFrame>
            </StageCanvas>

            {!isFlipping ? (
                <StageCanvas>
                    <StageFrame stageSize={activeStageSize}>
                        <SteadyFoldDecoration
                            rect={mode === 'detail' ? leftPageRect : rightPageRect}
                            corner={idlePeelCorner}
                        />
                    </StageFrame>
                </StageCanvas>
            ) : null}

        </div>
    );
}

export default FoldLinePageFlipStage;
