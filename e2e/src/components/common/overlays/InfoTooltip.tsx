import React from 'react';
import { UI_Z_INDEX } from '../../../core';

interface InfoTooltipProps {
    title: React.ReactNode;
    content: React.ReactNode[];
    isVisible: boolean;
    position?: 'right' | 'left';
    className?: string; // 额外样式
    /** 自定义 z-index，弹窗内使用时传入 UI_Z_INDEX.modalTooltip */
    zIndex?: number;
}

/**
 * 通用信息气泡组件
 *用于显示详情、规则提示等
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
    title,
    content,
    isVisible,
    position = 'right',
    className = '',
    zIndex,
}) => {
    if (!isVisible) return null;

    return (
        <div
            className={`
                absolute top-0 w-max max-w-[12vw] 
                bg-slate-900/95 border border-amber-500/30 rounded-[0.5vw] p-[0.8vw] 
                shadow-[0_0_1vw_rgba(0,0,0,0.5)] backdrop-blur-xl 
                animate-in fade-in slide-in-from-left-[0.5vw] duration-200
                pointer-events-none origin-left
                ${position === 'right' ? 'left-full ml-[0.8vw]' : 'right-full mr-[0.8vw]'}
                ${className}
            `}
            style={{ zIndex: zIndex ?? UI_Z_INDEX.tooltip }}
        >
            {/* 箭头 */}
            <div
                className={`
                    absolute top-[0.6vw] w-[0.6vw] h-[0.6vw] bg-slate-900 
                    border-l border-b border-amber-500/30 transform rotate-45
                    ${position === 'right' ? '-left-[0.35vw]' : '-right-[0.35vw] border-r border-t border-l-0 border-b-0'}
                `}
            />

            {/* 标题 */}
            <div className="text-amber-400 font-bold text-[0.9vw] mb-[0.4vw] pb-[0.2vw] border-b border-white/10 leading-tight">
                {title}
            </div>

            {/* 内容列表 */}
            <div className="flex flex-col gap-[0.2vw]">
                {content.map((line, i) => (
                    <div key={i} className="text-[0.7vw] text-slate-300 flex items-start leading-snug">
                        <span className="mr-[0.4vw] text-amber-500">•</span>
                        <span>{line}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
