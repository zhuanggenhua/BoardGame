import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardPreview } from '../../../common/media/CardPreview';
import { MagnifyOverlay } from '../../../common/overlays/MagnifyOverlay';
import { UI_Z_INDEX, type CardPreviewRef } from '../../../../core';

interface CardPreviewTooltipProps {
    /** 卡牌预览引用 */
    previewRef: CardPreviewRef;
    /** 显示的文本（卡牌名称） */
    children: React.ReactNode;
    /** 当前语言 */
    locale?: string;
    /** 预览最大尺寸（像素），默认 308 */
    maxDim?: number;
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
    maxDim: maxDimProp,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isMagnified, setIsMagnified] = useState(false);
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

    // 根据卡牌宽高比动态计算预览尺寸
    // aspectRatio > 1 = 横向卡牌，aspectRatio < 1 = 竖向卡牌
    const aspectRatio = 'aspectRatio' in previewRef ? previewRef.aspectRatio : undefined;
    const previewSize = useMemo(() => {
        const maxDim = maxDimProp ?? 308; // 预览最大尺寸（像素）
        const ar = aspectRatio ?? (192 / 308); // 默认竖向卡牌比例
        if (ar >= 1) {
            // 横向卡牌：宽度为最大值，高度按比例缩小
            return { width: maxDim, height: Math.round(maxDim / ar) };
        }
        // 竖向卡牌：高度为最大值，宽度按比例缩小
        return { width: Math.round(maxDim * ar), height: maxDim };
    }, [aspectRatio, maxDimProp]);

    const previewPosition = useMemo(() => {
        if (!anchorRect || typeof window === 'undefined') return null;
        const { width: previewWidth, height: previewHeight } = previewSize;
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
    }, [anchorRect, previewSize]);

    // 放大预览尺寸（点击放大时使用）
    const magnifySize = useMemo(() => {
        const ar = aspectRatio ?? (192 / 308);
        if (ar >= 1) {
            return { width: 'w-[50vw] max-w-[700px]', aspect: `aspect-[${ar}]` };
        }
        return { width: 'w-[30vw] max-w-[450px]', aspect: `aspect-[${ar}]` };
    }, [aspectRatio]);

    return (
        <span className="relative inline-block">
            {/* 可 hover 预览、可点击放大的卡牌名称 */}
            <span
                ref={anchorRef}
                className="underline decoration-dotted decoration-white/40 hover:decoration-white/80 cursor-zoom-in transition-colors"
                onMouseEnter={() => {
                    setIsHovered(true);
                    updateAnchorRect();
                }}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {
                    setIsHovered(false);
                    setIsMagnified(true);
                }}
            >
                {children}
            </span>

            {/* 预览图片 Tooltip

               说明：日志面板/Fab 容器通常带 overflow 裁剪。
               使用 portal + 视口定位，确保预览不被截断。
            */}
            {isHovered && portalRoot && previewPosition && createPortal(
                <div
                    className="fixed pointer-events-none"
                    style={{
                        left: previewPosition.left,
                        top: previewPosition.top,
                        zIndex: UI_Z_INDEX.tooltip,
                        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))',
                    }}
                >
                    {/* 卡牌预览 */}
                    <CardPreview
                        previewRef={previewRef}
                        locale={locale}
                        className="rounded-lg"
                        style={{
                            width: previewSize.width,
                            height: previewSize.height,
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

            {/* 点击放大预览（portal 到 modal-root，避免被 FabMenu Panel 的 stacking context 限制） */}
            {isMagnified && portalRoot && createPortal(
                <MagnifyOverlay isOpen={isMagnified} onClose={() => setIsMagnified(false)}>
                    <div className={`relative bg-transparent ${magnifySize.width}`} style={{ aspectRatio: aspectRatio ?? (192 / 308) }}>
                        <CardPreview
                            previewRef={previewRef}
                            locale={locale}
                            className="w-full h-full object-contain rounded-xl shadow-2xl"
                        />
                    </div>
                </MagnifyOverlay>,
                portalRoot
            )}
        </span>
    );
};
