/**
 * 引擎通知事件（用于 UI 提示）
 */

export const ENGINE_NOTIFICATION_EVENT = 'engine:notification';

export type EngineNotificationDetail = {
    gameId: string;
    error: string;
};

export const dispatchEngineNotification = (detail: EngineNotificationDetail): void => {
    const host = typeof globalThis !== 'undefined' ? (globalThis as { window?: unknown; CustomEvent?: unknown }) : undefined;
    const win = host?.window as { dispatchEvent?: (event: unknown) => void } | undefined;
    const CustomEventCtor = host?.CustomEvent as (new (type: string, init?: { detail?: EngineNotificationDetail }) => unknown) | undefined;
    if (!win?.dispatchEvent || !CustomEventCtor) return;
    win.dispatchEvent(new CustomEventCtor(ENGINE_NOTIFICATION_EVENT, { detail }));
};
