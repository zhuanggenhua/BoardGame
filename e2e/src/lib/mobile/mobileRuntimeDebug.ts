import { registerPlugin } from '@capacitor/core';

type MobileRuntimeLogLevel = 'info' | 'warn' | 'error';

type MobileRuntimeLogPayload = Record<string, unknown>;

type NativeDiagnosticPlugin = {
    logDiagnostic(options: { message: string }): Promise<void>;
};

declare global {
    interface Window {
        __BOARDGAME_MOBILE_RUNTIME_LOGS__?: Array<{
            at: string;
            scope: string;
            stage: string;
            level: MobileRuntimeLogLevel;
            payload?: MobileRuntimeLogPayload;
        }>;
    }
}

const MAX_RUNTIME_LOG_COUNT = 200;
const nativeDiagnosticPlugin = registerPlugin<NativeDiagnosticPlugin>('GamePackage');

const shouldEmitMobileRuntimeLog = () => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        return true;
    }

    if (typeof window === 'undefined') {
        return false;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('mobileDebug') === '1') {
        return true;
    }

    try {
        if (window.localStorage.getItem('mobileDebug') === '1') {
            return true;
        }
    } catch {
        // 忽略 localStorage 不可用的运行环境。
    }

    return false;
};

const normalizePayload = (payload?: MobileRuntimeLogPayload) => {
    if (!payload) {
        return undefined;
    }

    return JSON.parse(JSON.stringify(payload, (_key, value) => {
        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack,
            };
        }
        return value;
    })) as MobileRuntimeLogPayload;
};

const pushRuntimeHistory = (
    entry: {
        at: string;
        scope: string;
        stage: string;
        level: MobileRuntimeLogLevel;
        payload?: MobileRuntimeLogPayload;
    },
) => {
    if (typeof window === 'undefined') {
        return;
    }

    const history = window.__BOARDGAME_MOBILE_RUNTIME_LOGS__ ?? [];
    history.push(entry);
    if (history.length > MAX_RUNTIME_LOG_COUNT) {
        history.splice(0, history.length - MAX_RUNTIME_LOG_COUNT);
    }
    window.__BOARDGAME_MOBILE_RUNTIME_LOGS__ = history;
};

export const logMobileRuntime = (
    scope: string,
    stage: string,
    payload?: MobileRuntimeLogPayload,
    level: MobileRuntimeLogLevel = 'info',
) => {
    if (!shouldEmitMobileRuntimeLog()) {
        return;
    }

    const at = new Date().toISOString();
    const normalizedPayload = normalizePayload(payload);
    const entry = {
        at,
        scope,
        stage,
        level,
        payload: normalizedPayload,
    };

    pushRuntimeHistory(entry);

    const message = `[${scope}] ${JSON.stringify({
        at,
        stage,
        ...normalizedPayload,
    })}`;

    if (level === 'warn') {
        console.warn(message);
        return;
    }

    if (level === 'error') {
        console.error(message);
        return;
    }

    console.info(message);
};

const tryNativeLog = (message: string) => {
    try {
        void nativeDiagnosticPlugin.logDiagnostic({ message }).catch(() => {});
    } catch {
        // best-effort
    }
};

export const logMobileRuntimeCritical = (
    scope: string,
    stage: string,
    payload?: MobileRuntimeLogPayload,
) => {
    const at = new Date().toISOString();
    const normalizedPayload = normalizePayload(payload);
    pushRuntimeHistory({
        at,
        scope,
        stage,
        level: 'info',
        payload: normalizedPayload,
    });
    const message = `[MOBILE_CRITICAL][${scope}] ${JSON.stringify({
        at,
        stage,
        ...normalizedPayload,
    })}`;
    console.info(message);
    tryNativeLog(message);
};
