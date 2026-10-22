import { useEffect } from 'react';
import { useReducedMotionPreference } from '../../hooks/ui/useReducedMotionPreference';

type CameraMotionRef<T> = { current: T };

export interface CameraMotionLifecycleRefs<TPointer = unknown> {
    activePointersRef: CameraMotionRef<ReadonlyMap<number, TPointer>>;
    velocityRef: CameraMotionRef<{ x: number; y: number }>;
    inertiaActiveRef: CameraMotionRef<boolean>;
    cameraActiveRef: CameraMotionRef<boolean>;
}

/** Applies live reduced-motion changes to camera motion without cancelling an active gesture. */
export function useCameraMotionPreference<TPointer = unknown>({
    activePointersRef,
    velocityRef,
    inertiaActiveRef,
    cameraActiveRef,
}: CameraMotionLifecycleRefs<TPointer>): boolean {
    const prefersReducedMotion = useReducedMotionPreference();

    useEffect(() => {
        if (!prefersReducedMotion) return;

        velocityRef.current = { x: 0, y: 0 };
        inertiaActiveRef.current = false;
        if (activePointersRef.current.size === 0) cameraActiveRef.current = false;
    }, [activePointersRef, cameraActiveRef, inertiaActiveRef, prefersReducedMotion, velocityRef]);

    return prefersReducedMotion;
}
