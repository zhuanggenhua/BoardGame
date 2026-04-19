export type FrameSequenceReducedMotionBehavior = 'first-frame' | 'last-frame';

export interface FrameSequenceDefinition {
    frames: string[];
    fps?: number;
    loop?: boolean;
    holdLastFrame?: boolean;
    reducedMotionBehavior?: FrameSequenceReducedMotionBehavior;
}

export const createNumberedFramePaths = (
    basePath: string,
    count: number,
    extension = 'png',
) => Array.from({ length: count }, (_, index) => `${basePath}/${index + 1}.${extension}`);

export const createFrameSequence = (
    basePath: string,
    count: number,
    options?: Omit<FrameSequenceDefinition, 'frames'> & { extension?: string },
): FrameSequenceDefinition => ({
    frames: createNumberedFramePaths(basePath, count, options?.extension ?? 'png'),
    fps: options?.fps,
    loop: options?.loop,
    holdLastFrame: options?.holdLastFrame,
    reducedMotionBehavior: options?.reducedMotionBehavior,
});
