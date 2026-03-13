import { useEffect, useState } from 'react';

const COARSE_POINTER_QUERY = '(pointer: coarse)';

const getIsCoarsePointer = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    return window.matchMedia(COARSE_POINTER_QUERY).matches;
};

export function useCoarsePointer() {
    const [isCoarsePointer, setIsCoarsePointer] = useState(getIsCoarsePointer);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(COARSE_POINTER_QUERY);
        const updatePointer = () => {
            setIsCoarsePointer(mediaQuery.matches);
        };

        updatePointer();
        mediaQuery.addEventListener('change', updatePointer);

        return () => {
            mediaQuery.removeEventListener('change', updatePointer);
        };
    }, []);

    return isCoarsePointer;
}
