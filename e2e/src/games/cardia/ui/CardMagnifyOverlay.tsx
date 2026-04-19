/**
 * Cardia - 卡牌放大预览覆盖层
 *
 * 纯图片展示，无额外特效和文字。
 * 
 * 性能优化：组件始终渲染（不卸载），只控制可见性，避免重复挂载/卸载的开销。
 */

import React from 'react';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { CardInstance } from '../domain/core-types';
import type { CardiaCore } from '../domain/core-types';
import { resolveCardiaCardImagePath } from '../imagePaths';

export interface CardMagnifyTarget {
    card: CardInstance;
    core: CardiaCore;
    anchorRect?: DOMRect | null;
}

interface Props {
    target: CardMagnifyTarget | null;
    onClose: () => void;
    interactive?: boolean;
}

export const CardMagnifyOverlay: React.FC<Props> = ({ target, onClose, interactive = true }) => {
    const { card, anchorRect } = target || {};
    const imagePath = card ? resolveCardiaCardImagePath(card) : undefined;

    const widthForThreeQuarterHeight = 'calc(75vh * (106 / 160))';
    const overlayPositionStyle = React.useMemo(() => {
        if (typeof window === 'undefined') return undefined;

        if (!anchorRect) return undefined;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const gap = 20;
        const overlayHeight = Math.min(viewportHeight * 0.75, viewportHeight - gap * 2);
        const overlayWidth = overlayHeight * (106 / 160);
        const left = anchorRect.left - overlayWidth - gap;

        let top = anchorRect.top + anchorRect.height / 2 - overlayHeight / 2;
        if (top < gap) top = gap;
        if (top + overlayHeight > viewportHeight - gap) top = viewportHeight - gap - overlayHeight;

        return {
            position: 'fixed',
            left: Math.max(gap, Math.min(left, viewportWidth - gap - overlayWidth)),
            top: Math.max(gap, Math.min(top, viewportHeight - gap - overlayHeight)),
            height: `${overlayHeight}px`,
            width: `${overlayWidth}px`,
        } as React.CSSProperties;
    }, [anchorRect]);

    return (
        <MagnifyOverlay
            isOpen={!!target}
            onClose={onClose}
            interactive={interactive}
            overlayClassName="pointer-events-none p-3 sm:p-8"
            containerClassName="pointer-events-none"
            overlayTestId="cardia-magnify-overlay"
        >
            {target && (
                <div
                    className="relative aspect-[106/160] bg-transparent"
                    style={overlayPositionStyle ?? {
                        height: '75vh',
                        width: `min(75vw, ${widthForThreeQuarterHeight})`,
                    }}
                >
                    {/* 纯图片展示 */}
                    <div className="relative w-full h-full rounded-xl border-4 border-white/30 shadow-2xl overflow-hidden bg-gray-900">
                        {imagePath ? (
                            <CardPreview
                                previewRef={{ type: 'image', src: imagePath }}
                                alt="Card"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-white text-xl">
                                无图片
                            </div>
                        )}
                    </div>
                </div>
            )}
        </MagnifyOverlay>
    );
};
