/**
 * 大杀四方（Smash Up）专属设置：英文卡图中文覆盖层开关
 *
 * 背景：目前英文版大杀四方使用来自 TTS Mod 的原版卡图，
 * 没有高质量的中文本地化版卡图。因此在英文语言环境下，
 * 会在英文原版卡图上方叠加显示中文名称和能力说明。
 *
 * 本设置允许玩家自行决定是否显示此覆盖层：
 * - 中文玩家：开启（默认）
 * - 外文玩家：可关闭，直接看英文原版卡图
 *
 * 持久化：localStorage（浏览器本地永久保存，刷新/关闭后仍有效）
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const LS_KEY = 'smashup_overlay_zh_enabled';

function readLSValue(): boolean {
    try {
        const stored = localStorage.getItem(LS_KEY);
        // 如果用户从没设置过，则默认为 true（中文玩家友好配置）
        return stored === null ? true : stored === 'true';
    } catch {
        return true;
    }
}

interface SmashUpOverlayContextValue {
    /** 是否开启英文卡图上的中文覆盖层 */
    overlayEnabled: boolean;
    /** 切换开关 */
    toggleOverlay: () => void;
}

const SmashUpOverlayContext = createContext<SmashUpOverlayContextValue>({
    overlayEnabled: true,
    toggleOverlay: () => undefined,
});

/** 在大杀四方 Board 顶层包裹这个 Provider */
export function SmashUpOverlayProvider({ children }: { children: React.ReactNode }) {
    const [overlayEnabled, setOverlayEnabled] = useState<boolean>(() => readLSValue());

    const toggleOverlay = useCallback(() => {
        setOverlayEnabled(prev => {
            const next = !prev;
            try {
                localStorage.setItem(LS_KEY, String(next));
            } catch {
                // 忽略隐私模式下 localStorage 不可用
            }
            return next;
        });
    }, []);

    return (
        <SmashUpOverlayContext.Provider value={{ overlayEnabled, toggleOverlay }}>
            {children}
        </SmashUpOverlayContext.Provider>
    );
}

/** 在子组件中消费此 Context */
export function useSmashUpOverlay() {
    return useContext(SmashUpOverlayContext);
}
