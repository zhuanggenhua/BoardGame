import React from 'react';
import { LoadingScreen } from '../../system/LoadingScreen';

export interface TutorialSelectionGateProps {
    /** 是否处于教程模式（路由级） */
    isTutorialMode?: boolean;
    /** 教程是否激活（状态级） */
    isTutorialActive?: boolean;
    /** 加载提示文案 */
    loadingText?: string;
    /** 容器样式（背景/层级等） */
    containerClassName?: string;
    /** 文案样式 */
    textClassName?: string;
    /** 选角/选阵营界面 */
    children: React.ReactNode;
}

/**
 * 教程模式下屏蔽选角/选阵营界面，避免进入时闪屏。
 * 非教程模式直接渲染 children。
 */
export const TutorialSelectionGate: React.FC<TutorialSelectionGateProps> = ({
    isTutorialMode,
    isTutorialActive,
    loadingText = '教程初始化中',
    containerClassName,
    textClassName,
    children,
}) => {
    if (isTutorialMode || isTutorialActive) {
        return (
            <LoadingScreen
                anchor="container"
                description={loadingText}
                className={containerClassName}
                descriptionClassName={textClassName}
            />
        );
    }

    return <>{children}</>;
};
