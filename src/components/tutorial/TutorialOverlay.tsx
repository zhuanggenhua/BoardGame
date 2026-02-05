import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTutorial } from '../../contexts/TutorialContext';

export const TutorialOverlay: React.FC = () => {
    const { isActive, currentStep, nextStep, isLastStep } = useTutorial();
    const stepNamespace = currentStep?.content?.includes(':')
        ? currentStep.content.split(':')[0]
        : undefined;
    const namespaces = stepNamespace ? ['tutorial', stepNamespace] : ['tutorial'];
    const { t } = useTranslation(namespaces);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const lastStepIdRef = useRef<string | null>(null);
    const hasAutoScrolledRef = useRef(false);
    const lastLogKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isActive || !currentStep) return;
        const stepId = currentStep.id ?? 'unknown';
        // 日志已移除：TutorialOverlay 步骤变化过于频繁
    }, [currentStep, isActive]);



    // 更新高亮位置
    useEffect(() => {
        if (!isActive || !currentStep) return;

        if (lastStepIdRef.current !== currentStep.id) {
            lastStepIdRef.current = currentStep.id;
            hasAutoScrolledRef.current = false;
        }

        let resizeObserver: ResizeObserver | null = null;

        const updateRect = () => {
            if (currentStep.highlightTarget) {
                const el = document.querySelector(`[data-tutorial-id="${currentStep.highlightTarget}"]`) ||
                    document.getElementById(currentStep.highlightTarget);

                if (el) {
                    const rect = el.getBoundingClientRect();
                    setTargetRect(rect);

                    if (!hasAutoScrolledRef.current) {
                        const inView = rect.top >= 0
                            && rect.left >= 0
                            && rect.bottom <= window.innerHeight
                            && rect.right <= window.innerWidth;
                        if (!inView) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        hasAutoScrolledRef.current = true;
                    }

                    if (!resizeObserver) {
                        resizeObserver = new ResizeObserver(() => updateRect());
                        resizeObserver.observe(el);
                    }
                } else {
                    setTargetRect(null);
                }
            } else {
                setTargetRect(null);
            }
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
            resizeObserver?.disconnect();
        };
    }, [isActive, currentStep]);

    // 提示框位置和箭头样式的状态
    const [tooltipStyles, setTooltipStyles] = useState<{
        style: React.CSSProperties,
        arrowClass: string
    }>({ style: {}, arrowClass: '' });

    // 根据目标矩形计算布局
    useEffect(() => {
        if (!targetRect) {
            // 默认：底部居中
            setTooltipStyles({
                style: {
                    position: 'fixed',
                    bottom: '10%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100
                },
                arrowClass: 'hidden'
            });
            return;
        }

        const padding = 12; // 目标与提示框间距
        const tooltipWidth = 280; // 估计宽度
        const tooltipHeight = 160; // 估计高度

        // 优先级逻辑：右 -> 左 -> 下 -> 上
        const spaceRight = window.innerWidth - targetRect.right;
        const spaceLeft = targetRect.left;
        const spaceBottom = window.innerHeight - targetRect.bottom;

        let pos: 'right' | 'left' | 'bottom' | 'top';

        if (spaceRight > tooltipWidth + 20) {
            pos = 'right';
        } else if (spaceLeft > tooltipWidth + 20) {
            pos = 'left';
        } else if (spaceBottom > tooltipHeight + 20) {
            pos = 'bottom';
        } else {
            pos = 'top';
        }

        // 计算具体坐标
        const styles: React.CSSProperties = {
            position: 'fixed',
            zIndex: 100,
        };
        let arrow = '';

        switch (pos) {
            case 'right':
                styles.left = targetRect.right + padding;
                styles.top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 3);
                arrow = '-left-[6px] top-[40px] border-b border-l'; // 左箭头指向右侧
                break;
            case 'left':
                styles.left = targetRect.left - tooltipWidth - padding;
                styles.top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 3);
                arrow = '-right-[6px] top-[40px] border-t border-r'; // 右箭头指向左侧
                break;
            case 'bottom':
                styles.top = targetRect.bottom + padding;
                styles.left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
                arrow = '-top-[6px] left-1/2 -translate-x-1/2 border-t border-l'; // 上箭头指向下侧
                break;
            case 'top':
                styles.top = targetRect.top - tooltipHeight - padding;
                styles.left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
                arrow = '-bottom-[6px] left-1/2 -translate-x-1/2 border-b border-r'; // 下箭头指向上侧
                break;
        }

        // 为旋转的方形箭头添加通用基础类
        const arrowBase = "bg-white w-4 h-4 absolute rotate-45 border-gray-100 z-0";
        setTooltipStyles({ style: styles, arrowClass: `${arrowBase} ${arrow}` });

    }, [targetRect]);

    if (!isActive || !currentStep) return null;

    // 在智能回合期间不显示遮罩层 - 让智能方静默移动
    if (currentStep.aiActions && currentStep.aiActions.length > 0) return null;



    // 矢量路径用于带孔洞的遮罩
    let maskPath = `M0 0 h${window.innerWidth} v${window.innerHeight} h-${window.innerWidth} z`;
    if (targetRect) {
        // 逆时针矩形用于创建挖空效果（偶奇填充规则）
        const { left, top, right, bottom } = targetRect;
        const p = 8;
        maskPath += ` M${left - p} ${top - p} v${(bottom - top) + p * 2} h${(right - left) + p * 2} v-${(bottom - top) + p * 2} z`;
    }

    const maskOpacity = currentStep.showMask ? 0.6 : 0;

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* 遮罩层 - 仅在遮罩开关为真时阻止点击 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300">
                <path
                    d={maskPath}
                    fill={`rgba(0, 0, 0, ${maskOpacity})`}
                    // 当遮罩透明时，允许所有点击穿透
                    // 当遮罩可见时，仍需要允许在“孔洞”区域点击
                    style={{ pointerEvents: currentStep.showMask ? 'auto' : 'none' }}
                    fillRule="evenodd"
                />
            </svg>

            {/* 目标高亮环（苹果风格蓝色光晕）- 目标存在时始终可见 */}
            {targetRect && (
                <div
                    className="absolute pointer-events-none transition-all duration-300"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                        borderRadius: '12px',
                        boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 12px rgba(59, 130, 246, 0.3)'
                    }}
                />
            )}

            {/* 提示框弹窗 */}
            <div
                className="pointer-events-auto transition-all duration-300 ease-out flex flex-col items-center absolute"
                style={tooltipStyles.style}
            >
                {/* 样式三角箭头 */}
                <div className={`absolute w-0 h-0 border-solid ${tooltipStyles.arrowClass}`} />

                {/* 内容卡片 */}
                <div className="bg-[#fcfbf9] rounded-sm shadow-[0_8px_30px_rgba(67,52,34,0.12)] p-5 border border-[#e5e0d0] max-w-sm w-72 animate-in fade-in zoom-in-95 duration-200 relative font-serif">
                    {/* 装饰性边角（右上）*/}
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-[#c0a080] opacity-40" />

                    <div className="text-[#433422] font-bold text-lg mb-4 leading-relaxed text-left">
                        {t(currentStep.content, { defaultValue: currentStep.content })}
                    </div>

                    {!currentStep.requireAction && (
                        <button
                            onClick={() => nextStep('manual')}
                            className="w-full py-2 bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold text-sm uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center text-center relative z-10 pointer-events-auto"
                        >
                            {isLastStep ? t('overlay.finish') : t('overlay.next')}
                        </button>
                    )}

                    {currentStep.requireAction && (
                        <div className="flex items-center gap-2 text-sm font-bold text-[#8c7b64] bg-[#f3f0e6]/50 p-2 border border-[#e5e0d0]/50 justify-center italic">
                            <span className="animate-pulse w-2 h-2 rounded-full bg-[#c0a080]"></span>
                            {t('overlay.clickToContinue')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
