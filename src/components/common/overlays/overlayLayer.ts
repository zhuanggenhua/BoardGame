import React from 'react';
import { UI_Z_INDEX } from '../../../core';

export type OverlayLayerContextValue = {
    tooltipZIndex?: number;
};

export const OverlayLayerContext = React.createContext<OverlayLayerContextValue | null>(null);

export const resolveOverlayTooltipZIndex = (baseZIndex: number) => (
    Math.max(UI_Z_INDEX.tooltip, baseZIndex + 1)
);

export const useResolvedOverlayTooltipZIndex = (zIndex?: number) => {
    const context = React.useContext(OverlayLayerContext);
    return zIndex ?? context?.tooltipZIndex ?? UI_Z_INDEX.tooltip;
};
