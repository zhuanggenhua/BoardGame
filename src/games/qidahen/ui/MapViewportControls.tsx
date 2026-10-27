import React from 'react';
import { useTranslation } from 'react-i18next';
import { UI_STYLE, UI_SURFACE } from './qidahenTheme';

export const MapViewportControls: React.FC<{
    onZoom: (factor: number) => void;
    onReset: () => void;
}> = ({ onZoom, onReset }) => {
    const { t } = useTranslation('game-qidahen');
    return (
        <div
            className="pointer-events-auto absolute bottom-[244px] left-[26px] z-30 flex flex-col gap-2"
            data-testid="qidahen-map-viewport-controls"
            data-ui-anchor="left-bottom"
        >
            <div className="flex gap-2">
                <button
                    type="button"
                    data-testid="qidahen-map-zoom-out"
                    className="inline-flex h-[38px] min-w-[38px] items-center justify-center border-[3px] text-[18px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                    onClick={() => onZoom(1 / 1.14)}
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                >
                    -
                </button>
                <button
                    type="button"
                    data-testid="qidahen-map-zoom-reset"
                    className="inline-flex h-[38px] min-w-[74px] items-center justify-center border-[3px] px-3 text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                    onClick={onReset}
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                >
                    {t('devtools.regionMaskTool.compactBoundaryStats.reset', { defaultValue: '复位' })}
                </button>
                <button
                    type="button"
                    data-testid="qidahen-map-zoom-in"
                    className="inline-flex h-[38px] min-w-[38px] items-center justify-center border-[3px] text-[18px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                    onClick={() => onZoom(1.14)}
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                >
                    +
                </button>
            </div>
        </div>
    );
};
