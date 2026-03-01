import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { createPortal } from 'react-dom';
import { PulseGlow } from '../common/animations/PulseGlow';
import { UI_Z_INDEX } from '../../core';

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
    /** 覆盖悬浮球整体层级（默认 UI_Z_INDEX.hud） */
    zIndex?: number;
}

type FabAlignment = { v: 'top' | 'bottom'; h: 'left' | 'right' };

const BUTTON_SIZE = 48;
const BUTTON_GAP = 12;
const EDGE_PADDING = 32;

export const FabMenu = ({
    items,
    position: initialPosition = 'bottom-right',
    isDark = true,
    zIndex = UI_Z_INDEX.hud,
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
        // 默认位置往内偏移，不贴边
        const DEFAULT_INSET = 48;
        if (initialPosition === 'bottom-right') return { left: maxLeft - DEFAULT_INSET, top: maxTop - DEFAULT_INSET };
        if (initialPosition === 'bottom-left') return { left: EDGE_PADDING + DEFAULT_INSET, top: maxTop - DEFAULT_INSET };
        if (initialPosition === 'top-right') return { left: maxLeft - DEFAULT_INSET, top: EDGE_PADDING + DEFAULT_INSET };
        return { left: EDGE_PADDING + DEFAULT_INSET, top: EDGE_PADDING + DEFAULT_INSET };
    }, [initialPosition]);

    // 加载保存的位置（支持百分比格式，兼容旧绝对坐标）
    useEffect(() => {
        try {
            const saved = localStorage.getItem('hud_fab_position');
            if (saved) {
                const parsed = JSON.parse(saved);
                let next: { left: number; top: number };
                
                // 检测是否为百分比格式
                if ('leftPercent' in parsed && 'topPercent' in parsed) {
                    next = {
                        left: parsed.leftPercent * window.innerWidth,
                        top: parsed.topPercent * window.innerHeight,
                    };
                } else {
                    // 旧格式：绝对坐标，转换为百分比后保存
                    next = parsed;
                    const percent = {
                        leftPercent: next.left / window.innerWidth,
                        topPercent: next.top / window.innerHeight,
                    };
                    localStorage.setItem('hud_fab_position', JSON.stringify(percent));
                }
                
                next = clampPosition(next);
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
                const percent = {
                    leftPercent: next.left / window.innerWidth,
                    topPercent: next.top / window.innerHeight,
                };
                localStorage.setItem('hud_fab_position', JSON.stringify(percent));
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
        // 保存为百分比格式
        const percent = {
            leftPercent: next.left / window.innerWidth,
            topPercent: next.top / window.innerHeight,
        };
        localStorage.setItem('hud_fab_position', JSON.stringify(percent));
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
            // 从 localStorage 读取百分比，按新尺寸重新计算
            try {
                const saved = localStorage.getItem('hud_fab_position');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if ('leftPercent' in parsed && 'topPercent' in parsed) {
                        const next = clampPosition({
                            left: parsed.leftPercent * window.innerWidth,
                            top: parsed.topPercent * window.innerHeight,
                        });
                        setFabPosition(next);
                        setAlignment(getAlignmentForPosition(next));
                        return;
                    }
                }
            } catch (e) {
                console.error(e);
            }
            // 降级：直接 clamp 当前位置
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

    const hasAnyNotification = items.some((item) => item.active);
    // 波纹/辉光颜色跟随"选中态"同色系，避免不明显
    const glowColor = isDark ? 'rgba(0, 243, 255, 0.55)' : 'rgba(140, 123, 100, 0.85)';

    return (
        <motion.div
            ref={containerRef}
            className="fixed font-sans"
            drag
            dragMomentum={false}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onPointerDownCapture={handlePointerDownCapture}
            style={{ left: fabPosition.left, top: fabPosition.top, x: dragX, y: dragY, zIndex }}
            data-testid="fab-menu"
        >
            {/* 主球：锚点，位置固定 */}
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
                    showGlow={!isOpen ? hasAnyNotification : Boolean(items[0].active)}
                    isMain={true}
                    isDark={isDark}
                    alignment={alignment}
                    tooltipPortalRoot={tooltipPortalRoot}
                    glowColor={glowColor}
                    isDragging={isDragging}
                />
            </div>

            {/* 卫星按钮：绝对定位，相对主球偏移 */}
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
        </motion.div>
    );
};

const SatelliteList = ({ isOpen, items, activeId, onItemClick, alignment, isDark, tooltipPortalRoot, onExitComplete, glowColor, isDragging }: any) => {
    const isButtonBottom = alignment.v === 'bottom';
    const positionClass = isButtonBottom ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]';
    const flexDirection = isButtonBottom ? 'flex-col-reverse' : 'flex-col';
    const alignItems = alignment.h === 'right' ? 'items-start' : 'items-end';

    return (
        <AnimatePresence onExitComplete={onExitComplete}>
            {isOpen && (
                <motion.div
                    className={`absolute ${positionClass} left-0 flex ${flexDirection} ${alignItems} gap-3`}
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
                        absolute w-[300px] max-w-[calc(90vw-60px)] md:w-[300px] max-md:w-[260px] p-4 max-md:p-3 rounded-xl shadow-2xl backdrop-blur-xl border-l-[3px]
                        z-30
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
                    w-12 h-12 md:w-12 md:h-12 rounded-full backdrop-blur-md border
                    max-md:w-10 max-md:h-10
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
                                        zIndex: UI_Z_INDEX.tooltip,
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
                                        zIndex: UI_Z_INDEX.tooltip,
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

                <div className="flex items-center justify-center w-full h-full max-md:scale-90">
                    {item.icon}
                </div>
            </motion.button>
        </PulseGlow>
    );
};
