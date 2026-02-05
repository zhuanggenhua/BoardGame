import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardPreview } from '../common/media/CardPreview';
import type { CardPreviewRef } from '../../systems/CardSystem';

interface CardPreviewTooltipProps {
    /** 卡牌预览引用 */
    previewRef: CardPreviewRef;
    /** 显示的文本（卡牌名称） */
    children: React.ReactNode;
    /** 当前语言 */
    locale?: string;
}

/**
 * 卡牌预览 Tooltip 组件
 * 
 * 鼠标移到卡牌名称上时，显示卡牌图片预览
 */
export const CardPreviewTooltip: React.FC<CardPreviewTooltipProps> = ({
    previewRef,
    children,
    locale,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);

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

    const previewPosition = useMemo(() => {
        if (!anchorRect || typeof window === 'undefined') return null;
        const previewWidth = 192;
        const previewHeight = 308;
        const gap = 12;
        const padding = 8;
        const { innerWidth, innerHeight } = window;
        const canPlaceRight = anchorRect.right + gap + previewWidth <= innerWidth - padding;
        const placeRight = canPlaceRight || anchorRect.left < previewWidth + gap + padding;
        const left = placeRight
            ? anchorRect.right + gap
            : anchorRect.left - gap - previewWidth;
        const rawTop = anchorRect.top + anchorRect.height / 2 - previewHeight / 2;
        const top = Math.min(Math.max(rawTop, padding), innerHeight - previewHeight - padding);
        return { left, top, placeRight };
    }, [anchorRect]);

    return (
        <span className="relative inline-block">
            {/* 可 hover 的卡牌名称（带下划线） */}
            <span
                ref={anchorRef}
                className="underline decoration-dotted decoration-white/40 hover:decoration-white/80 cursor-help transition-colors"
                onMouseEnter={() => {
                    setIsHovered(true);
                    updateAnchorRect();
                }}
                onMouseLeave={() => setIsHovered(false)}
            >
                {children}
            </span>

            {/* 预览图片 Tooltip

               说明：日志面板/Fab 容器通常带 overflow 裁剪。
               使用 portal + 视口定位，确保预览不被截断。
            */}
            {isHovered && portalRoot && previewPosition && createPortal(
                <div
                    className="fixed z-[10001] pointer-events-none"
                    style={{
                        left: previewPosition.left,
                        top: previewPosition.top,
                        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))',
                    }}
                >
                    {/* 卡牌预览 */}
                    <CardPreview
                        previewRef={previewRef}
                        locale={locale}
                        className="w-48 h-[308px] rounded-lg"
                        style={{
                            backgroundRepeat: 'no-repeat',
                        }}
                    />
                    {/* 小三角箭头 */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-0 h-0"
                        style={
                            previewPosition.placeRight
                                ? {
                                    left: -6,
                                    borderTop: '6px solid transparent',
                                    borderBottom: '6px solid transparent',
                                    borderRight: '6px solid rgba(0, 0, 0, 0.8)',
                                }
                                : {
                                    right: -6,
                                    borderTop: '6px solid transparent',
                                    borderBottom: '6px solid transparent',
                                    borderLeft: '6px solid rgba(0, 0, 0, 0.8)',
                                }
                        }
                    />
                </div>,
                portalRoot
            )}
        </span>
    );
};
