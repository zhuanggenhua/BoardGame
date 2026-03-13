import { useEffect, useState } from 'react';
import { isMobileViewport as isMobileViewportWidth } from '../../games/mobileSupport';

const getIsMobileViewport = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return isMobileViewportWidth(window.innerWidth);
};

export function useMobileViewport() {
    const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const updateViewport = () => {
            setIsMobileViewport(getIsMobileViewport());
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        window.addEventListener('orientationchange', updateViewport);

        return () => {
            window.removeEventListener('resize', updateViewport);
            window.removeEventListener('orientationchange', updateViewport);
        };
    }, []);

    return isMobileViewport;
}
