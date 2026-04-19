import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';

interface OverflowElementSnapshot {
    tag: string;
    id: string;
    className: string;
    position: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

interface HorizontalScrollContainerSnapshot {
    tag: string;
    id: string;
    className: string;
    overflowX: string;
    clientWidth: number;
    scrollWidth: number;
    left: number;
    right: number;
    bottom: number;
}

interface ViewportDebugSnapshot {
    innerWidth: number;
    innerHeight: number;
    clientWidth: number;
    clientHeight: number;
    visualViewportWidth: number;
    visualViewportHeight: number;
    scrollWidth: number;
    scrollHeight: number;
    bodyScrollWidth: number;
    bodyScrollHeight: number;
    overflowElements: OverflowElementSnapshot[];
    horizontalScrollContainers: HorizontalScrollContainerSnapshot[];
}

const MAX_OVERFLOW_ITEMS = 5;
const MAX_SCROLL_CONTAINER_ITEMS = 5;
const UPDATE_INTERVAL_MS = 700;

const readOverflowElements = (): OverflowElementSnapshot[] => {
    if (typeof window === 'undefined') {
        return [];
    }

    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    return Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';

            if (!isVisible) {
                return null;
            }

            const overflowsViewport = rect.left < -1
                || rect.right > viewportWidth + 1
                || rect.top < -1
                || rect.bottom > viewportHeight + 1;

            if (!overflowsViewport) {
                return null;
            }

            return {
                tag: element.tagName.toLowerCase(),
                id: element.id,
                className: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
                position: style.position,
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        })
        .filter((item): item is OverflowElementSnapshot => item !== null)
        .slice(0, MAX_OVERFLOW_ITEMS);
};

const readHorizontalScrollContainers = (): HorizontalScrollContainerSnapshot[] => {
    if (typeof window === 'undefined') {
        return [];
    }

    return Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const isVisible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';

            if (!isVisible) {
                return null;
            }

            const hasHorizontalScroll = element.scrollWidth - element.clientWidth > 4;
            const allowsHorizontalScroll = style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay';

            if (!hasHorizontalScroll || !allowsHorizontalScroll) {
                return null;
            }

            return {
                tag: element.tagName.toLowerCase(),
                id: element.id,
                className: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
                overflowX: style.overflowX,
                clientWidth: Math.round(element.clientWidth),
                scrollWidth: Math.round(element.scrollWidth),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
            };
        })
        .filter((item): item is HorizontalScrollContainerSnapshot => item !== null)
        .slice(0, MAX_SCROLL_CONTAINER_ITEMS);
};

const readSnapshot = (): ViewportDebugSnapshot => {
    if (typeof window === 'undefined') {
        return {
            innerWidth: 0,
            innerHeight: 0,
            clientWidth: 0,
            clientHeight: 0,
            visualViewportWidth: 0,
            visualViewportHeight: 0,
            scrollWidth: 0,
            scrollHeight: 0,
            bodyScrollWidth: 0,
            bodyScrollHeight: 0,
            overflowElements: [],
            horizontalScrollContainers: [],
        };
    }

    return {
        innerWidth: Math.round(window.innerWidth),
        innerHeight: Math.round(window.innerHeight),
        clientWidth: Math.round(document.documentElement.clientWidth),
        clientHeight: Math.round(document.documentElement.clientHeight),
        visualViewportWidth: Math.round(window.visualViewport?.width ?? window.innerWidth),
        visualViewportHeight: Math.round(window.visualViewport?.height ?? window.innerHeight),
        scrollWidth: Math.round(document.documentElement.scrollWidth),
        scrollHeight: Math.round(document.documentElement.scrollHeight),
        bodyScrollWidth: Math.round(document.body.scrollWidth),
        bodyScrollHeight: Math.round(document.body.scrollHeight),
        overflowElements: readOverflowElements(),
        horizontalScrollContainers: readHorizontalScrollContainers(),
    };
};

export function ViewportDebugProbe() {
    const location = useLocation();
    const viewport = useRuntimeViewport({ syncCssVars: false });
    const enabled = new URLSearchParams(location.search).get('bgViewportDebug') === '1';
    const [snapshot, setSnapshot] = useState<ViewportDebugSnapshot>(() => readSnapshot());

    const refresh = useCallback(() => {
        setSnapshot(readSnapshot());
    }, []);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return undefined;
        }

        const visualViewport = window.visualViewport;
        const initialRefreshId = window.setTimeout(refresh, 0);
        const intervalId = window.setInterval(refresh, UPDATE_INTERVAL_MS);
        window.addEventListener('resize', refresh);
        window.addEventListener('orientationchange', refresh);
        visualViewport?.addEventListener('resize', refresh);

        return () => {
            window.clearTimeout(initialRefreshId);
            window.clearInterval(intervalId);
            window.removeEventListener('resize', refresh);
            window.removeEventListener('orientationchange', refresh);
            visualViewport?.removeEventListener('resize', refresh);
        };
    }, [enabled, refresh]);

    useEffect(() => {
        if (!enabled) return;
        const refreshId = window.setTimeout(refresh, 0);
        return () => {
            window.clearTimeout(refreshId);
        };
    }, [enabled, refresh, viewport.width, viewport.height, viewport.safeArea.top, viewport.safeArea.right, viewport.safeArea.bottom, viewport.safeArea.left]);

    if (!enabled) {
        return null;
    }

    return (
        <div
            data-testid="viewport-debug-probe"
            className="fixed left-[max(0.5rem,env(safe-area-inset-left))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-[10001] max-w-[min(22rem,calc(100vw-1rem))] rounded-lg border border-amber-400/40 bg-black/88 px-3 py-2 text-[11px] leading-4 text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm"
        >
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-semibold tracking-[0.08em] text-amber-300">真机视口诊断</div>
                <button
                    type="button"
                    onClick={refresh}
                    className="rounded border border-amber-400/30 px-2 py-0.5 text-[10px] text-amber-200"
                >
                    刷新
                </button>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                <span className="text-amber-300/70">inner</span>
                <span>{snapshot.innerWidth} x {snapshot.innerHeight}</span>
                <span className="text-amber-300/70">visual</span>
                <span>{snapshot.visualViewportWidth} x {snapshot.visualViewportHeight}</span>
                <span className="text-amber-300/70">client</span>
                <span>{snapshot.clientWidth} x {snapshot.clientHeight}</span>
                <span className="text-amber-300/70">runtime</span>
                <span>{Math.round(viewport.width)} x {Math.round(viewport.height)}</span>
                <span className="text-amber-300/70">safeArea</span>
                <span>{viewport.safeArea.top}/{viewport.safeArea.right}/{viewport.safeArea.bottom}/{viewport.safeArea.left}</span>
                <span className="text-amber-300/70">doc scroll</span>
                <span>{snapshot.scrollWidth} x {snapshot.scrollHeight}</span>
                <span className="text-amber-300/70">body scroll</span>
                <span>{snapshot.bodyScrollWidth} x {snapshot.bodyScrollHeight}</span>
                <span className="text-amber-300/70">越界元素</span>
                <span>{snapshot.overflowElements.length}</span>
                <span className="text-amber-300/70">横向容器</span>
                <span>{snapshot.horizontalScrollContainers.length}</span>
            </div>

            {snapshot.overflowElements.length > 0 ? (
                <div className="mt-2 border-t border-amber-400/20 pt-2">
                    {snapshot.overflowElements.map((item, index) => (
                        <div key={`${item.tag}-${item.id}-${index}`} className="mb-1 rounded bg-white/5 px-2 py-1">
                            <div className="truncate text-amber-200">
                                {item.tag}
                                {item.id ? `#${item.id}` : ''}
                                {item.className ? `.${item.className}` : ''}
                            </div>
                            <div className="text-[10px] text-amber-100/75">
                                {item.position} | L{item.left} R{item.right} T{item.top} B{item.bottom} | {item.width}x{item.height}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {snapshot.horizontalScrollContainers.length > 0 ? (
                <div className="mt-2 border-t border-amber-400/20 pt-2">
                    {snapshot.horizontalScrollContainers.map((item, index) => (
                        <div key={`${item.tag}-${item.id}-scroll-${index}`} className="mb-1 rounded bg-white/5 px-2 py-1">
                            <div className="truncate text-amber-200">
                                {item.tag}
                                {item.id ? `#${item.id}` : ''}
                                {item.className ? `.${item.className}` : ''}
                            </div>
                            <div className="text-[10px] text-amber-100/75">
                                overflow-x:{item.overflowX} | {item.clientWidth}/{item.scrollWidth} | L{item.left} R{item.right} B{item.bottom}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default ViewportDebugProbe;
