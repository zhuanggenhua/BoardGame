import { useEffect, useState } from 'react';

export function useDeferredRender(active = true): boolean {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!active) {
            setReady(false);
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            setReady(true);
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [active]);

    return ready;
}
