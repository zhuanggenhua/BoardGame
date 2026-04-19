import { useCallback, useEffect, useState } from 'react';

export interface UseArmedActivationConfig<TKey extends string | number> {
    enabled?: boolean;
    requireArming?: boolean;
    isKeyValid?: (key: TKey) => boolean;
    validationDeps?: ReadonlyArray<unknown>;
}

export interface ArmedActivationCallbacks {
    onArm?: () => void;
    onActivate: () => void;
}

export interface UseArmedActivationReturn<TKey extends string | number> {
    armedKey: TKey | null;
    isArmed: (key: TKey) => boolean;
    setArmedKey: React.Dispatch<React.SetStateAction<TKey | null>>;
    clearArmed: () => void;
    armOrActivate: (key: TKey, callbacks: ArmedActivationCallbacks) => boolean;
}

export function useArmedActivation<TKey extends string | number>({
    enabled = true,
    requireArming = true,
    isKeyValid,
    validationDeps = [],
}: UseArmedActivationConfig<TKey>): UseArmedActivationReturn<TKey> {
    const [armedKey, setArmedKey] = useState<TKey | null>(null);

    useEffect(() => {
        if (armedKey == null || !isKeyValid) return;
        if (!isKeyValid(armedKey)) {
            setArmedKey(null);
        }
    }, [armedKey, isKeyValid, ...validationDeps]);

    const isArmed = useCallback((key: TKey) => {
        return armedKey === key;
    }, [armedKey]);

    const clearArmed = useCallback(() => {
        setArmedKey(null);
    }, []);

    const armOrActivate = useCallback((key: TKey, callbacks: ArmedActivationCallbacks) => {
        if (!enabled) {
            callbacks.onActivate();
            return true;
        }

        if (!requireArming) {
            setArmedKey(null);
            callbacks.onActivate();
            return true;
        }

        if (armedKey === key) {
            setArmedKey(null);
            callbacks.onActivate();
            return true;
        }

        setArmedKey(key);
        callbacks.onArm?.();
        return false;
    }, [armedKey, enabled, requireArming]);

    return {
        armedKey,
        isArmed,
        setArmedKey,
        clearArmed,
        armOrActivate,
    };
}
