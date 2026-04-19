import type { HTMLAttributes } from 'react';
import { memo } from 'react';
import { cn } from '../../../lib/utils';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
    shimmerClassName?: string;
};

export const Skeleton = memo(function Skeleton({
    className,
    shimmerClassName,
    ...props
}: SkeletonProps) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                'relative overflow-hidden rounded-md bg-zinc-200/80',
                className,
            )}
            {...props}
        >
            <div
                className={cn(
                    'absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.4s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)]',
                    shimmerClassName,
                )}
            />
        </div>
    );
});

export default Skeleton;
