import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { createPortal } from 'react-dom';
import { PulseGlow } from '../common/animations/PulseGlow';

export interface FabAction {
    id: string;
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    content?: ReactNode; // 侧边面板内容
    color?: string;      // 颜色覆盖
    active?: boolean;    // 通知提示
    onActivate?: (isActive: boolean) => void;
    preview?: ReactNode; // 通知简略信息
}

interface FabMenuProps {
    items: FabAction[];
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    isDark?: boolean;
}

type FabAlignment = { v: 'top' | 'bottom'; h: 'left' | 'right' };

const BUTTON_SIZE = 48;
const BUTTON_GAP = 12;
const EDGE_PADDING = 32;
const TOOLTIP_Z_INDEX = 9200;

export const FabMenu = ({
    items,
    position: initialPosition = 'bottom-right',
    isDark = true
}: FabMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const prevActiveItemIdRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [fabPosition, setFabPosition] = useState<{ left: number; top: number } | null>(null);
    const dragX = useMotionValue(0);
    const dragY = useMotionValue(0);
    const [isListAnimating, setIsListAnimating] = useState(false);
    const didDragRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    // 动态对齐状态
    const [alignment, setAlignment] = useState<FabAlignment>({ v: 'bottom', h: 'right' });
    const tooltipPortalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root') ?? document.body;
    }, []);

    const clampPosition = useCallback((target: { left: number; top: number }) => {
        const maxLeft = window.innerWidth - BUTTON_SIZE - EDGE_PADDING;
        const maxTop = window.innerHeight - BUTTON_SIZE - EDGE_PADDING;
        return {
            left: Math.min(Math.max(target.left, EDGE_PADDING), maxLeft),
            top: Math.min(Math.max(target.top, EDGE_PADDING), maxTop),
        };
    }, []);

    const getAlignmentForPosition = useCallback((target: { left: number; top: number }): FabAlignment => {
        const centerY = window.innerHeight / 2;
        const centerX = window.innerWidth / 2;
        const anchorX = target.left + BUTTON_SIZE / 2;
        const anchorY = target.top + BUTTON_SIZE / 2;
        const v: FabAlignment['v'] = anchorY < centerY ? 'top' : 'bottom';
        const h: FabAlignment['h'] = anchorX < centerX ? 'right' : 'left';
        return { v, h };
    }, []);

    const getInitialPosition = useCallback(() => {
        const maxLeft = window.innerWidth - BUTTON_SIZE - EDGE_PADDING;
        const maxTop = window.innerHeight - BUTTON_SIZE - EDGE_PADDING;
        if (initialPosition === 'bottom-right') return { left: maxLeft, top: maxTop };
        if (initialPosition === 'bottom-left') return { left: EDGE_PADDING, top: maxTop };
        if (initialPosition === 'top-right') return { left: maxLeft, top: EDGE_PADDING };
        return { left: EDGE_PADDING, top: EDGE_PADDING };
    }, [initialPosition]);

    // 加载保存的位置（兼容旧偏移格式）
    useEffect(() => {
        try {
            const saved = localStorage.getItem('hud_fab_position');
            if (saved) {
                const parsed = JSON.parse(saved);
                const next = clampPosition(parsed);
                setFabPosition(next);
                setAlignment(getAlignmentForPosition(next));
                return;
            }

            const legacyOffset = localStorage.getItem('hud_fab_offset');
            const base = getInitialPosition();
            if (legacyOffset) {
                const parsed = JSON.parse(legacyOffset);
                const next = clampPosition({
                    left: base.left + (parsed.x ?? 0),
                    top: base.top + (parsed.y ?? 0),
                });
                localStorage.setItem('hud_fab_position', JSON.stringify(next));
                localStorage.removeItem('hud_fab_offset');
                setFabPosition(next);
                setAlignment(getAlignmentForPosition(next));
                return;
            }

            const next = clampPosition(base);
            setFabPosition(next);
            setAlignment(getAlignmentForPosition(next));
        } catch (e) {
            console.error(e);
        }
    }, [clampPosition, getAlignmentForPosition, getInitialPosition]);

    const handleDragEnd = (_: any, info: any) => {
        if (!fabPosition) return;
        setIsDragging(false);
        const next = clampPosition({
            left: fabPosition.left + info.offset.x,
            top: fabPosition.top + info.offset.y,
        });
        setFabPosition(next);
        localStorage.setItem('hud_fab_position', JSON.stringify(next));
        dragX.set(0);
        dragY.set(0);
        setAlignment(getAlignmentForPosition(next));
    };

    const handleDragStart = () => {
        didDragRef.current = true;
        setIsDragging(true);
    };

    const handleListExitComplete = useCallback(() => {
        if (!isOpen) {
            setIsListAnimating(false);
        }
    }, [isOpen]);

    const handlePointerDownCapture = () => {
        didDragRef.current = false;
    };

    const handleMainClick = () => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }

        if (!isOpen) {
            // 第一次点击：展开并选中主球
            setIsOpen(true);
            setActiveItemId(items[0].id);
            return;
        }

        // 已展开时：
        // - 若当前没选中主球，则只"选中主球"（不折叠）
        // - 若已选中主球，再次点击才折叠
        if (activeItemId !== items[0].id) {
            setActiveItemId(items[0].id);
            return;
        }

        setIsOpen(false);
        setActiveItemId(null);
    };

    const handleSatelliteClick = (item: FabAction) => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        if (item.content) {
            if (activeItemId === item.id) {
                setActiveItemId(null);
            } else {
                setActiveItemId(item.id);
            }
        } else {
            if (item.onClick) item.onClick();
        }
    };

    // 已展开时不允许"点空白就折叠"，只能再次点击主球关闭；
    // 避免误触导致面板闪退。
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen) return;
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                const target = event.target as HTMLElement;
                if (target.closest('[role="dialog"]')) return;
                // no-op
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!fabPosition) return;
        const handleResize = () => {
            const next = clampPosition(fabPosition);
            setFabPosition(next);
            setAlignment(getAlignmentForPosition(next));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampPosition, fabPosition, getAlignmentForPosition]);

    useEffect(() => {
        if (isOpen) {
            setIsListAnimating(true);
        }
    }, [isOpen]);

    useEffect(() => {
        if (prevActiveItemIdRef.current === activeItemId) return;

        const prevItem = items.find((item) => item.id === prevActiveItemIdRef.current);
        if (prevItem?.onActivate) {
            prevItem.onActivate(false);
        }

        const nextItem = items.find((item) => item.id === activeItemId);
        if (nextItem?.onActivate) {
            nextItem.onActivate(true);
        }

        prevActiveItemIdRef.current = activeItemId;
    }, [activeItemId, items]);

    // 列表顺序
    const isButtonBottom = alignment.v === 'bottom';
    const satellitesToRender = isButtonBottom ? [...items.slice(1)].reverse() : items.slice(1);

    // 水平对齐
    const alignClass = alignment.h === 'right' ? 'items-start' : 'items-end';

    if (!fabPosition) return null;

    const listCount = Math.max(items.length - 1, 0);
    const listHeight = listCount > 0
        ? listCount * BUTTON_SIZE + (listCount - 1) * BUTTON_GAP
        : 0;
    const isListVisible = isOpen || isListAnimating;
    const hasAnyNotification = items.some((item) => item.active);
    const listOffset = (isListVisible && isButtonBottom && listCount > 0)
        ? listHeight + BUTTON_GAP
        : 0;
    const containerTop = fabPosition.top - listOffset;
    // 波纹/辉光颜色跟随"选中态"同色系，避免不明显
    const glowColor = isDark ? 'rgba(0, 243, 255, 0.55)' : 'rgba(140, 123, 100, 0.85)';

    return (
        <motion.div
            ref={containerRef}
            className={`fixed z-[9000] flex flex-col ${alignClass} gap-3 font-sans`}
            drag
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onPointerDownCapture={handlePointerDownCapture}
            style={{ left: fabPosition.left, top: containerTop, x: dragX, y: dragY }}
            data-testid="fab-menu"
        >
            {isButtonBottom ? (
                <>
                    <SatelliteList
                        isOpen={isOpen}
                        items={satellitesToRender}
                        activeId={activeItemId}
                        onItemClick={handleSatelliteClick}
                        alignment={alignment}
                        isDark={isDark}
                        tooltipPortalRoot={tooltipPortalRoot}
                        onExitComplete={handleListExitComplete}
                        glowColor={glowColor}
                        isDragging={isDragging}
                    />
                    {items[0] && (
                        <div className={`relative flex items-center justify-center ${activeItemId === items[0].id ? 'z-50' : 'z-20'}`}>
                            <Panel
                                item={items[0]}
                                isActive={activeItemId === items[0].id && isOpen}
                                alignment={alignment}
                                isDark={isDark}
                            />
                            <MenuButton
                                item={items[0]}
                                onClick={handleMainClick}
                                isActive={activeItemId === items[0].id && isOpen}
                                showGlow={hasAnyNotification}
                                isMain={true}
                                isDark={isDark}
                                alignment={alignment}
                                tooltipPortalRoot={tooltipPortalRoot}
                                glowColor={glowColor}
                                isDragging={isDragging}
                            />
                        </div>
                    )}
                </>
            ) : (
                <>
                    {items[0] && (
                        <div className={`relative flex items-center justify-center ${activeItemId === items[0].id ? 'z-50' : 'z-20'}`}>
                            <Panel
                                item={items[0]}
                                isActive={activeItemId === items[0].id && isOpen}
                                alignment={alignment}
                                isDark={isDark}
                            />
                            <MenuButton
                                item={items[0]}
                                onClick={handleMainClick}
                                isActive={activeItemId === items[0].id && isOpen}
                                showGlow={hasAnyNotification}
                                isMain={true}
                                isDark={isDark}
                                alignment={alignment}
                                tooltipPortalRoot={tooltipPortalRoot}
                                glowColor={glowColor}
                                isDragging={isDragging}
                            />
                        </div>
                    )}
                    <SatelliteList
                        isOpen={isOpen}
                        items={satellitesToRender}
                        activeId={activeItemId}
                        onItemClick={handleSatelliteClick}
                        alignment={alignment}
                        isDark={isDark}
                        tooltipPortalRoot={tooltipPortalRoot}
                        onExitComplete={handleListExitComplete}
                        glowColor={glowColor}
                        isDragging={isDragging}
                    />
                </>
            )}
        </motion.div>
    );
};

const SatelliteList = ({ isOpen, items, activeId, onItemClick, alignment, isDark, tooltipPortalRoot, onExitComplete, glowColor, isDragging }: any) => {
    return (
        <AnimatePresence onExitComplete={onExitComplete}>
            {isOpen && (
                <motion.div
                    className={`flex flex-col gap-3 ${alignment.h === 'right' ? 'items-start' : 'items-end'}`}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
                    }}
                >
                    {items.map((item: FabAction) => (
                        <div key={item.id} className={`relative flex items-center justify-center ${activeId === item.id ? 'z-50' : 'z-20'}`}>
                            <Panel
                                item={item}
                                isActive={activeId === item.id}
                                alignment={alignment}
                                isDark={isDark}
                            />
                            <MenuButton
                                item={item}
                                onClick={() => onItemClick(item)}
                                isActive={activeId === item.id}
                                showGlow={Boolean(item.active) && activeId !== item.id}
                                isMain={false}
                                isDark={isDark}
                                alignment={alignment}
                                tooltipPortalRoot={tooltipPortalRoot}
                                glowColor={glowColor}
                                isDragging={isDragging}
                            />
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const Panel = ({ item, isActive, alignment, isDark }: any) => {
    const verticalClass = alignment.v === 'top' ? 'top-0' : 'bottom-0';
    const horizontalClass = alignment.h === 'right' ? 'left-[60px]' : 'right-[60px]';

    return (
        <AnimatePresence>
            {isActive && item.content && (
                <motion.div
                    key="panel"
                    initial={{ opacity: 0, scale: 0.95, x: alignment.h === 'right' ? -10 : 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: alignment.h === 'right' ? -10 : 10 }}
                    className={`
                        absolute w-[300px] max-w-[calc(90vw-60px)] p-4 rounded-xl shadow-2xl backdrop-blur-xl border-l-[3px]
                        z-10
                        ${isDark ? "bg-black/95 border-white/20 border-l-neon-blue text-white" : "bg-[#fcfbf9]/95 border-[#d3ccba] border-l-[#8c7b64] text-[#433422]"}

                        ${verticalClass}
                        ${horizontalClass}

                        max-h-[80vh] overflow-y-auto custom-scrollbar
                    `}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-70 border-b border-white/10 pb-2">
                        {item.label}
                    </div>
                    {item.content}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const MenuButton = ({ item, onClick, isActive, isMain, isDark, alignment, tooltipPortalRoot, showGlow, glowColor, isDragging }: any) => {
    const [isHovered, setIsHovered] = useState(false);
    const showTooltip = isHovered && !isDragging && !(isActive && item.content);
    const showPreview = Boolean(item.preview) && !isDragging && !isActive;
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);

    const updateTooltipRect = useCallback(() => {
        if (!buttonRef.current) return;
        setTooltipRect(buttonRef.current.getBoundingClientRect());
    }, []);

    useEffect(() => {
        const shouldTrackRect = showTooltip || showPreview;
        if (!shouldTrackRect) return;
        updateTooltipRect();
        window.addEventListener('resize', updateTooltipRect);
        window.addEventListener('scroll', updateTooltipRect, true);
        return () => {
            window.removeEventListener('resize', updateTooltipRect);
            window.removeEventListener('scroll', updateTooltipRect, true);
        };
    }, [showTooltip, showPreview, updateTooltipRect]);

    const tooltipSide = useMemo(() => {
        // tooltip 出现在"展开方向"的一侧：对齐规则与 Panel 一致
        return alignment.h === 'right' ? 'left' : 'right';
    }, [alignment.h]);

    const previewSide = useMemo(() => (tooltipSide === 'left' ? 'right' : 'left'), [tooltipSide]);

    const tooltipVerticalOffset = -(tooltipRect?.height ?? 0) / 2 + 8;
    const gap = 8; // tooltip/preview 与按钮边缘的间隙

    const activeStyle = isActive
        ? isDark
            ? 'bg-neon-blue text-black border-neon-blue shadow-neon-blue/50 ring-2 ring-white/20'
            : 'bg-[#8c7b64] text-white border-[#8c7b64] shadow-lg'
        : isDark
            ? "bg-black/90 border border-white/20 text-white shadow-xl shadow-black/50"
            : "bg-white border border-[#d3ccba] text-[#433422] shadow-xl shadow-[#433422]/10";

    return (
        <PulseGlow
            isGlowing={Boolean(showGlow)}
            glowColor={glowColor}
            className="relative"
            loop={Boolean(showGlow)}
            effect={showGlow ? 'ripple' : 'glow'}
        >
            <motion.button
                ref={buttonRef}
                variants={!isMain ? {
                    hidden: { opacity: 0, scale: 0.5, y: isMain ? 0 : 10 },
                    visible: { opacity: 1, scale: 1, y: 0 }
                } : undefined}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onMouseEnter={() => {
                    setIsHovered(true);
                    updateTooltipRect();
                }}
                onMouseLeave={() => setIsHovered(false)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={item.label}
                data-fab-id={item.id}
                className={`
                    relative flex items-center justify-center
                    w-12 h-12 rounded-full backdrop-blur-md border
                    ${activeStyle}
                    ${item.color || ''}
                    transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105
                    cursor-pointer
                    z-20
                `}
            >
                {tooltipPortalRoot && createPortal(
                    <>
                        <AnimatePresence>
                            {showTooltip && tooltipRect && (
                                <motion.div
                                    key={`tooltip-${item.id}`}
                                    initial={{ opacity: 0, x: tooltipSide === 'right' ? 10 : -10, scale: 0.9 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: tooltipSide === 'right' ? 10 : -10, scale: 0.9 }}
                                    className={`
                                        pointer-events-none px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap
                                        ${isDark ? 'bg-black text-white border border-white/20 shadow-lg shadow-black/50' : 'bg-white text-[#433422] border border-[#d3ccba] shadow-xl'}
                                    `}
                                    style={{
                                        position: 'fixed',
                                        top: tooltipRect.top + tooltipRect.height / 2 + tooltipVerticalOffset,
                                        left: tooltipSide === 'right'
                                            ? tooltipRect.right + gap
                                            : undefined,
                                        right: tooltipSide === 'left'
                                            ? window.innerWidth - tooltipRect.left + gap
                                            : undefined,
                                        transform: `translate(${tooltipSide === 'right' ? '0' : '-100%'}, -50%)`,
                                        zIndex: TOOLTIP_Z_INDEX,
                                    }}
                                >
                                    {item.label}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <AnimatePresence>
                            {showPreview && tooltipRect && (
                                <motion.div
                                    key={`preview-${item.id}`}
                                    initial={{ opacity: 0, x: previewSide === 'right' ? 8 : -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: previewSide === 'right' ? 8 : -8 }}
                                    className={`
                                        pointer-events-none px-3 py-2 rounded-lg text-xs font-medium
                                        overflow-hidden text-ellipsis whitespace-nowrap
                                        ${isDark ? 'bg-black/90 text-white border border-white/20 shadow-lg shadow-black/50' : 'bg-white text-[#433422] border border-[#d3ccba] shadow-xl'}
                                    `}
                                    style={{
                                        position: 'fixed',
                                        top: tooltipRect.top + tooltipRect.height / 2 + tooltipVerticalOffset,
                                        left: previewSide === 'right'
                                            ? tooltipRect.right + gap
                                            : undefined,
                                        right: previewSide === 'left'
                                            ? window.innerWidth - tooltipRect.left + gap
                                            : undefined,
                                        transform: `translate(${previewSide === 'right' ? '0' : '-100%'}, -50%)`,
                                        zIndex: TOOLTIP_Z_INDEX,
                                        maxWidth: 'min(360px, 70vw)',
                                    }}
                                >
                                    {item.preview}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>,
                    tooltipPortalRoot
                )}

                <div className="flex items-center justify-center w-full h-full">
                    {item.icon}
                </div>
            </motion.button>
        </PulseGlow>
    );
};
