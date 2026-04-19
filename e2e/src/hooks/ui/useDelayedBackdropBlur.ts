import { useEffect, useState } from 'react';

export function useDelayedBackdropBlur(active: boolean, delayMs = 320): boolean {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!active) {
            queueMicrotask(() => {
                if (!cancelled) {
                    setEnabled(false);
                }
            });
            return;
        }

        queueMicrotask(() => {
            if (!cancelled) {
                setEnabled(false);
            }
        });
        const timer = window.setTimeout(() => {
            setEnabled(true);
        }, delayMs);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [active, delayMs]);

    return active ? enabled : false;
}
