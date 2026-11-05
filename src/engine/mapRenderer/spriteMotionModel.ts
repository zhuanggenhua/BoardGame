import type { MapSceneSprite, MapSceneSpriteMotionPhase } from './types';

export interface SpriteMotionPhaseState {
    landingEmitted: boolean;
    settledEmitted: boolean;
}

/** Reports the one-time semantic phases for a motion frame; the Pixi ticker remains the clock owner. */
export function collectSpriteMotionPhases(
    frame: Pick<ReturnType<typeof resolveSpriteMotionFrame>, 'progress' | 'complete'>,
    kind: NonNullable<MapSceneSprite['motion']>['kind'],
    state: SpriteMotionPhaseState,
): MapSceneSpriteMotionPhase[] {
    const phases: MapSceneSpriteMotionPhase[] = [];
    if (kind === 'hop' && frame.progress === 1 && !state.landingEmitted) {
        state.landingEmitted = true;
        phases.push('landing');
    }
    if (frame.complete && !state.settledEmitted) {
        state.settledEmitted = true;
        phases.push('settled');
    }
    return phases;
}

export function resolveSpriteMotionFrame(elapsedMs: number, motion: NonNullable<MapSceneSprite['motion']>) {
    const duration = Math.max(0, motion.durationMs);
    const progress = duration === 0 ? 1 : Math.min(1, Math.max(0, elapsedMs) / duration);
    const landingDuration = Math.max(0, motion.landingDurationMs ?? 120);
    const landingProgress = landingDuration === 0
        ? 1
        : Math.min(1, Math.max(0, (elapsedMs - duration) / landingDuration));
    return {
        progress,
        landingProgress,
        shouldRenderRipple: progress === 1 && landingDuration > 0 && motion.kind === 'hop',
        complete: progress === 1 && (motion.kind !== 'hop' || landingProgress === 1),
    };
}

/** Ground-plane feedback scales with the token; it must not resemble a selection outline. */
export function resolveLandingRippleGeometry(width: number, height: number, progress: number) {
    const t = Math.max(0, Math.min(1, progress));
    return {
        x: width / 2,
        y: height + 6,
        radiusX: width * (.35 + t * .35),
        radiusY: height * (.07 + t * .13),
        alpha: (1 - t) * .95,
    };
}
