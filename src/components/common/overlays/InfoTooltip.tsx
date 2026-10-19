import React from 'react';
import { createPortal } from 'react-dom';
import { useResolvedOverlayTooltipZIndex } from './overlayLayer';

interface InfoTooltipProps {
    title: React.ReactNode;
    content: React.ReactNode[];
    isVisible: boolean;
    position?: 'right' | 'left';
    className?: string; // 额外样式
    /** 自定义 z-index，弹窗内使用时传入 UI_Z_INDEX.modalTooltip */
    zIndex?: number;
}

/**
 * 通用信息气泡组件
 *用于显示详情、规则提示等
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
    title,
    content,
    isVisible,
    position = 'right',
    className = '',
    zIndex,
}) => {
    const resolvedZIndex = useResolvedOverlayTooltipZIndex(zIndex);
    const tooltipRef = React.useRef<HTMLDivElement | null>(null);
    const anchorMarkerRef = React.useRef<HTMLSpanElement | null>(null);
    const [layout, setLayout] = React.useState<{
        top: number;
        left: number;
        side: 'right' | 'left';
    } | null>(null);

    React.useLayoutEffect(() => {
        if (!isVisible || !tooltipRef.current || typeof window === 'undefined') {
            setLayout(null);
            return;
        }

        const updateLayout = () => {
            const tooltip = tooltipRef.current;
            const anchor = anchorMarkerRef.current?.parentElement;
            if (!tooltip || !anchor) return;

            const anchorRect = anchor.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportPadding = 12;
            const gap = 10;
            const preferredSide = position;
            const fitsOnPreferredSide = preferredSide === 'right'
                ? anchorRect.right + gap + tooltipRect.width <= window.innerWidth - viewportPadding
                : anchorRect.left - gap - tooltipRect.width >= viewportPadding;
            const side: 'right' | 'left' = fitsOnPreferredSide
                ? preferredSide
                : preferredSide === 'right' ? 'left' : 'right';

            const preferredLeft = side === 'right'
                ? anchorRect.right + gap
                : anchorRect.left - gap - tooltipRect.width;
            const left = Math.min(
                Math.max(preferredLeft, viewportPadding),
                Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding),
            );
            const top = Math.min(
                Math.max(anchorRect.top, viewportPadding),
                Math.max(viewportPadding, window.innerHeight - tooltipRect.height - viewportPadding),
            );

            setLayout({ top, left, side });
        };

        updateLayout();
        window.addEventListener('resize', updateLayout);
        window.addEventListener('scroll', updateLayout, true);
        return () => {
            window.removeEventListener('resize', updateLayout);
            window.removeEventListener('scroll', updateLayout, true);
        };
    }, [isVisible, position]);

    if (!isVisible || typeof document === 'undefined') return null;

    return (
        <>
            <span ref={anchorMarkerRef} hidden aria-hidden="true" />
            {createPortal(
                <div
                    ref={tooltipRef}
                    data-testid="info-tooltip"
                    data-tooltip-placement={layout?.side ?? position}
                    className={`
                fixed w-max max-w-[min(20rem,calc(100vw-1.5rem))] whitespace-normal
                bg-slate-900/95 border border-amber-500/30 rounded-[clamp(6px,0.5vw,12px)] p-[clamp(8px,0.8vw,16px)]
                shadow-[0_0_1vw_rgba(0,0,0,0.5)] backdrop-blur-xl 
                transition-opacity duration-200 ease-out
                pointer-events-none origin-left
                ${className}
                    `}
                    style={{
                        zIndex: resolvedZIndex,
                        top: layout?.top ?? 0,
                        left: layout?.left ?? 0,
                        maxHeight: 'calc(100vh - 1.5rem)',
                        overflowY: 'auto',
                        visibility: layout ? 'visible' : 'hidden',
                        opacity: layout ? 1 : 0,
                    }}
                >
                    {/* 箭头 */}
                    <div
                        className={`
                    absolute top-[clamp(8px,0.6vw,12px)] w-[clamp(8px,0.6vw,12px)] h-[clamp(8px,0.6vw,12px)] bg-slate-900
                    border-l border-b border-amber-500/30 transform rotate-45
                    ${(layout?.side ?? position) === 'right'
                        ? '-left-[0.35vw]'
                        : '-right-[0.35vw] border-r border-t border-l-0 border-b-0'}
                        `}
                    />

                    {/* 标题为空时不占位，避免无职责的空标题栏挤压正文。 */}
                    {title !== null && title !== undefined && title !== '' && (
                        <div
                            data-testid="info-tooltip-title"
                            className="min-w-0 break-words text-amber-400 font-bold mb-[clamp(4px,0.4vw,8px)] pb-[clamp(3px,0.2vw,4px)] border-b border-white/10 leading-tight"
                            style={{ fontSize: 'clamp(12px, 0.9vw, 18px)' }}
                        >
                            {title}
                        </div>
                    )}

                    {/* 内容列表 */}
                    <div className="flex flex-col gap-[clamp(3px,0.2vw,4px)]">
                        {content.map((line, i) => (
                            <div key={i} data-testid="info-tooltip-content-line" className="min-w-0 text-slate-300 flex items-start leading-snug" style={{ fontSize: 'clamp(11px, 0.7vw, 14px)' }}>
                                <span className="mr-[0.4vw] text-amber-500">•</span>
                                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{line}</span>
                            </div>
                        ))}
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};
