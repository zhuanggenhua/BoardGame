import type { CSSProperties, MouseEvent, PointerEvent } from 'react';

export type CardInspectButtonVariant = 'outline' | 'filled';
export type CardInspectButtonPlacement = 'inside' | 'outside';

export interface CardInspectButtonProps {
    ariaLabel: string;
    title?: string;
    sourceCardId?: number | string;
    onInspect: () => void;
    testId?: string;
    sizeRatio?: number;
    minSize?: number;
    maxSize?: number;
    iconRatio?: number;
    buttonSize?: string;
    iconSize?: string;
    variant?: CardInspectButtonVariant;
    placement?: CardInspectButtonPlacement;
    alwaysVisible?: boolean;
    revealOnGroupHover?: boolean;
    className?: string;
}

const clampRatio = (value: number, fallback: number) => (
    Number.isFinite(value) && value > 0 && value <= 1 ? value : fallback
);

const clampPixels = (value: number, fallback: number) => (
    Number.isFinite(value) && value > 0 ? value : fallback
);

export function CardInspectButton({
    ariaLabel,
    title,
    sourceCardId,
    onInspect,
    testId = 'card-inspect-button',
    sizeRatio = 0.25,
    minSize = 20,
    maxSize = 96,
    iconRatio = 0.48,
    buttonSize,
    iconSize,
    variant = 'outline',
    placement = 'inside',
    alwaysVisible = false,
    revealOnGroupHover = true,
    className,
}: CardInspectButtonProps) {
    const resolvedSizeRatio = clampRatio(sizeRatio, 0.25);
    const resolvedIconRatio = clampRatio(iconRatio, 0.48);
    const resolvedMinSize = clampPixels(minSize, 20);
    const resolvedMaxSize = Math.max(clampPixels(maxSize, 96), resolvedMinSize);
    const style: CSSProperties = buttonSize
        ? { width: buttonSize, height: buttonSize }
        : {
            width: `clamp(${resolvedMinSize}px, calc(100% * ${resolvedSizeRatio}), ${resolvedMaxSize}px)`,
            height: 'auto',
            aspectRatio: '1 / 1',
        };
    const iconStyle: CSSProperties = iconSize
        ? { width: iconSize, height: iconSize }
        : {
            width: `${resolvedIconRatio * 100}%`,
            height: `${resolvedIconRatio * 100}%`,
        };

    const stopPropagation = (event: PointerEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
    };

    return (
        <button
            type="button"
            className={[
                'absolute z-40 grid place-items-center rounded-full border-2 border-solid text-amber-50',
                'cursor-zoom-in shadow-[0_0_0_1px_rgba(17,24,39,0.55),0_4px_12px_rgba(0,0,0,0.38)]',
                'transition-[opacity,border-color,background-color,color,box-shadow] duration-150',
                variant === 'outline'
                    ? 'border-amber-100/90 bg-transparent hover:border-amber-50 hover:bg-amber-200/15 hover:text-white hover:shadow-[0_0_0_2px_rgba(251,191,36,0.28),0_5px_14px_rgba(0,0,0,0.42)]'
                    : 'border-amber-100/70 bg-black/70 hover:border-amber-50 hover:bg-amber-300/85 hover:text-stone-950',
                placement === 'outside' ? '-right-6 top-0' : 'right-1 top-1',
                alwaysVisible
                    ? 'pointer-events-auto opacity-100'
                    : [
                        'pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100',
                        revealOnGroupHover && 'group-hover:pointer-events-auto group-hover:opacity-100',
                    ].filter(Boolean).join(' '),
                className,
            ].filter(Boolean).join(' ')}
            style={style}
            data-testid={testId}
            data-source-card-id={sourceCardId}
            data-browse-inspectable="true"
            data-secondary-inspect="true"
            data-card-inspect-variant={variant}
            data-card-inspect-size-ratio={buttonSize ? undefined : resolvedSizeRatio}
            data-card-inspect-button-size={buttonSize ?? undefined}
            aria-label={ariaLabel}
            title={title}
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
            onClick={(event) => {
                event.preventDefault();
                stopPropagation(event);
                onInspect();
            }}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="fill-current"
                style={iconStyle}
            >
                <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                />
            </svg>
        </button>
    );
}
