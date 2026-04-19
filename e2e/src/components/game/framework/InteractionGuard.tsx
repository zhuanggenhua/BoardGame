/**
 * 交互拦截守卫（播放 denied 音效 + 节流）
 *
 * 用于全局与组件级的"无效交互"反馈，不改动业务逻辑。
 */
/* eslint-disable react-refresh/only-export-components -- framework util exports factory + component together */

import React, { createContext, useContext, useMemo } from 'react';
import { playDeniedSoundLazy } from '../../../lib/audio/playDeniedSoundLazy';

export const DEFAULT_INTERACTION_GUARD_THROTTLE_MS = 400;

export interface InteractionDeniedOptions {
    /** 节流 key（相同 key 会被合并节流） */
    key?: string;
    /** 覆盖默认节流时间 */
    throttleMs?: number;
}

export interface InteractionGuardController {
    notifyDenied: (reason?: string, options?: InteractionDeniedOptions) => void;
    guardInteraction: (allowed: boolean, reason?: string, options?: InteractionDeniedOptions) => boolean;
}

export function createInteractionGuardController(options?: {
    throttleMs?: number;
    onDenied?: () => void;
}): InteractionGuardController {
    const throttleMs = options?.throttleMs ?? DEFAULT_INTERACTION_GUARD_THROTTLE_MS;
    const onDenied = options?.onDenied ?? playDeniedSoundLazy;
    const lastPlayedRef = new Map<string, number>();

    const notifyDenied = (reason?: string, notifyOptions?: InteractionDeniedOptions) => {
        const key = notifyOptions?.key ?? reason ?? 'interaction-denied';
        const effectiveThrottle = notifyOptions?.throttleMs ?? throttleMs;
        const now = Date.now();
        const lastPlayed = lastPlayedRef.get(key);
        if (lastPlayed !== undefined && now - lastPlayed < effectiveThrottle) return;
        lastPlayedRef.set(key, now);
        onDenied();
    };

    const guardInteraction = (allowed: boolean, reason?: string, notifyOptions?: InteractionDeniedOptions) => {
        if (allowed) return true;
        notifyDenied(reason, notifyOptions);
        return false;
    };

    return { notifyDenied, guardInteraction };
}

const InteractionGuardContext = createContext<InteractionGuardController>({
    notifyDenied: () => undefined,
    guardInteraction: (allowed: boolean) => allowed,
});

export const InteractionGuardProvider: React.FC<{
    children: React.ReactNode;
    throttleMs?: number;
}> = ({ children, throttleMs }) => {
    const value = useMemo(() => createInteractionGuardController({ throttleMs }), [throttleMs]);

    return (
        <InteractionGuardContext.Provider value={value}>
            {children}
        </InteractionGuardContext.Provider>
    );
};

export const useInteractionGuard = (): InteractionGuardController => {
    return useContext(InteractionGuardContext);
};
