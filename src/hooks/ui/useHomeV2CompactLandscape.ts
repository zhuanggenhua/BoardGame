import { useEffect, useState } from 'react';
import { safeMatchMedia } from '../../lib/mediaQuery';

const HOME_V2_COMPACT_LANDSCAPE_MAX_SHORT_EDGE = 520;
const HOME_V2_COMPACT_LANDSCAPE_MAX_LONG_EDGE = 1280;

function getIsHomeV2CompactLandscapeViewport() {
    if (typeof window === 'undefined') {
        return false;
    }

    const { innerWidth, innerHeight, navigator } = window;
    if (innerWidth <= innerHeight) {
        return false;
    }

    const shortEdge = Math.min(innerWidth, innerHeight);
    const longEdge = Math.max(innerWidth, innerHeight);
    const isCoarsePointer = safeMatchMedia('(pointer: coarse)').matches
        || safeMatchMedia('(hover: none)').matches
        || (navigator?.maxTouchPoints ?? 0) > 0;

    return shortEdge <= HOME_V2_COMPACT_LANDSCAPE_MAX_SHORT_EDGE
        && longEdge <= HOME_V2_COMPACT_LANDSCAPE_MAX_LONG_EDGE
        && isCoarsePointer;
}

export function useHomeV2CompactLandscape() {
    const [isCompact, setIsCompact] = useState(getIsHomeV2CompactLandscapeViewport);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const update = () => {
            setIsCompact(getIsHomeV2CompactLandscapeViewport());
        };

        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        window.visualViewport?.addEventListener('resize', update);

        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.visualViewport?.removeEventListener('resize', update);
        };
    }, []);

    return isCompact;
}
