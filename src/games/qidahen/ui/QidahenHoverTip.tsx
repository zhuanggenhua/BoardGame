import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

export type QidahenHoverTipPlacement = 'left' | 'right';

interface QidahenHoverTipProps {
    open: boolean;
    anchor: Element | null;
    placement?: QidahenHoverTipPlacement;
    testId?: string;
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
    onClick,
    onPointerEnter,
    onPointerLeave,
    children,
}) => {
    const tipRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState<{ left: number; top: number } | null>(null);
    const resolvedZIndex = Math.max(UI_Z_INDEX.tooltip, useResolvedOverlayTooltipZIndex());
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.body;
    }, []);

    const updateLayout = useCallback(() => {
        if (!open || !anchor || !tipRef.current || typeof window === 'undefined') {
            setLayout(null);
            return;
        }

        const anchorRect = anchor.getBoundingClientRect();
        const tooltipRect = tipRef.current.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || TIP_WIDTH;
        const tooltipHeight = tooltipRect.height || 120;
        const { innerWidth, innerHeight } = window;
        const fitsOnPreferredSide = placement === 'right'
            ? anchorRect.right + ANCHOR_GAP + tooltipWidth <= innerWidth - VIEWPORT_PADDING
            : anchorRect.left - ANCHOR_GAP - tooltipWidth >= VIEWPORT_PADDING;
        const side: QidahenHoverTipPlacement = fitsOnPreferredSide
            ? placement
            : placement === 'right' ? 'left' : 'right';
        const preferredLeft = side === 'right'
            ? anchorRect.right + ANCHOR_GAP
            : anchorRect.left - ANCHOR_GAP - tooltipWidth;
        const left = clamp(
            preferredLeft,
            VIEWPORT_PADDING,
            Math.max(VIEWPORT_PADDING, innerWidth - tooltipWidth - VIEWPORT_PADDING),
        );
        const rawTop = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
        const top = clamp(
            rawTop,
            VIEWPORT_PADDING,
            Math.max(VIEWPORT_PADDING, innerHeight - tooltipHeight - VIEWPORT_PADDING),
        );
        setLayout({ left, top });
    }, [open, anchor, placement]);

    useLayoutEffect(() => {
        updateLayout();
    }, [updateLayout, children]);

    useEffect(() => {
        if (!open) return undefined;
        window.addEventListener('resize', updateLayout);
        window.addEventListener('scroll', updateLayout, true);
        return () => {
            window.removeEventListener('resize', updateLayout);
            window.removeEventListener('scroll', updateLayout, true);
        };
    }, [open, updateLayout]);

    if (!open || !anchor || !portalRoot) {
        return null;
    }

    return createPortal(
        <div
            ref={tipRef}
            className={`${onClick ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} fixed border-[3px] px-3 py-2 text-[11px] font-black leading-5 tracking-normal`}
            data-testid={testId}
            role={onClick ? 'button' : 'tooltip'}
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
                left: layout?.left ?? -9999,
                top: layout?.top ?? -9999,
                width: TIP_WIDTH,
                zIndex: resolvedZIndex,
                borderColor: TIP_SKIN.borderColor,
                background: TIP_SKIN.background,
                color: TIP_SKIN.color,
                boxShadow: TIP_SKIN.boxShadow,
                borderRadius: 3,
                textShadow: 'none',
                whiteSpace: 'normal',
                visibility: layout ? 'visible' : 'hidden',
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
        <span className="flex items-center justify-between gap-3 text-[10px] tracking-[0.08em]" style={{ color: TIP_SKIN.headerColor }}>
            <span>{header}</span>
            {cost ? (
                <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-black"
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
        <span className="mt-1 block text-[13px]" style={{ color: TIP_SKIN.titleColor }}>{title}</span>
        <span className="mt-1 block">{detail}</span>
    </>
);
