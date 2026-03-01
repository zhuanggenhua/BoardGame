import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../../core';
import type { BreakdownLine } from '../../../engine/types';

interface BreakdownTooltipProps {
    /** 显示的数值文本 */
    displayText: string;
    /** 分解明细行 */
    lines: BreakdownLine[];
}

/** 单行明细（独立组件以支持 i18n） */
const BreakdownLineItem: React.FC<{ line: BreakdownLine }> = ({ line }) => {
    const ns = line.labelIsI18n ? line.labelNs : undefined;
    const { t } = useTranslation(ns || undefined);
    const label = line.labelIsI18n ? t(line.label, { defaultValue: line.label }) : line.label;

    const colorClass =
        line.color === 'positive'
            ? 'text-emerald-400'
            : line.color === 'negative'
              ? 'text-rose-400'
              : 'text-slate-300';

    const sign = line.value > 0 ? '+' : '';

    return (
        <div className="flex items-center justify-between gap-3 text-[11px] leading-relaxed">
            <span className="text-slate-300 truncate">{label}</span>
            <span className={`font-mono font-medium tabular-nums ${colorClass}`}>
                {sign}{line.value}
            </span>
        </div>
    );
};

/**
 * 数值分解 Tooltip 组件（通用）
 *
 * 显示带虚线下划线的数值，hover 时弹出气泡展示构成明细。
 * 经典游戏风格：虚线下划线 + 小气泡。
 */
export const BreakdownTooltip: React.FC<BreakdownTooltipProps> = ({
    displayText,
    lines,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root') ?? document.body;
    }, []);

    const updateAnchorRect = useCallback(() => {
        if (!anchorRef.current) return;
        setAnchorRect(anchorRef.current.getBoundingClientRect());
    }, []);

    useEffect(() => {
        if (!isHovered) return;
        updateAnchorRect();
        window.addEventListener('resize', updateAnchorRect);
        window.addEventListener('scroll', updateAnchorRect, true);
        return () => {
            window.removeEventListener('resize', updateAnchorRect);
            window.removeEventListener('scroll', updateAnchorRect, true);
        };
    }, [isHovered, updateAnchorRect]);

    // 计算 tooltip 位置（优先上方，空间不足则下方）
    const tooltipPosition = useMemo(() => {
        if (!anchorRect || typeof window === 'undefined') return null;
        const gap = 6;
        const padding = 8;
        const tooltipWidth = 180;
        const measured = tooltipRef.current?.getBoundingClientRect();
        const tooltipHeight = measured ? measured.height : 80;

        // 水平居中对齐锚点
        let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

        // 优先上方
        const canPlaceAbove = anchorRect.top - gap - tooltipHeight > padding;
        const top = canPlaceAbove
            ? anchorRect.top - gap - tooltipHeight
            : anchorRect.bottom + gap;

        return { left, top, above: canPlaceAbove, tooltipWidth };
    }, [anchorRect]);

    // 没有明细行时不显示 tooltip 效果
    if (!lines || lines.length === 0) {
        return <span>{displayText}</span>;
    }

    return (
        <span className="relative inline">
            <span
                ref={anchorRef}
                className="underline decoration-dotted decoration-white/40 underline-offset-2 hover:decoration-white/80 cursor-help transition-colors"
                onMouseEnter={() => {
                    setIsHovered(true);
                    updateAnchorRect();
                }}
                onMouseLeave={() => setIsHovered(false)}
            >
                {displayText}
            </span>

            {isHovered && portalRoot && tooltipPosition && createPortal(
                <div
                    ref={tooltipRef}
                    className="fixed pointer-events-none animate-in fade-in duration-150"
                    style={{
                        left: tooltipPosition.left,
                        top: tooltipPosition.top,
                        width: tooltipPosition.tooltipWidth,
                        zIndex: UI_Z_INDEX.tooltip,
                    }}
                >
                    <div className="bg-slate-900/95 border border-white/15 rounded-lg px-3 py-2 shadow-lg backdrop-blur-sm">
                        {lines.map((line, i) => (
                            <BreakdownLineItem key={i} line={line} />
                        ))}
                    </div>
                    {/* 小三角箭头 */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
                        style={
                            tooltipPosition.above
                                ? {
                                    bottom: -5,
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderTop: '5px solid rgba(15, 23, 42, 0.95)',
                                }
                                : {
                                    top: -5,
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderBottom: '5px solid rgba(15, 23, 42, 0.95)',
                                }
                        }
                    />
                </div>,
                portalRoot
            )}
        </span>
    );
};
