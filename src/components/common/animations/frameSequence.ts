export type FrameSequenceReducedMotionBehavior = 'first-frame' | 'last-frame';

export interface FrameSequenceDefinition {
    frames: string[];
    fps?: number;
    loop?: boolean;
    holdLastFrame?: boolean;
    reducedMotionBehavior?: FrameSequenceReducedMotionBehavior;
    /** 资源已经随当前应用发布时，跳过远端资源域名解析，直接走本地 /assets。 */
    assetSource?: 'default' | 'local';
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
    assetSource: options?.assetSource,
});
