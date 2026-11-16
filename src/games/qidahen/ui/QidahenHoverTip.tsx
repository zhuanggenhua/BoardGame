import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useResolvedOverlayTooltipZIndex } from '../../../components/common/overlays/overlayLayer';
import { UI_Z_INDEX } from '../../../core';

const TIP_WIDTH = 248;
const VIEWPORT_PADDING = 8;
const ANCHOR_GAP = 12;

const TIP_SKIN = {
    borderColor: '#20150d',
    background: [
        'linear-gradient(180deg, rgba(56,39,24,0.92) 0%, rgba(28,20,13,0.9) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(231,197,126,0.16), transparent 36%)',
    ].join(', '),
    color: '#ead7a7',
    boxShadow: '0 2px 0 rgba(7,5,3,0.7), 0 10px 18px rgba(22,14,8,0.32), inset 0 0 0 1px rgba(232,200,133,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)',
    headerColor: '#d2b775',
    titleColor: '#f6d5a8',
} as const;

export type QidahenHoverTipPlacement = 'left' | 'right' | 'above' | 'below' | 'inside-bottom';

interface QidahenHoverTipProps extends React.HTMLAttributes<HTMLDivElement> {
    open: boolean;
    anchor: Element | null;
    placement?: QidahenHoverTipPlacement;
    testId?: string;
    variant?: 'tooltip' | 'panel';
    width?: number;
    gap?: number;
    avoidSelectors?: string[];
    onClick?: () => void;
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    children: React.ReactNode;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const QidahenHoverTip: React.FC<QidahenHoverTipProps> = ({
    open,
    anchor,
    placement = 'right',
    testId,
    variant = 'tooltip',
    width = TIP_WIDTH,
    gap = ANCHOR_GAP,
    avoidSelectors,
    onClick,
    onPointerEnter,
    onPointerLeave,
    children,
    ...attributes
}) => {
    const tipRef = useRef<HTMLDivElement>(null);
    const resolvedZIndex = Math.max(UI_Z_INDEX.tooltip, useResolvedOverlayTooltipZIndex());
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.body;
    }, []);

    const updateLayout = useCallback(() => {
        const node = tipRef.current;
        if (!open || !anchor || !node || typeof window === 'undefined') {
            return;
        }

        const anchorRect = anchor.getBoundingClientRect();
        const tooltipRect = node.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || width;
        const tooltipHeight = tooltipRect.height || 120;
        const { innerWidth, innerHeight } = window;
        const vertical = placement === 'above' || placement === 'below' || placement === 'inside-bottom';
        const fitsOnPreferredSide = placement === 'right'
            ? anchorRect.right + gap + tooltipWidth <= innerWidth - VIEWPORT_PADDING
            : anchorRect.left - gap - tooltipWidth >= VIEWPORT_PADDING;
        const side = fitsOnPreferredSide ? placement : placement === 'right' ? 'left' : 'right';
        const preferredLeft = vertical ? anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2
            : side === 'right' ? anchorRect.right + gap : anchorRect.left - gap - tooltipWidth;
        let left = clamp(
            preferredLeft,
            VIEWPORT_PADDING,
            Math.max(VIEWPORT_PADDING, innerWidth - tooltipWidth - VIEWPORT_PADDING),
        );
        const rawTop = placement === 'inside-bottom' ? anchorRect.bottom - tooltipHeight
            : placement === 'above' ? anchorRect.top - tooltipHeight - gap
            : placement === 'below' ? anchorRect.bottom + gap
            : anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
        let top = clamp(
            rawTop,
            VIEWPORT_PADDING,
            Math.max(VIEWPORT_PADDING, innerHeight - tooltipHeight - VIEWPORT_PADDING),
        );
        if (avoidSelectors?.length) {
            const blocked = [...document.querySelectorAll(avoidSelectors.join(','))].map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
            const xs = [left, anchorRect.left, anchorRect.right - tooltipWidth, anchorRect.left - tooltipWidth - gap, anchorRect.right + gap,
                ...blocked.flatMap(rect => [rect.left - tooltipWidth - 2, rect.right + 2])];
            const ys = [top, anchorRect.top, anchorRect.bottom - tooltipHeight, anchorRect.top - tooltipHeight - gap, anchorRect.bottom + gap,
                ...blocked.flatMap(rect => [rect.top - tooltipHeight - 2, rect.bottom + 2])];
            const distance = (point: {left: number; top: number}) => Math.hypot(
                Math.max(anchorRect.left - point.left - tooltipWidth, point.left - anchorRect.right, 0),
                Math.max(anchorRect.top - point.top - tooltipHeight, point.top - anchorRect.bottom, 0));
            const candidates = xs.flatMap(x => ys.map(y => ({ left: x, top: y })))
                .filter(point => point.left >= VIEWPORT_PADDING && point.top >= VIEWPORT_PADDING
                    && point.left + tooltipWidth <= innerWidth - VIEWPORT_PADDING && point.top + tooltipHeight <= innerHeight - VIEWPORT_PADDING)
                .sort((a, b) => distance(a) - distance(b));
            const available = candidates.find(point => blocked.every(rect => point.left + tooltipWidth + 6 <= rect.left || point.left - 6 >= rect.right
                || point.top + tooltipHeight + 6 <= rect.top || point.top - 6 >= rect.bottom));
            if (!available) { node.style.visibility = 'hidden'; return; }
            left = available.left; top = available.top;
        }
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        node.style.visibility = 'visible';
    }, [open, anchor, placement, gap, width, avoidSelectors]);

    useLayoutEffect(() => {
        updateLayout();
    });

    useEffect(() => {
        if (!open) return undefined;
        window.addEventListener('resize', updateLayout);
        window.addEventListener('scroll', updateLayout, true);
        return () => {
            window.removeEventListener('resize', updateLayout);
            window.removeEventListener('scroll', updateLayout, true);
        };
    }, [open, updateLayout]);

    // 选中/悬停会移动实际卡牌，浮层跟随同一实体的变换；动画结束即停止逐帧测量。
    useEffect(() => {
        if (!open || !anchor) return undefined;
        let frame = 0;
        const follow = () => {
            updateLayout();
            frame = typeof anchor.getAnimations === 'function' && anchor.getAnimations().some(animation => animation.playState === 'running')
                ? requestAnimationFrame(follow) : 0;
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(follow); };
        anchor.addEventListener('transitionrun', schedule);
        anchor.addEventListener('animationstart', schedule);
        schedule();
        return () => {
            cancelAnimationFrame(frame);
            anchor.removeEventListener('transitionrun', schedule);
            anchor.removeEventListener('animationstart', schedule);
        };
    }, [open, anchor, updateLayout]);

    if (!open || !anchor || !portalRoot) {
        return null;
    }

    return createPortal(
        <div
            {...attributes}
            ref={tipRef}
            className={`${variant === 'panel' ? 'pointer-events-auto' : onClick ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} fixed [--spacing:4px] ${placement === 'inside-bottom' ? 'border px-1 text-[12px] leading-4' : variant === 'tooltip' ? 'border-[3px] px-3 py-2 text-[14px] leading-6' : 'text-[14px] leading-6'} font-black tracking-normal`}
            data-testid={testId}
            role={attributes.role ?? (variant === 'panel' ? 'group' : onClick ? 'button' : 'tooltip')}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onKeyDown={onClick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            } : undefined}
            style={{
                left: -9999,
                top: -9999,
                width: `min(${width}px, calc(100vw - 16px))`,
                zIndex: resolvedZIndex,
                borderColor: variant === 'tooltip' ? TIP_SKIN.borderColor : undefined,
                background: variant === 'tooltip' ? TIP_SKIN.background : undefined,
                color: TIP_SKIN.color,
                boxShadow: variant === 'tooltip' ? TIP_SKIN.boxShadow : undefined,
                borderRadius: 3,
                textShadow: 'none',
                whiteSpace: 'normal',
                visibility: 'hidden',
            }}
        >
            {children}
        </div>,
        portalRoot,
    );
};

export const QidahenHoverTipBody: React.FC<{
    header: string;
    cost?: string | null;
    title: string;
    detail: string;
}> = ({ header, cost, title, detail }) => (
    <>
        <span className="flex items-center justify-between gap-3 text-[12px] tracking-[0.08em]" style={{ color: TIP_SKIN.headerColor }}>
            <span>{header}</span>
            {cost ? (
                <span
                    className="rounded-full px-2 py-0.5 text-[12px] font-black"
                    style={{
                        background: 'rgba(210,183,117,0.14)',
                        color: TIP_SKIN.headerColor,
                        boxShadow: 'inset 0 0 0 1px rgba(232,200,133,0.2)',
                    }}
                >
                    {cost}
                </span>
            ) : null}
        </span>
        <span className="mt-1 block text-[16px]" style={{ color: TIP_SKIN.titleColor }}>{title}</span>
        <span className="mt-1 block">{detail}</span>
    </>
);
