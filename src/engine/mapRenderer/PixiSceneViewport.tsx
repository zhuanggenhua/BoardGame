import { useLayoutEffect, type RefObject } from 'react';
import { useApplication } from '@pixi/react';

/** The host's final layout, including CSS-only changes, owns renderer dimensions. */
export function PixiSceneViewport({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }) {
    const { app, isInitialised } = useApplication();
    useLayoutEffect(() => {
        const host = hostRef.current;
        if (!isInitialised || !host) return;
        const resize = () => {
            const width = host.clientWidth, height = host.clientHeight;
            if (width <= 0 || height <= 0) return;
            if (app.screen.width !== width || app.screen.height !== height) {
                app.renderer.resize(width, height);
            }
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        return () => observer.disconnect();
    }, [app, isInitialised, hostRef]);
    return null;
}
