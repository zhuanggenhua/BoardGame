/**
 * 引擎通知事件（用于 UI 提示）
 */

export const ENGINE_NOTIFICATION_EVENT = 'engine:notification';

export type EngineNotificationDetail = {
    gameId: string;
    error: string;
};

export const dispatchEngineNotification = (detail: EngineNotificationDetail): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<EngineNotificationDetail>(ENGINE_NOTIFICATION_EVENT, { detail }));
};
