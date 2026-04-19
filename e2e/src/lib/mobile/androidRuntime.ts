import { Capacitor } from '@capacitor/core';

type CapacitorRuntimeLike = {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
};

type AndroidRuntimeWindowLike = {
    Capacitor?: CapacitorRuntimeLike;
    androidBridge?: unknown;
};

const safeInvoke = <T,>(fn: () => T): T | undefined => {
    try {
        return fn();
    } catch {
        return undefined;
    }
};

export const isAndroidShellBuildMode = (env: Partial<ImportMetaEnv> = import.meta.env) => env.MODE === 'android';

export type NativeAndroidRuntimeDiagnostics = {
    nativeAndroid: boolean;
    importCapacitorPlatform?: string;
    importCapacitorNative?: boolean;
    windowCapacitorPlatform?: string;
    windowCapacitorNative?: boolean;
    hasAndroidBridge: boolean;
    summary: string;
};

export const getNativeAndroidRuntimeDiagnostics = (options?: {
    capacitor?: CapacitorRuntimeLike;
    windowObject?: AndroidRuntimeWindowLike | undefined;
}): NativeAndroidRuntimeDiagnostics => {
    const capacitorRuntime = options?.capacitor ?? Capacitor;
    const runtimeWindow = options?.windowObject ?? (
        typeof window !== 'undefined'
            ? window as typeof window & AndroidRuntimeWindowLike
            : undefined
    );

    const importCapacitorPlatform = safeInvoke(() => capacitorRuntime.getPlatform?.());
    const importCapacitorNative = safeInvoke(() => capacitorRuntime.isNativePlatform?.());
    const windowCapacitorPlatform = safeInvoke(() => runtimeWindow?.Capacitor?.getPlatform?.());
    const windowCapacitorNative = safeInvoke(() => runtimeWindow?.Capacitor?.isNativePlatform?.());
    const hasAndroidBridge = Boolean(runtimeWindow?.androidBridge);
    const hasImportRuntimeSignal = typeof importCapacitorNative === 'boolean' || typeof importCapacitorPlatform === 'string';
    const nativeAndroid = hasImportRuntimeSignal
        ? Boolean(importCapacitorNative && importCapacitorPlatform === 'android')
        : Boolean(windowCapacitorNative && windowCapacitorPlatform === 'android');

    return {
        nativeAndroid,
        importCapacitorPlatform,
        importCapacitorNative,
        windowCapacitorPlatform,
        windowCapacitorNative,
        hasAndroidBridge,
        summary: `import:${String(importCapacitorNative)}/${importCapacitorPlatform ?? '?'} win:${String(windowCapacitorNative)}/${windowCapacitorPlatform ?? '?'} bridge:${hasAndroidBridge ? '1' : '0'}`,
    };
};

export const detectNativeAndroidRuntime = (options?: {
    capacitor?: CapacitorRuntimeLike;
    windowObject?: AndroidRuntimeWindowLike | undefined;
}) => getNativeAndroidRuntimeDiagnostics(options).nativeAndroid;

export const isNativeAndroidRuntime = () => detectNativeAndroidRuntime();
