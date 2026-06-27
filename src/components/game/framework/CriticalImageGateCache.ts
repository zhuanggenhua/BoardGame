const criticalImageGateWindow = typeof window !== 'undefined'
    ? window as Window & {
        __BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__?: Set<string>;
    }
    : undefined;

if (criticalImageGateWindow && !criticalImageGateWindow.__BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__) {
    criticalImageGateWindow.__BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__ = new Set<string>();
}

export const criticalImageGateReadyRunKeys = criticalImageGateWindow?.__BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__
    ?? new Set<string>();

export function resetCriticalImageGateCacheForTests(): void {
    criticalImageGateReadyRunKeys.clear();
}
