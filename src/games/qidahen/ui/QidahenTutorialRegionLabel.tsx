import React from 'react';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../../core';
import type { QidahenMapViewport } from './mapRegionFocus';

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
            const rect = anchor.getBoundingClientRect();
            const next = { left: rect.left, top: rect.top - 4 };
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
