/**
 * Token 自动刷新 Hook
 * 
 * 在 token 即将过期前自动刷新，避免用户挂机后需要重新登录
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_API_URL } from '../config/server';

// 提前刷新时间（提前1天刷新）
const REFRESH_BEFORE_MS = 24 * 60 * 60 * 1000;

interface TokenPayload {
    userId: string;
    username: string;
    iat: number; // issued at (秒)
    exp: number; // expires at (秒)
}

/**
 * 解析 JWT token 获取过期时间
 */
function parseToken(token: string): TokenPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch {
        return null;
    }
}

/**
 * 计算距离过期还有多久（毫秒）
 */
function getTimeUntilExpiry(token: string): number | null {
    const payload = parseToken(token);
    if (!payload?.exp) return null;
    const expiryMs = payload.exp * 1000;
    return expiryMs - Date.now();
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
    const { token, logout } = useAuth();
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!token) {
            // 清理定时器
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        const scheduleRefresh = () => {
            const timeUntilExpiry = getTimeUntilExpiry(token);
            
            if (timeUntilExpiry === null) {
                console.warn('[TokenRefresh] 无法解析 token 过期时间');
                return;
            }

            // 已过期，立即退出登录
            if (timeUntilExpiry <= 0) {
                console.log('[TokenRefresh] Token 已过期，退出登录');
                logout();
                return;
            }

            // 计算刷新时机
            const refreshIn = Math.max(0, timeUntilExpiry - REFRESH_BEFORE_MS);
            
            console.log(`[TokenRefresh] 将在 ${Math.round(refreshIn / 1000 / 60)} 分钟后刷新 token`);

            timerRef.current = window.setTimeout(async () => {
                console.log('[TokenRefresh] 开始刷新 token');
                const newToken = await refreshToken();
                
                if (newToken) {
                    console.log('[TokenRefresh] Token 刷新成功');
                    localStorage.setItem('auth_token', newToken);
                    // 触发 storage 事件通知其他标签页
                    window.dispatchEvent(new Event('storage'));
                } else {
                    console.warn('[TokenRefresh] Token 刷新失败，退出登录');
                    logout();
                }
            }, refreshIn);
        };

        scheduleRefresh();

        // 监听 visibilitychange，页面恢复可见时检查 token 是否需要刷新
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                const timeUntilExpiry = getTimeUntilExpiry(token);
                if (timeUntilExpiry !== null && timeUntilExpiry < REFRESH_BEFORE_MS) {
                    console.log('[TokenRefresh] 页面恢复可见，token 即将过期，立即刷新');
                    void refreshToken().then(newToken => {
                        if (newToken) {
                            localStorage.setItem('auth_token', newToken);
                            window.dispatchEvent(new Event('storage'));
                        } else {
                            logout();
                        }
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token, logout]);
}
