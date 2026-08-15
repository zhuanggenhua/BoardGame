import React from 'react';
import { OverlayLayerContext, type OverlayLayerContextValue } from './overlayLayer';

export const OverlayLayerProvider: React.FC<{
    children: React.ReactNode;
    tooltipZIndex?: number;
}> = ({ children, tooltipZIndex }) => {
    const parentValue = React.useContext(OverlayLayerContext);
    const resolvedTooltipZIndex = tooltipZIndex ?? parentValue?.tooltipZIndex;
    const value = React.useMemo<OverlayLayerContextValue>(() => ({
        tooltipZIndex: resolvedTooltipZIndex,
    }), [resolvedTooltipZIndex]);

    return (
        <OverlayLayerContext.Provider value={value}>
            {children}
        </OverlayLayerContext.Provider>
    );
};
