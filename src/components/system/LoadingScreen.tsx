import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LoadingArcaneAether } from './LoadingVariants';
import clsx from 'clsx';

interface LoadingScreenProps {
    title?: string;
    description?: string;
    fullScreen?: boolean;
    className?: string;
}

/**
 * 统一的全局/局部加载屏幕
 * 接入了 "Qualified Arcane" (LoadingArcaneAether) 高级动画
 */
export const LoadingScreen = ({
    title,
    description,
    fullScreen = true,
    className
}: LoadingScreenProps) => {
    const { t } = useTranslation('lobby');

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={clsx(
                    "flex flex-col items-center justify-center bg-black z-[9999]",
                    fullScreen ? "fixed inset-0 w-screen h-screen" : "relative w-full h-full min-h-[400px]",
                    className
                )}
            >
                {/* 核心法阵动画 */}
                <div className="relative mb-8 transform scale-75 md:scale-100">
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

                {/* 文本提示区 */}
                <div className="flex flex-col items-center text-center px-6 max-w-sm">
                    {title && (
                        <motion.h2
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-amber-500 font-bold text-lg md:text-xl tracking-[0.2em] uppercase mb-2"
                        >
                            {title}
                        </motion.h2>
                    )}

                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-amber-200/60 text-xs md:text-sm font-serif tracking-widest leading-relaxed line-clamp-2"
                    >
                        {description || t('matchRoom.loadingResources')}
                    </motion.p>
                </div>

                {/* 底部装饰线 */}
                <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 0.3 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="absolute bottom-12 w-32 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                />
            </motion.div>
        </AnimatePresence>
    );
};

export default LoadingScreen;
