/**
 * Token 自动刷新 Hook
 * 
 * 在 token 即将过期前自动刷新，避免用户挂机后需要重新登录
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_API_URL } from '../config/server';

// 提前刷新时间（提前1天刷新）
const REFRESH_BEFORE_MS = 24 * 60 * 60 * 1000;
// setTimeout 最大安全延迟（2^31 - 1 ms ≈ 24.8 天），超过会溢出为 0 导致立即执行
const MAX_TIMEOUT_MS = 2147483647;
// 刷新失败重试间隔（5 分钟）
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

interface TokenPayload {
    userId: string;
    username: string;
    iat: number; // issued at (秒)
    exp: number; // expires at (秒)
}

function decodeBase64Url(value: string): string | null {
    try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padding = normalized.length % 4 === 0
            ? ''
            : '='.repeat(4 - (normalized.length % 4));
        const binary = atob(normalized + padding);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

/**
 * 解析 JWT token 获取过期时间
 */
export function parseToken(token: string): TokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadText = decodeBase64Url(parts[1]);
        if (!payloadText) return null;
        const payload = JSON.parse(payloadText);
        return payload;
    } catch {
        return null;
    }
}

/**
 * 计算距离过期还有多久（毫秒）
 */
export function getTimeUntilExpiry(token: string): number | null {
    const payload = parseToken(token);
    if (!payload?.exp) return null;
    const expiryMs = payload.exp * 1000;
    return expiryMs - Date.now();
}

/**
 * 获取当前最新的 token（优先 localStorage，避免闭包捕获旧值）
 */
function getCurrentToken(): string | null {
    return localStorage.getItem('auth_token');
}

/**
 * 刷新 token
 * 使用后端的 /auth/refresh 接口（基于 refresh_token cookie）
 */
async function refreshToken(): Promise<string | null> {
    try {
        const response = await fetch(`${AUTH_API_URL}/refresh`, {
            method: 'POST',
            credentials: 'include', // 携带 refresh_token cookie
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (!data.success || !data.data?.token) return null;
        
        return data.data.token;
    } catch {
        return null;
    }
}

export function useTokenRefresh() {
    const { token, setTokenDirect, logout } = useAuth();
    const timerRef = useRef<number | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    /**
     * 处理刷新成功：更新 localStorage + React state
     */
    const handleRefreshSuccess = useCallback((newToken: string) => {
        console.log('[TokenRefresh] Token 刷新成功');
        localStorage.setItem('auth_token', newToken);
        // 同步更新 React state，触发 effect 重新调度
        setTokenDirect(newToken);
    }, [setTokenDirect]);

    useEffect(() => {
        if (!token) {
            clearTimer();
            return;
        }

        const scheduleRefresh = () => {
            // 每次调度时读最新 token，避免闭包捕获旧值
            const currentToken = getCurrentToken();
            if (!currentToken) return;

            const timeUntilExpiry = getTimeUntilExpiry(currentToken);
            
            if (timeUntilExpiry === null) {
                console.warn('[TokenRefresh] 无法解析 token 过期时间');
                return;
            }

            // 已过期，退出登录
            if (timeUntilExpiry <= 0) {
                console.log('[TokenRefresh] Token 已过期，退出登录');
                logout();
                return;
            }

            // 计算刷新时机
            const refreshIn = Math.max(0, timeUntilExpiry - REFRESH_BEFORE_MS);
            
            console.log(`[TokenRefresh] 将在 ${Math.round(refreshIn / 1000 / 60)} 分钟后刷新 token`);

            // setTimeout 延迟超过 2^31-1 ms 会溢出为 0，需要分段等待
            if (refreshIn > MAX_TIMEOUT_MS) {
                console.log('[TokenRefresh] 延迟超过 setTimeout 上限，分段等待');
                timerRef.current = window.setTimeout(() => {
                    scheduleRefresh(); // 重新计算剩余时间
                }, MAX_TIMEOUT_MS);
                return;
            }

            timerRef.current = window.setTimeout(async () => {
                console.log('[TokenRefresh] 开始刷新 token');
                const newToken = await refreshToken();
                
                if (newToken) {
                    handleRefreshSuccess(newToken);
                    // handleRefreshSuccess 更新了 token state，effect 会重新触发 scheduleRefresh
                } else {
                    // 刷新失败：检查 token 是否仍然有效
                    const latestToken = getCurrentToken();
                    const remaining = latestToken ? getTimeUntilExpiry(latestToken) : null;
                    if (remaining !== null && remaining > 0) {
                        console.warn('[TokenRefresh] Token 刷新失败，但 token 未过期，稍后重试');
                        timerRef.current = window.setTimeout(() => scheduleRefresh(), RETRY_INTERVAL_MS);
                    } else {
                        console.error('[TokenRefresh] Token 刷新失败且已过期，退出登录');
                        console.error('[TokenRefresh] 可能原因：服务器 JWT_SECRET 变化、token 被截断、时钟不同步');
                        logout();
                    }
                }
            }, refreshIn);
        };

        scheduleRefresh();

        // 监听 visibilitychange，页面恢复可见时检查 token 是否需要刷新
        const handleVisibilityChange = () => {
            if (document.hidden) return;
            
            // 读最新 token，避免闭包捕获旧值
            const currentToken = getCurrentToken();
            if (!currentToken) return;

            const timeUntilExpiry = getTimeUntilExpiry(currentToken);
            if (timeUntilExpiry === null) return;

            // 已过期
            if (timeUntilExpiry <= 0) {
                console.log('[TokenRefresh] 页面恢复可见，token 已过期，退出登录');
                logout();
                return;
            }

            // 即将过期，立即刷新
            if (timeUntilExpiry < REFRESH_BEFORE_MS) {
                console.log('[TokenRefresh] 页面恢复可见，token 即将过期，立即刷新');
                void refreshToken().then(newToken => {
                    if (newToken) {
                        handleRefreshSuccess(newToken);
                    } else {
                        // 刷新失败但未过期，不 logout，等定时器重试
                        const remaining = getCurrentToken() ? getTimeUntilExpiry(getCurrentToken()!) : null;
                        if (!remaining || remaining <= 0) {
                            logout();
                        }
                        // 未过期则静默，scheduleRefresh 的重试机制会兜底
                    }
                });
            } else {
                // token 还很新，但可能定时器因为浏览器后台被冻结了，重新调度
                clearTimer();
                scheduleRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token, logout, clearTimer, handleRefreshSuccess]);
}
