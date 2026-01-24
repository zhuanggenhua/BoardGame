import { useEffect, useState } from 'react';

export function useDelayedBackdropBlur(active: boolean, delayMs = 320): boolean {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (!active) {
            setEnabled(false);
            return;
        }

        setEnabled(false);
        const timer = window.setTimeout(() => {
            setEnabled(true);
        }, delayMs);

        return () => window.clearTimeout(timer);
    }, [active, delayMs]);

    return enabled;
}
