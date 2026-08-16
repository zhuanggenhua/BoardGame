import React from 'react';
import { getOptimizedImageUrls } from '../../../core/AssetLoader';
import { subscribeFxFrame } from '../../../engine/fx';
import type { FrameSequenceDefinition } from './frameSequence';

const DEFAULT_FPS = 12;

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

        syncPreference();
        mediaQuery.addEventListener?.('change', syncPreference);

        return () => {
            mediaQuery.removeEventListener?.('change', syncPreference);
        };
    }, []);

    return prefersReducedMotion;
}

export interface FrameSequencePlayerProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    sequence: FrameSequenceDefinition;
    playbackKey?: string | number;
    playing?: boolean;
    onComplete?: () => void;
}

export const FrameSequencePlayer = ({
    sequence,
    playbackKey,
    playing = true,
    onComplete,
    alt = '',
    ...imgProps
}: FrameSequencePlayerProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const onCompleteRef = React.useRef(onComplete);
    const resolvedFrames = React.useMemo(
        () => sequence.frames.map((frame) => getOptimizedImageUrls(frame).webp),
        [sequence.frames],
    );
    const frameCount = resolvedFrames.length;
    const lastFrameIndex = Math.max(frameCount - 1, 0);
    const reducedMotionFrameIndex = sequence.reducedMotionBehavior === 'first-frame' ? 0 : lastFrameIndex;
    const [frameIndex, setFrameIndex] = React.useState(() => (prefersReducedMotion ? reducedMotionFrameIndex : 0));
    const frameIndexRef = React.useRef(frameIndex);
    const completedPlaybackKeyRef = React.useRef<string | number | undefined>(undefined);

    const updateFrameIndex = React.useCallback((nextFrameIndex: number) => {
        if (frameIndexRef.current === nextFrameIndex) return;
        frameIndexRef.current = nextFrameIndex;
        setFrameIndex(nextFrameIndex);
    }, []);

    React.useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    React.useEffect(() => {
        resolvedFrames.forEach((frame) => {
            const image = new Image();
            image.src = frame;
        });
    }, [resolvedFrames]);

    React.useEffect(() => {
        if (!playing || frameCount === 0) {
            if (!sequence.holdLastFrame) {
                updateFrameIndex(0);
            }
            return;
        }

        if (prefersReducedMotion) {
            updateFrameIndex(reducedMotionFrameIndex);
            if (completedPlaybackKeyRef.current !== playbackKey) {
                completedPlaybackKeyRef.current = playbackKey;
                onCompleteRef.current?.();
            }
            return;
        }

        const fps = sequence.fps ?? DEFAULT_FPS;
        const frameDurationMs = 1000 / Math.max(fps, 1);
        const startedAt = performance.now();
        let unsubscribeFrame: (() => void) | undefined;
        let done = false;

        frameIndexRef.current = 0;
        setFrameIndex(0);
        completedPlaybackKeyRef.current = undefined;

        const tick = (now: number) => {
            if (done) {
                return;
            }

            const elapsed = now - startedAt;
            const nextFrame = Math.floor(elapsed / frameDurationMs);

            if (sequence.loop) {
                updateFrameIndex(nextFrame % frameCount);
                return;
            }

            if (nextFrame >= frameCount) {
                updateFrameIndex(sequence.holdLastFrame === false ? 0 : lastFrameIndex);
                done = true;
                unsubscribeFrame?.();
                if (completedPlaybackKeyRef.current !== playbackKey) {
                    completedPlaybackKeyRef.current = playbackKey;
                    onCompleteRef.current?.();
                }
                return;
            }

            updateFrameIndex(nextFrame);
        };

        unsubscribeFrame = subscribeFxFrame(({ now }) => tick(now));

        return () => {
            done = true;
            unsubscribeFrame?.();
        };
    }, [
        frameCount,
        lastFrameIndex,
        playbackKey,
        playing,
        prefersReducedMotion,
        reducedMotionFrameIndex,
        sequence.fps,
        sequence.holdLastFrame,
        sequence.loop,
        updateFrameIndex,
    ]);

    if (frameCount === 0) {
        return null;
    }

    return <img {...imgProps} alt={alt} src={resolvedFrames[Math.min(frameIndex, lastFrameIndex)]} />;
};
