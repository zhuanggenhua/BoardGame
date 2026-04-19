/**
 * 等待房间通知系统
 *
 * 当对手加入等待房间时，通过三种方式通知用户（对标 BGA）：
 * 1. 页面内提示音 — 播放一个短音效
 * 2. 标签页标题闪烁 — 标签页在后台时 document.title 交替闪烁
 * 3. 浏览器推送通知 — 用 Notification API 发送桌面通知（需用户授权）
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioManager } from '../../lib/audio/AudioManager';

// ============================================================================
// 提示音
// ============================================================================

/**
 * 播放玩家加入提示音
 *
 * 使用 Fantasy Notification A（清脆短促的通知音），
 * 语义贴合"有人加入房间"，与游戏内音效完全不重复。
 * 不依赖游戏层音频配置，在大厅/等待阶段也能播放。
 */
const PLAYER_JOIN_SOUND_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.notification_a_001';

function playJoinSound(): void {
    try {
        AudioManager.play(PLAYER_JOIN_SOUND_KEY);
    } catch {
        // 音频上下文未初始化或被浏览器阻止，静默忽略
    }
}

// ============================================================================
// 标签页标题闪烁
// ============================================================================

let originalTitle: string | null = null;

function setNotificationTitle(message: string): void {
    if (originalTitle !== null) return; // 已设置过，不重复
    originalTitle = document.title;
    document.title = message;
}

function restoreTitle(): void {
    if (originalTitle !== null) {
        document.title = originalTitle;
        originalTitle = null;
    }
}

// ============================================================================
// 浏览器推送通知
// ============================================================================

function isPageVisible(): boolean {
    return document.visibilityState === 'visible';
}

function sendBrowserNotification(title: string, body: string): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        const notification = new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'player-joined', // 同 tag 的通知会替换而非堆叠
        });
        // 点击通知时聚焦到当前标签页
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        // 5 秒后自动关闭
        setTimeout(() => notification.close(), 5000);
    } catch {
        // 某些环境（如 Service Worker 未注册）可能抛异常，静默忽略
    }
}

/**
 * 请求浏览器通知权限（仅在用户未做过选择时弹出授权提示）
 */
export function requestNotificationPermission(): void {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        void Notification.requestPermission();
    }
}

// ============================================================================
// Hook
// ============================================================================

export interface WaitingRoomNotificationOptions {
    /** 是否启用通知（教程模式/旁观模式应禁用） */
    enabled: boolean;
}

/**
 * 等待房间通知 Hook
 *
 * 返回 `notifyPlayerJoined` 回调，在检测到对手加入时调用。
 * 自动处理：
 * - 页面可见时：只播放提示音
 * - 页面不可见时：提示音 + 标题闪烁 + 浏览器推送通知
 * - 页面重新可见时：自动停止标题闪烁
 */
export function useWaitingRoomNotification({ enabled }: WaitingRoomNotificationOptions) {
    const { t } = useTranslation('lobby');
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;
    // 防止重复通知：对手加入只通知一次，后续断开/重连不再触发
    const notifiedRef = useRef(false);

    // 页面重新可见时停止标题闪烁
    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                restoreTitle();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            restoreTitle();
        };
    }, [enabled]);

    const notifyPlayerJoined = useCallback((playerName?: string) => {
        if (!enabledRef.current) return;
        if (notifiedRef.current) return;
        notifiedRef.current = true;

        // 1. 提示音（无论页面是否可见都播放）
        playJoinSound();

        // 2 & 3. 标签页不可见时：标题变更 + 浏览器推送
        if (!isPageVisible()) {
            const titleMessage = t('notification.playerJoinedTitle', '🎮 有玩家加入了房间');
            setNotificationTitle(titleMessage);

            const notifTitle = t('notification.playerJoinedTitle', '有玩家加入了房间');
            const notifBody = playerName
                ? t('notification.playerJoinedBody', { name: playerName, defaultValue: `${playerName} 加入了你的房间` })
                : t('notification.playerJoinedBodyAnonymous', '对手已加入，准备开始游戏');
            sendBrowserNotification(notifTitle, notifBody);
        }
    }, [t]);

    // 对手离开时重置，下次加入可再次通知
    const resetNotification = useCallback(() => {
        notifiedRef.current = false;
    }, []);

    return { notifyPlayerJoined, resetNotification, requestNotificationPermission };
}
