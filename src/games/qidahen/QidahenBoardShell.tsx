import React from 'react';

export interface QidahenBoardLayoutConfig {
    width: number;
    height: number;
    mobileMaxViewportWidth: number;
    bottomDockInset: number;
    mobileLandscapeTopSafeInset: number;
    mobileLandscapeBottomDockInset: number;
    mobileLandscapeChronologyTop: number;
}

interface QidahenBoardShellProps {
    layout: QidahenBoardLayoutConfig;
    scene: React.ReactNode;
    hud: React.ReactNode;
    backgroundColor: string;
}

interface StagePlacement {
    scale: number;
    left: number;
    top: number;
}

interface QidahenBoardMetrics {
    scene: StagePlacement;
    hud: StagePlacement;
    viewportWidth: number;
    viewportHeight: number;
    mobileEdgePull: number;
    mobileTopInset: number;
    mobileBottomInset: number;
    mobileChronologyTop: number;
    isMobileLandscape: boolean;
}

const buildMetrics = (
    width: number,
    height: number,
    layout: QidahenBoardLayoutConfig,
): QidahenBoardMetrics => {
    const isMobileLandscape = width <= layout.mobileMaxViewportWidth && width > height;
    const sceneScale = Math.max(width / layout.width, height / layout.height);
    const hudScale = isMobileLandscape ? 1 : Math.min(width / layout.width, height / layout.height);
    const hudLeft = isMobileLandscape ? 0 : Math.max(0, (width - layout.width * hudScale) / 2);
    const hudTop = isMobileLandscape ? 0 : Math.max(0, (height - layout.height * hudScale) / 2);

    return {
        scene: {
            scale: sceneScale,
            left: (width - layout.width * sceneScale) / 2,
            top: (height - layout.height * sceneScale) / 2,
        },
        hud: {
            scale: hudScale,
            left: hudLeft,
            top: hudTop,
        },
        viewportWidth: width,
        viewportHeight: height,
        mobileEdgePull: 0,
        mobileTopInset: isMobileLandscape ? layout.mobileLandscapeTopSafeInset : 0,
        mobileBottomInset: isMobileLandscape ? layout.mobileLandscapeBottomDockInset : layout.bottomDockInset,
        mobileChronologyTop: isMobileLandscape
            ? layout.mobileLandscapeChronologyTop
            : 542,
        isMobileLandscape,
    };
};

export const QidahenBoardShell: React.FC<QidahenBoardShellProps> = ({
    layout,
    scene,
    hud,
    backgroundColor,
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [metrics, setMetrics] = React.useState<QidahenBoardMetrics>(() => (
        buildMetrics(layout.width, layout.height, layout)
    ));

    React.useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const update = () => {
            const rect = element.getBoundingClientRect();
            const width = Math.max(1, Math.min(rect.width, window.innerWidth));
            const height = Math.max(1, Math.min(rect.height, window.innerHeight));
            setMetrics(buildMetrics(width, height, layout));
        };

        update();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(element);
        window.addEventListener('resize', update);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [layout]);

    const hudStyle = {
        width: metrics.isMobileLandscape ? metrics.viewportWidth : layout.width,
        height: metrics.isMobileLandscape ? metrics.viewportHeight : layout.height,
        left: metrics.hud.left,
        top: metrics.hud.top,
        color: 'inherit',
        transform: `scale(${metrics.hud.scale})`,
        transformOrigin: 'top left',
        overflow: 'hidden',
        '--qidahen-mobile-edge-pull': `${metrics.mobileEdgePull}px`,
        '--qidahen-mobile-top-inset': `${metrics.mobileTopInset}px`,
        '--qidahen-mobile-bottom-inset': `${metrics.mobileBottomInset}px`,
        '--qidahen-mobile-chronology-top': `${metrics.mobileChronologyTop}px`,
    } as React.CSSProperties & {
        '--qidahen-mobile-edge-pull': string;
        '--qidahen-mobile-top-inset': string;
        '--qidahen-mobile-bottom-inset': string;
        '--qidahen-mobile-chronology-top': string;
    };

    return (
        <div
            ref={containerRef}
            className="relative h-full min-h-0 w-full overflow-hidden"
            data-testid="qidahen-board"
            data-qidahen-layout-mode={metrics.isMobileLandscape ? 'mobile-landscape' : 'desktop'}
            style={{
                backgroundColor,
                '--qidahen-scene-inverse-scale': String(1 / metrics.scene.scale),
            } as React.CSSProperties}
        >
            <div
                className="absolute inset-0 overflow-hidden"
                data-testid="qidahen-scene-layer"
            >
                <div
                    className="absolute overflow-visible"
                    data-testid="qidahen-scene-stage"
                    style={{
                        width: layout.width,
                        height: layout.height,
                        left: metrics.scene.left,
                        top: metrics.scene.top,
                        transform: `scale(${metrics.scene.scale})`,
                        transformOrigin: 'top left',
                    }}
                >
                    {scene}
                </div>
            </div>
            <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                data-testid="qidahen-hud-layer"
            >
                <div
                    className="pointer-events-none absolute"
                    data-testid="qidahen-desktop-stage"
                    data-layer-role="hud-stage"
                    data-qidahen-layout-mode={metrics.isMobileLandscape ? 'mobile-landscape' : 'desktop'}
                    style={hudStyle}
                >
                    {hud}
                </div>
            </div>
        </div>
    );
};
