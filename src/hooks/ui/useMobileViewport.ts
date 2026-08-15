import { isMobileViewport as isMobileViewportWidth } from '../../shared/mobileSupport';
import { useRuntimeViewport } from './useRuntimeViewport';

export function useMobileViewport() {
    const viewport = useRuntimeViewport();
    return isMobileViewportWidth(viewport.width);
}
