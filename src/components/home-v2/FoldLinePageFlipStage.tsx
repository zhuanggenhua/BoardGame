import React from 'react';
import {
    createFrameSequence,
    FrameSequencePlayer,
} from '../common/animations';

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

type RenderStage = (options?: { includeTestId?: boolean }) => React.ReactNode;

const HOME_V2_PAGE_FLIP_FPS = 18;
const HOME_V2_PAGE_FLIP_FRAME_COUNT = 8;
const HOME_V2_PAGE_FLIP_DURATION_MS =
    (HOME_V2_PAGE_FLIP_FRAME_COUNT / HOME_V2_PAGE_FLIP_FPS) * 1000;
const HOME_V2_PAGE_FLIP_ROOT = 'common/images/home-v2';
const HOME_V2_PAGE_FLIP_ARTBOARD = { width: 896, height: 720 };
// 8 帧透明画板的共同可见包络。定位可见内容，而不是对整张透明画板
// 写死任意缩放值，才能在不同书本舞台尺寸上保持与 V2 首页同一套语义。
const HOME_V2_PAGE_FLIP_CONTENT_BOUNDS = {
    left: 118,
    top: 140,
    right: 779,
    bottom: 597,
};

function parsePercent(value: string): number {
    return Number.parseFloat(value.replace('%', '')) / 100;
}

function getUnionRect(leftPageRect: PageRect, rightPageRect: PageRect) {
    const left = {
        left: parsePercent(leftPageRect.left),
        top: parsePercent(leftPageRect.top),
        width: parsePercent(leftPageRect.width),
        height: parsePercent(leftPageRect.height),
    };
    const right = {
        left: parsePercent(rightPageRect.left),
        top: parsePercent(rightPageRect.top),
        width: parsePercent(rightPageRect.width),
        height: parsePercent(rightPageRect.height),
    };

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

function StageCanvas({ children }: { children: React.ReactNode }) {
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

export interface FoldLinePageFlipStageProps {
    mode: FlipMode;
    renderOverviewStage: RenderStage;
    renderDetailStage: RenderStage;
    /** 保留旧调用方接口；翻页动画本体统一使用 V2 首页真实帧序列。 */
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
    overviewStageSize,
    detailStageSize,
    leftPageRect,
    rightPageRect,
    durationMs = HOME_V2_PAGE_FLIP_DURATION_MS,
    testId,
    onFlipToDetailComplete,
    onFlipToOverviewComplete,
}: FoldLinePageFlipStageProps) {
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const completeOnceRef = React.useRef(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [sequenceFrame, setSequenceFrame] = React.useState(0);

    const isFlipping = mode === 'flippingToDetail' || mode === 'flippingToOverview';
    const turningToDetail = mode === 'flippingToDetail';
    const activeStageSize = mode === 'detail' || mode === 'flippingToDetail'
        ? detailStageSize
        : overviewStageSize;
    const flipTargetRect = getUnionRect(leftPageRect, rightPageRect);
    const flipContentWidth =
        HOME_V2_PAGE_FLIP_CONTENT_BOUNDS.right - HOME_V2_PAGE_FLIP_CONTENT_BOUNDS.left;
    const flipContentHeight =
        HOME_V2_PAGE_FLIP_CONTENT_BOUNDS.bottom - HOME_V2_PAGE_FLIP_CONTENT_BOUNDS.top;
    const flipImageWidth =
        activeStageSize.width * flipTargetRect.width * HOME_V2_PAGE_FLIP_ARTBOARD.width / flipContentWidth;
    const flipImageHeight =
        activeStageSize.height * flipTargetRect.height * HOME_V2_PAGE_FLIP_ARTBOARD.height / flipContentHeight;
    const flipImageStyle: React.CSSProperties = {
        width: flipImageWidth,
        height: flipImageHeight,
        left: activeStageSize.width * flipTargetRect.left
            - flipImageWidth * HOME_V2_PAGE_FLIP_CONTENT_BOUNDS.left / HOME_V2_PAGE_FLIP_ARTBOARD.width,
        top: activeStageSize.height * flipTargetRect.top
            - flipImageHeight * HOME_V2_PAGE_FLIP_CONTENT_BOUNDS.top / HOME_V2_PAGE_FLIP_ARTBOARD.height,
        objectFit: 'fill',
    };
    const animationDurationMs = Math.max(
        durationMs,
        HOME_V2_PAGE_FLIP_DURATION_MS,
    );
    const sequenceDirection = turningToDetail ? 'left' : 'right';
    const sequence = React.useMemo(
        () => createFrameSequence(
            `${HOME_V2_PAGE_FLIP_ROOT}/page-flip-${sequenceDirection}/compressed`,
            HOME_V2_PAGE_FLIP_FRAME_COUNT,
            {
                fps: HOME_V2_PAGE_FLIP_FPS,
                extension: 'webp',
                holdLastFrame: true,
                reducedMotionBehavior: 'last-frame',
                assetSource: 'local',
            },
        ),
        [sequenceDirection],
    );

    const finishFlip = React.useCallback(() => {
        if (completeOnceRef.current) {
            return;
        }
        completeOnceRef.current = true;
        setProgress(1);
        setSequenceFrame(HOME_V2_PAGE_FLIP_FRAME_COUNT - 1);
        setIsAnimating(false);
        if (turningToDetail) {
            onFlipToDetailComplete?.();
        } else {
            onFlipToOverviewComplete?.();
        }
    }, [onFlipToDetailComplete, onFlipToOverviewComplete, turningToDetail]);

    React.useEffect(() => {
        completeOnceRef.current = false;
        if (!isFlipping) {
            setProgress(1);
            setSequenceFrame(0);
            setIsAnimating(false);
            return undefined;
        }

        setProgress(0);
        setSequenceFrame(0);
        setIsAnimating(true);
        return () => {
            // FrameSequencePlayer owns the animation clock. This effect only
            // marks the new playback as active; it must not maintain a second
            // synthetic frame counter that can drift from the actual image.
        };
    }, [animationDurationMs, isFlipping]);

    const handleFrameChange = React.useCallback((frameIndex: number) => {
        const clampedFrame = Math.min(
            HOME_V2_PAGE_FLIP_FRAME_COUNT - 1,
            Math.max(0, frameIndex),
        );
        setSequenceFrame(clampedFrame);
        setProgress(
            HOME_V2_PAGE_FLIP_FRAME_COUNT <= 1
                ? 1
                : clampedFrame / (HOME_V2_PAGE_FLIP_FRAME_COUNT - 1),
        );
    }, []);

    const baseStage = mode === 'overview'
        ? renderOverviewStage({ includeTestId: true })
        : mode === 'detail'
            ? renderDetailStage({ includeTestId: true })
            : (
                <div
                    className="relative h-full w-full"
                    data-testid="home-v2-real-page-flip-stage"
                    data-flip-sequence-direction={sequenceDirection}
                    data-flip-sequence-frame={sequenceFrame}
                >
                    <div className="absolute inset-0">
                        {turningToDetail
                            ? renderDetailStage({ includeTestId: true })
                            : renderOverviewStage({ includeTestId: true })}
                    </div>
                    <FrameSequencePlayer
                        data-testid="home-v2-real-page-flip-sequence"
                        sequence={sequence}
                        playbackKey={`${mode}:${sequenceDirection}`}
                        playing={isAnimating}
                        onComplete={finishFlip}
                        onFrameChange={handleFrameChange}
                        alt=""
                        aria-hidden="true"
                        className="absolute z-20"
                        style={flipImageStyle}
                    />
                </div>
            );

    React.useEffect(() => {
        if (!rootRef.current) {
            return;
        }
        rootRef.current.dataset.flipAnimationDuration = String(Math.round(animationDurationMs));
        rootRef.current.dataset.flipSequence = `${sequenceDirection}:${HOME_V2_PAGE_FLIP_FRAME_COUNT}frames@${HOME_V2_PAGE_FLIP_FPS}fps`;
    }, [animationDurationMs, sequenceDirection]);

    return (
        <div
            ref={rootRef}
            className="relative h-full w-full"
            data-testid={testId ?? 'home-v2-fold-line-flip'}
            data-flip-mode={mode}
            data-flip-progress={progress.toFixed(3)}
            data-flip-sequence-frame={sequenceFrame}
            data-flip-sequence-direction={sequenceDirection}
            data-flip-animating={isAnimating ? 'true' : 'false'}
            data-flip-ready="true"
            data-flip-error=""
        >
            <StageCanvas>
                <StageFrame stageSize={activeStageSize}>
                    <div className="relative h-full w-full">
                        {baseStage}
                    </div>
                </StageFrame>
            </StageCanvas>
        </div>
    );
}

export default FoldLinePageFlipStage;
