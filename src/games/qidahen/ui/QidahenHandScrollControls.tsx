import { useLayoutEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

/** 只读取真实手牌滚动容器，保留半露牌面和独立选中状态。 */
export function QidahenHandScrollControls({ dockRef, width, maxWidth, visibleHeight }: {
    dockRef: RefObject<HTMLDivElement | null>; width: number; maxWidth: string; visibleHeight: number;
}) {
    const { t } = useTranslation('game-qidahen');
    const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
    useLayoutEffect(() => {
        const dock = dockRef.current;
        if (!dock) return;
        const update = () => {
            const maximum = Math.max(0, dock.scrollWidth - dock.clientWidth);
            const next = { overflow: maximum > 1, left: dock.scrollLeft > 1, right: dock.scrollLeft < maximum - 1 };
            setEdges(previous => previous.overflow === next.overflow && previous.left === next.left && previous.right === next.right ? previous : next);
        };
        update();
        dock.addEventListener('scroll', update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(dock);
        if (dock.firstElementChild) observer.observe(dock.firstElementChild);
        return () => { dock.removeEventListener('scroll', update); observer.disconnect(); };
    }, [dockRef]);
    if (!edges.overflow) return null;
    return <div className="pointer-events-none absolute left-1/2 z-[90]" style={{ bottom: 0, width, maxWidth, height: visibleHeight, transform: 'translateX(-50%)' }}>
        {(['left', 'right'] as const).map(direction => <button key={direction} type="button"
            data-testid={'qidahen-hand-scroll-' + direction}
            aria-label={t(direction === 'left' ? 'board.handScroll.previous' : 'board.handScroll.next')}
            disabled={!edges[direction]}
            onClick={() => dockRef.current?.scrollBy({ left: (direction === 'left' ? -1 : 1) * dockRef.current.clientWidth * 0.8, behavior: 'smooth' })}
            className="pointer-events-auto absolute top-1/2 grid h-[88px] w-[88px] -translate-y-1/2 place-items-center disabled:cursor-default disabled:opacity-35"
            style={direction === 'left' ? { left: -88 } : { right: -88 }}>
            <span data-qidahen-hand-scroll-face className="grid h-7 w-7 place-items-center rounded-full border border-[#b79a70] bg-[#f5ead4] text-[26px] leading-none text-[#5d3222] shadow-sm">{direction === 'left' ? '‹' : '›'}</span>
        </button>)}
    </div>;
}
