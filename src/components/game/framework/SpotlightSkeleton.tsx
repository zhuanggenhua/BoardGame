/**
 * 特写骨架组件
 *
 * 用于中心展示重要内容（骰子结果、卡牌打出、技能激活等）。
 * 支持自动/手动关闭和入场/出场动画。
 */

import { memo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { SpotlightSkeletonProps } from './types';

/**
 * 特写骨架
 *
 * @example
 * ```tsx
 * // 自动关闭（骰子结果）
 * <SpotlightSkeleton
 *   isVisible={showDie}
 *   onClose={() => setShowDie(false)}
 *   autoCloseDelay={3000}
 *   title="额外骰子"
 *   description="太极效果触发"
 * >
 *   <Die3D value={dieValue} />
 * </SpotlightSkeleton>
 *
 * // 手动关闭（卡牌特写）
 * <SpotlightSkeleton
 *   isVisible={showCard}
 *   onClose={() => setShowCard(false)}
 *   closeOnBackdrop
 *   showCloseButton
 * >
 *   <CardPreview card={card} />
 * </SpotlightSkeleton>
 * ```
 */
export const SpotlightSkeleton = memo(function SpotlightSkeleton({
    isVisible,
    onClose,
    autoCloseDelay,
    title,
    description,
    children,
    enterAnimation,
    exitAnimation,
    backdropClassName,
    containerClassName,
    closeOnBackdrop = false,
    showCloseButton = false,
    renderCloseButton,
    confirmButtonDelay,
    renderConfirmButton,
}: SpotlightSkeletonProps) {
    const { t } = useTranslation('common');
    // 淡出状态（用于出场动画）
    const [isExiting, setIsExiting] = useState(false);
    // 内容是否已准备好显示
    const [isContentReady, setIsContentReady] = useState(false);
    // 确认按钮是否可见
    const [isConfirmButtonVisible, setIsConfirmButtonVisible] = useState(false);

    // 计算动画时长
    const enterDuration = enterAnimation?.duration ?? 300;
    const exitDuration = exitAnimation?.duration ?? 200;

    // 处理关闭（带出场动画）
    const handleClose = useCallback(() => {
        if (isExiting) return;
        setIsExiting(true);
        setTimeout(() => {
            setIsExiting(false);
            setIsContentReady(false);
            onClose();
        }, exitDuration);
    }, [isExiting, exitDuration, onClose]);

    // 处理背景点击
    const handleBackdropClick = useCallback(() => {
        if (closeOnBackdrop) {
            handleClose();
        }
    }, [closeOnBackdrop, handleClose]);

    // 自动关闭计时器
    useEffect(() => {
        if (!isVisible || !autoCloseDelay) return;

        const timer = setTimeout(() => {
            handleClose();
        }, autoCloseDelay);

        return () => clearTimeout(timer);
    }, [isVisible, autoCloseDelay, handleClose]);

    // 入场动画延迟
    useEffect(() => {
        if (!isVisible) {
            setIsContentReady(false);
            setIsConfirmButtonVisible(false);
            return;
        }

        // 短暂延迟后显示内容，确保入场动画生效
        const timer = setTimeout(() => {
            setIsContentReady(true);
        }, 50);

        return () => clearTimeout(timer);
    }, [isVisible]);

    // 确认按钮延迟显示
    useEffect(() => {
        if (!isVisible || confirmButtonDelay === undefined) {
            setIsConfirmButtonVisible(false);
            return;
        }

        const timer = setTimeout(() => {
            setIsConfirmButtonVisible(true);
        }, confirmButtonDelay);

        return () => clearTimeout(timer);
    }, [isVisible, confirmButtonDelay]);

    // 不可见时不渲染
    if (!isVisible && !isExiting) {
        return null;
    }

    // 默认关闭按钮渲染
    const defaultCloseButton = (close: () => void) => (
        <button
            onClick={close}
            aria-label={t('button.close')}
            style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
            }}
        >
            ✕
        </button>
    );

    return (
        <div
            data-spotlight="root"
            data-visible={isVisible}
            data-exiting={isExiting}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: isExiting ? 'none' : 'auto',
            }}
            role="dialog"
            aria-modal="true"
        >
            {/* 背景遮罩 */}
            <div
                data-spotlight="backdrop"
                className={backdropClassName}
                onClick={handleBackdropClick}
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: isExiting ? 0 : 1,
                    transition: `opacity ${exitDuration}ms ease-out`,
                }}
            />

            {/* 内容容器 */}
            <div
                data-spotlight="container"
                className={containerClassName}
                style={{
                    position: 'relative',
                    opacity: isContentReady && !isExiting ? 1 : 0,
                    transform: isContentReady && !isExiting ? 'scale(1)' : 'scale(0.95)',
                    transition: isExiting
                        ? `opacity ${exitDuration}ms ease-out, transform ${exitDuration}ms ease-out`
                        : `opacity ${enterDuration}ms ease-out, transform ${enterDuration}ms ease-out`,
                }}
            >
                {/* 标题 */}
                {title && (
                    <div data-spotlight="title">
                        {title}
                    </div>
                )}

                {/* 主要内容 */}
                <div data-spotlight="content">
                    {children}
                </div>

                {/* 描述 */}
                {description && (
                    <div data-spotlight="description">
                        {description}
                    </div>
                )}

                {/* 确认按钮（延迟显示，位于描述下方） */}
                {confirmButtonDelay !== undefined && isConfirmButtonVisible && renderConfirmButton && (
                    <div data-spotlight="confirm-button">
                        {renderConfirmButton(handleClose)}
                    </div>
                )}

                {/* 关闭按钮 */}
                {showCloseButton && (
                    renderCloseButton
                        ? renderCloseButton(handleClose)
                        : defaultCloseButton(handleClose)
                )}
            </div>
        </div>
    );
});

export default SpotlightSkeleton;
