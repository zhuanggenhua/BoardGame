/**
 * Cardia 卡牌翻转动画组件
 * 
 * 实现 3D 翻转效果，从暗牌翻转为明牌
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface CardFlipProps {
    /** 是否显示正面（明牌） */
    showFront: boolean;
    /** 正面内容 */
    frontContent: React.ReactNode;
    /** 背面内容 */
    backContent: React.ReactNode;
    /** 翻转动画时长（秒） */
    duration?: number;
    /** 是否启用翻转动画（首次渲染时可能不需要动画） */
    enableAnimation?: boolean;
}

/**
 * 卡牌翻转动画组件
 * 
 * 使用 CSS 3D transform 实现翻转效果：
 * - 沿 Y 轴旋转 180 度
 * - 背面和正面分别渲染，通过 rotateY 控制显示
 * - 使用 backface-visibility: hidden 隐藏背面
 */
export const CardFlip: React.FC<CardFlipProps> = ({
    showFront,
    frontContent,
    backContent,
    duration = 0.6,
    enableAnimation = true,
}) => {
    // 追踪是否是首次渲染
    const [isInitialRender, setIsInitialRender] = useState(true);

    useEffect(() => {
        // 首次渲染后标记为非初始状态
        if (isInitialRender) {
            setIsInitialRender(false);
        }
    }, [isInitialRender]);

    // 如果是首次渲染且不启用动画，直接显示目标状态
    const shouldAnimate = enableAnimation && !isInitialRender;

    return (
        <div style={{ perspective: '1000px' }}>
            <motion.div
                style={{ transformStyle: 'preserve-3d' }}
                animate={{
                    rotateY: showFront ? 180 : 0,
                }}
                transition={{
                    duration: shouldAnimate ? duration : 0,
                    ease: 'easeInOut',
                }}
            >
                {/* 背面（暗牌） */}
                <div
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    {backContent}
                </div>

                {/* 正面（明牌） - 使用绝对定位叠加在背面上 */}
                <div
                    className="absolute inset-0"
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    {frontContent}
                </div>
            </motion.div>
        </div>
    );
};
