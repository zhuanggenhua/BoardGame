import type { SVGProps } from 'react';
import { cn } from '../../../lib/utils';

export interface RewardPointsStarIconProps extends SVGProps<SVGSVGElement> {
    title?: string;
}

export function RewardPointsStarIcon({ className, title, ...props }: RewardPointsStarIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden={title ? undefined : true}
            role={title ? 'img' : undefined}
            className={cn('h-4 w-4 text-amber-500', className)}
            {...props}
        >
            {title ? <title>{title}</title> : null}
            <path
                d="M12 2.75l2.77 5.61 6.19.9-4.48 4.37 1.06 6.17L12 16.89 6.46 19.8l1.06-6.17-4.48-4.37 6.19-.9L12 2.75z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.15"
                strokeLinejoin="round"
            />
            <path
                d="M12 6.1l1.15 2.34 2.58.37-1.86 1.82.44 2.57L12 11.98l-2.31 1.22.44-2.57-1.86-1.82 2.58-.37L12 6.1z"
                fill="#fff7d6"
                opacity="0.92"
            />
        </svg>
    );
}

export interface RewardPointsBadgeProps {
    points: number;
    signed?: boolean;
    className?: string;
    iconClassName?: string;
    textClassName?: string;
}

export function RewardPointsBadge({
    points,
    signed = false,
    className,
    iconClassName,
    textClassName,
}: RewardPointsBadgeProps) {
    const normalized = Number.isFinite(points) ? Math.trunc(points) : 0;
    const displayValue = signed && normalized > 0 ? `+${normalized}` : `${normalized}`;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 shadow-[0_1px_0_rgba(120,53,15,0.08)]',
                className,
            )}
            data-testid="reward-points-badge"
        >
            <RewardPointsStarIcon className={cn('h-3.5 w-3.5 shrink-0 text-amber-500', iconClassName)} />
            <span className={cn('tabular-nums leading-none', textClassName)}>{displayValue}</span>
        </span>
    );
}
