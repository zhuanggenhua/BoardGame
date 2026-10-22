import { useEffect, useState } from 'react';
import { safeMatchMedia, subscribeMediaQueryChange } from '../../lib/mediaQuery';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Reads the current reduced-motion preference. */
export function useReducedMotionPreference(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        () => safeMatchMedia(REDUCED_MOTION_QUERY).matches,
    );

    useEffect(() => {
        const mediaQuery = safeMatchMedia(REDUCED_MOTION_QUERY);
        const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
        updatePreference();
        return subscribeMediaQueryChange(mediaQuery, updatePreference);
    }, []);

    return prefersReducedMotion;
}
