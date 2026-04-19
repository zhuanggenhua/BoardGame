import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LoadingArcaneAether } from './LoadingVariants';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { UI_Z_INDEX } from '../../core';

// 全局计数器：追踪当前存活的 LoadingScreen 实例数
let globalLoadingScreenCount = 0;
// 全局标记：标识本次会话是否已经播放过入场动画
let hasPlayedEntryAnimation = false;

interface LoadingScreenProps {
    title?: string;
    description?: string;
    progressText?: string;
    fullScreen?: boolean;
    anchor?: 'viewport' | 'container';
    className?: string;
    titleClassName?: string;
    descriptionClassName?: string;
}

/**
 * 统一的全局/局部加载屏幕
 * 接入了 "Qualified Arcane" (LoadingArcaneAether) 高级动画
 * 
 * 优化：连续切换加载阶段时，动画不重复播放，只变文本
 */
export const LoadingScreen = ({
    title,
    description,
    progressText,
    fullScreen = true,
    anchor = 'viewport',
    className,
    titleClassName,
    descriptionClassName
}: LoadingScreenProps) => {
    const { t } = useTranslation('lobby');
    
    // 追踪本实例是否应该播放入场动画
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const mountedRef = useRef(false);

    useEffect(() => {
        // 挂载时：增加计数
        globalLoadingScreenCount++;
        
        // LoadingScreen 挂载时移除 index.html 的静态占位，避免两个 loading 同时出现
        const initialLoader = document.getElementById('initial-loader');
        if (initialLoader) {
            initialLoader.remove();
        }

        // 判断是否需要播放动画：
        // 1. 如果之前没有 LoadingScreen 存活（计数为1，即当前是唯一一个）
        // 2. 且本次会话还没播放过入场动画
        // 则播放动画
        if (globalLoadingScreenCount === 1 && !hasPlayedEntryAnimation) {
            setShouldAnimate(true);
            hasPlayedEntryAnimation = true;
        } else {
            // 否则跳过动画，直接显示
            setShouldAnimate(false);
        }
        
        mountedRef.current = true;

        return () => {
            // 卸载时：减少计数
            globalLoadingScreenCount--;
            
            // 当所有 LoadingScreen 都卸载后，重置动画标记
            // 这样下次再显示加载屏幕时会重新播放动画
            if (globalLoadingScreenCount === 0) {
                // 延迟重置，避免快速切换时立即重置
                setTimeout(() => {
                    if (globalLoadingScreenCount === 0) {
                        hasPlayedEntryAnimation = false;
                    }
                }, 500);
            }
        };
    }, []);

    // 动画变体配置
    const containerVariants = shouldAnimate
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    
    const textVariants = shouldAnimate
        ? { initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 } }
        : { initial: { y: 0, opacity: 1 }, animate: { y: 0, opacity: 1 } };
    
    const decorVariants = shouldAnimate
        ? { initial: { scaleX: 0, opacity: 0 }, animate: { scaleX: 1, opacity: 0.3 } }
        : { initial: { scaleX: 1, opacity: 0.3 }, animate: { scaleX: 1, opacity: 0.3 } };
    const isViewportAnchor = anchor === 'viewport';
    const layoutClassName = fullScreen
        ? (isViewportAnchor
            ? 'fixed inset-0 h-[var(--runtime-viewport-height,100vh)] w-[var(--runtime-viewport-width,100vw)]'
            : 'absolute inset-0 h-full w-full max-h-full max-w-full')
        : 'relative h-full w-full min-h-0';

    return (
        <AnimatePresence>
            <motion.div
                initial={containerVariants.initial}
                animate={containerVariants.animate}
                exit={containerVariants.exit}
                data-testid="loading-screen"
                data-loading-anchor={anchor}
                className={clsx(
                    // 关键：不再用 flex-column 居中承载“动画 + 文本”，避免文本高度变化影响动画视觉中心
                    "bg-black overflow-hidden",
                    layoutClassName,
                    className
                )}
                style={{ zIndex: UI_Z_INDEX.loading }}
            >
                {/* 核心法阵动画：始终视觉居中（不受文本高度影响） */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative transform scale-75 md:scale-100">
                        <LoadingArcaneAether />

                        {/* 额外的底层氛围发光 */}
                        <motion.div
                            className="absolute inset-0 bg-amber-500/10 rounded-full blur-[60px] -z-10"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                </div>

                {/* 文本提示区：固定到底部，给容差；不参与垂直居中计算 */}
                <div className="absolute left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] flex flex-col items-center text-center px-6">
                    <div className="w-full max-w-sm min-h-[96px] flex flex-col items-center">
                        {title && (
                            <motion.h2
                                key={title}
                                initial={textVariants.initial}
                                animate={textVariants.animate}
                                transition={shouldAnimate ? { delay: 0.2 } : { duration: 0.3 }}
                                className={clsx(
                                    "text-amber-500 font-bold text-lg md:text-xl tracking-[0.2em] uppercase mb-2 line-clamp-1",
                                    titleClassName
                                )}
                            >
                                {title}
                            </motion.h2>
                        )}

                        <motion.p
                            key={description || 'default'}
                            initial={textVariants.initial}
                            animate={textVariants.animate}
                            transition={shouldAnimate ? { delay: 0.3 } : { duration: 0.3 }}
                            className={clsx(
                                "text-amber-200/60 text-xs md:text-sm font-serif tracking-widest leading-relaxed line-clamp-2",
                                descriptionClassName
                            )}
                            >
                                {description || t('matchRoom.loadingResources')}
                            </motion.p>
                        {progressText && (
                            <motion.p
                                key={`progress:${progressText}`}
                                initial={textVariants.initial}
                                animate={textVariants.animate}
                                transition={shouldAnimate ? { delay: 0.35 } : { duration: 0.3 }}
                                data-testid="loading-screen-progress"
                                className="mt-3 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-[0.24em] text-amber-300/85 md:text-xs"
                            >
                                {progressText}
                            </motion.p>
                        )}
                    </div>
                </div>

                {/* 底部装饰线 */}
                <motion.div
                    initial={decorVariants.initial}
                    animate={decorVariants.animate}
                    transition={shouldAnimate ? { delay: 0.5, duration: 1 } : { duration: 0 }}
                    className="absolute bottom-[calc(env(safe-area-inset-bottom)+3rem)] left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                />
            </motion.div>
        </AnimatePresence>
    );
};

export default LoadingScreen;
