import { useEffect, useState } from 'react';

export function useDeferredRender(active = true): boolean {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!active) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setReady(false);
                }
            });
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            setReady(true);
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frame);
        };
    }, [active]);

    return active ? ready : false;
}
