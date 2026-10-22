import { useLayoutEffect, useState } from 'react';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../../shared/mobileSupport';

export function resolveHomeHudClearance(width: number, height: number, pathname: string, bannerTop: number | null) {
    return pathname === '/' && width > 0 && width <= MOBILE_MAX_VIEWPORT_WIDTH
        && bannerTop !== null && bannerTop > 0 && bannerTop < height
        ? height - bannerTop + 12 : 0;
}

/** Home owns the active-match region; the existing FAB position owner consumes its measured inset.
 * Other routes and desktop keep the existing zero-inset behavior. No stored position is rewritten here.
 */
export function useHomeHudClearance(pathname: string) {
    const viewport = useRuntimeViewport();
    const [clearance, setClearance] = useState(0);
    useLayoutEffect(() => {
        if (pathname !== '/' || viewport.width > MOBILE_MAX_VIEWPORT_WIDTH) {
            setClearance(0); return;
        }
        let observed: Element | null = null;
        const measure = () => {
            const rect = observed?.getBoundingClientRect();
            setClearance(resolveHomeHudClearance(viewport.width, viewport.height, pathname,
                rect && rect.width > 0 && rect.height > 0 ? rect.top : null));
        };
        const resize = new ResizeObserver(measure);
        const findBanner = () => {
            const next = document.querySelector('.platform-active-match');
            if (next === observed) return;
            resize.disconnect(); observed = next;
            if (observed) resize.observe(observed);
            measure();
        };
        findBanner(); measure();
        const mutation = new MutationObserver(findBanner);
        mutation.observe(document.body, { childList: true, subtree: true });
        return () => { mutation.disconnect(); resize.disconnect(); };
    }, [pathname, viewport.width, viewport.height]);
    return clearance;
}
