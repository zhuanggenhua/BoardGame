import React from 'react';
import { getLocalAssetPath, getOptimizedImageUrls } from '../../../core/AssetLoader';
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
    onFrameChange?: (frameIndex: number) => void;
}

export const FrameSequencePlayer = ({
    sequence,
    playbackKey,
    playing = true,
    onComplete,
    onFrameChange,
    alt = '',
    ...imgProps
}: FrameSequencePlayerProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const onCompleteRef = React.useRef(onComplete);
    const onFrameChangeRef = React.useRef(onFrameChange);
    const resolvedFrames = React.useMemo(
        () => sequence.frames.map((frame) =>
            sequence.assetSource === 'local'
                ? getLocalAssetPath(frame)
                : getOptimizedImageUrls(frame).webp),
        [sequence.assetSource, sequence.frames],
    );
    const frameCount = resolvedFrames.length;
    const lastFrameIndex = Math.max(frameCount - 1, 0);
    const reducedMotionFrameIndex = sequence.reducedMotionBehavior === 'first-frame' ? 0 : lastFrameIndex;
    const [frameIndex, setFrameIndex] = React.useState(() => (prefersReducedMotion ? reducedMotionFrameIndex : 0));
    const completedPlaybackKeyRef = React.useRef<string | number | undefined>(undefined);

    React.useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    React.useEffect(() => {
        onFrameChangeRef.current = onFrameChange;
    }, [onFrameChange]);

    React.useEffect(() => {
        onFrameChangeRef.current?.(frameIndex);
    }, [frameIndex]);

    React.useEffect(() => {
        resolvedFrames.forEach((frame) => {
            const image = new Image();
            image.src = frame;
        });
    }, [resolvedFrames]);

    React.useEffect(() => {
        if (!playing || frameCount === 0) {
            if (!sequence.holdLastFrame) {
                setFrameIndex(0);
            }
            return;
        }

        if (prefersReducedMotion) {
            setFrameIndex(reducedMotionFrameIndex);
            if (completedPlaybackKeyRef.current !== playbackKey) {
                completedPlaybackKeyRef.current = playbackKey;
                onCompleteRef.current?.();
            }
            return;
        }

        const fps = sequence.fps ?? DEFAULT_FPS;
        const frameDurationMs = 1000 / Math.max(fps, 1);
        const startedAt = performance.now();
        let rafId = 0;
        let done = false;

        setFrameIndex(0);
        completedPlaybackKeyRef.current = undefined;

        const tick = (now: number) => {
            if (done) {
                return;
            }

            const elapsed = now - startedAt;
            const nextFrame = Math.floor(elapsed / frameDurationMs);

            if (sequence.loop) {
                setFrameIndex(nextFrame % frameCount);
                rafId = window.requestAnimationFrame(tick);
                return;
            }

            if (nextFrame >= frameCount) {
                setFrameIndex(sequence.holdLastFrame === false ? 0 : lastFrameIndex);
                done = true;
                if (completedPlaybackKeyRef.current !== playbackKey) {
                    completedPlaybackKeyRef.current = playbackKey;
                    onCompleteRef.current?.();
                }
                return;
            }

            setFrameIndex(nextFrame);
            rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);

        return () => {
            done = true;
            window.cancelAnimationFrame(rafId);
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
    ]);

    if (frameCount === 0) {
        return null;
    }

    return <img {...imgProps} alt={alt} src={resolvedFrames[Math.min(frameIndex, lastFrameIndex)]} />;
};
