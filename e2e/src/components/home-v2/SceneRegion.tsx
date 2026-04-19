import React from 'react';
import { resolveArtboardRegion } from '../../ugc/runtime/ui-scene/types';
import { HOME_V2_BOOK_SCENE } from '../../ugc/runtime/ui-scene/scenes/homeV2BookScene';

export interface SceneRegionProps extends React.HTMLAttributes<HTMLDivElement> {
    regionId: string;
    debug?: boolean;
}

export const SceneRegion = React.forwardRef<HTMLDivElement, SceneRegionProps>(
    ({ regionId, className = '', style, debug, children, ...props }, ref) => {
        const region = resolveArtboardRegion(HOME_V2_BOOK_SCENE.artboard, regionId);

        if (!region) {
            console.warn(`[SceneRegion] Region not found: ${regionId}`);
            return null;
        }

        const baseWidth = HOME_V2_BOOK_SCENE.artboard.baseWidth;
        const baseHeight = HOME_V2_BOOK_SCENE.artboard.baseHeight;

        const regionStyle: React.CSSProperties = {
            position: 'absolute',
            left: `${(region.x / baseWidth) * 100}%`,
            top: `${(region.y / baseHeight) * 100}%`,
            width: `${(region.width / baseWidth) * 100}%`,
            height: `${(region.height / baseHeight) * 100}%`,
            containerType: 'size',
            ...style,
        };

        if (debug) {
            regionStyle.border = '1px solid rgba(255, 0, 0, 0.5)';
            regionStyle.backgroundColor = 'rgba(255, 0, 0, 0.1)';
        }

        return (
            <div
                ref={ref}
                className={`pointer-events-auto @container ${className}`}
                style={regionStyle}
                {...props}
            >
                {children}
            </div>
        );
    }
);

SceneRegion.displayName = 'SceneRegion';
