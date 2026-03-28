import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { createPortal } from 'react-dom';
import { PulseGlow } from '../common/animations/PulseGlow';
import { UI_Z_INDEX } from '../../core';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../../games/mobileSupport';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import { logger } from '../../lib/logger';

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
type SafeAreaInsets = { top: number; right: number; bottom: number; left: number };
const FAB_EDGE_PEEK_SIZE_MOBILE = 18;
const FAB_EDGE_PEEK_SIZE_DESKTOP = 20;

export interface FabAction {
    mobilePanelVariant?: 'popover' | 'sheet';
}

export const FabMenu = ({
    items,
    position: initialPosition = 'bottom-right',
    isDark = true,
    zIndex = UI_Z_INDEX.hud,
}: FabMenuProps) => {
    // 响应式尺寸
    const viewport = useRuntimeViewport();
    const viewportWidth = viewport.width;
    const viewportHeight = viewport.height;
    const safeAreaInsets: SafeAreaInsets = viewport.safeArea;
    const isMobileViewport = viewportWidth > 0 && viewportWidth <= MOBILE_MAX_VIEWPORT_WIDTH;
    const buttonSize = isMobileViewport ? 44 : 48;
    const buttonGap = isMobileViewport ? 8 : 12;
    const edgePadding = isMobileViewport ? 12 : 32;
    const edgePeekSize = isMobileViewport ? FAB_EDGE_PEEK_SIZE_MOBILE : FAB_EDGE_PEEK_SIZE_DESKTOP;
    
    const [isOpen, setIsOpen] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const prevActiveItemIdRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [fabPosition, setFabPosition] = useState<{ left: number; top: number } | null>(null);
    const dragX = useMotionValue(0);
    const dragY = useMotionValue(0);
    const didDragRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);

    // 动态对齐状态
    const [alignment, setAlignment] = useState<FabAlignment>({ v: 'bottom', h: 'right' });
    const tooltipPortalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root') ?? document.body;
    }, []);
    const activeItem = useMemo(
        () => items.find((item) => item.id === activeItemId) ?? null,
        [activeItemId, items],
    );
    const shouldLockDocumentScroll = isOpen
        && isMobileViewport
        && activeItem?.mobilePanelVariant === 'sheet'
        && Boolean(activeItem.content);
    useDocumentScrollLock(shouldLockDocumentScroll);

    const clampPosition = useCallback((target: { left: number; top: number }, allowOverflow = true) => {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return target;
        }
        const minLeft = allowOverflow
            ? edgePeekSize - buttonSize
            : edgePadding + safeAreaInsets.left;
        const minTop = allowOverflow
            ? edgePeekSize - buttonSize
            : edgePadding + safeAreaInsets.top;
        const maxLeft = allowOverflow
            ? Math.max(minLeft, viewportWidth - edgePeekSize)
            : Math.max(minLeft, viewportWidth - buttonSize - edgePadding - safeAreaInsets.right);
        const maxTop = allowOverflow
            ? Math.max(minTop, viewportHeight - edgePeekSize)
            : Math.max(minTop, viewportHeight - buttonSize - edgePadding - safeAreaInsets.bottom);
        return {
            left: Math.min(Math.max(target.left, minLeft), maxLeft),
            top: Math.min(Math.max(target.top, minTop), maxTop),
        };
    }, [buttonSize, edgePadding, edgePeekSize, safeAreaInsets.bottom, safeAreaInsets.left, safeAreaInsets.right, safeAreaInsets.top, viewportHeight, viewportWidth]);

    const getAlignmentForPosition = useCallback((target: { left: number; top: number }): FabAlignment => {
        const centerY = viewportHeight / 2;
        const centerX = viewportWidth / 2;
        const anchorX = target.left + buttonSize / 2;
        const anchorY = target.top + buttonSize / 2;
        const v: FabAlignment['v'] = anchorY < centerY ? 'top' : 'bottom';
        const h: FabAlignment['h'] = anchorX < centerX ? 'right' : 'left';
        return { v, h };
    }, [buttonSize, viewportHeight, viewportWidth]);

    const getInitialPosition = useCallback(() => {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return { left: 0, top: 0 };
        }
        const minLeft = edgePadding + safeAreaInsets.left;
        const minTop = edgePadding + safeAreaInsets.top;
        const maxLeft = Math.max(minLeft, viewportWidth - buttonSize - edgePadding - safeAreaInsets.right);
        const maxTop = Math.max(minTop, viewportHeight - buttonSize - edgePadding - safeAreaInsets.bottom);
        // 默认位置往内偏移，不贴边
        const DEFAULT_INSET = Math.max(buttonSize, 48);
        if (initialPosition === 'bottom-right') return { left: maxLeft - DEFAULT_INSET, top: maxTop - DEFAULT_INSET };
        if (initialPosition === 'bottom-left') return { left: minLeft + DEFAULT_INSET, top: maxTop - DEFAULT_INSET };
        if (initialPosition === 'top-right') return { left: maxLeft - DEFAULT_INSET, top: minTop + DEFAULT_INSET };
        return { left: minLeft + DEFAULT_INSET, top: minTop + DEFAULT_INSET };
    }, [buttonSize, edgePadding, initialPosition, safeAreaInsets.bottom, safeAreaInsets.left, safeAreaInsets.right, safeAreaInsets.top, viewportHeight, viewportWidth]);

    // 加载保存的位置（支持百分比格式，兼容旧绝对坐标）
    useEffect(() => {
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return undefined;
        }
        const frameId = window.requestAnimationFrame(() => {
            try {
            const saved = localStorage.getItem('hud_fab_position');
            if (saved) {
                const parsed = JSON.parse(saved);
                let next: { left: number; top: number };
                
                // 检测是否为百分比格式
                if ('leftPercent' in parsed && 'topPercent' in parsed) {
                    next = {
                        left: parsed.leftPercent * viewportWidth,
                        top: parsed.topPercent * viewportHeight,
                    };
                } else {
                    // 旧格式：绝对坐标，转换为百分比后保存
                    next = parsed;
                    const percent = {
                        leftPercent: next.left / viewportWidth,
                        topPercent: next.top / viewportHeight,
                    };
                    localStorage.setItem('hud_fab_position', JSON.stringify(percent));
                }
                
                next = clampPosition(next, true);
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
                }, true);
                const percent = {
                    leftPercent: next.left / viewportWidth,
                    topPercent: next.top / viewportHeight,
                };
                localStorage.setItem('hud_fab_position', JSON.stringify(percent));
                localStorage.removeItem('hud_fab_offset');
                setFabPosition(next);
                setAlignment(getAlignmentForPosition(next));
                return;
            }

            const next = clampPosition(base, false);
            setFabPosition(next);
            setAlignment(getAlignmentForPosition(next));
        } catch (error) {
            logger.error('FabMenu: 加载悬浮球位置失败', { error });
        }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [clampPosition, getAlignmentForPosition, getInitialPosition, viewportHeight, viewportWidth]);

    const handleDragEnd = (_: any, info: any) => {
        if (!fabPosition || viewportWidth <= 0 || viewportHeight <= 0) return;
        setIsDragging(false);
        const next = clampPosition({
            left: fabPosition.left + info.offset.x,
            top: fabPosition.top + info.offset.y,
        }, true);
        setFabPosition(next);
        // 保存为百分比格式
        const percent = {
            leftPercent: next.left / viewportWidth,
            topPercent: next.top / viewportHeight,
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
        if (!fabPosition || viewportWidth <= 0 || viewportHeight <= 0) return;
        const handleResize = () => {
            // 从 localStorage 读取百分比，按新尺寸重新计算
            try {
                const saved = localStorage.getItem('hud_fab_position');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if ('leftPercent' in parsed && 'topPercent' in parsed) {
                        const next = clampPosition({
                            left: parsed.leftPercent * viewportWidth,
                            top: parsed.topPercent * viewportHeight,
                        }, true);
                        setFabPosition(next);
                        setAlignment(getAlignmentForPosition(next));
                        return;
                    }
                }
            } catch (error) {
                logger.error('FabMenu: 处理窗口缩放失败', { error });
            }
            // 降级：直接 clamp 当前位置
            const next = clampPosition(fabPosition, true);
            setFabPosition(next);
            setAlignment(getAlignmentForPosition(next));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampPosition, fabPosition, getAlignmentForPosition, viewportHeight, viewportWidth]);

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
                    fabPosition={fabPosition}
                    buttonSize={buttonSize}
                    buttonGap={buttonGap}
                    edgePadding={edgePadding}
                    safeAreaInsets={safeAreaInsets}
                    isMobileViewport={isMobileViewport}
                    viewportWidth={viewportWidth}
                    viewportHeight={viewportHeight}
                    tooltipPortalRoot={tooltipPortalRoot}
                    onRequestClose={() => {
                        setIsOpen(false);
                        setActiveItemId(null);
                    }}
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
                    buttonSize={buttonSize}
                    isMobileViewport={isMobileViewport}
                    viewportWidth={viewportWidth}
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
                glowColor={glowColor}
                isDragging={isDragging}
                fabPosition={fabPosition}
                buttonSize={buttonSize}
                buttonGap={buttonGap}
                edgePadding={edgePadding}
                safeAreaInsets={safeAreaInsets}
                isMobileViewport={isMobileViewport}
                viewportWidth={viewportWidth}
                viewportHeight={viewportHeight}
            />
        </motion.div>
    );
};

const SatelliteList = ({
    isOpen,
    items,
    activeId,
    onItemClick,
    alignment,
    isDark,
    tooltipPortalRoot,
    glowColor,
    isDragging,
    fabPosition,
    buttonSize,
    buttonGap,
    edgePadding,
    safeAreaInsets,
    isMobileViewport,
    viewportWidth,
    viewportHeight,
}: any) => {
    const isButtonBottom = alignment.v === 'bottom';
    const flexDirection = isButtonBottom ? 'flex-col-reverse' : 'flex-col';
    const alignItems = alignment.h === 'right' ? 'items-start' : 'items-end';
    const offset = buttonSize + buttonGap;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className={`absolute left-0 flex ${flexDirection} ${alignItems}`}
                    style={{
                        [isButtonBottom ? 'bottom' : 'top']: offset,
                        gap: isMobileViewport ? buttonGap : Math.max(buttonGap, 12),
                    }}
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
                                fabPosition={fabPosition}
                                buttonSize={buttonSize}
                                buttonGap={buttonGap}
                                edgePadding={edgePadding}
                                safeAreaInsets={safeAreaInsets}
                                isMobileViewport={isMobileViewport}
                                viewportWidth={viewportWidth}
                                viewportHeight={viewportHeight}
                                tooltipPortalRoot={tooltipPortalRoot}
                                onRequestClose={() => onItemClick(item)}
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
                                buttonSize={buttonSize}
                                isMobileViewport={isMobileViewport}
                                viewportWidth={viewportWidth}
                            />
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const Panel = ({
    item,
    isActive,
    alignment,
    isDark,
    fabPosition,
    buttonSize,
    buttonGap,
    edgePadding,
    safeAreaInsets,
    isMobileViewport,
    viewportWidth,
    viewportHeight,
    tooltipPortalRoot,
    onRequestClose,
}: any) => {
    const panelOffset = buttonSize + buttonGap;
    const isMobileSheetPanel = isMobileViewport && item.mobilePanelVariant === 'sheet';
    const panelWidth = isMobileViewport ? 260 : 300;
    const spaceRight = Math.max(
        0,
        Math.floor(viewportWidth - (fabPosition?.left ?? 0) - panelOffset - safeAreaInsets.right - edgePadding),
    );
    const spaceLeft = Math.max(
        0,
        Math.floor((fabPosition?.left ?? 0) - buttonGap - safeAreaInsets.left - edgePadding),
    );
    const spaceBelow = Math.max(
        0,
        Math.floor(viewportHeight - (fabPosition?.top ?? 0) - safeAreaInsets.bottom - edgePadding),
    );
    const spaceAbove = Math.max(
        0,
        Math.floor((fabPosition?.top ?? 0) + buttonSize - safeAreaInsets.top - edgePadding),
    );

    const horizontalPlacement: FabAlignment['h'] = isMobileViewport
        ? (spaceRight >= spaceLeft ? 'right' : 'left')
        : alignment.h;
    const verticalPlacement: FabAlignment['v'] = isMobileViewport
        ? (spaceBelow >= spaceAbove ? 'top' : 'bottom')
        : alignment.v;
    const verticalClass = verticalPlacement === 'top' ? 'top-0' : 'bottom-0';
    const safeAvailableWidth = horizontalPlacement === 'right' ? spaceRight : spaceLeft;
    const safeAvailableHeight = verticalPlacement === 'top' ? spaceBelow : spaceAbove;
    const resolvedPanelWidth = safeAvailableWidth > 0 ? Math.min(panelWidth, safeAvailableWidth) : panelWidth;
    const panelMaxWidth = safeAvailableWidth > 0 ? `${safeAvailableWidth}px` : undefined;
    const panelMaxHeight = safeAvailableHeight > 0 ? `${safeAvailableHeight}px` : undefined;
    const panelHeading = (
        <div className="mb-2 truncate border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-wider opacity-70">
            {item.label}
        </div>
    );

    if (isMobileSheetPanel) {
        const sheetHorizontalMargin = 12;
        const sheetBottomOffset = safeAreaInsets.bottom + 4;
        const availableSheetWidth = Math.max(
            0,
            viewportWidth - safeAreaInsets.left - safeAreaInsets.right - (sheetHorizontalMargin * 2),
        );
        const resolvedSheetWidth = Math.min(availableSheetWidth, 420);
        const resolvedSheetLeft = Math.max(
            safeAreaInsets.left + sheetHorizontalMargin,
            (viewportWidth - resolvedSheetWidth) / 2,
        );

        if (!isActive || !item.content || !tooltipPortalRoot) {
            return null;
        }

        return createPortal(
            <>
                <div
                    className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
                    style={{ zIndex: UI_Z_INDEX.modalOverlay }}
                    onClick={(event) => {
                        event.stopPropagation();
                        onRequestClose?.();
                    }}
                    data-testid={`fab-sheet-backdrop-${item.id}`}
                />
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.16 }}
                    className="fixed"
                    style={{
                        left: resolvedSheetLeft,
                        bottom: sheetBottomOffset,
                        width: resolvedSheetWidth > 0 ? resolvedSheetWidth : undefined,
                        zIndex: UI_Z_INDEX.modalContent,
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={item.label}
                    data-testid={`fab-sheet-${item.id}`}
                >
                    <div
                        className={`
                            overflow-hidden rounded-[22px] border shadow-2xl
                            ${isDark
                                ? 'border-white/10 bg-black/95 text-white shadow-black/70'
                                : 'border-[#d3ccba] bg-[#fcfbf9]/98 text-[#433422] shadow-[#433422]/20'}
                        `}
                        data-testid={`fab-panel-${item.id}`}
                    >
                        <div className="px-4 pt-4">
                            <div className="truncate border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-[0.22em] opacity-70">
                                {item.label}
                            </div>
                        </div>
                        <div className="px-3 pb-3 pt-3">
                            {item.content}
                        </div>
                    </div>
                </motion.div>
            </>,
            tooltipPortalRoot,
        );
    }

    return (
        <AnimatePresence>
            {isActive && item.content && (
                <motion.div
                    key="panel"
                    initial={{ opacity: 0, scale: 0.95, x: alignment.h === 'right' ? -10 : 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: alignment.h === 'right' ? -10 : 10 }}
                    className={`
                        absolute p-4 max-md:p-3 rounded-xl shadow-2xl backdrop-blur-xl border-l-[3px]
                        z-30
                        ${isDark ? "bg-black/95 border-white/20 border-l-neon-blue text-white" : "bg-[#fcfbf9]/95 border-[#d3ccba] border-l-[#8c7b64] text-[#433422]"}

                        ${verticalClass}

                        overflow-y-auto overflow-x-hidden custom-scrollbar
                    `}
                    style={{
                        width: resolvedPanelWidth,
                        maxWidth: panelMaxWidth,
                        maxHeight: panelMaxHeight,
                        minWidth: 0,
                        [horizontalPlacement === 'right' ? 'left' : 'right']: panelOffset,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    data-testid={`fab-panel-${item.id}`}
                >
                    {panelHeading}
                    {item.content}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const MenuButton = ({ item, onClick, isActive, isMain, isDark, alignment, tooltipPortalRoot, showGlow, glowColor, isDragging, buttonSize, isMobileViewport, viewportWidth }: any) => {
    const [isHovered, setIsHovered] = useState(false);
    const showTooltip = !isMobileViewport && isHovered && !isDragging && !(isActive && item.content);
    const showPreview = !isMobileViewport && Boolean(item.preview) && !isDragging && !isActive;
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
    const visualButtonSize = isMobileViewport ? Math.max(buttonSize - 4, 40) : buttonSize;

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
    const floatingMaxWidth = isMobileViewport ? 'min(220px, 56vw)' : 'min(360px, 70vw)';
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
                    bg-transparent border-0 p-0
                    transition-transform duration-300 hover:scale-105
                    cursor-pointer
                    z-20
                `}
                style={{
                    width: buttonSize,
                    height: buttonSize,
                    minWidth: buttonSize,
                    minHeight: buttonSize,
                }}
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
                                    data-testid={`fab-tooltip-${item.id}`}
                                    className={`
                                        pointer-events-none overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold
                                        ${isDark ? 'bg-black text-white border border-white/20 shadow-lg shadow-black/50' : 'bg-white text-[#433422] border border-[#d3ccba] shadow-xl'}
                                    `}
                                    style={{
                                        position: 'fixed',
                                        top: tooltipRect.top + tooltipRect.height / 2 + tooltipVerticalOffset,
                                        left: tooltipSide === 'right'
                                            ? tooltipRect.right + gap
                                            : undefined,
                                        right: tooltipSide === 'left'
                                            ? viewportWidth - tooltipRect.left + gap
                                            : undefined,
                                        transform: `translate(${tooltipSide === 'right' ? '0' : '-100%'}, -50%)`,
                                        zIndex: UI_Z_INDEX.tooltip,
                                        maxWidth: floatingMaxWidth,
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
                                    data-testid={`fab-preview-${item.id}`}
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
                                            ? viewportWidth - tooltipRect.left + gap
                                            : undefined,
                                        transform: `translate(${previewSide === 'right' ? '0' : '-100%'}, -50%)`,
                                        zIndex: UI_Z_INDEX.tooltip,
                                        maxWidth: floatingMaxWidth,
                                    }}
                                >
                                    {item.preview}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>,
                    tooltipPortalRoot
                )}

                {/* 移动端保留 44px 命中区，但缩小视觉圆球，避免遮挡主棋盘。 */}
                <div
                    data-fab-visual-id={item.id}
                    className={`
                        pointer-events-none flex items-center justify-center
                        rounded-full backdrop-blur-md border
                        ${activeStyle}
                        ${item.color || ''}
                        shadow-lg transition-shadow duration-300 hover:shadow-xl
                    `}
                    style={{
                        width: visualButtonSize,
                        height: visualButtonSize,
                    }}
                >
                    <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ transform: isMobileViewport ? 'scale(0.92)' : undefined }}
                    >
                        {item.icon}
                    </div>
                </div>
            </motion.button>
        </PulseGlow>
    );
};
