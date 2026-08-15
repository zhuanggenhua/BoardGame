type CapacitorRuntimeLike = {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
};

type MobileRuntimeWindowLike = {
    Capacitor?: CapacitorRuntimeLike;
    androidBridge?: unknown;
    webkit?: {
        messageHandlers?: {
            bridge?: unknown;
        };
    };
    __BG_E2E_NATIVE_ANDROID_RUNTIME__?: boolean;
    __BG_E2E_NATIVE_IOS_RUNTIME__?: boolean;
};

const safeInvoke = <T,>(fn: () => T): T | undefined => {
    try {
        return fn();
    } catch {
        return undefined;
    }
};

export type NativeMobilePlatform = 'android' | 'ios';

export type NativeMobileRuntimeDiagnostics = {
    nativeMobile: boolean;
    nativeAndroid: boolean;
    nativeIos: boolean;
    platform?: NativeMobilePlatform;
    importCapacitorPlatform?: string;
    importCapacitorNative?: boolean;
    windowCapacitorPlatform?: string;
    windowCapacitorNative?: boolean;
    hasAndroidBridge: boolean;
    summary: string;
};

const normalizeNativePlatform = (value: string | undefined): NativeMobilePlatform | undefined => {
    if (value === 'android' || value === 'ios') {
        return value;
    }
    return undefined;
};

export const getNativeMobileRuntimeDiagnostics = (options?: {
    capacitor?: CapacitorRuntimeLike;
    windowObject?: MobileRuntimeWindowLike | undefined;
}): NativeMobileRuntimeDiagnostics => {
    const runtimeWindow = options?.windowObject ?? (
        typeof window !== 'undefined'
            ? window as typeof window & MobileRuntimeWindowLike
            : undefined
    );
    const capacitorRuntime = options?.capacitor ?? runtimeWindow?.Capacitor;

    const importCapacitorPlatform = safeInvoke(() => capacitorRuntime?.getPlatform?.());
    const importCapacitorNative = safeInvoke(() => capacitorRuntime?.isNativePlatform?.());
    const windowCapacitorPlatform = safeInvoke(() => runtimeWindow?.Capacitor?.getPlatform?.());
    const windowCapacitorNative = safeInvoke(() => runtimeWindow?.Capacitor?.isNativePlatform?.());
    const hasAndroidBridge = Boolean(runtimeWindow?.androidBridge);
    const hasIosBridge = Boolean(runtimeWindow?.webkit?.messageHandlers?.bridge);
    const hasE2ENativeAndroidOverride = import.meta.env.DEV
        && runtimeWindow?.__BG_E2E_NATIVE_ANDROID_RUNTIME__ === true;
    const hasE2ENativeIosOverride = import.meta.env.DEV
        && runtimeWindow?.__BG_E2E_NATIVE_IOS_RUNTIME__ === true;

    const importPlatform = normalizeNativePlatform(importCapacitorPlatform);
    const windowPlatform = normalizeNativePlatform(windowCapacitorPlatform);
    const nativeImportPlatform = importCapacitorNative === true ? importPlatform : undefined;
    const nativeWindowPlatform = windowCapacitorNative === true ? windowPlatform : undefined;
    const platform = hasE2ENativeAndroidOverride
        ? 'android'
        : hasE2ENativeIosOverride
            ? 'ios'
            : hasAndroidBridge
                ? 'android'
                : hasIosBridge
                    ? 'ios'
                    : nativeWindowPlatform ?? nativeImportPlatform;
    const nativeAndroid = platform === 'android';
    const nativeIos = platform === 'ios';
    const nativeMobile = nativeAndroid || nativeIos;

    return {
        nativeMobile,
        nativeAndroid,
        nativeIos,
        platform,
        importCapacitorPlatform,
        importCapacitorNative,
        windowCapacitorPlatform,
        windowCapacitorNative,
        hasAndroidBridge,
        summary: `import:${String(importCapacitorNative)}/${importCapacitorPlatform ?? '?'} win:${String(windowCapacitorNative)}/${windowCapacitorPlatform ?? '?'} platform:${platform ?? '?'} bridge:${hasAndroidBridge ? '1' : '0'}`,
    };
};

export const detectNativeMobileRuntime = (options?: {
    capacitor?: CapacitorRuntimeLike;
    windowObject?: MobileRuntimeWindowLike | undefined;
}) => getNativeMobileRuntimeDiagnostics(options).nativeMobile;

export const isNativeMobileRuntime = () => detectNativeMobileRuntime();

export const isNativeIosRuntime = () => getNativeMobileRuntimeDiagnostics().nativeIos;
