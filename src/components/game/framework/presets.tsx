/**
 * UI 框架预设渲染函数
 * 
 * 提供开箱即用的默认样式，适合 UGC 和快速开发。
 * 成熟游戏可自定义 render 函数实现完全控制。
 */

import type { ReactNode } from 'react';
import type { PhaseInfo } from '../../../core/ui';

// ============================================================================
// PhaseIndicator 预设
// ============================================================================

export interface PhaseItemPresetOptions {
    /** 激活状态背景色 */
    activeBackground?: string;
    /** 激活状态文字色 */
    activeText?: string;
    /** 激活状态边框色 */
    activeBorder?: string;
    /** 非激活状态背景色 */
    inactiveBackground?: string;
    /** 非激活状态文字色 */
    inactiveText?: string;
    /** 非激活状态边框色 */
    inactiveBorder?: string;
}

const defaultPhaseItemOptions: Required<PhaseItemPresetOptions> = {
    activeBackground: 'bg-amber-600',
    activeText: 'text-white',
    activeBorder: 'border-amber-300',
    inactiveBackground: 'bg-black/40 hover:bg-slate-800',
    inactiveText: 'text-slate-500 hover:text-slate-300',
    inactiveBorder: 'border-slate-700',
};

/**
 * 创建阶段项渲染函数
 */
export function createPhaseItemRender(options: PhaseItemPresetOptions = {}) {
    const opts = { ...defaultPhaseItemOptions, ...options };

    return (phase: PhaseInfo, isActive: boolean): ReactNode => (
        <div
            className={`
                px-[0.8vw] py-[0.4vw] text-[0.8vw] font-bold rounded-r-[0.5vw]
                transition-[transform,background-color,color,box-shadow] duration-300
                border-l-[0.3vw] truncate
                ${isActive
                    ? `${opts.activeBackground} ${opts.activeText} ${opts.activeBorder} translate-x-[0.5vw] shadow-[0_0_1vw_rgba(245,158,11,0.5)]`
                    : `${opts.inactiveBackground} ${opts.inactiveText} ${opts.inactiveBorder}`}
            `}
        >
            {phase.label}
        </div>
    );
}

/** 默认阶段项渲染函数 */
export const defaultPhaseItemRender = createPhaseItemRender();

// ============================================================================
// PlayerPanel / ResourceBar 预设
// ============================================================================

export interface ResourceBarPresetOptions {
    /** 资源配置：key -> { max, gradient, labelColor, label } */
    resources?: Record<string, {
        max: number;
        gradient: string;
        labelColor: string;
        label: string;
    }>;
    /** 容器高度 */
    height?: string;
}

const defaultResourceConfig: Record<string, { max: number; gradient: string; labelColor: string; label: string }> = {
    health: {
        max: 100,
        gradient: 'from-red-900 to-red-600',
        labelColor: 'text-red-200/80',
        label: 'HP',
    },
    mana: {
        max: 100,
        gradient: 'from-blue-900 to-blue-600',
        labelColor: 'text-blue-200/80',
        label: 'MP',
    },
    energy: {
        max: 10,
        gradient: 'from-amber-800 to-amber-500',
        labelColor: 'text-amber-200/80',
        label: 'EP',
    },
    cp: {
        max: 6,
        gradient: 'from-amber-800 to-amber-500',
        labelColor: 'text-amber-200/80',
        label: 'CP',
    },
};

/**
 * 创建资源条渲染函数
 */
export function createResourceBarRender(options: ResourceBarPresetOptions = {}) {
    const resourceConfig = { ...defaultResourceConfig, ...options.resources };
    const height = options.height ?? 'h-[1.8vw]';

    return (key: string, value: number): ReactNode => {
        const config = resourceConfig[key];
        if (!config) {
            // 未配置的资源使用简单显示
            return (
                <div className={`relative w-full ${height} bg-black/50 rounded-full border border-white/10 overflow-hidden`}>
                    <div className="absolute inset-0 flex items-center justify-between px-[0.8vw]">
                        <span className="text-[0.8vw] font-bold text-slate-400 tracking-wider">{key}</span>
                        <span className="text-[1.1vw] font-black text-white drop-shadow-md">{value}</span>
                    </div>
                </div>
            );
        }

        const percentage = Math.min(100, (value / config.max) * 100);

        return (
            <div className={`relative w-full ${height} bg-black/50 rounded-full border border-white/10 overflow-hidden`}>
                <div
                    className={`absolute top-0 bottom-0 left-0 bg-gradient-to-r ${config.gradient} transition-[width] duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-[0.8vw]">
                    <span className={`text-[0.8vw] font-bold ${config.labelColor} tracking-wider`}>
                        {config.label}
                    </span>
                    <span className="text-[1.1vw] font-black text-white drop-shadow-md">{value}</span>
                </div>
            </div>
        );
    };
}

/** 默认资源条渲染函数 */
export const defaultResourceBarRender = createResourceBarRender();

// ============================================================================
// PlayerPanel 容器预设
// ============================================================================

export interface PlayerPanelPresetOptions {
    /** 面板样式 */
    panelClassName?: string;
}

/** 默认玩家面板容器样式 */
export const defaultPlayerPanelClassName = 
    'flex flex-col gap-[0.8vw] w-full bg-slate-900/80 p-[0.8vw] rounded-[0.8vw] border border-slate-600/50 shadow-xl backdrop-blur-md';

// ============================================================================
// SpotlightSkeleton 预设
// ============================================================================

export interface SpotlightPresetOptions {
    /** 背景遮罩样式 */
    backdropClassName?: string;
    /** 内容容器样式 */
    containerClassName?: string;
}

/** 默认 Spotlight 背景样式 */
export const defaultSpotlightBackdrop = 'bg-black/60 backdrop-blur-sm';

/** 默认 Spotlight 容器样式 */
export const defaultSpotlightContainer = 'flex flex-col items-center gap-[2vw]';

// ============================================================================
// 状态效果预设
// ============================================================================

export interface StatusEffectPresetOptions {
    /** 图标大小 */
    iconSize?: string;
}

/**
 * 创建状态效果渲染函数
 */
export function createStatusEffectRender(options: StatusEffectPresetOptions = {}) {
    const iconSize = options.iconSize ?? 'w-[1.5vw] h-[1.5vw]';

    return (effectId: string, stacks: number): ReactNode => (
        <div className="flex items-center gap-[0.3vw] bg-black/40 px-[0.4vw] py-[0.2vw] rounded">
            <span className={`${iconSize} flex items-center justify-center bg-slate-700 rounded text-[0.6vw]`}>
                {effectId.charAt(0).toUpperCase()}
            </span>
            {stacks > 1 && (
                <span className="text-[0.7vw] font-bold text-white">×{stacks}</span>
            )}
        </div>
    );
}

/** 默认状态效果渲染函数 */
export const defaultStatusEffectRender = createStatusEffectRender();
