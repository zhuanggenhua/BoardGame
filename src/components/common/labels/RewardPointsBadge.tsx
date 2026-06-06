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
                d="M12 1.75l2.05 8.2L22.25 12l-8.2 2.05L12 22.25l-2.05-8.2L1.75 12l8.2-2.05L12 1.75z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.15"
                strokeLinejoin="round"
            />
            <path
                d="M12 5.55l0.92 5.53 5.98 0.92-5.98 0.92L12 18.45l-0.92-5.53-5.53-0.92 5.53-0.92L12 5.55z"
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
