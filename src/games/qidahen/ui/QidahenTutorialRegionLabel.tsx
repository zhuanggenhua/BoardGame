import React from 'react';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../../core';
import type { QidahenMapViewport } from './mapRegionFocus';
import { getQidahenRuntimeRegionAnchorTargetPoint } from './mapGraph';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from './mapRegions';

interface Props {
    anchorRef: React.RefObject<HTMLElement | null>;
    viewport: QidahenMapViewport;
    regionId: string;
    name: string;
}

/** 教程注释跟随真实地区的屏幕位置，阅读尺寸独立于地图与正式HUD的等比缩放。 */
export const QidahenTutorialRegionLabel: React.FC<Props> = ({ anchorRef, viewport, regionId, name }) => {
    const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null);
    React.useLayoutEffect(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        let resizeFrame = 0;
        const place = () => {
            const marker = document.querySelector<HTMLElement>(`[data-qidahen-map-token-region="${regionId}"][data-qidahen-map-token-type="control"]`);
            const rect = marker?.getBoundingClientRect();
            const map = anchor.closest('[data-testid="qidahen-map-content"]')?.getBoundingClientRect();
            const point = getQidahenRuntimeRegionAnchorTargetPoint(regionId);
            // 地区名属于真实地图标记，不能放在仅供镜头取景的外接矩形角落。
            const next = rect && rect.width > 0 && rect.height > 0
                ? { left: rect.left, top: rect.top - 6 }
                : map && point ? {
                    left: map.left + point.x / QIDAHEN_MAP_WIDTH * map.width,
                    top: map.top + point.y / QIDAHEN_MAP_HEIGHT * map.height - 6,
                } : null;
            if (!next) { setPosition(null); return; }
            setPosition(current => current?.left === next.left && current.top === next.top ? current : next);
        };
        const schedule = () => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(place);
        };
        place();
        const observer = new ResizeObserver(schedule);
        for (let element: HTMLElement | null = anchor; element; element = element.parentElement) {
            observer.observe(element);
        }
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, { passive: true, capture: true });
        return () => {
            observer.disconnect();
            cancelAnimationFrame(resizeFrame);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
        };
    }, [anchorRef, viewport.zoom, viewport.panX, viewport.panY, regionId, name]);

    return position ? createPortal(
        <span
            data-testid="qidahen-map-region-focus-name"
            data-region-id={regionId}
            className="pointer-events-none fixed whitespace-nowrap font-bold"
            style={{
                ...position, transform: 'translateY(-100%)', zIndex: UI_Z_INDEX.tutorial - 1,
                fontSize: 14, lineHeight: '20px', paddingInline: 4,
                color: '#fff2d0', background: 'rgba(35,25,16,0.94)',
            }}
        >
            {name}
        </span>,
        document.body,
    ) : null;
};
