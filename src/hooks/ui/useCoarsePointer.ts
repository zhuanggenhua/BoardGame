import { useEffect, useState } from 'react';
import { safeMatchMedia, subscribeMediaQueryChange } from '../../lib/mediaQuery';

// 保留旧 Hook 名称；无悬浮设备同样需要触控优先的交互回退。
const TOUCH_FIRST_INTERACTION_QUERY = '(pointer: coarse), (hover: none)';
const FORCE_COARSE_POINTER_QUERY_KEY = 'bgForceCoarsePointer';

const getForcedCoarsePointer = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    const forcedByWindow = (window as Window & { __BG_FORCE_COARSE_POINTER__?: boolean }).__BG_FORCE_COARSE_POINTER__;
    if (forcedByWindow === true) {
        return true;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get(FORCE_COARSE_POINTER_QUERY_KEY) === '1') {
        return true;
    }

    return null;
};

const getIsCoarsePointer = () => {
    const forcedCoarsePointer = getForcedCoarsePointer();
    if (forcedCoarsePointer != null) {
        return forcedCoarsePointer;
    }

    if (typeof window === 'undefined') {
        return false;
    }

    return safeMatchMedia(TOUCH_FIRST_INTERACTION_QUERY).matches;
};

export function useCoarsePointer() {
    const [isCoarsePointer, setIsCoarsePointer] = useState(getIsCoarsePointer);
    const forcedCoarsePointer = getForcedCoarsePointer();

    useEffect(() => {
        if (forcedCoarsePointer != null) {
            return undefined;
        }

        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = safeMatchMedia(TOUCH_FIRST_INTERACTION_QUERY);
        const updatePointer = () => {
            setIsCoarsePointer(mediaQuery.matches);
        };

        updatePointer();
        return subscribeMediaQueryChange(mediaQuery, updatePointer);
    }, [forcedCoarsePointer]);

    return forcedCoarsePointer ?? isCoarsePointer;
}
