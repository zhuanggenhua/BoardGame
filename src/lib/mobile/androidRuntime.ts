import {
    getNativeMobileRuntimeDiagnostics,
    type NativeMobileRuntimeDiagnostics,
} from './mobileRuntime';

type CapacitorRuntimeLike = Parameters<typeof getNativeMobileRuntimeDiagnostics>[0] extends { capacitor?: infer T }
    ? T
    : never;
type AndroidRuntimeWindowLike = Parameters<typeof getNativeMobileRuntimeDiagnostics>[0] extends { windowObject?: infer T }
    ? T
    : never;

export const isAndroidShellBuildMode = (env: Partial<ImportMetaEnv> = import.meta.env) => env.MODE === 'android';

export type NativeAndroidRuntimeDiagnostics = Pick<
    NativeMobileRuntimeDiagnostics,
    | 'nativeAndroid'
    | 'importCapacitorPlatform'
    | 'importCapacitorNative'
    | 'windowCapacitorPlatform'
    | 'windowCapacitorNative'
    | 'hasAndroidBridge'
    | 'summary'
>;

export const getNativeAndroidRuntimeDiagnostics = (options?: {
    capacitor?: CapacitorRuntimeLike;
    windowObject?: AndroidRuntimeWindowLike | undefined;
}): NativeAndroidRuntimeDiagnostics => {
    const diagnostics = getNativeMobileRuntimeDiagnostics(options);
    const importedRuntimeExplicitlyReportsWeb = diagnostics.importCapacitorNative === false
        || diagnostics.importCapacitorPlatform === 'web';

    return {
        ...diagnostics,
        nativeAndroid: importedRuntimeExplicitlyReportsWeb
            ? false
            : diagnostics.nativeAndroid,
    };
};

export const detectNativeAndroidRuntime = (options?: {
    capacitor?: CapacitorRuntimeLike;
    windowObject?: AndroidRuntimeWindowLike | undefined;
}) => getNativeAndroidRuntimeDiagnostics(options).nativeAndroid;

export const isNativeAndroidRuntime = () => detectNativeAndroidRuntime();
