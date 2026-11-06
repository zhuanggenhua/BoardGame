import React from 'react';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../../core';
import type { QidahenMapViewport } from './mapRegionFocus';
import { getQidahenRuntimeRegionAnchorTargetPoint, QIDAHEN_MAP_NAMEPLATE_BOUNDS } from './mapGraph';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from './mapRegions';

interface Props {
    anchorRef: React.RefObject<HTMLElement | null>;
    viewport: QidahenMapViewport;
    regionId: string;
    name: string;
    objects: readonly { x: number; y: number }[];
}

/** 教程注释跟随真实地区的屏幕位置，阅读尺寸独立于地图与正式HUD的等比缩放。 */
export const QidahenTutorialRegionLabel: React.FC<Props> = ({ anchorRef, viewport, regionId, name, objects }) => {
    const labelRef = React.useRef<HTMLSpanElement>(null);
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
            const preferred = rect && rect.width > 0 && rect.height > 0
                ? { left: rect.left, top: rect.top - 6 }
                : map && point ? {
                    left: map.left + point.x / QIDAHEN_MAP_WIDTH * map.width,
                    top: map.top + point.y / QIDAHEN_MAP_HEIGHT * map.height - 6,
                } : null;
            if (!preferred) { setPosition(null); return; }
            const width = labelRef.current?.offsetWidth ?? name.length * 14 + 8;
            const height = labelRef.current?.offsetHeight ?? 20;
            const mapObjects = [...document.querySelectorAll('[data-qidahen-map-token-type="army"], [data-qidahen-map-token-type="control"]')];
            const regionObjects = mapObjects.filter(element => element.getAttribute('data-qidahen-map-token-region') === regionId)
                .map(element => element.getBoundingClientRect());
            const obstacles = [...mapObjects.map(element => element.getBoundingClientRect()),
                ...QIDAHEN_MAP_NAMEPLATE_BOUNDS.flatMap(bounds => map ? [{
                    left: map.left + bounds.left / QIDAHEN_MAP_WIDTH * map.width,
                    right: map.left + (bounds.left + bounds.width) / QIDAHEN_MAP_WIDTH * map.width,
                    top: map.top + bounds.top / QIDAHEN_MAP_HEIGHT * map.height,
                    bottom: map.top + (bounds.top + bounds.height) / QIDAHEN_MAP_HEIGHT * map.height,
                }] : []),
            ];
            // 名称与兵牌同属地图阅读层，跟随当前实际兵牌寻找最近空位。
            const candidates = [preferred, ...regionObjects.flatMap(box => [
                { left: box.left, top: box.top - 6 }, { left: box.left, top: box.bottom + height + 6 },
                { left: box.left - width - 6, top: box.top + height }, { left: box.right + 6, top: box.top + height },
            ])].filter(point => point.left >= 4 && point.top - height >= 4
                && point.left + width <= innerWidth - 4 && point.top <= innerHeight - 4
                && obstacles.every(box => point.left + width + 4 <= box.left || point.left - 4 >= box.right
                    || point.top + 4 <= box.top || point.top - height - 4 >= box.bottom));
            candidates.sort((a, b) => Math.hypot(a.left - preferred.left, a.top - preferred.top)
                - Math.hypot(b.left - preferred.left, b.top - preferred.top));
            const next = candidates[0] ?? null;
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
    }, [anchorRef, viewport.zoom, viewport.panX, viewport.panY, regionId, name, objects]);

    return position ? createPortal(
        <span
            ref={labelRef}
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
