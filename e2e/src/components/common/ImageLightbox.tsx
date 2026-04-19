import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UI_Z_INDEX } from '../../core';

interface ImageLightboxProps {
    src: string | null;
    alt?: string;
    onClose: () => void;
}

/**
 * 通用图片灯箱组件 — 点击图片全屏预览，点击遮罩或按 Esc 关闭。
 * 用法：维护一个 `previewSrc` state，传入 src 即可。
 */
export default function ImageLightbox({ src, alt = '预览', onClose }: ImageLightboxProps) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (!src) return;
        document.addEventListener('keydown', handleKeyDown);
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [src, handleKeyDown]);

    return (
        <AnimatePresence>
            {src && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
                    style={{ zIndex: UI_Z_INDEX.magnify }}
                    onClick={onClose}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        aria-label="关闭预览"
                    >
                        <X size={20} />
                    </button>
                    <motion.img
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        src={src}
                        alt={alt}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
